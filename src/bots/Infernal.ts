import type BotController from '../bot';
import type { UnitBotStrategy } from '../bot';
import { unitStrategies } from '../bot';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import { Team, isTeam } from '../utility/team';

// Ability slot indices
const ABILITY = {
	BOILING_POINT: 0,  // passive: places scorched-ground traps behind self each turn
	PULVERIZING_HIT: 1, // melee, stacks burn debuff on target
	INTENSE_PRAYER: 2,  // area attack front/back, also places traps if upgraded
	MOLTEN_HURL: 3,    // directional charge into enemy with damage; chains if upgraded
} as const;

const PULVERIZING_HIT_ESTIMATED_DAMAGE = 18;
const INTENSE_PRAYER_ESTIMATED_DAMAGE = 22;

const ABILITY_MIN_SCORE: Partial<Record<number, number>> = {
	[ABILITY.PULVERIZING_HIT]: 340,
	[ABILITY.INTENSE_PRAYER]: 380,
	[ABILITY.MOLTEN_HURL]: 420,
};

function scorePulverizingHit(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 620 - target.health + target.size * 12;

	if (target.health <= PULVERIZING_HIT_ESTIMATED_DAMAGE) {
		score += 850;
	}

	if (target.delayed) {
		score += 130;
	}

	// Stacking burn effects are more valuable on already-debuffed targets
	const hasExistingDebuff = target.findEffect('Pulverizing Hit').length > 0;
	if (hasExistingDebuff) {
		score += 140;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score += targetStrategy?.getTargetingPenalty?.(activeCreature, target, ABILITY.PULVERIZING_HIT, controller) ?? 0;
	score += targetStrategy?.getCounterTargetingModifier?.(activeCreature, target, ABILITY.PULVERIZING_HIT, controller) ?? 0;

	return score;
}

function scoreIntensePrayer(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature)) return Number.NEGATIVE_INFINITY;

	const isEnemy = isTeam(activeCreature, target, Team.Enemy);
	const isAlly = isTeam(activeCreature, target, Team.Ally);

	if (!isEnemy && !isAlly) return Number.NEGATIVE_INFINITY;

	if (isAlly) return -700;

	let score = 600 - target.health + target.size * 15;

	if (target.health <= INTENSE_PRAYER_ESTIMATED_DAMAGE) {
		score += 800;
	}

	if (target.delayed) {
		score += 120;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score += targetStrategy?.getTargetingPenalty?.(activeCreature, target, ABILITY.INTENSE_PRAYER, controller) ?? 0;
	score += targetStrategy?.getCounterTargetingModifier?.(activeCreature, target, ABILITY.INTENSE_PRAYER, controller) ?? 0;

	return score;
}

function scoreMoltenHurl(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 700 - target.health + target.size * 18;

	if (target.delayed) {
		score += 150;
	}

	const healthRatio = target.health / target.stats.health;
	if (healthRatio < 0.4) {
		score += 200;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score += targetStrategy?.getTargetingPenalty?.(activeCreature, target, ABILITY.MOLTEN_HURL, controller) ?? 0;
	score += targetStrategy?.getCounterTargetingModifier?.(activeCreature, target, ABILITY.MOLTEN_HURL, controller) ?? 0;

	return score;
}

const InfernalStrategy: UnitBotStrategy = {
	isRetreating(creature, _controller) {
		const healthRatio = creature.health / creature.stats.health;
		const energyRatio = creature.energy / creature.stats.energy;
		return healthRatio < 0.2 || energyRatio < 0.12;
	},

	getPreferredX(creature, controller) {
		const gridRow = controller.game.grid.hexes[0];
		const boardWidth = gridRow ? gridRow.length - 1 : 15;
		// Infernal lays traps behind itself; stay close-mid to ensure traps are in play
		return creature.player.flipped ? boardWidth * 0.36 : boardWidth * 0.64;
	},

	/**
	 * Infernal wants to stay mid-close so its passive traps (placed behind it)
	 * land in the path of advancing enemies. Avoid over-extending.
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
			score += 110;
		});

		if (adjacentEnemyCount > 1) {
			score -= (adjacentEnemyCount - 1) * 100;
		}

		const preferredX = controller.getPreferredX(activeCreature);
		score -= Math.abs(hex.x - preferredX) * 8;
		if (hex.trap) score -= 240;

		return score;
	},

	scoreAbilityHex(hex, abilityIndex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) return undefined;

		if (abilityIndex === ABILITY.PULVERIZING_HIT) return scorePulverizingHit(hex, activeCreature, controller);
		if (abilityIndex === ABILITY.INTENSE_PRAYER) return scoreIntensePrayer(hex, activeCreature, controller);
		if (abilityIndex === ABILITY.MOLTEN_HURL) return scoreMoltenHurl(hex, activeCreature, controller);

		return undefined;
	},

	getAbilityMinScore(_creature, abilityIndex, _controller) {
		return ABILITY_MIN_SCORE[abilityIndex];
	},

	/**
	 * Priority: Molten Hurl for maximum reach/damage, then Intense Prayer for
	 * area coverage, then Pulverizing Hit for stacking debuffs.
	 */
	getAbilityPriority(_creature, _controller) {
		return [ABILITY.MOLTEN_HURL, ABILITY.INTENSE_PRAYER, ABILITY.PULVERIZING_HIT];
	},

	getTargetingPenalty(_attacker, _target, _abilityIndex, _controller) {
		return 0;
	},

	getCounterTargetingModifier(_attacker, target, _abilityIndex, _controller) {
		let score = 25;
		const healthRatio = target.health / target.stats.health;
		if (healthRatio < 0.5) score += 80;
		if (healthRatio < 0.25) score += 100;
		return score;
	},

	getProximityPenalty(_mover, enemy, _destination, _controller) {
		// Boiling Point traps behind Infernal punish creatures that pass behind it.
		const energyRatio = enemy.energy / enemy.stats.energy;
		return energyRatio > 0.5 ? -20 : 0;
	},
};

export default InfernalStrategy;
