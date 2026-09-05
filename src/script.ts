import { locationPaths } from '../assets/index';

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
import { getDevvitAppVersion, getGameVersion } from './utility/clientVersion';

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
(window as any).G = G; // eslint-disable-line @typescript-eslint/no-explicit-any
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
	// Was an inline `oncontextmenu="return false;"` attribute on <body> — Devvit's CSP
	// (script-src-attr) blocks inline event handler attributes entirely, so this has to be
	// wired up from the bundled script instead.
	document.body.addEventListener('contextmenu', (event) => event.preventDefault());

	renderBuildBadge();

	function isPortraitViewport() {
		return window.matchMedia('(orientation: portrait) and (max-width: 600px)').matches;
	}

	function applyPortraitMode() {
		const wasPortrait = $j('body').hasClass('portrait-mode');
		const isPortrait = isPortraitViewport();

		if (isPortrait) {
			$j('body').addClass('portrait-mode');
			$j('#portrait-logo').show();
		} else {
			$j('body').removeClass('portrait-mode');
			$j('#portrait-logo').hide();
			$j('#combatwrapper').show();
			$j('#bottompanel').show();
		}

		if (G.Phaser && G.Phaser.scale) {
			G.Phaser.scale.parentIsWindow = !isPortrait;
			G.Phaser.scale.pageAlignVertically = !isPortrait;
			G.Phaser.scale.refresh();
			window.setTimeout(() => {
				if (G.Phaser && G.Phaser.scale) {
					G.Phaser.scale.refresh();
				}
			}, 100);
			window.setTimeout(() => {
				if (G.Phaser && G.Phaser.scale) {
					window.dispatchEvent(new Event('resize'));
				}
			}, 250);
		}

		if (wasPortrait && !isPortrait && G.UI) {
			G.UI.updateQueueDisplay();
		}

		if (G.UI && G.UI.dashopen) {
			setTimeout(() => {
				G.UI.resizeDash();
			}, 300);
		}
	}

	applyPortraitMode();
	window.addEventListener('resize', applyPortraitMode);

	if (typeof ResizeObserver !== 'undefined') {
		const resizeObserver = new ResizeObserver(() => applyPortraitMode());
		resizeObserver.observe(document.body);
	}

	const scrim = $j('.scrim');
	scrim.on('transitionend', function () {
		scrim.remove();
	});
	scrim.removeClass('loading');
	renderGameModeType(G.multiplayer);

	let isJoiningLobby = false;

	const joinCodeFromUrl = new URLSearchParams(window.location.search).get('join');
	const lobbyCodeFromUrl = new URLSearchParams(window.location.search).get('lobby');
	const netMode = new URLSearchParams(window.location.search).get('net');
	let devvitPlayerId = new URLSearchParams(window.location.search).get('playerId') || 'anon';

	// The Devvit splash (`splash.html`) launches the match in the larger expanded
	// "pop-up" webview via requestExpandedMode(_, 'game'). Expanded mode can't carry
	// query parameters, so the splash stashes the launch intent here and the full
	// game reads it on bootstrap. This also lets us detect we're running expanded
	// (handy for hiding the inline-only prematch chrome).
	let devvitLaunch: { mode: 'bot' | 'queue' | 'lobby'; playerId: string; lobby?: string } | null =
		null;
	try {
		const raw = localStorage.getItem('ab:devvitLaunch');
		if (raw) {
			devvitLaunch = JSON.parse(raw) as typeof devvitLaunch;
			localStorage.removeItem('ab:devvitLaunch');
		}
	} catch (_error) {
		// Ignore malformed/unavailable storage.
	}

	const effectiveNetMode = netMode === 'devvit' ? 'devvit' : devvitLaunch ? 'devvit' : null;
	if (devvitLaunch) {
		devvitPlayerId = devvitLaunch.playerId || devvitPlayerId;
	}

	if (effectiveNetMode === 'devvit') {
		$j('body').addClass('devvit-mode');

		if (devvitLaunch) {
			// Launched from the Devvit splash in expanded ("pop-up") mode.
			if (devvitLaunch.mode === 'bot') {
				G.multiplayer = false;
				const botConfig = {
					...getGameConfig(),
					gameMode: 2,
					players: [0],
				};
				G.loadGame(botConfig);
			} else if (devvitLaunch.mode === 'queue') {
				// The splash already opened expanded mode on the click gesture; now we
				// run the existing, tested queue flow (poll + countdown) in the larger
				// webview, reusing the in-game Devvit lobby UI.
				setupDevvitQueueUi(devvitPlayerId);
				setDevvitQueueButtonState('joining');
				attachDevvitQueueButtonHandler(devvitPlayerId);
				attachDevvitBotPracticeButtonHandler(devvitPlayerId);
				void joinDevvitQueue(devvitPlayerId);
			} else if (devvitLaunch.lobby) {
				const parsedJoinCode = parseLobbyCodeInput(devvitLaunch.lobby);
				if (parsedJoinCode) {
					G.multiplayer = true;
					forceTwoPlayerMode();
					renderGameModeType(G.multiplayer);
					G.lobbyCode = parsedJoinCode;
					$j('#lobbyCode').val(G.lobbyCode);
					isJoiningLobby = true;
					setDevvitQueueButtonState('matched');
					G.joinLobbyByCode(G.lobbyCode)
						.then(() => {
							isJoiningLobby = false;
							updateLobbyUi();
						})
						.catch((error) => {
							isJoiningLobby = false;
							console.error(error);
							G.lobby?.leaveMatch();
							G.lobby = null;
							G.lobbyState = null;
							G.lobbyCode = '';
							G.multiplayer = false;
							$j('#p4').prop('disabled', false);
							renderGameModeType(G.multiplayer);
							$j('#lobbyCode').val('');
							updateLobbyUi();
							setDevvitQueueButtonState('join');
							attachDevvitQueueButtonHandler(devvitPlayerId);
						});
				}
			}
		} else if (lobbyCodeFromUrl && lobbyCodeFromUrl !== 'menu') {
			const parsedJoinCode = parseLobbyCodeInput(lobbyCodeFromUrl);
			if (parsedJoinCode) {
				G.multiplayer = true;
				forceTwoPlayerMode();
				renderGameModeType(G.multiplayer);
				G.lobbyCode = parsedJoinCode;
				$j('#lobbyCode').val(G.lobbyCode);
				isJoiningLobby = true;
				setDevvitQueueButtonState('matched');
				G.joinLobbyByCode(G.lobbyCode)
					.then(() => {
						isJoiningLobby = false;
						updateLobbyUi();
					})
					.catch((error) => {
						isJoiningLobby = false;
						console.error(error);
						G.lobby?.leaveMatch();
						G.lobby = null;
						G.lobbyState = null;
						G.lobbyCode = '';
						G.multiplayer = false;
						$j('#p4').prop('disabled', false);
						renderGameModeType(G.multiplayer);
						$j('#lobbyCode').val('');
						updateLobbyUi();
						setDevvitQueueButtonState('join');
						attachDevvitQueueButtonHandler(devvitPlayerId);
					});
			}
		} else {
			setupDevvitQueueUi(devvitPlayerId);
		}
	} else if (joinCodeFromUrl) {
		const parsedJoinCode = parseLobbyCodeInput(joinCodeFromUrl);
		if (parsedJoinCode) {
			G.multiplayer = true;
			forceTwoPlayerMode();
			renderGameModeType(G.multiplayer);
			G.lobbyCode = parsedJoinCode;
			$j('#lobbyCode').val(G.lobbyCode);
			isJoiningLobby = true;
			G.joinLobbyByCode(G.lobbyCode)
				.then(() => {
					isJoiningLobby = false;
					updateLobbyUi();
				})
				.catch((error) => {
					isJoiningLobby = false;
					console.error(error);
					G.lobby?.leaveMatch();
					G.lobby = null;
					G.lobbyState = null;
					G.lobbyCode = '';
					G.multiplayer = false;
					$j('#p4').prop('disabled', false);
					renderGameModeType(G.multiplayer);
					$j('#lobbyCode').val('');
					updateLobbyUi();
				});
		}
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

	// The Fullscreen API requires the embedding page/iframe chain to explicitly allow it
	// (Permissions-Policy: fullscreen). Inside Reddit's webview we don't control that, so
	// `requestFullscreen()` silently fails there — hide the button instead of leaving a
	// control that looks clickable but does nothing.
	if (!document.fullscreenEnabled) {
		$j('#fullscreen').hide();
	}

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
		const code = hasLobby ? G.lobbyCode || lobby?.code || '' : '';
		const inputCode = parseLobbyCodeInput(($j('#lobbyCode').val() as string) || '');

		if (isHost && code) {
			$j('#lobbyCode').val(code);
		}

		const $joinButton = $j('#joinMatchButton');
		if (hasLobby && isHost) {
			$joinButton.prop('disabled', false);
			$joinButton.val('Cancel Lobby');
			$joinButton.toggleClass('disabled', false);
		} else if (hasLobby) {
			$joinButton.prop('disabled', true);
			$joinButton.val('Waiting...');
			$joinButton.toggleClass('disabled', true);
		} else if (isJoiningLobby) {
			$joinButton.prop('disabled', true);
			$joinButton.val('Joining...');
			$joinButton.toggleClass('disabled', true);
		} else {
			const hasValidJoinCode = Boolean(inputCode);
			$joinButton.prop('disabled', !hasValidJoinCode);
			$joinButton.val('Join Match');
			$joinButton.toggleClass('disabled', !hasValidJoinCode);
		}

		const $createButton = $j('#createLobbyButton');
		$createButton.prop('disabled', false);
		$createButton.toggleClass('disabled', false);
		if (!hasLobby) {
			$createButton.val('Create Lobby');
		} else if (isHost) {
			$createButton.val('Waiting Player');
			$createButton.prop('disabled', true);
			$createButton.toggleClass('disabled', true);
		} else {
			$createButton.val('Waiting Host');
			$createButton.prop('disabled', true);
			$createButton.toggleClass('disabled', true);
		}
	};

	updateLobbyUi();

	window.addEventListener('focus', async () => {
		if (G.gameState !== 'initialized') {
			return;
		}
		if (G.lobby) {
			return;
		}
		if (!$j('#pre-match').is(':visible')) {
			return;
		}
		// Skip when the peer-to-peer lobby row is hidden (e.g. Devvit mode, which uses its
		// own queue UI instead) — reading the clipboard here just triggers an unnecessary
		// browser "Paste" permission prompt for a field the player can't even see.
		if (!$j('#createdLobby').is(':visible')) {
			return;
		}

		try {
			const clipboardText = await navigator.clipboard.readText();
			const parsedCode = parseLobbyCodeInput(clipboardText);
			if (!parsedCode) {
				return;
			}

			const $input = $j('#lobbyCode');
			const currentCode = parseLobbyCodeInput(($input.val() as string) || '');
			if (parsedCode === currentCode) {
				return;
			}

			$input.val(parsedCode);
			updateLobbyUi();
		} catch (_e) {
			// Clipboard access unavailable
		}
	});

	let previousPlayerCount = 0;

	G.onLobbyUpdate = (lobby) => {
		const isHost = Boolean(G.lobby?.isHost());
		const playerCount = lobby?.players.length ?? 0;

		if (isHost && playerCount > previousPlayerCount && playerCount >= 2) {
			previousPlayerCount = playerCount;
			updateLobbyUi(lobby);
			const $createButton = $j('#createLobbyButton');
			$createButton.val('Starting match');
			window.setTimeout(
				() =>
					G.startMultiplayerMatch(getGameConfig() as unknown as import('./multiplayer').GameConfig),
				800,
			);
			return;
		}
		previousPlayerCount = playerCount;

		updateLobbyUi(lobby);
	};

	$j('#gameTitle').on('click', () => {
		beastAudio.playBeast();
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
			try {
				G.multiplayer = true;
				forceTwoPlayerMode();
				renderGameModeType(G.multiplayer);
				const config = getGameConfig() as unknown as import('./multiplayer').GameConfig;
				await G.createLobby(config);
				updateLobbyUi();

				const $button = $j('#createLobbyButton');
				try {
					await G.lobby?.copyLobbyCode();
					$button.val('Link copied');
					$button.prop('disabled', true);
					$button.toggleClass('disabled', true);
					window.setTimeout(() => updateLobbyUi(), 1000);
				} catch (_error) {
					// Clipboard unavailable, silently continue
				}
			} catch (error) {
				console.error(error);
				const $button = $j('#createLobbyButton');
				$button.val('Failed');
				$button.prop('disabled', true);
				$button.toggleClass('disabled', true);
				window.setTimeout(() => updateLobbyUi(), 1200);
			}
			return false;
		}

		return false;
	});

	$j('#lobbyCode').on('input keyup', () => {
		const $input = $j('#lobbyCode');
		const parsedCode = parseLobbyCodeInput($input.val() as string);
		if (parsedCode && parsedCode !== $input.val()) {
			$input.val(parsedCode);
		}
		$input.removeClass('mandatory');
		updateLobbyUi();
	});

	$j('#lobbyCode').on('paste', (event) => {
		const clipboardText =
			(event.originalEvent as ClipboardEvent).clipboardData?.getData('text') || '';
		const parsedCode = parseLobbyCodeInput(clipboardText);
		if (!parsedCode) {
			return;
		}

		event.preventDefault();
		$j('#lobbyCode').val(parsedCode);
		updateLobbyUi();
	});

	$j('#lobbyCode').on('keydown', (event) => {
		if (event.key === 'Enter') {
			const $joinButton = $j('#joinMatchButton');
			if (!$joinButton.prop('disabled')) {
				$joinButton.trigger('click');
			}
			event.preventDefault();
			event.stopPropagation();
		}
	});

	$j('#joinMatchButton').on('click', async () => {
		const $input = $j('#lobbyCode');

		if (G.lobby && G.lobby.isHost()) {
			try {
				await navigator.clipboard.writeText('');
			} catch (_e) {
				// Clipboard API unavailable
			}
			G.lobby.leaveMatch();
			G.lobby = null;
			G.lobbyState = null;
			G.lobbyCode = '';
			G.multiplayer = false;
			$j('#p4').prop('disabled', false);
			renderGameModeType(G.multiplayer);
			$input.val('');
			updateLobbyUi();
			return false;
		}

		const $joinButton = $j('#joinMatchButton');
		const rawCode = $input.val() as string;
		const code = parseLobbyCodeInput(rawCode);

		if (!code) {
			$input.addClass('mandatory').trigger('focus');
			return false;
		}

		G.multiplayer = true;
		forceTwoPlayerMode();
		renderGameModeType(G.multiplayer);
		G.lobbyCode = code;
		$input.val(code);
		isJoiningLobby = true;
		$joinButton.prop('disabled', true).addClass('disabled').val('Joining...');
		const joinStartTime = Date.now();

		try {
			await G.joinLobbyByCode(code);
			const elapsed = Date.now() - joinStartTime;
			if (elapsed < 800) {
				await new Promise((resolve) => setTimeout(resolve, 800 - elapsed));
			}
			isJoiningLobby = false;
			updateLobbyUi();
		} catch (error) {
			isJoiningLobby = false;
			console.error(error);
			try {
				await navigator.clipboard.writeText('');
			} catch (_e) {
				// Clipboard unavailable
			}
			G.lobby?.leaveMatch();
			G.lobby = null;
			G.lobbyState = null;
			G.lobbyCode = '';
			G.multiplayer = false;
			$j('#p4').prop('disabled', false);
			renderGameModeType(G.multiplayer);
			$j('#lobbyCode').val('');
			const elapsed = Date.now() - joinStartTime;
			if (elapsed < 800) {
				await new Promise((resolve) => setTimeout(resolve, 800 - elapsed));
			}
			$joinButton.val("Can't Join");
			$joinButton.prop('disabled', true);
			$joinButton.toggleClass('disabled', true);
		}

		return false;
	});
});

