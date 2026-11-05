import { Hono } from 'hono';
import { redis } from '@devvit/web/server';
import { ACTIVE_MATCHES_KEY } from './queue';
import { authoritativeProcessor } from './authoritativeRuntime';
import type { Intent } from './authoritativeTypes';
import {
	appendMessage,
	claimHost,
	getLobbyMeta,
	getMessages,
	getPlayers,
	isPlayerStale,
	markPlayerSeen,
	newLobbyCode,
	newPeerId,
	refreshTtl,
	removePlayer,
	setLobbyMeta,
	setPlayer,
	type LobbyMeta,
	type PlayerRecord,
} from './lobby';

export const lobby = new Hono();

// POST /api/lobby
lobby.post('/', async (c) => {
	const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
	const code =
		String(body.code || '')
			.trim()
			.toUpperCase()
			.replace(/[^A-Z0-9-]/g, '') || newLobbyCode();
	const rawConfig = body.config;
	const config =
		rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig)
			? (rawConfig as Record<string, unknown>)
			: {};

	const meta: LobbyMeta = {
		code,
		config,
		status: 'waiting',
		hostPeerId: '',
		createdAt: Date.now(),
	};
	await setLobbyMeta(code, meta);

	return c.json({ code });
});

// POST /api/lobby/:code/join
lobby.post('/:code/join', async (c) => {
	const code = c.req.param('code');
	const body = await c.req.json().catch(() => ({} as Record<string, unknown>));

	const meta = await getLobbyMeta(code);
	if (!meta) {
		return c.json({ error: 'Lobby not found' }, 404);
	}

	const myId = newPeerId();
	const players = await getPlayers(code);
	let playerIndex = -1;

	// Host status is decided atomically by the server, not the client's requested `isHost`
	// flag: the first peer to successfully claim the host slot for this lobby wins. This
	// matters for matchmaking-created lobbies (see queue.ts's createLobby), where neither
	// matched player explicitly "creates" the lobby — both would otherwise request
	// isHost:false and no host would ever be set, which meant the host-only "start once 2
	// players are present" logic never fired. A plain "is hostPeerId already set?" check has a
	// race window since both players can join within milliseconds of each other; claimHost()
	// uses an atomic SET NX so exactly one of them wins even in that case.
	const becomingHost = await claimHost(code, myId);

	if (becomingHost) {
		meta.hostPeerId = myId;
		playerIndex = 0;
		await setLobbyMeta(code, meta);
	} else {
		const usedIndexes = new Set(players.map((p) => p.playerIndex));
		for (let i = 1; i < 8; i += 1) {
			if (!usedIndexes.has(i)) {
				playerIndex = i;
				break;
			}
		}
	}

	const player: PlayerRecord = {
		peerId: myId,
		playerId: myId,
		name: String(body.name || myId),
		playerIndex,
		lastSeen: Date.now(),
	};

	await setPlayer(code, player);
	await markPlayerSeen(code, myId);
	await refreshTtl(code);

	if (meta.bot) {
		const currentPlayers = await getPlayers(code);
		const realPlayers = currentPlayers.filter((p) => !p.playerId.startsWith('bot-'));
		if (realPlayers.length === 1) {
			const botPlayerId = `bot-${code}`;
			const botPeerId = `bot-${code}`;
			const usedIndexes = new Set(currentPlayers.map((p) => p.playerIndex));
			let botPlayerIndex = -1;
			for (let i = 1; i < 8; i += 1) {
				if (!usedIndexes.has(i)) {
					botPlayerIndex = i;
					break;
				}
			}

			const botPlayer: PlayerRecord = {
				peerId: botPeerId,
				playerId: botPlayerId,
				name: 'CPU',
				playerIndex: botPlayerIndex,
				lastSeen: Date.now(),
			};

			await setPlayer(code, botPlayer);

			await appendMessage(code, botPeerId, {
				type: 'player-joined',
				player: {
					playerId: botPlayer.playerId,
					peerId: botPlayer.peerId,
					name: botPlayer.name,
					playerIndex: botPlayer.playerIndex,
				},
			});
		}
	}

	await appendMessage(code, myId, {
		type: 'player-joined',
		player: {
			playerId: player.playerId,
			peerId: player.peerId,
			name: player.name,
			playerIndex: player.playerIndex,
		},
	});

	return c.json({ myId, playerIndex, isHost: becomingHost });
});

