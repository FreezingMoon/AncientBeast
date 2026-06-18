// Import jQuery related stuff
import $j from 'jquery';
import 'jquery.transit';
import { unitData } from './data/units';
import Game from './game';
import { PreMatchAudioPlayer } from './sound/pre-match-audio';
import { Fullscreen } from './ui/fullscreen';
import { buttonSlide } from './ui/button';
import { normalizeLobbyCode } from './multiplayer/types';

import { installAvatarStyles } from './style/avatar-styles';
import {
	DEBUG,
	DEBUG_AUTO_START_GAME,
	DEBUG_DISABLE_HOTKEYS,
	DEBUG_GAME_LOG,
	DEBUG_HAS_GAME_LOG,
} from './debug';

if (DEBUG && 'serviceWorker' in navigator) {
	navigator.serviceWorker
		.getRegistrations()
		.then((registrations) => registrations.forEach((registration) => registration.unregister()));
}

// Load the stylesheet
import './style/main.less';

installAvatarStyles();

export type GameConfig = ReturnType<typeof getGameConfig>;

// Generic object we can decorate with helper methods to simply dev and user experience.
// TODO: Expose this in a less hacky way.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Too many unknown types.
const AB = {} as any;
// Create the game
const G = new Game();
const LAST_MATCH_LOG_STORAGE_KEY = 'ab:last-match-log';
// Helper properties and methods for retrieving and playing back game logs.
// TODO: Expose these in a less hacky way too.
AB.currentGame = G;
AB.getLog = () => AB.currentGame.gamelog.stringify();
AB.saveLog = () => AB.currentGame.gamelog.save();
AB.restoreGame = (str) => AB.currentGame.gamelog.load(str);
window.AB = AB;
// Load the abilities
unitData.forEach(async (creature) => {
	if (!creature.playable) {
		return;
	}

	import(`./abilities/${creature.name.split(' ').join('-')}`).then((generator) =>
		generator.default(G),
	);
});

