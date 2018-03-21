const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const settings = {
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
			favicon: path.resolve(__dirname, 'assets', 'favicon.ico')
		})
	]
};

// Create either a production or development build depending on the `production` env setting

module.exports = settings;
