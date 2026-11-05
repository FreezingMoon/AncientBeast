/*
 * Temporary tuning harness for the Chain Lightning look.
 *
 * The effect is a two-layer zig-zag line — a squiggly bolt
 * with a fat soft blue line underneath and a thin bright
 * white line burning on top of it — and every knob of it is
 * exposed here as a slider so the look can be tuned against
 * a board without touching the renderer.
 *
 * The stage fakes a match using the real roster cardboards:
 * an Impaler on the left and six target units in two rows
 * on the right, of various hex sizes (size 1, 2 and 3), so
 * the bolt can be seen landing on single-hex and multi-hex
 * creatures alike. The targets face the Impaler, and the
 * chain leaves from the Impaler's nose tip — the cardboard's
 * upper-right point — not its centre. A strike picks a
 * random subset, orders it to zig-zag across the rows, and
 * fires the real chain renderer down it — the same
 * `spawnChainLightning` the Impaler's fourth ability calls
 * in a match, with the same look table. Each unit's
 * cardboard reacts as its hop lands, so the chain order is
 * visible as well as the bolt itself.
 *
 * Since the harness author cannot view images, `Measure` also
 * asserts the look as numbers, measured identically on every
 * run: lit-pixel count (how much of the board the strike
 * lights), white fraction (the hot core showing through),
 * hue centroid (the blue layer's colour, which must stay
 * blue) and mean added luminance (overall brightness). A look
 * that reads wrong usually reads wrong in one of those four
 * first.
 *
 * Load /demos/lightning-visual.html while `vite` runs. Not
 * part of the game build.
 */

import Phaser from 'phaser';
import { Phaser4Engine } from '../../engine/Phaser4Engine';
import { loadPhaser } from '../../phaser/runtime';
import { spawnChainLightning } from './effect';
import { CHAIN_LIGHTNING_LOOK, type ChainLightningLook, type LightningPoint } from './look';
import { Easing } from '../../utility/easing';
import type { GameEngine, GroupHandle, SpriteHandle } from '../../engine/types';

/** Stage geometry, in scene pixels. */
const STAGE_W = 1200;
const STAGE_H = 640;

/** Depth that puts the bolt above every cardboard on the stage. */
const BOLT_DEPTH = 500;

/** Where the two target rows stand. */
const TOP_GROUND_Y = 300;
const BOTTOM_GROUND_Y = 585;

/** Left edge of the target area, per row. */
const ROW_ORIGIN_X = 310;

/** Right edge of the target area, per row. */
const ROW_END_X = 1160;

/** Gap between cardboards in a row. */
const ROW_GAP = 60;

const log = document.getElementById('log') as HTMLElement;
const lines: string[] = [];
function say(msg: string) {
	lines.push(msg);
	while (lines.length > 9) {
		lines.shift();
	}
	log.textContent = lines.join('\n');
}

class VisualScene extends Phaser.Scene {
	constructor() {
		super('chainLightningVisual');
	}
	create() {
		void boot(this.game);
	}
}

const game = new Phaser.Game({
	width: STAGE_W,
	height: STAGE_H,
	type: Phaser.AUTO,
	parent: 'host',
	backgroundColor: '#101826',
	preserveDrawingBuffer: true,
	scene: VisualScene,
});

/** The live look table. The sliders write into this object. */
const tune: ChainLightningLook = { ...CHAIN_LIGHTNING_LOOK };

let engine: GameEngine;
let scene: Phaser.Scene;
let creatureGrp: GroupHandle;
let impaler: Dummy;
/** Where the chain leaves the Impaler: its nose tip. */
let impalerNose: LightningPoint;
let dummies: Dummy[] = [];

/** A roster unit, by its real cardboard and hex size. */
interface UnitSpec {
	/** Texture key, same as the file name. */
	key: string;
	label: string;
	/** How many hexes the unit occupies. */
	size: 1 | 2 | 3;
}

/** The caster: a size-3 Impaler. */
const CASTER: UnitSpec = { key: 'Impaler', label: 'Impaler', size: 3 };

