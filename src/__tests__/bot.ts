import { jest, expect, describe, test, afterEach } from '@jest/globals';

jest.mock('../creature', () => ({
	Creature: class Creature {},
}));

import BotController from '../bot';
import { Creature } from '../creature';

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
	const creature = new Creature() as Creature & {
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
	};
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
	});
	return creature;
};

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
	} as const);

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
		expect(bot.scoreAbilityHex({ creature: alliedCreature })).toBe(100);
		expect(bot.scoreAbilityHex({ creature: enemyCreature })).toBeGreaterThan(100);
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
			{ hexes: [{ x: 1, y: 0, creature: enemyCreature }] },
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
