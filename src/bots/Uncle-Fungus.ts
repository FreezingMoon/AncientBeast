import type BotController from '../bot';
import type { UnitBotStrategy } from '../bot';
import { unitStrategies } from '../bot';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import { Team, isTeam } from '../utility/team';

// Ability slot indices
const ABILITY = {
	TOXIC_SPORES: 0, // triggered passive: counter-poisons on being hit (or attacking if upgraded)
	SUPPER_CHOMP: 1, // melee bite, heals/generates regrowth when upgraded
	FROGGER_JUMP: 2, // movement ability: inline jump forward or backward
	SABRE_KICK: 3, // melee kick, knockback if upgraded
} as const;

const CHOMP_ESTIMATED_DAMAGE = 20;
const KICK_ESTIMATED_DAMAGE = 15;

const ABILITY_MIN_SCORE: Partial<Record<number, number>> = {
	[ABILITY.SUPPER_CHOMP]: 350,
	[ABILITY.SABRE_KICK]: 300,
};

function scoreSupperChomp(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 640 - target.health + target.size * 12;

	if (target.health <= CHOMP_ESTIMATED_DAMAGE) {
		score += 850;
	}

	if (target.delayed) {
		score += 130;
	}

	// Chomp heals self — prioritise when low health
	const selfHealthRatio = activeCreature.health / activeCreature.stats.health;
	if (selfHealthRatio < 0.5) {
		score += 160;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(
			activeCreature,
			target,
			ABILITY.SUPPER_CHOMP,
			controller,
		) ?? 0;
	score +=
		targetStrategy?.getCounterTargetingModifier?.(
			activeCreature,
			target,
			ABILITY.SUPPER_CHOMP,
			controller,
		) ?? 0;

	return score;
}

function scoreSabreKick(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 580 - target.health + target.size * 10;

	if (target.health <= KICK_ESTIMATED_DAMAGE) {
		score += 750;
	}

	if (target.delayed) {
		score += 110;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(activeCreature, target, ABILITY.SABRE_KICK, controller) ??
		0;
	score +=
		targetStrategy?.getCounterTargetingModifier?.(
			activeCreature,
			target,
			ABILITY.SABRE_KICK,
			controller,
		) ?? 0;

	return score;
}

const UncleFungusStrategy: UnitBotStrategy = {
	isRetreating(creature, _controller) {
		const healthRatio = creature.health / creature.stats.health;
		const energyRatio = creature.energy / creature.stats.energy;
		return healthRatio < 0.2 || energyRatio < 0.15;
	},

	getPreferredX(creature, controller) {
		const gridRow = controller.game.grid.hexes[0];
		const boardWidth = gridRow ? gridRow.length - 1 : 15;
		// Size-2 melee fighter prefers mid-close position
		return creature.player.flipped ? boardWidth * 0.35 : boardWidth * 0.65;
	},

	/**
	 * Uncle Fungus is a size-2 brawler — moves to be adjacent to one enemy
	 * but avoids being flanked by too many at once.
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
			score += 100;
		});

		// Being flanked by more than 1 enemy is risky for a size-2 creature
		if (adjacentEnemyCount > 1) {
			score -= (adjacentEnemyCount - 1) * 150;
		}

		const preferredX = controller.getPreferredX(activeCreature);
		score -= Math.abs(hex.x - preferredX) * 9;
		if (hex.trap) score -= 240;

		return score;
	},

	scoreAbilityHex(hex, abilityIndex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) return undefined;

		if (abilityIndex === ABILITY.SUPPER_CHOMP)
			return scoreSupperChomp(hex, activeCreature, controller);
		if (abilityIndex === ABILITY.SABRE_KICK) return scoreSabreKick(hex, activeCreature, controller);

		// Frogger Jump is a movement ability — let the generic bot handle hex selection
		return undefined;
	},

	getAbilityMinScore(_creature, abilityIndex, _controller) {
		return ABILITY_MIN_SCORE[abilityIndex];
	},

	/**
	 * Priority: Chomp first (heals self and deals damage), then Kick to push
	 * enemies out of favourable positions.
	 */
	getAbilityPriority(_creature, _controller) {
		return [ABILITY.SUPPER_CHOMP, ABILITY.SABRE_KICK, ABILITY.FROGGER_JUMP];
	},

	getTargetingPenalty(_attacker, _target, _abilityIndex, _controller) {
		// Toxic Spores passive punishes melee attackers — slight discouragement.
		return -30;
	},

	getCounterTargetingModifier(_attacker, target, _abilityIndex, _controller) {
		let score = 20;
		const healthRatio = target.health / target.stats.health;
		if (healthRatio < 0.5) score += 70;
		if (healthRatio < 0.25) score += 90;
		return score;
	},

	getProximityPenalty(mover, _enemy, _destination, _controller) {
		// Toxic Spores counters melee attackers; slightly penalise close approach.
		const healthRatio = mover.health / mover.stats.health;
		return healthRatio < 0.45 ? -80 : -25;
	},
};

export default UncleFungusStrategy;
