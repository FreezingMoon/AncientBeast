/* eslint-disable @typescript-eslint/no-var-requires */
// Use .env configuration in webpack.config.js
require('dotenv-defaults').config({
	default: './.env.example',
	silent: true,
});

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

// Phaser 4 webpack config - single file, no PIXI/p2 needed
const phaser = path.join(__dirname, '/node_modules/phaser/dist/phaser.js');
const Dotenv = require('dotenv-webpack');

{
	// NOTE: Generate asset lists.
	// Was using Webpack's require.context to generate asset lists, but
	// it appears to have a memory leak that causes the dev server to crash after
	// a few consecutive builds.
	const fs = require('fs');
	const glob = require('glob');
	const toObjString = (paths) =>
		'{' + paths.map((path) => `"${path}":require("${path}")`).join(',') + '}';
	const globOptions = { ignore: ['**/*.js', '**/*.ts', '**/*.md'], posix: true };
	const phaserAutoloadAssets = toObjString(glob.sync('assets/autoload/**/*.*', globOptions));
	const allAssets = toObjString(glob.sync('assets/**/*.*', globOptions));
	const soundPaths = JSON.stringify(
		[
			...glob.sync('assets/sounds/**/*.*', globOptions),
			...glob.sync('assets/units/sfx/**/*.*', globOptions),
		].map((p) => p.replace(/^assets\//, '').replace(/\.[^.]+$/, '')),
	);
	const locationPaths = JSON.stringify(
		glob
			.sync('assets/locations/*.jpg', globOptions)
			.map((p) => p.replace(/^assets\/locations\//, '').replace(/\.jpg$/, '')),
	);

	fs.writeFileSync(
		'assets/index.js',
		`// NOTE: Generated at build time by ${path.basename(__filename)}.
// Do not add to this file.
// Any changes to this file will be overwritten when the project is rebuilt.
// ---------------------------------------------------------------------------
// Webpack's require.context would make this unnecessary, 
// however, it has performance issues https://github.com/webpack/webpack/issues/13636
// and it appears to have a memory leak that makes the webpack dev server crash after a few builds. 
// require.context was last tested July 15, 2023.

export const phaserAutoloadAssetPaths=${phaserAutoloadAssets}

export const assetPaths=${allAssets}

export const soundPaths=${soundPaths}

export const locationPaths=${locationPaths}

`,
	);
}

// Expose mode argument to unify our config options
module.exports = (env, argv) => {
	const production = (argv && argv.mode === 'production') || process.env.NODE_ENV === 'production';
	const enableServiceWorker = process.env.ENABLE_SERVICE_WORKER === 'true' ? true : false;
	// NOTE: The live AncientBeast.com site's CI (.github/workflows/config.yaml) uploads the
	// literal `deploy/` folder, so the default build must keep outputting there unchanged.
	// Passing `--env target=devvit` (used by the Devvit-specific npm scripts) outputs to
	// `dist/client` instead, and adds the extra `gameEntry` entrypoint Devvit Web needs.
	// NOTE: The game is embedded directly (no splash + "expanded mode" step) because Devvit's
	// expanded webview mode ignores our `height` config and forces its own fixed modal size
	// (tall/narrow) regardless of device — unusable for this landscape-only game.
	const isDevvitTarget = Boolean(env && env.target === 'devvit');

	return {
		entry: {
			vendor: ['phaser'],
			app: ['babel-polyfill', path.resolve(__dirname, 'src', 'script.ts')],
			...(isDevvitTarget && {
				// Splash screen (Devvit `default` entrypoint): Bot Practice / Join Queue.
				splash: path.resolve(__dirname, 'src', 'devvit', 'splash.ts'),
				// Thin bridge that loads the full game in Devvit's expanded "pop-up"
				// webview (Devvit `game` entrypoint). See src/devvit/game-entry.ts.
				gameEntry: path.resolve(__dirname, 'src', 'devvit', 'game-entry.ts'),
			}),
		},
		output: {
			path: isDevvitTarget
				? path.resolve(__dirname, 'dist', 'client')
				: path.resolve(__dirname, 'deploy'),
			filename: '[name].[contenthash].bundle.js',
			clean: true, // NOTE: Clean the output folder before each build.
			assetModuleFilename: () => {
				if (production) {
					return 'assets/[contenthash].[ext]';
				}
				return '[path][name].[ext]';
			},
		},
		devtool: production ? 'source-map' : 'inline-source-map',
module: {
			rules: [
				{ test: /\.js$/, use: ['babel-loader'], exclude: /node_modules/ },
				{
					test: /\.ts$/,
					use: isDevvitTarget
						? { loader: 'ts-loader', options: { configFile: 'tsconfig.devvit-client.json' } }
						: 'ts-loader',
					exclude: [/node_modules/, /[\\/]__tests__[\\/]/],
				},
			{
				test: /phaser\.js$/,
				loader: 'expose-loader',
				options: {
					exposes: [
						{
							globalName: 'Phaser',
							override: true,
						},
					],
				},
			},
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
					type: 'asset/resource',
				},
			],
		},
		resolve: {
			alias: {
				phaser: phaser,
				assets: path.resolve(__dirname, 'assets/'),
				modules: path.join(__dirname, 'node_modules'),
				underscore: path.resolve(__dirname, 'node_modules/underscore/underscore-umd.js'),
			},
			extensions: ['.ts', '.js'],
			conditionNames: ['browser', 'import', 'require', 'default'],
			fallback: {
				fs: false,
			},
		},
		watchOptions: {
			ignored: /node_modules/,
			poll: 1000,
		},
		devServer: {
			client: {
				overlay: {
					// Avoid duplicate error popups in dev (console still shows details).
					errors: false,
					warnings: false,
					runtimeErrors: false,
				},
			},
			static: {
				directory: process.env.PUBLIC_PATH
					? path.resolve(__dirname, process.env.PUBLIC_PATH)
					: path.resolve(__dirname, 'static'),
				watch: false,
			},
			port: 8080,
			proxy: [
				{
					context: ['/api'],
					target: '159.65.232.104:7350',
				},
			],
			allowedHosts: ['localhost', '.gitpod.io'],
		},
		plugins: [
			new CopyPlugin({
				patterns: [{ from: 'static' }],
			}),
			new HtmlWebpackPlugin({
				template: path.resolve(__dirname, 'src', 'index.ejs'),
				favicon: path.resolve(__dirname, 'assets', 'favicon.png'),
				chunks: ['vendor', 'app'],
				production,
				enableServiceWorker,
				devvitTarget: isDevvitTarget,
			}),
			...(isDevvitTarget
				? [
						new HtmlWebpackPlugin({
							template: path.resolve(__dirname, 'src', 'devvit', 'splash.ejs'),
							filename: 'splash.html',
							chunks: ['splash'],
							inject: 'body',
						}),
						new HtmlWebpackPlugin({
							template: path.resolve(__dirname, 'src', 'devvit', 'game-entry.html'),
							filename: 'game.html',
							chunks: ['gameEntry'],
							inject: 'body',
						}),
				  ]
				: []),
			new Dotenv({
				defaults: './.env.example',
				silent: true,
			}),
		],
		ignoreWarnings: [
			{
				module: /@protobufjs\/inquire/,
				message: /Critical dependency: the request of a dependency is an expression/,
			},
		],
		performance: {
			hints: false,
		},
	};
};
