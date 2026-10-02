/**
 * NullEngine — the headless `GameEngine`.
 *
 * Implements the same neutral `GameEngine` vocabulary as `Phaser4Engine`, but
 * with inert handles and no renderer. Used by:
 *   - the bot simulation harness (`bun run simulate`)
 *   - the Devvit server-side simulation (`createHeadlessGame`)
 *   - any Jest suite that needs a `GameEngine` but no pixels
 *
 * Two behaviours are *not* inert, because gameplay depends on them:
 *   - `tween()` applies the target properties synchronously and resolves
 *     `onComplete` on a microtask, so chained callbacks (trap fades, ability
 *     handoffs) still run in order.
 *   - CPU-drawn surfaces come from `createGameCanvasSurface` in
 *     `src/game-display/canvas-surface.ts`, which owns the headless 2D
 *     fallback, so the pixel paths in `animations.ts` / `bitmapUtils.ts`
 *     (`getImageData` / `putImageData` / `drawImage`) work headless.
 */

import { setOnDemandLoader } from '../assets';
import type {
	BoundsRect,
	GameEngine,
	GroupHandle,
	ShaderHandle,
	SignalHandle,
	SpriteHandle,
	TextureKeyLike,
	TimerHandle,
	TweenHandle,
} from './types';

// ─── Signals ──────────────────────────────────────────────────────────────────

class NullSignal implements SignalHandle {
	private listeners: Array<{ fn: (...args: any[]) => void; ctx?: any; once: boolean }> = [];

	add(fn: (...args: any[]) => void, context?: any): void {
		this.listeners.push({ fn, ctx: context, once: false });
	}

	addOnce(fn: (...args: any[]) => void, context?: any): void {
		this.listeners.push({ fn, ctx: context, once: true });
	}

	remove(fn: (...args: any[]) => void): void {
		this.listeners = this.listeners.filter((l) => l.fn !== fn);
	}

	removeAll(): void {
		this.listeners = [];
	}

	dispatch(...args: any[]): void {
		for (const listener of [...this.listeners]) {
			if (listener.once) this.remove(listener.fn);
			listener.fn.apply(listener.ctx, args);
		}
	}
}

// ─── Tween ────────────────────────────────────────────────────────────────────

/**
 * Tween stand-in. Properties are applied as soon as the tween starts and the
 * completion callback fires on a microtask, which is what the simulation's
 * fake-timer loop needs in order to advance past animation gates.
 */
class NullTween implements TweenHandle {
	private props: Record<string, any> | null = null;
	private started = false;
	private repeats = 0;
	private yoyoFlag = false;
	private loopCount = -1;
	private iteration = 0;
	private runLoop = false;

	private readonly completeHandlers: Array<{
		fn: (...args: any[]) => void;
		ctx?: any;
		once: boolean;
	}> = [];
	private readonly updateHandlers: Array<{ fn: (target: any) => void; ctx?: any }> = [];

	// Declared explicitly rather than as a constructor parameter property:
	// @babel/preset-typescript (used by Jest) does not strip parameter
	// properties, so the test run would fail to parse this file.
	private readonly target: Record<string, any>;

	constructor(target: Record<string, any>) {
		this.target = target;
	}

	to(
		props: Record<string, any>,
		_duration?: number,
		_easing?: string | ((k: number) => number),
		autoStart?: boolean,
		_delay?: number,
		repeat?: number,
		yoyo?: boolean,
	): TweenHandle {
		this.props = props;
		this.loopCount = repeat ?? this.loopCount;
		if (yoyo !== undefined) this.yoyoFlag = yoyo;
		if (autoStart) this.start();
		return this;
	}

	start(): TweenHandle {
		if (this.started) return this;
		this.started = true;
		this.runLoop = this.loopCount !== 0;
		this.applyProps();
		// Completion is asynchronous so callers can still register `onComplete`
		// after calling `to({...}, d, ease, true)`.
		Promise.resolve().then(() => this.completeOnce());
		return this;
	}

