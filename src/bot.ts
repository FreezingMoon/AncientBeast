import type Game from './game';
import { Creature } from './creature';
import { CreatureType } from './data/types';
import { Hex } from './utility/hex';
import { Team, isTeam } from './utility/team';

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
	activeCreatureId: number | null = null;
	decisionCount = 0;
	moveAttempted = false;
	failedAbilityIds = new Set<number>();
	isResolvingQuery = false;

	constructor(game: Game) {
		this.game = game;
		this.game.signals.creature.add(this.handleCreatureSignal, this);
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
			this.queueDecision(250);
		}
	}

	startTurn(creature?: Creature) {
		this.clearDecisionTimeout();
		this.pendingAction = null;
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
			this.queueDecision(1350);
		}
	}

	clearDecisionTimeout() {
		if (this.decisionTimeout) {
			clearTimeout(this.decisionTimeout);
			this.decisionTimeout = null;
		}
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

		if (this.decisionCount >= 8) {
			this.game.skipTurn({ noTooltip: true });
			return;
		}
		this.decisionCount += 1;

		if (this.tryUseOffensiveAbility()) {
			return;
		}

		if (this.trySummon()) {
			return;
		}

		if (!this.moveAttempted && this.tryMove()) {
			return;
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

		for (let i = 0; i < activeCreature.abilities.length; i++) {
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

			this.pendingAction = {
				type: 'ability',
				abilityIndex: i,
			};
			ability.use();
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

		this.pendingAction = {
			type: 'summon',
			abilityIndex: 3,
			summonType,
		};
		ability.materialize(summonType);
		return true;
	}

	tryMove() {
		const activeCreature = this.game.activeCreature;
		if (!activeCreature || activeCreature.remainingMove <= 0) {
			this.moveAttempted = true;
			return false;
		}

		this.pendingAction = { type: 'move' };
		this.moveAttempted = true;
		activeCreature.queryMove();
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
		const affordableCreatures = activeCreature.player.availableCreatures
			.filter((type) => !unavailable.has(type))
			.map((type) => {
				const stats = this.game.retrieveCreatureStats(type);
				const level = Number.parseInt(type.substring(1, 2), 10);
				const cost = level + Number(stats?.size ?? 0);
				return { type, cost };
			})
			.filter(({ cost }) => cost <= activeCreature.player.plasma);

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

		const chosenHex = this.chooseHexForCurrentQuery(queryOptions.hexes);
		if (!chosenHex) {
			const failedAction = this.pendingAction;
			this.pendingAction = null;
			if (failedAction?.type !== 'move' && typeof failedAction?.abilityIndex === 'number') {
				this.failedAbilityIds.add(failedAction.abilityIndex);
			}
			this.queueDecision(120);
			return;
		}

		this.isResolvingQuery = true;

		setTimeout(() => {
			if (!this.isBotTurn()) {
				return;
			}
			handlers.onSelect(chosenHex);
		}, 50);

		setTimeout(() => {
			if (!this.isBotTurn()) {
				return;
			}
			this.pendingAction = null;
			this.isResolvingQuery = false;
			handlers.onConfirm(chosenHex);
			this.queueDecision(1200);
		}, 140);
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
			return this.pickBestHex(filtered, (hex) => this.scoreMoveHex(hex));
		}

		if (action.type === 'summon') {
			return this.pickBestHex(candidates, (hex) => this.scoreSummonHex(hex));
		}

		return this.pickBestHex(candidates, (hex) => this.scoreAbilityHex(hex));
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
	 */
	getPreferredX(creature: Creature): number {
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

		const adjacentEnemy = hex
			.adjacentHex(1)
			.some(
				(adjacentHex) =>
					adjacentHex.creature && isTeam(activeCreature, adjacentHex.creature, Team.Enemy),
			);

		let score = 0;
		score += adjacentEnemy ? 120 : 0;
		score -= activeCreature.hexagons.some(
			(creatureHex) => creatureHex.pos.x === hex.x && creatureHex.pos.y === hex.y,
		)
			? 1000
			: 0;

		// All units use gradient zone preference; higher level = enemy-side preference
		const preferredX = this.getPreferredX(activeCreature);
		score -= Math.abs(hex.x - preferredX) * 10;

		return score;
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

		if (hex.creature instanceof Creature) {
			if (isTeam(activeCreature, hex.creature, Team.Enemy)) {
				return 1000 - hex.creature.health + hex.creature.size * 10;
			}

			if (hex.creature === activeCreature) {
				return 150;
			}

			return 100;
		}

		return 100 - this.closestDistanceToEnemy(hex) * 10;
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
}