const DEVVIT_QUEUE_COUNTDOWN_SECONDS = 30;
let devvitQueueActive = false;
let devvitQueueCancelled = false;
let devvitQueueCountdownTimer: number | undefined;
let devvitQueueRunId = 0;
let devvitQueueMatchPendingNavigation = false;

type DevvitQueueButtonState = 'join' | 'joining' | 'leave' | 'matched';

function setDevvitQueueButtonState(state: DevvitQueueButtonState) {
	const $button = $j('#devvitQueueButton');

	switch (state) {
		case 'join':
			$button.val('Online Duel').prop('disabled', false).toggleClass('disabled', false);
			break;
		case 'joining':
			$button.val('Joining...').prop('disabled', true).toggleClass('disabled', true);
			break;
		case 'leave':
			$button.val('Cancel Queue').prop('disabled', false).toggleClass('disabled', false);
			break;
		case 'matched':
			$button.val('Match Found').prop('disabled', true).toggleClass('disabled', true);
			break;
	}
}

function stopDevvitQueueCountdown() {
	if (devvitQueueCountdownTimer !== undefined) {
		window.clearInterval(devvitQueueCountdownTimer);
		devvitQueueCountdownTimer = undefined;
	}
}

/**
 * Render a small build-version badge in the lower-right corner. Lets testers
 * tell an old deployed Devvit build from a new one at a glance (Devvit keeps
 * several experience versions live after upload, so "looks broken" can just
 * mean "you're on 0.0.51, not the fix").
 *
 * Only created for Devvit builds (non-Devvit builds have their own version
 * display). In the pre-match screen the badge is always visible and stacks
 * the game version on top of the Devvit experience version. During gameplay
 * it is hidden by default — the version is surfaced in the lower-right
 * quickInfo tooltip instead (see gameFormatter in ui/interface.ts).
 */
