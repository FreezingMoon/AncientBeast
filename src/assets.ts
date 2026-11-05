import {
	phaserAutoloadAssetPaths,
	assetPaths,
	soundPaths as generatedSoundPaths,
} from '../assets/index';

export { generatedSoundPaths as soundPaths };

/**
 * Load the always-needed assets into the Phaser Game instance, using the URL
 * basename as the Phaser texture key.
 *
 * This is deliberately a short list — hex/frame chrome, drop pickups and the
 * shared unit sprites. Per-unit cardboards, backgrounds, artwork and avatars are
 * *not* here: they are fetched on demand (see {@link loadTexture}) so a match only
 * pays for the units it actually shows. See issue #678.
 *
 * @param {Phaser.Game} phaser
 * @returns {string[]} array of loaded texture keys
 *
 * Texture keys are file basenames, so a basename that appears in more than one
 * preloaded directory resolves to the first one in manifest order. The skipped
 * duplicates are reported as a single warning.
 */
export function use(phaser: Phaser.Game): string[] {
	// In Phaser 4 the loader hangs off the scene (`scene.load`) — neither `Game` nor
	// the `SceneManager` carries one. The first two links below are the Phaser 2 CE
	// shapes, kept as the documented upgrade path; each costs one optional read and
	// is simply absent at runtime under Phaser 4.
	const legacyGame = phaser as { load?: Phaser.Loader.LoaderPlugin };
	const legacyScene = phaser.scene as unknown as { load?: Phaser.Loader.LoaderPlugin };
	const load = legacyGame.load || legacyScene.load || phaser.scene?.scenes?.[0]?.load;
	if (!load) {
		console.warn('[assets.ts] Phaser loader not ready');
		return [];
	}
	const assets = Object.entries(phaserAutoloadAssetPaths ?? {});

	const loadedKeys = new Set<string>();
	const duplicateKeys = new Set<string>();
	const result: string[] = [];

	for (const [path, url] of assets) {
		if (!/\.(png|jpg|jpeg|svg)$/i.test(path)) continue; // Only load images

		const key = getBasename(path);

		if (loadedKeys.has(key)) {
			duplicateKeys.add(key);
			continue;
		}

		load.image(key, url);
		loadedKeys.add(key);
		result.push(key);
	}

	if (duplicateKeys.size) {
		console.warn(
			`[assets.ts] ${duplicateKeys.size} duplicate texture key(s) skipped, first match wins: ` +
				`${[...duplicateKeys].join(', ')}`,
		);
	}
	return result;
}

/**
 * Resolvers for textures that are loaded on demand rather than at match start.
 *
 * Both are reset by {@link resetOnDemandTextures} whenever the Phaser instance is
 * torn down, since the texture cache dies with it.
 */
let onDemandLoader: ((key: string, url: string) => void) | undefined;
let onDemandExists: ((key: string) => boolean) | undefined;
let warnedNoLoader = false;
const inFlight = new Set<string>();
const completed = new Set<string>();

/**
 * Binds {@link loadTexture} to a live Phaser scene.
 *
 * Call once after the engine exists and before the first on-demand texture is
 * requested. Calling it again (e.g. on rematch) clears the memo caches, because
 * the new Phaser instance starts with an empty texture manager.
 */
export function setOnDemandLoader(
	loader?: (key: string, url: string) => void,
	exists?: (key: string) => boolean,
): void {
	onDemandLoader = loader;
	onDemandExists = exists;
	warnedNoLoader = false;
	inFlight.clear();
	completed.clear();
}

/** Whether a texture can be drawn right now, or is already being fetched. */
export function isTextureReady(key: string): boolean {
	if (completed.has(key)) return true;
	return onDemandExists?.(key) ?? false;
}

/** Whether a texture has been requested but has not finished loading yet. */
export function isTextureLoading(key: string): boolean {
	return inFlight.has(key);
}

