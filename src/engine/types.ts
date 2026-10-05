/**
 * Engine adapter types — the GameEngine abstraction that gameplay code
 * talks to instead of raw Phaser APIs.
 *
 * The Phaser 4 adapter is a translation layer: Phaser 4 dropped most of the
 * Phaser 2 CE convenience API (anchor/scale objects, group ordering, …), so
 * those live here and are re-implemented on top of Phaser 4's own calls.
 * Anything not listed is forwarded straight to the underlying Phaser 4 game
 * object, which keeps the native API — `depth`, `setTint`, `setLighting`,
 * filters — reachable.
 *
 * Input is no longer part of that translation. `events.onInput*`,
 * `inputEnabled`, and `input.useHandCursor` are gone; gameplay subscribes
 * through `src/input/input.ts` against Phaser 4's own pointer events, and
 * `input` here is the native interactive object.
 */

// ─── Native passthrough ───────────────────────────────────────────────────────

/**
 * The one admitted `any` in the engine layer: native Phaser 4 members reached
 * through a handle.
 *
 * A handle is a forwarding proxy, so gameplay reads `depth`, calls `setTint`,
 * `setVisible`, `setInteractive` and whatever else Phaser 4 offers. Declaring
 * that surface here would make this file a second, always-stale copy of
 * Phaser's own types; typing the proxy's index signatures as `unknown` instead
 * pushes ~200 type errors into call sites that legitimately call through the
 * handle. So the index signatures below are the boundary: they are written in
 * terms of this alias rather than a bare `any`, which keeps the hole visible
 * in one named place instead of letting it spread across the codebase. Every
 * *named* member of these interfaces is properly typed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NativePassthrough = any;

/** A bare `{ x, y }` pair, as `toLocal`/`toGlobal` read one and write one. */
export interface PointLike {
	x: number;
	y: number;
}

// ─── Signal (Phaser.Signal replacement) ───────────────────────────────────────

export interface SignalHandle {
	add(fn: (...args: unknown[]) => void, context?: unknown): void;
	addOnce(fn: (...args: unknown[]) => void, context?: unknown): void;
	remove(fn: (...args: unknown[]) => void, context?: unknown): void;
	removeAll(): void;
	dispatch(...args: unknown[]): void;
}

// ─── Tween ────────────────────────────────────────────────────────────────────

export interface TweenHandle {
	/**
	 * Total time in milliseconds for the tween to play through once, excluding
	 * loop counts and loop delays.
	 *
	 * Mirrors Phaser 4's `Tween.duration`, and zero until `to()` supplies one:
	 * Phaser only computes it in `initTweenData`, so reading it before the
	 * first `to()` yields 0 there too.
	 */
	duration: number;
	to(
		props: Record<string, number>,
		duration: number,
		easing?: string | ((k: number) => number),
		autoStart?: boolean,
		delay?: number,
		repeat?: number,
		yoyo?: boolean,
	): TweenHandle;
	start(): TweenHandle;
	stop(): TweenHandle;
	yoyo(enable?: boolean): TweenHandle;
	repeat(count?: number): TweenHandle;
	onComplete: {
		add(cb: (...args: unknown[]) => void, context?: unknown): void;
		addOnce(cb: (...args: unknown[]) => void, context?: unknown): void;
	};
	onUpdateCallback(cb: (...args: unknown[]) => void, context?: unknown): TweenHandle;
}

/**
 * A `TweenHandle` as the legacy bounce/cleanup call sites read it.
 *
 * Several places open with `if (tween.isRunning)` to avoid restarting work that
 * is already playing. The tween adapter above exposes `start`/`stop`/`duration`
 * and no state flag at all, so `isRunning` is always `undefined`, those guards
 * never fire, and the code behind them runs on every call. Phaser 4's own
 * equivalent is `Tween#isPlaying()`.
 *
 * Declared here rather than papered over with `any` at each site, so the reads
 * keep compiling and the shape of the gap is recorded once.
 */
