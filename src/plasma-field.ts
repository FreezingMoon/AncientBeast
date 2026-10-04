/*
 * Ancient Beast Plasma Field effect (Dark Priest shield).
 *
 * Procedural Phaser CE egg-surface plasma shader, ported from the standalone
 * `ancient_beast_plasma_field_v52_blockspeed_default_060_demo` demo. It is shown
 * around non-active Dark Priests (human or bot) that still have plasma points,
 * visualising the Plasma Field passive ability.
 *
 * The effect renders into a canvas surface and is attached as a sprite child of
 * the creature's group so it tracks the Dark Priest automatically. A
 * short-lived burst flash is triggered whenever the shield counters an attack.
 */

import { PLASMA_LOOK, plasmaLookFor } from './plasma-look';
import type { Creature } from './creature';
import type { GameEngine, SpriteHandle, GroupHandle, ShaderHandle } from './engine/types';
import { BLEND_MODE_ADD } from './phaser/runtime';
import { PLASMA_FRAGMENT_SOURCE } from './plasma-shader';
import { every } from './timing/clock';
import {
	createCanvasSurface,
	type CanvasSurface,
	type SurfaceSource,
} from './game-display/canvas-surface';
import type { Timer } from './timing/clock';

export interface PlasmaFieldSettings {
	transparency: number;
	skin: number;
	wrap3d: number;
	density: number;
	thickness: number;
	flowSpeed: number;
	contrast: number;
	backSurface: number;
	blockPower: number;
	blockSpeed: number;
	bottomFade: number;
	bottomFadeCurve: number;
	blockOutline: number;
	scaleX: number;
	scaleY: number;
	hueShift: number;
}

export interface PlasmaFieldOptions extends Partial<PlasmaFieldSettings> {
	width?: number;
	height?: number;
	radiusX?: number;
	radiusY?: number;
	alpha?: number;
	fps?: number;
	renderScale?: number;
	staticMode?: boolean;
	parent?: GroupHandle;
	creature?: Creature;
	/**
	 * Where the shield's drawing surface is registered.
	 *
	 * The field is a visual component with no gameplay knowledge, and it reaches
	 * Phaser only for this one texture. Supplying it explicitly keeps that the
	 * case: without a source the field still draws, onto a context with nothing
	 * behind it, which is what the headless runner wants.
	 */
	surfaceSource?: SurfaceSource;
}

const WEAK_CORE_THRESHOLD = 4;
const VERY_WEAK_CORE_THRESHOLD = 2;

export function detectWeakHardware(): boolean {
	try {
		if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
			return navigator.hardwareConcurrency <= WEAK_CORE_THRESHOLD;
		}
	} catch {
		// navigator may be unavailable in some environments.
	}
	return false;
}

export function detectVeryWeakHardware(): boolean {
	try {
		if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
			return navigator.hardwareConcurrency <= VERY_WEAK_CORE_THRESHOLD;
		}
	} catch {
		// navigator may be unavailable in some environments.
	}
	return false;
}

const LOGICAL_GAME_WIDTH = 1920;

export function computePlasmaRenderScale(): number {
	try {
		if (typeof window !== 'undefined') {
			const displayWidth = window.innerWidth || 0;
			const ratio = displayWidth / LOGICAL_GAME_WIDTH;
			// A floor only. This used to hard-code a quality drop on narrow
			// windows — but `renderScale` is the plasma's real pixel density, so
			// guessing wrong makes the shield visibly blocky (scale 2 renders a
			// 96x128 grid upscaled to 192x256, which the sprite then scales 1.25x
			// again). Actual cost is now governed at runtime by the frame-budget
			// governor in `_tickAllFields`, which measures real draw time instead
			// of guessing from window width.
			if (ratio < 0.4) return 2;
		}
	} catch {
		// window may be unavailable.
	}
	return 1;
}

export function refreshPlasmaRenderScales(): void {
	const scale = computePlasmaRenderScale();
	_adaptiveRenderScale = scale;
	_adaptiveOverBudgetStreak = 0;
	for (const field of _activeFields) {
		field.updateRenderScale(scale);
	}
}

const DEFAULT_SETTINGS: PlasmaFieldSettings = {
	transparency: 1.0,
	skin: 1.11,
	wrap3d: 0.65,
	density: 0.65,
	thickness: 0.7,
	flowSpeed: 0.25,
	contrast: 1.03,
	backSurface: 0.6,
	blockPower: 1.0,
	blockSpeed: 0.6,
	bottomFade: 0.11,
	bottomFadeCurve: 1.0,
	blockOutline: 1.6,
	scaleX: 1.25,
	scaleY: 1.4,
	hueShift: 0.0,
};

function clamp(v: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, v));
}

function sin(v: number): number {
	return Math.sin(v);
}

function exp(v: number): number {
	return Math.exp(v);
}

function pow(v: number, p: number): number {
	return Math.pow(v, p);
}

function smoothstep(a: number, b: number, x: number): number {
	x = clamp((x - a) / (b - a), 0, 1);
	return x * x * (3 - 2 * x);
}

