import type BotController from '../bot';
import type { UnitBotStrategy } from '../bot';
import { unitStrategies } from '../bot';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import { Team, isTeam } from '../utility/team';

// Ability slot indices
const ABILITY = {
	TENTACLE_BUSH: 0, // passive: at end of turn, Nutcase becomes immovable; melee attackers get rooted
	HAMMER_TIME: 1, // applies "Hammered" effect: target takes damage when they move
	WAR_HORN: 2, // inline charge with distance-based damage; pushes target if upgraded
	FISHING_HOOK: 3, // swaps position with inline target; deals damage
} as const;

const HAMMER_TIME_TRIGGER_DAMAGE = 10;
const FISHING_HOOK_ESTIMATED_DAMAGE = 18;

const ABILITY_MIN_SCORE: Partial<Record<number, number>> = {
	[ABILITY.HAMMER_TIME]: 320,
	[ABILITY.WAR_HORN]: 360,
	[ABILITY.FISHING_HOOK]: 340,
};

function scoreHammerTime(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 580 - target.health + target.size * 12;

	// Hammer Time is most useful on mobile enemies that will move often
	if (target.remainingMove > 2) {
		score += 120;
	}

	if (target.health <= HAMMER_TIME_TRIGGER_DAMAGE) {
		score += 600;
	}

	if (target.delayed) {
		score += 100;
	}

	// Already hammered targets — stacking is less useful, prefer fresh targets
	const alreadyHammered = target.findEffect('Hammered').length > 0;
	if (alreadyHammered) {
		score -= 200;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(
			activeCreature,
			target,
			ABILITY.HAMMER_TIME,
			controller,
		) ?? 0;
	score +=
		targetStrategy?.getCounterTargetingModifier?.(
			activeCreature,
			target,
			ABILITY.HAMMER_TIME,
			controller,
		) ?? 0;

	return score;
}

function scoreWarHorn(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 640 - target.health + target.size * 14;

	if (target.delayed) {
		score += 140;
	}

	const healthRatio = target.health / target.stats.health;
	if (healthRatio < 0.4) {
		score += 130;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(activeCreature, target, ABILITY.WAR_HORN, controller) ??
		0;
	score +=
		targetStrategy?.getCounterTargetingModifier?.(
			activeCreature,
			target,
			ABILITY.WAR_HORN,
			controller,
		) ?? 0;

	return score;
}

function scoreFishingHook(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 580 - target.health + target.size * 12;

	if (target.health <= FISHING_HOOK_ESTIMATED_DAMAGE) {
		score += 760;
	}

	if (target.delayed) {
		score += 110;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(
			activeCreature,
			target,
			ABILITY.FISHING_HOOK,
			controller,
		) ?? 0;
	score +=
		targetStrategy?.getCounterTargetingModifier?.(
			activeCreature,
			target,
			ABILITY.FISHING_HOOK,
			controller,
		) ?? 0;

	return score;
}

const NutcaseStrategy: UnitBotStrategy = {
	/**
	 * Tentacle Bush makes Nutcase immovable at end of turn — it prefers to
	 * stay in a central position where it can reach enemies with War Horn.
	 */
	isRetreating(creature, _controller) {
		const healthRatio = creature.health / creature.stats.health;
		const energyRatio = creature.energy / creature.stats.energy;
		return healthRatio < 0.2 || energyRatio < 0.12;
	},

	getPreferredX(creature, controller) {
		const gridRow = controller.game.grid.hexes[0];
		const boardWidth = gridRow ? gridRow.length - 1 : 15;
		// Mid-field: close enough for War Horn charges, but not overextended
		return creature.player.flipped ? boardWidth * 0.4 : boardWidth * 0.6;
	},

	/**
	 * Nutcase becomes immovable at end of turn (Tentacle Bush). It should plant
	 * itself in the most central useful position before that happens — reward
	 * being adjacent to 1–2 enemies, penalise being surrounded by more.
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

		// Tentacle Bush will root melee attackers but Nutcase still takes damage —
		// don't deliberately step into 3+ enemy range
		if (adjacentEnemyCount > 2) {
			score -= (adjacentEnemyCount - 2) * 200;
		}

		const preferredX = controller.getPreferredX(activeCreature);
		score -= Math.abs(hex.x - preferredX) * 8;
		if (hex.trap) score -= 240;

		return score;
	},

	scoreAbilityHex(hex, abilityIndex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) return undefined;

		if (abilityIndex === ABILITY.HAMMER_TIME)
			return scoreHammerTime(hex, activeCreature, controller);
		if (abilityIndex === ABILITY.WAR_HORN) return scoreWarHorn(hex, activeCreature, controller);
		if (abilityIndex === ABILITY.FISHING_HOOK)
			return scoreFishingHook(hex, activeCreature, controller);

		return undefined;
	},

	getAbilityMinScore(_creature, abilityIndex, _controller) {
		return ABILITY_MIN_SCORE[abilityIndex];
	},

	/**
	 * Priority: War Horn for ranged-ish inline charge, then Hammer Time to set
	 * up movement-triggered damage, then Fishing Hook as positional tool.
	 */
	getAbilityPriority(_creature, _controller) {
		return [ABILITY.WAR_HORN, ABILITY.HAMMER_TIME, ABILITY.FISHING_HOOK];
	},

	getTargetingPenalty(_attacker, _target, _abilityIndex, _controller) {
		// Tentacle Bush roots melee attackers — penalise close melee approach against Nutcase
		return -50;
	},

	getCounterTargetingModifier(_attacker, target, _abilityIndex, _controller) {
		let score = 20;
		const healthRatio = target.health / target.stats.health;
		if (healthRatio < 0.5) score += 80;
		if (healthRatio < 0.25) score += 100;
		return score;
	},

	/**
	 * Tentacle Bush roots melee attackers — approaching Nutcase in melee is risky.
	 */
	getProximityPenalty(mover, _enemy, _destination, _controller) {
		// Any creature that would be adjacent to Nutcase risks getting rooted
		const healthRatio = mover.health / mover.stats.health;
		return healthRatio < 0.5 ? -120 : -60;
	},
};

export default NutcaseStrategy;
