const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const variables = require('./webpack.var');

let settings = {};
console.log('STRING:', process.env.NODE_ENV);
if (process.env.NODE_ENV) {
	console.log(1);
	settings = {
		entry: path.resolve(__dirname, 'src', 'script.js'),
		output: {
			path: path.resolve(__dirname, 'deploy/'),
			filename: 'ancientbeast.js',
			publicPath: '/'
		},
		devtool: 'inline-source-map',
		optimization: {
			splitChunks: {
				cacheGroups: {}
			}
		},
		module: {
			rules: [
				{
					test: /\.less$/,
					use: ['style-loader', 'css-loader', 'less-loader']
				},
				{
					test: /\.css$/,
					use: ['style-loader', 'css-loader']
				},
				{
					test: /\.(png|jpg|gif|svg|ogg|ico|cur|woff|woff2)$/,
					use: ['file-loader']
				}
			]
		},
		resolve: {
			alias: {
				assets: path.resolve(__dirname, 'assets/'),
				modules: path.join(__dirname, 'node_modules')
			}
		},
		plugins: [
			new HtmlWebpackPlugin({
				template: path.resolve(__dirname, 'src', 'index.html'),
				favicon: path.resolve(__dirname, 'assets', 'favicon.ico'),
				google: variables.google
			})
		]
	};
} else {
	console.log(2);
	settings = {
		entry: path.resolve(__dirname, 'src', 'script.js'),
		output: {
			path: path.resolve(__dirname, 'deploy/'),
			filename: 'ancientbeast.js',
			publicPath: '/'
		},
		devtool: 'inline-source-map',
		optimization: {
			splitChunks: {
				cacheGroups: {}
			}
		},
		module: {
			rules: [
				{
					test: /\.less$/,
					use: ['style-loader', 'css-loader', 'less-loader']
				},
				{
					test: /\.css$/,
					use: ['style-loader', 'css-loader']
				},
				{
					test: /\.(png|jpg|gif|svg|ogg|ico|cur|woff|woff2)$/,
					use: ['file-loader']
				}
			]
		},
		resolve: {
			alias: {
				assets: path.resolve(__dirname, 'assets/'),
				modules: path.join(__dirname, 'node_modules')
			}
		},
		plugins: [
			new HtmlWebpackPlugin({
				template: path.resolve(__dirname, 'src', 'index.html'),
				favicon: path.resolve(__dirname, 'assets', 'favicon.ico'),
				google: ''
			})
		]
	};
}
console.log(settings.plugins);
module.exports = settings;