function renderBuildBadge(): void {
	const devvit = getDevvitAppVersion();
	if (!devvit) return;

	const existing = document.getElementById('buildBadge');
	const badge = existing ?? document.createElement('div');
	badge.id = 'buildBadge';
	badge.className = 'build-badge';
	badge.classList.add('build-badge--two-line');
	badge.innerHTML =
		`<div class="build-badge__game">${getGameVersion()}</div>` +
		`<div class="build-badge__devvit">r${devvit}</div>`;
	if (!existing) {
		document.body.appendChild(badge);
	}
}

function setupDevvitQueueUi(playerId: string) {
	refreshDevvitMatchesCounter();
	window.setInterval(refreshDevvitMatchesCounter, 8000);

	if (devvitQueueMatchPendingNavigation) {
		setDevvitQueueButtonState('matched');
		return;
	}

	attachDevvitQueueButtonHandler(playerId);
	attachDevvitBotPracticeButtonHandler(playerId);
	setDevvitQueueButtonState('join');
}

function attachDevvitBotPracticeButtonHandler(playerId: string) {
	$j('#devvitBotPracticeButton')
		.off('click')
		.on('click', () => {
			void startDevvitBotPractice(playerId);
		});
}

async function startDevvitBotPractice(playerId: string) {
	const $button = $j('#devvitBotPracticeButton');
	if ($button.prop('disabled')) {
		return;
	}

	// Cancel any in-progress human queue search first so the two flows don't race.
	if (devvitQueueActive) {
		await leaveDevvitQueue(playerId);
	}

	$button.val('Loading...').prop('disabled', true).toggleClass('disabled', true);
	$j('#devvitQueueButton').prop('disabled', true).toggleClass('disabled', true);
	$j('#devvitQueueStatus').text('Starting bot practice...');

	// Bot Practice is a purely local (hotseat) 1v1: the human is player 0 and the
	// engine auto-assigns every other player to the client-side BotController
	// (see game.ts — `players.includes(id) ? 'human' : 'bot'`). No server lobby or
	// matchmaking is involved, so there's nothing to poll and nothing to navigate to.
	try {
		G.multiplayer = false;
		const config = {
			...getGameConfig(),
			gameMode: 2,
			players: [0],
		};
		G.loadGame(config);
	} catch (error) {
		console.error('Bot practice error:', error);
		$j('#devvitQueueStatus').text('Could not start bot practice, try again!');
		$button.val('Bot Practice').prop('disabled', false).toggleClass('disabled', false);
		$j('#devvitQueueButton').prop('disabled', false).toggleClass('disabled', false);
	}
}

