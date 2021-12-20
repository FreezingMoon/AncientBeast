// Automatically generates the manifest that contains all the assets
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const stat = promisify(fs.stat);
const readDir = promisify(fs.readdir);
const prettier = require('prettier');

const ignoredFiles = [/\.DS_Store/];

/**
 * Generate entity
 *
 * @param {String} filePath The path to the file to convert to an entity.
 * @return {Object} A file entity.
 */
function fileToEntity(filePath) {
	const extension = path.extname(filePath);
	const name = path.basename(filePath, extension);

	return {
		name,
		url: path.relative(path.join(__dirname, 'assets'), filePath),
	};
}

/**
 * Read the directory
 *
 * @param {string} dirPath the path of the directory.
 * @return {Promise<any[]>} An array of asset objects.
 */
async function readDirectory(dirPath) {
	let children = await readDir(dirPath);

	// Remove any files that should not be listed with assets.
	children = children.filter((child) => {
		return !ignoredFiles.some((pattern) => pattern.test(child));
	});

	return Promise.all(
		children.map(async (child) => {
			const childPath = path.join(dirPath, child);
			const stats = await stat(childPath);
			if (stats.isDirectory()) {
				const children = await readDirectory(childPath);
				return {
					name: child,
					children,
				};
			}
			return fileToEntity(childPath);
		}),
	);
}

/**
 * Tests if an entity is a dir
 *
 * @param {Object} entity  The entity to check.
 * @returns {boolean} Whether the entity is a dir.
 */
function entityIsDir(entity) {
	return entity.children !== undefined;
}

/**
 * Convert an entity object to a string
 *
 * @param {Object} entity The entity object to convert.
 * @return {string} The entity object as a string.
 */
function entityToString(entity) {
	return (entityIsDir(entity) ? dirToString(entity) : fileToString(entity)) + ',';
}

/**
 * Convert a tree of entities to a string
 *
 * @param {Object} tree A tree of entities.
 * @param {boolean} root Is this the root of a tree?
 * @returns {string} The tree converted to a string.
 */
function writeToString(tree, root = false) {
	let string = root ? '[' : '';

	if (Array.isArray(tree)) {
		string += tree.map(entityToString).reduce((prev, curr) => prev + curr);
	} else {
		string += entityToString(tree);
	}

	if (root) {
		string += ']';
	}

	return string;
}

/**
 * Convert a dir entity to a string
 *
 * @param {Object} dirEntity Entity object to convert to a string.
 * @return {string} The dir entity as a string.
 */
function dirToString(dirEntity) {
	return `{id: "${dirEntity.name}", children:[${dirEntity.children
		.map((child) => writeToString(child))
		.reduce((prev, curr) => prev + curr)}] }`;
}

/**
 * Convert a file entity to a string
 *
 * @param {Object} fileEntity Entity to write to string.
 * @return {string} The file entity as a string.
 */
function fileToString(fileEntity) {
	return `{id: "${fileEntity.name}", url: require("assets/${fileEntity.url}") }`;
}

readDirectory(path.join(__dirname, 'assets'))
	// Generate the JavaScript
	.then((result) => `export default ${writeToString(result, true)}`)
	// Add path fix for Windows
	.then((result) => result.replace(/\\/g, '\\\\'))
	// Format the JavaScript so that it's readable
	.then((result) => {
		return prettier.format(result, { parser: 'babel' });
	})
	// We only need to write one file so it doesn't matter that it's sync
	.then((result) => fs.writeFileSync(path.resolve(__dirname, 'src', 'assets.js'), result)) // eslint-disable-line no-sync
	.then((_) => console.log('Asset lister completed'))
	.catch((err) => console.error(`Asset lister failed: ${err.toString()}`));
