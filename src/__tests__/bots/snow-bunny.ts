import { jest, expect, describe, test } from '@jest/globals';

// Mock heavy dependencies
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

import SnowBunnyStrategy from '../../bots/Snow-Bunny';
import { Creature } from '../../creature';
import { Hex } from '../../utility/hex';

// ---------------------------------------------------------------------------
// Shared mock builders
// ---------------------------------------------------------------------------

/** Create a minimal Creature-like mock that satisfies instanceof Creature. */
const makeCreature = ({
	id = 1,
	team = 0,
	x = 0,
	y = 0,
	health = 55,
	maxHealth = 55,
	energy = 75,
	maxEnergy = 75,
	size = 1,
	frozen = false,
	flipped = false,
	abilities = [] as any[],
	adjacentHexes = (_: number) => [] as Hex[],
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
	frozen: boolean;
	flipped: boolean;
	abilities: any[];
	adjacentHexes: (n: number) => Hex[];
}> = {}) => {
	const c = Object.create(Creature.prototype);
	Object.assign(c, {
		id,
		team,
		x,
		y,
		health,
		stats: { health: maxHealth, energy: maxEnergy },
		energy,
		size,
		dead: false,
		temp: false,
		hexagons: [{ x, y }],
		player: { id: team, flipped, controller: 'bot' },
		abilities,
		isFrozen: () => frozen,
		adjacentHexes,
	});
	return c as Creature & { team: number };
};

/** Create a minimal Hex mock. */
const makeHex = ({
	x = 0,
	y = 0,
	creature = undefined as (Creature & { team: number }) | undefined,
	adjacentHex = (_: number) => [] as (Hex & { creature?: Creature & { team: number } })[],
} = {}) =>
	({
		x,
		y,
		creature,
		adjacentHex,
	} as unknown as Hex);

/** Create a minimal BotController mock used when calling strategy methods. */
const makeController = ({
	activeCreature,
	creatures = [] as (Creature & { team: number })[],
	drops = [] as any[],
	flipped = false,
	hexAt = (_x: number, _y: number) => undefined as Hex | undefined,
	closestDistanceToEnemyFn = (_pos: { x: number; y: number }) => 10,
	isRetreatingFn = (_c: Creature) => false,
}: {
	activeCreature: Creature & { team: number };
	creatures?: (Creature & { team: number })[];
	drops?: any[];
	flipped?: boolean;
	hexAt?: (x: number, y: number) => Hex | undefined;
	closestDistanceToEnemyFn?: (pos: { x: number; y: number }) => number;
	isRetreatingFn?: (c: Creature) => boolean;
}) => ({
	game: {
		activeCreature,
		creatures: [activeCreature, ...creatures],
		drops,
		grid: {
			hexes: [Array(16).fill(null)],
			hexAt,
		},
	},
	getStrategyFor: () => undefined,
	closestDistanceToEnemy: closestDistanceToEnemyFn,
	isRetreating: isRetreatingFn,
	getPreferredX: (c: Creature & { player: { flipped: boolean } }) => {
		const boardWidth = 15;
		return c.player.flipped ? boardWidth * 0.95 : boardWidth * 0.05;
	},
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SnowBunnyStrategy.isRetreating', () => {
	test('returns true at 44% health (above generic 30% threshold)', () => {
		const creature = makeCreature({ health: 24, maxHealth: 55 }); // ~43.6%
		const controller = makeController({ activeCreature: creature });
		expect(SnowBunnyStrategy.isRetreating!(creature, controller as any)).toBe(true);
	});

	test('returns false at 50% health (safe range for Snow Bunny)', () => {
		const creature = makeCreature({ health: 28, maxHealth: 55 }); // ~50.9%
		const controller = makeController({ activeCreature: creature });
		expect(SnowBunnyStrategy.isRetreating!(creature, controller as any)).toBe(false);
	});

	test('returns true when energy is below 25%', () => {
		const creature = makeCreature({ health: 55, maxHealth: 55, energy: 18, maxEnergy: 75 }); // 24%
		const controller = makeController({ activeCreature: creature });
		expect(SnowBunnyStrategy.isRetreating!(creature, controller as any)).toBe(true);
	});
});

