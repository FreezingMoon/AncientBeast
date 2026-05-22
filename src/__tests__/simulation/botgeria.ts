/**
 * botgeria.ts — simulation engine for bot-vs-bot matches.
 *
 * Provides:
 *  - minimal Phaser mock (deep Proxy + real Promise-based tween stubs)
 *  - real Signal implementation (copied from phaser-ce behaviour)
 *  - jQuery mock (chainable no-ops)
 *  - SoundSys / UI / Animations stubs
 *  - createGame()  — builds a fully-wired Game, bypassing asset loading
 *  - runMatch()    — drives a game to completion with Jest fake timers
 */

// perf_hooks.performance.now() is NOT mocked by Jest fake timers (unlike
// process.hrtime.bigint() which IS mocked and returns fake-clock time).
import { performance as realPerf } from 'perf_hooks';

// ─── Phaser global ───────────────────────────────────────────────────────────
// creature.ts references the Phaser namespace as a global (not an import),
// e.g. `Phaser.Easing.Linear.None`. Jest runs without webpack's ProvidePlugin,
// so we must define it on the global object ourselves.
(globalThis as any).Phaser = {
	Easing: {
		Linear: { None: 'Linear.None' },
		Quadratic: { In: 'Quad.In', Out: 'Quad.Out', InOut: 'Quad.InOut' },
		Back: { Out: 'Back.Out' },
	},
	AUTO: 0,
	CANVAS: 1,
	CENTER: 11, // Phaser.CENTER constant used by alignIn
	Signal: class PhaserGlobalSignal {
		add() {}
		dispatch() {}
		remove() {}
	},
};

// ─── Phaser mock ─────────────────────────────────────────────────────────────

/**
 * Returns a tween stub whose `.onComplete` resolves the returned Promise
 * immediately (synchronously via a microtask) so movement / animation
 * callbacks fire without any real time passing.
 */
function makeTween() {
	let completeCb: (() => void) | null = null;
	const tween = {
		isRunning: true,
		_target: null as any,
		_props: null as any,
		to(props: any, _duration: number, _easing?: any, autoStart = false) {
			this._props = props;
			if (autoStart) {
				// Apply properties synchronously
				if (this._target) {
					Object.assign(this._target, props);
				}
				Promise.resolve().then(() => completeCb?.());
			}
			return this;
		},
		start() {
			if (this._target && this._props) {
				Object.assign(this._target, this._props);
			}
			Promise.resolve().then(() => completeCb?.());
			return this;
		},
		stop() {
			this.isRunning = false;
			return this;
		},
		yoyo: () => tween,
		repeat: () => tween,
		onUpdateCallback: () => tween,
		onComplete: {
			add(cb: (...args: any[]) => void, context?: any) {
				completeCb = context ? cb.bind(context) : cb;
			},
			addOnce(cb: (...args: any[]) => void, context?: any) {
				completeCb = context ? cb.bind(context) : cb;
			},
		},
	};
	return tween;
}

function makePhaserGroup() {
	const grp: any = {
		x: 0,
		y: 0,
		alpha: 1,
		angle: 0,
		exists: true,
		children: [] as any[],
		position: {
			set(x: number, y: number) {
				grp.x = x;
				grp.y = y;
			},
		},
		scale: {
			x: 1,
			y: 1,
			setTo(x: number, y: number) {
				this.x = x;
				this.y = y;
			},
			set(x: number, y: number) {
				this.x = x;
				this.y = y;
			},
		},
		add: (child: any) => { grp.children.push(child); return child; },
		remove: () => undefined,
		removeChild: () => undefined,
		addChild: () => undefined,
		create: () => makePhaserSprite(),
		forEach: () => undefined,
		sendToBack: () => undefined,
		bringToTop: () => undefined,
		setChildIndex: () => undefined,
		getChildIndex: () => 0,
		sort: () => undefined,
		update: () => undefined,
		alignIn: () => undefined,
		destroy: () => undefined,
	};
	return grp;
}