/** The targets: single-, two- and three-hex units, real cardboards. */
const TARGET_SPECS: UnitSpec[] = [
	{ key: 'Gumble', label: 'Gumble', size: 1 },
	{ key: 'Cyber Wolf', label: 'Cyber Wolf', size: 2 },
	{ key: 'Abolished', label: 'Abolished', size: 3 },
	{ key: 'Snow Bunny', label: 'Snow Bunny', size: 1 },
	{ key: 'Stomper', label: 'Stomper', size: 2 },
	{ key: 'Golden Wyrm', label: 'Golden Wyrm', size: 3 },
];

/** Cardboard files, keyed by unit name. */
function cardboardFile(key: string): string {
	return `/assets/units/cardboards/${key}.png`;
}

/** Load every cardboard this stage needs. */
function loadCardboards(): Promise<void> {
	return new Promise((resolve) => {
		scene.load.on('complete', () => resolve());
		scene.load.image(CASTER.key, cardboardFile(CASTER.key));
		for (const spec of TARGET_SPECS) {
			scene.load.image(spec.key, cardboardFile(spec.key));
		}
		scene.load.start();
	});
}

/** Cardboard pixel width, once loaded. */
function cardboardWidth(key: string): number {
	const img = scene.textures.get(key).getSourceImage() as HTMLImageElement;
	return img.naturalWidth || img.width;
}

/** Cardboard pixel height, once loaded. */
function cardboardHeight(key: string): number {
	const img = scene.textures.get(key).getSourceImage() as HTMLImageElement;
	return img.naturalHeight || img.height;
}

/**
 * The nose tip of a right-facing cardboard, in its own
 * pixels: the topmost opaque pixel of the right half,
 * which is the cardboard's upper-right point — where a
 * unit's snout sits. The chain leaves from here.
 */
function cardboardNoseTip(key: string): LightningPoint {
	const img = scene.textures.get(key).getSourceImage() as HTMLImageElement;
	const w = img.naturalWidth || img.width;
	const h = img.naturalHeight || img.height;
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	const ctx = c.getContext('2d');
	if (!ctx) {
		return { x: w, y: 0 };
	}
	ctx.drawImage(img, 0, 0);
	const d = ctx.getImageData(0, 0, w, h).data;
	for (let y = 0; y < h; y++) {
		for (let x = w - 1; x >= w / 2; x--) {
			if (d[(y * w + x) * 4 + 3] > 40) {
				return { x, y };
			}
		}
	}
	return { x: w, y: 0 };
}

/**
 * Lay a row of units out centred in the target area, from
 * left to right in the order given. Every unit faces the
 * Impaler, which stands to the left of the target area.
 */
function layoutRow(specs: UnitSpec[], groundY: number, row: 0 | 1): Dummy[] {
	const widths = specs.map((s) => cardboardWidth(s.key));
	const total = widths.reduce((a, b) => a + b, 0) + ROW_GAP * (specs.length - 1);
	let x = ROW_ORIGIN_X + (ROW_END_X - ROW_ORIGIN_X - total) / 2;
	return specs.map((spec, i) => {
		const centerX = x + widths[i] / 2;
		x += widths[i] + ROW_GAP;
		return new Dummy(spec, centerX, groundY, row, -1);
	});
}

/** A fake unit on the stage. */
class Dummy {
	/** Display name, with the hex size appended. */
	readonly name: string;
	/** Scene x of the cardboard's centre. */
	readonly x: number;
	/** Scene y of the cardboard's bottom edge. */
	readonly groundY: number;
	/** Cardboard pixel height. */
	readonly height: number;
	/** Cardboard pixel width. */
	readonly width: number;
	/** Which row the unit stands on, for zig-zag chain ordering. */
	readonly row: 0 | 1;
	/** 1 faces right, -1 mirrors the cardboard to face left. */
	readonly facing: 1 | -1;
	readonly sprite: SpriteHandle;

