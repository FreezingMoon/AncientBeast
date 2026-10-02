/**
 * Cover for AB's camera shake over Phaser 4's `Camera`.
 *
 * The migration replaced 53 call sites of the old engine-adapter shake with
 * `shakeBoard`. What matters is that a directional shake still ends up
 * directional: Phaser 4 spells "vertical only" as a Vector2 with the horizontal
 * component zeroed, and a mistake there is invisible until someone watches an
 * ability shake the wrong way.
 */
import { jest, describe, expect, test, beforeEach, afterEach } from '@jest/globals';

jest.mock('phaser', () =>
	(
		jest.requireActual('../../../test/phaser-mock') as typeof import('../../../test/phaser-mock')
	).createPhaserMock(),
);

import { getPhaser, setPhaserNamespace } from '../../phaser/runtime';
import { resetBoardCamera, setBoardCamera, shakeBoard } from '../../game-display/camera';

const { Vector2 } = getPhaser().Math;

function makeCamera() {
	return { shake: jest.fn() };
}

describe('shakeBoard argument order', () => {
	let camera: ReturnType<typeof makeCamera>;

	beforeEach(() => {
		camera = makeCamera();
		setBoardCamera(camera as never);
	});

	afterEach(() => {
		resetBoardCamera();
	});

	test('a two-axis shake passes the amplitude straight through as intensity', () => {
		shakeBoard({ amplitude: 0.03, durationMs: 400 });

		// Phaser 4 is `shake(duration, intensity, force)` — the reverse of the old
		// `shake(amplitude, duration, …)`, which is exactly the kind of swap that
		// type-checks happily and shakes for 0.03ms.
		expect(camera.shake).toHaveBeenCalledWith(400, 0.03, undefined);
	});

	test('force is forwarded, not defaulted away', () => {
		shakeBoard({ amplitude: 0.02, durationMs: 100, force: true });

		expect(camera.shake).toHaveBeenCalledWith(100, 0.02, true);
	});

	test('an explicit both axis behaves like the default', () => {
		shakeBoard({ amplitude: 0.05, durationMs: 250, axis: 'both' });

		expect(camera.shake).toHaveBeenCalledWith(250, 0.05, undefined);
	});

	test('a horizontal shake zeroes the vertical component', () => {
		shakeBoard({ amplitude: 0.04, durationMs: 90, force: true, axis: 'horizontal' });

		const [durationMs, intensity, force] = camera.shake.mock.calls[0] as [
			number,
			InstanceType<typeof Vector2>,
			boolean,
		];
		expect(durationMs).toBe(90);
		expect(force).toBe(true);
		expect(intensity).toBeInstanceOf(Vector2);
		expect(intensity.x).toBe(0.04);
		expect(intensity.y).toBe(0);
	});

	test('a vertical shake zeroes the horizontal component', () => {
		shakeBoard({ amplitude: 0.02, durationMs: 333, axis: 'vertical' });

		const intensity = camera.shake.mock.calls[0][1] as InstanceType<typeof Vector2>;
		expect(intensity.x).toBe(0);
		expect(intensity.y).toBe(0.02);
	});

	test('each shake builds its own vector, so effects cannot corrupt each other', () => {
		shakeBoard({ amplitude: 0.02, durationMs: 100, axis: 'vertical' });
		shakeBoard({ amplitude: 0.03, durationMs: 100, axis: 'horizontal' });

		const first = camera.shake.mock.calls[0][1] as InstanceType<typeof Vector2>;
		const second = camera.shake.mock.calls[1][1] as InstanceType<typeof Vector2>;
		expect(first).not.toBe(second);
		expect(first.y).toBe(0.02);
		expect(second.x).toBe(0.03);
	});
});

describe('shakeBoard without a match', () => {
	afterEach(() => {
		resetBoardCamera();
	});

	test('no registered camera is a no-op, not a crash', () => {
		expect(() => shakeBoard({ amplitude: 0.03, durationMs: 100 })).not.toThrow();
	});

	test('no Phaser runtime is a no-op, even with a camera registered', () => {
		const namespace = getPhaser();
		setPhaserNamespace(undefined as never);
		try {
			const camera = makeCamera();
			setBoardCamera(camera as never);
			shakeBoard({ amplitude: 0.03, durationMs: 100, axis: 'vertical' });
			expect(camera.shake).not.toHaveBeenCalled();
		} finally {
			setPhaserNamespace(namespace);
			resetBoardCamera();
		}
	});
});

describe('shakeBoard camera lifecycle', () => {
	afterEach(() => {
		resetBoardCamera();
	});

	test('resetBoardCamera stops a torn-down match shaking the next one', () => {
		const stale = makeCamera();
		setBoardCamera(stale as never);
		shakeBoard({ amplitude: 0.02, durationMs: 100 });

		resetBoardCamera();
		shakeBoard({ amplitude: 0.02, durationMs: 100 });

		// Only the first shake reached the old camera.
		expect(stale.shake).toHaveBeenCalledTimes(1);
	});

	test('a rematch redirects shakes to its own camera', () => {
		const first = makeCamera();
		const second = makeCamera();

		setBoardCamera(first as never);
		shakeBoard({ amplitude: 0.02, durationMs: 100 });
		setBoardCamera(second as never);
		shakeBoard({ amplitude: 0.02, durationMs: 100 });

		expect(first.shake).toHaveBeenCalledTimes(1);
		expect(second.shake).toHaveBeenCalledTimes(1);
	});

	test('registering null is the same as resetting', () => {
		const camera = makeCamera();
		setBoardCamera(camera as never);
		setBoardCamera(null);

		shakeBoard({ amplitude: 0.02, durationMs: 100 });

		expect(camera.shake).not.toHaveBeenCalled();
	});
});
