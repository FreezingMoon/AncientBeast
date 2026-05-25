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

import ImpalerStrategy from '../../bots/Impaler';
import { Creature } from '../../creature';
import { Hex } from '../../utility/hex';

const {
	isRetreating,
	scoreMoveHex,
	scoreAbilityHex,
	getAbilityPriority,
	getCounterTargetingModifier,
	getProximityPenalty,
	getTargetingPenalty,
} = ImpalerStrategy as Required<typeof ImpalerStrategy>;

const makeCreature = ({
	id = 1,
	team = 0,
	realm = 'S',
	type = 'S5',
	x = 0,
	y = 0,
	health = 190,
	maxHealth = 190,
	energy = 131,
	maxEnergy = 131,
	level = 5,
	size = 3,
	flipped = false,
	dead = false,
	temp = false,
	remainingMove = 4,
	movement = 4,
	abilities = [] as any[],
	adjacentHexes = (_: number) => [] as Hex[],
	hexagons = [] as Hex[],
	findEffect = () => [] as any[],
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
	remainingMove: number;
	movement: number;
	abilities: any[];
	adjacentHexes: (_: number) => Hex[];
	hexagons: Hex[];
	findEffect: () => any[];
}> = {}) => {
	const creature = Object.create(Creature.prototype);
	Object.assign(creature, {
		id,
		team,
		realm,
		type,
		x,
		y,
		health,
		stats: { health: maxHealth, energy: maxEnergy, movement },
		energy,
		level,
		size,
		dead,
		temp,
		remainingMove,
		player: { id: team, flipped, controller: 'bot' },
		abilities,
		adjacentHexes,
		hexagons,
		findEffect,
	});
	return creature as Creature & { team: number };
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
	closestDistanceToEnemy = (_: { x: number; y: number }) => 3,
	preferredX = 9,
	retreating = false,
}: {
	activeCreature: Creature & { team: number };
	creatures?: (Creature & { team: number })[];
	closestDistanceToEnemy?: (_: { x: number; y: number }) => number;
	preferredX?: number;
	retreating?: boolean;
}) => ({
	game: {
		activeCreature,
		creatures: [activeCreature, ...creatures],
		grid: {
			hexes: [Array(16).fill(null)],
		},
	},
	closestDistanceToEnemy,
	getPreferredX: () => preferredX,
	isRetreating: (_creature: Creature) => retreating,
});

describe('ImpalerStrategy.isRetreating', () => {
	test('retreats only at low health or energy', () => {
		const impaler = makeCreature({ health: 30, energy: 90 });
		const controller = makeController({ activeCreature: impaler });
		expect(isRetreating(impaler, controller as any)).toBe(true);
	});

	test('holds position while healthy and charged', () => {
		const impaler = makeCreature({ health: 150, energy: 90 });
		const controller = makeController({ activeCreature: impaler });
		expect(isRetreating(impaler, controller as any)).toBe(false);
	});
});

