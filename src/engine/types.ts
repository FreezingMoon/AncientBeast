/**
 * Engine adapter types — the GameEngine abstraction that gameplay code
 * talks to instead of raw Phaser APIs. Both a Phaser 2 (phaser-ce) adapter
 * and a Phaser 4 adapter implement this interface, so the swap is a
 * one-line change in game.ts.
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
	};
	data: Record<string, any>;
	parent: any;
	trace: { width: number; height: number };
	loadTexture(key: string | any, frame?: string): void;
	alignIn(center: any, align?: number): void;
	destroy(): void;
	kill(): void;
	revive(): void;
	getBounds(): { x: number; y: number; width: number; height: number };
	// Graphics methods (when used as Graphics object)
	beginFill(color?: number, alpha?: number): void;
	drawRect(x: number, y: number, w: number, h: number): void;
	endFill(): void;
	clear(): void;
	lineStyle(lineWidth?: number, color?: number, alpha?: number): void;
	moveTo(x: number, y: number): void;
	lineTo(x: number, y: number): void;
	drawCircle(x: number, y: number, radius: number): void;
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
	position: {
		set(x: number, y: number): void;
	};
	scale: {
		x: number;
		y: number;
		setTo(x: number, y: number): void;
		set(x: number, y: number): void;
	};
	add(child: any): any;
	addAt(child: any, index: number): any;
	addChild(child: any): any;
	remove(child: any): void;
	removeChild(child: any): void;
	removeAll(destroy?: boolean): void;
	create(x: number, y: number, key: string, frame?: string, exists?: boolean): SpriteHandle;
	forEach(callback: (child: any) => void, context?: any): void;
	sendToBack(child: any): void;
	bringToTop(child: any): void;
	setChildIndex(child: any, index: number): void;
	getChildIndex(child: any): number;
	sort(key?: string, order?: number): void;
	update(): void;
	alignIn(center: any, align?: number): void;
	destroy(): void;
}

// ─── BitmapData ───────────────────────────────────────────────────────────────

export interface BitmapDataHandle {
	[key: string]: any;
	width: number;
	height: number;
	ctx: CanvasRenderingContext2D;
	context: CanvasRenderingContext2D;
	dirty: boolean;
	update(): void;
	destroy(): void;
}

// ─── Camera ───────────────────────────────────────────────────────────────────

export interface CameraHandle {
	shake(
		duration: number,
		amplitude: number,
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
		socket(x: number, y: number, key: string, frame?: string): SpriteHandle;
		image(x: number, y: number, key: string, frame?: string): SpriteHandle;
		sprite(x: number, y: number, key: string, frame?: string): SpriteHandle;
		text(x: number, y: number, text: string, style?: any): SpriteHandle;
		graphics(x?: number, y?: number, parent?: GroupHandle): SpriteHandle;
		group(parent?: GroupHandle, name?: string): GroupHandle;
		tileSprite(
			x: number,
			y: number,
			w: number,
			h: number,
			key: string,
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