/**
 * Queue an on-demand texture (a unit cardboard, a match background, …).
 *
 * Repeated calls for the same key are no-ops, and a texture that is already in
 * Phaser's texture manager is never re-fetched. Callers that need to draw it
 * should pass `onReady`, which fires once the texture is available.
 *
 * @param key Phaser texture key, i.e. the asset's basename
 * @param manifestKey key understood by {@link getUrl}, e.g. `units/cardboards/Abolished`
 * @param onReady optional callback invoked after the texture becomes available
 */
export function loadTexture(key: string, manifestKey: string, onReady?: () => void): void {
	if (isTextureReady(key)) {
		onReady?.();
		return;
	}
	if (!onDemandLoader) {
		// Nothing to load against: headless simulations and unit tests. Report
		// once, then let the caller draw anyway rather than hanging on a callback
		// that can never fire.
		//
		// The key is recorded as resolved so a caller that immediately retries
		// (e.g. a preview redrawn from its own onReady) terminates instead of
		// recursing. `setOnDemandLoader` clears `completed`, so binding a real
		// loader later still gives the key a chance to be fetched.
		if (!warnedNoLoader) {
			warnedNoLoader = true;
			console.warn('[assets.ts] no on-demand loader bound; textures will not be fetched');
		}
		completed.add(key);
		onReady?.();
		return;
	}
	if (inFlight.has(key)) {
		// A caller that arrived mid-flight still wants to draw the texture, so
		// defer its callback until the pending load settles.
		pendingCallbacks.set(key, (pendingCallbacks.get(key) ?? []).concat(onReady ?? []));
		return;
	}

	inFlight.add(key);
	if (onReady) {
		pendingCallbacks.set(key, [onReady]);
	}

	const url = safeGetUrl(manifestKey);
	if (!url) {
		console.warn(`[assets.ts] unknown asset "${manifestKey}"; texture "${key}" not loaded`);
		inFlight.delete(key);
		pendingCallbacks.delete(key);
		onReady?.();
		return;
	}

	onDemandLoader(key, url);
}

/**
 * Called by the scene once an on-demand file finishes decoding, so waiting
 * callers can draw it.
 */
export function notifyTextureLoaded(key: string): void {
	inFlight.delete(key);
	completed.add(key);
	const callbacks = pendingCallbacks.get(key);
	pendingCallbacks.delete(key);
	for (const callback of callbacks ?? []) {
		callback();
	}
}

/**
 * Called by the scene when an on-demand file fails to load.
 *
 * The waiters have to be released here or they wait forever. `ensureCardboardReady`
 * resolves on this, not only on success: a unit whose cardboard 404s should still
 * reach the board and draw with `__MISSING`, and a match that refuses to start
 * because one image 404s is strictly worse than one that looks wrong. Nothing is
 * added to `completed`, so a later retry can still fetch it.
 */
export function notifyTextureFailed(key: string): void {
	inFlight.delete(key);
	const callbacks = pendingCallbacks.get(key);
	pendingCallbacks.delete(key);
	console.warn(`[assets.ts] failed to load texture "${key}"`);
	for (const callback of callbacks ?? []) {
		callback();
	}
}

const pendingCallbacks = new Map<string, (() => void)[]>();

/**
 * Fetch a unit cardboard the first time it is needed.
 *
 * Cardboards are what a unit looks like on the board, and they are also what the
 * placement preview uses to work out where a unit will land — so a match only
 * ever pays for the units it actually shows, instead of the whole roster. The
 * 2–8 KiB PNGs are queued one at a time through the on-demand loader.
 *
 * @param key cardboard texture key, i.e. the file basename (`Abolished`, or
 *   `Dark Priest clone blue` for the per-player Dark Priest variants)
 * @param onReady optional callback invoked once the texture can be drawn
 * @returns true if the texture is already available
 */
export function ensureCardboard(key: string, onReady?: () => void): boolean {
	if (isTextureReady(key)) {
		onReady?.();
		return true;
	}
	loadTexture(key, `units/cardboards/${key}`, onReady);
	return false;
}

