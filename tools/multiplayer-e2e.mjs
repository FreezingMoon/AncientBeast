/**
 * Online multiplayer end-to-end test (PeerJS).
 *
 * Not part of the Jest suites on purpose: it drives a real headless Chromium
 * against the live dev server and the public PeerJS broker, so it needs network
 * access. If nothing is serving on the port yet, it starts its own Vite dev
 * server and shuts it down afterwards.
 *
 * What it does, with two pages in one browser:
 *   1. Host clicks "Create Lobby" → PeerJS registers ab-lobby-<code> on the
 *      public broker.
 *   2. Joiner opens /?join=<code> → auto-joins; host auto-starts the match.
 *   3. Both clients must reach gameState === 'playing' with identical state.
 *   4. A real move (hex select → confirm) and alternating turn skips must relay
 *      to the other client, keeping both boards in lockstep.
 *
 * Run from repo root: bun run multiplayer   (or: node tools/multiplayer-e2e.mjs)
 * Override the port (and the self-started server's port) with AB_PORT.
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const PORT = process.env.AB_PORT ?? '8080';
const BASE = `http://localhost:${PORT}`;
const results = [];
const check = (name, ok, detail = '') => {
	results.push({ name, ok });
	console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
};

// ── 0. Ensure a dev server is up; start one if nothing answers ──────────────
const alive = () =>
	fetch(BASE, { signal: AbortSignal.timeout(2000) }).then(
		(r) => r.ok,
		() => false,
	);
let devServer = null;
if (await alive()) {
	console.log(`♻️  Reusing dev server already running at ${BASE}`);
} else {
	console.log(`🚀 No dev server at ${BASE} — starting Vite...`);
	// detached → own process group, so the whole Vite/esbuild tree dies on cleanup.
	// BROWSER=none suppresses the configured `server.open` auto-launch.
	devServer = spawn('npx', ['vite', '--port', PORT, '--strictPort'], {
		stdio: 'ignore',
		detached: true,
		env: { ...process.env, BROWSER: 'none' },
	});
	const deadline = Date.now() + 60_000;
	while (!(await alive())) {
		if (devServer.exitCode !== null || Date.now() > deadline) {
			console.error('❌ Vite dev server failed to start within 60 s');
			if (devServer.exitCode === null) process.kill(-devServer.pid, 'SIGTERM');
			process.exit(1);
		}
		await new Promise((r) => setTimeout(r, 500));
	}
	console.log(`🚀 Vite ready at ${BASE}`);
}

const browser = await chromium
	.launch({ headless: true })
	.catch(() => chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome' }));

const ctx = await browser.newContext();
const host = await ctx.newPage();
const join = await ctx.newPage();
const errors = { host: [], join: [] };
for (const [name, p] of [
	['host', host],
	['join', join],
]) {
	p.on('pageerror', (e) => errors[name].push(e.message));
	p.on('console', (m) => {
		if (m.type() === 'error') errors[name].push(`console: ${m.text().slice(0, 200)}`);
	});
}

const snap = (p) =>
	p.evaluate(() => ({
		multiplayer: window.G.multiplayer,
		turn: window.G.turn,
		activeId: window.G.activeCreature?.id ?? null,
		activePlayer: window.G.activeCreature?.player?.id ?? null,
		isMyTurn: window.G.lobby?.isMyTurn?.() ?? null,
		isHost: window.G.lobby?.isHost?.() ?? null,
		creatures: window.G.creatures
			.filter((c) => c && !c.dead)
			.map((c) => `${c.name}#${c.id}p${c.player.id}@${c.x},${c.y}`)
			.sort(),
	}));

try {
	// ── 1. Host creates lobby ────────────────────────────────────────────────
	await host.goto(BASE, { waitUntil: 'domcontentloaded' });
	await host.waitForSelector('#createLobbyButton', { timeout: 30000 });
	await host.evaluate(() => document.querySelector('#createLobbyButton').click());
	await host.waitForFunction(
		() => (document.querySelector('#lobbyCode')?.value ?? '') !== '',
		null,
		{ timeout: 30000, polling: 250 },
	);
	const code = await host.evaluate(() => document.querySelector('#lobbyCode').value);
	check('host creates lobby via PeerJS broker', /^AB-/.test(code), `code ${code}`);

	// ── 2. Second client joins; host auto-starts ────────────────────────────
	await join.goto(`${BASE}/?join=${encodeURIComponent(code)}`, {
		waitUntil: 'domcontentloaded',
	});
	const playing = (p) =>
		p.waitForFunction(() => window.G?.gameState === 'playing', null, {
			timeout: 120000,
			polling: 500,
		});
	await Promise.all([playing(host), playing(join)]);
	check('both clients reach gameState=playing', true);

	// Give the first turn a moment to settle on both sides.
	await host.waitForTimeout(2000);

	// ── 3. Initial state must match ──────────────────────────────────────────
	let h = await snap(host);
	let j = await snap(join);
	check('both flagged multiplayer', h.multiplayer === true && j.multiplayer === true);
	check('exactly one side is host', h.isHost !== j.isHost, `host=${h.isHost}/join=${j.isHost}`);
	check(
		'same active creature on both clients',
		h.activeId !== null && h.activeId === j.activeId,
		`#${h.activeId} vs #${j.activeId}`,
	);
	check(
		'same board state on both clients',
		JSON.stringify(h.creatures) === JSON.stringify(j.creatures),
		h.creatures.join(' | '),
	);
	check(
		'turn ownership is exclusive',
		h.isMyTurn !== j.isMyTurn,
		`host=${h.isMyTurn}/join=${j.isMyTurn}`,
	);

	// ── 4. Move relay: real input path (hex confirm) on the turn owner ───────
	h = await snap(host);
	j = await snap(join);
	const mover = h.isMyTurn ? host : join;
	const spectator = mover === host ? join : host;
	const moveRes = await mover.evaluate(() => {
		const G = window.G;
		const c = G.activeCreature;
		const from = { x: c.x, y: c.y };
		const candidates = [];
		G.grid.hexes.forEach((row) =>
			row.forEach((hx) => {
				if (hx.reachable && !hx.creature) candidates.push(hx);
			}),
		);
		if (!candidates.length) return { ok: false, reason: 'no reachable hex' };
		candidates.sort(
			(a, b) =>
				Math.abs(a.x - from.x) +
				Math.abs(a.y - from.y) -
				(Math.abs(b.x - from.x) + Math.abs(b.y - from.y)),
		);
		const target = candidates[0];
		target.onSelectFn?.(target);
		target.onConfirmFn?.(target);
		return { ok: true, from, to: { x: target.x, y: target.y }, id: c.id };
	});
	check(
		'move: found reachable hex and clicked it',
		moveRes.ok,
		moveRes.reason ??
			`#${moveRes.id} ${JSON.stringify(moveRes.from)} → ${JSON.stringify(moveRes.to)}`,
	);
	if (moveRes.ok) {
		const atTarget = (p) =>
			p
				.waitForFunction(
					({ id, to }) => {
						const c = window.G.creatures.find((cc) => cc && cc.id === id);
						return !!c && c.x === to.x && c.y === to.y;
					},
					{ id: moveRes.id, to: moveRes.to },
					{ timeout: 20000, polling: 250 },
				)
				.then(
					() => true,
					() => false,
				);
		const [mOk, sOk] = await Promise.all([atTarget(mover), atTarget(spectator)]);
		check('move: applied locally', mOk);
		check('move: relayed to remote client', sOk);
		await host.waitForTimeout(1500);
		const hm = await snap(host);
		const jm = await snap(join);
		check(
			'move: board still in lockstep',
			JSON.stringify(hm.creatures) === JSON.stringify(jm.creatures),
			hm.creatures.join(' | '),
		);
	}

	// ── 5. Turn-relay sync: skip turns alternately ───────────────────────────
	for (let i = 0; i < 4; i++) {
		h = await snap(host);
		j = await snap(join);
		const actor = h.isMyTurn ? host : j.isMyTurn ? join : null;
		const watcher = actor === host ? join : host;
		if (!actor) {
			check(
				`skip #${i + 1}: an actor owns the turn`,
				false,
				'neither side thinks it is their turn',
			);
			break;
		}
		const prev = (await snap(actor)).activeId;
		await actor.evaluate(() => window.G.skipTurn());
		// Both clients must advance past the skipped creature.
		const advanced = (p) =>
			p
				.waitForFunction(
					(prevId) => window.G.activeCreature && window.G.activeCreature.id !== prevId,
					prev,
					{ timeout: 20000, polling: 250 },
				)
				.then(
					() => true,
					() => false,
				);
		const sameCreatureNext = (await snap(actor)).activeId === prev;
		const [aOk, wOk] = await Promise.all([
			sameCreatureNext ? Promise.resolve(true) : advanced(actor),
			sameCreatureNext ? Promise.resolve(true) : advanced(watcher),
		]);
		// Distributed state settles asynchronously (nextCreature has ~350ms of
		// staged hand-over), so assert convergence within a deadline rather than
		// sampling after a fixed delay.
		let ha, ja;
		let converged = false;
		for (let t = 0; t < 40 && !converged; t++) {
			await host.waitForTimeout(250);
			[ha, ja] = await Promise.all([snap(host), snap(join)]);
			converged = ha.activeId !== null && ha.activeId === ja.activeId && ha.turn === ja.turn;
		}
		check(
			`skip #${i + 1}: turn advance relayed (actor=${actor === host ? 'host' : 'join'})`,
			aOk && wOk && converged,
			`active #${ha.activeId} vs #${ja.activeId}, round ${ha.turn}/${ja.turn}`,
		);
		check(
			`skip #${i + 1}: board still in lockstep`,
			JSON.stringify(ha.creatures) === JSON.stringify(ja.creatures),
		);
	}
} catch (e) {
	check('unexpected failure', false, e.message.split('\n')[0]);
} finally {
	const realErrors = Object.fromEntries(
		Object.entries(errors).map(([k, v]) => [
			k,
			v.filter((m) => !/favicon|404|Failed to load resource|AudioContext/i.test(m)),
		]),
	);
	console.log('\npage errors:', JSON.stringify(realErrors, null, 1));
	await browser.close();
	if (devServer) {
		try {
			process.kill(-devServer.pid, 'SIGTERM');
			console.log('🧹 Stopped the self-started Vite dev server');
		} catch {
			/* already gone */
		}
	}
	const failed = results.filter((r) => !r.ok).length;
	console.log(`\n${results.length - failed}/${results.length} checks passed`);
	process.exit(failed ? 1 : 0);
}
