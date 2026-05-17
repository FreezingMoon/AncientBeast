/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, expect, describe, test } from '@jest/globals';

jest.mock('../../utility/hex', () => ({
	Hex: class Hex {},
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

import CycloperStrategy from '../../bots/Cycloper';
import { Creature } from '../../creature';
import { Hex } from '../../utility/hex';

const {
	isRetreating,
	scoreAbilityHex,
	getAbilityPriority,
	getCounterTargetingModifier,
	getProximityPenalty,
	getTargetingPenalty,
} = CycloperStrategy as Required<typeof CycloperStrategy>;

const makeCreature = ({
	id = 1,
	team = 0,
	realm = 'W',
	type = 'W3',
	x = 0,
	y = 0,
	health = 60,
	maxHealth = 60,
	energy = 100,
	maxEnergy = 150,
	level = 3,
	size = 1,
	flipped = false,
	dead = false,
	temp = false,
	abilities = [] as any[],
	adjacentHexes = (_: number) => [] as Hex[],
	playerCreatures = [] as (Creature & { team: number })[],
}: Partial<{
	id: number;
	team: number;
	realm: string;
	type: string;
	x: number;
	y: number;
	health: number;
	maxHealth: number;
	energy: number;
	maxEnergy: number;
	level: number;
	size: number;
	flipped: boolean;
	dead: boolean;
	temp: boolean;
	abilities: any[];
	adjacentHexes: (_: number) => Hex[];
	playerCreatures: (Creature & { team: number })[];
}> = {}) => {
	const c = Object.create(Creature.prototype);
	Object.assign(c, {
		id,
		team,
		realm,
		type,
		x,
		y,
		health,
		stats: { health: maxHealth, energy: maxEnergy },
		energy,
		level,
		size,
		dead,
		temp,
		player: { id: team, flipped, controller: 'bot', creatures: playerCreatures },
		abilities,
		adjacentHexes,
	});
	return c as Creature & { team: number };
};

const makeHex = ({
	x = 0,
	y = 0,
	creature = undefined as (Creature & { team: number }) | undefined,
	trap = false,
	adjacentHex = (_: number) => [] as Hex[],
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
	closestDistanceToEnemy: (_pos: { x: number; y: number }) => 2,
	closestDistanceToDrop: (_pos: { x: number; y: number }) => 12,
	getPreferredX: () => 10,
	isRetreating: (_c: Creature) => false,
});

describe('CycloperStrategy.isRetreating', () => {
	test('retreats at critical health', () => {
		const cycloper = makeCreature({ health: 10, maxHealth: 60, energy: 120, maxEnergy: 150 });
		const controller = makeController({ activeCreature: cycloper });
		expect(isRetreating(cycloper, controller as any)).toBe(true);
	});

	test('does not retreat while healthy and charged', () => {
		const cycloper = makeCreature({ health: 50, maxHealth: 60, energy: 100, maxEnergy: 150 });
		const controller = makeController({ activeCreature: cycloper });
		expect(isRetreating(cycloper, controller as any)).toBe(false);
	});
});

describe('CycloperStrategy.scoreAbilityHex', () => {
	test('Optic Burst prioritizes killable enemy targets', () => {
		const cycloper = makeCreature({ team: 0, x: 4, y: 4 });
		const lowEnemy = makeCreature({ id: 2, team: 1, x: 5, y: 4, health: 12, maxHealth: 70 });
		const fullEnemy = makeCreature({ id: 3, team: 1, x: 9, y: 4, health: 70, maxHealth: 70 });
		const lowEnemyHex = makeHex({ x: 5, y: 4, creature: lowEnemy });
		const fullEnemyHex = makeHex({ x: 9, y: 4, creature: fullEnemy });
		const controller = makeController({
			activeCreature: cycloper,
			creatures: [lowEnemy, fullEnemy],
		});

		const lowScore = scoreAbilityHex(lowEnemyHex, 1, controller as any) as number;
		const fullScore = scoreAbilityHex(fullEnemyHex, 1, controller as any) as number;
		expect(lowScore).toBeGreaterThan(fullScore);
	});

	test('upgraded Optic Burst prefers healing a heavily wounded ally', () => {
		const cycloper = makeCreature({
			team: 0,
			abilities: [{}, { isUpgraded: () => true }, {}, {}],
		});
		const woundedAlly = makeCreature({ id: 2, team: 0, health: 15, maxHealth: 80 });
		const enemy = makeCreature({ id: 3, team: 1, health: 70, maxHealth: 70, x: 7, y: 4 });
		const allyHex = makeHex({ x: 4, y: 5, creature: woundedAlly });
		const enemyHex = makeHex({ x: 7, y: 4, creature: enemy });
		const controller = makeController({
			activeCreature: cycloper,
			creatures: [woundedAlly, enemy],
		});

		const allyScore = scoreAbilityHex(allyHex, 1, controller as any) as number;
		const enemyScore = scoreAbilityHex(enemyHex, 1, controller as any) as number;
		expect(allyScore).toBeGreaterThan(enemyScore);
	});

	test('Power Aperture ignores unaffordable targets', () => {
		const cycloper = makeCreature({
			team: 0,
			energy: 60,
			maxEnergy: 150,
			abilities: [{}, {}, {}, { isUpgraded: () => false }],
		});
		const expensiveEnemy = makeCreature({ id: 4, team: 1, health: 120, maxHealth: 120, level: 7 });
		const affordableEnemy = makeCreature({ id: 5, team: 1, health: 40, maxHealth: 40, level: 3 });
		const expensiveHex = makeHex({ x: 6, y: 4, creature: expensiveEnemy });
		const affordableHex = makeHex({ x: 5, y: 4, creature: affordableEnemy });
		const controller = makeController({
			activeCreature: cycloper,
			creatures: [expensiveEnemy, affordableEnemy],
		});

		const expensiveScore = scoreAbilityHex(expensiveHex, 3, controller as any) as number;
		const affordableScore = scoreAbilityHex(affordableHex, 3, controller as any) as number;
		expect(expensiveScore).toBe(Number.NEGATIVE_INFINITY);
		expect(affordableScore).toBeGreaterThan(Number.NEGATIVE_INFINITY);
	});

	test('Power Aperture ignores shielded enemy Dark Priest', () => {
		const cycloper = makeCreature({
			team: 0,
			energy: 100,
			maxEnergy: 150,
			abilities: [{}, {}, {}, { isUpgraded: () => false }],
		});
		const shieldedDarkPriest = makeCreature({
			id: 6,
			team: 1,
			type: '--',
			health: 30,
			maxHealth: 30,
		});
		(shieldedDarkPriest.player as { plasma?: number }).plasma = 1;
		const enemy = makeCreature({ id: 7, team: 1, health: 35, maxHealth: 35 });
		const priestHex = makeHex({ x: 6, y: 4, creature: shieldedDarkPriest });
		const enemyHex = makeHex({ x: 5, y: 4, creature: enemy });
		const controller = makeController({
			activeCreature: cycloper,
			creatures: [shieldedDarkPriest, enemy],
		});

		const priestScore = scoreAbilityHex(priestHex, 3, controller as any) as number;
		const enemyScore = scoreAbilityHex(enemyHex, 3, controller as any) as number;
		expect(priestScore).toBe(Number.NEGATIVE_INFINITY);
		expect(enemyScore).toBeGreaterThan(Number.NEGATIVE_INFINITY);
	});

	test('Power Aperture ignores dead and temp creatures', () => {
		const cycloper = makeCreature({
			team: 0,
			energy: 100,
			maxEnergy: 150,
			abilities: [{}, {}, {}, { isUpgraded: () => false }],
		});
		const deadAlly = makeCreature({ id: 10, team: 0, health: 50, maxHealth: 50, dead: true });
		const tempEnemy = makeCreature({ id: 11, team: 1, health: 50, maxHealth: 50 });
		(tempEnemy as any).temp = true;
		const validAlly = makeCreature({ id: 12, team: 0, health: 30, maxHealth: 60 });
		const deadHex = makeHex({ x: 6, y: 4, creature: deadAlly });
		const tempHex = makeHex({ x: 5, y: 4, creature: tempEnemy });
		const validHex = makeHex({ x: 4, y: 4, creature: validAlly });
		const controller = makeController({
			activeCreature: cycloper,
			creatures: [deadAlly, tempEnemy, validAlly],
		});

		const deadScore = scoreAbilityHex(deadHex, 3, controller as any) as number;
		const tempScore = scoreAbilityHex(tempHex, 3, controller as any) as number;
		const validScore = scoreAbilityHex(validHex, 3, controller as any) as number;
		expect(deadScore).toBe(Number.NEGATIVE_INFINITY);
		expect(tempScore).toBe(Number.NEGATIVE_INFINITY);
		expect(validScore).toBeGreaterThan(Number.NEGATIVE_INFINITY);
	});
});

describe('CycloperStrategy.getAbilityPriority', () => {
	test('prefers Riot Shield when a damaged allied wall exists', () => {
		const wall = makeCreature({ id: 2, team: 0, type: 'O0', realm: 'O', health: 5, maxHealth: 30 });
		const cycloper = makeCreature({
			team: 0,
			playerCreatures: [wall],
			abilities: [{}, {}, {}, {}],
		});
		(cycloper.player.creatures as (Creature & { team: number })[]).unshift(cycloper);
		const controller = makeController({ activeCreature: cycloper, creatures: [wall] });

		expect(getAbilityPriority(cycloper, controller as any)).toEqual([2, 1, 3]);
	});
});

describe('CycloperStrategy.counter hooks', () => {
	test('getTargetingPenalty is harsher for adjacent attackers versus low-health upgraded Explosive End', () => {
		const attacker = makeCreature({
			team: 0,
			adjacentHexes: () => [makeHex()],
			health: 40,
			maxHealth: 70,
		});
		const riskyCycloper = makeCreature({
			team: 1,
			health: 20,
			maxHealth: 60,
			energy: 80,
			maxEnergy: 150,
			abilities: [{ isUpgraded: () => true }, {}, {}, {}],
		});
		const safeCycloper = makeCreature({
			team: 1,
			health: 60,
			maxHealth: 60,
			energy: 20,
			maxEnergy: 150,
			abilities: [{ isUpgraded: () => false }, {}, {}, {}],
		});

		attacker.adjacentHexes = () => [makeHex({ creature: riskyCycloper })];
		const riskyPenalty = getTargetingPenalty(attacker, riskyCycloper, 1, {} as any) as number;
		attacker.adjacentHexes = () => [makeHex({ creature: safeCycloper })];
		const safePenalty = getTargetingPenalty(attacker, safeCycloper, 1, {} as any) as number;

		expect(riskyPenalty).toBeLessThan(safePenalty);
	});

	test('getCounterTargetingModifier increases for wounded low-energy Cycloper', () => {
		const attacker = makeCreature({ team: 0 });
		const weakCycloper = makeCreature({
			team: 1,
			health: 18,
			maxHealth: 60,
			energy: 15,
			maxEnergy: 150,
			abilities: [{ isUpgraded: () => false }, {}, {}, {}],
		});
		const strongCycloper = makeCreature({
			team: 1,
			health: 60,
			maxHealth: 60,
			energy: 130,
			maxEnergy: 150,
			abilities: [{ isUpgraded: () => true }, {}, {}, {}],
		});

		const weakScore = getCounterTargetingModifier(attacker, weakCycloper, 1, {} as any) as number;
		const strongScore = getCounterTargetingModifier(
			attacker,
			strongCycloper,
			1,
			{} as any,
		) as number;
		expect(weakScore).toBeGreaterThan(strongScore);
	});

	test('getProximityPenalty discourages collapsing on high-energy upgraded Cycloper', () => {
		const mover = makeCreature({ team: 0, health: 50, maxHealth: 80 });
		const dangerousCycloper = makeCreature({
			team: 1,
			health: 50,
			maxHealth: 60,
			energy: 120,
			maxEnergy: 150,
			abilities: [{ isUpgraded: () => true }, {}, {}, {}],
		});
		const exhaustedCycloper = makeCreature({
			team: 1,
			health: 15,
			maxHealth: 60,
			energy: 5,
			maxEnergy: 150,
			abilities: [{ isUpgraded: () => false }, {}, {}, {}],
		});
		const destination = makeHex({ x: 7, y: 6 });

		const dangerousPenalty = getProximityPenalty(
			mover,
			dangerousCycloper,
			destination,
			{} as any,
		) as number;
		const exhaustedPenalty = getProximityPenalty(
			mover,
			exhaustedCycloper,
			destination,
			{} as any,
		) as number;

		expect(dangerousPenalty).toBeLessThan(exhaustedPenalty);
	});
});
