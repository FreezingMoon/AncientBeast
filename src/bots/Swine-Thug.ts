import type BotController from '../bot';
import type { UnitBotStrategy } from '../bot';
import { unitStrategies } from '../bot';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import { Team, isTeam } from '../utility/team';

// Ability slot indices
const ABILITY = {
	SPA_GOGGLES: 0,    // triggered passive: stat buff when moving inside a mud-bath trap
	BASEBALL_BATON: 1, // directional melee swing with knockback; sliding if upgraded and target over mud
	GROUND_BALL: 2,    // area throw; 6 pattern options hitting nearby enemies
	MUD_BATH: 3,       // places mud-bath trap on chosen hex (slows creatures passing through)
} as const;

const BASEBALL_BATON_ESTIMATED_DAMAGE = 20;
const GROUND_BALL_ESTIMATED_DAMAGE = 15;

const ABILITY_MIN_SCORE: Partial<Record<number, number>> = {
	[ABILITY.BASEBALL_BATON]: 360,
	[ABILITY.GROUND_BALL]: 300,
};

function scoreBaseballBaton(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 640 - target.health + target.size * 12;

	if (target.health <= BASEBALL_BATON_ESTIMATED_DAMAGE) {
		score += 850;
	}

	if (target.delayed) {
		score += 130;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score += targetStrategy?.getTargetingPenalty?.(activeCreature, target, ABILITY.BASEBALL_BATON, controller) ?? 0;
	score += targetStrategy?.getCounterTargetingModifier?.(activeCreature, target, ABILITY.BASEBALL_BATON, controller) ?? 0;

	return score;
}

function scoreGroundBall(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature)) return Number.NEGATIVE_INFINITY;

	const isEnemy = isTeam(activeCreature, target, Team.Enemy);
	const isAlly = isTeam(activeCreature, target, Team.Ally);

	if (!isEnemy && !isAlly) return Number.NEGATIVE_INFINITY;

	if (isAlly) return -500;

	let score = 570 - target.health + target.size * 10;

	if (target.health <= GROUND_BALL_ESTIMATED_DAMAGE) {
		score += 680;
	}

	if (target.delayed) {
		score += 100;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score += targetStrategy?.getTargetingPenalty?.(activeCreature, target, ABILITY.GROUND_BALL, controller) ?? 0;
	score += targetStrategy?.getCounterTargetingModifier?.(activeCreature, target, ABILITY.GROUND_BALL, controller) ?? 0;

	return score;
}

const SwineThugStrategy: UnitBotStrategy = {
	isRetreating(creature, _controller) {
		const healthRatio = creature.health / creature.stats.health;
		const energyRatio = creature.energy / creature.stats.energy;
		return healthRatio < 0.22 || energyRatio < 0.15;
	},

	getPreferredX(creature, controller) {
		const gridRow = controller.game.grid.hexes[0];
		const boardWidth = gridRow ? gridRow.length - 1 : 15;
		return creature.player.flipped ? boardWidth * 0.38 : boardWidth * 0.62;
	},

	scoreAbilityHex(hex, abilityIndex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) return undefined;

		if (abilityIndex === ABILITY.BASEBALL_BATON) return scoreBaseballBaton(hex, activeCreature, controller);
		if (abilityIndex === ABILITY.GROUND_BALL) return scoreGroundBall(hex, activeCreature, controller);

		// Mud Bath trap placement: let generic scoring handle hex selection
		return undefined;
	},

	getAbilityMinScore(_creature, abilityIndex, _controller) {
		return ABILITY_MIN_SCORE[abilityIndex];
	},

	/**
	 * Priority: Baton first for reliable single-target damage, then Ground Ball
	 * for area coverage, and Mud Bath only when no good attack target exists.
	 */
	getAbilityPriority(_creature, _controller) {
		return [ABILITY.BASEBALL_BATON, ABILITY.GROUND_BALL, ABILITY.MUD_BATH];
	},

	getTargetingPenalty(_attacker, _target, _abilityIndex, _controller) {
		return 0;
	},

	getCounterTargetingModifier(_attacker, target, _abilityIndex, _controller) {
		let score = 20;
		const healthRatio = target.health / target.stats.health;
		if (healthRatio < 0.5) score += 70;
		if (healthRatio < 0.25) score += 90;
		return score;
	},

	getProximityPenalty(_mover, _enemy, _destination, _controller) {
		return 0;
	},
};

export default SwineThugStrategy;
