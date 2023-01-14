import Assets from './assets';

// Cache to store previous results
const cache = {};

/**
 * Retrieves the URL for a specific asset based on its path. This function maintains a cache of previous results to improve performance. If the result is already in the cache, it is returned immediately. Otherwise, the result is calculated using the `reduce` method and added to the cache for future use.
 *
 * @param {string|string[]} path The path to the asset, either as a string or an array of strings.
 * @return {string} The URL of the asset.
 *
 * @throws {Error} If the path is empty or if the asset cannot be found.
 */

export function getUrl(path) {
	// Convert path to an array if it is a string
	if (typeof path === 'string') {
		path = path.split('/');
	}

	// Check if path is empty
	if (path.length === 0) {
		throw new Error('Path cannot be empty');
	}

	// Check if the result is already in the cache
	const cacheKey = path.join('/');
	if (cache[cacheKey]) {
		return cache[cacheKey];
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
	}, Assets);

	// Add the result to the cache
	cache[cacheKey] = result;

	return result;
}