	stop(): TweenHandle {
		this.runLoop = false;
		this.started = false;
		return this;
	}

	yoyo(enable = true): TweenHandle {
		this.yoyoFlag = enable;
		return this;
	}

	repeat(count = -1): TweenHandle {
		this.loopCount = count;
		return this;
	}

	onUpdateCallback(cb: (...args: any[]) => void, context?: any): TweenHandle {
		this.updateHandlers.push({ fn: cb, ctx: context });
		return this;
	}

	private applyProps(): void {
		if (!this.props) return;
		for (const [key, value] of Object.entries(this.props)) {
			// Nested Phaser 2 point-like objects (`.scale`, `.anchor`) are plain
			// objects on handles, so a shallow assign lands correctly.
			if (value && typeof value === 'object' && !Array.isArray(value)) {
				const existing = (this.target as Record<string, any>)[key];
				if (existing && typeof existing === 'object') {
					Object.assign(existing, value);
					continue;
				}
			}
			(this.target as Record<string, any>)[key] = value;
		}
		for (const handler of this.updateHandlers) handler.fn.call(handler.ctx, this.target);
	}

	private completeOnce(): void {
		if (!this.started) return;
		this.started = false;
		this.iteration++;
		for (const handler of [...this.completeHandlers]) {
			if (handler.once) this.completeHandlers.splice(this.completeHandlers.indexOf(handler), 1);
			handler.fn.apply(handler.ctx, [this.target]);
		}
		if (this.runLoop && this.iteration <= this.loopCount) {
			this.started = true;
			Promise.resolve().then(() => this.completeOnce());
		} else if (this.yoyoFlag && this.iteration < 2) {
			// Phaser 2 yoyo played the tween forwards then backwards; the
			// simulation only needs the second pass to happen, not to reverse
			// the property values.
			this.started = true;
			Promise.resolve().then(() => this.completeOnce());
		}
	}

	get onComplete(): TweenHandle['onComplete'] {
		return {
			add: (fn, context?) => {
				this.completeHandlers.push({ fn, ctx: context, once: false });
			},
			addOnce: (fn, context?) => {
				this.completeHandlers.push({ fn, ctx: context, once: true });
			},
		};
	}

	set onComplete(_value: TweenHandle['onComplete']) {
		// Phaser 2 code assigns `onComplete.add` rather than reading it; the
		// getter above always returns the live handler list, so assignment is
		// intentionally ignored.
	}
}

// ─── Sprites ──────────────────────────────────────────────────────────────────

