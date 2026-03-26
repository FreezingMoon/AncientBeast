/**
 * Undo Move UI Component
 *
 * Provides the UI button and icon for undo functionality.
 * Swaps between "Undo Move" and "Delay Turn" buttons.
 *
 * @file undo-ui.ts
 */

import { UndoManager, UndoResult } from '../game/undo-manager';
import { ActionType } from '../game/action-history';

/**
 * Undo UI Configuration
 */
export interface UndoUIConfig {
	/** Button container element ID */
	containerId: string;

	/** Undo button element ID */
	undoButtonId: string;

	/** Delay turn button element ID */
	delayButtonId: string;

	/** Icon path for undo button */
	undoIconPath: string;

	/** Show tooltip */
	showTooltip: boolean;
}

/**
 * Undo UI Class
 *
 * Manages undo button UI:
 * - Button visibility
 * - Icon swapping
 * - Tooltips
 * - Click handlers
 */
export class UndoUI {
	private undoManager: UndoManager;
	private config: UndoUIConfig;

	private undoButton?: HTMLButtonElement;
	private delayButton?: HTMLButtonElement;
	private container?: HTMLElement;

	constructor(undoManager: UndoManager, config?: Partial<UndoUIConfig>) {
		this.undoManager = undoManager;

		// Default configuration
		this.config = {
			containerId: 'game-controls',
			undoButtonId: 'undo-move-btn',
			delayButtonId: 'delay-turn-btn',
			undoIconPath: 'assets/icons/undo-move.svg',
			showTooltip: true,
			...config,
		};

		// Setup UI after DOM is ready
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', () => this.init());
		} else {
			this.init();
		}
	}

	/**
	 * Initialize UI components
	 */
	private init(): void {
		this.log('[UndoUI] Initializing...');

		// Get DOM elements
		this.container = document.getElementById(this.config.containerId);
		this.undoButton = document.getElementById(this.config.undoButtonId) as HTMLButtonElement;
		this.delayButton = document.getElementById(this.config.delayButtonId) as HTMLButtonElement;

		// Create elements if they don't exist
		if (!this.container) {
			this.createContainer();
		}

		if (!this.undoButton) {
			this.createUndoButton();
		}

		if (!this.delayButton) {
			this.createDelayButton();
		}

		// Setup event listeners
		this.setupEventListeners();

		// Setup undo manager callbacks
		this.undoManager.onUndoPerformed = (result, actionType) => {
			this.onUndoPerformed(result, actionType);
		};

		// Initial state
		this.updateButtonVisibility();

		this.log('[UndoUI] Initialized');
	}

	/**
	 * Create container element
	 */
	private createContainer(): void {
		this.container = document.createElement('div');
		this.container.id = this.config.containerId;
		this.container.className = 'game-controls';
		document.body.appendChild(this.container);
	}

	/**
	 * Create undo button
	 */
	private createUndoButton(): void {
		this.undoButton = document.createElement('button');
		this.undoButton.id = this.config.undoButtonId;
		this.undoButton.className = 'btn btn-warning undo-move-btn';
		this.undoButton.title = 'Undo Last Action (Ctrl+Z)';
		this.undoButton.style.display = 'none'; // Hidden by default

		// Create icon
		const icon = document.createElement('img');
		icon.src = this.config.undoIconPath;
		icon.alt = 'Undo';
		icon.className = 'btn-icon';
		this.undoButton.appendChild(icon);

		// Add to container
		if (this.container) {
			this.container.appendChild(this.undoButton);
		}
	}

	/**
	 * Create delay turn button
	 */
	private createDelayButton(): void {
		this.delayButton = document.createElement('button');
		this.delayButton.id = this.config.delayButtonId;
		this.delayButton.className = 'btn btn-info delay-turn-btn';
		this.delayButton.title = 'Delay Turn';
		this.delayButton.textContent = 'Delay Turn';

		// Add to container
		if (this.container) {
			this.container.appendChild(this.delayButton);
		}
	}

	/**
	 * Setup event listeners
	 */
	private setupEventListeners(): void {
		// Undo button click
		if (this.undoButton) {
			this.undoButton.addEventListener('click', () => {
				this.log('[UndoUI] Undo button clicked');
				this.undoManager.undo();
			});
		}

		// Delay button click
		if (this.delayButton) {
			this.delayButton.addEventListener('click', () => {
				this.log('[UndoUI] Delay button clicked');
				// Handle delay turn action
				this.onDelayTurn();
			});
		}
	}

	/**
	 * Show undo button, hide delay button
	 */
	public showUndoButton(): void {
		if (this.undoButton) {
			this.undoButton.style.display = 'inline-block';
		}
		if (this.delayButton) {
			this.delayButton.style.display = 'none';
		}
		this.log('[UndoUI] Showing undo button');
	}

	/**
	 * Show delay button, hide undo button
	 */
	public showDelayButton(): void {
		if (this.delayButton) {
			this.delayButton.style.display = 'inline-block';
		}
		if (this.undoButton) {
			this.undoButton.style.display = 'none';
		}
		this.log('[UndoUI] Showing delay button');
	}

	/**
	 * Update button visibility based on undo availability
	 */
	public updateButtonVisibility(): void {
		const status = this.undoManager.getUndoStatus();

		if (status.available) {
			this.showUndoButton();
			this.updateUndoButtonState(status);
		} else {
			this.showDelayButton();
		}
	}

	/**
	 * Update undo button state (enabled/disabled, tooltip)
	 */
	private updateUndoButtonState(status: {
		available: boolean;
		usedThisRound: boolean;
		canUndoAgain: boolean;
		cooldownRemaining: number;
	}): void {
		if (!this.undoButton) return;

		// Disable button if on cooldown or used
		this.undoButton.disabled = !status.canUndoAgain || status.cooldownRemaining > 0;

		// Update tooltip
		if (this.config.showTooltip) {
			if (status.usedThisRound) {
				this.undoButton.title = 'Undo already used this round';
			} else if (status.cooldownRemaining > 0) {
				const seconds = Math.ceil(status.cooldownRemaining / 1000);
				this.undoButton.title = `Undo on cooldown (${seconds}s)`;
			} else {
				this.undoButton.title = 'Undo Last Action (Ctrl+Z)';
			}
		}
	}

	/**
	 * Handle undo performed
	 */
	private onUndoPerformed(result: UndoResult, actionType?: ActionType): void {
		this.log('[UndoUI] Undo performed:', result);

		switch (result) {
			case UndoResult.SUCCESS:
				// Show success feedback
				this.showFeedback('Action undone!', 'success');
				// Switch back to delay button
				this.showDelayButton();
				break;

			case UndoResult.ALREADY_USED:
				this.showFeedback('Undo already used this round!', 'warning');
				break;

			case UndoResult.NO_ACTION_TO_UNDO:
				this.showFeedback('No action to undo!', 'info');
				break;

			case UndoResult.ERROR:
				this.showFeedback('Failed to undo action!', 'error');
				break;
		}
	}

	/**
	 * Handle delay turn button click
	 */
	private onDelayTurn(): void {
		this.log('[UndoUI] Delay turn clicked');
		// This would trigger the game's delay turn logic
		// For now, just log it
		console.log('Delay turn action triggered');
	}

	/**
	 * Show feedback message to user
	 */
	private showFeedback(message: string, type: 'success' | 'warning' | 'error' | 'info'): void {
		this.log('[UndoUI] Feedback:', message, type);

		// Create or get feedback element
		let feedback = document.getElementById('undo-feedback');
		if (!feedback) {
			feedback = document.createElement('div');
			feedback.id = 'undo-feedback';
			feedback.className = 'undo-feedback';
			document.body.appendChild(feedback);
		}

		// Set message and type
		feedback.textContent = message;
		feedback.className = `undo-feedback ${type}`;

		// Show animation
		feedback.style.opacity = '1';

		// Hide after 2 seconds
		setTimeout(() => {
			feedback.style.opacity = '0';
		}, 2000);
	}

	/**
	 * Enable or disable undo UI
	 */
	public setEnabled(enabled: boolean): void {
		if (this.undoButton) {
			this.undoButton.disabled = !enabled;
		}
		if (this.delayButton) {
			this.delayButton.disabled = !enabled;
		}
		this.log('[UndoUI] Enabled:', enabled);
	}

	/**
	 * Log message if debug is enabled
	 */
	private log(...args: any[]): void {
		console.log(...args);
	}
}
