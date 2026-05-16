import { beforeAll, describe, expect, jest, test } from '@jest/globals';
jest.mock('../../game', () => ({
	__esModule: true,
	default: class GameMock {},
}));

jest.mock('../../utility/hex', () => ({
	__esModule: true,
	Direction: {},
	Hex: class HexMock {},
}));

import { HexGrid } from '../../utility/hexgrid';

describe('HexGrid previewCreature query guards', () => {
	beforeAll(() => {
		(global as unknown as { Phaser?: unknown }).Phaser = {
			Easing: {
				Linear: {
					None: null,
				},
			},
		};
	});

	test('invalid target hex clears stale materialize preview and aborts rendering', () => {
		const oldHexA = { creature: null };
		const oldHexB = { creature: null };
		const invalidTargetHex = { reachable: false };

		const stopFlicker = jest.fn();
		const cleanHex = jest.fn();
		const restoreReachableHexVisual = jest.fn();
		const createOverlay = jest.fn();

		const materializeOverlay = {
			alpha: 0.5,
			_previewPos: { x: 2, y: 0 },
			_previewSize: 2,
		};

		const gridMock = {
			game: {
				activeCreature: { id: 7, team: 0 },
				Phaser: {
					add: {
						tween: jest.fn(),
					},
				},
			},
			hexes: [[{}, oldHexB, oldHexA, {}, invalidTargetHex]],
			lastQueryOpt: {
				hexes: [{ reachable: true }],
			},
			materialize_overlay: materializeOverlay,
			secondary_overlay: undefined,
			_flickerTween: { stop: stopFlicker },
			_flickerTweenSecondary: undefined,
			cleanHex,
			restoreReachableHexVisual,
			creatureGroup: {
				create: createOverlay,
			},
		};

		HexGrid.prototype.previewCreature.call(
			gridMock,
			{ x: 4, y: 0 },
			{
				size: 1,
				type: '--',
				name: 'Dark Priest',
				display: {
					'offset-x': 0,
					'offset-y': 0,
				},
			},
			{ flipped: false, color: 'blue' },
		);

		expect(stopFlicker).toHaveBeenCalledWith(true);
		expect((gridMock as unknown as { _flickerTween?: unknown })._flickerTween).toBeUndefined();
		expect(cleanHex).toHaveBeenCalledTimes(2);
		expect(restoreReachableHexVisual).toHaveBeenCalledTimes(2);
		expect(materializeOverlay.alpha).toBe(0);
		expect(materializeOverlay._previewPos).toBeUndefined();
		expect(createOverlay).not.toHaveBeenCalled();
	});
});
