import { DEBUG } from './debug';
import { phaserAutoloadAssetPaths, assetPaths } from '../assets/index';

/**
 * Load all assets in phaserAutoloadAssetsPaths into Phaser Game instance, using URL basename as Phaser key.
 *
 * @param {Phaser.Game} e.g., units/shouts/Chimera
 * @returns {void}
 * @throws Throws an error if two files have the same basename.
 */
export function use(phaser: Phaser.Game): void {
	// NOTE: currently only accepts images.
	const urls = Object.values(phaserAutoloadAssetPaths);

	const hasDuplicateBasenames = new Set(urls.map((url) => getBasename(url))).size < urls.length;
	if (DEBUG && hasDuplicateBasenames) throwDuplicateBasenamesError();

	for (const url of urls) {
		phaser.load.image(getBasename(url), url);
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
	while (i > 0 && base[i] === '.') {
		i--;
	}
	return base.substring(0, i + 1);
}

function throwDuplicateBasenamesError() {
	// NOTE: Throw a useful message listing duplicate basenames.
	const paths = assetPaths
		.map(({ path }) => path)
		.filter((path) => path.indexOf('/autoload/phaser/') !== -1);

	const basenameToPaths: { [basename: string]: string[] } = paths.reduce((obj, path) => {
		const bn = getBasename(path);
		if (obj.hasOwnProperty(bn)) {
			obj[bn].push(path);
		} else {
			obj[bn] = [path];
		}
		return obj;
	}, {});

	const duplicates: { [basename: string]: string[] } = Object.entries(basenameToPaths).reduce(
		(obj, [basename, paths]) => {
			if (paths.length > 1) {
				obj[basename] = paths;
			}
			return obj;
		},
		{},
	);

	const formatted = [];
	for (const [basename, paths] of Object.entries(duplicates)) {
		for (const path of paths) {
			formatted.push(basename + '\t' + path);
		}
	}

	throw new Error(`[Ancient Beast] 
Some files under assets/autoload/phaser/ have the same basename.
Basenames are used as keys by Phaser and must be unique.
Please make each basename unique.

Duplicate basenames:
${formatted.join('\n')}
`);
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
	 * E.g., getKey('./units/sprites/Gumble - Royal Seal.png') === 'units/sprites/Gumble - Royal Seal;
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