function hueRotateRgb(
	r: number,
	g: number,
	b: number,
	degrees: number,
): { r: number; g: number; b: number } {
	if (!degrees) return { r: r, g: g, b: b };

	const a = (degrees * Math.PI) / 180;
	const c = Math.cos(a);
	const s = Math.sin(a);

	// Luminance-preserving hue rotation matrix.
	return {
		r:
			(0.213 + c * 0.787 - s * 0.213) * r +
			(0.715 - c * 0.715 - s * 0.715) * g +
			(0.072 - c * 0.072 + s * 0.928) * b,
		g:
			(0.213 - c * 0.213 + s * 0.143) * r +
			(0.715 + c * 0.285 + s * 0.14) * g +
			(0.072 - c * 0.072 - s * 0.283) * b,
		b:
			(0.213 - c * 0.213 - s * 0.787) * r +
			(0.715 - c * 0.715 + s * 0.715) * g +
			(0.072 + c * 0.928 + s * 0.072) * b,
	};
}

// ─── Shared animation ticker ─────────────────────────────────────────────────
// All Plasma Fields share a single Phaser timer so the cost of animating
// several shields at once (e.g. a 2v2 where each side hovers the active
// Dark Priest) stays bounded instead of multiplying per-field timers.
let _sharedTimer: Timer | null = null;
let _sharedEngine: GameEngine | null = null;
const _activeFields = new Set<PlasmaField>();

// Fixed cadence for the shared ticker. We never mutate a running TimerEvent's
// `delay` (which does not reset the elapsed accumulator and causes an
// immediately-fired, skipped frame). Instead the ticker runs at a steady rate
// and each field self-throttles its own draw cadence below.
const SHARED_TICK_FPS = 24;

// ─── Frame-budget quality governor ───────────────────────────────────────────
// The per-pixel loop is by far the most expensive thing this effect does, and
// its cost depends on how many fields are on screen at once (2 in a 1v1, 4 in a
// 2v2) and on how fast the machine actually is. Neither is knowable up front
// from the window size, so instead of guessing a fixed tier and being wrong
// (visibly blocky shields on capable machines, or a slideshow on weak ones)
// the ticker measures its own real cost and trades resolution for smoothness
// only when the frame budget is genuinely being missed.
//
// Each step is roughly a 4x cut in grid area:
//   1 -> 192x256 (~15ms/field)  2 -> 96x128 (~4ms)  3 -> 64x85 (~1.8ms)  4 -> 48x64 (~1ms)
const MAX_RENDER_SCALE = 4;

/**
 * Animation speed multiplier applied to the shared tick rate.
 *
 * Below 1.0 slows the surface drift. Both renderers advance from `this.time`, so
 * this scales the shader and the Canvas2D fallback together.
 */
const PLASMA_ANIMATION_SPEED = 0.9;

/** Ceiling for plasma's own per-tick work, in ms. Leaves room for the rest of the frame. */
const PLASMA_BUDGET_MS = 6;

/** Consecutive over-budget ticks required before dropping quality. Avoids reacting to one hitch. */
const DOWNGRADE_STREAK = 8;

/** Consecutive comfortably-under-budget ticks required before restoring quality. */
const UPGRADE_STREAK = 90;

let _adaptiveRenderScale = 1;
let _adaptiveOverBudgetStreak = 0;
let _adaptiveUnderBudgetStreak = 0;

function _applyAdaptiveScale(scale: number): void {
	if (scale === _adaptiveRenderScale) return;
	_adaptiveRenderScale = scale;
	for (const field of _activeFields) {
		field.updateRenderScale(scale);
	}
}

/**
 * Feed one tick's measured duration into the governor.
 *
 * Hysteresis is deliberately asymmetric: downgrade quickly (8 slow ticks),
 * upgrade slowly (90 fast ones). Without that, a machine sitting near the
 * threshold oscillates between two quality levels and the shield visibly
 * pulses between sharp and soft.
 */
function _governQuality(elapsedMs: number): void {
	if (elapsedMs > PLASMA_BUDGET_MS) {
		_adaptiveUnderBudgetStreak = 0;
		_adaptiveOverBudgetStreak++;
		if (_adaptiveOverBudgetStreak >= DOWNGRADE_STREAK && _adaptiveRenderScale < MAX_RENDER_SCALE) {
			_adaptiveOverBudgetStreak = 0;
			_applyAdaptiveScale(_adaptiveRenderScale + 1);
		}
		return;
	}

	_adaptiveOverBudgetStreak = 0;
	_adaptiveUnderBudgetStreak++;
	if (_adaptiveUnderBudgetStreak >= UPGRADE_STREAK && _adaptiveRenderScale > 1) {
		_adaptiveUnderBudgetStreak = 0;
		_applyAdaptiveScale(_adaptiveRenderScale - 1);
	}
}

