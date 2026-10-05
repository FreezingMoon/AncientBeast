/*
 * Plasma Field show/hide fade.
 *
 * The fade lives inside `PlasmaField` rather than in the creature that owns one,
 * because the field is the thing that knows how it is drawn: on the CPU path
 * opacity is the sprite's `alpha`, while on the GPU path Phaser 4's `Shader` has
 * no Alpha component at all and opacity can only travel as `uAlpha`. A tween over
 * one of those and not the other would be silently ignored on one of the two
 * render paths.
 *
 * What these tests pin is the timing contract, which is not visible in a
 * screenshot: that hiding is deferred until the fade lands (the field has to stay
 * on the shared ticker for the whole fade, or nothing can drive the tween's
 * sibling — the burst decay), that a reversal resumes from the brightness on
 * screen instead of restarting, and that repeated calls do not restart a fade
 * already in flight.
 */

import { PlasmaField } from '../../plasma/field';
import type { GameEngine, TweenHandle } from '../../engine/types';

/**
 * A tween double that can be driven by hand.
 *
 * The chainable stubs elsewhere in the suite assert on what a caller *builds*;
 * a fade is only meaningfully testable if time can be pushed through it, so this
 * one records the start and end values, exposes `advance`/`finish`, and — like
 * Phaser's `killTweensOf` — can be dropped without completing.
 */
class FakeTween {
	/** Value the target held when the tween started. */
	from = 0;
	toValue = 0;
	duration = 0;
	easing: string | ((k: number) => number) | undefined;
	started = false;
	killed = false;
	private update: (() => void) | null = null;
	private completions: Array<() => void> = [];

	constructor(readonly target: { fade: number }) {}

	to(props: Record<string, number>, duration: number, easing?: string | ((k: number) => number)) {
		this.toValue = props.fade;
		this.duration = duration;
		this.easing = easing;
		return this;
	}

	onUpdateCallback(cb: (...args: unknown[]) => void) {
		this.update = cb as () => void;
		return this;
	}

	onComplete = {
		add: (cb: () => void) => this.completions.push(cb),
		addOnce: (cb: () => void) => this.completions.push(cb),
	};

	start() {
		this.started = true;
		// Phaser reads the start value when the tween starts, not when `to()` was
		// called — which is what lets a reversed fade pick up mid-dissolve brightness.
		this.from = this.target.fade;
		return this;
	}

	stop() {
		this.started = false;
		return this;
	}

	/** Run the tween to `progress` (0..1) of its duration, applying the ease. */
	advance(progress: number): void {
		const eased = typeof this.easing === 'function' ? this.easing(progress) : progress;
		this.target.fade = this.from + (this.toValue - this.from) * eased;
		this.update?.();
	}

	/** Run the tween to its end and dispatch its completion, as Phaser would. */
	finish(): void {
		this.advance(1);
		this.started = false;
		for (const cb of this.completions.splice(0)) cb();
	}

	get isRunning(): boolean {
		return this.started;
	}
}

/**
 * An engine that takes the GPU path, recording every uniform the field pushes.
 *
 * Phaser 4's `Shader` mixes in `BlendMode` but not `Alpha`, and `setAlpha()` on it
 * is a documented no-op — so the fade has to reach the screen as `uAlpha` on this
 * path. Reading the sprite's `alpha` here would assert nothing at all.
 */
function makeShaderEngine() {
	const base = makeEngine();
	const uniforms: Record<string, number> = {};
	const shader = {
		x: 0,
		y: 0,
		alpha: 1,
		visible: true,
		blendMode: 0,
		setOrigin: () => shader,
		setScale: () => shader,
		setUniform: (name: string, value: number | number[]) => {
			uniforms[name] = Array.isArray(value) ? value[0] : value;
		},
		destroy: () => undefined,
	};

	const engine = {
		world: base.engine.world,
		supportsShaders: true,
		add: {
			sprite: base.engine.add.sprite,
			shader: () => shader,
		},
		tween: base.engine.tween,
		removeTweensFrom: base.engine.removeTweensFrom,
	} as unknown as GameEngine;

	return { engine, shader, uniforms, tweens: base.tweens };
}

