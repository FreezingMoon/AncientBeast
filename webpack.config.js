const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const variables = require('./webpack.var');
const merge = require('webpack-merge');
const CopyPlugin = require('copy-webpack-plugin');

// Phaser webpack config
const phaserModule = path.join(__dirname, '/node_modules/phaser-ce/');
const phaser = path.join(phaserModule, 'build/custom/phaser-split.js');
const pixi = path.join(phaserModule, 'build/custom/pixi.js');
const p2 = path.join(phaserModule, 'build/custom/p2.js');

// Expose mode argument to unify our config options.
module.exports = (env, argv) => {
	// Common settings for all environments.
	const common = {
		entry: path.resolve(__dirname, 'src', 'script.js'),
		output: {
			path: path.resolve(__dirname, 'deploy/'),
			filename: 'ancientbeast.js',
			// chunkFilename: '[id].chunk.js',
			publicPath: '/',
		},

		devtool: 'inline-source-map',
		optimization: {
			splitChunks: {
				cacheGroups: {},
			},
		},

		module: {
			rules: [
				{ test: /pixi\.js/, use: ['expose-loader?PIXI'] },
				{ test: /phaser-split\.js$/, use: ['expose-loader?Phaser'] },
				{ test: /p2\.js/, use: ['expose-loader?p2'] },
				{ test: /\.js$/, use: ['babel-loader'] },
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

		// Eventually we want to use a version of this.
		// optimization: {
		// 	splitChunks: {
		// 		cacheGroups: {
		// 			vendor: {
		// 				test: /[\\/]node_modules[\\/]/,
		// 				name: "vendors",
		// 				enforce: true
		// 			},
		// 			assets: {
		// 				test: /[\\/]assets[\\/]/,
		// 				name: "assets",
		// 				enforce: true
		// 			},
		// 		}
		// 	}
		// },

		plugins: [
			new CopyPlugin([{ from: 'static' }]),
			new HtmlWebpackPlugin({
				template: path.resolve(__dirname, 'src', 'index.html'),
				favicon: path.resolve(__dirname, 'assets', 'favicon.png'),
				worker: variables.worker,
				analytics: '',
			}),
		],
	};

	const production = {
		plugins: [
			new CopyPlugin([{ from: 'static' }]),
			new HtmlWebpackPlugin({
				template: path.resolve(__dirname, 'src', 'index.html'),
				favicon: path.resolve(__dirname, 'assets', 'favicon.png'),
				worker: variables.worker,
				analytics: variables.analytics,
			}),
		],
	};

	// argv is passed in when ran via `webpack --mode` and process.env.NODE_ENV is used when
	// `npm start` commands are used.
	if ((argv && argv.mode === 'production') || process.env.NODE_ENV === 'production') {
		return merge.strategy({ plugins: 'replace' })(common, production);
	} else {
		return common;
	}
};