	constructor(spec: UnitSpec, x: number, groundY: number, row: 0 | 1, facing: 1 | -1) {
		this.name = `${spec.label}·${spec.size}`;
		this.x = x;
		this.groundY = groundY;
		this.height = cardboardHeight(spec.key);
		this.width = cardboardWidth(spec.key);
		this.row = row;
		this.facing = facing;
		this.sprite = engine.add.sprite(x, groundY, spec.key, undefined, creatureGrp);
		this.sprite.setOrigin(0.5, 1);
		// Targets stand to the Impaler's right, so they face
		// left — towards it — the way units face each other.
		this.sprite.scale.x = facing;
	}

	/** The unit's mid-body, where a bolt should connect. */
	get center(): LightningPoint {
		return { x: this.x, y: this.groundY - this.height / 2 };
	}

	/**
	 * A point in scene pixels, from a cardboard-pixel
	 * offset: the sprite's origin is its bottom centre.
	 */
	point(px: number, py: number): LightningPoint {
		return { x: this.x - this.width / 2 + px, y: this.groundY - this.height + py };
	}

	/** Hit reaction: a fast dip and wobble, then a slow settle. */
	punch() {
		const wobble = (Math.random() * 2 - 1) * 7;
		engine
			.tween(this.sprite)
			.to({ alpha: 0.2, angle: wobble }, 55, Easing.Cubic.Out, true)
			.onComplete.add(() => {
				engine.tween(this.sprite).to({ alpha: 1, angle: 0 }, 340, Easing.Cubic.Out, true);
			});
	}
}

/** Pick `count` targets and order them to zig-zag across the rows. */
function pickChain(count: number, random: () => number): Dummy[] {
	const pool = [...dummies];
	// Fisher–Yates, then take the first `count`.
	for (let i = pool.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[pool[i], pool[j]] = [pool[j], pool[i]];
	}
	const chosen = pool.slice(0, count);
	// Left to right, alternating rows, so the chain travels across
	// the stage and jumps between rows — the shape the ability's
	// chains usually have on the real board.
	const byX = chosen.sort((a, b) => a.x - b.x);
	const top = byX.filter((d) => d.row === 0);
	const bottom = byX.filter((d) => d.row === 1);
	const chain: Dummy[] = [];
	let fromTop = random() < 0.5;
	while (top.length || bottom.length) {
		const source = fromTop ? top : bottom;
		const fallback = fromTop ? bottom : top;
		const next = source.shift() ?? fallback.shift();
		if (next) {
			chain.push(next);
		}
		fromTop = !fromTop;
	}
	return chain;
}

let strikeCount = 0;
let autoEvent: Phaser.Time.TimerEvent | null = null;

const state = {
	auto: true,
	cadence: 1100,
	targetCount: 4,
};

/** Fire one chain from the Impaler's nose through a random zig-zag chain. */
function strike() {
	const chain = pickChain(state.targetCount, Math.random);
	const points: LightningPoint[] = [impalerNose, ...chain.map((d) => d.center)];

	impaler.punch();
	spawnChainLightning(engine, points, {
		parent: creatureGrp,
		surfaceSource: { textures: scene.textures },
		depth: BOLT_DEPTH,
		look: tune,
		onHop: (hopIndex) => {
			// Hop 0 strikes the first target, hop 1 the second, …
			chain[hopIndex]?.punch();
		},
	});

	strikeCount++;
	say(`#${strikeCount} Impaler·3 → ${chain.map((d) => d.name).join(' → ')}`);
}

function setAuto(on: boolean) {
	state.auto = on;
	if (on && !autoEvent) {
		autoEvent = scene.time.addEvent({
			delay: state.cadence,
			loop: true,
			callback: strike,
		});
	} else if (!on && autoEvent) {
		autoEvent.remove(false);
		autoEvent = null;
	}
}

// ─── Measurement ─────────────────────────────────────────────────────

type Img = { w: number; h: number; data: Uint8ClampedArray };

