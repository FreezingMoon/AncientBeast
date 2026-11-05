import { getPhaser } from '../phaser/runtime';

/**
 * Easing functions used by Ancient Beast tweens.
 *
 * These used to be a hand-written table, because Phaser 2 CE's `Phaser.Easing`
 * namespace is gone and nothing else was available. Phaser 4 has
 * `Phaser.Math.Easing`, so the table is now deleted rather than maintained.
 *
 * `spike/easing-parity.mjs` checked the two before removing ours: for every ease
 * AB uses, the worst absolute difference across 1001 sample points was
 * 2.22e-16 — floating-point noise. So this is a pure deletion, not a behaviour
 * change.
 *
 * Three naming differences are worth remembering:
 *
 *  - Phaser 2's `Sinusoidal` is Phaser 4's `Sine`.
 *  - Phaser 4 has **no `Linear` namespace**. An untweened ease is linear, so
 *    `Linear.None` is exported here as the identity function.
 *  - Phaser 4 spells its members `In` / `Out` / `InOut`, matching what AB used.
 *
 * The lookup is lazy: `Phaser.Math.Easing` is reached through the runtime rather
 * than a static import, so a module that merely mentions `Easing` does not pull
 * the whole engine onto the startup path.
 */

export type EaseFunction = (k: number) => number;

/** The identity ease. Phaser 4 has no `Linear` namespace to point at. */
const linear: EaseFunction = (k) => k;

/** Phaser 2's `Sinusoidal`, under the name Phaser 4 gives it. */
export const Sinusoidal = 'Sine' as const;

type EasingNamespace = { In: EaseFunction; Out: EaseFunction; InOut: EaseFunction };

/** The `Linear` pseudo-namespace; Phaser 4 has no equivalent. */
type LinearNamespace = EasingNamespace & { None: EaseFunction };

/**
 * The shape callers see.
 *
 * Spelled out rather than inferred so `Easing.Quadratic.InOut` typechecks: the
 * value behind it is a `Proxy`, which types as `unknown` on every property.
 */
export interface EasingTable {
	Linear: LinearNamespace;
	Quadratic: EasingNamespace;
	Cubic: EasingNamespace;
	Quartic: EasingNamespace;
	Quintic: EasingNamespace;
	/** Phaser 2's `Sinusoidal`; Phaser 4 calls it `Sine`. */
	Sinusoidal: EasingNamespace;
	Exponential: EasingNamespace;
	Circular: EasingNamespace;
	Elastic: EasingNamespace;
	Back: EasingNamespace;
	Bounce: EasingNamespace;
}

/**
 * Phaser 4 easing namespaces that correspond one-for-one with the names AB used,
 * with `Sinusoidal` remapped to `Sine` and `Exponential` to `Expo`.
 */
const NAMESPACE_FOR: Record<Exclude<keyof EasingTable, 'Linear'>, string> = {
	Quadratic: 'Quadratic',
	Cubic: 'Cubic',
	Quartic: 'Quartic',
	Quintic: 'Quintic',
	Sinusoidal: 'Sine',
	Exponential: 'Expo',
	Circular: 'Circular',
	Elastic: 'Elastic',
	Back: 'Back',
	Bounce: 'Bounce',
};

const resolve = (): Record<string, unknown> =>
	getPhaser().Math.Easing as unknown as Record<string, unknown>;

/**
 * The easing table, in AB's shape.
 *
 * A `Proxy` rather than a built object because the values have to come from the
 * Phaser runtime, which may not be loaded when this module is first imported —
 * only when a tween actually needs an ease. Looking up a name that Phaser 4 does
 * not have throws with the list of what it does have, instead of silently
 * handing back `undefined` and failing later inside the tween manager.
 */
export const Easing: EasingTable = new Proxy({} as EasingTable, {
	get(_target, prop: string) {
		if (prop === 'Linear') {
			return { None: linear, In: linear, Out: linear, InOut: linear };
		}

		const phaserName = NAMESPACE_FOR[prop as keyof typeof NAMESPACE_FOR];
		if (!phaserName) {
			return undefined;
		}

		const easing = resolve();
		const ns = easing[phaserName] as EasingNamespace | undefined;
		if (!ns) {
			throw new Error(
				`Easing.${prop} is not a Phaser 4 easing namespace (looked for ${phaserName}). ` +
					`Phaser 4 provides: ${Object.keys(easing).join(', ')}.`,
			);
		}
		return ns;
	},
	has(_target, prop: string) {
		return prop === 'Linear' || prop in NAMESPACE_FOR;
	},
});
