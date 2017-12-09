// automaticly generates the manifest that contains all the assets
const { promisify } = require("util");
const fs = require("fs");
const path = require("path");
const stat = promisify(fs.stat);
const readDir = promisify(fs.readdir);
const prettier = require("prettier");

/**
 * Read the directory
 * 
 * @param {string} dirPath the path of the directory 
 */
async function readDirectory(dirPath) {
    const result = [];
    for (const child of await readDir(dirPath)) {
        const childPath = path.join(dirPath, child);
        const stats = await stat(childPath);
        if (stats.isDirectory()) {
            result.push({
                name: child,
                children: await readDirectory(childPath),
            });
        } else {
            result.push(fileToEntity(childPath));
        }
    }
    return result;
}


/**
 * Generate entity
 * @param {String} filePath
 */
function fileToEntity(filePath) {
    const extension = path.extname(filePath);
    const name = path.basename(filePath, extension);
    return {
        name,
        url: path.relative(path.join(__dirname, 'assets'), filePath)
    }
}

/**
 * Tests if an entity is a dir
 * @param {Object} entity  The entity to check
 * @returns {boolean} Wether the entity is a dir
 */
function entityIsDir(entity) {
    return entity.children !== undefined;
}

/**
 * Write an entity to a string
 * @param {Object} entity  
 */
const entityToString = (entity) => {
    let string = "";
    if (entityIsDir(entity)) {
        string += dirToString(entity);
    }
    else {
        string += fileToString(entity)
    };

    string += ",";
    return string;
}

/**
 * Convert a dir entity to a string
 * @param {Object} dirEntity Entity to write to string
 */
const dirToString = (dirEntity) => `{id: "${dirEntity.name}", children:[${dirEntity.children.map(child => writeToString(child)).reduce((prev, curr) => prev + curr)}] }`;

/**
 * Convert an file entity to a string
 * @param {Object} fileEntity Entity to write to string
 */
const fileToString = (fileEntity) => `{id: "${fileEntity.name}", url: require("assets/${fileEntity.url}") }`;

/**
 * Convert a tree of entities to a string
 * @param {Object} tr
    entry: path.resolve(__dirname, 'src', 'script.js'),ee Tree of entitites
 * @returns {String} 
 */
function writeToString(tree, root = false) {
    let string = "";
    if (root) string += "[";
    if (Array.isArray(tree)) {
        string += tree
            .map(entityToString)
            .reduce((prev, curr) => prev + curr);
    } else {
        string += entityToString(tree);
    }
    if (root) string += "]";
    return string;
}

readDirectory(path.join(__dirname, "assets"))
    // Generate the javascript
    .then(result => `export default ${writeToString(result, true)}`)
    // Format the javascript so it"s readable
    .then(prettier.format)
    // We only need to write one file so it doesnt matter that it"s sync
    .then(result => fs.writeFileSync(path.resolve(__dirname, "src", "manifest.js"), result))
    .catch(console.error);