$j(() => {
	const scrim = $j('.scrim');
	scrim.on('transitionend', function () {
		scrim.remove();
	});
	scrim.removeClass('loading');
	renderGameModeType(G.multiplayer);

	const joinCodeFromUrl = new URLSearchParams(window.location.search).get('join');

	if (joinCodeFromUrl) {
		G.multiplayer = true;
		forceTwoPlayerMode();
		renderGameModeType(G.multiplayer);
		G.lobbyCode = parseLobbyCodeInput(joinCodeFromUrl);
		$j('#lobbyCode').val(G.lobbyCode);
		$j('#lobbyError').addClass('hide');
		G.joinLobbyByCode(G.lobbyCode)
			.then(() => {
				$j('#lobbyError').addClass('hide');
				updateLobbyUi();
			})
			.catch((error) => {
				console.error(error);
				G.lobby?.leaveMatch();
				G.lobby = null;
				G.lobbyState = null;
				$j('#lobbyError')
					.text(`Could not join lobby: ${error.message || error}`)
					.removeClass('hide');
				$j('#joinMatchButton').prop('disabled', false).removeClass('disabled').val('Paste Link');
				updateLobbyUi();
			});
	}

	window.addEventListener('blur', G.onBlur.bind(G), false);
	window.addEventListener('focus', G.onFocus.bind(G), false);

	// Function to disable scroll and arrow keys
	function disableScrollAndArrowKeys(element: HTMLElement) {
		const $element = $j(element);
		$element.attr('tabindex', '0'); // Set tabindex to make element focusable

		$element.on('mouseover', () => {
			// Add event listener for mouse over game area
			$element.focus(); // Focus the element
			$element.on('wheel', (e) => {
				e.preventDefault();
			});
			$element.on('keydown', (e) => {
				e.preventDefault();
			});

			$element.on('mouseout', () => {
				$element.blur(); // Remove focus from the element when mouse leaves game area
			});
		});
	}

	disableScrollAndArrowKeys(document.getElementById('loader')); // Disable scroll and arrow keys for loader element

	// Add listener for Fullscreen API
	const fullscreen = new Fullscreen(document.getElementById('fullscreen'));
	$j('#fullscreen').on('click', () => fullscreen.toggle());

	const isTyping = (event) => {
		const target = event.target as HTMLElement;
		if (!target) {
			return false;
		}

		if (target.tagName === 'TEXTAREA' || target.isContentEditable) {
			return true;
		}

		if (target.tagName !== 'INPUT') {
			return false;
		}

		const input = target as HTMLInputElement;
		return [
			'text',
			'search',
			'url',
			'tel',
			'email',
			'password',
			'number',
			'date',
			'month',
			'week',
			'time',
			'datetime-local',
		].includes(input.type);
	};

	const togglePlayer = (index: number) => {
		const $player = $j(`#player${index}`);
		if ($player.length === 0) {
			return;
		}

		$player.prop('checked', !$player.prop('checked')).trigger('change');
	};

	const startScreenHotkeys = {
		Space: {
			keyDownTest() {
				return true;
			},
			keyDownAction(event) {
				if (DEBUG && event.shiftKey) {
					$j('#startButton').trigger('contextmenu');
					return;
				}

				startGame();
			},
		},
		Enter: {
			keyDownTest() {
				return true;
			},
			keyDownAction(event) {
				if (DEBUG && event.shiftKey) {
					$j('#startButton').trigger('contextmenu');
					return;
				}

				startGame();
			},
		},
		KeyF: {
			keyDownTest(event) {
				return event.shiftKey;
			},
			keyDownAction() {
				fullscreen.toggle();
			},
		},
		F11: {
			keyDownTest() {
				return true;
			},
			keyDownAction(event) {
				event.preventDefault();
				fullscreen.toggle();
			},
		},
		KeyL: {
			keyDownTest(event) {
				return event.metaKey && event.ctrlKey;
			},
			keyDownAction() {
				readLogFromFile()
					.then((log) => G.gamelog.load(log as string))
					.catch((err) => {
						alert('An error occurred while loading the log file');
						console.log(err);
					});
			},
		},
		Digit1: {
			keyDownTest(event) {
				return !isTyping(event);
			},
			keyDownAction() {
				togglePlayer(1);
			},
		},
		Digit2: {
			keyDownTest(event) {
				return !isTyping(event);
			},
			keyDownAction() {
				togglePlayer(2);
			},
		},
		Digit3: {
			keyDownTest(event) {
				return !isTyping(event);
			},
			keyDownAction() {
				togglePlayer(3);
			},
		},
		Digit4: {
			keyDownTest(event) {
				return !isTyping(event);
			},
			keyDownAction() {
				togglePlayer(4);
			},
		},
		Numpad1: {
			keyDownTest(event) {
				return !isTyping(event);
			},
			keyDownAction() {
				togglePlayer(1);
			},
		},
		Numpad2: {
			keyDownTest(event) {
				return !isTyping(event);
			},
			keyDownAction() {
				togglePlayer(2);
			},
		},
		Numpad3: {
			keyDownTest(event) {
				return !isTyping(event);
			},
			keyDownAction() {
				togglePlayer(3);
			},
		},
		Numpad4: {
			keyDownTest(event) {
				return !isTyping(event);
			},
			keyDownAction() {
				togglePlayer(4);
			},
		},
		Backquote: {
			keyDownTest(event) {
				return !isTyping(event) && !$j('#p4').prop('disabled');
			},
			keyDownAction() {
				const currentMode = $j('input[name="gameMode"]:checked').val();
				if (currentMode === '2') {
					$j('#p4').trigger('click');
				} else {
					$j('#p2').trigger('click');
				}
			},
		},
	};

	// Binding Hotkeys
	if (!DEBUG_DISABLE_HOTKEYS) {
		const handleStartScreenKeydown = (event) => {
			// Only process start-screen hotkeys when the prematch UI is active
			if (G.gameState !== 'initialized') {
				return;
			}

			const hotkey = startScreenHotkeys[event.code];

			if (hotkey === undefined) {
				return;
			}

			const { keyDownTest, keyDownAction } = hotkey;

			if (keyDownTest.call(this, event)) {
				event.preventDefault();
				keyDownAction.call(this, event);
			}
		};

		window.addEventListener('keydown', handleStartScreenKeydown);
	}

	if (G.multiplayer) {
		// TODO Remove after implementation 2 vs 2 in multiplayer mode
		forceTwoPlayerMode();
	}

	function updateStartPrompt() {
		const gameMode = parseInt($j('input[name="gameMode"]:checked').val() as string, 10) || 2;
		const player1Checked = $j('#player1').is(':checked');
		const player2Checked = $j('#player2').is(':checked');
		const player3Checked = $j('#player3').is(':checked');
		const player4Checked = $j('#player4').is(':checked');
		const demoMode =
			gameMode === 2
				? !player1Checked && !player2Checked
				: gameMode === 4 &&
				  !player1Checked &&
				  !player2Checked &&
				  !player3Checked &&
				  !player4Checked;

		$j('#start-btn span.blink:first').text(demoMode ? 'VIEW' : 'PRESS');
		$j('#start-btn span.blink:last').text(demoMode ? 'MODE' : 'BUTTON');
		$j('#startButton').val(demoMode ? 'DEMO' : 'START');
	}

	$j('input[name="gameMode"]').on('change input click', updateStartPrompt);
	$j('input[name="players"]').on('change input click', updateStartPrompt);
	updateStartPrompt();

	if (!joinCodeFromUrl) {
		$j('#lobbyCode').val('');
	}

	// Allow button game options to slide in prematch screen
	buttonSlide();

	// Create new Object to play audio in pre-match screen
	const beastAudio = new PreMatchAudioPlayer();

	const updateLobbyUi = (lobby = G.lobbyState) => {
		const isHost = Boolean(G.lobby?.isHost());
		const hasLobby = Boolean(G.lobby);
		const playerCount = lobby?.players.length ?? 0;
		const code = hasLobby ? G.lobbyCode || lobby?.code || '' : '';
		const inputCode = parseLobbyCodeInput(($j('#lobbyCode').val() as string) || '');
		const joinCode = code || (!hasLobby ? inputCode : '');

		if (isHost && code) {
			$j('#lobbyCode').val(code);
		}

		const $joinButton = $j('#joinMatchButton');
		const hasValidJoinCode = Boolean(joinCode);
		if (hasLobby && isHost && playerCount < 2) {
			$joinButton.prop('disabled', true);
			$joinButton.val('Paste Link');
			$joinButton.toggleClass('disabled', true);
		} else if (!hasLobby) {
			$joinButton.prop('disabled', false);
			$joinButton.val(hasValidJoinCode ? 'Join Match' : 'Paste Link');
			$joinButton.toggleClass('disabled', false);
		} else {
			$joinButton.prop('disabled', hasLobby || !hasValidJoinCode);
			$joinButton.val(hasLobby ? 'Joined Match' : hasValidJoinCode ? 'Join Match' : 'Paste Link');
			$joinButton.toggleClass('disabled', hasLobby || !hasValidJoinCode);
		}

		const $createButton = $j('#createLobbyButton');
		$createButton.prop('disabled', false);
		$createButton.toggleClass('disabled', false);
		if (!hasLobby) {
			$createButton.val('Create Lobby');
		} else if (isHost && playerCount < 2) {
			$createButton.val('Copy Link');
		} else if (isHost) {
			$createButton.val('Start Match');
		} else {
			$createButton.val('Waiting Host');
			$createButton.prop('disabled', true);
			$createButton.toggleClass('disabled', true);
		}
	};

	let previousPlayerCount = 0;

	G.onLobbyUpdate = (lobby) => {
		const isHost = Boolean(G.lobby?.isHost());
		const playerCount = lobby?.players.length ?? 0;

		let showPlayerJoined = false;
		if (isHost && playerCount > previousPlayerCount && playerCount >= 2) {
			showPlayerJoined = true;
		}
		previousPlayerCount = playerCount;

		updateLobbyUi(lobby);

		if (showPlayerJoined && isHost) {
			const $createButton = $j('#createLobbyButton');
			$createButton.val('Player joined');
			window.setTimeout(() => updateLobbyUi(lobby), 1200);
		}
	};

	$j('#gameTitle').on('click', () => {
		beastAudio.playBeast();
	});

	$j('#orientation-message .framed-modal__return').on('click', async () => {
		$j('#orientation-message').hide();
	});

	const focusGameWindow = () => {
		const body = document.body as HTMLElement;
		if (body && typeof body.focus === 'function') {
			body.setAttribute('tabindex', '-1');
			body.focus();
		}
	};

	// Focus the form to enable "press enter to start the game" functionality
	$j('#startButton').trigger('focus');
	focusGameWindow();

	const startGame = () => {
		G.multiplayer = false;
		G.loadGame(getGameConfig());
	};

	const restoreGameLog = (log) => {
		G.gamelog.load(log);
	};

	const storeLastMatchLog = () => {
		if (!DEBUG || G.gameState === 'initialized') {
			return;
		}

		if (G.gamelog.actions.length === 0) {
			return;
		}

		try {
			localStorage.setItem(LAST_MATCH_LOG_STORAGE_KEY, G.gamelog.stringify());
		} catch (error) {
			console.warn('Could not persist last match replay log.', error);
		}
	};

	const replayLastStoredMatch = () => {
		let storedLog: string | null = null;

		try {
			storedLog = localStorage.getItem(LAST_MATCH_LOG_STORAGE_KEY);
		} catch (error) {
			console.warn('Could not read persisted match replay log.', error);
		}

		if (!storedLog) {
			return;
		}

		restoreGameLog(storedLog);
	};

	window.addEventListener('beforeunload', storeLastMatchLog);

	if (DEBUG) {
		// Dev shortcut: right-click Start/Demo to replay the latest locally stored match.
		$j('#startButton').on('contextmenu', (event) => {
			event.preventDefault();
			replayLastStoredMatch();
			return false;
		});
	}

	if (DEBUG_HAS_GAME_LOG) {
		setTimeout(() => restoreGameLog(DEBUG_GAME_LOG), 50);
	} else if (DEBUG_AUTO_START_GAME) {
		setTimeout(startGame, 50);
	}

	$j('form#gameSetup').on('submit', (e) => {
		// NOTE: Prevent submission
		e.preventDefault();
		startGame();
		// NOTE: Prevent submission
		return false;
	});

	$j('#createLobbyButton').on('click', async () => {
		if (!G.lobby) {
			$j('#lobbyError').addClass('hide');
			try {
				G.multiplayer = true;
				forceTwoPlayerMode();
				renderGameModeType(G.multiplayer);
				const config = getGameConfig() as unknown as import('./multiplayer').GameConfig;
				await G.createLobby(config);
				$j('#lobbyError').addClass('hide');
				updateLobbyUi();
			} catch (error) {
				console.error(error);
				$j('#lobbyError').text('Could not create lobby.').removeClass('hide');
				updateLobbyUi();
			}
			return false;
		}

		if ($j('#createLobbyButton').val() === 'Copy Link') {
			const $button = $j('#createLobbyButton');
			try {
				await G.lobby?.copyLobbyCode();
				$button.val('Link copied');
				window.setTimeout(() => updateLobbyUi(), 1200);
			} catch (error) {
				console.error(error);
				$j('#lobbyError').text('Could not copy lobby link.').removeClass('hide');
			}
			return false;
		}

		if (!G.lobby.isHost()) {
			$j('#lobbyError').text('Only the lobby host can start the match.').removeClass('hide');
			return false;
		}

		$j('#lobbyError').text('Waiting for players...').removeClass('hide');
		G.startMultiplayerMatch();
		return false;
	});

	$j('#lobbyCode').on('input keyup', () => {
		const $input = $j('#lobbyCode');
		const $joinButton = $j('#joinMatchButton');
		const parsedCode = parseLobbyCodeInput($input.val() as string);
		if (parsedCode && parsedCode !== $input.val()) {
			$input.val(parsedCode);
		}
		$input.removeClass('mandatory');
		$joinButton.val(parsedCode ? 'Join Match' : 'Paste Link');
		$joinButton.prop('disabled', !parsedCode);
		$joinButton.toggleClass('disabled', !parsedCode);
		updateLobbyUi();
	});

	$j('#lobbyCode').on('paste', async (event) => {
		const clipboardText =
			(event.originalEvent as ClipboardEvent).clipboardData?.getData('text') || '';
		const parsedCode = parseLobbyCodeInput(clipboardText);
		if (!parsedCode) {
			return;
		}

		event.preventDefault();
		const $input = $j('#lobbyCode');
		const $joinButton = $j('#joinMatchButton');
		$input.val(parsedCode);
		$input.removeClass('mandatory');
		$joinButton.val('Join Match');
		$joinButton.prop('disabled', false);
		$joinButton.toggleClass('disabled', false);
		updateLobbyUi();
	});

	$j('#joinMatchButton').on('click', async () => {
		const $input = $j('#lobbyCode');
		const rawCode = $input.val() as string;
		const code = parseLobbyCodeInput(rawCode);
		const $joinButton = $j('#joinMatchButton');
		const isPasteLinkState = $joinButton.val() === 'Paste Link';

		$input.removeClass('mandatory');

		// "Paste Link" state: try to read clipboard, then focus field if needed
		if (isPasteLinkState || !code) {
			try {
				const clipboardText = await navigator.clipboard.readText();
				const parsedCode = parseLobbyCodeInput(clipboardText);
				if (parsedCode) {
					$input.val(parsedCode);
					$input.removeClass('mandatory');
					$joinButton.val('Join Match');
					$joinButton.prop('disabled', false);
					$joinButton.toggleClass('disabled', false);
					updateLobbyUi();
					return false;
				}
			} catch (_e) {
				// Clipboard access denied, fall through to focus
			}
			$input.addClass('mandatory').trigger('focus');
			return false;
		}

		G.multiplayer = true;
		forceTwoPlayerMode();
		renderGameModeType(G.multiplayer);
		G.lobbyCode = code;
		$input.val(code);
		$j('#lobbyError').text('Joining lobby...').removeClass('hide');
		$joinButton.prop('disabled', true).addClass('disabled').val('Joining...');

		try {
			await G.joinLobbyByCode(code);
			$j('#lobbyError').addClass('hide');
			updateLobbyUi();
		} catch (error) {
			console.error(error);
			G.lobby?.leaveMatch();
			G.lobby = null;
			G.lobbyState = null;
			$j('#lobbyError')
				.text(`Could not join lobby: ${error.message || error}`)
				.removeClass('hide');
			$joinButton.prop('disabled', false).removeClass('disabled').val('Paste Link');
			updateLobbyUi();
		}

		return false;
	});
});

