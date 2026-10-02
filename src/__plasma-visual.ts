/*
 * Temporary measurement harness for the Plasma Field look.
 *
 * I cannot view images, so the shield's appearance has to be asserted as numbers
 * instead. Each complaint maps to one metric, measured identically for the GPU
 * and CPU paths so the port can also be checked for parity:
 *
 *   transparency  -> contrastSurvival: how much of a checkerboard's luminance
 *                    variation still shows through the middle of the shield.
 *   white waves   -> whiteFrac: lit pixels whose channels are all high (the
 *                    crests), which must be present but not blown out.
 *   player hue    -> hueCentroid: circular mean hue per field, so all six
 *                    player colours can be checked for being distinct.
 *   anti-aliasing -> edgeSoftPx: intermediate-luminance pixels along a centre
 *                    scanline, which is exactly what a hard mask lacks.
 *
 * Load /plasma-visual.html while `vite` runs. Not part of the game build.
 */

import Phaser from 'phaser';
import { PlasmaField } from './plasma-field';
import type { GroupHandle } from './engine/types';

const log = document.getElementById('log') as HTMLElement;
const lines: string[] = [];
function say(msg: string) {
	lines.push(msg);
	log.textContent = lines.join('\n');
}

class VisualScene extends Phaser.Scene {
	constructor() {
		super('plasmaVisual');
	}
	create() {
		void boot(this.game);
	}
}

const HUES = [0, 60, 120, 180, 240, 300];
const SCALE = 1.25;
const W = 192;
const H = 256;
// Fields display at W * SCALE px wide. Spacing must clear that or neighbours
// bleed into each other through ADD blending and every luminance metric below
// reads high -- which previously made the CPU path look ~2x the shader.
const COL_W = Math.ceil(W * SCALE) + 56;
const TOP_Y = 190;
const BOT_Y = 580;

const game = new Phaser.Game({
	width: HUES.length * COL_W + 200,
	height: 820,
	type: Phaser.AUTO,
	parent: 'host',
	backgroundColor: '#12203a',
	preserveDrawingBuffer: true,
	scene: VisualScene,
});

let cpuFields: PlasmaField[] = [];
let gpuFields: PlasmaField[] = [];

type Hack = {
	time: number;
	draw(): void;
	setPlasmaFraction(fraction: number): void;
	sprite: { visible: boolean; y: number; scale: { set(x: number, y: number): void } };
};

const win = window as unknown as Record<string, unknown>;

