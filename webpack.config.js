const path = require('path');

module.exports = {
    entry: './src/script.js',
    output: {
        path: path.resolve(__dirname, 'deploy/scripts'),
        filename: 'ancientbeast.js'
    },
    devtool: 'cheap-source-map'
}