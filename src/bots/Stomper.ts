import type BotController from '../bot';
import type { UnitBotStrategy } from '../bot';
import { unitStrategies } from '../bot';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import * as matrices from '../utility/matrices';
import { Team, isTeam } from '../utility/team';

// Ability slot indices
const ABILITY = {
	TANKISH_BUILD: 0, // passive onStartPhase/onDamage
	SEISMIC_STOMP: 1, // ranged directional strike, 3 range
	STONE_GRINDER: 2, // row stampede; can hit allies and enemies
	EARTH_SHAKER: 3, // front-and-back area delay/dizzy control
} as const;

const RETREAT_HEALTH_RATIO = 0.18;
const RETREAT_ENERGY_RATIO = 0.22;

const SEISMIC_STOMP_ESTIMATED_DAMAGE = 28;
const STONE_GRINDER_ESTIMATED_DAMAGE = 10;
const ABILITY_MIN_SCORE: Partial<Record<number, number>> = {
	[ABILITY.SEISMIC_STOMP]: 420,
	[ABILITY.STONE_GRINDER]: 260,
	[ABILITY.EARTH_SHAKER]: 320,
};

function hasEarthShakerEffect(target: Creature): boolean {
	return target.findEffect('Earth Shaker').length > 0;
}

function hasEarthShakerDizzyRisk(target: Creature): boolean {
	return target.delayed || hasEarthShakerEffect(target);
}

function getTankishBuildDefenseBonus(target: Creature): number {
	const effect = target.findEffect('Tankish Build')[0];
	const value = effect?.alterations?.defense;
	return typeof value === 'number' ? value : 0;
}

function scoreSeismicStomp(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 700 - target.health + target.size * 15;

	if (target.health <= SEISMIC_STOMP_ESTIMATED_DAMAGE) {
		score += 950;
	}

	if (target.delayed) {
		score += 160;
	}

	if (hasEarthShakerEffect(target)) {
		score += 220;
	}

	if (target.health / target.stats.health < 0.35) {
		score += 120;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(
			activeCreature,
			target,
			ABILITY.SEISMIC_STOMP,
			controller,
		) ?? 0;
	score +=
		targetStrategy?.getCounterTargetingModifier?.(
			activeCreature,
			target,
			ABILITY.SEISMIC_STOMP,
			controller,
		) ?? 0;

	return score;
}

function scoreStoneGrinder(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature)) {
		return Number.NEGATIVE_INFINITY;
	}

	const isEnemy = isTeam(activeCreature, target, Team.Enemy);
	const isAlly = isTeam(activeCreature, target, Team.Ally);

	if (!isEnemy && !isAlly) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 0;

	if (isEnemy) {
		score = 560 - target.health + target.size * 25;

		if (target.health <= STONE_GRINDER_ESTIMATED_DAMAGE) {
			score += 550;
		}

		if (target.health / target.stats.health < 0.4) {
			score += 140;
		}

		const targetStrategy = unitStrategies[target.type as string];
		score +=
			targetStrategy?.getTargetingPenalty?.(
				activeCreature,
				target,
				ABILITY.STONE_GRINDER,
				controller,
			) ?? 0;
		score +=
			targetStrategy?.getCounterTargetingModifier?.(
				activeCreature,
				target,
				ABILITY.STONE_GRINDER,
				controller,
			) ?? 0;

		return score;
	}

	// Friendly-fire avoidance: Stone Grinder is usually not worth collateral.
	score = -900;
	if (target.health / target.stats.health < 0.5) {
		score -= 280;
	}

	if (target.health <= STONE_GRINDER_ESTIMATED_DAMAGE) {
		score -= 400;
	}

	return score;
}

function scoreEarthShaker(hex: Hex, activeCreature: Creature): number {
	const target = hex.creature;
	if (!(target instanceof Creature)) {
		return Number.NEGATIVE_INFINITY;
	}

	const isEnemy = isTeam(activeCreature, target, Team.Enemy);
	const isAlly = isTeam(activeCreature, target, Team.Ally);
	const upgraded = activeCreature.abilities[ABILITY.EARTH_SHAKER]?.isUpgraded?.() ?? false;

	if (!isEnemy && !isAlly) {
		return Number.NEGATIVE_INFINITY;
	}

	if (isAlly) {
		if (upgraded && hasEarthShakerDizzyRisk(target)) {
			return -1200;
		}

		return target.delayed ? -700 : -560;
	}

	let score = 560;
	if (upgraded && hasEarthShakerDizzyRisk(target)) {
		score += 900;
	} else if (target.delayed || hasEarthShakerEffect(target)) {
		score += 180;
	} else {
		score += 140;
	}

	const healthRatio = target.health / target.stats.health;
	if (healthRatio < 0.5) {
		score += 120;
	}

	return score;
}