function attachDevvitQueueButtonHandler(playerId: string) {
	$j('#devvitQueueButton')
		.off('click')
		.on('click', () => {
			if (devvitQueueActive) {
				leaveDevvitQueue(playerId);
			} else {
				joinDevvitQueue(playerId);
			}
		});
}

async function refreshDevvitMatchesCounter() {
	try {
		const res = await fetch('/api/queue/stats');
		if (!res.ok) {
			return;
		}

		const data = (await res.json()) as { queued: number; ongoingMatches: number };
		const parts: string[] = [];
		if (data.ongoingMatches > 0) {
			parts.push(`${data.ongoingMatches} match${data.ongoingMatches === 1 ? '' : 'es'} ongoing`);
		}
		if (data.queued > 0) {
			parts.push(`${data.queued} in queue`);
		}
		$j('#devvitMatchesCounter').text(parts.join(' · '));
	} catch (_error) {
		// Non-critical; leave the counter as-is on failure.
	}
}

function joinDevvitQueue(playerId: string) {
	devvitQueueRunId += 1;
	devvitQueueActive = true;
	devvitQueueCancelled = false;
	devvitQueueMatchPendingNavigation = false;
	setDevvitQueueButtonState('joining');
	$j('#devvitQueueStatus').text('');
	void startDevvitQueue(playerId, devvitQueueRunId);
}

