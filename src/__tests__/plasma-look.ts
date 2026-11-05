import { describe, expect, test } from '@jest/globals';
import { jest } from '@jest/globals';

// The real Phaser bundle needs a canvas context at import time, which jsdom does
// not provide; `plasma-field` reaches it for `BlendModes`.
jest.mock('phaser', () =>
	(
		jest.requireActual('../../test/phaser-mock') as typeof import('../../test/phaser-mock')
	).createPhaserMock(),
);

import { PLASMA_LOOK, plasmaLookFor } from '../vfx/plasma/look';
import { Creature } from '../creature';

/**
 * The plasma field's line weight doubles as a read-out of how much plasma a Dark
 * Priest's player has left, and the same helper feeds both the GLSL shader and
 * the Canvas2D fallback. That makes it load-bearing for parity between the two
 * renderers, so the mapping itself is pinned here rather than only exercised
 * through the browser harness.
 */
describe('plasmaLookFor', () => {
	test('a full tank gets the reference look', () => {
		const look = plasmaLookFor(1);
		expect(look.bandWiden).toBeCloseTo(PLASMA_LOOK.bandWiden, 6);
		expect(look.bandGain).toBeCloseTo(PLASMA_LOOK.bandGain, 6);
	});

	test('an empty tank gets the thinnest look', () => {
		const look = plasmaLookFor(0);
		expect(look.bandWiden).toBeCloseTo(PLASMA_LOOK.bandWidenAtEmpty, 6);
		expect(look.bandGain).toBeCloseTo(PLASMA_LOOK.bandGainAtEmpty, 6);
	});

	test('line weight rises monotonically with plasma', () => {
		let prevWiden = -Infinity;
		let prevGain = -Infinity;
		for (const frac of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
			const look = plasmaLookFor(frac);
			expect(look.bandWiden).toBeGreaterThan(prevWiden);
			expect(look.bandGain).toBeGreaterThan(prevGain);
			prevWiden = look.bandWiden;
			prevGain = look.bandGain;
		}
	});

	test('spends plasma visibly: an empty field is much lighter than a full one', () => {
		const empty = plasmaLookFor(0);
		const full = plasmaLookFor(1);
		// Needs to be a clear read at a glance, not a subtle shift. Both weight
		// and brightness have to move for the field to be legible as a gauge.
		expect(empty.bandWiden / full.bandWiden).toBeLessThan(0.6);
		expect(empty.bandGain / full.bandGain).toBeLessThan(0.6);
	});

	test('weakens linearly, with no special-cased tail', () => {
		// Deliberately a straight ramp: every equal drop in plasma has to look
		// like an equal drop in weight. An eased curve concentrates the visible
		// change at one end of the pool, which makes the field a poor gauge for
		// the rest of the range.
		const widthStep = plasmaLookFor(0.25).bandWiden - plasmaLookFor(0).bandWiden;
		expect(plasmaLookFor(0.5).bandWiden - plasmaLookFor(0.25).bandWiden).toBeCloseTo(widthStep, 6);
		expect(plasmaLookFor(0.75).bandWiden - plasmaLookFor(0.5).bandWiden).toBeCloseTo(widthStep, 6);
		expect(plasmaLookFor(1).bandWiden - plasmaLookFor(0.75).bandWiden).toBeCloseTo(widthStep, 6);

		const gainStep = plasmaLookFor(0.25).bandGain - plasmaLookFor(0).bandGain;
		expect(plasmaLookFor(0.5).bandGain - plasmaLookFor(0.25).bandGain).toBeCloseTo(gainStep, 6);
		expect(plasmaLookFor(1).bandGain - plasmaLookFor(0.75).bandGain).toBeCloseTo(gainStep, 6);
	});

	test('a full tank reads as fat lines, matching the original field', () => {
		// The original CPU field had 1.0 *geometry* but looked considerably
		// fatter, because it also composited itself with 'lighter' and through a
		// `shadowBlur` glow that has no shader equivalent. That apparent weight is
		// folded into band width, so full plasma has to start well above the
		// original's literal 1.0 -- see PLASMA_LOOK.bandWiden.
		expect(PLASMA_LOOK.bandWiden).toBeGreaterThan(1.3);
		expect(PLASMA_LOOK.bandGain).toBeGreaterThan(1);

		// The bloom's *brightness* half is deliberately not reproduced: alpha is
		// clamped at 185/255 and matching the original's doubling would saturate
		// the crests into a flat wash.
		expect(PLASMA_LOOK.bandGain).toBeLessThan(1.4);

		// Everything the shader can reproduce is pinned to the original literals.
		expect(PLASMA_LOOK.alphaIntensity).toBe(124);
		expect(PLASMA_LOOK.alphaCore).toBe(42);
		expect(PLASMA_LOOK.auraAmount).toBe(30);
		expect(PLASMA_LOOK.auraEdgeBase).toBeCloseTo(0.18, 6);
		expect(PLASMA_LOOK.auraEdgeWeight).toBeCloseTo(0.82, 6);
		expect(PLASMA_LOOK.bandWidths).toEqual([0.078, 0.07, 0.075, 0.066]);
	});

	test('band crests reach close to white for the layered 3D read', () => {
		// The specular cap riding each band crest is what makes the field look
		// like stacked waves rather than one flat wash. Below ~0.8 the caps stay
		// tinted and the layering disappears; it must also stay below 1.0 or the
		// crests blow out to featureless white.
		expect(PLASMA_LOOK.crestWhite).toBeGreaterThan(0.85);
		expect(PLASMA_LOOK.crestWhite).toBeLessThanOrEqual(1);
	});

	test('leaves a wide enough range to read the gauge', () => {
		// The point of starting fat is that spending plasma is visible. A narrow
		// full-to-empty span would waste the range on a change nobody can see.
		const span = plasmaLookFor(1).bandWiden / plasmaLookFor(0).bandWiden;
		expect(span).toBeGreaterThan(2.5);
	});

	test('does not let the bands merge into one blob when full', () => {
		// Band centres are ~0.34 apart in normalised field units. Widening past
		// roughly half that would fuse neighbouring bands and destroy the layered
		// look, so the full-plasma width has to stay clear of it.
		const gap = 0.34;
		const sigma = PLASMA_LOOK.bandWidths[0] * 0.7 * plasmaLookFor(1).bandWiden;
		expect(sigma).toBeLessThan(gap / 2);
	});
});

