import type BotController from '../bot';
import type { UnitBotStrategy } from '../bot';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import { Team, isTeam } from '../utility/team';

// Ability slot indices
const ABILITY = {
	BATTLE_CRY: 0, // passive onDamage/onStartPhase – bot never activates directly
	EXECUTIONER_AXE: 1, // onQuery, frontnback3hex, executes targets at ≤ 45 health
	DRAGON_FLIGHT: 2, // onQuery isMovementAbility:'safe', fly up to 10 hexes
	VISIBLE_STIGMATA: 3, // onQuery, transfer health to adjacent ally (max 50)
} as const;

/** Health threshold below which Executioner Axe can execute (instakill). */
const EXECUTE_THRESHOLD = 45;

/**
 * Health ratio above which Golden Wyrm is considered "high health" and will
 * deliberately seek positions surrounded by enemies to maximise Battle Cry
 * passive damage.
 */
const HIGH_HEALTH_RATIO = 0.65;

/** Health ratio below which Golden Wyrm should retreat. */
const RETREAT_HEALTH_RATIO = 0.3;

/**
 * Ally health ratio below which Visible Stigmata is considered worthwhile.
 * An ally below this threshold benefits significantly from a health transfer.
 */
const LOW_ALLY_HEALTH_RATIO = 0.45;

/**
 * Minimum distinct enemy units adjacent before Battle Cry positioning is
 * considered worthwhile. One enemy is not enough to justify being surrounded.
 */
const MIN_ENEMIES_FOR_BATTLE_CRY = 2;

/**
 * Golden Wyrm must retain at least this much health after Visible Stigmata
 * to avoid becoming an easy target. (Max transfer is 50, so this means
 * a minimum of ~100 hp remaining after donation.)
 */
const SAFE_STIGMATA_HEALTH = 150;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns distinct enemy creature count adjacent to `creature`. */
function countAdjacentEnemies(creature: Creature): number {
	const seen = new Set<number>();
	creature.adjacentHexes(1).forEach((hex: Hex) => {
		if (hex.creature instanceof Creature && isTeam(creature, hex.creature, Team.Enemy)) {
			seen.add(hex.creature.id);
		}
	});
	return seen.size;
}

/**
 * Returns the first Dark Priest without plasma found in adjacent hex range
 * (Executioner Axe's frontnback3hex is approximated by adjacentHexes).
 * A Dark Priest with 0 plasma cannot shield itself and is the highest-value
 * target even above the execution threshold check.
 */
function findDarkPriestInRange(creature: Creature): Creature | null {
	for (const hex of creature.adjacentHexes(1)) {
		if (
			hex.creature instanceof Creature &&
			isTeam(creature, hex.creature, Team.Enemy) &&
			hex.creature.isDarkPriest() &&
			hex.creature.player.plasma <= 0
		) {
			return hex.creature;
		}
	}
	return null;
}

/**
 * Returns true if any enemy in Executioner Axe range (approximated as
 * adjacent hexes) has health at or below the execution threshold.
 */
function hasExecutableTargets(creature: Creature): boolean {
	return creature
		.adjacentHexes(1)
		.some(
			(hex: Hex) =>
				hex.creature instanceof Creature &&
				isTeam(creature, hex.creature, Team.Enemy) &&
				hex.creature.health <= EXECUTE_THRESHOLD,
		);
}

/**
 * Returns true when there is an adjacent ally with critically low health
 * that Golden Wyrm can safely heal via Visible Stigmata without reducing
 * its own health below the safe threshold.
 */
function hasHealableAlly(creature: Creature): boolean {
	if (creature.health <= SAFE_STIGMATA_HEALTH) {
		return false;
	}
	return creature.adjacentHexes(1).some(
		(hex: Hex) =>
			hex.creature instanceof Creature &&
			isTeam(creature, hex.creature, Team.Ally) &&
			hex.creature !== creature &&
			hex.creature.health / hex.creature.stats.health < LOW_ALLY_HEALTH_RATIO &&
			hex.creature.health < hex.creature.stats.health,
	);
}

// ---------------------------------------------------------------------------
// Per-ability scorers
// ---------------------------------------------------------------------------

