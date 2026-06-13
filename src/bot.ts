import type Game from './game';
import { Creature } from './creature';
import { CreatureType } from './data/types';
import { Hex } from './utility/hex';
import { getPointFacade } from './utility/pointfacade';
import type { Trap } from './utility/trap';
import { Team, isTeam } from './utility/team';
import { getSummonCandidates } from './utility/summon-candidates';
import SnowBunnyStrategy from './bots/Snow-Bunny';
import DarkPriestStrategy from './bots/Dark-Priest';
import AbolishedStrategy from './bots/Abolished';
import GoldenWyrmStrategy from './bots/Golden-Wyrm';
import GumbleStrategy from './bots/Gumble';
import VehemothStrategy from './bots/Vehemoth';
import StomperStrategy from './bots/Stomper';
import CycloperStrategy from './bots/Cycloper';
import ImpalerStrategy from './bots/Impaler';
import CyberWolfStrategy from './bots/Cyber-Wolf';
import BountyHunterStrategy from './bots/Bounty-Hunter';
import UncleFungusStrategy from './bots/Uncle-Fungus';
import InfernalStrategy from './bots/Infernal';
import HornHeadStrategy from './bots/Horn-Head';
import KnightmareStrategy from './bots/Knightmare';
import SwineThugStrategy from './bots/Swine-Thug';
import HeadlessStrategy from './bots/Headless';
import NutcaseStrategy from './bots/Nutcase';
import ScavengerStrategy from './bots/Scavenger';
import ChimeraStrategy from './bots/Chimera';

/**
 * Optional per-unit behaviour overrides for BotController.
 * Each method receives the controller instance so it can call any
 * generic helper (closestDistanceToEnemy, getPreferredX, …) as needed.
 * Return `undefined` from any hook to fall back to the generic logic.
 */
export interface UnitBotStrategy {
	/** Override move-hex scoring for a non-retreating creature. */
	scoreMoveHex?(hex: Hex, controller: BotController): number | undefined;
	/**
	 * Override ability-hex scoring for a specific ability slot.
	 * @param abilityIndex The index of the ability currently being queried (0–3).
	 */
	scoreAbilityHex?(hex: Hex, abilityIndex: number, controller: BotController): number | undefined;
	/**
	 * Optional minimum score threshold for selecting a queried ability target hex.
	 * If the best reachable target scores below this value, the bot skips that
	 * ability for the current turn and continues planning.
	 */
	getAbilityMinScore?(
		creature: Creature,
		abilityIndex: number,
		controller: BotController,
	): number | undefined;
	/** Override the retreat health/energy threshold check. */
	isRetreating?(creature: Creature, controller: BotController): boolean | undefined;
	/** Override the preferred board-x position for zone scoring. */
	getPreferredX?(creature: Creature, controller: BotController): number | undefined;
	/**
	 * Return ability slot indices in the desired try-order for this turn.
	 * Slots not listed are never tried; the generic guards (used, failed,
	 * require) still apply per slot.
	 */
	getAbilityPriority?(creature: Creature, controller: BotController): number[];
	/**
	 * Declares how dangerous it is for an attacker to use a given ability
	 * against this unit. Implemented by the TARGET unit's strategy file so
	 * that any attacker can query retaliation/debuff risk without knowing the
	 * specifics of other units.
	 *
	 * Return a negative score modifier (e.g. -300 for lethal retaliation) or
	 * 0 if there is no special danger. The caller adds this to its base score.
	 *
	 * @param attacker  The creature about to attack.
	 * @param target    This unit (the one being attacked).
	 * @param abilityIndex  The attacker's ability slot being used.
	 * @param controller  The shared BotController instance.
	 */
	getTargetingPenalty?(
		attacker: Creature,
		target: Creature,
		abilityIndex: number,
		controller: BotController,
	): number;
	/**
	 * Optional target-owned score modifier for opponents attacking this unit.
	 * Unlike `getTargetingPenalty`, this may return positive or negative values.
	 */
	getCounterTargetingModifier?(
		attacker: Creature,
		target: Creature,
		abilityIndex: number,
		controller: BotController,
	): number;
	/**
	 * Optional score modifier for movement destinations adjacent to this unit.
	 * Implemented by the ENEMY unit's strategy file to express zone-control
	 * danger (e.g. retaliation auras, execution threat, anti-clumping pressure).
	 */
	getProximityPenalty?(
		mover: Creature,
		enemy: Creature,
		destination: Hex,
		controller: BotController,
	): number;
}

/** Registry of unit-specific strategies, keyed by creature.type (e.g. 'S1'). */
export const unitStrategies: Partial<Record<string, UnitBotStrategy>> = {
	'--': DarkPriestStrategy,
	A3: CyberWolfStrategy,
	S1: SnowBunnyStrategy,
	E3: StomperStrategy,
	S7: VehemothStrategy,
	P7: AbolishedStrategy,
	A7: GoldenWyrmStrategy,
	P1: GumbleStrategy,
	W3: CycloperStrategy,
	S5: ImpalerStrategy,
	A2: BountyHunterStrategy,
	G3: UncleFungusStrategy,
	L2: InfernalStrategy,
	W5: HornHeadStrategy,
	S4: KnightmareStrategy,
	A1: SwineThugStrategy,
	W4: HeadlessStrategy,
	E2: NutcaseStrategy,
	P3: ScavengerStrategy,
	P6: ChimeraStrategy,
};