function makeEngine() {
	const tweens: FakeTween[] = [];
	const removed: unknown[] = [];
	const sprite = {
		x: 0,
		y: 0,
		alpha: 1,
		visible: true,
		key: 'surface',
		setOrigin: () => sprite,
		setScale: () => sprite,
		destroy: () => undefined,
	};
	const group = { add: () => undefined, children: [], total: 0 };

	const engine = {
		world: group,
		// No `add.shader`, so the field takes the CPU path. `uAlpha` is the GPU
		// equivalent of the same fade and is asserted through the uniform pushes
		// further down; the visibility timing is renderer-independent.
		supportsShaders: false,
		add: { sprite: () => sprite },
		tween: (target: { fade: number }) => {
			const tween = new FakeTween(target);
			tweens.push(tween);
			return tween as unknown as TweenHandle;
		},
		removeTweensFrom: (target: unknown) => {
			removed.push(target);
			for (const tween of tweens) {
				if (tween.target !== target) continue;
				tween.killed = true;
				tween.started = false;
			}
		},
	} as unknown as GameEngine;

	return { engine, sprite, tweens, removed };
}

/** The most recently started tween, which is the only one a field owns at a time. */
function liveTween(tweens: FakeTween[]): FakeTween {
	const live = tweens.filter((t) => !t.killed);
	return live[live.length - 1];
}

/** Private state, reached the way the visual harness reaches it. */
type Hack = {
	_fadeState: { fade: number };
	sprite: { alpha: number; visible: boolean };
};

