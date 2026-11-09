import type BotController from '../bot';
import type { UnitBotStrategy } from '../bot';
import { unitStrategies } from '../bot';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import { Team, isTeam } from '../utility/team';

// Ability slot indices (Swampler, G13)
const ABILITY = {
	NATURAL_HABITAT: 0, // passive/onEndPhase – bot never activates directly
	RABID_NIP: 1, // melee, adjacent enemy
	BAD_BREATH: 2, // 3-hex toxic cloud cluster on adjacent hexes
	GOO_SNEEZE: 3, // ranged directional contagion
} as const;

const RABID_NIP_ESTIMATED_DAMAGE = 16; // 10 pierce + 6 poison base
const BAD_BREATH_ESTIMATED_DAMAGE = 20; // 10 poison ×2 (ability doubles poison)
const GOO_SNEEZE_ESTIMATED_DAMAGE = 10; // 4 crush + contagion value modeled separately

const ABILITY_MIN_SCORE: Partial<Record<number, number>> = {
	[ABILITY.RABID_NIP]: 320,
	[ABILITY.BAD_BREATH]: 340,
	[ABILITY.GOO_SNEEZE]: 360,
};

function getHomeHex(creature: Creature): Hex | undefined {
	const game = creature.game;
	for (let y = 0; y < game.grid.hexes.length; y++) {
		const row = game.grid.hexes[y];
		if (!row) continue;
		for (let x = 0; x < row.length; x++) {
			const hex = row[x];
			if (hex && hex._swamplerHomeOwner === creature.id) {
				return hex;
			}
		}
	}
	return undefined;
}

function distanceToHome(creature: Creature, hex: Hex): number {
	const home = getHomeHex(creature);
	if (!home) return 0;
	return Math.abs(hex.x - home.x) + Math.abs(hex.y - home.y);
}

function enemyCountOnHexSet(hexes: Hex[], activeCreature: Creature): number {
	const seen = new Set<number>();
	let count = 0;
	hexes.forEach((hex) => {
		const target = hex.creature;
		if (
			target instanceof Creature &&
			!seen.has(target.id) &&
			isTeam(activeCreature, target, Team.Enemy)
		) {
			seen.add(target.id);
			count += 1;
		}
	});
	return count;
}

/**
 * Approximate the 3-hex Bad Breath cluster for a chosen adjacent hex:
 * clicked hex + up to two hexes adjacent to it that are also adjacent to Swampler.
 */
function estimateBadBreathCluster(hex: Hex, activeCreature: Creature): Hex[] {
	const ring = activeCreature.adjacentHexes(1);
	const cluster: Hex[] = [hex];
	for (const candidate of ring) {
		if (candidate === hex) continue;
		if (
			hex
				.adjacentHex(1)
				.some((neighbor) => neighbor.x === candidate.x && neighbor.y === candidate.y)
		) {
			cluster.push(candidate);
			if (cluster.length >= 3) break;
		}
	}
	return cluster;
}

function scoreRabidNip(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 600 - target.health + target.size * 12;

	if (target.health <= RABID_NIP_ESTIMATED_DAMAGE) {
		score += 850;
	}

	if (target.delayed) {
		score += 90;
	}

	// Upgraded Rabid Nip is especially strong against high-regrowth targets.
	const upgraded = activeCreature.abilities[ABILITY.RABID_NIP]?.isUpgraded?.() ?? false;
	if (upgraded) {
		const regrowth = Number(target.stats?.regrowth ?? 0);
		if (regrowth >= 8) score += 220;
		else if (regrowth >= 5) score += 140;
		else if (regrowth > 0) score += 60;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(activeCreature, target, ABILITY.RABID_NIP, controller) ??
		0;
	score +=
		targetStrategy?.getCounterTargetingModifier?.(
			activeCreature,
			target,
			ABILITY.RABID_NIP,
			controller,
		) ?? 0;

	return score;
}

function scoreBadBreath(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const cluster = estimateBadBreathCluster(hex, activeCreature);
	const enemyCount = enemyCountOnHexSet(cluster, activeCreature);
	if (enemyCount <= 0) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = enemyCount * 260;

	cluster.forEach((clusterHex) => {
		const target = clusterHex.creature;
		if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
			return;
		}
		score += Math.max(0, 80 - target.health * 0.5);
		if (target.health <= BAD_BREATH_ESTIMATED_DAMAGE) {
			score += 220;
		}
	});

	// Slight preference to keep pressure near home when a home exists.
	const homeDist = distanceToHome(activeCreature, hex);
	if (homeDist <= 2) {
		score += 40;
	}

	// Simple tactical preference: avoid using on empty value; do not over-model pathing.
	// (User requested no back-flip scoring for blocking/barrier nuance.)
	void controller;
	return score;
}

