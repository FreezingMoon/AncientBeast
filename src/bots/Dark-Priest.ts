import type BotController from '../bot';
import type { UnitBotStrategy } from '../bot';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import { Team, isTeam } from '../utility/team';

// Ability slot indices
const ABILITY = {
	PLASMA_FIELD: 0, // passive, onUnderAttack – bot never activates directly
	ELECTRO_SHOCKER: 1, // onQuery, range 1 (4 if upgraded), shock = 12 × target.size
	DISRUPTOR_BEAM: 2, // onQuery, range 2, pure = missingHP, plasma cost = target.size
	GODLET_PRINTER: 3, // handled by trySummon() in bot.ts
} as const;

/**
 * Minimum plasma kept in reserve to absorb incoming attacks via Plasma Field.
 * Disruptor Beam spending is blocked when it would take plasma at or below this.
 */
const PLASMA_SURVIVAL_RESERVE = 3;

// ---------------------------------------------------------------------------
// Axis-alignment helper (straight row or hex-grid diagonal)
// ---------------------------------------------------------------------------

/**
 * Returns true when hex B lies on the same straight row or diagonal axis as
 * hex A — the same axes that most ranged abilities travel along.
 * Straight: same y row.
 * Diagonal: floor(|Δy| / 2) === |Δx| on the staggered hex grid.
 */
function isOnSameAxis(ax: number, ay: number, bx: number, by: number): boolean {
	const dx = Math.abs(bx - ax);
	const dy = Math.abs(by - ay);
	if (dy === 0) return true;
	return Math.floor(dy / 2) === dx;
}

// ---------------------------------------------------------------------------
// Per-ability scorers
// ---------------------------------------------------------------------------

/**
 * Score a hex for Electro Shocker (ability 1).
 *
 * Damage = 12 × target.size (shock, no plasma cost).
 * Ideal combo use:
 * - Bring enemies (ideally larger ones) under half their HP so that a
 *   follow-up Disruptor Beam can finish them off, since the beam deals
 *   damage equal to the target's missing health.
 * - Outright kills are the highest priority.
 */
function scoreElectroShocker(
	hex: Hex,
	activeCreature: Creature,
	_controller: BotController,
): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	const damage = 12 * target.size;
	const healthAfterShock = Math.max(0, target.health - damage);
	const willKill = target.health <= damage;
	const halfHP = target.stats.health * 0.5;
	const alreadyBelowHalf = target.health < halfHP;
	const willBeBelowHalf = healthAfterShock < halfHP;

	// Larger targets deal more raw shock damage; low-health ones are closer to death.
	let score = 100 + target.size * 50 - target.health;

	const plasma = activeCreature.player.plasma;
	const beamCost = target.size;
	const canAffordBeam = plasma - beamCost >= PLASMA_SURVIVAL_RESERVE;

	if (willKill) {
		// Immediate elimination — always the top priority. The bonus is sized
		// to guarantee a kill scores higher than any combo-setup scenario,
		// regardless of target size or remaining health.
		score += 700;
	} else if (alreadyBelowHalf) {
		// Target is already under half HP: Disruptor Beam already has a good
		// return here; shock adds even more missing HP for the beam.
		score += 200;
		if (canAffordBeam) {
			score += 150; // Beam follow-up is affordable — strong combo.
		}
	} else if (willBeBelowHalf) {
		// Shock tips the target from above to below 50% HP, creating the
		// ideal Disruptor Beam opportunity on a subsequent action.
		score += 300;
		if (canAffordBeam) {
			score += 150; // Can immediately follow up this turn.
		}
	}

	return score;
}

/**
 * Score a hex for Disruptor Beam (ability 2).
 *
 * Damage = pure equal to the target's missing HP (baseStats.health − health).
 * Plasma cost = target.size.
 * Upgraded: minimum 40 damage even if missing HP is lower.
 *
 * Priorities:
 * - Kill bonus: highest value use.
 * - Ideally used against targets under half HP — the beam is most
 *   efficient when missing HP is large, and sub-50% targets give the
 *   best damage-per-plasma-point return.
 * - Efficiency: damage-per-plasma-point (favours smaller units).
 * - Never fire when plasma would drop below the survival reserve.
 */
