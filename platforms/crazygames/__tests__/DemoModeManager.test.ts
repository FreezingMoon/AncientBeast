import { DemoModeManager, DemoScenario } from '../../../src/utils/demoModeManager';
import { initKioskDemoMode } from '../instant-multiplayer';

describe('DemoModeManager & Kiosk Demo Mode', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	describe('Initialization & Default Demos', () => {
		it('should initialize with default options and 3 demo scenarios', () => {
			const manager = new DemoModeManager();
			expect(manager.getState()).toBe('idle');
			expect(manager.isKioskMode()).toBe(false);

			const demos = manager.getDemos();
			expect(demos.length).toBe(3);
			expect(demos[0].type).toBe('tutorial');
			expect(demos[1].type).toBe('scenario');
			expect(demos[2].type).toBe('replay');
		});

		it('should accept custom demo scenarios', () => {
			const customDemo: DemoScenario = {
				id: 'custom-demo',
				type: 'tutorial',
				title: 'Custom Tutorial',
				steps: [{ action: 'STEP1', durationMs: 1000 }],
			};
			const manager = new DemoModeManager({ demos: [customDemo] });
			expect(manager.getDemos()).toEqual([customDemo]);
		});
	});

	describe('Fuse Countdown & Transition to Demo', () => {
		it('should trigger fuse after idle timeout in kiosk mode', () => {
			const onFuseStart = jest.fn();
			const onFuseTick = jest.fn();
			const manager = new DemoModeManager({
				idleTimeoutMs: 5000,
				fuseDurationMs: 2000,
				onFuseStart,
				onFuseTick,
			});

			manager.setKioskMode(true);
			expect(manager.getState()).toBe('idle');

			jest.advanceTimersByTime(5000);

			expect(manager.getState()).toBe('fuse');
			expect(onFuseStart).toHaveBeenCalledWith(2000);

			jest.advanceTimersByTime(100);
			expect(onFuseTick).toHaveBeenCalled();
		});

		it('should start playing demo after fuse duration completes', () => {
			const onDemoStart = jest.fn();
			const manager = new DemoModeManager({
				idleTimeoutMs: 1000,
				fuseDurationMs: 1000,
				onDemoStart,
			});

			manager.setKioskMode(true);
			jest.advanceTimersByTime(1000);
			expect(manager.getState()).toBe('fuse');

			jest.advanceTimersByTime(1000);
			expect(manager.getState()).toBe('playing');
			expect(onDemoStart).toHaveBeenCalled();
			expect(manager.getCurrentDemo()?.type).toBe('tutorial');
		});

		it('should cycle through tutorial, scenario, and replay demos', () => {
			const startedDemos: string[] = [];
			const manager = new DemoModeManager({
				idleTimeoutMs: 1000,
				fuseDurationMs: 500,
				onDemoStart: (demo) => startedDemos.push(demo.id),
			});

			manager.setKioskMode(true);

			jest.advanceTimersByTime(1500);
			expect(startedDemos[0]).toBe('how-to-play-tutorial');

			manager.startNextDemo();
			expect(startedDemos[1]).toBe('random-battle-scenario');

			manager.startNextDemo();
			expect(startedDemos[2]).toBe('historic-match-replay');

			manager.startNextDemo();
			expect(startedDemos[3]).toBe('how-to-play-tutorial');
		});
	});

	describe('User Interaction Handling', () => {
		it('should cancel fuse on user interaction and return to idle timer', () => {
			const onFuseCancel = jest.fn();
			const manager = new DemoModeManager({
				idleTimeoutMs: 2000,
				fuseDurationMs: 1000,
				onFuseCancel,
			});

			manager.setKioskMode(true);
			jest.advanceTimersByTime(2000);
			expect(manager.getState()).toBe('fuse');

			manager.handleUserInteraction();
			expect(onFuseCancel).toHaveBeenCalled();
			expect(manager.getState()).toBe('idle');
		});

		it('should cancel active demo on user interaction and return to main menu', () => {
			const onReturnToMainMenu = jest.fn();
			const onDemoEnd = jest.fn();
			const manager = new DemoModeManager({
				idleTimeoutMs: 1000,
				fuseDurationMs: 1000,
				onReturnToMainMenu,
				onDemoEnd,
			});

			manager.setKioskMode(true);
			jest.advanceTimersByTime(2000);
			expect(manager.getState()).toBe('playing');

			manager.handleUserInteraction();
			expect(manager.getState()).toBe('idle');
			expect(onDemoEnd).toHaveBeenCalled();
			expect(onReturnToMainMenu).toHaveBeenCalled();
		});
	});

	describe('Connected Players & Kiosk Guards', () => {
		it('should not start fuse if players are connected', () => {
			const onFuseStart = jest.fn();
			const manager = new DemoModeManager({
				idleTimeoutMs: 1000,
				fuseDurationMs: 1000,
				onFuseStart,
			});

			manager.setKioskMode(true);
			manager.setConnectedPlayers(2);

			jest.advanceTimersByTime(3000);
			expect(manager.getState()).toBe('idle');
			expect(onFuseStart).not.toHaveBeenCalled();
		});

		it('should stop active demo if players connect during playback', () => {
			const manager = new DemoModeManager({
				idleTimeoutMs: 1000,
				fuseDurationMs: 1000,
			});

			manager.setKioskMode(true);
			jest.advanceTimersByTime(2000);
			expect(manager.getState()).toBe('playing');

			manager.setConnectedPlayers(1);
			expect(manager.getState()).toBe('idle');
		});
	});

	describe('Kiosk Helper & Cleanup', () => {
		it('initKioskDemoMode helper correctly initializes manager in kiosk mode', () => {
			const manager = initKioskDemoMode({ idleTimeoutMs: 3000 });
			expect(manager.isKioskMode()).toBe(true);
			expect(manager.getState()).toBe('idle');
			manager.destroy();
		});

		it('destroy should stop timers and reset state', () => {
			const manager = new DemoModeManager({ idleTimeoutMs: 1000 });
			manager.setKioskMode(true);
			manager.destroy();

			expect(manager.getState()).toBe('idle');
			expect(manager.getDemos().length).toBe(0);
		});
	});
});
