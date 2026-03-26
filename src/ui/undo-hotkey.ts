/**
 * Undo Hotkey Handler
 *
 * Handles Ctrl+Z keyboard shortcut for undo functionality.
 * Prevents default browser undo behavior.
 *
 * @file undo-hotkey.ts
 */

import { UndoManager } from '../game/undo-manager';

/**
 * Hotkey Configuration
 */
export interface UndoHotkeyConfig {
	/** Enable hotkey */
	enabled: boolean;

	/** Key combination (default: Ctrl+Z) */
	keyCombo: string;

	/** Prevent default browser behavior */
	preventDefault: boolean;

	/** Show tooltip on first use */
	showTooltip: boolean;
}

/**
 * Undo Hotkey Class
 *
 * Manages keyboard shortcuts for undo:
 * - Ctrl+Z handler
 * - Prevent browser default
 * - Tooltip on first use
 */
export class UndoHotkey {
	private undoManager: UndoManager;
	private config: UndoHotkeyConfig;
	private hasShownTooltip: boolean;

	constructor(undoManager: UndoManager, config?: Partial<UndoHotkeyConfig>) {
		this.undoManager = undoManager;

		// Default configuration
		this.config = {
			enabled: true,
			keyCombo: 'ctrl+z',
			preventDefault: true,
			showTooltip: true,
			...config,
		};

		this.hasShownTooltip = false;

		// Setup keyboard handler
		this.setupKeyboardHandler();

		console.log('[UndoHotkey] Initialized');
	}

	/**
	 * Setup keyboard event handler
	 */
	private setupKeyboardHandler(): void {
		document.addEventListener('keydown', (event: KeyboardEvent) => {
			// Check if hotkey is enabled
			if (!this.config.enabled) {
				return;
			}

			// Check for Ctrl+Z (or Cmd+Z on Mac)
			if (this.isUndoHotkey(event)) {
				this.log('[UndoHotkey] Ctrl+Z detected');

				// Prevent default browser undo
				if (this.config.preventDefault) {
					event.preventDefault();
					event.stopPropagation();
				}

				// Check if undo is available
				if (this.undoManager.canUndo()) {
					// Perform undo
					this.undoManager.undo();

					// Show tooltip on first use
					if (this.config.showTooltip && !this.hasShownTooltip) {
						this.showTooltip();
						this.hasShownTooltip = true;
					}
				} else {
					// Show feedback that undo is not available
					this.showNotAvailableFeedback();
				}
			}
		});
	}

	/**
	 * Check if event matches undo hotkey
	 */
	private isUndoHotkey(event: KeyboardEvent): boolean {
		// Check for Ctrl+Z or Cmd+Z (Mac)
		const isCtrlOrCmd = event.ctrlKey || event.metaKey;
		const isZ = event.key.toLowerCase() === 'z';

		// Make sure we're not in an input field
		const target = event.target as HTMLElement;
		const isInput =
			target.tagName === 'INPUT' ||
			target.tagName === 'TEXTAREA' ||
			target.tagName === 'SELECT' ||
			target.isContentEditable;

		return isCtrlOrCmd && isZ && !isInput;
	}

	/**
	 * Show tooltip on first undo use
	 */
	private showTooltip(): void {
		console.log('[UndoHotkey] Showing tooltip');

		// Create tooltip element
		const tooltip = document.createElement('div');
		tooltip.id = 'undo-hotkey-tooltip';
		tooltip.className = 'tooltip tooltip-undo';
		tooltip.innerHTML = `
      <div class="tooltip-content">
        <strong>Undo Move</strong>
        <p>You can use Ctrl+Z to undo your last action!</p>
        <p class="tooltip-hint">Only once per round</p>
      </div>
    `;

		// Style tooltip
		Object.assign(tooltip.style, {
			position: 'fixed',
			bottom: '100px',
			right: '20px',
			backgroundColor: 'rgba(0, 0, 0, 0.9)',
			color: 'white',
			padding: '15px',
			borderRadius: '8px',
			zIndex: '10000',
			maxWidth: '300px',
			boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
			animation: 'tooltipFadeIn 0.3s ease-out',
		});

		document.body.appendChild(tooltip);

		// Auto-hide after 5 seconds
		setTimeout(() => {
			tooltip.style.opacity = '0';
			setTimeout(() => tooltip.remove(), 300);
		}, 5000);
	}

	/**
	 * Show feedback when undo is not available
	 */
	private showNotAvailableFeedback(): void {
		this.log('[UndoHotkey] Undo not available, showing feedback');

		// Create feedback element
		const feedback = document.createElement('div');
		feedback.id = 'undo-not-available';
		feedback.className = 'feedback feedback-warning';
		feedback.textContent = 'Undo not available';

		// Style feedback
		Object.assign(feedback.style, {
			position: 'fixed',
			top: '20px',
			left: '50%',
			transform: 'translateX(-50%)',
			backgroundColor: 'rgba(255, 165, 0, 0.9)',
			color: 'white',
			padding: '10px 20px',
			borderRadius: '6px',
			zIndex: '10000',
			fontWeight: 'bold',
			boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
			animation: 'feedbackFadeIn 0.2s ease-out',
		});

		document.body.appendChild(feedback);

		// Auto-hide after 2 seconds
		setTimeout(() => {
			feedback.style.opacity = '0';
			setTimeout(() => feedback.remove(), 300);
		}, 2000);
	}

	/**
	 * Enable or disable hotkey
	 */
	public setEnabled(enabled: boolean): void {
		this.config.enabled = enabled;
		console.log('[UndoHotkey] Enabled:', enabled);
	}

	/**
	 * Check if hotkey is enabled
	 */
	public isEnabled(): boolean {
		return this.config.enabled;
	}

	/**
	 * Log message
	 */
	private log(...args: any[]): void {
		console.log(...args);
	}
}
