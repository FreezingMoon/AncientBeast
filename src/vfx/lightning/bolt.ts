/*
 * Ancient Beast Chain Lightning — the bolt itself.
 *
 * One `ChainLightningBolt` is one hop of the chain: a
 * bundle of zig-zag lines arcing between two points.
 * Lightning is not one thick line but several thinner
 * channels, so the bolt holds `look.lines` of them,
 * each with its own zig-zag and a slightly different
 * arch, spreading apart in the middle of the hop. Each
 * channel is stroked edge by edge into two stacked
 * canvas surfaces: a fat, soft blue line underneath and
 * a thin, bright white line burning on top of it.
 * Stroking the path (rather than stamping dots along
 * it) is what makes the strike read as squiggly
 * electricity; dots at any density read as magic dust.
 *
 * Each edge ignites when the strike head reaches it and
 * fades out over the rest of its window, so the bolt
 * darts from the caster to the target leaving a glowing
 * zig-zag behind it. Interior vertices undulate a
 * little every frame — the crackle of live current.
 * Embers, the few sparks drifting off the channels,
 * stay particles; they are spray, not the bolt.
 *
 * The constructor is pure geometry: it builds the
 * channels and the per-edge render data and nothing
 * else. `start()` materialises the surfaces and sprites
 * and runs the animation, so the chain manager can
 * construct every hop of a chain up front and fire
 * them with a stagger.
 *
 * Surfaces are reached through the same `createCanvasSurface`
 * seam the plasma field uses, so a headless or unit-test
 * run draws into buffer contexts and uploads nothing.
 */

import type { GameEngine, GroupHandle, SpriteHandle } from '../../engine/types';
import { BLEND_MODE_ADD } from '../../phaser/runtime';
import { FRAME_INTERVAL_MS, runTimedAnimation, type TimedAnimation } from '../../timing/clock';
import {
	createCanvasSurface,
	type CanvasSurface,
	type SurfaceSource,
} from '../../game-display/canvas-surface';
import {
	chainLightningLook,
	clamp,
	smoothstep01,
	unpackColor,
	type ChainLightningLook,
	type LightningPoint,
} from './look';

/**
 * A free-floating ember: one spark shed along the bolt.
 *
 * Positions are in surface space (the layer canvas's own pixels),
 * which keeps the per-frame draw a plain `drawImage` with no
 * per-particle coordinate translation.
 */
interface EmberParticle {
	x: number;
	y: number;
	/** Milliseconds into the animation at which this ember ignites. */
	igniteAt: number;
	/** Milliseconds the ember stays lit: from ignition to `lifetimeMs`. */
	window: number;
	/** Jittered radius, in surface pixels. */
	radius: number;
	/** Drift accumulated over the ember's whole life, in pixels. */
	driftX: number;
	driftY: number;
	/** Random phase of the flicker term. */
	phase: number;
}

/** Per-edge render data, built once from a channel's path. */
interface EdgeRender {
	/** Arc-length fraction of the edge's midpoint, 0..1 — the edge ignites at this fraction of `travelMs`. */
	fraction: number;
	/** Per-edge width variance, -1..1. */
	widthNoise: number;
	/** Per-edge flicker phase. */
	phase: number;
}

/**
 * One stroke pass of a layer: how much wider and dimmer than
 * the core line. Stacking a few passes of increasing width and
 * decreasing alpha turns a hard stroked line into a soft glow,
 * which is what a bolt's aura is.
 */
interface StrokePass {
	width: number;
	alpha: number;
}

/** The blue under-glow: three passes, wide and dim to narrow and bright. */
const BLUE_PASSES: StrokePass[] = [
	{ width: 2.4, alpha: 0.18 },
	{ width: 1.5, alpha: 0.38 },
	{ width: 1, alpha: 1 },
];

/** The white hot core: a slight halo around a bright line. */
const WHITE_PASSES: StrokePass[] = [
	{ width: 1.8, alpha: 0.45 },
	{ width: 1, alpha: 1 },
];

/**
 * Render data for one channel of the bolt's bundle: its own
 * zig-zag path, plus everything derived from it.
 */