function _tickAllFields(): void {
	if (_activeFields.size === 0) {
		return;
	}

	const started = performance.now();
	for (const field of _activeFields) {
		if (field.sprite.visible && field.sprite.inCamera !== false) {
			field.tick();
		}
	}
	// Only meaningful for the CPU path. Shader-backed fields cost a uniform write
	// per tick, so timing them would just report noise and pin the governor at
	// full resolution for no reason.
	if (!_anyFieldUsesShader()) {
		_governQuality(performance.now() - started);
	}
}

/** Whether any live field is drawn by the fragment shader rather than the CPU loop. */
function _anyFieldUsesShader(): boolean {
	for (const field of _activeFields) {
		if (field.usesShader) {
			return true;
		}
	}
	return false;
}

function _ensureTicker(): void {
	if (_sharedTimer || !_sharedEngine) return;
	// Seed from the display-derived floor so a rematch does not start at a
	// stale adaptive tier from the previous one.
	if (_adaptiveRenderScale < 1) {
		_adaptiveRenderScale = computePlasmaRenderScale();
	}
	// Routed through the AB clock rather than the engine directly: on a scene
	// this becomes a scene timer, so the shield surface is stepped by the same
	// clock as the tweens around it. Under a headless virtual clock that is what
	// makes the plasma deterministic instead of racing the render loop.
	_sharedTimer = every(1000 / SHARED_TICK_FPS, _tickAllFields);
}

function _resetSharedState(): void {
	// Clear all module-level shared state so a new match can register fields
	// against a fresh engine instance. Called automatically on engine mismatch.
	// Stopping the clock handle also covers the match-restart case the old
	// `engine.time.remove` try/catch existed for: the timer belongs to the clock,
	// not to the engine instance that happened to start it.
	_sharedTimer?.stop();
	_sharedTimer = null;
	_sharedEngine = null;
	_activeFields.clear();
	_adaptiveRenderScale = computePlasmaRenderScale();
	_adaptiveOverBudgetStreak = 0;
	_adaptiveUnderBudgetStreak = 0;
}

function _registerField(field: PlasmaField): void {
	// If our cached engine is stale (match was restarted), reset everything.
	if (_sharedEngine && _sharedEngine !== field._engine) {
		_resetSharedState();
	}
	_sharedEngine = field._engine;
	_activeFields.add(field);
	_ensureTicker();
}

function _unregisterField(field: PlasmaField): void {
	_activeFields.delete(field);
	if (_activeFields.size === 0 && _sharedTimer) {
		_sharedTimer.stop();
		_sharedTimer = null;
	}
}

export class PlasmaField {
	readonly _engine: GameEngine;
	private w: number;
	private h: number;
	private cx: number;
	private cy: number;
	private rx: number;
	private ry: number;

	private renderScale: number;
	private baseRenderScale: number;
	private displayRenderScale: number;
	private rw: number;
	private rh: number;

	private alpha: number;
	private frame: number;
	private time: number;
	private burstPower: number;
	private outlinePower: number;
	private settings: PlasmaFieldSettings;
	private lowCtx: CanvasRenderingContext2D;
	private bmd: CanvasSurface;
	private _surfaceSource: SurfaceSource | undefined;
	private low: HTMLCanvasElement;
	private _imgData: ImageData;
	private parent: GroupHandle;
	readonly sprite: SpriteHandle;
	private creature: Creature | null;
	onBurstEnd: (() => void) | null;
	private fps: number;
	private _staticMode: boolean;
	private _plasmaFraction: number;
	private _noCanvas = false;

	/**
	 * The GPU quad, when this field is running on the shader path.
	 *
	 * `null` on the CPU fallback (CANVAS renderer, the HEADLESS renderer, or when
	 * `staticMode` needs a single baked frame). The two paths are mutually
	 * exclusive — `sprite` is whichever one is live, so callers above this class
	 * (positioning, visibility, scale) do not need to care which is in use.
	 */
	private _shader: ShaderHandle | null = null;

	/**
	 * True when the field is drawn by the fragment shader rather than the CPU
	 * per-pixel loop. The shader costs a single draw call regardless of how
	 * many fields are on screen, so all of the CPU-path resolution machinery
	 * (renderScale, quality governor, the glow pass) is skipped entirely.
	 */
	get usesShader(): boolean {
		return this._shader !== null;
	}

	/**
	 * Drives the field's line weight from the owning player's remaining plasma,
	 * as a fraction of the plasma they allocated (1 = full, 0 = empty).
	 *
	 * Deliberately a plain setter rather than reading the player off the field:
	 * `PlasmaField` has no gameplay knowledge, which keeps it unit-testable and
	 * means the visual harness can sweep the whole range without a game.
	 */
	setPlasmaFraction(fraction: number): void {
		this._plasmaFraction = fraction;
	}

