import type BotController from '../bot';
import type { UnitBotStrategy } from '../bot';
import { unitStrategies } from '../bot';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import { Team, isTeam } from '../utility/team';

const ABILITY = {
	ELECTRIFIED_HAIR: 0,
	HASTED_JAVELIN: 1,
	POISONOUS_VINE: 2,
	CHAIN_LIGHTNING: 3,
} as const;

const RETREAT_HEALTH_RATIO = 0.22;
const RETREAT_ENERGY_RATIO = 0.18;
const HASTED_JAVELIN_DAMAGE = 30;
const HASTED_JAVELIN_UPGRADE_POISON = 10;
const POISONOUS_VINE_DAMAGE = 25;
const CHAIN_LIGHTNING_DAMAGE = 20;

function estimateDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
	return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function getEnemyCreatures(creature: Creature, controller: BotController): Creature[] {
	return controller.game.creatures.filter(
		(candidate) =>
			candidate instanceof Creature &&
			!candidate.dead &&
			!candidate.temp &&
			isTeam(creature, candidate, Team.Enemy),
	);
}

function getJavelinDamage(creature: Creature): number {
	const upgraded = creature.abilities[ABILITY.HASTED_JAVELIN]?.isUpgraded?.() ?? false;
	return HASTED_JAVELIN_DAMAGE + (upgraded ? HASTED_JAVELIN_UPGRADE_POISON : 0);
}

function countAdjacentUnits(
	hex: Hex,
	source: Creature,
	relation: Team,
	exclude?: Creature,
): number {
	const seen = new Set<number>();
	hex.adjacentHex(1).forEach((adjacentHex) => {
		const target = adjacentHex.creature;
		if (
			!(target instanceof Creature) ||
			target === exclude ||
			seen.has(target.id) ||
			!isTeam(source, target, relation)
		) {
			return;
		}

		seen.add(target.id);
	});

	return seen.size;
}

function countClusterTargets(hex: Hex, source: Creature) {
	const seen = new Set<number>();
	let enemyCount = 0;
	let allyCount = 0;

	[hex, ...hex.adjacentHex(1)].forEach((localHex) => {
		const target = localHex.creature;
		if (!(target instanceof Creature) || seen.has(target.id)) {
			return;
		}

		seen.add(target.id);
		if (isTeam(source, target, Team.Enemy)) {
			enemyCount += 1;
			return;
		}

		if (isTeam(source, target, Team.Ally)) {
			allyCount += 1;
		}
	});

	return { enemyCount, allyCount };
}

function countNearbyEnemies(
	position: { x: number; y: number },
	creature: Creature,
	controller: BotController,
	range: number,
): number {
	return getEnemyCreatures(creature, controller).filter(
		(candidate) => estimateDistance(position, candidate) <= range,
	).length;
}

function hasKillableJavelinTarget(creature: Creature, controller: BotController): boolean {
	const javelinDamage = getJavelinDamage(creature);
	return getEnemyCreatures(creature, controller).some(
		(enemy) => estimateDistance(creature, enemy) <= 3 && enemy.health <= javelinDamage,
	);
}

function hasHighValueChainTarget(creature: Creature, controller: BotController): boolean {
	return getEnemyCreatures(creature, controller).some((enemy) => {
		const nearbyEnemyCount = getEnemyCreatures(creature, controller).filter(
			(candidate) => candidate !== enemy && estimateDistance(enemy, candidate) <= 1,
		).length;
		return nearbyEnemyCount >= 1;
	});
}

function hasHighValueVineTarget(creature: Creature, controller: BotController): boolean {
	return getEnemyCreatures(creature, controller).some((enemy) => {
		if (estimateDistance(creature, enemy) > 2) {
			return false;
		}

		const pressuredByAllies = enemy
			.adjacentHexes(1)
			.some(
				(hex) =>
					hex.creature instanceof Creature &&
					hex.creature !== creature &&
					isTeam(creature, hex.creature, Team.Ally),
			);
		return pressuredByAllies || enemy.level >= creature.level;
	});
}