async function boot(game: Phaser.Game) {
	const scene = game.scene.getScene('plasmaVisual');
	if (!scene) {
		ready();
		return;
	}

	try {
		const { Phaser4Engine } = await import('./engine/Phaser4Engine');
		const engine = new Phaser4Engine(game, scene);

		// A DARK checkerboard, like the real board. A light one was a mistake: additive
		// light clipped every channel to 255, so the per-channel difference used
		// for the hue metric no longer reflected the plasma's own colour.
		const bg = scene.add.graphics();
		for (let y = 0; y < 820; y += 16) {
			for (let x = 0; x < 1200; x += 16) {
				const on = ((x / 16 + y / 16) | 0) % 2 === 0;
				bg.fillStyle(on ? 0x2b3d55 : 0x16202f, 1);
				bg.fillRect(x, y, 16, 16);
			}
		}

		const display = engine.add.group(undefined, 'displayGroup') as GroupHandle;
		const creatureGrp = engine.add.group(display, 'creatureGrp') as GroupHandle;

		gpuFields = [];
		cpuFields = [];

		for (let i = 0; i < HUES.length; i++) {
			const x = 100 + i * COL_W;

			const gpu = new PlasmaField(engine, x, TOP_Y, {
				parent: creatureGrp,
				hueShift: HUES[i],
				surfaceSource: { textures: scene.textures },
			});
			gpu.setVisible(false);
			gpuFields.push(gpu);

			// staticMode is what selects the CPU path.
			const cpu = new PlasmaField(engine, x, BOT_Y, {
				parent: creatureGrp,
				hueShift: HUES[i],
				staticMode: true,
				surfaceSource: { textures: scene.textures },
			});
			cpuFields.push(cpu);

			for (const f of [gpu, cpu]) {
				(f.sprite as unknown as Hack['sprite']).scale.set(SCALE, SCALE);
			}
		}

		say(`gpu usesShader=${gpuFields.map((f) => f.usesShader).join(',')}`);
		say(`cpu usesShader=${cpuFields.map((f) => f.usesShader).join(',')}`);

		/** Drive both paths to an explicit time so they stay comparable. */
		const renderAt = (t: number) => {
			for (const f of cpuFields) {
				const h = f as unknown as Hack;
				h.time = t;
				h.draw();
			}
			for (const f of gpuFields) {
				const h = f as unknown as Hack;
				h.time = t - 1 / 24;
				(f as unknown as { tick: () => void }).tick();
				h.sprite.visible = true;
			}
		};
		win.renderAt = renderAt;

		/**
		 * Capture the same instant twice -- once with every field visible, once
		 * with all hidden -- so the transparency ratio compares like with like
		 * instead of a frame against itself.
		 *
		 * Reads must wait for real frames: Phaser composites on its own rAF, so
		 * grabbing synchronously after a state change returns the *previous*
		 * frame, which silently made every field look invisible.
		 */
		win.measureAll = async () => {
			renderAt(2.5);
			await frames(3);
			const live = grab();

			for (const f of [...gpuFields, ...cpuFields]) {
				(f as unknown as Hack).sprite.visible = false;
			}
			await frames(3);
			const bare = grab();
			for (const f of [...gpuFields, ...cpuFields]) {
				(f as unknown as Hack).sprite.visible = true;
			}
			await frames(2);

			const gpu = [] as unknown[];
			const cpu = [] as unknown[];
			const same = [] as unknown[];
			for (let i = 0; i < HUES.length; i++) {
				const x = 100 + i * COL_W;
				gpu.push(metrics(live, bare, x, TOP_Y, HUES[i]));
				cpu.push(metrics(live, bare, x, BOT_Y, HUES[i]));
			}

			// Same path, same place: measure the CPU fields while they sit on the
			// GPU row. If GPU and CPU agree here but not on their own rows, the
			// difference is positional rather than a shading bug.
			const homes = cpuFields.map((f) => (f as unknown as Hack).sprite.y);
			for (let i = 0; i < HUES.length; i++) {
				const f = cpuFields[i] as unknown as Hack;
				f.sprite.visible = false;
				f.sprite.y = TOP_Y;
				f.time = 2.5;
				f.draw();
				f.sprite.visible = true;
			}
			await frames(3);
			const cpuAtTop = grab();
			for (let i = 0; i < HUES.length; i++) {
				same.push(metrics(cpuAtTop, bare, 100 + i * COL_W, TOP_Y, HUES[i]));
				const f = cpuFields[i] as unknown as Hack;
				f.sprite.visible = false;
				f.sprite.y = homes[i];
				f.time = 2.5;
				f.draw();
				f.sprite.visible = true;
			}
			await frames(2);

			return { gpu, cpu, same };
		};

		/**
		 * Per-pixel CPU/GPU parity. The two rows sit at different screen
		 * positions, so diffing them directly compares two different fields.
		 * Instead a CPU field is temporarily moved onto a GPU field's spot, so
		 * both paths render the identical rect and can be compared directly.
		 */
		win.parity = async (fractions?: number[]) => {
			// Band weight is a per-field uniform driven by remaining plasma, so
			// parity has to hold across the whole range and not just at a full
			// tank. Default to a sweep; callers pass explicit values to pin one.
			const levels = fractions && fractions.length ? fractions : [0, 0.25, 0.5, 0.75, 1];
			const res = [] as unknown[];
			for (const frac of levels) {
				for (let i = 0; i < HUES.length; i++) {
					const x = 100 + i * COL_W;
					const gpu = gpuFields[i] as unknown as Hack;
					const cpu = cpuFields[i] as unknown as Hack;
					const cpuHomeY = cpu.sprite.y;
					gpu.setPlasmaFraction(frac);
					cpu.setPlasmaFraction(frac);

					// GPU alone at (x, TOP_Y).
					for (const f of [...gpuFields, ...cpuFields]) f.sprite.visible = false;
					gpu.sprite.visible = true;
					renderGpuOnly(i);
					await frames(3);
					const gpuImg = grab();

					// CPU alone, moved to the very same rect.
					for (const f of [...gpuFields, ...cpuFields]) f.sprite.visible = false;
					cpu.sprite.visible = true;
					cpu.sprite.y = TOP_Y;
					cpu.time = 2.5;
					cpu.draw();
					await frames(3);
					const cpuImg = grab();

					cpu.sprite.y = cpuHomeY;
					res.push({ ...rectDiff(cpuImg, gpuImg, x, TOP_Y, HUES[i]), frac });
				}
			}
			for (const f of [...gpuFields, ...cpuFields]) f.sprite.visible = true;
			for (const f of [...gpuFields, ...cpuFields]) (f as unknown as Hack).setPlasmaFraction(1);
			return res;
		};

		/**
		 * Peak band brightness across the plasma range, to confirm the field
		 * actually gets visibly thinner as plasma is spent rather than just
		 * dimmer (and that it still renders at all at zero).
		 */
		win.plasmaSweep = async () => {
			const out = [] as unknown[];
			for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
				for (const f of [...gpuFields, ...cpuFields]) f.setPlasmaFraction(frac);
				// Reuse the thickness probe rather than duplicating its scanline
				// maths, so both report peak band brightness the same way.
				const t = (await (win.profile as () => Promise<Record<string, unknown>>)()) as Record<
					string,
					{ peakAdded: number; visibleSamples: number }
				>;
				out.push({ frac, gpu: t.gpuThickness, cpu: t.cpuThickness });
			}
			for (const f of [...gpuFields, ...cpuFields]) f.setPlasmaFraction(1);
			return out;
		};

		/** Put only GPU field `i` on screen, at the sample time. */
		function renderGpuOnly(i: number) {
			const g = gpuFields[i] as unknown as Hack;
			g.time = 2.5 - 1 / 24;
			(gpuFields[i] as unknown as { tick: () => void }).tick();
			g.sprite.visible = true;
		}

		scene.time.delayedCall(120, () => {
			renderAt(2.5);
			ready();
		});

		/**
		 * Luminance profile down the vertical centre line, for the GPU path and
		 * the CPU path rendered at the same spot. Shows where the two diverge
		 * instead of only their averages.
		 */
		win.profile = async () => {
			const g = gpuFields[0] as unknown as Hack;
			const c = cpuFields[0] as unknown as Hack;
			const cHome = c.sprite.y;

			// bare board first, then each path alone. Kept in this order because it
			// is the only sequencing whose captures have actually matched what is on
			// screen; toggling visibility repeatedly and re-reading drifted out of
			// sync with the renderer.
			for (const f of [...gpuFields, ...cpuFields]) f.sprite.visible = false;
			await frames(3);
			const bareImg = grab();

			gpuFields.forEach((f) => {
				const h = f as unknown as Hack;
				h.time = 2.5 - 1 / 24;
				(f as unknown as { tick: () => void }).tick();
				h.sprite.visible = true;
			});
			await frames(3);
			const gpuImg = grab();

			for (const f of gpuFields) (f as unknown as Hack).sprite.visible = false;
			cpuFields.forEach((f) => {
				const h = f as unknown as Hack;
				h.time = 2.5;
				h.draw();
				h.sprite.visible = true;
			});
			await frames(3);
			const cpuImg = grab();

			// Each row is scanned at its own centre: the GPU fields sit on the top
			// row and the CPU fields on the bottom one.
			const line = (img: Img | null, cy: number) => {
				if (!img) return [] as number[];
				const out: number[] = [];
				for (let k = 0; k <= 20; k++) {
					const y = Math.round(cy - (H * SCALE) / 2 + (k / 20) * H * SCALE);
					out.push(Number(lum(img, 100, y).toFixed(1)));
				}
				return out;
			};

			/**
			 * Apparent line thickness, measured as ADDED luminance over the bare
			 * board with a fixed threshold rather than one relative to each path's
			 * own peak. A relative threshold flatters the dimmer path, because a
			 * dim shield needs the same *ratio* to stay visible while reading as
			 * thinner. An absolute cut measures what the eye actually sees.
			 */
			const thickness = (withField: Img | null, bare: Img | null, cy: number) => {
				if (!withField || !bare) return { visible: 0, runs: 0, meanRunLen: 0, peakAdded: 0 };
				const THRESH = 20;
				const added: number[] = [];
				let peakAdded = 0;
				for (let k = 0; k <= 20; k++) {
					const y = Math.round(cy - (H * SCALE) / 2 + (k / 20) * H * SCALE);
					const d = lum(withField, 100, y) - lum(bare, 100, y);
					added.push(d);
					if (d > peakAdded) peakAdded = d;
				}
				let visible = 0;
				let runs = 0;
				let inRun = false;
				let runLen = 0;
				let runTotal = 0;
				for (const d of added) {
					if (d > THRESH) {
						visible++;
						if (!inRun) {
							inRun = true;
							runLen = 0;
							runs++;
						}
						runLen++;
					} else if (inRun) {
						runTotal += runLen;
						inRun = false;
					}
				}
				if (inRun) runTotal += runLen;
				return {
					visibleSamples: visible,
					runs,
					meanRunLen: runs ? Number((runTotal / runs).toFixed(2)) : 0,
					peakAdded: Number(peakAdded.toFixed(1)),
				};
			};

			return {
				gpu: line(gpuImg, TOP_Y),
				cpu: line(cpuImg, BOT_Y),
				gpuThickness: thickness(gpuImg, bareImg, TOP_Y),
				cpuThickness: thickness(cpuImg, bareImg, BOT_Y),
			};
		};

		/**
		 * * * *
		 * Controlled blend probe.
		 *
		 * Phaser's ADD blend mode is srcFactor = ONE, so a fragment's own alpha is
		 * discarded unless something premultiplies it first. Whether Phaser's Shader
		 * pipeline does that is not documented, and guessing wrong is what made the
		 * shield render either washed out or too thin.
		 *
		 * This renders a quad with a *constant* known output and measures how much
		 * light actually lands on the backdrop:
		 *   straight output, no premultiply anywhere -> added ~= full
		 *   premultiplied once                     -> added ~= full * alpha
		 *   premultiplied twice                     -> added ~= full * alpha^2
		 * The measured ratios distinguish the three unambiguously.
		 *
		 * Returns added luminance for alpha 1.0, 0.5 and 0.25 over a dark board.
		 */
		win.probeBlend = async () => {
			const SPAN = 60;
			const probeShader = (alpha: number) => `
precision highp float;
varying vec2 outTexCoord;
void main(void) {
    gl_FragColor = vec4(1.0, 1.0, 1.0, ${alpha.toFixed(4)});
}
`;
			const results: Record<string, number> = {};

			for (const alpha of [1.0, 0.5, 0.25]) {
				const quad = engine.add.shader(
					{
						name: 'probe' + alpha,
						fragmentSource: probeShader(alpha),
					},
					300,
					400,
					SPAN,
					SPAN,
				);
				await frames(3);
				const on = grab();

				quad.destroy();
				await frames(3);
				const off = grab();

				// Sample the middle of where the quad was.
				let sum = 0;
				let n = 0;
				for (let y = 385; y < 415; y++) {
					for (let x = 285; x < 315; x++) {
						sum += lum(on!, x, y) - lum(off!, x, y);
						n++;
					}
				}
				results['a' + alpha] = Number((sum / n).toFixed(2));
			}
			return results;
		};

		/**
		 * Alpha-convention probe for the CPU path.
		 *
		 * Setting `transparency` to 0 forces every pixel's alpha to 0 while leaving the
		 * colour untouched. That splits the two possible conventions apart:
		 *   premultiplied texture (rgb already folded with alpha) -> output goes black
		 *   straight colour, alpha ignored by ADD's ONE factor   -> output unchanged
		 *
		 * The GPU field is measured the same way, so the two conventions can be compared
		 * directly instead of inferred from mismatched brightness.
		 */
		win.probeAlpha = async () => {
			const sampleBox = (a: Img | null, b: Img | null, cx: number, cy: number) => {
				if (!a || !b) return 0;
				return Number(
					(meanLum(a, cx - 40, cy - 55, 80, 110) - meanLum(b, cx - 40, cy - 55, 80, 110)).toFixed(
						2,
					),
				);
			};

			const measure = async () => {
				renderAt(2.5);
				await frames(3);
				const live = grab();
				for (const f of [...gpuFields, ...cpuFields]) {
					(f as unknown as Hack).sprite.visible = false;
				}
				await frames(3);
				const bare = grab();
				for (const f of [...gpuFields, ...cpuFields]) {
					(f as unknown as Hack).sprite.visible = true;
				}
				return { live, bare };
			};

			const normal = await measure();
			const out: Record<string, number> = {};
			out.gpuNormal = sampleBox(normal.live, normal.bare, 100, TOP_Y);
			out.cpuNormal = sampleBox(normal.live, normal.bare, 100, BOT_Y);

			// transparency = 0 => alpha forced to 0, colour unchanged.
			cpuFields.forEach((f) => f.set('transparency', 0));
			gpuFields.forEach((f) => f.set('transparency', 0));
			const zeroed = await measure();
			out.gpuZeroAlpha = sampleBox(zeroed.live, zeroed.bare, 100, TOP_Y);
			out.cpuZeroAlpha = sampleBox(zeroed.live, zeroed.bare, 100, BOT_Y);

			// Half alpha discriminates the two blending conventions. Under ADD the
			// blend factor is ONE, so the only thing that can scale the result is
			// whether the texture itself stores premultiplied colour:
			//   premultiplied   -> brightness scales with alpha (half at 0.5)
			//   not premultiplied -> alpha is ignored entirely (unchanged at 0.5)
			// The shader always premultiplies, so it must agree with whichever
			// convention the CPU path actually gets.
			cpuFields.forEach((f) => f.set('transparency', 0.5));
			gpuFields.forEach((f) => f.set('transparency', 0.5));
			const halved = await measure();
			out.gpuHalfAlpha = sampleBox(halved.live, halved.bare, 100, TOP_Y);
			out.cpuHalfAlpha = sampleBox(halved.live, halved.bare, 100, BOT_Y);

			cpuFields.forEach((f) => f.set('transparency', 1));
			gpuFields.forEach((f) => f.set('transparency', 1));
			return out;
		};

		/**
		 * Scene-graph diagnostics. A quad left in the scene display list *and*
		 * added to a container renders twice, which shows up as a mysteriously
		 * brighter field rather than an obvious error.
		 */
		win.diag = () => {
			const list = scene.children.list as unknown as Array<Record<string, unknown>>;
			const shaders = list.filter((o) => o.type === 'Shader');
			const g = gpuFields[0] as unknown as Hack & {
				sprite: { x: number; y: number; parentContainer?: unknown };
			};
			const q = g.sprite as unknown as {
				width: number;
				height: number;
				displayWidth: number;
				displayHeight: number;
				scaleX: number;
				scaleY: number;
				originX: number;
				originY: number;
			};
			const cpuSprite = (cpuFields[0] as unknown as Hack).sprite as unknown as {
				width: number;
				height: number;
				displayWidth: number;
				displayHeight: number;
				scaleX: number;
				originX: number;
			};
			return {
				sceneChildCount: list.length,
				shaderInSceneRoot: shaders.length,
				quad0: {
					x: g.sprite.x,
					y: g.sprite.y,
					width: q.width,
					height: q.height,
					displayWidth: q.displayWidth,
					displayHeight: q.displayHeight,
					scaleX: q.scaleX,
					originX: q.originX,
					originY: q.originY,
				},
				cpuSprite0: {
					width: cpuSprite.width,
					height: cpuSprite.height,
					displayWidth: cpuSprite.displayWidth,
					displayHeight: cpuSprite.displayHeight,
					scaleX: cpuSprite.scaleX,
					originX: cpuSprite.originX,
				},
				quad0InContainer: Boolean(g.sprite.parentContainer),
				displayChildren: (display as unknown as { children: unknown[] }).children.length,
			};
		};
	} catch (err) {
		say('ERROR: ' + (err as Error).message);
		say((err as Error).stack ?? '');
		ready();
	}
}