export type RuntimeStateTween = TweenHandle & {
	isRunning?: boolean;
	/** Phaser 2's `Tween.stop(destroy)`; the flag is accepted but unused here. */
	stop(destroy?: boolean): TweenHandle;
};

// ─── Sprite / Game Object ─────────────────────────────────────────────────────

/**
 * Phaser 4's interactive object, as much of it as AB configures.
 *
 * Structurally typed rather than importing the Phaser class: `SpriteHandle` has
 * to stay usable from the unit suites, which run without Phaser loaded, and the
 * adapter's fake has to satisfy the same shape.
 */
export interface PhaserInput {
	enabled?: boolean;
	cursor?: string;
	hitArea?: unknown;
	hitAreaCallback?: (hitArea: unknown, x: number, y: number, gameObject?: unknown) => boolean;
	customHitArea?: boolean;
	draggable?: boolean;
}

/** Phaser 4 returns a `Geom.Rectangle` from `getBounds()`. */
export interface BoundsRect {
	x: number;
	y: number;
	width: number;
	height: number;
	left: number;
	right: number;
	top: number;
	bottom: number;
}

export interface SpriteHandle {
	[key: string]: NativePassthrough;
	x: number;
	y: number;
	alpha: number;
	angle: number;
	rotation: number;
	exists: boolean;
	width: number;
	height: number;
	key: string;
	text: string;
	blendMode: number;
	/** Phaser 4's own interactive object, once `setInteractive()` has run. */
	input?: PhaserInput;
	/**
	 * Native Phaser 4 event emitter, forwarded by the proxy. Pointer events are
	 * subscribed through `src/input/input.ts` rather than raw, so that AB's
	 * gesture rules apply to every board surface.
	 */
	on(event: string, handler: (...args: unknown[]) => void, context?: unknown): unknown;
	anchor: {
		x: number;
		y: number;
		setTo(x: number, y?: number): void;
		set(x: number, y?: number): void;
	};
	scale: {
		x: number;
		y: number;
		setTo(x: number, y?: number): void;
		set(x: number, y?: number): void;
	};
	position: {
		x: number;
		y: number;
		set(x: number, y: number): void;
		clone(): { x: number; y: number };
	};
	data: Record<string, NativePassthrough>;
	parent: GroupHandle | undefined;
	trace: { width: number; height: number };
	loadTexture(key: TextureKeyLike, frame?: string): void;
	alignIn(center: GroupHandle | SpriteHandle, align?: number): void;
	/** Phaser 4's `GameObject.destroy(fromScene?)`; the flag is forwarded as-is. */
	destroy(fromScene?: boolean): void;
	kill(): void;
	revive(): void;
	getBounds(): BoundsRect;
	// Graphics methods (when used as Graphics object)
	beginFill(color?: number, alpha?: number): void;
	drawRect(x: number, y: number, w: number, h: number): void;
	endFill(): void;
	clear(): void;
	lineStyle(lineWidth?: number, color?: number, alpha?: number): void;
	moveTo(x: number, y: number): void;
	lineTo(x: number, y: number): void;
	drawCircle(x: number, y: number, radius: number): void;
	strokePath(): void;
	mask: NativePassthrough;
}

// ─── Procedural shader ─────────────────────────────────────────────────────────

/**
 * Config for a fully procedural fragment shader, mirroring the subset of
 * Phaser 4's `ShaderQuadConfig` the engine exposes.
 */
export interface ShaderConfigHandle {
	/** Unique render-node name for this shader. */
	name: string;
	/** GLSL ES 1.00 fragment source. */
	fragmentSource: string;
	/** Uniform values applied before the first render and on demand. */
	initialUniforms?: Record<string, number | number[]>;
	/** Called each render with a `setUniform(name, value)` sink. */
	setupUniforms?: (setUniform: (name: string, value: number | number[]) => void) => void;
}