function getEarthShakerWindow(creature: Creature): {
	enemies: number;
	allies: number;
	hasDizzyWindow: boolean;
} {
	const windows = [
		creature.getHexMap(matrices.frontAndBack8Hex, false),
		creature.getHexMap(matrices.frontAndBack8Hex, true),
	];

	let best = {
		enemies: 0,
		allies: Number.POSITIVE_INFINITY,
		hasDizzyWindow: false,
	};

	windows.forEach((hexes) => {
		const enemies = new Set<number>();
		const allies = new Set<number>();
		let hasDizzyWindow = false;

		hexes.forEach((hex) => {
			if (!(hex.creature instanceof Creature)) return;
			if (isTeam(creature, hex.creature, Team.Enemy)) {
				enemies.add(hex.creature.id);
				if (hasEarthShakerDizzyRisk(hex.creature)) {
					hasDizzyWindow = true;
				}
				return;
			}

			if (isTeam(creature, hex.creature, Team.Ally) && hex.creature !== creature) {
				allies.add(hex.creature.id);
			}
		});

		if (
			enemies.size > best.enemies ||
			(enemies.size === best.enemies && allies.size < best.allies)
		) {
			best = {
				enemies: enemies.size,
				allies: allies.size,
				hasDizzyWindow,
			};
		}
	});

	if (!Number.isFinite(best.allies)) {
		best.allies = 0;
	}

	return best;
}