/**
 * Score a hex for Executioner Axe (ability 1).
 *
 * Priorities (highest to lowest):
 * 1. Dark Priest without plasma — ideal target regardless of health.
 * 2. Executable targets (health ≤ 45) — instakill; among these prefer
 *    higher-level targets with more energy remaining.
 * 3. Normal targets — prefer lower health (closer to execution threshold).
 */
function scoreExecutionerAxe(hex: Hex, activeCreature: Creature): number {
	const target = hex.creature;
	if (!(target instanceof Creature) || !isTeam(activeCreature, target, Team.Enemy)) {
		return Number.NEGATIVE_INFINITY;
	}

	// Highest priority: Dark Priest without plasma (unshielded)
	if (target.isDarkPriest() && target.player.plasma <= 0) {
		return 10000;
	}

	// Executable: instakill if health ≤ 45
	if (target.health <= EXECUTE_THRESHOLD) {
		let score = 5000;
		// Among executable targets prefer higher-level units (more energy = bigger threat)
		const level = typeof target.level === 'number' ? target.level : 1;
		score += level * 100;
		score += target.energy;
		return score;
	}

	// Normal attack: prefer lower health (closer to the execution threshold)
	let score = 500 - target.health;
	const healthRatio = target.health / target.stats.health;
	if (healthRatio < 0.25) {
		score += 200;
	} else if (healthRatio < 0.5) {
		score += 75;
	}

	return score;
}

/**
 * Score a destination hex for Dragon Flight (ability 2).
 *
 * Dragon Flight bypasses traps and lets Golden Wyrm reposition freely.
 * The scorer balances five goals:
 *
 * 1. Retreating: maximise distance from enemies.
 * 2. Landing adjacent to a Dark Priest without plasma for immediate execution.
 * 3. Landing adjacent to executable targets — extra bonus when Dragon Flight
 *    is upgraded (gives +25 offense on the next Executioner Axe hit).
 * 4. Landing surrounded by many enemies while at high health — ideal Battle
 *    Cry passive setup (deals 30 sonic to all adjacent enemies on next hit).
 * 5. Landing adjacent to a low-health ally for a Visible Stigmata heal.
 * 6. Protecting an ally by positioning between enemies and the ally; when
 *    Battle Cry is not yet upgraded, avoid being adjacent to allies since
 *    Battle Cry can damage them.
 */
