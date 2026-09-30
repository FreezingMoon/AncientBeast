/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/no-var-requires

// ─── SimSignal mock (minimal Signal replacement for simulation) ─────────────
class SimSignal {
	private listeners: Array<{ fn: (...args: any[]) => void; ctx?: any }> = [];
	add(fn: (...args: any[]) => void, ctx?: any) {
		this.listeners.push({ fn, ctx });
	}
	dispatch(...args: any[]) {
		for (const { fn, ctx } of this.listeners) {
			fn.apply(ctx, args);
		}
	}
}
// ─── UI module mock ──────────────────────────────────────────────────────────
// `Game.setup()` instantiates the real jQuery-bound UI, which needs the full
// game DOM. The harness replaces `game.UI` with a stub anyway, so the real
// class is never used.
jest.mock('../../ui/interface', () => {
	const deepNoop = (): unknown => {
		const fn = function () {
			return deepNoop();
		};
		return new Proxy(fn, {
			get: () => deepNoop(),
			apply: () => deepNoop(),
		});
	};

	return {
		UI: class UIStub {
			constructor() {
				return new Proxy(
					{ selectedAbility: -1, dashopen: false, active: false },
					{
						get: (target, prop) => (prop in target ? target[prop as string] : deepNoop()),
						set: (target, prop, value) => {
							target[prop as string] = value;
							return true;
						},
					},
				);
			}
		},
	};
});

// ─── Phaser module mock ─────────────────────────────────────────────────────
// The real Phaser 4 bundle boots a renderer at import time, which jsdom cannot
// satisfy. Only the value exports AB actually imports are provided here.
jest.mock('phaser', () => ({
	Scene: class SceneMock {
		sys: { settings: { key: ''; data: Record<string, unknown> } };
	},
	Math: {
		Vector2: class Vector2Mock {
			x: number;
			y: number;
			constructor(x?: number, y?: number) {
				this.x = x ?? 0;
				this.y = y ?? 0;
			}
			set(x: number, y?: number): this {
				this.x = x;
				this.y = y ?? x;
				return this;
			}
			setTo(x: number, y?: number): this {
				return this.set(x, y);
			}
			clone(): this {
				return new (this.constructor as any)(this.x, this.y);
			}
			copy(src: any): this {
				this.x = src.x;
				this.y = src.y;
				return this;
			}
		},
	},
	Vector2: class Vector2Mock {
		x: number;
		y: number;
		constructor(x?: number, y?: number) {
			this.x = x ?? 0;
			this.y = y ?? 0;
		}
		set(x: number, y?: number): this {
			this.x = x;
			this.y = y ?? x;
			return this;
		}
		setTo(x: number, y?: number): this {
			return this.set(x, y);
		}
		clone(): this {
			return new (this.constructor as any)(this.x, this.y);
		}
		copy(src: any): this {
			this.x = src.x;
			this.y = src.y;
			return this;
		}
	},
	GameObjects: {
		Polygon: class PolygonGameObjectMock {
			constructor(_scene?: unknown, _x?: number, _y?: number, points?: unknown) {
				(this as any).points = points ?? [];
			}
			contains() {
				return true;
			}
		},
	},
	Polygon: class PolygonMock {
		points: any[];
		constructor(points?: any[]) {
			this.points = points ?? [];
		}
		contains(_x: number, _y: number) {
			return true;
		}
	},
	Geom: {
		Polygon: class GeomPolygonMock {
			points: any[];
			constructor(points?: any[]) {
				this.points = points ?? [];
			}
			contains(_x: number, _y: number) {
				return true;
			}
		},
	},
	BlendModes: { ADD: 1, NORMAL: 0, MULTIPLY: 2, SCREEN: 3 },
	AUTO: 0,
	CANVAS: 1,
	Scale: { NO_CENTER: 0, CENTER_BOTH: 1, FIT: 1, RESIZE: 5 },
	Signal: class SignalMock {
		add() {}
		remove() {}
		dispatch() {}
	},
	default: class PhaserMock {},
}));

// ─── Real Signal implementation ──────────────────────────────────────────────

// ─── jQuery mock ─────────────────────────────────────────────────────────────

