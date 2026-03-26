/**
 * Undo Move Integration
 *
 * Integrates undo system with AncientBeast game.
 * Add this to game.ts to enable undo functionality.
 *
 * @file undo-integration.ts
 */

import { StateManager } from './state-manager';
import { ActionHistory, ActionType } from './action-history';
import { UndoManager } from './undo-manager';
import { UndoUI } from '../ui/undo-ui';
import { UndoHotkey } from '../ui/undo-hotkey';
import { injectUndoStyles } from '../ui/undo-styles';
import Game from '../game';

/**
 * Undo Integration Configuration
 */
export interface UndoIntegrationConfig {
	/** Enable undo system */
	enabled: boolean;

	/** Enable in multiplayer */
	allowMultiplayer: boolean;

	/** Show debug logging */
	debug: boolean;

	/** Auto-inject styles */
	autoInjectStyles: boolean;
}

/**
 * Undo Integration Class
 *
 * Wraps all undo functionality for easy integration with Game class.
 */
export class UndoIntegration {
	private game: Game;
	private config: UndoIntegrationConfig;

	public stateManager?: StateManager;
	public actionHistory?: ActionHistory;
	public undoManager?: UndoManager;
	public undoUI?: UndoUI;
	public undoHotkey?: UndoHotkey;

	constructor(game: Game, config?: Partial<UndoIntegrationConfig>) {
		this.game = game;

		// Default configuration
		this.config = {
			enabled: true,
			allowMultiplayer: true,
			debug: false,
			autoInjectStyles: true,
			...config,
		};

		console.log('[UndoIntegration] Initializing...');
	}

	/**
	 * Initialize undo system
	 * Call this in Game constructor or init method
	 */
	public init(): void {
		if (!this.config.enabled) {
			console.log('[UndoIntegration] Disabled, skipping initialization');
			return;
		}

		console.log('[UndoIntegration] Starting initialization...');

		// Inject styles
		if (this.config.autoInjectStyles) {
			injectUndoStyles();
		}

		// Create state manager
		this.stateManager = new StateManager(this.game);
		console.log('[UndoIntegration] StateManager created');

		// Create action history
		this.actionHistory = new ActionHistory();
		console.log('[UndoIntegration] ActionHistory created');

		// Create undo manager
		this.undoManager = new UndoManager(this.game, this.stateManager, this.actionHistory, {
			allowMultiplayer: this.config.allowMultiplayer,
			debug: this.config.debug,
		});
		console.log('[UndoIntegration] UndoManager created');

		// Create UI
		this.undoUI = new UndoUI(this.undoManager);
		console.log('[UndoIntegration] UndoUI created');

		// Create hotkey handler
		this.undoHotkey = new UndoHotkey(this.undoManager);
		console.log('[UndoIntegration] UndoHotkey created');

		// Hook into game events
		this.setupGameHooks();
		console.log('[UndoIntegration] Game hooks setup');

		console.log('[UndoIntegration] Initialization complete!');
	}

	/**
	 * Setup hooks into game events
	 */
	private setupGameHooks(): void {
		if (!this.undoManager) return;

		// Hook into action execution
		const originalExecuteAction = (this.game as any).executeAction;
		if (originalExecuteAction) {
			(this.game as any).executeAction = async (...args: any[]) => {
				// Save state before action
				this.beforeAction(ActionType.UNKNOWN);

				// Execute original action
				const result = await originalExecuteAction.apply(this.game, args);

				// Update UI after action
				this.afterAction();

				return result;
			};
		}

		// Hook into round end
		const originalEndRound = (this.game as any).endRound;
		if (originalEndRound) {
			(this.game as any).endRound = (...args: any[]) => {
				// Notify undo manager of round end
				this.undoManager?.onRoundEnd();

				// Call original
				return originalEndRound.apply(this.game, args);
			};
		}

		// Hook into round start
		const originalStartRound = (this.game as any).startRound;
		if (originalStartRound) {
			(this.game as any).startRound = (...args: any[]) => {
				// Call original
				const result = originalStartRound.apply(this.game, args);

				// Notify undo manager of round start
				if (this.undoManager) {
					const round = (this.game as any).round || 1;
					this.undoManager.onRoundStart(round);
				}

				return result;
			};
		}
	}

	/**
	 * Call before executing an action
	 */
	public beforeAction(
		type: ActionType,
		actorId?: string,
		targetId?: string,
		position?: { x: number; y: number },
		details?: any,
	): void {
		if (!this.undoManager) return;

		const playerId = this.game.activeCreature
			? String(this.game.activeCreature.player.id)
			: 'unknown';

		this.undoManager.beforeAction(type, playerId, actorId, targetId, position, details);
	}

	/**
	 * Call after executing an action
	 */
	public afterAction(): void {
		if (!this.undoUI) return;

		// Update button visibility
		this.undoUI.updateButtonVisibility();
	}

	/**
	 * Perform undo
	 * @returns Promise<boolean> - true if successful
	 */
	public async undo(): Promise<boolean> {
		if (!this.undoManager) {
			console.warn('[UndoIntegration] UndoManager not initialized');
			return false;
		}

		const result = await this.undoManager.undo();
		return result === 'success';
	}

	/**
	 * Check if undo is available
	 */
	public canUndo(): boolean {
		return this.undoManager?.canUndo() || false;
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
		return (
			this.undoManager?.getUndoStatus() || {
				available: false,
				usedThisRound: false,
				canUndoAgain: false,
				cooldownRemaining: 0,
			}
		);
	}

	/**
	 * Enable or disable undo system
	 */
	public setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		this.undoUI?.setEnabled(enabled);
		this.undoHotkey?.setEnabled(enabled);
	}

	/**
	 * Check if undo system is enabled
	 */
	public isEnabled(): boolean {
		return this.config.enabled;
	}
}

/**
 * Quick integration helper
 * Call this in game.ts to add undo functionality
 */
export function integrateUndo(
	game: Game,
	config?: Partial<UndoIntegrationConfig>,
): UndoIntegration {
	const integration = new UndoIntegration(game, config);
	integration.init();
	return integration;
}
