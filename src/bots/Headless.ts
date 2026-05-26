import type BotController from '../bot';
import type { UnitBotStrategy } from '../bot';
import { unitStrategies } from '../bot';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import { Team, isTeam } from '../utility/team';

// Ability slot indices
const ABILITY = {
	LARVA_INFEST: 0, // triggered passive: -5 max endurance to enemy directly behind Headless each turn
	CARTILAGE_DAGGER: 1, // melee pierce; doubled damage if target is fatigued
	WHIP_MOVE: 2, // inline pull toward self; size-dependent mechanics
	BOOMERANG_TOOL: 3, // area two-pass attack (no retaliation on first pass); front or back choice
} as const;

const CARTILAGE_DAGGER_BASE_DAMAGE = 11;
const BOOMERANG_ESTIMATED_DAMAGE = 10; // per hit; hits twice

const ABILITY_MIN_SCORE: Partial<Record<number, number>> = {
	[ABILITY.CARTILAGE_DAGGER]: 340,
	[ABILITY.WHIP_MOVE]: 300,
	[ABILITY.BOOMERANG_TOOL]: 360,
};

function isCreatureFatigued(target: Creature): boolean {
	return target.endurance <= 0 || target.findEffect('Fatigued').length > 0;
}

function scoreCartilageDagger(
	hex: Hex,
	activeCreature: Creature,
	controller: BotController,
): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	const fatigued = isCreatureFatigued(target);
	// Damage doubles when target is fatigued
	const estimatedDamage = fatigued
		? CARTILAGE_DAGGER_BASE_DAMAGE * 2
		: CARTILAGE_DAGGER_BASE_DAMAGE;

	let score = 600 - target.health + target.size * 12;

	if (fatigued) {
		// Target is fatigued — huge bonus for the doubled damage
		score += 350;
	}

	if (target.health <= estimatedDamage) {
		score += 900;
	}

	if (target.delayed) {
		score += 130;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(
			activeCreature,
			target,
			ABILITY.CARTILAGE_DAGGER,
			controller,
		) ?? 0;
	score +=
		targetStrategy?.getCounterTargetingModifier?.(
			activeCreature,
			target,
			ABILITY.CARTILAGE_DAGGER,
			controller,
		) ?? 0;

	return score;
}

function scoreWhipMove(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	// Whip Move is most valuable when it pulls a fatigued or low-health enemy into melee range
	const fatigued = isCreatureFatigued(target);

	let score = 500 + target.size * 10;

	if (fatigued) {
		score += 200;
	}

	const healthRatio = target.health / target.stats.health;
	if (healthRatio < 0.4) {
		score += 150;
	}

	if (target.delayed) {
		score += 120;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(activeCreature, target, ABILITY.WHIP_MOVE, controller) ??
		0;

	return score;
}

function scoreBoomerangTool(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature)) return Number.NEGATIVE_INFINITY;

	const isEnemy = isTeam(activeCreature, target, Team.Enemy);
	const isAlly = isTeam(activeCreature, target, Team.Ally);

	if (!isEnemy && !isAlly) return Number.NEGATIVE_INFINITY;

	if (isAlly) return -600;

	let score = 600 - target.health + target.size * 14;

	if (target.health <= BOOMERANG_ESTIMATED_DAMAGE * 2) {
		score += 800;
	} else if (target.health <= BOOMERANG_ESTIMATED_DAMAGE) {
		score += 400;
	}

	if (target.delayed) {
		score += 120;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(
			activeCreature,
			target,
			ABILITY.BOOMERANG_TOOL,
			controller,
		) ?? 0;
	score +=
		targetStrategy?.getCounterTargetingModifier?.(
			activeCreature,
			target,
			ABILITY.BOOMERANG_TOOL,
			controller,
		) ?? 0;

	return score;
}

const HeadlessStrategy: UnitBotStrategy = {
	/**
	 * Headless relies on Larva Infest (targets creature behind it) — ideally it
	 * wants an enemy at its back while attacking frontward. Retreat threshold is low
	 * because it can drain endurance passively.
	 */
	isRetreating(creature, _controller) {
		const healthRatio = creature.health / creature.stats.health;
		const energyRatio = creature.energy / creature.stats.energy;
		return healthRatio < 0.18 || energyRatio < 0.12;
	},

	getPreferredX(creature, controller) {
		const gridRow = controller.game.grid.hexes[0];
		const boardWidth = gridRow ? gridRow.length - 1 : 15;
		// Size-2; stay close to mid so Larva Infest can target enemies from behind
		return creature.player.flipped ? boardWidth * 0.4 : boardWidth * 0.6;
	},

	/**
	 * Headless (size-2) wants enemies adjacent from its back for Larva Infest
	 * and within reach for Cartilage Dagger / Boomerang. Reward positions where
	 * at least one enemy is nearby but avoid being fully surrounded.
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

		if (adjacentEnemyCount > 2) {
			score -= (adjacentEnemyCount - 2) * 160;
		}

		const preferredX = controller.getPreferredX(activeCreature);
		score -= Math.abs(hex.x - preferredX) * 9;
		if (hex.trap) score -= 240;

		return score;
	},

	scoreAbilityHex(hex, abilityIndex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) return undefined;

		if (abilityIndex === ABILITY.CARTILAGE_DAGGER)
			return scoreCartilageDagger(hex, activeCreature, controller);
		if (abilityIndex === ABILITY.WHIP_MOVE) return scoreWhipMove(hex, activeCreature, controller);
		if (abilityIndex === ABILITY.BOOMERANG_TOOL)
			return scoreBoomerangTool(hex, activeCreature, controller);

		return undefined;
	},

	getAbilityMinScore(_creature, abilityIndex, _controller) {
		return ABILITY_MIN_SCORE[abilityIndex];
	},

	/**
	 * Priority: Dagger vs fatigued enemies (massive damage), then Boomerang for
	 * area, then Whip Move to set up future Larva Infest/Dagger combos.
	 */
	getAbilityPriority(creature, _controller) {
		// Cartilage Dagger becomes exceptional when enemies are fatigued
		const anyEnemyFatigued = creature.game.creatures.some(
			(c) => c instanceof Creature && isTeam(creature, c, Team.Enemy) && isCreatureFatigued(c),
		);
		if (anyEnemyFatigued) {
			return [ABILITY.CARTILAGE_DAGGER, ABILITY.BOOMERANG_TOOL, ABILITY.WHIP_MOVE];
		}
		return [ABILITY.BOOMERANG_TOOL, ABILITY.WHIP_MOVE, ABILITY.CARTILAGE_DAGGER];
	},

	getTargetingPenalty(_attacker, _target, _abilityIndex, _controller) {
		return 0;
	},

	getCounterTargetingModifier(_attacker, target, _abilityIndex, _controller) {
		let score = 20;
		const healthRatio = target.health / target.stats.health;
		if (healthRatio < 0.5) score += 80;
		if (healthRatio < 0.25) score += 100;
		// More valuable when their endurance is depleted (Larva Infest stacks)
		const enduranceRatio = target.endurance / (target.stats.endurance || 1);
		if (enduranceRatio < 0.3) score += 120;
		return score;
	},

	getProximityPenalty(_mover, _enemy, _destination, _controller) {
		return 0;
	},
};

export default HeadlessStrategy;