function scoreHastedJavelin(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 760 - target.health + target.size * 20;
	const javelinDamage = getJavelinDamage(activeCreature);

	if (target.health <= javelinDamage) {
		score += 1400;
	}

	if (target.health / target.stats.health < 0.45) {
		score += 180;
	}

	if (activeCreature.remainingMove < activeCreature.stats.movement) {
		score += 220;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(
			activeCreature,
			target,
			ABILITY.HASTED_JAVELIN,
			controller,
		) ?? 0;
	score +=
		targetStrategy?.getCounterTargetingModifier?.(
			activeCreature,
			target,
			ABILITY.HASTED_JAVELIN,
			controller,
		) ?? 0;

	return score;
}

function scorePoisonousVine(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	const upgraded = activeCreature.abilities[ABILITY.POISONOUS_VINE]?.isUpgraded?.() ?? false;
	const alliedPressure = target
		.adjacentHexes(1)
		.filter(
			(adjacentHex) =>
				adjacentHex.creature instanceof Creature &&
				adjacentHex.creature !== activeCreature &&
				isTeam(activeCreature, adjacentHex.creature, Team.Ally),
		).length;
	const targetLevel = typeof target.level === 'number' ? target.level : 1;

	let score = 500 + targetLevel * 80 + target.size * 45;
	score += alliedPressure * 210;

	if (upgraded) {
		score += 120;
	}

	if (target.health <= POISONOUS_VINE_DAMAGE) {
		score += 140;
	}

	if (target.health / target.stats.health < 0.5) {
		score += 90;
	}

	score +=
		(unitStrategies[target.type as string]?.getCounterTargetingModifier?.(
			activeCreature,
			target,
			ABILITY.POISONOUS_VINE,
			controller,
		) ?? 0) / 2;

	return score;
}

function scoreChainLightning(
	hex: Hex,
	activeCreature: Creature,
	controller: BotController,
): number {
	const target = hex.creature;
	if (!(target instanceof Creature)) {
		return Number.NEGATIVE_INFINITY;
	}

	const upgraded = activeCreature.abilities[ABILITY.CHAIN_LIGHTNING]?.isUpgraded?.() ?? false;
	const { enemyCount, allyCount } = countClusterTargets(hex, activeCreature);

	if (isTeam(activeCreature, target, Team.Ally)) {
		if (!upgraded) {
			return Number.NEGATIVE_INFINITY;
		}

		let score = enemyCount * 300 - Math.max(0, allyCount - 1) * 180;
		const healthRatio = target.health / target.stats.health;
		if (healthRatio < 0.35) {
			score -= 360;
		}

		if (target === activeCreature) {
			score -= 140;
		}

		return score;
	}

	if (!isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 680 - target.health + target.size * 18;
	score += enemyCount * 220;
	score -= upgraded ? allyCount * 60 : allyCount * 260;

	if (target.health <= CHAIN_LIGHTNING_DAMAGE) {
		score += 950;
	}

	if (enemyCount >= 2) {
		score += 260;
	}

	if (enemyCount >= 3) {
		score += 200;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(
			activeCreature,
			target,
			ABILITY.CHAIN_LIGHTNING,
			controller,
		) ?? 0;
	score +=
		targetStrategy?.getCounterTargetingModifier?.(
			activeCreature,
			target,
			ABILITY.CHAIN_LIGHTNING,
			controller,
		) ?? 0;

	return score;
}

const ImpalerStrategy: UnitBotStrategy = {
	isRetreating(creature, _controller) {
		const healthRatio = creature.health / creature.stats.health;
		const energyRatio = creature.energy / creature.stats.energy;
		return healthRatio < RETREAT_HEALTH_RATIO || energyRatio < RETREAT_ENERGY_RATIO;
	},

	getPreferredX(creature, controller) {
		const gridRow = controller.game.grid.hexes[0];
		const boardWidth = gridRow ? gridRow.length - 1 : 15;
		return creature.player.flipped ? boardWidth * 0.38 : boardWidth * 0.62;
	},

	scoreMoveHex(hex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature || controller.isRetreating(activeCreature)) {
			return undefined;
		}

		let score = 0;
		const nearestEnemy = controller.closestDistanceToEnemy(hex);
		if (nearestEnemy === 2) {
			score += 220;
		} else if (nearestEnemy === 3) {
			score += 170;
		} else if (nearestEnemy === 1) {
			score += 30;
		} else {
			score -= Math.min(240, Math.abs(nearestEnemy - 2) * 70);
		}

		const adjacentEnemies = countAdjacentUnits(hex, activeCreature, Team.Enemy);
		score -= adjacentEnemies * 120;
		score += countNearbyEnemies(hex, activeCreature, controller, 3) * 30;

		const preferredX = controller.getPreferredX(activeCreature);
		score -= Math.abs(hex.x - preferredX) * 8;

		if (hex.trap) {
			score -= 220;
		}

		return score;
	},

	scoreAbilityHex(hex, abilityIndex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) {
			return undefined;
		}

		if (abilityIndex === ABILITY.HASTED_JAVELIN) {
			return scoreHastedJavelin(hex, activeCreature, controller);
		}

		if (abilityIndex === ABILITY.POISONOUS_VINE) {
			return scorePoisonousVine(hex, activeCreature, controller);
		}

		if (abilityIndex === ABILITY.CHAIN_LIGHTNING) {
			return scoreChainLightning(hex, activeCreature, controller);
		}

		return undefined;
	},

	getAbilityPriority(creature, controller) {
		if (hasKillableJavelinTarget(creature, controller)) {
			return [ABILITY.HASTED_JAVELIN, ABILITY.CHAIN_LIGHTNING, ABILITY.POISONOUS_VINE];
		}

		if (hasHighValueChainTarget(creature, controller)) {
			return [ABILITY.CHAIN_LIGHTNING, ABILITY.HASTED_JAVELIN, ABILITY.POISONOUS_VINE];
		}

		if (hasHighValueVineTarget(creature, controller)) {
			return [ABILITY.POISONOUS_VINE, ABILITY.HASTED_JAVELIN, ABILITY.CHAIN_LIGHTNING];
		}

		return [ABILITY.HASTED_JAVELIN, ABILITY.CHAIN_LIGHTNING, ABILITY.POISONOUS_VINE];
	},

	getTargetingPenalty(attacker, target, _abilityIndex, _controller) {
		const healthRatio = target.health / target.stats.health;
		const energyRatio = target.energy / target.stats.energy;
		const isAdjacent = attacker
			.adjacentHexes(1)
			.some((adjacentHex) => adjacentHex.creature === target);

		let penalty = 0;
		if (isAdjacent && energyRatio >= 0.2 && healthRatio > 0.35) {
			penalty -= 100;
		}

		if (isAdjacent && energyRatio >= 0.2 && attacker.health <= getJavelinDamage(target)) {
			penalty -= 180;
		}

		const adjacentAllies = attacker
			.adjacentHexes(1)
			.filter(
				(adjacentHex) =>
					adjacentHex.creature instanceof Creature &&
					adjacentHex.creature !== target &&
					isTeam(attacker, adjacentHex.creature, Team.Ally),
			).length;
		if (energyRatio >= 0.3 && adjacentAllies > 0) {
			penalty -= adjacentAllies * 70;
		}

		return penalty;
	},

	getCounterTargetingModifier(_attacker, target, _abilityIndex, _controller) {
		const healthRatio = target.health / target.stats.health;
		const energyRatio = target.energy / target.stats.energy;
		let score = 0;

		if (healthRatio < 0.45) {
			score += Math.round((0.45 - healthRatio) * 650);
		}

		if (energyRatio < 0.3) {
			score += Math.round((0.3 - energyRatio) * 500);
		}

		if (healthRatio < 0.25) {
			score += 180;
		}

		if (energyRatio < 0.15) {
			score += 120;
		}

		if (healthRatio > 0.75 && energyRatio > 0.55) {
			score -= 80;
		}

		return score;
	},

	getProximityPenalty(mover, enemy, destination, _controller) {
		const healthRatio = enemy.health / enemy.stats.health;
		const energyRatio = enemy.energy / enemy.stats.energy;
		let penalty = 0;

		if (energyRatio >= 0.2) {
			penalty -= 70;
		}

		if (energyRatio >= 0.2 && mover.health <= getJavelinDamage(enemy)) {
			penalty -= 150;
		}

		const adjacentAllies = destination
			.adjacentHex(1)
			.filter(
				(adjacentHex) =>
					adjacentHex.creature instanceof Creature &&
					adjacentHex.creature !== enemy &&
					isTeam(mover, adjacentHex.creature, Team.Ally),
			).length;
		if (energyRatio >= 0.3) {
			penalty -= adjacentAllies * 55;
		}

		if (healthRatio < 0.35 || energyRatio < 0.2) {
			penalty += 60;
		}

		return penalty;
	},
};

export default ImpalerStrategy;
