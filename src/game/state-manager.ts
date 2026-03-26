/**
 * Game State Manager
 *
 * Handles saving and restoring enough runtime state for the undo system to
 * reverse the last action. The current game model does not expose every field
 * the original prototype expected, so this snapshot intentionally tracks only
 * properties that exist on the real runtime objects.
 *
 * @file state-manager.ts
 */

import Game from '../game';
import { Ability } from '../ability';
import { Creature } from '../creature';
import { Effect } from '../effect';

type UndoableGame = Game & {
	round?: number;
	currentPlayerId?: string;
	lastAction?: unknown;
	actionLog?: unknown;
};

/**
 * Complete game state snapshot
 */
export interface GameState {
	turn: number;
	round: number;
	gamePhase: Game['gameState'];
	currentPlayerId: string;
	players: PlayerState[];
	units: UnitState[];
	hexes: HexState[];
	gameData: {
		lastAction?: unknown;
		actionLog?: unknown;
	};
	timestamp: number;
}

/**
 * Player state snapshot
 */
export interface PlayerState {
	id: number;
	name: string;
	flipped: boolean;
	plasma: number;
	hasLost: boolean;
	hasFled: boolean;
	unitIds: number[];
}

/**
 * Unit/Creature state snapshot
 */
export interface UnitState {
	id: number;
	type: string;
	name: string;
	team: number;
	x: number;
	y: number;
	health: number;
	energy: number;
	endurance: number;
	dead: boolean;
	remainingMove: number;
	abilities: AbilityState[];
	effects: EffectState[];
}

/**
 * Ability state snapshot
 */
export interface AbilityState {
	title: string;
	upgraded: boolean;
	used: boolean;
	timesUsed: number;
	timesUsedThisTurn: number;
}

/**
 * Effect state snapshot
 */
export interface EffectState {
	title: string;
	turnLifetime?: number;
	alterations?: unknown;
}

/**
 * Hex state snapshot
 */
export interface HexState {
	x: number;
	y: number;
	creatureId?: number;
	trapId?: number;
}

/**
 * State Manager Class
 *
 * Manages game state snapshots for undo functionality.
 */
export class StateManager {
	private game: UndoableGame;
	private previousState?: GameState;
	private stateHistory: GameState[];
	private maxHistorySize: number;

	constructor(game: Game, maxHistorySize = 1) {
		this.game = game as UndoableGame;
		this.previousState = undefined;
		this.stateHistory = [];
		this.maxHistorySize = maxHistorySize;
	}

	/**
	 * Save current game state
	 * Called before executing any action
	 */
	public saveState(): void {
		const currentState = this.captureGameState();
		this.previousState = currentState;
		this.stateHistory.push(currentState);

		if (this.stateHistory.length > this.maxHistorySize) {
			this.stateHistory.shift();
		}
	}

	/**
	 * Restore previous game state
	 * Called when player triggers undo
	 * @returns Restored game state or null if no state to restore
	 */
	public restoreState(): GameState | null {
		if (!this.previousState) {
			return null;
		}

		const stateToRestore = JSON.parse(JSON.stringify(this.previousState)) as GameState;
		this.applyGameState(stateToRestore);
		this.clearPreviousState();
		return stateToRestore;
	}

	/**
	 * Check if state can be restored
	 */
	public canRestore(): boolean {
		return this.previousState !== undefined;
	}

	/**
	 * Clear previous state
	 */
	public clearPreviousState(): void {
		this.previousState = undefined;
	}

	/**
	 * Clear all state history
	 */
	public clearAll(): void {
		this.previousState = undefined;
		this.stateHistory = [];
	}

	/**
	 * Capture current game state into serializable format
	 */
	private captureGameState(): GameState {
		return {
			turn: this.game.turn,
			round: this.game.round ?? 1,
			gamePhase: this.game.gameState,
			currentPlayerId: this.getCurrentPlayerId(),
			players: this.capturePlayers(),
			units: this.captureUnits(),
			hexes: this.captureHexes(),
			gameData: this.captureGameData(),
			timestamp: Date.now(),
		};
	}

	/**
	 * Capture all player states
	 */
	private capturePlayers(): PlayerState[] {
		return this.game.players.map((player) => ({
			id: player.id,
			name: player.name,
			flipped: player.flipped,
			plasma: player.plasma,
			hasLost: player.hasLost,
			hasFled: player.hasFled,
			unitIds: player.creatures.map((creature) => creature.id),
		}));
	}

	/**
	 * Capture all unit/creature states
	 */
	private captureUnits(): UnitState[] {
		return this.game.creatures.map((creature) => ({
			id: creature.id,
			type: creature.type,
			name: creature.name,
			team: creature.team,
			x: creature.x,
			y: creature.y,
			health: creature.health,
			energy: creature.energy,
			endurance: creature.endurance,
			dead: creature.dead,
			remainingMove: creature.remainingMove,
			abilities: this.captureAbilities(creature),
			effects: this.captureEffects(creature),
		}));
	}

