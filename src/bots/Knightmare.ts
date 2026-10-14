import type BotController from '../bot';
import type { UnitBotStrategy } from '../bot';
import { unitStrategies } from '../bot';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import { Team, isTeam } from '../utility/team';

// Ability slot indices
const ABILITY = {
	FRIGID_TOWER: 0, // passive: stacks frost/defense buff when not moved; also offense if upgraded
	ICY_TALONS: 1, // melee slash with -1 frost debuff on target
	SUDDEN_UPPERCUT: 2, // melee uppercut, -10 defense debuff if upgraded, applies hinder
	ICICLE_SPEAR: 3, // directional ranged projectile, passes through multiple targets
} as const;

const ICY_TALONS_ESTIMATED_DAMAGE = 18;
const ICICLE_SPEAR_ESTIMATED_DAMAGE = 20;

/** Effect name of the Frigid Tower stack applied by the passive. */
const FRIGID_TOWER_EFFECT = 'Frostified';
/** Frigid Tower stops stacking at this many charges — holding then gains nothing. */
const FRIGID_TOWER_MAX_STACKS = 10;
/**
 * Worth of one forfeited Frigid Tower stack (+5 frost and defense, +5 offense
 * once upgraded). Sized just under the score of stepping next to a single enemy
 * so the Knightmare still commits to a fight it can reach, but does not drift
 * for free.
 */
const FRIGID_TOWER_STACK_VALUE = 80;

const ABILITY_MIN_SCORE: Partial<Record<number, number>> = {
	[ABILITY.ICY_TALONS]: 340,
	[ABILITY.SUDDEN_UPPERCUT]: 360,
	[ABILITY.ICICLE_SPEAR]: 380,
};

function scoreIcyTalons(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 620 - target.health + target.size * 12;

	if (target.health <= ICY_TALONS_ESTIMATED_DAMAGE) {
		score += 820;
	}

	if (target.delayed) {
		score += 130;
	}

	// Prefer smaller targets that will be more affected by size-based pierce bonus
	if (target.size < activeCreature.size) {
		score += 80;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(activeCreature, target, ABILITY.ICY_TALONS, controller) ??
		0;
	score +=
		targetStrategy?.getCounterTargetingModifier?.(
			activeCreature,
			target,
			ABILITY.ICY_TALONS,
			controller,
		) ?? 0;

	return score;
}

function scoreSuddenUppercut(
	hex: Hex,
	activeCreature: Creature,
	controller: BotController,
): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 650 - target.health + target.size * 14;

	if (target.delayed) {
		score += 160;
	}

	const healthRatio = target.health / target.stats.health;
	if (healthRatio < 0.5) {
		score += 130;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(
			activeCreature,
			target,
			ABILITY.SUDDEN_UPPERCUT,
			controller,
		) ?? 0;
	score +=
		targetStrategy?.getCounterTargetingModifier?.(
			activeCreature,
			target,
			ABILITY.SUDDEN_UPPERCUT,
			controller,
		) ?? 0;

	return score;
}

function scoreIcicleSpear(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 660 - target.health + target.size * 16;

	if (target.health <= ICICLE_SPEAR_ESTIMATED_DAMAGE) {
		score += 900;
	}

	if (target.delayed) {
		score += 140;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(
			activeCreature,
			target,
			ABILITY.ICICLE_SPEAR,
			controller,
		) ?? 0;
	score +=
		targetStrategy?.getCounterTargetingModifier?.(
			activeCreature,
			target,
			ABILITY.ICICLE_SPEAR,
			controller,
		) ?? 0;

	return score;
}

const KnightmareStrategy: UnitBotStrategy = {
	/**
	 * Frigid Tower rewards not moving — Knightmare prefers to hold position and
	 * stack defense/frost buffs while using ranged Icicle Spear.
	 */
	isRetreating(creature, _controller) {
		const healthRatio = creature.health / creature.stats.health;
		const energyRatio = creature.energy / creature.stats.energy;
		return healthRatio < 0.2 || energyRatio < 0.12;
	},

	getPreferredX(creature, controller) {
		const gridRow = controller.game.grid.hexes[0];
		const boardWidth = gridRow ? gridRow.length - 1 : 15;
		// Prefer mid-range to leverage Icicle Spear while staying in melee reach
		return creature.player.flipped ? boardWidth * 0.42 : boardWidth * 0.58;
	},

	/**
	 * Knightmare gains Frigid Tower stacks when it does NOT move. The move
	 * scoring makes it prefer positions where it can stay: adjacent to one enemy
	 * (for melee reach) while not being surrounded. `getHoldPositionScore`
	 * prices the stack the move would forfeit, so the generic bot compares those
	 * positions against staying put instead of always drifting.
	 *
	 * Trap exposure is applied by the generic scorer on top of this score.
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
			score += 90;
		});

		// Penalise being surrounded — Frigid Tower stacks are lost if health drops
		if (adjacentEnemyCount > 1) {
			score -= (adjacentEnemyCount - 1) * 180;
		}

		const preferredX = controller.getPreferredX(activeCreature);
		score -= Math.abs(hex.x - preferredX) * 8;

		return score;
	},

	/**
	 * Value of holding position for the Knightmare: one Frigid Tower stack
	 * (+5 frost and defense, plus offense once upgraded) is forfeited the turn
	 * it moves, up to 10 stacks. Once the passive is capped — or as aggression
	 * rises and breaks a stalemate — the bar shrinks and the Knightmare commits.
	 */
	getHoldPositionScore(creature, controller) {
		const stacks = creature.effects.filter((effect) => effect.name === FRIGID_TOWER_EFFECT).length;
		if (stacks >= FRIGID_TOWER_MAX_STACKS) {
			return 0;
		}

		const aggression = controller.getAggressionFactor(creature);
		return Math.round(FRIGID_TOWER_STACK_VALUE * Math.max(0.3, 1 - aggression / 15));
	},

	scoreAbilityHex(hex, abilityIndex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) return undefined;

		if (abilityIndex === ABILITY.ICY_TALONS) return scoreIcyTalons(hex, activeCreature, controller);
		if (abilityIndex === ABILITY.SUDDEN_UPPERCUT)
			return scoreSuddenUppercut(hex, activeCreature, controller);
		if (abilityIndex === ABILITY.ICICLE_SPEAR)
			return scoreIcicleSpear(hex, activeCreature, controller);

		return undefined;
	},

	getAbilityMinScore(_creature, abilityIndex, _controller) {
		return ABILITY_MIN_SCORE[abilityIndex];
	},

	/**
	 * Priority: Icicle Spear first (range and chain potential), then Sudden
	 * Uppercut for defense debuff, then Icy Talons for frost stacking.
	 */
	getAbilityPriority(_creature, _controller) {
		return [ABILITY.ICICLE_SPEAR, ABILITY.SUDDEN_UPPERCUT, ABILITY.ICY_TALONS];
	},

	getTargetingPenalty(_attacker, _target, _abilityIndex, _controller) {
		return 0;
	},

	getCounterTargetingModifier(_attacker, target, _abilityIndex, _controller) {
		let score = 25;
		const healthRatio = target.health / target.stats.health;
		if (healthRatio < 0.5) score += 75;
		if (healthRatio < 0.3) score += 90;
		return score;
	},

	getProximityPenalty(_mover, _enemy, _destination, _controller) {
		return 0;
	},
};

export default KnightmareStrategy;
