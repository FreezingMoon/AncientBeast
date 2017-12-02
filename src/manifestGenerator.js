// automaticly generate manifest
// Don't use this in the game. All this does is generate the
const { promisify } = require("util");
const fs = require("fs");
const path = require("path");
const stat = promisify(fs.stat);
const readDir = promisify(fs.readdir);

/**
 * Read the directory
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
                type: "directory"
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
        url: path.relative(__dirname, filePath)
    }
}

readDirectory(path.join(__dirname, 'assets'))
    .then(result => console.log(result))
    .catch(console.error);