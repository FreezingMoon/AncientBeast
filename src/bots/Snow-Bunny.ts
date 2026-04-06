import type BotController from '../bot';
import type { UnitBotStrategy } from '../bot';
import { unitStrategies } from '../bot';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import { Team, isTeam } from '../utility/team';

// Ability slot indices (Bunny Hop is passive – bot never activates it directly)
const ABILITY = {
	BIG_PLIERS: 1, // Melee; upgraded deals pure damage against frozen targets
	BLOWING_WIND: 2, // Push any unit in 6 directions; targets Team.Both
	FREEZING_SPIT: 3, // Ranged; scaled crush by empty-hex distance; upgraded freezes at melee
} as const;

/** Max push hexes before size penalty is applied by the Blowing Wind ability. */
const MAX_PUSH_DISTANCE = 6;

/**
 * Returns true when hex B is on the same straight row or diagonal axis as
 * hex A, matching the three attack axes used by directional abilities
 * (Blowing Wind, Freezing Spit).
 *
 * Straight: same y row.
 * Diagonal: the hex grid shifts x by 1 every 2 rows, so
 *   floor(|Δy| / 2) === |Δx| characterises both diagonal directions.
 */
function isOnSameAxis(ax: number, ay: number, bx: number, by: number): boolean {
	const dx = Math.abs(bx - ax);
	const dy = Math.abs(by - ay);
	if (dy === 0) return true; // same row (straight axis)
	return Math.floor(dy / 2) === dx; // diagonal axis
}

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

/**
 * Approximate the hex a pushed unit will land on.
 *
 * The exact landing depends on the hex-grid push matrices; this uses the
 * integer-normalised direction vector from Snow Bunny to the target, which is
 * accurate for straight-line pushes and a close approximation for diagonals.
 */
function approximateLandingPos(
	target: Hex,
	bunnyX: number,
	bunnyY: number,
	pushDist: number,
): { x: number; y: number } {
	const deltaX = target.x - bunnyX;
	const deltaY = target.y - bunnyY;
	const scale = Math.max(Math.abs(deltaX), Math.abs(deltaY)) || 1;
	const stepX = deltaX / scale;
	const stepY = deltaY / scale;
	return {
		x: Math.round(target.x + stepX * pushDist),
		y: Math.round(target.y + stepY * pushDist),
	};
}

/**
 * Returns true when any hex along the push path (from target outward by
 * `steps` increments) contains a drop – meaning an enemy being pushed there
 * would pick it up.
 */
function pathHasDrop(
	controller: BotController,
	target: Hex,
	bunnyX: number,
	bunnyY: number,
	steps: number,
): boolean {
	const deltaX = target.x - bunnyX;
	const deltaY = target.y - bunnyY;
	const scale = Math.max(Math.abs(deltaX), Math.abs(deltaY)) || 1;
	const stepX = deltaX / scale;
	const stepY = deltaY / scale;

	for (let i = 1; i <= steps; i++) {
		const x = Math.round(target.x + stepX * i);
		const y = Math.round(target.y + stepY * i);
		const h = controller.game.grid.hexAt(x, y);
		if (h?.drop) return true;
	}
	return false;
}

/**
 * Returns true when any hex along the push path (from target outward by
 * `steps` increments) contains a trap – relevant when pushing allied units.
 */
function pathHasTrap(
	controller: BotController,
	target: Hex,
	bunnyX: number,
	bunnyY: number,
	steps: number,
): boolean {
	const deltaX = target.x - bunnyX;
	const deltaY = target.y - bunnyY;
	const scale = Math.max(Math.abs(deltaX), Math.abs(deltaY)) || 1;
	const stepX = deltaX / scale;
	const stepY = deltaY / scale;

	for (let i = 1; i <= steps; i++) {
		const x = Math.round(target.x + stepX * i);
		const y = Math.round(target.y + stepY * i);
		const h = controller.game.grid.hexAt(x, y);
		if (h?.trap) return true;
	}
	return false;
}

// ---------------------------------------------------------------------------
// Per-ability scorers
// ---------------------------------------------------------------------------

