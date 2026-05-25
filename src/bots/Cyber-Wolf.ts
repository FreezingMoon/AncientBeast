import type BotController from '../bot';
import type { UnitBotStrategy } from '../bot';
import { unitStrategies } from '../bot';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import { Team, isTeam } from '../utility/team';

const ABILITY = {
	BAD_DOGGIE: 0, // Passive melee attack
	METAL_HAND: 1, // Melee; steals energy if upgraded
	ROCKET_LAUNCHER: 2, // Ranged; can miss
	TARGET_LOCKING: 3, // Use missed rockets to attack
} as const;

// Retreat thresholds
const RETREAT_HEALTH_RATIO = 0.25;
const RETREAT_ENERGY_RATIO = 0.15;
const TARGET_LOCKING_ENERGY_COST = 30;

// Energy thresholds for strategy selection
const HIGH_ENERGY_RATIO = 0.6; // Enough for rocket (30-40) + target lock combo
const VERY_HIGH_ENERGY_RATIO = 0.8; // Can freely use abilities
const LOW_ENERGY_RATIO = 0.3;

// Combat strategy thresholds
const MELEE_PREFERENCE_HEALTH_RATIO = 0.5; // Prefer melee if health is high

// Targeting penalties - used for counter-strategy
const HIGH_LEVEL_PENALTY_MULTIPLIER = 30; // Discourage attacking high-level units when we have energy
const LOW_HEALTH_SPREAD_DETECTION_BONUS = 100; // Bonus for hitting low-health units spread across rows

/**
 * Returns true if Cyber Wolf should use the melee strategy (Metal Hand + Bad Doggie).
 * Melee is preferred when:
 * - Health is good (>50%)
 * - There are adjacent enemies (can land consistent hits)
 * - We're not energy-starved (need energy for Metal Hand)
 */
function shouldPreferMelee(creature: Creature): boolean {
	const healthRatio = creature.health / creature.stats.health;
	if (healthRatio < MELEE_PREFERENCE_HEALTH_RATIO) {
		return false;
	}

	const energyRatio = creature.energy / creature.stats.energy;
	if (energyRatio < 0.2) {
		return false;
	}

	// Check if there are adjacent enemies to melee
	const hasAdjacentEnemies = creature
		.adjacentHexes(1)
		.some((hex) => hex.creature instanceof Creature && isTeam(creature, hex.creature, Team.Enemy));

	return hasAdjacentEnemies;
}

/**
 * Returns true if Cyber Wolf should use the ranged strategy (Rocket Launcher + Target Locking).
 * Ranged is preferred when:
 * - We have enough energy for both abilities
 * - Health is moderate to low (safer to stay back)
 * - There are multiple enemy units across different rows
 */
function shouldPreferRanged(creature: Creature): boolean {
	const energyRatio = creature.energy / creature.stats.energy;
	if (energyRatio < HIGH_ENERGY_RATIO) {
		return false;
	}

	// Ranged strategy works well when enemies are spread across rows
	const enemies = creature.player.game.creatures.filter(
		(c) => c instanceof Creature && !c.dead && isTeam(creature, c, Team.Enemy),
	);

	return enemies.length >= 2;
}

function getTargetLockingEnergyRequirement(creature: Creature): number {
	const missedRockets = creature.abilities[ABILITY.ROCKET_LAUNCHER]?.token ?? 0;
	if (missedRockets <= 0) {
		return 0;
	}

	return TARGET_LOCKING_ENERGY_COST;
}

function hasLiveEnemyTarget(creature: Creature): boolean {
	return creature.player.game.creatures.some(
		(candidate) =>
			candidate instanceof Creature &&
			!candidate.dead &&
			!candidate.temp &&
			candidate !== creature &&
			isTeam(creature, candidate, Team.Enemy),
	);
}

/**
 * Returns true if Cyber Wolf should keep pressure despite low energy.
 * Adjacent pressure enables Bad Doggie/Metal Hand follow-ups, and stored
 * rockets can still be converted through Target Locking.
 */
function hasLowEnergyCombatOption(creature: Creature): boolean {
	const hasAdjacentEnemies = creature
		.adjacentHexes(1)
		.some((hex) => hex.creature instanceof Creature && isTeam(creature, hex.creature, Team.Enemy));

	if (hasAdjacentEnemies) {
		return true;
	}

	const missedRockets = creature.abilities[ABILITY.ROCKET_LAUNCHER]?.token ?? 0;
	const minEnergyForTargetLock = getTargetLockingEnergyRequirement(creature);

	return (
		missedRockets > 0 && creature.energy >= minEnergyForTargetLock && hasLiveEnemyTarget(creature)
	);
}

/**
 * Scores targeting a hex for Metal Hand (melee attack).
 */
