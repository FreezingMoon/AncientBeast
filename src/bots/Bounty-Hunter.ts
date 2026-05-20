import type BotController from '../bot';
import type { UnitBotStrategy } from '../bot';
import { unitStrategies } from '../bot';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import { Team, isTeam } from '../utility/team';

// Ability slot indices
const ABILITY = {
	PERSONAL_SPACE: 0, // passive: +offense and +move when adjacent enemy at turn start
	SWORD_SLITTER: 1,  // melee single-target, 1 hex range
	PISTOL_SHOT: 2,    // ranged directional, up to 6 hexes
	RIFLE_ASSASSIN: 3, // long-range directional, up to 12 hexes
} as const;

const SWORD_SLITTER_ESTIMATED_DAMAGE = 25;
const PISTOL_SHOT_ESTIMATED_DAMAGE = 20;
const RIFLE_ASSASSIN_ESTIMATED_DAMAGE = 40;

const ABILITY_MIN_SCORE: Partial<Record<number, number>> = {
	[ABILITY.SWORD_SLITTER]: 380,
	[ABILITY.PISTOL_SHOT]: 320,
	[ABILITY.RIFLE_ASSASSIN]: 480,
};

function scoreSwordSlitter(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 650 - target.health + target.size * 10;

	if (target.health <= SWORD_SLITTER_ESTIMATED_DAMAGE) {
		score += 900;
	}

	if (target.delayed) {
		score += 140;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score += targetStrategy?.getTargetingPenalty?.(activeCreature, target, ABILITY.SWORD_SLITTER, controller) ?? 0;
	score += targetStrategy?.getCounterTargetingModifier?.(activeCreature, target, ABILITY.SWORD_SLITTER, controller) ?? 0;

	return score;
}

function scorePistolShot(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 600 - target.health + target.size * 12;

	if (target.health <= PISTOL_SHOT_ESTIMATED_DAMAGE) {
		score += 700;
	}

	if (target.delayed) {
		score += 120;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score += targetStrategy?.getTargetingPenalty?.(activeCreature, target, ABILITY.PISTOL_SHOT, controller) ?? 0;
	score += targetStrategy?.getCounterTargetingModifier?.(activeCreature, target, ABILITY.PISTOL_SHOT, controller) ?? 0;

	return score;
}

function scoreRifleAssassin(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 750 - target.health + target.size * 15;

	if (target.health <= RIFLE_ASSASSIN_ESTIMATED_DAMAGE) {
		score += 1100;
	}

	if (target.delayed) {
		score += 160;
	}

	const healthRatio = target.health / target.stats.health;
	if (healthRatio < 0.4) {
		score += 150;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score += targetStrategy?.getTargetingPenalty?.(activeCreature, target, ABILITY.RIFLE_ASSASSIN, controller) ?? 0;
	score += targetStrategy?.getCounterTargetingModifier?.(activeCreature, target, ABILITY.RIFLE_ASSASSIN, controller) ?? 0;

	return score;
}

const BountyHunterStrategy: UnitBotStrategy = {
	/**
	 * Bounty Hunter is an aggressive skirmisher; it retreats a bit earlier than
	 * most to preserve energy for its cost-intensive ranged shots.
	 */
	isRetreating(creature, _controller) {
		const healthRatio = creature.health / creature.stats.health;
		const energyRatio = creature.energy / creature.stats.energy;
		return healthRatio < 0.22 || energyRatio < 0.15;
	},

	/**
	 * Mid-field positioning exploits Personal Space (adjacent enemy attack bonus)
	 * while keeping Pistol/Rifle shots in range.
	 */
	getPreferredX(creature, controller) {
		const gridRow = controller.game.grid.hexes[0];
		const boardWidth = gridRow ? gridRow.length - 1 : 15;
		return creature.player.flipped ? boardWidth * 0.38 : boardWidth * 0.62;
	},

	/**
	 * Bounty Hunter is a ranged skirmisher — it wants to stay at 2–5 hex distance
	 * from enemies so Pistol Shot and Rifle Assassin are in range but it avoids
	 * taking melee hits that Personal Space cannot fully compensate for.
	 */
	scoreMoveHex(hex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature || controller.isRetreating(activeCreature)) return undefined;

		let score = 0;
		const nearestEnemyDist = controller.closestDistanceToEnemy(hex);

		// Ideal range: 2–5 hexes (Pistol 6, Rifle 12). Adjacent is dangerous.
		if (nearestEnemyDist === 3 || nearestEnemyDist === 4) {
			score += 200;
		} else if (nearestEnemyDist === 2 || nearestEnemyDist === 5) {
			score += 100;
		} else if (nearestEnemyDist === 1) {
			score -= 100; // too close; melee risk without melee bonuses
		} else if (nearestEnemyDist > 6) {
			score -= (nearestEnemyDist - 6) * 40;
		}

		// Penalise being surrounded by enemies
		const adjacentEnemyCount = hex
			.adjacentHex(1)
			.filter(
				(adj) =>
					adj.creature instanceof Creature && isTeam(activeCreature, adj.creature, Team.Enemy),
			).length;
		score -= adjacentEnemyCount * 160;

		const preferredX = controller.getPreferredX(activeCreature);
		score -= Math.abs(hex.x - preferredX) * 7;
		if (hex.trap) score -= 260;

		return score;
	},

	scoreAbilityHex(hex, abilityIndex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) return undefined;

		if (abilityIndex === ABILITY.SWORD_SLITTER) return scoreSwordSlitter(hex, activeCreature, controller);
		if (abilityIndex === ABILITY.PISTOL_SHOT) return scorePistolShot(hex, activeCreature, controller);
		if (abilityIndex === ABILITY.RIFLE_ASSASSIN) return scoreRifleAssassin(hex, activeCreature, controller);

		return undefined;
	},

	getAbilityMinScore(_creature, abilityIndex, _controller) {
		return ABILITY_MIN_SCORE[abilityIndex];
	},

	/**
	 * Priority: Rifle Assassin when any enemy is in kill range (max damage),
	 * otherwise Sword Slitter in melee then Pistol Shot at range.
	 */
	getAbilityPriority(creature, controller) {
		const hasKillableTarget = controller.game.creatures.some(
			(c) =>
				c instanceof Creature &&
				!c.dead &&
				!c.temp &&
				isTeam(creature, c, Team.Enemy) &&
				c.health <= RIFLE_ASSASSIN_ESTIMATED_DAMAGE,
		);

		if (hasKillableTarget) {
			return [ABILITY.RIFLE_ASSASSIN, ABILITY.PISTOL_SHOT, ABILITY.SWORD_SLITTER];
		}

		const healthRatio = creature.health / creature.stats.health;
		if (healthRatio > 0.5) {
			return [ABILITY.RIFLE_ASSASSIN, ABILITY.SWORD_SLITTER, ABILITY.PISTOL_SHOT];
		}

		return [ABILITY.SWORD_SLITTER, ABILITY.PISTOL_SHOT, ABILITY.RIFLE_ASSASSIN];
	},

	getTargetingPenalty(_attacker, _target, _abilityIndex, _controller) {
		return 0;
	},

	getCounterTargetingModifier(_attacker, target, _abilityIndex, _controller) {
		let score = 30;
		const healthRatio = target.health / target.stats.health;
		if (healthRatio < 0.5) score += 80;
		if (healthRatio < 0.25) score += 100;
		const energyRatio = target.energy / target.stats.energy;
		if (energyRatio < 0.2) score += 60;
		return score;
	},

	getProximityPenalty(_mover, enemy, _destination, _controller) {
		// Bounty Hunter has no strong retaliation passive; treat as neutral proximity.
		const energyRatio = enemy.energy / enemy.stats.energy;
		if (energyRatio > 0.6) return -30;
		return 0;
	},
};

export default BountyHunterStrategy;
