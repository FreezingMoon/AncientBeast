/*
 * Ancient Beast Plasma Field — shared look constants.
 *
 * The field is rendered two ways: a GLSL shader (`plasma-shader.ts`) on WebGL,
 * and a per-pixel Canvas2D loop (`plasma-field.ts`) on the CANVAS renderer and
 * in headless tests. Both must produce the *same image* — a player should not be
 * able to tell which renderer their machine picked.
 *
 * Every number that affects the look therefore lives here and is interpolated
 * into the shader source, instead of being typed into both implementations. A
 * value edited here changes the GPU and the CPU together, which is the only way
 * to keep them from drifting apart.
 *
 * The full-plasma values reproduce the original pre-shader Canvas2D field. When
 * the shader replaced that loop it was easy to quietly re-tune the constants
 * until the field stopped resembling what shipped, so they are pinned to the
 * originals deliberately: at full plasma the field should look the way it always
 * did. See `bandWiden` for the one thing that cannot be reproduced.
 */

/** Formatting helper: emits a JS/GLSL float literal with no locale surprises. */
const f = (n: number): string => (Number.isInteger(n) ? `${n}.0` : `${n}`);

export const PLASMA_LOOK = {
	/**
	 * Multiplier on every band's Gaussian width at full plasma.
	 *
	 * This is the knob that controls how thick the lines read as. The bands sit
	 * ~0.3-0.35 apart in normalised field units, so widening can grow a long way
	 * before adjacent bands merge into one blob.
	 *
	 * 1.0 is the original CPU field's geometry exactly: the original multiplied
	 * the band widths by `thickness` alone, with no extra factor.
	 *
	 * The original *geometry* was 1.0 (it multiplied the band widths by
	 * `thickness` alone), but the original did not *look* like 1.0: it also drew
	 * the bitmap onto itself with `globalCompositeOperation = 'lighter'` plus a
	 * blurred coloured shadow, which roughly doubled the apparent weight of
	 * every band and bloomed past its edges. That is a Canvas2D `shadowBlur`
	 * effect with no fragment-shader equivalent, so the weight it contributed is
	 * folded in here as extra band width.
	 *
	 * The bloom's brightness half is deliberately *not* compensated. Alpha is
	 * clamped at 185/255, so matching the original's doubled brightness would
	 * just saturate the crests into a flat, milky wash; widening the bands gets
	 * the same "phat lines" read without that failure mode.
	 *
	 * The bands sit ~0.34 apart, so there is room to widen well past the
	 * original before neighbouring bands merge into a single blob.
	 */
	bandWiden: 2.2,

	/**
	 * Band widening at zero plasma.
	 *
	 * Not 0: a zero-width band vanishes entirely, and a priest holding their last
	 * plasma point would look as though they had no shield at all. Half weight
	 * still reads clearly as "nearly spent".
	 */
	bandWidenAtEmpty: 0.4,

	/**
	 * Multiplier on the band alpha term (the bright crests) at full plasma.
	 *
	 * Distinct from `bandWiden`: this changes how *bright* the lines are rather
	 * than how wide. Kept separate because ADD blending means crest brightness
	 * directly reduces contrast for anything behind the field, so it wants
	 * tuning against legibility rather than against line weight.
	 *
	 * Slightly above 1.0 for a bit more presence in the crests at full plasma,
	 * but nowhere near the original's effective doubling -- see `bandWiden` for
	 * why that is not reproduced.
	 */
	bandGain: 1.2,

	/** Band alpha multiplier at zero plasma. */
	bandGainAtEmpty: 0.55,

	/**
	 * Base Gaussian widths of the four bands, in normalised field units, before
	 * `bandWiden` and the per-field `thickness` option are applied.
	 */
	bandWidths: [0.078, 0.07, 0.075, 0.066],

	/** Alpha contributed per unit of band intensity. */
	alphaIntensity: 124,
	/** Alpha contributed per unit of core (crest) intensity. */
	alphaCore: 42,

	/**
	 * Lower bound of the anti-aliased onset ramp.
	 *
	 * The original CPU version used a hard `if (intensity > 0.038)` cutoff, which
	 * produced a jagged, aliased silhouette on the leading edge of the bands.
	 * Smoothing between these two bounds removes it. This is the one intentional
	 * deviation from the original look: a rendering fix, not a restyle.
	 */
	onsetLow: 0.02,
	onsetHigh: 0.075,

	/**
	 * Alpha contributed by the rim aura, and how its weight is split between the
	 * field interior and its silhouette.
	 *
	 * The aura is a glow along the inside of the edge, not a fill. Both values are
	 * the original CPU field's; an unweighted or much stronger aura spreads a
	 * milky film across the whole shield and hides the board behind it.
	 */
	auraAmount: 30,
	auraEdgeBase: 0.18,
	auraEdgeWeight: 0.82,

	/**
	 * How far the brightest part of each band is mixed toward white.
	 *
	 * This is what gives the field its layered, 3D-wave read: a specular cap
	 * riding the crest of every band, sitting above a saturated body. Lower
	 * values leave the crests tinted and the whole field reads as one flat wash.
	 *
	 * Applied *after* the hue rotation, so the cap stays white for every player
	 * colour. Rotating the crest as well flattened every field into a single
	 * tint, which is the opposite of the layered look.
	 */
	crestWhite: 0.92,
} as const;

