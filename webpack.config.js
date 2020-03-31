const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const variables = require('./webpack.var');
const CopyPlugin = require('copy-webpack-plugin');

// Phaser webpack config
const phaserModule = path.join(__dirname, '/node_modules/phaser-ce/');
const phaser = path.join(phaserModule, 'build/custom/phaser-split.js');
const pixi = path.join(phaserModule, 'build/custom/pixi.js');
const p2 = path.join(phaserModule, 'build/custom/p2.js');
const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');

// Expose mode argument to unify our config options.
module.exports = (env, argv) => {
	let htmlPluginSettings = {
		template: path.resolve(__dirname, 'src', 'index.html'),
		favicon: path.resolve(__dirname, 'assets', 'favicon.png'),
		worker: variables.worker,
		analytics: '',
	};

	if ((argv && argv.mode === 'production') || process.env.NODE_ENV === 'production') {
		htmlPluginSettings.analytics = variables.analytics;
	}

	const smp = new SpeedMeasurePlugin();

	return smp.wrap({
		entry: path.resolve(__dirname, 'src', 'script.js'),
		output: {
			path: path.resolve(__dirname, 'deploy/'),
			filename: 'ancientbeast.js',
			// chunkFilename: '[id].chunk.js',
			publicPath: '/',
		},
		devtool: 'inline-source-map',
		module: {
			rules: [
				{ test: /pixi\.js/, use: ['expose-loader?PIXI'] },
				{ test: /phaser-split\.js$/, use: ['expose-loader?Phaser'] },
				{ test: /p2\.js/, use: ['expose-loader?p2'] },
				{ test: /\.js$/, use: ['babel-loader'], exclude: /node_modules/ },
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
					use: ['file-loader'],
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
		},
		plugins: [new CopyPlugin([{ from: 'static' }]), new HtmlWebpackPlugin(htmlPluginSettings)],
	});
};
