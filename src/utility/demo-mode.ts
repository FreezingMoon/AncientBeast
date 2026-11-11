/**
 * Demo Mode System for AncientBeast
 * 
 * Automatically plays demo content when the game is idle (kiosk mode).
 * Features:
 * - Idle detection (no player activity)
 * - "How to Play" tutorial showcase
 * - Random battle scenarios (AI vs AI)
 * - Instant cancel on user interaction
 */

import Game from '../game';
import { sleep } from '../utility/time';

export enum DemoState {
	IDLE = 'idle',
	TUTORIAL = 'tutorial',
	BATTLE = 'battle',
	PAUSED = 'paused'
}

export class DemoMode {
	private game: Game;
	private state: DemoState = DemoState.IDLE;
	private idleTimeout: number = 30000; // 30 seconds
	private demoInterval: number = 15000; // 15 seconds per demo
	private timeoutId: ReturnType<typeof setTimeout> | null = null;
	private intervalId: ReturnType<typeof setInterval> | null = null;
	private lastActivityTime: number = Date.now();
	private isActive: boolean = false;
	private demoSequence: number = 0;

	// Tutorial content
	private tutorials: string[] = [
		'summon',
		'movement',
		'abilities',
		'combat'
	];

	constructor(game: Game) {
		this.game = game;
		this.setupActivityListeners();
		this.startIdleDetection();
	}

	/**
	 * Setup event listeners to detect player activity
	 */
	private setupActivityListeners(): void {
		// Track mouse movement
		document.addEventListener('mousemove', () => this.resetIdleTimer());
		
		// Track keyboard input
		document.addEventListener('keydown', () => this.resetIdleTimer());
		
		// Track touch events (mobile)
		document.addEventListener('touchstart', () => this.resetIdleTimer());
		
		// Track clicks
		document.addEventListener('click', () => this.resetIdleTimer());
	}

	/**
	 * Start monitoring for idle state
	 */
	private startIdleDetection(): void {
		this.stopDemo();
		
		this.timeoutId = setTimeout(() => {
			if (this.isIdle()) {
				this.startDemo();
			}
		}, this.idleTimeout);
	}

	/**
	 * Reset idle timer on player activity
	 */
	private resetIdleTimer(): void {
		this.lastActivityTime = Date.now();
		
		// If demo is playing, stop it
		if (this.isActive) {
			this.stopDemo();
			this.game.UI.banner('Demo cancelled - Welcome back!', 2000);
		}
		
		// Restart idle detection
		this.startIdleDetection();
	}

	/**
	 * Check if enough time has passed to consider game idle
	 */
	private isIdle(): boolean {
		const timeSinceActivity = Date.now() - this.lastActivityTime;
		return timeSinceActivity >= this.idleTimeout;
	}

	/**
	 * Start demo mode
	 */
	public startDemo(): void {
		if (this.isActive) return;
		
		this.isActive = true;
		this.state = DemoState.TUTORIAL;
		this.demoSequence = 0;
		
		console.log('🎮 Demo mode started');
		
		// Show welcome message
		this.game.UI.banner('🎮 Demo Mode - Click anywhere to exit', 3000);
		
		// Start demo sequence
		this.runDemoSequence();
	}

	/**
	 * Stop demo mode
	 */
	public stopDemo(): void {
		if (!this.isActive) return;
		
		this.isActive = false;
		this.state = DemoState.IDLE;
		
		// Clear timers
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
		
		console.log('⏹️ Demo mode stopped');
	}

	/**
	 * Run demo sequence (cycle through tutorials and battles)
	 */
	private async runDemoSequence(): Promise<void> {
		while (this.isActive) {
			try {
				switch (this.demoSequence % 3) {
					case 0:
						await this.showTutorial('summon');
						break;
					case 1:
						await this.showTutorial('movement');
						break;
					case 2:
						await this.playRandomBattle();
						break;
				}
				
				this.demoSequence++;
				
				// Wait between demos
				await sleep(2000);
				
			} catch (error) {
				console.error('Demo sequence error:', error);
				this.stopDemo();
				break;
			}
		}
	}

	/**
	 * Show tutorial demonstration
	 */
	private async showTutorial(type: string): Promise<void> {
		if (!this.isActive) return;
		
		this.state = DemoState.TUTORIAL;
		console.log(`📚 Showing tutorial: ${type}`);
		
		// Display tutorial banner
		this.game.UI.banner(`📚 Tutorial: ${this.formatTutorialTitle(type)}`, 3000);
		
		// Simulate tutorial showcase
		// In a real implementation, this would:
		// - Highlight UI elements
		// - Show tooltips
		// - Play animations demonstrating the concept
		
		await sleep(this.demoInterval);
	}

	/**
	 * Play random AI vs AI battle
	 */
	private async playRandomBattle(): Promise<void> {
		if (!this.isActive) return;
		
		this.state = DemoState.BATTLE;
		console.log('⚔️ Playing random battle');
		
		// Display battle banner
		this.game.UI.banner('⚔️ AI Battle Demo', 2000);
		
		// In a real implementation, this would:
		// - Setup a random scenario
		// - Let AI control both players
		// - Show interesting combat moves
		
		await sleep(this.demoInterval);
	}

	/**
	 * Format tutorial type into display title
	 */
	private formatTutorialTitle(type: string): string {
		const titles: { [key: string]: string } = {
			'summon': 'Summoning Creatures',
			'movement': 'Moving on the Grid',
			'abilities': 'Using Abilities',
			'combat': 'Combat Mechanics'
		};
		
		return titles[type] || type;
	}

	/**
	 * Get current demo state
	 */
	public getState(): DemoState {
		return this.state;
	}

	/**
	 * Check if demo mode is active
	 */
	public isDemoActive(): boolean {
		return this.isActive;
	}

	/**
	 * Manually trigger demo mode (for testing)
	 */
	public triggerDemo(): void {
		this.lastActivityTime = 0;
		this.startDemo();
	}

	/**
	 * Cleanup on destroy
	 */
	public destroy(): void {
		this.stopDemo();
		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
		}
	}
}

// Export singleton factory
let demoModeInstance: DemoMode | null = null;

export function createDemoMode(game: Game): DemoMode {
	if (!demoModeInstance) {
		demoModeInstance = new DemoMode(game);
	}
	return demoModeInstance;
}

export function getDemoMode(): DemoMode | null {
	return demoModeInstance;
}