type BotPendingAction =
	| { type: 'ability'; abilityIndex: number }
	| { type: 'move' }
	| { type: 'summon'; abilityIndex: number; summonType: CreatureType };

type QueryHandlers = {
	onSelect: (hex: Hex) => void;
	onConfirm: (hex: Hex) => void;
};

export default class BotController {
	game: Game;
	decisionTimeout: ReturnType<typeof setTimeout> | null = null;
	pendingAction: BotPendingAction | null = null;
	pendingActionSetAt = 0;
	activeCreatureId: number | null = null;
	decisionCount = 0;
	moveAttempted = false;
	failedAbilityIds = new Set<number>();
	isResolvingQuery = false;
	stalePendingActionMs = 2200;
	/** Delay before the onSelect callback fires in resolveQuery (ms). */
	selectDelayMs = 50;
	/** Delay before the onConfirm callback fires in resolveQuery (ms). */
	confirmDelayMs = 140;
	/** Default delay passed to queueDecision() when scheduling a new turn. */
	turnDelayMs = 300;
	/** Delay for the very first queueDecision() call when a new creature turn starts.
	 *  Defaults to turnDelayMs * 4 + 150 to give the UI time to settle.
	 *  Override this in simulation environments to reduce fake-time overhead. */
	startTurnDelayMs = -1; // -1 = use default formula
	/** The game round during which damage was last dealt to any creature. */
	lastDamageRound = 0;

	constructor(game: Game) {
		this.game = game;
		this.game.signals.creature.add(this.handleCreatureSignal, this);
	}

	/** Returns the unit-specific strategy for the given creature, if one exists. */
	getStrategyFor(creature: Creature): UnitBotStrategy | undefined {
		return unitStrategies[creature.type as string];
	}

	handleCreatureSignal(message: string, payload?: { creature?: Creature }) {
		if (message === 'activate') {
			this.startTurn(payload?.creature);
			return;
		}

		if (!this.isBotTurn()) {
			return;
		}

		if (
			(message === 'abilityend' || message === 'movementComplete') &&
			payload?.creature?.id === this.game.activeCreature?.id
		) {
			this.queueDecision(this.turnDelayMs);
		}
	}

	startTurn(creature?: Creature) {
		this.clearDecisionTimeout();
		this.clearPendingAction();
		this.isResolvingQuery = false;
		this.activeCreatureId = creature?.id ?? null;
		this.decisionCount = 0;
		this.moveAttempted = false;
		this.failedAbilityIds.clear();

		if (this.isBotTurn()) {
			if (creature?.player.hasLost) {
				// Dazzled unit — the creature's activate() will handle the skip
				return;
			}
			if (creature?.isFrozen() || creature?.isDizzy()) {
				// Frozen/dizzied unit — the creature's activate() interval will handle the skip
				return;
			}
			// Minimize the combat log so it doesn't obstruct bot actions
			this.game.UI?.chat?.hide();
			this.queueDecision(
				this.startTurnDelayMs >= 0 ? this.startTurnDelayMs : this.turnDelayMs * 4 + 150,
			);
		}
	}

	clearDecisionTimeout() {
		if (this.decisionTimeout) {
			clearTimeout(this.decisionTimeout);
			this.decisionTimeout = null;
		}
	}

	/**
	 * Called whenever any creature takes damage. Resets the stagnation clock.
	 */
	notifyDamage() {
		this.lastDamageRound = this.game.turn;
	}

	/**
	 * Returns a 0–10 aggression multiplier that grows as a creature ages
	 * (turns it has personally taken) and when no damage has been dealt
	 * globally for a while, breaking stagnant stand-offs.
	 *
	 * - Age pressure: rises after the creature has taken 4 turns (+0.5 per turn).
	 * - Stagnation pressure: rises after 3 global damage-free rounds (+1.5 per round).
	 */
	getAggressionFactor(creature: Creature): number {
		const ageFactor = Math.max(0, creature.turnsActive - 4) * 0.8;
		const stagnantRounds = this.game.turn - this.lastDamageRound;
		const stagnationFactor = Math.max(0, stagnantRounds - 3) * 2.5;
		const engagementPressure = Math.max(0, this.getTeamEngagementPressure(creature));
		return Math.min(10, ageFactor + stagnationFactor + engagementPressure * 1.25);
	}

	private getTeamEngagementPressure(creature: Creature): number {
		const allyPower = this.getTeamCombatPower(creature, Team.Ally);
		const enemyPower = this.getTeamCombatPower(creature, Team.Enemy);
		const advantage = allyPower - enemyPower;

		// Keep pressure bounded so it nudges behavior without overriding tactical safety.
		return Math.max(-4, Math.min(4, advantage / 350));
	}

