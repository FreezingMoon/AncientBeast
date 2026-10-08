// eslint-disable-next-line no-undef
/* global JQuery */
import $j from 'jquery';
import { Easing } from '../utility/easing';
import * as time from '../utility/time';
import * as emoji from 'node-emoji';
import { Hotkeys, getHotKeys } from './hotkeys';
import { Button, ButtonStateEnum } from './button';
import { Chat } from './chat';
import { Creature } from '../creature';
import { Fullscreen } from './fullscreen';
import { ProgressBar } from './progressbar';
import { getUrl } from '../assets';
import { MetaPowers } from './meta-powers';
import { Queue } from './queue';
import { QuickInfo } from './quickinfo';
import { pretty as version } from '../utility/version';
import { getDevvitAppVersion } from '../utility/clientVersion';
import { capitalize } from '../utility/string';
import { throttle } from 'underscore';
import { DEBUG_DISABLE_HOTKEYS } from '../debug';
import { cycleAudioMode as cycleSoundAudioMode } from '../sound/soundsys';
import Game from '../game';
import { CreatureType } from '../data/types';
import { getAvatarSet } from '../style/avatar-styles';
import { applyBuffDebuffStyle } from './buffs-debuffs';
import { getRandomSummonCandidates, getSummonCandidates } from '../utility/summon-candidates';
import { OpenCollectiveBanner, isThirdPartyContentBlocked } from './open-collective-banner';
import { onPointerUp } from '../input/input';
import { isScoreboardHotkey, isUtilityHotkey as isUtilityHotkeyEvent } from '../input/hotkey-gate';
import { setHandCursor } from '../game-display/cursor';
import type { SpriteHandle } from '../engine/types';

const SECRET_VIEW_ID = 'ab-secret-view';

/**
 * Render/input depth of the brand logo revealed with Ctrl.
 *
 * The hex grid renders in bands of `row * 100` (see HexGrid#getDepthAtBand), so
 * anything above a few thousand sits in front of the whole board — which is
 * what the logo needs, since it is a clickable overlay rather than scenery.
 */
const BRAND_LOGO_DEPTH = 100000;

/** Combat log elements that toggle the Meta Powers panel on right-click. */
const META_TOGGLE_SELECTOR = '#chatbox, #chatcontent';
const GAME_IN_PROGRESS_UNLOAD_CONFIRMATION =
	'A game is in progress and cannot be restored, are you sure you want to leave?';
const RELOAD_PROMPT_ID = 'ab-dev-reload-prompt';
const MANUAL_REFRESH_PROMPT_TITLE = 'A game is in progress';
const MANUAL_REFRESH_PROMPT_BODY = 'Reload now and abandon this match?';

/** Scoreboard buttons that discard the match and therefore need a second activation. */
type ScoreboardConfirmAction = 'restart' | 'exit';

/** How long an armed destructive button stays red before it disarms itself. */
const SCOREBOARD_CONFIRM_TIMEOUT_MS = 5000;

/** How long the cost of an ability the hotkey cannot afford stays on screen. */
const ABILITY_COST_FLASH_MS = 1000;

/** Fade in/out duration of that cost preview. */
const ABILITY_COST_FADE_MS = 250;

type ConfirmUnloadState = {
	ignoreNextConfirmUnload: boolean;
};

let getActiveConfirmUnloadState: () => ConfirmUnloadState | null = () => null;
let hasManualRefreshConfirmListener = false;
/** Window key holding the registered manual-refresh capture handler. */
const MANUAL_REFRESH_LISTENER_KEY = '__abManualRefreshListener';
let reloadPromptOverlay: HTMLDivElement | null = null;
let removeReloadPromptEscListener: (() => void) | null = null;
let allowNextReloadWithoutPrompt = false;

const isManualReloadShortcut = (event: KeyboardEvent) => {
	if (event.key === 'F5') {
		return true;
	}

	if (event.altKey || !(event.ctrlKey || event.metaKey)) {
		return false;
	}

	return event.key.toLowerCase() === 'r';
};

// Intercept browser modals while dev reload prompt is visible to prevent them from appearing on top
const savedModalFunctions = {
	alert: window.alert,
	confirm: window.confirm,
	prompt: window.prompt,
};

let isRefreshPromptVisible = false;

const suppressBrowserModalWhilePromptVisible = () => {
	window.alert = (message?: unknown) => {
		if (isRefreshPromptVisible) {
			console.warn('[Refresh Prompt] Suppressed alert:', message);
			return undefined;
		}
		return savedModalFunctions.alert(message);
	};

	window.confirm = (message?: string) => {
		if (isRefreshPromptVisible) {
			console.warn('[Refresh Prompt] Suppressed confirm:', message);
			return false;
		}
		return savedModalFunctions.confirm(message);
	};

	window.prompt = (message?: string, defaultValue?: string) => {
		if (isRefreshPromptVisible) {
			console.warn('[Refresh Prompt] Suppressed prompt:', message);
			return null;
		}
		return savedModalFunctions.prompt(message, defaultValue);
	};
};

suppressBrowserModalWhilePromptVisible();

const clearBeforeUnloadReturnValue = (event: BeforeUnloadEvent) => {
	Reflect.deleteProperty(event as unknown as Record<string, unknown>, 'returnValue');
};

const setBeforeUnloadReturnValue = (event: BeforeUnloadEvent, value: string) => {
	Reflect.set(event as unknown as Record<string, unknown>, 'returnValue', value);
};

const confirmUnload = (event: BeforeUnloadEvent) => {
	if (allowNextReloadWithoutPrompt) {
		allowNextReloadWithoutPrompt = false;
		clearBeforeUnloadReturnValue(event);
		return;
	}

	const activeConfirmUnloadState = getActiveConfirmUnloadState();
	if (!activeConfirmUnloadState) {
		return;
	}

	if (isRefreshPromptVisible) {
		clearBeforeUnloadReturnValue(event);
		return;
	}

	if (activeConfirmUnloadState.ignoreNextConfirmUnload) {
		clearBeforeUnloadReturnValue(event);
		return;
	}

	// https://developer.mozilla.org/en-US/docs/Web/API/WindowEventHandlers/onbeforeunload#example
	event.preventDefault();
	setBeforeUnloadReturnValue(event, GAME_IN_PROGRESS_UNLOAD_CONFIRMATION);
	return GAME_IN_PROGRESS_UNLOAD_CONFIRMATION;
};

/**
 * Whether a match has been started (the unload guard is armed).
 * Used by the dev-only vite reload guard in `script.ts`.
 */
export const isMatchRunning = () => Boolean(getActiveConfirmUnloadState());

const closeRefreshPrompt = () => {
	if (!reloadPromptOverlay) {
		return;
	}

	isRefreshPromptVisible = false;
	reloadPromptOverlay.remove();
	reloadPromptOverlay = null;

	if (removeReloadPromptEscListener) {
		removeReloadPromptEscListener();
		removeReloadPromptEscListener = null;
	}
};

const createRefreshButton = (
	label: string,
	onClick: () => void,
	hotkey: string,
	variant?: 'secondary',
) => {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = `opencollective_cta dev-reload-button${
		variant === 'secondary' ? ' dev-reload-button--secondary' : ''
	}`;
	button.dataset.devReloadHotkey = hotkey.toLowerCase();
	button.setAttribute('aria-keyshortcuts', hotkey.toUpperCase());

	const hotkeyNode = document.createElement('span');
	hotkeyNode.textContent = label.charAt(0);
	hotkeyNode.style.cssText = 'text-decoration:underline;';
	button.appendChild(hotkeyNode);
	button.appendChild(document.createTextNode(label.slice(1)));
	button.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		onClick();
	});

	return button;
};

const showRefreshPrompt = () => {
	if (reloadPromptOverlay) {
		isRefreshPromptVisible = true;
		return reloadPromptOverlay;
	}

	const activeConfirmUnloadState = getActiveConfirmUnloadState();
	if (!activeConfirmUnloadState) {
		return null;
	}

	const overlay = document.createElement('div');
	overlay.id = RELOAD_PROMPT_ID;
	overlay.setAttribute('role', 'dialog');
	overlay.setAttribute('aria-modal', 'true');
	overlay.setAttribute('aria-label', 'Refresh prompt');
	overlay.style.cssText =
		'position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.88);pointer-events:auto;contain:layout style paint;';

	const modal = document.createElement('div');
	modal.className = 'framed-modal framed-modal--fluid';
	modal.style.cssText = 'position:relative;max-width:min(92vw,560px);padding:28px 24px 22px;';

	const closeWrapper = document.createElement('div');
	closeWrapper.className = 'framed-modal__return';
	closeWrapper.style.cssText =
		'top:0;right:0;position:absolute;height:100px;width:100px;z-index:100000;';

	const closeButton = document.createElement('button');
	closeButton.type = 'button';
	closeButton.className = 'close-button';
	closeButton.setAttribute('aria-label', 'Close refresh prompt');
	closeButton.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		closeRefreshPrompt();
	});

	closeWrapper.appendChild(closeButton);

	const handlePromptKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Tab') {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		if (typeof event.stopImmediatePropagation === 'function') {
			event.stopImmediatePropagation();
		}

		if (event.key === 'Escape') {
			closeRefreshPrompt();
			return;
		}

		if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
			return;
		}

		const normalizedKey = event.key.toLowerCase();
		if (normalizedKey.length !== 1) {
			return;
		}

		const hotkeyButton = overlay.querySelector(
			`[data-dev-reload-hotkey="${normalizedKey}"]`,
		) as HTMLButtonElement | null;
		if (!hotkeyButton) {
			return;
		}

		hotkeyButton.click();
	};

	const title = document.createElement('p');
	title.style.cssText = 'margin:0 0 12px;font-size:24px;line-height:1.2;text-align:center;';
	title.textContent = MANUAL_REFRESH_PROMPT_TITLE;

	const body = document.createElement('p');
	body.style.cssText = 'margin:0 0 20px;text-align:center;line-height:1.45;';
	body.textContent = MANUAL_REFRESH_PROMPT_BODY;

	const actions = document.createElement('div');
	actions.className = 'dev-reload-actions';

	actions.appendChild(
		createRefreshButton(
			'Save',
			() => {
				window.AB?.saveLog?.();
			},
			'S',
		),
	);
	actions.appendChild(
		createRefreshButton(
			'Reload',
			() => {
				// Re-resolve state at click time — the overlay is created once and reused,
				// so the creation-time closure may point to a stale UI instance.
				const currentState = getActiveConfirmUnloadState();
				allowNextReloadWithoutPrompt = true;
				if (currentState) {
					currentState.ignoreNextConfirmUnload = true;
				}
				closeRefreshPrompt();
				const previousOnBeforeUnload = window.onbeforeunload;
				window.onbeforeunload = null;
				// Watchdog: if the page doesn't unload within 3 s (reload was silently
				// blocked by the browser), reset bypass flags so Ctrl+R shows the modal again.
				setTimeout(() => {
					allowNextReloadWithoutPrompt = false;
					if (currentState) {
						currentState.ignoreNextConfirmUnload = false;
					}
					if (window.onbeforeunload === null) {
						window.onbeforeunload = previousOnBeforeUnload;
					}
				}, 3000);
				window.location.assign(window.location.href);
			},
			'R',
		),
	);
	actions.appendChild(
		createRefreshButton(
			'Continue',
			() => {
				closeRefreshPrompt();
			},
			'C',
			'secondary',
		),
	);

	modal.appendChild(title);
	modal.appendChild(body);
	modal.appendChild(actions);
	overlay.appendChild(closeWrapper);
	overlay.appendChild(modal);
	overlay.addEventListener('click', (event) => {
		if (event.target === overlay) {
			closeRefreshPrompt();
		}
	});
	overlay.addEventListener('contextmenu', (event) => {
		event.preventDefault();
		event.stopPropagation();
		closeRefreshPrompt();
	});
	document.body.appendChild(overlay);
	window.addEventListener('keydown', handlePromptKeydown, true);
	removeReloadPromptEscListener = () => {
		window.removeEventListener('keydown', handlePromptKeydown, true);
	};
	reloadPromptOverlay = overlay;
	isRefreshPromptVisible = true;

	return overlay;
};

const confirmManualRefresh = (event: KeyboardEvent) => {
	if (!isManualReloadShortcut(event)) {
		return;
	}

	// A reload is already in flight — let the native shortcut through so it
	// can bypass the beforeunload guard and complete the reload.
	if (allowNextReloadWithoutPrompt) {
		return;
	}

	const activeConfirmUnloadState = getActiveConfirmUnloadState();
	if (!activeConfirmUnloadState) {
		return;
	}

	event.preventDefault();
	event.stopPropagation();
	if (typeof event.stopImmediatePropagation === 'function') {
		event.stopImmediatePropagation();
	}
	showRefreshPrompt();
};

const createSecretViewOverlay = () => {
	const overlay = document.createElement('div');
	overlay.id = SECRET_VIEW_ID;
	overlay.setAttribute('role', 'dialog');
	overlay.setAttribute('aria-modal', 'true');
	overlay.setAttribute('aria-label', 'Secret view');
	overlay.style.cssText =
		'position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.9);';

	const closeButton = document.createElement('button');
	const closeWrapper = document.createElement('div');
	closeWrapper.className = 'framed-modal__return';

	closeButton.type = 'button';
	closeButton.className = 'close-button';
	closeButton.setAttribute('aria-label', 'Close secret view');

	const image = document.createElement('img');
	let lotusUrl = 'assets/interface/Lotus.png';
	try {
		lotusUrl = getUrl('interface/Lotus');
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
	} catch (error) {
		// Keep raw-path fallback if asset map is unavailable.
	}

	image.src = lotusUrl;
	image.alt = 'Dark Priest in lotus position';
	image.style.cssText =
		'max-width:min(90vw,920px);max-height:90vh;width:auto;height:auto;display:block;';

	closeButton.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		toggleSecretView();
	});

	overlay.addEventListener('click', () => {
		toggleSecretView();
	});

	overlay.addEventListener('contextmenu', (event) => {
		event.preventDefault();
		event.stopPropagation();
		toggleSecretView();
	});

	image.addEventListener('click', (event) => {
		event.stopPropagation();
	});

	closeWrapper.appendChild(closeButton);
	overlay.appendChild(closeWrapper);
	overlay.appendChild(image);
	document.body.appendChild(overlay);

	return overlay;
};

const toggleSecretView = () => {
	const overlay =
		(document.getElementById(SECRET_VIEW_ID) as HTMLDivElement | null) || createSecretViewOverlay();
	overlay.style.display = overlay.style.display === 'flex' ? 'none' : 'flex';
};

type InterfaceView = 'dash' | 'score' | 'audio' | 'secret';

const interfaceViewSignals = {
	dash: 'toggleDash',
	score: 'toggleScore',
	audio: 'toggleMusicPlayer',
	secret: 'toggleSecretView',
} as const;

type Config = {
	isAcceptingInput: () => boolean;
};

type ApertureAbilityState = {
	_noAffordableApertureTargetInRange?: boolean;
};

/**
 * Class UI
 *
 * Object containing UI DOM element, update functions and event management on UI.
 */
export class UI {
	/* Attributes
	 *
	 * NOTE : attributes and variables starting with $ are jquery element
	 * and jquery function can be called directly from them.
	 *
	 * $display :	 	UI container
	 * $queue :		  Queue container
	 * $textbox :		Chat and log container
	 * $activebox :	Current active creature panel (left panel) container
	 * $dash :			Overview container
	 * $grid :			Creature grid container
	 * $brandlogo:  Brand logo container
	 *
	 * selectedCreature :	String :	ID of the visible creature card
	 * selectedPlayer :	Integer :	ID of the selected player in the dash
	 *
	 */

