import type BotController from '../bot';
import type { UnitBotStrategy } from '../bot';
import { unitStrategies } from '../bot';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import { Team, isTeam } from '../utility/team';

// Ability slot indices
const ABILITY = {
	CARVING_NAILS: 1, // melee claw; damage compounds on repeat strikes vs the same foe, heals if upgraded
	FATAL_ATTRACTION: 2, // drags an in-range foe toward her at the start of their turn (not Dark Priests)
	TENDRIL_FEET: 3, // roots every adjacent foe and deals 20 crush; silences upgrades if upgraded
} as const;

const CARVING_NAILS_ESTIMATED_DAMAGE = 16; // two-stack average (8 + 16)
const TENDRIL_FEET_ESTIMATED_DAMAGE = 20;

const ABILITY_MIN_SCORE: Partial<Record<number, number>> = {
	[ABILITY.CARVING_NAILS]: 380,
	[ABILITY.FATAL_ATTRACTION]: 360,
	[ABILITY.TENDRIL_FEET]: 340,
};

function scoreCarvingNails(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 620 - target.health + target.size * 12;

	if (target.health <= CARVING_NAILS_ESTIMATED_DAMAGE) {
		score += 950; // execution
	}

	if (target.delayed) {
		score += 120;
	}

	// Focus fire: the Nth strike on the same unit multiplies damage, so keep
	// carving a foe that is already wounded instead of switching.
	const healthRatio = target.health / target.stats.health;
	if (healthRatio < 0.5) score += 130;
	if (healthRatio < 0.25) score += 130;

	// Upgraded claws restore 8 health per hit — more urgent when hurt.
	const nails = activeCreature.abilities[ABILITY.CARVING_NAILS];
	const selfHealthRatio = activeCreature.health / activeCreature.stats.health;
	if (nails?.isUpgraded?.() && selfHealthRatio < 0.6) {
		score += 100;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(
			activeCreature,
			target,
			ABILITY.CARVING_NAILS,
			controller,
		) ?? 0;
	score +=
		targetStrategy?.getCounterTargetingModifier?.(
			activeCreature,
			target,
			ABILITY.CARVING_NAILS,
			controller,
		) ?? 0;

	return score;
}

function scoreFatalAttraction(
	hex: Hex,
	activeCreature: Creature,
	controller: BotController,
): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	// She is already adjacent: pulling does nothing, leave it to the melee abilities.
	if (hex.adjacentHex(1).some((adj) => adj.creature === activeCreature)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 580 - target.health + target.size * 10;

	if (target.delayed) {
		score += 120;
	}

	// Wounded foes are worth dragging into claws range for a finishing Carving Nails.
	const healthRatio = target.health / target.stats.health;
	if (healthRatio < 0.5) score += 110;
	if (healthRatio < 0.25) score += 110;

	// Prefer foes too far to walk to (movement 1 can't chase them down).
	const creeperDistance =
		Math.abs(target.x - activeCreature.x) + Math.abs(target.y - activeCreature.y);
	if (creeperDistance > activeCreature.stats.movement) {
		score += 80;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(
			activeCreature,
			target,
			ABILITY.FATAL_ATTRACTION,
			controller,
		) ?? 0;
	score +=
		targetStrategy?.getCounterTargetingModifier?.(
			activeCreature,
			target,
			ABILITY.FATAL_ATTRACTION,
			controller,
		) ?? 0;

	return score;
}

function scoreTendrilFeet(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature)) return Number.NEGATIVE_INFINITY;

	const isEnemy = isTeam(activeCreature, target, Team.Enemy);
	if (!isEnemy) return Number.NEGATIVE_INFINITY;

	let score = 560 - target.health + target.size * 10;

	if (target.health <= TENDRIL_FEET_ESTIMATED_DAMAGE) {
		score += 850; // execution
	}

	if (target.delayed) {
		score += 120;
	}

	// Rooting is only worthwhile if the target can still move; a rooted target
	// can't walk away from her claws next turn.
	if (target.stats.moveable !== false) {
		score += 90;
	}

	// Count how many foes stand in her adjacent hexes — Tendril Feet hits all of them.
	let adjacentFoes = 0;
	activeCreature.adjacentHexes(1).forEach((adj) => {
		if (adj.creature instanceof Creature && isTeam(activeCreature, adj.creature, Team.Enemy)) {
			adjacentFoes += 1;
		}
	});
	score += adjacentFoes * 70;

	// Don't root a foe that is already immobilized.
	if (target.stats.moveable === false) {
		score -= 200;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(
			activeCreature,
			target,
			ABILITY.TENDRIL_FEET,
			controller,
		) ?? 0;
	score +=
		targetStrategy?.getCounterTargetingModifier?.(
			activeCreature,
			target,
			ABILITY.TENDRIL_FEET,
			controller,
		) ?? 0;

	return score;
}

const MissCreeperStrategy: UnitBotStrategy = {
	isRetreating(creature, _controller) {
		const healthRatio = creature.health / creature.stats.health;
		const energyRatio = creature.energy / creature.stats.energy;
		// Glass cannon melee: pull back early before she can't afford abilities.
		return healthRatio < 0.25 || energyRatio < 0.18;
	},

	getPreferredX(creature, controller) {
		const gridRow = controller.game.grid.hexes[0];
		const boardWidth = gridRow ? gridRow.length - 1 : 15;
		// Mid-forward: close enough to threaten with her 6-hex pull, not so far
		// that a slow unit can't contest the middle.
		return creature.player.flipped ? boardWidth * 0.45 : boardWidth * 0.55;
	},

	/**
	 * Miss Creeper has one movement point. She wants to stand adjacent to foes
	 * so Tendril Feet can root them all and Muscous Pillar can feed on their
	 * corpses; being surrounded is fine (even desirable as bait for allied
	 * area abilities).
	 */
	scoreMoveHex(hex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature || controller.isRetreating(activeCreature)) return undefined;

		let score = 0;
		hex.adjacentHex(1).forEach((adj) => {
			if (!(adj.creature instanceof Creature)) return;
			if (!isTeam(activeCreature, adj.creature, Team.Enemy)) return;
			score += 110;
		});

		// More adjacent foes = more Tendril Feet targets and more corpses to feed on.
		// No surround penalty: her passive and root make clumping safe.

		const preferredX = controller.getPreferredX(activeCreature);
		score -= Math.abs(hex.x - preferredX) * 8;
		if (hex.trap) score -= 240;

		return score;
	},

	scoreAbilityHex(hex, abilityIndex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) return undefined;

		if (abilityIndex === ABILITY.CARVING_NAILS) {
			return scoreCarvingNails(hex, activeCreature, controller);
		}
		if (abilityIndex === ABILITY.FATAL_ATTRACTION) {
			return scoreFatalAttraction(hex, activeCreature, controller);
		}
		if (abilityIndex === ABILITY.TENDRIL_FEET) {
			return scoreTendrilFeet(hex, activeCreature, controller);
		}

		return undefined;
	},

	getAbilityMinScore(_creature, abilityIndex, _controller) {
		return ABILITY_MIN_SCORE[abilityIndex];
	},

	/**
	 * Priority: Tendril Feet to lock foes in place, then Carving Nails to
	 * execute with compounding damage, then Fatal Attraction to bring a distant
	 * foe into claws range.
	 */
	getAbilityPriority(_creature, _controller) {
		return [ABILITY.TENDRIL_FEET, ABILITY.CARVING_NAILS, ABILITY.FATAL_ATTRACTION];
	},

	getTargetingPenalty(_attacker, _target, _abilityIndex, _controller) {
		// Muscous Pillar heals her when nearby units die — being focused on is
		// fine, even good as bait for allied area abilities.
		return 0;
	},

	getCounterTargetingModifier(_attacker, target, _abilityIndex, _controller) {
		let score = 20;
		const healthRatio = target.health / target.stats.health;
		if (healthRatio < 0.5) score += 70;
		if (healthRatio < 0.25) score += 90;
		return score;
	},

	getProximityPenalty(_mover, enemy, _destination, _controller) {
		// An enemy stepping adjacent is a Tendril Feet target and potential
		// Muscous Pillar meal — approaching her is welcome.
		const healthRatio = enemy.health / enemy.stats.health;
		return healthRatio < 0.4 ? 30 : 15;
	},
};

export default MissCreeperStrategy;
