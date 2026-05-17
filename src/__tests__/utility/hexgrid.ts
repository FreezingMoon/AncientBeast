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

jest.mock('../../creature', () => ({
	__esModule: true,
	Creature: class CreatureMock {},
}));

import { HexGrid } from '../../utility/hexgrid';
import { Creature } from '../../creature';

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

	test('replay mode clears stale preview and suppresses cardboard rendering', () => {
		const oldHex = { creature: null };
		const stopFlicker = jest.fn();
		const cleanHex = jest.fn();
		const restoreReachableHexVisual = jest.fn();
		const createOverlay = jest.fn();

		const materializeOverlay = {
			alpha: 0.5,
			_previewPos: { x: 1, y: 0 },
			_previewSize: 1,
		};

		const gridMock = {
			game: {
				isReplayInProgress: true,
				botController: { isBotTurn: () => false },
				activeCreature: { id: 7, team: 0, player: { id: 1 } },
				activePlayer: { id: 1 },
				Phaser: {
					add: {
						tween: jest.fn(),
					},
				},
			},
			hexes: [[{}, oldHex, {}]],
			lastQueryOpt: {
				hexes: [],
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
			{ x: 2, y: 0 },
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
		expect(materializeOverlay.alpha).toBe(0);
		expect(materializeOverlay._previewPos).toBeUndefined();
		expect(cleanHex).toHaveBeenCalledTimes(1);
		expect(restoreReachableHexVisual).toHaveBeenCalledTimes(1);
		expect(createOverlay).not.toHaveBeenCalled();
	});
});

