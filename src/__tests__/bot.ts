import { jest, expect, describe, test, afterEach } from '@jest/globals';

// Mock heavy dependencies before importing bot
jest.mock('../ability');
jest.mock('../utility/hex', () => {
	return {
		Hex: class Hex {},
	};
});
// Provide a minimal Creature class so that `instanceof Creature` works in
// BotController.scoreAbilityHex without pulling in the full creature module
// (which transitively requires jQuery and other DOM dependencies).
jest.mock('../creature', () => ({
	Creature: class Creature {},
}));

import BotController from '../bot';
import { Creature } from '../creature';
import type Game from '../game';
import { Hex } from '../utility/hex';
import { Team } from '../utility/team';

// Minimal mock creature for testing.
// Object.create(Creature.prototype) ensures `instanceof Creature` is true in
// BotController.scoreAbilityHex so the creature-scoring branches actually run.
const makeCreature = ({
	id,
	team,
	x,
	y,
	controller = 'human',
	health = 100,
	maxHealth = 100,
	size = 1,
}: {
	id: number;
	team: number;
	x: number;
	y: number;
	controller?: 'human' | 'bot';
	health?: number;
	maxHealth?: number;
	size?: number;
}) => {
	const creature = Object.create(Creature.prototype);
	Object.assign(creature, {
		id,
		team,
		level: 1,
		x,
		y,
		health,
		size,
		dead: false,
		temp: false,
		hexagons: [{ x, y, pos: { x, y } }],
		player: {
			id: team,
			controller,
		},
		abilities: [],
		remainingMove: 0,
		isDarkPriest: () => false,
		calculatePath: jest.fn(() => []),
		queryMove: jest.fn(),
		stats: {
			health: maxHealth,
			energy: 100,
		},
		energy: 100,
		protectedFromFatigue: false,
		isFatigued: () => false,
	});
	return creature as Creature & {
		id: number;
		team: number;
		x: number;
		y: number;
		health: number;
		size: number;
		level: number;
		dead: boolean;
		temp: boolean;
		hexagons: { x: number; y: number; pos: { x: number; y: number } }[];
		player: {
			id: number;
			controller: 'human' | 'bot';
		};
		abilities: unknown[];
		remainingMove: number;
		isDarkPriest: () => boolean;
		calculatePath: jest.Mock;
		queryMove: jest.Mock;
		stats: { health: number; energy: number };
		energy: number;
		protectedFromFatigue: boolean;
		isFatigued: () => boolean;
	};
};

// Minimal mock game for testing
const makeGame = (activeCreature: ReturnType<typeof makeCreature>, otherCreatures = []) =>
	({
		activeCreature,
		creatures: [activeCreature, ...otherCreatures],
		drops: [],
		grid: {
			lastQueryOpt: undefined,
			hexes: [[makeHex({ x: 0, y: 0 })]],
			findCreatureMovementHexes: () => [],
		},
		multiplayer: false,
		gameState: 'playing',
		freezedInput: false,
		turnThrottle: false,
		signals: {
			creature: {
				add: jest.fn(),
			},
		},
		skipTurn: jest.fn(),
		retrieveCreatureStats: () => ({ size: 1 }),
	} as unknown as Game);

// Helper to create minimal Hex mock for testing
const makeHex = ({
	x,
	y,
	creature,
	trap,
}: {
	x: number;
	y: number;
	creature?: ReturnType<typeof makeCreature>;
	trap?: {
		effects: Array<{
			trigger?: string;
			name?: string;
			specialHint?: string;
			effectFn?: (...args: unknown[]) => unknown;
		}>;
	};
}) =>
	({
		x,
		y,
		creature,
		trap,
		adjacentHex: (_radius: number) => [] as Hex[],
	} as unknown as Hex);

