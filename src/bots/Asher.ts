import type BotController from '../bot';
import type { UnitBotStrategy } from '../bot';
import { unitStrategies } from '../bot';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import { getPointFacade } from '../utility/pointfacade';
import { Team, isTeam } from '../utility/team';

const ABILITY = {
	HEAT_HAZE: 0,
	GLOWING_EYE: 1,
	COVERT_STRIKE: 2,
	CRASHING_GLOBE: 3,
} as const;

const ABILITY_DAMAGE = {
	[ABILITY.GLOWING_EYE]: 15,
	[ABILITY.COVERT_STRIKE]: 21,
	[ABILITY.CRASHING_GLOBE]: 30,
} as const;

const ACRYLIC_WALL_TYPE = 'O0';
const ACRYLIC_WALL_TARGET_PENALTY = 500;

function isAcrylicWall(target: Creature): boolean {
	return target.type === ACRYLIC_WALL_TYPE;
}

function hasMovementPunishingEffect(target: Creature): boolean {
	const effects = new Set(target.effects ?? []);
	target.hexagons.forEach((hex) => {
		getPointFacade()
			.getTrapsAt(hex)
			.forEach((trap) => trap.effects.forEach((effect) => effects.add(effect)));
	});

	return [...effects].some((effect) => effect.trigger.includes('onStepOut') && !effect.isDeleted);
}

function cannotMoveBeforeGlobeResolves(target: Creature): boolean {
	return (
		target.stats.moveable === false ||
		target.isFrozen() ||
		target.isDizzy() ||
		target.noActionPossible
	);
}

function scoreAttack(
	hex: Hex,
	activeCreature: Creature,
	abilityIndex: keyof typeof ABILITY_DAMAGE,
	controller: BotController,
): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}
	const acrylicWall = isAcrylicWall(target);

	const damage = ABILITY_DAMAGE[abilityIndex];
	let score = 500 - target.health + target.size * 15;
	if (target.health <= damage) {
		score += 700;
	} else if (target.health < target.stats.health * 0.35) {
		score += 120;
	}

	if (abilityIndex === ABILITY.CRASHING_GLOBE) {
		score -= 140;
		if (acrylicWall) {
			// Walls are stationary by design, so immobility alone should not bait
			// a delayed Globe. Still allow a high-value shot, especially a kill.
			score -= ACRYLIC_WALL_TARGET_PENALTY;
		} else if (cannotMoveBeforeGlobeResolves(target)) {
			score += 300;
		}
		if (!acrylicWall && hasMovementPunishingEffect(target)) {
			score += 300;
		}
	}

	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(activeCreature, target, abilityIndex, controller) ?? 0;
	score +=
		targetStrategy?.getCounterTargetingModifier?.(
			activeCreature,
			target,
			abilityIndex,
			controller,
		) ?? 0;

	return score;
}

const AsherStrategy: UnitBotStrategy = {
	isRetreating(creature) {
		return (
			creature.health / creature.stats.health < 0.25 ||
			creature.energy / creature.stats.energy < 0.15
		);
	},

	scoreAbilityHex(hex, abilityIndex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) {
			return undefined;
		}

		if (
			abilityIndex === ABILITY.GLOWING_EYE ||
			abilityIndex === ABILITY.COVERT_STRIKE ||
			abilityIndex === ABILITY.CRASHING_GLOBE
		) {
			return scoreAttack(hex, activeCreature, abilityIndex, controller);
		}

		return undefined;
	},

	getAbilityMinScore(_creature, abilityIndex) {
		if (abilityIndex === ABILITY.CRASHING_GLOBE) {
			return 350;
		}
		if (abilityIndex === ABILITY.GLOWING_EYE || abilityIndex === ABILITY.COVERT_STRIKE) {
			return 300;
		}
		return undefined;
	},

	getAbilityPriority(_creature, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) {
			return [ABILITY.COVERT_STRIKE, ABILITY.GLOWING_EYE, ABILITY.CRASHING_GLOBE];
		}

		const enemies = controller.game.creatures.filter(
			(creature) => creature instanceof Creature && isTeam(activeCreature, creature, Team.Enemy),
		);
		const hasNearbyEnemy = enemies.some(
			(enemy) => Math.abs(enemy.x - activeCreature.x) + Math.abs(enemy.y - activeCreature.y) <= 5,
		);

		return hasNearbyEnemy
			? [ABILITY.COVERT_STRIKE, ABILITY.GLOWING_EYE, ABILITY.CRASHING_GLOBE]
			: [ABILITY.CRASHING_GLOBE, ABILITY.COVERT_STRIKE, ABILITY.GLOWING_EYE];
	},
};

export default AsherStrategy;
