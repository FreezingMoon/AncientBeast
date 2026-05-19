/*
 * Jest config for bot simulation tests.
 * Run via: npm run simulate
 */
const base = require('./jest.config.js');

module.exports = {
	...base,
	testMatch: ['**/src/__tests__/simulation/**/*.test.[jt]s?(x)'],
	// Override base exclusions — we WANT to run the simulation directory here
	testPathIgnorePatterns: ['/node_modules/'],
	testTimeout: 600_000, // 10 minutes — simulation runs thousands of matches
	verbose: false, // the test itself prints a summary; per-test lines are noisy
};