/** Chainable no-op jQuery stub — covers every call site in Game / UI / HexGrid */
function _makeJQueryChain(): any {
	const chain: any = new Proxy(
		function _jq() {
			return chain;
		},
		{
			get(_target, prop) {
				if (prop === 'then' || prop === Symbol.toPrimitive) return undefined;
				if (prop === 'length') return 0;
				if (prop === 'width' || prop === 'height') return () => 1920;
				if (prop === 'offset') return () => ({ top: 0, left: 0 });
				return () => chain;
			},
			apply() {
				return chain;
			},
		},
	);
	return chain;
}

// ─── Animations mock ─────────────────────────────────────────────────────────

/**
 * Mock Animations that skips all Phaser tweens and completes movement
 * synchronously (via a resolved Promise) so BotController receives the
 * 'movementComplete' signal without needing real timer advancement.
 */
class MockAnimations {
	game: any;
	animationCounter = 0;
	movementPoints = 0;

	constructor(game: any) {
		this.game = game;
	}

	/** Cosmetic effect setup; simulation never renders, so this is a no-op. */
	initInfernalCardboardEffect(_creature: unknown, _sprite: unknown) {}

	/** Cosmetic effect teardown; simulation has nothing to dispose. */
	disposeInfernalCardboardEffect(_creature: unknown) {}

	/** Called by Creature.moveTo() via game.animations[animType](creature, path, opts) */
	walk(creature: any, path: any[], opts: Record<string, any>) {
		this._completeMove(creature, path[path.length - 1] ?? path[0], opts);
	}

	fly(creature: any, path: any[], opts: Record<string, any>) {
		this._completeMove(creature, path[0], opts);
	}

	teleport(creature: any, path: any[], opts: Record<string, any>) {
		this._completeMove(creature, path[0], opts);
	}

	push(creature: any, path: any[], opts: Record<string, any>) {
		this._completeMove(creature, path[path.length - 1] ?? path[0], opts);
	}

	private _completeMove(creature: any, hex: any, opts: Record<string, any>) {
		const animId = ++this.animationCounter;
		(this.game as any).animationQueue.push(animId);
		setTimeout(() => {
			this.movementComplete(creature, hex, animId, opts);
		}, 1);
	}

	movementComplete(creature: any, hex: any, animId: number | string, opts: Record<string, any>) {
		if (
			opts?.customMovementPoint &&
			typeof opts.customMovementPoint === 'number' &&
			opts.customMovementPoint > 0
		) {
			creature.remainingMove = this.movementPoints;
		}
		if (opts?.turnAroundOnComplete) {
			creature.facePlayerDefault?.();
		}
		creature.healthShow?.();
		creature.hexagons?.forEach(() => creature.pickupDrop?.());
		(this.game as any).grid?.orderCreatureZ?.();

		const queue = (this.game as any).animationQueue.filter((item: any) => item !== animId);
		if (queue.length === 0) {
			(this.game as any).freezedInput = false;
			(this.game as any).grid?.refreshHoverState?.();
		}
		(this.game as any).animationQueue = queue;
		opts?.callback?.();
	}

	// Stubs for other animation paths used in abilities
	death(creature: any, opts: Record<string, any>) {
		opts?.callback?.();
	}
	melt(creature: any, opts: Record<string, any>) {
		opts?.callback?.();
	}
	rise(creature: any, opts: Record<string, any>) {
		opts?.callback?.();
	}
	shake(creature: any, opts: Record<string, any>) {
		opts?.callback?.();
	}
	projectile(_creature: any, _spell: any, _targets: any, _args: any, ..._rest: any[]) {
		// Abilities expect [tween, sprite] back. The tween's onComplete.add(fn, ctx) must
		// invoke fn with ctx as `this` so the turn can resume after the projectile lands.
		const sprite = { destroy: () => undefined };
		const tween = {
			onComplete: {
				add(fn: (...a: any[]) => any, ctx?: any) {
					fn.call(ctx ?? sprite);
				},
			},
		};
		return [tween, sprite];
	}
	startBonfireSpringTrapAnimation() {}
	startScorchedGroundTrapAnimation() {}
	shatterDown(creature: any, opts: Record<string, any>) {
		opts?.callback?.();
	}
	rekeyInfernalCardboardEffect() {}
}

