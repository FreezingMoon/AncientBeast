import type Phaser from 'phaser';
import { getPhaser } from './phaser-runtime';
import { Signal } from '../utility/signal';
import { DynamicTextureAdapter, wrapGameObject, wrapGroup } from './Phaser4Handles';
import { toTextureKey } from './textureKey';
import type {
	CameraHandle,
	GameEngine,
	GroupHandle,
	ScaleHandle,
	SpriteHandle,
	TextureKeyLike,
	TimerHandle,
	TweenHandle,
} from './types';

type AnyObject = Record<string, any>;

/**
 * Phaser 2 CE removed `game.camera.SHAKE_*`; Phaser 4 expresses the shake
 * direction through a per-axis `intensity` Vector2, so the adapter keeps the
 * Phaser 2 direction flags and translates them on the way through.
 */
const SHAKE_HORIZONTAL = 1;
const SHAKE_VERTICAL = 2;
const SHAKE_BOTH = 3;

/**
 * Phaser 4 engine adapter.
 *
 * Gameplay code never touches a raw Phaser object: it goes through this
 * adapter, which is a thin translation layer over Phaser 4's own APIs. The
 * scene is injected (rather than discovered through globals) so the adapter and
 * the {@link GameScene} that owns it are decoupled from module state.
 */
export class Phaser4Engine implements GameEngine {
	private readonly phaser: Phaser.Game;
	private readonly scene: Phaser.Scene;
	/** Tracked manually: Phaser 4's Clock exposes `now` but not `elapsedMS`. */
	private _elapsedMS = 0;
	private _loadWired = false;

	readonly signals: Record<string, Signal> = {};

	constructor(phaser: Phaser.Game, scene: Phaser.Scene) {
		this.phaser = phaser;
		this.scene = scene;
	}

	/** The live Phaser 4 scene backing this engine. */
	getScene(): Phaser.Scene {
		return this.scene;
	}

	// ─── Tween ──────────────────────────────────────────────────────────────

	tween(target: object): TweenHandle {
		return new TweenAdapter(this.scene, this.scene.tweens.add({ targets: target }));
	}

	removeTweensFrom(target: object): void {
		this.scene.tweens.killTweensOf(target);
	}

	// ─── Game object factories ──────────────────────────────────────────────
	// Phaser 4 factories take positional arguments, unlike the Phaser 2 CE
	// config objects, so the adapter owns the translation.

	get add() {
		return {
			/** Phaser 2 `socket` had no Phaser 4 equivalent; it was a display object. */
			socket: (x: number, y: number, key: TextureKeyLike, frame?: string): SpriteHandle =>
				this.add.sprite(x, y, key, frame),
			image: (x: number, y: number, key: TextureKeyLike, frame?: string): SpriteHandle =>
				wrapGameObject(this.scene.add.image(x, y, toTextureKey(key), frame)),
			sprite: (x: number, y: number, key: TextureKeyLike, frame?: string): SpriteHandle =>
				wrapGameObject(this.scene.add.sprite(x, y, toTextureKey(key), frame)),
			text: (x: number, y: number, text: string, style?: AnyObject): SpriteHandle =>
				wrapGameObject(this.scene.add.text(x, y, text, style)),
			graphics: (x?: number, y?: number, parent?: GroupHandle): SpriteHandle => {
				const graphics = this.scene.add.graphics({ x, y });
				if (parent) parent.add(graphics);
				return wrapGameObject(graphics);
			},
			/**
			 * Phaser 2 `Group` was a transformable, ordered display container.
			 * Phaser 4's `Group` is only a membership set, so groups are backed
			 * by the native `Container`, which does provide ordering + transform.
			 */
			group: (parent?: GroupHandle, name?: string): GroupHandle => {
				const container = this.scene.add.container(0, 0);
				if (name) container.setName(name);
				if (parent) parent.add(container);
				return wrapGroup(container);
			},
			tileSprite: (
				x: number,
				y: number,
				w: number,
				h: number,
				key: TextureKeyLike,
				frame?: string,
			): SpriteHandle =>
				wrapGameObject(this.scene.add.tileSprite(x, y, w, h, toTextureKey(key), frame)),
			bitmapData: (w: number, h: number) => this.make.bitmapData(w, h),
		};
	}

	get make() {
		return {
			/**
			 * Phaser 2 `BitmapData` was an offscreen 2D canvas. Phaser 4 has no
			 * equivalent: `RenderTexture`'s `DynamicTexture` has no 2D context
			 * under WebGL, so the surface is a `CanvasTexture` instead — the one
			 * Phaser 4 texture with a real `CanvasRenderingContext2D`.
			 */
			bitmapData: (w: number, h: number) => new DynamicTextureAdapter(this.scene.textures, w, h),
		};
	}

