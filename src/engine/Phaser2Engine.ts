/**
 * Phaser 2 (phaser-ce) engine adapter.
 *
 * Wraps the current `game.Phaser` instance, delegating all calls to
 * Phaser 2 CE APIs. This is essentially a pass-through: each method
 * on this class forwards to the corresponding `this.phaser.*` call.
 *
 * The adapter exists so gameplay code can talk to a stable `GameEngine`
 * interface instead of raw Phaser APIs. When we swap to Phaser 4, only
 * this file (and its replacement `Phaser4Engine`) change.
 */

import type {
	BitmapDataHandle,
 CameraHandle,
 GameEngine,
 GroupHandle,
 SignalHandle,
 SpriteHandle,
 ScaleHandle,
 TimerHandle,
} from './types';

// ─── Signal wrapper ───────────────────────────────────────────────────────────

class SignalAdapter implements SignalHandle {
	constructor(private signal: any) {}

	add(fn: (...args: any[]) => void, context?: any) {
		this.signal.add(fn, context);
	}

	addOnce(fn: (...args: any[]) => void, context?: any) {
		this.signal.addOnce(fn, context);
	}

	remove(fn: (...args: any[]) => void, context?: any) {
		this.signal.remove(fn, context);
	}

	removeAll() {
		this.signal.removeAll();
	}

	dispatch(...args: any[]) {
		this.signal.dispatch(...args);
	}
}

// ─── Tween adapter ────────────────────────────────────────────────────────────

class TweenAdapter implements TweenHandle {
	constructor(private tween: any) {}

	to(props: Record<string, any>, duration: number, easing?: string, autoStart?: boolean) {
		this.tween.to(props, duration, easing as any, autoStart);
		return this;
	}

	start() {
		this.tween.start();
		return this;
	}

	stop() {
		this.tween.stop();
		return this;
	}

	yoyo(enable?: boolean) {
		this.tween.yoyo(enable);
		return this;
	}

	repeat(count?: number) {
		this.tween.repeat(count);
		return this;
	}

	get onComplete() {
		return {
			add: (cb: (...args: any[]) => void, context?: any) =>
				this.tween.onComplete.add(cb, context),
			addOnce: (cb: (...args: any[]) => void, context?: any) =>
				this.tween.onComplete.addOnce(cb, context),
		};
	}

	onUpdateCallback(cb: (...args: any[]) => void, context?: any) {
		this.tween.onUpdateCallback(cb, context);
		return this;
	}
}

// ─── BitmapData adapter ───────────────────────────────────────────────────────

class BitmapDataAdapter implements BitmapDataHandle {
	constructor(private bmd: any) {}

	get width() { return this.bmd.width; }
	get height() { return this.bmd.height; }
	get ctx() { return this.bmd.ctx; }
	get context() { return this.bmd.context; }
	get dirty() { return this.bmd.dirty; }
	set dirty(v: boolean) { this.bmd.dirty = v; }
	update() { this.bmd.update(); }
	destroy() { this.bmd.destroy(); }
}

// ─── Scale adapter ─────────────────────────────────────────────────────────────

class ScaleAdapter implements ScaleHandle {
	constructor(private scale: any) {}

	get parentIsWindow() { return this.scale.parentIsWindow; }
	set parentIsWindow(v: boolean) { this.scale.parentIsWindow = v; }
	get pageAlignHorizontally() { return this.scale.pageAlignHorizontally; }
	set pageAlignHorizontally(v: boolean) { this.scale.pageAlignHorizontally = v; }
	get pageAlignVertically() { return this.scale.pageAlignVertically; }
	set pageAlignVertically(v: boolean) { this.scale.pageAlignVertically = v; }
	get scaleMode() { return this.scale.scaleMode; }
	set scaleMode(v: number) { this.scale.scaleMode = v; }
	get fullScreenScaleMode() { return this.scale.fullScreenScaleMode; }
	set fullScreenScaleMode(v: number) { this.scale.fullScreenScaleMode = v; }
	refresh() { this.scale.refresh(); }
	resize() { this.scale.refresh(); }
}

// ─── Camera adapter ────────────────────────────────────────────────────────────

class CameraAdapter implements CameraHandle {
	constructor(private camera: any) {}

	shake(duration: number, amplitude: number, force?: boolean, direction?: number | string, snap?: boolean) {
		// Phaser 2 signature: shake(amplitude, duration, force, direction, snap)
		// Adapter normalizes to: shake(duration, amplitude, force, direction, snap)
		this.camera.shake(amplitude, duration, force, direction as any, snap);
	}
}