// ─── Stub UI / SoundSys ───────────────────────────────────────────────────────

function makeUiStub() {
	// Deep no-op proxy: any property access and any function call returns another
	// deep no-op, so chained calls like UI.abilitiesButtons[1].$button.addClass()
	// and direct calls like UI.closeDash() are all silently swallowed.
	function deepNoop(): unknown {
		// The target MUST be a function for the apply trap to work.
		const fn = function () {
			return deepNoop();
		};
		return new Proxy(fn, {
			get(_t, _prop) {
				return deepNoop();
			},
			apply(_t, _this, _args) {
				return deepNoop();
			},
		});
	}

	// Explicit overrides for properties that game logic reads (not just calls).
	const base: Record<string, unknown> = {
		selectedAbility: -1,
		dashopen: false,
		active: false,
		materializeToggled: false,
		_abilityPanelAnimating: false,
		logScrollEnabled: false,
		plasmaBars: [],
		// Keep well-typed nested stubs for the most common UI objects
		chat: { hide: deepNoop(), addMsg: deepNoop(), suppressMessage: deepNoop() },
		cardWrapper: { find: () => ({ hide: deepNoop(), show: deepNoop() }) },
	};

	return new Proxy(base, {
		get(target, prop) {
			if (prop in target) return target[prop as string];
			return deepNoop();
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
		stopSFX: noop,
		playHeartBeat: noop,
		loadSound: noop,
		playShout: noop,
	};
}

// ─── Game factory ─────────────────────────────────────────────────────────────

/**
 * Build and start a game instance, bypassing asset loading entirely.
 *
 * @param abilities  Array of ability-loader functions from src/abilities/*.ts
 *                   (each has signature `(G: Game) => void`)
 */
export async function createGame(abilities: Array<(G: any) => void>): Promise<any> {
	// Stub requestAnimationFrame to prevent hex spin-loops from consuming fake-timer
	// budget. The real rAF is unused in simulation (no renderer), so we replace it with

	// ─── Stub UI / SoundSys ───────────────────────────────────────────────────────
	(
		globalThis as { requestAnimationFrame?: any; cancelAnimationFrame?: any }
	).requestAnimationFrame = (_cb: () => void) => 0;
	(globalThis as { cancelAnimationFrame?: any }).cancelAnimationFrame = (_id: number) => undefined;

	// Use dynamic import instead of require()
	// Note: If running in a test context that does not support top-level await, this may need to be refactored.
	// eslint-disable-next-line @typescript-eslint/no-var-requires

	const GameModule = await import('../../game');
	const Game = GameModule.default;
	const game: any = new Game();

	// Headless engine: the neutral `GameEngine` vocabulary with inert handles and
	// no renderer. Gameplay code talks to `gameEngine`, never to raw Phaser, so
	// the simulation never needs a Phaser instance at all.
	const { NullEngine } = await import('../../engine/NullEngine');
	const engine = new NullEngine();
	// Expose the existing signal channels through the adapter
	for (const ch of Object.keys(game.signals)) {
		engine.signals[ch] = game.signals[ch];
	}
	game._gameEngine = engine;

	// Swap out the Animations instance with our synchronous mock
	game.animations = new MockAnimations(game);

	// Install real signals (Game constructor creates them via setupSignalChannels
	// which uses `new Signal()` from the phaser mock — replace with SimSignals)
	const signalChannels = ['ui', 'metaPowers', 'creature', 'hex'];
	game.signals = signalChannels.reduce((acc: Record<string, any>, ch: string) => {
		acc[ch] = new SimSignal();
		return acc;
	}, {} as Record<string, any>);

	// Re-register BotController on the new signals (it registered during constructor)
	game.botController.game = game;
	// BotController listens on game.signals.creature
	game.signals.creature.add(
		game.botController.handleCreatureSignal.bind(game.botController),
		game.botController,
	);

	// Stub sound / music
	game.soundsys = makeSoundSysStub();
	game.musicPlayer = { audio: { pause: () => undefined } };

	// Set config needed by setup()
	game.configData = {
		players: [], // no human players → both bots
		gameMode: 2,
		plasma_amount: 50,
		creaLimitNbr: 7,
		abilityUpgrades: 1,
		unitDrops: 0,
		timePool: -1, // -1 = infinite → no time-exhaustion endings
		turnTimePool: -1,
	};
	// loadGame() normally does $j.extend(this, setupData) which copies configData fields
	// onto the game object. Since we call setup() directly (bypassing loadGame), we must
	// apply these fields manually so downstream code (e.g. Player constructor reading
	// game.plasma_amount, ability scripts reading game.creaLimitNbr) sees correct values.
	game.plasma_amount = 50;
	game.creaLimitNbr = 7;
	game.abilityUpgrades = 1;
	game.unitDrops = 0;
	game.timePool = -1;
	game.turnTimePool = -1;
	game.gameMode = 2;

	// Install abilities so creatures get working skill sets
	for (const loader of abilities) {
		loader(game);
	}

	// Load unit data (normally done in loadGame which we bypass)
	// eslint-disable-next-line @typescript-eslint/no-var-requires

	const unitsModule = await import('../../data/units');
	const unitData = unitsModule.unitData;
	(game as any).loadUnitData(unitData);

	// Call setup bypassing loadGame
	game.gameState = 'loading';

	// setup() is synchronous and no longer calls matchInit()
	game.setup(2);
	// game.setup() calls `this.animations = new Animations(this)` internally, which
	// overwrites any pre-setup assignment. Re-install the mock here, after setup().
	game.animations = new MockAnimations(game);

	// Collapse ability animation delays from 350ms/500ms → 1ms/2ms (one-time prototype patch).
	// The real timings generate ~9 fake-timer callbacks per ability use; with 1ms/2ms and a
	// 1ms setInterval the whole cycle completes in ~3 callbacks, giving ~3× fewer fake-time
	// events and keeping games from hitting MAX_SIM_TURNS due to animation-blocked turns.
	// eslint-disable-next-line @typescript-eslint/no-var-requires

	const abilityModule = await import('../../ability');
	const AbilityClass = abilityModule.Ability;
	if (!(AbilityClass.prototype.animation2 as { _simPatched?: boolean })._simPatched) {
		AbilityClass.prototype.animation2 = function (this: any, o: any) {
			const g = this.game;
			const opt = Object.assign({ callback: () => {}, arg: {} }, o);
			const args = opt.arg;
			const activateAbility = () => {
				// Clamp setTimeout only during ability activation — collapses visual-
				// only timers (Cycloper heal pulses, Knightmare/Vehemoth 250ms shot
				// delay, keepFacing ticks) without touching bot retry timers.
				const _origST = (globalThis as { setTimeout?: unknown }).setTimeout;
				(globalThis as { setTimeout?: unknown }).setTimeout = (
					fn: (...args: unknown[]) => void,
					delay: number,
					...a: unknown[]
				) =>
					typeof _origST === 'function' ? _origST(fn, Math.min(delay ?? 0, 1), ...a) : undefined;
				try {
					(this as { activate?: (...args: unknown[]) => void }).activate?.(
						args[0],
						args[1],
						args[2],
					);
					(this as { postActivate?: () => void }).postActivate?.();
				} finally {
					(globalThis as { setTimeout?: unknown }).setTimeout = _origST;
				}
			};

			g.freezedInput = true;

			if (this.getTrigger() === 'onQuery') {
				const animId = Math.random();
				g.animationQueue.push(animId);

				// 1ms instead of animationData.delay (default 350ms)
				setTimeout(() => {
					if (!g.triggers?.onUnderAttack?.test?.(this.getTrigger())) {
						activateAbility();
					}
				}, 1);

				// 2ms instead of animationData.duration (default 500ms)
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

			// 1ms instead of 100ms — fires on first tick after freezedInput clears
			const iv = setInterval(() => {
				if (!g.freezedInput) {
					clearInterval(iv);
					opt.callback();
				}
			}, 1);
		};
		(AbilityClass.prototype.animation2 as { _simPatched?: boolean })._simPatched = true;
	}

	// Patch Creature.prototype.activate to use 1ms instead of 1000ms for the
	// queryMove delay. The normal activation path has setInterval(fn, 1000) that
	// delays queryMove (and thus bot AI) by 1000ms of fake time per creature.
	// With 10+ creatures per round this costs 10+ seconds of fake time, requiring
	// 5 TICK_MS=2000 iterations just for the delays. Capping all setInterval calls
	// inside activate() to 1ms makes the whole round fit in a single tick.
	// eslint-disable-next-line @typescript-eslint/no-var-requires

	const creatureModule = await import('../../creature');
	const CreatureClass = creatureModule.Creature;
	if (!(CreatureClass.prototype.activate as { _simPatched?: boolean })._simPatched) {
		const _origActivate = CreatureClass.prototype.activate;
		CreatureClass.prototype.activate = function (this: any, ...args: any[]) {
			// Temporarily wrap setInterval to cap the delay to 1ms for all calls
			// inside activate(). This collapses the 1000ms UI-only delay before
			// queryMove to 1ms, without changing any game logic.
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

	// Skip the BFS part of queryMove(null) in deactivate('turn-end'): the
	// movement-range computation exists only to refresh the hover display for the
	// incoming creature. In simulation the bot calls its own queryMove() via
	// tryMove(). The non-UI side effects (clearing freezedInput,
	// decrementing _deferredQueryMovePending) are preserved.
	if (!(CreatureClass.prototype.deactivate as { _simPatched?: boolean })._simPatched) {
		const _origDeactivate = CreatureClass.prototype.deactivate;
		CreatureClass.prototype.deactivate = function (this: any, reason: string) {
			if (reason === 'turn-end') {
				const game = this.game;
				this.resetBounce?.();
				this.status.frozen = false;
				this.status.cryostasis = false;
				this.status.dizzy = false;
				game.grid.lastMouseHex = undefined;
				game.grid.suppressNextHoverRefresh = true;
				this.remainingMove = 0;
				// Preserve the non-UI side effects of queryMove(null):
				// decrement deferred-query counter and clear freezedInput.
				if (game._deferredQueryMovePending > 0) game._deferredQueryMovePending--;
				if (game._deferredQueryMovePending === 0 && game.animationQueue.length === 0) {
					game.freezedInput = false;
				}
				// Skip: getMovementRange() BFS + queryHexes() — UI-only hover refresh
				this.turnsActive += 1;
				this._nextGameTurnActive = game.turn + 1;
				// game.onEndPhase(this);
				this.hasWait = this.isDelayed;
			} else {
				_origDeactivate.call(this, reason);
			}
		};
		(CreatureClass.prototype.deactivate as { _simPatched?: boolean })._simPatched = true;
	}

	// Fast-path hex.trap and hex.creature getters — bypass PointFacade overhead.
	// The default getters call getPointFacade().getTrapsAt() / getCreaturesAt(), which
	// creates a new PointFacade instance, builds a hash Set, and iterates ALL traps or
	// creatures with per-item blocked/passable point lookups on every access.
	// Profiling shows hex.trap alone accounts for 10.7% of all CPU ticks (=~1.8s/game)
	// and the creature getter adds another 9.5%.  Simple linear scans of game.traps and
	// game.creatures are much cheaper (no allocation, no hash ops, 2-5× fewer comparisons).

	const hexModule = await import('../../utility/hex');
	const HexClass = hexModule.Hex;
	if (!(HexClass.prototype as { _simGetterPatched?: boolean })._simGetterPatched) {
		Object.defineProperty(HexClass.prototype, 'trap', {
			get(this: unknown) {
				const traps: unknown[] = (this as { game?: { traps?: unknown[] } }).game?.traps;
				if (!traps) return undefined;
				for (let i = 0; i < traps.length; i++) {
					if (
						(traps[i] as { x?: number; y?: number }).x === (this as { x?: number }).x &&
						(traps[i] as { y?: number }).y === (this as { y?: number }).y
					)
						return traps[i];
				}
				return undefined;
			},
			configurable: true,
		});
		Object.defineProperty(HexClass.prototype, 'creature', {
			get(this: unknown) {
				const creatures: unknown[] = (this as { game?: { creatures?: unknown[] } }).game?.creatures;
				if (!creatures) return undefined;
				const { x, y } = this as { x?: number; y?: number };
				for (let i = 0; i < creatures.length; i++) {
					const c = creatures[i] as { dead?: boolean; isVaporized?: boolean; hexagons?: unknown[] };
					if (!c || c.dead || c.isVaporized) continue;
					const hexs: unknown[] = c.hexagons ?? [];
					for (let j = 0; j < hexs.length; j++) {
						if (
							(hexs[j] as { x?: number; y?: number }).x === x &&
							(hexs[j] as { y?: number }).y === y
						)
							return c;
					}
				}
				return undefined;
			},
			// Preserve the no-op setter that existed for compatibility
			set(_value: unknown) {},
			configurable: true,
		});
		(HexClass.prototype as { _simGetterPatched?: boolean })._simGetterPatched = true;
	}

	// Replace real UI (created inside setup) with stub
	game.UI = makeUiStub();

	// Disable hex visual methods — all are purely cosmetic and contain expensive work:
	// - cleanDisplayVisualState/cleanOverlayVisualState compile 9-14 new RegExp objects
	//   per hex per call; updateDisplay() invokes them on all 63 hexes for every
	//   queryHexes() call, yielding ~7 245 regex compilations per creature turn.
	// - setReachable/unsetReachable access this.hitBox (a Phaser proxy) triggering the
	//   proxy handler chain; hex.reachable is the only flag bot logic reads.
	// - overlayVisualState/displayVisualState perform string concatenation + updateStyle.
	// Stubbing these eliminates the bulk of per-turn simulation overhead.
	game.grid.allhexes.forEach((hex: any) => {
		(hex as any).updateStyle = () => undefined;
		(hex as any).displayVisualState = () => undefined;
		(hex as any).cleanDisplayVisualState = () => undefined;
		(hex as any).overlayVisualState = () => undefined;
		(hex as any).cleanOverlayVisualState = () => undefined;
		(hex as any).setNotTarget = () => undefined;
		(hex as any).unsetNotTarget = () => undefined;
		// setReachable/unsetReachable: keep the reachable flag (bot reads it) but skip
		// hitBox proxy access (UI-only) and updateStyle (already a noop above).
		(hex as any).setReachable = function (this: any) {
			this.reachable = true;
		};
		(hex as any).unsetReachable = function (this: any) {
			this.reachable = false;
		};
		// Stop any rAF spin loops started during setup (hex.startSpinning uses
		// requestAnimationFrame recursively; under Jest fake timers this fires
		// ~312× per 5000ms tick, eating all wall-clock time).
		(hex as any).isSpinning = false;
		(hex as any).startSpinning = () => undefined;
	});

	// updateDisplay() iterates all hexes calling cleanDisplayVisualState and
	// cleanOverlayVisualState — purely cosmetic, safe to skip entirely.
	game.grid.updateDisplay = () => undefined;

	// clearAllXray calls creature.xray() on every creature — pure visual effect.
	game.grid.clearAllXray = () => undefined;

	// Fast-mode timing: collapse bot delays to 1 ms.
	// stalePendingActionMs must remain above selectDelayMs + confirmDelayMs.
	const bc = game.botController;
	bc.selectDelayMs = 1;
	bc.confirmDelayMs = 1;
	bc.turnDelayMs = 1;
	bc.startTurnDelayMs = 1;
	bc.stalePendingActionMs = 20;

	// Silence game.log: suppresses console.log calls (Jest captures these with
	// overhead) and skips 7 string.replace() ops per log message × ~thousands
	// of messages per game.  All log output is purely informational.
	game.log = () => undefined;

	// Stub skipTurn and delayCreature to eliminate the 1000ms throttle +
	// 350ms hint timers they schedule.  In a long game (150+ rounds ×
	// ~10 creatures) those dead callbacks accumulate to 2000+ fake-timer
	// entries, each costing real wall-clock time when sinon dispatches them.
	// We keep all game-logic side-effects (temp-creature cleanup, deactivate,
	// nextCreature) and fire the callback synchronously instead of after 1000ms.
	game.skipTurn = function (this: any, o: Record<string, any> = {}) {
		// Destroy any temp (summoned) creatures, as the real skipTurn does.
		(this as { creatures?: unknown[] }).creatures
			?.filter((c: { temp?: boolean }) => c?.temp)
			.forEach((c: { destroy?: () => void }) => c.destroy?.());
		if (this.turnThrottle) return;
		const opts = Object.assign({ callback: () => {}, noTooltip: false, tooltip: 'Skipped' }, o);
		if (this.activeCreature) {
			this.pauseTime = 0;
			this.activeCreature.deactivate?.('turn-end');
			this.nextCreature?.();
		}
		// Fire callback synchronously — no 1000ms delay needed.
		opts.callback?.();
	};

	game.delayCreature = function (this: any, o: Record<string, any> = {}) {
		if (this.turnThrottle) return;
		if (!this.activeCreature?.canWait || this.queue?.isCurrentEmpty?.()) return;
		const opts = Object.assign({ callback: () => {} }, o);
		this.activeCreature.wait?.();
		this.nextCreature?.();
		// Fire callback synchronously — no 1000ms delay needed.
		opts.callback?.();
	};

	// Override nextCreature to use 1ms delays instead of 300ms+50ms.
	// The original wraps everything in setTimeout(300ms){setInterval(50ms){…}};
	// both delays are UI-transition aesthetics with no game-logic purpose.
	// Collapsing them to a single 1ms setTimeout saves ~350ms of fake time per
	// creature turn — roughly halving the total fake-time budget of a game.
	// This mirrors the inner callback of game.ts:nextCreature exactly; keep in
	// sync if that function changes.
	const _origNextCreature = game.nextCreature.bind(game);
	void _origNextCreature; // retained for reference; not called in fast path
	game.nextCreature = function (this: any) {
		this.UI?.closeDash?.();
		this.UI?.btnToggleDash?.changeState?.('normal');
		// clearAllXray is already stubbed to a noop above
		if (this.gameState === 'ended') return;
		this.stopTimer?.();
		setTimeout(() => {
			if (this.queue.isCurrentEmpty() || this.turn === 0) {
				this.nextRound();
				return;
			}
			const next = this.queue.queue[0];

			// Non-playable creatures (e.g. Cycloper crystal walls) have no agency —
			// skip them instantly without bot AI evaluation.
			// Fast-path: replicate only the queue-advancing parts of deactivate('turn-end')
			// without queryMove() or onEndPhase(), both of which do expensive O(N×4) loops
			// over all creatures/abilities — with 13+ crystal walls per round, those loops
			// dominate wall-clock time.
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
			if (this.activeCreature) {
				differentPlayer = this.activeCreature.player !== next.player;
			} else {
				differentPlayer = true;
			}
			const last = this.activeCreature;
			this.activeCreature = next;
			if (last && !last.dead) last.updateHealth?.();
			if (differentPlayer) this.soundsys?.playHeartBeat?.('sounds/heartbeat');
			if (this.UI) this.UI._abilityPanelAnimating = true;
			if (this.grid) this.grid.suppressNextHoverRefresh = true;
			this.activeCreature.activate();
			this.UI?.updateActivebox?.();
			this.updateQueueDisplay?.();
			this.signals.creature.dispatch('activate', { creature: this.activeCreature });
			if (!this.multiplayer) {
				this.playersReady = true;
			}
		}, 1);
	};

	// Override turnThrottle to always be false.  In real gameplay it prevents rapid
	// UI clicks (1000 ms rate-limit per skip/delay action).  In simulation it causes
	// two main penalties:
	//   1. bot.takeTurn loops via queueDecision(200) ~5× waiting for turnThrottle=false
	//   2. frozen-creature setInterval(50) polls 20× per creature turn, waiting for
	//      turnThrottle=false before it can call skipTurn
	// Neither effect is needed here — the UI is stubbed, and bot guards work without it.
	Object.defineProperty(game, 'turnThrottle', {
		get: () => false,
		set: () => {},
		configurable: true,
	});

	return game;
}

// ─── Match runner ─────────────────────────────────────────────────────────────

export interface MatchResult {
	turns: number;
	winnerIdx: number | null; // null = draw / timeout
	scores: number[];
	endedByTimeout: boolean;
}

const MAX_SIM_TURNS = 40; // hard cap — 4 rounds is plenty; outlier games beyond this are timeouts

/**
 * Advance a running game to completion using Jest fake timers.
 * Must be called inside a test that has already called `jest.useFakeTimers()`.
 */
export async function runMatch(game: unknown): Promise<MatchResult> {
	// Suppress the checkTime interval — it's a noop for infinite time pools but
	// fires every 1000 ms of fake time, creating thousands of empty callbacks.
	const origCheckTime = (game as any).checkTime?.bind?.(game) ?? (() => {});
	(game as any).checkTime = () => {};

	// Advance fake time in chunks, yielding between each so microtasks (Promise
	// callbacks from MockAnimations._completeMove) can flush.
	// With bot delays collapsed to 1ms and nextCreature at 1ms, total per creature
	// turn ≈ ~160ms fake time.  TICK_MS=2000 covers ~12 creature turns per iteration.
	const TICK_MS = 2_000;
	// Allow enough fake time for MAX_SIM_TURNS turns, with 2× headroom.
	const MAX_ELAPSED = MAX_SIM_TURNS * 500;
	// Stagnation timeout: end game if no damage dealt in this many rounds.
	// Prevents extremely long stalemates where both bots are stuck in a loop.
	const STAGNATION_ROUNDS = 15;
	let elapsed = 0;
	// Wall-clock bail-out using perf_hooks.performance.now() which is NOT mocked
	// by Jest fake timers (unlike process.hrtime.bigint() which IS mocked).
	const wallStart = (globalThis as any).realPerf?.now?.() ?? 0;
	const MAX_WALL_MS = 120_000; // 2 minutes per game

	let _dbgTick = 0;
	const bc = (game as any).botController;
	while (
		(game as any).gameState !== 'ended' &&
		(game as any).turn < MAX_SIM_TURNS &&
		elapsed < MAX_ELAPSED
	) {
		// Stagnation check: bail out early if no damage in STAGNATION_ROUNDS rounds.
		if (
			bc &&
			(game as any).turn > 0 &&
			(game as any).turn - (bc.lastDamageRound ?? 0) > STAGNATION_ROUNDS
		) {
			break;
		}
		const _t0 = (globalThis as any).realPerf?.now?.() ?? 0;
		(jest as any).advanceTimersByTime?.(TICK_MS);
		const _dtAdv = ((globalThis as any).realPerf?.now?.() ?? 0) - _t0;
		// Let microtasks (Promise callbacks from MockAnimations) flush
		await Promise.resolve();
		await Promise.resolve();
		const _dtAwait = ((globalThis as any).realPerf?.now?.() ?? 0) - _t0 - _dtAdv;
		if (_dbgTick < 20)
			(process.stderr as any).write(
				`  [tick${_dbgTick} t=${(game as any).turn} adv=${_dtAdv.toFixed(
					0,
				)}ms await=${_dtAwait.toFixed(0)}ms]\n`,
			);
		_dbgTick++;
		elapsed += TICK_MS;
		if (((globalThis as any).realPerf?.now?.() ?? 0) - wallStart > MAX_WALL_MS) break;
	}

	(game as any).checkTime = origCheckTime;

	const scores = ((game as any).players as any[]).map(
		(p: { getScore: () => { total: number } }) => p.getScore().total,
	);
	let winnerIdx: number | null = null;
	const endedByTimeout = (game as any).gameState !== 'ended';

	if (!endedByTimeout) {
		const max = Math.max(...scores);
		const tied = scores.filter((s: number) => s === max).length > 1;
		if (!tied) {
			winnerIdx = scores.indexOf(max);
		}
	}

	return {
		turns: (game as any).turn,
		winnerIdx,
		scores,
		endedByTimeout,
	};
}