type Img = { w: number; h: number; data: Uint8ClampedArray };

/** Wait for n real animation frames so Phaser has actually composited. */
function frames(n: number): Promise<void> {
	return new Promise((resolve) => {
		let left = n;
		const tick = () => {
			if (left-- <= 0) {
				resolve();
				return;
			}
			requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	});
}

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

function lum(img: Img, x: number, y: number): number {
	const i = (y * img.w + x) * 4;
	return 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
}

function meanLum(img: Img, x0: number, y0: number, w: number, h: number): number {
	let sum = 0;
	let n = 0;
	for (let y = y0; y < y0 + h; y++) {
		for (let x = x0; x < x0 + w; x++) {
			if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
			sum += lum(img, x, y);
			n++;
		}
	}
	return n ? sum / n : 0;
}

function spread(img: Img, x0: number, y0: number, w: number, h: number): number {
	const vals: number[] = [];
	for (let y = y0; y < y0 + h; y++) {
		for (let x = x0; x < x0 + w; x++) {
			if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
			vals.push(lum(img, x, y));
		}
	}
	if (vals.length < 8) return 0;
	const m = vals.reduce((a, b) => a + b, 0) / vals.length;
	return Math.sqrt(vals.reduce((a, b) => a + (b - m) * (b - m), 0) / vals.length);
}

/** The four look metrics for one field, from a live frame plus its bare twin. */
function metrics(
	live: Img | null,
	bare: Img | null,
	cx: number,
	cy: number,
	hue: number,
): Record<string, number> {
	if (!live || !bare) return { hue, error: 1 };
	const halfW = (W * SCALE) / 2;
	const halfH = (H * SCALE) / 2;
	const x0 = Math.round(cx - halfW);
	const y0 = Math.round(cy - halfH);

	// Transparency has two halves and the shield needs both:
	//  - contrastSurvival: the backdrop's pattern must still be readable.
	//  - addedLum: how much light the shield dumps into the region. Surviving
	//    contrast is useless if the shield floods the area with its own glow,
	//    which is what "can't see behind it" actually looks like.
	const bx = Math.round(cx - 40);
	const by = Math.round(cy - 55);
	const liveSpread = spread(live, bx, by, 80, 110);
	const bareSpread = spread(bare, bx, by, 80, 110);
	const contrastSurvival = bareSpread > 1 ? liveSpread / bareSpread : 0;
	const addedLum = meanLum(live, bx, by, 80, 110) - meanLum(bare, bx, by, 80, 110);

	// White crests and mean hue over lit pixels.
	let lit = 0;
	let white = 0;
	let hx = 0;
	let hy = 0;
	let hueN = 0;
	for (let y = y0; y < y0 + H * SCALE; y++) {
		for (let x = x0; x < x0 + W * SCALE; x++) {
			if (x < 0 || y < 0 || x >= live.w || y >= live.h) continue;
			const i = (y * live.w + x) * 4;
			const r = live.data[i];
			const g = live.data[i + 1];
			const b = live.data[i + 2];
			// Compare against the same pixel in the bare frame, so only what the
			// shield itself contributed is counted as lit -- and take the hue from
			// that ADDED colour. Taking it from the composite measures the blue
			// checkerboard showing through, not the plasma.
			const j = (y * bare.w + x) * 4;
			const ar = Math.max(0, r - bare.data[j]);
			const ag = Math.max(0, g - bare.data[j + 1]);
			const ab = Math.max(0, b - bare.data[j + 2]);
			const added = ar + ag + ab;
			if (added < 25) continue;
			lit++;
			if (ar > 150 && ag > 150 && ab > 150) white++;
			// Hue is only meaningful on saturated pixels. Including near-white
			// pixels drags every centroid toward 0deg, because a white pixel's hue
			// is undefined and resolves to red in this formula.
			const max = Math.max(ar, ag, ab);
			const min = Math.min(ar, ag, ab);
			if (max - min < 30) continue;
			const rad = (Math.atan2(Math.sqrt(3) * (ag - ab), 2 * ar - ag - ab) * Math.PI) / 180;
			hx += Math.cos(rad);
			hy += Math.sin(rad);
			hueN++;
		}
	}
	let hueCentroid = hueN > 0 ? (Math.atan2(hy, hx) * 180) / Math.PI : -1;
	if (hueCentroid < 0) hueCentroid += 360;

	// Anti-aliasing: intermediate values along a centre scanline mean the
	// silhouette ramps rather than steps.
	const sy = Math.round(cy);
	const prof: number[] = [];
	for (let x = x0; x < x0 + W * SCALE; x++) {
		if (x < 0 || sy < 0 || x >= live.w || sy >= live.h) continue;
		prof.push(lum(live, x, sy));
	}
	const peak = prof.length ? Math.max(...prof) : 0;
	const low = prof.length ? Math.min(...prof) : 0;
	let edgeSoftPx = 0;
	for (const v of prof) {
		const n = (v - low) / Math.max(1, peak - low);
		if (n > 0.12 && n < 0.88) edgeSoftPx++;
	}

	// Corner transparency: the quad's outer corners sit outside the plasma
	// ellipse, where alpha is ~0. Anything added there means the path is not
	// premultiplying, which is what floods the shield's interior with colour.
	const corner = [0, 0, 1, 1].map(() => 0);
	let cornerN = 0;
	for (const [ox, oy] of [
		[10, 10],
		[W * SCALE - 20, 10],
		[10, H * SCALE - 20],
		[W * SCALE - 20, H * SCALE - 20],
	]) {
		for (let y = Math.round(cy - halfH + oy); y < Math.round(cy - halfH + oy + 14); y++) {
			for (let x = Math.round(cx - halfW + ox); x < Math.round(cx - halfW + ox + 14); x++) {
				if (x < 0 || y < 0 || x >= live.w || y >= live.h) continue;
				corner[0] += lum(live, x, y) - lum(bare, x, y);
				cornerN++;
			}
		}
	}
	const cornerAdded = cornerN ? corner[0] / cornerN : 0;

	return {
		hue,
		lit,
		hueN,
		contrastSurvival: Number(contrastSurvival.toFixed(3)),
		addedLum: Number(addedLum.toFixed(1)),
		cornerAdded: Number(cornerAdded.toFixed(2)),
		whiteFrac: lit ? Number((white / lit).toFixed(3)) : 0,
		hueCentroid: Number(hueCentroid.toFixed(1)),
		edgeSoftPx,
	};
}

/** Max/mean per-pixel difference between two captures over a field's rect. */
function rectDiff(
	a: Img | null,
	b: Img | null,
	cx: number,
	cy: number,
	hue: number,
): Record<string, unknown> {
	if (!a || !b) return { hue, error: 1 };
	const halfW = (W * SCALE) / 2;
	const halfH = (H * SCALE) / 2;
	let max = 0;
	let sum = 0;
	let n = 0;
	let maxAt = { x: 0, y: 0, ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0 };
	const fx0 = Math.round(cx - halfW);
	const fy0 = Math.round(cy - halfH);
	for (let y = fy0; y < cy + halfH; y++) {
		for (let x = fx0; x < cx + halfW; x++) {
			if (x < 0 || y < 0 || x >= a.w || y >= a.h) continue;
			const i = (y * a.w + x) * 4;
			const d =
				Math.abs(a.data[i] - b.data[i]) +
				Math.abs(a.data[i + 1] - b.data[i + 1]) +
				Math.abs(a.data[i + 2] - b.data[i + 2]);
			if (d > max) {
				max = d;
				maxAt = {
					x: x - fx0,
					y: y - fy0,
					ax: a.data[i],
					ay: a.data[i + 1],
					az: a.data[i + 2],
					bx: b.data[i],
					by: b.data[i + 1],
					bz: b.data[i + 2],
				};
			}
			sum += d;
			n++;
		}
	}
	// Centre and quarter-height samples, to compare tone rather than averages.
	const at = (img: Img, fx: number, fy: number) => {
		const x = fx0 + Math.round(fx);
		const y = fy0 + Math.round(fy);
		const i = (y * img.w + x) * 4;
		return [img.data[i], img.data[i + 1], img.data[i + 2]];
	};
	const cA = at(a, (W * SCALE) / 2, (H * SCALE) / 2);
	const cB = at(b, (W * SCALE) / 2, (H * SCALE) / 2);
	const qA = at(a, (W * SCALE) / 2, (H * SCALE) / 4);
	const qB = at(b, (W * SCALE) / 2, (H * SCALE) / 4);

	return {
		hue,
		maxDiff: max,
		meanDiff: n ? Number((sum / n).toFixed(3)) : 0,
		px: n,
		rect: [Math.round(W * SCALE), Math.round(H * SCALE)],
		maxAt,
		centreCpu: cA,
		centreGpu: cB,
		quarterCpu: qA,
		quarterGpu: qB,
	};
}

function ready() {
	win.__plasmaReady = true;
}

win.__plasmaLog = () => lines.join('\n');
