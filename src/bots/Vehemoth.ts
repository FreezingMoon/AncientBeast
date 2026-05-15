import type BotController from '../bot';
import type { UnitBotStrategy } from '../bot';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import * as matrices from '../utility/matrices';
import { Team, isTeam } from '../utility/team';

// Ability slot indices
const ABILITY = {
	LAMELLAR_BODY: 0, // passive – bot never activates directly
	FLAT_FRONS: 1, // execute frozen targets <= 49 hp
	FLAKE_CONVERTOR: 2, // freeze fatigued inline targets within 5 range
	FALLING_ARROW: 3, // ranged cone, bonus damage vs lower-level targets
} as const;

const FLAT_FRONS_EXECUTE_THRESHOLD = 49;
const RETREAT_HEALTH_RATIO = 0.2;
const RETREAT_ENERGY_RATIO = 0.2;

function countLivingSlothAllies(creature: Creature, controller: BotController): number {
	let count = 0;
	controller.game.creatures.forEach((candidate) => {
		if (!candidate || candidate.dead || candidate.temp) return;
		if (!isTeam(creature, candidate, Team.Ally)) return;
		if (candidate.realm !== 'S') return;
		count += 1;
	});
	return count;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isOnSameAxis(ax: number, ay: number, bx: number, by: number): boolean {
	const dx = Math.abs(bx - ax);
	const dy = Math.abs(by - ay);
	if (dy === 0) return true;
	return Math.floor(dy / 2) === dx;
}

function getFlatFronsHexes(creature: Creature): Hex[] {
	return creature.getHexMap(matrices.frontnback3hex, creature.player.flipped);
}

function hasExecutableFrozenTargetInFlatFrons(creature: Creature): boolean {
	return getFlatFronsHexes(creature).some(
		(hex) =>
			hex.creature instanceof Creature &&
			isTeam(creature, hex.creature, Team.Enemy) &&
			hex.creature.isFrozen() &&
			hex.creature.health <= FLAT_FRONS_EXECUTE_THRESHOLD,
	);
}

function scoreFlatFrons(hex: Hex, activeCreature: Creature): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	const isExecute = target.isFrozen() && target.health <= FLAT_FRONS_EXECUTE_THRESHOLD;
	if (isExecute) {
		const level = typeof target.level === 'number' ? target.level : 1;
		return 7000 + level * 120 + target.energy;
	}

	let score = 500 - target.health + target.size * 15;
	if (target.isFrozen()) {
		score += 350;
	}

	const healthRatio = target.health / target.stats.health;
	if (healthRatio < 0.35) {
		score += 150;
	}

	return score;
}

function scoreFlakeConvertor(hex: Hex, activeCreature: Creature): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	// Ability only works on fatigued targets.
	if (!target.isFatigued()) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 800;

	// Control value: higher-level enemies are harder to trade into.
	const level = typeof target.level === 'number' ? target.level : 1;
	score += level * 70;

	if (typeof target.stats.energy === 'number' && target.stats.energy > 0) {
		score += Math.round((target.energy / target.stats.energy) * 120);
	}

	// Setting up a Flat Frons shatter on the next action/turn is very valuable.
	if (target.health <= FLAT_FRONS_EXECUTE_THRESHOLD) {
		score += 500;
	}

	if (target.isFrozen()) {
		score -= 250;
	}

	// Keep slight pressure on axis-aligned targets that are easy to re-engage.
	if (isOnSameAxis(activeCreature.x, activeCreature.y, target.x, target.y)) {
		score += 50;
	}

	return score;
}

function scoreFallingArrow(hex: Hex, activeCreature: Creature): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	const ability = activeCreature.abilities[ABILITY.FALLING_ARROW];
	const upgraded = ability?.isUpgraded?.() ?? false;
	const casterLevel = typeof activeCreature.level === 'number' ? activeCreature.level : 0;
	const targetLevel = typeof target.level === 'number' ? target.level : 0;
	const levelDiff = Math.max(casterLevel - targetLevel, 0);

	// Approximate expected damage from ability data and level scaling.
	const estimatedDamage = 20 + levelDiff * 3 + (upgraded ? levelDiff * 2 : 0);

	let score = 600 - target.health + levelDiff * 120;
	if (target.health <= estimatedDamage) {
		score += 1200;
	}

	if (target.health / target.stats.health < 0.4) {
		score += 120;
	}

	return score;
}

