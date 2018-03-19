const path = require('path');
const webpack = require('webpack');
const merge = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

// Are we in production
const production = process.env.production;

const baseSettings = {
	entry: path.resolve(__dirname, 'src', 'script.js'),
	output: {
		path: path.resolve(__dirname, 'deploy/'),
		filename: 'ancientbeast.js'
	},
	optimization: {
		splitChunks: {
			cacheGroups: {
				vendor: {
					test: 'vendor',
					name: 'vendor',
					enforce: true
				}
			}
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
			favicon: path.resolve(__dirname, 'assets', 'favicon.ico')
		})
	]
};

const prodSettings = {
	plugins: [
		new UglifyJSPlugin(),
		new webpack.DefinePlugin({
			'process.env.NODE_ENV': JSON.stringify('production')
		})
	]
};

const devSettings = {
	devtool: 'cheap-module-eval-source-map'
};

// Create either a production or development build depending on the `production` env setting
module.exports = merge(baseSettings, production ? devSettings : prodSettings);