function makeSprite(x = 0, y = 0, key: TextureKeyLike = ''): SpriteHandle {
	// CPU-drawn surfaces are real texture keys under Phaser 4, so an absent key
	// still has to normalize to something the sprite can carry.
	const resolvedKey = key ?? '';

	const sprite: Record<string, any> = {
		x,
		y,
		alpha: 1,
		angle: 0,
		rotation: 0,
		angleDeg: 0,
		exists: true,
		visible: true,
		width: 0,
		height: 0,
		key: resolvedKey,
		text: '',
		texture: { width: 0, height: 0 },
		blendMode: 0,
		depth: 0,
		// Pointer events are Phaser 4's own; the headless engine only has to
		// satisfy the emitter shape, since nothing can click a headless board.
		input: null,
		on: () => sprite,
		anchor: { x: 0, y: 0 },
		scale: { x: 1, y: 1 },
		flipX: false,
		flipY: false,
		scaleX: 1,
		scaleY: 1,
		data: {},
		parent: null,
		trace: { width: 0, height: 0 },
		originX: 0.5,
		originY: 0.5,
		mask: null,
		// Pointer plumbing is inert but shape-compatible.
		setInteractive: () => sprite,
		disableInteractive: () => sprite,
		setOrigin: (ox: number, oy = ox) => {
			sprite.originX = ox;
			sprite.originY = oy;
			return sprite;
		},
		setPosition: (px: number, py: number) => {
			sprite.x = px;
			sprite.y = py;
			return sprite;
		},
		setScale: (sx: number, sy = sx) => {
			sprite.scaleX = sx;
			sprite.scaleY = sy;
			return sprite;
		},
		setDepth: (value: number) => {
			sprite.depth = value;
			return sprite;
		},
		getDepth: () => sprite.depth,
		loadTexture: (nextKey: TextureKeyLike) => {
			sprite.key = nextKey;
			return sprite;
		},
		setTexture: (nextKey: TextureKeyLike) => {
			sprite.key = nextKey;
			return sprite;
		},
		setDisplaySize: () => sprite,
		setSize: () => sprite,
		setVisible: (v: boolean) => {
			sprite.visible = v;
			return sprite;
		},
		getBounds: () => makeBounds(sprite.x, sprite.y, sprite.width, sprite.height),
		alignIn: () => undefined,
		destroy: () => {
			sprite.exists = false;
		},
		kill: () => {
			sprite.exists = false;
		},
		revive: () => {
			sprite.exists = true;
		},
		// Phaser.Graphics surface — no-ops, but keeps call sites type-safe.
		beginFill: () => undefined,
		endFill: () => undefined,
		clear: () => undefined,
		lineStyle: () => undefined,
		moveTo: () => undefined,
		lineTo: () => undefined,
		drawRect: () => undefined,
		drawCircle: () => undefined,
		fillRect: () => undefined,
		fillCircle: () => undefined,
		beginPath: () => undefined,
		closePath: () => undefined,
		strokePath: () => undefined,
		fillPath: () => undefined,
		generateTexture: () => undefined,
		// Plucked from Phaser 2 call sites that survive in helpers.
		centerX: 0,
		centerY: 0,
		worldView: { x: 0, y: 0, width: 1920, height: 1080 },
	};

	// Phaser 2 mutates `anchor`/`scale` through `setTo`/`set`; the object form
	// used by Phaser 4 is separate.
	sprite.anchor.setTo = (ax: number, ay = ax) => {
		sprite.anchor.x = ax;
		sprite.anchor.y = ay;
	};
	sprite.anchor.set = sprite.anchor.setTo;
	sprite.scale.setTo = (sx: number, sy = sx) => {
		sprite.scale.x = sx;
		sprite.scale.y = sy;
	};
	sprite.scale.set = sprite.scale.setTo;
	sprite.position = {
		get x() {
			return sprite.x;
		},
		get y() {
			return sprite.y;
		},
		set(px: number, py: number) {
			sprite.x = px;
			sprite.y = py;
		},
		clone: () => ({ x: sprite.x, y: sprite.y }),
	};

	return sprite as SpriteHandle;
}

function makeBounds(x: number, y: number, width: number, height: number): BoundsRect {
	return {
		x,
		y,
		width,
		height,
		left: x,
		right: x + width,
		top: y,
		bottom: y + height,
	};
}

// ─── Groups ───────────────────────────────────────────────────────────────────

