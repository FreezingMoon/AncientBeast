const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: path.resolve(__dirname, 'src', 'script.js'),
    output: {
        path: path.resolve(__dirname, 'deploy/'),
        filename: 'ancientbeast.js'
    },
    module: {
        rules: [
            {
                test: /\.less$/,
                use: [
                    'style-loader',
                    'css-loader',
                    'less-loader',
                ]
            },
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    'css-loader',
                ]
            },
            {
                test: /\.(png|jpg|gif|svg|ogg|ico|cur|woff|woff2)$/,
                use: [
                    'file-loader'
                ]
            }
        ]
    },
    resolve: {
        alias: {
            Assets: path.resolve(__dirname, 'assets/'),
            'jquery-ui': 'jquery-ui-dist/jquery-ui.js'
        }
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, 'src', 'index.html'),
            favicon: path.resolve(__dirname, 'assets', 'favicon.ico')
        }),
    ],
    devtool: 'cheap-eval-sourcemap'
}