describe('SnowBunnyStrategy.getPreferredX', () => {
	test('returns ~5% from left edge for non-flipped player', () => {
		const creature = makeCreature({ flipped: false });
		const controller = makeController({ activeCreature: creature });
		expect(SnowBunnyStrategy.getPreferredX!(creature, controller as any)).toBeCloseTo(0.75); // 15 * 0.05
	});

	test('returns ~95% from left edge for flipped player', () => {
		const creature = makeCreature({ flipped: true });
		const controller = makeController({ activeCreature: creature });
		expect(SnowBunnyStrategy.getPreferredX!(creature, controller as any)).toBeCloseTo(14.25); // 15 * 0.95
	});
});

describe('SnowBunnyStrategy.scoreMoveHex', () => {
	test('returns undefined when retreating (falls through to generic)', () => {
		const bunny = makeCreature({ x: 5 });
		const controller = makeController({
			activeCreature: bunny,
			isRetreatingFn: () => true,
		});
		const hex = makeHex({ x: 5, y: 3 });
		expect(SnowBunnyStrategy.scoreMoveHex!(hex, controller as any)).toBeUndefined();
	});

	test('penalises hexes adjacent to enemies', () => {
		const bunny = makeCreature({ team: 0, x: 5 });
		const enemy = makeCreature({ team: 1, x: 6 });
		const safeHex = makeHex({ x: 5, y: 3, adjacentHex: () => [] });
		const dangerHex = makeHex({
			x: 5,
			y: 3,
			adjacentHex: () => [{ ...makeHex({ x: 6, y: 3 }), creature: enemy }] as any,
		});
		const controller = makeController({ activeCreature: bunny });

		const safeScore = SnowBunnyStrategy.scoreMoveHex!(safeHex, controller as any) as number;
		const dangerScore = SnowBunnyStrategy.scoreMoveHex!(dangerHex, controller as any) as number;
		expect(dangerScore).toBeLessThan(safeScore);
	});

	test('rewards hexes adjacent to allies', () => {
		const bunny = makeCreature({ team: 0, x: 5 });
		const ally = makeCreature({ team: 0, id: 2, x: 4 });
		const openHex = makeHex({ x: 5, y: 3, adjacentHex: () => [] });
		const coveredHex = makeHex({
			x: 5,
			y: 3,
			adjacentHex: () => [{ ...makeHex({ x: 4, y: 3 }), creature: ally }] as any,
		});
		const controller = makeController({ activeCreature: bunny, creatures: [ally] });

		const openScore = SnowBunnyStrategy.scoreMoveHex!(openHex, controller as any) as number;
		const coveredScore = SnowBunnyStrategy.scoreMoveHex!(coveredHex, controller as any) as number;
		expect(coveredScore).toBeGreaterThan(openScore);
	});

	test('prefers home-side x position (non-flipped: low x is better)', () => {
		const bunny = makeCreature({ team: 0, flipped: false, x: 5 });
		const controller = makeController({ activeCreature: bunny });

		const homeHex = makeHex({ x: 1, y: 3, adjacentHex: () => [] });
		const midHex = makeHex({ x: 8, y: 3, adjacentHex: () => [] });
		const homeScore = SnowBunnyStrategy.scoreMoveHex!(homeHex, controller as any) as number;
		const midScore = SnowBunnyStrategy.scoreMoveHex!(midHex, controller as any) as number;
		expect(homeScore).toBeGreaterThan(midScore);
	});

	test('penalises staying on same row as enemy after Freezing Spit is used', () => {
		const freezingSpitAbility = { used: true };
		const bunny = makeCreature({
			team: 0,
			x: 3,
			y: 3,
			abilities: [null, null, { used: false }, freezingSpitAbility],
		});
		const enemy = makeCreature({ team: 1, x: 10, y: 3 });
		// Same row as enemy (y=3) vs safe off-row hex (y=4)
		const inLineHex = makeHex({ x: 3, y: 3, adjacentHex: () => [] });
		const offLineHex = makeHex({ x: 3, y: 4, adjacentHex: () => [] });
		const controller = makeController({ activeCreature: bunny, creatures: [enemy] });

		const inLineScore = SnowBunnyStrategy.scoreMoveHex!(inLineHex, controller as any) as number;
		const offLineScore = SnowBunnyStrategy.scoreMoveHex!(offLineHex, controller as any) as number;
		expect(inLineScore).toBeLessThan(offLineScore);
	});

	test('penalises staying on diagonal axis as enemy after Blowing Wind is used', () => {
		const blowingWindAbility = { used: true };
		const bunny = makeCreature({
			team: 0,
			x: 4,
			y: 4,
			abilities: [null, null, blowingWindAbility, { used: false }],
		});
		// Enemy at (6, 6): dx=2, dy=2, floor(2/2)=1 ≠ 2 — NOT diagonal
		// Enemy at (6, 4): dx=2, dy=0 — same row (straight)
		// Let's use: enemy at (6, 6): dx=2, dy=2, floor(dy/2)=1 ≠ dx=2 → not diagonal
		// Use: enemy at (5, 6): dx=1, dy=2, floor(2/2)=1 === dx=1 → diagonal ✓
		const enemy = makeCreature({ team: 1, x: 5, y: 6 });
		const diagHex = makeHex({ x: 4, y: 4, adjacentHex: () => [] }); // same diagonal as enemy
		const safeHex = makeHex({ x: 4, y: 5, adjacentHex: () => [] }); // dy=1, dx=0 → not diagonal
		const controller = makeController({ activeCreature: bunny, creatures: [enemy] });

		const diagScore = SnowBunnyStrategy.scoreMoveHex!(diagHex, controller as any) as number;
		const safeScore = SnowBunnyStrategy.scoreMoveHex!(safeHex, controller as any) as number;
		expect(diagScore).toBeLessThan(safeScore);
	});

	test('does NOT penalise in-line position when abilities have not been used', () => {
		const bunny = makeCreature({
			team: 0,
			x: 3,
			y: 3,
			abilities: [null, null, { used: false }, { used: false }],
		});
		const enemy = makeCreature({ team: 1, x: 10, y: 3 });
		const inLineHex = makeHex({ x: 3, y: 3, adjacentHex: () => [] });
		const controller = makeController({ activeCreature: bunny, creatures: [enemy] });

		// Score should not have the penalty — just check it is not massively negative
		const score = SnowBunnyStrategy.scoreMoveHex!(inLineHex, controller as any) as number;
		// Without the penalty the score is only zone-preference based; should be > -50
		expect(score).toBeGreaterThan(-50);
	});
});