	private getTeamCombatPower(reference: Creature, relation: Team): number {
		let aliveUnits = 0;
		let totalHealthRatio = 0;
		let totalLevels = 0;
		let upgradedAbilities = 0;

		this.game.creatures.forEach((creature) => {
			if (!creature || creature.dead || creature.temp || !isTeam(reference, creature, relation)) {
				return;
			}

			aliveUnits += 1;

			const maxHealth = Number(creature.stats?.health ?? 0);
			if (maxHealth > 0) {
				totalHealthRatio += Math.max(0, Math.min(1, creature.health / maxHealth));
			}

			totalLevels += Number.isFinite(Number(creature.level)) ? Number(creature.level) : 0;

			upgradedAbilities += creature.abilities.filter(
				(ability) => typeof ability?.isUpgraded === 'function' && ability.isUpgraded(),
			).length;
		});

		return aliveUnits * 220 + totalHealthRatio * 140 + totalLevels * 55 + upgradedAbilities * 90;
	}

	isBotTurn() {
		const activeCreature = this.game.activeCreature;
		return Boolean(
			activeCreature &&
				activeCreature.player.controller === 'bot' &&
				!this.game.multiplayer &&
				this.game.gameState === 'playing',
		);
	}

	queueDecision(delay = 300) {
		if (!this.isBotTurn()) {
			return;
		}

		this.clearDecisionTimeout();
		this.decisionTimeout = setTimeout(() => {
			this.takeTurn();
		}, delay);
	}

	takeTurn() {
		if (!this.isBotTurn()) {
			return;
		}

		if (this.pendingAction) {
			const staleMs = Date.now() - this.pendingActionSetAt;
			if (staleMs > this.stalePendingActionMs) {
				// Force-clear even if isResolvingQuery is stuck true from a failed chain.
				this.isResolvingQuery = false;
				this.clearPendingAction({ markFailedAbility: true });
				this.queueDecision(120);
			} else if (!this.isResolvingQuery) {
				// No active resolution cycle driving progress; schedule a retry after
				// the remaining stale window so we don't just silently block forever.
				this.queueDecision(Math.max(200, this.stalePendingActionMs - staleMs + 100));
			}
			return;
		}

		const activeCreature = this.game.activeCreature;
		if (!activeCreature || activeCreature.id !== this.activeCreatureId) {
			this.startTurn(activeCreature);
			return;
		}

		if (this.game.freezedInput || this.game.turnThrottle) {
			this.queueDecision(200);
			return;
		}

		if (this.decisionCount >= 12) {
			this.game.skipTurn({ noTooltip: true });
			return;
		}
		this.decisionCount += 1;

		// Low health / energy creatures flee first
		if (!this.moveAttempted && this.isRetreating(activeCreature)) {
			// Prefer a movement ability to avoid traps when retreating
			if (
				this.bestMovePathCrossesOrLandsOnTrap() &&
				this.tryMovementAbility({ requireTrapSafe: true })
			) {
				return;
			}
			if (this.tryMove()) {
				return;
			}
		}

		if (this.tryUseOffensiveAbility()) {
			return;
		}

		if (this.trySummon()) {
			return;
		}

		if (!this.moveAttempted) {
			// If the best walking path would cross or land on a trap, use a movement
			// ability (teleport / flying) to bypass it if one is available.
			if (
				this.bestMovePathCrossesOrLandsOnTrap() &&
				this.tryMovementAbility({ requireTrapSafe: true })
			) {
				return;
			}
			if (this.tryMove()) {
				return;
			}
		}

		if (this.tryUseOffensiveAbility()) {
			return;
		}

		this.game.skipTurn({ noTooltip: true });
	}

	tryUseOffensiveAbility() {
		const activeCreature = this.game.activeCreature;
		if (!activeCreature) {
			return false;
		}

		const strategy = this.getStrategyFor(activeCreature);
		const abilityOrder =
			strategy?.getAbilityPriority?.(activeCreature, this) ??
			activeCreature.abilities.map((_, i) => i);

		for (const i of abilityOrder) {
			const ability = activeCreature.abilities[i];
			if (!ability || this.failedAbilityIds.has(i)) {
				continue;
			}

			if (activeCreature.isDarkPriest() && i === 3) {
				continue;
			}

			if (
				ability.getTrigger() !== 'onQuery' ||
				ability.used ||
				typeof ability.require !== 'function'
			) {
				continue;
			}

			try {
				if (!ability.require()) {
					continue;
				}
			} catch {
				continue;
			}

			this.setPendingAction({
				type: 'ability',
				abilityIndex: i,
			});
			const previousQueryOpt = this.game.grid?.lastQueryOpt;
			try {
				ability.use();
			} catch {
				// Ability threw (e.g. TypeError accessing undefined position).
				// Treat as a failed ability and try the next one.
				this.clearPendingAction();
				this.failedAbilityIds.add(i);
				continue;
			}

			// Case A: resolveQuery already ran synchronously with no targets and cleared
			// pendingAction (empty query path).  failedAbilityIds was already updated.
			if (this.pendingAction === null) {
				continue;
			}

			// Case B: ability.use() returned without opening any query at all
			// (require() failed inside use(), or query() bailed early).
			if (this.game.grid?.lastQueryOpt === previousQueryOpt) {
				this.clearPendingAction();
				this.failedAbilityIds.add(i);
				continue;
			}

			// Case C: query opened successfully — wait for resolveQuery callback.
			// Add a stale-recovery insurance timer: if the resolution timers fire normally
			// they call queueDecision which cancels this; if resolveQuery was skipped due
			// to a stale isResolvingQuery=true, this fires and the stale path recovers.
			if (this.pendingAction !== null) {
				this.queueDecision(this.stalePendingActionMs + 200);
			}
			return true;
		}

		return false;
	}

