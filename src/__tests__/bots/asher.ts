/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, describe, test } from '@jest/globals';

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
jest.mock('../../utility/pointfacade', () => ({
	getPointFacade: () => ({
		getTrapsAt: (hex: { traps?: { effects: unknown[] }[] }) => hex.traps ?? [],
	}),
}));

import { unitStrategies } from '../../bot';
import AsherStrategy from '../../bots/Asher';
import { Creature } from '../../creature';
import { Hex } from '../../utility/hex';

const strategy = AsherStrategy as Required<typeof AsherStrategy>;

const makeCreature = ({
	id = 1,
	team = 0,
	x = 0,
	y = 0,
	health = 60,
	maxHealth = 60,
	energy = 60,
	maxEnergy = 60,
	size = 1,
	type = 'L1',
	frozen = false,
	dizzy = false,
	moveable = true,
	effects = [] as { trigger: string; isDeleted?: boolean }[],
	hexagons = [] as { traps?: { effects: { trigger: string; isDeleted?: boolean }[] }[] }[],
}: Partial<{
	id: number;
	team: number;
	x: number;
	y: number;
	health: number;
	maxHealth: number;
	energy: number;
	maxEnergy: number;
	size: number;
	type: string;
	frozen: boolean;
	dizzy: boolean;
	moveable: boolean;
	effects: { trigger: string; isDeleted?: boolean }[];
	hexagons: { traps?: { effects: { trigger: string; isDeleted?: boolean }[] }[] }[];
}> = {}) => {
	const creature = Object.create(Creature.prototype);
	Object.assign(creature, {
		id,
		team,
		x,
		y,
		health,
		size,
		type,
		energy,
		effects,
		hexagons,
		stats: { health: maxHealth, energy: maxEnergy, moveable },
		isFrozen: () => frozen,
		isDizzy: () => dizzy,
	});
	return creature as Creature & {
		id: number;
		team: number;
		x: number;
		y: number;
		health: number;
		energy: number;
		size: number;
		type: string;
		stats: { health: number; energy: number };
		effects: { trigger: string; isDeleted?: boolean }[];
		hexagons: { traps?: { effects: { trigger: string; isDeleted?: boolean }[] }[] }[];
		isFrozen: () => boolean;
		isDizzy: () => boolean;
	};
};

const makeHex = (creature?: Creature) => ({ creature } as Hex);

const makeController = (activeCreature: Creature, creatures: Creature[] = []) =>
	({
		game: { activeCreature, creatures: [activeCreature, ...creatures] },
	} as any);

describe('AsherStrategy', () => {
	test('scores lethal attacks above non-lethal attacks', () => {
		const asher = makeCreature();
		const lethalEnemy = makeCreature({ id: 2, team: 1, health: 15 });
		const healthyEnemy = makeCreature({ id: 3, team: 1, health: 55 });
		const controller = makeController(asher);

		const lethalScore = strategy.scoreAbilityHex(makeHex(lethalEnemy), 1, controller) as number;
		const healthyScore = strategy.scoreAbilityHex(makeHex(healthyEnemy), 1, controller) as number;

		expect(lethalScore).toBeGreaterThan(healthyScore);
	});

	test('prefers Crashing Globe targets immobilized for its delayed impact', () => {
		const asher = makeCreature();
		const mobileEnemy = makeCreature({ id: 2, team: 1 });
		const immobilizedEnemy = makeCreature({ id: 3, team: 1, frozen: true });
		const controller = makeController(asher);

		const mobileScore = strategy.scoreAbilityHex(makeHex(mobileEnemy), 3, controller) as number;
		const immobilizedScore = strategy.scoreAbilityHex(
			makeHex(immobilizedEnemy),
			3,
			controller,
		) as number;

		expect(immobilizedScore).toBeGreaterThan(mobileScore);
	});

	test('scores any active step-out effect without relying on trap names', () => {
		const asher = makeCreature();
		const mobileEnemy = makeCreature({ id: 2, team: 1 });
		const trappedEnemy = makeCreature({
			id: 3,
			team: 1,
			hexagons: [
				{
					traps: [
						{
							effects: [{ trigger: 'onStepOut', isDeleted: false }],
						},
					],
				},
			],
		});
		const controller = makeController(asher);

		const mobileScore = strategy.scoreAbilityHex(makeHex(mobileEnemy), 3, controller) as number;
		const trappedScore = strategy.scoreAbilityHex(makeHex(trappedEnemy), 3, controller) as number;

		expect(trappedScore).toBeGreaterThan(mobileScore);
	});

	test('keeps Acrylic Walls low priority unless the Globe can destroy one', () => {
		const asher = makeCreature();
		const controller = makeController(asher);
		const wall = makeCreature({
			id: 2,
			team: 1,
			type: 'O0',
			health: 100,
			maxHealth: 100,
			moveable: false,
		});
		const ordinaryEnemy = makeCreature({ id: 3, team: 1 });
		const weakenedWall = makeCreature({
			id: 4,
			team: 1,
			type: 'O0',
			health: 20,
			maxHealth: 100,
			moveable: false,
		});
		const wallScore = strategy.scoreAbilityHex(makeHex(wall), 3, controller) as number;
		const enemyScore = strategy.scoreAbilityHex(makeHex(ordinaryEnemy), 3, controller) as number;
		const weakenedWallScore = strategy.scoreAbilityHex(
			makeHex(weakenedWall),
			3,
			controller,
		) as number;

		expect(wallScore).toBeGreaterThan(Number.NEGATIVE_INFINITY);
		expect(wallScore).toBeLessThan(enemyScore);
		expect(weakenedWallScore).toBeGreaterThan(350);
	});

	test('prioritizes immediate attacks when enemies are nearby and Globe otherwise', () => {
		const asher = makeCreature({ x: 4, y: 4 });
		const nearbyEnemy = makeCreature({ id: 2, team: 1, x: 8, y: 4 });
		const distantEnemy = makeCreature({ id: 3, team: 1, x: 14, y: 4 });

		expect(strategy.getAbilityPriority(asher, makeController(asher, [nearbyEnemy]))).toEqual([
			2, 1, 3,
		]);
		expect(strategy.getAbilityPriority(asher, makeController(asher, [distantEnemy]))).toEqual([
			3, 2, 1,
		]);
	});

	test('retreats below a quarter health', () => {
		const asher = makeCreature({ health: 15, maxHealth: 65 });
		expect(strategy.isRetreating(asher, makeController(asher))).toBe(true);
	});

	test('retreats when energy is nearly depleted', () => {
		const asher = makeCreature({ energy: 8 });
		expect(strategy.isRetreating(asher, makeController(asher))).toBe(true);
	});

	test('is registered for Asher units', () => {
		expect(unitStrategies.L1).toBe(AsherStrategy);
	});
});
