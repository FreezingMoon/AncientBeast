/**
 * Undo Manager
 *
 * Manages undo functionality for game actions.
 * Coordinates between StateManager and ActionHistory.
 *
 * @file undo-manager.ts
 */

import { StateManager } from './state-manager';
import { ActionHistory, ActionType } from './action-history';
import Game from '../game';

/**
 * Undo result status
 */
export enum UndoResult {
	SUCCESS = 'success',
	NO_ACTION_TO_UNDO = 'no_action_to_undo',
	ALREADY_USED = 'already_used',
	INVALID_STATE = 'invalid_state',
	ERROR = 'error',
}

/**
 * Undo Manager Configuration
 */
export interface UndoManagerConfig {
	/** Allow undo in multiplayer */
	allowMultiplayer: boolean;

	/** Show confirmation dialog before undo */
	showConfirmation: boolean;

	/** Cooldown between undos (ms) */
	cooldownMs: number;

	/** Enable debug logging */
	debug: boolean;
}

/**
 * Undo Manager Class
 *
 * Manages undo functionality:
 * - Validates if undo is available
 * - Coordinates state restoration
 * - Tracks usage (once per round)
 * - Handles P2P synchronization
 */
export class UndoManager {
	private game: Game;
	private stateManager: StateManager;
	private actionHistory: ActionHistory;
	private config: UndoManagerConfig;

	/** Whether undo has been used this round */
	private undoUsedThisRound: boolean;

	/** Last undo timestamp */
	private lastUndoTimestamp: number;

	/** Callback when undo is performed */
	onUndoPerformed?: (result: UndoResult, actionType?: ActionType) => void;

	constructor(
		game: Game,
		stateManager: StateManager,
		actionHistory: ActionHistory,
		config?: Partial<UndoManagerConfig>,
	) {
		this.game = game;
		this.stateManager = stateManager;
		this.actionHistory = actionHistory;

		// Default configuration
		this.config = {
			allowMultiplayer: true,
			showConfirmation: false,
			cooldownMs: 1000, // 1 second cooldown
			debug: false,
			...config,
		};

		this.undoUsedThisRound = false;
		this.lastUndoTimestamp = 0;

		this.log('[UndoManager] Initialized');
	}

	/**
	 * Check if undo is currently available
	 */
	public canUndo(): boolean {
		// Check if already used this round
		if (this.undoUsedThisRound) {
			this.log('[UndoManager] Cannot undo: already used this round');
			return false;
		}

		// Check if there's an action to undo
		if (!this.actionHistory.canUndo()) {
			this.log('[UndoManager] Cannot undo: no action to undo');
			return false;
		}

		// Check cooldown
		const now = Date.now();
		if (now - this.lastUndoTimestamp < this.config.cooldownMs) {
			this.log('[UndoManager] Cannot undo: on cooldown');
			return false;
		}

		// Check if state can be restored
		if (!this.stateManager.canRestore()) {
			this.log('[UndoManager] Cannot undo: no state to restore');
			return false;
		}

		this.log('[UndoManager] Can undo: true');
		return true;
	}

	/**
	 * Perform undo operation
	 * @returns UndoResult indicating success or failure reason
	 */
	public async undo(): Promise<UndoResult> {
		this.log('[UndoManager] Attempting undo...');

		// Validate undo is available
		if (!this.canUndo()) {
			const result = this.determineFailureReason();
			this.onUndoPerformed?.(result);
			return result;
		}

		try {
			// Get the action we're undoing
			const lastAction = this.actionHistory.getLastAction();
			if (!lastAction) {
				this.onUndoPerformed?.(UndoResult.NO_ACTION_TO_UNDO);
				return UndoResult.NO_ACTION_TO_UNDO;
			}

			this.log('[UndoManager] Undoing action:', lastAction.type, lastAction.description);

			// Restore previous game state
			const restoredState = this.stateManager.restoreState();

			if (!restoredState) {
				this.onUndoPerformed?.(UndoResult.INVALID_STATE);
				return UndoResult.INVALID_STATE;
			}

			// Mark undo as used this round
			this.undoUsedThisRound = true;
			this.lastUndoTimestamp = Date.now();

			// Remove the undone action from history
			this.actionHistory.getCurrentRoundActions().pop();

			this.log('[UndoManager] Undo successful');

			// Notify listeners
			this.onUndoPerformed?.(UndoResult.SUCCESS, lastAction.type);

			// Broadcast to peers in multiplayer
			if (this.config.allowMultiplayer) {
				this.broadcastUndo(lastAction);
			}

			return UndoResult.SUCCESS;
		} catch (error) {
			console.error('[UndoManager] Undo failed:', error);
			this.onUndoPerformed?.(UndoResult.ERROR);
			return UndoResult.ERROR;
		}
	}