function scoreDragonFlight(hex: Hex, activeCreature: Creature, controller: BotController): number {
	// Cannot land on an occupied hex (size-3 creature needs clear hexes)
	if (hex.creature instanceof Creature) {
		return Number.NEGATIVE_INFINITY;
	}

	// No benefit in staying at the same position
	if (hex.x === activeCreature.x && hex.y === activeCreature.y) {
		return Number.NEGATIVE_INFINITY;
	}

	const healthRatio = activeCreature.health / activeCreature.stats.health;
	const isRetreating = controller.isRetreating(activeCreature);
	const isHighHealth = healthRatio > HIGH_HEALTH_RATIO;

	// ── Retreat mode ──────────────────────────────────────────────────────────
	if (isRetreating) {
		const distFromEnemy = controller.closestDistanceToEnemy(hex);
		let score = distFromEnemy * 50;

		if (hex.trap) {
			score -= 300;
		}

		const adjacentAllyCount = hex
			.adjacentHex(1)
			.filter(
				(adj: Hex) =>
					adj.creature instanceof Creature &&
					adj.creature !== activeCreature &&
					isTeam(activeCreature, adj.creature, Team.Ally),
			).length;
		score += adjacentAllyCount * 60;

		const dropDist = controller.closestDistanceToDrop(hex);
		if (dropDist < Number.POSITIVE_INFINITY) {
			score += Math.max(0, 6 - dropDist) * 10;
		}

		return score;
	}

	// ── Aggressive/positioning mode ───────────────────────────────────────────
	let score = 0;
	const adjacentHexes = hex.adjacentHex(1);

	// Collect unique adjacent enemies and allies at this landing position
	const adjacentEnemyMap = new Map<number, Creature>();
	const adjacentAllyMap = new Map<number, Creature>();
	adjacentHexes.forEach((adj: Hex) => {
		if (!(adj.creature instanceof Creature)) return;
		if (isTeam(activeCreature, adj.creature, Team.Enemy)) {
			adjacentEnemyMap.set(adj.creature.id, adj.creature);
		} else if (adj.creature !== activeCreature && isTeam(activeCreature, adj.creature, Team.Ally)) {
			adjacentAllyMap.set(adj.creature.id, adj.creature);
		}
	});
	const adjacentEnemies = [...adjacentEnemyMap.values()];
	const adjacentAllies = [...adjacentAllyMap.values()];

	const executableTargets = adjacentEnemies.filter((e) => e.health <= EXECUTE_THRESHOLD);
	const darkPriestTarget = adjacentEnemies.find(
		(e) => e.isDarkPriest() && e.player.plasma <= 0,
	);

	const dragonFlightAbility = activeCreature.abilities[ABILITY.DRAGON_FLIGHT];
	const isDragonFlightUpgraded = dragonFlightAbility?.isUpgraded?.() ?? false;
	const battleCryAbility = activeCreature.abilities[ABILITY.BATTLE_CRY];
	const isBattleCryUpgraded = battleCryAbility?.isUpgraded?.() ?? false;

	// 1. Landing adjacent to Dark Priest without plasma (top offensive priority)
	if (darkPriestTarget) {
		score += 4000;
	}

	// 2. Landing adjacent to executable targets
	//    Upgraded Dragon Flight grants +25 offense on next Executioner Axe — even better.
	if (executableTargets.length > 0) {
		score += 2500;
		if (isDragonFlightUpgraded) {
			score += 800; // offense buff makes the follow-up execution more reliable
		}
		score += executableTargets.length * 200;
		const bestLevel = Math.max(
			...executableTargets.map((e) => (typeof e.level === 'number' ? e.level : 1)),
		);
		score += bestLevel * 50;
	}

	// 3. Surrounding self with many enemies when at high health (Battle Cry setup)
	//    Battle Cry deals 30 sonic to all adjacent enemies when Golden Wyrm takes damage.
	if (adjacentEnemies.length >= MIN_ENEMIES_FOR_BATTLE_CRY) {
		if (isHighHealth) {
			score += adjacentEnemies.length * 400 + 600;
		} else {
			// Still has some value even at lower health but not worth the risk as much
			score += adjacentEnemies.length * 80;
		}
	}

	// 4. Landing adjacent to a low-health ally for Visible Stigmata
	//    Only pursue if Golden Wyrm has enough health to safely donate.
	if (activeCreature.health > SAFE_STIGMATA_HEALTH) {
		const lowHealthAllies = adjacentAllies.filter(
			(a) => a.health / a.stats.health < LOW_ALLY_HEALTH_RATIO && a.health < a.stats.health,
		);
		if (lowHealthAllies.length > 0) {
			score += 1200;
		}
	}

	// 5. Ally protection: position between enemies and allies (cover role)
	//    If Battle Cry is not yet upgraded, avoid being adjacent to allies
	//    since Battle Cry can trigger and harm them.
	if (adjacentAllies.length > 0) {
		if (adjacentEnemies.length === 0) {
			const distFromEnemy = controller.closestDistanceToEnemy(hex);
			if (distFromEnemy >= 1 && distFromEnemy <= 3) {
				// Good interception position
				score += 300;
			}
			if (!isBattleCryUpgraded) {
				// Not adjacent to enemies here, so Battle Cry won't fire — being adjacent
				// to an ally is safe in this sub-case.
			}
		} else if (!isBattleCryUpgraded) {
			// Adjacent to both allies and enemies: Battle Cry would harm the allies.
			score -= adjacentAllies.length * 350;
		}
	}

	// Avoid traps
	if (hex.trap) {
		score -= 200;
	}

	// Drop collection opportunity
	const dropDist = controller.closestDistanceToDrop(hex);
	if (dropDist < Number.POSITIVE_INFINITY) {
		score += Math.max(0, 6 - dropDist) * 10;
	}

	return score;
}