function parseLobbyCodeInput(value: string) {
	const trimmed = value.trim();

	if (!trimmed) {
		return '';
	}

	const joinParam = trimmed.match(/[?&]join=([^&]+)/i)?.[1];
	if (joinParam) {
		return normalizeLobbyCode(joinParam);
	}

	try {
		const url = new URL(trimmed);
		return normalizeLobbyCode(url.searchParams.get('join') || trimmed);
	} catch (_error) {
		return normalizeLobbyCode(trimmed);
	}
}

/**
 * force 1 vs 1 game mode
 * should be removed after implementation 2 vs 2 in multiplayer mode
 */
function forceTwoPlayerMode() {
	$j('#p2').trigger('click');
	$j('#p4').prop('disabled', true);
}

/**
 * read log from file
 * @returns {Promise<string>}
 */
function readLogFromFile() {
	// TODO: This would probably be better off in ./src/utility/gamelog.ts
	return new Promise((resolve, reject) => {
		const fileInput = document.createElement('input') as HTMLInputElement;
		fileInput.accept = '.ab';
		fileInput.type = 'file';

		fileInput.onchange = (event) => {
			const file = (event.target as HTMLInputElement).files[0];
			const reader = new FileReader();

			reader.readAsText(file);

			reader.onload = () => {
				resolve(reader.result);
			};

			reader.onerror = () => {
				reject(reader.error);
			};
		};

		fileInput.click();
	});
}