	configuration: {
		isAcceptingInput: () => boolean;
	};
	game: Game;
	fullscreen: Fullscreen;
	$display: JQuery<HTMLElement>; //eslint-disable-line no-undef
	$dash: JQuery<HTMLElement>; //eslint-disable-line no-undef
	$grid: JQuery<HTMLElement>; //eslint-disable-line no-undef
	$activebox: JQuery<HTMLElement>; //eslint-disable-line no-undef
	$scoreboard: JQuery<HTMLElement>; //eslint-disable-line no-undef
	brandlogo: SpriteHandle;
	active: boolean;
	queue: Queue;
	quickInfo: QuickInfo;
	lastViewedCreature: string | CreatureType;
	viewedCreature: string;
	chat: Chat;
	metaPowers: MetaPowers;
	buttons: Button[];
	abilitiesButtons: Button[];
	btnToggleDash: Button;
	btnToggleScore: Button;
	btnFullscreen: Button;
	btnAudio: Button;
	btnSkipTurn: Button;
	dashopen: boolean;
	animationUpgradeTimeOutID: ReturnType<typeof setTimeout>;
	queryUnit: string;
	btnDelay: Button;
	btnFlee?: Button;
	btnSaveLog: Button;
	btnRestartMatch: Button;
	btnExit: Button;
	materializeButton: Button;
	clickedAbility: number;
	selectedAbility: number;
	healthBar: ProgressBar;
	energyBar: ProgressBar;
	timeBar: ProgressBar;
	poolBar: ProgressBar;
	hotkeys: Hotkeys;
	selectedCreature: string;
	selectedPlayer: number;
	queueAnimSpeed: number;
	dashAnimSpeed: number;
	cardAssetCache: Map<string, HTMLImageElement>;
	cardFlipTimeoutId: ReturnType<typeof setTimeout> | null;
	abilityCostFlashTimeout: ReturnType<typeof setTimeout> | null;
	materializeToggled: boolean;
	glowInterval: ReturnType<typeof setInterval>;
	hoveringNoActionCreature: boolean;
	lastTurnWarningSecond: number | null;
	lastTurnWarningPlayerId: number | null;
	infiniteTurnBarInitialized: boolean;
	infinitePoolBarInitialized: boolean;
	dashOpenCollectiveBanner: OpenCollectiveBanner;
	scoreboardOpenCollectiveBanner: OpenCollectiveBanner;
	musicPlayerOpenCollectiveBanner: OpenCollectiveBanner;
	selectedCreatureObj: Creature | undefined;
	activeAbility: boolean;
	hoveredAbilityIndex: number;
	_abilityPanelAnimating: boolean;
	ignoreNextConfirmUnload: boolean;
	scoreboardGameOver: boolean;
	/** Destructive scoreboard action awaiting its second activation, if any. */
	scoreboardConfirmAction: ScoreboardConfirmAction | null;
	scoreboardConfirmTimer: ReturnType<typeof setTimeout> | null;
	// Guards the deferred pointer-events disable in closeDash(): a re-open
	// before the fade callback runs must not have pointer-events yanked by
	// the stale close's timeout.
	private dashFadeToken: symbol | null = null;
	/**
	 * Create attributes and default buttons
	 * @constructor
	 */
	constructor(configuration: Config, game: Game) {
		this.configuration = configuration;
		this.game = game;
		this.fullscreen = new Fullscreen(
			document.querySelector('#fullscreen.button'),
			game.fullscreenMode,
		);
		this.$display = $j('#ui');
		this.$dash = $j('#dash');
		this.$grid = $j(this.makeCreatureGrid(document.getElementById('creaturerasterwrapper')));
		this.$activebox = $j('#activebox');
		this.$scoreboard = $j('#scoreboard');
		this.scoreboardConfirmAction = null;
		this.scoreboardConfirmTimer = null;
		// The logo is revealed while holding Ctrl; keep it horizontally centered
		// on the viewport instead of hardcoding an off-center x.
		this.brandlogo = game.gameEngine.add.image(this.getBrandLogoCenterX(), 200, 'AncientBeastLogo');
		this.brandlogo.alpha = 0;
		// Clicking the revealed logo re-rolls the combat location. A secret
		// feature, so it stays inert until the logo is actually shown and it
		// takes priority over the board — see #setBrandLogoVisible.
		this.brandlogo.setDepth(BRAND_LOGO_DEPTH);
		// The subscription is installed once and outlives the show/hide toggles;
		// `setBrandLogoVisible` is what makes the logo hit-testable or not, so a
		// hidden logo cannot consume a board click.
		this.brandlogo.disableInteractive();
		onPointerUp(this.brandlogo, (pointer) => {
			// Left click only: a right-click over the logo should still reach the
			// backdrop shortcut underneath and open the active creature's card.
			if (pointer.button !== 0) {
				return;
			}
			game.randomizeCombatLocation();
		});
		this.active = false;

		this.queue = UI.#getQueue(this, document.getElementById('queuewrapper'));
		this.quickInfo = UI.#getQuickInfo(this, document.querySelector('div.quickinfowrapper'));
		this.dashOpenCollectiveBanner = new OpenCollectiveBanner({
			bannerSelector: '#opencollective_banner',
			onCloseView: () => {
				this.closeDash();
			},
			isViewOpen: () => this.dashopen,
			hidden: isThirdPartyContentBlocked(),
		});
		this.scoreboardOpenCollectiveBanner = new OpenCollectiveBanner({
			bannerSelector: '#opencollective_banner_scoreboard',
			onCloseView: () => {
				this.closeScoreboard();
			},
			isViewOpen: () => !this.$scoreboard.hasClass('hide'),
			hidden: isThirdPartyContentBlocked(),
		});
		this.musicPlayerOpenCollectiveBanner = new OpenCollectiveBanner({
			bannerSelector: '#opencollective_banner_musicplayer',
			onCloseView: () => {
				this.toggleMusicPlayer(false);
			},
			isViewOpen: () => !$j('#musicplayerwrapper').hasClass('hide'),
			hidden: isThirdPartyContentBlocked(),
		});
		this.dashOpenCollectiveBanner.init();
		this.scoreboardOpenCollectiveBanner.init();
		this.musicPlayerOpenCollectiveBanner.init();

		// Last clicked creature in Godlet Printer for the current turn
		this.lastViewedCreature = '';

		// Last viewed creature for the current turn
		this.viewedCreature = '';

		// Chat
		this.chat = new Chat(game);

		// Meta Powers - only available for hot-seat games running in development mode.
		if (process.env.NODE_ENV === 'development' && !this.game.multiplayer) {
			this.metaPowers = new MetaPowers(this.game);
		}

		// Buttons Objects
		this.buttons = [];
		this.abilitiesButtons = [];

		// Dash Button
		this.btnToggleDash = new Button(
			{
				$button: $j('.toggledash'),
				hasShortcut: true,
				click: () => {
					this.game.channels.ui.emit('toggleDash');
				},
				overridefreeze: true,
			},
			{ isAcceptingInput: this.configuration.isAcceptingInput },
		);
		this.buttons.push(this.btnToggleDash);

		// Score Button
		this.btnToggleScore = new Button(
			{
				$button: $j('#playerbutton.togglescore'),
				hasShortcut: true,
				click: () => {
					this.game.channels.ui.emit('toggleScore');
				},
				overridefreeze: true,
			},
			{ isAcceptingInput: this.configuration.isAcceptingInput },
		);

		// In-Game Fullscreen Button
		this.btnFullscreen = new Button(
			{
				$button: $j('#fullscreen.button'),
				hasShortcut: true,
				click: () => this.fullscreen.toggle(),
				overridefreeze: true,
			},
			{ isAcceptingInput: this.configuration.isAcceptingInput },
		);
		this.buttons.push(this.btnFullscreen);

		// Audio Button
		this.btnAudio = new Button(
			{
				$button: $j('.toggle-music-player'),
				hasShortcut: true,
				click: () => {
					this.game.channels.ui.emit('toggleMusicPlayer');
				},
				overridefreeze: true,
			},
			{ isAcceptingInput: this.configuration.isAcceptingInput },
		);
		this.buttons.push(this.btnAudio);
		this.btnAudio.$button.on('contextmenu', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.cycleAudioMode();
		});
		// Skip Turn Button
		this.btnSkipTurn = new Button(
			{
				$button: $j('#skip.button'),
				hasShortcut: true,
				click: () => {
					if (!this.dashopen) {
						if (game.turnThrottle || game.botController.isBotTurn()) {
							if (game.botController.isBotTurn()) {
								this.showCancelIconOnButton(this.btnSkipTurn.$button);
							}
							return;
						}

						game.gamelog.add({
							action: 'skip',
						});

						// Prevents upgrade animation from carrying on into opponent's turn and disabling their button
						clearTimeout(this.animationUpgradeTimeOutID);

						game.skipTurn();
						this.lastViewedCreature = '';
						this.queryUnit = '';
						const buttonElement = this.btnSkipTurn.$button;

						buttonElement.removeClass('bounce');
					}
				},
			},
			{ isAcceptingInput: this.configuration.isAcceptingInput },
		);
		this.buttons.push(this.btnSkipTurn);

		// Delay Unit Button
		const canPreviewDelay = () =>
			!this.dashopen &&
			!game.turnThrottle &&
			!game.botController.isBotTurn() &&
			Boolean(game.activeCreature?.canWait) &&
			!game.queue.isCurrentEmpty();
		this.btnDelay = new Button(
			{
				$button: $j('#delay.button'),
				hasShortcut: true,
				mouseover: () => {
					if (canPreviewDelay()) {
						this.queue.showDelayPreview();
					}
				},
				mouseleave: () => {
					this.queue.clearDelayPreview();
				},
				click: () => {
					if (!this.dashopen) {
						if (
							game.turnThrottle ||
							game.botController.isBotTurn() ||
							!game.activeCreature?.canWait ||
							game.queue.isCurrentEmpty()
						) {
							if (game.botController.isBotTurn()) {
								this.showCancelIconOnButton(this.btnDelay.$button);
							}
							return;
						}

						game.gamelog.add({
							action: 'delay',
						});
						game.delayCreature();
					}
				},
			},
			{ isAcceptingInput: this.configuration.isAcceptingInput },
		);
		this.buttons.push(this.btnDelay);

		this.btnSaveLog = new Button(
			{
				$button: $j('#save.button'),
				hasShortcut: true,
				click: () => {
					// Saving the log is not destructive, so it never joins the
					// confirmation dance — it just drops a pending arm.
					this.disarmScoreboardConfirm();
					game.gamelog.save();
				},
				mouseleave: () => {
					this.disarmScoreboardConfirm();
				},
				state: ButtonStateEnum.hidden,
			},
			{ isAcceptingInput: this.configuration.isAcceptingInput },
		);
		this.buttons.push(this.btnSaveLog);

		this.btnRestartMatch = new Button(
			{
				$button: $j('#restart.button'),
				hasShortcut: true,
				click: () => {
					// Restarting throws the match away, so the first activation only
					// arms the button (red outline) and the second one commits.
					if (!this.confirmScoreboardAction('restart')) {
						return;
					}

					game.gamelog.add({
						action: 'restart',
					});

					if (game.multiplayer) {
						game.resetGame();
						return;
					}

					const restartConfig = {
						...game.configData,
						players: Array.isArray(game.configData.players)
							? [...game.configData.players]
							: game.configData.players,
					};

					game.resetGame();
					void game.loadGame(restartConfig).catch((error) => {
						console.error('[Game] Could not restart the match', error);
					});
				},
				mouseleave: () => {
					this.disarmScoreboardConfirm('restart');
				},
				state: ButtonStateEnum.hidden,
			},
			{ isAcceptingInput: this.configuration.isAcceptingInput },
		);
		this.buttons.push(this.btnRestartMatch);

		this.btnExit = new Button(
			{
				$button: $j('#exit.button'),
				hasShortcut: true,
				click: () => {
					if (this.dashopen) {
						return;
					}

					// Same two-step guard as restart: leaving discards the match.
					if (!this.confirmScoreboardAction('exit')) {
						return;
					}

					game.gamelog.add({
						action: 'exit',
					});
					game.resetGame();
				},
				mouseleave: () => {
					this.disarmScoreboardConfirm('exit');
				},
				state: ButtonStateEnum.normal,
			},
			{ isAcceptingInput: this.configuration.isAcceptingInput },
		);
		this.buttons.push(this.btnExit);

		this.materializeButton = new Button(
			{
				$button: $j('#materialize_button'),
				css: {
					disabled: {
						cursor: 'not-allowed',
					},
					glowing: {
						cursor: 'pointer',
					},
					selected: {},
					active: {},
					noclick: {},
					normal: {
						cursor: 'default',
					},
					slideIn: {},
				},
			},
			{ isAcceptingInput: this.configuration.isAcceptingInput },
		);

		// Defines states for ability buttons
		for (let i = 0; i < 4; i++) {
			const b = new Button(
				{
					$button: $j('.ability[ability="' + i + '"]'),
					hasShortcut: true,
					click: () => {
						const game = this.game;

						// During bot turns, show cancelIcon and block interaction
						if (game.botController.isBotTurn()) {
							this.showCancelIconOnButton(b.$button);
							return;
						}

						// Block all ability interactions while an animation is running
						if (game.freezedInput) {
							return;
						}

						this.clickedAbility = i;

						// Animate ability range circles when clicking a no-target ability
						if (i !== 0) {
							const creature = game.activeCreature;
							if (creature) {
								const ab = creature.abilities[i];
								if (ab.message === game.msg.abilities.noTarget && ab._abilityRangeHexes?.length) {
									const cx = creature.x;
									const cy = creature.y;
									const sorted = ab._abilityRangeHexes.slice().sort((a, b) => {
										const da = Math.hypot(a.x - cx, a.y - cy);
										const db = Math.hypot(b.x - cx, b.y - cy);
										return da - db;
									});
									sorted.forEach((hex, idx) => {
										// isHovered: whether *this* ability is currently hovered (determines final scale).
										// Check displayClasses separately to decide if we need to (re-)apply the class,
										// since a concurrent animation (e.g. hotkey B) may have cleaned it already.
										const isHovered = this.hoveredAbilityIndex === i;
										if (!hex.displayClasses.includes('abilityRange')) {
											hex.displayVisualState('abilityRange');
										}
										// Kill any in-flight tweens so spamming doesn't stack animations.
										game.gameEngine.removeTweensFrom(hex.display.scale);
										// Hover path: return to 0.5 so circles remain as they were.
										// Hotkey path: end at 0 and clean up since no hover is active.
										const finalScale = isHovered ? 0.5 : 0;
										hex.display.setScale(0.5, 0.5);
										hex.display.setOrigin(0.5, 0.5);
										game.gameEngine
											.tween(hex.display.scale)
											.to({ x: 1.0, y: 1.0 }, 180, Easing.Quadratic.Out, true, idx * 20)
											.onComplete.addOnce(() => {
												game.gameEngine
													.tween(hex.display.scale)
													.to({ x: finalScale, y: finalScale }, 180, Easing.Quadratic.In, true)
													.onComplete.addOnce(() => {
														if (!isHovered) {
															hex.display.setOrigin(0, 0);
															// Only clean this hex individually so circles from a
															// concurrently hovered ability remain unaffected.
															hex.cleanDisplayVisualState('abilityRange');
														}
													});
											});
									});
								}
							}
						}

						this.flashAbilityBtn(i);

						if (this.selectedAbility != i) {
							if (this.dashopen) {
								return false;
							}

							const ability = game.activeCreature.abilities[i];
							// Passive ability icon can cycle between usable abilities
							if (i == 0) {
								this.checkAbilities(); // Ensure state is up to date
								const ab = game.activeCreature.abilities[0];
								if (ab.message === game.msg.abilities.passiveUnavailable) {
									if (!game.freezedInput) {
										this.animateNoTargetAbilityRanges();
									}
									this.flashAbilityBtn(0);
									return;
								}
								// Joywin
								const selectedAbility = this.selectNextAbility();
								if (selectedAbility > 0) {
									this.abilitiesButtons.forEach((btn, index) => {
										if (index === 0) {
											btn.$button.removeClass('cancelIcon');
											btn.$button.removeClass('nextIcon');
											this.clickedAbility = -1;
										}
									});
									b.cssTransition('nextIcon', 1000);
									this.flashAbilityBtn(0);
								} else if (selectedAbility === -1) {
									this.abilitiesButtons.forEach((btn, index) => {
										if (index === 0) {
											btn.$button.removeClass('nextIcon');
											btn.$button.removeClass('cancelIcon');
											this.clickedAbility = -1;
										}
									});
									b.cssTransition('cancelIcon', 1000);
									this.flashAbilityBtn(0);
								}
								return;
							}
							if (
								ability.used ||
								ability.message === game.msg.abilities.noTarget ||
								b.state === ButtonStateEnum.noClick
							) {
								return;
							}
							// Colored frame around selected ability
							if (ability.require() == true && i != 0) {
								if (ability._abilityRangeHexes?.length) {
									ability._abilityRangeHexes.forEach((hex) => {
										this.game.gameEngine.removeTweensFrom(hex.display.scale);
										hex.display.setScale(0, 0);
										hex.display.setOrigin(0, 0);
										hex.cleanDisplayVisualState('abilityRange');
									});
								}
								this.selectAbility(i);
							}
							// Activate Ability
							game.activeCreature.abilities[i].use();
						} else {
							// Cancel Ability
							this.closeDash();
							game.activeCreature.queryMove();
							this.selectAbility(-1);
						}
					},
					mouseover: () => {
						this.hoveredAbilityIndex = i;
						if (this.selectedAbility == -1) {
							this.showAbilityCosts(i);
						}

						// Show hex_path markers over the ability's target range when hovering
						// a non-passive ability that currently has no targets in sight
						if (
							i !== 0 &&
							this.selectedAbility === -1 &&
							!this.game.botController.isBotTurn() &&
							!this.game.freezedInput
						) {
							const game = this.game;
							const creature = game.activeCreature;
							if (creature) {
								const ab = creature.abilities[i];
								if (ab.message === game.msg.abilities.noTarget && ab._abilityRangeHexes?.length) {
									ab._abilityRangeHexes.forEach((hex) => {
										hex.displayVisualState('abilityRange');
										hex.display.setScale(0.5, 0.5);
										hex.display.setOrigin(0.5, 0.5);
									});
								}
							}
						}

						(function () {
							const $desc = $j('.desc[ability="' + i + '"]');

							// Ensure tooltip stays in window - adjust
							const rect = $desc[0].getBoundingClientRect();
							const margin = 20;
							if (rect.bottom > window.innerHeight - margin) {
								const value = window.innerHeight - rect.bottom - margin;
								$desc[0].style.top = value + 'px';
								$desc.find('.arrow')[0].style.top = 27 - value + 'px'; // Keep arrow position
							}
						})();
					},
					mouseleave: () => {
						if (this.hoveredAbilityIndex === i) {
							this.hoveredAbilityIndex = -1;
						}
						if (this.selectedAbility == -1) {
							this.hideAbilityCosts();
						}
						// Stop any in-flight scale tweens and clean up ability range circles
						if (i !== 0) {
							const creature = this.game.activeCreature;
							if (creature) {
								const ab = creature.abilities[i];
								if (ab._abilityRangeHexes?.length) {
									ab._abilityRangeHexes.forEach((hex) => {
										// Kill any running tween (including ones that would restore to 0.5).
										this.game.gameEngine.removeTweensFrom(hex.display.scale);
										hex.display.setScale(0, 0);
										hex.display.setOrigin(0, 0);
										hex.cleanDisplayVisualState('abilityRange');
									});
								}
							}
						}
						(function () {
							const $desc = $j('.desc[ability="' + i + '"]');
							$desc[0].style.top = '0px';
							$desc.find('.arrow')[0].style.top = '27px';
						})();
					},
					abilityId: i,
					css: {
						disabled: {
							cursor: 'help',
						},
						glowing: {
							cursor: 'pointer',
						},
						selected: {},
						active: {},
						noclick: {
							cursor: 'help',
						},
						normal: {
							cursor: 'default',
						},
						slideIn: {
							cursor: 'pointer',
						},
					},
				},
				{ isAcceptingInput: this.configuration.isAcceptingInput },
			);
			// Native listener fires even when Button state is disabled (jQuery unbind doesn't remove it).
			b.$button[0].addEventListener('click', () => this.flashAbilityBtn(i));
			this.buttons.push(b);
			this.abilitiesButtons.push(b);
		}

		// Scoreboard close button
		$j('.togglescore.close-button').on('click', () => {
			this.closeScoreboard();
		});

		// ProgressBar
		this.healthBar = new ProgressBar({
			$bar: $j('#leftpanel .progressbar .bar.healthbar'),
			color: 'red',
		});

		this.energyBar = new ProgressBar({
			$bar: $j('#leftpanel .progressbar .bar.energybar'),
			color: 'yellow',
		});

		this.timeBar = new ProgressBar({
			$bar: $j('#rightpanel .progressbar .timebar'),
			color: 'white',
		});