/**
 * Score a hex for Visible Stigmata (ability 3).
 *
 * Transfers up to 50 health from Golden Wyrm to an adjacent ally.
 *
 * Priorities:
 * - Allies with the most missing health (higher deficit = more valuable heal).
 * - Allies critically low on health (urgency bonus).
 * - Higher-level allies — they are harder to replace and more impactful.
 * - Allies with more remaining energy — can still use their abilities and
 *   contribute meaningfully once healed.
 * - Allies that have upgraded abilities — worth more to keep alive.
 *
 * Safety gates:
 * - Penalise if the Wyrm's health would drop below a safe floor after the
 *   transfer — don't let a heal make Golden Wyrm an easy kill.
 * - Scale down reward when many energized enemies are present.
 */
function scoreVisibleStigmata(
	hex: Hex,
	activeCreature: Creature,
	controller: BotController,
): number {
	const target = hex.creature;
	if (
		!(target instanceof Creature) ||
		!isTeam(activeCreature, target, Team.Ally) ||
		target === activeCreature
	) {
		return Number.NEGATIVE_INFINITY;
	}

	// Target must not be at full health (ability requirement)
	if (target.health >= target.stats.health) {
		return Number.NEGATIVE_INFINITY;
	}

	const allyHealthRatio = target.health / target.stats.health;
	const missingHealth = target.stats.health - target.health;

	let score = missingHealth * 5; // more deficit = more valuable

	// Urgency bonuses
	if (allyHealthRatio < 0.25) {
		score += 800;
	} else if (allyHealthRatio < LOW_ALLY_HEALTH_RATIO) {
		score += 300;
	}

	// Higher-level allies are more impactful — reward healing them
	const level = typeof target.level === 'number' ? target.level : 1;
	score += level * 60;

	// Energy: allies with more remaining energy can still act effectively once healed
	const energyRatio = target.stats.energy > 0 ? target.energy / target.stats.energy : 0;
	score += Math.round(energyRatio * 200);

	// Upgraded abilities: allies with at least one upgraded ability are more valuable
	const upgradedAbilityCount = target.abilities.filter(
		(ability) => typeof ability?.isUpgraded === 'function' && ability.isUpgraded(),
	).length;
	score += upgradedAbilityCount * 120;

	// Safety check: penalise if Wyrm health after donation would be risky
	const transferAmount = Math.min(missingHealth, 50);
	const wyrmHealthAfter = activeCreature.health - transferAmount;
	if (wyrmHealthAfter < SAFE_STIGMATA_HEALTH) {
		score -= 600; // risky; only acceptable for truly critical allies
	}

	// Danger factor: many energized enemies make self-weakening very risky
	const energizedEnemyCount = (controller.game.creatures as Array<Creature | null>).filter(
		(c) =>
			c &&
			!c.dead &&
			!c.temp &&
			isTeam(activeCreature, c, Team.Enemy) &&
			c.energy / c.stats.energy > 0.5,
	).length;
	score -= energizedEnemyCount * 80;

	return score;
}

// ---------------------------------------------------------------------------
// Strategy export
// ---------------------------------------------------------------------------

