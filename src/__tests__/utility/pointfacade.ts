import { expect, describe, test, beforeEach } from '@jest/globals';
import { PointFacade } from '../../utility/pointfacade';

// NOTE: ts-comments are necessary in this file to avoid mocking the entire game.
/* eslint-disable @typescript-eslint/ban-ts-comment */

// NOTE: To ensure we're not depending on Creature, etc. implementations, they're not imported.
// That leads to some linter problems, which are disabled here:
/* eslint-disable @typescript-eslint/no-unused-vars */

describe('class PointFacade', () => {
	test('typical usage', () => {
		/**
		 * NOTE: Initial mock data setup will be done in-game by various components.
		 * That may look something like this in `Game`:
		 * this.pointFacade = new PointFacade({
		 *     getCreatures:() => this.creatures,
		 *     getCreaturePassablePoints:(creature) => [],
		 *     getCreatureBlockedPoints:(creature) => (creature.dead || creature.temp) ? [] : creature.hexagons,
		 *     getTraps: () => this.traps,
		 *     getTrapPassablePoints:(trap) => [trap],
		 *     getTrapBlockedPoints:(trap) => [],
		 *     getDrops: () => this.grid.forEachHex(hex => hex.drop).filter(d => d),
		 *     getDropPassablePoints: (drop) => [drop],
		 *     getDropBlockedPoitns: (drop) => [],
		 * });
		 */
		const creatureMocks = [
			{
				dead: false,
				temp: false,
				hexagons: [
					{ x: 10, y: 21 },
					{ x: 11, y: 21 },
				],
			},
			{
				dead: false,
				temp: false,
				hexagons: [
					{ x: 14, y: 20 },
					{ x: 13, y: 20 },
				],
			},
			{
				dead: false,
				temp: false,
				hexagons: [{ x: 10, y: 10 }],
			},
		];
		const trapMocks = [
			{ x: 13, y: 20 },
			{ x: 1, y: 1 },
			{ x: 10, y: 10 },
		];
		const dropMocks = [
			{ x: 2, y: 10 },
			{ x: 0, y: 0 },
			{ x: 10, y: 10 },
		];

		/**
		 * NOTE: Intended typical creation of PointFacade
		 */
		const pointFacade = new PointFacade({
			// @ts-ignore
			getCreatures: () => creatureMocks, // NOTE: Locate actual in-game data
			getCreaturePassablePoints: (creature) => [],
			getCreatureBlockedPoints: (creature) =>
				creature.dead || creature.temp ? [] : creature.hexagons,
			// @ts-ignore
			getTraps: () => trapMocks, // NOTE: Locate actual in-game data
			getTrapPassablePoints: (trap) => [trap],
			getTrapBlockedPoints: (trap) => [],
			// @ts-ignore
			getDrops: () => dropMocks, // NOTE: Locate actual in-game data
			getDropPassablePoints: (drop) => [drop],
			getDropBlockedPoints: (drop) => [],
		});

		/**
		 * NOTE: Typical usage of PointFacade
		 */
		const blockedSet = pointFacade.getBlockedSet();

		expect(blockedSet.has({ x: 10, y: 21 })).toBe(true);
		expect(blockedSet.has(10, 21)).toBe(true);
		expect(blockedSet.has(creatureMocks[0].hexagons[0])).toBe(true);

		expect(pointFacade.getCreaturesAt(0, 0)).toEqual([]);
		expect(pointFacade.getCreaturesAt(10, 21)).toEqual([creatureMocks[0]]);
		expect(pointFacade.getCreaturesAt(13, 20)).toEqual([creatureMocks[1]]);

		expect(pointFacade.getTrapsAt(0, 0)).toEqual([]);
		expect(pointFacade.getTrapsAt(13, 20)).toEqual([trapMocks[0]]);
		expect(pointFacade.getTrapsAt(1, 1)).toEqual([trapMocks[1]]);

		expect(pointFacade.getDropsAt(1, 1)).toEqual([]);
		expect(pointFacade.getDropsAt(2, 10)).toEqual([dropMocks[0]]);
		expect(pointFacade.getDropsAt(0, 0)).toEqual([dropMocks[1]]);

		expect(blockedSet.has(10, 10)).toBe(true);
		expect(pointFacade.getCreaturesAt(10, 10)).toEqual([creatureMocks[2]]);
		expect(pointFacade.getTrapsAt(10, 10)).toEqual([trapMocks[2]]);
		expect(pointFacade.getDropsAt(10, 10)).toEqual([dropMocks[2]]);

		// NOTE: The methods can be called with anything having {x:number, y:number}.
		// However, it's awkward using game data. This is why we're using a facade in the first place!
		expect(blockedSet.has(10, 10)).toBe(true);
		expect(pointFacade.getCreaturesAt(trapMocks[2])).toEqual([creatureMocks[2]]);
		expect(pointFacade.getTrapsAt(creatureMocks[2].hexagons[0])).toEqual([trapMocks[2]]);
		expect(pointFacade.getDropsAt({ x: 10, y: 10 })).toEqual([dropMocks[2]]);

		// NOTE: In typical config, traps and drops are not blocking (i.e., they can be walked on).
		expect(blockedSet.has(1, 1)).toBe(false);
		expect(pointFacade.getTrapsAt(1, 1)).toEqual([trapMocks[1]]);
		expect(pointFacade.getTrapsAt(1, 1)).toEqual([trapMocks[1]]);
	});

	let creatures = [];
	let getCreatures = () => [];
	const getNothingFromCreature = (c) => [];
	const getCreaturePoints = (c) =>
		new Array(c.size).fill(0).map((_, i) => ({ x: c.x + i, y: c.y }));
	let getCreaturePassablePoints = (c) => [];
	let getCreatureBlockedPoints = (c) => [];

	let traps = [];
	let getTraps = () => [];
	const getNothingFromTrap = (t) => [];
	const getTrapPoints = (trap) => [{ x: trap.x, y: trap.y }];
	let getTrapPassablePoints = (t) => [];
	let getTrapBlockedPoints = (t) => [];

	let drops = [];
	let getDrops = () => [];
	const getNothingFromDrop = (drop) => [];
	const getDropPoints = (drop) => [{ x: drop.x, y: drop.y }];
	let getDropPassablePoints = (d) => [];
	let getDropBlockedPoints = (d) => [];

	let completeConfig;
	let incompleteConfig = {};

	let pointFacade: PointFacade;

	beforeEach(() => {
		creatures = [
			{ x: 1, y: 2, size: 3, temp: false },
			{ x: -1, y: -2, size: 2, temp: true },
		];
		getCreatures = () => creatures;
		getCreaturePassablePoints = (c) => (c.temp ? getCreaturePoints(c) : []);
		getCreatureBlockedPoints = (c) => (c.temp ? [] : getCreaturePoints(c));

		traps = [
			{ x: 101, y: 102 },
			{ x: -101, y: -102 },
		];
		getTraps = () => traps;
		getTrapPassablePoints = (trap) => [{ x: trap.x, y: trap.y }];
		getTrapBlockedPoints = (trap) => [];

		drops = [
			{ x: 1001, y: 1002 },
			{ x: -1001, y: -1002 },
		];
		getDrops = () => drops;
		getDropPassablePoints = (drop) => [{ x: drop.x, y: drop.y }];
		getDropBlockedPoints = (drop) => [];

		completeConfig = {
			getCreatures,
			getCreaturePassablePoints,
			getCreatureBlockedPoints,
			getTraps,
			getTrapPassablePoints,
			getTrapBlockedPoints,
			getDrops,
			getDropPassablePoints,
			getDropBlockedPoints,
		};

		incompleteConfig = {
			getCreaturePassablePoints,
			getCreatureBlockedPoints,
			getTraps,
			getTrapPassablePoints,
			getTrapBlockedPoints,
			getDrops,
			getDropPassablePoints,
			getDropBlockedPoints,
		};

		pointFacade = new PointFacade(completeConfig);
	});

	describe('new PointFacade(config:PointFacadeConfig)', () => {
		describe('new PointFacade(config:HexMapConfig)', () => {
			test('complete config argument does not throw error', () => {
				// @ts-ignore
				expect(() => new PointFacade(completeConfig)).not.toThrowError();
			});
			test('incomplete config argument throws error', () => {
				// @ts-ignore
				expect(() => new PointFacade(incompleteConfig)).toThrowError();
			});
			test('incomplete config argument can be completed and does not throw error', () => {
				// @ts-ignore
				incompleteConfig.getCreatures = () => [];
				// @ts-ignore
				expect(() => new PointFacade(incompleteConfig)).not.toThrowError();
			});
		});

		describe('pointFacade.getBlockedSet() returns a set of all blocked {x, y}', () => {
			test('returns a PointSet', () => {
				expect('has' in pointFacade.getBlockedSet()).toBe(true);
				expect('add' in pointFacade.getBlockedSet()).toBe(false);
			});
			test('if config.getCreatureBlockedPoints returns {x, y}, hash({x, y}) is in getBlockedSet()', () => {
				expect(pointFacade.getBlockedSet().has({ x: 1, y: 2 })).toBe(true);
				expect(pointFacade.getBlockedSet().has({ x: 2, y: 2 })).toBe(true);
				expect(pointFacade.getBlockedSet().has({ x: 3, y: 2 })).toBe(true);
			});
			test('if config.getCreatureBlockedPoints does not return {x, y}, hash({x, y}) is not in getBlockedSet()', () => {
				completeConfig.getCreatureBlockedPoints = getNothingFromCreature;
				const pointFacadeCreaturesPass = new PointFacade(completeConfig);
				expect(pointFacadeCreaturesPass.getBlockedSet().has({ x: 1, y: 2 })).toBe(false);
				expect(pointFacadeCreaturesPass.getBlockedSet().has({ x: 2, y: 2 })).toBe(false);
				expect(pointFacadeCreaturesPass.getBlockedSet().has({ x: 3, y: 2 })).toBe(false);
			});
		});

		describe('pointFacade.isBlocked({x, y})', () => {
			describe('if config.getCreatureBlockedPoints returns {x, y}', () => {
				test('return true if {x, y} has creature', () => {
					completeConfig.getCreatureBlockedPoints = getCreaturePoints;
					pointFacade = new PointFacade(completeConfig);
					expect(pointFacade.isBlocked({ x: 1, y: 2 })).toBe(true);
					expect(pointFacade.isBlocked({ x: 2, y: 2 })).toBe(true);
					expect(pointFacade.isBlocked({ x: 3, y: 2 })).toBe(true);
				});
				test('return false if {x, y} has no creature', () => {
					completeConfig.getCreatureBlockedPoints = getCreaturePoints;
					pointFacade = new PointFacade(completeConfig);
					expect(pointFacade.isBlocked({ x: 0, y: 2 })).toBe(false);
					expect(pointFacade.isBlocked({ x: 2, y: 3 })).toBe(false);
					expect(pointFacade.isBlocked({ x: 3, y: 3 })).toBe(false);
				});
			});
			describe('if config.getCreatureBlockedPoints does not return {x, y}', () => {
				test('return false if {x, y} only has creature', () => {
					completeConfig.getCreatureBlockedPoints = getNothingFromCreature;
					const pointFacadeCreaturesPass = new PointFacade(completeConfig);
					expect(pointFacade.isBlocked({ x: 1, y: 2 })).toBe(false);
					expect(pointFacade.isBlocked({ x: 2, y: 2 })).toBe(false);
					expect(pointFacade.isBlocked({ x: 3, y: 2 })).toBe(false);
				});
			});
		});

		describe('pointFacade.getCreaturesAt({x, y})', () => {
			describe('if config.getCreatureBlockedPoints returns {x, y}', () => {
				test('return [creature] if {x, y} has creature', () => {
					expect(pointFacade.getCreaturesAt({ x: 1, y: 2 })).toEqual([creatures[0]]);
					expect(pointFacade.getCreaturesAt({ x: 2, y: 2 })).toEqual([creatures[0]]);
					expect(pointFacade.getCreaturesAt({ x: 3, y: 2 })).toEqual([creatures[0]]);

					expect(pointFacade.getCreaturesAt({ x: -1, y: -2 })).toEqual([creatures[1]]);
					expect(pointFacade.getCreaturesAt({ x: 0, y: -2 })).toEqual([creatures[1]]);
				});
				test('return [] if {x, y} has no creature', () => {
					expect(pointFacade.getCreaturesAt({ x: 0, y: 2 })).toEqual([]);
					expect(pointFacade.getCreaturesAt({ x: 4, y: 2 })).toEqual([]);

					expect(pointFacade.getCreaturesAt({ x: -2, y: -2 })).toEqual([]);
					expect(pointFacade.getCreaturesAt({ x: 1, y: -2 })).toEqual([]);
					expect(pointFacade.getCreaturesAt({ x: 2, y: -2 })).toEqual([]);
				});
				test('return [creatures] if {x, y} has multiple creatures', () => {
					creatures[1].x = 1;
					creatures[1].y = 2;
					expect(pointFacade.getCreaturesAt({ x: 0, y: 2 })).toEqual([]);
					expect(pointFacade.getCreaturesAt({ x: 1, y: 2 })).toEqual(creatures);
					expect(pointFacade.getCreaturesAt({ x: 2, y: 2 })).toEqual(creatures);
					expect(pointFacade.getCreaturesAt({ x: 3, y: 2 })).toEqual([creatures[0]]);
				});
			});
			describe('if config.getCreaturePassablePoints returns {x, y}', () => {
				test('return [creature] if {x, y} has creature', () => {
					completeConfig.getCreatureBlockedPoints = getNothingFromCreature;
					completeConfig.getCreaturePassablePoints = getCreaturePoints;
					const pointFacadeCreaturesArePassable = new PointFacade(completeConfig);
					expect(pointFacadeCreaturesArePassable.getCreaturesAt({ x: 1, y: 2 })).toEqual([
						creatures[0],
					]);
					expect(pointFacadeCreaturesArePassable.getCreaturesAt({ x: 2, y: 2 })).toEqual([
						creatures[0],
					]);
					expect(pointFacadeCreaturesArePassable.getCreaturesAt({ x: 3, y: 2 })).toEqual([
						creatures[0],
					]);

					expect(pointFacadeCreaturesArePassable.getCreaturesAt({ x: -1, y: -2 })).toEqual([
						creatures[1],
					]);
					expect(pointFacadeCreaturesArePassable.getCreaturesAt({ x: 0, y: -2 })).toEqual([
						creatures[1],
					]);
				});
				test('return [] if {x, y} has no creature', () => {
					completeConfig.getCreatureBlockedPoints = getNothingFromCreature;
					completeConfig.getCreaturePassablePoints = getCreaturePoints;
					const pointFacadeCreaturesArePassable = new PointFacade(completeConfig);
					expect(pointFacadeCreaturesArePassable.getCreaturesAt({ x: 0, y: 2 })).toEqual([]);
					expect(pointFacadeCreaturesArePassable.getCreaturesAt({ x: 4, y: 2 })).toEqual([]);

					expect(pointFacadeCreaturesArePassable.getCreaturesAt({ x: -2, y: -2 })).toEqual([]);
					expect(pointFacadeCreaturesArePassable.getCreaturesAt({ x: 1, y: -2 })).toEqual([]);
					expect(pointFacadeCreaturesArePassable.getCreaturesAt({ x: 2, y: -2 })).toEqual([]);
				});
			});
		});

		describe('pointFacade.getTrapsAt({x, y})', () => {
			describe('if config.getTrapBlockedPoints returns {x, y}', () => {
				test('return [Trap] if {x, y} has Trap', () => {
					expect(pointFacade.getTrapsAt({ x: 101, y: 102 })).toEqual([traps[0]]);
					expect(pointFacade.getTrapsAt({ x: -101, y: -102 })).toEqual([traps[1]]);
				});
				test('return [] if {x, y} has no Trap', () => {
					expect(pointFacade.getTrapsAt({ x: 0, y: 2 })).toEqual([]);
					expect(pointFacade.getTrapsAt({ x: 4, y: 2 })).toEqual([]);
					expect(pointFacade.getTrapsAt({ x: 100, y: 102 })).toEqual([]);
					expect(pointFacade.getTrapsAt({ x: 104, y: 102 })).toEqual([]);
				});
				test('return [Traps] if {x, y} has multiple Traps', () => {
					traps[1].x = 101;
					traps[1].y = 102;
					expect(pointFacade.getTrapsAt({ x: 100, y: 102 })).toEqual([]);
					expect(pointFacade.getTrapsAt({ x: 101, y: 102 })).toEqual(traps);
				});
			});
			describe('if config.getTrapPassablePoints returns {x, y}', () => {
				test('return [Trap] if {x, y} has Trap', () => {
					completeConfig.getTrapBlockedPoints = getNothingFromTrap;
					completeConfig.getTrapPassablePoints = getTrapPoints;
					const pointFacadeTrapsArePassable = new PointFacade(completeConfig);
					expect(pointFacadeTrapsArePassable.getTrapsAt({ x: 101, y: 102 })).toEqual([traps[0]]);
					expect(pointFacadeTrapsArePassable.getTrapsAt({ x: -101, y: -102 })).toEqual([traps[1]]);
				});
				test('return [] if {x, y} has no Trap', () => {
					completeConfig.getTrapBlockedPoints = getNothingFromTrap;
					completeConfig.getTrapPassablePoints = getTrapPoints;
					const pointFacadeTrapsArePassable = new PointFacade(completeConfig);
					expect(pointFacadeTrapsArePassable.getTrapsAt({ x: 100, y: 102 })).toEqual([]);
					expect(pointFacadeTrapsArePassable.getTrapsAt({ x: 104, y: 102 })).toEqual([]);

					expect(pointFacadeTrapsArePassable.getTrapsAt({ x: -102, y: -102 })).toEqual([]);
					expect(pointFacadeTrapsArePassable.getTrapsAt({ x: 101, y: -102 })).toEqual([]);
					expect(pointFacadeTrapsArePassable.getTrapsAt({ x: 102, y: -102 })).toEqual([]);
				});
			});
		});

		describe('pointFacade.getDropsAt({x, y})', () => {
			describe('if config.getDropBlockedPoints returns {x, y}', () => {
				test('return [Drop] if {x, y} has Drop', () => {
					expect(pointFacade.getDropsAt({ x: 1001, y: 1002 })).toEqual([drops[0]]);
					expect(pointFacade.getDropsAt({ x: -1001, y: -1002 })).toEqual([drops[1]]);
				});
				test('return [] if {x, y} has no Drop', () => {
					expect(pointFacade.getDropsAt({ x: 0, y: 2 })).toEqual([]);
					expect(pointFacade.getDropsAt({ x: 4, y: 2 })).toEqual([]);
					expect(pointFacade.getDropsAt({ x: 1000, y: 1002 })).toEqual([]);
					expect(pointFacade.getDropsAt({ x: 1004, y: 1002 })).toEqual([]);
				});
				test('return [Drops] if {x, y} has multiple Drops', () => {
					drops[1].x = 1001;
					drops[1].y = 1002;
					expect(pointFacade.getDropsAt({ x: 1000, y: 1002 })).toEqual([]);
					expect(pointFacade.getDropsAt({ x: 1001, y: 1002 })).toEqual(drops);
					expect(pointFacade.getDropsAt({ x: -1001, y: -1002 })).toEqual([]);
				});
			});
			describe('if config.getDropPassablePoints returns {x, y}', () => {
				test('return [Drop] if {x, y} has Drop', () => {
					completeConfig.getDropBlockedPoints = getNothingFromDrop;
					completeConfig.getDropPassablePoints = getDropPoints;
					const pointFacadeDropsArePassable = new PointFacade(completeConfig);
					expect(pointFacadeDropsArePassable.getDropsAt({ x: 1001, y: 1002 })).toEqual([drops[0]]);
					expect(pointFacadeDropsArePassable.getDropsAt({ x: -1001, y: -1002 })).toEqual([
						drops[1],
					]);
				});
				test('return [] if {x, y} has no Drop', () => {
					completeConfig.getDropBlockedPoints = getNothingFromDrop;
					completeConfig.getDropPassablePoints = getDropPoints;
					const pointFacadeDropsArePassable = new PointFacade(completeConfig);
					expect(pointFacadeDropsArePassable.getDropsAt({ x: 1000, y: 1002 })).toEqual([]);
					expect(pointFacadeDropsArePassable.getDropsAt({ x: 1004, y: 1002 })).toEqual([]);

					expect(pointFacadeDropsArePassable.getDropsAt({ x: -1002, y: -1002 })).toEqual([]);
					expect(pointFacadeDropsArePassable.getDropsAt({ x: 1001, y: -1002 })).toEqual([]);
					expect(pointFacadeDropsArePassable.getDropsAt({ x: 1002, y: -1002 })).toEqual([]);
				});
			});
		});
	});
});
