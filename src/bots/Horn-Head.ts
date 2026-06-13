import type BotController from '../bot';
import type { UnitBotStrategy } from '../bot';
import { unitStrategies } from '../bot';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import { Team, isTeam } from '../utility/team';

// Ability slot indices
const ABILITY = {
	LIFE_SUPPORT: 0, // passive: converts incoming damage to endurance gain; intercepts lethal if upgraded
	KNUCKLE_NIB: 1, // melee punch, -2 defense debuff, knockback if upgraded
	MEAT_SICKLE: 2, // ranged drag attack, pulls target and restricts their movement
	TWIN_SLASH: 3, // area lane attack, hits all enemies in chosen lane twice
} as const;

const KNUCKLE_NIB_ESTIMATED_DAMAGE = 22;
const TWIN_SLASH_ESTIMATED_DAMAGE = 18;

const ABILITY_MIN_SCORE: Partial<Record<number, number>> = {
	[ABILITY.KNUCKLE_NIB]: 360,
	[ABILITY.MEAT_SICKLE]: 400,
	[ABILITY.TWIN_SLASH]: 380,
};

function scoreKnuckleNib(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 640 - target.health + target.size * 14;

	if (target.health <= KNUCKLE_NIB_ESTIMATED_DAMAGE) {
		score += 880;
	}

	if (target.delayed) {
		score += 130;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(
			activeCreature,
			target,
			ABILITY.KNUCKLE_NIB,
			controller,
		) ?? 0;
	score +=
		targetStrategy?.getCounterTargetingModifier?.(
			activeCreature,
			target,
			ABILITY.KNUCKLE_NIB,
			controller,
		) ?? 0;

	return score;
}

function scoreMeatSickle(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 680 - target.health + target.size * 16;

	if (target.delayed) {
		score += 140;
	}

	// Pulling high-health targets is especially useful to disrupt their position
	const healthRatio = target.health / target.stats.health;
	if (healthRatio > 0.7) {
		score += 90;
	}

	if (target.health <= 15) {
		score += 600;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(
			activeCreature,
			target,
			ABILITY.MEAT_SICKLE,
			controller,
		) ?? 0;
	score +=
		targetStrategy?.getCounterTargetingModifier?.(
			activeCreature,
			target,
			ABILITY.MEAT_SICKLE,
			controller,
		) ?? 0;

	return score;
}

function scoreTwinSlash(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature)) return Number.NEGATIVE_INFINITY;

	const isEnemy = isTeam(activeCreature, target, Team.Enemy);
	const isAlly = isTeam(activeCreature, target, Team.Ally);

	if (!isEnemy && !isAlly) return Number.NEGATIVE_INFINITY;

	if (isAlly) return -600;

	let score = 600 - target.health + target.size * 14;

	if (target.health <= TWIN_SLASH_ESTIMATED_DAMAGE) {
		score += 750;
	}

	if (target.delayed) {
		score += 120;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(activeCreature, target, ABILITY.TWIN_SLASH, controller) ??
		0;
	score +=
		targetStrategy?.getCounterTargetingModifier?.(
			activeCreature,
			target,
			ABILITY.TWIN_SLASH,
			controller,
		) ?? 0;

	return score;
}

const HornHeadStrategy: UnitBotStrategy = {
	/**
	 * Life Support passive converts damage to endurance, making Horn Head more
	 * durable than health ratio suggests. Retreat threshold is lower.
	 */
	isRetreating(creature, _controller) {
		const healthRatio = creature.health / creature.stats.health;
		const energyRatio = creature.energy / creature.stats.energy;
		return healthRatio < 0.15 || energyRatio < 0.12;
	},

	getPreferredX(creature, controller) {
		const gridRow = controller.game.grid.hexes[0];
		const boardWidth = gridRow ? gridRow.length - 1 : 15;
		// Size-2 brawler; stay in close-to-mid range for Meat Sickle reach
		return creature.player.flipped ? boardWidth * 0.38 : boardWidth * 0.62;
	},

	/**
	 * Horn Head is a size-2 tank — prefers 1–2 hex distance for Meat Sickle
	 * drag range, avoids being surrounded given its large footprint.
	 */
	scoreMoveHex(hex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature || controller.isRetreating(activeCreature)) return undefined;

		let score = 0;
		let adjacentEnemyCount = 0;
		hex.adjacentHex(1).forEach((adj) => {
			if (!(adj.creature instanceof Creature)) return;
			if (!isTeam(activeCreature, adj.creature, Team.Enemy)) return;
			adjacentEnemyCount += 1;
			score += 115;
		});

		// Life Support converts damage to endurance — being hit isn't as scary,
		// but being surrounded by 3+ enemies still overwhelming for a size-2 unit.
		if (adjacentEnemyCount > 2) {
			score -= (adjacentEnemyCount - 2) * 140;
		}

		const preferredX = controller.getPreferredX(activeCreature);
		score -= Math.abs(hex.x - preferredX) * 8;

		const hasDeathIntercept = activeCreature.abilities.some(
			(ability) => typeof ability.interceptDeath === 'function',
		);
		if (hasDeathIntercept && hex.trap) {
			const enduranceRatio = activeCreature.endurance / Math.max(1, activeCreature.stats.endurance);
			if (enduranceRatio > 0.25) {
				score -= 80;
			} else if (enduranceRatio > 0) {
				score -= Math.round((1 - enduranceRatio / 0.25) * 220);
			} else {
				score -= 420;
			}
		} else if (hex.trap) {
			score -= 240;
		}

		return score;
	},

	scoreAbilityHex(hex, abilityIndex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) return undefined;

		if (abilityIndex === ABILITY.KNUCKLE_NIB)
			return scoreKnuckleNib(hex, activeCreature, controller);
		if (abilityIndex === ABILITY.MEAT_SICKLE)
			return scoreMeatSickle(hex, activeCreature, controller);
		if (abilityIndex === ABILITY.TWIN_SLASH) return scoreTwinSlash(hex, activeCreature, controller);

		return undefined;
	},

	getAbilityMinScore(_creature, abilityIndex, _controller) {
		return ABILITY_MIN_SCORE[abilityIndex];
	},

	/**
	 * Priority: Meat Sickle to disrupt enemy position, then Twin Slash for
	 * multi-target lane coverage, then Knuckle Nib for close melee.
	 */
	getAbilityPriority(_creature, _controller) {
		return [ABILITY.MEAT_SICKLE, ABILITY.TWIN_SLASH, ABILITY.KNUCKLE_NIB];
	},

	getTargetingPenalty(_attacker, _target, _abilityIndex, _controller) {
		// Life Support passive makes Horn Head tankier than it looks — slight target penalty.
		return -15;
	},

	getCounterTargetingModifier(_attacker, target, _abilityIndex, _controller) {
		let score = 20;
		const healthRatio = target.health / target.stats.health;
		if (healthRatio < 0.5) score += 80;
		if (healthRatio < 0.3) score += 100;
		return score;
	},

	getProximityPenalty(_mover, enemy, _destination, _controller) {
		// Horn Head has no direct retaliation; approach is generally safe.
		const energyRatio = enemy.energy / enemy.stats.energy;
		return energyRatio > 0.7 ? -15 : 0;
	},
};

export default HornHeadStrategy;