function makePhaserSprite() {
	const sprite: any = {
		x: 0,
		y: 0,
		alpha: 1,
		angle: 0,
		rotation: 0,
		exists: true,
		key: '',
		text: '',
		inputEnabled: false,
		ignoreChildInput: false,
		input: { useHandCursor: false, priorityID: 0 },
		events: {
			onInputUp: { add: () => undefined },
			onInputDown: { add: () => undefined },
			onInputOver: { add: () => undefined },
			onInputOut: { add: () => undefined },
		},
		anchor: {
			x: 0,
			y: 0,
			setTo(x: number, y: number) {
				this.x = x;
				this.y = y;
			},
			set(x: number, y: number) {
				this.x = x;
				this.y = y;
			},
		},
		scale: {
			x: 1,
			y: 1,
			setTo(x: number, y: number) {
				this.x = x;
				this.y = y;
			},
		},
		texture: { width: 10, height: 10 },
		width: 10,
		height: 10,
		position: {
			x: 0,
			y: 0,
			set(x: number, y: number) {
				this.x = x;
				this.y = y;
			},
		},
		data: {},
		parent: null,
		getBounds: () => ({ x: 0, y: 0, width: 10, height: 10 }),
		loadTexture: () => undefined,
		alignIn: () => undefined,
		destroy: () => undefined,
		kill: () => undefined,
		revive: () => undefined,
		// Phaser.Graphics methods (used when Phaser.add.graphics() returns a sprite stub)
		beginFill: () => undefined,
		drawRect: () => undefined,
		endFill: () => undefined,
		clear: () => undefined,
		mask: null,
	};
	return sprite;
}

function makePhaserBitmapData() {
	return {
		width: 10,
		height: 10,
		canvas: { getContext: () => ({ drawImage: () => undefined, putImageData: () => undefined, getImageData: () => ({ data: new Uint8ClampedArray(0) }) }) },
		context: { drawImage: () => undefined, putImageData: () => undefined, getImageData: () => ({ data: new Uint8ClampedArray(0) }) },
		dirty: false,
		destroy: () => undefined,
	};
}

/** Full Phaser mock — all paths used by HexGrid / Creature / Animations */
export function buildPhaserMock() {
	const phaser: any = {
		world: { width: 1920, height: 1080 },
		width: 1920,
		height: 1080,
		scale: {
			parentIsWindow: false,
			pageAlignHorizontally: false,
			pageAlignVertically: false,
			scaleMode: 0,
			fullScreenScaleMode: 0,
			refresh: () => undefined,
		},
		stage: {
			disableVisibilityChange: false,
			forcePortrait: false,
		},
		device: { desktop: true },
		camera: { shake: () => undefined },
		load: {
			progress: 100,
			onFileComplete: { add: () => undefined },
			onLoadComplete: { add: () => undefined },
			start: () => undefined,
		},
		add: {
			group: (_parent?: any, _name?: string) => makePhaserGroup(),
			sprite: (_x?: number, _y?: number, _key?: string) => makePhaserSprite(),
			tween: (target: any) => {
				const t = makeTween();
				t._target = target;
				return t;
			},
			text: (_x?: number, _y?: number, _text?: string, _style?: any) => makePhaserSprite(),
			bitmapData: (_w?: number, _h?: number) => makePhaserBitmapData(),
			graphics: () => makePhaserSprite(),
		},
	};
	return phaser;
}

// ─── Real Signal implementation ──────────────────────────────────────────────

type SignalBinding = { listener: (...args: any[]) => void; context: any };

export class SimSignal {
	private _bindings: SignalBinding[] = [];

	add(listener: (...args: any[]) => void, context?: any) {
		this._bindings.push({ listener, context: context ?? null });
	}

	addOnce(listener: (...args: any[]) => void, context?: any) {
		const binding: SignalBinding = {
			listener: (...args: any[]) => {
				this.remove(binding.listener, context);
				listener.apply(context ?? null, args);
			},
			context: context ?? null,
		};
		this._bindings.push(binding);
	}

	remove(listener: (...args: any[]) => void, _context?: any) {
		this._bindings = this._bindings.filter((b) => b.listener !== listener);
	}

	dispatch(...args: any[]) {
		// Snapshot in case dispatch triggers add/remove
		const snapshot = this._bindings.slice();
		for (const b of snapshot) {
			b.listener.apply(b.context, args);
		}
	}

	removeAll() {
		this._bindings = [];
	}
}

// ─── jQuery mock ─────────────────────────────────────────────────────────────