interface LineRender {
	/** This channel's zig-zag path, in the caller's space. */
	path: LightningPoint[];
	/** Per-edge render data, aligned with the path's edges. */
	edges: EdgeRender[];
	/** Cumulative arc length at each path vertex. */
	cumulative: number[];
	/** Total arc length of the path. */
	total: number;
	/** Per-vertex crackle: undulation direction and phase. */
	crackle: Array<{ dx: number; dy: number; phase: number }>;
	/** Endpoint drift animation for spread channels. */
	endDrift?: {
		baseX: number;
		baseY: number;
		angle: number;
		radius: number;
		phase: number;
	};
}

export interface ChainLightningBoltOptions {
	/**
	 * Group to parent both layer sprites to.
	 *
	 * Coordinates are read in the parent's space; the game passes the
	 * board's creature group so a bolt tracks the units it connects.
	 * Without a parent the sprites land on the scene root and the
	 * coordinates are scene-absolute.
	 */
	parent?: GroupHandle;
	/** Where the layer surfaces register their textures. */
	surfaceSource?: SurfaceSource;
	/**
	 * Depth for the blue layer sprite; the white layer sits one above
	 * it. Omit to keep the sprites in insertion order (blue below
	 * white), which is the correct stack on its own.
	 */
	depth?: number;
	look?: Partial<ChainLightningLook>;
	/** Random source, injectable for deterministic tests. */
	random?: () => number;
	/** Fires when the bolt's trail has fully faded. */
	onEnd?: () => void;
}

/**
 * Build the zig-zag path of a channel.
 *
 * The straight line from start to end is divided into
 * `length / segmentLength` segments; each interior vertex is pushed off
 * the line along the path's normal by an alternating swing (the
 * zig-zag) plus a random term (the jaggedness), with the swing ramped
 * out near both endpoints so the bolt lands exactly on the units it
 * connects. A screen-space upward arc lifts the middle of long bolts.
 */
export function generateZigzagPath(
	start: LightningPoint,
	end: LightningPoint,
	look: ChainLightningLook,
	random: () => number,
): LightningPoint[] {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const length = Math.hypot(dx, dy);
	if (length < 1) {
		// A degenerate hop (two points on top of each other) still
		// deserves a bolt: a tiny vertical stub.
		return [
			{ x: start.x, y: start.y },
			{ x: start.x, y: start.y + 1 },
		];
	}

	// Unit normal: the axis the zig-zag oscillates along.
	const nx = -dy / length;
	const ny = dx / length;

	const segmentCount = Math.max(2, Math.round(length / Math.max(8, look.segmentLength)));
	const amplitude = look.zigzagAmplitude * look.segmentLength;

	const points: LightningPoint[] = [{ x: start.x, y: start.y }];
	for (let i = 1; i < segmentCount; i++) {
		const t = i / segmentCount;
		// The swing dies out towards both endpoints so the strike
		// connects to the caster and the target exactly.
		const endpointWeight = clamp(Math.min(t, 1 - t) / Math.max(0.01, look.endpointBlend), 0, 1);
		// Strict alternation is what reads as "zig-zag"; the random term
		// is what keeps it from looking like a sine wave. The two are
		// mixed by `zigzagAlternate`, so 0.75 leaves a quarter of the
		// swing — plus all of `jitter` — to chance.
		const alternate = (i % 2 === 0 ? 1 : -1) * look.zigzagAlternate;
		const randomTerm = (random() * 2 - 1) * (1 - look.zigzagAlternate + look.jitter);
		const offset = (alternate + randomTerm) * amplitude * endpointWeight;
		// Screen-space upward arc, peaking at the midpoint.
		const arcLift = look.arc * length * 4 * t * (1 - t);
		points.push({
			x: start.x + dx * t + nx * offset,
			y: start.y + dy * t + ny * offset - arcLift,
		});
	}
	points.push({ x: end.x, y: end.y });
	return points;
}

/**
 * One point of a sampled path: a position on the polyline,
 * how far along it (`t`, 0..1) and the local direction.
 */
interface PathSample {
	x: number;
	y: number;
	t: number;
	dx: number;
	dy: number;
}