/**
 * {@link ensureCardboard} as a promise, for the rare caller that cannot draw
 * until the texture is actually resident.
 *
 * The Dark Priest is the case that matters: it is on the board the instant
 * `setup()` runs and has no placement preview to trigger a lazy load, so
 * `setup()` waits on this rather than spawning a unit against a missing texture.
 *
 * @param key cardboard texture key, i.e. the file basename
 */
export function ensureCardboardReady(key: string): Promise<void> {
	return new Promise((resolve) => {
		ensureCardboard(key, resolve);
	});
}

/**
 * Fetch a drop pickup's art the first time a unit carrying it is created.
 *
 * Drops are only ever spawned when a unit dies, so a match that ends without
 * losses never touches them. Warming when the unit appears leaves the whole
 * round between the request and the drop actually hitting the board.
 *
 * @param key drop texture key, i.e. the file basename (`fried chicken`)
 */
export function ensureDropTexture(key: string): void {
	loadTexture(key, `drops/${key}`);
}

/** Clears the on-demand memo state. Called when the Phaser instance is destroyed. */
export function resetOnDemandTextures(): void {
	inFlight.clear();
	completed.clear();
	pendingCallbacks.clear();
}

function safeGetUrl(key: string): string | undefined {
	try {
		return getUrl(key);
	} catch {
		return undefined;
	}
}

/**
 * Extract basename from a file path.
 *
 * @param {string} path a file path
 * @returns {string} the basename from the path
 * @example getBasename('./assets/a/b/myFile.png') === 'myFile'
 */
function getBasename(path: string): string {
	const base = new String(path).substring(path.lastIndexOf('/') + 1);
	let i = base.lastIndexOf('.');
	if (base.lastIndexOf('.') === -1) {
		return base;
	}
	while (i > 0 && base[i - 1] === '.') {
		i--;
	}
	return base.substring(0, i);
}

/**
 * Legacy asset system
 * /////////////////////////////////////////////////////////////////////////////////////////////////
 *
 * TODO: Simplify legacy assets
 *
 * Ancient Beast used to use a custom asset list format in `assetLister`.
 * assetLister.ts was removed, but its format is duplicated here for compatibility reasons.
 * It should probably be rethought and simplified.
 *
 *
 * NOTE: Assemble the legacy Assets format.
 *
 * For theses local paths ...
 *
 * assets/icons/audio/back.svg
 * assets/icons/audio/effects-off.svg
 * assets/icons/audio/effects.svg
 * assets/icons/audio/music-off.svg
 * assets/icons/audio/music.svg
 * assets/icons/audio/next.svg
 * assets/icons/audio/pause.svg
 * assets/icons/audio/play.svg
 * assets/icons/audio/shuffle.svg
 * assets/icons/audio.svg
 * assets/icons/cancel.svg
 * assets/icons/close.svg
 * assets/icons/contract.svg
 *
 *
 * Create this structure
 * {
 *  id: "icons",
 *  children: [
 *    {
 *      id: "audio",
 *      children: [
 *        { id: "back", url: require("assets/icons/audio/back.svg") },
 *        {
 *          id: "effects-off",
 *          url: require("assets/icons/audio/effects-off.svg"),
 *        },
 *        { id: "effects", url: require("assets/icons/audio/effects.svg") },
 *        { id: "music-off", url: require("assets/icons/audio/music-off.svg") },
 *        { id: "music", url: require("assets/icons/audio/music.svg") },
 *        { id: "next", url: require("assets/icons/audio/next.svg") },
 *        { id: "pause", url: require("assets/icons/audio/pause.svg") },
 *        { id: "play", url: require("assets/icons/audio/play.svg") },
 *        { id: "shuffle", url: require("assets/icons/audio/shuffle.svg") },
 *      ],
 *    },
 *    { id: "audio", url: require("assets/icons/audio.svg") },
 *    { id: "cancel", url: require("assets/icons/cancel.svg") },
 *    { id: "close", url: require("assets/icons/close.svg") },
 *    { id: "contract", url: require("assets/icons/contract.svg") }
 *  ]
 * }
 *
 */

