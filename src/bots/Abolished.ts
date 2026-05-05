import type BotController from '../bot';
import type { UnitBotStrategy } from '../bot';
import { unitStrategies } from '../bot';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import { Team, isTeam } from '../utility/team';

// Ability slot indices
const ABILITY = {
	BURNING_SPIRIT: 0, // passive onOtherDamage – bot never activates directly
	FIERY_TOUCH: 1, // onQuery, ranged 3 (upgraded 6), slash + burn
	BONFIRE_SPRING: 2, // onQuery, teleport to empty 3-hex space; leaves bonfire traps
	GREATER_PYRE: 3, // onQuery, AoE burn all adjacent hexes, high energy cost
} as const;

/**
 * Minimum energy ratio below which Greater Pyre is refused.
 * The ability consumes a lot of energy and Abolished also needs energy
 * to keep Bonfire Spring available as an escape route.
 */
const GREATER_PYRE_ENERGY_MIN = 0.45;

/**
 * Minimum number of distinct enemy *units* (not hexes) adjacent to Abolished
 * before Greater Pyre is considered worthwhile.
 */
const GREATER_PYRE_MIN_ENEMIES = 2;

// ---------------------------------------------------------------------------
// Axis-alignment helper (same row or hex-grid diagonal)
// ---------------------------------------------------------------------------

/**
 * Returns true when hex B lies on the same straight row or diagonal axis as
 * hex A — the axes that Fiery Touch travels along.
 * Straight: same y row.
 * Diagonal: floor(|Δy| / 2) === |Δx| on the staggered hex grid.
 */
