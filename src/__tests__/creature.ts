import { Creature } from '../creature';
import { jest, expect, describe, test, beforeEach } from '@jest/globals';

// NOTE: ts-comments are necessary in this file to avoid mocking the entire game.
/* eslint-disable @typescript-eslint/ban-ts-comment */

describe('Creature', () => {
	describe('creature.id', () => {
		let game;
		beforeEach(() => (game = getGameMock()));

		test('"materialized" creatures are automatically assigned separate ids', () => {
			const creature0 = new Creature(getCreatureObjMock(), game);
			const creature1 = new Creature(getCreatureObjMock(), game);
			expect(creature0).toBeDefined();
			expect(creature1).toBeDefined();
			expect(creature0.id).not.toBe(creature1.id);
			expect(game.creatures.length).toBe(2);
		});

		test('a "materialized" (not temp) creature will reuse an existing, matching "unmaterialized" creature id', () => {
			const obj = getCreatureObjMock();
			obj.temp = true;
			const creatureTemp = new Creature(obj, game);
			obj.temp = false;
			const creatureNotTemp = new Creature(obj, game);
			expect(creatureTemp.id).toBe(creatureNotTemp.id);
		});
	});

	describe('game.creatures', () => {
		test('a "materialized" creature will replace a matching "unmaterialized" creature in game.creatures', () => {
			const game = getGameMock();
			const obj = getCreatureObjMock();
			obj.temp = true;
			// @ts-ignore
			const creatureTemp = new Creature(obj, game);
			expect(game.creatures.length).toBe(1);
			expect(game.creatures.filter((c) => c)[0]).toStrictEqual(creatureTemp);

			obj.temp = false;
			// @ts-ignore
			const creatureNotTemp = new Creature(obj, game);
			expect(game.creatures.length).toBe(1);
			expect(game.creatures.filter((c) => c)[0]).not.toStrictEqual(creatureTemp);
			expect(game.creatures.filter((c) => c)[0]).toStrictEqual(creatureNotTemp);
		});
	});
});

jest.mock('../ability');
jest.mock('../utility/hex', () => {
	return {
		default: () => {
			// Do nothing
		},
	};
});

const getPlayerMock = () => {
	return {};
};

const getRandomString = (length: number) => {
	return Array(length + 1)
		.join((Math.random().toString(36) + '00000000000000000').slice(2, 18))
		.slice(0, length);
};

const getCreatureObjMock = () => {
	return {
		stats: {
			health: 10,
		},
		temp: false,
		team: 0,
		type: getRandomString(5),
		display: {
			'offset-x': true,
		},
		size: 2,
		x: 4,
		y: 4,
	};
};

const getHexesMock = () => {
	const arr = [];
	for (let y = 0; y < 100; y++) {
		const row = [];
		for (let x = 0; x < 100; x++) {
			row.push({
				displayPos: { x, y },
				creature: 0,
			});
		}
		arr.push(row);
	}
	return arr;
};

import data from '../data/units.json';

const getGameMock = () => {
	const self = {
		creatures: [],
		players: [],
		queue: {
			addByInitiative: jest.fn(),
			removeTempCreature: jest.fn(),
		},
		updateQueueDisplay: jest.fn(),
		grid: {
			orderCreatureZ: jest.fn(),
			hexes: getHexesMock(),
		},
		Phaser: getPhaserMock(),
		retrieveCreatureStats: (type: number) => {
			for (const d of data) {
				if (d.id === type) {
					return d;
				}
			}
			return {};
		},
		abilities: jest.fn(),
		signals: {
			metaPowers: {
				add: jest.fn(),
			},
		},
		plasma_amount: 10,
	};
	self.players = [getPlayerMock(), getPlayerMock()];
	return self;
};

const getPhaserMock = () => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const self: Record<string, any> = {};
	self.tween = () => self;
	self.to = () => self;
	self.start = () => self;
	self.text = () => self;
	self.anchor = self;
	self.setTo = () => self;
	self.group = () => self;
	self.create = () => self;
	self.sprite = self;
	self.scale = self;
	self.add = () => self;
	self.texture = {
		width: 10,
		height: 10,
	};

	return {
		add: self,
	};
};