describe('SnowBunnyStrategy.scoreAbilityHex – Freezing Spit (index 3)', () => {
	test('returns NEGATIVE_INFINITY for non-enemy hex', () => {
		const bunny = makeCreature({ team: 0, x: 5 });
		const ally = makeCreature({ team: 0, id: 2, x: 3 });
		const hex = makeHex({ x: 3, y: 3, creature: ally });
		const controller = makeController({ activeCreature: bunny });
		expect(SnowBunnyStrategy.scoreAbilityHex!(hex, 3, controller as any)).toBe(
			Number.NEGATIVE_INFINITY,
		);
	});

	test('prefers more distant enemies (higher crush damage scaling)', () => {
		const bunny = makeCreature({ team: 0, x: 5, y: 3 });
		const nearEnemy = makeCreature({ team: 1, x: 7, y: 3, health: 30 });
		const farEnemy = makeCreature({ team: 1, x: 9, y: 3, health: 30 });
		const nearHex = makeHex({ x: 7, y: 3, creature: nearEnemy });
		const farHex = makeHex({ x: 9, y: 3, creature: farEnemy });
		const controller = makeController({ activeCreature: bunny, creatures: [nearEnemy, farEnemy] });

		const nearScore = SnowBunnyStrategy.scoreAbilityHex!(nearHex, 3, controller as any) as number;
		const farScore = SnowBunnyStrategy.scoreAbilityHex!(farHex, 3, controller as any) as number;
		expect(farScore).toBeGreaterThan(nearScore);
	});

	test('prefers unfrozen target over a healthy frozen one (re-freeze bonus wasted)', () => {
		const bunny = makeCreature({ team: 0, x: 5, y: 3 });
		const frozenEnemy = makeCreature({
			team: 1,
			x: 8,
			y: 3,
			health: 40,
			maxHealth: 55,
			frozen: true,
		});
		const normalEnemy = makeCreature({
			team: 1,
			x: 8,
			y: 3,
			health: 40,
			maxHealth: 55,
			frozen: false,
		});
		const frozenHex = makeHex({ x: 8, y: 3, creature: frozenEnemy });
		const normalHex = makeHex({ x: 8, y: 3, creature: normalEnemy });
		const controller = makeController({ activeCreature: bunny });

		const frozenScore = SnowBunnyStrategy.scoreAbilityHex!(
			frozenHex,
			3,
			controller as any,
		) as number;
		const normalScore = SnowBunnyStrategy.scoreAbilityHex!(
			normalHex,
			3,
			controller as any,
		) as number;
		expect(frozenScore).toBeLessThan(normalScore);
	});

	test('prioritises finishing a low-health frozen target', () => {
		const bunny = makeCreature({ team: 0, x: 5, y: 3 });
		const dyingFrozenEnemy = makeCreature({
			team: 1,
			x: 8,
			y: 3,
			health: 5,
			maxHealth: 55,
			frozen: true,
		});
		const healthyEnemy = makeCreature({
			team: 1,
			x: 8,
			y: 3,
			health: 40,
			maxHealth: 55,
			frozen: false,
		});
		const dyingHex = makeHex({ x: 8, y: 3, creature: dyingFrozenEnemy });
		const healthyHex = makeHex({ x: 8, y: 3, creature: healthyEnemy });
		const controller = makeController({ activeCreature: bunny });

		const dyingScore = SnowBunnyStrategy.scoreAbilityHex!(dyingHex, 3, controller as any) as number;
		const healthyScore = SnowBunnyStrategy.scoreAbilityHex!(
			healthyHex,
			3,
			controller as any,
		) as number;
		expect(dyingScore).toBeGreaterThan(healthyScore);
	});
});