async function leaveDevvitQueue(playerId: string, message = '', runId?: number) {
	if (runId != null && runId !== devvitQueueRunId) {
		return;
	}

	devvitQueueActive = false;
	devvitQueueCancelled = true;
	devvitQueueMatchPendingNavigation = false;

	stopDevvitQueueCountdown();

	setDevvitQueueButtonState('join');
	$j('#devvitQueueStatus').text(message);

	try {
		await fetch('/api/queue/leave', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ playerId }),
		});
	} catch (_error) {
		// Best-effort; queue entries also expire server-side on their own.
	}

	refreshDevvitMatchesCounter();
}

async function startDevvitQueue(playerId: string, runId: number) {
	let remaining = DEVVIT_QUEUE_COUNTDOWN_SECONDS;
	const updateCountdown = () => {
		$j('#devvitQueueStatus').text(`Searching for opponent... ${remaining}s`);
	};

	try {
		const joinRes = await fetch('/api/queue/join', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ playerId }),
		});

		if (!joinRes.ok) {
			throw new Error('Failed to join queue');
		}

		const joinData = (await joinRes.json()) as { status: string; lobbyCode?: string };

		if (runId !== devvitQueueRunId) {
			return;
		}

		if (joinData.status === 'matched' && joinData.lobbyCode) {
			devvitQueueActive = false;
			devvitQueueCancelled = true;
			devvitQueueMatchPendingNavigation = true;
			stopDevvitQueueCountdown();
			setDevvitQueueButtonState('matched');
			navigateToLobby(joinData.lobbyCode);
			return;
		}

		if (devvitQueueCancelled) {
			return;
		}

		// The initial join didn't find an immediate match — now it's safe to let the
		// player cancel while we keep polling in the background.
		setDevvitQueueButtonState('leave');
		updateCountdown();
		devvitQueueCountdownTimer = window.setInterval(() => {
			remaining = Math.max(0, remaining - 1);
			updateCountdown();
		}, 1000);

		// Poll a little past the visible countdown so a match resolved right at the
		// boundary (e.g. the bot-fallback timeout) still gets picked up.
		const maxPolls = DEVVIT_QUEUE_COUNTDOWN_SECONDS + 5;
		for (let i = 0; i < maxPolls && !devvitQueueCancelled; i++) {
			await new Promise((resolve) => setTimeout(resolve, 1000));
			if (runId !== devvitQueueRunId) {
				return;
			}

			if (devvitQueueCancelled) {
				return;
			}

			const statusRes = await fetch(`/api/queue/status?playerId=${encodeURIComponent(playerId)}`);
			if (!statusRes.ok) {
				continue;
			}

			const statusData = (await statusRes.json()) as { status: string; lobbyCode?: string };
			if (statusData.status === 'matched' && statusData.lobbyCode) {
				devvitQueueActive = false;
				devvitQueueCancelled = true;
				devvitQueueMatchPendingNavigation = true;
				stopDevvitQueueCountdown();
				setDevvitQueueButtonState('matched');
				navigateToLobby(statusData.lobbyCode);
				return;
			}
		}

		if (!devvitQueueCancelled) {
			await leaveDevvitQueue(playerId, 'No opponent found, try again!', runId);
		}
	} catch (error) {
		console.error('Queue error:', error);
		if (!devvitQueueCancelled) {
			await leaveDevvitQueue(playerId, 'Matchmaking error, try again!', runId);
		}
	}
}