		this.poolBar = new ProgressBar({
			$bar: $j('#rightpanel .progressbar .poolbar'),
			color: 'grey',
		});

		// Sound Effects slider
		const slider = document.getElementById('sfx') as HTMLInputElement;
		slider.addEventListener(
			'input',
			() => (game.soundsys.allEffectsMultiplier = parseFloat(slider.value)),
		);

		// Prevents default touch behaviour on slider when first touched (prevents scrolling the screen).
		slider.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });

		slider.addEventListener('touchmove', (e) => {
			// Get slider relative to the view port.
			const sliderRect = slider.getBoundingClientRect();
			// The original touch point Y coordinate relative to the view port.
			const touchPoint = e.touches[0].clientY;
			/// The y coord of the touch event relative to the slider.
			const touchRelToSlider = touchPoint - sliderRect.top;
			const distFromBottom = sliderRect.height - touchRelToSlider;
			// Normalize the distance from the bottom of the slider to a value between 0 and 1.
			const normDist = distFromBottom / sliderRect.height;
			// Scale normDist to range of the slider.
			const scaledDist = normDist * (parseInt(slider.max) - parseInt(slider.min));
			// New value of the slider.
			const slidersNewVal = scaledDist + parseFloat(slider.min);
			// Sets the slider value to the new value between the min/max bounds of the slider.
			// eslint-disable-next-line prettier/prettier
			slider.value = Math.min(
				Math.max(slidersNewVal, parseInt(slider.min)),
				parseInt(slider.max),
			).toString();

			// Manually dispatches the input event to update the sound system with new slider value.
			slider.dispatchEvent(new Event('input'));
		});

		this.hotkeys = new Hotkeys(this);
		const ingameHotkeys = getHotKeys(this.hotkeys);

		// Right-click closes the topmost open view on RELEASE (mouseup), not on
		// press: holding the button must keep the view visible until release
		// (the pre-Phaser-4 behaviour). The whole gesture is swallowed here in
		// window capture — which runs before Phaser's canvas/window listeners
		// and before any DOM bubble handler — so no part of it can leak into
		// the hex grid and reopen the dash:
		//  - mousedown with a view open: swallow, remember the gesture started
		//    on an overlay, don't close yet (button still held);
		//  - mouseup: swallow, close exactly one view (topmost first);
		//  - contextmenu: swallow, close only if a view is somehow still open
		//    (gestures without a preceding mousedown); otherwise a no-op, so a
		//    single press can never close twice.
		const openViews = () => {
			const open: Array<'music' | 'score' | 'meta' | 'dash'> = [];
			if (!this.$scoreboard.hasClass('hide')) {
				open.push('score');
			}
			if (!$j('#musicplayerwrapper').hasClass('hide')) {
				open.push('music');
			}
			if (this.metaPowers && !this.metaPowers.$els?.modal?.hasClass('hide')) {
				open.push('meta');
			}
			if (this.dashopen) {
				open.push('dash');
			}
			return open;
		};
		const topmostOpenView = (): 'music' | 'score' | 'meta' | 'dash' | null => {
			// Topmost mirrors z-order: scoreboard > music > meta > dash.
			const open = openViews();
			if (open.includes('score')) {
				return 'score';
			}
			if (open.includes('music')) {
				return 'music';
			}
			if (open.includes('meta')) {
				return 'meta';
			}
			if (open.includes('dash')) {
				return 'dash';
			}
			return null;
		};
		const closeViewName = (view: 'music' | 'score' | 'meta' | 'dash') => {
			if (view === 'music') {
				this.toggleMusicPlayer(false);
			} else if (view === 'score') {
				this.closeScoreboard();
			} else if (view === 'meta') {
				this.metaPowers?._closeModal();
			} else {
				this.closeDash();
			}
		};
		// The combat log is also the Meta Powers toggle (bound on the
		// contextmenu bubble further down). That gesture must toggle the panel
		// on/off, not close it, so this capture handler stays out of its way:
		// without the guard below, the panel opened by the contextmenu would be
		// closed again by the same press' mouseup (it only appeared while the
		// button was held, then faded out).
		const isMetaToggleGesture = (e: Event) => {
			const target = e.target as Element | null;
			return !!target?.closest?.(META_TOGGLE_SELECTOR);
		};
		// A physical right-click fires mousedown -> mouseup -> contextmenu.
		// Close on mouseup (release): the overlay stays visible while the
		// button is held, and only the release event closes a view — exactly
		// one, topmost first. Closing happens here in window capture — which
		// runs before Phaser's canvas listeners and before any DOM bubble
		// handler — and propagation is stopped so every other layer stays
		// silent for the whole gesture.
		// The consumed-flag covers the gesture's own contextmenu (some
		// browsers fire contextmenu without a preceding mousedown, e.g. after
		// preventDefault on an earlier event) and resets there, so each
		// physical press is a fresh gesture and the flag can't stick.
		let gestureConsumed = false;
		const onCaptureRightClick = (e: Event) => {
			if (game.freezedInput) {
				return;
			}
			const me = e as MouseEvent;
			const isRightButton = e.type === 'contextmenu' || me.button === 2;
			if (!isRightButton) {
				return;
			}
			if (e.type !== 'mousedown' && e.type !== 'mouseup' && e.type !== 'contextmenu') {
				return;
			}
			if (gestureConsumed) {
				// Tail of an already-closed gesture: keep swallowing; the
				// gesture's own contextmenu ends it and re-arms the next press.
				// A fresh mousedown here means the previous release was missed
				// (e.g. released off-window), so re-arm and handle it as new.
				if (e.type === 'mousedown') {
					gestureConsumed = false;
				} else {
					e.preventDefault();
					e.stopPropagation();
					if (e.type === 'contextmenu') {
						gestureConsumed = false;
					}
					return;
				}
			}
			if (openViews().length === 0) {
				return;
			}
			if (isMetaToggleGesture(e) && topmostOpenView() === 'meta') {
				// Hand the whole press to the combat log's toggle: the native menu
				// and text selection stay suppressed, but the gesture is no longer
				// swallowed so the panel toggles instead of closing on release.
				e.preventDefault();
				return;
			}
			e.preventDefault();
			e.stopPropagation();
			if (e.type === 'mouseup') {
				// Close exactly one view per gesture, topmost first.
				const topmost = topmostOpenView();
				if (topmost) {
					closeViewName(topmost);
					gestureConsumed = true;
				}
			}
		};
		// Capture on window: runs before Phaser's canvas/window listeners and
		// before any per-view bubble handler. Per-view bubble handlers are
		// gone: closing here (once per gesture) means no second layer can
		// double-close into the view underneath.
		window.addEventListener('mousedown', onCaptureRightClick, true);
		window.addEventListener('mouseup', onCaptureRightClick, true);
		window.addEventListener('contextmenu', onCaptureRightClick, true);

		// Remove hex grid if window loses focus
		$j(window).off('blur.ingameHotkeys');
		$j(window).on('blur.ingameHotkeys', () => {
			game.grid.showGrid(false);
		});

		// Binding Hotkeys
		if (!DEBUG_DISABLE_HOTKEYS) {
			$j(document).off('keydown.ingameHotkeys');
			$j(document).on('keydown.ingameHotkeys', (rawEvent) => {
				const e = rawEvent as unknown as KeyboardEvent;
				const keydownAction = ingameHotkeys[e.code] && ingameHotkeys[e.code].onkeydown;
				const isScoreboardOpen = !this.$scoreboard.hasClass('hide');
				const isInterfaceViewOpen = this.isInterfaceViewOpen();

				// While scoreboard is open, block gameplay/navigation hotkeys and keep only
				// scoreboard-scoped actions (Save, Exit, fullscreen, view switching) plus Escape.
				if (isScoreboardOpen && !isScoreboardHotkey(e)) {
					return;
				}

				const isUtilityHotkey = isUtilityHotkeyEvent(e, {
					dashOpen: this.dashopen,
					interfaceViewOpen: isInterfaceViewOpen,
					scoreboardOpen: isScoreboardOpen,
				});

				if (game.freezedInput && !isUtilityHotkey) {
					return;
				}

				if (this.isViewOpen('secret') && !isUtilityHotkey) {
					return;
				}

				if (keydownAction !== undefined) {
					const shouldPreventDefault =
						e.code !== 'Escape' || isInterfaceViewOpen || this.activeAbility;

					if (shouldPreventDefault && !(e.code === 'Tab' && e.shiftKey)) {
						e.preventDefault();
					}
					keydownAction.call(this, e);
				}
			});

			$j(document).off('keyup.ingameHotkeys');
			$j(document).on('keyup.ingameHotkeys', (rawEvent) => {
				const e = rawEvent as unknown as KeyboardEvent;
				if (game.freezedInput) {
					return;
				}

				const keyupAction = ingameHotkeys[e.code] && ingameHotkeys[e.code].onkeyup;

				if (keyupAction !== undefined && !this.dashopen) {
					keyupAction.call(this, e);

					e.preventDefault();
				}
			});
		}

		// Mouse Shortcut - Middle click to skip turn (global, when dash is not open)
		$j(document).off('mousedown.ingameHotkeys');
		$j(document).on('mousedown.ingameHotkeys', (e) => {
			if (game.freezedInput) {
				return;
			}

			if (e.which === 2 && !this.dashopen) {
				e.preventDefault();
				this.btnSkipTurn.triggerClick();
			}
		});

		// Mouse Shortcut
		$j('#dash').on('mousedown', (e) => {
			if (game.freezedInput) {
				return;
			}

			switch (e.which) {
				case 1:
					// Left mouse button pressed
					break;
				case 2:
					// Middle mouse button pressed
					e.stopPropagation();
					if (this.dashopen) {
						this.materializeButton.triggerClick();
					}
					break;
				// Right-click (button 3) handled by window capture handler below,
				// which intercepts before canvas and closes dash.
			}
		});

		// Prevent mouseup from falling through to Phaser canvas after right-click closes dash
		$j('#dash').on('mouseup', (e) => {
			if (game.freezedInput) {
				return;
			}
			e.stopPropagation();
		});

		// Stale per-view right-click closers, superseded by the window-capture
		// gesture handler above (closes once per gesture, topmost first). They
		// are detached so a single gesture can't close twice — e.g. closing
		// audio and then, on the same gesture, the dash underneath.
		$j('#meta-powers').off('mousedown.ab-close');
		$j('#ui').off('mousedown.ab-close');

		$j(META_TOGGLE_SELECTOR).on('contextmenu', (e) => {
			if (game.freezedInput) {
				return;
			}

			if (this.canToggleMetaPowers()) {
				e.preventDefault();
				e.stopPropagation();
				this.game.channels.ui.emit('toggleMetaPowers');
			}
		});

		$j('#combatwrapper, #dash, #bottompanel').on('wheel', (e) => {
			if (game.freezedInput) {
				return;
			}
			const originalWheelEvent = e.originalEvent as WheelEvent;
			// Dash
			if (this.dashopen) {
				if (originalWheelEvent.deltaY < 0) {
					// Wheel up
					this.gridSelectPrevious();
				} else if (originalWheelEvent.deltaY > 0) {
					// Wheel down
					this.gridSelectNext();
				}
				// Abilities
			} else {
				if (originalWheelEvent.deltaY < 0) {
					// Wheel up
					this.selectPreviousAbility();
					// TODO: Allow to cycle between the usable active abilities by pressing the passive one's icon
				} else if (originalWheelEvent.deltaY > 0) {
					// Wheel down
					this.selectNextAbility();
				}
			}

			e.preventDefault();
		});

		this.$dash.find('.section.numbers .stat').on('mouseover', (event) => {
			const $stat = $j(event.target).closest('.stat');
			const $section = $stat.closest('.section');
			const which = $section.hasClass('stats') ? '.stats_desc' : '.masteries_desc';
			const hasAdvancedTooltip = $stat.children('.stat-modifiers').length > 0;

			$j('.stats_desc, .masteries_desc').removeClass('shown');
			$stat.toggleClass('suppress-regular-tooltip', hasAdvancedTooltip);

			$j(which).addClass('shown');

			if (!hasAdvancedTooltip && $stat.children('.tooltiptext').length === 0) {
				const tooltipText =
					($stat.data('default-title') as string | undefined) ||
					$stat.attr('title') ||
					String($stat.attr('stat') || '');

				if (tooltipText !== '') {
					$stat.append(`<span class="tooltiptext">${tooltipText}</span>`);
				}
			}
		});

		this.$dash.find('.section.numbers .stat').on('mouseleave', (event) => {
			const $stat = $j(event.target).closest('.stat');
			$stat.removeClass('suppress-regular-tooltip');
			$j('.stats_desc, .masteries_desc').removeClass('shown');
		});

		this.$dash.children('#playertabswrapper').addClass('numplayer' + game.gameMode);

		this.selectedCreature = '';
		this.selectedPlayer = 0;
		this.selectedAbility = -1;
		this.clickedAbility = -1;
		this.hoveredAbilityIndex = -1;
		this.hoveringNoActionCreature = false;
		this.queueAnimSpeed = 500; // ms
		this.dashAnimSpeed = 250; // ms
		this.cardAssetCache = new Map();
		this.cardFlipTimeoutId = null;
		this.abilityCostFlashTimeout = null;

		this.materializeToggled = false;
		this.lastTurnWarningSecond = null;
		this.lastTurnWarningPlayerId = null;
		this.infiniteTurnBarInitialized = false;
		this.infinitePoolBarInitialized = false;
		this.dashopen = false;

		this.glowInterval = setInterval(() => {
			// Guard against a torn-down game (e.g. between matches) so a stray tick
			// can't throw "can't access property 'allhexes', e.grid is null".
			if (!game.grid || !game.grid.allhexes) {
				return;
			}
			const opa =
				0.5 +
				// eslint-disable-next-line prettier/prettier
				Math.floor(
					((1 + Math.sin(Math.floor(new Date().valueOf() * (Math.PI / 7.775)) / 100)) / 4) * 100,
				) /
					100;
			const opaWeak = opa / 2;

			game.grid.allhexes.forEach((hex) => {
				if (hex.overlayClasses.match(/creature/)) {
					if (hex.overlayClasses.match(/selected|active/)) {
						if (hex.overlayClasses.match(/weakDmg/)) {
							hex.overlay.alpha = opaWeak;
							return;
						}

						hex.overlay.alpha = opa;
					}
				}
			});
		}, 10);

		if (game.turnTimePool >= 0) {
			$j('.turntime').text(time.getTimer(game.turnTimePool));
			this.infiniteTurnBarInitialized = false;
		} else {
			$j('.turntime').text('∞');
			const initialPlasmaRatio =
				game.activeCreature && game.configData.plasma_amount > 0
					? Math.min(1, game.activeCreature.player.plasma / game.configData.plasma_amount)
					: 0;
			this.timeBar.setColor('#c5f');
			this.timeBar.setSize(initialPlasmaRatio);
			this.infiniteTurnBarInitialized = true;
		}

		if (game.timePool >= 0) {
			$j('.timepool').text(time.getTimer(game.timePool));
			this.infinitePoolBarInitialized = false;
		} else {
			$j('.timepool').text('∞');
			const initialScoreRatio =
				game.activeCreature && game.players.length > 0
					? (() => {
							const scores = game.players.map((pl) => pl.getScore().total);
							const maxScore = Math.max(...scores, 1);
							return Math.max(
								0,
								Math.min(1, game.activeCreature.player.getScore().total / maxScore),
							);
					  })()
					: 0;
			this.poolBar.setColor('#aaf');
			this.poolBar.setSize(initialScoreRatio);
			this.infinitePoolBarInitialized = true;
		}

		this.confirmWindowUnload();

		$j('#tabwrapper a').removeAttr('href'); // Empty links

		this.disarmScoreboardConfirm();
		this.btnExit.changeState(ButtonStateEnum.hidden);
		this.btnSaveLog.changeState(ButtonStateEnum.hidden);
		this.btnRestartMatch.changeState(ButtonStateEnum.hidden);
		// Show UI
		this.$display.show();
		this.$dash.hide();

		// Events
		this.game.channels.ui.on('toggleDash', () => this.toggleDash(false));
		this.game.channels.ui.on('toggleScore', () => this.toggleScoreboard(false));
		this.game.channels.ui.on('toggleMusicPlayer', () => this.toggleMusicPlayer());
		this.game.channels.ui.on('toggleSecretView', () => toggleSecretView());
		this.game.channels.ui.on('toggleMetaPowers', () => {
			if (!this.canToggleMetaPowers()) {
				return;
			}

			this.closeDash();
			this.closeScoreboard();
		});
		this.game.channels.ui.on('closeInterfaceScreens', () => {
			if (this.isViewOpen('secret')) {
				toggleSecretView();
			}
			this.closeDash();
			this.toggleMusicPlayer(false);
			this.closeScoreboard();
		});
	}

	/** Horizontal center of the game viewport, used to center the brand logo. */
	getBrandLogoCenterX(): number {
		const worldWidth = this.game.gameEngine?.world?.width;
		return worldWidth ? worldWidth / 2 : 960;
	}

	/** Re-center the brand logo, e.g. after the viewport was resized. */
	centerBrandLogo() {
		if (this.brandlogo) {
			this.brandlogo.x = this.getBrandLogoCenterX();
		}
	}

	/**
	 * Show or hide the brand logo, and with it its click target.
	 *
	 * Holding Ctrl reveals the logo as a secret control that re-rolls the
	 * combat location, so it only accepts pointer input while it is on screen.
	 * Phaser 4 hit-tests interactive objects regardless of alpha — the engine
	 * adapter deliberately keeps the render mask set so invisible hex hitboxes
	 * still work — so leaving input enabled on a hidden logo would make it
	 * swallow clicks meant for the board underneath it.
	 */
	setBrandLogoVisible(visible: boolean) {
		const logo = this.brandlogo;
		if (!logo) {
			return;
		}
		logo.alpha = visible ? 1 : 0;
		if (visible) {
			// `setInteractive` is what creates the interactive object the hand
			// cursor is stored on, so the cursor has to be set afterwards.
			logo.setInteractive();
			setHandCursor(logo, true);
			return;
		}
		// Disabled rather than left enabled-and-transparent: an invisible logo that
		// still hit-tests would swallow clicks meant for the board underneath.
		logo.disableInteractive();
		setHandCursor(logo, false);
		// Phaser only restores the canvas cursor on a pointer-out it observes
		// itself, which never arrives for an object hidden mid-hover.
		if ($j('canvas').css('cursor') === 'pointer') {
			$j('canvas').css('cursor', '');
		}
	}

	/**
	 * Handle events on the "ui" channel.
	 *
	 * @param {string} message Event name.
	 * @param {object} payload Event payload.
	 */
	canToggleMetaPowers() {
		return process.env.NODE_ENV === 'development' && !this.game.multiplayer && !!this.metaPowers;
	}

	/**
	 * How an ability's energy cost reads on the bar: the total it needs and the
	 * part of that total the creature cannot cover.
	 *
	 * The total includes the energy every ability keeps in reserve, and the
	 * shortfall is measured from the energy the creature has right now, so the
	 * existing energy is always part of the reading.
	 *
	 * @returns {object} Fractions of the bar, or null when the ability has no
	 * energy cost
	 */
	energyCostPreview(abilityId: number) {
		const creature = this.game.activeCreature,
			cost = creature?.abilities[abilityId]?.costs?.energy;

		if (typeof cost !== 'number') {
			return null;
		}

		const requiredEnergy = cost + creature.stats.reqEnergy;

		return {
			required: requiredEnergy / creature.stats.energy,
			missing: requiredEnergy / creature.stats.energy - creature.energy / creature.stats.energy,
			affordable: requiredEnergy <= creature.energy,
		};
	}

	showAbilityCosts(abilityId: number) {
		const game = this.game,
			creature = game.activeCreature,
			ab = creature.abilities[abilityId];

		if (ab.costs !== undefined) {
			const cost = this.energyCostPreview(abilityId);

			if (cost) {
				this.energyBar.previewSize(cost.required);
				this.energyBar.setAvailableStyle();

				if (!cost.affordable) {
					// Indicate the minimum energy required for the hovered ability
					// if the requirement is not met
					this.energyBar.showUnavailableCost(cost.required, cost.missing);
				}
			} else {
				this.energyBar.previewSize(0);
			}

			if (typeof ab.costs.health == 'number') {
				this.healthBar.previewSize(ab.costs.health / creature.stats.health);
			} else {
				this.healthBar.previewSize(0);
			}
		}
	}

	hideAbilityCosts() {
		const game = this.game,
			creature = game.activeCreature;
		// Reset energy bar to match actual energy value
		this.energyBar.setSize(creature.energy / creature.stats.energy);

		this.energyBar.previewSize(0);
		this.healthBar.previewSize(0);
	}

	/**
	 * Drop a pending cost flash and remove its overlay.
	 */
	private clearAbilityCostFlash() {
		if (this.abilityCostFlashTimeout !== null) {
			clearTimeout(this.abilityCostFlashTimeout);
			this.abilityCostFlashTimeout = null;
		}
		this.energyBar.clearCostGhost();
	}

	/**
	 * Briefly show what an ability costs when its hotkey is pressed while the
	 * creature cannot afford it.
	 *
	 * A disabled ability button drops the click before it reaches the ability
	 * (see Button#triggerClick), so the cost the hotkey silently refused would
	 * only ever be visible to players who happen to hover the button. This draws
	 * the same preview the hover does, on an overlay bar, so the energy the
	 * creature does have never disappears.
	 */
	flashAbilityCosts(abilityId: number) {
		// A selected ability or the dash already owns the preview.
		if (this.selectedAbility !== -1 || this.dashopen) {
			return;
		}

		const cost = this.energyCostPreview(abilityId);

		// Only an energy shortfall is worth explaining on the bar itself; every
		// refusal flashes the icon (see flashAbilityBtn), and targetless ones
		// also pulse the range circles.
		if (!cost || cost.affordable) {
			return;
		}

		this.energyBar.showCostGhost(cost.required, cost.missing);

		if (this.abilityCostFlashTimeout === null) {
			// Start hidden, otherwise the overlay is already opaque and the fade
			// in is invisible.
			this.energyBar.fadeCostGhost(false, 0);
			this.energyBar.fadeCostGhost(true, ABILITY_COST_FADE_MS);
		} else {
			// Already up: only re-arm the timer. Re-fading would make the cost
			// blink for as long as the key is held down.
			clearTimeout(this.abilityCostFlashTimeout);
		}

		this.abilityCostFlashTimeout = setTimeout(() => {
			this.abilityCostFlashTimeout = null;
			this.energyBar.fadeCostGhost(false, ABILITY_COST_FADE_MS, () => {
				this.energyBar.clearCostGhost();
			});
		}, ABILITY_COST_FLASH_MS);
	}

	selectPreviousAbility() {
		const game = this.game,
			b = this.selectedAbility == -1 ? 4 : this.selectedAbility;

		for (let i = b - 1; i > 0; i--) {
			const creature = game.activeCreature;

			if (creature.abilities[i].require() && !creature.abilities[i].used) {
				this.abilitiesButtons[i].triggerClick();
				return;
			}
		}

		game.activeCreature.queryMove();
		this.selectAbility(-1);
	}

	/**
	 * Cycles to next available ability. Returns the ability number selected or -1 if deselected.
	 */
	selectNextAbility() {
		const game = this.game,
			b = this.selectedAbility == -1 ? 0 : this.selectedAbility;
		if (this.selectedAbility == 3) {
			game.activeCreature.queryMove();
			this.selectAbility(-1);
			return -1;
		}
		for (let i = b + 1; i < 4; i++) {
			const creature = game.activeCreature;

			if (creature.abilities[i].require() && !creature.abilities[i].used) {
				this.abilitiesButtons[i].triggerClick();
				return i;
			}

			// Check if creature has at least one more ability to choose from
			let creatureHaveAtleastOneAvailableAbility = false;
			for (let y = i; y < 4; y++) {
				if (creature.abilities[y].require()) {
					creatureHaveAtleastOneAvailableAbility = true;
					break;
				}
			}

			// If creature has no more available abilities to choose from, return -1
			if (!creatureHaveAtleastOneAvailableAbility) {
				game.activeCreature.queryMove();
				this.selectAbility(-1);
				return -1;
			}
		}

		// All remaining abilities are available (require()=true) but already used.
		// Fall back to movement mode.
		game.activeCreature.queryMove();
		this.selectAbility(-1);
		return -1;
	}
	resizeDash() {
		const isArcade = window.innerWidth <= 600 && window.innerHeight <= 700;

		if (isArcade) {
			$j('#cardwrapper_inner').css('scale', '');
			$j('#cardwrapper_inner').css({
				zoom: Math.min(
					$j('#cardwrapper').innerWidth() / $j('#card').outerWidth(),
					$j('#cardwrapper').innerHeight() / $j('#card').outerHeight(),
					1,
				),
				left: 'auto',
				position: 'relative',
				margin: '0 auto',
			});

			$j('#materialize_button').css('scale', '');
			$j('#materialize_button').css({
				zoom: Math.min(
					$j('#cardwrapper').innerWidth() / $j('#materialize_button').outerWidth(),
					$j('#cardwrapper').innerHeight() / $j('#materialize_button').outerHeight(),
					1,
				),
				left: 'auto',
				position: 'relative',
				margin: '0 auto',
			});
		} else {
			$j('#cardwrapper_inner').css('zoom', '');
			const zoom = Math.min(
				$j('#cardwrapper').innerWidth() / $j('#card').outerWidth(),
				$j('#cardwrapper').innerHeight() /
					($j('#card').outerHeight() + $j('#materialize_button').outerHeight()),
				1,
			);

			$j('#cardwrapper_inner').css({
				scale: zoom,
				left: ($j('#cardwrapper').innerWidth() - $j('#card').innerWidth() * zoom) / 2,
				position: 'absolute',
				margin: 0,
			});

			$j('#materialize_button').css('zoom', '');
			$j('#materialize_button').css({
				scale: '',
				left: '',
				position: '',
				margin: '',
			});
		}

		const zoom1 = $j('#creaturerasterwrapper').innerWidth() / $j('#creatureraster').innerWidth();
		const zoom2 = $j('#creaturerasterwrapper').innerHeight() / $j('#creatureraster').innerHeight();
		const zoom = Math.min(zoom1, zoom2, 1);

		$j('#creatureraster').css({
			scale: zoom,
			left:
				($j('#creaturerasterwrapper').innerWidth() - $j('#creatureraster').innerWidth() * zoom) / 2,
			position: 'absolute',
			margin: 0,
		});
	}

	/**
	 * Query a creature in the available creatures of the active player.
	 *
	 * @param {CreatureType} creatureType Creature type
	 * @param {number} player Player ID
	 * @param {'emptyHex' | 'portrait' | 'grid'} clickMethod Method used to view creatures.
	 */
	showCreature(
		creatureType: CreatureType,
		player: number,
		clickMethod?: 'emptyHex' | 'portrait' | 'grid' | '',
	) {
		const game = this.game;
		const getUrlWithFallback = (key: string, fallbackKey: string) => {
			try {
				return getUrl(key);
			} catch {
				return getUrl(fallbackKey);
			}
		};
		const getCardArtworkUrl = (name: string) => {
			if (name.startsWith('object_')) {
				return getUrlWithFallback('units/sprites/' + name, 'units/artwork/Dark Priest');
			}

			return getUrlWithFallback('units/artwork/' + name, 'units/artwork/Dark Priest');
		};

		const wasDashClosed = !this.dashopen;
		const oldCreatureType = this.selectedCreature;

		if (wasDashClosed) {
			// Invalidate any in-flight close's deferred pointer-events changes
			// (see closeDash): a racing open before the fade callback runs
			// would otherwise be left unclickable.
			this.dashFadeToken = null;
			this.$dash.css('pointer-events', '');
			this.$dash.show().css('opacity', 0);
			this.$dash.transition(
				{
					opacity: 1,
				},
				this.dashAnimSpeed,
				'linear',
				() => {
					this.dashOpenCollectiveBanner.onViewOpen();
				},
			);
		}

		this.dashopen = true;

		if (player === undefined) {
			player = game.activeCreature.player.id;
		}

		// Set dash active
		this.$dash.addClass('active');
		this.$dash.children('#tooltip').removeClass('active');
		this.$dash.children('#playertabswrapper').addClass('active');
		this.changePlayerTab(game.activeCreature.team);
		this.resizeDash();

		if (window.innerWidth <= 600 && window.innerHeight <= 700 && game.activeCreature) {
			this.chat.showExpanded(game.activeCreature);
		}

		this.$dash
			.children('#playertabswrapper')
			.children('.playertabs')
			.off('click')
			.on('click', (e) => {
				if (game.freezedInput) {
					return;
				}
				this.showCreature('--', parseInt($j(e.currentTarget).attr('player')) - 0);
			});

		// Update player info
		for (let i = game.players.length - 1; i >= 0; i--) {
			$j('#dash .playertabs.p' + i + ' .vignette').css(
				'background-image',
				`url("${game.players[i].avatar}")`,
			);
			$j('#dash .playertabs.p' + i + ' .name').text(game.players[i].name);
			$j('#dash .playertabs.p' + i + ' .plasma').text('Plasma ' + game.players[i].plasma);
			$j('#dash .playertabs.p' + i + ' .score').text('Score ' + game.players[i].getScore().total);
			$j('#dash .playertabs.p' + i + ' .units').text(
				'Units ' + game.players[i].getNbrOfCreatures() + ' / ' + game.configData.creaLimitNbr,
			);
		}

		// Change to the player tab
		if (player != this.selectedPlayer) {
			this.changePlayerTab(player);
		}

		this.$grid
			.children('.vignette')
			.removeClass('active')
			.filter("[creature='" + creatureType + "']")
			.addClass('active');

		this.selectedCreature = creatureType;
		// Added: Visually highlight the selected creature on the grid
		// This ensures the tile matches the active creature shown in the UI panel
		this.$grid.find('.vignette').removeClass('active');
		this.$grid.find(".vignette[creature='" + creatureType + "']").addClass('active');
		const stats = game.retrieveCreatureStats(creatureType);
		if (stats === undefined) return;

		//function to add the name, realm, size etc of the current card in the menu
		function addCardCharacterInfo() {
			const name = stats.name;
			let type = stats.type;
			let set = stats.set;
			const no_of_hexes =
				stats.size === 1
					? '&#11041'
					: stats.size == 2
					? '&#11041 &#11041'
					: '&#11041 &#11041 &#11041';

			if (stats.level === '-' || stats.realm === '-') {
				type = '&#9734';
				$j('#card .sideA .type').addClass('star');
				set = '';
			} else {
				$j('#card .sideA .type').removeClass('star');
			}

			$j('#card .sideA .type').html(type);
			$j('#card .sideA .name').text(name);
			$j('#card .sideA .set').html(set);
			$j('#card .sideA .hexes').html(no_of_hexes);
		}

		// Card flip animation when switching creatures
		const isSwitchingCreature =
			!wasDashClosed && oldCreatureType !== '' && oldCreatureType !== creatureType;
		const cardAssetUrls = [
			getUrl('cards/margin'),
			getCardArtworkUrl(stats.name),
			getUrl('cards/' + stats.type.substring(0, 1)),
			...Object.keys(stats.ability_info).map((key) =>
				getUrl('units/abilities/' + stats.name + ' ' + key),
			),
		];

		const updateCardContent = () => {
			const materializedCreature = game.players[player].creatures.find(
				(creature) => creature.type === creatureType,
			);
			$j('#card .sideA').css(
				'cursor',
				materializedCreature && !materializedCreature.dead ? 'progress' : 'not-allowed',
			);

			if (
				$j.inArray(creatureType, game.players[player].availableCreatures) > 0 ||
				creatureType == '--'
			) {
				this.selectedCreatureObj = undefined;

				// retrieve the selected unit
				game.players[player].creatures.forEach((creature) => {
					if (creature.type == creatureType) {
						this.selectedCreatureObj = creature;
					}
				});

				// Card A
				$j('#card .sideA').css({
					'background-image': `url('${getUrl('cards/margin')}'), url('${getUrlWithFallback(
						'units/artwork/' + stats.name,
						'units/artwork/Dark Priest',
					)}')`,
				});
				$j('#card .sideA .section.info')
					.removeClass('sin- sinA sinE sinG sinL sinP sinS sinW')
					.addClass('sin' + stats.type.substring(0, 1));
				addCardCharacterInfo();

				// Card B
				$j('#card .sideB').css({
					'background-image': `url('${getUrl('cards/margin')}'), url('${getUrl(
						'cards/' + stats.type.substring(0, 1),
					)}')`,
				});

				const isBrowsing = !this.selectedCreatureObj;

				$j.each(stats.stats, (key, value) => {
					const $stat = $j('#card .sideB .' + key + ' .value');

					if (this.selectedCreatureObj) {
						if (key == 'health') {
							$stat.text(
								this.selectedCreatureObj.health + '/' + this.selectedCreatureObj.stats[key],
							);
						} else if (key == 'movement') {
							$stat.text(
								this.selectedCreatureObj.remainingMove + '/' + this.selectedCreatureObj.maxMovement,
							);
						} else if (key == 'energy') {
							$stat.text(
								this.selectedCreatureObj.energy + '/' + this.selectedCreatureObj.stats[key],
							);
						} else if (key == 'endurance') {
							$stat.text(
								this.selectedCreatureObj.endurance + '/' + this.selectedCreatureObj.stats[key],
							);
						} else {
							$stat.text(this.selectedCreatureObj.stats[key]);
						}
					} else {
						$stat.text(value);
					}

					applyBuffDebuffStyle($stat, this.selectedCreatureObj, key, value, isBrowsing);
				});
				$j.each(game.abilities[stats.id], (key) => {
					const $ability = $j('#card .sideB .abilities .ability:eq(' + key + ')');
					const abilityIndex = Number(key);
					const isUpgraded = Boolean(
						this.selectedCreatureObj?.abilities?.[abilityIndex]?.isUpgraded(),
					);
					$ability.children('.icon').css({
						'background-image': `url('${getUrl('units/abilities/' + stats.name + ' ' + key)}')`,
					});
					$ability.toggleClass('upgraded', isUpgraded);
					$ability
						.children('.wrapper')
						.children('.info')
						.children('h3')
						.text(stats.ability_info[key].title);
					$ability
						.children('.wrapper')
						.children('.info')
						.children('#desc')
						.text(stats.ability_info[key].desc);
					$ability
						.children('.wrapper')
						.children('.info')
						.children('#info')
						.text(stats.ability_info[key].info);
					$ability
						.children('.wrapper')
						.children('.info')
						.children('#upgrade')
						.text('Upgrade: ' + stats.ability_info[key].upgrade);

					if (stats.ability_info[key].costs !== undefined && key !== 0) {
						$ability
							.children('.wrapper')
							.children('.info')
							.children('#cost')
							.text(' - costs ' + stats.ability_info[key].costs.energy + ' energy pts.');
					} else {
						$ability
							.children('.wrapper')
							.children('.info')
							.children('#cost')
							.text(' - this ability is passive.');
					}
				});

				const summonedOrDead = game.players[player].creatures.some(
					(creature) => creature.type == creatureType,
				);

				this.materializeButton.changeState(ButtonStateEnum.disabled);
				$j('#card .sideA').addClass('disabled').off('click');

				const activeCreature = game.activeCreature;

				if (activeCreature.player.getNbrOfCreatures() > game.configData.creaLimitNbr) {
					$j('#card .sideA').css('cursor', 'no-drop');
					$j('#materialize_button p').text(game.msg.ui.dash.materializeOverload);
				}
				// Check if the player is viewing the wrong tab
				else if (
					activeCreature.player.id !== player &&
					activeCreature.isDarkPriest() &&
					activeCreature.abilities[3].testRequirements() &&
					activeCreature.abilities[3].used === false
				) {
					$j('#card .sideA').css('cursor', 'alias');
					$j('#materialize_button p').text(game.msg.ui.dash.wrongPlayer);

					// Switch to turn player's dark priest
					this.materializeButton.click = () => {
						this.showCreature('--', activeCreature.player.id);
					};

					$j('#card .sideA').on('click', this.materializeButton.click);
					$j('#card .sideA').removeClass('disabled');
					this.materializeButton.changeState(ButtonStateEnum.glowing);
					$j('#materialize_button').show();
				} else if (
					!summonedOrDead &&
					activeCreature.player.id === player &&
					activeCreature.type === '--' &&
					activeCreature.abilities[3].used === false
				) {
					const lvl = parseInt(creatureType.substring(1, 2)) - 0,
						size = game.retrieveCreatureStats(creatureType).size - 0,
						plasmaCost = lvl + size;

					// Messages (TODO: text strings in a new language file)
					if (plasmaCost > activeCreature.player.plasma) {
						$j('#card .sideA').css('cursor', 'help');
						$j('#materialize_button p').text(game.msg.ui.dash.lowPlasma);
					} else {
						if (creatureType == '--') {
							$j('#materialize_button p').text(game.msg.ui.dash.selectUnit);
						} else {
							$j('#materialize_button p').text(
								game.msg.ui.dash.materializeUnit(plasmaCost.toString()),
							);
							$j('#card .sideA').css('cursor', 'pointer');

							// Bind button
							this.materializeButton.click = () => {
								this.materializeToggled = false;
								this.selectAbility(3);
								this.closeDash();
								if (this.lastViewedCreature) {
									activeCreature.abilities[3].materialize(this.lastViewedCreature);
								} else {
									activeCreature.abilities[3].materialize(this.selectedCreature);
									this.lastViewedCreature = this.selectedCreature;
								}
							};
							$j('#card .sideA').on('click', this.materializeButton.click);
							$j('#card .sideA').removeClass('disabled');
							this.materializeButton.changeState(ButtonStateEnum.glowing);
							$j('#materialize_button').show();
						}
					}
				} else {
					if (creatureType == '--' && !activeCreature.abilities[3].used) {
						// Figure out if the player has enough plasma to summon any available creatures
						const activePlayer = game.players[game.activeCreature.player.id];
						const deadOrSummonedTypes = new Set(
							activePlayer.creatures.map((creature) => creature.type),
						);
						const availableTypes = getSummonCandidates(game, activePlayer.availableCreatures, {
							excludeTypes: deadOrSummonedTypes,
						});
						// Assume we can't afford anything
						// Check one available creature at a time until we see something we can afford
						let can_afford_a_unit = false;
						availableTypes.forEach((type) => {
							const lvl = parseInt(type.substring(1, 2)) - 0;
							const size = game.retrieveCreatureStats(type).size - 0;
							const plasmaCost = lvl + size;
							if (plasmaCost <= activePlayer.plasma) {
								can_afford_a_unit = true;
							}
						});
						// If we can't afford anything, tell the player and disable the materialize button
						if (!can_afford_a_unit) {
							$j('#materialize_button p').text(game.msg.abilities.noPlasma);
							this.materializeButton.changeState(ButtonStateEnum.disabled);
						}
						// Otherwise, let's have it show a random creature on click
						else {
							$j('#materialize_button p').text(game.msg.ui.dash.selectUnit);
							// Bind button for random unit selection
							this.materializeButton.click = () => {
								this.lastViewedCreature = this.showRandomCreature();
							};
							// Apply the changes
							$j('#card .sideA').on('click', this.materializeButton.click);
							$j('#card .sideA').removeClass('disabled');
							this.materializeButton.changeState(ButtonStateEnum.glowing);
						}
					} else if (
						activeCreature.abilities[3].used &&
						game.activeCreature.isDarkPriest() &&
						player == game.activeCreature.player.id &&
						(clickMethod === 'emptyHex' || clickMethod === 'portrait' || clickMethod === 'grid')
					) {
						if (summonedOrDead) {
							$j('#materialize_button').hide();
						} else if (clickMethod === 'portrait' && creatureType !== '--') {
							$j('#materialize_button').hide();
						} else {
							$j('#materialize_button p').text(game.msg.ui.dash.materializeUsed);
							$j('#materialize_button').show();
						}
					} else {
						$j('#materialize_button').hide();
					}
				}
			} else {
				// Card A
				$j('#card .sideA').css({
					'background-image': `url('${getUrl('cards/margin')}'), url('${getCardArtworkUrl(
						stats.name,
					)}')`,
				});
				$j('#card .sideA .section.info')
					.removeClass('sin- sinA sinE sinG sinL sinP sinS sinW')
					.addClass('sin' + stats.type.substring(0, 1));
				addCardCharacterInfo();

				// Card B
				$j.each(stats.stats, (key, value) => {
					const $stat = $j('#card .sideB .' + key + ' .value');
					$stat.removeClass('buff debuff');
					$stat.text(value);
				});

				// Abilities
				$j.each(stats.ability_info, (key) => {
					const $ability = $j('#card .sideB .abilities .ability:eq(' + key + ')');
					$ability.children('.icon').css({
						'background-image': `url('${getUrl('units/abilities/' + stats.name + ' ' + key)}')`,
					});
					$ability.removeClass('upgraded');
					$ability
						.children('.wrapper')
						.children('.info')
						.children('h3')
						.text(stats.ability_info[key].title);
					$ability
						.children('.wrapper')
						.children('.info')
						.children('#desc')
						.html(stats.ability_info[key].desc);
					$ability
						.children('.wrapper')
						.children('.info')
						.children('#info')
						.html(stats.ability_info[key].info);
					// Check for an upgrade
					if (stats.ability_info[key].upgrade) {
						$ability
							.children('.wrapper')
							.children('.info')
							.children('#upgrade')
							.text('Upgrade: ' + stats.ability_info[key].upgrade);
					} else {
						$ability.children('.wrapper').children('.info').children('#upgrade').text(' ');
					}

					if (stats.ability_info[key].costs !== undefined && key !== 0) {
						$ability
							.children('.wrapper')
							.children('.info')
							.children('#cost')
							.text(' - costs ' + stats.ability_info[key].costs.energy + ' energy pts.');
					} else {
						$ability
							.children('.wrapper')
							.children('.info')
							.children('#cost')
							.text(' - this ability is passive.');
					}
				});

				// Materialize button
				this.materializeButton.changeState(ButtonStateEnum.disabled);
				$j('#materialize_button p').text(game.msg.ui.dash.heavyDev);
				$j('#materialize_button').show();
				$j('#card .sideA').addClass('disabled').off('click');
			}
		};

		if (isSwitchingCreature) {
			this.flipCard(cardAssetUrls, updateCardContent);
		} else {
			updateCardContent();
		}
	}

	/**
	 * Fake a full card flip with one container: rotate to the edge, swap content,
	 * reset invisibly to the opposite edge, and rotate back to the front.
	 *
	 * @param assetUrls - Images needed by the incoming card face.
	 * @param onMidpoint - Callback invoked when the card is at 90 degrees (edge at screen).
	 */
	flipCard(assetUrls: string[], onMidpoint: () => void) {
		const $cards = $j('#card .sideA, #card .sideB');
		assetUrls.forEach((url) => {
			if (!this.cardAssetCache.has(url)) {
				const image = new Image();
				image.src = url;
				this.cardAssetCache.set(url, image);
			}
		});

		if (this.cardFlipTimeoutId !== null) {
			clearTimeout(this.cardFlipTimeoutId);
		}

		this.game.soundsys.playSFX('sounds/flip');
		$cards.removeClass('flipping flip-reset').addClass('flipping');

		// At 90 degrees, swap content and reset to -90 degrees without a transition.
		this.cardFlipTimeoutId = setTimeout(() => {
			onMidpoint();
			$cards.removeClass('flipping').addClass('flip-reset');
			$cards.each((_, card) => void (card as HTMLElement).offsetWidth);
			window.requestAnimationFrame(() => {
				$cards.removeClass('flip-reset');
			});
			this.cardFlipTimeoutId = null;
		}, this.dashAnimSpeed / 2);
	}

	/**
	 * Selects a random available unit and shows its card on the dash.
	 *
	 * Calls showCreature(chosenRandomUnit, activePlayerID, '') to handle opening the dash.
	 *
	 * Called by toggleDash with the randomize option and by clicking the materialize button
	 * when it reads "Please select..."
	 *
	 * @returns ID of the random creature selected.
	 */
	showRandomCreature() {
		const game = this.game;
		// Figure out what the active player can summon
		const activePlayer = game.players[this.game.activeCreature.player.id];
		const deadOrSummonedTypes = new Set(activePlayer.creatures.map((creature) => creature.type));
		const summonableTypes = getSummonCandidates(game, activePlayer.availableCreatures, {
			excludeTypes: deadOrSummonedTypes,
		});
		// Skip the unit that was materialized right before, so the random pick
		// encourages some variety instead of copy-catting it.
		const availableTypes = getRandomSummonCandidates(
			game,
			summonableTypes,
			activePlayer.plasma,
			game.lastSummonedType,
		);

		// Randomize array to grab a random creature
		for (let i = availableTypes.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			const temp = availableTypes[i];
			availableTypes[i] = availableTypes[j];
			availableTypes[j] = temp;
		}

		// Grab the first creature we can afford (if none, default to priest)
		let typeToPass = '--';
		availableTypes.some((creature) => {
			const lvl = parseInt(creature.substring(1, 2)) - 0;
			const size = game.retrieveCreatureStats(creature).size - 0;
			const plasmaCost = lvl + size;

			if (plasmaCost <= activePlayer.plasma) {
				typeToPass = creature;
				return true;
			}

			return false;
		});

		// Show the random unit selected
		this.showCreature(typeToPass, game.activeCreature.team, '');

		return typeToPass;
	}

	selectAbility(i: number) {
		if (!this._abilityPanelAnimating) {
			this.checkAbilities();
		}
		this.selectedAbility = i;

		if (i > -1) {
			this.showAbilityCosts(i);
			this.abilitiesButtons[i].changeState(ButtonStateEnum.active);
			this.activeAbility = true;
		} else {
			this.hideAbilityCosts();
			this.activeAbility = false;
			this.game.grid?.refreshHoverState();
		}
	}

	/**
	 * Change to the specified player tab in the dash
	 * @param{number} id - player id (integer)
	 */
	changePlayerTab(id) {
		const game = this.game;

		this.selectedPlayer = id;
		this.$dash // Dash class
			.removeClass('selected0 selected1 selected2 selected3')
			.addClass('selected' + id);

		this.$grid
			.find('.vignette') // Vignettes class
			.removeClass('active dead queued notsummonable materialized unmaterialized')
			.addClass('locked');

		$j('#tabwrapper').show();
		$j('#playertabswrapper').show();

		// Change creature status
		game.players[id].availableCreatures.forEach((creature) => {
			const creatureStats = game.retrieveCreatureStats(creature);
			if (!creatureStats) {
				return;
			}

			if (creatureStats.playable === true) {
				this.$grid.find(".vignette[creature='" + creature + "']").removeClass('locked');
			}

			const lvl = parseInt(creature.substring(1, 2)) - 0,
				size = creatureStats.size - 0,
				plasmaCost = lvl + size;

			if (plasmaCost > game.players[id].plasma) {
				this.$grid.find(".vignette[creature='" + creature + "']").addClass('notsummonable');
			}
		});

		game.players[id].creatures.forEach((creature) => {
			const $crea = this.$grid.find(".vignette[creature='" + creature.type + "']");

			$crea.removeClass('locked notsummonable');
			if (creature.dead === true) {
				$crea.addClass('dead');
			} else {
				$crea.addClass('queued');
			}
		});

		// Bind creature vignette click
		this.$grid
			.find('.vignette')
			.off('click')
			.on('click', (e) => {
				e.preventDefault();
				if (game.freezedInput) {
					return;
				}

				if ($j(e.currentTarget).hasClass('locked')) {
					this.$dash.children('#tooltip').text('Creature locked.');
				}

				const creatureType = $j(e.currentTarget).attr('creature'); // CreatureType
				this.lastViewedCreature = creatureType;
				this.showCreature(creatureType, this.selectedPlayer, 'grid');
			});
	}

	toggleMusicPlayer(force?: boolean) {
		// Close-then-reopen within one synchronous flow (e.g. toggleDash()
		// closing audio before opening) must not leave a stale deferred
		// disable from closeDash() to yank pointer-events off the new open:
		// invalidate it whenever audio opens.
		if (force === false && $j('#musicplayerwrapper').hasClass('hide')) {
			return;
		}
		const $musicPlayerWrapper = $j('#musicplayerwrapper');
		const shouldOpen = force ?? $musicPlayerWrapper.hasClass('hide');

		if (shouldOpen) {
			this.dashFadeToken = null;
			this.closeDash();
			this.closeScoreboard();
			$musicPlayerWrapper.removeClass('hide');
			this.musicPlayerOpenCollectiveBanner.onViewOpen();
			return;
		}

		$musicPlayerWrapper.addClass('hide');
		this.musicPlayerOpenCollectiveBanner.onViewClose();
	}

	toggleView(view: InterfaceView) {
		if (this.isViewOpen(view)) {
			this.closeView(view);
			return;
		}
		(Object.keys(interfaceViewSignals) as InterfaceView[]).forEach((candidate) => {
			if (candidate !== view) {
				this.closeView(candidate);
			}
		});
		this.game.channels.ui.emit(interfaceViewSignals[view]);
	}

	closeOpenInterfaceViews() {
		(Object.keys(interfaceViewSignals) as InterfaceView[]).forEach((view) => this.closeView(view));
	}

	closeView(view: InterfaceView) {
		switch (view) {
			case 'dash':
				this.closeDash();
				break;
			case 'score':
				this.closeScoreboard();
				break;
			case 'audio':
				this.toggleMusicPlayer(false);
				break;
			case 'secret':
				if (this.isViewOpen('secret')) {
					toggleSecretView();
				}
				break;
		}
	}

	isInterfaceViewOpen() {
		return (
			this.chat.isOpen ||
			(Object.keys(interfaceViewSignals) as InterfaceView[]).some((view) => this.isViewOpen(view))
		);
	}

	isViewOpen(view: InterfaceView) {
		switch (view) {
			case 'dash':
				return this.dashopen;
			case 'score':
				return !this.$scoreboard.hasClass('hide');
			case 'audio':
				return !$j('#musicplayerwrapper').hasClass('hide');
			case 'secret':
				return document.getElementById(SECRET_VIEW_ID)?.style.display === 'flex';
		}
	}

	renderScoreboard(gameOver, disconnectReason?: string) {
		const game = this.game;

		// Configure scoreboard data
		if (disconnectReason) {
			this.$scoreboard.find('#scoreboardTitle').text(disconnectReason);
		} else {
			this.$scoreboard.find('#scoreboardTitle').text('Score');
		}
		$j('#winnerMessage').text('');

		// 1 vs 1 has room next to the icons for the score names, so they are shown inline
		this.$scoreboard.toggleClass('score-labels-inline', game.gameMode === 2);

		const date = new Date().valueOf() - game.pauseTime;
		const players = game.players;
		const scores = players.map((pl) => pl.getScore().total);
		const maxScore = Math.max(...scores, 1);
		const playerColors = ['#f55', '#88f', '#fa5', '#5f5'];
		const hasFiniteTimePool = game.timePool > 0;

		const playerHeaderMeta = players.map((player) => {
			const dp = player.creatures.find((c) => c.isDarkPriest && c.isDarkPriest());
			const dpHealthRatio = dp ? Math.max(0, dp.health) / Math.max(1, dp.stats.health) : 0;
			const dpEnergyRatio = dp ? Math.max(0, dp.energy) / Math.max(1, dp.stats.energy) : 0;

			const plasmaRatio =
				game.configData.plasma_amount > 0
					? Math.min(1, player.plasma / game.configData.plasma_amount)
					: 0;

			let poolTimeRatio = 1;
			if (game.timePool > 0) {
				const remaining =
					player.id === game.activeCreature?.player?.id
						? player.totalTimePool - (date - player.startTime.valueOf())
						: player.totalTimePool;
				poolTimeRatio = Math.max(0, Math.min(1, remaining / (game.timePool * 1000)));
			}

			const unitsRatio =
				game.configData.creaLimitNbr > 0
					? Math.max(0, Math.min(1, player.getNbrOfCreatures() / game.configData.creaLimitNbr))
					: 0;

			const scoreRatio = Math.max(0, Math.min(1, player.getScore().total / maxScore));
			const statData = [
				{
					label: 'Plasma',
					emoji: '🌐',
					color: '#c5f',
					ratio: plasmaRatio,
				},
				{
					label: 'Health',
					emoji: emoji.get('heartbeat'),
					color: '#f00',
					ratio: dpHealthRatio,
				},
				{
					label: 'Energy',
					emoji: '💫',
					color: '#ff0',
					ratio: dpEnergyRatio,
				},
				{
					label: 'Time Pool',
					emoji: emoji.get('alarm_clock'),
					color: '#888',
					ratio: poolTimeRatio,
					enabled: hasFiniteTimePool,
				},
				{
					label: 'Units',
					emoji: emoji.get('bat'),
					color: '#5c5',
					ratio: unitsRatio,
				},
				{
					label: 'Score',
					emoji: emoji.get('100'),
					color: '#aaf',
					ratio: scoreRatio,
				},
			].filter((stat) => stat.enabled !== false);

			const barsHtml = statData
				.map(
					(stat) =>
						`<div class="score-header-bar-wrap" title="${stat.label}">` +
						`<span class="score-header-tooltip">${stat.emoji} ${stat.label}</span>` +
						`<div class="score-header-bar-fill" style="height:${Math.round(
							stat.ratio * 100,
						)}%;background:${stat.color}"></div>` +
						`</div>`,
				)
				.join('');

			return {
				playerLabel: `Player${player.id + 1}`,
				color: playerColors[player.id] || '#fff',
				barsHtml,
			};
		});

		const appendWinnerMessage = (winners) => {
			const $winnerMessage = this.$scoreboard.find('#scoreboardTitle').empty();

			winners.forEach((winner, index) => {
				if (index > 0) {
					$winnerMessage.append(' and ');
				}

				$winnerMessage.append($j('<span>').text(winner.name).addClass(winner.color));
			});

			$winnerMessage.append(' won the match!');
		};

		$j('#scoreboard-overview').html('');

		const $table = $j('#scoreboard table tbody');

		// Write table for number players

		// Clear table
		const tableMeta = [
			{
				cls: 'player_name',
				title: '',
			},
			{
				cls: 'firstKill',
				// node-emoji has no shortcode for the drop of blood, so it is inlined.
				emoji: '🩸',
				title: 'Blood',
			},
			{
				cls: 'kill',
				emoji: emoji.get('skull'),
				title: 'Kills',
			},
			{
				cls: 'combo',
				emoji: emoji.get('chains'),
				title: 'Combos',
			},
			{
				cls: 'humiliation',
				emoji: emoji.get('baby'),
				title: 'Humiliation',
			},
			{
				cls: 'annihilation',
				emoji: emoji.get('coffin'),
				title: 'Annihilation',
			},
			{
				cls: 'deny',
				emoji: emoji.get('syringe'),
				title: 'Denies',
			},
			{
				cls: 'pickupDrop',
				emoji: emoji.get('cherries'),
				title: 'Drops',
			},
			{
				cls: 'timebonus',
				emoji: emoji.get('alarm_clock'),
				title: 'Time',
			},
			{
				cls: 'creaturebonus',
				emoji: emoji.get('chicken'),
				title: 'Survivors',
			},
			{
				cls: 'darkpriestbonus',
				title: 'Survivor Dark Priest',
			},
			{
				cls: 'immortal',
				emoji: emoji.get('bat'),
				title: 'Immortal',
			},
			{
				cls: 'upgrade',
				emoji: emoji.get('medal'),
				title: 'Upgrades',
			},
			{
				cls: 'total',
				emoji: emoji.get('100'),
				title: 'Total',
			},
		];

		tableMeta.forEach((row) => {
			let firstCellContent = `${row.title}`;
			if (row.emoji) {
				firstCellContent = `<span class="score-emoji-tooltip-wrap">${row.emoji}<span class="tooltiptext">${row.title}</span></span>`;
			}

			$table.find(`tr.${row.cls}`).empty().html(`<td>
			${firstCellContent}
			</td>`);

			// Add cells for each player
			for (let i = 0; i < game.gameMode; i++) {
				$table.find(`tr.${row.cls}`).append('<td>--</td>');
			}
		});

		// Fill the board
		for (let i = 0; i < game.gameMode; i++) {
			// Each player
			// TimeBonus
			if (game.timePool > 0) {
				const remainingMs =
					game.players[i].id == game.activeCreature.player.id
						? game.players[i].totalTimePool - (date - game.players[i].startTime.valueOf())
						: game.players[i].totalTimePool;
				game.players[i].bonusTimePool = Math.round(Math.max(remainingMs, 0) / 1000);
			}

			//----------Display-----------//
			const colId = game.gameMode > 2 ? i + 2 + ((i % 2) * 2 - 1) * Math.min(1, i % 3) : i + 2;

			$table
				.children('tr.player_name')
				.children('td:nth-child(' + colId + ')')
				.html(
					`<div class="score-player-header">` +
						`<div class="score-player-bars">${playerHeaderMeta[i].barsHtml}</div>` +
						`<div class="score-player-name" style="color:${playerHeaderMeta[i].color}">${playerHeaderMeta[i].playerLabel}</div>` +
						`</div>`,
				);

			// Change score
			$j.each(game.players[i].getScore(), function (index, val) {
				const text = val === 0 && index !== 'total' ? '--' : val;
				$table
					.children('tr.' + index)
					.children('td:nth-child(' + colId + ')') // Weird expression swaps 2nd and 3rd player
					.text(text);
			});
		}

		if (gameOver) {
			// Hide close button on game over screen
			this.$scoreboard.find('.framed-modal__return').hide();

			if (!disconnectReason) {
				// Declare winner
				if (game.gameMode > 2) {
					// 2 vs 2
					const score1 = game.players[0].getScore().total + game.players[2].getScore().total,
						score2 = game.players[1].getScore().total + game.players[3].getScore().total;

					if (score1 > score2) {
						// Left side wins
						appendWinnerMessage([game.players[0], game.players[2]]);
					} else if (score1 < score2) {
						// Right side wins
						appendWinnerMessage([game.players[1], game.players[3]]);
					} else if (score1 == score2) {
						// Draw
						this.$scoreboard.find('#scoreboardTitle').text('Draw!');
					}
				} else {
					// 1 vs 1
					const score1 = game.players[0].getScore().total,
						score2 = game.players[1].getScore().total;

					if (score1 > score2) {
						// Left side wins
						appendWinnerMessage([game.players[0]]);
					} else if (score1 < score2) {
						// Right side wins
						appendWinnerMessage([game.players[1]]);
					} else if (score1 == score2) {
						// Draw
						this.$scoreboard.find('#scoreboardTitle').text('Draw!');
					}
				}
			}
		} else {
			// Clear winner message when showing current score
			$j('#winnerMessage').text('');

			// Show close button for current score view
			this.$scoreboard.find('.framed-modal__return').show();
		}
	}

	private getScoreboardConfirmButton(action: ScoreboardConfirmAction): Button {
		return action === 'restart' ? this.btnRestartMatch : this.btnExit;
	}

	/**
	 * Two-step gate for the scoreboard's destructive actions (restart, exit).
	 * Returns true only on the second activation, when the caller may proceed.
	 */
	confirmScoreboardAction(action: ScoreboardConfirmAction): boolean {
		if (this.scoreboardConfirmAction === action) {
			this.disarmScoreboardConfirm(action);
			return true;
		}

		// Arming a new action cancels the previous one: only one button is ever red.
		this.disarmScoreboardConfirm();
		this.scoreboardConfirmAction = action;
		this.getScoreboardConfirmButton(action).$button.addClass('confirm');
		this.scoreboardConfirmTimer = setTimeout(() => {
			this.disarmScoreboardConfirm();
		}, SCOREBOARD_CONFIRM_TIMEOUT_MS);

		return false;
	}

	/**
	 * Un-arm a destructive scoreboard button. Without an argument every armed
	 * button is cancelled, which is what happens when the scoreboard is closed or
	 * a non-destructive action is used.
	 */
	disarmScoreboardConfirm(action?: ScoreboardConfirmAction) {
		if (action !== undefined && action !== this.scoreboardConfirmAction) {
			return;
		}

		if (this.scoreboardConfirmTimer !== null) {
			clearTimeout(this.scoreboardConfirmTimer);
			this.scoreboardConfirmTimer = null;
		}

		if (this.scoreboardConfirmAction === null) {
			return;
		}

		this.getScoreboardConfirmButton(this.scoreboardConfirmAction).$button.removeClass('confirm');
		this.scoreboardConfirmAction = null;
	}

	toggleScoreboard(gameOver, disconnectReason?: string) {
		// If the scoreboard is already displayed, hide it and return
		if (!this.$scoreboard.hasClass('hide')) {
			this.closeScoreboard();
			return;
		}

		this.dashFadeToken = null;
		this.closeDash();
		this.toggleMusicPlayer(false);

		this.disarmScoreboardConfirm();
		this.scoreboardGameOver = gameOver;
		this.btnSaveLog.changeState(ButtonStateEnum.normal);
		this.btnRestartMatch.changeState(ButtonStateEnum.normal);
		this.btnExit.changeState(ButtonStateEnum.normal);

		this.renderScoreboard(gameOver, disconnectReason);

		this.$scoreboard.removeClass('hide');
		this.scoreboardOpenCollectiveBanner.onViewOpen();
	}

	refreshScoreboard() {
		if (this.$scoreboard.hasClass('hide')) {
			return;
		}

		const game = this.game;
		const $table = $j('#scoreboard table tbody');

		if ($table.children('tr.player_name').children('td').length <= 1) {
			this.renderScoreboard(this.scoreboardGameOver, game.disconnectReason);
			return;
		}

		const date = new Date().valueOf() - game.pauseTime;
		const scores = game.players.map((pl) => pl.getScore().total);
		const maxScore = Math.max(...scores, 1);
		const hasFiniteTimePool = game.timePool > 0;

		for (let i = 0; i < game.gameMode; i++) {
			if (game.timePool > 0) {
				const remainingMs =
					game.players[i].id == game.activeCreature.player.id
						? game.players[i].totalTimePool - (date - game.players[i].startTime.valueOf())
						: game.players[i].totalTimePool;
				game.players[i].bonusTimePool = Math.round(Math.max(remainingMs, 0) / 1000);
			}

			const player = game.players[i];
			const dp = player.creatures.find((c) => c.isDarkPriest && c.isDarkPriest());
			const dpHealthRatio = dp ? Math.max(0, dp.health) / Math.max(1, dp.stats.health) : 0;
			const dpEnergyRatio = dp ? Math.max(0, dp.energy) / Math.max(1, dp.stats.energy) : 0;

			const plasmaRatio =
				game.configData.plasma_amount > 0
					? Math.min(1, player.plasma / game.configData.plasma_amount)
					: 0;

			let poolTimeRatio = 1;
			if (game.timePool > 0) {
				const remaining =
					player.id === game.activeCreature?.player?.id
						? player.totalTimePool - (date - player.startTime.valueOf())
						: player.totalTimePool;
				poolTimeRatio = Math.max(0, Math.min(1, remaining / (game.timePool * 1000)));
			}

			const unitsRatio =
				game.configData.creaLimitNbr > 0
					? Math.max(0, Math.min(1, player.getNbrOfCreatures() / game.configData.creaLimitNbr))
					: 0;

			const scoreRatio = Math.max(0, Math.min(1, player.getScore().total / maxScore));
			const statRatios = [
				dpHealthRatio,
				dpEnergyRatio,
				plasmaRatio,
				poolTimeRatio,
				unitsRatio,
				scoreRatio,
			].filter((_ratio, idx) => hasFiniteTimePool || idx !== 3);

			const colId = game.gameMode > 2 ? i + 2 + ((i % 2) * 2 - 1) * Math.min(1, i % 3) : i + 2;
			const $playerHeaderCell = $table
				.children('tr.player_name')
				.children('td:nth-child(' + colId + ')');
			const $fills = $playerHeaderCell.find('.score-header-bar-fill');

			if ($fills.length !== statRatios.length) {
				this.renderScoreboard(this.scoreboardGameOver, game.disconnectReason);
				return;
			}

			statRatios.forEach((ratio, index) => {
				$fills.eq(index).css('height', Math.round(ratio * 100) + '%');
			});

			$j.each(player.getScore(), function (index, val) {
				const text = val === 0 && index !== 'total' ? '--' : val;
				$table
					.children('tr.' + index)
					.children('td:nth-child(' + colId + ')')
					.text(text);
			});
		}
	}

	closeScoreboard() {
		this.scoreboardOpenCollectiveBanner.onViewClose();
		if (this.$scoreboard.hasClass('hide')) {
			return;
		}
		this.scoreboardGameOver = false;
		this.disarmScoreboardConfirm();
		this.btnSaveLog.changeState(ButtonStateEnum.hidden);
		this.btnRestartMatch.changeState(ButtonStateEnum.hidden);
		this.btnExit.changeState(ButtonStateEnum.hidden);
		this.$scoreboard.addClass('hide');
	}

	/**
	 * Show the dash and hide some buttons
	 * @param{boolean} [randomize] - True selects a random creature from the grid.
	 */
	toggleDash(randomize) {
		const game = this.game;

		if (this.$dash.hasClass('active')) {
			this.clickedAbility = -1;
			this.closeDash();
			return;
		}

		this.closeScoreboard();
		this.toggleMusicPlayer(false);

		game.channels.ui.emit('onOpenDash');
		if (randomize && !this.lastViewedCreature) {
			this.showRandomCreature();
		} else if (!randomize) {
			this.showCreature('--', game.activeCreature.team, '');
		} else if (this.lastViewedCreature) {
			const lastViewedCreatureStats = game.retrieveCreatureStats(this.lastViewedCreature);
			if (lastViewedCreatureStats?.playable === true) {
				this.showCreature(this.lastViewedCreature, game.activeCreature.team, '');
			} else {
				this.lastViewedCreature = '';
				this.showRandomCreature();
			}
		} else {
			this.showCreature(game.activeCreature.type, game.activeCreature.team, '');
		}
	}

	closeDash() {
		const game = this.game;
		if (this.cardFlipTimeoutId !== null) {
			clearTimeout(this.cardFlipTimeoutId);
			this.cardFlipTimeoutId = null;
		}
		$j('#card .sideA, #card .sideB').removeClass('flipping flip-reset');
		this.dashOpenCollectiveBanner.onViewClose();

		game.channels.ui.emit('onCloseDash');

		const isArcade = window.innerWidth <= 600 && window.innerHeight <= 700;
		// Token for this close's deferred pointer-events changes: a re-open
		// before they fire must cancel them, or the dash opens unclickable.
		const fadeToken = Symbol('dashFade');
		this.dashFadeToken = fadeToken;

		if (isArcade) {
			// Keep the dash visible (display:flex) during the fade-out so the
			// transition actually animates; remove .active / hide only after.
			// While the dash is fading out it still intercepts pointer events
			// (it sits at the same z-index as the music player/scoreboard below),
			// so right-clicks meant to close those views were landing on the
			// dash instead and reopening it. Disable pointer-events during the
			// fade so clicks fall through to the view underneath.
			this.$dash.css('pointer-events', 'none');
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(this.$dash as any).transition(
				{
					opacity: 0,
					queue: false,
				},
				this.dashAnimSpeed,
				'linear',
				() => {
					this.$dash.removeClass('active');
					if (!this.dashopen) {
						this.$dash.hide();
					} else if (this.dashFadeToken !== fadeToken) {
						// Re-opened while fading: this close is stale, restore
						// hit-testing so the new open receives clicks.
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						(this.$dash as any).css('pointer-events', '');
					}
				},
			);
		} else {
			this.$dash.removeClass('active');
			// Defer pointer-events: none until after the current event cycle (mouseup, contextmenu)
			// so those events still hit the dash element and are stopped by its handlers,
			// rather than passing through to the Phaser canvas underneath.
			setTimeout(() => {
				if (this.dashFadeToken !== fadeToken) {
					return;
				}
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(this.$dash as any).css('pointer-events', 'none');
			}, 0);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(this.$dash as any).transition(
				{
					opacity: 0,
					queue: false,
				},
				this.dashAnimSpeed,
				'linear',
				() => {
					if (!this.dashopen) {
						this.$dash.hide();
						// Re-enable pointer-events after fade-out so the dash can be interacted with when reopened
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						(this.$dash as any).css('pointer-events', '');
					} else if (this.dashFadeToken !== fadeToken) {
						// Re-opened while fading: stale close, restore hit-testing.
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						(this.$dash as any).css('pointer-events', '');
					}
				},
			);
		}

		if (this.materializeToggled && game.activeCreature && game.activeCreature.type === '--') {
			game.activeCreature.queryMove();
		}

		this.dashopen = false;
		this.materializeToggled = false;
	}

	gridSelectUp() {
		// 🔁 Updated: Use showCreature(...) to ensure both UI panel and grid highlight stay in sync

		const game = this.game;
		const creatureType = this.selectedCreature;

		if (creatureType === '--') {
			this.showCreature('W1', this.selectedPlayer);
			return;
		}

		const currentRealmIndex = game.realms.indexOf(creatureType[0]);
		const newRealm = game.realms[currentRealmIndex - 1];

		if (newRealm && newRealm !== '-') {
			const nextCreature = newRealm + creatureType[1];
			this.showCreature(nextCreature, this.selectedPlayer);
		}
	}

	gridSelectDown() {
		// 🔁 Updated: Use showCreature(...) to ensure both UI panel and grid highlight stay in sync

		const game = this.game;
		const creatureType = this.selectedCreature;

		if (creatureType === '--') {
			this.showCreature('A1', this.selectedPlayer);
			return;
		}

		const currentRealmIndex = game.realms.indexOf(creatureType[0]);
		const newRealm = game.realms[currentRealmIndex + 1];

		if (newRealm) {
			const nextCreature = newRealm + creatureType[1];
			this.showCreature(nextCreature, this.selectedPlayer);
		}
	}

	gridSelectLeft() {
		// 🔁 Updated: Use showCreature(...) to ensure both UI panel and grid highlight stay in sync

		const creatureType = this.selectedCreature === '--' ? 'A0' : this.selectedCreature;

		const col = parseInt(creatureType[1]);
		if (col - 1 < 1) return;

		const nextCreature = creatureType[0] + (col - 1);
		this.showCreature(nextCreature, this.selectedPlayer);
	}

	gridSelectRight() {
		// 🔁 Updated: Use showCreature(...) to ensure both UI panel and grid highlight stay in sync

		const creatureType = this.selectedCreature === '--' ? 'A8' : this.selectedCreature;

		const col = parseInt(creatureType[1]);
		if (col + 1 > 7) return;

		const nextCreature = creatureType[0] + (col + 1);
		this.showCreature(nextCreature, this.selectedPlayer);
	}

	gridSelectNext() {
		const game = this.game;
		const isDarkPriest = this.selectedCreature === '--';
		const creatureType = isDarkPriest ? 'A0' : this.selectedCreature;
		const candidateTypes = new Set(
			getSummonCandidates(game, game.players[this.selectedPlayer].availableCreatures, {
				excludeTypes: game.players[this.selectedPlayer].creatures.map((creature) => creature.type),
			}),
		);
		const creatures = game.players[this.selectedPlayer].creatures;
		let realmIndex = game.realms.indexOf(creatureType[0]);
		let column = parseInt(creatureType[1]) + 1;

		while (realmIndex < game.realms.length) {
			if (column > 7) {
				realmIndex++;
				column = 1;
				continue;
			}

			const nextCreature = (game.realms[realmIndex] + column) as CreatureType;
			column++;

			if (
				candidateTypes.has(nextCreature) &&
				!creatures.some(
					(creature) =>
						creature instanceof Creature && creature.type === nextCreature && creature.dead,
				)
			) {
				this.lastViewedCreature = nextCreature;
				this.showCreature(nextCreature, this.selectedPlayer);
				return;
			}
		}
	}

	gridSelectPrevious() {
		const game = this.game;
		const creatureType = this.selectedCreature == '--' ? 'W8' : this.selectedCreature;
		const candidateTypes = new Set(
			getSummonCandidates(game, game.players[this.selectedPlayer].availableCreatures, {
				excludeTypes: game.players[this.selectedPlayer].creatures.map((creature) => creature.type),
			}),
		);
		const creatures = game.players[this.selectedPlayer].creatures;
		let realmIndex = game.realms.indexOf(creatureType[0]);
		let column = parseInt(creatureType[1]) - 1;

		while (realmIndex >= 0) {
			if (column < 1) {
				realmIndex--;
				column = 7;
				continue;
			}

			const previousCreature = (game.realms[realmIndex] + column) as CreatureType;
			column--;

			if (
				candidateTypes.has(previousCreature) &&
				!creatures.some(
					(creature) =>
						creature instanceof Creature && creature.type === previousCreature && creature.dead,
				)
			) {
				this.lastViewedCreature = previousCreature;
				this.showCreature(previousCreature, this.selectedPlayer);
				return;
			}
		}
	}
	animateNoTargetAbilityRanges() {
		const creature = this.game.activeCreature;
		if (!creature) return;
		creature.abilities.forEach((ab) => {
			if (ab.message === this.game.msg.abilities.noTarget && ab._abilityRangeHexes?.length) {
				const cx = creature.x;
				const cy = creature.y;
				const sorted = ab._abilityRangeHexes.slice().sort((a, b) => {
					const da = Math.hypot(a.x - cx, a.y - cy);
					const db = Math.hypot(b.x - cx, b.y - cy);
					return da - db;
				});
				sorted.forEach((hex, idx) => {
					if (!hex.displayClasses.includes('abilityRange')) {
						hex.displayVisualState('abilityRange');
					}
					this.game.gameEngine.removeTweensFrom(hex.display.scale);
					hex.display.setScale(0.5, 0.5);
					hex.display.setOrigin(0.5, 0.5);
					this.game.gameEngine
						.tween(hex.display.scale)
						.to({ x: 1.0, y: 1.0 }, 180, Easing.Quadratic.Out, true, idx * 20)
						.onComplete.addOnce(() => {
							this.game.gameEngine
								.tween(hex.display.scale)
								.to({ x: 0, y: 0 }, 180, Easing.Quadratic.In, true)
								.onComplete.addOnce(() => {
									hex.display.setOrigin(0, 0);
									hex.cleanDisplayVisualState('abilityRange');
								});
						});
				});
			}
		});
	}

	/**
	 * Show cancelIcon briefly on any button element during bot turns.
	 * Used for skip/delay buttons and ability hotkey feedback.
	 */
	/**
	 * @param $btn {JQuery<HTMLElement>}
	 */
	showCancelIconOnButton($btn: JQuery<HTMLElement>) {
		$btn.removeClass('cancelIcon');
		void $btn[0].offsetWidth; // force reflow
		$btn.addClass('cancelIcon');
		setTimeout(() => $btn.removeClass('cancelIcon'), 1000);
	}

	/**
	 * True when activating ability `i` is impossible right now, whatever the
	 * reason: an unmet requirement (energy, plasma, endurance, stats, movement,
	 * targets) or an ability that is already spent.
	 *
	 * checkAbilities() paints those buttons `disabled`, and a disabled button
	 * drops the click before the ability ever sees it, so without this the icon
	 * would give no feedback at all. Mirrors checkAbilities() so every refusal
	 * flashes the icon instead of only "already used" and "no targets".
	 *
	 * @param i {number} Ability slot, 0 being the passive slot.
	 */
	isAbilityBlocked(i: number): boolean {
		const game = this.game;
		const ab = game.activeCreature?.abilities[i];
		if (!ab) {
			return false;
		}
		if (ab.used) {
			return true;
		}

		// The passive slot has no player-activated requirements: its require() is a
		// trigger gate, not something the player can satisfy, and checkAbilities()
		// always writes a message on it. `passiveCycle` means other abilities are
		// usable, so only `passiveUnavailable` counts as a refusal.
		if (i === 0) {
			return ab.message === game.msg.abilities.passiveUnavailable;
		}

		return !ab.require();
	}

	flashAbilityBtn(i: number) {
		if (!this.isAbilityBlocked(i)) {
			return;
		}
		const $btn = this.abilitiesButtons[i].$button;

		// During bot turns, skip the blink animation and just show cancelIcon briefly
		if (this.game.botController?.isBotTurn()) {
			$btn.removeClass('cancelIcon');
			void $btn[0].offsetWidth;
			$btn.addClass('cancelIcon');
			setTimeout(() => $btn.removeClass('cancelIcon'), 1000);
			return;
		}

		$btn.removeClass('iconInvertFlash');
		void $btn[0].offsetWidth;
		$btn.addClass('iconInvertFlash');
		$btn[0].addEventListener('animationend', () => $btn.removeClass('iconInvertFlash'), {
			once: true,
		});
	}

	/**
	 * Change ability buttons and bind events
	 */
	changeAbilityButtons() {
		const game = this.game,
			creature = game.activeCreature;
		this.abilitiesButtons.forEach((btn) => {
			const ab = creature.abilities[btn.abilityId];
			const iconUrl = `url('${getUrl('units/abilities/' + creature.name + ' ' + btn.abilityId)}')`;
			btn.css.normal = { 'background-image': iconUrl };
			(btn.$button[0] as HTMLElement).style.setProperty('--icon-url', iconUrl);
			const $desc = btn.$button.next('.desc');
			$desc.find('span.title').text(ab.title);
			$desc.find('p.description').html(ab.desc);
			$desc.find('p.full-info').html(ab.info);
			btn.$button.removeClass('bounce');
			btn.changeState(); // Apply changes
		});
	}
	/* updateActiveBox()
	 *
	 * Update activebox with new current creature's abilities
	 */
	banner(message: string) {
		const $bannerBox = $j('#banner');
		$bannerBox.text(message);
	}

	updateActivebox() {
		const game = this.game,
			creature = game.activeCreature,
			$abilitiesButtons = $j('#abilities .ability');

		const localPlayer = game.lobby?.getLocalPlayer();
		this.active = !game.multiplayer || !game.lobby || !localPlayer || game.lobby.isMyTurn();

		// Set/reset cursor based on turn state
		if (!this.active) {
			// Opponent's turn in multiplayer or bot turn
			$j('canvas').css('cursor', 'wait');
			$j('body').css('cursor', 'wait');
		} else if (!game.botController?.isBotTurn()) {
			// Player's turn (not bot)
			$j('canvas').css('cursor', '');
			$j('body').css('cursor', '');
		}

		$abilitiesButtons.off('click');

		const $abilities = this.$activebox.find('#abilities');
		const $panel = $j('#leftpanel');

		// Reset any in-progress animation state
		$abilities
			.clearQueue()
			.css({ transform: '', '-webkit-transform': '' })
			.removeClass('panel-folding panel-stacked');

		// Helper: update panel data then play the unfold animation.
		// Must be called with panel-stacked already active so all data/state changes
		// happen while slot transitions are disabled — no visual flash before the unfold.
		const applyDataAndUnfold = () => {
			$abilities.removeClass('p0 p1 p2 p3').addClass('p' + creature.player.id);

			// A cost flash from the outgoing turn must not survive the swap.
			this.clearAbilityCostFlash();
			this.energyBar.setSize(creature.oldEnergy / creature.stats.energy);
			this.healthBar.setSize(creature.oldHealth / creature.stats.health);

			this.btnSkipTurn.changeState(ButtonStateEnum.normal);
			this.btnFullscreen.changeState(ButtonStateEnum.normal);

			// Snap all elements to the overlapping stacked position (disables slot transitions).
			// Must happen before data updates so no transitioned property can fire mid-change.
			$abilities.addClass('panel-stacked');
			// Make panel visible (no panel-level transition — individual slots animate)
			$panel.removeClass('offscreen');

			// Update ability button images and states while transitions are disabled,
			// so the correct styling is already in place before the unfold animation starts.
			this.changeAbilityButtons();
			this.updateAbilityUpgrades();
			this.checkAbilities();

			// Force reflow to commit stacked positions + all state changes as the animation start point
			void $abilities[0].offsetHeight;
			// Remove stacked class: per-slot CSS transitions animate each element to its place
			$abilities.removeClass('panel-stacked');

			// After the slowest slot transition completes (250ms unfold), trigger side-panel button slide-ins
			setTimeout(() => {
				this._abilityPanelAnimating = false;
				this.btnSkipTurn.changeState(ButtonStateEnum.slideIn);
				this.btnFullscreen.changeState(ButtonStateEnum.slideIn);
				if (creature.canWait && game.queue.getCurrentQueueLength() > 1) {
					this.btnDelay.changeState(ButtonStateEnum.slideIn);
				}
				// Show skip/delay/abilities as not-allowed during bot turns
				const isBotTurn = game.botController.isBotTurn();
				$j('#rightpanel').toggleClass('bot-turn', isBotTurn);
				$j('#abilities').toggleClass('bot-turn', isBotTurn);

				// Show not-allowed cursor during opponent's turn in multiplayer
				const isOpponentTurn = game.multiplayer && !game.lobby?.isMyTurn();
				$j('#rightpanel').toggleClass('opponent-turn', isOpponentTurn);
				$j('#abilities').toggleClass('opponent-turn', isOpponentTurn);

				// Update hex cursors based on current turn
				if (game.grid) {
					game.grid.forEachHex((hex) => {
						if (isOpponentTurn) {
							setHandCursor(hex.hitBox, false);
						} else if (hex.reachable) {
							setHandCursor(hex.hitBox, true);
						}
					});
				}
			}, 300);
		};

		if ($panel.hasClass('offscreen')) {
			// First show: no fold needed, go straight to unfold
			applyDataAndUnfold();
		} else {
			// Turn transition: fold slots down to a stack, then swap data and unfold.
			// Atomically switch panel-folding → panel-stacked so there is never a gap
			// where active transitions would spring slots back to their default positions.
			$abilities.addClass('panel-folding');
			setTimeout(() => {
				$abilities.removeClass('panel-folding').addClass('panel-stacked');
				applyDataAndUnfold();
			}, 520); // slightly past the longest fold transition (500ms)
		}

		if (game.multiplayer) {
			if (!this.active) {
				game.freezedInput = true;
			} else {
				game.freezedInput = false;
			}
		}
	}
	cycleAudioMode() {
		cycleSoundAudioMode(this.game.soundsys, this);
	}
	updateAudioIcon(mode) {
		let iconKey = 'icons/audio';
		const modeLabel = mode === 'full' ? 'Full' : mode === 'sfx' ? 'SFX' : 'Off';
		const tooltipText = modeLabel;

		if (mode === 'sfx') {
			iconKey = 'icons/SFX';
		} else if (mode === 'muted') {
			iconKey = 'icons/muted';
		}

		const iconUrl = getUrl(iconKey);
		const $audioImg = $j('#audio img');
		if ($audioImg.length) {
			$audioImg.attr('src', iconUrl);
		}

		const $tooltip = $j('#audio-tooltip');
		if ($tooltip.length) {
			$tooltip.text(tooltipText);
		}

		const $audioMode = $j('#audio-mode');
		if ($audioMode.length) {
			$audioMode.text(tooltipText);
		}
	}
	updateAbilityUpgrades() {
		const game = this.game,
			creature = game.activeCreature;

		// The ability that just upgraded belongs to a creature whose turn may
		// already be over — when its Dark Priest died mid-animation, endGame()
		// clears activeCreature before this deferred callback lands. Nothing to
		// update against a dead board.
		if (!creature) {
			return;
		}

		// Change ability buttons
		this.abilitiesButtons.forEach((btn) => {
			const ab = creature.abilities[btn.abilityId];
			const $desc = btn.$button.next('.desc');

			// Play the ability upgrade animation and sound when it gets upgraded
			if (
				!ab.upgraded &&
				ab.usesLeftBeforeUpgrade() === 0 &&
				(ab.used || !ab.isUpgradedPerUse()) &&
				game.configData.abilityUpgrades != 0
			) {
				// Add the class for the background image and fade transition
				btn.$button.addClass('upgradeTransition');
				btn.$button.addClass('upgradeIcon');

				btn.changeState(ButtonStateEnum.slideIn); // Keep the button in view

				// After .3s play the upgrade sound
				setTimeout(() => {
					game.soundsys.playSFX('sounds/upgrade');
				}, 300);

				// After 2s remove the background and update the button if it's not a passive
				setTimeout(() => {
					btn.$button.removeClass('upgradeIcon');
				}, 1200);

				// Then remove the animation
				this.animationUpgradeTimeOutID = setTimeout(() => {
					btn.$button.removeClass('upgradeTransition');
					if (ab.isUpgradedPerUse()) {
						btn.changeState(ButtonStateEnum.disabled);
					}
				}, 1500);

				ab.setUpgraded(); // Set the ability to upgraded
			}

			// Change the ability's frame when it gets upgraded
			if (ab.isUpgraded()) {
				btn.$button.addClass('upgraded');
			} else {
				btn.$button.removeClass('upgraded');
			}

			// Add extra ability info
			const $abilityInfo = $desc.find('.abilityinfo_content');
			$abilityInfo.find('.info').remove();

			const costsString = ab.getFormattedCosts();
			if (costsString) {
				$abilityInfo.append('<div class="info costs">Costs : ' + costsString + '</div>');
			}

			const dmgString = ab.getFormattedDamages();
			if (dmgString) {
				$abilityInfo.append('<div class="info damages">Damages : ' + dmgString + '</div>');
			}

			const specialString = ab.getFormattedEffects();
			if (specialString) {
				$abilityInfo.append('<div class="info special">Effects : ' + specialString + '</div>');
			}

			if (ab.hasUpgrade()) {
				if (!ab.isUpgraded()) {
					$abilityInfo.append(
						'<div class="info upgrade">' +
							(ab.isUpgradedPerUse() ? 'Uses' : 'Rounds') +
							' left before upgrading : ' +
							ab.usesLeftBeforeUpgrade() +
							'</div>',
					);
				}

				$abilityInfo.append('<div class="info upgrade">Upgrade : ' + ab.upgrade + '</div>');
			}
		});
	}

	checkAbilities() {
		const game = this.game;
		let oneUsableAbility = false;
		for (let i = 0; i < 4; i++) {
			const ab = game.activeCreature.abilities[i];
			ab.message = '';
			const req = ab.require();
			const noAffordableApertureTargetInRange = Boolean(
				(ab as ApertureAbilityState)._noAffordableApertureTargetInRange,
			);
			ab.message = ab.used ? game.msg.abilities.alreadyUsed : ab.message;

			// Tooltip for passive ability to display if there is any usable abilities or not
			if (i === 0) {
				for (let j = 0 + 1; j < 4; j++) {
					if (
						game.activeCreature.abilities[j].require() &&
						!game.activeCreature.abilities[j].used
					) {
						ab.message = game.msg.abilities.passiveCycle; // Message if there is any usable abilities
						break;
					} else {
						ab.message = game.msg.abilities.passiveUnavailable; // Message if there is no usable abilities
					}
				}
			}
			if (ab.message == game.msg.abilities.passiveCycle) {
				this.abilitiesButtons[i].changeState(ButtonStateEnum.slideIn);
			} else if (req && !ab.used && ab.trigger == 'onQuery') {
				this.abilitiesButtons[i].changeState(ButtonStateEnum.slideIn);
				oneUsableAbility = true;
			} else if (
				noAffordableApertureTargetInRange ||
				ab.message == game.msg.abilities.noTarget ||
				(ab.trigger != 'onQuery' && req && !ab.used)
			) {
				this.abilitiesButtons[i].changeState(ButtonStateEnum.noClick);
			} else {
				this.abilitiesButtons[i].changeState(ButtonStateEnum.disabled);
			}

			// Charge
			this.abilitiesButtons[i].$button.next('.desc').find('.charge').remove();
			// is this even in use
			//if (ab.getCharge !== undefined) {
			//	this.abilitiesButtons[i].$button
			//		.next('.desc')
			//		.append(
			//			'<div class="charge">Charge : ' +
			//				ab.getCharge().value +
			//				'/' +
			//				ab.getCharge().max +
			//				'</div>',
			//		);
			//}

			// Message
			this.abilitiesButtons[i].$button.next('.desc').find('.message').remove();
			if (ab.message !== '') {
				this.abilitiesButtons[i].$button
					.next('.desc')
					.append('<div class="message">' + ab.message + '</div>');
			}
		}

		// No action possible
		if (!oneUsableAbility && game.activeCreature.remainingMove === 0) {
			//game.skipTurn( { tooltip: "Finished" } ); // Autoskip
			game.activeCreature.noActionPossible = true;
			this.btnSkipTurn.changeState(ButtonStateEnum.slideIn);
		} else {
			// Actions are available; clear any stale noActionPossible state that may
			// have been set by a premature checkAbilities() call before an ability's
			// movement animation had completed (e.g. Molten Hurl moving Infernal into
			// range of a target that Pulverizing Hit can now reach).
			game.activeCreature.noActionPossible = false;
		}
	}

	updateTimer() {
		const game = this.game,
			date = new Date().valueOf() - game.pauseTime;
		const playerStartTime = game.activeCreature.player.startTime.valueOf();
		// TurnTimePool
		if (game.turnTimePool >= 0) {
			this.timeBar.$bar.removeClass('plasma-mode').addClass('turntime-mode');
			this.infiniteTurnBarInitialized = false;
			let remainingTime = game.turnTimePool - Math.round((date - playerStartTime) / 1000);

			if (game.timePool > 0) {
				remainingTime = Math.min(
					remainingTime,
					Math.round((game.activeCreature.player.totalTimePool - (date - playerStartTime)) / 1000),
				);
			}

			const id = game.activeCreature.player.id;
			const $turnTime = $j('.p' + id + ' .turntime');
			$turnTime.text(time.getTimer(remainingTime));

			if (this.lastTurnWarningPlayerId !== id) {
				this.lastTurnWarningPlayerId = id;
				this.lastTurnWarningSecond = null;
			}
			// Time Alert
			if (remainingTime < 6) {
				$turnTime.addClass('alert');
			} else {
				$turnTime.removeClass('alert');
			}

			const isUrgentWarning = remainingTime > 0 && remainingTime <= 3;
			if (isUrgentWarning) {
				$turnTime.addClass('turntime-warning');
				if (this.hoveringNoActionCreature) {
					this.btnSkipTurn.$button.removeClass('bounce');
					this.btnSkipTurn.$button.removeClass('hidden');
				} else {
					this.btnSkipTurn.$button.removeClass('hidden');
					this.btnSkipTurn.$button.addClass('bounce');
				}

				if (this.lastTurnWarningSecond !== remainingTime) {
					this.lastTurnWarningSecond = remainingTime;
					game.soundsys.playSFX('sounds/tick');
				}
			} else {
				$turnTime.removeClass('turntime-warning');
				this.btnSkipTurn.$button.removeClass('bounce');
				this.btnSkipTurn.$button.removeClass('hidden');
				this.lastTurnWarningSecond = null;
			}

			// Time Bar
			const timeRatio = (date - playerStartTime) / 1000 / game.turnTimePool;
			this.timeBar.animSize(1 - timeRatio);
			this.timeBar.setColor('white');
		} else {
			this.timeBar.$bar.removeClass('turntime-mode').addClass('plasma-mode');
			$j('.turntime').text('∞');
			$j('.turntime').removeClass('alert turntime-warning');
			this.btnSkipTurn.$button.removeClass('bounce');
			this.btnSkipTurn.$button.removeClass('hidden');
			this.lastTurnWarningSecond = null;
			this.lastTurnWarningPlayerId = null;

			// Display plasma bar instead when turn time is infinite
			const plasmaRatio =
				game.configData.plasma_amount > 0
					? Math.min(1, game.activeCreature.player.plasma / game.configData.plasma_amount)
					: 0;
			this.timeBar.setColor('#c5f');
			if (!this.infiniteTurnBarInitialized || plasmaRatio <= 0) {
				this.timeBar.setSize(plasmaRatio);
			} else {
				this.timeBar.animSize(plasmaRatio);
			}
			this.infiniteTurnBarInitialized = true;
		}

		// TotalTimePool
		if (game.timePool >= 0) {
			this.infinitePoolBarInitialized = false;
			game.players.forEach((player) => {
				let remainingTime =
					player.id == game.activeCreature.player.id
						? player.totalTimePool - (date - player.startTime.valueOf())
						: player.totalTimePool;
				remainingTime = Math.max(Math.round(remainingTime / 1000), 0);
				$j('.p' + player.id + ' .timepool').text(time.getTimer(remainingTime));
			});

			// Time Bar
			const poolRatio =
				(game.activeCreature.player.totalTimePool - (date - playerStartTime)) /
				1000 /
				game.timePool;
			this.poolBar.animSize(poolRatio);
			this.poolBar.setColor('grey');
		} else {
			$j('.timepool').text('∞');

			// Display score bar instead when pool time is infinite
			const scores = game.players.map((pl) => pl.getScore().total);
			const maxScore = Math.max(...scores, 1);
			const scoreRatio = Math.max(
				0,
				Math.min(1, game.activeCreature.player.getScore().total / maxScore),
			);
			this.poolBar.setColor('#aaf');
			if (!this.infinitePoolBarInitialized) {
				this.poolBar.setSize(scoreRatio);
			} else {
				this.poolBar.animSize(scoreRatio);
			}
			this.infinitePoolBarInitialized = true;
		}

		// Keep scoreboard values and bars in sync while it is open.
		this.refreshScoreboard();
	}

	/**
	 * Delete and add element to the Queue container based on the game's queues
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	updateQueueDisplay(_excludeActiveCreature?: any) {
		const game = this.game;
		this.queue.setQueue(game.queue, game.turn);
	}

	xrayQueue(creaID) {
		this.queue.xray(creaID);
	}

	bouncexrayQueue(creaID) {
		this.queue.xray(creaID);
		this.queue.bounce(creaID);
	}

	updateFatigue() {
		this.queue.refresh();
	}

	endGame(reason?: string) {
		this.toggleScoreboard(true, reason);
		this.btnFlee?.changeState(ButtonStateEnum.hidden);
		this.btnSaveLog.changeState(ButtonStateEnum.normal);
		this.btnRestartMatch.changeState(ButtonStateEnum.normal);
		this.btnExit.changeState(ButtonStateEnum.normal);
	}

	showGameSetup() {
		this.toggleScoreboard(false);
		this.updateQueueDisplay();
		$j('#matchMaking').show();
		$j('#gameSetupContainer').show();
		$j('#loader').addClass('hide');
		$j('body').removeClass('in-game');
		this.queue.empty(Queue.IMMEDIATE);
	}

	/**
	 * Make the user confirm attempts to navigate away (refresh, back button, close
	 * tab, etc) to prevent accidentally ending the game.
	 */
	confirmWindowUnload() {
		this.ignoreNextConfirmUnload = false;
		getActiveConfirmUnloadState = () => this;
		window.onbeforeunload = confirmUnload;

		if (!hasManualRefreshConfirmListener) {
			// Dedupe across module copies (tests re-import this module, and HMR
			// can replace it): a stale capture handler would swallow every
			// refresh shortcut with stopImmediatePropagation and open a prompt
			// bound to a UI instance that is no longer active.
			const previousListener = (window as unknown as Record<string, unknown>)[
				MANUAL_REFRESH_LISTENER_KEY
			] as ((event: KeyboardEvent) => void) | undefined;
			if (previousListener) {
				window.removeEventListener('keydown', previousListener, true);
			}
			(window as unknown as Record<string, unknown>)[MANUAL_REFRESH_LISTENER_KEY] =
				confirmManualRefresh;
			window.addEventListener('keydown', confirmManualRefresh, true);
			hasManualRefreshConfirmListener = true;
		}
	}

	makeCreatureGrid(rasterElement) {
		const getLink = (type) => {
			const stats = this.game.retrieveCreatureStats(type);
			const snakeCaseName = stats.name.replace(' ', '_');
			const set = getAvatarSet(type);
			return `<a href="#${snakeCaseName}" class="vignette realm${stats.realm} type${type}" data-set="${set}" creature="${type}">
						<div class="tooltip">
							<div class="content">${stats.name}</div>
						</div>
						<div class="overlay"></div>
						<div class="border"></div>
					</a>`;
		};

		// Remove any previously generated grid to avoid duplicating the avatar
		// grid when a new UI is created (e.g. after a match restart/reconnect).
		const existingRaster = rasterElement.querySelector('#creatureraster');
		if (existingRaster) {
			existingRaster.remove();
		}

		const tmpElement = document.createElement('div');
		const rasterWrapper = document.createElement('div');
		rasterWrapper.setAttribute('id', 'creatureraster');
		rasterElement.appendChild(rasterWrapper);

		for (const realm of 'AEGLPSW'.split('')) {
			for (const i of '1234567'.split('')) {
				const type = realm + i;
				tmpElement.innerHTML = getLink(type);
				rasterWrapper.appendChild(tmpElement.firstChild);
			}
		}

		return rasterElement;
	}

	static #getQuickInfo(ui, quickInfoDomElement) {
		const quickInfo = new QuickInfo(quickInfoDomElement);

		const getCreatureDisplayName = (creatureOrName: { name?: string } | string) => {
			const rawName =
				typeof creatureOrName === 'string' ? creatureOrName : creatureOrName?.name ?? '';
			const withoutPrefix = rawName.replace(/^object[_-]/i, '');
			const spaced = withoutPrefix.replace(/[_-]+/g, ' ').trim();
			if (!spaced) {
				return '';
			}

			return spaced.charAt(0).toUpperCase() + spaced.slice(1);
		};

		const creatureFormatter = (creature) => {
			const name = getCreatureDisplayName(creature);
			const trapOrLocation = capitalize(
				creature?.hexagons[0]?.trap ? creature?.hexagons[0]?.trap?.name : ui.game.combatLocation,
			);
			const nameColorClasses =
				creature && creature.player ? `p${creature.player.id} player-text bright` : '';

			return `<div class="vignette hex">
			<div class="hexinfo frame">
			<p class="name ${nameColorClasses}">${name}</p>
			<p>${trapOrLocation}</p>
			</div>
			</div>
			`;
		};

		const playerFormatter = (player) => {
			const playerTimeStatus =
				ui.game.turnTimePool < 0 && ui.game.timePool < 0
					? `<p>Ancient Beast</p>`
					: '<p><span class="activePlayer turntime">&#8734;</span> / <span class="timepool">&#8734;</span></p>';

			return `<div class="vignette active p${player.id}">
				<div class="playerinfo frame p${player.id}">
				<p class="name">${player.name}</p>
				<p class="points"><span>${player.getScore().total}</span> Points</p>
				<p class="plasma"><span>${player.plasma}</span> Plasma</p>
				<p class="units"><span>${player.getNbrOfCreatures() + ' / ' + ui.game.creaLimitNbr}</span> Units</p>
				${playerTimeStatus}
			</div></div>`;
		};

		const hexFormatter = (hex) => {
			const name = hex.creature
				? getCreatureDisplayName(hex.creature)
				: capitalize(hex.drop ? hex.drop.name : hex.coord);
			const trapOrLocation = capitalize(hex.trap ? hex.trap.name : ui.game.combatLocation);
			const nameColorClasses =
				hex.creature && hex.creature.player ? `p${hex.creature.player.id} player-text bright` : '';
			return `<div class="vignette hex">
			<div class="hexinfo frame">
			<p class="name ${nameColorClasses}">${name}</p>
			<p>${trapOrLocation}</p>
			</div>
			</div>
			`;
		};

		const gameFormatter = () => {
			const devvit = getDevvitAppVersion();
			const devvitLine = devvit ? `<p>r${devvit}</p>` : '';
			return `<div class="vignette hex">
	<div class="hexinfo frame">
	<p class="name">Ancient Beast</p>
		<p>${version}</p>
		${devvitLine}
		</div>
		</div>
		`;
		};

		/**
		 * NOTE: Throttling here because we want to
		 * skip a hex 'mouse out' if there's a
		 * 'mouse enter' soon after. We don't want a
		 * transition between 2 different hexes that
		 * have the same contents.
		 */
		const throttledSet = throttle(
			(str) => {
				quickInfo.set(str);
			},
			50,
			{ leading: false },
		);

		const showCurrentPlayer = () => {
			const activePlayer = ui.game.activePlayer;
			if (!activePlayer) {
				showGameInfo();
				return;
			}

			throttledSet(playerFormatter(activePlayer));
		};

		const showHex = (hex) => {
			throttledSet(hexFormatter(hex));
		};

		const showCreature = (creature) => {
			throttledSet(creatureFormatter(creature));
		};

		const showGameInfo = () => {
			throttledSet(gameFormatter());
		};

		const showDefault = () => {
			showCurrentPlayer();
		};

		const showQuickInfoForActiveCreature = () => {
			showDefault();
			if (window.innerWidth <= 600 && window.innerHeight <= 700 && ui.game.activeCreature) {
				ui.chat.showExpanded(ui.game.activeCreature);
			}
		};
		ui.game.channels.creature.on('abilityend', showQuickInfoForActiveCreature);
		ui.game.channels.creature.on('activate', showQuickInfoForActiveCreature);

		for (const message of [
			'toggleMusicPlayer',
			'toggleDash',
			'toggleScore',
			'toggleMetaPowers',
			'closeInterfaceScreens',
			'vignettecreaturemouseleave',
			'vignetteturnendmouseleave',
		] as const) {
			ui.game.channels.ui.on(message, showDefault);
		}
		ui.game.channels.ui.on('vignettecreaturemouseenter', ({ creature }) => showCreature(creature));
		ui.game.channels.ui.on('vignetteturnendmouseenter', showGameInfo);

		// `hex` carries both directions: `over` shows the hovered hex when it has
		// something worth describing, `out` always falls back to the player card.
		ui.game.channels.hex.on('over', ({ hex }) => {
			if (hex.creature || hex.drop || hex.trap) {
				showHex(hex);
			} else {
				showDefault();
			}
		});
		ui.game.channels.hex.on('out', showDefault);

		return quickInfo;
	}

	static #getQueue(ui, queueDomElement) {
		/**
		 * NOTE:
		 * Sets up event handlers for the Queue.
		 * Creates Queue.
		 * Attaches events to the Queue.
		 * Returns Queue.
		 */
		const ifGameNotFrozen = utils.ifGameNotFrozen(ui.game);

		const onCreatureClick = ifGameNotFrozen((creature) => {
			/**
			 * NOTE:
			 * If showing the active player's Dark Priest, open the dash using
			 * another method which restores any previously selected creature
			 * for materialization.
			 */
			if (creature.isDarkPriest() && creature.id === ui.game.activeCreature.id) {
				ui.toggleDash();
			} else {
				ui.showCreature(creature.type, creature.player.id, 'portrait');
			}
		});

		const onCreatureMouseEnter = ifGameNotFrozen((placeholderCreature) => {
			const creatures = ui.game.creatures.filter((c) => c instanceof Creature);
			const creature = creatures.filter((c) => c.id === placeholderCreature.id)[0];
			if (!creature || !Array.isArray(creature.hexagons) || creature.hexagons.length === 0) {
				return;
			}
			ui.game.grid.clearAllXray();
			const otherCreatures = creatures.filter((c) => c.id !== placeholderCreature.id);

			otherCreatures.forEach((c) => {
				if (c === ui.game.activeCreature) {
					c.xray(false);
					return;
				}

				c.xray(true, creature);
				c.hexagons.forEach((hex) => {
					hex.cleanOverlayVisualState();
				});
			});
			creature.hexagons.forEach((hex) => {
				hex.overlayVisualState('hover h_player' + creature.team);
			});

			ui.chat.showExpanded(creature);
			ui.game.grid.showMovementRange(creature);
			ui.queue.xray(creature.id);
		});

		const onCreatureMouseLeave = () => {
			// The mouse over adds a coloured hex to the creature, so when we mouse leave we have to remove them
			const creatures = ui.game.creatures.filter((c) => c instanceof Creature);
			creatures.forEach((creature) => {
				if (creature === ui.game.activeCreature) {
					return;
				}
				creature.hexagons.forEach((hex) => {
					hex.cleanOverlayVisualState();
				});
			});

			if (window.innerWidth <= 600 && window.innerHeight <= 700 && ui.game.activeCreature) {
				ui.chat.showExpanded(ui.game.activeCreature);
			} else {
				ui.chat.hideExpanded();
			}

			// Clear any dashed/shrunken movement visualization added on hover.
			// Do this BEFORE restoring query state so we don't wipe freshly restored
			// visuals (which can leave stale outlines on startup).
			ui.game.grid.allhexes.forEach((hex) => {
				hex.unsetReachable();
				hex.cleanDisplayVisualState('dashed shrunken');
			});

			if (ui.game.grid.lastQueryOpt) {
				ui.game.grid.redoLastQuery();
			} else {
				ui.game.grid.updateDisplay();
			}
		};

		const onTurnEndClick = throttle(() => {
			ui.game.soundsys.playSFX('sounds/AncientBeast');
		}, 2000);

		const onTurnEndMouseEnter = ifGameNotFrozen(() => {
			ui.setBrandLogoVisible(false);
			ui.game.grid.showGrid(true);
			ui.game.grid.showCurrentCreatureMovementInOverlay(ui.game.activeCreature);
		});

		const onTurnEndMouseLeave = () => {
			ui.setBrandLogoVisible(false);
			ui.game.grid.showGrid(false);
			ui.game.grid.allhexes.forEach((hex) => {
				hex.cleanOverlayVisualState();
			});
			ui.game.grid.redoLastQuery();
		};

		// Hide the project logo when navigating away using a hotkey
		document.addEventListener('visibilitychange', function () {
			if (document.hidden) {
				ui.setBrandLogoVisible(false);
			}
		});

		// Hide the project logo when navigating away using a hotkey (Ctrl+Shift+M)
		document.addEventListener('keydown', (event) => {
			if (event.ctrlKey && event.shiftKey && event.key === 'M') {
				ui.setBrandLogoVisible(false);
			}
		});

		const SIGNAL_CREATURE_CLICK = 'vignettecreatureclick';
		const SIGNAL_CREATURE_MOUSE_ENTER = 'vignettecreaturemouseenter';
		const SIGNAL_CREATURE_MOUSE_LEAVE = 'vignettecreaturemouseleave';
		const SIGNAL_DELAY_CLICK = 'vignettedelayclick';
		const SIGNAL_DELAY_MOUSE_ENTER = 'vignettedelaymouseenter';
		const SIGNAL_DELAY_MOUSE_LEAVE = 'vignettedelaymouseleave';
		const SIGNAL_TURN_END_CLICK = 'vignetteturnendlick';
		const SIGNAL_TURN_END_MOUSE_ENTER = 'vignetteturnendmouseenter';
		const SIGNAL_TURN_END_MOUSE_LEAVE = 'vignetteturnendmouseleave';

		// One subscription per vignette message the queue drives, rather than a
		// single handler switching on the message name.
		ui.game.channels.ui.on(SIGNAL_CREATURE_CLICK, ({ creature }) => onCreatureClick(creature));
		ui.game.channels.ui.on(SIGNAL_CREATURE_MOUSE_ENTER, ({ creature }) =>
			onCreatureMouseEnter(creature),
		);
		ui.game.channels.ui.on(SIGNAL_CREATURE_MOUSE_LEAVE, () => onCreatureMouseLeave());
		ui.game.channels.ui.on(SIGNAL_TURN_END_CLICK, () => onTurnEndClick());
		ui.game.channels.ui.on(SIGNAL_TURN_END_MOUSE_ENTER, ({ turnNumber }) =>
			onTurnEndMouseEnter(turnNumber),
		);
		ui.game.channels.ui.on(SIGNAL_TURN_END_MOUSE_LEAVE, () => onTurnEndMouseLeave());

		const queueEventHandlers = {
			onCreatureClick: (creature) => ui.game.channels.ui.emit(SIGNAL_CREATURE_CLICK, { creature }),
			onCreatureMouseEnter: (creature) =>
				ui.game.channels.ui.emit(SIGNAL_CREATURE_MOUSE_ENTER, { creature }),
			onCreatureMouseLeave: () => ui.game.channels.ui.emit(SIGNAL_CREATURE_MOUSE_LEAVE, {}),
			onDelayClick: () => ui.game.channels.ui.emit(SIGNAL_DELAY_CLICK, {}),
			onDelayMouseEnter: () => ui.game.channels.ui.emit(SIGNAL_DELAY_MOUSE_ENTER, {}),
			onDelayMouseLeave: () => ui.game.channels.ui.emit(SIGNAL_DELAY_MOUSE_LEAVE, {}),
			onTurnEndClick: (turnNumber: number) =>
				ui.game.channels.ui.emit(SIGNAL_TURN_END_CLICK, { turnNumber }),
			onTurnEndMarkerMouseDown: () => {
				ui.toggleView('secret');
			},
			onTurnEndMouseEnter: (turnNumber: number) =>
				ui.game.channels.ui.emit(SIGNAL_TURN_END_MOUSE_ENTER, { turnNumber }),
			onTurnEndMouseLeave: () => ui.game.channels.ui.emit(SIGNAL_TURN_END_MOUSE_LEAVE, {}),
		};

		return new Queue(queueDomElement, queueEventHandlers);
	}
}

const utils = {
	ifGameNotFrozen: (game) => {
		// NOTE: Higher order function
		// Filters out function calls made when the game is frozen.
		return (fn) => {
			return (...args) => {
				if (game.freezedInput) {
					return;
				} else {
					return fn(...args);
				}
			};
		};
	},
};