	/**
	 * Determine why undo failed
	 */
	private determineFailureReason(): UndoResult {
		if (this.undoUsedThisRound) {
			return UndoResult.ALREADY_USED;
		}

		if (!this.actionHistory.canUndo()) {
			return UndoResult.NO_ACTION_TO_UNDO;
		}

		if (!this.stateManager.canRestore()) {
			return UndoResult.INVALID_STATE;
		}

		return UndoResult.ERROR;
	}

	/**
	 * Mark that an action is about to be performed
	 * This saves the state BEFORE the action
	 */
	public beforeAction(
		type: ActionType,
		playerId: string,
		actorId?: string,
		targetId?: string,
		position?: { x: number; y: number },
		details?: any,
	): void {
		this.log('[UndoManager] Before action:', type);

		// Save game state before action
		this.stateManager.saveState();

		// Record action in history
		this.actionHistory.recordAction(type, playerId, actorId, targetId, position, details);

		// Reset undo availability for new action
		// (player can undo any action, but only once per round)
	}

	/**
	 * Mark that a round has ended
	 * Resets undo availability for next round
	 */
	public onRoundEnd(): void {
		this.log('[UndoManager] Round ended, resetting undo');
		this.undoUsedThisRound = false;
		this.actionHistory.clearForNewRound();
		this.stateManager.clearPreviousState();
	}

	/**
	 * Mark that a round has started
	 */
	public onRoundStart(round: number): void {
		this.log('[UndoManager] Round started:', round);
		this.undoUsedThisRound = false;
	}

	/**
	 * Handle undo received from peer (multiplayer)
	 */
	public onPeerUndo(actionData: string): void {
		if (!this.config.allowMultiplayer) {
			this.log('[UndoManager] Ignoring peer undo: multiplayer disabled');
			return;
		}

		this.log('[UndoManager] Received peer undo');

		const action = this.actionHistory.deserializeAction(actionData);
		if (action) {
			// Perform undo locally
			this.undo();
		}
	}

	/**
	 * Broadcast undo to peers (multiplayer)
	 */
	private broadcastUndo(action: any): void {
		// In a real implementation, this would use the game's networking layer
		// For now, just log it
		this.log('[UndoManager] Broadcasting undo to peers:', action.id);

		// Example: this.game.network.broadcast('undo', { action });
	}

	/**
	 * Get undo status for UI
	 */
	public getUndoStatus(): {
		available: boolean;
		usedThisRound: boolean;
		canUndoAgain: boolean;
		cooldownRemaining: number;
	} {
		const now = Date.now();
		const cooldownElapsed = now - this.lastUndoTimestamp;
		const cooldownRemaining = Math.max(0, this.config.cooldownMs - cooldownElapsed);

		return {
			available: this.canUndo(),
			usedThisRound: this.undoUsedThisRound,
			canUndoAgain: !this.undoUsedThisRound,
			cooldownRemaining,
		};
	}

	/**
	 * Get last action (for UI display)
	 */
	public getLastActionDescription(): string {
		const lastAction = this.actionHistory.getLastAction();
		return lastAction ? lastAction.description : 'No actions yet';
	}

	/**
	 * Enable or disable debug logging
	 */
	public setDebug(enabled: boolean): void {
		this.config.debug = enabled;
	}

	/**
	 * Log message if debug is enabled
	 */
	private log(...args: any[]): void {
		if (this.config.debug) {
			console.log(...args);
		}
	}
}