describe('BotController', () => {
	afterEach(() => {
		jest.useRealTimers();
	});

	test('2v2 targeting ignores allied players on the same team', () => {
		const activeCreature = makeCreature({
			id: 1,
			team: 0,
			x: 0,
			y: 0,
			controller: 'bot',
		});
		const alliedCreature = makeCreature({
			id: 2,
			team: 2,
			x: 1,
			y: 0,
		});
		const enemyCreature = makeCreature({
			id: 3,
			team: 1,
			x: 5,
			y: 0,
			health: 40,
		});
		const game = makeGame(activeCreature, [alliedCreature, enemyCreature]);
		const bot = new BotController(game);

		expect(bot.closestDistanceToEnemy({ x: 0, y: 0 })).toBe(5);
		// Allied creature at (1,0): team 2, same parity as active team 0 → ally branch → score = 100
		expect(bot.scoreAbilityHex(makeHex({ x: 1, y: 0, creature: alliedCreature }))).toBe(100);
		// Enemy creature at (5,0): team 1, different parity → enemy branch → score = 1000 - 40 + 1*10 = 970
		// Enemy hex should score higher than allied hex
		expect(bot.scoreAbilityHex(makeHex({ x: 5, y: 0, creature: enemyCreature }))).toBeGreaterThan(
			bot.scoreAbilityHex(makeHex({ x: 1, y: 0, creature: alliedCreature })),
		);
	});

	test('query resolution schedules a fallback decision after confirm', () => {
		jest.useFakeTimers();

		const activeCreature = makeCreature({
			id: 1,
			team: 0,
			x: 0,
			y: 0,
			controller: 'bot',
		});
		const enemyCreature = makeCreature({
			id: 2,
			team: 1,
			x: 1,
			y: 0,
			health: 30,
		});
		const game = makeGame(activeCreature, [enemyCreature]);
		const bot = new BotController(game);
		bot.activeCreatureId = activeCreature.id;
		bot.pendingAction = { type: 'ability', abilityIndex: 0 };

		const onSelect = jest.fn();
		const onConfirm = jest.fn();
		const queueDecisionSpy = jest.spyOn(bot, 'queueDecision').mockImplementation(() => undefined);

		bot.resolveQuery(
			{ hexes: [makeHex({ x: 1, y: 0, creature: enemyCreature })] },
			{
				onSelect,
				onConfirm,
			},
		);

		jest.advanceTimersByTime(50);
		expect(onSelect).toHaveBeenCalled();

		jest.advanceTimersByTime(90);
		expect(onConfirm).toHaveBeenCalled();
		jest.runOnlyPendingTimers();
		expect(bot.pendingAction).toBeNull();
		expect(queueDecisionSpy).toHaveBeenCalledWith(1200);
	});

	test('query resolution preserves pending ability for chained bot queries', () => {
		jest.useFakeTimers();

		const activeCreature = makeCreature({
			id: 1,
			team: 0,
			x: 0,
			y: 0,
			controller: 'bot',
		});
		const firstTarget = makeCreature({
			id: 2,
			team: 1,
			x: 1,
			y: 0,
			health: 30,
		});
		const destinationHex = makeHex({ x: 2, y: 0 });
		const game = makeGame(activeCreature, [firstTarget]);
		const bot = new BotController(game);
		bot.activeCreatureId = activeCreature.id;
		bot.pendingAction = { type: 'ability', abilityIndex: 3 };
		jest.spyOn(bot, 'queueDecision').mockImplementation(() => undefined);

		const secondOnSelect = jest.fn();
		const secondOnConfirm = jest.fn();
		const firstOnConfirm = jest.fn(() => {
			bot.resolveQuery(
				{ hexes: [destinationHex] },
				{
					onSelect: secondOnSelect,
					onConfirm: secondOnConfirm,
				},
			);
		});

		bot.resolveQuery(
			{ hexes: [makeHex({ x: 1, y: 0, creature: firstTarget })] },
			{
				onSelect: jest.fn(),
				onConfirm: firstOnConfirm,
			},
		);

		jest.advanceTimersByTime(140);
		expect(firstOnConfirm).toHaveBeenCalled();
		expect(bot.pendingAction).not.toBeNull();
		expect(bot.isResolvingQuery).toBe(true);
		expect(bot.pendingAction).not.toBeNull();

		jest.advanceTimersByTime(50);
		expect(secondOnSelect).toHaveBeenCalled();

		jest.advanceTimersByTime(90);
		expect(secondOnConfirm).toHaveBeenCalled();
		jest.runOnlyPendingTimers();
		expect(bot.pendingAction).toBeNull();
	});

	test('query resolution clears pending action when onConfirm throws', () => {
		jest.useFakeTimers();

		const activeCreature = makeCreature({
			id: 1,
			team: 0,
			x: 0,
			y: 0,
			controller: 'bot',
		});
		const enemyCreature = makeCreature({
			id: 2,
			team: 1,
			x: 1,
			y: 0,
			health: 30,
		});
		const game = makeGame(activeCreature, [enemyCreature]);
		const bot = new BotController(game);
		bot.activeCreatureId = activeCreature.id;
		bot.pendingAction = { type: 'ability', abilityIndex: 2 };
		const queueDecisionSpy = jest.spyOn(bot, 'queueDecision').mockImplementation(() => undefined);

		bot.resolveQuery(
			{ hexes: [makeHex({ x: 1, y: 0, creature: enemyCreature })] },
			{
				onSelect: jest.fn(),
				onConfirm: jest.fn(() => {
					throw new Error('confirm failed');
				}),
			},
		);

		jest.advanceTimersByTime(140);
		expect(bot.pendingAction).toBeNull();
		expect(bot.failedAbilityIds.has(2)).toBe(true);
		expect(queueDecisionSpy).toHaveBeenCalledWith(120);
	});

	test('bot does not get stuck when ability use opens no query', () => {
		const activeCreature = makeCreature({
			id: 1,
			team: 0,
			x: 0,
			y: 0,
			controller: 'bot',
		});

		const abilityUse = jest.fn();
		activeCreature.abilities = [
			{
				used: false,
				getTrigger: () => 'onQuery',
				require: () => true,
				use: abilityUse,
				creature: activeCreature,
				game: {} as unknown as Game,
				id: 0,
				priority: 0,
				timesUsed: 0,
				timesUsedThisTurn: 0,
				token: 0,
				upgraded: false,
				title: 'Test Ability',
				_disableCooldowns: false,
				_infiniteEnergy: false,
				_energySelfUpgraded: 0,
				_getMaxDistance: () => 0,
				_targetTeam: Team.Enemy,
				_targets: [],
				_addOffenseBuff: () => undefined,
				_maxTransferAmount: 0,
				_damaged: false,
				_executeHealthThreshold: 0,
				_getDirections: () => [],
				_activateOnAttacker: () => false,
				_activateOnTarget: () => undefined,
			} as unknown as Creature['abilities'][number],
		];
		activeCreature.remainingMove = 0;

		const game = makeGame(activeCreature);
		const bot = new BotController(game);
		bot.activeCreatureId = activeCreature.id;

		bot.takeTurn();

		expect(abilityUse).toHaveBeenCalledTimes(1);
		expect(bot.pendingAction).toBeNull();
		expect(bot.failedAbilityIds.has(0)).toBe(true);
		expect(game.skipTurn).toHaveBeenCalledWith({ noTooltip: true });
	});

	test('bot does not get stuck when ability use opens an empty query (no viable targets)', () => {
		// Reproduces the "no energy / no targets" freeze: ability.use() calls queryHexes
		// with an empty hexes array, which causes resolveQuery to clear pendingAction
		// synchronously *inside* ability.use().  The guard must not return true in this case.
		const activeCreature = makeCreature({
			id: 1,
			team: 0,
			x: 0,
			y: 0,
			controller: 'bot',
		});

		const abilityUse = jest.fn().mockImplementation(function () {
			// Simulate queryHexes being called with no valid hexes, causing resolveQuery
			// to clear pendingAction and mark the ability as failed before use() returns.
			bot.resolveQuery({ hexes: [] }, { onSelect: jest.fn(), onConfirm: jest.fn() });
		});

		activeCreature.abilities = [
			{
				used: false,
				getTrigger: () => 'onQuery',
				require: () => true,
				use: abilityUse,
				creature: activeCreature,
				game: {} as unknown as Game,
				id: 0,
				priority: 0,
				timesUsed: 0,
				timesUsedThisTurn: 0,
				token: 0,
				upgraded: false,
				title: 'Test Ability',
				_disableCooldowns: false,
				_infiniteEnergy: false,
				_energySelfUpgraded: 0,
				_getMaxDistance: () => 0,
				_targetTeam: Team.Enemy,
				_targets: [],
				_addOffenseBuff: () => undefined,
				_maxTransferAmount: 0,
				_damaged: false,
				_executeHealthThreshold: 0,
				_getDirections: () => [],
				_activateOnAttacker: () => false,
				_activateOnTarget: () => undefined,
			} as unknown as Creature['abilities'][number],
		];
		activeCreature.remainingMove = 0;

		const game = makeGame(activeCreature);
		// Simulate lastQueryOpt changing (queryHexes DID run, just with empty hexes).
		game.grid.lastQueryOpt = {};
		const bot = new BotController(game);
		bot.activeCreatureId = activeCreature.id;

		bot.takeTurn();

		expect(abilityUse).toHaveBeenCalledTimes(1);
		expect(bot.pendingAction).toBeNull();
		expect(bot.failedAbilityIds.has(0)).toBe(true);
		expect(game.skipTurn).toHaveBeenCalledWith({ noTooltip: true });
	});

	test('immoveable bot with remaining movement does not queue move action', () => {
		const activeCreature = makeCreature({
			id: 1,
			team: 0,
			x: 0,
			y: 0,
			controller: 'bot',
		});

		activeCreature.remainingMove = 3;
		activeCreature.stats.moveable = false;

		const game = makeGame(activeCreature);
		const bot = new BotController(game);
		bot.activeCreatureId = activeCreature.id;

		bot.takeTurn();

		expect(activeCreature.queryMove).not.toHaveBeenCalled();
		expect(bot.pendingAction).toBeNull();
		expect(game.skipTurn).toHaveBeenCalledWith({ noTooltip: true });
	});

	test('low-health bot prefers a safe tile over a damaging trap tile', () => {
		const activeCreature = makeCreature({
			id: 1,
			team: 0,
			x: 0,
			y: 0,
			controller: 'bot',
			health: 18,
		});
 		const enemyCreature = makeCreature({
			id: 2,
			team: 1,
			x: 10,
			y: 0,
		});

		const safeHex = makeHex({ x: 3, y: 0 });
		const trapHex = makeHex({
			x: 1,
			y: 0,
			trap: {
				effects: [
					{
						trigger: 'onStepIn',
						name: 'burn damage',
					},
				],
			},
		});

		const game = makeGame(activeCreature, [enemyCreature]);
		const bot = new BotController(game);
		bot.pendingAction = { type: 'move' };

		const picked = bot.chooseHexForCurrentQuery([trapHex, safeHex]);

		expect(picked).toBe(safeHex);
		expect(bot.scoreMoveHex(safeHex)).toBeGreaterThan(bot.scoreMoveHex(trapHex));
	});

	test('low-health bot avoids routes that cross damaging traps when a safe route exists', () => {
		const activeCreature = makeCreature({
			id: 1,
			team: 0,
			x: 0,
			y: 0,
			controller: 'bot',
			health: 20,
		});
		const enemyCreature = makeCreature({
			id: 2,
			team: 1,
			x: 10,
			y: 0,
		});

		const damagingTrap = {
			effects: [
				{
					trigger: 'onStepOut',
					effectFn: () => {
						/* noop */
					},
				},
			],
		};

		const safeDestination = makeHex({ x: 2, y: 1 });
		const riskyDestination = makeHex({ x: 2, y: 0 });

		activeCreature.calculatePath.mockImplementation(({ x, y }: { x: number; y: number }) => {
			if (x === 2 && y === 0) {
				return [makeHex({ x: 1, y: 0, trap: damagingTrap }), riskyDestination];
			}
			return [safeDestination];
		});

		const game = makeGame(activeCreature, [enemyCreature]);
		const bot = new BotController(game);
		bot.pendingAction = { type: 'move' };

		const picked = bot.chooseHexForCurrentQuery([riskyDestination, safeDestination]);

		expect(picked).toBe(safeDestination);
		expect(bot.scoreMoveHex(safeDestination)).toBeGreaterThan(bot.scoreMoveHex(riskyDestination));
	});

	test('low-health bot waits when all movement options are trapped', () => {
		const activeCreature = makeCreature({
			id: 1,
			team: 0,
			x: 0,
			y: 0,
			controller: 'bot',
			health: 14,
		});
		const enemyCreature = makeCreature({
			id: 2,
			team: 1,
			x: 10,
			y: 0,
		});

		const trapHexA = makeHex({
			x: 1,
			y: 0,
			trap: {
				effects: [
					{
						trigger: 'onStepIn',
						name: 'poison damage',
					},
				],
			},
		});

		const trapHexB = makeHex({
			x: 1,
			y: 1,
			trap: {
				effects: [
					{
						trigger: 'onStepOut',
						name: 'burn damage',
					},
				],
			},
		});

		const game = makeGame(activeCreature, [enemyCreature]);
		const bot = new BotController(game);
		bot.pendingAction = { type: 'move' };

		const picked = bot.chooseHexForCurrentQuery([trapHexA, trapHexB]);

		expect(picked).toBeUndefined();
	});

	test('retreating bot prefers safe path over farther trapped path', () => {
		const activeCreature = makeCreature({
			id: 1,
			team: 0,
			x: 0,
			y: 0,
			controller: 'bot',
			health: 18,
		});
		const enemyCreature = makeCreature({
			id: 2,
			team: 1,
			x: 1,
			y: 0,
		});

		const safeRetreat = makeHex({ x: 2, y: 0 });
		const trapRetreat = makeHex({
			x: 4,
			y: 0,
			trap: {
				effects: [
					{
						trigger: 'onStepIn',
						name: 'burn damage',
					},
				],
			},
		});

		const game = makeGame(activeCreature, [enemyCreature]);
		const bot = new BotController(game);
		bot.pendingAction = { type: 'move' };

		const picked = bot.chooseHexForCurrentQuery([trapRetreat, safeRetreat]);

		expect(bot.isRetreating(activeCreature)).toBe(true);
		expect(picked).toBe(safeRetreat);
		expect(bot.scoreMoveHex(safeRetreat)).toBeGreaterThan(bot.scoreMoveHex(trapRetreat));
	});
});
