import type Phaser from 'phaser';
import { getPhaser } from './phaser-runtime';
import { Signal } from '../utility/signal';
import { DynamicTextureAdapter, wrapGameObject, wrapGroup } from './Phaser4Handles';
import { toTextureKey } from './textureKey';
import { notifyTextureLoaded, resetOnDemandTextures, setOnDemandLoader } from '../assets';
import type {
	CameraHandle,
	GameEngine,
	GroupHandle,
	ScaleHandle,
	ShaderConfigHandle,
	ShaderHandle,
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
			sprite: (
				x: number,
				y: number,
				key: TextureKeyLike,
				frame?: string,
				parent?: GroupHandle,
			): SpriteHandle => {
				const sprite = wrapGameObject(this.scene.add.sprite(0, 0, toTextureKey(key), frame));
				if (parent) {
					parent.add(sprite);
					sprite.x = x;
					sprite.y = y;
				} else {
					sprite.setPosition(x, y);
				}
				return sprite;
			},
			text: (
				x: number,
				y: number,
				text: string,
				style?: AnyObject,
				parent?: GroupHandle,
			): SpriteHandle => {
				const txt = wrapGameObject(this.scene.add.text(0, 0, text, style));
				if (parent) {
					parent.add(txt);
					txt.x = x;
					txt.y = y;
				} else {
					txt.setPosition(x, y);
				}
				return txt;
			},
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
			/**
			 * Phaser 4's `Shader` game object: a quad running a fragment shader.
			 *
			 * Note this replaces Phaser 3's `preFX` / `postFX`, which Phaser 4
			 * removed — the FX system became *Filters* and custom shaders are
			 * RenderNodes. A fully procedural effect needs neither: a Shader quad
			 * is the direct route, and unlike a Filter it needs no node
			 * registration and no `enableFilters()`.
			 *
			 * The returned quad mixes in `BlendMode` but NOT `Alpha` (`setAlpha`
			 * is a no-op), so callers apply opacity inside the fragment shader.
			 */
			shader: (
				config: ShaderConfigHandle,
				x: number,
				y: number,
				w: number,
				h: number,
				parent?: GroupHandle,
			): ShaderHandle => {
				const shaderConfig = {
					name: config.name,
					fragmentSource: config.fragmentSource,
					...(config.initialUniforms ? { initialUniforms: { ...config.initialUniforms } } : {}),
					...(config.setupUniforms
						? {
								setupUniforms: (setUniform: (name: string, value: number | number[]) => void) =>
									config.setupUniforms?.(setUniform),
						  }
						: {}),
				};
				const shader = this.scene.add.shader(shaderConfig, x, y, w, h);
				if (parent) {
					// Groups are Containers, so children inherit the group's
					// transform — the board display group is offset by (230, 380).
					// `scene.add` also registered the quad in the scene display list,
					// where it would keep rendering at un-offset coordinates as a
					// second copy, so detach it before re-parenting.
					this.scene.children.remove(shader);
					parent.add(shader);
					shader.x = x;
					shader.y = y;
				}
				return wrapGameObject(shader) as unknown as ShaderHandle;
			},
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
		this.wireLoader();
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

	/**
	 * Queue a texture after the initial preload has finished.
	 *
	 * Phaser only drains a queue that has been started, and it ignores `start()`
	 * while a run is already in flight — so a texture requested mid-match is
	 * queued and started here, and one requested during a run simply joins that
	 * run. Callers reach this through the on-demand path in `assets.ts` rather
	 * than calling it directly.
	 */
	loadImage(key: string, url: string): void {
		this.wireLoader();
		const loader = this.scene.load as AnyObject;
		loader.image(key, url);
		if (!loader.isLoading?.()) {
			loader.start();
		}
	}

	get textures() {
		return {
			exists: (key: string) => this.scene.textures.exists(key),
		};
	}

	private wireLoader(): void {
		// The `load` getter, `loadImage` and the on-demand binder all reach the
		// Phaser 4 loader, so the event listeners are attached exactly once.
		if (this._loadWired) {
			return;
		}
		this._loadWired = true;
		const loader = this.scene.load;
		loader.on('filecomplete', (key: string) => {
			// On-demand textures are fetched one at a time, after the preload
			// batch; release any caller waiting on this key.
			notifyTextureLoaded(key);
			this.loadSignal('onFileComplete').dispatch(key);
		});
		loader.on('complete', () => this.loadSignal('onLoadComplete').dispatch());
		// The loader only exists once Phaser has booted partway, which is why
		// this is wired lazily rather than in the constructor. Rebinding also
		// drops the previous instance's memo caches.
		setOnDemandLoader(
			(key, url) => this.loadImage(key, url),
			(key) => this.scene.textures.exists(key),
		);
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
		// phaser-ce (`src/time/Time.js`) sets `elapsedMS = this.time - previousDateNow`,
		// i.e. the delta since the last update — NOT cumulative time. Callers such as
		// the Infernal glow accumulate it into a `uTime` uniform, so accumulating here
		// would drive their animations at the frame rate times too fast.
		this._elapsedMS = delta;
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

	/**
	 * Phaser 4's `Shader` has no renderer under CANVAS (`ShaderCanvasRenderer` is
	 * an empty stub that draws nothing), so a shader would silently produce an
	 * invisible object. This is the same `renderer.gl` discriminator Phaser's own
	 * code uses internally.
	 */
	get supportsShaders(): boolean {
		return Boolean((this.phaser.renderer as AnyObject | undefined)?.gl);
	}

	// ─── Lifecycle ──────────────────────────────────────────────────────────

	destroy(): void {
		// The texture cache dies with the game, so the on-demand memo has to go
		// with it — otherwise a rematch would believe its textures are loaded.
		resetOnDemandTextures();
		setOnDemandLoader(undefined, undefined);
		// Phaser 4 `Game.destroy(removeCanvas, noReturn)`.
		this.phaser.destroy(true, true);
	}
}

// ─── Tween adapter ───────────────────────────────────────────────────────────

class TweenAdapter implements TweenHandle {
	private readonly scene: Phaser.Scene;
	private chainSteps: Array<{
		props: Record<string, any>;
		duration: number;
		ease?: string | ((k: number) => number);
		delay?: number;
		repeat?: number;
		yoyo?: boolean;
	}> = [];
	private chain: Phaser.Tweens.TweenChain | null = null;
	private readonly targets: any[];
	private _started = false;

	constructor(scene: Phaser.Scene, initialTween: Phaser.Tweens.Tween) {
		this.scene = scene;
		this.targets = initialTween.targets as any[];
		initialTween.stop();
		initialTween.destroy();
	}

	private buildChain(): Phaser.Tweens.TweenChain | null {
		if (this.chainSteps.length === 0) {
			return null;
		}
		const tweens = this.chainSteps.map((step, i) => ({
			targets: this.targets,
			duration: step.duration,
			ease: step.ease,
			delay: step.delay ?? (i === 0 ? 0 : undefined),
			repeat: step.repeat,
			yoyo: step.yoyo,
			...step.props,
		}));
		return this.scene.tweens.chain({ tweens });
	}

	private stopCurrentChain(): void {
		this.chain?.stop();
	}

	to(
		props: Record<string, any>,
		duration: number,
		easing?: string | ((k: number) => number),
		autoStart = false,
		delay = 0,
		repeat = 0,
		yoyo = false,
	): TweenHandle {
		this.chainSteps.push({ props, duration, ease: easing, delay, repeat, yoyo });
		if (autoStart && !this._started) {
			// First auto-starting step: build and play immediately.
			this.stopCurrentChain();
			this.chain = this.buildChain();
			this.chain?.play();
			this._started = true;
		} else if (autoStart && this._started) {
			// Subsequent auto-starting steps: rebuild chain but don't play yet.
			// The final explicit .start() will play the complete chain once.
			this.stopCurrentChain();
			this.chain = this.buildChain();
		}
		return this;
	}

	start(): TweenHandle {
		if (!this.chain) {
			this.chain = this.buildChain();
		}
		if (this._started) {
			// Already auto-played a partial chain; restart the complete one.
			this.stopCurrentChain();
		}
		this.chain?.play();
		this._started = true;
		return this;
	}

	stop(): TweenHandle {
		this.stopCurrentChain();
		return this;
	}

	yoyo(enable = true): TweenHandle {
		this.chainSteps.forEach((s) => (s.yoyo = enable));
		if (this.chain) {
			this.stopCurrentChain();
			this.chain = this.buildChain();
			if (this._started) this.chain?.play();
		}
		return this;
	}

	repeat(count = 1): TweenHandle {
		this.chainSteps.forEach((s) => (s.repeat = count));
		if (this.chain) {
			this.stopCurrentChain();
			this.chain = this.buildChain();
			if (this._started) this.chain?.play();
		}
		return this;
	}

	get onComplete() {
		const self = this;
		return {
			add: (cb: (...args: any[]) => void, context?: any) => {
				if (self.chain) {
					self.chain.on('complete', cb, context);
				} else {
					// No chain built yet (no steps). Attach when chain is created.
					const originalStart = self.start.bind(self);
					self.start = function () {
						originalStart();
						if (self.chain) self.chain.on('complete', cb, context);
						return self;
					} as typeof self.start;
				}
			},
			addOnce: (cb: (...args: any[]) => void, context?: any) => {
				if (self.chain) {
					self.chain.once('complete', cb, context);
				} else {
					const originalStart = self.start.bind(self);
					self.start = function () {
						originalStart();
						if (self.chain) self.chain.once('complete', cb, context);
						return self;
					} as typeof self.start;
				}
			},
		};
	}

	onUpdateCallback(cb: (...args: any[]) => void, context?: any): TweenHandle {
		const self = this;
		if (!self.chain) {
			const originalStart = self.start.bind(self);
			self.start = function () {
				originalStart();
				if (self.chain) self.chain.on('update', cb, context);
				return self;
			};
		} else {
			self.chain.on('update', cb, context);
		}
		return self;
	}
}