describe('SnowBunnyStrategy.scoreAbilityHex – Big Pliers (index 1)', () => {
	test('scores frozen+upgraded target highest', () => {
		const bigPliersAbility = { isUpgraded: () => true };
		const bunny = makeCreature({
			team: 0,
			x: 5,
			abilities: [null, bigPliersAbility, null, null],
		});
		const frozenEnemy = makeCreature({ team: 1, x: 6, health: 30, frozen: true });
		const normalEnemy = makeCreature({ team: 1, x: 6, health: 30, frozen: false });
		const frozenHex = makeHex({ x: 6, y: 3, creature: frozenEnemy });
		const normalHex = makeHex({ x: 6, y: 3, creature: normalEnemy });
		const controller = makeController({ activeCreature: bunny });

		const frozenScore = SnowBunnyStrategy.scoreAbilityHex!(
			frozenHex,
			1,
			controller as any,
		) as number;
		const normalScore = SnowBunnyStrategy.scoreAbilityHex!(
			normalHex,
			1,
			controller as any,
		) as number;
		expect(frozenScore).toBeGreaterThan(normalScore);
	});

	test('applies getTargetingPenalty from the target unit strategy', () => {
		const bunny = makeCreature({ team: 0, x: 5 });
		const enemy = makeCreature({ team: 1, x: 6, health: 30, frozen: false });
		// Give the enemy a fake type that maps to a strategy with a penalty
		(enemy as any).type = 'X9';
		const hex = makeHex({ x: 6, y: 3, creature: enemy });
		const controller = makeController({ activeCreature: bunny });

		// Temporarily register a strategy with a -300 penalty for the fake type
		const { unitStrategies } = jest.requireActual('../../bot') as any;
		const restore = unitStrategies['X9'];
		unitStrategies['X9'] = { getTargetingPenalty: () => -300 };

		const penalisedScore = SnowBunnyStrategy.scoreAbilityHex!(hex, 1, controller as any) as number;
		unitStrategies['X9'] = restore; // clean up

		const noPenaltyScore = SnowBunnyStrategy.scoreAbilityHex!(
			makeHex({ x: 6, y: 3, creature: makeCreature({ team: 1, x: 6, health: 30 }) }),
			1,
			controller as any,
		) as number;

		expect(penalisedScore).toBeLessThan(noPenaltyScore);
	});
});