/** Sample the polyline at even arc-length intervals. */
function samplePath(points: LightningPoint[], spacing: number): PathSample[] {
	const cumulative = [0];
	let total = 0;
	for (let i = 1; i < points.length; i++) {
		total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
		cumulative.push(total);
	}
	if (total < 1) {
		return [{ x: points[0].x, y: points[0].y, t: 0, dx: 1, dy: 0 }];
	}

	const count = Math.max(2, Math.ceil(total / Math.max(1, spacing)));
	const samples: PathSample[] = [];
	let segment = 1;
	for (let k = 0; k < count; k++) {
		const d = (k / (count - 1)) * total;
		while (segment < cumulative.length - 1 && cumulative[segment] < d) {
			segment++;
		}
		const segStart = cumulative[segment - 1];
		const segLength = cumulative[segment] - segStart;
		const f = segLength > 0 ? (d - segStart) / segLength : 0;
		const a = points[segment - 1];
		const b = points[segment];
		const segDx = b.x - a.x;
		const segDy = b.y - a.y;
		const segLen = Math.hypot(segDx, segDy);
		samples.push({
			x: a.x + segDx * f,
			y: a.y + segDy * f,
			t: d / total,
			dx: segLen > 0 ? segDx / segLen : 1,
			dy: segLen > 0 ? segDy / segLen : 0,
		});
	}
	return samples;
}

/**
 * Pre-rendered radial-gradient dot, one per layer.
 *
 * Used for the endpoint flashes, the strike head and the embers —
 * the round bloom spots of the effect. The channels themselves are
 * stroked directly, never stamped.
 */
function makeDotStamp(color: number, diameter: number): HTMLCanvasElement | null {
	if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
		// No DOM (pure Node): nothing can be drawn anyway, and the
		// headless surface behind the layer is a buffer.
		return null;
	}
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(2, Math.ceil(diameter));
	canvas.height = canvas.width;
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		return null;
	}
	const { r, g, b } = unpackColor(color);
	const radius = canvas.width / 2;
	const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
	gradient.addColorStop(0, `rgba(${r},${g},${b},1)`);
	gradient.addColorStop(0.3, `rgba(${r},${g},${b},0.8)`);
	gradient.addColorStop(0.6, `rgba(${r},${g},${b},0.25)`);
	gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	return canvas;
}

/**
 * One hop of the chain.
 *
 * Construct to build the channels and render data; call `start()` to
 * put it on screen; `destroy()` tears it down at any point.
 */
export class ChainLightningBolt {
	private readonly _engine: GameEngine;
	private readonly _look: ChainLightningLook;
	private readonly _random: () => number;
	private _onEnd: (() => void) | null;

	/** Where the layer sprites go, captured at construction. */
	private readonly _parent: GroupHandle | undefined;
	private readonly _surfaceSource: SurfaceSource | undefined;
	private readonly _depth: number | undefined;

	/** The bolt's channels, each with its own zig-zag. */
	private readonly _lines: LineRender[];

	/** Bounding box of the whole effect, in the caller's space. */
	private readonly _originX: number;
	private readonly _originY: number;
	private readonly _w: number;
	private readonly _h: number;

	/** The two endpoints, in surface space. */
	private readonly _start: LightningPoint;
	private readonly _end: LightningPoint;

	/** The embers shed along the bolt. */
	private readonly _embers: EmberParticle[];

	private _blue: CanvasSurface | null = null;
	private _white: CanvasSurface | null = null;
	private _blueSprite: SpriteHandle | null = null;
	private _whiteSprite: SpriteHandle | null = null;
	private _blueStamp: HTMLCanvasElement | null = null;
	private _whiteStamp: HTMLCanvasElement | null = null;
	/** Stroke colours, precomputed from the look table. */
	private _blueStyle = '';
	private _whiteStyle = '';
	private _animation: TimedAnimation | null = null;
	private _destroyed = false;

