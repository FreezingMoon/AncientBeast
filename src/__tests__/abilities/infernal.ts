import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.mock('phaser-ce', () => ({
	Point: class PointMock {},
	Polygon: class PolygonMock {},
}));

jest.mock('../../damage', () => ({
	Damage: class DamageMock {
	},
}));

jest.mock('../../utility/pointfacade', () => ({
	getPointFacade: () => ({
		getTrapsAt: () => [],
	}),
}));

import loadInfernalAbilities from '../../abilities/Infernal';

type MockHex = {
	x: number;
	y: number;
	creature?: unknown;
	trap?: { destroy: () => void };
	destroyTrap?: () => void;
	isWalkable: (size: number, id: number, ignoreReachable?: boolean) => boolean;
};

describe('Infernal Molten Hurl movement safety', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.runOnlyPendingTimers();
		jest.useRealTimers();
	});

	test('falls back to the nearest walkable hex when furthest destination is blocked', () => {
		const selectAbility = jest.fn();
		const queryMove = jest.fn();
		const cameraShake = jest.fn();

		const row: MockHex[] = [];
		for (let x = 0; x <= 10; x++) {
			row[x] = {
				x,
				y: 2,
				isWalkable: () => true,
			};
		}

		row[7].isWalkable = () => false;
		row[6].isWalkable = () => true;

		const moveTo = jest.fn((destination: MockHex, opts: { callback: () => void }) => {
			expect(destination).toBe(row[6]);
			opts.callback();
		});

		const magmaSpawn = {
			id: 4,
			size: 3,
			player: { flipped: false },
			hexagons: [row[4], row[3], row[2]],
			moveTo,
		};

		const game = {
			abilities: [] as unknown[],
			grid: {
				hexes: [[], [], row],
				getHexLine: jest.fn(),
			},
			UI: { selectAbility },
			activeCreature: { queryMove },
			freezedInput: false,
			Phaser: {
				camera: {
					shake: cameraShake,
					SHAKE_BOTH: 0,
				},
			},
		};

		loadInfernalAbilities(game as never);

		const abilityDef = (game.abilities[4] as Array<Record<string, unknown>>)[3];
		const moltenHurl = {
			...(abilityDef as object),
			creature: magmaSpawn,
			damages: { burn: 10, crush: 10 },
			end: jest.fn(),
			isUpgraded: () => false,
		};

		const path: MockHex[] = [
			{ x: 6, y: 2, isWalkable: () => true },
			{ x: 7, y: 2, isWalkable: () => true },
		];

		(
			moltenHurl as unknown as {
				activate: (pathArg: MockHex[], args: { direction: number }) => void;
			}
		).activate(path, { direction: 1 });

		expect(moveTo).toHaveBeenCalledTimes(1);
		jest.runOnlyPendingTimers();
		expect(selectAbility).toHaveBeenCalledWith(-1);
		expect(queryMove).toHaveBeenCalledTimes(1);
		expect(cameraShake).toHaveBeenCalledTimes(1);
	});

	test('aborts movement when no walkable destination exists', () => {
		const selectAbility = jest.fn();
		const queryMove = jest.fn();
		const cameraShake = jest.fn();

		const row: MockHex[] = [];
		for (let x = 0; x <= 10; x++) {
			row[x] = {
				x,
				y: 2,
				isWalkable: () => false,
			};
		}

		const moveTo = jest.fn();
		const magmaSpawn = {
			id: 4,
			size: 3,
			player: { flipped: false },
			hexagons: [row[4], row[3], row[2]],
			moveTo,
		};

		const game = {
			abilities: [] as unknown[],
			grid: {
				hexes: [[], [], row],
				getHexLine: jest.fn(),
			},
			UI: { selectAbility },
			activeCreature: { queryMove },
			freezedInput: false,
			Phaser: {
				camera: {
					shake: cameraShake,
					SHAKE_BOTH: 0,
				},
			},
		};

		loadInfernalAbilities(game as never);

		const abilityDef = (game.abilities[4] as Array<Record<string, unknown>>)[3];
		const moltenHurl = {
			...(abilityDef as object),
			creature: magmaSpawn,
			damages: { burn: 10, crush: 10 },
			end: jest.fn(),
			isUpgraded: () => false,
		};

		const path: MockHex[] = [
			{ x: 6, y: 2, isWalkable: () => false },
			{ x: 7, y: 2, isWalkable: () => false },
		];

		(
			moltenHurl as unknown as {
				activate: (pathArg: MockHex[], args: { direction: number }) => void;
			}
		).activate(path, { direction: 1 });

		expect(moveTo).not.toHaveBeenCalled();
		jest.runOnlyPendingTimers();
		expect(selectAbility).toHaveBeenCalledWith(-1);
		expect(queryMove).toHaveBeenCalledTimes(1);
		expect(cameraShake).toHaveBeenCalledTimes(1);
	});
});
