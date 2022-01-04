/* eslint-disable @typescript-eslint/no-var-requires */
// Use .env configuration in webpack.config.js
require('dotenv-defaults').config({
	default: './.env.example',
});

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

// Phaser webpack config
const phaserModule = path.join(__dirname, '/node_modules/phaser-ce/');
const phaser = path.join(phaserModule, 'build/custom/phaser-split.js');
const pixi = path.join(phaserModule, 'build/custom/pixi.js');
const p2 = path.join(phaserModule, 'build/custom/p2.js');
const Dotenv = require('dotenv-webpack');

// Expose mode argument to unify our config options.
module.exports = (env, argv) => {
	const production = (argv && argv.mode === 'production') || process.env.NODE_ENV === 'production';
	const enableServiceWorker = process.env.ENABLE_SERVICE_WORKER === 'true' ? true : false;

	return {
		entry: {
			vendor: ['pixi', 'p2', 'phaser'],
			app: ['babel-polyfill', path.resolve(__dirname, 'src', 'script.ts')],
		},
		output: {
			path: path.resolve(__dirname, 'deploy'),
			filename: '[name].[hash].bundle.js',
		},
		devtool: production ? 'none' : 'source-map',
		module: {
			rules: [
				{ test: /\.js$/, use: ['babel-loader'], exclude: /node_modules/ },
				{
					test: /\.ts$/,
					use: 'ts-loader',
					exclude: /node_modules/,
				},
				{ test: /pixi\.js/, use: ['expose-loader?PIXI'] },
				{ test: /phaser-split\.js$/, use: ['expose-loader?Phaser'] },
				{ test: /p2\.js/, use: ['expose-loader?p2'] },
				{
					test: /\.html$/,
					use: ['html-loader'],
				},
				{
					test: /\.less$/,
					use: ['style-loader', 'css-loader', 'less-loader'],
				},
				{
					test: /\.css$/,
					use: ['style-loader', 'css-loader'],
				},
				{
					test: /\.(png|jpg|gif|svg|ogg|ico|cur|woff|woff2)$/,
					loader: 'file-loader',
					options: {
						name(resourcePath, resourceQuery) {
							if (production) {
								return 'assets/[contenthash].[ext]';
							}
							return '[path][name].[ext]';
						},
						esModule: false,
					},
				},
			],
		},
		resolve: {
			alias: {
				pixi: pixi,
				p2: p2,
				phaser: phaser,
				assets: path.resolve(__dirname, 'assets/'),
				modules: path.join(__dirname, 'node_modules'),
			},
			extensions: ['.ts', '.js'],
		},
		devServer: {
			contentBase: process.env.PUBLIC_PATH ? process.env.PUBLIC_PATH : '/',
			port: 8080,
			proxy: {
				'/api': '159.65.232.104:7350',
			},
		},
		plugins: [
			new CopyPlugin({
				patterns: [{ from: 'static' }],
			}),
			new HtmlWebpackPlugin({
				template: path.resolve(__dirname, 'src', 'index.ejs'),
				favicon: path.resolve(__dirname, 'assets', 'favicon.png'),
				production,
				enableServiceWorker,
			}),
			new Dotenv({
				defaults: './.env.example',
			}),
		],
		node: {
			fs: 'empty',
		},
	};
};
