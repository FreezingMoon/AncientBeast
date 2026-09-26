/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-function */
/* global NodeListOf */
import * as fs from 'fs';
import * as nodePath from 'path';

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

// Phaser global — creature.ts / plasma-field.ts reference `Phaser` as a global.
declare const globalThis: typeof global & { [key: string]: unknown };

const mockScene = {
	add: {
		sprite: () => ({}),
		image: () => ({}),
		text: () => ({}),
		graphics: () => ({}),
		group: () => ({ children: { clear: () => {} }, add: () => {} }),
		tileSprite: () => ({}),
		renderTexture: () => ({}),
	},
	load: {
		on: () => {},
		start: () => {},
		image: () => {},
		audio: () => {},
	},
	time: {
		addEvent: () => ({ remove: () => {} }),
	},
	textures: {},
	cameras: {
		main: { refresh: () => {} },
	},
	children: { clear: () => {} },
	tweens: {
		add: () => ({ pause: () => {}, play: () => {} }),
		killTweensOf: () => {},
	},
	sys: { game: { device: { desktop: true }, destroy: () => {} } },
};

(globalThis as Record<string, unknown>).Phaser = {
	Easing: {
		Linear: { None: 'Linear.None' },
		Quadratic: { In: 'Quad.In', Out: 'Quad.Out', InOut: 'Quad.InOut' },
		Back: { Out: 'Back.Out' },
	},
	AUTO: 0,
	CANVAS: 1,
	CENTER: 11,
	blendModes: { ADD: 1, NORMAL: 0 },
	Timer: { SECOND: 1000 },
	Scale: {
		NONE: 0,
		FIT: 1,
		ENVELOP: 2,
		WIDTH_CONTROLS_HEIGHT: 3,
		HEIGHT_CONTROLS_WIDTH: 4,
		RESIZE: 5,
	},
	Signal: class {
		add() {}
		dispatch() {}
		remove() {}
	},
	Scene: mockScene,
	Game: class {
		scene = { active: mockScene, scenes: [mockScene] };
		scale = { mode: 0, parentIsWindow: false, autoCenter: 0, fullscreenTarget: null, refresh: () => {}, resize: () => {} };
		device = { desktop: true };
		destroy = () => {};
		cameras = { main: { refresh: () => {} } };
	},
};

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
	// jsdom doesn't implement canvas 2d; plasma-field's getContext returns null
	// and guards on it, so just make the call a no-op to silence the warning.
	const gAny = globalThis as any;
	if (gAny.HTMLCanvasElement) {
		gAny.HTMLCanvasElement.prototype.getContext = () => null;
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

// ─── Phaser mock ─────────────────────────────────────────────────────────────

function makeTween() {
	let completeCb: (() => void) | null = null;
	const scene = {
		tweens: {
			add: (config: any) => {
				if (!config.paused) {
					if (config.delay) {
						setTimeout(() => {
							Object.assign(config.targets, config);
							config.onComplete?.dispatch?.();
						}, config.delay);
					} else {
						Object.assign(config.targets, config);
						config.onComplete?.dispatch?.();
					}
				}
				return {
					targets: config.targets,
					on: (event: string, cb: () => void) => {
						if (event === 'complete') config.onComplete = { dispatch: cb };
						if (event === 'update') config.onUpdate = cb;
					},
					stop: () => {},
					play: () => {},
					paused: config.paused || false,
					scene,
				};
			},
			killTweensOf: () => {},
		},
	};
	const tween: any = {
		isRunning: true,
		_target: null,
		_props: null,
		scene,
		to(props: Record<string, any>, _duration: number, _easing?: any, autoStart = false) {
			this._props = props;
			if (autoStart) {
				if (this._target) Object.assign(this._target, props);
				Promise.resolve().then(() => completeCb?.());
			}
			return this;
		},
		start() {
			if (this._target && this._props) Object.assign(this._target, this._props);
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
				grp.x = x;
				grp.y = y;
			},
			set(x: number, y: number) {
				grp.x = x;
				grp.y = y;
			},
		},
		add: (child: any) => {
			grp.children.push(child);
			return child;
		},
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
				sprite.x = x;
				sprite.y = y;
			},
			set(x: number, y: number) {
				sprite.x = x;
				sprite.y = y;
			},
		},
		scale: {
			x: 1,
			y: 1,
			setTo(x: number, y: number) {
				sprite.x = x;
				sprite.y = y;
			},
			set(x: number, y: number) {
				sprite.x = x;
				sprite.y = y;
			},
		},
		texture: { width: 10, height: 10 },
		width: 10,
		height: 10,
		position: {
			x: 0,
			y: 0,
			set(x: number, y: number) {
				sprite.x = x;
				sprite.y = y;
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
		canvas: {
			getContext: () => ({
				drawImage: () => undefined,
				putImageData: () => undefined,
				getImageData: () => ({ data: new Uint8ClampedArray(0) }),
			}),
		},
		context: {
			drawImage: () => undefined,
			putImageData: () => undefined,
			getImageData: () => ({ data: new Uint8ClampedArray(0) }),
		},
		dirty: false,
		destroy: () => undefined,
	};
}

