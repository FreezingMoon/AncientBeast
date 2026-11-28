export type DemoType = 'tutorial' | 'scenario' | 'replay';

export interface DemoStep {
	action: string;
	durationMs: number;
	payload?: Record<string, unknown>;
}

export interface DemoScenario {
	id: string;
	type: DemoType;
	title: string;
	description?: string;
	steps: DemoStep[];
	totalDurationMs?: number;
}

export interface DemoModeOptions {
	idleTimeoutMs?: number;
	fuseDurationMs?: number;
	kioskMode?: boolean;
	demos?: DemoScenario[];
	onFuseStart?: (durationMs: number) => void;
	onFuseTick?: (remainingMs: number, percentage: number) => void;
	onFuseCancel?: () => void;
	onDemoStart?: (demo: DemoScenario) => void;
	onDemoEnd?: (demo: DemoScenario) => void;
	onReturnToMainMenu?: () => void;
}

export class DemoModeManager {
	private idleTimeoutMs: number;
	private fuseDurationMs: number;
	private kioskMode: boolean;
	private playersConnected: number = 0;
	private demos: DemoScenario[] = [];
	private currentDemoIndex: number = -1;
	private activeState: 'idle' | 'fuse' | 'playing' = 'idle';

	private idleTimer: ReturnType<typeof setTimeout> | null = null;
	private fuseTimer: ReturnType<typeof setInterval> | null = null;
	private fuseEndTime: number = 0;

	private onFuseStartCb?: (durationMs: number) => void;
	private onFuseTickCb?: (remainingMs: number, percentage: number) => void;
	private onFuseCancelCb?: () => void;
	private onDemoStartCb?: (demo: DemoScenario) => void;
	private onDemoEndCb?: (demo: DemoScenario) => void;
	private onReturnToMainMenuCb?: () => void;

	private userInteractionHandler: (event?: Event) => void;
	private isListening: boolean = false;

	constructor(options: DemoModeOptions = {}) {
		this.idleTimeoutMs = options.idleTimeoutMs ?? 15000;
		this.fuseDurationMs = options.fuseDurationMs ?? 5000;
		this.kioskMode = options.kioskMode ?? false;
		this.demos = options.demos ? [...options.demos] : this.getDefaultDemos();
		this.onFuseStartCb = options.onFuseStart;
		this.onFuseTickCb = options.onFuseTick;
		this.onFuseCancelCb = options.onFuseCancel;
		this.onDemoStartCb = options.onDemoStart;
		this.onDemoEndCb = options.onDemoEnd;
		this.onReturnToMainMenuCb = options.onReturnToMainMenu;

		this.userInteractionHandler = this.handleUserInteraction.bind(this);
	}

	public getDefaultDemos(): DemoScenario[] {
		return [
			{
				id: 'how-to-play-tutorial',
				type: 'tutorial',
				title: 'How to Play Tutorial',
				description: 'Interactive introduction to basic moves and combat mechanics.',
				steps: [
					{ action: 'HIGHLIGHT_UNIT', durationMs: 2000, payload: { unitId: 'hero' } },
					{ action: 'SHOW_MOVEMENT_GRID', durationMs: 2500, payload: { range: 3 } },
					{ action: 'EXECUTE_MOVE', durationMs: 2000, payload: { x: 4, y: 2 } },
					{ action: 'ATTACK_TARGET', durationMs: 3000, payload: { targetId: 'enemy1' } },
				],
			},
			{
				id: 'random-battle-scenario',
				type: 'scenario',
				title: 'Random Scenario Battle',
				description: 'Automated battle simulation between balanced scenario squads.',
				steps: [
					{ action: 'SPAWN_SQUAD_A', durationMs: 1500, payload: { faction: 'beasts' } },
					{ action: 'SPAWN_SQUAD_B', durationMs: 1500, payload: { faction: 'guardians' } },
					{ action: 'SIMULATE_TURN', durationMs: 4000, payload: { turn: 1 } },
					{ action: 'SIMULATE_TURN', durationMs: 4000, payload: { turn: 2 } },
				],
			},
			{
				id: 'historic-match-replay',
				type: 'replay',
				title: 'Historic Match Highlights',
				description: 'Replay of critical moves from championship tournament match.',
				steps: [
					{ action: 'LOAD_REPLAY_STATE', durationMs: 1000, payload: { matchId: 'champ_2024' } },
					{ action: 'REPLAY_EPIC_MOVE', durationMs: 3500, payload: { moveId: 42 } },
					{ action: 'REPLAY_VICTORY_COMBO', durationMs: 4000, payload: { moveId: 43 } },
				],
			},
		];
	}

