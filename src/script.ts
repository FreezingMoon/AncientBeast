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
import { applyPortraitScale, refreshScale } from './display/scale';
import { installTouchSlideHover } from './input/touch-slide-hover';

import { installAvatarStyles } from './style/avatar-styles';
import {
	DEBUG,
	DEBUG_AUTO_START_GAME,
	DEBUG_DISABLE_HOTKEYS,
	DEBUG_GAME_LOG,
	DEBUG_HAS_GAME_LOG,
} from './debug';
import { getDevvitAppVersion, getGameVersion } from './utility/clientVersion';
import { prefetchPhaser } from './phaser/runtime';
import type { ReplayMode } from './utility/gamelog';
import { GameSnapshotSerializer } from './engine/GameSnapshot';
import { funjeInit } from '../platforms/funje/funje';
import { bootstrapCrazyGames } from '../platforms/crazygames/crazygames';
import { startInstantMultiplayerLobby } from '../platforms/crazygames/instant-multiplayer';
import { applyPlatformMute } from './sound/soundsys';
import { setPlayerDisplayName } from './multiplayer/identity';

const PRE_MATCH_SETTINGS_STORAGE_KEY = 'ab:pre-match-settings';

type PreMatchSettings = {
	gameMode: number;
	players: number[];
	plasmaPoints: number;
	unitDrops: number;
	activeUnits: number;
	abilityUpgrades: number;
	turnTime: number;
	timePool: number;
};

const PRE_MATCH_SETTING_NAMES = [
	'gameMode',
	'players',
	'plasmaPoints',
	'unitDrops',
	'activeUnits',
	'abilityUpgrades',
	'turnTime',
	'timePool',
] as const;

function clampPreMatchInt(value: unknown, allowed: number[], fallback: number): number {
	const n = typeof value === 'number' ? value : parseInt(String(value), 10);
	return allowed.includes(n) ? n : fallback;
}