describe('HexGrid xray hover behavior', () => {
	type Bounds = {
		left: number;
		top: number;
		right: number;
		bottom: number;
	};

	const makeCreature = (id: number, bounds: Bounds, hexCount = 1) => {
		const hexagons = Array.from({ length: hexCount }, () => ({
			ghostOverlap: jest.fn(),
		}));

		const creature = Object.assign(Object.create(Creature.prototype), {
			id,
			xray: jest.fn(),
			sprite: {
				getBounds: jest.fn(() => bounds),
			},
			grp: { id },
			hexagons,
		});

		return creature as Creature & {
			xray: jest.Mock;
			hexagons: Array<{ ghostOverlap: jest.Mock }>;
		};
	};

	test('hovered non-active creature takes precedence over trap branch', () => {
		const active = makeCreature(1, { left: 0, top: 0, right: 10, bottom: 10 });
		const hovered = makeCreature(2, { left: 20, top: 20, right: 40, bottom: 40 }, 2);
		const blocker = makeCreature(3, { left: 22, top: 22, right: 38, bottom: 38 });

		const trapSprite = {
			exists: true,
			getBounds: jest.fn(() => ({ left: 20, top: 20, right: 40, bottom: 40 })),
		};

		const gridMock = {
			creatureGroup: { id: 'creature-group' },
			game: {
				activeCreature: active,
				creatures: [active, hovered, blocker],
				UI: { selectedAbility: -1 },
				traps: [
					{
						x: 4,
						y: 7,
						getVisualSprites: () => [trapSprite],
					},
				],
			},
		};

		const hoverHex = {
			x: 4,
			y: 7,
			reachable: false,
			creature: hovered,
			ghostOverlap: jest.fn(),
		};

		HexGrid.prototype.xray.call(gridMock, hoverHex as never);

		hovered.hexagons.forEach((hex) => {
			expect(hex.ghostOverlap).toHaveBeenCalledWith(hovered);
		});
		expect(blocker.xray.mock.calls.some((args) => args[0] === true)).toBe(false);
	});

	test('hovered trap reveals trap by ghosting overlapping blockers, even when reachable', () => {
		const active = makeCreature(1, { left: 0, top: 0, right: 10, bottom: 10 });
		const blocker = makeCreature(2, { left: 18, top: 18, right: 42, bottom: 42 });
		const farCreature = makeCreature(3, { left: 100, top: 100, right: 120, bottom: 120 });

		const trapSprite = {
			exists: true,
			getBounds: jest.fn(() => ({ left: 20, top: 20, right: 40, bottom: 40 })),
		};

		const gridMock = {
			creatureGroup: { id: 'creature-group' },
			game: {
				activeCreature: active,
				creatures: [active, blocker, farCreature],
				UI: { selectedAbility: -1 },
				traps: [
					{
						x: 8,
						y: 3,
						getVisualSprites: () => [trapSprite],
					},
				],
			},
		};

		const hoverHex = {
			x: 8,
			y: 3,
			reachable: true,
			creature: null,
			ghostOverlap: jest.fn(),
		};

		HexGrid.prototype.xray.call(gridMock, hoverHex as never);

		expect(blocker.xray).toHaveBeenLastCalledWith(
			true,
			expect.objectContaining({ sprite: trapSprite, grp: gridMock.creatureGroup }),
		);
		expect(farCreature.xray.mock.calls.some((args) => args[0] === true)).toBe(false);
	});

	test('unreachable hovered trap falls back to hex ghost overlap when no trap sprites exist', () => {
		const active = makeCreature(1, { left: 0, top: 0, right: 10, bottom: 10 });
		const blocker = makeCreature(2, { left: 18, top: 18, right: 42, bottom: 42 });

		const gridMock = {
			creatureGroup: { id: 'creature-group' },
			game: {
				activeCreature: active,
				creatures: [active, blocker],
				UI: { selectedAbility: -1 },
				traps: [
					{
						x: 2,
						y: 6,
						getVisualSprites: () => [],
					},
				],
			},
		};

		const hoverHex = {
			x: 2,
			y: 6,
			reachable: false,
			creature: null,
			ghostOverlap: jest.fn(),
		};

		HexGrid.prototype.xray.call(gridMock, hoverHex as never);

		expect(hoverHex.ghostOverlap).toHaveBeenCalledTimes(1);
	});

	test('default branch keeps active creature visible when no exception applies', () => {
		const active = makeCreature(1, { left: 0, top: 0, right: 10, bottom: 10 }, 2);
		const other = makeCreature(2, { left: 50, top: 50, right: 70, bottom: 70 });

		const gridMock = {
			creatureGroup: { id: 'creature-group' },
			game: {
				activeCreature: active,
				creatures: [active, other],
				UI: { selectedAbility: 1 },
				traps: [],
			},
		};

		const hoverHex = {
			x: 1,
			y: 1,
			reachable: true,
			creature: other,
			ghostOverlap: jest.fn(),
		};

		HexGrid.prototype.xray.call(gridMock, hoverHex as never);

		active.hexagons.forEach((hex) => {
			expect(hex.ghostOverlap).toHaveBeenCalledWith(active);
		});
		expect(active.xray).toHaveBeenLastCalledWith(false);
	});

	test('moving off exception hover restores active-creature default xray path', () => {
		const active = makeCreature(1, { left: 0, top: 0, right: 10, bottom: 10 }, 2);
		const hovered = makeCreature(2, { left: 20, top: 20, right: 40, bottom: 40 }, 2);

		const gridMock = {
			creatureGroup: { id: 'creature-group' },
			game: {
				activeCreature: active,
				creatures: [active, hovered],
				UI: { selectedAbility: -1 },
				traps: [],
			},
		};

		const hoveredHex = {
			x: 6,
			y: 6,
			reachable: true,
			creature: hovered,
			ghostOverlap: jest.fn(),
		};

		HexGrid.prototype.xray.call(gridMock, hoveredHex as never);

		hovered.hexagons.forEach((hex) => {
			expect(hex.ghostOverlap).toHaveBeenCalledWith(hovered);
		});
		active.hexagons.forEach((hex) => {
			expect(hex.ghostOverlap).not.toHaveBeenCalled();
		});

		active.hexagons.forEach((hex) => hex.ghostOverlap.mockClear());

		const neutralHex = {
			x: 7,
			y: 7,
			reachable: true,
			creature: null,
			ghostOverlap: jest.fn(),
		};

		HexGrid.prototype.xray.call(gridMock, neutralHex as never);

		active.hexagons.forEach((hex) => {
			expect(hex.ghostOverlap).toHaveBeenCalledWith(active);
		});
		expect(active.xray).toHaveBeenLastCalledWith(false);
	});

	test('transition from unreachable trap hover to adjacent creature hover keeps correct xray targeting', () => {
		const active = makeCreature(1, { left: 0, top: 0, right: 10, bottom: 10 });
		const scavenger = makeCreature(2, { left: 18, top: 18, right: 42, bottom: 42 }, 2);
		const blocker = makeCreature(3, { left: 19, top: 19, right: 41, bottom: 41 });

		const trapSprite = {
			exists: true,
			getBounds: jest.fn(() => ({ left: 20, top: 20, right: 40, bottom: 40 })),
		};

		const gridMock = {
			creatureGroup: { id: 'creature-group' },
			game: {
				activeCreature: active,
				creatures: [active, scavenger, blocker],
				UI: { selectedAbility: -1 },
				traps: [
					{
						x: 8,
						y: 3,
						getVisualSprites: () => [trapSprite],
					},
				],
			},
		};

		const mudbathHex = {
			x: 8,
			y: 3,
			reachable: false,
			creature: null,
			ghostOverlap: jest.fn(),
		};

		HexGrid.prototype.xray.call(gridMock, mudbathHex as never);

		expect(blocker.xray).toHaveBeenLastCalledWith(
			true,
			expect.objectContaining({ sprite: trapSprite, grp: gridMock.creatureGroup }),
		);

		scavenger.hexagons.forEach((hex) => hex.ghostOverlap.mockClear());

		const scavengerHex = {
			x: 9,
			y: 3,
			reachable: false,
			creature: scavenger,
			ghostOverlap: jest.fn(),
		};

		HexGrid.prototype.xray.call(gridMock, scavengerHex as never);

		scavenger.hexagons.forEach((hex) => {
			expect(hex.ghostOverlap).toHaveBeenCalledWith(scavenger);
		});
	});
});
