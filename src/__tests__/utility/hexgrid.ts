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

	test('hovered non-active creature on trap reveals both creature and trap blockers', () => {
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
		expect(hovered.xray).toHaveBeenLastCalledWith(false);
		expect(hovered.xray.mock.calls.some((args) => args[0] === true)).toBe(false);
		expect(blocker.xray).toHaveBeenLastCalledWith(
			true,
			expect.arrayContaining([
				expect.objectContaining({ sprite: trapSprite, grp: gridMock.creatureGroup }),
				hovered,
			]),
		);
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

	test('hovered non-active creature on trap is revealed while trap blockers are still xrayed', () => {
		const active = makeCreature(1, { left: 0, top: 0, right: 10, bottom: 10 });
		const hovered = makeCreature(2, { left: 20, top: 20, right: 44, bottom: 44 }, 2);
		const blocker = makeCreature(3, { left: 18, top: 18, right: 42, bottom: 42 });

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
		expect(hovered.xray).toHaveBeenLastCalledWith(false);
		expect(hovered.xray.mock.calls.some((args) => args[0] === true)).toBe(false);
		expect(blocker.xray).toHaveBeenLastCalledWith(
			true,
			expect.arrayContaining([
				expect.objectContaining({ sprite: trapSprite, grp: gridMock.creatureGroup }),
				hovered,
			]),
		);
	});

	test('hovered active creature on trap keeps active visible and includes active in reveal refs', () => {
		const active = makeCreature(1, { left: 20, top: 20, right: 44, bottom: 44 }, 2);
		const blocker = makeCreature(3, { left: 18, top: 18, right: 42, bottom: 42 });

		const trapSprite = {
			exists: true,
			getBounds: jest.fn(() => ({ left: 20, top: 20, right: 40, bottom: 40 })),
		};

		const gridMock = {
			creatureGroup: { id: 'creature-group' },
			game: {
				activeCreature: active,
				creatures: [active, blocker],
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
			creature: active,
			ghostOverlap: jest.fn(),
		};

		HexGrid.prototype.xray.call(gridMock, hoverHex as never);

		active.hexagons.forEach((hex) => {
			expect(hex.ghostOverlap).toHaveBeenCalledWith(active);
		});
		expect(active.xray).toHaveBeenLastCalledWith(false);
		expect(active.xray.mock.calls.some((args) => args[0] === true)).toBe(false);
		expect(blocker.xray).toHaveBeenLastCalledWith(
			true,
			expect.arrayContaining([
				expect.objectContaining({ sprite: trapSprite, grp: gridMock.creatureGroup }),
				active,
			]),
		);
	});

	test('hovered drop reveals drop by ghosting overlapping blockers', () => {
		const active = makeCreature(1, { left: 0, top: 0, right: 10, bottom: 10 });
		const blocker = makeCreature(2, { left: 18, top: 18, right: 42, bottom: 42 });
		const farCreature = makeCreature(3, { left: 100, top: 100, right: 120, bottom: 120 });

		const dropSprite = {
			exists: true,
			getBounds: jest.fn(() => ({ left: 20, top: 20, right: 40, bottom: 40 })),
		};

		const gridMock = {
			creatureGroup: { id: 'creature-group' },
			game: {
				activeCreature: active,
				creatures: [active, blocker, farCreature],
				UI: { selectedAbility: -1 },
				traps: [],
				drops: [
					{
						x: 8,
						y: 3,
						pickedUp: false,
						display: dropSprite,
					},
				],
			},
		};

		const hoverHex = {
			x: 8,
			y: 3,
			reachable: true,
			creature: null,
			drop: gridMock.game.drops[0],
			ghostOverlap: jest.fn(),
		};

		HexGrid.prototype.xray.call(gridMock, hoverHex as never);

		expect(blocker.xray).toHaveBeenLastCalledWith(
			true,
			expect.objectContaining({ sprite: dropSprite, grp: gridMock.creatureGroup }),
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

		active.hexagons.forEach((hex) => (hex.ghostOverlap as jest.Mock).mockClear());

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

		scavenger.hexagons.forEach((hex) => (hex.ghostOverlap as jest.Mock).mockClear());

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

	test('hovered drop stacked on trap passes both reveal masks to overlapping blockers', () => {
		const active = makeCreature(1, { left: 0, top: 0, right: 10, bottom: 10 });
		const blocker = makeCreature(2, { left: 18, top: 18, right: 42, bottom: 42 });

		const trapSprite = {
			exists: true,
			getBounds: jest.fn(() => ({ left: 20, top: 20, right: 30, bottom: 34 })),
		};
		const dropSprite = {
			exists: true,
			getBounds: jest.fn(() => ({ left: 24, top: 22, right: 40, bottom: 40 })),
		};

		const gridMock = {
			creatureGroup: { id: 'creature-group' },
			game: {
				activeCreature: active,
				creatures: [active, blocker],
				UI: { selectedAbility: -1 },
				traps: [
					{
						x: 5,
						y: 4,
						getVisualSprites: () => [trapSprite],
					},
				],
				drops: [
					{
						x: 5,
						y: 4,
						pickedUp: false,
						display: dropSprite,
					},
				],
			},
		};

		const hoverHex = {
			x: 5,
			y: 4,
			reachable: false,
			creature: null,
			drop: gridMock.game.drops[0],
			ghostOverlap: jest.fn(),
		};

		HexGrid.prototype.xray.call(gridMock, hoverHex as never);

		expect(blocker.xray).toHaveBeenLastCalledWith(
			true,
			expect.arrayContaining([
				expect.objectContaining({ sprite: trapSprite, grp: gridMock.creatureGroup }),
				expect.objectContaining({ sprite: dropSprite, grp: gridMock.creatureGroup }),
			]),
		);
	});

	test('orderCreatureZ assigns shared depth bands within each row', () => {
		const row0Creature = { y: 0, grp: { z: -1 } };
		const row1Creature = { y: 1, grp: { z: -1 } };
		const row0Drop = { y: 0, display: { z: -1 } };
		const row0Materialize = { posy: 0, z: -1 };
		const row0TrapUnderFx = { z: -1, parent: { id: 'trap-group' } };
		const row0TrapOverFx = { z: -1, parent: { id: 'trap-over-group' } };
		const row0Trap = {
			y: 0,
			display: { z: -1, parent: { id: 'trap-group' } },
			displayOver: { z: -1 },
			getVisualSprites: () => [row0Trap.display, row0TrapUnderFx, row0TrapOverFx],
		};

		const trapSort = jest.fn();
		const creatureSort = jest.fn();
		const dropSort = jest.fn();
		const trapOverSort = jest.fn();

		const trapGroup = { id: 'trap-group', sort: trapSort };
		const trapOverGroup = { id: 'trap-over-group', sort: trapOverSort };
		const gridMock = {
			hexes: [[{}], [{}]],
			game: {
				creatures: [row0Creature, row1Creature],
				drops: [row0Drop],
				traps: [row0Trap],
			},
			trapGroup,
			creatureGroup: { sort: creatureSort },
			dropGroup: { sort: dropSort },
			trapOverGroup,
			materialize_overlay: row0Materialize,
			secondary_overlay: undefined,
			_rowDepthBaseIndex: HexGrid.prototype['_rowDepthBaseIndex'],
			getDepthAtBand: HexGrid.prototype.getDepthAtBand,
			assignSpriteDepthBand: HexGrid.prototype.assignSpriteDepthBand,
		};

		row0Trap.display.parent = trapGroup;
		row0TrapUnderFx.parent = trapGroup;
		row0TrapOverFx.parent = trapOverGroup;

		HexGrid.prototype.orderCreatureZ.call(gridMock);

		expect(row0Trap.display.z).toBe(0);
		expect(row0TrapUnderFx.z).toBe(20);
		expect(row0Creature.grp.z).toBe(40);
		expect(row0Drop.display.z).toBe(85);
		expect(row0Materialize.z).toBe(80);
		expect(row0TrapOverFx.z).toBe(90);
		expect(row0Trap.displayOver.z).toBe(91);
		expect(row1Creature.grp.z).toBe(140);
		expect(trapSort).toHaveBeenCalledWith('z', -1);
		expect(creatureSort).toHaveBeenCalledWith('z', -1);
		expect(dropSort).toHaveBeenCalledWith('z', -1);
		expect(trapOverSort).toHaveBeenCalledWith('z', -1);
	});

	test('clearAllXray can clear immediately without fade state', () => {
		const clearAllXray = HexGrid.prototype.clearAllXray as (
			this: { lastXrayHex: unknown; game: { creatures: unknown[] } },
			immediate?: boolean,
		) => void;
		const immediateClear = jest.fn();
		const fadeClear = jest.fn();
		const creatureA = Object.assign(Object.create(Creature.prototype), {
			clearXrayImmediately: immediateClear,
			xray: fadeClear,
		});
		const creatureB = Object.assign(Object.create(Creature.prototype), {
			clearXrayImmediately: jest.fn(),
			xray: jest.fn(),
		});
		const gridMock = {
			lastXrayHex: { x: 2, y: 3 },
			game: {
				creatures: [creatureA, creatureB, null],
			},
		};

		clearAllXray.call(gridMock, true);

		expect(gridMock.lastXrayHex).toBeNull();
		expect(immediateClear).toHaveBeenCalledTimes(1);
		expect(fadeClear).not.toHaveBeenCalled();
		expect(creatureB.clearXrayImmediately).toHaveBeenCalledTimes(1);
		expect(creatureB.xray).not.toHaveBeenCalled();
	});
});

describe('HexGrid display group layering', () => {
	test('constructor creates drop group below creature group', () => {
		type MockGroup = {
			name: string;
			children: MockGroup[];
			scale: { set: jest.Mock };
		};

		const createGroup = (parent?: MockGroup, name = ''): MockGroup => {
			const group: MockGroup = {
				name,
				children: [],
				scale: { set: jest.fn() },
			};
			if (parent) {
				parent.children.push(group);
			}
			return group;
		};

		const gameMock = {
			Phaser: {
				add: {
					group: jest.fn((parent?: MockGroup, name?: string) => createGroup(parent, name)),
				},
			},
			signals: {
				metaPowers: { add: jest.fn() },
				ui: { add: jest.fn() },
			},
			metaPowersState: {
				executeMonster: false,
			},
		};

		const grid = new HexGrid({ numRows: 2, numCols: 3, isFirstRowFull: true }, gameMock as never);
		const childNames = grid.display.children.map(
			(child) => (child as { name?: string }).name ?? '',
		);

		expect(childNames.indexOf('dropGrp')).toBeGreaterThanOrEqual(0);
		expect(childNames.indexOf('creaturesGrp')).toBeGreaterThanOrEqual(0);
		expect(childNames.indexOf('dropGrp')).toBeLessThan(childNames.indexOf('creaturesGrp'));
	});
});