	constructor(engine: GameEngine, x: number, y: number, opt: PlasmaFieldOptions = {}) {
		this._engine = engine;
		// Defaults to a full tank so any field created outside the Dark Priest
		// path (tests, the visual harness) keeps the reference look.
		this._plasmaFraction = 1;
		this.w = opt.width || 192;
		this.h = opt.height || 256;
		this.cx = this.w / 2;
		this.cy = this.h / 2;
		this.rx = opt.radiusX || 58;
		this.ry = opt.radiusY || 94;

		this.baseRenderScale = opt.renderScale || 1;
		this.displayRenderScale = 1;
		this.renderScale = this.baseRenderScale;
		this.rw = Math.floor(this.w / this.renderScale);
		this.rh = Math.floor(this.h / this.renderScale);

		this.alpha = opt.alpha == null ? 0.94 : opt.alpha;
		this.frame = 0;
		this.time = 0;
		this.burstPower = 0;
		this.outlinePower = 0;
		this.fps = opt.fps || 24;
		this._staticMode = !!opt.staticMode;

		this.settings = { ...DEFAULT_SETTINGS, ...opt };

		this._surfaceSource = opt.surfaceSource;
		this.parent = opt.parent || engine.world;
		this.creature = opt.creature || null;
		this.onBurstEnd = null;

		// Prefer the GPU. It is exact (the GLSL is a verified port of the loop
		// below), renders at full resolution, and costs the same for four shields
		// as for one — the CPU path used ~15ms per field per frame at full res.
		// `staticMode` asks for one baked frame with no animation, which only the
		// CPU path can produce, so it keeps the old behaviour.
		const canUseShader =
			!this._staticMode &&
			typeof engine.add?.shader === 'function' &&
			engine.supportsShaders === true;

		if (canUseShader) {
			this.sprite = this._createShaderQuad(x, y);
		} else {
			this.sprite = this._createCpuSprite(x, y);
		}

		if (this._staticMode) {
			this.draw();
		} else {
			_registerField(this);
		}
	}

	/** GPU path: one fragment-shader quad, animated purely by uniforms. */
	private _createShaderQuad(x: number, y: number): ShaderHandle {
		const shader = this._engine.add.shader(
			{
				name: 'ABPlasmaField',
				fragmentSource: PLASMA_FRAGMENT_SOURCE,
				setupUniforms: (setUniform) => this._pushShaderUniforms(setUniform),
			},
			x,
			y,
			this.w,
			this.h,
			// Same group as the CPU path. The board display group is offset by
			// (230, 380), so an un-parented quad would render off in the upper-left
			// corner instead of over its creature.
			this.parent,
		);

		// Phaser 4's Shader mixes in Origin, not Anchor; `setOrigin` is the
		// equivalent of the CPU path's `anchor.set(0.5, 0.5)`.
		(shader as unknown as { setOrigin?: (x: number, y: number) => void }).setOrigin?.(0.5, 0.5);
		shader.setScale(this.settings.scaleX, this.settings.scaleY);
		// Shader has no Alpha component (`setAlpha` is a no-op), so opacity travels
		// as the `uAlpha` uniform instead — see `_pushShaderUniforms`.
		shader.blendMode = BLEND_MODE_ADD;

		this._shader = shader;
		return shader;
	}

	/** CPU path: a canvas-surface-backed sprite redrawn by `draw()` every tick. */
	private _createCpuSprite(x: number, y: number): SpriteHandle {
		this.low = document.createElement('canvas');
		this.low.width = this.rw;
		this.low.height = this.rh;
		const ctx = this.low.getContext('2d', { willReadFrequently: true });
		if (!ctx) {
			this._noCanvas = true;
			this.lowCtx = {} as CanvasRenderingContext2D;
			this._imgData = { data: new Uint8ClampedArray(this.rw * this.rh * 4) } as ImageData;
		} else {
			this._noCanvas = false;
			this.lowCtx = ctx;
			this._imgData = ctx.createImageData(this.rw, this.rh);
		}

		this.bmd = createCanvasSurface(this._surfaceSource, this.w, this.h);
		// The handle is a live texture, so the sprite samples the pixels written
		// into it below rather than falling back to the missing-texture image.
		const sprite = this._engine.add.sprite(x, y, this.bmd.key, undefined, this.parent);
		sprite.setOrigin(0.5, 0.5);
		sprite.setScale(this.settings.scaleX, this.settings.scaleY);
		sprite.alpha = this.alpha;
		// Additive blending is what gives the shield its glow. `2` is MULTIPLY,
		// not ADD (ADD is 1 in both Phaser 2 CE and Phaser 4), and multiplying
		// muddies the highlight instead of blooming it — so use the constant.
		// `BLEND_MODE_ADD` mirrors `BlendModes.ADD` rather than reading it off the
		// Phaser namespace, so this also works before Phaser has loaded.
		sprite.blendMode = BLEND_MODE_ADD;
		return sprite;
	}

