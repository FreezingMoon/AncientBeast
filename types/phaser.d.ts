/**
 * Phaser 4 module augmentation - adds Phaser 2 CE compatibility types
 * to the existing Phaser 4 type definitions.
 */

// Augment the global Phaser namespace with Phaser 2 CE compatibility types
declare namespace Phaser {
	// Add missing constants from Phaser 2 CE
	const Easing: any;
	const blendModes: any;
	const AUTO: 0;
	const CANVAS: 1;
	const CENTER: number;
	// Phaser 4 Scale modes (SHOW_ALL equivalent is FIT = 1)
	const Scale: {
		NONE: 0;
		FIT: 1;
		ENVELOP: 2;
		WIDTH_CONTROLS_HEIGHT: 3;
		HEIGHT_CONTROLS_WIDTH: 4;
		RESIZE: 5;
	};
	const ScaleManager: { 
		SHOW_ALL: number; 
		EXACT_FIT: number; 
		NO_SCALE: number; 
		USER_SCALE: number; 
	};

	// Add Phaser 2 CE classes
	class Point {
		constructor(x?: number, y?: number);
		x: number;
		y: number;
		setTo(x: number, y: number): this;
	}

	class Polygon {
		constructor(points: any[]);
		addPoint(x: number, y: number): this;
	}

	class Signal {
		add(fn: (...args: any[]) => void, context?: any): void;
		addOnce(fn: (...args: any[]) => void, context?: any): void;
		remove(fn: (...args: any[]) => void, context?: any): void;
		removeAll(): void;
		dispatch(...args: any[]): void;
	}

	class BitmapData {
		width: number;
		height: number;
		ctx: CanvasRenderingContext2D;
		context: CanvasRenderingContext2D;
		dirty: boolean;
		update(): void;
		destroy(): void;
	}

class Sprite {
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
		texture: any;
		inputEnabled: boolean;
		input: { useHandcursor: boolean; useHandCursor: boolean; priorityID: number };
		events: { onInputUp: Signal; onInputDown: Signal; onInputOver: Signal; onInputOut: Signal };
		anchor: { x: number; y: number; setTo(x: number, y?: number): void; set(x: number, y?: number): void };
		scale: { x: number; y: number; setTo(x: number, y?: number): void; set(x: number, y?: number): void };
		position: { x: number; y: number; set(x: number, y: number): void; set(x: number, y: number): void; clone(): any };
		data: Record<string, any>;
		parent: any;
		z: number;
		trace: { width: number; height: number };
		loadTexture(key: string | any, frame?: string): void;
		alignIn(container?: any, position?: number, offsetX?: number, offsetY?: number): this;
		alignTo(container?: any, position?: number, offsetX?: number, offsetY?: number): this;
		destroy(): void;
		kill(): void;
		revive(): void;
		getBounds(): { x: number; y: number; width: number; height: number; left: number; right: number; top: number; bottom: number };
		getLocalBounds(): { x: number; y: number; width: number; height: number };
		beginFill(color?: number, alpha?: number): any;
		drawRect(x: number, y: number, w: number, h: number): any;
		endFill(): any;
		clear(): any;
		lineStyle(lineWidth?: number, color?: number, alpha?: number): any;
		moveTo(x: number, y: number): any;
		lineTo(x: number, y: number): any;
		drawCircle(x: number, y: number, radius: number): any;
		mask: any;
		tint: number;
		toGlobal(position: any): any;
		toLocal(position: any): any;
	}

	class Image extends Sprite {}

	class Text {
		text: string;
		x: number;
		y: number;
		setText(text: string): this;
		setPosition(x: number, y: number): this;
		setStyle(style: any): this;
		destroy(): void;
		data: any;
	}

	class Graphics {
		x: number;
		y: number;
		alpha: number;
		beginFill(color?: number, alpha?: number): this;
		drawRect(x: number, y: number, w: number, h: number): this;
		drawCircle(x: number, y: number, radius: number): this;
		endFill(): this;
		clear(): this;
		lineStyle(lineWidth?: number, color?: number, alpha?: number): this;
		moveTo(x: number, y: number): this;
		lineTo(x: number, y: number): this;
		destroy(): void;
	}

class Group {
		x: number;
		y: number;
		alpha: number;
		angle: number;
		exists: boolean;
		children: any[];
		position: { set(x: number, y: number): void; set(x: number, y: number): void; clone(): any; x: number; y: number };
		scale: { x: number; y: number; setTo(x: number, y?: number): void; set(x: number, y?: number): void };
		add(child: any): any;
		addAt(child: any, index: number): any;
		addChild(child: any): any;
		remove(child: any, destroy?: boolean): void;
		removeChild(child: any): void;
		removeAll(destroy?: boolean): void;
		create(x: number, y: number, key: string, frame?: string, exists?: boolean): Sprite;
		forEach(callback: (child: any) => void, context?: any): void;
		sendToBack(child: any): void;
		bringToTop(child: any): void;
		setChildIndex(child: any, index: number): void;
		getChildIndex(child: any): number;
		sort(key?: string, order?: number): void;
		update(): void;
		alignIn(container?: any, position?: number, offsetX?: number, offsetY?: number): this;
		destroy(): void;
		createMultiple(quantity: number, key: string, frame?: string, exists?: boolean): Sprite[];
		toGlobal(position: any, output?: any): any;
		toLocal(position: any, from?: any, output?: any): any;
	}

