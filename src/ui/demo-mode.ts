import $j from 'jquery';
import type Game from '../game';

/** Idle time on the main menu before the fuse shows up (#2976). */
export const DEMO_IDLE_MS = 5000;
/** How long the fuse burns, shrinking from both ends, before the demo starts. */
export const DEMO_FUSE_MS = 25000;
/** Time the end screen of a finished demo match stays up before the menu returns. */
const DEMO_END_PAUSE_MS = 5000;

/** Anything that counts as someone being at the menu, resetting the idle timer. */
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];
/** Interactions that cancel a running demo (a stray mouse move does not). */
const CANCEL_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'];

type DemoModeOptions = {
	/** Starts the self playing match shown as the demo. */
	startDemo: () => void;
	idleMs?: number;
	fuseMs?: number;
};

/**
 * Demo mode (#2976): after a few seconds without input on the main menu, a fuse
 * line lights up between the match settings and the start button and burns down
 * from both ends. If nobody interrupts it, a match where every seat is a bot
 * starts by itself. Any interaction cancels the demo and goes straight back to
 * the main menu, and so does the end of the demo match.
 */
export function installDemoMode(game: Game, options: DemoModeOptions) {
	const idleMs = options.idleMs ?? DEMO_IDLE_MS;
	const fuseMs = options.fuseMs ?? DEMO_FUSE_MS;
	const $fuse = $j('#demo-fuse');

	let idleTimer: ReturnType<typeof setTimeout> | undefined;
	let fuseTimer: ReturnType<typeof setTimeout> | undefined;
	let watchTimer: ReturnType<typeof setInterval> | undefined;
	let running = false;
	let cancelRequested = false;

	const isOnMenu = () =>
		!running &&
		!game.multiplayer &&
		!game.lobby &&
		!$j('body').hasClass('in-game') &&
		$j('#gameSetupContainer').is(':visible');

	const putOutFuse = () => {
		clearTimeout(fuseTimer);
		$fuse.removeClass('burning');
	};

	const armIdleTimer = () => {
		clearTimeout(idleTimer);
		putOutFuse();
		if (running) {
			return;
		}
		idleTimer = setTimeout(() => (isOnMenu() ? lightFuse() : armIdleTimer()), idleMs);
	};

	const lightFuse = () => {
		$fuse.css('--demo-fuse-ms', `${fuseMs}ms`);
		// Restart the CSS animation from a full length fuse
		$fuse.removeClass('burning');
		void $fuse[0]?.offsetWidth;
		$fuse.addClass('burning');
		fuseTimer = setTimeout(() => (isOnMenu() ? startDemo() : armIdleTimer()), fuseMs);
	};

	const stopDemo = () => {
		if (!running) {
			return;
		}
		running = false;
		cancelRequested = false;
		clearInterval(watchTimer);
		$j('body').removeClass('demo-mode');
		game.resetGame();
		armIdleTimer();
	};

	const startDemo = () => {
		putOutFuse();
		running = true;
		cancelRequested = false;
		$j('body').addClass('demo-mode');
		options.startDemo();

		let endedAt = 0;
		watchTimer = setInterval(() => {
			// A cancel during loading waits for the match to be up, as tearing it
			// down half built is not something resetGame() is meant for.
			if (cancelRequested && (game.gameState === 'playing' || game.gameState === 'ended')) {
				stopDemo();
				return;
			}
			if (game.gameState === 'ended') {
				endedAt ||= Date.now();
				if (Date.now() - endedAt >= DEMO_END_PAUSE_MS) {
					stopDemo();
				}
			}
		}, 250);
	};

	ACTIVITY_EVENTS.forEach((type) =>
		document.addEventListener(
			type,
			() => {
				if (!running) {
					armIdleTimer();
				}
			},
			{ capture: true, passive: true },
		),
	);

	CANCEL_EVENTS.forEach((type) =>
		document.addEventListener(
			type,
			(event) => {
				if (!running) {
					return;
				}
				// The input only cancels the demo, it must not also act in the match
				event.preventDefault();
				event.stopPropagation();
				cancelRequested = true;
				if (game.gameState === 'playing' || game.gameState === 'ended') {
					stopDemo();
				}
			},
			{ capture: true },
		),
	);

	armIdleTimer();
}