const StomperStrategy: UnitBotStrategy = {
	/**
	 * Stomper is a durable front-liner and can stay in lane longer than default,
	 * retreating only when health or energy reaches a critical floor.
	 */
	isRetreating(creature, _controller) {
		const healthRatio = creature.health / creature.stats.health;
		const energyRatio = creature.energy / creature.stats.energy;
		return healthRatio < RETREAT_HEALTH_RATIO || energyRatio < RETREAT_ENERGY_RATIO;
	},

	/**
	 * Keep Stomper forward enough to influence turn tempo, but not so deep that
	 * Stone Grinder lanes force frequent collateral on allies.
	 */
	getPreferredX(creature, controller) {
		const gridRow = controller.game.grid.hexes[0];
		const boardWidth = gridRow ? gridRow.length - 1 : 15;
		return creature.player.flipped ? boardWidth * 0.4 : boardWidth * 0.6;
	},

	/**
	 * Movement keeps Stomper in close-control range while avoiding traps and
	 * over-commits when currently pressured.
	 */
	scoreMoveHex(hex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) return undefined;

		if (controller.isRetreating(activeCreature)) {
			return undefined;
		}

		let score = 0;
		let adjacentEnemies = 0;
		let adjacentAllies = 0;

		hex.adjacentHex(1).forEach((adj) => {
			if (!(adj.creature instanceof Creature)) return;
			if (isTeam(activeCreature, adj.creature, Team.Enemy)) {
				adjacentEnemies += 1;
				score += 115;
				if (hasEarthShakerDizzyRisk(adj.creature)) {
					score += 80;
				}
				return;
			}

			if (isTeam(activeCreature, adj.creature, Team.Ally) && adj.creature !== activeCreature) {
				adjacentAllies += 1;
			}
		});

		if (adjacentAllies > 0) {
			score += Math.min(adjacentAllies, 2) * 30;
		}

		const healthRatio = activeCreature.health / activeCreature.stats.health;
		if (healthRatio < 0.55 && adjacentEnemies > 2) {
			score -= (adjacentEnemies - 2) * 180;
		}

		const preferredX = controller.getPreferredX(activeCreature);
		score -= Math.abs(hex.x - preferredX) * 8;

		if (hex.trap) {
			score -= 260;
		}

		return score;
	},

	/**
	 * Delegate ability scoring so Stomper avoids Stone Grinder collateral and
	 * capitalises on Earth Shaker control windows.
	 */
	scoreAbilityHex(hex, abilityIndex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) return undefined;

		if (abilityIndex === ABILITY.SEISMIC_STOMP) {
			return scoreSeismicStomp(hex, activeCreature, controller);
		}

		if (abilityIndex === ABILITY.STONE_GRINDER) {
			return scoreStoneGrinder(hex, activeCreature, controller);
		}

		if (abilityIndex === ABILITY.EARTH_SHAKER) {
			return scoreEarthShaker(hex, activeCreature);
		}

		return undefined;
	},

	/**
	 * Skip low-impact ability casts so Stomper does not spend actions on
	 * poor windows (especially ally-only Stone Grinder / Earth Shaker lines).
	 */
	getAbilityMinScore(_creature, abilityIndex, _controller) {
		return ABILITY_MIN_SCORE[abilityIndex];
	},

	/**
	 * Priority logic:
	 * - If upgraded Earth Shaker can convert delays into dizzy, use it first.
	 * - If Earth Shaker can hit multiple enemies with low collateral, use it early.
	 * - Otherwise use Seismic Stomp first and keep Stone Grinder as a riskier closer.
	 */
	getAbilityPriority(creature, _controller) {
		const window = getEarthShakerWindow(creature);
		const earthShakerUpgraded = creature.abilities[ABILITY.EARTH_SHAKER]?.isUpgraded?.() ?? false;

		if (earthShakerUpgraded && window.hasDizzyWindow && window.enemies >= 1) {
			return [ABILITY.EARTH_SHAKER, ABILITY.SEISMIC_STOMP, ABILITY.STONE_GRINDER];
		}

		if (window.enemies >= 2 && window.allies <= 1) {
			return [ABILITY.EARTH_SHAKER, ABILITY.SEISMIC_STOMP, ABILITY.STONE_GRINDER];
		}

		return [ABILITY.SEISMIC_STOMP, ABILITY.EARTH_SHAKER, ABILITY.STONE_GRINDER];
	},

	/**
	 * Stomper has no direct retaliation trigger when being targeted.
	 */
	getTargetingPenalty(_attacker, _target, _abilityIndex, _controller) {
		return 0;
	},

	/**
	 * Counter-focus recommendation vs Stomper:
	 * - Focus more when Stomper is low on energy/health.
	 * - Focus less when Tankish Build has stacked large defense bonuses.
	 */
	getCounterTargetingModifier(_attacker, target, _abilityIndex, _controller) {
		let score = 45;

		const tankishBonus = getTankishBuildDefenseBonus(target);
		if (tankishBonus >= 20) {
			score -= 160;
		} else if (tankishBonus >= 10) {
			score -= 80;
		}

		const energyRatio = target.energy / target.stats.energy;
		if (energyRatio < 0.3) {
			score += 150;
		} else if (energyRatio > 0.8) {
			score -= 25;
		}

		const healthRatio = target.health / target.stats.health;
		if (healthRatio < 0.55) score += 100;
		if (healthRatio < 0.35) score += 130;

		return score;
	},

	/**
	 * Counter-positioning recommendation vs Stomper:
	 * - Avoid adjacency when a unit is already delayed and Earth Shaker can dizzy.
	 * - Collapse more aggressively when Stomper is low on energy.
	 * - Respect high Tankish Build stacks in prolonged trades.
	 */
	getProximityPenalty(mover, enemy, _destination, _controller) {
		let score = 0;

		const earthShakerUpgraded = enemy.abilities[ABILITY.EARTH_SHAKER]?.isUpgraded?.() ?? false;
		if (earthShakerUpgraded && hasEarthShakerDizzyRisk(mover)) {
			score -= 360;
		} else if (mover.delayed) {
			score -= 160;
		}

		if (mover.health <= STONE_GRINDER_ESTIMATED_DAMAGE) {
			score -= 90;
		}

		const enemyEnergyRatio = enemy.energy / enemy.stats.energy;
		if (enemyEnergyRatio < 0.3) {
			score += 110;
		}

		const tankishBonus = getTankishBuildDefenseBonus(enemy);
		const moverHealthRatio = mover.health / mover.stats.health;
		if (tankishBonus >= 20 && moverHealthRatio < 0.6) {
			score -= 120;
		}

		return score;
	},
};

export default StomperStrategy;
