/**
 * Cover for AB's loader seam over Phaser 4's `LoaderPlugin`.
 *
 * The behaviour worth pinning is the part Phaser does not provide: progress as a
 * whole percentage, subscriptions that hand back an unsubscribe function, the
 * one-shot `complete` subscription the preload batch needs (on-demand textures
 * keep firing `complete` for the rest of the match), and the binding into
 * `assets.ts` that makes `ensureCardboard` fetch anything not resident.
 */
import { jest, describe, expect, test, beforeEach } from '@jest/globals';

import {
	loadTexture,
	notifyTextureLoaded,
	resetOnDemandTextures,
	setOnDemandLoader,
} from '../../assets';
import { AssetLoader } from '../../phaser/loader';

type Handler = (...args: any[]) => void;

/** The slice of `LoaderPlugin` and `TextureManager` the seam actually touches. */
function makeSceneStub() {
	// Phaser's events come from `eventemitter3`: a `once` listener is stored under
	// the *same* function reference as a plain one, so `off(event, fn)` removes
	// either. Only the dispatch drops it after firing. The stub keeps that
	// distinction, because `onceComplete` relies on being removable.
	const fileComplete: Handler[] = [];
	const complete: Handler[] = [];
	const lists: Record<string, Handler[]> = { filecomplete: fileComplete, complete };
	const oneShots = new Set<Handler>();

	const loader = {
		image: jest.fn(),
		start: jest.fn(),
		progress: 0.5,
		loading: true,
		isLoading() {
			return this.loading;
		},
		on(event: string, handler: Handler) {
			(lists[event] ??= []).push(handler);
			return loader;
		},
		off(event: string, handler: Handler) {
			const list = lists[event];
			if (!list) return loader;
			const index = list.indexOf(handler);
			if (index >= 0) list.splice(index, 1);
			return loader;
		},
		once(event: string, handler: Handler) {
			oneShots.add(handler);
			return this.on(event, handler);
		},
		/** Dispatch, dropping one-shot listeners first — eventemitter3's order. */
		emit(event: string, ...args: any[]) {
			for (const handler of [...(lists[event] ?? [])]) {
				if (oneShots.delete(handler)) {
					this.off(event, handler);
				}
				handler(...args);
			}
			return loader;
		},
	};
	const resident = new Set<string>();
	const textures = {
		exists: (key: string) => resident.has(key),
	};
	const scene = { load: loader, textures } as any;
	return { scene, loader, textures, resident, fileComplete, complete };
}

/** Let `assets.ts` drain the callbacks it queued synchronously. */
const drain = () => Promise.resolve();

describe('AssetLoader queueing and progress', () => {
	beforeEach(() => {
		resetOnDemandTextures();
	});

	test('progress is a whole percentage, not Phaser 0-1 ratio', () => {
		const { scene, loader } = makeSceneStub();
		const assets = new AssetLoader(scene);

		expect(assets.progress).toBe(50);

		loader.progress = 1;
		expect(assets.progress).toBe(100);
	});

	test('image() queues and start() drains', () => {
		const { scene, loader } = makeSceneStub();
		const assets = new AssetLoader(scene);

		assets.image('background', '/locations/dungeon.png');
		assets.start();

		expect(loader.image).toHaveBeenCalledWith('background', '/locations/dungeon.png');
		expect(loader.start).toHaveBeenCalled();
	});

	test('textureExists reports residency from the scene texture manager', () => {
		const { scene, resident } = makeSceneStub();
		const assets = new AssetLoader(scene);

		expect(assets.textureExists('__DEFAULT')).toBe(false);
		resident.add('__DEFAULT');
		expect(assets.textureExists('__DEFAULT')).toBe(true);
	});
});

