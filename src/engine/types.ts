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

// ─── Signal (Phaser.Signal replacement) ───────────────────────────────────────

export interface SignalHandle {
	add(fn: (...args: any[]) => void, context?: any): void;
	addOnce(fn: (...args: any[]) => void, context?: any): void;
	remove(fn: (...args: any[]) => void, context?: any): void;
	removeAll(): void;
	dispatch(...args: any[]): void;
}

// ─── Tween ────────────────────────────────────────────────────────────────────

export interface TweenHandle {
	to(
		props: Record<string, any>,
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
		add(cb: (...args: any[]) => void, context?: any): void;
		addOnce(cb: (...args: any[]) => void, context?: any): void;
	};
	onUpdateCallback(cb: (...args: any[]) => void, context?: any): TweenHandle;
}

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
	[key: string]: any;
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
	on(event: string, handler: (...args: any[]) => void, context?: unknown): unknown;
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
	data: Record<string, any>;
	parent: any;
	trace: { width: number; height: number };
	loadTexture(key: TextureKeyLike, frame?: string): void;
	alignIn(center: any, align?: number): void;
	destroy(): void;
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
	mask: any;
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
	[key: string]: any;
	x: number;
	y: number;
	alpha: number;
	angle: number;
	exists: boolean;
	children: any[];
	length: number;
	/** Phaser 2 `Group.total`: the group's child count. */
	total: number;
	position: {
		set(x: number, y: number): void;
	};
	scale: {
		x: number;
		y: number;
		setTo(x: number, y?: number): void;
		set(x: number, y?: number): void;
	};
	add(child: any): any;
	addAt(child: any, index: number): any;
	remove(child: any, destroy?: boolean): void;
	removeAll(destroy?: boolean): void;
	create(x: number, y: number, key: TextureKeyLike, frame?: string, exists?: boolean): SpriteHandle;
	/** Native `Container.each`; hands back the same stable handle each visit. */
	each(callback: (child: any) => void, context?: any): void;
	sendToBack(child: any): void;
	bringToTop(child: any): void;
	/** A child's position in the draw list, or -1 when it is not a member. */
	getIndex(child: any): number;
	setScale(x: number, y: number): void;
	/** Render order key; Phaser 4 owns ordering through the native `depth`. */
	sort(property?: string, order?: number): void;
	update(): void;
	toLocal(point: any, output?: any): any;
	toGlobal(point: any, output?: any): any;
	destroy(): void;
}

// ─── Texture keys ─────────────────────────────────────────────────────────────

/**
 * Anything acceptable where a texture key is expected.
 *
 * Phaser 2 CE's texture-key parameters were loosely typed enough to take a
 * `BitmapData`, and AB's per-pixel effects leaned on that. Under native Phaser
 * 4 the CPU-drawn surfaces are `CanvasTexture`s registered in the
 * `TextureManager` (see `src/game-display/canvas-surface.ts`), so a surface is
 * now passed as its key like any other texture.
 */
export type TextureKeyLike = string | undefined;

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
		text(x: number, y: number, text: string, style?: any, parent?: GroupHandle): SpriteHandle;
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
	world: any;

	// Cache / Textures
	cache: { getImage(key: string): any };

	// Device
	device: { desktop: boolean };

	// Stage
	stage: { disableVisibilityChange: boolean; forcePortrait: boolean };

	/**
	 * Whether `add.shader` produces a working fragment shader.
	 *
	 * False on the CANVAS renderer (Phaser 4's `ShaderCanvasRenderer` is an empty
	 * stub, so a shader silently renders nothing) and on the headless NullEngine.
	 * Callers that can render acceptably without a shader must check this and
	 * fall back rather than assume a blank quad is a rendering bug.
	 */
	supportsShaders: boolean;
}