	public setKioskMode(enabled: boolean): void {
		this.kioskMode = enabled;
		if (enabled) {
			this.attachListeners();
			this.restartIdleTimer();
		} else {
			this.stop();
			this.detachListeners();
		}
	}

	public isKioskMode(): boolean {
		return this.kioskMode;
	}

	public setConnectedPlayers(count: number): void {
		this.playersConnected = count;
		if (count > 0) {
			this.stop();
		} else if (this.kioskMode && this.activeState === 'idle') {
			this.restartIdleTimer();
		}
	}

	public getConnectedPlayers(): number {
		return this.playersConnected;
	}

	public getState(): 'idle' | 'fuse' | 'playing' {
		return this.activeState;
	}

	public addDemo(demo: DemoScenario): void {
		this.demos.push(demo);
	}

	public getDemos(): DemoScenario[] {
		return [...this.demos];
	}

	public getCurrentDemo(): DemoScenario | null {
		if (this.currentDemoIndex >= 0 && this.currentDemoIndex < this.demos.length) {
			return this.demos[this.currentDemoIndex];
		}
		return null;
	}

	public restartIdleTimer(): void {
		this.clearTimers();
		if (!this.kioskMode || this.playersConnected > 0) {
			this.activeState = 'idle';
			return;
		}

		this.activeState = 'idle';
		this.idleTimer = setTimeout(() => {
			this.startFuse();
		}, this.idleTimeoutMs);
	}

	public startFuse(): void {
		if (!this.kioskMode || this.playersConnected > 0) return;

		this.activeState = 'fuse';
		this.onFuseStartCb?.(this.fuseDurationMs);

		const startTime = Date.now();
		this.fuseEndTime = startTime + this.fuseDurationMs;

		this.fuseTimer = setInterval(() => {
			const now = Date.now();
			const remainingMs = Math.max(0, this.fuseEndTime - now);
			const percentage = Math.max(0, (remainingMs / this.fuseDurationMs) * 100);

			this.onFuseTickCb?.(remainingMs, percentage);

			if (remainingMs <= 0) {
				this.clearFuseInterval();
				this.startNextDemo();
			}
		}, 100);
	}

	public cancelFuse(): void {
		if (this.activeState === 'fuse') {
			this.clearFuseInterval();
			this.activeState = 'idle';
			this.onFuseCancelCb?.();
			this.restartIdleTimer();
		}
	}

	public startNextDemo(): void {
		this.clearTimers();
		if (this.demos.length === 0) return;

		this.currentDemoIndex = (this.currentDemoIndex + 1) % this.demos.length;
		const demo = this.demos[this.currentDemoIndex];
		this.activeState = 'playing';
		this.onDemoStartCb?.(demo);
	}

	public stop(): void {
		const wasPlaying = this.activeState === 'playing';
		const currentDemo = this.getCurrentDemo();
		this.clearTimers();
		this.activeState = 'idle';
		if (wasPlaying && currentDemo) {
			this.onDemoEndCb?.(currentDemo);
		}
	}

	public handleUserInteraction(_event?: Event): void {
		if (!this.kioskMode) return;

		if (this.activeState === 'playing') {
			const endingDemo = this.getCurrentDemo();
			this.stop();
			if (endingDemo) {
				this.onReturnToMainMenuCb?.();
			}
			this.restartIdleTimer();
		} else if (this.activeState === 'fuse') {
			this.cancelFuse();
		} else if (this.activeState === 'idle') {
			this.restartIdleTimer();
		}
	}

	public attachListeners(): void {
		if (this.isListening || typeof window === 'undefined') return;
		const events = ['keydown', 'pointerdown', 'mousemove', 'touchstart'];
		events.forEach((evt) => {
			window.addEventListener(evt, this.userInteractionHandler, { passive: true });
		});
		this.isListening = true;
	}

	public detachListeners(): void {
		if (!this.isListening || typeof window === 'undefined') return;
		const events = ['keydown', 'pointerdown', 'mousemove', 'touchstart'];
		events.forEach((evt) => {
			window.removeEventListener(evt, this.userInteractionHandler);
		});
		this.isListening = false;
	}

	public destroy(): void {
		this.stop();
		this.detachListeners();
		this.demos = [];
	}

	private clearTimers(): void {
		if (this.idleTimer) {
			clearTimeout(this.idleTimer);
			this.idleTimer = null;
		}
		this.clearFuseInterval();
	}

	private clearFuseInterval(): void {
		if (this.fuseTimer) {
			clearInterval(this.fuseTimer);
			this.fuseTimer = null;
		}
	}
}