function scoreFreezingSpit(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	const distToTarget = Math.abs(hex.x - activeCreature.x) + Math.abs(hex.y - activeCreature.y);
	const isMelee = distToTarget <= 1;
	// Rough emptyHexDist – exact value is computed from the path in the ability itself
	const emptyHexDist = Math.max(0, distToTarget - 1);

	const ability = activeCreature.abilities[ABILITY.FREEZING_SPIT];
	const upgraded = ability?.isUpgraded?.() ?? false;

	let score = 400 - target.health + target.size * 10;

	if (target.isFrozen()) {
		// Frozen targets are still valid — the damage is real and freeze can be
		// removed at any time. Prioritise finishing them off when health is low;
		// score slightly below a fresh non-frozen target otherwise (Big Pliers
		// is more efficient at melee, but ranged Freezing Spit is still valid).
		const healthRatio = target.health / target.stats.health;
		if (healthRatio < 0.3) {
			// Potential kill — treat as high priority
			score += 150;
		} else {
			// Alive and frozen: still damage, just a small penalty vs fresh targets
			// since the re-freeze bonus is wasted and Big Pliers may combo better
			score -= 50;
		}
		// Frozen targets don't benefit from the upgrade's fresh-freeze combo,
		// but still take the ranged crush bonus normally
		if (!isMelee) score += emptyHexDist * 20;
		return score;
	}

	if (isMelee) {
		if (upgraded) {
			// Upgraded + melee = freeze, enabling a Big Pliers pure-damage follow-up
			score += 200;
		} else {
			// Non-upgraded melee yields zero crush bonus; Snow Bunny prefers range
			score -= 100;
		}
	} else {
		// Range: crush damage scales with empty hexes – prefer farther targets
		score += emptyHexDist * 20;
	}

	return score;
}

function scoreBlowingWind(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || target === activeCreature) {
		return Number.NEGATIVE_INFINITY;
	}

	const isEnemy = isTeam(activeCreature, target, Team.Enemy);
	const isAlly = isTeam(activeCreature, target, Team.Ally);

	// Blowing Wind always pushes outward from Snow Bunny – no self-targeting possible
	const pushDist = Math.max(1, MAX_PUSH_DISTANCE - target.size);
	const landingPos = approximateLandingPos(hex, activeCreature.x, activeCreature.y, pushDist);

	let score = 0;

	if (isEnemy) {
		score += 300; // Base reward for pushing any enemy

		// Penalise if the enemy would land adjacent to a low-health ally
		controller.game.creatures.forEach((c) => {
			if (!c || c.dead || c.temp || !isTeam(activeCreature, c, Team.Ally)) return;
			const distToLanding = Math.abs(landingPos.x - c.x) + Math.abs(landingPos.y - c.y);
			if (distToLanding <= 1) {
				const healthRatio = c.health / c.stats.health;
				// The weaker the ally, the worse it is to have an enemy pushed next to them
				score -= healthRatio < 0.3 ? 400 : 150;
			}
		});

		// Penalise if any hex along the push path has a drop (enemy picks it up)
		if (pathHasDrop(controller, hex, activeCreature.x, activeCreature.y, pushDist)) {
			score -= 150;
		}

		// Bonus: the further the enemy lands from all allies, the better
		score += controller.closestDistanceToEnemy(landingPos) * 3;
	} else if (isAlly) {
		// Pushing allies is risky – start with a penalty; only rescue is worth it
		score -= 150;

		const currentEnemyDist = controller.closestDistanceToEnemy({
			x: target.x,
			y: target.y,
		});
		const landingEnemyDist = controller.closestDistanceToEnemy(landingPos);

		if (currentEnemyDist <= 1 && landingEnemyDist > 2) {
			// Clear rescue: ally is currently in melee, push gets them to safety
			score += 400;
		} else if (landingEnemyDist <= 1 && currentEnemyDist > 1) {
			// Pushing a safe ally into enemy range – very bad
			score -= 400;
		}

		// Penalise if any hex along the path has a trap
		if (pathHasTrap(controller, hex, activeCreature.x, activeCreature.y, pushDist)) {
			score -= 500;
		}
	}

	return score;
}

function scoreBigPliers(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	const ability = activeCreature.abilities[ABILITY.BIG_PLIERS];
	const upgraded = ability?.isUpgraded?.() ?? false;

	let score: number;

	if (target.isFrozen() && upgraded) {
		// Upgraded pure damage against a frozen target – highest Big Pliers value
		score = 700 - target.health + target.size * 10;
	} else if (target.isFrozen()) {
		// Frozen but not upgraded – still meaningful bonus damage
		score = 400 - target.health + target.size * 10;
	} else {
		// Non-frozen melee on a sniper unit: last resort
		score = 100 - target.health + target.size * 10;
	}

	// Ask the target's own strategy if attacking it carries retaliation or
	// debuff risk (e.g. Plasma Field, Battle Cry, Toxic Spores …).
	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(activeCreature, target, ABILITY.BIG_PLIERS, controller) ??
		0;

	return score;
}

// ---------------------------------------------------------------------------
// Strategy export
// ---------------------------------------------------------------------------

