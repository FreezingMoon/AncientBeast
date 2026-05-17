import type BotController from '../bot';
import type { UnitBotStrategy } from '../bot';
import { unitStrategies } from '../bot';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import { Team, isTeam } from '../utility/team';

const ABILITY = {
	EXPLOSIVE_END: 0,
	OPTIC_BURST: 1,
	RIOT_SHIELD: 2,
	POWER_APERTURE: 3,
} as const;

const RETREAT_HEALTH_RATIO = 0.2;
const RETREAT_ENERGY_RATIO = 0.18;
const OPTIC_BURST_BASE_DAMAGE = 30;

function isAcrylicWall(creature: Creature | null | undefined): boolean {
	return creature instanceof Creature && creature.type === 'O0';
}

function estimateLineDistance(a: Creature, b: Creature): number {
	return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function getApertureCost(target: Creature, upgraded: boolean): number {
	const sourceHealth = upgraded ? target.health : target.stats.health;
	return Math.max(1, Math.ceil(sourceHealth));
}

function isAdjacent(a: Creature, b: Creature): boolean {
	return a.adjacentHexes(1).some((hex) => hex.creature === b);
}

function countAdjacentEnemies(creature: Creature): number {
	const seen = new Set<number>();
	creature.adjacentHexes(1).forEach((hex) => {
		if (hex.creature instanceof Creature && isTeam(creature, hex.creature, Team.Enemy)) {
			seen.add(hex.creature.id);
		}
	});
	return seen.size;
}

function hasDamagedAlliedAcrylicWall(creature: Creature): boolean {
	return creature.player.creatures.some(
		(candidate) =>
			candidate instanceof Creature &&
			!candidate.dead &&
			isAcrylicWall(candidate) &&
			candidate.health < candidate.stats.health,
	);
}

function hasUrgentApertureRescue(creature: Creature): boolean {
	return creature.player.creatures.some((candidate) => {
		if (
			!(candidate instanceof Creature) ||
			candidate.dead ||
			candidate === creature ||
			candidate.health >= candidate.stats.health ||
			isAcrylicWall(candidate)
		) {
			return false;
		}

		const healthRatio = candidate.health / candidate.stats.health;
		if (healthRatio > 0.45) {
			return false;
		}

		return countAdjacentEnemies(candidate) >= 1;
	});
}

function hasLethalOpticBurstTarget(creature: Creature): boolean {
	return creature.adjacentHexes(8).some((hex) => {
		const target = hex.creature;
		if (!(target instanceof Creature) || !isTeam(creature, target, Team.Enemy)) {
			return false;
		}

		const distance = estimateLineDistance(creature, target);
		const estimatedDamage = Math.max(1, OPTIC_BURST_BASE_DAMAGE - distance);
		return target.health <= estimatedDamage;
	});
}

function isShieldedDarkPriestTarget(attacker: Creature, target: Creature): boolean {
	return target.type === '--' && isTeam(attacker, target, Team.Enemy) && target.player.plasma > 0;
}

function scoreOpticBurst(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || target === activeCreature || isAcrylicWall(target)) {
		return Number.NEGATIVE_INFINITY;
	}

	const upgraded = activeCreature.abilities[ABILITY.OPTIC_BURST]?.isUpgraded?.() ?? false;

	if (isTeam(activeCreature, target, Team.Ally)) {
		if (!upgraded || target.health >= target.stats.health) {
			return Number.NEGATIVE_INFINITY;
		}

		const missingHealth = target.stats.health - target.health;
		let score = 450 + missingHealth * 8;

		if (target.health / target.stats.health < 0.35) {
			score += 260;
		}

		score += countAdjacentEnemies(target) * 180;
		if (isAcrylicWall(target)) {
			score += 120;
		}

		return score;
	}

	if (!isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	const distance = estimateLineDistance(activeCreature, target);
	const estimatedDamage = Math.max(1, OPTIC_BURST_BASE_DAMAGE - distance);
	let score = 700 - target.health + target.size * 15;

	if (target.health <= estimatedDamage) {
		score += 1150;
	}

	const healthRatio = target.health / target.stats.health;
	if (healthRatio < 0.4) {
		score += 180;
	}

	if (typeof target.stats.energy === 'number' && target.stats.energy > 0) {
		score += Math.round((target.energy / target.stats.energy) * 80);
	}

	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(
			activeCreature,
			target,
			ABILITY.OPTIC_BURST,
			controller,
		) ?? 0;
	score +=
		targetStrategy?.getCounterTargetingModifier?.(
			activeCreature,
			target,
			ABILITY.OPTIC_BURST,
			controller,
		) ?? 0;

	return score;
}

function scoreRiotShield(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;

	if (target instanceof Creature) {
		if (
			isAcrylicWall(target) &&
			isTeam(activeCreature, target, Team.Ally) &&
			target.health < target.stats.health
		) {
			const missingHealth = target.stats.health - target.health;
			return 900 + missingHealth * 16;
		}

		return Number.NEGATIVE_INFINITY;
	}

	let score = 0;
	const nearestEnemyDist = controller.closestDistanceToEnemy(hex);
	if (nearestEnemyDist <= 1) {
		score += 260;
	} else if (nearestEnemyDist === 2) {
		score += 190;
	} else if (nearestEnemyDist === 3) {
		score += 120;
	} else {
		score -= Math.min(220, (nearestEnemyDist - 3) * 55);
	}

	const healthRatio = activeCreature.health / activeCreature.stats.health;
	if (healthRatio < 0.45) {
		score += Math.round((0.45 - healthRatio) * 520);
	}

	if (hex.trap) {
		score -= 220;
	}

	return score;
}

function scorePowerAperture(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || target === activeCreature || target.dead || target.temp) {
		return Number.NEGATIVE_INFINITY;
	}

	const upgraded = activeCreature.abilities[ABILITY.POWER_APERTURE]?.isUpgraded?.() ?? false;
	const apertureCost = getApertureCost(target, upgraded);
	if (apertureCost > activeCreature.energy) {
		return Number.NEGATIVE_INFINITY;
	}
	const energyAfter = activeCreature.energy - apertureCost;

	if (isTeam(activeCreature, target, Team.Ally)) {
		if (isAcrylicWall(target)) {
			return Number.NEGATIVE_INFINITY;
		}

		const missingHealth = target.stats.health - target.health;
		const threat = countAdjacentEnemies(target);
		let score = 140 + threat * 240;

		if (missingHealth > 0) {
			score += Math.min(500, missingHealth * 4);
		}

		if (target.health / target.stats.health < 0.4) {
			score += 220;
		}

		if (threat === 0 && missingHealth <= 0) {
			score -= 340;
		}

		if (energyAfter < activeCreature.stats.energy * 0.1) {
			score -= 180;
		}

		return score;
	}

	if (!isTeam(activeCreature, target, Team.Enemy) || isAcrylicWall(target)) {
		return Number.NEGATIVE_INFINITY;
	}

	if (isShieldedDarkPriestTarget(activeCreature, target)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 500;
	const enemyThreat = countAdjacentEnemies(target);
	const level = typeof target.level === 'number' ? target.level : 1;
	const healthRatio = target.health / target.stats.health;

	score += enemyThreat * 130;
	score += level * 70;
	if (typeof target.stats.energy === 'number' && target.stats.energy > 0) {
		score += Math.round((target.energy / target.stats.energy) * 130);
	}

	if (healthRatio < 0.35) {
		score -= 140;
	}

	if (energyAfter < activeCreature.stats.energy * 0.1) {
		score -= 240;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(
			activeCreature,
			target,
			ABILITY.POWER_APERTURE,
			controller,
		) ?? 0;
	score +=
		targetStrategy?.getCounterTargetingModifier?.(
			activeCreature,
			target,
			ABILITY.POWER_APERTURE,
			controller,
		) ?? 0;

	return score;
}

const CycloperStrategy: UnitBotStrategy = {
	isRetreating(creature, _controller) {
		const healthRatio = creature.health / creature.stats.health;
		const energyRatio = creature.energy / creature.stats.energy;
		return healthRatio < RETREAT_HEALTH_RATIO || energyRatio < RETREAT_ENERGY_RATIO;
	},

	getPreferredX(creature, controller) {
		const gridRow = controller.game.grid.hexes[0];
		const boardWidth = gridRow ? gridRow.length - 1 : 15;
		return creature.player.flipped ? boardWidth * 0.32 : boardWidth * 0.68;
	},

	scoreAbilityHex(hex, abilityIndex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) return undefined;

		if (abilityIndex === ABILITY.OPTIC_BURST) {
			return scoreOpticBurst(hex, activeCreature, controller);
		}

		if (abilityIndex === ABILITY.RIOT_SHIELD) {
			return scoreRiotShield(hex, activeCreature, controller);
		}

		if (abilityIndex === ABILITY.POWER_APERTURE) {
			return scorePowerAperture(hex, activeCreature, controller);
		}

		return undefined;
	},

	getAbilityPriority(creature, _controller) {
		if (hasLethalOpticBurstTarget(creature)) {
			return [ABILITY.OPTIC_BURST, ABILITY.POWER_APERTURE, ABILITY.RIOT_SHIELD];
		}

		if (hasDamagedAlliedAcrylicWall(creature)) {
			return [ABILITY.RIOT_SHIELD, ABILITY.OPTIC_BURST, ABILITY.POWER_APERTURE];
		}

		if (hasUrgentApertureRescue(creature)) {
			return [ABILITY.POWER_APERTURE, ABILITY.OPTIC_BURST, ABILITY.RIOT_SHIELD];
		}

		return [ABILITY.OPTIC_BURST, ABILITY.RIOT_SHIELD, ABILITY.POWER_APERTURE];
	},

	getTargetingPenalty(attacker, target, _abilityIndex, _controller) {
		let score = 0;
		const adjacent = isAdjacent(attacker, target);
		if (!adjacent) {
			return score;
		}

		score -= 90;
		const targetHealthRatio = target.health / target.stats.health;
		if (targetHealthRatio < 0.45) {
			score -= 180;
		}

		const explosiveEndUpgraded = target.abilities[ABILITY.EXPLOSIVE_END]?.isUpgraded?.() ?? false;
		if (explosiveEndUpgraded && target.energy > 0) {
			score -= Math.min(260, target.energy * 3);
		}

		const attackerHealthRatio = attacker.health / attacker.stats.health;
		if (attackerHealthRatio < 0.35) {
			score -= 120;
		}

		return score;
	},

	getCounterTargetingModifier(attacker, target, _abilityIndex, _controller) {
		let score = 70;
		const healthRatio = target.health / target.stats.health;
		const energyRatio = target.energy / target.stats.energy;
		const explosiveEndUpgraded = target.abilities[ABILITY.EXPLOSIVE_END]?.isUpgraded?.() ?? false;

		if (healthRatio < 0.55) score += 130;
		if (healthRatio < 0.32) score += 190;

		if (energyRatio < 0.25) {
			score += 140;
		} else if (energyRatio > 0.75) {
			score -= 90;
		}

		if (explosiveEndUpgraded && energyRatio > 0.5) {
			score -= 130;
		}

		if (!isAdjacent(attacker, target) && healthRatio < 0.32) {
			score += 90;
		}

		return score;
	},

	getProximityPenalty(mover, enemy, destination, _controller) {
		let score = -120;
		const explosiveEndUpgraded = enemy.abilities[ABILITY.EXPLOSIVE_END]?.isUpgraded?.() ?? false;
		const enemyEnergyRatio = enemy.energy / enemy.stats.energy;
		const enemyHealthRatio = enemy.health / enemy.stats.health;

		if (explosiveEndUpgraded && enemyEnergyRatio > 0.5) {
			score -= 190;
		}

		const nearbyAllies = destination
			.adjacentHex(1)
			.filter(
				(hex) =>
					hex.creature instanceof Creature &&
					hex.creature !== mover &&
					isTeam(mover, hex.creature, Team.Ally),
			)
			.map((hex) => hex.creature as Creature).length;
		score -= nearbyAllies * 70;

		if (enemyHealthRatio < 0.25 && enemyEnergyRatio < 0.25) {
			score += 170;
		}

		const moverHealthRatio = mover.health / mover.stats.health;
		if (moverHealthRatio < 0.45) {
			score -= 120;
		}

		return score;
	},
};

export default CycloperStrategy;