export function buildPhaserMock(): any {
	const scene = {
		active: true,
		time: {
			now: 0,
			elapsedMS: 0,
			delayedCall: (delay: number, cb: () => void) => {
				cb();
				return { remove: () => undefined };
			},
			addEvent: (config: any) => {
				if (config.loop) {
					config.callback();
					return { remove: () => undefined };
				}
				config.callback();
				return { remove: () => undefined };
			},
		},
		tweens: {
			add: (config: any) => {
				if (!config.paused) {
					Object.assign(config.targets, config);
					config.onComplete?.dispatch?.();
				}
				return {
					targets: config.targets,
					on: (event: string, cb: () => void) => {
						if (event === 'complete') config.onComplete = { dispatch: cb };
						if (event === 'update') config.onUpdate = cb;
					},
					stop: () => {},
					play: () => {},
					paused: config.paused || false,
					scene,
				};
			},
			killTweensOf: () => {},
		},
		add: {
			sprite: (config: any) => makePhaserSprite(),
			image: (config: any) => makePhaserSprite(),
			text: (config: any) => makePhaserSprite(),
			graphics: (config: any) => makePhaserSprite(),
			group: () => makePhaserGroup(),
			tileSprite: (config: any) => makePhaserSprite(),
			renderTexture: (config: any) => ({
				width: config.width,
				height: config.height,
				canvas: { getContext: () => ({ drawImage: () => {} }) },
				update: () => {},
				destroy: () => {},
			}),
		},
		textures: {
			get: (key: string) => null,
		},
		cameras: {
			main: { shake: () => {}, refresh: () => {} },
		},
		children: {
			clear: () => {},
		},
		sys: {
			game: {
				device: { desktop: true },
				destroy: () => {},
			},
		},
	};

	return {
		scene,
		tweens: scene.tweens,
		cameras: scene.cameras,
		add: scene.add,
		textures: scene.textures,
		children: scene.children,
		sys: scene.sys,
		world: { width: 1920, height: 1080 },
		cache: { getImage: () => null },
		width: 1920,
		height: 1080,
		scale: {
			parentIsWindow: false,
			pageAlignHorizontally: false,
			pageAlignVertically: false,
			scaleMode: 0,
			fullScreenScaleMode: 0,
			autoCenter: 0,
			fullscreenTarget: null,
			refresh: () => undefined,
			resize: () => undefined,
			mode: 0,
		},
		stage: { disableVisibilityChange: false, forcePortrait: false },
		device: { desktop: true },
		time: {
			now: 0,
			elapsedMS: 0,
			events: {
				loop: () => 0,
				remove: () => undefined,
				add: () => 0,
			},
		},
		load: {
			progress: 100,
			onFileComplete: { add: () => undefined },
			onLoadComplete: { add: () => undefined },
			start: () => undefined,
		},
	};
}

// ─── Real Signal implementation ──────────────────────────────────────────────

class SimSignal {
	private listeners: Array<{ fn: (...args: any[]) => void; ctx?: any }> = [];
	add(fn: (...args: any[]) => void, ctx?: any) {
		this.listeners.push({ fn, ctx });
	}
	dispatch(...args: any[]) {
		for (const { fn, ctx } of this.listeners) fn.apply(ctx, args);
	}
}

// ─── Animations mock (completes movement synchronously) ─────────────────────

class MockAnimations {
	game: any;
	animationCounter = 0;
	movementPoints = 0;

	constructor(game: any) {
		this.game = game;
	}

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

	movementComplete(creature: any, _hex: any, animId: number | string, opts: Record<string, any>) {
		if (
			opts?.customMovementPoint &&
			typeof opts.customMovementPoint === 'number' &&
			opts.customMovementPoint > 0
		)
			creature.remainingMove = this.movementPoints;
		if (opts?.turnAroundOnComplete) creature.facePlayerDefault?.();
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

	game.Phaser = buildPhaserMock();
	// Wrap the mock in the engine adapter so gameplay code uses gameEngine
	// instead of game.Phaser directly.
	const { Phaser4Engine } = await import('../engine/Phaser4Engine');
	const engine = new Phaser4Engine(game.Phaser);
	for (const ch of Object.keys(game.signals)) {
		engine.signals[ch] = game.signals[ch];
	}
	game._gameEngine = engine;
	game.animations = new MockAnimations(game);

	const signalChannels = ['ui', 'metaPowers', 'creature', 'hex'];
	game.signals = signalChannels.reduce((acc: Record<string, any>, ch: string) => {
		acc[ch] = new SimSignal();
		return acc;
	}, {} as Record<string, any>);

	game.botController.game = game;
	game.signals.creature.add(
		game.botController.handleCreatureSignal.bind(game.botController),
		game.botController,
	);

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

	game.setup(config.gameMode);
	// setup() reinstalls a real Animations instance; swap it back for the mock.
	game.animations = new MockAnimations(game);

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
				this.remainingMove = 0;
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
			this.signals.creature.dispatch('activate', { creature: this.activeCreature });
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
 * Pump the (real) event loop until `predicate` is true or we hit the bounds.
 * The headless engine advances via setTimeout/setInterval (clamped to ~1ms by
 * the sim patches) plus Promise microtasks, so awaiting a macrotask repeatedly
 * lets it progress without jest fake timers.
 */
export async function pumpUntil(
	game: any,
	predicate: (game: any) => boolean,
	options: { maxIters?: number; maxMs?: number } = {},
): Promise<void> {
	const maxIters = options.maxIters ?? 20000;
	const maxMs = options.maxMs ?? 60_000;
	const start = Date.now();
	for (let i = 0; i < maxIters; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
		if (predicate(game) || Date.now() - start > maxMs) return;
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
	const maxIters = options.maxIters ?? 20000;
	const maxMs = options.maxMs ?? 60_000;
	const start = Date.now();
	let streak = 0;
	for (let i = 0; i < maxIters; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
		if (game.gameState === 'ended') return;
		streak = isIdle(game) ? streak + 1 : 0;
		if (streak >= 2) return;
		if (Date.now() - start > maxMs) return;
	}
}

/** Apply a single client `Intent` to the engine (does not await settle). */
export function applyIntent(game: any, intent: import('./authoritativeTypes').Intent): void {
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