	constructor(
		engine: GameEngine,
		start: LightningPoint,
		end: LightningPoint,
		options: ChainLightningBoltOptions = {},
	) {
		this._engine = engine;
		this._look = chainLightningLook(options.look);
		this._random = options.random ?? Math.random;
		this._onEnd = options.onEnd ?? null;
		this._parent = options.parent;
		this._surfaceSource = options.surfaceSource;
		this._depth = options.depth;

		// The bolt is a bundle of `lines` channels. Each gets its
		// own zig-zag and a slightly different arch, so the channels
		// spread apart in the middle of the hop instead of tracking
		// each other — which is what a real lightning channel does.
		// Additionally, fan out the endpoints so each channel strikes
		// a different spot on the target, and let them jitter.
		const random = this._random;
		const look = this._look;
		this._lines = [];
		for (let i = 0; i < look.lines; i++) {
			// Fan out endpoint for each channel around the target
			const spreadAngle = (i / Math.max(1, look.lines - 1) - 0.5) * Math.PI * 0.8;
			const spreadRadius = look.impactFlashRadius * 1.2;
			const spreadX = Math.cos(spreadAngle) * spreadRadius * (0.5 + 0.5 * random());
			const spreadY = Math.sin(spreadAngle) * spreadRadius * (0.5 + 0.5 * random());
			const lineEnd = { x: end.x + spreadX, y: end.y + spreadY };

			// Per-channel endpoint drift animation: each endpoint wiggles independently
			const endDriftAngle = random() * Math.PI * 2;
			const endDriftRadius = spreadRadius * 0.4;

			const lineLook: ChainLightningLook = {
				...look,
				arc: look.arc * (0.7 + 0.6 * random()),
				zigzagAmplitude: look.zigzagAmplitude * (0.85 + 0.3 * random()),
			};
			const line = this._buildLine(generateZigzagPath(start, lineEnd, lineLook, random));
			// Store drift params on the line for animation
			line.endDrift = {
				baseX: lineEnd.x,
				baseY: lineEnd.y,
				angle: endDriftAngle,
				radius: endDriftRadius,
				phase: random() * Math.PI * 2,
			};
			this._lines.push(line);
		}

		// Bounding box over every channel, with room for the
		// crackle, the endpoint flashes and the ember drift, so
		// nothing is ever clipped by the layer canvas.
		const margin =
			look.impactFlashRadius +
			Math.max(look.blueRadius, look.whiteRadius) * 2 * (1 + look.radiusJitter) +
			look.drift +
			look.emberDrift +
			4;

		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const line of this._lines) {
			for (const point of line.path) {
				if (point.x < minX) minX = point.x;
				if (point.y < minY) minY = point.y;
				if (point.x > maxX) maxX = point.x;
				if (point.y > maxY) maxY = point.y;
			}
		}
		this._originX = minX - margin;
		this._originY = minY - margin;
		this._w = Math.max(2, Math.ceil(maxX - minX + margin * 2));
		this._h = Math.max(2, Math.ceil(maxY - minY + margin * 2));

		this._start = { x: start.x - this._originX, y: start.y - this._originY };
		this._end = { x: end.x - this._originX, y: end.y - this._originY };

