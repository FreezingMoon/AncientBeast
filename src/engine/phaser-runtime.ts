/**
 * Deferred access to the Phaser 4 runtime.
 *
 * Phaser ships a single prebuilt bundle with no tree-shaking: even a bare
 * `import { BlendModes } from 'phaser'` drags the whole engine (~360K gzip)
 * into the importing chunk. Ancient Beast boots into a pre-match screen that
 * never touches Phaser, so a static `import` from any module reachable at
 * startup would put the engine on the critical path and delay the first
 * interactive frame.
 *
 * This module is the single place allowed to hold a *runtime* (value) import
 * of Phaser, and it obtains it through `import()` so the bundler emits it as a
 * separate chunk. Everything else imports Phaser for its **types only** and
 * reads runtime values through {@link getPhaser}, which is safe because those
 * call sites only run once a match is being created (after
 * {@link loadPhaser} has resolved).
 */

/** The Phaser namespace object, as returned by the dynamic import. */
export type PhaserNamespace = typeof import('phaser');

/**
 * Phaser's `BlendModes.ADD`, as a plain constant.
 *
 * This is a stable enum member (`SKIP_CHECK = 0, NORMAL = 0, ADD = 1`), not a
 * runtime object, so it is mirrored here instead of read through
 * {@link getPhaser}. That keeps additive blending usable on the headless
 * `NullEngine` path (unit tests, the authoritative Devvit server), which never
 * loads Phaser at all.
 */
export const BLEND_MODE_ADD = 1;

/**
 * Phaser's `Scale.FIT`, as a plain constant (`ScaleModes.FIT = 3`).
 *
 * Mirrored for the same reason as {@link BLEND_MODE_ADD}: `Game.setup()` talks to
 * the `GameEngine` abstraction, whose `scaleMode` is a plain number, so reading
 * the enum off the Phaser namespace there would make the headless `NullEngine`
 * path (unit tests, authoritative Devvit server) require the engine it exists
 * to avoid.
 */
export const SCALE_MODE_FIT = 3;

let phaserPromise: Promise<PhaserNamespace> | null = null;
let phaserNamespace: PhaserNamespace | null = null;

/**
 * Load the Phaser runtime, memoised. Safe to call repeatedly and from multiple
 * places: concurrent callers share the same in-flight promise.
 */
export function loadPhaser(): Promise<PhaserNamespace> {
	if (!phaserPromise) {
		phaserPromise = import('phaser').then((mod) => {
			// Phaser is aliased to its UMD build, so a dynamic import surfaces the
			// real namespace on `default` rather than as the module namespace.
			// Normalise both shapes so callers never have to care.
			const namespace = ((mod as { default?: PhaserNamespace }).default ?? mod) as PhaserNamespace;
			phaserNamespace = namespace;
			return namespace;
		});
	}

	return phaserPromise;
}

/**
 * The already-loaded Phaser namespace.
 *
 * @throws if called before {@link loadPhaser} has resolved. Every caller is
 * reached from match setup, which awaits the runtime first, so a throw here
 * means a genuinely new call path that needs to await the loader.
 */
export function getPhaser(): PhaserNamespace {
	if (!phaserNamespace) {
		throw new Error(
			'Phaser runtime accessed before it finished loading — await loadPhaser() during match setup.',
		);
	}

	return phaserNamespace;
}

/**
 * The loaded Phaser namespace, or `null` when the engine was never loaded.
 *
 * Use this for values that only matter to the rendered game (display objects,
 * geometry, blend modes) and whose absence is harmless off-screen. The headless
 * `NullEngine` path — unit tests and the authoritative Devvit server — runs the
 * same gameplay code without Phaser, and skips work that only a real renderer
 * would consume. Reach for {@link getPhaser} instead wherever a missing value
 * would be a genuine bug.
 */
export function tryGetPhaser(): PhaserNamespace | null {
	return phaserNamespace;
}

/**
 * Warm the Phaser chunk while the player is still on the pre-match screen.
 *
 * Deferring the engine moves its download off page load; prefetching it during
 * idle puts it back before the player can press Start, so the first match does
 * not pay the cost that deferral introduced.
 */
export function prefetchPhaser(): void {
	if (phaserPromise) {
		return;
	}

	const warm = () => {
		void loadPhaser();
	};

	if (typeof window.requestIdleCallback === 'function') {
		window.requestIdleCallback(warm, { timeout: 3000 });
	} else {
		window.setTimeout(warm, 200);
	}
}