function navigateToLobby(lobbyCode: string) {
	const url = new URL(window.location.href);
	url.searchParams.set('lobby', lobbyCode);
	window.location.href = url.toString();
}

function parseLobbyCodeInput(value: string) {
	const trimmed = value.trim();

	if (!trimmed) {
		return '';
	}

	const joinParam = trimmed.match(/[?&]join=([^&]+)/i)?.[1];
	const normalized = normalizeLobbyCode(
		joinParam
			? joinParam
			: (() => {
					try {
						const url = new URL(trimmed);
						return url.searchParams.get('join') || trimmed;
					} catch (_error) {
						return trimmed;
					}
			  })(),
	);

	if (!/^AB-[A-Z0-9]{4}$/.test(normalized)) {
		return '';
	}

	return normalized;
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

/**
 * Generate game config from form and return it.
 * @return {Partial<GameConfig>} The game config.
 */
export function getGameConfig() {
	const combatLocation = locationPaths[Math.floor(Math.random() * locationPaths.length)];
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


// Landscape orientation lock by default (#2711)
function lockLandscapeOrientation(): void {
	if (typeof window !== "undefined" && window.screen && "orientation" in window.screen) {
		const orientation = (window.screen as any).orientation;
		if (orientation && typeof orientation.lock === "function") {
			orientation.lock("landscape").catch(() => {
				// Non-fullscreen or unsupported device fallback
			});
		}
	}
}

if (typeof window !== "undefined") {
	window.addEventListener("DOMContentLoaded", lockLandscapeOrientation);
	window.addEventListener("fullscreenchange", lockLandscapeOrientation);
}