function scoreMetalHand(hex: Hex, activeCreature: Creature, _controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	const distance = Math.abs(hex.x - activeCreature.x) + Math.abs(hex.y - activeCreature.y);
	if (distance > 1) {
		// Metal Hand requires being at melee range (front/back)
		return Number.NEGATIVE_INFINITY;
	}

	const upgraded = activeCreature.abilities[ABILITY.METAL_HAND]?.isUpgraded?.() ?? false;
	let score = 300 - target.health;

	// Boost for energy-hungry targets
	if (typeof target.stats.energy === 'number' && target.stats.energy > 0) {
		const energyRatio = target.energy / target.stats.energy;
		score += Math.round(energyRatio * 120); // Bonus for targets with high energy (more to steal)
	}

	// Upgraded can steal energy, bonus
	if (upgraded) {
		score += 100;
	}

	// Reduce score if target is very low health (reserved for finishing)
	if (target.health < 30) {
		score += 50;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(
			activeCreature,
			target,
			ABILITY.METAL_HAND,
			_controller,
		) ?? 0;

	return score;
}

/**
 * Scores targeting a hex for Rocket Launcher.
 * Rockets can hit multiple rows; we want to spread hits across different rows
 * or concentrate on high-priority targets.
 */
function scoreRocketLauncher(
	hex: Hex,
	activeCreature: Creature,
	controller: BotController,
): number {
	const target = hex.creature;

	// Empty hexes are valid targets (area effect)
	if (!(target instanceof Creature)) {
		// Bonus for empty hexes if it creates a good setup for rockets
		// (e.g., if they clear a path to reach more enemies)
		return 50;
	}

	if (!isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 400 - target.health * 2;

	// Prioritize high-level units (harder to deal with later)
	const level = typeof target.level === 'number' ? target.level : 1;
	score += level * 60;

	// Bonus for energy-rich targets (they're more dangerous)
	if (typeof target.stats.energy === 'number' && target.stats.energy > 0) {
		score += Math.round((target.energy / target.stats.energy) * 80);
	}

	// Large bonus for lethal hits
	if (target.health <= 20) {
		score += 300;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(
			activeCreature,
			target,
			ABILITY.ROCKET_LAUNCHER,
			controller,
		) ?? 0;

	return score;
}

/**
 * Scores targeting a hex for Target Locking (using redirected rockets).
 */
function scoreTargetLocking(
	hex: Hex,
	activeCreature: Creature,
	_controller: BotController,
): number {
	const target = hex.creature;
	if (
		!(target instanceof Creature) ||
		target.dead ||
		target.temp ||
		!target.stats ||
		typeof target.stats.health !== 'number' ||
		target.stats.health <= 0 ||
		!isTeam(activeCreature, target, Team.Enemy)
	) {
		return Number.NEGATIVE_INFINITY;
	}

	const rocketLauncherAbility = activeCreature.abilities[ABILITY.ROCKET_LAUNCHER];
	const missedRockets = rocketLauncherAbility.token ?? 0;

	if (missedRockets === 0) {
		return Number.NEGATIVE_INFINITY;
	}

	const upgraded = activeCreature.abilities[ABILITY.TARGET_LOCKING]?.isUpgraded?.() ?? false;
	let score = 600 - target.health;

	// Significant bonus for high-health tanks (this ability's main use)
	const healthRatio = target.health / target.stats.health;
	if (healthRatio > 0.7) {
		score += 400;
	}

	// Scale score with number of rockets available
	score += missedRockets * 150;

	// Upgraded can use all rockets
	if (upgraded) {
		score += 50;
	}

	// High-level units are high priority
	const level = typeof target.level === 'number' ? target.level : 1;
	score += level * 80;

	return score;
}

const CyberWolfStrategy: UnitBotStrategy = {
	isRetreating(creature, _controller) {
		const healthRatio = creature.health / creature.stats.health;
		const energyRatio = creature.energy / creature.stats.energy;

		if (healthRatio < RETREAT_HEALTH_RATIO) {
			return true;
		}

		if (energyRatio < RETREAT_ENERGY_RATIO && !hasLowEnergyCombatOption(creature)) {
			return true;
		}

		return false;
	},

	getPreferredX(creature, controller) {
		const gridRow = controller.game.grid.hexes[0];
		const boardWidth = gridRow ? gridRow.length - 1 : 15;

		const shouldBeMelee = shouldPreferMelee(creature);

		// Melee: stay forward to use Metal Hand
		if (shouldBeMelee) {
			return creature.player.flipped ? boardWidth * 0.45 : boardWidth * 0.55;
		}

		// Ranged: stay back for rocket coverage and regeneration space
		return creature.player.flipped ? boardWidth * 0.3 : boardWidth * 0.7;
	},

	scoreAbilityHex(hex, abilityIndex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) return undefined;

		if (abilityIndex === ABILITY.METAL_HAND) {
			return scoreMetalHand(hex, activeCreature, controller);
		}

		if (abilityIndex === ABILITY.ROCKET_LAUNCHER) {
			return scoreRocketLauncher(hex, activeCreature, controller);
		}

		if (abilityIndex === ABILITY.TARGET_LOCKING) {
			return scoreTargetLocking(hex, activeCreature, controller);
		}

		return undefined;
	},

	getAbilityPriority(creature) {
		const energyRatio = creature.energy / creature.stats.energy;

		// If we have a target locked and rockets fired, finish with Target Locking
		const rocketLauncherAbility = creature.abilities[ABILITY.ROCKET_LAUNCHER];
		const missedRockets = rocketLauncherAbility?.token ?? 0;
		const targetLockEnergyRequirement = getTargetLockingEnergyRequirement(creature);

		if (
			missedRockets > 0 &&
			creature.energy >= targetLockEnergyRequirement &&
			hasLiveEnemyTarget(creature)
		) {
			// Prioritize using missed rockets on high-priority targets
			return [ABILITY.TARGET_LOCKING, ABILITY.METAL_HAND, ABILITY.ROCKET_LAUNCHER];
		}

		// Strategy selection based on conditions
		if (shouldPreferMelee(creature)) {
			return [ABILITY.METAL_HAND, ABILITY.ROCKET_LAUNCHER, ABILITY.TARGET_LOCKING];
		}

		if (shouldPreferRanged(creature)) {
			return [ABILITY.ROCKET_LAUNCHER, ABILITY.TARGET_LOCKING, ABILITY.METAL_HAND];
		}

		// Default: balanced approach
		if (energyRatio > 0.5) {
			return [ABILITY.ROCKET_LAUNCHER, ABILITY.METAL_HAND, ABILITY.TARGET_LOCKING];
		}

		// Low energy: just use what we can
		return [ABILITY.METAL_HAND, ABILITY.ROCKET_LAUNCHER, ABILITY.TARGET_LOCKING];
	},

	getTargetingPenalty(attacker, target, _abilityIndex, _controller) {
		let score = 0;

		// Counter-strategy: punish attacking high-level units when we have high energy
		const attackerEnergyRatio = attacker.energy / attacker.stats.energy;
		const targetLevel = typeof target.level === 'number' ? target.level : 1;

		if (attackerEnergyRatio > VERY_HIGH_ENERGY_RATIO && targetLevel >= 4) {
			// This is the counter-play: high-level units are dangerous when Cyber Wolf is energized
			// Encourage attacking lower-level or already-damaged units instead
			score -= Math.min(200, targetLevel * HIGH_LEVEL_PENALTY_MULTIPLIER);
		}

		// Detect spread low-health units across rows (Cyber Wolf's advantage)
		const healthRatio = target.health / target.stats.health;
		if (healthRatio < 0.35) {
			// Low-health unit - this is vulnerable to rockets spread across rows
			score += LOW_HEALTH_SPREAD_DETECTION_BONUS;
		}

		return score;
	},

	getCounterTargetingModifier(attacker, target, _abilityIndex, _controller) {
		let score = 0;

		// If Cyber Wolf is frozen or sick, he's much weaker
		if (target.isFrozen()) {
			score -= 250; // Attackers should take advantage
		}

		// If Cyber Wolf has low energy, he can't regenerate or use expensive abilities
		const energyRatio = target.energy / target.stats.energy;
		if (energyRatio < LOW_ENERGY_RATIO) {
			score -= 150; // Easier to overwhelm
		}

		return score;
	},

	getProximityPenalty(mover, enemy, destination, _controller) {
		let score = 0;

		// Check if moving adjacent would expose us to Metal Hand's energy steal
		const distanceToEnemy = Math.abs(destination.x - enemy.x) + Math.abs(destination.y - enemy.y);
		if (distanceToEnemy <= 1) {
			// Moving adjacent to Cyber Wolf is risky if it has high energy to steal
			const cyberWolfEnergyRatio = enemy.energy / enemy.stats.energy;
			if (cyberWolfEnergyRatio > 0.4) {
				score -= Math.round(cyberWolfEnergyRatio * 150); // Risk of energy drain
			}
		}

		// If Cyber Wolf is positioned to fire rockets, avoid grouping units in same row
		const rowDifference = Math.abs(destination.y - mover.y);
		if (rowDifference <= 1) {
			// Grouped in same row - vulnerable to rocket spread
			score -= 80;
		}

		return score;
	},
};

export default CyberWolfStrategy;
