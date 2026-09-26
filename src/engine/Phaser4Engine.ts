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

type CallbackFn = (...args: any[]) => void;

class SimpleEmitter {
	private listeners: Map<string, Array<{ fn: CallbackFn; context?: any; once: boolean }>> =
		new Map();

	on(event: string, fn: CallbackFn, context?: any) {
		const arr = this.listeners.get(event) || [];
		arr.push({ fn, context, once: false });
		this.listeners.set(event, arr);
	}

	once(event: string, fn: CallbackFn, context?: any) {
		const arr = this.listeners.get(event) || [];
		arr.push({ fn, context, once: true });
		this.listeners.set(event, arr);
	}

	off(event: string, fn: CallbackFn, context?: any) {
		const arr = this.listeners.get(event);
		if (!arr) return;
		const idx = arr.findIndex((l) => l.fn === fn && l.context === context);
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

	to(
		props: Record<string, any>,
		duration: number,
		easing?: string | ((k: number) => number),
		autoStart?: boolean,
		delay?: number,
		repeat?: number,
		yoyo?: boolean,
	): TweenHandle {
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
			add: (cb: (...args: any[]) => void, context?: any) =>
				this.onCompleteEmitter.on('dispatch', cb, context),
			addOnce: (cb: (...args: any[]) => void, context?: any) =>
				this.onCompleteEmitter.once('dispatch', cb, context),
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

	get width() {
		return this.texture.width;
	}
	get height() {
		return this.texture.height;
	}
	get context() {
		return this.ctx;
	}
	get dirty() {
		return true;
	}
	set dirty(v: boolean) {}
	update() {
		this.texture.update();
	}
	destroy() {
		this.texture.destroy();
	}
}

// ─── Scale adapter ──────────────────────────────────────────────────────────────

class ScaleAdapter implements ScaleHandle {
	private readonly phaser: any;
	private _scaleManager: any | null = null;
	private _camera: any | null = null;

	constructor(phaser: any) {
		this.phaser = phaser;
	}

	private get scaleManager() {
		if (!this._scaleManager) this._scaleManager = this.phaser?.scale;
		return this._scaleManager;
	}
	private get camera() {
		if (!this._camera)
			this._camera = this.phaser?.scene?.cameras?.main || this.phaser?.cameras?.main;
		return this._camera;
	}

	get parentIsWindow() {
		return this.scaleManager?.parentIsWindow ?? false;
	}
	set parentIsWindow(v: boolean) {
		if (this.scaleManager) this.scaleManager.parentIsWindow = v;
	}
	get pageAlignHorizontally() {
		return this.scaleManager?.autoCenter === 1 || this.scaleManager?.autoCenter === 3;
	}
	set pageAlignHorizontally(v: boolean) {
		if (this.scaleManager)
			this.scaleManager.autoCenter = v
				? this.pageAlignVertically
					? 3
					: 1
				: this.pageAlignVertically
				? 2
				: 0;
	}
	get pageAlignVertically() {
		return this.scaleManager?.autoCenter === 2 || this.scaleManager?.autoCenter === 3;
	}
	set pageAlignVertically(v: boolean) {
		if (this.scaleManager)
			this.scaleManager.autoCenter = v
				? this.pageAlignHorizontally
					? 3
					: 2
				: this.pageAlignHorizontally
				? 1
				: 0;
	}
	get scaleMode() {
		return this.scaleManager?.mode ?? 0;
	}
	set scaleMode(v: number) {
		if (this.scaleManager) this.scaleManager.mode = v;
	}
	get fullScreenScaleMode() {
		return this.scaleManager?.fullscreenTarget ? 1 : 0;
	}
	set fullScreenScaleMode(v: number) {}
	refresh() {
		this.camera?.refresh();
		this.scaleManager?.refresh();
	}
	resize() {
		this.scaleManager?.resize();
	}
}

// ─── Camera adapter ─────────────────────────────────────────────────────────────

class CameraAdapter implements CameraHandle {
	private readonly phaser: any;
	private _camera: any | null = null;
	readonly SHAKE_HORIZONTAL = 1;
	readonly SHAKE_VERTICAL = 2;
	readonly SHAKE_BOTH = 3;

	constructor(phaser: any) {
		this.phaser = phaser;
	}

	private get camera() {
		if (!this._camera)
			this._camera = this.phaser?.scene?.cameras?.main || this.phaser?.cameras?.main;
		return this._camera;
	}

	shake(
		duration: number,
		amplitude: number,
		force?: boolean,
		direction?: number | string,
		snap?: boolean,
	) {
		const camera = this.camera;
		if (!camera || typeof camera.shake !== 'function') return;
		const dir =
			direction === this.SHAKE_HORIZONTAL
				? 'horizontal'
				: direction === this.SHAKE_VERTICAL
				? 'vertical'
				: 'both';
		camera.shake({ duration, intensity: amplitude, force, direction: dir });
	}
}

// ─── Timer adapter ──────────────────────────────────────────────────────────────

class TimerAdapter implements TimerHandle {
	readonly event: any;
	constructor(event: any) {
		this.event = event;
	}

	destroy?(): void {
		this.event?.destroy?.();
	}
}

// ─── Loader adapter ─────────────────────────────────────────────────────────────

class LoaderAdapter {
	private readonly phaser: any;
	private _load: any | null = null;
	private fileCompleteEmitter = new SimpleEmitter();
	private loadCompleteEmitter = new SimpleEmitter();

	constructor(phaser: any) {
		this.phaser = phaser;
	}

	private get load() {
		if (!this._load) this._load = this.phaser?.scene?.scenes?.[0]?.load || this.phaser?.scene?.load;
		return this._load;
	}

	start() {
		this.load?.start();
	}

	get progress() {
		return this.load?.progress ?? 100;
	}

	get onFileComplete() {
		if (this.load) {
			console.log('[LoaderAdapter] Setting up filecomplete and complete listeners');
			this.load.on('filecomplete', (key: string, type: string, data: any) => {
				console.log('[LoaderAdapter] filecomplete:', key, type);
				this.fileCompleteEmitter.emit('dispatch', key, type, data);
			});
			this.load.on('complete', () => {
				console.log('[LoaderAdapter] complete event fired');
				this.loadCompleteEmitter.emit('dispatch');
			});
		}
		return new SignalAdapter(this.fileCompleteEmitter);
	}
	get onLoadComplete() {
		return new SignalAdapter(this.loadCompleteEmitter);
	}
}

// ─── Phaser4Engine class ────────────────────────────────────────────────────────

export class Phaser4Engine implements GameEngine {
	public readonly phaser: any;

	constructor(phaser: any) {
		this.phaser = phaser;
	}

	private get _scene() {
		// In Phaser 4, phaser.scene.active returns the active Scene
		// In mock, phaser.scene IS the scene (and .active is a boolean)
		const sceneManager = this.phaser.scene;
		if (sceneManager?.active && typeof sceneManager.active === 'object') {
			return sceneManager.active;
		}
		if (sceneManager?.add) {
			return sceneManager;
		}
		return this.phaser;
	}

	private get _scaleManager() {
		return this.phaser.scale;
	}

	private get _camerasMain() {
		return this._scene.cameras?.main || this.phaser.cameras?.main;
	}

	private get _load() {
		return this._scene.load;
	}

	private get _time() {
		return this._scene.time;
	}

	private get _add() {
		return this._scene.add;
	}

	private get _textures() {
		return this._scene.textures;
	}

	public get scale() {
		return new ScaleAdapter(this.phaser);
	}
	public get cameras() {
		return { main: new CameraAdapter(this.phaser) };
	}
	public get world() {
		return {
			removeAll: (destroy?: boolean) => this._scene.children.clear(destroy),
		};
	}
	public get cache() {
		return {
			getImage: (key: string) => {
				const tex = this._textures.get(key);
				return tex?.source?.[0]?.image || tex;
			},
		};
	}
	public get device() {
		const self = this;
		return {
			get desktop() {
				return self.phaser?.device?.desktop ?? self._scene?.sys?.game?.device?.desktop ?? true;
			},
		};
	}
	public get stage() {
		const self = this;
		return {
			get disableVisibilityChange() {
				return self.phaser.stage?.disableVisibilityChange ?? false;
			},
			set disableVisibilityChange(v: boolean) {
				if (self.phaser.stage) self.phaser.stage.disableVisibilityChange = v;
			},
			get forcePortrait() {
				return self.phaser.stage?.forcePortrait ?? false;
			},
			set forcePortrait(v: boolean) {
				if (self.phaser.stage) self.phaser.stage.forcePortrait = v;
			},
		};
	}
	public readonly signals: Record<string, SignalHandle> = {};
	public get load() {
		return new LoaderAdapter(this.phaser);
	}
	public get time() {
		const self = this;
		return {
			get now() {
				return self._time?.now ?? 0;
			},
			get elapsedMS() {
				return self._time?.elapsedMS ?? 0;
			},
			add: (delay: number, cb: () => void) => new TimerAdapter(self._time.delayedCall(delay, cb)),
			loop: (delay: number, cb: () => void) =>
				new TimerAdapter(self._time.addEvent({ delay, loop: true, callback: cb })),
			remove: (timer: TimerHandle) => (timer as TimerAdapter).event?.remove?.(),
		};
	}

	public readonly add = {
		socket: (x: number, y: number, key: string, frame?: string) =>
			this._add.sprite({ x, y, key, frame }) as unknown as SpriteHandle,
		image: (x: number, y: number, key: string, frame?: string) =>
			this._add.image({ x, y, key, frame }) as unknown as SpriteHandle,
		sprite: (x: number, y: number, key: string, frame?: string) =>
			this._add.sprite({ x, y, key, frame }) as unknown as SpriteHandle,
		text: (x: number, y: number, text: string, style?: any) =>
			this._add.text({ x, y, text, style }) as unknown as SpriteHandle,
		graphics: (x?: number, y?: number, parent?: GroupHandle) => {
			const g = this._add.graphics({ x: x ?? 0, y: y ?? 0 });
			if (parent) (parent as any).add?.(g);
			return g as unknown as SpriteHandle;
		},
		group: (parent?: GroupHandle, name?: string) => {
			const group = this._add.group();
			if (parent) (parent as any).add?.(group);
			return group as unknown as GroupHandle;
		},
		tileSprite: (x: number, y: number, w: number, h: number, key: string, frame?: string) =>
			this._add.tileSprite({ x, y, width: w, height: h, key, frame }) as unknown as SpriteHandle,
		bitmapData: (w: number, h: number) =>
			new BitmapDataAdapter(this._add.renderTexture({ width: w, height: h })),
	};

	public readonly make = {
		bitmapData: (w: number, h: number) =>
			new BitmapDataAdapter(this._add.renderTexture({ width: w, height: h })),
	};

	destroy() {
		this.phaser.destroy?.(true, false) ?? this._scene?.sys?.game?.destroy?.(true, false);
	}

	tween(target: object): TweenHandle {
		const tween = this._scene.tweens.add({ targets: target, duration: 0, paused: true });
		return new TweenAdapter(tween);
	}

	removeTweensFrom(target: object) {
		this._scene.tweens.killTweensOf(target);
	}
}