	/**
	 * Capture creature abilities
	 */
	private captureAbilities(creature: Creature): AbilityState[] {
		return creature.abilities.map((ability) => ({
			title: ability.title,
			upgraded: ability.upgraded,
			used: ability.used,
			timesUsed: ability.timesUsed,
			timesUsedThisTurn: ability.timesUsedThisTurn,
		}));
	}

	/**
	 * Capture creature effects
	 */
	private captureEffects(creature: Creature): EffectState[] {
		return creature.effects.map((effect) => {
			const typedEffect = effect as Partial<Effect> & {
				title?: string;
				turnLifetime?: number;
				alterations?: unknown;
			};

			return {
				title: typedEffect.title ?? '',
				turnLifetime: typedEffect.turnLifetime,
				alterations: typedEffect.alterations,
			};
		});
	}

	/**
	 * Capture hex/board states
	 */
	private captureHexes(): HexState[] {
		if (!this.game.grid) {
			return [];
		}

		return this.game.grid.allhexes.map((hex) => ({
			x: hex.x,
			y: hex.y,
			creatureId: hex.creature?.id,
			trapId: hex.trap?.id,
		}));
	}

	/**
	 * Capture additional game data
	 */
	private captureGameData(): GameState['gameData'] {
		return {
			lastAction: this.game.lastAction,
			actionLog: this.game.actionLog,
		};
	}

	/**
	 * Apply restored state to game
	 */
	private applyGameState(state: GameState): void {
		this.game.turn = state.turn;
		this.game.gameState = state.gamePhase;
		this.game.round = state.round;
		this.game.currentPlayerId = state.currentPlayerId;

		this.restorePlayers(state.players);
		this.restoreUnits(state.units);
		this.restoreGameData(state.gameData);
	}

	/**
	 * Restore player states
	 */
	private restorePlayers(players: PlayerState[]): void {
		for (const playerState of players) {
			const player = this.game.players.find((candidate) => candidate.id === playerState.id);
			if (!player) {
				continue;
			}

			player.flipped = playerState.flipped;
			player.plasma = playerState.plasma;
			player.hasLost = playerState.hasLost;
			player.hasFled = playerState.hasFled;
		}
	}

	/**
	 * Restore unit/creature states
	 */
	private restoreUnits(units: UnitState[]): void {
		for (const unitState of units) {
			const creature = this.game.creatures.find((candidate) => candidate.id === unitState.id);
			if (!creature) {
				continue;
			}

			creature.x = unitState.x;
			creature.y = unitState.y;
			creature.pos = { x: unitState.x, y: unitState.y };
			creature.health = unitState.health;
			creature.energy = unitState.energy;
			creature.endurance = unitState.endurance;
			creature.dead = unitState.dead;
			creature.remainingMove = unitState.remainingMove;

			this.restoreAbilities(creature.abilities, unitState.abilities);
			this.restoreEffects(creature, unitState.effects);
		}
	}

	/**
	 * Restore creature abilities
	 */
	private restoreAbilities(abilities: Ability[], abilityStates: AbilityState[]): void {
		abilities.forEach((ability, index) => {
			const abilityState = abilityStates[index];
			if (!abilityState) {
				return;
			}

			ability.title = abilityState.title;
			ability.upgraded = abilityState.upgraded;
			ability.used = abilityState.used;
			ability.timesUsed = abilityState.timesUsed;
			ability.timesUsedThisTurn = abilityState.timesUsedThisTurn;
		});
	}

	/**
	 * Restore creature effects
	 */
	private restoreEffects(creature: Creature, effects: EffectState[]): void {
		creature.effects = effects.map((effectState) => ({
			title: effectState.title,
			turnLifetime: effectState.turnLifetime ?? 0,
			alterations: effectState.alterations ?? {},
		}));
	}

	/**
	 * Restore additional game data
	 */
	private restoreGameData(gameData: GameState['gameData']): void {
		if (gameData.lastAction !== undefined) {
			this.game.lastAction = gameData.lastAction;
		}

		if (gameData.actionLog !== undefined) {
			this.game.actionLog = gameData.actionLog;
		}
	}

	private getCurrentPlayerId(): string {
		if (this.game.currentPlayerId) {
			return this.game.currentPlayerId;
		}

		const currentPlayer = this.game.activeCreature?.player;
		return currentPlayer ? String(currentPlayer.id) : '';
	}

	/**
	 * Get previous state (for debugging)
	 */
	public getPreviousState(): GameState | undefined {
		return this.previousState;
	}

	/**
	 * Get state history (for debugging)
	 */
	public getStateHistory(): GameState[] {
		return [...this.stateHistory];
	}
}
