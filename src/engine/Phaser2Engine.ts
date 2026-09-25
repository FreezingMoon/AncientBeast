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
 TweenHandle,
} from './types';

// ─── Signal wrapper ───────────────────────────────────────────────────────────

class SignalAdapter implements SignalHandle {
	readonly signal: any;

	constructor(signal: any) {
		this.signal = signal;
	}

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
	readonly tween: any;

	constructor(tween: any) {
		this.tween = tween;
	}

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
	readonly bmd: any;

	constructor(bmd: any) {
		this.bmd = bmd;
	}

	get width() { return this.bmd.width; }
	get height() { return this.bmd.height; }
	get ctx() { return this.bmd.ctx; }
	get context() { return this.bmd.context; }
	get canvas() { return this.bmd.canvas; }
	get dirty() { return this.bmd.dirty; }
	set dirty(v: boolean) { this.bmd.dirty = v; }
	update() { this.bmd.update(); }
	destroy() { this.bmd.destroy(); }
}

// ─── Scale adapter ─────────────────────────────────────────────────────────────

class ScaleAdapter implements ScaleHandle {
	readonly phaser: any;
	private _scale: any;

	constructor(phaser: any) {
		this.phaser = phaser;
	}

	private get scale() {
		if (!this._scale) {
			this._scale = this.phaser.scale;
		}
		return this._scale;
	}

	get parentIsWindow() { return this.scale?.parentIsWindow ?? false; }
	set parentIsWindow(v: boolean) { if (this.scale) this.scale.parentIsWindow = v; }
	get pageAlignHorizontally() { return this.scale?.pageAlignHorizontally ?? false; }
	set pageAlignHorizontally(v: boolean) { if (this.scale) this.scale.pageAlignHorizontally = v; }
	get pageAlignVertically() { return this.scale?.pageAlignVertically ?? false; }
	set pageAlignVertically(v: boolean) { if (this.scale) this.scale.pageAlignVertically = v; }
	get scaleMode() { return this.scale?.scaleMode ?? 0; }
	set scaleMode(v: number) { if (this.scale) this.scale.scaleMode = v; }
	get fullScreenScaleMode() { return this.scale?.fullScreenScaleMode ?? 0; }
	set fullScreenScaleMode(v: number) { if (this.scale) this.scale.fullScreenScaleMode = v; }
	refresh() { if (this.scale) this.scale.refresh(); }
	resize() { if (this.scale) this.scale.refresh(); }
}

// ─── Camera adapter ────────────────────────────────────────────────────────────

class CameraAdapter implements CameraHandle {
	readonly phaser: any;
	readonly SHAKE_HORIZONTAL = 1;
	readonly SHAKE_VERTICAL = 2;
	readonly SHAKE_BOTH = 3;
	private _camera: any;

	constructor(phaser: any) {
		this.phaser = phaser;
	}

	private get camera() {
		if (!this._camera) {
			this._camera = this.phaser.camera;
		}
		return this._camera;
	}

	shake(duration: number, amplitude: number, force?: boolean, direction?: number | string, snap?: boolean) {
		// Phaser 2 signature: shake(amplitude, duration, force, direction, snap)
		// Adapter normalizes to: shake(duration, amplitude, force, direction, snap)
		const camera = this.camera;
		if (camera && typeof camera.shake === 'function') {
			camera.shake(amplitude, duration, force, direction as any, snap);
		}
	}
}

// ─── Timer adapter ─────────────────────────────────────────────────────────────

class TimerAdapter implements TimerHandle {
	readonly timer: any;

	constructor(timer: any) {
		this.timer = timer;
	}
}

// ─── Loader adapter ────────────────────────────────────────────────────────────

class LoaderAdapter {
	readonly phaser: any;
	private _load: any;

	constructor(phaser: any) {
		this.phaser = phaser;
	}

	private get load() {
		if (!this._load) {
			this._load = this.phaser.load;
		}
		return this._load;
	}

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
		elapsedMS: number;
		add(delay: number, cb: () => void): TimerHandle;
		loop(delay: number, cb: () => void): TimerHandle;
		remove(timer: TimerHandle): void;
	};

	public add: {
		socket(x: number, y: number, key: string, frame?: string): SpriteHandle;
		image(x: number, y: number, key: string, frame?: string): SpriteHandle;
		sprite(x: number, y: number, key: string, frame?: string): SpriteHandle;
		text(x: number, y: number, text: string, style?: any): SpriteHandle;
		graphics(x?: number, y?: number, parent?: GroupHandle): SpriteHandle;
		group(parent?: GroupHandle, name?: string): GroupHandle;
		tileSprite(x: number, y: number, w: number, h: number, key: string, frame?: string): SpriteHandle;
		bitmapData(w: number, h: number): BitmapDataHandle;
	};

	public make: {
		bitmapData(w: number, h: number): BitmapDataHandle;
	};

	public readonly phaser: any;

	constructor(phaser: any) {
		this.phaser = phaser;
		this.scale = new ScaleAdapter(phaser);
		this.cameras = { main: new CameraAdapter(phaser) };
		this.world = {
			removeAll: (destroy?: boolean) => phaser.world.removeAll(destroy),
		};
		this.cache = {
			getImage: (key: string) => phaser.cache.getImage(key),
		};
		this.device = { desktop: phaser.device.desktop };
		this.stage = {
			get disableVisibilityChange() { return phaser.stage?.disableVisibilityChange ?? false; },
			set disableVisibilityChange(v: boolean) {
				if (phaser.stage) {
					phaser.stage.disableVisibilityChange = v;
				}
			},
			get forcePortrait() { return phaser.stage?.forcePortrait ?? false; },
			set forcePortrait(v: boolean) {
				if (phaser.stage) {
					phaser.stage.forcePortrait = v;
				}
			},
		};
		this.signals = {};
		this.load = new LoaderAdapter(phaser);
		this.time = {
			get now() { return phaser.time.now; },
			get elapsedMS() { return phaser.time.elapsedMS; },
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
			sprite: (x: number, y: number, key: string, frame?: string) =>
				phaser.add.sprite(x, y, key, frame) as unknown as SpriteHandle,
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

		// make.* factories — pass through to phaser.make
		this.make = {
			bitmapData: (w: number, h: number) =>
				new BitmapDataAdapter(phaser.make.bitmapData(w, h)),
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