const VehemothStrategy: UnitBotStrategy = {
	/**
	 * Vehemoth is highly durable; retreat only at truly critical health/energy.
	 */
	isRetreating(creature, _controller) {
		const healthRatio = creature.health / creature.stats.health;
		const energyRatio = creature.energy / creature.stats.energy;
		return healthRatio < RETREAT_HEALTH_RATIO || energyRatio < RETREAT_ENERGY_RATIO;
	},

	/**
	 * Keep Vehemoth in the forward-mid lane rather than overcommitting to the
	 * deepest enemy-side position used by the generic level-7 profile.
	 */
	getPreferredX(creature, controller) {
		const gridRow = controller.game.grid.hexes[0];
		const boardWidth = gridRow ? gridRow.length - 1 : 15;
		return creature.player.flipped ? boardWidth * 0.3 : boardWidth * 0.7;
	},

	/**
	 * Movement scoring emphasises adjacent pressure on frozen/fatigued enemies,
	 * while avoiding over-clumping when Vehemoth drops to mid-low health.
	 */
	scoreMoveHex(hex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) return undefined;

		if (controller.isRetreating(activeCreature)) return undefined;

		let score = 0;
		const adjacentHexes = hex.adjacentHex(1);
		let adjacentEnemyCount = 0;

		adjacentHexes.forEach((adj) => {
			if (!(adj.creature instanceof Creature)) return;
			if (!isTeam(activeCreature, adj.creature, Team.Enemy)) return;

			adjacentEnemyCount += 1;
			score += 80;

			if (adj.creature.isFrozen()) {
				score += 220;
			}

			if (adj.creature.isFatigued() && !adj.creature.isFrozen()) {
				score += 140;
			}
		});

		const healthRatio = activeCreature.health / activeCreature.stats.health;
		if (healthRatio < 0.5 && adjacentEnemyCount > 2) {
			score -= (adjacentEnemyCount - 2) * 180;
		}

		const preferredX = controller.getPreferredX(activeCreature);
		score -= Math.abs(hex.x - preferredX) * 9;

		if (hex.trap) {
			score -= 220;
		}

		return score;
	},

	/**
	 * Delegates to per-ability scorers for Flat Frons, Flake Convertor,
	 * and Falling Arrow.
	 */
	scoreAbilityHex(hex, abilityIndex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) return undefined;

		if (abilityIndex === ABILITY.FLAT_FRONS) {
			return scoreFlatFrons(hex, activeCreature);
		}

		if (abilityIndex === ABILITY.FLAKE_CONVERTOR) {
			return scoreFlakeConvertor(hex, activeCreature);
		}

		if (abilityIndex === ABILITY.FALLING_ARROW) {
			return scoreFallingArrow(hex, activeCreature);
		}

		return undefined;
	},

	/**
	 * Priority logic:
	 * - Execute now when Flat Frons can shatter a frozen low-health enemy.
	 * - Otherwise, prefer Flake Convertor first to create freeze control windows.
	 */
	getAbilityPriority(creature, _controller) {
		if (hasExecutableFrozenTargetInFlatFrons(creature)) {
			return [ABILITY.FLAT_FRONS, ABILITY.FLAKE_CONVERTOR, ABILITY.FALLING_ARROW];
		}

		return [ABILITY.FLAKE_CONVERTOR, ABILITY.FALLING_ARROW, ABILITY.FLAT_FRONS];
	},

	/**
	 * Vehemoth has no direct retaliation on being targeted.
	 */
	getTargetingPenalty(_attacker, _target, _abilityIndex, _controller) {
		return 0;
	},

	/**
	 * Counter-focus recommendation vs Vehemoth:
	 * - Increase focus when Lamellar Body scaling is low (few Sloth allies alive).
	 * - Increase focus when Vehemoth is low on energy (control chain is weaker).
	 * - Increase focus when already injured.
	 */
	getCounterTargetingModifier(_attacker, target, _abilityIndex, controller) {
		let score = 60;

		const slothAllies = countLivingSlothAllies(target, controller);
		if (slothAllies <= 1) {
			score += 180;
		} else if (slothAllies >= 4) {
			score -= 90;
		}

		const energyRatio = target.energy / target.stats.energy;
		if (energyRatio < 0.3) {
			score += 130;
		} else if (energyRatio > 0.8) {
			score -= 30;
		}

		const healthRatio = target.health / target.stats.health;
		if (healthRatio < 0.5) score += 120;
		if (healthRatio < 0.3) score += 180;

		return score;
	},

	/**
	 * Counter-positioning recommendation vs Vehemoth:
	 * - Avoid adjacency when frozen and in shatter range (Flat Frons execute).
	 * - Avoid adjacency when fatigued (high risk of freeze-control chain).
	 * - Collapse more aggressively when Vehemoth is low health/energy.
	 */
	getProximityPenalty(mover, enemy, _destination, controller) {
		let score = 0;

		if (mover.isFrozen() && mover.health <= FLAT_FRONS_EXECUTE_THRESHOLD) {
			score -= 1000;
		} else if (mover.isFrozen()) {
			score -= 320;
		}

		if (mover.isFatigued() && !mover.isFrozen()) {
			score -= 170;
		}

		const slothAllies = countLivingSlothAllies(enemy, controller);
		if (slothAllies >= 4) {
			score -= 80;
		}

		const enemyEnergyRatio = enemy.energy / enemy.stats.energy;
		if (enemyEnergyRatio < 0.3) {
			score += 110;
		}

		const enemyHealthRatio = enemy.health / enemy.stats.health;
		if (enemyHealthRatio < 0.5) score += 90;
		if (enemyHealthRatio < 0.3) score += 120;

		return score;
	},
};

export default VehemothStrategy;
