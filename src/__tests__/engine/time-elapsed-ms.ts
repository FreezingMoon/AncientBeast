import { Phaser4Engine } from '../../engine/Phaser4Engine';

const createEngine = () =>
	new Phaser4Engine({} as never, { time: { now: 1000 } } as unknown as Phaser.Scene);

describe('Phaser4Engine time parity with Phaser 2 CE', () => {
	test('elapsedMS reports the frame delta, not cumulative time', () => {
		// phaser-ce: `this.elapsedMS = this.time - previousDateNow` (src/time/Time.js).
		const engine = createEngine();

		engine.advanceClock(16);
		expect(engine.time.elapsedMS).toBe(16);

		// A steady 60fps must keep reporting ~16ms. Accumulating here instead
		// makes every caller that integrates the value run at 60x frame rate.
		engine.advanceClock(16);
		expect(engine.time.elapsedMS).toBe(16);
		engine.advanceClock(16);
		expect(engine.time.elapsedMS).toBe(16);
	});

	test('elapsedMS tracks the most recent delta when frame time varies', () => {
		const engine = createEngine();

		engine.advanceClock(33);
		expect(engine.time.elapsedMS).toBe(33);

		engine.advanceClock(8);
		expect(engine.time.elapsedMS).toBe(8);

		engine.advanceClock(250);
		expect(engine.time.elapsedMS).toBe(250);
	});

	test('a long session does not let elapsedMS grow without bound', () => {
		const engine = createEngine();

		// 60 seconds of 60fps frames. Cumulative timing would reach 60000 here and
		// pin the Infernal glow against its clamp, driving the pulse ~6x too fast.
		for (let frame = 0; frame < 3600; frame++) {
			engine.advanceClock(16);
		}

		expect(engine.time.elapsedMS).toBe(16);
	});
});