	trySummon() {
		const activeCreature = this.game.activeCreature;
		if (!activeCreature?.isDarkPriest()) {
			return false;
		}

		const ability = activeCreature.abilities[3];
		if (
			!ability ||
			ability.used ||
			this.failedAbilityIds.has(3) ||
			typeof ability.require !== 'function' ||
			!ability.require()
		) {
			return false;
		}

		const summonType = this.chooseSummonType();
		if (!summonType || typeof ability.materialize !== 'function') {
			return false;
		}

		this.setPendingAction({
			type: 'summon',
			abilityIndex: 3,
			summonType,
		});
		ability.materialize(summonType);
		return true;
	}

	tryMove() {
		const activeCreature = this.game.activeCreature;
		if (!activeCreature || activeCreature.remainingMove <= 0) {
			this.moveAttempted = true;
			return false;
		}

		if (!activeCreature.stats.moveable) {
			this.moveAttempted = true;
			return false;
		}

		this.setPendingAction({ type: 'move' });
		this.moveAttempted = true;
		activeCreature.queryMove();
		// If queryHexes wasn't reached (noActionPossible skips it for bots), resolveQuery
		// was never called so pendingAction stays set with no resolver — clear immediately.
		if (this.pendingAction !== null && !this.isResolvingQuery) {
			this.clearPendingAction();
			return false;
		}
		// resolveQuery was entered (isResolvingQuery=true) but may have been skipped if a
		// previous call left it stuck true.  Schedule a stale-recovery check as insurance:
		// if the normal resolution timers (50ms + 140ms) fire they call queueDecision which
		// cancels this; if they don't, we recover via the stale-action path in takeTurn.
		if (this.pendingAction !== null) {
			this.queueDecision(this.stalePendingActionMs + 200);
		}
		return true;
	}

	chooseSummonType() {
		const activeCreature = this.game.activeCreature;
		if (!activeCreature) {
			return undefined;
		}

		// Exclude types already placed (real creatures) or currently pending as temp
		// creatures from a previous materialize that hasn't been confirmed yet.
		const unavailable = new Set([
			...activeCreature.player.creatures.map((creature) => creature.type),
			...this.game.creatures
				.filter((c) => c?.temp && c.team === activeCreature.team)
				.map((c) => c.type),
		]);
		const affordableCreatures = getSummonCandidates(
			this.game,
			activeCreature.player.availableCreatures,
			{
				excludeTypes: unavailable,
				requireAffordable: true,
				plasma: activeCreature.player.plasma,
			},
		)
			.filter((type) => {
				// Skip creatures whose ability scripts haven't finished loading yet
				const stats = this.game.retrieveCreatureStats(type);
				return stats != null && this.game.abilities[stats.id] != null;
			})
			.map((type) => {
				const stats = this.game.retrieveCreatureStats(type);
				const level = Number.parseInt(type.substring(1, 2), 10);
				const cost = level + Number(stats?.size ?? 0);
				return { type, cost };
			});

		if (affordableCreatures.length === 0) {
			return undefined;
		}

		const randomIndex = Math.floor(Math.random() * affordableCreatures.length);
		return affordableCreatures[randomIndex]?.type;
	}

	shouldAutoResolveQuery() {
		return this.isBotTurn() && this.pendingAction !== null;
	}

	resolveQuery(queryOptions: { hexes: Hex[] }, handlers: QueryHandlers) {
		if (!this.shouldAutoResolveQuery() || this.isResolvingQuery) {
			return;
		}

		const failPendingAction = () => {
			this.clearPendingAction({ markFailedAbility: true });
			this.queueDecision(120);
		};

		const chosenHex = this.chooseHexForCurrentQuery(queryOptions.hexes);
		if (!chosenHex) {
			failPendingAction();
			return;
		}

		this.isResolvingQuery = true;

		setTimeout(() => {
			if (!this.isBotTurn()) {
				return;
			}
			try {
				handlers.onSelect(chosenHex);
			} catch {
				this.isResolvingQuery = false;
				failPendingAction();
			}
		}, this.selectDelayMs);

		setTimeout(() => {
			if (!this.isBotTurn()) {
				this.isResolvingQuery = false;
				return;
			}
			this.isResolvingQuery = false;
			try {
				handlers.onConfirm(chosenHex);
			} catch {
				// Ensure isResolvingQuery is cleared so the next resolveQuery() call is
				// not blocked by a stale true value from a chained query that was started
				// inside onConfirm before it threw.
				this.isResolvingQuery = false;
				failPendingAction();
				return;
			}
			// Clear pendingAction synchronously after onConfirm returns.
			// Using setTimeout(0) is unreliable: sinon fake timers enforce a 1ms minimum
			// delay, so a setTimeout(0) fires at the same tick as setTimeout(1) —
			// AFTER any timer scheduled inside onConfirm (e.g. movementComplete).
			// Clearing here ensures pendingAction is null when movementComplete fires
			// its callback, preventing queryHexes from re-entering resolveQuery.
			// The guard `!isResolvingQuery` protects chained ability queries: if a
			// second query opened during onConfirm it set isResolvingQuery=true, so
			// we skip the clear and let that chain's resolution cycle clear it instead.
			if (this.pendingAction && !this.isResolvingQuery) {
				this.clearPendingAction();
			}
			// Always keep a fallback decision in case no follow-up signal arrives.
			// If a chained query starts during onConfirm, defer fallback scheduling
			// to the chained resolution cycle instead.
			if (!this.isResolvingQuery) {
				this.queueDecision(this.confirmDelayMs * 9);
			}
		}, this.confirmDelayMs);
	}

