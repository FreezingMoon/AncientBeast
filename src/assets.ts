/**
 * TODO: Simplify
 *
 * Ancient Beast used to use a custom script to list assets as part of the build process:
 * https://github.com/FreezingMoon/AncientBeast/blob/76692ad039d7a0530fa30ceef367bb0ef68c5015/assetLister.js
 *
 * But Webpack can list assets using require.context, so we're using it here instead.
 *
 * The assetLister was removed, but its format is duplicated here for compatibility reasons.
 * It should probably be rethought and simplified.
 */

/**
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
const dirs: AssetEntry[] = [];
const urls: { [key: string]: string } = {};

{
	const importAll = (require: __WebpackModuleApi.RequireContext) =>
		require.keys().map((localPath) => ({ localPath, url: require(localPath) }));

	const localPaths_urls = importAll(require.context('../assets', true));

	{
		// NOTE: Add entries to URLs.
		/**
		 * Receives the "local path" and returns the "key".
		 * E.g., getKey('./units/sprites/Gumble - Royal Seal.png') === 'units/sprites/Gumble - Royal Seal;
		 */
		const getKey = (localPath: string): string => {
			const parts = localPath.split('/');
			parts.shift();
			const filename = parts.pop().split('.');
			filename.pop();
			parts.push(filename.join('.'));
			return parts.join('/');
		};

		for (const { localPath, url } of localPaths_urls) {
			urls[getKey(localPath)] = url;
		}
	}

	{
		// NOTE: Add entries to dirs.
		for (const { localPath, url } of localPaths_urls) {
			const parts = localPath.split('/');
			parts.shift();

			const id = parts[parts.length - 1].split('.')[0];

			const directories = [...parts];
			directories.pop();

			let currDir = dirs;
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
	}
}

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

/**
 * Accepts a key and returns the absolute path to the resource.
 *
 * @param key {string} e.g., units/shouts/Chimera
 * @returns {string} e.g., http://0.0.0.0:8080/assets/units/shouts/Chimera..ogg
 * @throws Throws an error if the key is not found.
 */
export function getUrl(key: string): string {
	if (urls.hasOwnProperty(key)) return urls[key];
	throw new Error('assets.getUrl(key) is not available for the key: ' + key);
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

export function use(phaser: Phaser.Game) {
	const importAll = (require: __WebpackModuleApi.RequireContext) =>
		require.keys().map((localPath) => require(localPath));

	const basename = (path: string) => {
		const base = new String(path).substring(path.lastIndexOf('/') + 1);
		let i = base.lastIndexOf('.');
		if (base.lastIndexOf('.') === -1) {
			return base;
		}
		while (i > 0 && base[i] === '.') {
			i--;
		}
		return base.substring(0, i + 1);
	};

	const urls = importAll(require.context('../assets/autoload/phaser', true));
	for (const url of urls) {
		phaser.load.image(basename(url), url);
	}
}
