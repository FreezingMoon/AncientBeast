/**
 * A DOM for Phaser to boot into, off-browser.
 *
 * Phaser 4 touches `window` at module-evaluation time, not at construction time,
 * so a bare `import('phaser')` in Node throws `ReferenceError: window is not
 * defined` before any of AB's own code runs. There is no way to make Phaser
 * tolerate a missing `window`; the engine has to be given one.
 *
 * jsdom supplies it. This is the same DOM the Jest suites already run under, so
 * the headless simulation and the unit tests agree about what the environment
 * looks like — which is the point: a behaviour that only shows up off-browser is
 * a behaviour the test suite should have been able to see.
 *
 * Nothing is rendered, so the expensive parts of a DOM are not worth paying for:
 * no layout, no CSS, no resource loading.
 */

let installed = false;

/** The window this module installed, so a caller can restore the real one. */
let installedWindow: unknown = null;

/**
 * Make `window`/`document` available, if they are not already.
 *
 * Idempotent, and a no-op under jsdom or a browser. Call it *before*
 * `loadPhaser()` — the ordering is the whole reason this module exists.
 *
 * @returns `true` if globals were installed by this call.
 */
export async function ensureDomGlobals(): Promise<boolean> {
	if (installed || typeof globalThis.window !== 'undefined') {
		return false;
	}

	const { JSDOM, VirtualConsole } = (await import('jsdom')) as unknown as {
		JSDOM: new (html: string, options: Record<string, unknown>) => {
			window: Record<string, unknown> & typeof globalThis;
		};
		VirtualConsole: new () => {
			on(event: string, cb: (error: Error) => void): void;
			sendTo(console: unknown, omitJSDOMErrors?: boolean): void;
		};
	};

	// jsdom reports the DOM APIs it has no implementation for as errors, and
	// Phaser touches several of them while booting (`window.focus` from the
	// visibility handler, most visibly). Those are rendering and focus concerns
	// this runner has no use for, so the noise is dropped rather than printed
	// once per boot. Everything else still reaches the console.
	const virtualConsole = new VirtualConsole();
	virtualConsole.on('jsdomError', () => undefined);
	virtualConsole.sendTo(console, true);

	const dom = new JSDOM('<!doctype html><html><body></body></html>', {
		// Without `pretendToBeVisual` jsdom has no `requestAnimationFrame`, and
		// Phaser's `TimeStep` schedules its loop through one.
		pretendToBeVisual: true,
		// Phaser 4's `TextureManager` blocks its own boot on decoding two base64
		// PNGs (`__DEFAULT` and `__MISSING`). jsdom only fires an image's `load`
		// when it is allowed to resolve `src`, and without this the game sits at
		// `isBooted` forever with no scene and no error.
		resources: 'usable',
		virtualConsole,
	});

	const target = globalThis as unknown as Record<string, unknown>;
	Object.defineProperty(target, 'window', {
		value: dom.window,
		configurable: true,
		writable: true,
	});
	Object.defineProperty(target, 'document', {
		value: dom.window.document,
		configurable: true,
		writable: true,
	});
	Object.defineProperty(target, 'navigator', {
		value: dom.window.navigator,
		configurable: true,
		writable: true,
	});

	// Phaser and AB both reach for the rest of the window surface directly
	// (`self`, `Image`, `HTMLCanvasElement`, `Event`, …). Some of those are
	// getter-only on jsdom's window, so each is installed defensively and any
	// that refuses is simply left off — the call sites that need one are all
	// DOM-rendering paths, which the headless runner does not take.
	for (const key of Object.getOwnPropertyNames(dom.window)) {
		if (key in target) {
			continue;
		}
		try {
			const value = (dom.window as Record<string, unknown>)[key];
			Object.defineProperty(target, key, {
				value: typeof value === 'function' ? value.bind(dom.window) : value,
				configurable: true,
				writable: true,
			});
		} catch {
			/* getter-only property; not needed off-browser */
		}
	}

	installed = true;
	installedWindow = dom.window;
	return true;
}

/**
 * Put back whatever `window` was before {@link ensureDomGlobals} ran.
 *
 * A no-op when this module installed nothing — under Jest, jsdom owns the global
 * and tearing it down would break the surrounding suite.
 */
export function restoreDomGlobals(): void {
	if (!installed) {
		return;
	}
	delete (globalThis as unknown as Record<string, unknown>).window;
	delete (globalThis as unknown as Record<string, unknown>).document;
	installed = false;
	installedWindow = null;
}

/** The jsdom window this module installed, or `null` if it installed none. */
export function getInstalledWindow(): unknown {
	return installedWindow;
}