/**
 * `Creature.getPlasmaFraction` is what feeds the field, so its mapping is
 * pinned here too. Prototyped rather than constructed: these cases are pure
 * arithmetic over `player.plasma` and the configured pool, and building a real
 * Creature would drag in the whole renderer for no added coverage.
 */
describe('Creature.getPlasmaFraction', () => {
	const call = (plasma: number, pool: unknown): number => {
		const c = Object.create(Creature.prototype) as {
			game: unknown;
			player: { plasma: number };
			getPlasmaFraction(): number;
		};
		c.game = pool === undefined ? {} : { plasma_amount: pool };
		c.player = { plasma };
		return c.getPlasmaFraction();
	};

	test('reports plasma as a fraction of the allocated pool', () => {
		expect(call(30, 30)).toBe(1);
		expect(call(15, 30)).toBeCloseTo(0.5, 6);
		expect(call(1, 30)).toBeCloseTo(1 / 30, 6);
	});

	test('clamps plasma that overshoots the pool', () => {
		// A mid-turn gain, or the pool changing under a running game, must not
		// push the field past its full-plasma look.
		expect(call(45, 30)).toBe(1);
		expect(call(-5, 30)).toBe(0);
	});

	test('treats an unknown or zero pool as a full tank', () => {
		// `plasma_amount` is attached from the setup form rather than declared on
		// Game, so it can genuinely be missing. A zero or absent pool must not
		// divide to NaN and blank the field on both renderers.
		expect(call(10, undefined)).toBe(1);
		expect(call(10, 0)).toBe(1);
		expect(call(10, null)).toBe(1);
		expect(call(10, Number.NaN)).toBe(1);
	});
});