/** Chainable no-op jQuery stub — covers every call site in Game / UI / HexGrid */
function makeJQueryChain(): any {
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

	/** Called by Creature.moveTo() via game.animations[animType](creature, path, opts) */
	walk(creature: any, path: any[], opts: any) {
		this._completeMove(creature, path[path.length - 1] ?? path[0], opts);
	}

	fly(creature: any, path: any[], opts: any) {
		this._completeMove(creature, path[0], opts);
	}

	teleport(creature: any, path: any[], opts: any) {
		this._completeMove(creature, path[0], opts);
	}

	push(creature: any, path: any[], opts: any) {
		this._completeMove(creature, path[path.length - 1] ?? path[0], opts);
	}

	private _completeMove(creature: any, hex: any, opts: any) {
		const animId = ++this.animationCounter;
		this.game.animationQueue.push(animId);
		// Use setTimeout(1) — not setTimeout(0) — so that bot.ts resolveQuery's
		// clearPendingAction (setTimeout(0), scheduled after onConfirm returns)
		// fires BEFORE movementComplete. If movementComplete fires first it sees
		// pendingAction still set and re-enters resolveQuery, creating an infinite loop.
		// Using 1ms ensures clearPendingAction fires first while still landing within
		// the same advanceTimersByTime tick, avoiding the stale-animId bug.
		setTimeout(() => {
			this.movementComplete(creature, hex, animId, opts);
		}, 1);
	}

	movementComplete(creature: any, hex: any, animId: number | string, opts: any) {
		if (opts?.customMovementPoint > 0) {
			creature.remainingMove = this.movementPoints;
		}
		if (opts?.turnAroundOnComplete) {
			creature.facePlayerDefault?.();
		}
		creature.healthShow?.();
		creature.hexagons?.forEach(() => creature.pickupDrop?.());
		this.game.grid?.orderCreatureZ?.();

		const queue = this.game.animationQueue.filter((item: any) => item !== animId);
		if (queue.length === 0) {
			this.game.freezedInput = false;
			this.game.grid?.refreshHoverState?.();
		}
		this.game.animationQueue = queue;
		opts?.callback?.();
	}

	// Stubs for other animation paths used in abilities
	death(creature: any, opts: any) {
		opts?.callback?.();
	}
	melt(creature: any, opts: any) {
		opts?.callback?.();
	}
	rise(creature: any, opts: any) {
		opts?.callback?.();
	}
	shake(creature: any, opts: any) {
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
	shatterDown(creature: any, opts: any) {
		opts?.callback?.();
	}
	rekeyInfernalCardboardEffect() {}

	// Hex visual methods — no-ops
	updateDisplay() {}
	cleanDisplay() {}
	leaveHex() {}
	enterHex() {}
	displayMovementRange() {}
	cleanHex() {}
	cleanAll() {}
	refreshHoverState() {}
	displayHexesAsMovementRange() {}
	displayHexesAsTrait() {}
	displayHexesAsSummon() {}
	updateTeam() {}
	fadeTo() {}
	blink() {}
	onUnderAttack() {}
	onEndPhase() {}
	initInfernalCardboardEffect() {}
	tickInfernalCardboardEffect() {}
	disposeInfernalCardboardEffect() {}
}

// ─── Stub UI / SoundSys ───────────────────────────────────────────────────────

function makeUiStub() {
	// Deep no-op proxy: any property access and any function call returns another
	// deep no-op, so chained calls like UI.abilitiesButtons[1].$button.addClass()
	// and direct calls like UI.closeDash() are all silently swallowed.
	function deepNoop(): any {
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
	const base: Record<string, any> = {
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
export function createGame(abilities: Array<(G: any) => void>): any {
	// Stub requestAnimationFrame to prevent hex spin-loops from consuming fake-timer
	// budget. The real rAF is unused in simulation (no renderer), so we replace it with
	// a noop that returns 0 (a valid cancel handle) and ignore cancelAnimationFrame.
	(global as any).requestAnimationFrame = (_cb: () => void) => 0;
	(global as any).cancelAnimationFrame = (_id: number) => undefined;

	// Use require() (synchronous) instead of dynamic import() to avoid
	// process.nextTick-based Promise resolution, which hangs when Jest fake
	// timers are active (fake timers intercept process.nextTick).
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const Game = require('../../game').default;

	const game: any = new Game();

	// Replace game.Phaser with our fully-featured mock so all subsequent calls
	// (setup, HexGrid construction, Creature sprites, etc.) use a consistent mock
	// with proper sprite/group/tween support.
	game.Phaser = buildPhaserMock();

	// Swap out the Animations instance with our synchronous mock
	game.animations = new MockAnimations(game);

	// Install real signals (Game constructor creates them via setupSignalChannels
	// which uses `new Signal()` from the phaser mock — replace with SimSignals)
	const signalChannels = ['ui', 'metaPowers', 'creature', 'hex'];
	game.signals = signalChannels.reduce(
		(acc: any, ch: string) => {
			acc[ch] = new SimSignal();
			return acc;
		},
		{} as any,
	);

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
	const { unitData } = require('../../data/units');
	game.loadUnitData(unitData);

	// Call setup bypassing loadGame
	game.gameState = 'loading';

	// setup() is synchronous; matchInit() at the end is async but fire-and-forget.
	// We replace it with a no-op so there's no multiplayer network connection attempt.
	game.matchInit = () => Promise.resolve();
	game.setup(2);
	// game.setup() calls `this.animations = new Animations(this)` internally, which
	// overwrites any pre-setup assignment. Re-install the mock here, after setup().
	game.animations = new MockAnimations(game);

	// Collapse ability animation delays from 350ms/500ms → 1ms/2ms (one-time prototype patch).
	// The real timings generate ~9 fake-timer callbacks per ability use; with 1ms/2ms and a
	// 1ms setInterval the whole cycle completes in ~3 callbacks, giving ~3× fewer fake-time
	// events and keeping games from hitting MAX_SIM_TURNS due to animation-blocked turns.
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const AbilityClass = (require('../../ability') as any).Ability;
	if (!(AbilityClass.prototype.animation2 as any)._simPatched) {
		AbilityClass.prototype.animation2 = function (this: any, o: any) {
			const g = this.game;
			const opt = Object.assign({ callback: () => {}, arg: {} }, o);
			const args = opt.arg;
			const activateAbility = () => {
				// Clamp setTimeout only during ability activation — collapses visual-
				// only timers (Cycloper heal pulses, Knightmare/Vehemoth 250ms shot
				// delay, keepFacing ticks) without touching bot retry timers.
				const _origST = (global as any).setTimeout;
				(global as any).setTimeout = (fn: any, delay: number, ...a: any[]) =>
					_origST(fn, Math.min(delay ?? 0, 1), ...a);
				try {
					this.activate(args[0], args[1], args[2]);
					this.postActivate();
				} finally {
					(global as any).setTimeout = _origST;
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
					const queue = g.animationQueue.filter((item: any) => item != animId);
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
		(AbilityClass.prototype.animation2 as any)._simPatched = true;
	}

	// Patch Creature.prototype.activate to use 1ms instead of 1000ms for the
	// queryMove delay. The normal activation path has setInterval(fn, 1000) that
	// delays queryMove (and thus bot AI) by 1000ms of fake time per creature.
	// With 10+ creatures per round this costs 10+ seconds of fake time, requiring
	// 5 TICK_MS=2000 iterations just for the delays. Capping all setInterval calls
	// inside activate() to 1ms makes the whole round fit in a single tick.
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const CreatureClass = (require('../../creature') as any).Creature;
	if (!(CreatureClass.prototype.activate as any)._simPatched) {
		const _origActivate = CreatureClass.prototype.activate;
		CreatureClass.prototype.activate = function (this: any, ...args: any[]) {
			// Temporarily wrap setInterval to cap the delay to 1ms for all calls
			// inside activate(). This collapses the 1000ms UI-only delay before
			// queryMove to 1ms, without changing any game logic.
			const _realSetInterval = (global as any).setInterval;
			(global as any).setInterval = (fn: any, delay: number, ...a: any[]) =>
				_realSetInterval(fn, Math.min(delay, 1), ...a);
			try {
				return _origActivate.apply(this, args);
			} finally {
				(global as any).setInterval = _realSetInterval;
			}
		};
		(CreatureClass.prototype.activate as any)._simPatched = true;
	}

	// Skip the BFS part of queryMove(null) in deactivate('turn-end'): the
	// movement-range computation exists only to refresh the hover display for the
	// incoming creature. In simulation the bot calls its own queryMove() via
	// tryMove(). The non-UI side effects (clearing freezedInput,
	// decrementing _deferredQueryMovePending) are preserved.
	if (!(CreatureClass.prototype.deactivate as any)._simPatched) {
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
				// game.onEndPhase(this); // @ts-expect-error removed as no longer needed
				this.hasWait = this.isDelayed;
			} else {
				_origDeactivate.call(this, reason);
			}
		};
		(CreatureClass.prototype.deactivate as any)._simPatched = true;
	}

	// Fast-path hex.trap and hex.creature getters — bypass PointFacade overhead.
	// The default getters call getPointFacade().getTrapsAt() / getCreaturesAt(), which
	// creates a new PointFacade instance, builds a hash Set, and iterates ALL traps or
	// creatures with per-item blocked/passable point lookups on every access.
	// Profiling shows hex.trap alone accounts for 10.7% of all CPU ticks (=~1.8s/game)
	// and the creature getter adds another 9.5%.  Simple linear scans of game.traps and
	// game.creatures are much cheaper (no allocation, no hash ops, 2-5× fewer comparisons).
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const HexClass = (require('../../utility/hex') as any).Hex;
	if (!(HexClass.prototype as any)._simGetterPatched) {
		Object.defineProperty(HexClass.prototype, 'trap', {
			get(this: any) {
				const traps: any[] = this.game?.traps;
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
				const creatures: any[] = this.game?.creatures;
				if (!creatures) return undefined;
				const { x, y } = this;
				for (let i = 0; i < creatures.length; i++) {
					const c = creatures[i];
					if (!c || c.dead || c.isVaporized) continue;
					const hexs: any[] = c.hexagons;
					if (!hexs) continue;
					for (let j = 0; j < hexs.length; j++) {
						if (hexs[j].x === x && hexs[j].y === y) return c;
					}
				}
				return undefined;
			},
			// Preserve the no-op setter that existed for compatibility
			set(_value: any) {},
			configurable: true,
		});
		(HexClass.prototype as any)._simGetterPatched = true;
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
		hex.updateStyle = () => undefined;
		hex.displayVisualState = () => undefined;
		hex.cleanDisplayVisualState = () => undefined;
		hex.overlayVisualState = () => undefined;
		hex.cleanOverlayVisualState = () => undefined;
		hex.setNotTarget = () => undefined;
		hex.unsetNotTarget = () => undefined;
		// setReachable/unsetReachable: keep the reachable flag (bot reads it) but skip
		// hitBox proxy access (UI-only) and updateStyle (already a noop above).
		hex.setReachable = function (this: any) {
			this.reachable = true;
		};
		hex.unsetReachable = function (this: any) {
			this.reachable = false;
		};
		// Stop any rAF spin loops started during setup (hex.startSpinning uses
		// requestAnimationFrame recursively; under Jest fake timers this fires
		// ~312× per 5000ms tick, eating all wall-clock time).
		hex.isSpinning = false;
		hex.startSpinning = () => undefined;
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
	game.skipTurn = function (this: any, o: any = {}) {
		// Destroy any temp (summoned) creatures, as the real skipTurn does.
		this.creatures?.filter((c: any) => c?.temp).forEach((c: any) => c.destroy?.());
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

	game.delayCreature = function (this: any, o: any = {}) {
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
export async function runMatch(game: any): Promise<MatchResult> {
	// Suppress the checkTime interval — it's a noop for infinite time pools but
	// fires every 1000 ms of fake time, creating thousands of empty callbacks.
	const origCheckTime = game.checkTime.bind(game);
	game.checkTime = () => {};

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
	const wallStart = realPerf.now();
	const MAX_WALL_MS = 120_000; // 2 minutes per game

	let _dbgTick = 0;
	const bc = game.botController;
	while (game.gameState !== 'ended' && game.turn < MAX_SIM_TURNS && elapsed < MAX_ELAPSED) {
		// Stagnation check: bail out early if no damage in STAGNATION_ROUNDS rounds.
		if (bc && game.turn > 0 && game.turn - (bc.lastDamageRound ?? 0) > STAGNATION_ROUNDS) {
			break;
		}
		const _t0 = realPerf.now();
		jest.advanceTimersByTime(TICK_MS);
		const _dtAdv = realPerf.now() - _t0;
		// Let microtasks (Promise callbacks from MockAnimations) flush
		await Promise.resolve();
		await Promise.resolve();
		const _dtAwait = realPerf.now() - _t0 - _dtAdv;
		if (_dbgTick < 20) process.stderr.write(`  [tick${_dbgTick} t=${game.turn} adv=${_dtAdv.toFixed(0)}ms await=${_dtAwait.toFixed(0)}ms]\n`);
		_dbgTick++;
		elapsed += TICK_MS;
		if (realPerf.now() - wallStart > MAX_WALL_MS) break;
	}

	game.checkTime = origCheckTime;

	const scores = game.players.map((p: any) => p.getScore().total);
	let winnerIdx: number | null = null;
	const endedByTimeout = game.gameState !== 'ended';

	if (!endedByTimeout) {
		const max = Math.max(...scores);
		const tied = scores.filter((s: number) => s === max).length > 1;
		if (!tied) {
			winnerIdx = scores.indexOf(max);
		}
	}

	return {
		turns: game.turn,
		winnerIdx,
		scores,
		endedByTimeout,
	};
}