function scoreDisruptorBeam(
	hex: Hex,
	activeCreature: Creature,
	_controller: BotController,
): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	const plasma = activeCreature.player.plasma;
	const plasmaCost = target.size;

	// Hard block: preserve the shield reserve
	if (plasma - plasmaCost < PLASMA_SURVIVAL_RESERVE) {
		return Number.NEGATIVE_INFINITY;
	}

	const ability = activeCreature.abilities[ABILITY.DISRUPTOR_BEAM];
	const upgraded = ability?.isUpgraded?.() ?? false;

	let damageAmount = target.baseStats.health - target.health;
	if (upgraded && damageAmount < 40) {
		damageAmount = 40;
	}

	const willKill = target.health <= damageAmount;
	const halfHP = target.stats.health * 0.5;
	const belowHalf = target.health < halfHP;

	// Efficiency: damage per plasma point (smaller units cost less plasma)
	const efficiency = plasmaCost > 0 ? damageAmount / plasmaCost : 0;

	let score = efficiency * 15;

	if (willKill) {
		// Elimination is the best possible outcome.
		score += 600;
	} else if (belowHalf) {
		// Under half HP is the sweet spot: missing health is large so the
		// beam deals substantial pure damage. This is the intended use case.
		score += 300;
		// Scale further with how far below half the target already is.
		const baseHP = target.baseStats.health;
		if (baseHP > 0) {
			const missingHPRatio = (baseHP - target.health) / baseHP;
			score += missingHPRatio * 150;
		}
	} else {
		// Target is above half HP: the beam deals less than half its potential
		// damage. Weak bonus from whatever missing HP exists; no threshold bonus.
		const baseHP = target.baseStats.health;
		if (baseHP > 0) {
			const missingHPRatio = (baseHP - target.health) / baseHP;
			score += missingHPRatio * 60;
		}
	}

	// Penalise near-full-health targets when not upgraded (beam deals near-zero damage)
	if (target.health >= target.baseStats.health && !upgraded) {
		score -= 400;
	}

	return score;
}

// ---------------------------------------------------------------------------
// Strategy export
// ---------------------------------------------------------------------------

