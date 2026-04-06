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
	size = 1,
}: {
	id: number;
	team: number;
	x: number;
	y: number;
	controller?: 'human' | 'bot';
	health?: number;
	size?: number;
}) => {
	const creature = Object.create(Creature.prototype);
	Object.assign(creature, {
		id,
		team,
		x,
		y,
		health,
		size,
		dead: false,
		temp: false,
		hexagons: [{ x, y }],
		player: {
			id: team,
			controller,
		},
		abilities: [],
		remainingMove: 0,
		isDarkPriest: () => false,
		queryMove: jest.fn(),
		stats: {
			health,
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
		dead: boolean;
		temp: boolean;
		hexagons: { x: number; y: number }[];
		player: {
			id: number;
			controller: 'human' | 'bot';
		};
		abilities: any[];
		remainingMove: number;
		isDarkPriest: () => boolean;
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
}: {
	x: number;
	y: number;
	creature?: ReturnType<typeof makeCreature>;
}) =>
	({
		x,
		y,
		creature,
		adjacentHex: (radius: number) => [] as Hex[],
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
		expect(bot.pendingAction).toBeNull();
		expect(queueDecisionSpy).toHaveBeenCalledWith(1200);
	});
});