function grab(): Img | null {
	const src = game.canvas as HTMLCanvasElement;
	const c = document.createElement('canvas');
	c.width = src.width;
	c.height = src.height;
	const ctx = c.getContext('2d');
	if (!ctx) return null;
	ctx.drawImage(src, 0, 0);
	const px = ctx.getImageData(0, 0, c.width, c.height);
	return { w: c.width, h: c.height, data: px.data };
}

/**
 * The four look metrics, from a frame of a live strike and a bare
 * frame of the same stage taken before it.
 *
 * Only what the strike *added* is counted, so the cardboards and
 * the board behind them never pollute the numbers.
 */
function computeMetrics(bare: Img | null, live: Img | null): Record<string, number> {
	if (!bare || !live) {
		return { error: 1 };
	}
	let lit = 0;
	let white = 0;
	let hueN = 0;
	let hx = 0;
	let hy = 0;
	let addedSum = 0;
	let addedN = 0;
	for (let y = 0; y < live.h; y += 2) {
		for (let x = 0; x < live.w; x += 2) {
			const i = (y * live.w + x) * 4;
			const j = (y * bare.w + x) * 4;
			const ar = Math.max(0, live.data[i] - bare.data[j]);
			const ag = Math.max(0, live.data[i + 1] - bare.data[j + 1]);
			const ab = Math.max(0, live.data[i + 2] - bare.data[j + 2]);
			const added = ar + ag + ab;
			if (added < 25) {
				continue;
			}
			lit++;
			addedSum += added;
			addedN++;
			if (ar > 150 && ag > 150 && ab > 150) {
				white++;
			}
			// Hue only exists on saturated pixels; near-white ones
			// resolve to red and would drag the centroid.
			const max = Math.max(ar, ag, ab);
			const min = Math.min(ar, ag, ab);
			if (max - min < 30) {
				continue;
			}
			const ang = Math.atan2(Math.sqrt(3) * (ag - ab), 2 * ar - ag - ab);
			hx += Math.cos(ang);
			hy += Math.sin(ang);
			hueN++;
		}
	}
	let hueCentroid = hueN > 0 ? (Math.atan2(hy, hx) * 180) / Math.PI : -1;
	if (hueCentroid < 0) {
		hueCentroid += 360;
	}
	return {
		lit,
		whiteFrac: lit ? Number((white / lit).toFixed(3)) : 0,
		hueCentroid: Number(hueCentroid.toFixed(1)),
		meanAdded: addedN ? Number((addedSum / addedN).toFixed(1)) : 0,
	};
}

/** Fire a strike and sample it while its trail is fully lit. */
function measure() {
	const bare = grab();
	strike();
	// The trail peaks just after the head completes its arc and
	// lives until `lifetimeMs`; sample inside that window, however
	// the sliders have it tuned.
	const sampleAt = Math.max(30, Math.min(tune.travelMs + 40, tune.lifetimeMs - 40));
	window.setTimeout(() => {
		const live = grab();
		const metrics = computeMetrics(bare, live);
		say(`measure ${JSON.stringify(metrics)}`);
	}, sampleAt);
}

// ─── The tuning panel ──────────────────────────────────────────────

/** One slider row, generated from this spec. */
interface SliderSpec {
	key: keyof ChainLightningLook;
	label: string;
	min: number;
	max: number;
	step: number;
}

const FMT = (v: number) => String(Math.round(v * 100) / 100);

const PATH_SLIDERS: SliderSpec[] = [
	{ key: 'segmentLength', label: 'Segment length', min: 16, max: 90, step: 1 },
	{ key: 'zigzagAmplitude', label: 'Zig-zag amplitude', min: 0, max: 1.4, step: 0.01 },
	{ key: 'zigzagAlternate', label: 'Zig-zag strictness', min: 0, max: 1, step: 0.01 },
	{ key: 'jitter', label: 'Jitter', min: 0, max: 1, step: 0.01 },
	{ key: 'arc', label: 'Arc', min: 0, max: 0.5, step: 0.005 },
	{ key: 'endpointBlend', label: 'Endpoint blend', min: 0.02, max: 0.5, step: 0.005 },
];

