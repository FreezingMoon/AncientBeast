import { beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.mock('jquery', () => ({
	extend: (...args: unknown[]) => Object.assign({}, ...args),
}));

jest.mock('../../game', () => ({
	__esModule: true,
	default: class GameMock {},
}));

jest.mock('../../utility/hex', () => ({
	__esModule: true,
	Hex: class HexMock {},
}));

jest.mock('../../creature', () => ({
	Creature: class CreatureMock {
		sprite = { alpha: 1 };
		cleanHex = jest.fn();
	},
}));

import loadDarkPriestAbilities from '../../abilities/Dark-Priest';

type MockHex = {
	x: number;
	y: number;
	pos: { x: number; y: number };
	reachable: boolean;
	setReachable: ReturnType<typeof jest.fn>;
	unsetReachable: ReturnType<typeof jest.fn>;
	isWalkable: ReturnType<typeof jest.fn>;
};

const makeHex = (x: number, y: number, reachable = true): MockHex => ({
	x,
	y,
	pos: { x, y },
	reachable,
	setReachable: jest.fn(function (this: MockHex) {
		this.reachable = true;
	}),
	unsetReachable: jest.fn(function (this: MockHex) {
		this.reachable = false;
	}),
	isWalkable: jest.fn(() => true),
});

describe('Dark Priest materialize query preview guards', () => {
	let spawnHex: MockHex;
	let otherHex: MockHex;
	let queryHexes: ReturnType<typeof jest.fn>;
	let previewCreature: ReturnType<typeof jest.fn>;
	let ability: {
		materialize: (creatureType: string) => void;
		creature: {
			id: number;
			player: { id: number; flipped: boolean; summonCreaturesWithMaterializationSickness: boolean };
			hexagons: [{ adjacentHex: (distance: number) => MockHex[] }];
		};
		isUpgraded: () => boolean;
	};

	beforeEach(() => {
		spawnHex = makeHex(5, 4);
		otherHex = makeHex(9, 4, false);
		queryHexes = jest.fn();
		previewCreature = jest.fn();

		const game = {
			abilities: {} as Record<number, unknown[]>,
			updateQueueDisplay: jest.fn(),
			retrieveCreatureStats: jest.fn(() => ({
				name: 'Test Unit',
				type: 'A1',
				size: 1,
				level: 1,
				display: {
					'offset-x': 0,
					'offset-y': 0,
				},
			})),
			grid: {
				forEachHex: jest.fn((callback: (hex: MockHex) => void) => {
					[spawnHex, otherHex].forEach(callback);
				}),
				queryHexes,
				previewCreature,
			},
			activeCreature: {
				queryMove: jest.fn(),
			},
		};

		loadDarkPriestAbilities(game as never);

		const baseAbility = game.abilities[0][3] as unknown;
		ability = {
			...(baseAbility as object),
			materialize:
				(baseAbility as { materialize?: (creatureType: string) => void })?.materialize || jest.fn(),
			creature: {
				id: 0,
				player: {
					id: 0,
					flipped: false,
					summonCreaturesWithMaterializationSickness: true,
				},
				hexagons: [
					{
						adjacentHex: jest.fn(() => [spawnHex]),
					},
				],
			},
			isUpgraded: () => false,
		};
	});

	test('materialize hover previews only in-range spawn hexes', () => {
		ability.materialize('A1');

		expect(queryHexes).toHaveBeenCalledTimes(1);
		const queryArgs = queryHexes.mock.calls[0][0] as {
			args: { creature: string; spawnRange: MockHex[] };
			fnOnSelect: (hex: MockHex, args: { creature: string; spawnRange: MockHex[] }) => void;
		};

		queryArgs.fnOnSelect(spawnHex, queryArgs.args);
		expect(previewCreature).toHaveBeenCalledWith(
			spawnHex.pos,
			expect.any(Object),
			ability.creature.player,
		);

		previewCreature.mockClear();
		queryArgs.fnOnSelect(otherHex, queryArgs.args);
		expect(previewCreature).not.toHaveBeenCalled();
	});
});