describe('ImpalerStrategy.scoreAbilityHex', () => {
	test('Hasted Javelin strongly prefers killable targets', () => {
		const impaler = makeCreature({
			abilities: [{}, { isUpgraded: () => true }, {}, {}],
			remainingMove: 1,
		});
		const killableEnemy = makeCreature({ id: 2, team: 1, health: 34, maxHealth: 80, size: 1 });
		const healthyEnemy = makeCreature({ id: 3, team: 1, health: 110, maxHealth: 110, size: 2 });
		const killableHex = makeHex({ x: 3, y: 0, creature: killableEnemy });
		const healthyHex = makeHex({ x: 3, y: 1, creature: healthyEnemy });
		const controller = makeController({
			activeCreature: impaler,
			creatures: [killableEnemy, healthyEnemy],
		});

		expect(scoreAbilityHex(killableHex, 1, controller as any)).toBeGreaterThan(
			scoreAbilityHex(healthyHex, 1, controller as any) as number,
		);
	});

	test('Poisonous Vine prefers enemies already pressured by allies', () => {
		const alliedFrontliner = makeCreature({ id: 2, team: 0, type: 'S7', size: 3 });
		const pressuredEnemy = makeCreature({
			id: 3,
			team: 1,
			health: 120,
			adjacentHexes: () => [makeHex({ creature: alliedFrontliner })],
		});
		const isolatedEnemy = makeCreature({
			id: 4,
			team: 1,
			health: 120,
			adjacentHexes: () => [],
		});
		const impaler = makeCreature({
			abilities: [{}, {}, { isUpgraded: () => false }, {}],
		});
		const pressuredHex = makeHex({ x: 2, y: 1, creature: pressuredEnemy });
		const isolatedHex = makeHex({ x: 2, y: 2, creature: isolatedEnemy });
		const controller = makeController({
			activeCreature: impaler,
			creatures: [alliedFrontliner, pressuredEnemy, isolatedEnemy],
		});

		expect(scoreAbilityHex(pressuredHex, 2, controller as any)).toBeGreaterThan(
			scoreAbilityHex(isolatedHex, 2, controller as any) as number,
		);
	});

	test('Chain Lightning prefers clustered enemy starts over isolated ones', () => {
		const impaler = makeCreature({ abilities: [{}, {}, {}, { isUpgraded: () => false }] });
		const enemyOne = makeCreature({ id: 2, team: 1, health: 60, maxHealth: 80 });
		const enemyTwo = makeCreature({ id: 3, team: 1, health: 60, maxHealth: 80 });
		const isolatedEnemy = makeCreature({ id: 4, team: 1, health: 60, maxHealth: 80 });
		const clusterHex = makeHex({
			x: 3,
			y: 0,
			creature: enemyOne,
			adjacentHex: () => [makeHex({ creature: enemyTwo })],
		});
		const isolatedHex = makeHex({
			x: 4,
			y: 0,
			creature: isolatedEnemy,
			adjacentHex: () => [],
		});
		const controller = makeController({
			activeCreature: impaler,
			creatures: [enemyOne, enemyTwo, isolatedEnemy],
		});

		expect(scoreAbilityHex(clusterHex, 3, controller as any)).toBeGreaterThan(
			scoreAbilityHex(isolatedHex, 3, controller as any) as number,
		);
	});

	test('Chain Lightning rejects allied targets with no enemy payoff', () => {
		const impaler = makeCreature({ abilities: [{}, {}, {}, { isUpgraded: () => true }] });
		const ally = makeCreature({ id: 2, team: 0, health: 80, maxHealth: 80 });
		const allyHex = makeHex({
			x: 3,
			y: 0,
			creature: ally,
			adjacentHex: () => [],
		});
		const controller = makeController({
			activeCreature: impaler,
			creatures: [ally],
		});

		expect(scoreAbilityHex(allyHex, 3, controller as any)).toBe(Number.NEGATIVE_INFINITY);
	});

	test('Chain Lightning avoids allied Dark Priest splash unless the cluster is truly worth it', () => {
		const impaler = makeCreature({ abilities: [{}, {}, {}, { isUpgraded: () => true }] });
		const enemyOne = makeCreature({ id: 2, team: 1, health: 60, maxHealth: 80 });
		const enemyTwo = makeCreature({ id: 3, team: 1, health: 60, maxHealth: 80 });
		const alliedDarkPriest = makeCreature({
			id: 4,
			team: 0,
			type: '--',
			health: 70,
			maxHealth: 70,
		});
		const riskyHex = makeHex({
			x: 3,
			y: 0,
			creature: enemyOne,
			adjacentHex: () => [makeHex({ creature: enemyTwo }), makeHex({ creature: alliedDarkPriest })],
		});
		const safeHex = makeHex({
			x: 4,
			y: 0,
			creature: enemyOne,
			adjacentHex: () => [makeHex({ creature: enemyTwo })],
		});
		const controller = makeController({
			activeCreature: impaler,
			creatures: [enemyOne, enemyTwo, alliedDarkPriest],
		});

		expect(scoreAbilityHex(riskyHex, 3, controller as any)).toBeLessThan(
			scoreAbilityHex(safeHex, 3, controller as any) as number,
		);
	});
});

