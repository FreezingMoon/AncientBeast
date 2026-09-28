/*
 * Jest config for bot simulation tests.
 * Run via: bun run simulate
 */

// CommonJS on purpose: `package.json` has no `"type": "module"`, so mixing an
// ESM `import` with `module.exports` here makes Node load this file as ESM and
// then fail on `module.exports`.
const base = require('./jest.config.js');

module.exports = {
	...base,
	testMatch: ['**/src/__tests__/simulation/**/*.test.[jt]s?(x)'],
	// Override base exclusions — we WANT to run the simulation directory here.
	// `/node_modules/` is dropped too so matches inside the worktree still run.
	testPathIgnorePatterns: ['/node_modules/'],
	testTimeout: 600_000, // 10 minutes — simulation runs thousands of matches
	verbose: false, // the test itself prints a summary; per-test lines are noisy
};