describe('PlasmaField show/hide fade', () => {
	test('is born hidden and transparent, and fades up when shown', () => {
		const { engine, sprite, tweens } = makeEngine();
		const field = new PlasmaField(engine, 100, 200, { alpha: 0.8 });

		// Not merely transparent: hidden and off the shared ticker, so a field that
		// is created and never shown costs nothing.
		expect(sprite.visible).toBe(false);
		expect(sprite.alpha).toBe(0);

		field.setVisible(true);

		// Revealed before the fade begins — a still-hidden sprite renders nothing,
		// so fading in from invisible would animate an empty frame.
		expect(sprite.visible).toBe(true);
		expect(tweens).toHaveLength(1);
		expect(sprite.alpha).toBe(0);

		// Ends at the field's own alpha, not at 1: the fade scales the base alpha
		// rather than replacing it.
		liveTween(tweens).advance(1);
		expect(sprite.alpha).toBeCloseTo(0.8, 5);
	});

	test('brightens on an easing curve, not linearly', () => {
		const { engine, sprite, tweens } = makeEngine();
		const field = new PlasmaField(engine, 100, 200, { alpha: 0.8 });
		field.setVisible(true);

		liveTween(tweens).advance(0.5);
		// `Sinusoidal.Out`: most of the brightness arrives early, then it settles.
		// Linear would sit at exactly half the base alpha here.
		expect(sprite.alpha).toBeGreaterThan(0.8 * 0.5);
		expect(sprite.alpha).toBeLessThan(0.8);
	});

	test('keeps the field on screen for the whole fade-out, then hides it', () => {
		const { engine, sprite, tweens } = makeEngine();
		const field = new PlasmaField(engine, 100, 200);
		field.setVisible(true);
		liveTween(tweens).finish();

		field.setVisible(false);

		// Still visible, and still being redrawn: the tween is what dims it, so
		// hiding on the first frame would cut the collapse off before it began.
		expect(sprite.visible).toBe(true);
		expect(sprite.alpha).toBeGreaterThan(0);

		liveTween(tweens).advance(0.5);
		expect(sprite.visible).toBe(true);

		liveTween(tweens).finish();
		expect(sprite.alpha).toBeCloseTo(0, 5);
		expect(sprite.visible).toBe(false);
	});

	test('dimming is eased too, in the direction that suits a collapse', () => {
		const { engine, sprite, tweens } = makeEngine();
		const field = new PlasmaField(engine, 100, 200, { alpha: 0.8 });
		field.setVisible(true);
		liveTween(tweens).finish();
		const full = sprite.alpha;

		field.setVisible(false);
		liveTween(tweens).advance(0.5);

		// `Sinusoidal.In`: the slow half comes first, so more than half the
		// brightness is still there halfway through. An `Out` fade to zero would be
		// the opposite — it would spend most of its brightness in the opening
		// frames, while the shield is at its brightest and most noticeable, and read
		// as a flicker. Linear would land exactly on half.
		expect(sprite.alpha).toBeGreaterThan(full * 0.5);
		expect(sprite.alpha).toBeLessThan(full);
	});

	test('re-showing mid-dissolve resumes from the brightness on screen', () => {
		const { engine, sprite, tweens } = makeEngine();
		const field = new PlasmaField(engine, 100, 200, { alpha: 0.8 });
		field.setVisible(true);
		liveTween(tweens).finish();

		field.setVisible(false);
		liveTween(tweens).advance(0.5);
		const midway = (field as unknown as Hack)._fadeState.fade;

		field.setVisible(true);

		expect(sprite.visible).toBe(true);
		const fadeIn = liveTween(tweens);
		expect(fadeIn.from).toBeCloseTo(midway, 5);
		// The reversed fade-in finishing must not take the hide callback with it.
		fadeIn.finish();
		expect(sprite.visible).toBe(true);
	});

	test('repeated visibility calls do not restart a fade already in flight', () => {
		const { engine, sprite, tweens } = makeEngine();
		const field = new PlasmaField(engine, 100, 200);
		field.setVisible(true);
		liveTween(tweens).advance(0.5);
		const midway = sprite.alpha;

		// Hovering a priest's hex re-shows the shield many times a second.
		field.setVisible(true);
		field.setVisible(true);

		// No new tween, so the shield still settles instead of being held part-dim.
		expect(tweens).toHaveLength(1);
		expect(sprite.alpha).toBe(midway);
		liveTween(tweens).finish();
		expect(sprite.visible).toBe(true);
	});

	test('a show on an already-shown field does not dim it again', () => {
		const { engine, sprite, tweens } = makeEngine();
		const field = new PlasmaField(engine, 100, 200);
		field.setVisible(true);
		liveTween(tweens).finish();

		field.setVisible(true);

		expect(tweens).toHaveLength(1);
		expect(sprite.visible).toBe(true);
		expect(sprite.alpha).toBeGreaterThan(0);
	});

	test('hiding a field that was never shown hides it outright', () => {
		const { engine, sprite, tweens } = makeEngine();
		const field = new PlasmaField(engine, 100, 200);

		field.setVisible(false);

		// Nothing to dissolve, so nothing to wait for — and no tween to leave a
		// never-shown field registered on the shared ticker.
		expect(tweens).toHaveLength(0);
		expect(sprite.visible).toBe(false);
		expect(sprite.alpha).toBe(0);
	});

	test('the fade in and the fade out are the same duration', () => {
		const { engine, tweens } = makeEngine();
		const field = new PlasmaField(engine, 100, 200);

		field.setVisible(true);
		const fadeIn = liveTween(tweens);
		fadeIn.finish();

		field.setVisible(false);
		const fadeOut = liveTween(tweens);

		// One value drives both ends. They used to be tuned separately (240 in,
		// 320 out), and the mismatch made a hover-out feel slower than the hover-in
		// that undid it — the pair stopped reading as one motion. The *eases* still
		// differ by direction; only the duration is shared.
		expect(fadeOut.duration).toBe(fadeIn.duration);
		expect(fadeOut.duration).toBe(240);
	});

	test('a zero-duration fade toggles instantly, in both directions', () => {
		const { engine, sprite, tweens } = makeEngine();
		const field = new PlasmaField(engine, 100, 200, { fadeMs: 0 });

		field.setVisible(true);
		expect(tweens).toHaveLength(0);
		expect(sprite.visible).toBe(true);
		expect(sprite.alpha).toBeGreaterThan(0);

		const shown = sprite.alpha;
		field.setVisible(false);
		expect(tweens).toHaveLength(0);
		expect(sprite.alpha).toBe(0);
		expect(sprite.visible).toBe(false);
		expect(shown).toBeGreaterThan(0);
	});

	test('a deferred removal still settles when the field is hidden mid-burst', () => {
		const { engine, sprite, tweens } = makeEngine();
		const field = new PlasmaField(engine, 100, 200);
		field.setVisible(true);
		liveTween(tweens).finish();

		// What `removePlasmaShield` does when a block flash is playing: hand the
		// teardown to `onBurstEnd` instead of dropping the field on the floor.
		field.burst();
		let settled = 0;
		field.onBurstEnd = () => {
			settled++;
		};

		field.setVisible(false);

		// The burst has not decayed on its own — nothing has ticked — so the
		// callback cannot have fired yet.
		expect(settled).toBe(0);

		liveTween(tweens).finish();
		expect(settled).toBe(1);
		expect(sprite.visible).toBe(false);
	});

	test('destroying mid-fade drops the tween without completing it', () => {
		const { engine, tweens, removed } = makeEngine();
		const field = new PlasmaField(engine, 100, 200);
		field.setVisible(true);

		field.destroy();

		expect(removed).toHaveLength(1);
		// A completed tween would run the hide callback against a dead field.
		expect(tweens).toHaveLength(1);
		expect(tweens[0].killed).toBe(true);
		expect(tweens[0].started).toBe(false);
	});

	test('a baked static frame is never faded', () => {
		const { engine, sprite, tweens } = makeEngine();
		const field = new PlasmaField(engine, 100, 200, { staticMode: true });

		// `staticMode` bakes one frame and never animates, so a fade would leave
		// it permanently transparent instead of showing anything at all.
		expect(sprite.alpha).toBeGreaterThan(0);
		expect(sprite.visible).toBe(true);
		expect(tweens).toHaveLength(0);
		expect((field as unknown as Hack)._fadeState.fade).toBe(1);
	});

	test('the shader path fades through uAlpha, not through sprite alpha', () => {
		const { engine, uniforms, tweens } = makeShaderEngine();
		const field = new PlasmaField(engine, 100, 200, { alpha: 0.8 });
		expect(field.usesShader).toBe(true);

		field.setVisible(true);
		expect(uniforms.uAlpha).toBeCloseTo(0, 5);

		liveTween(tweens).advance(0.5);
		const midway = uniforms.uAlpha;
		expect(midway).toBeGreaterThan(0);
		expect(midway).toBeLessThan(0.8);

		liveTween(tweens).finish();
		expect(uniforms.uAlpha).toBeCloseTo(0.8, 5);

		field.setVisible(false);
		liveTween(tweens).finish();
		expect(uniforms.uAlpha).toBeCloseTo(0, 5);
	});

	test('the shader path still hides only once the fade lands', () => {
		const { engine, shader, uniforms, tweens } = makeShaderEngine();
		const field = new PlasmaField(engine, 100, 200);
		field.setVisible(true);
		liveTween(tweens).finish();

		field.setVisible(false);
		liveTween(tweens).advance(0.5);

		// A hidden shader quad renders nothing, so fading out of one that is already
		// hidden animates an empty frame and leaves the burst undecayed.
		expect(shader.visible).toBe(true);
		expect(uniforms.uAlpha).toBeGreaterThan(0);

		liveTween(tweens).finish();
		expect(uniforms.uAlpha).toBeCloseTo(0, 5);
		expect(shader.visible).toBe(false);
	});
});

