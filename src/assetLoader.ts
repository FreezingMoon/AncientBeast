import Assets from './assets';

/** getUrl
 *
 * @param {String | Array} path path to the string
 * @return {?} ? ?
 */
export function getUrl(path) {
	if (typeof path === 'string') {
		path = path.split('/');
	}

	// Check if path is empty
	if (path.length === 0) {
		throw new Error('Path cannot be empty');
	}

	// prev = children (starts with the assets)
	// current = what we are looking at now
	return path.reduce((prev, current) => {
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
}
