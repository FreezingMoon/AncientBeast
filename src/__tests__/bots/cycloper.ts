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
		temp: false,
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
		const controller = makeController({ activeCreature: cycloper, creatures: [lowEnemy, fullEnemy] });

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
		const controller = makeController({ activeCreature: cycloper, creatures: [woundedAlly, enemy] });

		const allyScore = scoreAbilityHex(allyHex, 1, controller as any) as number;
		const enemyScore = scoreAbilityHex(enemyHex, 1, controller as any) as number;
		expect(allyScore).toBeGreaterThan(enemyScore);
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
		const strongScore = getCounterTargetingModifier(attacker, strongCycloper, 1, {} as any) as number;
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