function loadPreMatchSettings(): Partial<PreMatchSettings> | null {
	try {
		const raw = localStorage.getItem(PRE_MATCH_SETTINGS_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<PreMatchSettings>;
		return parsed && typeof parsed === 'object' ? parsed : null;
	} catch {
		return null;
	}
}

function savePreMatchSettings(): void {
	try {
		const settings = getPreMatchSettingsFromForm();
		localStorage.setItem(PRE_MATCH_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
	} catch {
		// Storage may be unavailable.
	}
}

function setCheckedRadio(name: string, value: number): void {
	const input = $j(`input[name="${name}"][value="${value}"]`);
	if (input.length) {
		input.prop('checked', true);
	}
}

function getPreMatchSettingsFromForm(): PreMatchSettings {
	const gameMode = clampPreMatchInt($j('input[name="gameMode"]:checked').val(), [2, 4], 2);
	let players = $j('input[name="players"]:checked')
		.map((_, element) => parseInt($j(element).val() as string, 10))
		.get()
		.filter((p: number) => [0, 1, 2, 3].includes(p));
	if (!players.length) {
		players = [0];
	}
	return {
		gameMode,
		players,
		plasmaPoints: clampPreMatchInt(
			$j('input[name="plasmaPoints"]:checked').val(),
			[20, 30, 40, 50, 60, 70, 80, 90, 100],
			30,
		),
		unitDrops: clampPreMatchInt($j('input[name="unitDrops"]:checked').val(), [0, 1], 1),
		activeUnits: clampPreMatchInt(
			$j('input[name="activeUnits"]:checked').val(),
			[1, 2, 3, 4, 5, 6, 7],
			3,
		),
		abilityUpgrades: clampPreMatchInt(
			$j('input[name="abilityUpgrades"]:checked').val(),
			[-1, 5, 4, 3, 2, 1, 0],
			3,
		),
		turnTime: clampPreMatchInt(
			$j('input[name="turnTime"]:checked').val(),
			[20, 40, 60, 80, 99, -1],
			-1,
		),
		timePool: clampPreMatchInt(
			$j('input[name="timePool"]:checked').val(),
			[15, 20, 25, 30, -1],
			-1,
		),
	};
}

function applyPreMatchSettings(settings: Partial<PreMatchSettings> | null): void {
	if (!settings) return;

	if (settings.gameMode !== undefined) {
		setCheckedRadio('gameMode', clampPreMatchInt(settings.gameMode, [2, 4], 2));
	}

	if (Array.isArray(settings.players)) {
		const valid = settings.players.filter((p): p is number => [0, 1, 2, 3].includes(p as number));
		$j('input[name="players"]').each((_, element) => {
			const val = parseInt($j(element).val() as string, 10);
			$j(element).prop('checked', valid.includes(val));
		});
		// Ensure at least P1 remains checked if nothing valid restored.
		if (!$j('input[name="players"]:checked').length) {
			$j('#player1').prop('checked', true);
		}
	}

	if (settings.plasmaPoints !== undefined) {
		setCheckedRadio(
			'plasmaPoints',
			clampPreMatchInt(settings.plasmaPoints, [20, 30, 40, 50, 60, 70, 80, 90, 100], 30),
		);
	}
	if (settings.unitDrops !== undefined) {
		setCheckedRadio('unitDrops', clampPreMatchInt(settings.unitDrops, [0, 1], 1));
	}
	if (settings.activeUnits !== undefined) {
		setCheckedRadio(
			'activeUnits',
			clampPreMatchInt(settings.activeUnits, [1, 2, 3, 4, 5, 6, 7], 3),
		);
	}
	if (settings.abilityUpgrades !== undefined) {
		setCheckedRadio(
			'abilityUpgrades',
			clampPreMatchInt(settings.abilityUpgrades, [-1, 5, 4, 3, 2, 1, 0], 3),
		);
	}
	if (settings.turnTime !== undefined) {
		setCheckedRadio('turnTime', clampPreMatchInt(settings.turnTime, [20, 40, 60, 80, 99, -1], -1));
	}
	if (settings.timePool !== undefined) {
		setCheckedRadio('timePool', clampPreMatchInt(settings.timePool, [15, 20, 25, 30, -1], -1));
	}
}

function bindPreMatchSettingsPersistence(): void {
	PRE_MATCH_SETTING_NAMES.forEach((name) => {
		$j(`input[name="${name}"]`).on('change input click', savePreMatchSettings);
	});
}

if (DEBUG && 'serviceWorker' in navigator) {
	navigator.serviceWorker
		.getRegistrations()
		.then((registrations) => registrations.forEach((registration) => registration.unregister()));
}

void funjeInit();

// Load the stylesheet
import './style/main.less';

installAvatarStyles();
installTouchSlideHover();

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
AB.playGame = (str) => AB.currentGame.gamelog.play(str);
window.AB = AB;
// Load the abilities
// `import.meta.glob` is required here: a fully dynamic `import()` specifier has
// no static part for the bundler to resolve, so it is left as a bare runtime
// request that 404s against the deployed bundle.
const abilityModules = import.meta.glob<{ default: (game: Game) => void }>('./abilities/*.ts');

unitData.forEach((creature) => {
	if (!creature.playable) {
		return;
	}

	const modulePath = `./abilities/${creature.name.split(' ').join('-')}.ts`;
	const loadAbility = abilityModules[modulePath];

	if (!loadAbility) {
		console.error(`[Ability] No module found for ${creature.name} (${modulePath})`);
		return;
	}

	loadAbility().then((generator) => generator.default(G));
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

		if (G.Phaser) {
			try {
				const scale = G.Phaser.scale;
				if (scale) {
					applyPortraitScale(scale, isPortrait);
					// The mobile browser has usually not finished laying out for the
					// new orientation when this handler runs, so a second pass a
					// moment later is what actually lands the right size.
					window.setTimeout(() => {
						try {
							refreshScale(G.Phaser?.scale);
						} catch {}
					}, 100);
					window.setTimeout(() => {
						window.dispatchEvent(new Event('resize'));
					}, 250);
				}
			} catch {}
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

	// The pre-match screen is up and interactive, so this is a safe moment to pull
	// the Phaser chunk down in the background. Deferring it keeps it off the
	// critical path; prefetching it here means the first match still starts without
	// waiting on a download the player could not have avoided anyway.
	prefetchPhaser();

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
				void G.loadGame(botConfig).catch((error) => {
					console.error('[Game] Could not start the bot match', error);
				});
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
		joinLobbyFromCode(joinCodeFromUrl);
	}

	/**
	 * Join a lobby from a code or share URL (used by `?join=`, CrazyGames invite
	 * links and in-session invites). Shared by the URL bootstrap and the
	 * CrazyGames SDK launch handlers.
	 */
	function joinLobbyFromCode(rawCode: string): void {
		const parsedJoinCode = parseLobbyCodeInput(rawCode);
		if (!parsedJoinCode) {
			return;
		}
		G.multiplayer = true;
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

	// CrazyGames SDK v3: all SDK/glue logic lives in platforms/crazygames.
	bootstrapCrazyGames({
		joinLobby: joinLobbyFromCode,
		startInstantLobby: () =>
			startInstantMultiplayerLobby({
				game: G,
				renderGameModeType,
				getGameConfig,
				updateLobbyUi,
			}),
		applyMute: (muted) => applyPlatformMute(muted, G.soundsys, G.UI),
		setDisplayName: setPlayerDisplayName,
	});

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
	} else if (Fullscreen.isIosBrowserTab()) {
		// iOS doesn't support the Fullscreen API for non-video elements, so the
		// button can't actually toggle fullscreen here. Disable it (like the Delay
		// button when the unit is last in the turn) and let `toggle()` show a toast
		// nudging the user to add to the home screen instead.
		$j('#fullscreen').addClass('disabled');
	} else if (Fullscreen.isIosStandalone()) {
		// Already launched from the home screen — the app is chromeless and
		// maximized, so the button has nothing to toggle. Disable it rather than
		// hiding it: players still reach the app switcher / home indicator by
		// sliding from the bottom, so a visible-but-disabled control is clearer
		// than a missing one.
		$j('#fullscreen').addClass('disabled');
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
				return (
					!isTyping(event) && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey
				);
			},
			keyDownAction() {
				openReplayFile('load');
			},
		},
		KeyS: {
			keyDownTest(event) {
				if (isTyping(event)) return false;
				// Shift+S: save snapshot
				if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
					return true;
				}
				// Bare S during replay: toggle fast-forward
				if (!event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
					return AB.currentGame?.isReplayInProgress === true;
				}
				return false;
			},
			keyDownAction(event) {
				if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
					AB.currentGame?.saveSnapshot?.();
				} else if (!event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
					AB.currentGame?.toggleReplayFastForward?.();
				}
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

		setStartPrompt(
			demoMode ? 'VIEW' : 'PRESS',
			demoMode ? 'DEMO' : 'START',
			demoMode ? 'MODE' : 'BUTTON',
		);
	}

	function setStartPrompt(prefix: string, button: string, suffix: string): void {
		$j('#start-btn span.blink:first').text(prefix);
		$j('#start-btn span.blink:last').text(suffix);
		$j('#startButton').val(button);
	}

	$j('input[name="gameMode"]').on('change input click', updateStartPrompt);
	$j('input[name="players"]').on('change input click', updateStartPrompt);

	applyPreMatchSettings(loadPreMatchSettings());
	updateStartPrompt();
	bindPreMatchSettingsPersistence();

	if (!joinCodeFromUrl) {
		$j('#lobbyCode').val('');
	}

	// Allow button game options to slide in prematch screen
	buttonSlide();

	// Create new Object to play audio in pre-match screen
	const beastAudio = new PreMatchAudioPlayer();

	let previousLobbyPlayers = new Map<string, import('./multiplayer').LobbyPlayer>();
	let lobbyNoticeTimer: number | undefined;

	const showLobbyNotice = (message: string, duration = 5000): void => {
		const $lobbyError = $j('#lobbyError');
		if (lobbyNoticeTimer !== undefined) {
			window.clearTimeout(lobbyNoticeTimer);
		}
		$lobbyError.text(message).removeClass('hide');
		lobbyNoticeTimer = window.setTimeout(() => {
			$lobbyError.addClass('hide').text('');
			lobbyNoticeTimer = undefined;
		}, duration);
	};

	const getLobbyPlayerLabel = (player: import('./multiplayer').LobbyPlayer): string =>
		player.displayName || `Player ${player.playerNumber ?? player.playerIndex + 1}`;

	const updateLobbyUi = (lobby = G.lobbyState, rememberPlayerIds = true) => {
		const isHost = Boolean(G.lobby?.isHost());
		const hasLobby = Boolean(G.lobby);
		const code = hasLobby ? G.lobbyCode || lobby?.code || '' : '';
		const inputCode = parseLobbyCodeInput(($j('#lobbyCode').val() as string) || '');

		if (hasLobby && !isHost && lobby) {
			applyPreMatchSettings({
				gameMode: lobby.config.gameMode,
				plasmaPoints: lobby.config.plasma_amount,
				unitDrops: lobby.config.unitDrops,
				activeUnits: lobby.config.creaLimitNbr,
				abilityUpgrades: lobby.config.abilityUpgrades,
				turnTime: lobby.config.turnTimePool,
				timePool: lobby.config.timePool === -1 ? -1 : Math.round(lobby.config.timePool / 60),
			});
		}

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
			$createButton.val('Waiting Players');
			$createButton.prop('disabled', true);
			$createButton.toggleClass('disabled', true);
		} else {
			$createButton.val('Waiting Host');
			$createButton.prop('disabled', true);
			$createButton.toggleClass('disabled', true);
		}

		const playerCount = lobby?.players.length ?? 0;
		const $startButton = $j('#startButton');
		if (!hasLobby) {
			$startButton.prop('disabled', false).toggleClass('disabled', false);
			updateStartPrompt();
		} else if (isHost && playerCount === 1) {
			$startButton.prop('disabled', true).toggleClass('disabled', true);
			setStartPrompt('PRESS', 'START', 'BUTTON');
		} else if (isHost && playerCount === 2) {
			$startButton.prop('disabled', false).toggleClass('disabled', false);
			setStartPrompt('1vs1', 'START', 'MATCH');
		} else if (isHost && playerCount === 3) {
			$startButton.prop('disabled', false).toggleClass('disabled', false);
			setStartPrompt('FORCE', 'START', '1vs1 MATCH');
		} else if (isHost && playerCount === 4) {
			$startButton.prop('disabled', false).toggleClass('disabled', false);
			setStartPrompt('2vs2', 'START', 'MATCH');
		} else {
			$startButton.prop('disabled', true).toggleClass('disabled', true);
			setStartPrompt('PRESS', 'START', 'BUTTON');
		}

		$j('input[name="players"]').prop('disabled', hasLobby);
		[
			'gameMode',
			'plasmaPoints',
			'unitDrops',
			'activeUnits',
			'abilityUpgrades',
			'turnTime',
			'timePool',
		].forEach((name) => {
			$j(`input[name="${name}"]`).prop('disabled', hasLobby && !isHost);
		});

		if (rememberPlayerIds) {
			previousLobbyPlayers = new Map(
				(lobby?.players ?? []).map((player) => [player.playerId, player]),
			);
		}
	};

	updateLobbyUi();

	// Ctrl+V focuses the lobby code field so one paste puts the join code into it.
	$j(document).on('keydown', (event) => {
		if (event.ctrlKey && event.key.toLowerCase() === 'v') {
			const $input = $j('#lobbyCode');
			if (!$input.is(':focus')) {
				event.preventDefault();
				$input.trigger('focus');
			}
		}
	});

	let devvitMatchStartScheduled = false;

	G.onLobbyUpdate = (lobby) => {
		const wasRemoved = lobby.status === 'ended' && !G.lobby?.isHost();
		if (wasRemoved) {
			G.lobby?.leaveMatch();
			G.lobby = null;
			G.lobbyState = null;
			G.lobbyCode = '';
			G.multiplayer = false;
			showLobbyNotice('You were removed from the lobby.');
		}

		if (!G.lobby?.isHost()) {
			applyPreMatchSettings({
				gameMode: lobby.config.gameMode,
				plasmaPoints: lobby.config.plasma_amount,
				unitDrops: lobby.config.unitDrops,
				activeUnits: lobby.config.creaLimitNbr,
				abilityUpgrades: lobby.config.abilityUpgrades,
				turnTime: lobby.config.turnTimePool,
				timePool: lobby.config.timePool === -1 ? -1 : Math.round(lobby.config.timePool / 60),
			});
		}

		updateLobbyUi(lobby, false);

		const currentPlayers = new Map(lobby.players.map((player) => [player.playerId, player]));
		const joinedPlayers = [...lobby.players].filter(
			(player) => !previousLobbyPlayers.has(player.playerId),
		);
		const leftPlayers = [...previousLobbyPlayers.values()].filter(
			(player) => !currentPlayers.has(player.playerId),
		);

		if (
			!wasRemoved &&
			previousLobbyPlayers.size > 0 &&
			(joinedPlayers.length > 0 || leftPlayers.length > 0)
		) {
			const notices: string[] = [];
			if (joinedPlayers.length > 0) {
				const names = joinedPlayers.map(getLobbyPlayerLabel).join(', ');
				notices.push(`${names} joined the lobby.`);
			}
			if (leftPlayers.length > 0) {
				const names = leftPlayers.map(getLobbyPlayerLabel).join(', ');
				notices.push(`${names} left the lobby.`);
			}
			showLobbyNotice(notices.join(' '));
		}
		previousLobbyPlayers = currentPlayers;

		if (wasRemoved) {
			return;
		}

		// Devvit matchmaking remains an automatic 1v1 queue. Peer/CrazyGames
		// private lobbies require the host to press Start.
		if (
			effectiveNetMode === 'devvit' &&
			G.lobby?.isHost() &&
			joinedPlayers.length > 0 &&
			lobby.players.length === 2 &&
			lobby.status === 'waiting' &&
			!devvitMatchStartScheduled
		) {
			devvitMatchStartScheduled = true;
			window.setTimeout(() => {
				G.startMultiplayerMatch(getGameConfig() as unknown as import('./multiplayer').GameConfig);
			}, 800);
		}
	};

	$j(
		'input[name="gameMode"], input[name="plasmaPoints"], input[name="unitDrops"], ' +
			'input[name="activeUnits"], input[name="abilityUpgrades"], input[name="turnTime"], ' +
			'input[name="timePool"]',
	).on('change', () => {
		if (!G.lobby?.isHost() || !G.lobbyState || G.lobbyState.status !== 'waiting') {
			return;
		}

		const playerCount = G.lobbyState.players.length;
		const requestedMode = clampPreMatchInt(
			$j('input[name="gameMode"]:checked').val(),
			[2, 4],
			G.lobbyState.config.gameMode,
		);
		if (requestedMode < playerCount) {
			setCheckedRadio('gameMode', G.lobbyState.config.gameMode);
			return;
		}

		const config = getLobbyConfigFromForm(G.lobbyState.config);
		G.lobby.updateLobbyConfig(config);
	});

	$j('#gameTitle').on('click', () => {
		beastAudio.playBeast();
	});

	const startGame = () => {
		if (G.lobby) {
			if (!G.lobby.isHost()) {
				return;
			}

			const playerCount = G.lobbyState?.players.length ?? 0;
			if (playerCount === 3) {
				const removedPlayer = [...(G.lobbyState?.players ?? [])]
					.filter((player) => player.playerIndex > 0)
					.sort((a, b) => b.playerIndex - a.playerIndex)[0];
				if (removedPlayer) {
					G.lobby.kickPlayer(removedPlayer.playerId);
				}
			} else if (playerCount !== 2 && playerCount !== 4) {
				return;
			}

			const startPlayerCount = G.lobbyState?.players.length ?? 0;
			const config = {
				...getLobbyConfigFromForm(G.lobbyState?.config),
				gameMode: startPlayerCount === 2 ? 2 : 4,
			};
			G.startMultiplayerMatch(config);
			return;
		}

		G.multiplayer = false;
		// Starting a fresh live match (left-click Start) clears any replay state
		// so a failed right-click replay doesn't prevent the new match's log
		// from being persisted on unload.
		G.gamelog.loadedFromLog = false;
		void G.loadGame(getGameConfig()).catch((error) => {
			console.error('[Game] Could not start the match', error);
		});
	};

	const restoreGameLog = (log) => {
		G.gamelog.load(log);
	};

	const storeLastMatchLog = () => {
		if (!DEBUG || G.gameState === 'initialized' || G.gamelog.loadedFromLog) {
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
	$j('#startButton').on('click', (event) => {
		event.preventDefault();
		startGame();
		return false;
	});
	$j('#start').on('click', (event) => {
		event.preventDefault();
		startGame();
		return false;
	});

	$j('#createLobbyButton').on('click', async () => {
		if (!G.lobby) {
			try {
				G.multiplayer = true;
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

			const errorMessage = error instanceof Error ? error.message : String(error);
			const $lobbyError = $j('#lobbyError');
			$lobbyError.text(errorMessage).removeClass('hide');
			window.setTimeout(() => {
				$lobbyError.addClass('hide').text('');
				$joinButton.val('Join Match');
				$joinButton.prop('disabled', false);
				$joinButton.toggleClass('disabled', false);
				updateLobbyUi();
			}, 10000);
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
		await G.loadGame(config);
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

/** Devvit matchmaking currently creates 1v1 matches only. */
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
		fileInput.accept = '.ab,.abs';
		fileInput.type = 'file';

		fileInput.onchange = (event) => {
			const file = (event.target as HTMLInputElement).files?.[0];
			if (!file) {
				reject(new Error('No game log file selected'));
				return;
			}
			const reader = new FileReader();

			reader.readAsText(file);

			reader.onload = () => {
				resolve({ content: reader.result, name: file.name });
			};

			reader.onerror = () => {
				reject(reader.error);
			};
		};

		fileInput.click();
	});
}

function openReplayFile(mode: ReplayMode) {
	readLogFromFile()
		.then(({ content, name }) => {
			const isSnapshot =
				name.endsWith('.abs') || GameSnapshotSerializer.isSnapshotString(content as string);
			if (isSnapshot) {
				AB.currentGame?.loadSnapshot?.(content as string);
			} else if (mode === 'load') {
				G.gamelog.load(content as string);
			} else {
				G.gamelog.play(content as string);
			}
		})
		.catch((err) => {
			if (err instanceof Error && err.message === 'No game log file selected') {
				return;
			}
			alert('An error occurred while loading the log file');
			console.error(err);
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
	savePreMatchSettings();
	return defaultConfig;
}

function getLobbyConfigFromForm(
	previous?: import('./multiplayer').GameConfig,
): import('./multiplayer').GameConfig {
	const formConfig = getGameConfig();
	return {
		...formConfig,
		gameMode: formConfig.gameMode,
		background_image: previous?.background_image ?? formConfig.background_image,
	};
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