/**
 * A procedural shader quad.
 *
 * Phaser 4's `Shader` mixes in `BlendMode` but NOT `Alpha`, and its
 * `setAlpha()` is a documented no-op — opacity has to be applied inside the
 * fragment shader. It also has no `inCamera`.
 */
export interface ShaderHandle extends SpriteHandle {
	setUniform(name: string, value: number | number[]): void;
}

// ─── Group ────────────────────────────────────────────────────────────────────

export interface GroupHandle {
	[key: string]: NativePassthrough;
	x: number;
	y: number;
	alpha: number;
	angle: number;
	exists: boolean;
	children: SpriteHandle[];
	length: number;
	/** Phaser 2 `Group.total`: the group's child count. */
	total: number;
	position: {
		/** Readable position: Phaser 2's `Group.position` was a point-like object. */
		readonly x: number;
		readonly y: number;
		set(x: number, y: number): void;
	};
	scale: {
		x: number;
		y: number;
		setTo(x: number, y?: number): void;
		set(x: number, y?: number): void;
	};
	/**
	 * Groups nest: `add.group(parent)` parents a fresh group under `parent`, so a
	 * member is either a sprite-like handle or another group handle.
	 */
	add<T extends SpriteHandle | GroupHandle>(child: T): T;
	addAt<T extends SpriteHandle | GroupHandle>(child: T, index: number): T;
	remove(child: SpriteHandle | GroupHandle, destroy?: boolean): void;
	removeAll(destroy?: boolean): void;
	/** Native `Container.each`; hands back the same stable handle each visit. */
	each(callback: (child: SpriteHandle) => void, context?: unknown): void;
	sendToBack(child: SpriteHandle | GroupHandle): void;
	bringToTop(child: SpriteHandle | GroupHandle): void;
	/** A child's position in the draw list, or -1 when it is not a member. */
	getIndex(child: SpriteHandle | GroupHandle): number;
	setScale(x: number, y: number): void;
	/** Render order key; Phaser 4 owns ordering through the native `depth`. */
	sort(property?: string, order?: number): void;
	update(): void;
	toLocal(point: PointLike, output?: PointLike): PointLike;
	toGlobal(point: PointLike, output?: PointLike): PointLike;
	destroy(): void;
}

// ─── Texture keys ─────────────────────────────────────────────────────────────

/**
 * The registered-key side of a CPU-drawn surface.
 *
 * `src/game-display/canvas-surface.ts` owns the full `CanvasSurface`; a texture
 * key only needs the string the surface registered under, so the engine layer
 * states that minimum itself and keeps its own file free of Phaser types.
 */
export interface SurfaceTextureKey {
	readonly key: string;
}

/**
 * Anything acceptable where a texture key is expected.
 *
 * Phaser 2 CE's texture-key parameters were loosely typed enough to take a
 * `BitmapData`, and AB's per-pixel effects leaned on that. Under native Phaser
 * 4 the CPU-drawn surfaces are `CanvasTexture`s registered in the
 * `TextureManager` (see `src/game-display/canvas-surface.ts`), so a surface is
 * now passed as its key like any other texture — either the surface itself or
 * the string it registered under.
 *
 * Phaser only ever sees the string. `TextureManager#get` coerces any key it
 * cannot recognise to `__MISSING`, so handing it a surface object directly would
 * quietly render the missing-texture box rather than the drawn surface; the
 * adapter resolves both spellings to one key before calling into Phaser.
 */
export type TextureKeyLike = string | SurfaceTextureKey | undefined;

// ─── World / display list ─────────────────────────────────────────────────────

/**
 * The scene display list — the stand-in for Phaser 2's `game.world`.
 *
 * `Phaser4Engine` deliberately exposes the scene's whole display list here
 * rather than the `GameScene.world` container: teardown (`removeAll`) has to
 * reach every display object, not only the ones parented under that container.
 * Callers with no group of their own still use it as a parent, since `add`
 * lands on the same display list either way.
 */
