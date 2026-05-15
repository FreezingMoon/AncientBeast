/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, expect, describe, test } from '@jest/globals';

jest.mock('../../utility/hex', () => ({
	Hex: class Hex {},
}));
jest.mock('../../utility/matrices', () => ({
	frontAndBack8Hex: {},
}));
jest.mock('../../creature', () => ({
	Creature: class Creature {},
}));
jest.mock('../../utility/team', () => ({
	Team: { Enemy: 'Enemy', Ally: 'Ally', Both: 'Both' },
	isTeam: jest.fn((reference: { team: number }, other: { team: number }, relation: string) => {
		if (relation === 'Enemy') return other.team !== reference.team;
		if (relation === 'Ally') return other.team === reference.team;
		return true;
	}),
}));

import StomperStrategy from '../../bots/Stomper';
import { Creature } from '../../creature';
import { Hex } from '../../utility/hex';

const {
	isRetreating,
	scoreAbilityHex,
	getAbilityPriority,
	getCounterTargetingModifier,
	getProximityPenalty,
	getTargetingPenalty,
} = StomperStrategy as Required<typeof StomperStrategy>;

const makeCreature = ({
	id = 1,
	team = 0,
	x = 0,
	y = 0,
	health = 100,
	maxHealth = 100,
	energy = 60,
	maxEnergy = 80,
	level = 3,
	size = 1,
	flipped = false,
	delayed = false,
	effects = [] as any[],
	abilities = [] as any[],
	getHexMap = (_matrix: any, _flipped: boolean) => [] as Hex[],
}: Partial<{
	id: number;
	team: number;
	x: number;
	y: number;
	health: number;
	maxHealth: number;
	energy: number;
	maxEnergy: number;
	level: number;
	size: number;
	flipped: boolean;
	delayed: boolean;
	effects: any[];
	abilities: any[];
	getHexMap: (_matrix: any, _flipped: boolean) => Hex[];
}> = {}) => {
	const c = Object.create(Creature.prototype);
	Object.assign(c, {
		id,
		team,
		realm: 'E',
		type: 'E3',
		x,
		y,
		health,
		stats: { health: maxHealth, energy: maxEnergy },
		energy,
		level,
		size,
		delayed,
		effects,
		dead: false,
		temp: false,
		player: { id: team, flipped, controller: 'bot' },
		abilities,
		getHexMap,
		findEffect: (name: string) => effects.filter((effect) => effect.name === name),
	});
	return c as Creature & { team: number };
};

const makeHex = ({
	x = 0,
	y = 0,
	creature = undefined as (Creature & { team: number }) | undefined,
	trap = false,
	adjacentHex = (_: number) => [] as (Hex & { creature?: Creature & { team: number } })[],
} = {}) =>
	({
		x,
		y,
		creature,
		trap,
		adjacentHex,
	} as unknown as Hex);

const makeController = ({
	activeCreature,
	creatures = [] as (Creature & { team: number })[],
}: {
	activeCreature: Creature & { team: number };
	creatures?: (Creature & { team: number })[];
}) => ({
	game: {
		activeCreature,
		creatures: [activeCreature, ...creatures],
		grid: {
			hexes: [Array(16).fill(null)],
		},
	},
	getPreferredX: () => 9,
	isRetreating: (_c: Creature) => false,
	closestDistanceToEnemy: (_pos: { x: number; y: number }) => 4,
	closestDistanceToDrop: (_pos: { x: number; y: number }) => 10,
});

describe('StomperStrategy.isRetreating', () => {
	test('returns true at critical health', () => {
		const stomper = makeCreature({ health: 20, maxHealth: 135, energy: 90, maxEnergy: 96 });
		const controller = makeController({ activeCreature: stomper });
		expect(isRetreating(stomper, controller as any)).toBe(true);
	});

	test('returns false when still stable', () => {
		const stomper = makeCreature({ health: 100, maxHealth: 135, energy: 70, maxEnergy: 96 });
		const controller = makeController({ activeCreature: stomper });
		expect(isRetreating(stomper, controller as any)).toBe(false);
	});
});