describe('SnowBunnyStrategy.scoreAbilityHex – Blowing Wind (index 2)', () => {
	test('penalises pushing enemy next to a low-health ally', () => {
		const bunny = makeCreature({ team: 0, x: 5, y: 3 });
		const enemy = makeCreature({ team: 1, x: 7, y: 3, size: 1 });
		// Weak ally sits at x=12 – approximate landing (7 + 5 push steps) = 12
		const weakAlly = makeCreature({
			team: 0,
			id: 3,
			x: 12,
			y: 3,
			health: 10,
			maxHealth: 55,
		});
		// Safe push scenario: no allies near landing
		const safeEnemy = makeCreature({ team: 1, x: 7, y: 3, size: 1 });
		const endangeringHex = makeHex({ x: 7, y: 3, creature: enemy });
		const safeHex = makeHex({ x: 7, y: 3, creature: safeEnemy });

		const dangerController = makeController({
			activeCreature: bunny,
			creatures: [enemy, weakAlly],
		});
		const safeController = makeController({
			activeCreature: bunny,
			creatures: [safeEnemy],
		});

		const dangerScore = SnowBunnyStrategy.scoreAbilityHex!(
			endangeringHex,
			2,
			dangerController as any,
		) as number;
		const safeScore = SnowBunnyStrategy.scoreAbilityHex!(
			safeHex,
			2,
			safeController as any,
		) as number;
		expect(dangerScore).toBeLessThan(safeScore);
	});

	test('penalises pushing ally onto a trap path', () => {
		const bunny = makeCreature({ team: 0, x: 5, y: 3 });
		const allyInDanger = makeCreature({ team: 0, id: 2, x: 7, y: 3, size: 1 });
		const trapHex = makeHex({ x: 9, y: 3 });
		Object.defineProperty(trapHex, 'trap', { get: () => ({ name: 'spike' }) });

		const allyHex = makeHex({ x: 7, y: 3, creature: allyInDanger });
		const safeAllyHex = makeHex({ x: 7, y: 3, creature: allyInDanger });

		const trapController = makeController({
			activeCreature: bunny,
			creatures: [allyInDanger],
			hexAt: (x, y) => (x === 9 && y === 3 ? (trapHex as any) : undefined),
			closestDistanceToEnemyFn: (pos) => (pos.x <= 7 ? 1 : 5),
		});
		const safeController = makeController({
			activeCreature: bunny,
			creatures: [allyInDanger],
			hexAt: () => undefined,
			closestDistanceToEnemyFn: (pos) => (pos.x <= 7 ? 1 : 5),
		});

		const trapScore = SnowBunnyStrategy.scoreAbilityHex!(
			allyHex,
			2,
			trapController as any,
		) as number;
		const safeScore = SnowBunnyStrategy.scoreAbilityHex!(
			safeAllyHex,
			2,
			safeController as any,
		) as number;
		expect(trapScore).toBeLessThan(safeScore);
	});
});

describe('SnowBunnyStrategy.getAbilityPriority', () => {
	test('default order is Freezing Spit → Blowing Wind → Big Pliers', () => {
		const bunny = makeCreature({ adjacentHexes: () => [] });
		const controller = makeController({ activeCreature: bunny });
		expect(SnowBunnyStrategy.getAbilityPriority!(bunny, controller as any)).toEqual([3, 2, 1]);
	});

	test('Big Pliers goes first when a frozen enemy is adjacent', () => {
		const frozenEnemy = makeCreature({ team: 1, id: 2, frozen: true });
		const adjacentHexWithFrozenEnemy = makeHex({ creature: frozenEnemy as any });
		const bunny = makeCreature({
			adjacentHexes: () => [adjacentHexWithFrozenEnemy],
		});
		const controller = makeController({ activeCreature: bunny, creatures: [frozenEnemy] });
		expect(SnowBunnyStrategy.getAbilityPriority!(bunny, controller as any)).toEqual([1, 3, 2]);
	});

	test('default order when adjacent hex has no creature', () => {
		const bunny = makeCreature({ adjacentHexes: () => [makeHex()] });
		const controller = makeController({ activeCreature: bunny });
		expect(SnowBunnyStrategy.getAbilityPriority!(bunny, controller as any)).toEqual([3, 2, 1]);
	});
});