const DarkPriestStrategy: UnitBotStrategy = {
	/**
	 * Dark Priest retreats only when critically low on health.
	 * He relies on Plasma Field for defence rather than raw distance,
	 * so the retreat threshold is lower than most units.
	 */
	isRetreating(creature, _controller) {
		const healthRatio = creature.health / creature.stats.health;
		return healthRatio < 0.25;
	},

	/**
	 * Dark Priest always hugs the deepest home position (~5 % from the edge).
	 * The generic formula already places him there via isDarkPriest(), but this
	 * override makes the intent explicit and keeps him anchored even when
	 * aggression pressure rises.
	 */
	getPreferredX(creature, controller) {
		const gridRow = controller.game.grid.hexes[0];
		const boardWidth = gridRow ? gridRow.length - 1 : 15;
		return creature.player.flipped ? boardWidth * 0.95 : boardWidth * 0.05;
	},

	/**
	 * Movement scoring for the Dark Priest:
	 *
	 * 1. Heavy penalty for landing adjacent to any enemy.
	 * 2. Penalty for being in line-of-sight of enemies along straight rows or
	 *    diagonal axes (removes approach corridor for ranged units).
	 * 3. Reward for allied units on neighbouring hexes — they act as meat-shields.
	 * 4. Corner defence bonus: when surrounded by melee enemies with no allied
	 *    cover, prefer tighter hex geometry with fewer open neighbours so fewer
	 *    enemies can reach the priest simultaneously.
	 * 5. Zone pressure keeps the priest near the back line at all times.
	 */
	scoreMoveHex(hex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) return undefined;

		if (controller.isRetreating(activeCreature)) return undefined;

		let score = 0;

		const adjacentHexes = hex.adjacentHex(1);

		const adjacentEnemyCount = adjacentHexes.filter(
			(adj) => adj.creature && isTeam(activeCreature, adj.creature, Team.Enemy),
		).length;
		score -= adjacentEnemyCount * 300;

		const adjacentAllyCount = adjacentHexes.filter(
			(adj) =>
				adj.creature &&
				adj.creature !== activeCreature &&
				isTeam(activeCreature, adj.creature, Team.Ally),
		).length;
		score += adjacentAllyCount * 80;

		// Line-of-sight penalty: ranged enemies threaten along rows and diagonals
		controller.game.creatures.forEach((enemy) => {
			if (!enemy || enemy.dead || enemy.temp) return;
			if (!isTeam(activeCreature, enemy, Team.Enemy)) return;
			if (!isOnSameAxis(hex.x, hex.y, enemy.x, enemy.y)) return;
			const dy = Math.abs(hex.y - enemy.y);
			if (dy === 0) {
				score -= 150; // Straight row: primary ranged attack axis
			} else {
				score -= 80; // Diagonal axis: lighter penalty
			}
		});

		// Corner defence: trapped by melee enemies and no allied cover?
		// Prefer hexes with few open neighbours — harder for enemies to crowd in.
		if (adjacentEnemyCount > 0 && adjacentAllyCount === 0) {
			const openCount = adjacentHexes.filter((adj) => !adj.creature).length;
			score += (6 - openCount) * 30;
		}

		// Zone preference: stay deep at home side
		const preferredX = controller.getPreferredX(activeCreature);
		score -= Math.abs(hex.x - preferredX) * 15;

		return score;
	},

	/**
	 * Delegates to per-ability scorers for Electro Shocker and Disruptor Beam.
	 */
	scoreAbilityHex(hex, abilityIndex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) return undefined;

		if (abilityIndex === ABILITY.ELECTRO_SHOCKER) {
			return scoreElectroShocker(hex, activeCreature, controller);
		}

		if (abilityIndex === ABILITY.DISRUPTOR_BEAM) {
			return scoreDisruptorBeam(hex, activeCreature, controller);
		}

		return undefined;
	},

	/**
	 * Ability priority for the Dark Priest:
	 *
	 * - Normal: Electro Shocker (1) first to maximise the target's missing HP,
	 *   then Disruptor Beam (2) to capitalise on the wound.
	 * - Critically low plasma: Electro Shocker only — Disruptor Beam would
	 *   consume the last shield points needed for survival.
	 *
	 * Godlet Printer (3) is excluded here; it is handled by trySummon() in bot.ts.
	 */
	getAbilityPriority(creature, _controller) {
		const plasma = creature.player.plasma;

		if (plasma <= PLASMA_SURVIVAL_RESERVE) {
			return [ABILITY.ELECTRO_SHOCKER];
		}

		return [ABILITY.ELECTRO_SHOCKER, ABILITY.DISRUPTOR_BEAM];
	},

	/**
	 * Penalty for attackers targeting the Dark Priest.
	 *
	 * While DP has plasma the Plasma Field absorbs the hit — that attack is
	 * entirely wasted. If the ability is upgraded, melee strikes additionally
	 * trigger a 9-pure-damage counter, making physical contact even riskier.
	 */
	getTargetingPenalty(attacker, target, _abilityIndex, _controller) {
		const plasma = target.player.plasma;
		if (plasma <= 0) {
			return 0; // No shield — no special danger
		}

		const plasmaFieldAbility = target.abilities[ABILITY.PLASMA_FIELD];
		const upgraded = plasmaFieldAbility?.isUpgraded?.() ?? false;

		// Base penalty: the attack will be negated by Plasma Field
		let penalty = -200;

		// Upgraded counter-damage risk for melee attackers
		if (upgraded) {
			penalty -= 90;
		}

		return penalty;
	},
};

export default DarkPriestStrategy;