		this._embers = this._buildEmbers();
	}

	/** The middle channel's zig-zag path, in the caller's space. */
	get path(): LightningPoint[] {
		const middle = this._lines[Math.floor(this._lines.length / 2)];
		return middle.path.map((point) => ({ ...point }));
	}

	/**
	 * One channel's render data, from its path.
	 *
	 * An edge ignites at its midpoint's arc-length fraction of
	 * `travelMs`, which is what makes the strike travel along
	 * the line instead of the whole bolt fading in at once.
	 */
	private _buildLine(path: LightningPoint[]): LineRender {
		const cumulative = [0];
		let total = 0;
		for (let i = 1; i < path.length; i++) {
			total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
			cumulative.push(total);
		}

		const random = this._random;
		const edges: EdgeRender[] = [];
		for (let i = 0; i < path.length - 1; i++) {
			edges.push({
				fraction: total > 0 ? (cumulative[i] + cumulative[i + 1]) / 2 / total : 0,
				widthNoise: random() * 2 - 1,
				phase: random() * Math.PI * 2,
			});
		}

		// Per-vertex crackle: every interior vertex undulates along
		// its own random axis, so the channel writhes like live
		// current instead of sitting still. Endpoints stay pinned —
		// the bolt has to keep touching the units it connects.
		const crackle = path.map(() => {
			const angle = random() * Math.PI * 2;
			return { dx: Math.cos(angle), dy: Math.sin(angle), phase: random() * Math.PI * 2 };
		});

		return { path, edges, cumulative, total, crackle };
	}

	/** The embers: a few sparks shed off the channels at random. */
	private _buildEmbers(): EmberParticle[] {
		const look = this._look;
		const random = this._random;
		const embers: EmberParticle[] = [];

		for (let i = 0; i < look.embers; i++) {
			// Each ember sheds off a random channel of the
			// bundle, at a random point along it.
			const line = this._lines[Math.floor(random() * this._lines.length)];
			const samples = samplePath(line.path, Math.max(2, look.emberRadius * 2));
			const t = random();
			const sample = samples[Math.min(samples.length - 1, Math.floor(t * samples.length))];
			// Perpendicular scatter around the spine, so the spray
			// drifts off the line rather than along it.
			const perp = (random() * 2 - 1) * look.emberRadius * 2;
			const along = (random() * 2 - 1) * look.emberRadius;
			const drift = look.emberDrift * (0.4 + 0.6 * random());
			const driftAngle = random() * Math.PI * 2;
			embers.push({
				x: sample.x - this._originX - sample.dy * perp + sample.dx * along,
				y: sample.y - this._originY + sample.dx * perp + sample.dy * along,
				igniteAt: t * look.travelMs + random() * 30,
				window: Math.max(1, look.lifetimeMs - t * look.travelMs),
				radius: Math.max(0.5, look.emberRadius * (1 + (random() * 2 - 1) * look.radiusJitter)),
				driftX: Math.cos(driftAngle) * drift,
				driftY: Math.sin(driftAngle) * drift - drift * 0.35,
				phase: random() * Math.PI * 2,
			});
		}
		return embers;
	}

	/** Put the bolt on screen and run its animation. */
	start(): void {
		if (this._destroyed || this._animation) {
			return;
		}
		this._materialize();
		this._animation = runTimedAnimation({
			durationMs: Math.max(1, this._look.lifetimeMs),
			intervalMs: FRAME_INTERVAL_MS,
			onFrame: (elapsedMs) => this._drawFrame(elapsedMs),
			onDone: () => this._finish(),
		});
	}

	/**
	 * Create the surfaces and sprites.
	 *
	 * Deferred from the constructor so a bolt costs nothing on screen
	 * until its hop of the chain is due to fire.
	 */
	private _materialize(): void {
		const look = this._look;

		this._blue = createCanvasSurface(this._surfaceSource, this._w, this._h);
		this._white = createCanvasSurface(this._surfaceSource, this._w, this._h);

		// The stamps are sized to the largest bloom each layer draws —
		// the endpoint flash — so a bloom never scales a stamp up
		// (which would blur it).
		this._blueStamp = makeDotStamp(
			look.blueColor,
			Math.max(look.impactFlashRadius, look.blueRadius * (1 + look.radiusJitter)) * 2,
		);
		this._whiteStamp = makeDotStamp(
			look.whiteColor,
			Math.max(look.impactFlashRadius * 0.5, look.whiteRadius * (1 + look.radiusJitter)) * 2,
		);

		const blue = unpackColor(look.blueColor);
		const white = unpackColor(look.whiteColor);
		this._blueStyle = `rgb(${blue.r},${blue.g},${blue.b})`;
		this._whiteStyle = `rgb(${white.r},${white.g},${white.b})`;

		const centerX = this._originX + this._w / 2;
		const centerY = this._originY + this._h / 2;

		// Blue first, white second: with no explicit depth the later
		// sprite draws on top, which is the layer order the effect
		// needs. With a depth, the white layer gets a fractional bump
		// so it stays above the blue one within the same band.
		this._blueSprite = this._engine.add.sprite(
			centerX,
			centerY,
			this._blue.key,
			undefined,
			this._parent,
		);
		this._blueSprite.setOrigin(0.5, 0.5);
		this._blueSprite.blendMode = BLEND_MODE_ADD;
		if (this._depth !== undefined) {
			this._blueSprite.setDepth(this._depth);
		}

		this._whiteSprite = this._engine.add.sprite(
			centerX,
			centerY,
			this._white.key,
			undefined,
			this._parent,
		);
		this._whiteSprite.setOrigin(0.5, 0.5);
		this._whiteSprite.blendMode = BLEND_MODE_ADD;
		if (this._depth !== undefined) {
			this._whiteSprite.setDepth(this._depth + 0.5);
		}
	}

	private _drawFrame(elapsedMs: number): void {
		const look = this._look;
		const blue = this._blue;
		const white = this._white;
		const blueStamp = this._blueStamp;
		const whiteStamp = this._whiteStamp;
		if (!blue || !white || !blueStamp || !whiteStamp) {
			return;
		}
		const blueCtx = blue.ctx;
		const whiteCtx = white.ctx;

		blueCtx.clearRect(0, 0, this._w, this._h);
		whiteCtx.clearRect(0, 0, this._w, this._h);
		// Everything within a layer adds together, and the layer is
		// then additively blended over the board: overlaps burn
		// brighter instead of covering each other.
		blueCtx.globalCompositeOperation = 'lighter';
		whiteCtx.globalCompositeOperation = 'lighter';

		const flickerRate = (look.flickerHz * Math.PI * 2) / 1000;

		// Crackled vertex positions: interior vertices undulate
		// around their path position, a little faster than the
		// flicker so the writhe and the shimmer read separately.
		// Also animate the spread endpoints with independent drift.
		const crackleRate = flickerRate * 1.3;
		const endDriftSpeed = 0.008;
		const lines = this._lines.map((line) => {
			const drift = line.endDrift;
			const path = line.path.map((vertex, i) => {
				if (i === 0 || look.drift <= 0) {
					return vertex;
				}
				if (i === line.path.length - 1 && drift) {
					// Animate the spread endpoint
					const driftOffset = Math.sin(elapsedMs * endDriftSpeed + drift.phase) * drift.radius;
					return {
						x: drift.baseX + Math.cos(drift.angle) * driftOffset,
						y: drift.baseY + Math.sin(drift.angle) * driftOffset,
					};
				}
				const c = line.crackle[i];
				const w = Math.sin(elapsedMs * crackleRate + c.phase) * look.drift * 0.5;
				return { x: vertex.x + c.dx * w, y: vertex.y + c.dy * w };
			});
			return { line, pts: path };
		});

		// The bolt: every channel stroked edge by edge into
		// each layer, each edge igniting as the strike head
		// reaches it and fading out over the rest of its window.
		for (const { line, pts } of lines) {
			this._strokeLayer(
				blueCtx,
				this._blueStyle,
				look.blueRadius,
				look.blueAlpha,
				BLUE_PASSES,
				line,
				pts,
				elapsedMs,
				flickerRate,
			);
			this._strokeLayer(
				whiteCtx,
				this._whiteStyle,
				look.whiteRadius,
				look.whiteAlpha,
				WHITE_PASSES,
				line,
				pts,
				elapsedMs,
				flickerRate,
			);
		}

		// The strike head: a bright bloom at the front of every
		// channel while it is still travelling, which is what
		// makes the strike read as darting down the chain.
		const headFraction = clamp(elapsedMs / Math.max(1, look.travelMs), 0, 1);
		if (headFraction < 1) {
			const headAlpha = smoothstep01(elapsedMs, look.fadeInMs) * (1 - headFraction * 0.25);
			const headRadius = look.impactFlashRadius * 0.45;
			const coreRadius = headRadius * 0.5;
			for (const { line } of lines) {
				const head = this._pointAtFraction(line, headFraction);
				blueCtx.globalAlpha = Math.min(1, headAlpha * look.blueAlpha);
				blueCtx.drawImage(
					blueStamp,
					head.x - headRadius,
					head.y - headRadius,
					headRadius * 2,
					headRadius * 2,
				);
				whiteCtx.globalAlpha = Math.min(1, headAlpha * look.whiteAlpha);
				whiteCtx.drawImage(
					whiteStamp,
					head.x - coreRadius,
					head.y - coreRadius,
					coreRadius * 2,
					coreRadius * 2,
				);
			}
		}

		// Embers: the fine spray drifting off the bolt.
		for (const ember of this._embers) {
			const age = elapsedMs - ember.igniteAt;
			if (age < 0) {
				continue;
			}
			const fade = age / ember.window;
			if (fade >= 1) {
				continue;
			}
			const alpha =
				smoothstep01(age, look.fadeInMs) *
				Math.pow(1 - fade, 1.6) *
				(1 - look.flicker * 0.5 * (1 - Math.sin(age * flickerRate + ember.phase)));
			if (alpha < 0.004) {
				continue;
			}

			const drift = fade;
			const px = ember.x + ember.driftX * drift;
			const py = ember.y + ember.driftY * drift;

			blueCtx.globalAlpha = alpha * look.blueAlpha;
			blueCtx.drawImage(
				blueStamp,
				px - ember.radius,
				py - ember.radius,
				ember.radius * 2,
				ember.radius * 2,
			);
			whiteCtx.globalAlpha = alpha * look.whiteAlpha;
			whiteCtx.drawImage(
				whiteStamp,
				px - ember.radius,
				py - ember.radius,
				ember.radius * 2,
				ember.radius * 2,
			);
		}

		// Endpoint flashes: a brief bloom where the strike takes
		// off and where it lands. Each blooms when the head is
		// actually there — at takeoff for the caster, on arrival
		// for the target — so nothing lights up at a target
		// before the bolt has reached it.
		// Start flash at caster
		for (const endpoint of [{ point: this._start, igniteAt: 0 }]) {
			const age = elapsedMs - endpoint.igniteAt;
			if (age < 0) {
				continue;
			}
			const flashFade = clamp(age / look.impactFlashMs, 0, 1);
			if (flashFade >= 1) {
				continue;
			}
			const flashAlpha = (1 - flashFade) * (1 - flashFade);
			const grow = 0.55 + 0.45 * flashFade;
			const radius = look.impactFlashRadius * grow;
			const coreRadius = radius * 0.5;
			blueCtx.globalAlpha = Math.min(1, flashAlpha * look.blueAlpha * 1.6);
			blueCtx.drawImage(
				blueStamp,
				endpoint.point.x - radius,
				endpoint.point.y - radius,
				radius * 2,
				radius * 2,
			);
			whiteCtx.globalAlpha = Math.min(1, flashAlpha * look.whiteAlpha * 1.2);
			whiteCtx.drawImage(
				whiteStamp,
				endpoint.point.x - coreRadius,
				endpoint.point.y - coreRadius,
				coreRadius * 2,
				coreRadius * 2,
			);
		}
		// Target flashes: one per channel at its animated spread endpoint
		for (const line of this._lines) {
			const drift = line.endDrift;
			if (!drift) continue;
			// Animate endpoint drift
			const driftSpeed = 0.008;
			const driftOffset = Math.sin(elapsedMs * driftSpeed + drift.phase) * drift.radius;
			const animatedX = drift.baseX + Math.cos(drift.angle) * driftOffset;
			const animatedY = drift.baseY + Math.sin(drift.angle) * driftOffset;
			const surfaceEnd = { x: animatedX - this._originX, y: animatedY - this._originY };
			const age = elapsedMs - look.travelMs;
			if (age < 0) {
				continue;
			}
			const flashFade = clamp(age / look.impactFlashMs, 0, 1);
			if (flashFade >= 1) {
				continue;
			}
			const flashAlpha = (1 - flashFade) * (1 - flashFade);
			const grow = 0.55 + 0.45 * flashFade;
			const radius = look.impactFlashRadius * grow * 0.7;
			const coreRadius = radius * 0.5;
			blueCtx.globalAlpha = Math.min(1, flashAlpha * look.blueAlpha * 1.2);
			blueCtx.drawImage(
				blueStamp,
				surfaceEnd.x - radius,
				surfaceEnd.y - radius,
				radius * 2,
				radius * 2,
			);
			whiteCtx.globalAlpha = Math.min(1, flashAlpha * look.whiteAlpha * 1.2);
			whiteCtx.drawImage(
				whiteStamp,
				surfaceEnd.x - coreRadius,
				surfaceEnd.y - coreRadius,
				coreRadius * 2,
				coreRadius * 2,
			);
		}

		blueCtx.globalAlpha = 1;
		whiteCtx.globalAlpha = 1;
		blueCtx.globalCompositeOperation = 'source-over';
		whiteCtx.globalCompositeOperation = 'source-over';

		blue.commit();
		white.commit();
	}

	/**
	 * Stroke one channel into one layer, pass by pass.
	 *
	 * Each edge is its own stroke so its alpha can follow its own
	 * ignite-and-fade envelope. Joints are bevelled rather than
	 * rounded: a round join bulges out at the zig-zag's acute
	 * angles and reads as a dot at every kink, while a bevelled
	 * joint stays as wide as the line itself.
	 */
	private _strokeLayer(
		ctx: CanvasRenderingContext2D,
		style: string,
		halfWidth: number,
		layerAlpha: number,
		passes: StrokePass[],
		line: LineRender,
		pts: LightningPoint[],
		elapsedMs: number,
		flickerRate: number,
	): void {
		const look = this._look;
		ctx.strokeStyle = style;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'bevel';

		for (const pass of passes) {
			for (let i = 0; i < line.edges.length; i++) {
				const edge = line.edges[i];
				const igniteAt = edge.fraction * look.travelMs;
				const age = elapsedMs - igniteAt;
				if (age < 0) {
					continue; // the strike has not reached this edge yet
				}
				const window = Math.max(1, look.lifetimeMs - igniteAt);
				if (age >= window) {
					continue; // dead
				}
				const alpha =
					smoothstep01(age, look.fadeInMs) *
					Math.pow(1 - age / window, 1.6) *
					(1 - look.flicker * 0.5 * (1 - Math.sin(age * flickerRate + edge.phase)));
				if (alpha < 0.004) {
					continue;
				}

				const width =
					Math.max(0.5, halfWidth * 2 * (1 + edge.widthNoise * look.radiusJitter)) * pass.width;
				ctx.globalAlpha = Math.min(1, alpha * layerAlpha * pass.alpha);
				ctx.lineWidth = width;
				ctx.beginPath();
				ctx.moveTo(pts[i].x - this._originX, pts[i].y - this._originY);
				ctx.lineTo(pts[i + 1].x - this._originX, pts[i + 1].y - this._originY);
				ctx.stroke();
			}
		}
	}

	/** The point at an arc-length fraction of a channel, in surface space. */
	private _pointAtFraction(line: LineRender, fraction: number): LightningPoint {
		const target = fraction * line.total;
		let i = 1;
		while (i < line.cumulative.length - 1 && line.cumulative[i] < target) {
			i++;
		}
		const segLength = line.cumulative[i] - line.cumulative[i - 1];
		const f = segLength > 0 ? (target - line.cumulative[i - 1]) / segLength : 0;
		const a = line.path[i - 1];
		const b = line.path[i];
		return {
			x: a.x + (b.x - a.x) * f - this._originX,
			y: a.y + (b.y - a.y) * f - this._originY,
		};
	}

	/**
	 * The animation ran out: tear down and notify.
	 *
	 * `onEnd` is cleared before it runs — a caller that destroys the
	 * bolt from inside its own `onEnd` must not double-fire it.
	 */
	private _finish(): void {
		if (this._destroyed) {
			return;
		}
		const onEnd = this._onEnd;
		this._onEnd = null;
		this._teardown();
		onEnd?.();
	}

	/** Tear down without firing `onEnd` — the caller owns the chain now. */
	destroy(): void {
		if (this._destroyed) {
			return;
		}
		this._teardown();
	}

	private _teardown(): void {
		this._destroyed = true;
		this._animation?.cancel();
		this._animation = null;
		this._blueSprite?.destroy();
		this._whiteSprite?.destroy();
		this._blueSprite = null;
		this._whiteSprite = null;
		this._blue?.destroy();
		this._white?.destroy();
		this._blue = null;
		this._white = null;
		this._blueStamp = null;
		this._whiteStamp = null;
	}
}
