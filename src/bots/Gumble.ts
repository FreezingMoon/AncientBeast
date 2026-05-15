import type BotController from '../bot';
import type { UnitBotStrategy } from '../bot';
import { unitStrategies } from '../bot';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import { Team, isTeam } from '../utility/team';

const ABILITY = {
	GOOEY_BODY: 0,
	GUMMY_MALLET: 1,
	PRETTY_RIBBON: 2,
	BOOM_BOX: 3,
} as const;

const RETREAT_HEALTH_RATIO = 0.32;
const RETREAT_ENERGY_RATIO = 0.2;
const MALLET_DAMAGE = 10;
const BOOM_BOX_DAMAGE = 20;
const DARK_PRIEST_TYPE = '--';
const DARK_PRIEST_HARD_FOCUS_HEALTH_RATIO = 0.45;

function isDarkPriest(creature: Creature): boolean {
	return creature.type === DARK_PRIEST_TYPE;
}

function hasBiggerAlliedFrontliner(creature: Creature, controller: BotController): boolean {
	return controller.game.creatures.some((candidate) => {
		if (
			!(candidate instanceof Creature) ||
			candidate === creature ||
			candidate.dead ||
			candidate.temp ||
			!isTeam(creature, candidate, Team.Ally)
		) {
			return false;
		}

		return candidate.level > creature.level || candidate.size > creature.size;
	});
}

function hasEnemyDarkPriest(creature: Creature, controller: BotController): boolean {
	return controller.game.creatures.some(
		(candidate) =>
			candidate instanceof Creature &&
			!candidate.dead &&
			!candidate.temp &&
			isTeam(creature, candidate, Team.Enemy) &&
			isDarkPriest(candidate),
	);
}

function hasHardFocusDarkPriestWindow(creature: Creature, controller: BotController): boolean {
	return controller.game.creatures.some(
		(candidate) =>
			candidate instanceof Creature &&
			!candidate.dead &&
			!candidate.temp &&
			isTeam(creature, candidate, Team.Enemy) &&
			isDarkPriest(candidate) &&
			candidate.health / candidate.stats.health <= DARK_PRIEST_HARD_FOCUS_HEALTH_RATIO,
	);
}

function getClosestEnemyDarkPriestDistance(
	hex: Hex,
	creature: Creature,
	controller: BotController,
): number {
	let closest = Number.POSITIVE_INFINITY;

	controller.game.creatures.forEach((candidate) => {
		if (
			!(candidate instanceof Creature) ||
			candidate.dead ||
			candidate.temp ||
			!isTeam(creature, candidate, Team.Enemy) ||
			!isDarkPriest(candidate)
		) {
			return;
		}

		const distance = Math.abs(hex.x - candidate.x) + Math.abs(hex.y - candidate.y);
		closest = Math.min(closest, distance);
	});

	return closest;
}

function isWounded(creature: Creature): boolean {
	return creature.health < creature.stats.health;
}

function isHealableTarget(source: Creature, target: Creature): boolean {
	return isTeam(source, target, Team.Ally) && isWounded(target);
}