	/** Push the current field state into the fragment shader's uniforms. */
	private _pushShaderUniforms(setUniform: (name: string, value: number | number[]) => void): void {
		const set = this.settings;
		// `uRadius` is in normalised quad units: the CPU loop works in pixels with
		// rx/ry over a w x h bitmap, so divide to get the same ellipse once the
		// quad's own aspect is accounted for.
		setUniform('uTime', this.time);
		setUniform('uAlpha', this.alpha);
		setUniform('uHueShift', set.hueShift);
		setUniform('uRadius', [this.rx / this.w, this.ry / this.h]);
		setUniform('uFlowSpeed', set.flowSpeed);
		setUniform('uWrap3D', set.wrap3d);
		setUniform('uDensity', set.density);
		setUniform('uThickness', set.thickness);
		setUniform('uSkin', set.skin);
		setUniform('uContrast', set.contrast);
		setUniform('uBackSurface', set.backSurface);
		setUniform('uTransparency', set.transparency);
		setUniform('uBottomFade', set.bottomFade);
		setUniform('uBottomFadeCurve', set.bottomFadeCurve);
		setUniform('uBurst', this.burstPower * set.blockPower);
		// Same helper the CPU loop calls, so the two renderers agree on band
		// weight for the same field on the same tick.
		const look = plasmaLookFor(this._plasmaFraction);
		setUniform('uBandWiden', look.bandWiden);
		setUniform('uBandGain', look.bandGain);
	}

	private band(s: number, center: number, width: number): number {
		return exp(-pow((s - center) / width, 2));
	}

	get burstPowerVisible(): number {
		return this.burstPower + this.outlinePower;
	}

	private isUpgraded(): boolean {
		if (!this.creature) return false;
		const ability = this.creature.abilities[0];
		return ability && ability.upgraded;
	}

	private surfaceScalar(
		theta: number,
		v: number,
		depth: number,
		mt: number,
		isBack: boolean,
	): { s: number; drain: number; v: number } {
		const set = this.settings;
		const dir = isBack ? -1.0 : 1.0;

		const baseFlow = mt * set.flowSpeed;
		const burst = this.burstPower;
		const burstFlow = baseFlow * burst * 2.5;
		const drain = v - baseFlow - burstFlow;

		let T = theta;
		T += dir * set.wrap3d * (0.72 * sin(mt * 1.35) + 0.22 * sin(v * 8.0 - mt * 2.8));
		T += set.wrap3d * 0.28 * sin(v * 12.0 + theta * 0.8 + mt * 2.2);
		T += set.wrap3d * 0.16 * sin(v * 21.0 - theta * 1.3 - mt * 3.6);

		let V = v;
		V += 0.055 * sin(theta * 2.4 + mt * 1.8 * dir);
		V += 0.035 * sin(theta * 5.0 - v * 10.0 + mt * 2.7);

		let s = 0;
		s += 0.92 * sin(1.75 * T + 4.1 * drain + 0.6 * sin(8.0 * V - mt * 2.0));
		s += 0.78 * sin(3.25 * T - 5.7 * drain + 0.44 * sin(2.2 * T + mt * 2.8));
		s += 0.62 * sin(5.6 * T + 6.4 * V - mt * 3.5);
		s += 0.42 * sin(9.2 * T - 7.8 * drain + 0.28 * sin(15.0 * V + mt * 1.6));
		s += 0.26 * sin(14.0 * T + 10.0 * V + mt * 4.0);
		s += 0.1 * depth * sin(6.0 * V + mt * 2.6);

		return { s: s / 2.45, drain: drain, v: v };
	}