	class RenderTexture {
		width: number;
		height: number;
		canvas: HTMLCanvasElement;
		update(): void;
		destroy(): void;
	}

	class TileSprite extends Sprite {
		tileScale: { x: number; y: number };
		tilePosition: { x: number; y: number };
	}

	interface Game {
		width: number;
		height: number;
		world: { width: number; height: number; removeAll(destroy?: boolean): void };
		scale: any;
		stage: { disableVisibilityChange: boolean; forcePortrait: boolean };
		device: { desktop: boolean };
		cache: { getImage(key: string): any };
		load: any;
		add: any;
		tweens: { removeFrom(target: object): void };
		time: any;
		camera: any;
		raf: { stop(): void };
		destroy(clearWorld?: boolean, clearCache?: boolean): void;
		isBooted: boolean;
	}

	namespace Math {
		// Vector2 is already defined in Phaser 4, this merges with it
		interface Vector2 {
			setTo(x: number, y: number): this;
		}
	}

	namespace Geom {
		class Polygon {
			points: any[];
			constructor(points: any[]);
			addPoint(x: number, y: number): this;
		}
	}

	namespace Display {
		namespace Align {
			const CENTER: number;
		}
	}
}

// Also declare module 'phaser' to allow named imports for the added types
declare module 'phaser' {
	// Named exports for direct imports
	export const Easing: any;
	export const blendModes: any;
	export const AUTO: 0;
	export const CANVAS: 1;
	export const CENTER: number;
	export const ScaleManager: { SHOW_ALL: number };
	
	export class Point {
		constructor(x?: number, y?: number);
		x: number;
		y: number;
		setTo(x: number, y: number): this;
	}
	
	export class Polygon {
		constructor(points: any[]);
		addPoint(x: number, y: number): this;
	}
	
	export class Signal {
		add(fn: (...args: any[]) => void, context?: any): void;
		addOnce(fn: (...args: any[]) => void, context?: any): void;
		remove(fn: (...args: any[]) => void, context?: any): void;
		removeAll(): void;
		dispatch(...args: any[]): void;
	}
	
	export class BitmapData {
		width: number;
		height: number;
		ctx: CanvasRenderingContext2D;
		context: CanvasRenderingContext2D;
		dirty: boolean;
		update(): void;
		destroy(): void;
	}
	
	export class Sprite {
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
		texture: any;
		inputEnabled: boolean;
		input: { useHandcursor: boolean; useHandCursor: boolean; priorityID: number };
		events: { onInputUp: Signal; onInputDown: Signal; onInputOver: Signal; onInputOut: Signal };
		anchor: { x: number; y: number; setTo(x: number, y?: number): void; set(x: number, y?: number): void };
		scale: { x: number; y: number; setTo(x: number, y?: number): void; set(x: number, y?: number): void };
		position: { x: number; y: number; set(x: number, y: number): void; set(x: number, y: number): void; clone(): any };
		data: Record<string, any>;
		parent: any;
		z: number;
		trace: { width: number; height: number };
		loadTexture(key: string | any, frame?: string): void;
		alignIn(container?: any, position?: number, offsetX?: number, offsetY?: number): this;
		alignTo(container?: any, position?: number, offsetX?: number, offsetY?: number): this;
		destroy(): void;
		kill(): void;
		revive(): void;
		getBounds(): { x: number; y: number; width: number; height: number; left: number; right: number; top: number; bottom: number };
		getLocalBounds(): { x: number; y: number; width: number; height: number };
		beginFill(color?: number, alpha?: number): any;
		drawRect(x: number, y: number, w: number, h: number): any;
		endFill(): any;
		clear(): any;
		lineStyle(lineWidth?: number, color?: number, alpha?: number): any;
		moveTo(x: number, y: number): any;
		lineTo(x: number, y: number): any;
		drawCircle(x: number, y: number, radius: number): any;
		mask: any;
		tint: number;
		toGlobal(position: any): any;
		toLocal(position: any): any;
	}
	