describe('ImpalerStrategy.getAbilityPriority', () => {
	test('prioritizes Javelin when a kill is available', () => {
		const impaler = makeCreature({
			x: 0,
			y: 0,
			abilities: [{}, { isUpgraded: () => false }, {}, {}],
		});
		const killableEnemy = makeCreature({ id: 2, team: 1, x: 2, y: 0, health: 25, maxHealth: 80 });
		const controller = makeController({
			activeCreature: impaler,
			creatures: [killableEnemy],
		});

		expect(getAbilityPriority(impaler, controller as any)).toEqual([1, 3, 2]);
	});
});

describe('ImpalerStrategy.counter hooks', () => {
	test('counter targeting focuses weakened low-energy Impaler harder', () => {
		const attacker = makeCreature({ team: 0, type: 'W3', size: 1 });
		const weakImpaler = makeCreature({ team: 1, health: 40, energy: 15, maxEnergy: 131 });
		const strongImpaler = makeCreature({ team: 1, health: 190, energy: 120, maxEnergy: 131 });

		expect(getCounterTargetingModifier(attacker, weakImpaler, 1, {} as any)).toBeGreaterThan(
			getCounterTargetingModifier(attacker, strongImpaler, 1, {} as any) as number,
		);
	});

	test('proximity penalty is harsher around a charged Impaler with a clustered destination', () => {
		const mover = makeCreature({ team: 0, health: 30, maxHealth: 80, type: 'P1', size: 1 });
		const ally = makeCreature({ id: 3, team: 0, type: 'S1', size: 1 });
		const chargedImpaler = makeCreature({ team: 1, energy: 120, maxEnergy: 131 });
		const drainedImpaler = makeCreature({ team: 1, energy: 10, maxEnergy: 131 });
		const destination = makeHex({
			x: 1,
			y: 0,
			adjacentHex: () => [makeHex({ creature: ally })],
		});

		expect(getProximityPenalty(mover, chargedImpaler, destination, {} as any)).toBeLessThan(
			getProximityPenalty(mover, drainedImpaler, destination, {} as any) as number,
		);
	});

	test('targeting penalty discourages adjacent low-health dives into Impaler', () => {
		const impaler = makeCreature({ team: 1, energy: 120, maxEnergy: 131 });
		const ally = makeCreature({ id: 3, team: 0, type: 'S1', size: 1 });
		const attacker = makeCreature({
			team: 0,
			health: 25,
			maxHealth: 80,
			adjacentHexes: () => [makeHex({ creature: impaler }), makeHex({ creature: ally })],
		});

		expect(getTargetingPenalty(attacker, impaler, 1, {} as any)).toBeLessThan(0);
	});
});

describe('ImpalerStrategy.scoreMoveHex', () => {
	test('prefers mid-range hexes over trap-adjacent overcommits', () => {
		const impaler = makeCreature();
		const controller = makeController({
			activeCreature: impaler,
			closestDistanceToEnemy: ({ x }) => (x === 6 ? 2 : 1),
			preferredX: 6,
		});
		const safeMidHex = makeHex({ x: 6, y: 0, trap: false, adjacentHex: () => [] });
		const trapHex = makeHex({
			x: 8,
			y: 0,
			trap: true,
			adjacentHex: () => [makeHex({ creature: makeCreature({ id: 9, team: 1, type: 'W3' }) })],
		});

		expect(scoreMoveHex(safeMidHex, controller as any)).toBeGreaterThan(
			scoreMoveHex(trapHex, controller as any) as number,
		);
	});
});