	chooseHexForCurrentQuery(hexes: Hex[]) {
		const activeCreature = this.game.activeCreature;
		const action = this.pendingAction;
		if (!activeCreature || !action) {
			return undefined;
		}

		const candidates = this.getUniqueHexes(hexes).filter(Boolean);
		if (candidates.length === 0) {
			return undefined;
		}

		if (action.type === 'move') {
			const filtered = candidates.filter(
				(hex) => !(hex.x === activeCreature.x && hex.y === activeCreature.y),
			);
			const retreating = this.isRetreating(activeCreature);
			const scored = filtered
				.map((hex) => ({
					hex,
					score: this.scoreMoveHex(hex),
					trapPenalty: this.getMovePathTrapPenalty(activeCreature, hex, { retreating }),
				}))
				.sort((left, right) => right.score - left.score);

			const best = scored[0];
			if (!best) {
				return undefined;
			}

			if (this.shouldWaitInsteadOfRiskyMove(activeCreature, best, scored)) {
				return undefined;
			}

			return best.hex;
		}

		if (action.type === 'summon') {
			return this.pickBestHex(candidates, (hex) => this.scoreSummonHex(hex));
		}

		const scored = candidates
			.map((hex) => ({
				hex,
				score: this.scoreAbilityHex(hex),
			}))
			.filter((entry) => Number.isFinite(entry.score))
			.sort((left, right) => right.score - left.score);

		const best = scored[0];
		if (!best) {
			return undefined;
		}

		if (action.type === 'ability') {
			const strategy = this.getStrategyFor(activeCreature);
			const minScore = strategy?.getAbilityMinScore?.(activeCreature, action.abilityIndex, this);
			if (typeof minScore === 'number' && best.score < minScore) {
				return undefined;
			}
		}

		return best.hex;
	}

	getUniqueHexes(hexes: Hex[]) {
		const byCoord = new Map<string, Hex>();
		hexes.forEach((hex) => {
			if (hex) {
				byCoord.set(`${hex.x},${hex.y}`, hex);
			}
		});
		return [...byCoord.values()];
	}

	pickBestHex(hexes: Hex[], scorer: (hex: Hex) => number) {
		if (!hexes.length) {
			return undefined;
		}

		return hexes
			.map((hex) => ({ hex, score: scorer(hex) }))
			.sort((left, right) => right.score - left.score)[0]?.hex;
	}

	/**
	 * Returns the preferred x-coordinate for a creature using a linear gradient:
	 * - Dark Priest (treated as level 0): deepest home side (~10% in)
	 * - Level 1–7: linearly from home (~10%) to enemy side (~90%)
	 * Accounts for which side the player started on via `player.flipped`.
	 * Unit strategies may override this via `UnitBotStrategy.getPreferredX`.
	 */
	getPreferredX(creature: Creature): number {
		const strategy = this.getStrategyFor(creature);
		if (strategy?.getPreferredX) {
			const override = strategy.getPreferredX(creature, this);
			if (override !== undefined) return override;
		}

		const gridRow = this.game.grid.hexes[0];
		const boardWidth = gridRow ? gridRow.length - 1 : 15;
		const flipped = creature.player.flipped;

		// Dark Priest treated as level 0 for positioning
		const level = creature.isDarkPriest() ? 0 : (creature.level as number);
		const t = level / 7; // 0 = full home, 1 = full enemy side

		const homeX = flipped ? boardWidth * 0.9 : boardWidth * 0.1;
		const enemyX = flipped ? boardWidth * 0.1 : boardWidth * 0.9;

		return homeX + t * (enemyX - homeX);
	}

