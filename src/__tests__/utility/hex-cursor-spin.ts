/**
 * Regression cover for the targeting cursor's rotation leaking onto hexes that
 * stop being the cursor.
 *
 * The spin angle lives on `overlay.angle`, and the overlay is a single reused
 * sprite per hex. `stopSpinning()` deliberately stopped unwinding that angle,
 * because `updateStyle()` runs several times per hover step and resetting on
 * every call rewound the visible cursor mid-sweep. But nothing else ever reset
 * it, so the accumulated angle stayed on the sprite permanently: the hex that
 * had been the cursor later rendered `hex_path` as a possible target, already
 * turned by whatever angle the cursor stopped at.
 *
 * `updateStyle()` now unwinds the angle on the transition into the non-cursor
 * branch, which is reached only when the hex stops being the on-screen cursor —
 * so the sweep still reads as a turning cursor.
 */
import { describe, expect, test, beforeEach } from '@jest/globals';
import { jest } from '@jest/globals';

jest.mock('phaser', () =>
	(
		jest.requireActual('../../../test/phaser-mock') as typeof import('../../../test/phaser-mock')
	).createPhaserMock(),
);

import { Hex, stopAllCursorSpinning } from '../../utility/hex';
import { createSpriteMock } from '../../../test/sprite-mock';

/**
 * A stand-in `Hex` exposing only what `updateStyle()` reads.
 *
 * `updateStyle()` reads the display/overlay classes, the alpha override fields
 * and the two sprite handles, so constructing the real class would drag in the
 * whole Phaser board setup for no extra coverage. The overlay sprite is
 * deliberately shared across calls, exactly as it is in a real match: the whole
 * point is that one sprite is re-textured and re-angled in place.
 */
function createHexStandIn() {
	const display = createSpriteMock({ key: 'hex' });
	const overlay = createSpriteMock({ key: 'input' });
	const grid = {
		displayHexesGroup: { bringToTop: jest.fn(), sendToBack: jest.fn() },
		overlayHexesGroup: { bringToTop: jest.fn(), sendToBack: jest.fn() },
	};
	// `drawPoint` and `pinTopLeft` are private; they are reached here because
	// `updateStyle()` calls them and this stand-in is its receiver.
	const proto = Hex.prototype as unknown as {
		get drawPoint(): { x: number; y: number };
		pinTopLeft(sprite: unknown, x: number, y: number): void;
	};
	const readDrawPoint = Object.getOwnPropertyDescriptor(proto, 'drawPoint')?.get;
	if (!readDrawPoint) {
		throw new Error('Hex.prototype.drawPoint is no longer a getter');
	}
	const hex = {
		reachable: false,
		displayClasses: '',
		overlayClasses: '',
		forcedDisplayAlpha: undefined,
		forcedCreatureOverlayAlpha: undefined,
		forcedHidden: false,
		isSpinning: false,
		creature: undefined,
		trap: undefined,
		drop: undefined,
		coordText: undefined,
		game: { gameEngine: { add: { text: jest.fn() } } },
		grid,
		originalDisplayPos: { x: 0, y: 0 },
		hitBox: createSpriteMock({ x: 0, y: 0 }),
		display,
		overlay,
		get drawPoint(): { x: number; y: number } {
			return readDrawPoint.call(hex);
		},
		startSpinning: Hex.prototype.startSpinning,
		stopSpinning: Hex.prototype.stopSpinning,
		pinTopLeft: (sprite: unknown, x: number, y: number) => proto.pinTopLeft.call(hex, sprite, x, y),
	};
	const style = (overlayClasses: string) => {
		hex.overlayClasses = overlayClasses;
		Hex.prototype.updateStyle.call(hex as unknown as Hex);
	};
	return { hex, style, display, overlay };
}

describe('Hex targeting cursor rotation', () => {
	beforeEach(() => {
		stopAllCursorSpinning();
	});

	test('stops spinning and unwinds the angle once the hex becomes a possible target', () => {
		const { style, overlay } = createHexStandIn();

		// The hex is the cursor: plain `hover`, so it resolves to the `input`
		// texture and turns.
		style(' hover ');
		expect(overlay.key).toBe('input');
		expect(overlay.alpha).toBe(1);

		// Accumulate rotation, then re-style as a possible target. Same sprite.
		overlay.angle = 146;
		style(' reachable h_player0 ');

		expect(overlay.key).toBe('hex_path');
		expect(overlay.angle).toBe(0);
	});

	test('keeps the angle while the hex is still the cursor', () => {
		const { style, overlay } = createHexStandIn();
		style(' hover ');
		overlay.angle = 92;

		// `updateStyle()` runs several times per hover step. Re-styling the same
		// cursor hex must not rewind it, or the sweep reads as a snap-back.
		style(' hover ');

		expect(overlay.key).toBe('input');
		expect(overlay.angle).toBe(92);
	});

	test('unwinds when the cursor hex goes transparent', () => {
		const { style, overlay } = createHexStandIn();
		style(' hover ');
		overlay.angle = 30;

		// `hover` cleared: the cursor is off screen but the sprite keeps the
		// `input` texture, so the angle has to be reset here too.
		style('');

		expect(overlay.angle).toBe(0);
	});
});