type AssetEntry = { id: string; url?: string; children?: AssetEntry[] };

const dirs: AssetEntry[] = (() => {
	// NOTE: Add entries to dirs.
	const result = [];
	for (const [path, url] of Object.entries(assetPaths)) {
		const parts = path.split('/');
		parts.shift();

		const id = parts[parts.length - 1].split('.')[0];

		const directories = [...parts];
		directories.pop();

		let currDir = result;
		for (const dir of directories) {
			const matches = currDir.filter((entry) => entry.id === dir);
			if (matches.length && matches[0].children) {
				currDir = matches[0].children;
			} else {
				const entry = { id: dir, children: [] };
				currDir.push(entry);
				currDir = entry.children;
			}
		}
		currDir.push({ id, url });
	}
	return result;
})();

function getAssetEntry(pathStr: string): string | AssetEntry[] {
	// Convert path to an array if it is a string
	const path = pathStr.split('/');

	// Check if path is empty
	if (path.length === 0) {
		throw new Error('Path cannot be empty');
	}
	// prev = children (starts with the assets)
	// current = what we are looking at now
	const result = path.reduce((prev, current) => {
		const entity = prev.find((e) => e.id === current);
		if (entity === undefined) {
			throw new Error(`Could not find asset with path: ${path.join('/')}`);
		}

		if (entity.children) {
			// If there are still children left, return the children
			return entity.children;
		} else if (entity.url) {
			// When there are no more children left, return the url
			return entity.url;
		} else {
			throw new Error('Entity is of wrong type: ' + entity);
		}
	}, dirs);

	return result;
}

const dirCache: Record<string, AssetEntry[]> = {};

/**
 * Accepts a key and returns an AssetEntry array.
 *
 * @param key {string} A key from the '/assets' folder, e.g., "music" | "music/epic"
 * @returns {AsssetEntry[]} An array of {id:string, children?:AssetEntry[], url?:string}
 *
 * E.g., getDirectory('music') === [
 * {
 * "id": "epic",
 * "children": [
 *  {
 *   "id": "Castle Black by Agret Brisignr",
 *   "url": "http://0.0.0.0:8080/assets/music/epic/Castle Black by Agret Brisignr..ogg"
 *  },
 *  {
 *   "id": "City of Sand by Agret Brisignr",
 *   "url": "http://0.0.0.0:8080/assets/music/epic/City of Sand by Agret Brisignr..ogg"
 *  }, ...
 * @throws Throws an error if the key is not found.
 */
export function getDirectory(path: string): AssetEntry[] {
	if (dirCache.hasOwnProperty(path)) return dirCache[path];

	const entry = getAssetEntry(path);
	if (typeof entry === 'string') {
		throw new Error('Asset URL is not available: ' + path);
	} else {
		dirCache[path] = entry;
	}
	return entry;
}

const urls: { [key: string]: string } = (() => {
	/**
	 * Receives the "local path" and returns the "key".
	 * E.g., getKey('./assets/units/sprites/trap_firewall.png') === 'units/sprites/trap_firewall';
	 */
	const getKey = (path: string): string => {
		const parts = path.split('/');
		parts.shift();
		const filename = parts.pop().split('.');
		filename.pop();
		parts.push(filename.join('.'));
		return parts.join('/');
	};

	const result = {};
	for (const [path, url] of Object.entries(assetPaths)) {
		result[getKey(path)] = url;
	}
	return result;
})();

/**
 * Accepts a key and returns the absolute path to the resource.
 *
 * @param key {string} e.g., units/shouts/Chimera
 * @returns {string} e.g., http://0.0.0.0:8080/deploy/assets/0acb67b5fb51207b6b23..ogg
 * @throws Throws an error if the key is not found.
 */
export function getUrl(key: string): string {
	if (urls.hasOwnProperty(key)) return urls[key];
	throw new Error('assets.getUrl(key) is not available for the key: ' + key);
}
