/**
 * Engine adapter types — the GameEngine abstraction that gameplay code
 * talks to instead of raw Phaser APIs.
 *
 * The Phaser 4 adapter is a translation layer: Phaser 4 dropped most of the
 * Phaser 2 CE convenience API (anchor/scale objects, `inputEnabled`,
 * `events.onInput*`, group ordering, `BitmapData`, …), so those live here and
 * are re-implemented on top of Phaser 4's own calls. Anything not listed is
 * forwarded straight to the underlying Phaser 4 game object, which keeps the
 * native API — `depth`, `setTint`, `setLighting`, filters — reachable.
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
	inputEnabled: boolean;
	input: {
		useHandcursor: boolean;
		useHandCursor: boolean;
		priorityID: number;
	};
	events: {
		onInputUp: SignalHandle;
		onInputDown: SignalHandle;
		onInputOver: SignalHandle;
		onInputOut: SignalHandle;
	};
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
	addChild(child: any): any;
	remove(child: any, destroy?: boolean): void;
	removeChild(child: any, destroy?: boolean): void;
	removeAll(destroy?: boolean): void;
	create(x: number, y: number, key: TextureKeyLike, frame?: string, exists?: boolean): SpriteHandle;
	forEach(callback: (child: any) => void, context?: any): void;
	sendToBack(child: any): void;
	bringToTop(child: any): void;
	setChildIndex(child: any, index: number): void;
	/** Render order key; Phaser 4 owns ordering through the native `depth`. */
	getChildIndex(child: any): number;
	sort(property?: string, order?: number): void;
	update(): void;
	alignIn(center?: any, align?: number): void;
	toLocal(point: any, output?: any): any;
	toGlobal(point: any, output?: any): any;
	destroy(): void;
}

// ─── Texture keys ─────────────────────────────────────────────────────────────

/**
 * Anything acceptable where a texture key is expected.
 *
 * Phaser 2 CE's texture-key parameters were loosely typed enough to take a
 * `BitmapData`, and AB's per-pixel effects lean on that. `string` covers the
 * normal loader keys; `BitmapDataHandle` covers the CPU-drawn surfaces; Phaser
 * `Texture`/`Frame` instances are passed through untouched.
 */
export type TextureKeyLike = string | BitmapDataHandle | { key?: unknown } | undefined;

// ─── BitmapData ───────────────────────────────────────────────────────────────

export interface BitmapDataHandle {
	[key: string]: any;
	width: number;
	height: number;
	/**
	 * The key this surface is registered under in the texture manager, so the
	 * handle can be used anywhere a texture key is expected. Phaser 2 CE
	 * registered every `BitmapData` as a texture and accepted it directly in
	 * `sprite.loadTexture(bmd)` / `group.create(x, y, bmd)`; the per-pixel
	 * effects depend on that, and Phaser 4 has no such overload.
	 */
	textureKey: string;
	ctx: CanvasRenderingContext2D;
	context: CanvasRenderingContext2D;
	/**
	 * Phaser 4's DynamicTexture buffers drawing operations and only uploads
	 * them on an explicit `render()`, so marking the surface dirty flushes.
	 */
	dirty: boolean;
	update(): void;
	destroy(): void;
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

// ─── Scale ────────────────────────────────────────────────────────────────────

export interface ScaleHandle {
	parentIsWindow: boolean;
	pageAlignHorizontally: boolean;
	pageAlignVertically: boolean;
	scaleMode: number;
	fullScreenScaleMode: number;
	refresh(): void;
	resize(): void;
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
		sprite(x: number, y: number, key: TextureKeyLike, frame?: string): SpriteHandle;
		text(x: number, y: number, text: string, style?: any): SpriteHandle;
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
		bitmapData(w: number, h: number): BitmapDataHandle;
	};

	make: {
		bitmapData(w: number, h: number): BitmapDataHandle;
	};

	// Loader
	load: {
		start(): void;
		progress: number;
		onFileComplete: SignalHandle;
		onLoadComplete: SignalHandle;
	};

	// Time
	time: {
		now: number;
		elapsedMS: number;
		add(delay: number, cb: () => void): TimerHandle;
		loop(delay: number, cb: () => void): TimerHandle;
		remove(timer: TimerHandle): void;
	};

	// Scale
	scale: ScaleHandle;

	// Camera
	cameras: { main: CameraHandle };

	// World / Display
	world: any;

	// Cache / Textures
	cache: { getImage(key: string): any };

	// Device
	device: { desktop: boolean };

	// Stage
	stage: { disableVisibilityChange: boolean; forcePortrait: boolean };

	// Signals
	signals: Record<string, SignalHandle>;
}
