module.exports = (api) => {
	// Source: https://www.wisdomgeek.com/development/web-development/how-to-setup-jest-typescript-babel-webpack-project/
	// Testing if babel is being run in test mode
	const isTest = api.env('test');
	/**
	 * Cache the returned value forever and don't call this function again. This is the default behavior but since we
	 * are reading the env value above, we need to explicitly set it after we are done doing that, else we get a
	 * caching was left unconfigured error.
	 */
	api.cache(true);
	return {
		plugins: ['@babel/plugin-transform-runtime'],
		presets: [
			// Enabling Babel to understand TypeScript
			'@babel/preset-typescript',
			[
				// Allows smart transpilation according to target environments
				'@babel/preset-env',
				{
					/**
					 * Specifying what module type should the output be in.
					 * For test cases, we transpile all the way down to commonjs since jest does not understand TypeScript.
					 * For all other cases, we don't transform since we want Webpack to do that in order for it to do
					 * dead code elimination (tree shaking) and intelligently select what all to add to the bundle.
					 */
					modules: isTest ? 'commonjs' : false,
				},
			],
		],
	};
};