	scoreMoveHex(hex: Hex) {
		const activeCreature = this.game.activeCreature;
		if (!activeCreature) {
			return Number.NEGATIVE_INFINITY;
		}

		if (this.isRetreating(activeCreature)) {
			return this.scoreRetreatHex(hex);
		}

		const strategy = this.getStrategyFor(activeCreature);
		if (strategy?.scoreMoveHex) {
			const score = strategy.scoreMoveHex(hex, this);
			if (score !== undefined) return score;
		}

		const adjHexes = hex.adjacentHex(1);
		const adjacentEnemyCreatures = new Map<number, Creature>();
		adjHexes.forEach((adjacentHex) => {
			if (
				adjacentHex.creature instanceof Creature &&
				isTeam(activeCreature, adjacentHex.creature, Team.Enemy)
			) {
				adjacentEnemyCreatures.set(adjacentHex.creature.id, adjacentHex.creature);
			}
		});
		const adjacentEnemyCount = adjacentEnemyCreatures.size;

		const aggression = this.getAggressionFactor(activeCreature);

		let score = 0;
		// Adjacent-enemy bonus grows with aggression, pushing units to seek contact.
		// First adjacent enemy gives the full bonus; each additional enemy beyond one
		// is diminished — being flanked by 3 enemies is dangerous even for fighters.
		if (adjacentEnemyCount >= 1) {
			score += 120 + aggression * 25;
			const extraEnemies = adjacentEnemyCount - 1;
			const healthRatio = activeCreature.health / activeCreature.stats.health;
			score -= extraEnemies * Math.round(80 + (1 - healthRatio) * 120);
		}

		score -= activeCreature.hexagons.some(
			(creatureHex) => creatureHex.pos.x === hex.x && creatureHex.pos.y === hex.y,
		)
			? 1000
			: 0;

		// Apply enemy-owned proximity penalties for adjacent hostile units.
		adjacentEnemyCreatures.forEach((enemy) => {
			const enemyStrategy = unitStrategies[enemy.type as string];
			score += enemyStrategy?.getProximityPenalty?.(activeCreature, enemy, hex, this) ?? 0;
		});

		// Zone preference weakens with aggression so units stop hugging safe ground.
		const preferredX = this.getPreferredX(activeCreature);
		const zoneWeight = Math.max(1, 10 - aggression);
		score -= Math.abs(hex.x - preferredX) * zoneWeight;

		// Penalize trap exposure both on the destination and along the walk path.
		score -= this.getMovePathTrapPenalty(activeCreature, hex);

		return score;
	}

	private getMovePathTrapPenalty(
		creature: Creature,
		destination: Hex,
		opts: { retreating: boolean } = { retreating: false },
	): number {
		let penalty = 0;
		// Always check destination hex — getTrapsForHex falls back to hex.trap for unit tests.
		this.getTrapsForHex(destination).forEach((trap) => {
			penalty += this.getTrapExposurePenalty(creature, trap, true, opts);
		});

		// Skip the expensive A* path scan when no traps are registered in the game.
		// game.traps is the authoritative source for live traps; unit tests that set
		// hex.trap directly still get the destination check above.
		if (!this.game.traps?.length) {
			return penalty;
		}

		try {
			const path = creature.calculatePath({ x: destination.x, y: destination.y });
			path.forEach((pathHex) => {
				const isOrigin = pathHex.x === creature.x && pathHex.y === creature.y;
				const isDestination = pathHex.x === destination.x && pathHex.y === destination.y;
				if (isOrigin || isDestination) {
					return;
				}
				this.getTrapsForHex(pathHex).forEach((trap) => {
					penalty += this.getTrapExposurePenalty(creature, trap, false, opts);
				});
			});
		} catch {
			// Keep scoring robust if a path cannot be computed from the mocked/runtime state.
		}

		return penalty;
	}

	private getTrapsForHex(hex: Hex): Trap[] {
		try {
			const traps = getPointFacade().getTrapsAt(hex);
			if (Array.isArray(traps) && traps.length > 0) {
				return traps;
			}
		} catch {
			// Fallback to deprecated accessor when point facade isn't configured.
		}

		return hex.trap ? [hex.trap] : [];
	}

	private shouldWaitInsteadOfRiskyMove(
		creature: Creature,
		best: { trapPenalty: number },
		allCandidates: Array<{ trapPenalty: number }>,
	): boolean {
		if (best.trapPenalty <= 0) {
			return false;
		}

		const hasTrapSafeOption = allCandidates.some((candidate) => candidate.trapPenalty <= 0);
		if (hasTrapSafeOption) {
			return false;
		}

		const healthRatio = creature.health / creature.stats.health;
		if (this.isRetreating(creature)) {
			if (healthRatio <= 0.35 && best.trapPenalty >= 170) {
				return true;
			}

			if (best.trapPenalty >= 600) {
				return true;
			}
		}

		if (healthRatio <= 0.2 && best.trapPenalty >= 180) {
			return true;
		}

		if (healthRatio <= 0.35 && best.trapPenalty >= 300) {
			return true;
		}

		// Even healthy units should occasionally hold if every option is extremely dangerous.
		return best.trapPenalty >= 950;
	}

	private getTrapExposurePenalty(
		creature: Creature,
		trap: Trap,
		isDestination: boolean,
		opts: { retreating: boolean },
	): number {
		const healthRatio = creature.health / creature.stats.health;
		let penalty = Math.round(80 + (1 - healthRatio) * 270);

		const enduranceRatio = creature.endurance / Math.max(1, creature.stats.endurance);

		if (this.isLikelyDamagingTrap(trap)) {
			penalty += healthRatio <= 0.35 ? 700 : 240;
			if (healthRatio <= 0.2) {
				penalty += 500;
			}

			if (enduranceRatio < 0.05) {
				penalty += Math.round((0.05 - enduranceRatio) * 900);
			} else if (enduranceRatio < 0.25) {
				penalty += Math.round((0.25 - enduranceRatio) * 180);
			}
		}

		if (opts.retreating) {
			penalty = Math.round(penalty * 1.7);
			if (healthRatio <= 0.35) {
				penalty += 220;
			}
		}

		if (!isDestination) {
			penalty = Math.round(penalty * 0.6);
		}

		return penalty;
	}