function isOnSameAxis(ax: number, ay: number, bx: number, by: number): boolean {
	const dx = Math.abs(bx - ax);
	const dy = Math.abs(by - ay);
	if (dy === 0) return true;
	return Math.floor(dy / 2) === dx;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns how many Burning Spirit stacks have been applied to the target.
 * Each successful Abolished attack reduces the target's burn mastery by 1.
 * Higher stacks mean more burn damage on subsequent hits and from Greater Pyre.
 */
function burnSpiritStacks(target: Creature): number {
	const base = (target.baseStats as typeof target.stats)?.burn ?? target.stats.burn;
	const current = target.stats.burn;
	return Math.max(0, base - current);
}

/**
 * Counts the number of distinct enemy *creatures* adjacent to `creature`.
 * Large enemies occupy multiple hexes; this counts each creature only once.
 */
function countAdjacentEnemies(creature: Creature): number {
	const seen = new Set<number>();
	creature.adjacentHexes(1).forEach((hex: Hex) => {
		if (hex.creature instanceof Creature && isTeam(creature, hex.creature, Team.Enemy)) {
			seen.add(hex.creature.id);
		}
	});
	return seen.size;
}

// ---------------------------------------------------------------------------
// Per-ability scorers
// ---------------------------------------------------------------------------

/**
 * Score a hex for Fiery Touch (ability 1).
 *
 * Damage: slash + burn, range 3 (upgraded 6 but burn-only beyond 3).
 * Burning Spirit passive: each hit applies a -1 burn mastery stack on the target,
 * so repeatedly hitting the same unit compounds damage over time and improves
 * Greater Pyre follow-up damage.
 *
 * Priorities:
 * - Kill bonus: always highest priority.
 * - Targets with existing Burning Spirit stacks: compound the debuff.
 * - Low-health enemies: closer to elimination.
 * - Larger enemies: more hexes = Greater Pyre hits more area later.
 */
function scoreFieryTouch(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	// Base: lower-health targets are preferred (nearer to death), size bonus (AoE synergy later)
	let score = 500 - target.health + target.size * 15;

	// Burning Spirit synergy: reward stacking the debuff on the same target
	const stacks = burnSpiritStacks(target);
	score += stacks * 60;

	// Kill/low-health bonuses
	const healthRatio = target.health / target.stats.health;
	if (healthRatio < 0.25) {
		score += 400; // Near-death: finish it
	} else if (healthRatio < 0.5) {
		score += 150;
	}

	// Retaliation / debuff risk from the target's own strategy
	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(
			activeCreature,
			target,
			ABILITY.FIERY_TOUCH,
			controller,
		) ?? 0;

	return score;
}

/**
 * Score a hex for Bonfire Spring (ability 2).
 *
 * This is a teleport to an *empty* 3-hex landing position; the ability also
 * leaves one-turn bonfire traps on every hex Abolished vacates.
 *
 * KEY FIX: the generic scorer assigns high values to hexes occupied by
 * creatures (treating them as offensive targets). Bonfire Spring cannot
 * land on an occupied hex, so any hex with a creature must be rejected
 * immediately with NEGATIVE_INFINITY. This resolves the bot misuse bug.
 *
 * Retreat mode: escape far from enemies, preferring cover from allies and
 * uncollected drops.
 *
 * Aggressive mode: when enough energy exists and multiple enemies cluster
 * nearby, favour positions that set up an immediate Greater Pyre strike.
 * Otherwise prefer maintaining Fiery Touch range from enemies.
 *
 * Upgraded: each successful use stacks permanent range bonuses, so there
 * is a mild incentive to use the ability even for pure repositioning.
 */
function scoreBonfireSpring(hex: Hex, activeCreature: Creature, controller: BotController): number {
	// Cannot land on an occupied hex – size-3 creature needs 3 clear hexes
	if (hex.creature instanceof Creature) {
		return Number.NEGATIVE_INFINITY;
	}

	// Prevent trivially confirming the same position
	if (hex.x === activeCreature.x && hex.y === activeCreature.y) {
		return Number.NEGATIVE_INFINITY;
	}

	const isRetreating = controller.isRetreating(activeCreature);
	const distFromEnemy = controller.closestDistanceToEnemy(hex);

	let score = 0;

	if (isRetreating) {
		// Escape: maximise distance from all enemies
		score += distFromEnemy * 40;

		// Allied cover is valuable for a fragile unit resting behind the front
		const adjacentAllyCount = hex
			.adjacentHex(1)
			.filter(
				(adj) =>
					adj.creature &&
					adj.creature !== activeCreature &&
					isTeam(activeCreature, adj.creature, Team.Ally),
			).length;
		score += adjacentAllyCount * 80;

		// Drops: collecting health/energy items accelerates recovery
		const dropDist = controller.closestDistanceToDrop(hex);
		if (dropDist < Number.POSITIVE_INFINITY) {
			score += Math.max(0, 8 - dropDist) * 25;
		}
	} else {
		// Offensive: check if this landing position places Abolished next to many enemies
		const adjacentEnemyHexes = hex
			.adjacentHex(1)
			.filter(
				(adj) =>
					adj.creature instanceof Creature && isTeam(activeCreature, adj.creature, Team.Enemy),
			);
		const adjacentEnemyCount = adjacentEnemyHexes.length;

		const energyRatio = activeCreature.energy / activeCreature.stats.energy;

		if (adjacentEnemyCount >= GREATER_PYRE_MIN_ENEMIES && energyRatio >= GREATER_PYRE_ENERGY_MIN) {
			// Great setup: teleport into the middle of enemies and follow with Greater Pyre
			score += adjacentEnemyCount * 80 + 200;

			// Bonus per Burning Spirit stack on each adjacent enemy (amplified Pyre damage)
			const seen = new Set<number>();
			adjacentEnemyHexes.forEach((adj) => {
				const t = adj.creature as Creature;
				if (!seen.has(t.id)) {
					seen.add(t.id);
					score += burnSpiritStacks(t) * 30;
				}
			});
		} else if (adjacentEnemyCount > 0 && energyRatio < GREATER_PYRE_ENERGY_MIN) {
			// Would land next to enemies but can't follow up with Greater Pyre – avoid
			score -= adjacentEnemyCount * 80;
		}

		// Staying at Fiery Touch range (≤3) without being adjacent is ideal
		if (adjacentEnemyCount === 0 && distFromEnemy >= 1 && distFromEnemy <= 3) {
			score += (4 - distFromEnemy) * 20;
		}

		// Upgraded range-stacking incentive: mild bonus to encourage using the ability
		const ability = activeCreature.abilities[ABILITY.BONFIRE_SPRING];
		if (ability?.isUpgraded?.()) {
			score += 40;
		}

		// Opportunistic drop collection
		const dropDist = controller.closestDistanceToDrop(hex);
		if (dropDist < Number.POSITIVE_INFINITY) {
			score += Math.max(0, 5 - dropDist) * 15;
		}

		// Trap placement value: landing next to a cornered ally (e.g. Dark Priest)
		// leaves a firewall on the vacated hexes that covers the ally.
		const leavingAdjacentAllyCount = activeCreature
			.adjacentHexes(1)
			.filter(
				(adj: Hex) =>
					adj.creature instanceof Creature && isTeam(activeCreature, adj.creature, Team.Ally),
			).length;
		if (leavingAdjacentAllyCount > 0 && distFromEnemy > 3) {
			// We jumped away from near an ally, leaving the bonfire to protect them
			score += leavingAdjacentAllyCount * 50;
		}
	}

	return score;
}

/**
 * Score a hex for Greater Pyre (ability 3).
 *
 * Greater Pyre burns every unit on adjacent hexes simultaneously, regardless
 * of which hex in the query range is confirmed. Since the outcome is identical
 * for all query hexes, we evaluate the *overall worth of using the ability now*
 * and return that constant across every candidate hex.
 *
 * Worth increases with:
 * - Number of distinct enemy creatures adjacent (AoE efficiency).
 * - Burning Spirit stacks on those enemies (lower resistance → more damage).
 * - Size of targets (larger creatures occupy more adjacent hexes → more bonus).
 *
 * Hard gates:
 * - Energy below threshold: refuse (preserve energy for Bonfire Spring escape).
 * - Fewer than GREATER_PYRE_MIN_ENEMIES distinct enemies adjacent: refuse.
 */
function scoreGreaterPyre(hex: Hex, activeCreature: Creature): number {
	const energyRatio = activeCreature.energy / activeCreature.stats.energy;
	if (energyRatio < GREATER_PYRE_ENERGY_MIN) {
		return Number.NEGATIVE_INFINITY;
	}

	// Evaluate adjacent enemies from Abolished's current position
	const seen = new Set<number>();
	let bonusScore = 0;

	activeCreature.adjacentHexes(1).forEach((adjHex: Hex) => {
		const target = adjHex.creature;
		if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
			return;
		}
		if (seen.has(target.id)) {
			return;
		}
		seen.add(target.id);

		// Burning Spirit stacks amplify burn damage from Greater Pyre
		bonusScore += burnSpiritStacks(target) * 40;
		// Larger targets cover more adjacent hexes → more raw damage exchanged
		bonusScore += target.size * 10;
	});

	const adjacentEnemyCount = seen.size;

	if (adjacentEnemyCount < GREATER_PYRE_MIN_ENEMIES) {
		return Number.NEGATIVE_INFINITY;
	}

	// The queried hex itself doesn't change the outcome; return the same score for all
	void hex; // intentionally unused – all hexes in the range produce identical results
	return 300 + adjacentEnemyCount * 120 + bonusScore;
}

