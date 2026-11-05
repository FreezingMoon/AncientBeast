import {
	notifyTextureFailed,
	notifyTextureLoaded,
	resetOnDemandTextures,
	setOnDemandLoader,
} from '../assets';
import type Phaser from 'phaser';

type Loader = Phaser.Loader.LoaderPlugin;
type TextureManager = Phaser.Textures.TextureManager;

/** Remove a listener previously added through {@link AssetLoader}. */
export type Unsubscribe = () => void;

/**
 * AB's view of the Phaser 4 loader.
 *
 * Phaser 4's `LoaderPlugin` already has the queue, the events and the progress
 * ratio AB needs, so nothing is emulated here. What this adds is the three
 * things Phaser does not offer in AB's shape:
 *
 *   - progress as a whole percentage, because the loader bar is styled with one
 *     and Phaser reports a 0-1 ratio;
 *   - subscriptions that hand back an unsubscribe function, because the preload
 *     progress listener has to come off once the preload batch is done;
 *   - the on-demand seam in `src/assets.ts`, which is where "fetch a texture the
 *     first time something needs it" lives.
 *
 * One instance per scene, created in `GameScene.create()`. Off-engine callers
 * (unit tests, the authoritative Devvit server) never build one; they bind their
 * own no-op through `setOnDemandLoader`, exactly as the headless engine did.
 */
export class AssetLoader {
	private readonly loader: Loader;
	private readonly textures: TextureManager;
	private readonly teardown: Unsubscribe[] = [];

	constructor(scene: Phaser.Scene) {
		this.loader = scene.load;
		this.textures = scene.textures;
		this.bindOnDemand();
		this.bindOnDemandNotifications();
		this.bindLoadFailures();
	}

	/**
	 * Release waiters when a queued image fails.
	 *
	 * Without this, anything awaiting an on-demand texture waits forever on a
	 * file that will never arrive: `assets.ts` only drains its pending callbacks
	 * from `filecomplete`, and Phaser does not fire that for a failed file. The
	 * visible symptom is a match that simply stops — `setup()` is waiting on
	 * `ensureCardboardReady` and the game never reaches its first turn.
	 */
	private bindLoadFailures(): void {
		// Phaser 4 hands the `File`, not the key, so the key has to be read off it
		// before the lookup can find anything.
		const handler = (file: { key?: string }) => {
			if (file?.key) notifyTextureFailed(file.key);
		};
		this.loader.on('loaderror', handler);
		this.track(() => this.loader.off('loaderror', handler));
	}

	/**
	 * Whether a texture key is resident and safe to draw with.
	 *
	 * This is the second half of the on-demand seam: `assets.ts` asks before it
	 * queues, so a texture already fetched is never requested twice.
	 */
	textureExists(key: string): boolean {
		return this.textures.exists(key);
	}

	/** Queue one image. It is only fetched once {@link start} drains the queue. */
	image(key: string, url: string): void {
		this.loader.image(key, url);
	}

	/** Drain the queue. A second call while a run is in flight is a no-op. */
	start(): void {
		this.loader.start();
	}

	/** Queue completion, 0-100. */
	get progress(): number {
		return Math.round((this.loader.progress ?? 1) * 100);
	}

	/**
	 * Subscribe to the on-demand notification channel.
	 *
	 * This listener is the only thing that tells `assets.ts` a queued texture has
	 * arrived, so it lives for as long as the loader does — one per instance,
	 * installed in the constructor and released by {@link destroy}. It is
	 * deliberately NOT the same thing as a progress subscription: the preload bar
	 * stops caring the moment the batch finishes, whereas every on-demand fetch
	 * after that still needs this to release its waiters.
	 *
	 * Conflating the two strands every waiter's release on whether the progress
	 * bar happened to still be subscribed. Since {@link Game#finishLoading}
	 * unsubscribes the progress bar and *then* asks for the Dark Priest
	 * cardboards, the request was always queued with nobody left listening, and
	 * `setup()` blocked on `ensureCardboardReady` forever — a match stuck on the
	 * loading screen with no error, at 100%.
	 */
	private bindOnDemandNotifications(): void {
		const handler = (key: string) => notifyTextureLoaded(key);
		this.loader.on('filecomplete', handler);
		// Tracked like every other subscription so `destroy()` really does release
		// all of them, as its contract claims.
		this.track(() => this.loader.off('filecomplete', handler));
	}

	/**
	 * Subscribe to one file finishing, for the preload progress bar only.
	 *
	 * Returns the unsubscribe function so the caller can drop it once the batch
	 * completes. Use {@link bindOnDemandNotifications} for anything that needs an
	 * on-demand texture released; unsubscribing from here does not affect it.
	 */
	onFileComplete(cb: (key: string) => void): Unsubscribe {
		const handler = (key: string) => cb(key);
		this.loader.on('filecomplete', handler);
		return this.track(() => this.loader.off('filecomplete', handler));
	}

	/**
	 * Subscribe to the queue finishing, once.
	 *
	 * On-demand textures keep flowing through the same loader during a match and
	 * `complete` fires for each of them, so this is deliberately one-shot: the
	 * caller is finishing the *preload batch*, not "the last load ever".
	 */
	onceComplete(cb: () => void): Unsubscribe {
		const handler = () => cb();
		this.loader.once('complete', handler);
		return this.track(() => this.loader.off('complete', handler));
	}

	/**
	 * Release every subscription, unbind the on-demand seam, and drop the memo.
	 *
	 * Called from the scene's `shutdown()`, so a later match does not keep
	 * queueing images into a destroyed loader — and does not inherit the previous
	 * match's record of which textures are already resident.
	 */
	destroy(): void {
		for (const off of this.teardown.splice(0)) {
			off();
		}
		setOnDemandLoader(undefined, undefined);
		resetOnDemandTextures();
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
	private loadOnDemand(key: string, url: string): void {
		this.loader.image(key, url);
		if (!this.loader.isLoading?.()) {
			this.loader.start();
		}
	}

	private bindOnDemand(): void {
		setOnDemandLoader(
			(key, url) => this.loadOnDemand(key, url),
			(key) => this.textures.exists(key),
		);
	}

	private track(off: Unsubscribe): Unsubscribe {
		const wrapped: Unsubscribe = () => {
			const index = this.teardown.indexOf(wrapped);
			if (index >= 0) {
				this.teardown.splice(index, 1);
			}
			off();
		};
		this.teardown.push(wrapped);
		return wrapped;
	}
}
