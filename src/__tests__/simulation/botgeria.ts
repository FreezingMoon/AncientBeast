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
			add(cb: () => void) {
				completeCb = cb;
			},
			addOnce(cb: () => void) {
				completeCb = cb;
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
	// Replace real UI (created inside setup) with stub
	game.UI = makeUiStub();

	// Disable hex visual updates: skips ~15 regex ops + requestAnimationFrame spinning
	// callbacks per call. Without this, 123K+ updateStyle() calls each schedule rAF
	// animations that fire 7500× during fake-time advancement, consuming all wall time.
	// hex.reachable is still set correctly by setReachable()/unsetReachable() because
	// those assign the flag before calling updateStyle().
	game.grid.allhexes.forEach((hex: any) => {
		hex.updateStyle = () => undefined;
	});

	// Fast-mode timing: collapse bot delays to 1 ms.
	// stalePendingActionMs must remain above selectDelayMs + confirmDelayMs.
	const bc = game.botController;
	bc.selectDelayMs = 1;
	bc.confirmDelayMs = 1;
	bc.turnDelayMs = 1;
	bc.stalePendingActionMs = 20;

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

const MAX_SIM_TURNS = 400; // hard cap — prevents infinite loops

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
	// The game engine itself adds ~1350ms of fake time per creature turn
	// (300ms nextCreature timeout + 50ms interval + 1000ms turnThrottle).
	// With bot delays collapsed to 1ms, total per creature turn ≈ 1515ms.
	// TICK_MS=5000 covers ~3 creature turns per iteration (efficient).
	const TICK_MS = 5_000;
	const MAX_ELAPSED = MAX_SIM_TURNS * 10_000;
	let elapsed = 0;

	while (game.gameState !== 'ended' && game.turn < MAX_SIM_TURNS && elapsed < MAX_ELAPSED) {
		jest.advanceTimersByTime(TICK_MS);
		// Let microtasks (Promise callbacks from MockAnimations) flush
		await Promise.resolve();
		await Promise.resolve();
		elapsed += TICK_MS;
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