const GoldenWyrmStrategy: UnitBotStrategy = {
	/**
	 * Retreat when health drops below 30 %.
	 * Golden Wyrm is a high-health tank; Battle Cry passive is only useful when
	 * it actually survives hits, so it should not fight at critically low health.
	 */
	isRetreating(creature, _controller) {
		const healthRatio = creature.health / creature.stats.health;
		return healthRatio < RETREAT_HEALTH_RATIO;
	},

	/**
	 * Golden Wyrm is a level-7 front-line brawler.
	 * Prefer aggressive positioning close to the enemy side so it can
	 * intercept enemies and trigger Battle Cry effectively.
	 */
	getPreferredX(creature, controller) {
		const gridRow = controller.game.grid?.hexes[0];
		const boardWidth = gridRow ? gridRow.length - 1 : 15;
		return creature.player.flipped ? boardWidth * 0.2 : boardWidth * 0.8;
	},

	/**
	 * Move-hex scoring for Golden Wyrm.
	 *
	 * At high health: actively seek positions adjacent to multiple enemies so
	 * that Battle Cry passive deals maximum collateral damage when triggered.
	 *
	 * At medium/lower health: still advance but avoid being surrounded by
	 * more enemies than is safe; leave Dragon Flight as the positioning tool.
	 */
	scoreMoveHex(hex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) return undefined;

		if (controller.isRetreating(activeCreature)) return undefined;

		let score = 0;
		const healthRatio = activeCreature.health / activeCreature.stats.health;
		const isHighHealth = healthRatio > HIGH_HEALTH_RATIO;

		const adjacentHexes = hex.adjacentHex(1);
		const adjacentEnemyCount = adjacentHexes.filter(
			(adj: Hex) =>
				adj.creature instanceof Creature && isTeam(activeCreature, adj.creature, Team.Enemy),
		).length;

		if (isHighHealth) {
			// Deliberately seek out positions surrounded by enemies for Battle Cry
			score += adjacentEnemyCount * 200;
			if (adjacentEnemyCount >= MIN_ENEMIES_FOR_BATTLE_CRY) {
				score += 400;
			}
		} else {
			// Advance toward enemies but don't deliberately get surrounded
			score += Math.min(adjacentEnemyCount, 1) * 100;
		}

		// Trap avoidance scales with injury level
		if (hex.trap) {
			score -= Math.round(80 + (1 - healthRatio) * 270);
		}

		// Zone preference: push toward the front
		const preferredX = controller.getPreferredX(activeCreature);
		score -= Math.abs(hex.x - preferredX) * 8;

		return score;
	},

	/**
	 * Routes each ability slot to its dedicated scorer.
	 */
	scoreAbilityHex(hex, abilityIndex, controller) {
		const activeCreature = controller.game.activeCreature;
		if (!activeCreature) return undefined;

		if (abilityIndex === ABILITY.EXECUTIONER_AXE) {
			return scoreExecutionerAxe(hex, activeCreature);
		}

		if (abilityIndex === ABILITY.DRAGON_FLIGHT) {
			return scoreDragonFlight(hex, activeCreature, controller);
		}

		if (abilityIndex === ABILITY.VISIBLE_STIGMATA) {
			return scoreVisibleStigmata(hex, activeCreature, controller);
		}

		return undefined;
	},

	/**
	 * Ability priority for Golden Wyrm each turn.
	 *
	 * Retreating:
	 *   Dragon Flight only — escape using safe flying movement.
	 *
	 * Dark Priest without plasma is adjacent:
	 *   Executioner Axe first — hit the unshielded Dark Priest immediately.
	 *   Dragon Flight next — reposition after.
	 *   Visible Stigmata last — heal if able.
	 *
	 * Executable targets adjacent + Dragon Flight upgraded:
	 *   Dragon Flight first — land next to a target, gain the +25 offense buff.
	 *   Executioner Axe next — execute the weakened enemy with the bonus.
	 *   Visible Stigmata last.
	 *
	 * Executable targets adjacent (no upgrade):
	 *   Executioner Axe first — execute directly.
	 *   Dragon Flight next — reposition or reach new targets.
	 *   Visible Stigmata last.
	 *
	 * High health + already surrounded by multiple enemies (Battle Cry setup):
	 *   Executioner Axe first — deal damage and stay in position to trigger Battle Cry.
	 *   Visible Stigmata next — heal an ally if adjacent.
	 *   Dragon Flight last — reposition if needed.
	 *
	 * High health, not yet surrounded:
	 *   Dragon Flight first — fly into the middle of enemies.
	 *   Executioner Axe next — attack after repositioning.
	 *   Visible Stigmata last.
	 *
	 * Ally needs healing and Wyrm can safely donate:
	 *   Visible Stigmata first — heal the ally.
	 *   Dragon Flight next — reposition afterward.
	 *   Executioner Axe last.
	 *
	 * Default:
	 *   Executioner Axe → Dragon Flight → Visible Stigmata.
	 *
	 * Battle Cry (0) is passive and never in the list.
	 */
	getAbilityPriority(creature, controller) {
		// Flee via Dragon Flight when critically low health
		if (controller.isRetreating(creature)) {
			return [ABILITY.DRAGON_FLIGHT];
		}

		const healthRatio = creature.health / creature.stats.health;
		const isHighHealth = healthRatio > HIGH_HEALTH_RATIO;
		const darkPriestInRange = findDarkPriestInRange(creature);
		const executableNearby = hasExecutableTargets(creature);
		const allyNeedsHealing = hasHealableAlly(creature);
		const dragonFlightAbility = creature.abilities[ABILITY.DRAGON_FLIGHT];
		const isDragonFlightUpgraded = dragonFlightAbility?.isUpgraded?.() ?? false;
		const adjacentEnemyCount = countAdjacentEnemies(creature);

		// Unshielded Dark Priest adjacent: strike it before it can spend plasma
		if (darkPriestInRange) {
			return [ABILITY.EXECUTIONER_AXE, ABILITY.DRAGON_FLIGHT, ABILITY.VISIBLE_STIGMATA];
		}

		// Executable targets + upgraded Dragon Flight: fly first for offense bonus, then execute
		if (executableNearby && isDragonFlightUpgraded) {
			return [ABILITY.DRAGON_FLIGHT, ABILITY.EXECUTIONER_AXE, ABILITY.VISIBLE_STIGMATA];
		}

		// Executable targets without flight upgrade: execute immediately
		if (executableNearby) {
			return [ABILITY.EXECUTIONER_AXE, ABILITY.DRAGON_FLIGHT, ABILITY.VISIBLE_STIGMATA];
		}

		// High health and already surrounded — ideal Battle Cry position; stay and attack
		if (isHighHealth && adjacentEnemyCount >= MIN_ENEMIES_FOR_BATTLE_CRY) {
			return [ABILITY.EXECUTIONER_AXE, ABILITY.VISIBLE_STIGMATA, ABILITY.DRAGON_FLIGHT];
		}

		// High health but not yet surrounded — fly into a better Battle Cry position
		if (isHighHealth) {
			return [ABILITY.DRAGON_FLIGHT, ABILITY.EXECUTIONER_AXE, ABILITY.VISIBLE_STIGMATA];
		}

		// Adjacent ally critically low on health and Wyrm can safely donate
		if (allyNeedsHealing) {
			return [ABILITY.VISIBLE_STIGMATA, ABILITY.DRAGON_FLIGHT, ABILITY.EXECUTIONER_AXE];
		}

		// Default: attack if possible, reposition, then heal
		return [ABILITY.EXECUTIONER_AXE, ABILITY.DRAGON_FLIGHT, ABILITY.VISIBLE_STIGMATA];
	},

	/**
	 * Battle Cry deals 30 sonic damage to all adjacent units when Golden Wyrm
	 * is damaged. Any attacker using a melee or close-range ability risks
	 * taking this retaliation. Return a penalty to discourage reckless attacks.
	 */
	getTargetingPenalty(_attacker, _target, _abilityIndex, _controller) {
		// -30 represents the sonic damage from Battle Cry retaliation
		return -30;
	},

	/**
	 * Counter-focus recommendation vs Golden Wyrm:
	 * - Keep pressure on it as a priority target.
	 * - Prefer applying fatigue while it is still susceptible.
	 */
	getCounterTargetingModifier(_attacker, target, _abilityIndex, _controller) {
		let score = 220; // baseline focus on Golden Wyrm
		if (!target.protectedFromFatigue && !target.isFatigued()) {
			score += 220; // strong preference to keep fatigue uptime
		}
		return score;
	},

	/**
	 * Zone-control pressure around Golden Wyrm:
	 * - Avoid standing adjacent, especially with low-health units (Executioner Axe).
	 * - Avoid clumping allies nearby (Battle Cry punishes clustered formations).
	 */
	getProximityPenalty(mover, _enemy, destination, _controller) {
		const adjacentAllyCount = destination
			.adjacentHex(1)
			.filter(
				(adjacentHex: Hex) =>
					adjacentHex.creature instanceof Creature &&
					adjacentHex.creature !== mover &&
					isTeam(mover, adjacentHex.creature, Team.Ally),
			).length;

		let penalty = -220;
		penalty -= adjacentAllyCount * 80;

		if (mover.health <= 45) {
			penalty -= 900;
		} else if (mover.health <= 70) {
			penalty -= 300;
		}

		return penalty;
	},
};

export default GoldenWyrmStrategy;