	export class Image extends Sprite {}
	
	export class Text {
		text: string;
		x: number;
		y: number;
		setText(text: string): this;
		setPosition(x: number, y: number): this;
		setStyle(style: any): this;
		destroy(): void;
		data: any;
	}
	
	export class Graphics {
		x: number;
		y: number;
		alpha: number;
		beginFill(color?: number, alpha?: number): this;
		drawRect(x: number, y: number, w: number, h: number): this;
		drawCircle(x: number, y: number, radius: number): this;
		endFill(): this;
		clear(): this;
		lineStyle(lineWidth?: number, color?: number, alpha?: number): this;
		moveTo(x: number, y: number): this;
		lineTo(x: number, y: number): this;
		destroy(): void;
	}
	
	export class Group {
		x: number;
		y: number;
		alpha: number;
		angle: number;
		exists: boolean;
		children: any[];
		position: { set(x: number, y: number): void; set(x: number, y: number): void; clone(): any; x: number; y: number };
		scale: { x: number; y: number; setTo(x: number, y?: number): void; set(x: number, y?: number): void };
		add(child: any): any;
		addAt(child: any, index: number): any;
		addChild(child: any): any;
		remove(child: any, destroy?: boolean): void;
		removeChild(child: any): void;
		removeAll(destroy?: boolean): void;
		create(x: number, y: number, key: string, frame?: string, exists?: boolean): Sprite;
		forEach(callback: (child: any) => void, context?: any): void;
		sendToBack(child: any): void;
		bringToTop(child: any): void;
		setChildIndex(child: any, index: number): void;
		getChildIndex(child: any): number;
		sort(key?: string, order?: number): void;
		update(): void;
		alignIn(container?: any, position?: number, offsetX?: number, offsetY?: number): this;
		destroy(): void;
		createMultiple(quantity: number, key: string, frame?: string, exists?: boolean): Sprite[];
		toGlobal(position: any, output?: any): any;
		toLocal(position: any, from?: any, output?: any): any;
	}
	
	export class RenderTexture {
		width: number;
		height: number;
		canvas: HTMLCanvasElement;
		update(): void;
		destroy(): void;
	}
	
	export class TileSprite extends Sprite {
		tileScale: { x: number; y: number };
		tilePosition: { x: number; y: number };
	}
	
	export interface Game {
		width: number;
		height: number;
		world: { width: number; height: number; removeAll(destroy?: boolean): void };
		scale: any;
		stage: { disableVisibilityChange: boolean; forcePortrait: boolean };
		device: { desktop: boolean };
		cache: { getImage(key: string): any };
		load: any;
		add: any;
		tweens: { removeFrom(target: object): void };
		time: any;
		camera: any;
		raf: { stop(): void };
		destroy(clearWorld?: boolean, clearCache?: boolean): void;
		isBooted: boolean;
	}
	
	export namespace Math {
		export interface Vector2 {
			setTo(x: number, y: number): this;
		}
	}
	
	export namespace Geom {
		export class Polygon {
			points: any[];
			constructor(points: any[]);
			addPoint(x: number, y: number): this;
		}
	}
	
	export namespace Display {
		export namespace Align {
			export const CENTER: number;
		}
	}

	// Top-level named exports for Phaser 2 CE compatibility
	export class Vector2 {
		x: number;
		y: number;
		constructor(x?: number | Phaser.Types.Math.Vector2Like, y?: number);
		set(x: number, y?: number): this;
		setTo(x: number, y?: number): this;
		clone(): this;
		copy(src: Phaser.Types.Math.Vector2Like): this;
		add(v: Phaser.Types.Math.Vector2Like): this;
		subtract(v: Phaser.Types.Math.Vector2Like): this;
		multiply(v: Phaser.Types.Math.Vector2Like): this;
		divide(v: Phaser.Types.Math.Vector2Like): this;
		length(): number;
		normalize(): this;
		dot(v: Phaser.Types.Math.Vector2Like): number;
		cross(v: Phaser.Types.Math.Vector2Like): number;
		angle(): number;
		distance(v: Phaser.Types.Math.Vector2Like): number;
		lerp(v: Phaser.Types.Math.Vector2Like, t: number): this;
	}

	export class Polygon {
		points: any[];
		constructor(points?: string | number[] | Phaser.Types.Math.Vector2Like[]);
		static Clone(polygon: Phaser.Geom.Polygon): Phaser.Geom.Polygon;
		static Contains(polygon: Phaser.Geom.Polygon, x: number, y: number): boolean;
		static ContainsPoint(polygon: Phaser.Geom.Polygon, vec: Phaser.Math.Vector2): boolean;
	}
}