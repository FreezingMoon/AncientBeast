// CrazyGames instant multiplayer (https://docs.crazygames.com/sdk/game/#instant-multiplayer).
//
// When CrazyGames launches the game on its Multiplayer page with
// `isInstantMultiplayer` set, the first player should go straight into a fresh,
// joinable private room instead of the main menu. Kept here so the generic game
// bootstrap only passes a few callbacks.
import $j from 'jquery';
import type Game from '../../src/game';
import { DemoModeManager, type DemoModeOptions } from '../../src/utils/demoModeManager';

export type InstantMultiplayerContext = {
	game: Game;
	renderGameModeType: (multiplayer: boolean) => void;
	getGameConfig: () => unknown;
	updateLobbyUi: () => void;
};

/** Drop the first player into a new, joinable private room. */
export function startInstantMultiplayerLobby(ctx: InstantMultiplayerContext): void {
	const { game, renderGameModeType, getGameConfig, updateLobbyUi } = ctx;

	game.multiplayer = true;
	renderGameModeType(game.multiplayer);

	const config = {
		...(getGameConfig() as Parameters<Game['createLobby']>[0]),
		gameMode: 4,
	};
	void game
		.createLobby(config)
		.then(() => {
			updateLobbyUi();
			const $button = $j('#createLobbyButton');
			try {
				void game.lobby?.copyLobbyCode();
				$button.val('Link copied');
				$button.prop('disabled', true);
				$button.toggleClass('disabled', true);
				window.setTimeout(() => updateLobbyUi(), 1000);
			} catch (_error) {
				// Clipboard unavailable
			}
		})
		.catch((error) => {
			console.error(error);
			game.multiplayer = false;
			renderGameModeType(game.multiplayer);
			updateLobbyUi();
		});
}

/**
 * Initializes Kiosk Demo Mode for idle auto-play when no players are connected.
 */
export function initKioskDemoMode(options: Partial<DemoModeOptions> = {}): DemoModeManager {
	const demoManager = new DemoModeManager({
		kioskMode: true,
		idleTimeoutMs: options.idleTimeoutMs ?? 15000,
		fuseDurationMs: options.fuseDurationMs ?? 5000,
		...options,
	});

	demoManager.setKioskMode(true);
	return demoManager;
}