const LINE_SLIDERS: SliderSpec[] = [
	{ key: 'radiusJitter', label: 'Width jitter', min: 0, max: 1, step: 0.01 },
	{ key: 'blueRadius', label: 'Blue half-width', min: 1, max: 18, step: 0.25 },
	{ key: 'blueAlpha', label: 'Blue alpha', min: 0.05, max: 1, step: 0.01 },
	{ key: 'whiteRadius', label: 'White half-width', min: 0.5, max: 10, step: 0.1 },
	{ key: 'whiteAlpha', label: 'White alpha', min: 0.05, max: 1, step: 0.01 },
	{ key: 'flicker', label: 'Flicker', min: 0, max: 1, step: 0.01 },
	{ key: 'flickerHz', label: 'Flicker rate', min: 0, max: 30, step: 0.5 },
	{ key: 'drift', label: 'Crackle', min: 0, max: 40, step: 1 },
	{ key: 'embers', label: 'Embers', min: 0, max: 30, step: 1 },
	{ key: 'emberRadius', label: 'Ember radius', min: 0.5, max: 8, step: 0.1 },
	{ key: 'emberDrift', label: 'Ember drift', min: 0, max: 80, step: 1 },
];

const TIMING_SLIDERS: SliderSpec[] = [
	{ key: 'travelMs', label: 'Travel ms', min: 30, max: 400, step: 5 },
	{ key: 'lifetimeMs', label: 'Lifetime ms', min: 120, max: 1200, step: 10 },
	{ key: 'fadeInMs', label: 'Ignite ms', min: 0, max: 80, step: 1 },
	{ key: 'impactFlashMs', label: 'Flash ms', min: 0, max: 400, step: 5 },
	{ key: 'impactFlashRadius', label: 'Flash radius', min: 0, max: 60, step: 1 },
];

/** Build one slider row and wire it into `tune`. */
function bindSlider(spec: SliderSpec, host: HTMLElement) {
	const row = document.createElement('label');
	row.className = 'slider';

	const name = document.createElement('span');
	name.className = 'slider-name';
	name.textContent = spec.label;
	row.appendChild(name);

	const input = document.createElement('input');
	input.type = 'range';
	input.min = String(spec.min);
	input.max = String(spec.max);
	input.step = String(spec.step);
	input.value = String(tune[spec.key]);
	row.appendChild(input);

	const value = document.createElement('span');
	value.className = 'slider-value';
	row.appendChild(value);

	const update = () => {
		const v = parseFloat(input.value);
		tune[spec.key] = v;
		value.textContent = FMT(v);
	};
	input.addEventListener('input', update);
	update();

	host.appendChild(row);
}

/** A colour row for one of the two layer colours. */
function bindColor(key: 'blueColor' | 'whiteColor', label: string, host: HTMLElement) {
	const row = document.createElement('label');
	row.className = 'slider';

	const name = document.createElement('span');
	name.className = 'slider-name';
	name.textContent = label;
	row.appendChild(name);

	const input = document.createElement('input');
	input.type = 'color';
	input.value = '#' + tune[key].toString(16).padStart(6, '0');
	row.appendChild(input);

	const update = () => {
		tune[key] = parseInt(input.value.slice(1), 16);
	};
	input.addEventListener('input', update);

	host.appendChild(row);
}

function bindSlidersTo(specs: SliderSpec[], hostId: string) {
	const host = document.getElementById(hostId) as HTMLElement;
	for (const spec of specs) {
		bindSlider(spec, host);
	}
}

