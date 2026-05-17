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

import GumbleStrategy from '../../bots/Gumble';
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
} = GumbleStrategy as Required<typeof GumbleStrategy>;

const makeCreature = ({
	id = 1,
	team = 0,
	realm = 'P',
	type = 'P1',
	x = 0,
	y = 0,
	health = 70,
	maxHealth = 70,
	energy = 70,
	maxEnergy = 70,
	level = 1,
	size = 1,
	flipped = false,
	abilities = [] as any[],
	hexagons = [] as Hex[],
	adjacentHexes = (_: number) => [] as Hex[],
} = {}) => {
	const creature = Object.create(Creature.prototype);
	Object.assign(creature, {
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
		dead: false,
		temp: false,
		player: { id: team, flipped, controller: 'bot' },
		abilities,
		hexagons,
		adjacentHexes,
		findEffect: () => [],
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
	isRetreating: (_c: Creature) => false,
	closestDistanceToEnemy: (_pos: { x: number; y: number }) => 4,
	closestDistanceToDrop: (_pos: { x: number; y: number }) => 10,
	getPreferredX: () => 5,
});

describe('GumbleStrategy.isRetreating', () => {
	test('returns true at low health', () => {
		const gumble = makeCreature({ health: 18, maxHealth: 70, energy: 55, maxEnergy: 70 });
		const controller = makeController({ activeCreature: gumble });
		expect(isRetreating(gumble, controller as any)).toBe(true);
	});

	test('returns false while stable', () => {
		const gumble = makeCreature({ health: 50, maxHealth: 70, energy: 40, maxEnergy: 70 });
		const controller = makeController({ activeCreature: gumble });
		expect(isRetreating(gumble, controller as any)).toBe(false);
	});
});

describe('GumbleStrategy.scoreAbilityHex', () => {
	test('Pretty Ribbon prefers wounded allies over enemies', () => {
		const gumble = makeCreature({
			team: 0,
			hexagons: [makeHex({ x: 2, y: 2 })],
			abilities: [{}, {}, { isUpgraded: () => true }, {}],
		});
		const woundedAlly = makeCreature({ id: 2, team: 0, health: 30, maxHealth: 70 });
		const enemy = makeCreature({ id: 3, team: 1, health: 60, maxHealth: 70 });
		const allyHex = makeHex({ x: 2, y: 3, creature: woundedAlly });
		const enemyHex = makeHex({ x: 3, y: 3, creature: enemy });
		const controller = makeController({ activeCreature: gumble, creatures: [woundedAlly, enemy] });

		expect(scoreAbilityHex(allyHex, 2, controller as any)).toBeGreaterThan(
			scoreAbilityHex(enemyHex, 2, controller as any) as number,
		);
	});

	test('Pretty Ribbon favors larger wounded allies in support mode', () => {
		const bigWoundedAlly = makeCreature({
			id: 2,
			team: 0,
			level: 4,
			size: 2,
			health: 30,
			maxHealth: 90,
		});
		const smallWoundedAlly = makeCreature({
			id: 3,
			team: 0,
			level: 1,
			size: 1,
			health: 30,
			maxHealth: 90,
		});
		const frontliner = makeCreature({
			id: 4,
			team: 0,
			level: 5,
			size: 2,
			health: 90,
			maxHealth: 90,
		});
		const gumble = makeCreature({
			team: 0,
			hexagons: [makeHex({ x: 2, y: 2 })],
			abilities: [{}, {}, { isUpgraded: () => true }, {}],
		});
		const bigHex = makeHex({ x: 2, y: 3, creature: bigWoundedAlly });
		const smallHex = makeHex({ x: 3, y: 3, creature: smallWoundedAlly });
		const controller = makeController({
			activeCreature: gumble,
			creatures: [frontliner, bigWoundedAlly, smallWoundedAlly],
		});

		expect(scoreAbilityHex(bigHex, 2, controller as any)).toBeGreaterThan(
			scoreAbilityHex(smallHex, 2, controller as any) as number,
		);
	});

	test('Gummy Mallet strongly prefers clustered enemies over ally collateral', () => {
		const gumble = makeCreature({ team: 0 });
		const enemyOne = makeCreature({ id: 2, team: 1, health: 18, maxHealth: 70 });
		const enemyTwo = makeCreature({ id: 3, team: 1, health: 42, maxHealth: 70 });
		const ally = makeCreature({ id: 4, team: 0, health: 42, maxHealth: 70 });
		const clusterHex = makeHex({
			x: 4,
			y: 4,
			creature: enemyOne,
			adjacentHex: () => [makeHex({ creature: enemyTwo })],
		});
		const collateralHex = makeHex({
			x: 5,
			y: 4,
			creature: ally,
			adjacentHex: () => [makeHex({ creature: enemyTwo })],
		});
		const controller = makeController({
			activeCreature: gumble,
			creatures: [enemyOne, enemyTwo, ally],
		});

		const clusterScore = scoreAbilityHex(clusterHex, 1, controller as any) as number;
		const collateralScore = scoreAbilityHex(collateralHex, 1, controller as any) as number;
		expect(clusterScore).toBeGreaterThan(collateralScore + 500);
	});

	test('Gummy Mallet never targets own Dark Priest directly', () => {
		const gumble = makeCreature({ team: 0 });
		const alliedDarkPriest = makeCreature({
			id: 2,
			team: 0,
			type: '--',
			health: 70,
			maxHealth: 70,
		});
		const darkPriestHex = makeHex({
			x: 5,
			y: 5,
			creature: alliedDarkPriest,
			adjacentHex: () => [],
		});
		const controller = makeController({
			activeCreature: gumble,
			creatures: [alliedDarkPriest],
		});

		expect(scoreAbilityHex(darkPriestHex, 1, controller as any)).toBe(Number.NEGATIVE_INFINITY);
	});

	test('Gummy Mallet never targets splash that hits allied Dark Priest', () => {
		const gumble = makeCreature({ team: 0 });
		const enemy = makeCreature({ id: 2, team: 1, health: 40, maxHealth: 70 });
		const alliedDarkPriest = makeCreature({
			id: 3,
			team: 0,
			type: '--',
			health: 70,
			maxHealth: 70,
		});
		const riskyHex = makeHex({
			x: 5,
			y: 5,
			creature: enemy,
			adjacentHex: () => [makeHex({ creature: alliedDarkPriest })],
		});
		const controller = makeController({
			activeCreature: gumble,
			creatures: [enemy, alliedDarkPriest],
		});

		expect(scoreAbilityHex(riskyHex, 1, controller as any)).toBe(Number.NEGATIVE_INFINITY);
	});

	test('Boom Box prioritizes killable enemies', () => {
		const gumble = makeCreature({ team: 0 });
		const killableEnemy = makeCreature({ id: 2, team: 1, health: 12, maxHealth: 70 });
		const healthyEnemy = makeCreature({ id: 3, team: 1, health: 60, maxHealth: 70 });
		const killableHex = makeHex({ x: 4, y: 4, creature: killableEnemy });
		const healthyHex = makeHex({ x: 5, y: 4, creature: healthyEnemy });
		const controller = makeController({
			activeCreature: gumble,
			creatures: [killableEnemy, healthyEnemy],
		});

		expect(scoreAbilityHex(killableHex, 3, controller as any)).toBeGreaterThan(
			scoreAbilityHex(healthyHex, 3, controller as any) as number,
		);
	});

	test('Boom Box prefers Dark Priest harassment targets', () => {
		const gumble = makeCreature({ team: 0 });
		const darkPriest = makeCreature({ id: 2, team: 1, type: '--', health: 45, maxHealth: 70 });
		const regularEnemy = makeCreature({ id: 3, team: 1, type: 'S1', health: 45, maxHealth: 70 });
		const darkPriestHex = makeHex({ x: 4, y: 4, creature: darkPriest });
		const regularHex = makeHex({ x: 5, y: 4, creature: regularEnemy });
		const controller = makeController({
			activeCreature: gumble,
			creatures: [darkPriest, regularEnemy],
		});

		expect(scoreAbilityHex(darkPriestHex, 3, controller as any)).toBeGreaterThan(
			scoreAbilityHex(regularHex, 3, controller as any) as number,
		);
	});
});

describe('GumbleStrategy.scoreMoveHex', () => {
	test('upgraded Gooey Body prefers rushing enemy clusters', () => {
		const gumble = makeCreature({ team: 0, abilities: [{ isUpgraded: () => true }, {}, {}, {}] });
		const enemyOne = makeCreature({ id: 2, team: 1, x: 6, y: 6, health: 60, maxHealth: 70 });
		const enemyTwo = makeCreature({ id: 3, team: 1, x: 7, y: 6, health: 55, maxHealth: 70 });
		const darkPriest = makeCreature({
			id: 4,
			team: 1,
			type: '--',
			x: 8,
			y: 6,
			health: 50,
			maxHealth: 70,
		});

		const hotHex = makeHex({
			x: 6,
			y: 6,
			adjacentHex: () => [makeHex({ creature: enemyOne }), makeHex({ creature: enemyTwo })],
		});
		const coldHex = makeHex({ x: 2, y: 2, adjacentHex: () => [] });
		const controller = makeController({
			activeCreature: gumble,
			creatures: [enemyOne, enemyTwo, darkPriest],
		});

		expect(scoreMoveHex(hotHex, controller as any)).toBeGreaterThan(
			scoreMoveHex(coldHex, controller as any) as number,
		);
	});

	test('prefers adjacent Dark Priest pressure over non-priest pressure', () => {
		const gumble = makeCreature({ team: 0, abilities: [{ isUpgraded: () => true }, {}, {}, {}] });
		const darkPriest = makeCreature({
			id: 2,
			team: 1,
			type: '--',
			x: 6,
			y: 6,
			health: 60,
			maxHealth: 70,
		});
		const nonPriestEnemy = makeCreature({
			id: 3,
			team: 1,
			type: 'S1',
			x: 6,
			y: 6,
			health: 60,
			maxHealth: 70,
		});
		const darkPriestHex = makeHex({
			x: 6,
			y: 6,
			adjacentHex: () => [makeHex({ creature: darkPriest })],
		});
		const nonPriestHex = makeHex({
			x: 6,
			y: 6,
			adjacentHex: () => [makeHex({ creature: nonPriestEnemy })],
		});
		const controller = makeController({
			activeCreature: gumble,
			creatures: [darkPriest, nonPriestEnemy],
		});

		expect(scoreMoveHex(darkPriestHex, controller as any)).toBeGreaterThan(
			scoreMoveHex(nonPriestHex, controller as any) as number,
		);
	});
});

describe('GumbleStrategy.getAbilityPriority', () => {
	test('opens with Pretty Ribbon when a wounded ally is in range', () => {
		const woundedAlly = makeCreature({ id: 2, team: 0, health: 25, maxHealth: 70 });
		const gumble = makeCreature({
			team: 0,
			hexagons: [makeHex({ x: 2, y: 2 })],
			adjacentHexes: (distance: number) =>
				distance === 2 ? [makeHex({ creature: woundedAlly })] : [],
		});
		const controller = makeController({ activeCreature: gumble, creatures: [woundedAlly] });

		expect(getAbilityPriority(gumble, controller as any)).toEqual([2, 1, 3]);
	});

	test('goes support-first when bigger allies are alive', () => {
		const woundedAlly = makeCreature({
			id: 2,
			team: 0,
			health: 25,
			maxHealth: 70,
			level: 3,
			size: 2,
		});
		const gumble = makeCreature({
			team: 0,
			hexagons: [makeHex({ x: 2, y: 2 })],
			adjacentHexes: (distance: number) =>
				distance === 2 ? [makeHex({ creature: woundedAlly })] : [],
		});
		const controller = makeController({ activeCreature: gumble, creatures: [woundedAlly] });

		expect(getAbilityPriority(gumble, controller as any)).toEqual([2, 3, 1]);
	});

	test('keeps support-first when Dark Priest is not in hard-focus health range', () => {
		const woundedAlly = makeCreature({
			id: 2,
			team: 0,
			health: 25,
			maxHealth: 70,
			level: 3,
			size: 2,
		});
		const darkPriest = makeCreature({
			id: 3,
			team: 1,
			type: '--',
			health: 50,
			maxHealth: 70,
			x: 8,
			y: 6,
		});
		const gumble = makeCreature({
			team: 0,
			hexagons: [makeHex({ x: 2, y: 2 })],
			adjacentHexes: (distance: number) => {
				if (distance === 2) return [makeHex({ creature: woundedAlly })];
				if (distance === 6) return [makeHex({ creature: darkPriest })];
				return [];
			},
		});
		const controller = makeController({
			activeCreature: gumble,
			creatures: [woundedAlly, darkPriest],
		});

		expect(getAbilityPriority(gumble, controller as any)).toEqual([2, 3, 1]);
	});

	test('overrides support-first to hard-focus low-health Dark Priest', () => {
		const woundedAlly = makeCreature({
			id: 2,
			team: 0,
			health: 25,
			maxHealth: 70,
			level: 3,
			size: 2,
		});
		const lowDarkPriest = makeCreature({
			id: 3,
			team: 1,
			type: '--',
			health: 30,
			maxHealth: 70,
			x: 8,
			y: 6,
		});
		const gumble = makeCreature({
			team: 0,
			hexagons: [makeHex({ x: 2, y: 2 })],
			adjacentHexes: (distance: number) => {
				if (distance === 2) return [makeHex({ creature: woundedAlly })];
				if (distance === 6) return [makeHex({ creature: lowDarkPriest })];
				return [];
			},
		});
		const controller = makeController({
			activeCreature: gumble,
			creatures: [woundedAlly, lowDarkPriest],
		});

		expect(getAbilityPriority(gumble, controller as any)).toEqual([3, 1, 2]);
	});

	test('harasses Dark Priest first when no support window exists', () => {
		const darkPriest = makeCreature({
			id: 2,
			team: 1,
			type: '--',
			x: 8,
			y: 6,
			health: 50,
			maxHealth: 70,
		});
		const gumble = makeCreature({
			team: 0,
			hexagons: [makeHex({ x: 2, y: 2 })],
			adjacentHexes: (distance: number) =>
				distance === 6 ? [makeHex({ creature: darkPriest })] : [],
		});
		const controller = makeController({ activeCreature: gumble, creatures: [darkPriest] });

		expect(getAbilityPriority(gumble, controller as any)).toEqual([3, 1, 2]);
	});
});

describe('GumbleStrategy.counter hooks', () => {
	test('getTargetingPenalty returns 0', () => {
		const attacker = makeCreature({ team: 0 });
		const gumble = makeCreature({ team: 1 });
		const controller = makeController({ activeCreature: attacker, creatures: [gumble] });

		expect(getTargetingPenalty(attacker, gumble, 1, controller as any)).toBe(0);
	});

	test('getCounterTargetingModifier rises as Gumble gets weaker', () => {
		const attacker = makeCreature({ team: 0 });
		const healthyGumble = makeCreature({
			team: 1,
			health: 60,
			maxHealth: 70,
			abilities: [{}, {}, {}, {}],
		});
		const woundedGumble = makeCreature({
			team: 1,
			health: 15,
			maxHealth: 70,
			abilities: [{ isUpgraded: () => true }, {}, {}, {}],
		});

		expect(getCounterTargetingModifier(attacker, woundedGumble, 3, {} as any)).toBeGreaterThan(
			getCounterTargetingModifier(attacker, healthyGumble, 3, {} as any) as number,
		);
	});

	test('getProximityPenalty discourages healthy Gumble more than weakened Gumble', () => {
		const mover = makeCreature({ team: 0 });
		const healthyGumble = makeCreature({
			team: 1,
			health: 60,
			maxHealth: 70,
			abilities: [{}, {}, {}, {}],
		});
		const weakGumble = makeCreature({
			team: 1,
			health: 15,
			maxHealth: 70,
			abilities: [{ isUpgraded: () => true }, {}, {}, {}],
		});
		const destination = makeHex({ x: 5, y: 5 });

		expect(getProximityPenalty(mover, weakGumble, destination, {} as any)).toBeGreaterThan(
			getProximityPenalty(mover, healthyGumble, destination, {} as any) as number,
		);
	});
});