	private isLikelyDamagingTrap(trap: Trap): boolean {
		const effects = trap.effects;
		if (!Array.isArray(effects) || effects.length === 0) {
			return false;
		}

		return effects.some((effect) => {
			const trigger = `${effect?.trigger ?? ''}`;
			if (!/onStepIn|onStepOut/.test(trigger)) {
				return false;
			}

			const name = `${effect?.name ?? ''}`.toLowerCase();
			const hint = `${effect?.specialHint ?? ''}`.toLowerCase();
			if (/damage|burn|poison|shock|frost|mental|pure/.test(name + hint)) {
				return true;
			}

			const effectFn = effect?.effectFn;
			if (typeof effectFn !== 'function') {
				return true;
			}

			const effectSource = Function.prototype.toString.call(effectFn);
			if (/takeDamage|new Damage|applyDamage|damages/.test(effectSource)) {
				return true;
			}

			// Step-triggered traps with opaque effect functions should still be
			// treated as dangerous for movement planning.
			return true;
		});
	}

	scoreSummonHex(hex: Hex) {
		const activeCreature = this.game.activeCreature;
		if (!activeCreature) {
			return Number.NEGATIVE_INFINITY;
		}

		const nearestEnemyDistance = this.closestDistanceToEnemy(hex);
		const adjacentEnemy = hex
			.adjacentHex(1)
			.some(
				(adjacentHex) =>
					adjacentHex.creature && isTeam(activeCreature, adjacentHex.creature, Team.Enemy),
			);

		let score = 200 - nearestEnemyDistance * 12;
		score += adjacentEnemy ? 40 : 0;
		return score;
	}

	scoreAbilityHex(hex: Hex) {
		const activeCreature = this.game.activeCreature;
		if (!activeCreature) {
			return Number.NEGATIVE_INFINITY;
		}

		const abilityIndex =
			this.pendingAction?.type === 'ability' ? this.pendingAction.abilityIndex : -1;
		const strategy = this.getStrategyFor(activeCreature);
		if (strategy?.scoreAbilityHex) {
			const score = strategy.scoreAbilityHex(hex, abilityIndex, this);
			if (score !== undefined) return score;
		}

		if (hex.creature instanceof Creature) {
			if (isTeam(activeCreature, hex.creature, Team.Enemy)) {
				const target = hex.creature;
				if (!target.stats || typeof target.stats.health !== 'number' || target.stats.health === 0) {
					// Skip scoring if stats or health is missing/invalid
					return undefined;
				}
				const healthPercent = target.health / target.stats.health;

				// Base: lower health enemies are higher priority
				let score = 1000 - target.health + target.size * 10;

				// Death blow bonus: heavily prefer targets close to elimination
				if (target.health <= 8) {
					score += 650;
				} else if (healthPercent < 0.2) {
					score += 480;
				} else if (healthPercent < 0.35) {
					score += 250;
				} else if (healthPercent < 0.5) {
					score += 120;
				}

				// Prefer targets that can still be fatigued and/or have more energy to drain
				if (!target.protectedFromFatigue && !target.isFatigued()) {
					score += 50;
					if (typeof target.stats.energy === 'number' && target.stats.energy > 0) {
						score += Math.round((target.energy / target.stats.energy) * 100);
					}
				}

				const targetStrategy = unitStrategies[target.type as string];
				score +=
					targetStrategy?.getTargetingPenalty?.(activeCreature, target, abilityIndex, this) ?? 0;
				score +=
					targetStrategy?.getCounterTargetingModifier?.(
						activeCreature,
						target,
						abilityIndex,
						this,
					) ?? 0;

				return score;
			}

			if (hex.creature === activeCreature) {
				// Self-targeting (buff/utility abilities) — modest positive score
				return 80;
			}

			// Allied creature in ability range: penalise to avoid collateral from area
			// abilities, but not so heavily that pure-buff abilities targeting only allies fail.
			return -200;
		}

		return 100 - this.closestDistanceToEnemy(hex) * 10;
	}

	/**
	 * Returns true when the creature is in a low-health (< 30 %) or
	 * low-energy (< 25 %) state and should try to retreat.
	 * Unit strategies may override this via `UnitBotStrategy.isRetreating`.
	 */
	isRetreating(creature: Creature): boolean {
		const strategy = this.getStrategyFor(creature);
		if (strategy?.isRetreating) {
			const override = strategy.isRetreating(creature, this);
			if (override !== undefined) return override;
		}

		const engagementPressure = this.getTeamEngagementPressure(creature);
		const healthThreshold = Math.max(0.12, Math.min(0.5, 0.3 - engagementPressure * 0.04));
		const energyThreshold = Math.max(0.1, Math.min(0.45, 0.25 - engagementPressure * 0.03));
		const healthRatio = creature.health / creature.stats.health;
		const energyRatio = creature.energy / creature.stats.energy;
		return healthRatio < healthThreshold || energyRatio < energyThreshold;
	}