/**
 * Render the game mode text inside game form
 * @param {Boolean} isMultiPlayer Is playing in online multiplayer mode or hotSeat mode
 * @returns {Object} JQuery<HTMLElement>
 */
function renderGameModeType(isMultiPlayer) {
	const gameModeType = $j('#gameModeType');
	return isMultiPlayer ? gameModeType.text('[ Online ]') : gameModeType.text('[ Hotseat ]');
}

const LOCATIONS = ['Dark Forest', 'Frozen Wall', 'Shadow Cave', 'Dragon Bones'];

/**
 * Generate game config from form and return it.
 * @return {Partial<GameConfig>} The game config.
 */
export function getGameConfig() {
	const combatLocation = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
	const defaultConfig = {
		gameMode: parseInt($j('input[name="gameMode"]:checked').val() as string, 10),
		players: $j('input[name="players"]:checked')
			.map((_, element) => parseInt($j(element).val() as string, 10))
			.get(),
		creaLimitNbr: parseInt($j('input[name="activeUnits"]:checked').val() as string, 10), // DP counts as One
		unitDrops: parseInt($j('input[name="unitDrops"]:checked').val() as string, 10),
		abilityUpgrades: parseInt($j('input[name="abilityUpgrades"]:checked').val() as string, 10),
		plasma_amount: parseInt($j('input[name="plasmaPoints"]:checked').val() as string, 10),
		turnTimePool: parseInt($j('input[name="turnTime"]:checked').val() as string, 10),
		timePool: parseInt($j('input[name="timePool"]:checked').val() as string, 10) * 60,
		background_image: combatLocation,
		combatLocation,
		fullscreenMode: $j('#fullscreen').hasClass('fullscreenMode'),
	};
	return defaultConfig;
}

/**
 * Return true if an object has no keys.
 * @param {Object} obj The object to test.
 * @return {boolean} Empty or not.
 */
export function isEmpty(obj) {
	for (const key in obj) {
		if (Object.prototype.hasOwnProperty.call(obj, key)) {
			return false;
		}
	}

	return true;
}
