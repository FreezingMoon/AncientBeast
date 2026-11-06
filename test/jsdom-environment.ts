/**
 * Jest environment: jsdom, minus the unreachable-asset noise.
 *
 * Suites that boot a real Phaser game need `resources: 'usable'`, because
 * Phaser 4's `TextureManager` blocks its own boot on decoding two base64 PNGs and
 * jsdom only fires an image's `load` event when it is allowed to resolve `src`
 * (see the docblock in `src/__tests__/headless/engine.ts`).
 *
 * The cost of that option is that jsdom also tries to *fetch* every other image
 * the game asks for. There is no asset server behind `http://localhost/`, so each
 * one fails with `ECONNREFUSED` and jsdom reports the miss as a `jsdomError`,
 * which the stock environment prints via `console.error`. A single suite emits
 * hundreds of them, which buries the console output a test actually cares about.
 *
 * Those misses are environmental, not behavioural: the game already degrades on a
 * failed texture (`src/phaser/loader.ts` warns and hands back a placeholder), and
 * the suites assert on that path rather than on the fetch succeeding. So this
 * environment drops the failures that can only mean "the test environment cannot
 * do this" — undeliverable assets, and the DOM APIs jsdom deliberately leaves
 * unimplemented — and forwards everything else untouched: uncaught exceptions,
 * script errors, parse failures, malformed assets, and a missing `canvas` (which
 * would mean a code path needs a real 2D context it cannot have here).
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const JSDOMEnvironment = require('jest-environment-jsdom').default;

/** jsdom error types that mean "a resource could not be delivered". */
const RESOURCE_ERROR_TYPES = new Set(['resource loading', 'XMLHttpRequest']);

/**
 * "Nothing is listening on localhost." jsdom surfaces this either as a Node error
 * code on `error.detail` (the image and script paths keep the original error) or
 * flattened into the message, because `xhr-utils.js` rebuilds a bare `Error` from
 * the XHR status text and drops the code.
 */
const CONNECTION_FAILURES = /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNABORTED/;

/**
 * `src/templates/interface.html` ships its icon placeholders as `src="data:,"`.
 * The URL is valid but empty, and jsdom rejects it as an unloadable resource.
 */
const EMPTY_PLACEHOLDER_URL = /^Could not load \w+: "data:,"/;

/**
 * Phaser's `VisibilityHandler` calls `window.focus()` on every `Game.start()`,
 * and jsdom has no notion of a focused window. Matched by full message so other
 * unimplemented APIs (`HTMLCanvasElement.prototype.getContext` and friends) still
 * surface — those would tell us a code path needs something jsdom cannot give it.
 */
const PHASER_BOOT_FOCUS = /^Not implemented: window\.focus$/;

function isEnvironmentNoise(error) {
	const message = String(error?.message);

	if (PHASER_BOOT_FOCUS.test(message)) {
		return true;
	}

	if (!RESOURCE_ERROR_TYPES.has(error?.type)) {
		return false;
	}

	const cause = error?.detail ?? error;

	return (
		CONNECTION_FAILURES.test(String(cause?.code)) ||
		CONNECTION_FAILURES.test(message) ||
		EMPTY_PLACEHOLDER_URL.test(message)
	);
}

class QuietAssetsEnvironment extends JSDOMEnvironment {
	constructor(config, context) {
		super(config, context);

		const { virtualConsole } = this.dom;
		// The base environment registers a listener that prints every `jsdomError`.
		virtualConsole.removeAllListeners('jsdomError');
		virtualConsole.on('jsdomError', (error) => {
			if (isEnvironmentNoise(error)) {
				return;
			}

			context.console.error(error);
		});
	}

	async teardown() {
		this.dom.virtualConsole.removeAllListeners('jsdomError');
		await super.teardown();
	}
}

module.exports = QuietAssetsEnvironment;
