/**
 * Minimal type declarations for phaser-ce (Phaser Community Edition 2.x).
 *
 * These cover the subset of the Phaser 2 CE API that Ancient Beast uses.
 * They allow `import Phaser from 'phaser-ce'` and bare `Phaser.*` references
 * to type-check without `@ts-expect-error` comments.
 *
 * When the migration to Phaser 4 is complete, this file and the phaser-ce
 * dependency can be removed — Phaser 4 ships its own types.
 */

declare class Point {
	constructor(x?: number, y?: number);
	x: number;
	y: number;
	setTo(x: number, y: number): Point;
}

declare class Polygon {
	constructor(points: Point[] | Array<[number, number]>);
	addPoint(x: number, y: number): Polygon;
}

declare class Signal {
	add(fn: (...args: any[]) => void, context?: any): void;
	addOnce(fn: (...args: any[]) => void, context?: any): void;
	remove(fn: (...args: any[]) => void, context?: any): void;
	removeAll(): void;
	dispatch(...args: any[]): void;
}

declare class BitmapData {
	width: number;
	height: number;
	ctx: CanvasRenderingContext2D;
	context: CanvasRenderingContext2D;
	dirty: boolean;
	update(): void;
	destroy(): void;
}

declare class TimerEvent {}

declare class Game {
	width: number;
	height: number;
	world: { width: number; height: number; removeAll(destroy?: boolean): void };
	scale: {
		parentIsWindow: boolean;
		pageAlignHorizontally: boolean;
		pageAlignVertically: boolean;
		scaleMode: number;
		fullScreenScaleMode: number;
		refresh(): void;
	};
	stage: { disableVisibilityChange: boolean; forcePortrait: boolean };
	device: { desktop: boolean };
	cache: { getImage(key: string): any };
	load: {
		progress: number;
		onFileComplete: Signal;
		onLoadComplete: Signal;
		start(): void;
	};
	add: {
		group(parent?: any, name?: string): any;
		socket(x: number, y: number, key: string, frame?: string): any;
		image(x: number, y: number, key: string, frame?: string): any;
		text(x: number, y: number, text: string, style?: any): any;
		graphics(x?: number, y?: number, parent?: any): any;
		tileSprite(x: number, y: number, w: number, h: number, key: string, frame?: string): any;
		bitmapData(w: number, h: number): BitmapData;
		tween(target: object): any;
	};
	tweens: {
		removeFrom(target: object): void;
	};
	time: {
		now: number;
		events: {
			add(delay: number, cb: () => void): TimerEvent;
			loop(delay: number, cb: () => void): TimerEvent;
			remove(timer: TimerEvent): void;
		};
	};
	camera: {
		shake(amplitude: number, duration: number, force?: boolean, direction?: number, snap?: boolean): void;
		SHAKE_HORIZONTAL: number;
		SHAKE_VERTICAL: number;
		SHAKE_BOTH: number;
	};
	raf: { stop(): void };
	destroy(clearWorld?: boolean, clearCache?: boolean): void;
	isBooted: boolean;
}

declare const AUTO: 0;
declare const CANVAS: 1;
declare const CENTER: number;

declare const ScaleManager: {
	SHOW_ALL: number;
};

declare const Easing: {
	Linear: { None: string };
	Quadratic: { In: string; Out: string; InOut: string };
	Cubic: { In: string; Out: string; InOut: string };
	Sinusoidal: { In: string; Out: string; InOut: string };
	Back: { Out: string };
};

declare const blendModes: {
	NORMAL: 0;
	ADD: 1;
	MULTIPLY: 2;
	OVERLAY: 3;
	DARKEN: 4;
	LIGHTEN: 5;
};

declare namespace Phaser {
	export type Point = Point;
	export type Polygon = Polygon;
	export type Signal = Signal;
	export type BitmapData = BitmapData;
	export type TimerEvent = TimerEvent;
	export type Game = Game;
	export type AUTO = typeof AUTO;
	export type CANVAS = typeof CANVAS;
	export type CENTER = typeof CENTER;
	export type ScaleManager = typeof ScaleManager;
	export type Easing = typeof Easing;
	export type blendModes = typeof blendModes;
}

declare module 'phaser-ce' {
	export = Phaser;
}