	private draw(): void {
		// CPU fallback only. On the GPU path the effect lives in a fragment shader
		// and `tick()` just writes uniforms, so there is nothing to rasterise.
		if (this._noCanvas || this._shader) return;
		const set = this.settings;
		const ctx = this.lowCtx;
		const img = this._imgData;
		const data = img.data;

		const t = this.time;
		const burst = this.burstPower * set.blockPower;
		// Outline has its own power that decays slower than the main burst,
		// so the block outline ring stays visible long after the main flash.
		const outlineBurst = this.outlinePower * set.blockOutline;

		// Pre-compute values that are constant across all pixels this frame.
		const cx = this.cx;
		const cy = this.cy;
		const rx = this.rx;
		const ry = this.ry;
		const mt = t * (0.28 + set.flowSpeed * 0.55);
		const mtBack = mt + 0.1 * (0.28 + set.flowSpeed * 0.55);
		const sin_t_1_8 = Math.sin(t * 1.8);
		const sin_t_2_4_1_5 = Math.sin(t * 2.4 + 1.5);
		const sin_t_2_0_2_2 = Math.sin(t * 2.0 + 2.2);
		const sin_t_2_8_0_7 = Math.sin(t * 2.8 + 0.7);
		const sin_t_1_5 = Math.sin(t * 1.5);
		const sin_t_2_1_1_4 = Math.sin(t * 2.1 + 1.4);
		const sin_t_2_4_2_0 = Math.sin(t * 2.4 + 2.0);
		const sin_t_2_3_0_8 = Math.sin(t * 2.3 + 0.8);
		const bf = set.bottomFade;
		const bfPlus = bf + 0.11;
		const dens = set.density;
		const thick = set.thickness;
		const backSurf = set.backSurface;
		// Resolved once per frame, outside the pixel loop: band weight tracks the
		// owner's remaining plasma, and it is constant across the whole field.
		const look = plasmaLookFor(this._plasmaFraction);

		let idx = 0;

		for (let py = 0; py < this.rh; py++) {
			const y = py * this.renderScale + this.renderScale * 0.5;

			for (let px = 0; px < this.rw; px++, idx += 4) {
				const x = px * this.renderScale + this.renderScale * 0.5;

				const nx = (x - cx) / rx;
				const ny = (y - cy) / ry;
				const e = nx * nx + ny * ny;

				if (e > 1) {
					data[idx + 3] = 0;
					continue;
				}

				const v = clamp((ny + 1) * 0.5, 0, 1);

				const rowWidth = Math.sqrt(Math.max(0.001, 1.0 - ny * ny));
				const u = clamp(nx / Math.max(0.08, rowWidth), -0.999, 0.999);
				const thetaFront = Math.asin(u);
				const thetaBack = thetaFront + Math.PI;
				const sideDepth = Math.max(0, Math.cos(thetaFront));
				const edge = clamp((e - 0.55) / 0.45, 0, 1);

				// BOTTOM ONLY. Top stays intact.
				const bottomMetric = 1 - v - set.bottomFadeCurve * (1 - sideDepth) * 0.12;
				const bottomMask = smoothstep(bf, bfPlus, bottomMetric);
				if (bottomMask <= 0.001) {
					data[idx + 3] = 0;
					continue;
				}

				const front = this.surfaceScalar(thetaFront, v, sideDepth, mt, false);
				const back = this.surfaceScalar(thetaBack, v, -sideDepth, mtBack, true);

				let f = 0;
				f = Math.max(
					f,
					this.band(
						front.s * dens,
						-0.54 + 0.08 * sin_t_1_8,
						PLASMA_LOOK.bandWidths[0] * look.bandWiden * thick,
					),
				);
				f = Math.max(
					f,
					this.band(
						front.s * dens,
						-0.2 + 0.07 * sin_t_2_4_1_5,
						PLASMA_LOOK.bandWidths[1] * look.bandWiden * thick,
					),
				);
				f = Math.max(
					f,
					this.band(
						front.s * dens,
						0.14 + 0.08 * sin_t_2_0_2_2,
						PLASMA_LOOK.bandWidths[2] * look.bandWiden * thick,
					),
				);
				f = Math.max(
					f,
					this.band(
						front.s * dens,
						0.48 + 0.06 * sin_t_2_8_0_7,
						PLASMA_LOOK.bandWidths[3] * look.bandWiden * thick,
					),
				);

				let b = 0;
				b = Math.max(
					b,
					this.band(
						back.s * dens,
						-0.5 + 0.08 * sin_t_1_5,
						PLASMA_LOOK.bandWidths[0] * look.bandWiden * thick,
					),
				);
				b = Math.max(
					b,
					this.band(
						back.s * dens,
						-0.15 + 0.07 * sin_t_2_1_1_4,
						PLASMA_LOOK.bandWidths[1] * look.bandWiden * thick,
					),
				);
				b = Math.max(
					b,
					this.band(
						back.s * dens,
						0.2 + 0.08 * sin_t_2_4_2_0,
						PLASMA_LOOK.bandWidths[2] * look.bandWiden * thick,
					),
				);
				b = Math.max(
					b,
					this.band(
						back.s * dens,
						0.52 + 0.06 * sin_t_2_3_0_8,
						PLASMA_LOOK.bandWidths[3] * look.bandWiden * thick,
					),
				);

				const crackleF =
					0.7 +
					0.18 * Math.sin(8.0 * v + 1.8 * thetaFront - t * 5.2) +
					0.12 * Math.sin(11.0 * front.drain - 2.1 * thetaFront + t * 7.0);
				const crackleB = 0.58 + 0.16 * Math.sin(7.6 * v + 1.7 * thetaBack + t * 3.6);
				f = clamp(f * crackleF, 0, 1.18);
				b = clamp(b * crackleB, 0, 1.05);

				let frontI = f * (0.22 + 0.52 * sideDepth + 0.12 * edge);
				let backI = b * backSurf * (0.05 + 0.38 * edge + 0.12 * (1 - sideDepth));

				let shock = 0;
				if (burst > 0.02) {
					const verticalPulse = smoothstep(0.1, 0.55, v) * smoothstep(0.1, 0.55, 1 - v);
					const blockT = t * (0.1 + set.blockSpeed * 0.22);
					const drainPulse = 0.55 + 0.45 * sin(8.0 * v + blockT + thetaFront * 1.8);
					shock = burst * 0.16 * verticalPulse * drainPulse;
					frontI += f * 0.18 * burst;
					backI += b * 0.08 * burst;
				}

				let intensity = clamp((frontI + backI + shock) * set.skin * bottomMask, 0, 1.22);
				intensity = pow(intensity, 1.0 / set.contrast);

				const core = clamp(
					((frontI - 0.24) * 2.35 + (backI - 0.16) * 1.1 + shock * 1.2) * bottomMask,
					0,
					1,
				);

				// Mirrors the shader's anti-aliased onset. The hard `if (intensity > 0.038)`
				// that used to guard this cut the first band in with a stair-stepped
				// rim; ramping over the same threshold fades the silhouette in.
				const onset = smoothstep(PLASMA_LOOK.onsetLow, PLASMA_LOOK.onsetHigh, intensity);
				let alpha =
					(intensity * PLASMA_LOOK.alphaIntensity + core * PLASMA_LOOK.alphaCore) *
					look.bandGain *
					onset;

				// Rim-weighted aura: weighting it towards `edge` alone still spread a
				// milky film across the whole shield and hid the board behind it.
				const aura =
					(0.018 + 0.028 * Math.sin(t * 2.6 + v * 10.0 + thetaFront * 0.6)) *
					(PLASMA_LOOK.auraEdgeBase + PLASMA_LOOK.auraEdgeWeight * edge) *
					bottomMask;
				alpha += aura * PLASMA_LOOK.auraAmount;
				alpha = clamp(alpha * set.transparency, 0, 185);

				const rr = 116 + 126 * Math.min(1, intensity) + 58 * core + 8 * sideDepth * f;
				const gg = 4 + 22 * Math.min(1, intensity) + 180 * core;
				const bb = 130 + 96 * Math.min(1, intensity) + 104 * core + 18 * edge * b;

				const hue = hueRotateRgb(rr, gg, bb, set.hueShift);

				// Only the body of each wave carries the player's hue; the crest
				// burns toward white, mixed in after the rotation so the caps stay
				// white instead of being dragged to one flat tinted wash.
				const white = core * PLASMA_LOOK.crestWhite * onset;

				data[idx] = clamp(hue.r + (255 - hue.r) * white, 0, 255);
				data[idx + 1] = clamp(hue.g + (255 - hue.g) * white, 0, 255);
				data[idx + 2] = clamp(hue.b + (255 - hue.b) * white, 0, 255);
				data[idx + 3] = alpha;
			}
		}

		ctx.clearRect(0, 0, this.rw, this.rh);
		ctx.putImageData(img, 0, 0);

		const out = this.bmd.ctx;
		out.clearRect(0, 0, this.w, this.h);
		out.imageSmoothingEnabled = true;
		out.drawImage(this.low, 0, 0, this.w, this.h);

		// Block outline using the same bottom-fade idea as the plasma body.
		// Only shown when the plasma field ability is upgraded and burstPower is active.
		// Threshold lowered to 0.02 for longer visibility.
		if (outlineBurst > 0.02 && set.blockOutline > 0 && this.isUpgraded()) {
			out.save();
			out.globalCompositeOperation = 'lighter';
			// hueRotateRgb is computed once because both the shadow and the stroke
			// use the same source color (255, 55, 232).
			const outlineHue = hueRotateRgb(255, 55, 232, set.hueShift);
			out.shadowColor =
				'rgba(' +
				Math.round(clamp(outlineHue.r, 0, 255)) +
				',' +
				Math.round(clamp(outlineHue.g, 0, 255)) +
				',' +
				Math.round(clamp(outlineHue.b, 0, 255)) +
				', .90)';
			out.shadowBlur = 18 + outlineBurst * 10;
			out.lineWidth = 3.6;
			out.lineCap = 'round';
			out.lineJoin = 'round';

			const rxO = this.rx + 4;
			const ryO = this.ry + 6;
			const stepsO = 48;

			for (let oi = 0; oi < stepsO; oi++) {
				const a0 = (oi / stepsO) * Math.PI * 2;
				const a1 = ((oi + 1) / stepsO) * Math.PI * 2;
				const am = (a0 + a1) * 0.5;

				const xm = cx + rxO * Math.cos(am);
				const ym = cy + ryO * Math.sin(am);
				const nym = clamp((ym - cy) / ry, -1, 1);
				const vm = clamp((nym + 1) * 0.5, 0, 1);
				const uO = clamp((xm - cx) / rxO, -0.999, 0.999);
				const sideDepthO = Math.sqrt(Math.max(0, 1 - uO * uO));
				const outlineMetric = 1 - vm - set.bottomFadeCurve * (1 - sideDepthO) * 0.12;
				const maskO = smoothstep(bf, bfPlus, outlineMetric);

				if (maskO <= 0.015) continue;

				const alphaO = 0.45 * outlineBurst * maskO;
				out.strokeStyle =
					'rgba(' +
					Math.round(clamp(outlineHue.r, 0, 255)) +
					',' +
					Math.round(clamp(outlineHue.g, 0, 255)) +
					',' +
					Math.round(clamp(outlineHue.b, 0, 255)) +
					',' +
					alphaO +
					')';

				out.beginPath();
				out.moveTo(cx + rxO * Math.cos(a0), cy + ryO * Math.sin(a0));
				out.lineTo(cx + rxO * Math.cos(a1), cy + ryO * Math.sin(a1));
				out.stroke();
			}

			out.restore();
		}

		this.bmd.commit();
	}

