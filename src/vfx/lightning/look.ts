/*
 * Ancient Beast Chain Lightning — shared look constants.
 *
 * The effect (Impaler's fourth ability) is a two-layer
 * zig-zag line: a squiggly bolt arcs between two points, a
 * fat soft blue line underneath and a thin bright white line
 * burning on top of it. The strike head travels from the
 * caster to the target over `travelMs`, and every part of the
 * line it passes lingers for the rest of `lifetimeMs` and
 * then dies — so a long chain reads as a bolt darting from
 * unit to unit, leaving glowing zig-zags behind it.
 *
 * Every number that affects the look lives here, in one table,
 * for two reasons: the game and the tuning harness
 * (`/demos/lightning-visual.html`) must fire the same bolt, and a
 * value edited here changes both at once. The harness exposes
 * this table as sliders, which is how the look is meant to be
 * tuned — edit there, or edit here, never in the renderer.
 */

/** A point in whatever coordinate space the effect was spawned in. */
export interface LightningPoint {
	x: number;
	y: number;
}

export interface ChainLightningLook {
	// ─── Path geometry ────────────────────────────────────────────

	/**
	 * Distance between zig-zag vertices, in pixels.
	 *
	 * The vertex count is derived from the bolt length, so a short hop
	 * gets two or three kinks and a long arch gets a dozen, at a
	 * constant kink density. Smaller values mean more vertices and a
	 * busier bolt; larger values mean sweeping arcs.
	 */
	segmentLength: number;

	/**
	 * How far each vertex swings off the straight line, as a fraction
	 * of `segmentLength`.
	 *
	 * 0.5 reads as a lively but controlled arc; past ~1 the bolt starts
	 * doubling back on itself.
	 */
	zigzagAmplitude: number;

	/**
	 * How strictly the vertex offsets alternate sign, 0..1.
	 *
	 * 1 is a perfect saw-tooth — the "zig-zag" in chain lightning.
	 * 0 is pure noise, which reads as a heat shimmer. The default
	 * leaves a quarter of the swing to randomness so the bolt is
	 * jagged without being a sine wave.
	 */
	zigzagAlternate: number;

	/**
	 * Extra random vertex jitter, as a fraction of `segmentLength`, on
	 * top of the alternating swing.
	 */
	jitter: number;

	/**
	 * Upward arc of the whole bolt, as a fraction of its length.
	 *
	 * Lightning arches, it does not stretch flat; the lift is applied
	 * in screen space so a horizontal bolt rises in the middle the way
	 * a thrown bolt would. 0 keeps the path dead straight.
	 */
	arc: number;

	/**
	 * Fraction of the path over which the zig-zag ramps in and out,
	 * measured from each endpoint.
	 *
	 * The bolt has to land exactly on the caster and the target — a
	 * full-size kink at either end would detach the bolt from the units
	 * it connects. 0.15 means the swing reaches full strength a quarter
	 * of the way in from each end.
	 */
	endpointBlend: number;

	/**
	 * How many parallel channels make up one bolt.
	 *
	 * Lightning is not one thick line but a bundle of
	 * thinner channels, each with its own zig-zag and a
	 * slightly different arch, spreading apart in the
	 * middle of the hop. 1 draws a single line.
	 */
	lines: number;

	// ─── Line ───────────────────────────────────────────────

	/**
	 * Per-channel width variance, as a fraction of the
	 * channel's half-width.
	 *
	 * A line of perfectly even width reads as a drawn rule; a
	 * little variance per channel is what makes it look like
	 * plasma.
	 */
	radiusJitter: number;

	/** Blue channel line half-width, in pixels. The soft under-glow. */
	blueRadius: number;

	/** Blue channel peak opacity, 0..1. */
	blueAlpha: number;

	/** White channel line half-width, in pixels. The hot core. */
	whiteRadius: number;

	/** White layer peak opacity, 0..1. */
	whiteAlpha: number;

	/** How hard each segment flickers, 0..1. */
	flicker: number;

	/** Flicker rate, in cycles per second. */
	flickerHz: number;

