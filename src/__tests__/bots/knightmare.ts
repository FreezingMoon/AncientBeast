/* eslint-disable @typescript-eslint/no-explicit-any */
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

import KnightmareStrategy from '../../bots/Knightmare';
import { Creature } from '../../creature';
import { Hex } from '../../utility/hex';

const { scoreMoveHex, getHoldPositionScore, getAbilityMinScore, getAbilityPriority } =
	KnightmareStrategy as Required<typeof KnightmareStrategy>;

// ---------------------------------------------------------------------------
// Shared mock builders
// ---------------------------------------------------------------------------

const makeCreature = ({
	id = 1,
	team = 0,
	x = 0,
	y = 0,
	health = 175,
	maxHealth = 175,
	energy = 114,
	maxEnergy = 114,
	size = 2,
	flipped = false,
	abilities = [] as any[],
	effects = [] as any[],
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
	flipped: boolean;
	abilities: any[];
	effects: any[];
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
		baseStats: { health: maxHealth, energy: maxEnergy },
		energy,
		size,
		dead: false,
		temp: false,
		hexagons: [{ x, y }],
		player: { id: team, flipped, plasma: 0, controller: 'bot' },
		abilities,
		effects,
		adjacentHexes,
	});
	return c as Creature & { team: number };
};

/** Hex mock whose neighbours can be scripted per test. */
const makeHex = ({
	x = 0,
	y = 0,
	creature = undefined as (Creature & { team: number }) | undefined,
	trap = undefined as unknown,
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
	isRetreatingFn = (_c: Creature) => false,
	aggression = 0,
}: {
	activeCreature: Creature & { team: number };
	creatures?: (Creature & { team: number })[];
	isRetreatingFn?: (c: Creature) => boolean;
	aggression?: number;
}) => ({
	game: {
		activeCreature,
		creatures: [activeCreature, ...creatures],
		grid: { hexes: [Array(16).fill(null)] },
	},
	getStrategyFor: () => undefined,
	closestDistanceToEnemy: (_pos: { x: number; y: number }) => 5,
	isRetreating: isRetreatingFn,
	getPreferredX: (c: Creature & { player: { flipped: boolean } }) => {
		const boardWidth = 15;
		return c.player.flipped ? boardWidth * 0.42 : boardWidth * 0.58;
	},
	getAggressionFactor: () => aggression,
});

/** A Frigid Tower stack, as added by the passive each turn the unit skips moving. */
const frigidTowerStacks = (count: number) =>
	Array.from({ length: count }, () => ({ name: 'Frostified' }));

// ---------------------------------------------------------------------------
// Hold position (Frigid Tower)
// ---------------------------------------------------------------------------

describe('KnightmareStrategy.getHoldPositionScore', () => {
	test('prices in one Frigid Tower stack while the passive has room to grow', () => {
		const knightmare = makeCreature({ effects: frigidTowerStacks(3) });
		const controller = makeController({ activeCreature: knightmare });

		expect(getHoldPositionScore(knightmare, controller as any)).toBe(80);
	});

	test('holding is worth nothing once Frigid Tower is capped', () => {
		const knightmare = makeCreature({ effects: frigidTowerStacks(10) });
		const controller = makeController({ activeCreature: knightmare });

		expect(getHoldPositionScore(knightmare, controller as any)).toBe(0);
	});

	test('the bar shrinks as aggression rises so a stalemate still breaks', () => {
		const knightmare = makeCreature({ effects: frigidTowerStacks(1) });
		const calm = makeController({ activeCreature: knightmare, aggression: 0 });
		const pressed = makeController({ activeCreature: knightmare, aggression: 10 });

		expect(getHoldPositionScore(knightmare, pressed as any)).toBeLessThan(
			getHoldPositionScore(knightmare, calm as any) as number,
		);
		expect(getHoldPositionScore(knightmare, pressed as any)).toBe(27);
	});
});

// ---------------------------------------------------------------------------
// Move scoring
// ---------------------------------------------------------------------------

describe('KnightmareStrategy.scoreMoveHex', () => {
	test('defers to the generic scorer while retreating', () => {
		const knightmare = makeCreature();
		const controller = makeController({
			activeCreature: knightmare,
			isRetreatingFn: () => true,
		});

		expect(scoreMoveHex(makeHex(), controller as any)).toBeUndefined();
	});

	test('rewards a single adjacent enemy for melee reach', () => {
		const knightmare = makeCreature();
		const enemy = makeCreature({ id: 2, team: 1 });
		const nextToEnemy = makeHex({
			x: 4,
			y: 0,
			adjacentHex: () => [makeHex({ x: 5, y: 0, creature: enemy })],
		});
		const isolated = makeHex({ x: 4, y: 3 });
		const controller = makeController({ activeCreature: knightmare, creatures: [enemy] });

		expect(scoreMoveHex(nextToEnemy, controller as any) as number).toBeGreaterThan(
			scoreMoveHex(isolated, controller as any) as number,
		);
	});

	test('penalises being surrounded', () => {
		const knightmare = makeCreature();
		const enemyA = makeCreature({ id: 2, team: 1, x: 5, y: 0 });
		const enemyB = makeCreature({ id: 3, team: 3, x: 5, y: 1 });
		const surrounded = makeHex({
			x: 4,
			y: 0,
			adjacentHex: () => [
				makeHex({ x: 5, y: 0, creature: enemyA }),
				makeHex({ x: 5, y: 1, creature: enemyB }),
			],
		});
		const singleEnemy = makeHex({
			x: 4,
			y: 3,
			adjacentHex: () => [makeHex({ x: 5, y: 3, creature: enemyA })],
		});
		// Separate controllers so alignment bonus only sees relevant enemies
		const surroundedController = makeController({
			activeCreature: knightmare,
			creatures: [enemyA, enemyB],
		});
		const singleController = makeController({
			activeCreature: knightmare,
			creatures: [makeCreature({ id: 2, team: 1, x: 5, y: 3 })],
		});

		expect(scoreMoveHex(surrounded, surroundedController as any) as number).toBeLessThan(
			scoreMoveHex(singleEnemy, singleController as any) as number,
		);
	});

	test('leaves trap exposure to the generic scorer', () => {
		const knightmare = makeCreature();
		const trapped = makeHex({ x: 4, y: 0, trap: { effects: [] } });
		const clean = makeHex({ x: 4, y: 0 });
		const controller = makeController({ activeCreature: knightmare });

		// Trap penalties are applied by BotController.scoreMoveHex on top of this
		// score, so the strategy itself must not special-case destination traps.
		expect(scoreMoveHex(trapped, controller as any)).toBe(scoreMoveHex(clean, controller as any));
	});
});

// ---------------------------------------------------------------------------
// Ability gates
// ---------------------------------------------------------------------------

describe('KnightmareStrategy ability gates', () => {
	test('ranged Icicle Spear still needs a solid score to be used', () => {
		const knightmare = makeCreature();
		const controller = makeController({ activeCreature: knightmare });

		expect(getAbilityMinScore(knightmare, 3, controller as any)).toBe(380);
	});

	test('keeps the ranged-first ability order', () => {
		const knightmare = makeCreature();
		const controller = makeController({ activeCreature: knightmare });

		expect(getAbilityPriority(knightmare, controller as any)).toEqual([3, 2, 1]);
	});
});