	// ─── Loader ─────────────────────────────────────────────────────────────

	get load() {
		// The adapter's `load` getter is read several times while wiring the
		// loader, so the Phaser 4 event listeners are attached exactly once.
		if (!this._loadWired) {
			this._loadWired = true;
			const loader = this.scene.load;
			loader.on('filecomplete', (key: string) => this.loadSignal('onFileComplete').dispatch(key));
			loader.on('complete', () => this.loadSignal('onLoadComplete').dispatch());
		}
		const loader = this.scene.load as AnyObject;
		return {
			start: () => loader.start(),
			// Phaser 2 reported 0-100; Phaser 4 reports a 0-1 ratio.
			get progress() {
				return Math.round((loader.progress ?? 1) * 100);
			},
			onFileComplete: this.loadSignal('onFileComplete'),
			onLoadComplete: this.loadSignal('onLoadComplete'),
		};
	}

	private readonly loadSignals: Record<string, Signal> = {};

	private loadSignal(name: 'onFileComplete' | 'onLoadComplete'): Signal {
		let signal = this.loadSignals[name];
		if (!signal) {
			signal = new Signal();
			this.loadSignals[name] = signal;
		}
		return signal;
	}

	// ─── Time ───────────────────────────────────────────────────────────────

	get time() {
		const clock = this.scene.time;
		const self = this;
		return {
			get now() {
				return clock.now;
			},
			get elapsedMS() {
				return self._elapsedMS;
			},
			add: (delay: number, cb: () => void): TimerHandle => clock.delayedCall(delay, cb),
			loop: (delay: number, cb: () => void): TimerHandle =>
				clock.addEvent({
					delay,
					loop: true,
					callback: cb,
				}),
			remove: (timer: TimerHandle) => timer?.destroy?.(),
		};
	}

	/** Called from the scene's `update()` so `time.elapsedMS` keeps working. */
	advanceClock(delta: number): void {
		this._elapsedMS += delta;
	}

	// ─── Scale ──────────────────────────────────────────────────────────────

	get scale(): ScaleHandle {
		const manager = this.phaser.scale;
		const scale: ScaleHandle = {
			get parentIsWindow() {
				return manager.parentIsWindow;
			},
			set parentIsWindow(value: boolean) {
				manager.parentIsWindow = value;
			},
			// Phaser 2's page alignment flags are Phaser 4's `autoCenter`.
			get pageAlignHorizontally() {
				return manager.autoCenter !== getPhaser().Scale.NO_CENTER;
			},
			set pageAlignHorizontally(value: boolean) {
				const { Scale } = getPhaser();
				manager.autoCenter = value ? Scale.CENTER_BOTH : Scale.NO_CENTER;
			},
			get pageAlignVertically() {
				return manager.autoCenter !== getPhaser().Scale.NO_CENTER;
			},
			set pageAlignVertically(value: boolean) {
				const { Scale } = getPhaser();
				manager.autoCenter = value ? Scale.CENTER_BOTH : Scale.NO_CENTER;
			},
			get scaleMode() {
				return manager.scaleMode;
			},
			set scaleMode(value: number) {
				manager.scaleMode = value;
			},
			// Phaser 4 has a single scale mode; full screen uses the same one.
			get fullScreenScaleMode() {
				return manager.scaleMode;
			},
			set fullScreenScaleMode(value: number) {
				manager.scaleMode = value;
			},
			refresh: () => manager.refresh(),
			resize: (w?: number, h?: number) => manager.resize(w, h),
		};
		return scale;
	}

	// ─── Camera ─────────────────────────────────────────────────────────────

	get cameras() {
		const manager = this;
		return {
			main: {
				/**
				 * Phaser 4 signature: `shake(duration, intensity, force)`.
				 *
				 * Phaser 2 CE was `shake(amplitude, duration, force, direction,
				 * snap)` and Ancient Beast still calls it that way, so the
				 * amplitude/duration pair is swapped here and the direction flag
				 * is turned into a per-axis `intensity` Vector2 — which is how
				 * Phaser 4 expresses a one-axis shake.
				 */
				shake(
					amplitude: number,
					duration: number,
					force?: boolean,
					direction: number = SHAKE_BOTH,
					snap?: boolean,
				): void {
					void snap;
					const horizontal = direction === SHAKE_HORIZONTAL || direction === SHAKE_BOTH;
					const vertical = direction === SHAKE_VERTICAL || direction === SHAKE_BOTH;
					const intensity =
						horizontal && vertical
							? amplitude
							: new (getPhaser().Math.Vector2)(
									horizontal ? amplitude : 0,
									vertical ? amplitude : 0,
							  );
					manager.getScene().cameras.main.shake(duration, intensity, force);
				},
				SHAKE_HORIZONTAL,
				SHAKE_VERTICAL,
				SHAKE_BOTH,
			} as CameraHandle,
		};
	}