	tick = (): void => {
		this.frame++;
		// Steady animation step. The shared ticker fires at a fixed rate, so
		// advancing by a constant keeps the plasma flowing smoothly regardless
		// of how many fields are currently on screen.
		//
		// Scaled down from the tick rate to give the surface a slow, lava-lamp
		// drift rather than a busy churn. This is purely cosmetic and costs
		// nothing: both paths evaluate the same per-pixel work regardless of how
		// fast the clock advances.
		this.time += (1 / 24) * PLASMA_ANIMATION_SPEED;
		if (this.advanceBurst()) {
			// The field destroyed itself as the burst finished; its sprite is gone.
			return;
		}
		if (this._shader) {
			// GPU path: the effect is a fragment shader, so animating it is just a
			// uniform write. No per-pixel work, no canvas, no upload — which is the
			// entire point of the port.
			this._pushShaderUniforms((name, value) => this._shader?.setUniform(name, value));
			return;
		}
		this.draw();
	};

	/**
	 * Decay the burst flash and fire `onBurstEnd` once it has fully faded.
	 *
	 * `onBurstEnd` is how callers defer tearing the field down until the block
	 * flash has actually played. Nothing invoked it, so a deferred removal never
	 * completed: the field stayed registered on the shared ticker and kept
	 * redrawing every frame for the rest of the match.
	 *
	 * Runs from {@link tick} while visible, and once more from {@link setVisible}
	 * when hiding — an invisible field is unregistered from the ticker, so its
	 * burst would otherwise stop decaying and the callback would dangle forever.
	 *
	 * @returns `true` when the field destroyed itself and must not draw.
	 */
	private advanceBurst(): boolean {
		if (this.burstPower > 0) {
			this.burstPower = Math.max(0, this.burstPower - 0.08);
		}
		if (this.outlinePower > 0) {
			this.outlinePower = Math.max(0, this.outlinePower - 0.03);
		}

		if (this.onBurstEnd && this.burstPowerVisible <= 0) {
			const onBurstEnd = this.onBurstEnd;
			// Clear before invoking: the callback destroys this field, and a
			// re-entrant tick would otherwise fire the callback a second time.
			this.onBurstEnd = null;
			onBurstEnd();
			return true;
		}

		return false;
	}

