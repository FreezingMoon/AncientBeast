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

import DarkPriestStrategy from '../../bots/Dark-Priest';
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
	health = 60,
	maxHealth = 60,
	energy = 75,
	maxEnergy = 75,
	size = 1,
	flipped = false,
	plasma = 10,
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
	plasma: number;
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
		player: { id: team, flipped, plasma, controller: 'bot' },
		abilities,
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

/** Create a minimal BotController mock. */
const makeController = ({
	activeCreature,
	creatures = [] as (Creature & { team: number })[],
	flipped = false,
	isRetreatingFn = (_c: Creature) => false,
}: {
	activeCreature: Creature & { team: number };
	creatures?: (Creature & { team: number })[];
	flipped?: boolean;
	isRetreatingFn?: (c: Creature) => boolean;
}) => ({
	game: {
		activeCreature,
		creatures: [activeCreature, ...creatures],
		grid: {
			hexes: [Array(16).fill(null)],
		},
	},
	getStrategyFor: () => undefined,
	closestDistanceToEnemy: (_pos: { x: number; y: number }) => 10,
	isRetreating: isRetreatingFn,
	getPreferredX: (c: Creature & { player: { flipped: boolean } }) => {
		const boardWidth = 15;
		return c.player.flipped ? boardWidth * 0.95 : boardWidth * 0.05;
	},
});

// ---------------------------------------------------------------------------
// isRetreating
// ---------------------------------------------------------------------------