// ─── Timer adapter ─────────────────────────────────────────────────────────────

class TimerAdapter implements TimerHandle {
	constructor(public timer: any) {}
}

// ─── Loader adapter ────────────────────────────────────────────────────────────

class LoaderAdapter implements GameEngine['load'] {
	constructor(private load: any) {}

	start() { this.load.start(); }

	get progress() { return this.load.progress; }

	get onFileComplete() {
		return new SignalAdapter(this.load.onFileComplete);
	}

	get onLoadComplete() {
		return new SignalAdapter(this.load.onLoadComplete);
	}
}

// ─── The Phaser2Engine class ───────────────────────────────────────────────────

export class Phaser2Engine implements GameEngine {
	public readonly scale: ScaleHandle;
	public readonly cameras: { main: CameraHandle };
	public readonly world: { removeAll(destroy?: boolean): void };
	public readonly cache: { getImage(key: string): any };
	public readonly device: { desktop: boolean };
	public readonly stage: { disableVisibilityChange: boolean; forcePortrait: boolean };
	public readonly signals: Record<string, SignalHandle>;
	public readonly load: GameEngine['load'];
	public readonly time: {
		now: number;
		add(delay: number, cb: () => void): TimerHandle;
		loop(delay: number, cb: () => void): TimerHandle;
		remove(timer: TimerHandle): void;
	};

	public add: {
		socket(x: number, y: number, key: string, frame?: string): SpriteHandle;
		image(x: number, y: number, key: string, frame?: string): SpriteHandle;
		text(x: number, y: number, text: string, style?: any): SpriteHandle;
		graphics(x?: number, y?: number, parent?: GroupHandle): SpriteHandle;
		group(parent?: GroupHandle, name?: string): GroupHandle;
		tileSprite(x: number, y: number, w: number, h: number, key: string, frame?: string): SpriteHandle;
		bitmapData(w: number, h: number): BitmapDataHandle;
	};

	constructor(public readonly phaser: any) {
		this.scale = new ScaleAdapter(phaser.scale);
		this.cameras = { main: new CameraAdapter(phaser.camera) };
		this.world = {
			removeAll: (destroy?: boolean) => phaser.world.removeAll(destroy),
		};
		this.cache = {
			getImage: (key: string) => phaser.cache.getImage(key),
		};
		this.device = { desktop: phaser.device.desktop };
		this.stage = {
			disableVisibilityChange: phaser.stage.disableVisibilityChange,
			forcePortrait: phaser.stage.forcePortrait,
		};
		this.signals = {};
		this.load = new LoaderAdapter(phaser.load);
		this.time = {
			get now() { return phaser.time.now; },
			add: (delay: number, cb: () => void) =>
				new TimerAdapter(phaser.time.events.add(delay, cb)),
			loop: (delay: number, cb: () => void) =>
				new TimerAdapter(phaser.time.events.loop(delay, cb)),
			remove: (timer: TimerHandle) => {
				phaser.time.events.remove((timer as TimerAdapter).timer);
			},
		};

		// add.* factories — pass through to phaser.add, wrapping bitmapData
		this.add = {
			socket: (x: number, y: number, key: string, frame?: string) =>
				phaser.add.sprite(x, y, key, frame) as unknown as SpriteHandle,
			image: (x: number, y: number, key: string, frame?: string) =>
				phaser.add.image(x, y, key, frame) as unknown as SpriteHandle,
			text: (x: number, y: number, text: string, style?: any) =>
				phaser.add.text(x, y, text, style) as unknown as SpriteHandle,
			graphics: (x?: number, y?: number, parent?: GroupHandle) =>
				phaser.add.graphics(x, y, parent as any) as unknown as SpriteHandle,
			group: (parent?: GroupHandle, name?: string) =>
				phaser.add.group(parent as any, name) as unknown as GroupHandle,
			tileSprite: (x: number, y: number, w: number, h: number, key: string, frame?: string) =>
				phaser.add.tileSprite(x, y, w, h, key, frame) as unknown as SpriteHandle,
			bitmapData: (w: number, h: number) =>
				new BitmapDataAdapter(phaser.add.bitmapData(w, h)),
		};
	}

	destroy() {
		this.phaser.destroy(true, false);
	}

	tween(target: object): TweenHandle {
		return new TweenAdapter(this.phaser.add.tween(target));
	}

	removeTweensFrom(target: object) {
		this.phaser.tweens.removeFrom(target);
	}
}