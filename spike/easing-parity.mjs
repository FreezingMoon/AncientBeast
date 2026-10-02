/**
 * Throwaway: compare AB's hand-written easing table against Phaser 4's.
 *
 * Phase 5 replaces `src/utility/easing.ts` with `Phaser.Math.Easing`, which is
 * only safe if the two agree numerically for every ease AB actually uses. This
 * prints the worst absolute difference per pair so the decision is evidence-based
 * rather than a guess from the namespace names.
 *
 * Run: node spike/easing-parity.mjs
 */
import { JSDOM } from 'jsdom';

// Phaser touches `document.createElement('canvas').getContext()` at *module
// import* time, so a DOM has to exist before the import — there is no lazy path.
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
	pretendToBeVisual: true,
	resources: 'usable',
});
for (const key of Object.getOwnPropertyNames(dom.window)) {
	if (key in globalThis) continue;
	try {
		Object.defineProperty(globalThis, key, {
			configurable: true,
			get: () => dom.window[key],
		});
	} catch {
		/* some globals are getter-only on Node 22; skip what will not bind */
	}
}
Object.defineProperty(globalThis, 'navigator', {
	configurable: true,
	get: () => dom.window.navigator,
});

const Phaser = (await import('phaser')).default ?? (await import('phaser'));

/** AB's table, copied verbatim from src/utility/easing.ts. */
const linear = (k) => k;
const easeIn = (power) => (k) => Math.pow(k, power);
const easeOut = (power) => (k) => 1 - Math.pow(1 - k, power);
const easeInOut = (power) => (k) =>
	k < 0.5 ? 0.5 * Math.pow(2 * k, power) : 1 - 0.5 * Math.pow(2 - 2 * k, power);
const sinusoidalIn = (k) => 1 - Math.cos((k * Math.PI) / 2);
const sinusoidalOut = (k) => Math.sin((k * Math.PI) / 2);
const sinusoidalInOut = (k) => 0.5 * (1 - Math.cos(Math.PI * k));

const AB = {
	'Linear.None': linear,
	'Quadratic.In': easeIn(2),
	'Quadratic.Out': easeOut(2),
	'Quadratic.InOut': easeInOut(2),
	'Cubic.In': easeIn(3),
	'Cubic.Out': easeOut(3),
	'Cubic.InOut': easeInOut(3),
	'Sinusoidal.In': sinusoidalIn,
	'Sinusoidal.Out': sinusoidalOut,
	'Sinusoidal.InOut': sinusoidalInOut,
};

const PHASER = {
	'Linear.None': linear,
	'Quadratic.In': Phaser.Math.Easing.Quadratic.In,
	'Quadratic.Out': Phaser.Math.Easing.Quadratic.Out,
	'Quadratic.InOut': Phaser.Math.Easing.Quadratic.InOut,
	'Cubic.In': Phaser.Math.Easing.Cubic.In,
	'Cubic.Out': Phaser.Math.Easing.Cubic.Out,
	'Cubic.InOut': Phaser.Math.Easing.Cubic.InOut,
	'Sinusoidal.In': Phaser.Math.Easing.Sine.In,
	'Sinusoidal.Out': Phaser.Math.Easing.Sine.Out,
	'Sinusoidal.InOut': Phaser.Math.Easing.Sine.InOut,
};

let worstOverall = 0;
for (const name of Object.keys(AB)) {
	let worst = 0;
	let at = 0;
	for (let i = 0; i <= 1000; i++) {
		const k = i / 1000;
		const diff = Math.abs(AB[name](k) - PHASER[name](k));
		if (diff > worst) {
			worst = diff;
			at = k;
		}
	}
	worstOverall = Math.max(worstOverall, worst);
	console.log(
		`${name.padEnd(22)} max|AB - Phaser| = ${worst.toExponential(3)}  (at k=${at})`,
	);
}

console.log(`\nworst across all eases: ${worstOverall.toExponential(3)}`);
console.log(
	worstOverall < 1e-9
		? 'VERDICT: identical to floating-point noise — safe to swap.'
		: 'VERDICT: DIVERGENT — do not swap blindly; inspect.',
);

// Which eases exist in Phaser 4 at all, so the plan's mapping table is grounded.
const namespaces = [
	'Back',
	'Bounce',
	'Circular',
	'Cubic',
	'Elastic',
	'Expo',
	'Quadratic',
	'Quartic',
	'Quintic',
	'Sine',
];
console.log('\nPhaser 4 Easing namespaces:', namespaces.join(', '));
console.log('Phaser 4 has no Linear namespace — an untweened/default ease is linear.');