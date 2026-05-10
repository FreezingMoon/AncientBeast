import { Creature } from '../creature';
import { jest, expect, describe, test, beforeEach, beforeAll } from '@jest/globals';

// NOTE: ts-comments are necessary in this file to avoid mocking the entire game.
/* eslint-disable @typescript-eslint/ban-ts-comment */

describe('Creature', () => {
	describe('creature.id', () => {
		let game: Game;
		// @ts-ignore
		beforeEach(() => (game = getGameMock()));

		test('"materialized" creatures are automatically assigned separate ids', () => {
			// @ts-ignore
			const creature0 = new Creature(getCreatureObjMock(), game);
			// @ts-ignore
			const creature1 = new Creature(getCreatureObjMock(), game);
			expect(creature0).toBeDefined();
			expect(creature1).toBeDefined();
			expect(creature0.id).not.toBe(creature1.id);
			expect(game.creatures.length).toBe(2);
		});

		test('a "materialized" (not temp) creature will reuse an existing, matching "unmaterialized" creature id', () => {
			const obj = getCreatureObjMock();
			obj.temp = true;
			// @ts-ignore
			const creatureTemp = new Creature(obj, game);
			obj.temp = false;
			// @ts-ignore
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

	describe('Creature materializes in which queue?', () => {
		test('a new Creature normally materializes in next queue, not current', () => {
			const game = getGameMock();
			const obj = getCreatureObjMock();
			// @ts-ignore
			const creature = new Creature(obj, game);
			expect(creature.isInCurrentQueue).toBe(false);
			expect(creature.isInNextQueue).toBe(true);
		});
		test('a new Priest materializes in current queue', () => {
			const game = getGameMock();
			const obj = getCreatureObjMock();
			obj.type = '--';
			// @ts-ignore
			const creature = new Creature(obj, game);
			expect(creature.isDarkPriest()).toBe(true);
			expect(creature.isInCurrentQueue).toBe(true);
			expect(creature.isInNextQueue).toBe(true);
		});
		test('a creature without materialization sickness materializes in current queue', () => {
			const game = getGameMock();
			const obj = getCreatureObjMock();
			// @ts-ignore
			obj.materializationSickness = false;
			// @ts-ignore
			const creature = new Creature(obj, game);
			expect(creature.isDarkPriest()).toBe(false);
			expect(creature.isInCurrentQueue).toBe(true);
			expect(creature.isInNextQueue).toBe(true);
		});
	});

	describe('creature.canWait()', () => {
		test('a new Creature can wait', () => {
			const game = getGameMock();
			const obj = getCreatureObjMock();
			// @ts-ignore
			const creature = new Creature(obj, game);
			creature.activate();
			expect(creature.canWait).toBe(true);
		});
		test('a waiting Creature cannot wait', () => {
			const game = getGameMock();
			const obj = getCreatureObjMock();
			// @ts-ignore
			const creature = new Creature(obj, game);
			creature.activate();
			creature.wait();
			expect(creature.canWait).toBe(false);
		});
		test('a hindered Creature cannot wait', () => {
			const game = getGameMock();
			const obj = getCreatureObjMock();
			// @ts-ignore
			const creature = new Creature(obj, game);
			creature.activate();
			creature.hinder();
			expect(creature.canWait).toBe(false);
		});
	});

	describe('creature.wait()', () => {
		test('a creature that has waited is delayed', () => {
			const game = getGameMock();
			const obj = getCreatureObjMock();
			// @ts-ignore
			const creature = new Creature(obj, game);
			creature.activate();
			expect(creature.isDelayed).toBe(false);
			expect(creature.canWait).toBe(true);
			creature.wait();
			expect(creature.isDelayed).toBe(true);
		});
		test('when a round is over, a waited creature is no longer delayed', () => {
			const game = getGameMock();
			const obj = getCreatureObjMock();
			// @ts-ignore
			const creature = new Creature(obj, game);
			creature.activate();
			expect(creature.isDelayed).toBe(false);
			expect(creature.canWait).toBe(true);
			creature.wait();
			expect(creature.isWaiting).toBe(true);
			creature.deactivate('turn-end');
			expect(creature.isDelayed).toBe(false);
		});
	});

	describe('creature.hinder()', () => {
		test('a hindered creature is delayed', () => {
			const game = getGameMock();
			const obj = getCreatureObjMock();
			// @ts-ignore
			const creature = new Creature(obj, game);
			expect(creature.isHindered).toBe(false);
			expect(creature.isDelayed).toBe(false);
			creature.hinder();
			expect(creature.isHindered).toBe(true);
			expect(creature.isDelayed).toBe(true);
		});
		test('a creature can be hindered', () => {
			const game = getGameMock();
			const obj = getCreatureObjMock();
			// @ts-ignore
			const creature = new Creature(obj, game);
			expect(creature.isHindered).toBe(false);
			creature.hinder();
			expect(creature.isHindered).toBe(true);
		});
		test('a creature whose turn is over, who is then hindered, will be delayed the next round', () => {
			const game = getGameMock();
			const obj = getCreatureObjMock();
			// @ts-ignore
			const creature = new Creature(obj, game);
			creature.displayHealthStats = () => undefined;

			creature.activate();
			creature.deactivate('turn-end');
			expect(creature.isHindered).toBe(false);
			creature.hinder();
			expect(creature.isHindered).toBe(true);
			creature.activate();
			expect(creature.isHindered).toBe(true);
			creature.deactivate('turn-end');
			expect(creature.isHindered).toBe(false);
		});
		test('a creature whose turn is not over, who is then hindered, will not be delayed the next round from that hinder()', () => {
			const game = getGameMock();
			const obj = getCreatureObjMock();
			// @ts-ignore
			const creature = new Creature(obj, game);
			expect(creature.isWaiting).toBe(false);
			expect(creature.isDelayed).toBe(false);
			creature.hinder();
			expect(creature.isWaiting).toBe(false);
			expect(creature.isHindered).toBe(true);
			expect(creature.isDelayed).toBe(true);
			creature.activate();
			creature.deactivate('turn-end');
			expect(creature.isWaiting).toBe(false);
			expect(creature.isHindered).toBe(false);
			expect(creature.isDelayed).toBe(false);
		});
	});

	describe('movement preview cleanup regressions', () => {
		test('queryMove uses non-filling hover for movement previews', () => {
			const game = getGameMock();
			const grid = game.grid as MockGrid;
			grid.queryHexes = jest.fn();
			grid.forEachHex = jest.fn();
			grid.xray = jest.fn();
			grid.updateDisplay = jest.fn();
			grid.getFlyingRange = jest.fn(() => []);

			const obj = getCreatureObjMock();
			// @ts-ignore
			const creature = new Creature(obj, game);
			(game as MockGame).activeCreature = creature;
			creature.remainingMove = 3;

			creature.queryMove();

			expect(grid.queryHexes).toHaveBeenCalled();
			const args = grid.queryHexes.mock.calls[0][0] as { fillHexOnHover: boolean };
			expect(args.fillHexOnHover).toBe(false);
		});

		test('movement hover redraw resets the query before tracing the new path', () => {
			const game = getGameMock();
			const grid = game.grid as MockGrid;
			grid.queryHexes = jest.fn();
			grid.redoLastQuery = jest.fn();
			grid.forEachHex = jest.fn();
			grid.xray = jest.fn();
			grid.updateDisplay = jest.fn();
			grid.getFlyingRange = jest.fn(() => []);

			const obj = getCreatureObjMock();
			// @ts-ignore
			const creature = new Creature(obj, game);
			(game as MockGame).activeCreature = creature;
			creature.remainingMove = 3;
			const tracePathSpy = jest.spyOn(creature, 'tracePath').mockImplementation(jest.fn());

			creature.queryMove();

			const queryArgs = grid.queryHexes.mock.calls[0][0] as {
				fnOnSelect: (hex: { x: number; y: number }, payload: { creature: Creature }) => void;
			};
			queryArgs.fnOnSelect({ x: creature.x + 1, y: creature.y }, { creature });

			expect(grid.redoLastQuery).toHaveBeenCalledTimes(1);
			expect(tracePathSpy).toHaveBeenCalledWith({ x: creature.x + 1, y: creature.y });
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

import { unitData } from '../data/units';
import Game from '../game';

type MockGrid = {
	queryHexes: jest.Mock;
	redoLastQuery: jest.Mock;
	forEachHex: jest.Mock;
	xray: jest.Mock;
	updateDisplay: jest.Mock;
	getFlyingRange: jest.Mock;
	orderCreatureZ: jest.Mock;
	hexes: ReturnType<typeof getHexesMock>;
	allhexes: unknown[];
	refreshActiveCreatureXray: jest.Mock;
	healthIndicatorUiGroup: { add: jest.Mock; remove: jest.Mock };
};

type MockGame = {
	grid: MockGrid;
	activeCreature?: Creature;
};

type MockPhaser = {
	position: { set: jest.Mock };
	add: () => MockPhaser;
	create: () => MockPhaser;
	forEach: () => MockPhaser;
	group: () => MockPhaser;
	removeChild: () => MockPhaser;
	setTo: () => MockPhaser;
	start: () => MockPhaser;
	text: () => MockPhaser;
	to: () => MockPhaser;
	tween: () => MockPhaser;
	yoyo: () => MockPhaser;
	repeat: () => MockPhaser;
	onUpdateCallback: () => MockPhaser;
	update: jest.Mock;
	anchor: MockPhaser;
	data: Record<string, unknown>;
	onComplete: MockPhaser;
	parent: MockPhaser;
	sprite: MockPhaser;
	scale: MockPhaser;
	texture: { width: number; height: number };
};

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
			movement: 10,
		},
		temp: false,
		team: 0,
		materializationSickness: true,
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
				overlayVisualState: jest.fn(),
				displayVisualState: jest.fn(),
				cleanDisplayVisualState: jest.fn(),
				cleanOverlayVisualState: jest.fn(),
			});
		}
		arr.push(row);
	}
	return arr;
};

const getGameMock = () => {
	const self = {
		turn: 0,
		creatures: [],
		players: [],
		queue: { update: jest.fn() },
		updateQueueDisplay: jest.fn(),
		grid: {
			queryHexes: jest.fn(),
			redoLastQuery: jest.fn(),
			forEachHex: jest.fn(),
			xray: jest.fn(),
			updateDisplay: jest.fn(),
			getFlyingRange: jest.fn(() => []),
			orderCreatureZ: jest.fn(),
			hexes: getHexesMock(),
			allhexes: [] as unknown[],
			getMovementRange: jest.fn(() => []),
			refreshActiveCreatureXray: jest.fn(),
			healthIndicatorUiGroup: { add: jest.fn(), remove: jest.fn() },
		},
		Phaser: getPhaserMock(),
		retrieveCreatureStats: (type: number) => {
			for (const d of unitData) {
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
		UI: {
			selectedAbility: -1,
			healthBar: { animSize: jest.fn() },
			energyBar: { animSize: jest.fn() },
		},
		triggers: {
			oncePerDamageChain: {
				test: jest.fn(() => false),
			},
		},
		plasma_amount: 10,
		onReset: jest.fn(),
		onStartPhase: jest.fn(),
		onEndPhase: jest.fn(),
		log: jest.fn(),
		onHeal: jest.fn(),
	};
	self.grid.allhexes = self.grid.hexes.flat(1);
	self.players = [getPlayerMock(), getPlayerMock()];
	return self;
};

const getPhaserMock = () => {
	const self = { position: { set: jest.fn() } } as MockPhaser;
	self.add = () => self;
	self.create = () => self;
	self.forEach = () => self;
	self.group = () => self;
	self.removeChild = () => self;
	self.setTo = () => self;
	self.start = () => self;
	self.text = () => self;
	self.to = () => self;
	self.tween = () => self;
	self.yoyo = () => self;
	self.repeat = () => self;
	self.onUpdateCallback = () => self;
	self.update = jest.fn();
	self.anchor = self;
	self.data = {};
	self.onComplete = self;
	self.parent = self;
	self.sprite = self;
	self.scale = self;
	self.texture = {
		width: 10,
		height: 10,
	};

	return {
		add: self,
	};
};

beforeAll(() => {
	Object.defineProperty(window, 'Phaser', {
		get() {
			return { Easing: { Linear: { None: 1 }, Quadratic: { InOut: jest.fn((t) => t) } } };
		},
	});

	// Mock jQuery globally
	(global as unknown as { $j: unknown }).$j = jest.fn(() => ({
		removeClass: jest.fn(),
	}));

	// Mock the jquery module
	jest.doMock('jquery', () => ({
		__esModule: true,
		default: jest.fn(() => ({
			removeClass: jest.fn(),
		})),
	}));
});