	/**
	 * Scores a hex for a retreating creature.
	 * Prefers hexes far from enemies, sheltered behind allied units,
	 * and close to uncollected drops.
	 */
	scoreRetreatHex(hex: Hex): number {
		const activeCreature = this.game.activeCreature;
		if (!activeCreature) {
			return Number.NEGATIVE_INFINITY;
		}

		let score = 0;

		// Strongly prefer distance from enemies
		score += this.closestDistanceToEnemy(hex) * 30;

		// Reward being adjacent to allied units (they provide cover)
		const adjacentAllyCount = hex
			.adjacentHex(1)
			.filter(
				(adj) =>
					adj.creature &&
					adj.creature !== activeCreature &&
					isTeam(activeCreature, adj.creature, Team.Ally),
			).length;
		score += adjacentAllyCount * 50;

		// Reward proximity to uncollected drops
		const nearestDrop = this.closestDistanceToDrop(hex);
		if (nearestDrop < Number.POSITIVE_INFINITY) {
			score += Math.max(0, 10 - nearestDrop) * 20;
		}

		// Retreating units are already injured; heavily penalize trap exposure.
		score -= this.getMovePathTrapPenalty(activeCreature, hex, { retreating: true });

		return score;
	}

	closestDistanceToDrop(position: { x: number; y: number }): number {
		let shortest = Number.POSITIVE_INFINITY;
		this.game.drops.forEach((drop) => {
			if (!drop || drop.pickedUp) {
				return;
			}
			const dist = Math.abs(position.x - drop.x) + Math.abs(position.y - drop.y);
			shortest = Math.min(shortest, dist);
		});
		return shortest;
	}

	closestDistanceToEnemy(position: { x: number; y: number }) {
		const activeCreature = this.game.activeCreature;
		if (!activeCreature) {
			return Number.POSITIVE_INFINITY;
		}

		let shortestDistance = Number.POSITIVE_INFINITY;
		this.game.creatures.forEach((creature) => {
			if (
				!creature ||
				creature.dead ||
				creature.temp ||
				!isTeam(activeCreature, creature, Team.Enemy)
			) {
				return;
			}

			creature.hexagons.forEach((hex) => {
				const distance = Math.abs(position.x - hex.x) + Math.abs(position.y - hex.y);
				shortestDistance = Math.min(shortestDistance, distance);
			});
		});

		return shortestDistance;
	}

	/**
	 * Returns true when the best move the creature could make via normal walking
	 * either lands on a trap hex or requires crossing a trap along the path.
	 * Used as the trigger condition for `tryMovementAbility`.
	 */
	bestMovePathCrossesOrLandsOnTrap(): boolean {
		const creature = this.game.activeCreature;
		if (!creature) return false;

		const hexes = this.game.grid.findCreatureMovementHexes(creature);
		const candidates = hexes.filter((h) => !(h.x === creature.x && h.y === creature.y));
		if (candidates.length === 0) return false;

		const best = this.pickBestHex(candidates, (hex) => this.scoreMoveHex(hex));
		if (!best) return false;

		// Landing on a trap is bad regardless of movement type
		if (best.trap) return true;

		// Check intermediate hexes along the walk path
		try {
			const path = creature.calculatePath({ x: best.x, y: best.y });
			return path.some((h) => h.trap);
		} catch {
			return false;
		}
	}

	/**
	 * Try to use an ability flagged as `isMovementAbility` (teleport, flying dash, etc.)
	 * to reposition the creature.
	 * Returns true if an ability was triggered.
	 */
	tryMovementAbility(opts: { requireTrapSafe?: boolean } = {}): boolean {
		const creature = this.game.activeCreature;
		if (!creature) return false;
		const requireTrapSafe = opts.requireTrapSafe ?? false;

		const strategy = this.getStrategyFor(creature);
		const abilityOrder =
			strategy?.getAbilityPriority?.(creature, this) ?? creature.abilities.map((_, i) => i);

		for (const i of abilityOrder) {
			const ability = creature.abilities[i];
			if (
				!ability ||
				!ability.isMovementAbility ||
				(requireTrapSafe && ability.isMovementAbility !== 'safe') ||
				this.failedAbilityIds.has(i) ||
				ability.getTrigger() !== 'onQuery' ||
				ability.used ||
				typeof ability.require !== 'function'
			) {
				continue;
			}
			try {
				if (!ability.require()) continue;
			} catch {
				continue;
			}
			this.setPendingAction({ type: 'ability', abilityIndex: i });
			const previousQueryOpt = this.game.grid?.lastQueryOpt;
			ability.use();
			if (this.pendingAction === null) {
				continue;
			}
			if (this.game.grid?.lastQueryOpt === previousQueryOpt) {
				this.clearPendingAction();
				this.failedAbilityIds.add(i);
				continue;
			}
			return true;
		}

		return false;
	}

	private setPendingAction(action: BotPendingAction) {
		this.pendingAction = action;
		this.pendingActionSetAt = Date.now();
	}

	private clearPendingAction(options: { markFailedAbility?: boolean } = {}) {
		const failedAction = this.pendingAction;
		this.pendingAction = null;
		this.pendingActionSetAt = 0;
		if (
			options.markFailedAbility &&
			failedAction?.type !== 'move' &&
			typeof failedAction?.abilityIndex === 'number'
		) {
			this.failedAbilityIds.add(failedAction.abilityIndex);
		}
	}
}
