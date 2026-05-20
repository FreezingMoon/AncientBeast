import type BotController from '../bot';
import type { UnitBotStrategy } from '../bot';
import { unitStrategies } from '../bot';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import { Team, isTeam } from '../utility/team';

// Ability slot indices
const ABILITY = {
	WING_FEATHERS: 0,   // passive: hover movement; flying if upgraded
	SLICING_POUNCE: 1,  // melee pounce; permanent -1 offense debuff on target if upgraded
	ESCORT_SERVICE: 2,  // paired movement ability: move self and adjacent creature together
	DEADLY_TOXIN: 3,    // melee poison; ongoing damage per turn
} as const;

const SLICING_POUNCE_ESTIMATED_DAMAGE = 18;
const DEADLY_TOXIN_ESTIMATED_DAMAGE = 12;

const ABILITY_MIN_SCORE: Partial<Record<number, number>> = {
	[ABILITY.SLICING_POUNCE]: 340,
	[ABILITY.DEADLY_TOXIN]: 320,
};

function scoreSlicingPounce(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 620 - target.health + target.size * 12;

	if (target.health <= SLICING_POUNCE_ESTIMATED_DAMAGE) {
		score += 850;
	}

	if (target.delayed) {
		score += 130;
	}

	// Offense debuff stacking is more useful against high-damage threats
	const targetHealthRatio = target.health / target.stats.health;
	if (targetHealthRatio > 0.6) {
		score += 80; // prefer to debuff healthy, long-lasting enemies
	}

	const targetStrategy = unitStrategies[target.type as string];
	score += targetStrategy?.getTargetingPenalty?.(activeCreature, target, ABILITY.SLICING_POUNCE, controller) ?? 0;
	score += targetStrategy?.getCounterTargetingModifier?.(activeCreature, target, ABILITY.SLICING_POUNCE, controller) ?? 0;

	return score;
}

function scoreDeadlyToxin(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 580 - target.health + target.size * 12;

	if (target.health <= DEADLY_TOXIN_ESTIMATED_DAMAGE) {
		score += 700;
	}

	if (target.delayed) {
		score += 110;
	}

	// Poison is more valuable on high-health targets that will survive long enough to accumulate damage
	const targetHealthRatio = target.health / target.stats.health;
	if (targetHealthRatio > 0.5) {
		score += 100;
	}

	// Already poisoned — applying again refreshes but is less urgent
	const alreadyPoisoned = target.findEffect('Deadly Toxin').length > 0;
	if (alreadyPoisoned) {
		score -= 150;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score += targetStrategy?.getTargetingPenalty?.(activeCreature, target, ABILITY.DEADLY_TOXIN, controller) ?? 0;
	score += targetStrategy?.getCounterTargetingModifier?.(activeCreature, target, ABILITY.DEADLY_TOXIN, controller) ?? 0;

	return score;
}

const ScavengerStrategy: UnitBotStrategy = {
	/**
	 * Scavenger is a mobile skirmisher (hover/flying movement); retreats a bit
	 * earlier to avoid trading unfavourably in melee.
	 */
	isRetreating(creature, _controller) {
		const healthRatio = creature.health / creature.stats.health;
		const energyRatio = creature.energy / creature.stats.energy;
		return healthRatio < 0.22 || energyRatio < 0.15;
	},

	getPreferredX(creature, controller) {
		const gridRow = controller.game.grid.hexes[0];
		const boardWidth = gridRow ? gridRow.length - 1 : 15;
		// Mobile skirmisher — stay mid-close for pounce/toxin access
		return creature.player.flipped ? boardWidth * 0.38 : boardWidth * 0.62;
	},

	/**
	 * Scavenger is a mobile hover/fly unit — it wants to stay at 1–2 hexes
	 * from enemies (pounce + toxin range) without getting bogged down in melee.
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

		// Flying unit takes full damage in melee — avoid being surrounded
		if (adjacentEnemyCount > 1) {
			score -= (adjacentEnemyCount - 1) * 180;
		}

		const preferredX = controller.getPreferredX(activeCreature);
		score -= Math.abs(hex.x - preferredX) * 8;
		if (hex.trap) score -= 200; // hover/fly may bypass some traps

		return score;
	},

	scoreAbilityHex(hex, abilityIndex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) return undefined;

		if (abilityIndex === ABILITY.SLICING_POUNCE) return scoreSlicingPounce(hex, activeCreature, controller);
		if (abilityIndex === ABILITY.DEADLY_TOXIN) return scoreDeadlyToxin(hex, activeCreature, controller);

		// Escort Service is a movement utility — let generic bot handle hex selection
		return undefined;
	},

	getAbilityMinScore(_creature, abilityIndex, _controller) {
		return ABILITY_MIN_SCORE[abilityIndex];
	},

	/**
	 * Priority: Slicing Pounce if any enemy isn't yet debuffed (stack offense
	 * debuffs first), then Deadly Toxin for sustained damage.
	 */
	getAbilityPriority(creature, controller) {
		const anyEnemyNotDebuffed = controller.game.creatures.some(
			(c) =>
				c instanceof Creature &&
				!c.dead &&
				!c.temp &&
				isTeam(creature, c, Team.Enemy) &&
				c.findEffect('Slicing Pounce').length === 0,
		);

		if (anyEnemyNotDebuffed) {
			return [ABILITY.SLICING_POUNCE, ABILITY.DEADLY_TOXIN, ABILITY.ESCORT_SERVICE];
		}

		// All enemies already debuffed — poison for sustained damage
		return [ABILITY.DEADLY_TOXIN, ABILITY.SLICING_POUNCE, ABILITY.ESCORT_SERVICE];
	},

	getTargetingPenalty(_attacker, _target, _abilityIndex, _controller) {
		return 0;
	},

	getCounterTargetingModifier(_attacker, target, _abilityIndex, _controller) {
		let score = 20;
		const healthRatio = target.health / target.stats.health;
		if (healthRatio < 0.5) score += 80;
		if (healthRatio < 0.25) score += 100;
		return score;
	},

	getProximityPenalty(_mover, _enemy, _destination, _controller) {
		return 0;
	},
};

export default ScavengerStrategy;