	/** Position the field relative to the Dark Priest cardboard sprite. */
	positionTo(target: SpriteHandle, offsetX: number, offsetY: number): void {
		this.sprite.x = target.x + offsetX;
		this.sprite.y = target.y - offsetY;
	}

	setVisible(visible: boolean): void {
		this.sprite.visible = visible;
		if (visible && !this._staticMode) {
			_registerField(this);
		} else if (!visible && !this._staticMode) {
			// A hidden field is unregistered from the shared ticker, so nothing
			// would ever decay its burst or fire `onBurstEnd`. Since the field is
			// invisible anyway there is no flash left to play, so snap the burst
			// to its end: a removal deferred while hidden completes immediately
			// instead of waiting on a callback nothing can run.
			this.burstPower = 0;
			this.outlinePower = 0;
			if (this.advanceBurst()) {
				return;
			}
			_unregisterField(this);
		}
	}

	burst(): void {
		this.burstPower = 1;
		this.outlinePower = 1;
	}

	set(key: keyof PlasmaFieldSettings, value: number | boolean): void {
		if (key in this.settings) {
			(this.settings[key] as number | boolean) = value as never;
			if (key === 'scaleX' || key === 'scaleY') {
				this.sprite.setScale(this.settings.scaleX, this.settings.scaleY);
			}
			// On the GPU path every setting is a uniform, so a change only reaches
			// the screen on the next tick. Push now so the change is immediate.
			if (this._shader) {
				this._pushShaderUniforms((n, v) => this._shader?.setUniform(n, v));
			}
		}
	}

	destroy(): void {
		_unregisterField(this);
		this.onBurstEnd = null;
		if (this.sprite && this.sprite.destroy) this.sprite.destroy();
		// Only the CPU path owns a canvas surface; the GPU path has no backing
		// texture to free (the shader quad holds its own).
		this.bmd?.destroy();
		this._shader = null;
	}

	/**
	 * Recompute the effective render scale from the display-derived factor.
	 *
	 * CPU path only: it trades internal resolution for fill rate. The shader path
	 * has no internal resolution to change, so it always renders at full size.
	 */
	updateRenderScale(displayScale: number): void {
		if (this._shader) return;
		this.displayRenderScale = displayScale > 1 ? displayScale : 1;
		const effective = Math.max(this.baseRenderScale, this.displayRenderScale);
		if (this.renderScale === effective) return;
		this.renderScale = effective;
		this.rw = Math.floor(this.w / this.renderScale);
		this.rh = Math.floor(this.h / this.renderScale);
		this.low.width = this.rw;
		this.low.height = this.rh;
		if (!this._noCanvas) {
			this._imgData = this.lowCtx.createImageData(this.rw, this.rh);
		}
		this.draw();
	}
}