// POST /api/lobby/:code/message
lobby.post('/:code/message', async (c) => {
	const code = c.req.param('code');
	const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
	const from = String(body.playerId || 'unknown');

	const meta = await getLobbyMeta(code);
	if (!meta) {
		return c.json({ error: 'Lobby not found' }, 404);
	}

	const cursor = await appendMessage(code, from, body.message as Record<string, unknown>);
	await markPlayerSeen(code, from);
	await refreshTtl(code);

	// Server-authoritative intent: append to the ordered log so any consumer
	// that replays it through the engine gets the same state. The server is
	// engine-agnostic — the engine (`LobbyEngine`/`game.ts`) runs in the
	// client browser (or a dedicated engine node) and pulls pixi/phaser
	// through its own bundle. The Devvit serverless bundle intentionally
	// stays free of those browser-only deps. Guarded so a processor failure
	// never breaks normal message relay.
	if (body.message && (body.message as Record<string, unknown>).type === 'intent') {
		try {
			const { sequence } = await authoritativeProcessor.step(
				code,
				(body.message as { intent: Intent }).intent,
			);
			await appendMessage(code, meta.hostPeerId || 'server', {
				type: 'intent-ack',
				sequence,
			});
		} catch (error) {
			console.warn('[lobby] authoritative intent failed:', error);
		}
	}

	return c.json({ cursor });
});

// POST /api/lobby/:code/start
lobby.post('/:code/start', async (c) => {
	const code = c.req.param('code');
	const meta = await getLobbyMeta(code);
	if (!meta) {
		return c.json({ error: 'Lobby not found' }, 404);
	}

	meta.status = 'playing';
	await setLobbyMeta(code, meta);
	await redis.zAdd(ACTIVE_MATCHES_KEY, { member: code, score: Date.now() });

	const players = await getPlayers(code);

	await appendMessage(code, meta.hostPeerId, {
		type: 'match-start',
		config: meta.config,
		players: players.map((p) => ({
			playerId: p.playerId,
			peerId: p.peerId,
			name: p.name,
			playerIndex: p.playerIndex,
			isBot: p.playerId.startsWith('bot-'),
		})),
		host: meta.hostPeerId,
		hostPeerId: meta.hostPeerId,
	});

	await refreshTtl(code);

	return c.json({ ok: true });
});

// POST /api/lobby/:code/leave
lobby.post('/:code/leave', async (c) => {
	const code = c.req.param('code');
	const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
	const from = String(body.playerId || 'unknown');
	await removePlayer(code, from);

	const players = await getPlayers(code);
	if (players.length === 0) {
		await redis.del(`ab:lobby:${code}:meta`);
		await redis.del(`ab:lobby:${code}:players`);
		await redis.del(`ab:lobby:${code}:log`);
		await redis.del(`ab:lobby:${code}:cursor`);
		await redis.zRem(ACTIVE_MATCHES_KEY, [code]);
	} else {
		await appendMessage(code, from, {
			type: 'player-left',
			playerId: from,
			player: {
				playerId: from,
				peerId: from,
				name: from,
				playerIndex: -1,
			},
		});
	}

	await refreshTtl(code);

	return c.json({ ok: true });
});

// GET /api/lobby/:code/messages
lobby.get('/:code/messages', async (c) => {
	const code = c.req.param('code');
	const after = c.req.query('after') || '0';
	const playerId = c.req.query('playerId');
	if (playerId) {
		await markPlayerSeen(code, playerId);
	}
	const entries = await getMessages(code, after);

	return c.json(entries);
});

// GET /api/lobby/:code/state
lobby.get('/:code/state', async (c) => {
	const code = c.req.param('code');
	const playerId = c.req.query('playerId');
	if (playerId) {
		await markPlayerSeen(code, playerId);
	}

	const meta = await getLobbyMeta(code);
	if (!meta) {
		return c.json({ error: 'Lobby not found' }, 404);
	}

	let players = await getPlayers(code);
	const activePlayers: PlayerRecord[] = [];

	for (const player of players) {
		if (!(await isPlayerStale(code, player.peerId))) {
			activePlayers.push(player);
		}
	}

	if (activePlayers.length !== players.length) {
		for (const stale of players) {
			if (activePlayers.find((p) => p.peerId === stale.peerId)) {
				continue;
			}
			await removePlayer(code, stale.peerId);
		}
		players = activePlayers;
	}

	await refreshTtl(code);

	return c.json({
		players: players.map((p) => ({
			peerId: p.peerId,
			playerId: p.playerId,
			name: p.name,
			playerIndex: p.playerIndex,
		})),
		config: meta.config,
		status: meta.status,
		host: meta.hostPeerId,
		hostPlayerId: meta.hostPeerId,
	});
});