describe('PlasmaField deferred teardown', () => {
	test('onHidden fires once the fade lands, not on the first frame', () => {
		const { engine, sprite, tweens } = makeEngine();
		const field = new PlasmaField(engine, 100, 200);
		field.setVisible(true);
		liveTween(tweens).finish();

		let hidden = 0;
		field.onHidden = () => {
			hidden++;
		};
		field.setVisible(false);

		// This is the whole point of the hook: `Creature.removePlasmaShield` uses it
		// to destroy the field *after* the collapse, so the priest acting no longer
		// pops its shield out of existence.
		expect(hidden).toBe(0);

		liveTween(tweens).advance(0.5);
		expect(hidden).toBe(0);

		liveTween(tweens).finish();
		expect(hidden).toBe(1);
		expect(sprite.visible).toBe(false);
	});

	test('onHidden fires for an instant hide too', () => {
		const { engine, tweens } = makeEngine();
		const field = new PlasmaField(engine, 100, 200, { fadeMs: 0 });

		let hidden = 0;
		field.onHidden = () => {
			hidden++;
		};
		field.setVisible(false);

		// Hiding a field that was never shown skips the tween entirely, so a
		// teardown waiting on `onHidden` would otherwise never run.
		expect(hidden).toBe(1);
		expect(tweens).toHaveLength(0);
	});

	test('showing the field again cancels a queued teardown', () => {
		const { engine, sprite, tweens } = makeEngine();
		const field = new PlasmaField(engine, 100, 200);
		field.setVisible(true);
		liveTween(tweens).finish();

		field.onHidden = () => field.destroy();
		field.setVisible(false);
		liveTween(tweens).advance(0.5);

		// The player hovered the priest back before the fade finished.
		field.setVisible(true);
		liveTween(tweens).finish();

		expect(sprite.visible).toBe(true);
		expect(tweens.filter((t) => !t.killed)).toHaveLength(1);
	});

	test('a hide deferred behind a burst still settles', () => {
		const { engine, sprite, tweens } = makeEngine();
		const field = new PlasmaField(engine, 100, 200);
		field.setVisible(true);
		liveTween(tweens).finish();

		// A block flash is playing, so the field must stay on the shared ticker for
		// the whole fade for the burst to decay at all.
		field.burst();
		field.onBurstEnd = () => {
			field.onHidden?.();
		};
		field.onHidden = () => field.destroy();
		field.setVisible(false);

		expect(sprite.visible).toBe(true);
		liveTween(tweens).finish();

		// `_hideNow` snaps the still-lit burst, which fires `onBurstEnd`, which
		// hands over to `onHidden` — so the deferred teardown still lands.
		expect(sprite.visible).toBe(false);
	});

	test('destroying clears onHidden, so a dead field cannot fire it', () => {
		const { engine, tweens } = makeEngine();
		const field = new PlasmaField(engine, 100, 200);
		field.setVisible(true);
		liveTween(tweens).finish();

		let hidden = 0;
		field.onHidden = () => {
			hidden++;
		};
		field.destroy();

		expect(hidden).toBe(0);
		expect(field.onHidden).toBeNull();
	});
});