	// ─── World / display list ───────────────────────────────────────────────

	get world() {
		const displayList = this.scene.children;
		const scene = this.scene;
		return {
			/** Phaser 2's `world.removeAll(destroy)` tore down every display object. */
			removeAll: (destroy = true) => {
				displayList.list.slice().forEach((child) => {
					displayList.remove(child);
					if (destroy) child.destroy();
				});
			},
			get width() {
				return scene.scale.width;
			},
			get height() {
				return scene.scale.height;
			},
			add: (gameObject: AnyObject) => displayList.add(gameObject),
		};
	}

	// ─── Cache / textures ───────────────────────────────────────────────────

	get cache() {
		const textures = this.scene.textures;
		return {
			getImage: (key: string) => {
				const texture = textures.exists(key) ? textures.get(key) : null;
				return texture ? texture.getSourceImage() : null;
			},
		};
	}

	// ─── Device ─────────────────────────────────────────────────────────────

	get device() {
		// Phaser 4 exposes device info through `Phaser.Device`; `os` carries the
		// desktop/mobile split that Phaser 2 reported as `device.desktop`.
		const os = this.phaser.device?.os as AnyObject | undefined;
		return { desktop: Boolean(os?.desktop) };
	}

	/**
	 * Phaser 2's `game.stage` flags were used for visibility/portrait handling.
	 * Phaser 4 has no stage object; those behaviours moved to the ScaleManager
	 * (`autoCenter`) and to the browser's own visibility events, so this is a
	 * retained no-op rather than a global.
	 */
	get stage(): { disableVisibilityChange: boolean; forcePortrait: boolean } {
		return { disableVisibilityChange: false, forcePortrait: false };
	}

	// ─── Lifecycle ──────────────────────────────────────────────────────────

	destroy(): void {
		// Phaser 4 `Game.destroy(removeCanvas, noReturn)`.
		this.phaser.destroy(true, true);
	}
}

// ─── Tween adapter ───────────────────────────────────────────────────────────

class TweenAdapter implements TweenHandle {
	private tween: Phaser.Tweens.Tween;
	private readonly scene: Phaser.Scene;

	constructor(scene: Phaser.Scene, tween: Phaser.Tweens.Tween) {
		this.scene = scene;
		this.tween = tween;
	}

	private get liveScene(): Phaser.Scene {
		// Phaser 4 tweens reach the scene through their owning TweenManager.
		return (this.tween.parent as Phaser.Tweens.TweenManager | undefined)?.scene ?? this.scene;
	}

	to(
		props: Record<string, any>,
		duration: number,
		easing?: string | ((k: number) => number),
		autoStart = true,
		delay = 0,
		repeat = 0,
		yoyo = false,
	): TweenHandle {
		this.tween.stop();
		this.tween = this.liveScene.tweens.add({
			targets: this.tween.targets,
			duration,
			ease: easing as any,
			delay,
			repeat,
			yoyo,
			paused: !autoStart,
			...props,
		});
		return this;
	}

	start(): TweenHandle {
		this.tween.play();
		return this;
	}

	stop(): TweenHandle {
		this.tween.stop();
		return this;
	}

	/** Phaser 4 moved `yoyo` onto each tween data entry rather than the tween. */
	yoyo(enable = true): TweenHandle {
		this.tween.data.forEach((entry) => {
			entry.yoyo = enable;
		});
		return this;
	}

	/** Phaser 4 renamed the tween-level repeat count to `loop`. */
	repeat(count = 1): TweenHandle {
		this.tween.loop = count;
		return this;
	}

	get onComplete() {
		return {
			add: (cb: (...args: any[]) => void) => this.tween.on('complete', cb),
			addOnce: (cb: (...args: any[]) => void) => this.tween.once('complete', cb),
		};
	}

	onUpdateCallback(cb: (...args: any[]) => void): TweenHandle {
		this.tween.on('update', cb);
		return this;
	}
}
