const path = require('path');

const ExtractTextPlugin = require("extract-text-webpack-plugin");
const extractLess = new ExtractTextPlugin(path.resolve(__dirname, 'deploy', 'css', 'main.css'));

module.exports = {
    entry: path.resolve(__dirname, 'src', 'script.js'),
    output: {
        path: path.resolve(__dirname, 'deploy/scripts'),
        filename: 'ancientbeast.js'
    },
    module: {
        rules: [
            {
                test: /\.less$/,
                use: [
                    'style-loader',
                    {
                        loader: 'css-loader',
                        options: {
                            sourceMap: true
                        }
                    },
                    {
                        loader: 'less-loader',
                        options: {
                            sourceMap: true,
                        }
                    }
                ]
            },
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    {
                        loader: 'css-loader',
                        options: {
                            sourceMap: true
                        }
                    }
                ]
            },
            {
                test: /\.(png|jpg|gif|svg|ogg)$/,
                use: [
                    'file-loader'
                ]
            }
        ]
    },
    plugins: [
        extractLess
    ],
    devtool: 'cheap-source-map'
}