function makeGroup(x = 0, y = 0): GroupHandle {
	const children: any[] = [];

	const group: Record<string, any> = {
		x,
		y,
		alpha: 1,
		angle: 0,
		exists: true,
		visible: true,
		depth: 0,
		children,
		/**
		 * Phaser 4's `Container` exposes its children as `list`; `children` was
		 * Phaser 2's `Group` spelling. Both name the same array, so code written
		 * against the native container works unchanged against this stand-in.
		 */
		list: children,
		length: 0,
		// Phaser 2 exposed the child count as `total`; kept alongside `length`.
		total: 0,
		parent: null,
		scaleX: 1,
		scaleY: 1,
		mask: null,
		anchor: { x: 0, y: 0 },
		scale: { x: 1, y: 1 },
		add: (child: any) => {
			children.push(child);
			group.length = children.length;
			group.total = children.length;
			return child;
		},
		addAt: (child: any, index: number) => {
			children.splice(index, 0, child);
			group.length = children.length;
			group.total = children.length;
			return child;
		},
		addChild: (child: any) => {
			children.push(child);
			group.length = children.length;
			group.total = children.length;
			return child;
		},
		create: (px = 0, py = 0, key: TextureKeyLike = '', _frame?: string) =>
			group.add(makeSprite(px, py, key)) as SpriteHandle,
		remove: (child: any, _destroy?: boolean) => {
			const i = children.indexOf(child);
			if (i !== -1) children.splice(i, 1);
			group.length = children.length;
			group.total = children.length;
		},
		removeChild: (child: any, _destroy?: boolean) => {
			const i = children.indexOf(child);
			if (i !== -1) children.splice(i, 1);
			group.length = children.length;
			group.total = children.length;
		},
		removeAll: (_destroy?: boolean) => {
			children.length = 0;
			group.length = 0;
		},
		forEach: (callback: (child: any) => void, context?: any) => {
			for (const child of [...children]) callback.call(context, child);
		},
		sendToBack: (child: any) => {
			const i = children.indexOf(child);
			if (i > 0) {
				children.splice(i, 1);
				children.unshift(child);
			}
		},
		bringToTop: (child: any) => {
			const i = children.indexOf(child);
			if (i !== -1 && i !== children.length - 1) {
				children.splice(i, 1);
				children.push(child);
			}
		},
		getIndex: (child: any) => children.indexOf(child),
		// Phaser 4 sorts by `depth`; Phaser 2 call sites pass a property name.
		// `order < 0` means "ascending" here to match the real adapter, which
		// inverts Phaser 2's flag because Phaser 2's renderer ignored list order
		// (see `sortChildrenByDepth` in Phaser4Handles).
		sort: (property = 'depth', order = 1) => {
			children.sort((a, b) => {
				const av = a?.[property] ?? 0;
				const bv = b?.[property] ?? 0;
				return order < 0 ? av - bv : bv - av;
			});
		},
		setDepth: (value: number) => {
			group.depth = value;
			return group;
		},
		getDepth: () => group.depth,
		setScale: (sx: number, sy = sx) => {
			group.scaleX = sx;
			group.scaleY = sy;
			return group;
		},
		setPosition: (px: number, py: number) => {
			group.x = px;
			group.y = py;
			return group;
		},
		setOrigin: (ox: number, oy = ox) => {
			group.anchor.x = ox;
			group.anchor.y = oy;
			return group;
		},
		setAlpha: (a: number) => {
			group.alpha = a;
			return group;
		},
		update: () => undefined,
		alignIn: () => undefined,
		/**
		 * Phaser 4 dropped group-local coordinates. Without a real scene graph
		 * the headless group has no transform, so translation is the identity
		 * apart from the group's own offset.
		 */
		toLocal: (point: any, output: any = {}) => {
			output.x = point.x - group.x;
			output.y = point.y - group.y;
			return output;
		},
		toGlobal: (point: any, output: any = {}) => {
			output.x = point.x + group.x;
			output.y = point.y + group.y;
			return output;
		},
		destroy: () => {
			children.length = 0;
			group.exists = false;
		},
	};

	group.position = {
		get x() {
			return group.x;
		},
		get y() {
			return group.y;
		},
		set(px: number, py: number) {
			group.x = px;
			group.y = py;
		},
	};
	group.anchor.setTo = (ax: number, ay = ax) => {
		group.anchor.x = ax;
		group.anchor.y = ay;
	};
	group.anchor.set = group.anchor.setTo;
	group.scale.setTo = (sx: number, sy = sx) => {
		group.scale.x = sx;
		group.scale.y = sy;
	};
	group.scale.set = group.scale.setTo;

	return group as GroupHandle;
}

// ─── Timers ───────────────────────────────────────────────────────────────────

