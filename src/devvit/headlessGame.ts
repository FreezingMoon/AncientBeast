/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-function */
/* global NodeListOf */
import * as fs from 'fs';
import * as nodePath from 'path';
import { setBoardCamera } from '../game-display/camera';
import { setClockScene } from '../timing/clock';

// ─────────────────────────────────────────────────────────────────────────────
// Headless game harness for the authoritative server.
//
// This is a jest-independent extraction of the mocks botgeria/simulate already
// use to run the full engine with rendering, animations, jQuery and audio
// stubbed out. Because the engine is deterministic and already runs headless in
// tests, the Devvit server (Node) can import this, apply client `Intent`s
// through the real engine, and broadcast the resulting `AuthoritativeState`.
//
// The only thing that differs from botgeria is intent: there `runMatch` lets the
// BotController auto-play. Here we expose `applyIntent`/`stepGame` so the SERVER
// drives the engine from client inputs, and `serializeState` so it can broadcast
// the authoritative result.
// ─────────────────────────────────────────────────────────────────────────────

// Real UI markup (contains every #id the UI constructor looks up). Loaded into
// the jsdom/server DOM so the real `new UI()` during setup() can complete; the
// dummy shim below covers any stragglers.
let TEMPLATE_HTML = '';
try {
	TEMPLATE_HTML = fs.readFileSync(
		nodePath.resolve(__dirname, '../templates/interface.html'),
		'utf8',
	);
} catch {
	// Server builds may relocate the template; the dummy shim still covers setup.
}

// ─── DOM bootstrap (jsdom / server-with-jsdom only) ──────────────────────────

/**
 * The real `UI` constructor runs during `Game.setup()` and touches DOM ids. The
 * headless engine stubs `game.UI` after setup, so we only need these elements to
 * *exist* for the constructor to complete. Called only when a `document` exists.
 */
