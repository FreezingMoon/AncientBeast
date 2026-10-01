import { Phaser4Engine } from '../../engine/Phaser4Engine';

/**
 * Minimal stand-in for the bits of Phaser 4's `TweenChain` that `TweenAdapter`
 * depends on. The real chain initialises as soon as `scene.tweens.chain()` is
 * called and `setCurrentTween(0)` dereferences `data[0]`, which is what used to
 * throw for a chain built with no tween configs.
 */
const createChainFactory = () => {
	const built: Array<Record<string, unknown>> = [];
	const played: Array<unknown> = [];
	const state = { inits: 0 };

	const chain = (config: { tweens?: unknown[] }) => {
		const instance = {
			data: [] as unknown[],
			// Mirrors Phaser: `setCurrentTween(0)` runs during init, before any
			// caller-supplied `add()` could have populated `data`.
			init() {
				const current = this.data[0] as { setActiveState: () => void } | undefined;
				if (!current) {
					throw new TypeError(
						'can\'t access property "setActiveState", this.currentTween is undefined',
					);
				}
				current.setActiveState();
			},
			add(tweens: unknown[]) {
				// Real Phaser runs each config through `TweenBuilder` before adding.
				this.data.push(
					...(tweens as Array<Record<string, unknown>>).map((cfg) => ({
						...cfg,
						reset() {
							return this;
						},
						setActiveState() {
							state.inits += 1;
						},
					})),
				);
			},
			play() {
				played.push(instance);
				this.init();
			},
			stop() {},
			destroy() {},
			on() {},
			once() {},
		};
		const tweens = config.tweens;
		if (Array.isArray(tweens)) {
			instance.add(tweens);
		}
		instance.init();
		built.push({ tweens });
		return instance;
	};

	return { chain, built, played, state };
};

const createEngine = () => {
	const { chain, built, played, state } = createChainFactory();
	const scene = {
		tweens: {
			chain,
			add: (config: { targets: unknown }) => ({
				targets: config.targets,
				stop() {},
				destroy() {},
			}),
		},
	};
	return {
		engine: new Phaser4Engine({} as never, scene as unknown as Phaser.Scene),
		built,
		played,
		state,
	};
};

describe('TweenAdapter chain construction', () => {
	test('supplying tween configs up front keeps init from dereferencing empty data', () => {
		const { engine, built, state } = createEngine();
		const target = { alpha: 1 };

		// The exact `CreatureSprite._promisifyTween` sequence.
		const tween = engine.tween(target).to({ alpha: 0.5 }, 200);
		tween.onComplete.add(() => {});
		tween.start();

		expect(built).toHaveLength(1);
		expect(built[0].tweens).toHaveLength(1);
		// The head tween really was activated, not silently skipped.
		expect(state.inits).toBeGreaterThanOrEqual(1);
	});

	test('a chain with no steps does not throw', () => {
		const { engine, built } = createEngine();

		const tween = engine.tween({ alpha: 1 });

		expect(() => tween.start()).not.toThrow();
		expect(() => tween.stop()).not.toThrow();
		expect(built).toHaveLength(0);
	});

	test('attaching a callback before any step does not throw', () => {
		const { engine } = createEngine();
		const tween = engine.tween({ alpha: 1 });

		expect(() => tween.onComplete.add(() => {})).not.toThrow();
		expect(() => tween.onUpdateCallback(() => {})).not.toThrow();
	});

	test('a lone `.to()` with autoStart builds and plays on a fresh adapter', () => {
		const { engine, built, played } = createEngine();

		// No chain existed yet, so guarding on `this.chain` used to record the
		// step and never play it. The Infernal cardboard breathing tween was the
		// casualty: it never ran, leaving the cardboard pinned at full opacity.
		engine.tween({ alpha: 1 }).to({ alpha: 0.86 }, 1000, undefined, true);
		expect(built).toHaveLength(1);
		expect(built[0].tweens).toHaveLength(1);
		expect(played).toHaveLength(1);
	});

	test('a `.to()` with autoStart disabled waits for an explicit start', () => {
		const { engine, built, played } = createEngine();

		engine.tween({ alpha: 1 }).to({ alpha: 0.86 }, 1000, undefined, false);
		expect(built).toHaveLength(0);
		expect(played).toHaveLength(0);
	});

	test('multiple steps are chained in order', () => {
		const { engine, built } = createEngine();
		const target = { alpha: 1, x: 0 };

		const tween = engine.tween(target);
		tween.to({ alpha: 0.5 }, 100);
		tween.to({ x: 10 }, 200);
		tween.start();

		// Each auto-starting step rebuilds, so the last build is the complete chain.
		const tweens = built[built.length - 1].tweens as Array<Record<string, unknown>>;
		expect(tweens).toHaveLength(2);
		expect(tweens[0].alpha).toBe(0.5);
		expect(tweens[1].x).toBe(10);
		// Every step tween keeps the original targets.
		expect(tweens[0].targets).toBe(target);
		expect(tweens[1].targets).toBe(target);
	});
});