/**
 * Per-field band weight for a given plasma level.
 *
 * The field is the only persistent, always-visible read-out a Dark Priest has of
 * how much plasma its player has left, so its line weight tracks the resource: a
 * fat, bright field means a well-stocked player, a thin wispy one means nearly
 * spent. This doubles the existing plasma pill on the creature sprite, which is
 * small and easy to miss while reading the board.
 *
 * `fraction` is plasma remaining / plasma allocated, so 1 is full and 0 empty.
 * The ramp is linear: the field weakens steadily as plasma is spent, with no
 * special-casing of the tail.
 *
 * Deliberately returns a plain pair rather than being baked into a uniform or a
 * global: both renderers call this with the same input on the same tick, which
 * is what keeps the shader and the Canvas2D fallback pixel-identical.
 */
export function plasmaLookFor(fraction: number): { bandWiden: number; bandGain: number } {
	const t = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 1));
	return {
		bandWiden:
			PLASMA_LOOK.bandWidenAtEmpty + (PLASMA_LOOK.bandWiden - PLASMA_LOOK.bandWidenAtEmpty) * t,
		bandGain:
			PLASMA_LOOK.bandGainAtEmpty + (PLASMA_LOOK.bandGain - PLASMA_LOOK.bandGainAtEmpty) * t,
	};
}

/**
 * GLSL const block injected at the top of the fragment shader.
 *
 * Only values that are genuinely fixed for every field live here. The band
 * weight is *not* among them -- it varies per field with the owner's remaining
 * plasma, so it arrives as `uBandWiden` / `uBandGain`, which `plasmaLookFor()`
 * fills in for both renderers.
 */
export const PLASMA_LOOK_GLSL = `
const float BAND_W0 = ${f(PLASMA_LOOK.bandWidths[0])};
const float BAND_W1 = ${f(PLASMA_LOOK.bandWidths[1])};
const float BAND_W2 = ${f(PLASMA_LOOK.bandWidths[2])};
const float BAND_W3 = ${f(PLASMA_LOOK.bandWidths[3])};
const float ALPHA_INTENSITY = ${f(PLASMA_LOOK.alphaIntensity)};
const float ALPHA_CORE = ${f(PLASMA_LOOK.alphaCore)};
const float AURA_AMOUNT = ${f(PLASMA_LOOK.auraAmount)};
const float AURA_EDGE_BASE = ${f(PLASMA_LOOK.auraEdgeBase)};
const float AURA_EDGE_WEIGHT = ${f(PLASMA_LOOK.auraEdgeWeight)};
const float ONSET_LOW = ${f(PLASMA_LOOK.onsetLow)};
const float ONSET_HIGH = ${f(PLASMA_LOOK.onsetHigh)};
const float CREST_WHITE = ${f(PLASMA_LOOK.crestWhite)};
`;