export interface WorldHandle {
	removeAll(destroy?: boolean): void;
	readonly width: number;
	readonly height: number;
	add(gameObject: NativePassthrough): unknown;
}

// ─── Camera ───────────────────────────────────────────────────────────────────

export interface CameraHandle {
	/**
	 * Phaser 2 CE order: `shake(amplitude, duration, force, direction, snap)`.
	 * Phaser 4 is `shake(duration, intensity, force)`; the adapter translates,
	 * expressing `direction` as a per-axis `intensity` Vector2.
	 */
	shake(
		amplitude: number,
		duration: number,
		force?: boolean,
		direction?: number | string,
		snap?: boolean,
	): void;
	SHAKE_HORIZONTAL: number;
	SHAKE_VERTICAL: number;
	SHAKE_BOTH: number;
}

// ─── Timer ────────────────────────────────────────────────────────────────────

export type TimerHandle = { destroy?: () => void };

// ─── The GameEngine interface ──────────────────────────────────────────────────

export interface GameEngine {
	// Lifecycle
	destroy(): void;

	// Tween
	tween(target: object): TweenHandle;
	removeTweensFrom(target: object): void;

	// Game object factories
	add: {
		socket(x: number, y: number, key: TextureKeyLike, frame?: string): SpriteHandle;
		image(x: number, y: number, key: TextureKeyLike, frame?: string): SpriteHandle;
		sprite(
			x: number,
			y: number,
			key: TextureKeyLike,
			frame?: string,
			parent?: GroupHandle,
		): SpriteHandle;
		text(x: number, y: number, text: string, style?: unknown, parent?: GroupHandle): SpriteHandle;
		graphics(x?: number, y?: number, parent?: GroupHandle): SpriteHandle;
		group(parent?: GroupHandle, name?: string): GroupHandle;
		tileSprite(
			x: number,
			y: number,
			w: number,
			h: number,
			key: TextureKeyLike,
			frame?: string,
		): SpriteHandle;
		/**
		 * A fully procedural fragment-shader quad. Only functional on the WebGL
		 * renderer — see {@link GameEngine.supportsShaders}.
		 *
		 * Pass `parent` to place the quad inside a group: groups are backed by
		 * `Container`, so the quad then inherits the group's transform and ordering.
		 * Without it the quad sits at un-offset scene coordinates, which is
		 * visibly wrong for anything parented to the offset board display group.
		 */
		shader(
			config: ShaderConfigHandle,
			x: number,
			y: number,
			w: number,
			h: number,
			parent?: GroupHandle,
		): ShaderHandle;
	};

	// Textures. `textures.exists` reports whether a key is drawable yet, which is
	// what lets callers fetch a texture the first time it is needed rather than
	// up front — see assets.ts#loadTexture and issue #678.
	textures: {
		exists(key: string): boolean;
	};

	// Time
	time: {
		now: number;
		elapsedMS: number;
		add(delay: number, cb: () => void): TimerHandle;
		loop(delay: number, cb: () => void): TimerHandle;
		remove(timer: TimerHandle): void;
	};

	// World / Display
	world: WorldHandle;

	// Cache / Textures
	cache: { getImage(key: string): unknown };

	// Device
	device: { desktop: boolean };

	// Stage
	stage: { disableVisibilityChange: boolean; forcePortrait: boolean };

	/**
	 * Whether `add.shader` produces a working fragment shader.
	 *
	 * False on the CANVAS renderer (Phaser 4's `ShaderCanvasRenderer` is an empty
	 * stub, so a shader silently renders nothing) and under `Phaser.HEADLESS`.
	 * Callers that can render acceptably without a shader must check this and
	 * fall back rather than assume a blank quad is a rendering bug.
	 */
	supportsShaders: boolean;
}
