/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, expect, describe, test } from '@jest/globals';

jest.mock('../../utility/hex', () => ({
	Hex: class Hex {},
}));
jest.mock('../../utility/matrices', () => ({
	frontnback3hex: {},
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

import VehemothStrategy from '../../bots/Vehemoth';
import { Creature } from '../../creature';
import { Hex } from '../../utility/hex';

const {
	isRetreating,
	scoreAbilityHex,
	getAbilityPriority,
	getCounterTargetingModifier,
	getProximityPenalty,
	getTargetingPenalty,
} = VehemothStrategy as Required<typeof VehemothStrategy>;

const makeCreature = ({
	id = 1,
	team = 0,
	x = 0,
	y = 0,
	health = 100,
	maxHealth = 100,
	energy = 60,
	maxEnergy = 80,
	level = 7,
	size = 1,
	frozen = false,
	fatigued = false,
	flipped = false,
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
	frozen: boolean;
	fatigued: boolean;
	flipped: boolean;
	abilities: any[];
	getHexMap: (_matrix: any, _flipped: boolean) => Hex[];
}> = {}) => {
	const c = Object.create(Creature.prototype);
	Object.assign(c, {
		id,
		team,
		realm: 'S',
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
		isFrozen: () => frozen,
		isFatigued: () => fatigued,
		getHexMap,
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
	getPreferredX: () => 10,
	isRetreating: (_c: Creature) => false,
	closestDistanceToEnemy: (_pos: { x: number; y: number }) => 5,
	closestDistanceToDrop: (_pos: { x: number; y: number }) => 10,
});

describe('VehemothStrategy.isRetreating', () => {
	test('returns true at very low health', () => {
		const vehemoth = makeCreature({ health: 18, maxHealth: 100, energy: 60, maxEnergy: 80 });
		const controller = makeController({ activeCreature: vehemoth });
		expect(isRetreating(vehemoth, controller as any)).toBe(true);
	});

	test('returns false at moderate health and energy', () => {
		const vehemoth = makeCreature({ health: 60, maxHealth: 100, energy: 40, maxEnergy: 80 });
		const controller = makeController({ activeCreature: vehemoth });
		expect(isRetreating(vehemoth, controller as any)).toBe(false);
	});
});

describe('VehemothStrategy.scoreAbilityHex', () => {
	test('Flat Frons strongly prefers frozen executable targets', () => {
		const vehemoth = makeCreature({ team: 0, level: 7 });
		const execTarget = makeCreature({
			id: 2,
			team: 1,
			health: 40,
			maxHealth: 120,
			frozen: true,
			fatigued: true,
			level: 6,
		});
		const normalTarget = makeCreature({
			id: 3,
			team: 1,
			health: 90,
			maxHealth: 120,
			frozen: false,
			level: 6,
		});
		const execHex = makeHex({ x: 3, y: 3, creature: execTarget });
		const normalHex = makeHex({ x: 4, y: 3, creature: normalTarget });
		const controller = makeController({ activeCreature: vehemoth });

		const execScore = scoreAbilityHex(execHex, 1, controller as any) as number;
		const normalScore = scoreAbilityHex(normalHex, 1, controller as any) as number;
		expect(execScore).toBeGreaterThan(normalScore);
	});

	test('Flake Convertor rejects non-fatigued targets', () => {
		const vehemoth = makeCreature({ team: 0, level: 7 });
		const enemy = makeCreature({
			id: 2,
			team: 1,
			health: 70,
			maxHealth: 120,
			fatigued: false,
			frozen: false,
		});
		const hex = makeHex({ x: 3, y: 3, creature: enemy });
		const controller = makeController({ activeCreature: vehemoth });

		expect(scoreAbilityHex(hex, 2, controller as any)).toBe(Number.NEGATIVE_INFINITY);
	});

	test('Flake Convertor prefers higher-level fatigued targets', () => {
		const vehemoth = makeCreature({ team: 0, level: 7, x: 5, y: 5 });
		const lowLevelEnemy = makeCreature({
			id: 2,
			team: 1,
			x: 6,
			y: 5,
			health: 80,
			maxHealth: 120,
			fatigued: true,
			level: 2,
			maxEnergy: 80,
			energy: 40,
		});
		const highLevelEnemy = makeCreature({
			id: 3,
			team: 1,
			x: 7,
			y: 5,
			health: 80,
			maxHealth: 120,
			fatigued: true,
			level: 7,
			maxEnergy: 80,
			energy: 40,
		});
		const lowHex = makeHex({ x: 6, y: 5, creature: lowLevelEnemy });
		const highHex = makeHex({ x: 7, y: 5, creature: highLevelEnemy });
		const controller = makeController({ activeCreature: vehemoth });

		const lowScore = scoreAbilityHex(lowHex, 2, controller as any) as number;
		const highScore = scoreAbilityHex(highHex, 2, controller as any) as number;
		expect(highScore).toBeGreaterThan(lowScore);
	});
});

describe('VehemothStrategy.getAbilityPriority', () => {
	test('uses Flat Frons first when a frozen executable target is in range', () => {
		const frozenExecTarget = makeCreature({
			id: 2,
			team: 1,
			health: 45,
			maxHealth: 120,
			frozen: true,
			fatigued: true,
		});

		const vehemoth = makeCreature({
			team: 0,
			getHexMap: () => [makeHex({ x: 6, y: 5, creature: frozenExecTarget })],
		});
		const controller = makeController({ activeCreature: vehemoth });

		expect(getAbilityPriority(vehemoth, controller as any)).toEqual([1, 2, 3]);
	});

	test('prefers Flake Convertor first when execute is not available', () => {
		const enemy = makeCreature({
			id: 2,
			team: 1,
			health: 80,
			maxHealth: 120,
			frozen: false,
			fatigued: true,
		});

		const vehemoth = makeCreature({
			team: 0,
			getHexMap: () => [makeHex({ x: 6, y: 5, creature: enemy })],
		});
		const controller = makeController({ activeCreature: vehemoth });

		expect(getAbilityPriority(vehemoth, controller as any)).toEqual([2, 3, 1]);
	});
});

describe('VehemothStrategy.counter hooks', () => {
	test('getTargetingPenalty returns 0 (no retaliation)', () => {
		const vehemoth = makeCreature({ team: 1 });
		const attacker = makeCreature({ team: 0 });
		const controller = makeController({ activeCreature: attacker, creatures: [vehemoth] });

		expect(getTargetingPenalty(attacker, vehemoth, 1, controller as any)).toBe(0);
	});

	test('getCounterTargetingModifier increases when Vehemoth is isolated and low energy', () => {
		const attacker = makeCreature({ team: 0, realm: 'A' } as any);
		const isolatedVehemoth = makeCreature({
			team: 1,
			health: 120,
			maxHealth: 245,
			energy: 10,
			maxEnergy: 80,
		});
		const supportedVehemoth = makeCreature({
			team: 1,
			health: 245,
			maxHealth: 245,
			energy: 70,
			maxEnergy: 80,
		});
		const slothAlly1 = makeCreature({ id: 3, team: 1 });
		const slothAlly2 = makeCreature({ id: 4, team: 1 });
		const slothAlly3 = makeCreature({ id: 5, team: 1 });

		const isolatedController = makeController({
			activeCreature: attacker,
			creatures: [isolatedVehemoth],
		});
		const supportedController = makeController({
			activeCreature: attacker,
			creatures: [supportedVehemoth, slothAlly1, slothAlly2, slothAlly3],
		});

		const isolatedScore = getCounterTargetingModifier(
			attacker,
			isolatedVehemoth,
			1,
			isolatedController as any,
		) as number;
		const supportedScore = getCounterTargetingModifier(
			attacker,
			supportedVehemoth,
			1,
			supportedController as any,
		) as number;

		expect(isolatedScore).toBeGreaterThan(supportedScore);
	});

	test('getProximityPenalty heavily penalizes frozen mover in shatter range', () => {
		const vehemoth = makeCreature({
			team: 1,
			health: 245,
			maxHealth: 245,
			energy: 70,
			maxEnergy: 80,
		});
		const vulnerableMover = makeCreature({ team: 0, frozen: true, health: 45, maxHealth: 100 });
		const healthyMover = makeCreature({
			team: 0,
			frozen: false,
			fatigued: false,
			health: 100,
			maxHealth: 100,
		});
		const destination = makeHex({ x: 6, y: 6 });
		const controller = makeController({ activeCreature: healthyMover, creatures: [vehemoth] });

		const vulnerableScore = getProximityPenalty(
			vulnerableMover,
			vehemoth,
			destination,
			controller as any,
		) as number;
		const healthyScore = getProximityPenalty(
			healthyMover,
			vehemoth,
			destination,
			controller as any,
		) as number;

		expect(vulnerableScore).toBeLessThan(healthyScore - 500);
	});
});