	/**
	 * Per-frame crackle amplitude, in pixels.
	 *
	 * Every interior vertex of the line undulates by up to
	 * half this, on its own axis and phase, which is what
	 * makes the bolt writhe like live current instead of
	 * sitting still. 0 pins the path.
	 */
	drift: number;

	/** Free-floating sparks shed per bolt, on top of the line. */
	embers: number;

	/** Ember radius, in pixels. Embers are the small fast-fading bits. */
	emberRadius: number;

	/** Ember drift over their (short) life, in pixels. */
	emberDrift: number;

	// ─── Timing ───────────────────────────────────────────────────

	/** How long the strike head takes to arc from start to end, in ms. */
	travelMs: number;

	/**
	 * Total animation duration, in ms — the oldest part of the
	 * line dies exactly at this instant.
	 *
	 * Each segment lives from its own ignition to `lifetimeMs`,
	 * so the head of the bolt lingers longest and the tail dies
	 * soonest. That asymmetry is the "strike travels, trail is
	 * left behind" read.
	 */
	lifetimeMs: number;

	/** Ignition ramp per segment, in ms. */
	fadeInMs: number;

	/** Duration of the bright flash at both endpoints, in ms. */
	impactFlashMs: number;

	/** Peak radius of the endpoint flash, in pixels. */
	impactFlashRadius: number;

	// ─── Colour ───────────────────────────────────────────────────

	/** Blue layer colour. Saturated azure reads as electricity. */
	blueColor: number;

	/** White layer colour. */
	whiteColor: number;
}

/**
 * The reference look.
 *
 * These are first-draft values, not final ones — the whole point of the
 * harness is to tune them against the board. They were chosen to be
 * clearly visible over a dark board under additive blending: several
 * thin channels carrying a bright core, a fine squiggle so the bolt
 * reads as a jagged line, and a fast strike with a short afterglow
 * so a full chain resolves inside a second.
 */
export const CHAIN_LIGHTNING_LOOK: ChainLightningLook = {
	segmentLength: 32,
	zigzagAmplitude: 0.55,
	zigzagAlternate: 0.75,
	jitter: 0.35,
	arc: 0.1,
	endpointBlend: 0.15,

	lines: 3,

	radiusJitter: 0.45,
	blueRadius: 4.5,
	blueAlpha: 0.5,
	whiteRadius: 1.8,
	whiteAlpha: 0.95,
	flicker: 0.55,
	flickerHz: 9,
	drift: 9,
	embers: 6,
	emberRadius: 2.1,
	emberDrift: 30,

	travelMs: 130,
	lifetimeMs: 420,
	fadeInMs: 24,
	impactFlashMs: 170,
	impactFlashRadius: 26,

	blueColor: 0x3f8cff,
	whiteColor: 0xffffff,
};

/**
 * Merge caller overrides onto the reference look.
 *
 * Partial by design: a caller (an ability, a test, the harness) states
 * only the values it cares about and inherits the rest, so a tuning
 * slider never has to supply the whole table.
 */
export function chainLightningLook(overrides?: Partial<ChainLightningLook>): ChainLightningLook {
	return overrides ? { ...CHAIN_LIGHTNING_LOOK, ...overrides } : { ...CHAIN_LIGHTNING_LOOK };
}

/** Clamp to [lo, hi]. */
export function clamp(value: number, lo: number, hi: number): number {
	return value < lo ? lo : value > hi ? hi : value;
}

/** Unpack a 0xRRGGBB colour into channels for canvas gradients. */
export function unpackColor(color: number): { r: number; g: number; b: number } {
	return {
		r: (color >> 16) & 0xff,
		g: (color >> 8) & 0xff,
		b: color & 0xff,
	};
}

/**
 * Smooth 0..1 ramp over [0, edge], the standard ease for ignitions.
 *
 * A linear ramp makes a segment pop; a cubic one makes it bloom.
 */
export function smoothstep01(age: number, edge: number): number {
	const t = clamp(age / Math.max(0.001, edge), 0, 1);
	return t * t * (3 - 2 * t);
}