/**
 * Timer handles are inert by design.
 *
 * Phaser 2 CE's `game.time` was never the simulation's clock: every timed
 * effect in AB goes through host `setTimeout` / `setInterval`, which the
 * harness drives with jest fake timers. Engine timers only ever needed to be
 * removable, so registering a real interval here would add a second, unsynced
 * clock that spins under fake timers.
 */
class NullTimer {
	destroy(): void {}
}

// ─── The engine ───────────────────────────────────────────────────────────────

export class NullEngine implements GameEngine {
	constructor() {
		// Headless draws nothing, so every key counts as present and the on-demand
		// path in `assets.ts` short-circuits instead of queueing anything. Binding
		// it here keeps simulation callers free of asset plumbing.
		setOnDemandLoader(
			() => undefined,
			() => true,
		);
	}

	public readonly world = { removeAll: (_destroy?: boolean) => undefined };

	/** No textures are loaded headless; consumers treat a null image as "no pixels". */
	public readonly cache = { getImage: (_key: string) => null };

	public readonly device = { desktop: true };

	public readonly stage = {
		disableVisibilityChange: false,
		forcePortrait: false,
	};

	/**
	 * Headless: there is no renderer, so no fragment shader can run. Effects that
	 * can render acceptably another way check this and fall back.
	 */
	public readonly supportsShaders = false;

	/**
	 * Headless has no texture manager. Reporting every key as present keeps
	 * callers that gate a redraw on `onReady` from waiting forever, and nothing
	 * ever draws in a simulation anyway.
	 *
	 * The on-demand *queueing* side is bound separately, in the constructor, via
	 * `setOnDemandLoader`.
	 */
	public readonly textures: GameEngine['textures'] = {
		exists: () => true,
	};

	public readonly time: GameEngine['time'] = {
		now: 0,
		elapsedMS: 0,
		add: (_delay: number, _cb: () => void) => new NullTimer() as TimerHandle,
		loop: (_delay: number, _cb: () => void) => new NullTimer() as TimerHandle,
		remove: (timer: TimerHandle) => timer?.destroy?.(),
	};

	public readonly add: GameEngine['add'] = {
		socket: (x, y, key) => makeSprite(x, y, key),
		image: (x, y, key) => makeSprite(x, y, key),
		sprite: (x, y, key) => makeSprite(x, y, key),
		text: (x, y, text) => {
			const sprite = makeSprite(x, y);
			sprite.text = text;
			return sprite;
		},
		graphics: () => makeSprite(),
		group: () => makeGroup(),
		tileSprite: (x, y, w, h, key) => {
			const sprite = makeSprite(x, y, key);
			sprite.width = w;
			sprite.height = h;
			return sprite;
		},
		/**
		 * An inert quad. Headless runs never rasterise anything, so this exists
		 * only so shader-backed visuals can construct and tear down without
		 * crashing — `supportsShaders` is `false`, which is the signal callers
		 * use to pick a non-shader path anyway.
		 */
		shader: (config, x, y, w, h, parent) => {
			const sprite = makeSprite(x, y, config.name);
			sprite.width = w;
			sprite.height = h;
			sprite.setUniform = (uniformName: string, value: number | number[]) => {
				if (config.initialUniforms) {
					config.initialUniforms[uniformName] = value;
				}
			};
			if (parent) {
				parent.add(sprite);
				sprite.x = x;
				sprite.y = y;
			}
			return sprite as ShaderHandle;
		},
	};

	private readonly activeTweens = new Set<NullTween>();

	tween(target: object): TweenHandle {
		const tween = new NullTween(target as Record<string, any>);
		this.activeTweens.add(tween);
		return tween;
	}

	removeTweensFrom(target: object): void {
		for (const tween of this.activeTweens) {
			if ((tween as unknown as { target: object }).target === target) tween.stop();
		}
		this.activeTweens.clear();
	}

	destroy(): void {
		this.activeTweens.clear();
	}
}
