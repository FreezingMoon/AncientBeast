/**
 * Phaser 4 engine adapter.
 *
 * Wraps a Phaser 4 Game/Scene instance, delegating all calls to
 * Phaser 4 APIs. Implements the same GameEngine interface as
 * Phaser2Engine so gameplay code remains engine-agnostic.
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

// ─── Simple EventEmitter for SignalHandle ───────────────────────────────────────

class SimpleEmitter {
	private listeners: Map<string, Array<{ fn: Function; context?: any; once: boolean }>> = new Map();

	on(event: string, fn: Function, context?: any) {
		const arr = this.listeners.get(event) || [];
		arr.push({ fn, context, once: false });
		this.listeners.set(event, arr);
	}

	once(event: string, fn: Function, context?: any) {
		const arr = this.listeners.get(event) || [];
		arr.push({ fn, context, once: true });
		this.listeners.set(event, arr);
	}

	off(event: string, fn: Function, context?: any) {
		const arr = this.listeners.get(event);
		if (!arr) return;
		const idx = arr.findIndex(l => l.fn === fn && l.context === context);
		if (idx >= 0) arr.splice(idx, 1);
	}

	emit(event: string, ...args: any[]) {
		const arr = this.listeners.get(event);
		if (!arr) return;
		const toRemove: number[] = [];
		arr.forEach((l, i) => {
			l.fn.apply(l.context, args);
			if (l.once) toRemove.push(i);
		});
		for (let i = toRemove.length - 1; i >= 0; i--) arr.splice(toRemove[i], 1);
	}

	removeAllListeners(event?: string) {
		if (event) this.listeners.delete(event);
		else this.listeners.clear();
	}
}

// ─── Signal wrapper ─────────────────────────────────────────────────────────────

class SignalAdapter implements SignalHandle {
	private emitter: SimpleEmitter | any;

	constructor(emitter?: any) {
		this.emitter = emitter || new SimpleEmitter();
	}

	add(fn: (...args: any[]) => void, context?: any) {
		this.emitter.on('dispatch', fn, context);
	}

	addOnce(fn: (...args: any[]) => void, context?: any) {
		this.emitter.once('dispatch', fn, context);
	}

	remove(fn: (...args: any[]) => void, context?: any) {
		this.emitter.off('dispatch', fn, context);
	}

	removeAll() {
		this.emitter.removeAllListeners('dispatch');
	}

	dispatch(...args: any[]) {
		this.emitter.emit('dispatch', ...args);
	}
}

// ─── Tween adapter ──────────────────────────────────────────────────────────────

class TweenAdapter implements TweenHandle {
	private tween: any;
	private onCompleteEmitter = new SimpleEmitter();
	private updateCallback: ((...args: any[]) => void) | null = null;
	private updateContext: any = null;

	constructor(tween: any) {
		this.tween = tween;
		tween.on('complete', () => this.onCompleteEmitter.emit('dispatch'));
		tween.on('update', (t: any, target: any) => {
			if (this.updateCallback) this.updateCallback.call(this.updateContext, t, target);
		});
	}

	to(props: Record<string, any>, duration: number, easing?: string | ((k: number) => number), autoStart?: boolean, delay?: number, repeat?: number, yoyo?: boolean): TweenHandle {
		this.tween.stop();
		this.scene?.tweens.killTweensOf(this.tween.targets);
		const config: any = {
			targets: this.tween.targets,
			duration,
			ease: easing,
			delay,
			repeat: repeat ?? 0,
			yoyo: yoyo ?? false,
			...props,
		};
		if (autoStart !== false) {
			this.tween = this.scene.tweens.add(config);
			this.tween.on('complete', () => this.onCompleteEmitter.emit('dispatch'));
			this.tween.on('update', (t: any, target: any) => {
				if (this.updateCallback) this.updateCallback.call(this.updateContext, t, target);
			});
		} else {
			this.tween = this.scene.tweens.add({ ...config, paused: true });
		}
		return this;
	}

	get scene() {
		return (this.tween as any).scene || (this.tween as any).manager?.scene;
	}

	start(): TweenHandle {
		if (this.tween.paused) this.tween.play();
		return this;
	}

	stop(): TweenHandle {
		this.tween.stop();
		return this;
	}

	yoyo(enable?: boolean): TweenHandle {
		this.tween.yoyo = enable ?? true;
		return this;
	}

	repeat(count?: number): TweenHandle {
		this.tween.repeat = count ?? 0;
		return this;
	}

	get onComplete() {
		return {
			add: (cb: (...args: any[]) => void, context?: any) => this.onCompleteEmitter.on('dispatch', cb, context),
			addOnce: (cb: (...args: any[]) => void, context?: any) => this.onCompleteEmitter.once('dispatch', cb, context),
		};
	}

	onUpdateCallback(cb: (...args: any[]) => void, context?: any): TweenHandle {
		this.updateCallback = cb;
		this.updateContext = context;
		return this;
	}
}

// ─── BitmapData adapter (wraps RenderTexture) ───────────────────────────────────

class BitmapDataAdapter implements BitmapDataHandle {
	readonly texture: any;
	readonly canvas: HTMLCanvasElement;
	readonly ctx: CanvasRenderingContext2D;

	constructor(texture: any) {
		this.texture = texture;
		this.canvas = texture.canvas;
		this.ctx = this.canvas.getContext('2d')!;
	}

	get width() { return this.texture.width; }
	get height() { return this.texture.height; }
	get context() { return this.ctx; }
	get dirty() { return true; }
	set dirty(v: boolean) { }
	update() { this.texture.update(); }
	destroy() { this.texture.destroy(); }
}

// ─── Scale adapter ──────────────────────────────────────────────────────────────

class ScaleAdapter implements ScaleHandle {
	readonly scaleManager: any;
	readonly camera: any;

	constructor(game: any) {
		this.scaleManager = game.scale;
		this.camera = game.scene?.cameras?.main || game.cameras?.main;
	}

	get parentIsWindow() { return this.scaleManager.parentIsWindow; }
	set parentIsWindow(v: boolean) { this.scaleManager.parentIsWindow = v; }
	get pageAlignHorizontally() { return this.scaleManager.autoCenter === 1 || this.scaleManager.autoCenter === 3; }
	set pageAlignHorizontally(v: boolean) { this.scaleManager.autoCenter = v ? (this.pageAlignVertically ? 3 : 1) : (this.pageAlignVertically ? 2 : 0); }
	get pageAlignVertically() { return this.scaleManager.autoCenter === 2 || this.scaleManager.autoCenter === 3; }
	set pageAlignVertically(v: boolean) { this.scaleManager.autoCenter = v ? (this.pageAlignHorizontally ? 3 : 2) : (this.pageAlignHorizontally ? 1 : 0); }
	get scaleMode() { return this.scaleManager.mode; }
	set scaleMode(v: number) { this.scaleManager.mode = v; }
	get fullScreenScaleMode() { return this.scaleManager.fullscreenTarget ? 1 : 0; }
	set fullScreenScaleMode(v: number) { }
	refresh() { this.camera?.refresh(); this.scaleManager.refresh(); }
	resize() { this.scaleManager.resize(); }
}

// ─── Camera adapter ─────────────────────────────────────────────────────────────

class CameraAdapter implements CameraHandle {
	readonly camera: any;
	readonly SHAKE_HORIZONTAL = 1;
	readonly SHAKE_VERTICAL = 2;
	readonly SHAKE_BOTH = 3;

	constructor(camera: any) {
		this.camera = camera;
	}

	shake(duration: number, amplitude: number, force?: boolean, direction?: number | string, snap?: boolean) {
		const dir = direction === this.SHAKE_HORIZONTAL ? 'horizontal'
			: direction === this.SHAKE_VERTICAL ? 'vertical'
			: 'both';
		this.camera.shake({ duration, intensity: amplitude, force, direction: dir });
	}
}

// ─── Timer adapter ──────────────────────────────────────────────────────────────

class TimerAdapter implements TimerHandle {
	readonly event: any;
	constructor(event: any) { this.event = event; }
}

// ─── Loader adapter ─────────────────────────────────────────────────────────────

class LoaderAdapter {
	readonly load: any;
	private fileCompleteEmitter = new SimpleEmitter();
	private loadCompleteEmitter = new SimpleEmitter();

	constructor(load: any) {
		this.load = load;
		load.on('filecomplete', (key: string, type: string, data: any) => this.fileCompleteEmitter.emit('dispatch', key, type, data));
		load.on('complete', () => this.loadCompleteEmitter.emit('dispatch'));
	}

	start() { this.load.start(); }

	get progress() { return this.load.progress; }

	get onFileComplete() { return new SignalAdapter(this.fileCompleteEmitter); }
	get onLoadComplete() { return new SignalAdapter(this.loadCompleteEmitter); }
}

// ─── Phaser4Engine class ────────────────────────────────────────────────────────

export class Phaser4Engine implements GameEngine {
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
	private readonly scene: any;

	constructor(phaser: any) {
		this.phaser = phaser;
		this.scene = phaser.scene?.active || phaser;
		const scene = this.scene;

		this.scale = new ScaleAdapter(phaser);
		this.cameras = { main: new CameraAdapter(this.scene.cameras?.main || phaser.cameras?.main) };
		this.world = {
			removeAll: (destroy?: boolean) => this.scene.children.clear(destroy),
		};
		this.cache = {
			getImage: (key: string) => {
				const tex = this.scene.textures.get(key);
				return tex?.source?.[0]?.image || tex;
			},
		};
		this.device = { desktop: phaser.device?.desktop ?? this.scene.sys?.game?.device?.desktop ?? true };
		this.stage = { disableVisibilityChange: false, forcePortrait: false };
		this.signals = {};
		this.load = new LoaderAdapter(this.scene.load);
		this.time = {
			get now() { return scene.time.now; },
			get elapsedMS() { return scene.time.elapsedMS; },
			add: (delay: number, cb: () => void) => new TimerAdapter(scene.time.delayedCall(delay, cb)),
			loop: (delay: number, cb: () => void) => new TimerAdapter(scene.time.addEvent({ delay, loop: true, callback: cb })),
			remove: (timer: TimerHandle) => (timer as TimerAdapter).event?.remove?.(),
		};

		this.add = {
			socket: (x: number, y: number, key: string, frame?: string) =>
				this.scene.add.sprite({ x, y, key, frame }) as unknown as SpriteHandle,
			image: (x: number, y: number, key: string, frame?: string) =>
				this.scene.add.image({ x, y, key, frame }) as unknown as SpriteHandle,
			sprite: (x: number, y: number, key: string, frame?: string) =>
				this.scene.add.sprite({ x, y, key, frame }) as unknown as SpriteHandle,
			text: (x: number, y: number, text: string, style?: any) =>
				this.scene.add.text({ x, y, text, style }) as unknown as SpriteHandle,
			graphics: (x?: number, y?: number, parent?: GroupHandle) => {
				const g = this.scene.add.graphics({ x: x ?? 0, y: y ?? 0 });
				if (parent) (parent as any).add?.(g);
				return g as unknown as SpriteHandle;
			},
			group: (parent?: GroupHandle, name?: string) => {
				const group = this.scene.add.group();
				if (parent) (parent as any).add?.(group);
				return group as unknown as GroupHandle;
			},
			tileSprite: (x: number, y: number, w: number, h: number, key: string, frame?: string) =>
				this.scene.add.tileSprite({ x, y, width: w, height: h, key, frame }) as unknown as SpriteHandle,
			bitmapData: (w: number, h: number) =>
				new BitmapDataAdapter(this.scene.add.renderTexture({ width: w, height: h })),
		};

		this.make = {
			bitmapData: (w: number, h: number) =>
				new BitmapDataAdapter(this.scene.add.renderTexture({ width: w, height: h })),
		};
	}

	destroy() {
		this.phaser.destroy?.(true, false) ?? this.scene?.sys?.game?.destroy?.(true, false);
	}

	tween(target: object): TweenHandle {
		const tween = this.scene.tweens.add({ targets: target, duration: 0, paused: true });
		return new TweenAdapter(tween);
	}

	removeTweensFrom(target: object) {
		this.scene.tweens.killTweensOf(target);
	}
}