function ensureHeadlessDom(): void {
	if (typeof document === 'undefined' || !document.body) return;
	if (typeof (globalThis as { fetch?: unknown }).fetch === 'undefined') {
		(globalThis as { fetch?: unknown }).fetch = () =>
			Promise.reject(new Error('headless: network disabled'));
	}
	// `plasma-field` calls `getContext('2d')` and tolerates a null return, which
	// used to be all jsdom could offer. That assumption is now false — the
	// optional `canvas` package is installed and provides a real 2D context — and
	// forcing null regardless sabotages Phaser, whose text metrics take a hard
	// dependency on a working context and throw outright on null.
	//
	// So probe for the capability and only stub where it is genuinely missing.
	const gAny = globalThis as any;
	if (gAny.HTMLCanvasElement) {
		const probe = document.createElement('canvas');
		if (!probe.getContext('2d')) {
			gAny.HTMLCanvasElement.prototype.getContext = () => null;
		}
	}

	if (TEMPLATE_HTML) {
		const bodyMatch = TEMPLATE_HTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
		const bodyHtml = bodyMatch ? bodyMatch[1] : TEMPLATE_HTML;
		const holder = document.createElement('div');
		holder.innerHTML = bodyHtml;
		while (holder.firstChild) document.body.appendChild(holder.firstChild);
	}

	// Fallback: return stable dummy elements for any id/selector not present.
	const cache = new Map<string, any>();
	const makeDummy = (id?: string) => {
		const el = document.createElement('div');
		if (id) el.id = id;
		document.body.appendChild(el);
		return el;
	};
	const origGet = document.getElementById.bind(document);
	document.getElementById = ((id: string) => {
		const found = origGet(id);
		if (found) return found;
		if (!cache.has(id)) cache.set(id, makeDummy(id));
		return cache.get(id) as HTMLElement;
	}) as typeof document.getElementById;
	const origQuery = document.querySelector.bind(document);
	document.querySelector = ((sel: string) => {
		const found = origQuery(sel);
		if (found) return found;
		if (!cache.has(sel))
			cache.set(
				sel,
				makeDummy(typeof sel === 'string' ? (sel.match(/#([\w-]+)/) || [])[1] : undefined),
			);
		return cache.get(sel) as HTMLElement;
	}) as typeof document.querySelector;

	// jQuery (used by the real UI) resolves selectors via querySelectorAll, so
	// shim that too — returning a single id'd dummy keeps `.attr('id')` defined.
	const origQSA = document.querySelectorAll.bind(document);
	document.querySelectorAll = ((sel: string) => {
		const found = origQSA(sel);
		if (found && found.length) return found;
		const key = `qsa:${sel}`;
		if (!cache.has(key)) {
			const id = typeof sel === 'string' ? (sel.match(/#([\w-]+)/) || [])[1] : undefined;
			cache.set(key, [makeDummy(id)]);
		}
		return cache.get(key) as unknown as NodeListOf<HTMLElement>;
	}) as typeof document.querySelectorAll;
}

// ─── UI / sound stubs ────────────────────────────────────────────────────────

function deepNoop(): unknown {
	const fn = function () {
		return deepNoop();
	};
	return new Proxy(fn, { get: () => deepNoop(), apply: () => deepNoop() });
}

function makeUiStub() {
	const base: Record<string, unknown> = {
		selectedAbility: -1,
		dashopen: false,
		active: false,
		materializeToggled: false,
		_abilityPanelAnimating: false,
		logScrollEnabled: false,
		plasmaBars: [],
		chat: { hide: deepNoop(), addMsg: deepNoop(), suppressMessage: deepNoop() },
		cardWrapper: { find: () => ({ hide: deepNoop(), show: deepNoop() }) },
	};
	return new Proxy(base, {
		get(target, prop) {
			return prop in target ? target[prop as string] : deepNoop();
		},
		set(target, prop, value) {
			target[prop as string] = value;
			return true;
		},
	});
}

function makeSoundSysStub() {
	const noop = () => undefined;
	return {
		playMusic: noop,
		stopMusic: noop,
		playSFX: () => ({ stop: noop }),
		playSFXLoop: () => ({ stop: noop }),
		stopSFX: noop,
		playHeartBeat: noop,
		loadSound: noop,
		playShout: noop,
	};
}

// ─── Headless config ─────────────────────────────────────────────────────────

export interface HeadlessConfig {
	gameMode: number;
	plasma_amount: number;
	creaLimitNbr: number;
	abilityUpgrades: number;
	unitDrops: number;
	timePool: number;
	turnTimePool: number;
	/** Player indices that should be controlled by humans (no bot auto-play). */
	players: number[];
}

export const DEFAULT_HEADLESS_CONFIG: HeadlessConfig = {
	gameMode: 2,
	plasma_amount: 50,
	creaLimitNbr: 7,
	abilityUpgrades: 1,
	unitDrops: 0,
	timePool: -1,
	turnTimePool: -1,
	players: [0, 1],
};

export interface HeadlessGameOptions {
	/** When true, every player is a bot and the BotController auto-plays (for generating logs). */
	auto?: boolean;
	config?: Partial<HeadlessConfig>;
}

// ─── Server DOM shim (Devvit Node runtime — no DOM by default) ───────────────

/**
 * The Devvit server runs on Node with no `document`/`window`. The engine still
 * constructs `UI`/canvas during `setup()`, so before creating a game on the
 * server we install a minimal jsdom environment as globals. This is what makes
 * `createHeadlessGame` usable server-side (the authoritative engine / route).
 * The real UI is stubbed after setup, so only element *existence* matters.
 */
async function installServerDom(): Promise<void> {
	if (typeof document !== 'undefined') return;
	const { JSDOM } = (await import('jsdom')) as any;
	const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
	const g = globalThis as any;
	g.window = dom.window;
	g.document = dom.window.document;
	g.navigator = dom.window.navigator;
	g.HTMLElement = dom.window.HTMLElement;
	g.HTMLCanvasElement = dom.window.HTMLCanvasElement;
	g.Image = dom.window.Image;
	g.requestAnimationFrame = (cb: (t: number) => void) =>
		setTimeout(() => cb(Date.now()), 16) as unknown as number;
	g.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

// ─── Game factory ─────────────────────────────────────────────────────────────

/**
 * Build and start a headless game instance (no renderer). Mirrors botgeria's
 * createGame but is jest-free and parameterised. `players` in the resolved
 * config decide which seats are human (so the engine waits for our `Intent`s
 * instead of the BotController auto-playing).
 */
export async function createHeadlessGame(
	abilities: Array<(G: any) => void>,
	options: HeadlessGameOptions = {},
): Promise<any> {
	// On the server (no DOM) install a jsdom shim before the engine constructs UI.
	if (typeof document === 'undefined') await installServerDom();

	(
		globalThis as { requestAnimationFrame?: any; cancelAnimationFrame?: any }
	).requestAnimationFrame = (_cb: () => void) => 0;
	(globalThis as { cancelAnimationFrame?: any }).cancelAnimationFrame = (_id: number) => undefined;

	const config: HeadlessConfig = {
		...DEFAULT_HEADLESS_CONFIG,
		...(options.config ?? {}),
		players: options.auto ? [] : options.config?.players ?? DEFAULT_HEADLESS_CONFIG.players,
	};

	ensureHeadlessDom();

	const GameModule = await import('../game');
	const Game = GameModule.default;
	const game: any = new Game();

	// Real `Phaser.HEADLESS`, booted through the same `createPhaser()` the
	// browser uses — same `GameScene`, same `Phaser4Engine` wrapper, same
	// genuine `EventEmitter` channels, same AB clock bound to the scene. The
	// authoritative server is now running the engine that runs in production,
	// with rendering the only thing switched off.
	//
	// `HEADLESS` because there is no display for Phaser to pick a renderer from,
	// and `parent: null` because it has no canvas to mount into.
	//
	// The driver goes in *before* `createPhaser()`, because the scene's
	// `TweenManager` reads the clock while `createPhaser()` builds it; installed
	// afterwards, every tween would be keyed to a start time the virtual clock
	// has already moved past, and none of them would ever complete.
	const { getPhaser } = await import('../phaser/runtime');
	const { createHeadlessDriver } = await import('../phaser/headless');
	const driver = createHeadlessDriver();
	game.headlessDriver = driver;
	await game.createPhaser({ type: getPhaser().HEADLESS, parent: null });
	// `setup()` builds sprites, so it has to wait for the scene's GameObject
	// factory. Nothing drives the scene boot under `HEADLESS` on its own.
	await game.whenSceneReady();
	if (game.Phaser) driver.attach(game.Phaser);

	game.soundsys = makeSoundSysStub();
	game.musicPlayer = { audio: { pause: () => undefined } };

	game.configData = {
		players: config.players,
		gameMode: config.gameMode,
		plasma_amount: config.plasma_amount,
		creaLimitNbr: config.creaLimitNbr,
		abilityUpgrades: config.abilityUpgrades,
		unitDrops: config.unitDrops,
		timePool: config.timePool,
		turnTimePool: config.turnTimePool,
	};
	game.plasma_amount = config.plasma_amount;
	game.creaLimitNbr = config.creaLimitNbr;
	game.abilityUpgrades = config.abilityUpgrades;
	game.unitDrops = config.unitDrops;
	game.timePool = config.timePool;
	game.turnTimePool = config.turnTimePool;
	game.gameMode = config.gameMode;

	for (const loader of abilities) loader(game);

	const unitsModule = await import('../data/units');
	game.loadUnitData(unitsModule.unitData);

	// `setup()` builds the real `Animations` on top of the real scene. Movement
	// is therefore tween-driven, and `settle()` advances the frames that move
	// those tweens along — the same path the browser takes, minus the pixels.
	game.setup(config.gameMode);

	// Collapse ability animation delays (350ms/500ms) to ~1ms so the engine
	// advances without real-time waiting. Logic is untouched — only cosmetic
	// timers are clamped, exactly as botgeria does.
	const abilityModule = await import('../ability');
	const AbilityClass = abilityModule.Ability;
	if (!(AbilityClass.prototype.animation2 as { _simPatched?: boolean })._simPatched) {
		AbilityClass.prototype.animation2 = function (this: any, o: any) {
			const g = this.game;
			const opt = Object.assign({ callback: () => {}, arg: {} }, o);
			const args = opt.arg;
			const activateAbility = () => {
				const _origST = (globalThis as { setTimeout?: unknown }).setTimeout;
				(globalThis as { setTimeout?: unknown }).setTimeout = (
					fn: (...args: unknown[]) => void,
					delay: number,
					...a: unknown[]
				) =>
					typeof _origST === 'function' ? _origST(fn, Math.min(delay ?? 0, 1), ...a) : undefined;
				try {
					this.activate?.(args[0], args[1], args[2]);
					this.postActivate?.();
				} finally {
					(globalThis as { setTimeout?: unknown }).setTimeout = _origST;
				}
			};
			g.freezedInput = true;
			if (this.getTrigger() === 'onQuery') {
				const animId = Math.random();
				g.animationQueue.push(animId);
				setTimeout(() => {
					if (!g.triggers?.onUnderAttack?.test?.(this.getTrigger())) activateAbility();
				}, 1);
				setTimeout(() => {
					const queue = g.animationQueue.filter((item: unknown) => item != animId);
					if (queue.length === 0 && !g._deferredQueryMovePending) {
						g.freezedInput = false;
						g.grid?.refreshHoverState?.();
					}
					g.animationQueue = queue;
				}, 2);
			} else {
				activateAbility();
				if (g.animationQueue.length === 0) {
					g.freezedInput = false;
					g.grid?.refreshHoverState?.();
				}
			}
			const iv = setInterval(() => {
				if (!g.freezedInput) {
					clearInterval(iv);
					opt.callback();
				}
			}, 1);
		};
		(AbilityClass.prototype.animation2 as { _simPatched?: boolean })._simPatched = true;
	}

	// Collapse the 1000ms queryMove/activate delay to 1ms (UI-only timing).
	const creatureModule = await import('../creature');
	const CreatureClass = creatureModule.Creature;
	if (!(CreatureClass.prototype.activate as { _simPatched?: boolean })._simPatched) {
		const _origActivate = CreatureClass.prototype.activate;
		CreatureClass.prototype.activate = function (this: any, ...args: any[]) {
			const _realSetInterval = (globalThis as { setInterval?: unknown }).setInterval;
			(globalThis as { setInterval?: unknown }).setInterval = (
				fn: (...args: unknown[]) => void,
				delay: number,
				...a: unknown[]
			) =>
				typeof _realSetInterval === 'function'
					? _realSetInterval(fn, Math.min(delay, 1), ...a)
					: undefined;
			try {
				return _origActivate.apply(this, args);
			} finally {
				(globalThis as { setInterval?: unknown }).setInterval = _realSetInterval;
			}
		};
		(CreatureClass.prototype.activate as { _simPatched?: boolean })._simPatched = true;
	}

	// Skip the BFS hover-refresh part of deactivate('turn-end') — UI-only.
	if (!(CreatureClass.prototype.deactivate as { _simPatched?: boolean })._simPatched) {
		const _origDeactivate = CreatureClass.prototype.deactivate;
		CreatureClass.prototype.deactivate = function (this: any, reason: string) {
			if (reason === 'turn-end') {
				const g = this.game;
				this.resetBounce?.();
				this.status.frozen = false;
				this.status.cryostasis = false;
				this.status.dizzy = false;
				g.grid.lastMouseHex = undefined;
				g.grid.suppressNextHoverRefresh = true;
				// Stashes leftover movement for next turn (see Creature.stashMovement)
				// before zeroing this turn's movement.
				this.stashMovement?.();
				if (g._deferredQueryMovePending > 0) g._deferredQueryMovePending--;
				if (g._deferredQueryMovePending === 0 && g.animationQueue.length === 0)
					g.freezedInput = false;
				this.turnsActive += 1;
				this._nextGameTurnActive = g.turn + 1;
				this.hasWait = this.isDelayed;
			} else {
				_origDeactivate.call(this, reason);
			}
		};
		(CreatureClass.prototype.deactivate as { _simPatched?: boolean })._simPatched = true;
	}

	// Fast-path hex.trap / hex.creature getters (bypass PointFacade overhead).
	const hexModule = await import('../utility/hex');
	const HexClass = hexModule.Hex;
	if (!(HexClass.prototype as { _simGetterPatched?: boolean })._simGetterPatched) {
		Object.defineProperty(HexClass.prototype, 'trap', {
			get(this: any) {
				const traps = this.game?.traps;
				if (!traps) return undefined;
				for (let i = 0; i < traps.length; i++) {
					if (traps[i].x === this.x && traps[i].y === this.y) return traps[i];
				}
				return undefined;
			},
			configurable: true,
		});
		Object.defineProperty(HexClass.prototype, 'creature', {
			get(this: any) {
				const creatures = this.game?.creatures;
				if (!creatures) return undefined;
				const { x, y } = this;
				for (let i = 0; i < creatures.length; i++) {
					const c = creatures[i];
					if (!c || c.dead || c.isVaporized) continue;
					const hexs = c.hexagons ?? [];
					for (let j = 0; j < hexs.length; j++) {
						if (hexs[j].x === x && hexs[j].y === y) return c;
					}
				}
				return undefined;
			},
			set(_value: unknown) {},
			configurable: true,
		});
		(HexClass.prototype as { _simGetterPatched?: boolean })._simGetterPatched = true;
	}

	game.UI = makeUiStub();

	game.grid.allhexes.forEach((hex: any) => {
		hex.updateStyle = () => undefined;
		hex.displayVisualState = () => undefined;
		hex.cleanDisplayVisualState = () => undefined;
		hex.overlayVisualState = () => undefined;
		hex.cleanOverlayVisualState = () => undefined;
		hex.setNotTarget = () => undefined;
		hex.unsetNotTarget = () => undefined;
		hex.setReachable = function (this: any) {
			this.reachable = true;
		};
		hex.unsetReachable = function (this: any) {
			this.reachable = false;
		};
		hex.isSpinning = false;
		hex.startSpinning = () => undefined;
	});
	game.grid.updateDisplay = () => undefined;
	game.grid.clearAllXray = () => undefined;

	const bc = game.botController;
	bc.selectDelayMs = 1;
	bc.confirmDelayMs = 1;
	bc.turnDelayMs = 1;
	bc.startTurnDelayMs = 1;
	bc.stalePendingActionMs = 20;

	game.log = () => undefined;

	// Fire skip/delay/deactivate synchronously (drop the 1000ms throttle timers).
	game.skipTurn = function (this: any, o: Record<string, any> = {}) {
		(this as any).creatures?.filter((c: any) => c?.temp).forEach((c: any) => c.destroy?.());
		if (this.turnThrottle) return;
		const opts = Object.assign({ callback: () => {}, noTooltip: false, tooltip: 'Skipped' }, o);
		if (this.activeCreature) {
			this.pauseTime = 0;
			this.activeCreature.deactivate?.('turn-end');
			this.nextCreature?.();
		}
		opts.callback?.();
	};
	game.delayCreature = function (this: any, o: Record<string, any> = {}) {
		if (this.turnThrottle) return;
		if (!this.activeCreature?.canWait || this.queue?.isCurrentEmpty?.()) return;
		const opts = Object.assign({ callback: () => {} }, o);
		this.activeCreature.wait?.();
		this.nextCreature?.();
		opts.callback?.();
	};
	game.nextCreature = function (this: any) {
		this.UI?.closeDash?.();
		this.UI?.btnToggleDash?.changeState?.('normal');
		if (this.gameState === 'ended') return;
		this.stopTimer?.();
		setTimeout(() => {
			if (this.queue.isCurrentEmpty() || this.turn === 0) {
				this.nextRound();
				return;
			}
			const next = this.queue.queue[0];
			if (next.playable === false) {
				this.activeCreature = next;
				next.status.frozen = false;
				next.status.cryostasis = false;
				next.status.dizzy = false;
				next.remainingMove = 0;
				next.turnsActive = (next.turnsActive ?? 0) + 1;
				next._nextGameTurnActive = this.turn + 1;
				next.hasWait = false;
				this.nextCreature?.();
				return;
			}
			let differentPlayer = false;
			if (this.activeCreature) differentPlayer = this.activeCreature.player !== next.player;
			else differentPlayer = true;
			const last = this.activeCreature;
			this.activeCreature = next;
			if (last && !last.dead) last.updateHealth?.();
			if (differentPlayer) this.soundsys?.playHeartBeat?.('sounds/heartbeat');
			if (this.UI) this.UI._abilityPanelAnimating = true;
			if (this.grid) this.grid.suppressNextHoverRefresh = true;
			this.activeCreature.activate();
			this.UI?.updateActivebox?.();
			this.updateQueueDisplay?.();
			this.channels.creature.emit('activate', { creature: this.activeCreature });
			if (!this.multiplayer) this.playersReady = true;
		}, 1);
	};

	Object.defineProperty(game, 'turnThrottle', {
		get: () => false,
		set: () => {},
		configurable: true,
	});

	return game;
}

// ─── Step loop ───────────────────────────────────────────────────────────────

function isIdle(game: any): boolean {
	if (game.gameState === 'ended') return true;
	const busy =
		!!game.freezedInput ||
		(game.animationQueue?.length || 0) > 0 ||
		(game._deferredQueryMovePending || 0) > 0;
	return !busy;
}

/**
 * Point AB's engine singletons at this match before driving it.
 *
 * `src/timing/clock.ts` and `src/game-display/camera.ts` keep module-level
 * state, because gameplay reaches them without a handle to the match they
 * belong to. `createPhaser()` registers into those on behalf of whichever game
 * booted last, so a process running two engines — which the convergence test
 * does deliberately, and which the server does not — has to re-register before
 * it pumps either one. Otherwise the second game to boot silently answers for
 * the first, and the first match advances on the other match's clock.
 */
/**
 * Virtual milliseconds elapsed on this match's clock.
 *
 * Falls back to the wall clock for a game built before the driver existed, so
 * the budget still means something rather than measuring the driver's install.
 */
function elapsedMs(game: any): number {
	return game.headlessDriver ? game.headlessDriver.elapsed() : Date.now();
}

function activateGame(game: any): void {
	const scene = game.scene;
	if (!scene) return;
	setClockScene(scene);
	const camera = scene.camera ?? null;
	if (camera) setBoardCamera(camera);
}

/**
 * One turn of the pump: advance a frame, then let promises run.
 *
 * Both halves are needed. The frame is what Phaser runs on — tweens, timers,
 * the scene update — so without it nothing time-driven ever happens. The yield
 * is what gameplay promises run on, and a loop that never returned to the event
 * loop would starve them. Order matters: the frame first, so anything it
 * queues is already in place when the microtasks drain.
 */
async function pumpOnce(game: any): Promise<void> {
	game.headlessDriver?.step();
	await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Pump until `predicate` is true or a bound is hit.
 *
 * The budget is measured on the virtual clock the driver installed, not the
 * wall clock: a step advances virtual time by exactly one frame, so the bound
 * means "this much game time" and the same intent log always costs the same
 * number of steps regardless of how fast the host is.
 */
export async function pumpUntil(
	game: any,
	predicate: (game: any) => boolean,
	options: { maxIters?: number; maxMs?: number } = {},
): Promise<void> {
	activateGame(game);
	// Sized in frames, not iterations. Each iteration now costs 16ms of *virtual*
	// time, so a 60s budget was 3 750 frames — sized when an iteration was a
	// ~0ms microtask drain and the cap was effectively unreachable. With real
	// tweened movement a long pathing turn needs more than that, and because match
	// length is random the shortfall showed up as an intermittent settle that
	// returned early and desynchronised the two engines.
	const maxIters = options.maxIters ?? 50_000;
	const maxMs = options.maxMs ?? 800_000;
	const start = elapsedMs(game);
	for (let i = 0; i < maxIters; i++) {
		await pumpOnce(game);
		if (predicate(game) || elapsedMs(game) - start > maxMs) return;
	}
}

/**
 * Wait until the engine has settled (no pending animation / frozen input) and
 * stayed idle for two consecutive polls — i.e. it is now waiting for the next
 * human `Intent` (or the match ended). Two consecutive idle polls avoids
 * returning during the 1ms gap before `nextCreature` hands off the turn.
 */
export async function settle(
	game: any,
	options: { maxIters?: number; maxMs?: number } = {},
): Promise<void> {
	activateGame(game);
	// Sized in frames, not iterations. Each iteration now costs 16ms of *virtual*
	// time, so a 60s budget was 3 750 frames — sized when an iteration was a
	// ~0ms microtask drain and the cap was effectively unreachable. With real
	// tweened movement a long pathing turn needs more than that, and because match
	// length is random the shortfall showed up as an intermittent settle that
	// returned early and desynchronised the two engines.
	const maxIters = options.maxIters ?? 50_000;
	const maxMs = options.maxMs ?? 800_000;
	const start = elapsedMs(game);
	let streak = 0;
	for (let i = 0; i < maxIters; i++) {
		await pumpOnce(game);
		if (game.gameState === 'ended') return;
		streak = isIdle(game) ? streak + 1 : 0;
		if (streak >= 2) return;
		if (elapsedMs(game) - start > maxMs) return;
	}
}

/** Apply a single client `Intent` to the engine (does not await settle). */
export function applyIntent(game: any, intent: import('./authoritativeTypes').Intent): void {
	// Every operation on a game has to run against *that* game's engine
	// registries, not merely the one that settled last. `game.action()` reaches
	// the AB clock synchronously while it queues the move, so activating only
	// inside `settle()` leaves the intent itself running on whichever match was
	// pumped previously — which desynchronises two engines by a turn.
	activateGame(game);
	switch (intent.kind) {
		case 'skip':
			game.action({ action: 'skip' }, { callback() {} });
			break;
		case 'delay':
			game.action({ action: 'delay' }, { callback() {} });
			break;
		case 'move':
			game.action({ action: 'move', target: intent.target, path: intent.path }, { callback() {} });
			break;
		case 'ability':
			game.action(
				{ action: 'ability', id: intent.id, target: intent.target, args: intent.args },
				{ callback() {} },
			);
			break;
	}
}

/** The authoritative server step: apply an intent, then wait for the engine to settle. */
export async function stepGame(
	game: any,
	intent: import('./authoritativeTypes').Intent,
): Promise<any> {
	applyIntent(game, intent);
	await settle(game);
	return game;
}

// ─── Authoritative state serialization ───────────────────────────────────────

export function serializeState(game: any): import('./authoritativeTypes').AuthoritativeState {
	const players = (game.players || []).map((p: any) => ({
		playerIndex: p.id,
		controller: p.controller,
		score: p.getScore?.().total ?? 0,
	}));

	const creatures = (game.creatures || []).filter(Boolean).map((c: any) => ({
		id: c.id,
		type: c.type,
		name: c.name,
		x: c.x,
		y: c.y,
		health: c.health,
		maxHealth: c.stats?.health ?? c.health,
		energy: c.energy,
		maxEnergy: c.stats?.energy ?? c.energy,
		dead: !!c.dead,
		vaporized: !!c.isVaporized,
		remainingMove: c.remainingMove,
		movementPool: c.movementPool ?? 0,
		playerIndex: c.player?.id ?? null,
		status: {
			frozen: !!c.status?.frozen,
			dizzy: !!c.status?.dizzy,
			cryostasis: !!c.status?.cryostasis,
		},
	}));

	const queue = (game.queue?.queue || []).map((c: any) => c.id);

	return {
		turn: game.turn,
		round: game.round,
		gameState: game.gameState,
		activeCreatureId: game.activeCreature?.id ?? null,
		players,
		creatures,
		queue,
	};
}

/**
 * Reconstruct authoritative state purely from an initial config + an ordered
 * intent log. Because the engine is deterministic, this reproduces the exact
 * state any client holds — no need to keep a live game instance around. This is
 * the Redis-friendly heart of the server-authoritative design: persist the
 * ordered `Intent`s and replay them on demand.
 */
export async function replayIntents(
	abilities: Array<(G: any) => void>,
	config: Partial<HeadlessConfig>,
	intents: import('./authoritativeTypes').Intent[],
): Promise<any> {
	const game = await createHeadlessGame(abilities, {
		config: { ...config, players: config.players ?? DEFAULT_HEADLESS_CONFIG.players },
	});
	for (const intent of intents) {
		applyIntent(game, intent);
		await settle(game);
	}
	return game;
}