function countLocalTargets(hex: Hex, source: Creature) {
	const localHexes = [hex, ...hex.adjacentHex(1)];
	let enemyCount = 0;
	let allyCount = 0;

	localHexes.forEach((localHex) => {
		const target = localHex.creature;
		if (!(target instanceof Creature)) {
			return;
		}

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

function scoreGummyMallet(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	const localTargets = countLocalTargets(hex, activeCreature);
	let score = localTargets.enemyCount * 180 - localTargets.allyCount * 240;

	if (target instanceof Creature) {
		if (!isTeam(activeCreature, target, Team.Enemy)) {
			return score - 250;
		}

		score += 520 - target.health + target.size * 20;
		if (target.health <= MALLET_DAMAGE) {
			score += 520;
		}
		if (target.health / target.stats.health < 0.45) {
			score += 180;
		}

		if (isDarkPriest(target)) {
			score += 320;
		}

		const targetStrategy = unitStrategies[target.type as string];
		score +=
			targetStrategy?.getTargetingPenalty?.(
				activeCreature,
				target,
				ABILITY.GUMMY_MALLET,
				controller,
			) ?? 0;
		score +=
			targetStrategy?.getCounterTargetingModifier?.(
				activeCreature,
				target,
				ABILITY.GUMMY_MALLET,
				controller,
			) ?? 0;
	}

	if (localTargets.enemyCount >= 2) {
		score += 260;
	}

	if (localTargets.allyCount > 0) {
		score -= 120 * localTargets.allyCount;
	}

	return score;
}

function scorePrettyRibbon(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature)) {
		return Number.NEGATIVE_INFINITY;
	}

	if (isHealableTarget(activeCreature, target)) {
		const missingHealth = target.stats.health - target.health;
		const supportMode = hasBiggerAlliedFrontliner(activeCreature, controller);
		let score = 360 + missingHealth * 10;

		if (target === activeCreature) {
			score += 180;
		}

		if (supportMode) {
			score += 140;
		}

		if (target.level > activeCreature.level || target.size > activeCreature.size) {
			score += 180;
		}

		if (target.health / target.stats.health < 0.4) {
			score += 220;
		}

		return score;
	}

	if (!isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	const upgraded = activeCreature.abilities[ABILITY.PRETTY_RIBBON]?.isUpgraded?.() ?? false;
	if (!upgraded) {
		return Number.NEGATIVE_INFINITY;
	}

	const healthRatio = target.health / target.stats.health;
	let score = 90;

	if (isDarkPriest(target)) {
		score += 240;
	}

	if (healthRatio < 0.7) {
		score += 100;
	}

	if (healthRatio < 0.4) {
		score += 120;
	}

	return score;
}

function scoreBoomBox(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 620 - target.health + target.size * 18;

	if (target.health <= BOOM_BOX_DAMAGE) {
		score += 1100;
	}

	if (target.health / target.stats.health < 0.45) {
		score += 180;
	}

	if (isDarkPriest(target)) {
		score += 760;
	}

	if (activeCreature.adjacentHexes(1).some((adjacentHex) => adjacentHex.creature === target)) {
		score += 140;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(activeCreature, target, ABILITY.BOOM_BOX, controller) ??
		0;
	score +=
		targetStrategy?.getCounterTargetingModifier?.(
			activeCreature,
			target,
			ABILITY.BOOM_BOX,
			controller,
		) ?? 0;

	const hasUpgradedGooeyBody =
		activeCreature.abilities[ABILITY.GOOEY_BODY]?.isUpgraded?.() ?? false;
	if (hasUpgradedGooeyBody && isDarkPriest(target)) {
		score += 180;
	}

	return score;
}

function hasWoundedRibbonTarget(creature: Creature): boolean {
	return creature.hexagons
		.concat(creature.adjacentHexes(2))
		.some((hex) => hex.creature instanceof Creature && isHealableTarget(creature, hex.creature));
}

function hasStrongMalletWindow(creature: Creature): boolean {
	const nearbyEnemies = creature
		.adjacentHexes(2)
		.filter(
			(hex) => hex.creature instanceof Creature && isTeam(creature, hex.creature, Team.Enemy),
		).length;
	const nearbyAllies = creature
		.adjacentHexes(2)
		.filter(
			(hex) => hex.creature instanceof Creature && isTeam(creature, hex.creature, Team.Ally),
		).length;

	return nearbyEnemies >= 2 && nearbyAllies <= 1;
}

function hasBoomBoxTarget(creature: Creature): boolean {
	return creature
		.adjacentHexes(6)
		.some((hex) => hex.creature instanceof Creature && isTeam(creature, hex.creature, Team.Enemy));
}

const GumbleStrategy: UnitBotStrategy = {
	isRetreating(creature, controller) {
		const healthRatio = creature.health / creature.stats.health;
		const energyRatio = creature.energy / creature.stats.energy;
		const hasUpgradedGooeyBody = creature.abilities[ABILITY.GOOEY_BODY]?.isUpgraded?.() ?? false;

		if (hasUpgradedGooeyBody && hasEnemyDarkPriest(creature, controller) && healthRatio > 0.2) {
			return false;
		}

		return healthRatio < RETREAT_HEALTH_RATIO || energyRatio < RETREAT_ENERGY_RATIO;
	},

	scoreMoveHex(hex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) {
			return undefined;
		}

		const hasUpgradedGooeyBody =
			activeCreature.abilities[ABILITY.GOOEY_BODY]?.isUpgraded?.() ?? false;
		const supportMode = hasBiggerAlliedFrontliner(activeCreature, controller);
		const adjacentEnemies = hex
			.adjacentHex(1)
			.filter(
				(adjacentHex) =>
					adjacentHex.creature instanceof Creature &&
					isTeam(activeCreature, adjacentHex.creature, Team.Enemy),
			)
			.map((adjacentHex) => adjacentHex.creature as Creature);

		let score = 340 - controller.closestDistanceToEnemy(hex) * 78;
		score += adjacentEnemies.length * 130;

		if (adjacentEnemies.some((enemy) => isDarkPriest(enemy))) {
			score += 680;
		}

		const darkPriestDistance = getClosestEnemyDarkPriestDistance(hex, activeCreature, controller);
		if (Number.isFinite(darkPriestDistance)) {
			score += Math.max(0, 420 - darkPriestDistance * 95);
		}

		if (hasUpgradedGooeyBody) {
			if (adjacentEnemies.length >= 2) {
				score += 320;
			}
			if (adjacentEnemies.length >= 3) {
				score += 220;
			}
		}

		if (supportMode && hasWoundedRibbonTarget(activeCreature)) {
			const adjacentAllies = hex
				.adjacentHex(1)
				.filter(
					(adjacentHex) =>
						adjacentHex.creature instanceof Creature &&
						isTeam(activeCreature, adjacentHex.creature, Team.Ally),
				).length;
			score += adjacentAllies * 170;
			score -= adjacentEnemies.length * 40;
		}

		if (hex.trap) {
			score -= hasUpgradedGooeyBody ? 110 : 300;
		}

		return score;
	},

	scoreAbilityHex(hex, abilityIndex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) {
			return undefined;
		}

		if (abilityIndex === ABILITY.GUMMY_MALLET) {
			return scoreGummyMallet(hex, activeCreature, controller);
		}

		if (abilityIndex === ABILITY.PRETTY_RIBBON) {
			return scorePrettyRibbon(hex, activeCreature, controller);
		}

		if (abilityIndex === ABILITY.BOOM_BOX) {
			return scoreBoomBox(hex, activeCreature, controller);
		}

		return undefined;
	},

	getAbilityPriority(creature, controller) {
		const supportMode = hasBiggerAlliedFrontliner(creature, controller);
		const darkPriestPressure = hasEnemyDarkPriest(creature, controller);
		const darkPriestHardFocus = hasHardFocusDarkPriestWindow(creature, controller);

		if (controller.isRetreating(creature)) {
			if (hasWoundedRibbonTarget(creature)) {
				return [ABILITY.PRETTY_RIBBON, ABILITY.BOOM_BOX, ABILITY.GUMMY_MALLET];
			}

			return [ABILITY.BOOM_BOX, ABILITY.PRETTY_RIBBON, ABILITY.GUMMY_MALLET];
		}

		if (supportMode && hasWoundedRibbonTarget(creature)) {
			if (darkPriestHardFocus) {
				return [ABILITY.BOOM_BOX, ABILITY.GUMMY_MALLET, ABILITY.PRETTY_RIBBON];
			}

			return [ABILITY.PRETTY_RIBBON, ABILITY.BOOM_BOX, ABILITY.GUMMY_MALLET];
		}

		if (darkPriestPressure) {
			return [ABILITY.BOOM_BOX, ABILITY.GUMMY_MALLET, ABILITY.PRETTY_RIBBON];
		}

		if (hasWoundedRibbonTarget(creature)) {
			return [ABILITY.PRETTY_RIBBON, ABILITY.GUMMY_MALLET, ABILITY.BOOM_BOX];
		}

		if (hasStrongMalletWindow(creature)) {
			return [ABILITY.GUMMY_MALLET, ABILITY.BOOM_BOX, ABILITY.PRETTY_RIBBON];
		}

		if (hasBoomBoxTarget(creature)) {
			return [ABILITY.BOOM_BOX, ABILITY.GUMMY_MALLET, ABILITY.PRETTY_RIBBON];
		}

		return [ABILITY.BOOM_BOX, ABILITY.PRETTY_RIBBON, ABILITY.GUMMY_MALLET];
	},

	getTargetingPenalty() {
		return 0;
	},

	getCounterTargetingModifier(_attacker, target) {
		const healthRatio = target.health / target.stats.health;
		let score = 40;

		if (target.abilities[ABILITY.GOOEY_BODY]?.isUpgraded?.()) {
			score += 110;
		}

		if (healthRatio < 0.5) {
			score += 160;
		}

		if (healthRatio < 0.25) {
			score += 220;
		}

		if (healthRatio > 0.8) {
			score -= 70;
		}

		return score;
	},

	getProximityPenalty(_mover, enemy) {
		const healthRatio = enemy.health / enemy.stats.health;
		let score = -100;

		if (enemy.abilities[ABILITY.GOOEY_BODY]?.isUpgraded?.()) {
			score += 60;
		}

		if (healthRatio < 0.5) {
			score += 180;
		}

		if (healthRatio < 0.25) {
			score += 140;
		}

		if (healthRatio > 0.75) {
			score -= 120;
		}

		return score;
	},
};

export default GumbleStrategy;