// ---------------------------------------------------------------------------
// Strategy export
// ---------------------------------------------------------------------------

const AbolishedStrategy: UnitBotStrategy = {
	/**
	 * Abolished is fragile (low health, endurance, defence) and depends on
	 * Bonfire Spring to escape dangerous situations.  Retreat earlier than
	 * default to ensure Bonfire Spring energy is still available when needed.
	 * Also retreat when low on energy — without energy Abolished cannot
	 * teleport, attack at range, or use Greater Pyre.
	 */
	isRetreating(creature, _controller) {
		const healthRatio = creature.health / creature.stats.health;
		const energyRatio = creature.energy / creature.stats.energy;
		return healthRatio < 0.4 || energyRatio < 0.3;
	},

	/**
	 * Abolished is an aggressive level-7 unit that attacks from range and
	 * teleports freely.  Preferred position is ~70 % toward the enemy side —
	 * threatening and in Fiery Touch range, but not hugging the front line.
	 */
	getPreferredX(creature, controller) {
		const gridRow = controller.game.grid?.hexes[0];
		const boardWidth = gridRow ? gridRow.length - 1 : 15;
		return creature.player.flipped ? boardWidth * 0.3 : boardWidth * 0.7;
	},

	/**
	 * Movement scoring for Abolished:
	 *
	 * 1. Heavy penalty for landing adjacent to enemies (very fragile, relies on range
	 *    and teleport rather than trading melee hits).
	 * 2. Reward for being on the same axis as an enemy (enables Fiery Touch shots
	 *    along straight rows and diagonals).
	 * 3. Bonus for adjacent allies — they absorb return fire and shield Abolished.
	 * 4. Zone pressure towards the forward-leaning preferred x position.
	 */
	scoreMoveHex(hex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) return undefined;

		// Retreat movement is handled generically by scoreRetreatHex
		if (controller.isRetreating(activeCreature)) return undefined;

		let score = 0;

		const adjacentHexes = hex.adjacentHex(1);

		// Fragile: avoid standing next to enemies
		const adjacentEnemyCount = adjacentHexes.filter(
			(adj) => adj.creature && isTeam(activeCreature, adj.creature, Team.Enemy),
		).length;
		score -= adjacentEnemyCount * 250;

		// Allied cover: adjacent allies absorb some incoming fire
		const adjacentAllyCount = adjacentHexes.filter(
			(adj) =>
				adj.creature &&
				adj.creature !== activeCreature &&
				isTeam(activeCreature, adj.creature, Team.Ally),
		).length;
		score += adjacentAllyCount * 60;

		// Axis reward: being on the same row or diagonal as an enemy enables Fiery Touch
		controller.game.creatures.forEach((enemy) => {
			if (!enemy || enemy.dead || enemy.temp) return;
			if (!isTeam(activeCreature, enemy, Team.Enemy)) return;
			if (!isOnSameAxis(hex.x, hex.y, enemy.x, enemy.y)) return;
			const dy = Math.abs(hex.y - enemy.y);
			score += dy === 0 ? 50 : 30; // straight row is slightly more valuable
		});

		// Zone preference: push toward the forward position
		const preferredX = controller.getPreferredX(activeCreature);
		score -= Math.abs(hex.x - preferredX) * 10;

		return score;
	},

	/**
	 * Routes each ability slot to its dedicated scorer.
	 *
	 * Bonfire Spring (slot 2): rejects occupied hexes via scoreBonfireSpring,
	 * fixing the bot misuse where it would target units instead of open ground.
	 */
	scoreAbilityHex(hex, abilityIndex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) return undefined;

		if (abilityIndex === ABILITY.FIERY_TOUCH) {
			return scoreFieryTouch(hex, activeCreature, controller);
		}

		if (abilityIndex === ABILITY.BONFIRE_SPRING) {
			return scoreBonfireSpring(hex, activeCreature, controller);
		}

		if (abilityIndex === ABILITY.GREATER_PYRE) {
			return scoreGreaterPyre(hex, activeCreature);
		}

		return undefined;
	},

	/**
	 * Ability priority for Abolished each turn:
	 *
	 * Retreating, enough energy for both abilities (≥70):
	 *   Fiery Touch first   — parting shot before fleeing; still has 40 energy
	 *                         left to cover the Bonfire Spring teleport cost.
	 *   Bonfire Spring next — teleport to safety after the shot.
	 *
	 * Retreating, low energy (< 70):
	 *   Bonfire Spring only — cannot afford both; escape takes priority over
	 *                         chip damage that might not be possible anyway.
	 *
	 * Multiple adjacent enemies + enough energy:
	 *   Greater Pyre first  — capitalise on the positioning windfall.
	 *   Fiery Touch second  — stack Burning Spirit before/after the blast.
	 *   Bonfire Spring last — exit after the engagement if needed.
	 *
	 * Default (fewer adjacent enemies or low energy):
	 *   Fiery Touch first   — safely stack Burning Spirit stacks at range.
	 *   Bonfire Spring next — reposition or collect drops.
	 *   Greater Pyre last   — only fires if prerequisites are satisfied.
	 *
	 * Burning Spirit (0) is passive and never in the list.
	 */
	getAbilityPriority(creature, controller) {
		if (controller.isRetreating(creature)) {
			// Fiery Touch (30) + Bonfire Spring (40) = 70 energy needed to do both
			const canAffordBoth = creature.energy >= 70;
			return canAffordBoth
				? [ABILITY.FIERY_TOUCH, ABILITY.BONFIRE_SPRING]
				: [ABILITY.BONFIRE_SPRING];
		}

		const adjacentEnemies = countAdjacentEnemies(creature);
		const energyRatio = creature.energy / creature.stats.energy;

		if (adjacentEnemies >= GREATER_PYRE_MIN_ENEMIES && energyRatio >= GREATER_PYRE_ENERGY_MIN) {
			// Already surrounded and have the energy — fire off Greater Pyre
			return [ABILITY.GREATER_PYRE, ABILITY.FIERY_TOUCH, ABILITY.BONFIRE_SPRING];
		}

		return [ABILITY.FIERY_TOUCH, ABILITY.BONFIRE_SPRING, ABILITY.GREATER_PYRE];
	},

	/**
	 * Abolished has no retaliation or on-attack-triggered debuffs.
	 * Attackers face no special penalty from targeting it directly.
	 */
	getTargetingPenalty() {
		return 0;
	},

	/**
	 * Counter-focus recommendation vs Abolished:
	 * - Prioritise it as a fragile high-impact ranged unit.
	 * - Increase focus further when it is already injured.
	 */
	getCounterTargetingModifier(_attacker, target, _abilityIndex, _controller) {
		let score = 120;
		const healthRatio = target.health / target.stats.health;
		if (healthRatio < 0.5) score += 160;
		if (healthRatio < 0.3) score += 220;
		return score;
	},

	/**
	 * Counter-positioning recommendation vs Abolished:
	 * - Adjacent pressure is valuable because Abolished is fragile and prefers range.
	 * - Reward adjacency more when Abolished is low health so bots collapse to finish.
	 */
	getProximityPenalty(_mover, enemy, _destination, _controller) {
		let score = 80;
		const healthRatio = enemy.health / enemy.stats.health;
		if (healthRatio < 0.5) score += 80;
		if (healthRatio < 0.3) score += 140;
		return score;
	},
};

export default AbolishedStrategy;
