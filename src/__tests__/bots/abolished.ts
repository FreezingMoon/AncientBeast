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

import AbolishedStrategy from '../../bots/Abolished';
import { Creature } from '../../creature';
import { Hex } from '../../utility/hex';

const { scoreMoveHex, scoreAbilityHex, getHoldPositionScore, getAbilityMinScore } =
	AbolishedStrategy as Required<typeof AbolishedStrategy>;

// Ability slot indices, mirroring the strategy file
const ABILITY = {
	BURNING_SPIRIT: 0,
	FIERY_TOUCH: 1,
	BONFIRE_SPRING: 2,
	GREATER_PYRE: 3,
} as const;

// ---------------------------------------------------------------------------
// Shared mock builders
// ---------------------------------------------------------------------------

const makeCreature = ({
	id = 1,
	team = 0,
	x = 0,
	y = 0,
	health = 234,
	maxHealth = 234,
	energy = 114,
	maxEnergy = 114,
	size = 3,
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
		baseStats: { health: maxHealth, energy: maxEnergy },
		energy,
		size,
		dead: false,
		temp: false,
		hexagons: [{ x, y }],
		player: { id: team, flipped, controller: 'bot' },
		abilities,
		adjacentHexes,
		accumulatedTeleportRange: 0,
	});
	return c as Creature & { team: number };
};

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
	trapPenalty = 0,
}: {
	activeCreature: Creature & { team: number };
	creatures?: (Creature & { team: number })[];
	isRetreatingFn?: (c: Creature) => boolean;
	trapPenalty?: number;
}) => ({
	game: {
		activeCreature,
		creatures: [activeCreature, ...creatures],
		grid: { hexes: [Array(16).fill(null)] },
	},
	getStrategyFor: () => undefined,
	closestDistanceToEnemy: (_pos: { x: number; y: number }) => 5,
	closestDistanceToDrop: () => Number.POSITIVE_INFINITY,
	isRetreating: isRetreatingFn,
	getHoldPositionScore: () => 0,
	getPreferredX: (c: Creature & { player: { flipped: boolean } }) => {
		const boardWidth = 15;
		return c.player.flipped ? boardWidth * 0.3 : boardWidth * 0.7;
	},
	getMovePathTrapPenalty: jest.fn((_creature: Creature, hex: Hex) => (hex?.trap ? trapPenalty : 0)),
});

// ---------------------------------------------------------------------------
// Hold position
// ---------------------------------------------------------------------------

describe('AbolishedStrategy.getHoldPositionScore', () => {
	test('moving has to beat standing still', () => {
		const abolished = makeCreature();
		const controller = makeController({ activeCreature: abolished });

		expect(getHoldPositionScore(abolished, controller as any)).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Move scoring
// ---------------------------------------------------------------------------

describe('AbolishedStrategy.scoreMoveHex', () => {
	test('defers to the generic scorer while retreating', () => {
		const abolished = makeCreature();
		const controller = makeController({
			activeCreature: abolished,
			isRetreatingFn: () => true,
		});

		expect(scoreMoveHex(makeHex(), controller as any)).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Bonfire Spring (teleport) trap awareness
// ---------------------------------------------------------------------------

describe('AbolishedStrategy.scoreAbilityHex – Bonfire Spring', () => {
	test('rejects occupied hexes outright', () => {
		const abolished = makeCreature();
		const enemy = makeCreature({ id: 2, team: 1 });
		const occupiedHex = makeHex({ x: 4, y: 0, creature: enemy });
		const controller = makeController({ activeCreature: abolished, creatures: [enemy] });

		expect(scoreAbilityHex(occupiedHex, ABILITY.BONFIRE_SPRING, controller as any)).toBe(
			Number.NEGATIVE_INFINITY,
		);
	});

	test('subtracts the trap penalty from teleport destinations', () => {
		const abolished = makeCreature();
		const clean = makeHex({ x: 4, y: 0 });
		const trapped = makeHex({ x: 6, y: 0, trap: { effects: [] } });
		const controller = makeController({
			activeCreature: abolished,
			trapPenalty: 320,
		});

		// The strategy asks the generic penalty (path scan skipped — a teleport
		// never crosses a walking path) and subtracts it from its own score.
		const cleanScore = scoreAbilityHex(clean, ABILITY.BONFIRE_SPRING, controller as any) as number;
		const trappedScore = scoreAbilityHex(
			trapped,
			ABILITY.BONFIRE_SPRING,
			controller as any,
		) as number;
		expect(cleanScore - trappedScore).toBe(320);

		const lastCall = (controller.getMovePathTrapPenalty as jest.Mock).mock.calls.at(-1);
		expect(lastCall?.[2]).toEqual({ retreating: false, skipPathScan: true });
	});
});

// ---------------------------------------------------------------------------
// Bonfire Spring gating
// ---------------------------------------------------------------------------

describe('AbolishedStrategy.getAbilityMinScore', () => {
	test('Bonfire Spring must clear the hold bar before it is spent', () => {
		const abolished = makeCreature();
		const controller = makeController({ activeCreature: abolished });

		expect(getAbilityMinScore(abolished, ABILITY.BONFIRE_SPRING, controller as any)).toBe(0);
	});

	test('escaping is never gated while retreating', () => {
		const abolished = makeCreature();
		const controller = makeController({
			activeCreature: abolished,
			isRetreatingFn: () => true,
		});

		expect(
			getAbilityMinScore(abolished, ABILITY.BONFIRE_SPRING, controller as any),
		).toBeUndefined();
	});

	test('offensive abilities are not gated', () => {
		const abolished = makeCreature();
		const controller = makeController({ activeCreature: abolished });

		expect(getAbilityMinScore(abolished, ABILITY.FIERY_TOUCH, controller as any)).toBeUndefined();
		expect(getAbilityMinScore(abolished, ABILITY.GREATER_PYRE, controller as any)).toBeUndefined();
	});
});
