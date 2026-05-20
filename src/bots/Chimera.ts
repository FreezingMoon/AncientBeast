import type BotController from '../bot';
import type { UnitBotStrategy } from '../bot';
import { unitStrategies } from '../bot';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import { Team, isTeam } from '../utility/team';

// Ability slot indices
const ABILITY = {
	CYCLIC_DUALITY: 0,  // passive: on fatigue, heals and recharges meditation/2 if upgraded
	TOOTH_FAIRY: 1,     // melee bite; second delayed hit if upgraded
	DISTURBING_SOUND: 2, // directional sonic chain: continues down line if target killed
	BATTERING_RAM: 3,   // adjacent ram + knockback chain; diminishing damage unless upgraded
} as const;

const TOOTH_FAIRY_ESTIMATED_DAMAGE = 22;
const DISTURBING_SOUND_ESTIMATED_DAMAGE = 18;
const BATTERING_RAM_ESTIMATED_DAMAGE = 20;

const ABILITY_MIN_SCORE: Partial<Record<number, number>> = {
	[ABILITY.TOOTH_FAIRY]: 360,
	[ABILITY.DISTURBING_SOUND]: 380,
	[ABILITY.BATTERING_RAM]: 380,
};

function scoreToothFairy(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 660 - target.health + target.size * 15;

	if (target.health <= TOOTH_FAIRY_ESTIMATED_DAMAGE) {
		score += 920;
	}

	if (target.delayed) {
		score += 140;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score += targetStrategy?.getTargetingPenalty?.(activeCreature, target, ABILITY.TOOTH_FAIRY, controller) ?? 0;
	score += targetStrategy?.getCounterTargetingModifier?.(activeCreature, target, ABILITY.TOOTH_FAIRY, controller) ?? 0;

	return score;
}

function scoreDisturbingSound(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 680 - target.health + target.size * 16;

	if (target.health <= DISTURBING_SOUND_ESTIMATED_DAMAGE) {
		// Chain potential when first target can be killed
		score += 950;
	}

	if (target.delayed) {
		score += 140;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score += targetStrategy?.getTargetingPenalty?.(activeCreature, target, ABILITY.DISTURBING_SOUND, controller) ?? 0;
	score += targetStrategy?.getCounterTargetingModifier?.(activeCreature, target, ABILITY.DISTURBING_SOUND, controller) ?? 0;

	return score;
}

function scoreBatteringRam(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 660 - target.health + target.size * 14;

	if (target.health <= BATTERING_RAM_ESTIMATED_DAMAGE) {
		score += 900;
	}

	if (target.delayed) {
		score += 140;
	}

	// Knockback is most disruptive to low-health or already-delayed enemies
	const healthRatio = target.health / target.stats.health;
	if (healthRatio < 0.4) {
		score += 120;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score += targetStrategy?.getTargetingPenalty?.(activeCreature, target, ABILITY.BATTERING_RAM, controller) ?? 0;
	score += targetStrategy?.getCounterTargetingModifier?.(activeCreature, target, ABILITY.BATTERING_RAM, controller) ?? 0;

	return score;
}

const ChimeraStrategy: UnitBotStrategy = {
	/**
	 * Chimera is a large size-3 creature; it retreats conservatively since
	 * Cyclic Duality gives a partial heal when fatigued.
	 */
	isRetreating(creature, _controller) {
		const healthRatio = creature.health / creature.stats.health;
		const energyRatio = creature.energy / creature.stats.energy;
		return healthRatio < 0.18 || energyRatio < 0.12;
	},

	getPreferredX(creature, controller) {
		const gridRow = controller.game.grid.hexes[0];
		const boardWidth = gridRow ? gridRow.length - 1 : 15;
		// Size-3 creature needs more space; stay slightly behind mid to avoid being flanked
		return creature.player.flipped ? boardWidth * 0.42 : boardWidth * 0.58;
	},

	scoreAbilityHex(hex, abilityIndex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) return undefined;

		if (abilityIndex === ABILITY.TOOTH_FAIRY) return scoreToothFairy(hex, activeCreature, controller);
		if (abilityIndex === ABILITY.DISTURBING_SOUND) return scoreDisturbingSound(hex, activeCreature, controller);
		if (abilityIndex === ABILITY.BATTERING_RAM) return scoreBatteringRam(hex, activeCreature, controller);

		return undefined;
	},

	getAbilityMinScore(_creature, abilityIndex, _controller) {
		return ABILITY_MIN_SCORE[abilityIndex];
	},

	/**
	 * Priority: Disturbing Sound for chain kill potential, then Tooth Fairy for
	 * reliable bite damage, then Battering Ram for knockback disruption.
	 */
	getAbilityPriority(_creature, _controller) {
		return [ABILITY.DISTURBING_SOUND, ABILITY.TOOTH_FAIRY, ABILITY.BATTERING_RAM];
	},

	getTargetingPenalty(_attacker, _target, _abilityIndex, _controller) {
		return 0;
	},

	getCounterTargetingModifier(_attacker, target, _abilityIndex, _controller) {
		let score = 30;
		const healthRatio = target.health / target.stats.health;
		if (healthRatio < 0.5) score += 90;
		if (healthRatio < 0.3) score += 110;
		return score;
	},

	getProximityPenalty(_mover, enemy, _destination, _controller) {
		// Large target — being adjacent to Chimera when it has Battering Ram available is dangerous
		const energyRatio = enemy.energy / enemy.stats.energy;
		return energyRatio > 0.5 ? -30 : 0;
	},
};

export default ChimeraStrategy;