function scoreGooSneeze(hex: Hex, activeCreature: Creature, controller: BotController): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	let score = 520 - target.health + target.size * 10;

	if (target.health <= GOO_SNEEZE_ESTIMATED_DAMAGE) {
		score += 450;
	}

	// Contagion is strongest when targets are crowded or likely adjacent to allies.
	const adjacentEnemies = enemyCountOnHexSet(target.adjacentHexes(1), activeCreature);
	score += adjacentEnemies * 180;
	if (adjacentEnemies >= 2) {
		score += 180;
	}

	if (target.delayed) {
		score += 70;
	}

	const targetStrategy = unitStrategies[target.type as string];
	score +=
		targetStrategy?.getTargetingPenalty?.(activeCreature, target, ABILITY.GOO_SNEEZE, controller) ??
		0;
	score +=
		targetStrategy?.getCounterTargetingModifier?.(
			activeCreature,
			target,
			ABILITY.GOO_SNEEZE,
			controller,
		) ?? 0;

	return score;
}

const SwamplerStrategy: UnitBotStrategy = {
	isRetreating(creature, _controller) {
		const healthRatio = creature.health / creature.stats.health;
		const energyRatio = creature.energy / creature.stats.energy;
		const home = getHomeHex(creature);
		const onHome = home ? creature.hexagons.some((h) => h.x === home.x && h.y === home.y) : false;
		// Retreat earlier when away from home; home is a safe regeneration spot (especially upgraded).
		if (onHome) return healthRatio < 0.18 || energyRatio < 0.12;
		return healthRatio < 0.28 || energyRatio < 0.15;
	},

	getPreferredX(creature, controller) {
		const gridRow = controller.game.grid.hexes[0];
		const boardWidth = gridRow ? gridRow.length - 1 : 15;
		const home = getHomeHex(creature);
		if (home) {
			// Stay anchored near established home, but allow limited forward pressure.
			const anchor = home.x;
			const enemyX = creature.player.flipped ? boardWidth * 0.15 : boardWidth * 0.85;
			const aggression = Math.min(0.35, controller.getAggressionFactor(creature) * 0.035);
			return anchor + (enemyX - anchor) * aggression;
		}
		// Before home is claimed: hold a strategic mid-front position.
		return creature.player.flipped ? boardWidth * 0.42 : boardWidth * 0.58;
	},

	scoreMoveHex(hex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) return undefined;

		const retreating = controller.isRetreating(activeCreature);
		let score = 0;

		const adjacentEnemyCount = hex
			.adjacentHex(1)
			.filter(
				(adj) =>
					adj.creature instanceof Creature && isTeam(activeCreature, adj.creature, Team.Enemy),
			).length;

		if (retreating) {
			score -= adjacentEnemyCount * 180;
			const home = getHomeHex(activeCreature);
			if (home) {
				const d = Math.abs(hex.x - home.x) + Math.abs(hex.y - home.y);
				score += Math.max(0, 12 - d) * 55;
				if (hex.x === home.x && hex.y === home.y) score += 220;
			}
		} else {
			// Wants to threaten with Rabid Nip / Bad Breath while staying able to return home.
			score += Math.min(adjacentEnemyCount, 2) * 90;
			score -= Math.max(0, adjacentEnemyCount - 2) * 120;
		}

		const preferredX = controller.getPreferredX(activeCreature);
		score -= Math.abs(hex.x - preferredX) * 10;

		const home = getHomeHex(activeCreature);
		if (home) {
			const d = Math.abs(hex.x - home.x) + Math.abs(hex.y - home.y);
			const upgraded = activeCreature.abilities[ABILITY.NATURAL_HABITAT]?.isUpgraded?.() ?? false;
			const healthRatio = activeCreature.health / activeCreature.stats.health;
			// Stay able to turn back to home; stronger pull when low or upgraded.
			score -= d * (upgraded || healthRatio < 0.5 ? 10 : 6);
			if (hex.x === home.x && hex.y === home.y) {
				score += upgraded ? 120 : 60;
				if (healthRatio < 0.6) score += 120;
			}
		}

		if (hex.trap) score -= 220;

		return score;
	},

	getHoldPositionScore(creature, _controller) {
		const home = getHomeHex(creature);
		if (!home) return undefined;
		const onHome = creature.hexagons.some((h) => h.x === home.x && h.y === home.y);
		if (!onHome) return undefined;
		const healthRatio = creature.health / creature.stats.health;
		const upgraded = creature.abilities[ABILITY.NATURAL_HABITAT]?.isUpgraded?.() ?? false;
		if (upgraded && healthRatio < 0.75) return 140;
		if (healthRatio < 0.45) return 120;
		return 60;
	},

	scoreAbilityHex(hex, abilityIndex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) return undefined;

		if (abilityIndex === ABILITY.RABID_NIP) return scoreRabidNip(hex, activeCreature, controller);
		if (abilityIndex === ABILITY.BAD_BREATH) return scoreBadBreath(hex, activeCreature, controller);
		if (abilityIndex === ABILITY.GOO_SNEEZE) return scoreGooSneeze(hex, activeCreature, controller);

		return undefined;
	},

	getAbilityMinScore(_creature, abilityIndex, _controller) {
		return ABILITY_MIN_SCORE[abilityIndex];
	},

	getAbilityPriority(_creature, _controller) {
		// Crowd control/contagion first when available, then area poison, then melee.
		return [ABILITY.GOO_SNEEZE, ABILITY.BAD_BREATH, ABILITY.RABID_NIP];
	},
};

export default SwamplerStrategy;