describe('StomperStrategy.scoreAbilityHex', () => {
	test('Stone Grinder strongly disfavors ally collateral', () => {
		const stomper = makeCreature({ team: 0 });
		const enemy = makeCreature({ id: 2, team: 1, health: 65, maxHealth: 120 });
		const ally = makeCreature({ id: 3, team: 0, health: 65, maxHealth: 120 });
		const enemyHex = makeHex({ x: 3, y: 3, creature: enemy });
		const allyHex = makeHex({ x: 4, y: 3, creature: ally });
		const controller = makeController({ activeCreature: stomper });

		const enemyScore = scoreAbilityHex(enemyHex, 2, controller as any) as number;
		const allyScore = scoreAbilityHex(allyHex, 2, controller as any) as number;
		expect(enemyScore).toBeGreaterThan(allyScore + 800);
	});

	test('upgraded Earth Shaker prefers delayed enemies for dizzy conversion', () => {
		const stomper = makeCreature({
			team: 0,
			abilities: [{}, {}, {}, { isUpgraded: () => true }],
		});
		const delayedEnemy = makeCreature({
			id: 2,
			team: 1,
			delayed: true,
			health: 100,
			maxHealth: 120,
		});
		const freshEnemy = makeCreature({
			id: 3,
			team: 1,
			delayed: false,
			health: 100,
			maxHealth: 120,
		});
		const delayedHex = makeHex({ x: 2, y: 3, creature: delayedEnemy });
		const freshHex = makeHex({ x: 3, y: 3, creature: freshEnemy });
		const controller = makeController({ activeCreature: stomper });

		const delayedScore = scoreAbilityHex(delayedHex, 3, controller as any) as number;
		const freshScore = scoreAbilityHex(freshHex, 3, controller as any) as number;
		expect(delayedScore).toBeGreaterThan(freshScore);
	});
});

describe('StomperStrategy.getAbilityPriority', () => {
	test('opens with Earth Shaker when upgraded dizzy window exists', () => {
		const delayedEnemy = makeCreature({ id: 2, team: 1, delayed: true });
		const stomper = makeCreature({
			team: 0,
			abilities: [{}, {}, {}, { isUpgraded: () => true }],
			getHexMap: (_matrix, flipped) => {
				if (!flipped) {
					return [makeHex({ x: 3, y: 3, creature: delayedEnemy })];
				}
				return [];
			},
		});
		const controller = makeController({ activeCreature: stomper });

		expect(getAbilityPriority(stomper, controller as any)).toEqual([3, 1, 2]);
	});
});

describe('StomperStrategy.counter hooks', () => {
	test('getTargetingPenalty returns 0 (no retaliation)', () => {
		const stomper = makeCreature({ team: 1 });
		const attacker = makeCreature({ team: 0 });
		const controller = makeController({ activeCreature: attacker, creatures: [stomper] });

		expect(getTargetingPenalty(attacker, stomper, 1, controller as any)).toBe(0);
	});

	test('getCounterTargetingModifier decreases when Tankish Build stacks are high', () => {
		const attacker = makeCreature({ team: 0 });
		const stackedStomper = makeCreature({
			team: 1,
			health: 90,
			maxHealth: 135,
			energy: 50,
			maxEnergy: 96,
			effects: [{ name: 'Tankish Build', alterations: { defense: 24 } }],
		});
		const unstackedStomper = makeCreature({
			team: 1,
			health: 90,
			maxHealth: 135,
			energy: 50,
			maxEnergy: 96,
			effects: [],
		});
		const controller = makeController({
			activeCreature: attacker,
			creatures: [stackedStomper, unstackedStomper],
		});

		const stackedScore = getCounterTargetingModifier(
			attacker,
			stackedStomper,
			1,
			controller as any,
		) as number;
		const unstackedScore = getCounterTargetingModifier(
			attacker,
			unstackedStomper,
			1,
			controller as any,
		) as number;

		expect(stackedScore).toBeLessThan(unstackedScore);
	});

	test('getProximityPenalty penalizes delayed movers near upgraded Earth Shaker', () => {
		const stomper = makeCreature({
			team: 1,
			abilities: [{}, {}, {}, { isUpgraded: () => true }],
		});
		const delayedMover = makeCreature({ team: 0, delayed: true });
		const freshMover = makeCreature({ team: 0, delayed: false });
		const destination = makeHex({ x: 6, y: 6 });
		const controller = makeController({ activeCreature: freshMover, creatures: [stomper] });

		const delayedScore = getProximityPenalty(
			delayedMover,
			stomper,
			destination,
			controller as any,
		) as number;
		const freshScore = getProximityPenalty(
			freshMover,
			stomper,
			destination,
			controller as any,
		) as number;

		expect(delayedScore).toBeLessThan(freshScore);
	});
});