const SnowBunnyStrategy: UnitBotStrategy = {
	/**
	 * Snow Bunny is very fragile – start retreating at 45 % health
	 * (generic threshold is 30 %).
	 */
	isRetreating(creature, _controller) {
		const healthRatio = creature.health / creature.stats.health;
		const energyRatio = creature.energy / creature.stats.energy;
		return healthRatio < 0.45 || energyRatio < 0.25;
	},

	/**
	 * Snow Bunny should stay deep in home territory (≈5 % from the edge)
	 * regardless of its level, unlike most units that push forward over time.
	 */
	getPreferredX(creature, controller) {
		const gridRow = controller.game.grid.hexes[0];
		const boardWidth = gridRow ? gridRow.length - 1 : 15;
		return creature.player.flipped ? boardWidth * 0.95 : boardWidth * 0.05;
	},

	/**
	 * Snow Bunny strongly avoids adjacency to enemies, prefers cover from allies,
	 * and gains a bonus for being in line with enemies (enabling Freezing Spit /
	 * Blowing Wind shots).
	 */
	scoreMoveHex(hex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) return undefined;

		// Retreat movement is handled generically by scoreRetreatHex
		if (controller.isRetreating(activeCreature)) return undefined;

		let score = 0;

		// Heavy penalty for landing adjacent to an enemy
		const adjacentEnemyCount = hex
			.adjacentHex(1)
			.filter((adj) => adj.creature && isTeam(activeCreature, adj.creature, Team.Enemy)).length;
		score -= adjacentEnemyCount * 200;

		// Reward being adjacent to allies – they shield the bunny
		const adjacentAllyCount = hex
			.adjacentHex(1)
			.filter(
				(adj) =>
					adj.creature &&
					adj.creature !== activeCreature &&
					isTeam(activeCreature, adj.creature, Team.Ally),
			).length;
		score += adjacentAllyCount * 60;

		// After firing a directional ability (Blowing Wind or Freezing Spit),
		// enemies can retaliate along the same axis on their turn.
		// Apply escape-line penalties so Snow Bunny moves off the firing line.
		const blowingWindUsed = activeCreature.abilities[ABILITY.BLOWING_WIND]?.used ?? false;
		const freezingSpitUsed = activeCreature.abilities[ABILITY.FREEZING_SPIT]?.used ?? false;
		if (blowingWindUsed || freezingSpitUsed) {
			controller.game.creatures.forEach((enemy) => {
				if (!enemy || enemy.dead || enemy.temp) return;
				if (!isTeam(activeCreature, enemy, Team.Enemy)) return;
				if (!isOnSameAxis(hex.x, hex.y, enemy.x, enemy.y)) return;
				const dy = Math.abs(hex.y - enemy.y);
				if (dy === 0) {
					// Straight row: strongest penalty – this is the primary attack axis
					score -= 120;
				} else {
					// Diagonal: lighter penalty
					score -= 60;
				}
			});
		}

		// Zone preference: fixed weight keeps the bunny firmly at the back
		// even as aggression rises (unlike the generic formula that relaxes it)
		const preferredX = controller.getPreferredX(activeCreature);
		score -= Math.abs(hex.x - preferredX) * 12;

		return score;
	},

	/**
	 * Delegates to the per-ability scorers above based on which ability slot
	 * is currently being queried.
	 */
	scoreAbilityHex(hex, abilityIndex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) return undefined;

		if (abilityIndex === ABILITY.FREEZING_SPIT)
			return scoreFreezingSpit(hex, activeCreature, controller);

		if (abilityIndex === ABILITY.BLOWING_WIND)
			return scoreBlowingWind(hex, activeCreature, controller);

		if (abilityIndex === ABILITY.BIG_PLIERS) return scoreBigPliers(hex, activeCreature, controller);

		return undefined;
	},

	/**
	 * Ability priority for Snow Bunny:
	 * - Default: Freezing Spit (3) → Blowing Wind (2) → Big Pliers (1)
	 *   Ranged attacks first; melee is a last resort for a glass-cannon sniper.
	 * - Frozen adjacent enemy: Big Pliers (1) first to capitalise on the
	 *   upgraded pure-damage combo; then the ranged options.
	 */
	/**
	 * Snow Bunny has no retaliation or attack-triggered debuffs — return 0.
	 * Other unit bot files can declare their own penalties here.
	 */
	getTargetingPenalty(_attacker, _target, _abilityIndex, _controller) {
		return 0;
	},

	getAbilityPriority(creature, _controller) {
		const hasFrozenAdjacent = creature
			.adjacentHexes(1)
			.some(
				(hex: Hex) =>
					hex.creature instanceof Creature &&
					isTeam(creature, hex.creature, Team.Enemy) &&
					hex.creature.isFrozen(),
			);

		if (hasFrozenAdjacent) {
			return [ABILITY.BIG_PLIERS, ABILITY.FREEZING_SPIT, ABILITY.BLOWING_WIND];
		}

		return [ABILITY.FREEZING_SPIT, ABILITY.BLOWING_WIND, ABILITY.BIG_PLIERS];
	},
};

export default SnowBunnyStrategy;