describe('DarkPriestStrategy.isRetreating', () => {
	test('returns true at 24% health (below 25% threshold)', () => {
		const priest = makeCreature({ health: 14, maxHealth: 60 }); // ~23.3%
		const controller = makeController({ activeCreature: priest });
		expect(DarkPriestStrategy.isRetreating!(priest, controller as any)).toBe(true);
	});

	test('returns false at 26% health (above 25% threshold)', () => {
		const priest = makeCreature({ health: 16, maxHealth: 60 }); // ~26.7%
		const controller = makeController({ activeCreature: priest });
		expect(DarkPriestStrategy.isRetreating!(priest, controller as any)).toBe(false);
	});

	test('returns false at full health', () => {
		const priest = makeCreature({ health: 60, maxHealth: 60 });
		const controller = makeController({ activeCreature: priest });
		expect(DarkPriestStrategy.isRetreating!(priest, controller as any)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// getPreferredX
// ---------------------------------------------------------------------------

describe('DarkPriestStrategy.getPreferredX', () => {
	test('returns ~5% from left edge for non-flipped player', () => {
		const priest = makeCreature({ flipped: false });
		const controller = makeController({ activeCreature: priest });
		expect(DarkPriestStrategy.getPreferredX!(priest, controller as any)).toBeCloseTo(0.75); // 15 * 0.05
	});

	test('returns ~95% from left edge for flipped player', () => {
		const priest = makeCreature({ flipped: true });
		const controller = makeController({ activeCreature: priest });
		expect(DarkPriestStrategy.getPreferredX!(priest, controller as any)).toBeCloseTo(14.25); // 15 * 0.95
	});
});

// ---------------------------------------------------------------------------
// scoreMoveHex
// ---------------------------------------------------------------------------

describe('DarkPriestStrategy.scoreMoveHex', () => {
	test('returns undefined when retreating (falls through to generic)', () => {
		const priest = makeCreature({ x: 5 });
		const controller = makeController({
			activeCreature: priest,
			isRetreatingFn: () => true,
		});
		const hex = makeHex({ x: 5, y: 3 });
		expect(DarkPriestStrategy.scoreMoveHex!(hex, controller as any)).toBeUndefined();
	});

	test('heavily penalises hexes adjacent to enemies', () => {
		const priest = makeCreature({ team: 0, x: 5 });
		const enemy = makeCreature({ team: 1, x: 6 });
		const safeHex = makeHex({ x: 5, y: 3, adjacentHex: () => [] });
		const dangerHex = makeHex({
			x: 5,
			y: 3,
			adjacentHex: () => [{ ...makeHex({ x: 6, y: 3 }), creature: enemy }] as any,
		});
		const controller = makeController({ activeCreature: priest });

		const safeScore = DarkPriestStrategy.scoreMoveHex!(safeHex, controller as any) as number;
		const dangerScore = DarkPriestStrategy.scoreMoveHex!(dangerHex, controller as any) as number;
		// Net penalty is -300 (adjacent enemy) + corner-defence bonus (mock returns one hex so
		// openCount=0, bonus=(6-0)*30=+180) = -120 effective drop.
		expect(dangerScore).toBeLessThan(safeScore - 100);
	});

	test('rewards hexes adjacent to allies (cover/meat-shield)', () => {
		const priest = makeCreature({ team: 0, x: 5 });
		const ally = makeCreature({ team: 0, id: 2, x: 4 });
		const openHex = makeHex({ x: 5, y: 3, adjacentHex: () => [] });
		const coveredHex = makeHex({
			x: 5,
			y: 3,
			adjacentHex: () => [{ ...makeHex({ x: 4, y: 3 }), creature: ally }] as any,
		});
		const controller = makeController({ activeCreature: priest, creatures: [ally] });

		const openScore = DarkPriestStrategy.scoreMoveHex!(openHex, controller as any) as number;
		const coveredScore = DarkPriestStrategy.scoreMoveHex!(coveredHex, controller as any) as number;
		expect(coveredScore).toBeGreaterThan(openScore);
	});

	test('penalises being on the same straight row as an enemy', () => {
		const priest = makeCreature({ team: 0, x: 3, y: 3 });
		const enemy = makeCreature({ team: 1, x: 10, y: 3 });
		const inLineHex = makeHex({ x: 3, y: 3, adjacentHex: () => [] });
		const offLineHex = makeHex({ x: 3, y: 5, adjacentHex: () => [] });
		const controller = makeController({ activeCreature: priest, creatures: [enemy] });

		const inLineScore = DarkPriestStrategy.scoreMoveHex!(inLineHex, controller as any) as number;
		const offLineScore = DarkPriestStrategy.scoreMoveHex!(offLineHex, controller as any) as number;
		expect(inLineScore).toBeLessThan(offLineScore);
	});

	test('penalises being on the same diagonal axis as an enemy', () => {
		const priest = makeCreature({ team: 0, x: 4, y: 4 });
		// (5, 6): dx=1, dy=2, floor(2/2)=1 === dx → diagonal ✓
		const enemy = makeCreature({ team: 1, x: 5, y: 6 });
		const diagHex = makeHex({ x: 4, y: 4, adjacentHex: () => [] });
		// (4, 5): dx=|4-5|=1, dy=|5-6|=1, floor(1/2)=0 ≠ 1 → NOT on any axis ✓
		const safeHex = makeHex({ x: 4, y: 5, adjacentHex: () => [] });
		const controller = makeController({ activeCreature: priest, creatures: [enemy] });

		const diagScore = DarkPriestStrategy.scoreMoveHex!(diagHex, controller as any) as number;
		const safeScore = DarkPriestStrategy.scoreMoveHex!(safeHex, controller as any) as number;
		expect(diagScore).toBeLessThan(safeScore);
	});

	test('prefers home-side x position (non-flipped: low x is better)', () => {
		const priest = makeCreature({ team: 0, flipped: false, x: 5 });
		const controller = makeController({ activeCreature: priest });

		const homeHex = makeHex({ x: 1, y: 3, adjacentHex: () => [] });
		const midHex = makeHex({ x: 8, y: 3, adjacentHex: () => [] });
		const homeScore = DarkPriestStrategy.scoreMoveHex!(homeHex, controller as any) as number;
		const midScore = DarkPriestStrategy.scoreMoveHex!(midHex, controller as any) as number;
		expect(homeScore).toBeGreaterThan(midScore);
	});

	test('applies corner-defence bonus when boxed by melee enemies with no ally cover', () => {
		const priest = makeCreature({ team: 0, x: 5, y: 3 });
		const enemy = makeCreature({ team: 1, x: 6, y: 3, id: 2 });

		// Open hex: enemy adjacent, 5 other open neighbours → score penalty only
		const openAdjacentHexes = [
			{ x: 5, y: 2, creature: undefined },
			{ x: 5, y: 4, creature: undefined },
			{ x: 4, y: 2, creature: undefined },
			{ x: 4, y: 4, creature: undefined },
			{ x: 6, y: 3, creature: enemy },
			// sixth neighbour open
		] as any[];
		const openHex = makeHex({
			x: 5,
			y: 3,
			adjacentHex: () => openAdjacentHexes,
		});

		// Corner hex: enemy adjacent, only 1 other open neighbour → bigger bonus
		const cornerAdjacentHexes = [
			{ x: 5, y: 2, creature: undefined },
			{ x: 6, y: 3, creature: enemy },
			// other 4 neighbours are walls / off-grid (no creature but we fake them as occupied)
			{ x: 4, y: 2, creature: makeCreature({ id: 99, x: 4, y: 2 }) },
			{ x: 4, y: 4, creature: makeCreature({ id: 98, x: 4, y: 4 }) },
			{ x: 5, y: 4, creature: makeCreature({ id: 97, x: 5, y: 4 }) },
			{ x: 6, y: 2, creature: makeCreature({ id: 96, x: 6, y: 2 }) },
		] as any[];
		const cornerHex = makeHex({
			x: 5,
			y: 3,
			adjacentHex: () => cornerAdjacentHexes,
		});

		const controller = makeController({ activeCreature: priest, creatures: [enemy] });

		const openScore = DarkPriestStrategy.scoreMoveHex!(openHex, controller as any) as number;
		const cornerScore = DarkPriestStrategy.scoreMoveHex!(cornerHex, controller as any) as number;
		expect(cornerScore).toBeGreaterThan(openScore);
	});
});

// ---------------------------------------------------------------------------
// scoreAbilityHex – Electro Shocker (index 1)
// ---------------------------------------------------------------------------

describe('DarkPriestStrategy.scoreAbilityHex – Electro Shocker (index 1)', () => {
	test('returns NEGATIVE_INFINITY for a non-enemy hex', () => {
		const priest = makeCreature({ team: 0 });
		const ally = makeCreature({ team: 0, id: 2 });
		const hex = makeHex({ creature: ally });
		const controller = makeController({ activeCreature: priest });
		expect(DarkPriestStrategy.scoreAbilityHex!(hex, 1, controller as any)).toBe(
			Number.NEGATIVE_INFINITY,
		);
	});

	test('scores larger targets higher (more shock damage)', () => {
		const priest = makeCreature({ team: 0, plasma: 10 });
		const smallEnemy = makeCreature({ team: 1, id: 2, size: 1, health: 30, maxHealth: 60 });
		const largeEnemy = makeCreature({ team: 1, id: 3, size: 3, health: 30, maxHealth: 60 });
		const smallHex = makeHex({ creature: smallEnemy });
		const largeHex = makeHex({ creature: largeEnemy });
		const controller = makeController({ activeCreature: priest });

		const smallScore = DarkPriestStrategy.scoreAbilityHex!(
			smallHex,
			1,
			controller as any,
		) as number;
		const largeScore = DarkPriestStrategy.scoreAbilityHex!(
			largeHex,
			1,
			controller as any,
		) as number;
		expect(largeScore).toBeGreaterThan(smallScore);
	});

	test('gives large kill bonus when the shock would finish the target', () => {
		const priest = makeCreature({ team: 0, plasma: 10 });
		// size 1 → damage = 12; health 10 → killed
		const dyingEnemy = makeCreature({ team: 1, id: 2, size: 1, health: 10, maxHealth: 60 });
		// health 50 → not killed
		const healthyEnemy = makeCreature({ team: 1, id: 3, size: 1, health: 50, maxHealth: 60 });
		const dyingHex = makeHex({ creature: dyingEnemy });
		const healthyHex = makeHex({ creature: healthyEnemy });
		const controller = makeController({ activeCreature: priest });

		const dyingScore = DarkPriestStrategy.scoreAbilityHex!(
			dyingHex,
			1,
			controller as any,
		) as number;
		const healthyScore = DarkPriestStrategy.scoreAbilityHex!(
			healthyHex,
			1,
			controller as any,
		) as number;
		expect(dyingScore).toBeGreaterThan(healthyScore);
	});

	test('killing a small unit always scores higher than a combo setup on a large one', () => {
		// Worst-case kill: size=1, health=1 → total = 100+50-1 + 700 = 849
		// Best-case combo: size=3, health just above halfHP, canAffordBeam
		//   size=3 → damage=36; stats.health=100 → halfHP=50; health=55 → survives(55>36),
		//   healthAfterShock=19 < 50 ✓ (willBeBelowHalf); total = 100+150-55 + 300+150 = 645
		//   Kill (849) must always beat this setup (645).
		const priest = makeCreature({ team: 0, plasma: 10 });
		const tinyDyingEnemy = makeCreature({ team: 1, id: 2, size: 1, health: 1, maxHealth: 60 });
		// size=3, health=55 > halfHP=50, healthAfterShock=55-36=19 < 50 → willBeBelowHalf ✓
		const largeComboEnemy = makeCreature({ team: 1, id: 3, size: 3, health: 55, maxHealth: 100 });
		const tinyHex = makeHex({ creature: tinyDyingEnemy });
		const largeHex = makeHex({ creature: largeComboEnemy });
		const controller = makeController({ activeCreature: priest });

		const killScore = DarkPriestStrategy.scoreAbilityHex!(tinyHex, 1, controller as any) as number;
		const comboScore = DarkPriestStrategy.scoreAbilityHex!(
			largeHex,
			1,
			controller as any,
		) as number;
		expect(killScore).toBeGreaterThan(comboScore);
	});

	test('adds combo bonus when plasma allows a follow-up Disruptor Beam', () => {
		// size=2 → Electro Shocker damage 24; beam cost 2; survive reserve 3
		// If plasma=8, plasma-beamCost(2)=6 >= reserve(3) → combo bonus applies
		const richPriest = makeCreature({ team: 0, plasma: 8 });
		// If plasma=3, plasma-beamCost(2)=1 < reserve(3) → no combo bonus
		const poorPriest = makeCreature({ team: 0, plasma: 3, id: 99 });
		const enemy = makeCreature({ team: 1, id: 2, size: 2, health: 30, maxHealth: 60 });
		const hex = makeHex({ creature: enemy });

		const richController = makeController({ activeCreature: richPriest });
		const poorController = makeController({ activeCreature: poorPriest });

		const richScore = DarkPriestStrategy.scoreAbilityHex!(hex, 1, richController as any) as number;
		const poorScore = DarkPriestStrategy.scoreAbilityHex!(hex, 1, poorController as any) as number;
		expect(richScore).toBeGreaterThan(poorScore);
	});
});

// ---------------------------------------------------------------------------
// scoreAbilityHex – Disruptor Beam (index 2)
// ---------------------------------------------------------------------------

describe('DarkPriestStrategy.scoreAbilityHex – Disruptor Beam (index 2)', () => {
	test('returns NEGATIVE_INFINITY for a non-enemy hex', () => {
		const priest = makeCreature({ team: 0, plasma: 10 });
		const ally = makeCreature({ team: 0, id: 2 });
		const hex = makeHex({ creature: ally });
		const controller = makeController({ activeCreature: priest });
		expect(DarkPriestStrategy.scoreAbilityHex!(hex, 2, controller as any)).toBe(
			Number.NEGATIVE_INFINITY,
		);
	});

	test('returns NEGATIVE_INFINITY when spending would drop plasma below reserve', () => {
		// plasma=4, beamCost(size=2)=2, after spend=2 < reserve(3) → blocked
		const priest = makeCreature({ team: 0, plasma: 4 });
		const enemy = makeCreature({ team: 1, id: 2, size: 2, health: 20, maxHealth: 60 });
		const hex = makeHex({ creature: enemy });
		const controller = makeController({ activeCreature: priest });
		expect(DarkPriestStrategy.scoreAbilityHex!(hex, 2, controller as any)).toBe(
			Number.NEGATIVE_INFINITY,
		);
	});

	test('allows firing when plasma minus cost still meets reserve', () => {
		// plasma=6, beamCost(size=2)=2, after spend=4 >= reserve(3) → allowed
		const priest = makeCreature({ team: 0, plasma: 6 });
		const enemy = makeCreature({ team: 1, id: 2, size: 2, health: 20, maxHealth: 60 });
		const hex = makeHex({ creature: enemy });
		const controller = makeController({ activeCreature: priest });
		const score = DarkPriestStrategy.scoreAbilityHex!(hex, 2, controller as any);
		expect(score).not.toBe(Number.NEGATIVE_INFINITY);
	});

	test('gives large kill bonus when damage equals or exceeds remaining health', () => {
		const priest = makeCreature({ team: 0, plasma: 10 });
		// missingHP = 50 (60-10 health); will kill if target.health (10) <= 50 → yes
		const dyingEnemy = makeCreature({ team: 1, id: 2, size: 1, health: 10, maxHealth: 60 });
		// missingHP = 20 (60-40); won't kill 40 hp target with 20 dmg
		const healthyEnemy = makeCreature({ team: 1, id: 3, size: 1, health: 40, maxHealth: 60 });
		const dyingHex = makeHex({ creature: dyingEnemy });
		const healthyHex = makeHex({ creature: healthyEnemy });
		const controller = makeController({ activeCreature: priest });

		const dyingScore = DarkPriestStrategy.scoreAbilityHex!(
			dyingHex,
			2,
			controller as any,
		) as number;
		const healthyScore = DarkPriestStrategy.scoreAbilityHex!(
			healthyHex,
			2,
			controller as any,
		) as number;
		expect(dyingScore).toBeGreaterThan(healthyScore);
	});

	test('prefers small-size targets (more efficient plasma use)', () => {
		const priest = makeCreature({ team: 0, plasma: 10 });
		// Both enemies have same health; small has lower cost → higher efficiency
		const smallEnemy = makeCreature({ team: 1, id: 2, size: 1, health: 20, maxHealth: 60 });
		const largeEnemy = makeCreature({ team: 1, id: 3, size: 3, health: 20, maxHealth: 60 });
		const smallHex = makeHex({ creature: smallEnemy });
		const largeHex = makeHex({ creature: largeEnemy });
		const controller = makeController({ activeCreature: priest });

		const smallScore = DarkPriestStrategy.scoreAbilityHex!(
			smallHex,
			2,
			controller as any,
		) as number;
		const largeScore = DarkPriestStrategy.scoreAbilityHex!(
			largeHex,
			2,
			controller as any,
		) as number;
		expect(smallScore).toBeGreaterThan(largeScore);
	});

	test('penalises near-full-health target when ability is not upgraded', () => {
		const disruptorAbility = { isUpgraded: () => false };
		const priest = makeCreature({
			team: 0,
			plasma: 10,
			abilities: [null, null, disruptorAbility, null],
		});
		// At full health: missingHP=0, near zero damage
		const fullHealthEnemy = makeCreature({ team: 1, id: 2, size: 1, health: 60, maxHealth: 60 });
		// At half health: missingHP=30, meaningful damage
		const woundedEnemy = makeCreature({ team: 1, id: 3, size: 1, health: 30, maxHealth: 60 });
		const fullHex = makeHex({ creature: fullHealthEnemy });
		const woundedHex = makeHex({ creature: woundedEnemy });
		const controller = makeController({ activeCreature: priest });

		const fullScore = DarkPriestStrategy.scoreAbilityHex!(fullHex, 2, controller as any) as number;
		const woundedScore = DarkPriestStrategy.scoreAbilityHex!(
			woundedHex,
			2,
			controller as any,
		) as number;
		expect(woundedScore).toBeGreaterThan(fullScore);
	});

	test('upgraded ability still scores positively against full-health target', () => {
		const disruptorAbility = { isUpgraded: () => true };
		const priest = makeCreature({
			team: 0,
			plasma: 10,
			abilities: [null, null, disruptorAbility, null],
		});
		// Full health: upgraded guarantees 40 damage
		const fullHealthEnemy = makeCreature({ team: 1, id: 2, size: 1, health: 60, maxHealth: 60 });
		const hex = makeHex({ creature: fullHealthEnemy });
		const controller = makeController({ activeCreature: priest });

		const score = DarkPriestStrategy.scoreAbilityHex!(hex, 2, controller as any) as number;
		expect(score).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// getAbilityPriority
// ---------------------------------------------------------------------------

describe('DarkPriestStrategy.getAbilityPriority', () => {
	test('includes both Electro Shocker and Disruptor Beam when plasma is ample', () => {
		const priest = makeCreature({ plasma: 8 }); // > PLASMA_SURVIVAL_RESERVE(3)
		const controller = makeController({ activeCreature: priest });
		const priority = DarkPriestStrategy.getAbilityPriority!(priest, controller as any);
		expect(priority).toContain(1); // ELECTRO_SHOCKER
		expect(priority).toContain(2); // DISRUPTOR_BEAM
	});

	test('Electro Shocker comes before Disruptor Beam when plasma is ample', () => {
		const priest = makeCreature({ plasma: 8 });
		const controller = makeController({ activeCreature: priest });
		const priority = DarkPriestStrategy.getAbilityPriority!(priest, controller as any);
		expect(priority.indexOf(1)).toBeLessThan(priority.indexOf(2));
	});

	test('omits Disruptor Beam when plasma is at or below survival reserve', () => {
		const priest = makeCreature({ plasma: 3 }); // === PLASMA_SURVIVAL_RESERVE
		const controller = makeController({ activeCreature: priest });
		const priority = DarkPriestStrategy.getAbilityPriority!(priest, controller as any);
		expect(priority).toContain(1); // ELECTRO_SHOCKER still available
		expect(priority).not.toContain(2); // DISRUPTOR_BEAM excluded
	});

	test('Godlet Printer (index 3) is never included in priority list', () => {
		for (const plasma of [1, 5, 10]) {
			const priest = makeCreature({ plasma });
			const controller = makeController({ activeCreature: priest });
			const priority = DarkPriestStrategy.getAbilityPriority!(priest, controller as any);
			expect(priority).not.toContain(3);
		}
	});
});

// ---------------------------------------------------------------------------
// getTargetingPenalty
// ---------------------------------------------------------------------------

describe('DarkPriestStrategy.getTargetingPenalty', () => {
	test('returns 0 when Dark Priest has no plasma (no shield active)', () => {
		const attacker = makeCreature({ team: 1 });
		const priest = makeCreature({ team: 0, plasma: 0 });
		const controller = makeController({ activeCreature: attacker });
		expect(DarkPriestStrategy.getTargetingPenalty!(attacker, priest, 1, controller as any)).toBe(0);
	});

	test('returns a negative penalty when Dark Priest has plasma (attack will be absorbed)', () => {
		const attacker = makeCreature({ team: 1 });
		const priest = makeCreature({ team: 0, plasma: 5 });
		const controller = makeController({ activeCreature: attacker });
		const penalty = DarkPriestStrategy.getTargetingPenalty!(attacker, priest, 1, controller as any);
		expect(penalty).toBeLessThan(0);
	});

	test('upgraded Plasma Field applies a larger penalty than non-upgraded', () => {
		const attacker = makeCreature({ team: 1 });
		const plasmaFieldUpgraded = { isUpgraded: () => true };
		const plasmaFieldBasic = { isUpgraded: () => false };

		const upgradedPriest = makeCreature({
			team: 0,
			plasma: 5,
			abilities: [plasmaFieldUpgraded],
		});
		const basicPriest = makeCreature({
			team: 0,
			plasma: 5,
			abilities: [plasmaFieldBasic],
		});

		const controller = makeController({ activeCreature: attacker });

		const upgradedPenalty = DarkPriestStrategy.getTargetingPenalty!(
			attacker,
			upgradedPriest,
			1,
			controller as any,
		);
		const basicPenalty = DarkPriestStrategy.getTargetingPenalty!(
			attacker,
			basicPriest,
			1,
			controller as any,
		);
		expect(upgradedPenalty).toBeLessThan(basicPenalty);
	});
});