function bindPanel() {
	(document.getElementById('strike') as HTMLButtonElement).addEventListener('click', strike);

	const auto = document.getElementById('auto') as HTMLInputElement;
	auto.addEventListener('change', () => setAuto(auto.checked));

	const cadence = document.getElementById('cadence') as HTMLInputElement;
	const cadenceVal = document.getElementById('cadenceVal') as HTMLElement;
	const updateCadence = () => {
		state.cadence = parseFloat(cadence.value);
		cadenceVal.textContent = `${Math.round(state.cadence)}ms`;
		// Retune the loop if it is running.
		if (state.auto) {
			setAuto(false);
			setAuto(true);
		}
	};
	cadence.addEventListener('input', updateCadence);
	updateCadence();

	const targets = document.getElementById('targets') as HTMLInputElement;
	const targetsVal = document.getElementById('targetsVal') as HTMLElement;
	const updateTargets = () => {
		state.targetCount = parseInt(targets.value, 10);
		targetsVal.textContent = String(state.targetCount);
	};
	targets.addEventListener('input', updateTargets);
	updateTargets();

	(document.getElementById('measure') as HTMLButtonElement).addEventListener('click', measure);

	bindSlidersTo(PATH_SLIDERS, 'pathControls');
	bindSlidersTo(LINE_SLIDERS, 'lineControls');
	bindSlidersTo(TIMING_SLIDERS, 'timingControls');
	const colorHost = document.getElementById('colorControls') as HTMLElement;
	bindColor('blueColor', 'Blue colour', colorHost);
	bindColor('whiteColor', 'White colour', colorHost);
}

// ─── Boot ────────────────────────────────────────────────────────────

const win = window as unknown as Record<string, unknown>;

async function boot(phaserGame: Phaser.Game) {
	const bootScene = phaserGame.scene.getScene('chainLightningVisual');
	if (!bootScene) {
		ready();
		return;
	}
	scene = bootScene;

	// The tween easings read the Phaser runtime through the
	// deferred gate, which match setup normally awaits; the demo
	// has to do the same before it can punch a cardboard.
	await loadPhaser();

	try {
		engine = new Phaser4Engine(phaserGame, scene);

		// The real cardboards, straight from the assets.
		await loadCardboards();

		// A DARK checkerboard, like the real board. Lightning is
		// additively blended, so a light backdrop would clip it.
		const bg = scene.add.graphics();
		for (let y = 0; y < STAGE_H; y += 24) {
			for (let x = 0; x < STAGE_W; x += 24) {
				const on = ((x / 24 + y / 24) | 0) % 2 === 0;
				bg.fillStyle(on ? 0x24344a : 0x151e2c, 1);
				bg.fillRect(x, y, 24, 24);
			}
		}

		const display = engine.add.group(undefined, 'displayGroup') as GroupHandle;
		creatureGrp = engine.add.group(display, 'creatureGrp') as GroupHandle;

		// The caster: the real Impaler cardboard, a size-3
		// unit, facing its targets.
		impaler = new Dummy(CASTER, 150, 520, 1, 1);
		// The chain leaves from the Impaler's nose tip —
		// the cardboard's upper-right point.
		const nose = cardboardNoseTip(CASTER.key);
		impalerNose = impaler.point(nose.x, nose.y);

		// Six targets in two rows, of various hex sizes — the real
		// roster cardboards, so the bolt lands on the silhouettes
		// it will chase in a match.
		dummies = [
			...layoutRow(TARGET_SPECS.slice(0, 3), TOP_GROUND_Y, 0),
			...layoutRow(TARGET_SPECS.slice(3), BOTTOM_GROUND_Y, 1),
		];

		bindPanel();

		// Auto-strikes on, so the page opens on the eye candy.
		setAuto(true);
		scene.time.delayedCall(250, strike);

		// Console control: the units, so facing and the
		// nose origin can be inspected while tuning.
		win.impaler = impaler;
		win.impalerNose = impalerNose;
		win.units = [impaler, ...dummies];

		say('chain lightning harness ready');
	} catch (err) {
		say('ERROR: ' + (err as Error).message);
		say((err as Error).stack ?? '');
	}

	ready();
}

/** Console control: fire a chain, tune the look, measure it. */
win.strike = strike;
win.measure = measure;
win.tune = tune;

function ready() {
	win.__chainLightningReady = true;
}