describe('AssetLoader subscriptions', () => {
	beforeEach(() => {
		resetOnDemandTextures();
	});

	test('onFileComplete reports the key for the progress bar', async () => {
		const { scene, loader, resident } = makeSceneStub();
		const assets = new AssetLoader(scene);
		const seen: string[] = [];
		assets.onFileComplete((key) => seen.push(key));

		loadTexture('Cycloper', 'units/cardboards/Cycloper');

		resident.add('Cycloper');
		loader.emit('filecomplete', 'Cycloper');
		await drain();

		expect(seen).toEqual(['Cycloper']);
	});

	test('a queued texture is released without any progress subscription', async () => {
		const { scene, loader, resident } = makeSceneStub();
		new AssetLoader(scene);

		let ready = false;
		loadTexture('Cycloper', 'units/cardboards/Cycloper', () => {
			ready = true;
		});

		expect(ready).toBe(false);
		resident.add('Cycloper');
		loader.emit('filecomplete', 'Cycloper');
		await drain();

		// The on-demand channel is the loader's own, not the progress bar's, so a
		// caller that never subscribed still gets released.
		expect(ready).toBe(true);
	});

	test('unsubscribing progress does not strand on-demand waiters', async () => {
		// Regression: the preload bar and the on-demand channel used to be the same
		// subscription. `finishLoading()` drops the bar and then immediately asks
		// for the Dark Priest cardboards, so the request was queued with nobody
		// listening and `setup()` blocked on `ensureCardboardReady` forever — the
		// match sat on the loading screen at 100% with no error.
		const { scene, loader, resident } = makeSceneStub();
		const assets = new AssetLoader(scene);
		const off = assets.onFileComplete(() => undefined);
		off();

		let ready = false;
		loadTexture('Dark Priest player red', 'units/cardboards/Dark Priest player red', () => {
			ready = true;
		});
		resident.add('Dark Priest player red');
		loader.emit('filecomplete', 'Dark Priest player red');
		await drain();

		expect(ready).toBe(true);
	});

	test('unsubscribing stops progress updates for the rest of the match', () => {
		const { scene, loader } = makeSceneStub();
		const assets = new AssetLoader(scene);
		let calls = 0;
		const off = assets.onFileComplete(() => calls++);

		loader.emit('filecomplete');
		off();
		loader.emit('filecomplete');

		// The bar's own listener is gone, so later on-demand textures cannot move it.
		expect(calls).toBe(1);
		loader.progress = 0.9;
		expect(assets.progress).toBe(90);
	});

	test('onceComplete fires for a single complete, not the on-demand ones', () => {
		const { scene, complete, loader } = makeSceneStub();
		const assets = new AssetLoader(scene);
		let calls = 0;
		assets.onceComplete(() => calls++);

		// Three `complete` events fire over a match: the preload batch plus two
		// on-demand textures. Only the first may run the world setup.
		loader.emit('complete');
		loader.emit('complete');
		loader.emit('complete');

		expect(calls).toBe(1);
		expect(complete).toHaveLength(0);
	});

	test('unsubscribing a pending onceComplete cancels it', () => {
		const { scene, complete, loader } = makeSceneStub();
		const assets = new AssetLoader(scene);
		let calls = 0;
		const off = assets.onceComplete(() => calls++);

		off();
		loader.emit('complete');

		expect(calls).toBe(0);
		expect(complete).toHaveLength(0);
	});

	test('unsubscribing twice is harmless', () => {
		const { scene, loader } = makeSceneStub();
		const assets = new AssetLoader(scene);
		let calls = 0;
		const off = assets.onFileComplete(() => calls++);

		off();
		expect(() => off()).not.toThrow();

		loader.emit('filecomplete', 'Cycloper');
		expect(calls).toBe(0);
	});
});

describe('AssetLoader on-demand seam', () => {
	beforeEach(() => {
		resetOnDemandTextures();
		setOnDemandLoader(undefined, undefined);
	});

	test('construction binds the on-demand queue to this scene', async () => {
		const { scene, loader } = makeSceneStub();
		new AssetLoader(scene);

		const waited: string[] = [];
		loadTexture('Cycloper', 'units/cardboards/Cycloper', () => waited.push('ok'));

		expect(loader.image).toHaveBeenCalledWith(
			'Cycloper',
			expect.stringContaining('units/cardboards/'),
		);

		// The file lands: the waiter is released without a further notification.
		notifyTextureLoaded('Cycloper');
		await drain();

		expect(waited).toEqual(['ok']);
	});

	test('a texture requested during a run joins it instead of restarting it', () => {
		const { scene, loader } = makeSceneStub();
		new AssetLoader(scene);
		loader.loading = true;

		loadTexture('Gumble', 'units/cardboards/Gumble');

		expect(loader.image).toHaveBeenCalledTimes(1);
		// Already draining: Phaser ignores a second `start()`, and a naive restart
		// would leave the file queued until some unrelated load came along.
		expect(loader.start).not.toHaveBeenCalled();
	});

	test('a texture requested while idle is queued and started immediately', () => {
		const { scene, loader } = makeSceneStub();
		new AssetLoader(scene);
		loader.loading = false;

		loadTexture('Stomper', 'units/cardboards/Stomper');

		expect(loader.image).toHaveBeenCalledWith('Stomper', expect.any(String));
		expect(loader.start).toHaveBeenCalledTimes(1);
	});

	test('the same key is requested only once', () => {
		const { scene, loader } = makeSceneStub();
		new AssetLoader(scene);

		loadTexture('Nutcase', 'units/cardboards/Nutcase');
		loadTexture('Nutcase', 'units/cardboards/Nutcase');

		expect(loader.image).toHaveBeenCalledTimes(1);
	});

	test('destroy unbinds the seam so a rematch does not queue into a dead loader', () => {
		const { scene, loader } = makeSceneStub();
		const assets = new AssetLoader(scene);
		assets.destroy();

		loadTexture('Impaler', 'units/cardboards/Impaler');

		// With no loader bound the request is recorded as satisfied rather than
		// queued — the headless behaviour, and safe because nothing is rendering.
		expect(loader.image).not.toHaveBeenCalled();
	});

	test('destroy drops every outstanding subscription', () => {
		const { scene, fileComplete, complete } = makeSceneStub();
		const assets = new AssetLoader(scene);
		assets.onFileComplete(() => undefined);
		assets.onceComplete(() => undefined);

		assets.destroy();

		expect(fileComplete).toHaveLength(0);
		expect(complete).toHaveLength(0);
	});

	test('destroy drops the memo so a rematch re-requests what it needs', () => {
		const first = makeSceneStub();
		new AssetLoader(first.scene).destroy();
		first.loader.image.mockClear();

		const second = makeSceneStub();
		new AssetLoader(second.scene);
		loadTexture('Chimera', 'units/cardboards/Chimera');

		// The old loader never saw this key; the new one must.
		expect(first.loader.image).not.toHaveBeenCalled();
		expect(second.loader.image).toHaveBeenCalledWith('Chimera', expect.any(String));
	});
});
