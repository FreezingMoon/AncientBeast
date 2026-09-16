import $j from 'jquery';
import { Animations } from './animations';
import { CreatureQueue } from './creature_queue';
import { GameLog } from './utility/gamelog';
import { SoundSys, SoundSysAudioBufferSourceNode } from './sound/soundsys';
import { Hex } from './utility/hex';
import { HexGrid } from './utility/hexgrid';
import { getUrl, use as assetsUse, soundPaths } from './assets';
import { Player, PlayerColor, PlayerID, getDarkPriestAvatarUrl } from './player';
import { UI } from './ui/interface';
import { Creature, CreatureHintType } from './creature';
import { refreshPlasmaRenderScales } from './plasma-field';
import { unitData } from './data/units';
import 'pixi';
import 'p2';
import 'p2';
// @ts-expect-error: Phaser CE has no official type declarations
import Phaser, { Signal } from 'phaser';
import { LobbyClient } from './multiplayer';
import { createLobbyProvider } from './multiplayer/provider';
import type {
	GameConfig as MultiplayerGameConfig,
	GameMessage,
	LobbySession,
	LobbyState,
} from './multiplayer';
import type { AuthoritativeState, Intent } from './multiplayer/authoritative';
import type { AbilityTarget } from './multiplayer/types';
import { getVisibilityAwareDelay } from './utility/time';
import { DEBUG_DISABLE_GAME_STATUS_CONSOLE_LOG, DEBUG_DISABLE_MUSIC } from './debug';
import { Point, configure as configurePointFacade } from './utility/pointfacade';
import { pretty as version } from './utility/version';
import { Ability } from './ability';
import { Effect } from './effect';
import { GameConfig } from './script';
import { Trap } from './utility/trap';
import { Drop } from './drop';
import { CreatureType, Realm, UnitData } from './data/types';
import { setAudioMode } from './sound/soundsys';
import BotController from './bot';
import { locationPaths } from '../assets/index';

/* eslint-disable prefer-rest-params */

/* NOTES/TODOS
 *
 * to fix @ts-expect-error
 * 2339: convert match.js -> match.ts
 * 2307: cannot find module
 *
 * refactor the trigger functions to get rid of the `prefer-rest-params` linter errors
 */

/* Game Class
 *
 * Game contains all Game elements and functions.
 * It's the root element and defined only one time through the G variable.
 *
 * NOTE: Constructor does nothing because the G object must be defined
 * before creating other class instances. The game setup is triggered
 * to really start the game.
 */

type AnimationID = number;

const webKitGtkUserAgent = /(X11|Linux).*AppleWebKit\/.*Version\/.*Safari\//i;

function shouldUseCanvasRenderer() {
	return webKitGtkUserAgent.test(navigator.userAgent);
}

export type MetaPowersState = {
	executeMonster: boolean;
	resetCooldowns: boolean;
	disableMaterializationSickness: boolean;
	infiniteEnergy: boolean;
};

export default class Game {
	/* Attributes
	 *
	 * NOTE : attributes and variables starting with $ are jQuery elements
	 * and jQuery functions can be called directly from them.
	 *
	 * // jQuery attributes
	 * $combatFrame :   Combat element containing all graphics except the UI
	 *
	 * // Game elements
	 * players :            Array : Contains Player objects ordered by player ID (0 to 3)
	 * creatures :          Array : Contains Creature objects (creatures[creature.id]) start at index 1
	 * traps :              Array : Contains Trap objects
	 *
	 * grid :               Grid :  Grid object
	 * UI :             UI :    UI object
	 *
	 * queue :              CreatureQueue : queue of creatures to manage phase order
	 *
	 * turn :               Integer :   Current's turn number
	 *
	 * // Normal attributes
	 * gameMode :     Integer :   Number of players in the game
	 * activeCreature : Creature :  Current active creature object reference
	 * creatureData :       Array :     Array containing all data for the creatures
	 *
	 */
	abilities: Array<Partial<Ability>[]>;
	players: Player[];
	creatures: Creature[];
	traps: Trap[];
	drops: Drop[];
	effects: Effect[];
	activeCreature: Creature | undefined;
	matchid: string;
	playersReady: boolean;
	preventSetup: boolean;
	animations: Animations;
	queue: CreatureQueue;
	creatureData: typeof unitData | [];
	pause: boolean;
	gameState: 'initialized' | 'loading' | 'loaded' | 'playing' | 'ended';
	pauseTime: number;
	unitDrops: number;
	minimumTurnBeforeFleeing: number;
	availableCreatures: CreatureType[];
	lastSummonedType: CreatureType | null;
	animationQueue: (Animation | AnimationID)[];
	checkTimeFrequency: number;
	gamelog: GameLog;
	configData: Partial<GameConfig>;
	match: object;
	multiplayer: boolean;
	/**
	 * Server-authoritative mode toggle. When true, the client sends `Intent`s
	 * to the server-authoritative processor and applies them via `applyIntent`
	 * when received (no optimistic local application). When false, the client
	 * uses relay `action-*` messages and relies on the transport to drop its
	 * own echoed messages. The Devvit backend currently uses relay, so we
	 * default to false to avoid applying each action twice (once locally,
	 * again when the intent echo arrives).
	 */
	authority: boolean;
	lobby: LobbyClient | null;
	lobbyCode: string;
	lobbyState: LobbyState | null;
	onLobbyUpdate: ((lobby: LobbyState) => void) | null;
	botOpponentIds: Set<number>;
	realms: Realm[];
	availableMusic = [];
	inputMethod = 'Mouse';
	firstKill: boolean;
	freezedInput: boolean;
	isReplayInProgress: boolean;
	turnThrottle: boolean;
	turn: number;
	metaPowersState: MetaPowersState;
	/** Counts abilities that called end(false,true) but haven't yet invoked queryMove(). */
	_deferredQueryMovePending: number;
	Phaser: Phaser;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	msg: any; // type this properly
	triggers: Record<string, RegExp>;
	signals: Record<string, Signal>;
	botController: BotController;

	// The optionals below are created by the various methods of `Game`, mainly by `setup` and `loadGame`

	musicPlayer?: { audio: { pause: () => void } };
	soundsys?: SoundSys;
	fullscreenMode?: boolean;
	background_image?: string;

	gameMode?: number;

	UI?: UI;

	trapId?: number;
	effectId?: number;
	dropId?: number;
	grid?: HexGrid;

	startMatchTime?: Date;
	$combatFrame?: JQuery<HTMLElement>; //eslint-disable-line no-undef
	timeInterval?: NodeJS.Timeout; //eslint-disable-line no-undef

	windowResizeTimeout?: string | number | NodeJS.Timeout; //eslint-disable-line no-undef

	pauseStartTime?: Date;

	timePool?: number;
	turnTimePool?: number;

	endGameSound?: SoundSysAudioBufferSourceNode;
	disconnectReason?: string;

	createPhaser() {
		// Always destroy existing Phaser first to prevent duplicate canvas elements
		if (this.Phaser) {
			this.destroyPhaser();
		}
		const renderer = shouldUseCanvasRenderer() ? Phaser.CANVAS : Phaser.AUTO;
		this.Phaser = new Phaser.Game(1920, 1080, renderer, 'combatwrapper', {
			update: this.phaserUpdate.bind(this),
			render: this.phaserRender.bind(this),
			// Browsers fully suspend native requestAnimationFrame (not just throttle it)
			// once a tab is hidden/backgrounded. Phaser's TweenManager (movement/ability
			// animations) and its whole update loop run off that rAF, so a backgrounded
			// client's creature moves/abilities would completely freeze mid-animation —
			// never dispatching movementComplete/activateAbility, never advancing the
			// turn — until the tab regains focus. That is the "moves desync between
			// tabs" symptom seen when testing two clients side-by-side with one
			// unfocused. Forcing Phaser onto a setTimeout-driven loop in multiplayer
			// keeps it ticking (just throttled, like our other multiplayer timers)
			// instead of fully stopping while backgrounded.
			forceSetTimeOut: this.multiplayer,
		});
		// Note: Scale manager configuration happens in setup() after Phaser is ready
	}

	whenPhaserBooted(phaser: Phaser.Game | null, onBooted: (phaser: Phaser.Game) => void) {
		if (!phaser) {
			return;
		}

		if (phaser === this.Phaser && phaser.isBooted && phaser.load) {
			onBooted(phaser);
			return;
		}

		window.setTimeout(() => {
			if (phaser !== this.Phaser) {
				return;
			}

			this.whenPhaserBooted(phaser, onBooted);
		}, 0);
	}

	destroyPhaser() {
		if (this.Phaser) {
			const phaser = this.Phaser;

			// Kill client-side timers tied to the old game/UI BEFORE nulling them,
			// otherwise they keep firing on the torn-down instance and throw
			// "grid is null" (UI glowInterval), "this.UI is null" / "updateTimer"
			// (game checkTime via timeInterval), etc. See destroyPhaser's notes on
			// the dead-Phaser rAF loop below.
			if (this.UI) {
				if (this.UI.glowInterval != null) {
					clearInterval(this.UI.glowInterval);
					this.UI.glowInterval = undefined;
				}
				this.UI = null;
			}
			if (this.timeInterval != null) {
				clearInterval(this.timeInterval);
				this.timeInterval = undefined;
			}
			if (this.windowResizeTimeout != null) {
				clearTimeout(this.windowResizeTimeout);
				this.windowResizeTimeout = undefined;
			}

			// Detach pending async callbacks before destroying.
			// Phaser.Game.destroy() stops the rAF loop but leaves the Cache's
			// `onReady` signal and the Loader's completion signals registered.
			// If createPhaser() is called again before those async callbacks
			// (default/missing texture decodes, asset loads) settle, they fire
			// on the already-destroyed game, calling raf.start() -> Game.update()
			// -> this.time.update() where `this.time` is now null. This throws
			// "can't access property 'update', this.time is null" (phaser-split.js
			// Game.update, line ~14835). Clearing them prevents a dead game from
			// starting its loop or running finishLoading/loadFinish after death.
			if (phaser.cache && phaser.cache.onReady && phaser.cache.onReady.removeAll) {
				phaser.cache.onReady.removeAll();
			}
			if (phaser.load) {
				if (phaser.load.onLoadComplete && phaser.load.onLoadComplete.removeAll) {
					phaser.load.onLoadComplete.removeAll();
				}
				if (phaser.load.onFileComplete && phaser.load.onFileComplete.removeAll) {
					phaser.load.onFileComplete.removeAll();
				}
			}

			// IMPORTANT: Remove the canvas element from the DOM before destroying Phaser
			// Phaser.destroy() does NOT remove the canvas, so we'd end up duplicated canvases
			const canvas = phaser.canvas;
			if (canvas && canvas.parentNode) {
				canvas.parentNode.removeChild(canvas);
			}

			// Destroy Phaser with cleanup to avoid memory leaks
			// Parameters: clearWorld=true (remove game objects), clearCache=false
			// Stop the rAF loop first so a pending frame can't fire Game.update()
			// (this.time is null) on the dying instance after destroy() returns.
			if (phaser.raf && typeof phaser.raf.stop === 'function') {
				phaser.raf.stop();
			}
			phaser.destroy(true, false);
			this.Phaser = null;

			// Reset game state (this.UI is already nulled above when its interval
			// was cleared, kept here for clarity)
			this.grid = null;
			this.UI = null;
			this.gameState = 'initialized';
		}
	}
	isAcceptingInput: () => boolean;
	constructor() {
		this.abilities = [];
		this.players = [];
		this.creatures = [];
		this.traps = [];
		this.drops = [];
		this.effects = [];
		this.activeCreature = undefined;
		this.matchid = null;
		this.playersReady = false;
		this.preventSetup = false;
		this.animations = new Animations(this);
		this.queue = new CreatureQueue(() => this.creatures);
		this.creatureData = [];
		this.pause = false;
		this.gameState = 'initialized';
		this.pauseTime = 0;
		this.unitDrops = 0;
		this.minimumTurnBeforeFleeing = 12;
		this.availableCreatures = [];
		this.lastSummonedType = null;
		this.animationQueue = [];
		this.checkTimeFrequency = 1000;
		this._deferredQueryMovePending = 0;
		this.gamelog = new GameLog(
			(log) => this.onLogSave(log),
			(log) => this.onLogLoad(log),
		);
		this.configData = {};
		this.match = {};
		this.multiplayer = false;
		this.authority = false;
		this.lobby = null;
		this.lobbyCode = '';
		this.lobbyState = null;
		this.onLobbyUpdate = null;
		this.botOpponentIds = new Set<number>();
		this.realms = ['-', 'A', 'E', 'G', 'L', 'P', 'S', 'W'];
		this.availableMusic = [];
		this.inputMethod = 'Mouse';
		this.isAcceptingInput = () => !this.freezedInput;
		// Gameplay properties
		this.firstKill = false;
		this.freezedInput = false;
		this.isReplayInProgress = false;
		this.turnThrottle = false;
		this.turn = 0;
		this.metaPowersState = {
			executeMonster: false,
			resetCooldowns: false,
			disableMaterializationSickness: false,
			infiniteEnergy: false,
		};

		// Phaser is created lazily in loadGame() on the first match start.
		// Creating it here (at app boot) was redundant: it was always destroyed
		// and rebuilt moments later by loadGame(), which also triggered a crash
		// when a stale instance's pending async callbacks fired after destruction.

		// Messages
		// TODO: Move strings to external file in order to be able to support translations
		// https://github.com/FreezingMoon/AncientBeast/issues/923
		this.msg = {
			abilities: {
				noTarget: 'No targets available.',
				noPlasma: 'Not enough plasma.',
				noPsy: 'Psyhelm overload: too many units!',
				alreadyUsed: 'This ability has already been used.',
				tooMuch: 'Too much %stat%.',
				notEnough: 'Not enough %stat%.',
				notMoveable: 'This creature cannot be moved.',
				passiveCycle: 'Switches between any usable abilities.',
				passiveUnavailable: 'No usable abilities to switch to.',
			},
			ui: {
				dash: {
					materializeOverload: 'Overload! Maximum number of units controlled',
					selectUnit: 'Please select an available unit from the left grid',
					wrongPlayer: 'Please select an available unit from own unit grid',
					lowPlasma: 'Low Plasma! Cannot materialize the selected unit',
					// plasmaCost :    String :    plasma cost of the unit to materialize
					materializeUnit: (plasmaCost: string) => {
						return 'Materialize unit at target location for ' + plasmaCost + ' plasma';
					},
					materializeUsed: 'Materialization has already been used this round',
					heavyDev: 'This unit is currently under heavy development',
				},
			},
		};

		/* Regex Test for triggers */
		this.triggers = {
			onStepIn: /\bonStepIn\b/,
			onStepOut: /\bonStepOut\b/,
			onReset: /\bonReset\b/,
			onStartPhase: /\bonStartPhase\b/,
			onEndPhase: /\bonEndPhase\b/,
			onMovement: /\bonMovement\b/,
			onUnderAttack: /\bonUnderAttack\b/,
			onDamage: /\bonDamage\b/,
			onHeal: /\bonHeal\b/,
			onAttack: /\bonAttack\b/,
			onCreatureMove: /\bonCreatureMove\b/,
			onCreatureDeath: /\bonCreatureDeath\b/,
			onCreatureSummon: /\bonCreatureSummon\b/,

			onStepIn_other: /\bonOtherStepIn\b/,
			onStepOut_other: /\bonOtherStepOut\b/,
			onReset_other: /\bonOtherReset\b/,
			onStartPhase_other: /\bonOtherStartPhase\b/,
			onEndPhase_other: /\bonOtherEndPhase\b/,
			onMovement_other: /\bonOtherMovement\b/,
			onAttack_other: /\bonOtherAttack\b/,
			onDamage_other: /\bonOtherDamage\b/,
			onHeal_other: /\bonOtherHeal\b/,
			onUnderAttack_other: /\bonOtherUnderAttack\b/,
			onCreatureMove_other: /\bonOtherCreatureMove\b/,
			onCreatureDeath_other: /\bonOtherCreatureDeath\b/,
			onCreatureSummon_other: /\bonOtherCreatureSummon\b/,

			onEffectAttach: /\bonEffectAttach\b/,
			onEffectAttach_other: /\bonOtherEffectAttach\b/,

			onStartOfRound: /\bonStartOfRound\b/,
			onQuery: /\bonQuery\b/,
			oncePerDamageChain: /\boncePerDamageChain\b/,
		};

		const signalChannels = ['ui', 'metaPowers', 'creature', 'hex'];
		this.signals = this.setupSignalChannels(signalChannels);
		this.botController = new BotController(this);
	}

	loadUnitData(data: UnitData) {
		const dpcolor: PlayerColor[] = ['blue', 'orange', 'green', 'red'];

		this.creatureData = data;

		data.forEach((creature) => {
			if (!creature.playable) {
				return;
			}

			const creatureId = creature.id,
				realm = creature.realm,
				level = creature.level,
				type = (realm.toUpperCase() + level) as CreatureType,
				name = creature.name;

			let count: number, i: number;

			// Create the `creature.type` property
			creature['type'] = type;

			// Load unit shouts
			this.soundsys.loadSound('units/shouts/' + name);

			// Load artwork
			this.getImage(getUrl('units/artwork/' + name));

			if (name == 'Dark Priest') {
				for (i = 0, count = dpcolor.length; i < count; i++) {
					this.getImage(getUrl('units/avatars/' + name + ' player ' + dpcolor[i]));
					this.getImage(getUrl('units/avatars/' + name + ' clone ' + dpcolor[i]));
				}
			} else {
				this.getImage(getUrl('units/avatars/' + name));
			}

			// For code compatibility
			this.availableCreatures[creatureId] = type;
		});

		this.Phaser.load.start();
	}

	/**
	 * @param {Partial<GameConfig>} setupOpt - Setup options from matchmaking menu
	 * Load all required game files
	 */
	loadGame(
		setupOpt: Partial<GameConfig>,
		matchInitialized?: boolean,
		matchid?: string,
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		onLoadCompleteFn = () => {},
	) {
		// Guard against a re-entrant load while one is already initializing (e.g. a
		// match-start echo arriving after the host already began loading, or a stray
		// second match-start delivery). Without this, loadGame() can run twice in the
		// same match, spawning a second Phaser instance whose rAF loop outlives the
		// first and throws "this.time is null", and leaving one client's setup
		// half-initialized. We only block an *in-progress* load ('loading'); a fresh
		// match is always allowed (the previous one is torn down by createPhaser's
		// destroyPhaser), so we never block a legitimate rematch.
		if (this.gameState === 'loading') {
			return;
		}

		// Create a fresh Phaser instance for this game session
		// (createPhaser safely destroys any existing Phaser first to prevent duplicates)
		this.createPhaser();

		// Need to remove keydown listener before new game start
		// to prevent memory leak and mixing hotkeys between start screen and game
		$j(document).off('keydown');

		if (matchid) {
			this.matchid = matchid;
		}

		this.gameState = 'loading';
		this.preventSetup = false;
		if (setupOpt) {
			this.configData = setupOpt;
			const setupData = { ...setupOpt };
			delete setupData.players;
			$j.extend(this, setupData);
		}
		// console.log(this);
		this.startLoading();

		this.soundsys = new SoundSys({ paths: soundPaths });
		this.musicPlayer = this.soundsys.musicPlayer;

		this.whenPhaserBooted(this.Phaser, (phaser) => {
			// Belt-and-suspenders: Phaser sets `isBooted` slightly before the Loader
			// (`load`) is created during boot, so a stale/cached build can call this
			// with `phaser.load` still null and throw "can't access property
			// 'onFileComplete', this.Phaser.load is null". Re-wait rather than crash.
			if (!phaser.load) {
				this.whenPhaserBooted(phaser, () => this.startAssetLoad(phaser, onLoadCompleteFn));
				return;
			}
			this.startAssetLoad(phaser, onLoadCompleteFn);
		});
	}

	/** Wire up loader completion hooks and queue the game's asset downloads. */
	private startAssetLoad(phaser: Phaser.Game, onLoadCompleteFn: () => void): void {
		if (!phaser.load) {
			return;
		}

		phaser.load.onFileComplete.add(this.loadFinish, this);
		phaser.load.onLoadComplete.add(this.finishLoading, this);
		phaser.load.onLoadComplete.add(onLoadCompleteFn, this);

		const assetsRaw = assetsUse(phaser);
		const assets = Array.isArray(assetsRaw) ? assetsRaw : [];

		console.log('[DEBUG] Safe assets list:', assets);

		assets.forEach((_asset) => {
			// safely process each asset here
		});

		// Background
		const backgroundImage =
			this.background_image ||
			this.configData.background_image ||
			this.configData.combatLocation ||
			locationPaths[0];
		phaser.load.image('background', getUrl('locations/' + backgroundImage));

		// Branding
		phaser.load.image('AncientBeastLogo', getUrl('interface/AncientBeast'));

		// Load artwork, shout and avatar for each unit
		this.loadUnitData(unitData);
	}

	hexAt(x: number, y: number): Hex | undefined {
		return this.grid.hexAt(x, y);
	}

	get activePlayer() {
		if (this.multiplayer && this.activeCreature && this.activeCreature.player) {
			return this.activeCreature.player;
		}
		if (this.activeCreature && this.activeCreature.player) {
			return this.activeCreature.player;
		}
		return undefined;
	}

	startLoading() {
		$j('#gameSetupContainer').hide();
		$j('#loader').removeClass('hide');
		$j('body').css('cursor', 'wait');
		if (this.Phaser?.stage) {
			this.Phaser.stage.disableVisibilityChange = true;
		}
	}

	loadFinish() {
		const progress = this.Phaser.load.progress,
			progressWidth = progress + '%';

		$j('#barLoader .progress').css('width', progressWidth);
	}

	finishLoading() {
		this.gameState = 'loaded';
		$j('#combatwrapper').show();
		$j('body').css('cursor', 'default');

		// In multiplayer, always start setup regardless of focus state
		// Headless browsers and tab-switching shouldn't block multiplayer initialization
		if (this.multiplayer || !this.preventSetup) {
			this.preventSetup = false;
			this.setup(this.gameMode);
		}
	}

	phaserUpdate() {
		if (this.gameState != 'playing') {
			return;
		}
	}

	phaserRender() {
		for (let i = 1; i < this.creatures.length; i++) {
			//G.Phaser.debug.renderSpriteBounds(G.creatures[i].sprite);
		}
	}

	// Catch the browser being made inactive to prevent initial rendering bugs.
	onBlur() {
		// Only prevent setup during the loading phase to avoid getting stuck on loading screen
		// when the tab is not focused during asset loading. After loading completes,
		// the preventSetup flag can be used to handle rendering issues on focus.
		if (this.gameState !== 'loading') {
			this.preventSetup = true;
		}
	}

	// Catch the browser coming back into focus so we can render the game board.
	onFocus() {
		this.preventSetup = false;
		// If loaded, call maybeSetup with a tiny delay to prevent rendering issues.
		if (this.gameState == 'loaded') {
			setTimeout(() => {
				this.maybeSetup();
			}, 100);
		}
		// Reapply xray so obstructing units are ghosted without needing cursor movement
		if (this.grid?.lastXrayHex) {
			this.grid.xray(this.grid.lastXrayHex);
		}
	}

	// If no red flags, remove the loading bar and begin rendering the game.
	maybeSetup() {
		if (this.preventSetup) {
			return;
		}

		$j('#loader').addClass('hide');
		$j('body').css('cursor', 'default');
		this.setup(this.gameMode);
	}

	/**
	 * @param {number} gameMode - Ideally 2 or 4, number of players to configure
	 * Launch the game with the given number of player.
	 */
	setup(gameMode: number) {
		// Clear existing Phaser objects if setup() was already called once
		// This prevents duplicate input handlers in multiplayer scenarios
		if (this.grid) {
			this.Phaser.world.removeAll(true);
			this.grid = undefined;
		}

		// Phaser
		this.Phaser.scale.parentIsWindow = window.innerWidth > 600 || window.innerHeight > 700;
		this.Phaser.scale.pageAlignHorizontally = true;
		this.Phaser.scale.pageAlignVertically = window.innerWidth > 600 || window.innerHeight > 700;
		this.Phaser.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
		this.Phaser.scale.fullScreenScaleMode = Phaser.ScaleManager.SHOW_ALL;
		this.Phaser.scale.refresh();

		if (!this.Phaser.device.desktop) {
			this.Phaser.stage.forcePortrait = true;
		}

		const bg = this.Phaser.add.sprite(0, 0, 'background');

		bg.inputEnabled = true;
		bg.events.onInputUp.add((Sprite, Pointer) => {
			if (this.freezedInput || !this.UI || this.UI.dashopen) {
				return;
			}

			switch (Pointer.button) {
				case 0:
					// Left mouse button pressed
					break;
				case 1:
					// Middle mouse button pressed
					break;
				case 2:
					// Right mouse button pressed
					if (this.activeCreature) {
						this.UI.showCreature(this.activeCreature.type, this.activeCreature.player.id);
					}
					break;
			}
		}, this);

		// Reset global counters
		this.trapId = 0;
		this.effectId = 0;
		this.dropId = 0;

		this.grid = new HexGrid({}, this); // Create Hexgrid
		configurePointFacade({
			getCreatures: () => this.creatures.filter(Boolean),
			getCreaturePassablePoints: (_creature) => [],
			getCreatureBlockedPoints: (creature) => {
				if (creature.dead || creature.temp || creature._brbState !== null) {
					return [];
				} else {
					const ps = [];
					for (let i = 0; i < creature.size; i++) {
						ps.push({ x: creature.x - i, y: creature.y });
					}
					return ps;
				}
			},
			getTraps: () => this.traps,
			getTrapPassablePoints: (trap: Trap) => [trap],
			getTrapBlockedPoints: (_trap) => [],
			getDrops: () => this.drops,
			getDropPassablePoints: (drop) => [drop],
			getDropBlockedPoints: (_drop) => [],
		});

		this.startMatchTime = new Date();

		this.$combatFrame = $j('#combatframe');
		this.$combatFrame.show();

		// Remove loading screen
		$j('#matchMaking').hide();
		// Marks the body so the build-version badge in the lower-right corner
		// hides during gameplay (the version is surfaced in the quickInfo
		// tooltip on round-marker hover instead — see gameFormatter in
		// ui/interface.ts).
		$j('body').addClass('in-game');

		this.players = [];
		// Drop any leftover creatures/traps/drops/effects from a previous match.
		// createPhaser() above destroyed their Phaser sprites (clearWorld), so these
		// stale objects would otherwise carry null sprite internals (`this._tweens is
		// null` in resetBounce) into this setup and crash when nextCreature fires the
		// onCloseDash signal that bounces every creature on the board.
		this.creatures = [];
		this.traps = [];
		this.drops = [];
		this.effects = [];
		for (let i = 0; i < gameMode; i++) {
			const player = new Player(i as PlayerID, this);
			this.players.push(player);
			if (this.multiplayer) {
				player.controller = 'human';
			} else {
				player.controller = this.configData.players?.includes(player.id) ? 'human' : 'bot';
			}
			if (this.botOpponentIds.has(player.id)) {
				player.controller = 'bot';
			}
			player.avatar = getDarkPriestAvatarUrl(player);
			// Initialize players' starting positions
			let pos: Point;

			if (gameMode > 2) {
				// If 4 players
				switch (player.id) {
					case 0:
						pos = {
							x: 0,
							y: 1,
						};
						break;
					case 1:
						pos = {
							x: 15,
							y: 1,
						};
						break;
					case 2:
						pos = {
							x: 0,
							y: 7,
						};
						break;
					case 3:
						pos = {
							x: 15,
							y: 7,
						};
						break;
				}
			} else {
				// If 2 players
				switch (player.id) {
					case 0:
						pos = {
							x: 0,
							y: 4,
						};
						break;
					case 1:
						pos = {
							x: 14,
							y: 4,
						};
						break;
				}
			}

			player.summon('--', pos); // Summon Dark Priest
		}

		if (this.players.length && this.players[0].creatures.length) {
			this.activeCreature = this.players[0].creatures[0]; // Prevent errors
		}

		this.UI = new UI(
			{
				isAcceptingInput: this.isAcceptingInput,
			},
			this,
		); // Create UI (not before because some functions require creatures to already exist)

		setAudioMode('full', this.soundsys, this.UI);
		// DO NOT CALL LOG BEFORE UI CREATION
		this.gameState = 'playing';

		this.log(`Welcome to Ancient Beast ${version}`);
		this.log('Setting up a ' + gameMode + ' player match');

		this.timeInterval = setInterval(() => {
			this.checkTime();
		}, this.checkTimeFrequency);

		this.nextCreature();

		this.resizeCombatFrame(); // Resize while the game is starting
		this.UI.resizeDash();

		const resizeGame = () => {
			clearTimeout(this.windowResizeTimeout);
			this.windowResizeTimeout = setTimeout(() => {
				this.resizeCombatFrame();
				this.UI.resizeDash();
			}, 100);
		};

		// Handle resize events
		$j(window).resize(() => {
			// Throttle down to 1 event every 100ms of inactivity
			resizeGame();
			// Refresh Phaser scale to fit the resized window
			if (this.Phaser && this.Phaser.scale) {
				this.Phaser.scale.refresh();
			}
			refreshPlasmaRenderScales();
		});

		this.soundsys.playMusic();
		if (DEBUG_DISABLE_MUSIC) {
			this.musicPlayer.audio.pause();
		}
	}

	async createLobby(config: MultiplayerGameConfig): Promise<LobbySession> {
		if (!this.lobby) {
			this.lobby = new LobbyClient(this, createLobbyProvider());
		}
		const session = await this.lobby.createMatch(config);
		this.lobbyCode = session.code;
		this.lobbyState = this.lobby.getLobbyState();
		return session;
	}

	async joinLobbyByCode(code: string): Promise<LobbySession> {
		if (!this.lobby) {
			this.lobby = new LobbyClient(this, createLobbyProvider());
		}
		const session = await this.lobby.joinMatch(code);
		this.lobbyCode = code;
		this.lobbyState = this.lobby.getLobbyState();
		return session;
	}

	startMultiplayerMatch(configOverride?: Record<string, unknown>): void {
		if (!this.lobby || !this.lobby.isHost()) {
			return;
		}
		const lobbyState = this.lobby.getLobbyState();
		const config = (configOverride ?? lobbyState.config) as GameConfig;
		this.lobby.markMatchStarted();
		this.lobby.sendAction({
			type: 'match-start',
			config,
			players: lobbyState.players,
			host: lobbyState.host,
			hostPeerId: lobbyState.hostPeerId,
		});
		this.multiplayer = true;
		this.loadGame(config as Partial<GameConfig>, true);
	}

	handleLobbyMessage(message: GameMessage): void {
		if (message.type === 'intent') {
			const intent = message.intent;
			switch (intent.kind) {
				case 'skip':
					this.action({ action: 'skip' }, {});
					break;
				case 'delay':
					this.action({ action: 'delay' }, {});
					break;
				case 'move':
					this.action(
						{ action: 'move', target: intent.target, path: intent.path },
						{
							callback: () => {
								this.activeCreature?.queryMove();
							},
						},
					);
					break;
				case 'ability':
					this.action(
						{
							action: 'ability',
							id: intent.id,
							target: intent.target,
							args: intent.args,
						},
						{},
					);
					break;
			}
			return;
		}
		if (message.type === 'match-start') {
			// Idempotency guard: the host calls loadGame() directly in
			// startMultiplayerMatch() and ALSO receives its own echoed
			// match-start over the transport, so this handler can fire twice
			// for the same match. A redundant match-start can also arrive from
			// redelivery while loading is still in flight. If a match is already
			// loading or in progress, ignore the duplicate so we don't destroy
			// and recreate Phaser (which can start a dead game's loop and throw).
			// A brand-new match after a previous one ended (gameState 'ended')
			// is still allowed through.
			if (
				this.gameState === 'loading' ||
				this.gameState === 'loaded' ||
				this.gameState === 'playing'
			) {
				return;
			}
			this.multiplayer = true;
			this.botOpponentIds = new Set(
				(message.players || [])
					.filter((player) => player.isBot)
					.map((player) => player.playerIndex),
			);
			this.loadGame(message.config as Partial<GameConfig>, true);
			return;
		}
		if (message.type === 'match-loaded') {
			return;
		}
		if (message.type === 'sync-snapshot') {
			// Devvit snapshots currently carry only config, not full board state.
			// Reloading an active match here desynchronizes clients (different maps,
			// missing priests, repeated round logs). Only allow bootstrap-time use.
			if (this.gameState === 'initialized' || this.gameState === 'ended') {
				this.multiplayer = true;
				this.loadGame(message.config as Partial<GameConfig>, true);
			}
			return;
		}
		if (message.type === 'turn-update') {
			if (message.turn > this.turn) {
				this.turn = message.turn;
			}
			const creature = this.creatures[message.creatureId];
			if (creature) {
				if (this.activeCreature?.id === creature.id) {
					return;
				}
				this.activeCreature = creature;
				creature.activate();
				this.UI.updateActivebox();
				this.updateQueueDisplay();
			}
			return;
		}
		if (message.type === 'action-end') {
			const creature = this.creatures[message.creatureId];
			if (creature) {
				if (message.action === 'skip') {
					this.activeCreature = creature;
					this.skipTurn(undefined, true);
				} else if (message.action === 'delay') {
					this.activeCreature = creature;
					this.delayCreature(undefined, true);
				}
			}
			return;
		}
		if (message.type === 'action-move') {
			const creature = this.creatures[message.creatureId];
			if (creature) {
				this.activeCreature = creature;
				// Shares applyMoveRecord() with action() (the saved-log replay
				// dispatcher) instead of a second hand-rolled implementation of
				// "apply a move action" — one canonical code path for both, so fixes
				// (like replaying the exact recorded path) can't drift out of sync
				// between live multiplayer relay and file replay.
				this.applyMoveRecord({ target: message.target, path: message.path }, () => {
					creature.queryMove();
				});
			}
			return;
		}
		if (message.type === 'action-ability') {
			const creature = this.creatures[message.creatureId];
			if (creature) {
				this.activeCreature = creature;
				const ability = creature.abilities[message.id];
				if (ability) {
					const args = Array.isArray(message.args) ? [...message.args] : [];
					if (message.target.type === 'hex') {
						const hex = this.grid.hexes[message.target.y][message.target.x];
						args.unshift(hex);
						ability.animation2({ arg: args });
					} else if (message.target.type === 'creature') {
						const targetCreature = this.creatures[message.target.crea];
						if (targetCreature) {
							args.unshift(targetCreature);
							ability.animation2({ arg: args });
						}
					} else if (message.target.type === 'array') {
						const hexArray = message.target.array.map((item) => this.grid.hexes[item.y][item.x]);
						args.unshift(hexArray);
						ability.animation2({ arg: args });
					}
				}
			}
			return;
		}
		if (message.type === 'player-left') {
			console.warn(
				'[Game.handleLobbyMessage] Received player-left:',
				message.player?.playerId,
				'gameState:',
				this.gameState,
				'isPlaying:',
				this.gameState === 'playing',
			);
			if (this.gameState === 'playing') {
				const leavingPlayer = message.player;
				const hostPeerId = this.lobby?.getLobbyState()?.hostPeerId;
				const leavingWasHost = leavingPlayer?.peerId === hostPeerId;
				const reason = leavingWasHost
					? 'Host disconnected. Match ended.'
					: 'Player disconnected. Match ended.';
				this.endGame(reason);
			}
			return;
		}
	}

	sendMultiplayerMove(
		target: { x: number; y: number },
		path?: Array<{ x: number; y: number }>,
	): void {
		if (!this.multiplayer || !this.lobby || !this.activeCreature) {
			return;
		}
		if (this.authority) {
			this.sendIntent({ kind: 'move', target, path } as Intent);
			return;
		}
		this.lobby.sendAction({
			type: 'action-move',
			target,
			path,
			playerId: this.lobby.getLocalPlayer()?.playerId || '',
			creatureId: this.activeCreature.id,
		});
	}

	sendMultiplayerAbility(params: { target: AbilityTarget; id: number; args: unknown[] }): void {
		if (!this.multiplayer || !this.lobby || !this.activeCreature) {
			return;
		}
		// authority mode: emit an `Intent` (input) instead of a relay action
		// message. The acting client does NOT apply locally here — the processor
		// applies it through the engine and broadcasts the resulting
		// authoritative state, which this client adopts (see
		// adoptAuthoritativeState). The relay path below stays as the safeguard
		// when authority is false.
		if (this.authority) {
			this.sendIntent({
				kind: 'ability',
				id: params.id,
				target: params.target,
				args: params.args,
			} as Intent);
			return;
		}
		this.lobby.sendAction({
			type: 'action-ability',
			id: params.id,
			target: params.target,
			args: params.args,
			playerId: this.lobby.getLocalPlayer()?.playerId || '',
			creatureId: this.activeCreature.id,
		});
	}

	/** Send a player input to the authoritative server (transport-agnostic). */
	sendIntent(intent: Intent): void {
		if (!this.lobby) {
			return;
		}
		void this.lobby.sendIntent(intent);
	}

	/**
	 * Adopt an authoritative state snapshot as the single source of truth.
	 * Reconciles creature positions/health/energy/dead/status, the queue order,
	 * the active creature, turn/round, and player scores to match the server.
	 * Used in server-authoritative mode so every client converges on identical
	 * state regardless of its own (now-irrelevant) local simulation.
	 */
	adoptAuthoritativeState(state: AuthoritativeState): void {
		// Best-effort reconciliation against the real `Game`/`Creature` shapes,
		// which are stricter than the serializable snapshot. Cast to `any` so the
		// authoritative state can drive the live game without fighting internal
		// types; the fields we set are the canonical ones `serializeState` reads.
		const g = this as any; // eslint-disable-line @typescript-eslint/no-explicit-any
		for (const snap of state.creatures) {
			const creature = g.creatures[snap.id];
			if (!creature) {
				continue;
			}
			creature.x = snap.x;
			creature.y = snap.y;
			creature.health = snap.health;
			if (creature.stats) {
				creature.stats.health = snap.maxHealth;
				creature.stats.energy = snap.maxEnergy;
			}
			creature.energy = snap.energy;
			creature.dead = snap.dead;
			if ('isVaporized' in creature) creature.isVaporized = snap.vaporized;
			creature.remainingMove = snap.remainingMove;
			if (creature.status) {
				creature.status.frozen = snap.status.frozen;
				creature.status.dizzy = snap.status.dizzy;
				creature.status.cryostasis = snap.status.cryostasis;
			}
			if (snap.dead && !creature.dead && typeof creature.die === 'function') {
				try {
					creature.die(true);
				} catch {
					/* best-effort; state fields already set above */
				}
			}
			const sprite = creature.sprite;
			if (sprite && sprite.position && typeof sprite.position.set === 'function') {
				try {
					sprite.position.set(snap.x, snap.y);
				} catch {
					/* non-fatal */
				}
			}
		}

		g.turn = state.turn;
		g.round = state.round;
		g.gameState = state.gameState;
		g.activeCreature =
			state.activeCreatureId != null ? g.creatures[state.activeCreatureId] : g.activeCreature;

		for (const playerSnap of state.players) {
			const player = g.players[playerSnap.playerIndex];
			const score = player && player.score;
			if (score && typeof score.setTotal === 'function') {
				score.setTotal(playerSnap.score);
			}
		}
	}
	/**
	 * Resize the combat frame
	 */
	resizeCombatFrame() {
		if ($j('#cardwrapper').width() < $j('#card').width()) {
			$j('#cardwrapper_inner').width();
		}
	}

	/**
	 * Replace the current queue with the next queue
	 */
	nextRound(remote?: boolean) {
		this.turn++;
		this.log(`Round ${this.turn}`, 'roundmarker', true);
		this.onStartOfRound();
		this.nextCreature(remote);
	}

	/**
	 * Activate the next creature in queue
	 */
	nextCreature(remote?: boolean) {
		// Captured before any reassignment below so the broadcast gate can tell
		// whose turn is actually ending. This matters when nextCreature() is
		// invoked indirectly (e.g. Creature.die() ending the active creature's
		// turn as a side effect of an ability) rather than via a direct local
		// skipTurn/delayCreature call carrying an explicit `remote` flag. In
		// Devvit mode, opponent actions (moves/abilities) are replayed locally
		// via the same code path that a live action takes, so without this check
		// BOTH clients would end up broadcasting their own 'turn-update' for the
		// same transition, causing races between the two players' turn state.
		const previousActiveCreature = this.activeCreature;

		this.UI.closeDash();
		this.UI.btnToggleDash.changeState('normal');
		this.grid.clearAllXray(); // Clear Xray without re-triggering ghostOverlap

		if (this.gameState == 'ended') {
			return;
		}

		this.stopTimer();
		// Delay (skipped while backgrounded — see getVisibilityAwareDelay)
		setTimeout(() => {
			const interval = setInterval(() => {
				clearInterval(interval);

				let differentPlayer = false;

				if (this.queue.isCurrentEmpty() || this.turn === 0) {
					this.nextRound(remote); // Switch to the next Round
					return;
				} else {
					const next = this.queue.queue[0];
					if (this.activeCreature && this.activeCreature) {
						differentPlayer = this.activeCreature.player != next.player;
					} else {
						differentPlayer = true;
					}

					const last = this.activeCreature;
					this.activeCreature = next; // Set new activeCreature

					if (!last.dead) {
						last.updateHealth(); // Update health display due to active creature change
					}
				}

				// Play heartbeat sound on other player's turn
				if (differentPlayer) {
					this.soundsys.playHeartBeat('sounds/heartbeat');
				}

				this.log('Active Creature : %CreatureName' + this.activeCreature.id + '%');
				// Block ability icon state changes during the turn transition (fold + unfold).
				// activate() resets abilities via setUsed() which would otherwise flash icons.
				this.UI._abilityPanelAnimating = true;
				// The new active creature's queryMove() will replay hover once its handlers
				// are installed; suppress that single replay to avoid a stale cursor preview.
				this.grid.suppressNextHoverRefresh = true;
				this.activeCreature.activate();
				// console.log(this.activeCreature);

				// Show mini tutorial in the first round for each player
				if (this.turn == 1) {
					this.log('The active unit has a bouncing indicator');
					this.log('It uses a plasma field to protect itself');
					this.log('Its portrait is displayed in the lower left');
					this.log("Above the portrait are the unit's abilities");
					this.log('The ones with revealed icons are usable');
					this.log('Use the materialize ability to summon');
					this.log('Making units drains your plasma points');
					this.log('Press the hourglass icon to skip the turn');
					this.log('%CreatureName' + this.activeCreature.id + '%, press here to toggle tutorial!');
				}
				// Updates UI to match new creature
				this.UI.updateActivebox();
				this.updateQueueDisplay();
				this.signals.creature.dispatch('activate', { creature: this.activeCreature });
				// Only the client whose own player controlled the *outgoing* creature
				// broadcasts the turn transition. Without this, a locally-replayed
				// remote action that ends in the opponent's creature dying (and thus
				// ending its own turn) would cause this client to also broadcast a
				// 'turn-update', racing with the authoritative one from the acting
				// client and desyncing whose turn each side thinks it is.
				const localPlayerIndex = this.lobby?.getLocalPlayer()?.playerIndex;
				const wasLocalPlayersTurn =
					!previousActiveCreature || previousActiveCreature.player.id === localPlayerIndex;
				if (
					this.multiplayer &&
					this.playersReady &&
					this.lobby &&
					!remote &&
					wasLocalPlayersTurn &&
					!this.authority
				) {
					this.lobby.sendAction({
						type: 'turn-update',
						playerId: this.lobby.getLocalPlayer()?.playerId || '',
						creatureId: this.activeCreature.id,
						turn: this.turn,
					});
				} else {
					this.playersReady = true;
				}
			}, getVisibilityAwareDelay(50));
		}, getVisibilityAwareDelay(300));
	}

	updateQueueDisplay(excludeActiveCreature?) {
		if (this.UI) {
			this.UI.updateQueueDisplay(excludeActiveCreature);
		}
	}

	/**
	 * @param {any} obj - Any variable to display in console and game log
	 * Display obj in the console log and in the game log
	 */
	log(obj, htmlclass?, ifNoTimestamp = false) {
		// Formating
		let stringConsole = obj,
			stringLog = obj,
			creature: Creature;

		const totalCreatures = this.creatures.length;

		for (let i = 0; i < totalCreatures; i++) {
			creature = this.creatures[i];

			if (creature) {
				stringConsole = stringConsole.replace(
					'%CreatureName' + i + '%',
					creature.player.name + "'s " + creature.name,
				);
				stringLog = stringLog.replace(
					'%CreatureName' + i + '%',
					"<span class='" + creature.player.color + "'>" + creature.name + '</span>',
				);
			}
		}

		if (!DEBUG_DISABLE_GAME_STATUS_CONSOLE_LOG) {
			console.log(stringConsole);
		}
		this.UI.chat.addMsg(stringLog, htmlclass, ifNoTimestamp);
	}

	togglePause() {
		if (this.freezedInput && this.pause) {
			this.pause = false;
			this.freezedInput = false;
			this.pauseTime += new Date().valueOf() - this.pauseStartTime.valueOf();
			$j('#pause').remove();
			this.startTimer();
		} else if (!this.pause && !this.freezedInput) {
			this.pause = true;
			this.freezedInput = true;
			this.pauseStartTime = new Date();
			this.stopTimer();
			$j('#ui').append('<div id="pause">Pause</div>');
		}
	}

	/**
	 * Only true when this client is NOT authoritative for the currently active
	 * creature's turn in a multiplayer match (i.e. it belongs to the other
	 * human player). Automatic turn-ending triggers (turn timer expiry,
	 * frozen/dizzy/dazzled/BRB status in Creature.activate()) run locally on
	 * every client, so without this check both clients could independently
	 * skip and broadcast for the same turn transition, double-advancing the
	 * queue on whichever client applies both its own and the echoed remote
	 * skip. Bot-controlled creatures are exempt since bots run locally on
	 * every client rather than being owned by a specific human player.
	 */
	private isOtherPlayersTurn(): boolean {
		return (
			this.multiplayer &&
			!!this.lobby &&
			this.activeCreature?.player?.controller !== 'bot' &&
			!this.lobby.isMyTurn()
		);
	}

	/**
	 * End turn for the current unit
	 */
	skipTurn(o?, remote?: boolean) {
		if (!remote && this.isOtherPlayersTurn()) {
			return;
		}

		// NOTE: If skipping a turn and there is a temp creature, destroy it.
		this.creatures.filter((c) => c?.temp).forEach((c) => c.destroy());

		if (this.turnThrottle && !remote) {
			return;
		}

		if (!remote && this.multiplayer && this.lobby) {
			if (this.authority) {
				this.sendIntent({ kind: 'skip' } as Intent);
				return;
			}
			this.lobby.sendAction({
				type: 'action-end',
				action: 'skip',
				playerId: this.lobby.getLocalPlayer()?.playerId || '',
				creatureId: this.activeCreature?.id || 0,
			});
		}

		o = $j.extend(
			{
				// eslint-disable-next-line @typescript-eslint/no-empty-function
				callback: function () {},
				noTooltip: false,
				tooltip: 'Skipped',
			},
			o,
		);

		this.turnThrottle = true;
		this.UI.btnSkipTurn.changeState('disabled');
		this.UI.btnDelay.changeState('disabled');

		setTimeout(() => {
			this.turnThrottle = false;
			this.UI.btnSkipTurn.changeState('normal');

			if (this.activeCreature?.canWait && this.queue.queue.length > 1) {
				this.UI.btnDelay.changeState('normal');
			}

			o.callback.apply();
		}, 1000);

		if (this.activeCreature) {
			this.activeCreature.facePlayerDefault();

			const skipTurn = new Date();
			const p = this.activeCreature.player;
			p.totalTimePool = p.totalTimePool - (skipTurn.valueOf() - p.startTime.valueOf());
			this.pauseTime = 0;
			// Block icon state changes for the entire fold+unfold cycle.
			// Must be set before deactivate() which calls queryMove(null) → selectAbility(-1) → checkAbilities.
			this.UI._abilityPanelAnimating = true;

			// Animate out the no-action hint before deactivating
			if (this.activeCreature.noActionPossible) {
				this.activeCreature.fadeOutNoActionHints();
			}

			this.activeCreature.deactivate('turn-end');
			const activeCreature = this.activeCreature;
			this.nextCreature(remote);

			setTimeout(() => {
				if (!o.noTooltip) {
					activeCreature.hint(o.tooltip, 'msg_effects');
				}
			}, 350);
		}
	}

	/**
	 * Delay the action turn of the current creature
	 * o - object containing a callback function
	 */

	delayCreature(o?, remote?: boolean) {
		if (!this.activeCreature?.canWait || this.queue.isCurrentEmpty()) {
			return;
		}

		if (!remote && this.isOtherPlayersTurn()) {
			return;
		}

		if (this.turnThrottle && !remote) {
			return;
		}

		if (!remote && this.multiplayer && this.lobby) {
			if (this.authority) {
				this.sendIntent({ kind: 'delay' } as Intent);
				return;
			}
			this.lobby.sendAction({
				type: 'action-end',
				action: 'delay',
				playerId: this.lobby.getLocalPlayer()?.playerId || '',
				creatureId: this.activeCreature?.id || 0,
			});
		}

		o = $j.extend(
			{
				// eslint-disable-next-line @typescript-eslint/no-empty-function
				callback: function () {},
			},
			o,
		);

		this.turnThrottle = true;
		this.UI.btnSkipTurn.changeState('disabled');
		this.UI.btnDelay.changeState('disabled');

		setTimeout(() => {
			this.turnThrottle = false;
			this.UI.btnSkipTurn.changeState('normal');
			if (this.activeCreature?.canWait && !this.queue.isCurrentEmpty()) {
				this.UI.btnDelay.changeState('slideIn');
			}

			o.callback.apply();
		}, 1000);

		const skipTurn = new Date(),
			p = this.activeCreature.player;

		p.totalTimePool = p.totalTimePool - (skipTurn.valueOf() - p.startTime.valueOf());
		this.activeCreature.wait();
		this.nextCreature(remote);
	}

	startTimer() {
		clearInterval(this.timeInterval);

		const totalTime = new Date().valueOf();
		this.activeCreature.player.startTime = new Date(totalTime - this.pauseTime);
		this.checkTime();

		this.timeInterval = setInterval(() => {
			this.checkTime();
		}, this.checkTimeFrequency);
	}

	stopTimer() {
		clearInterval(this.timeInterval);
	}

	checkTime() {
		if (this.gameState === 'ended') {
			return;
		}

		const date = new Date().valueOf() - this.pauseTime,
			p = this.activeCreature.player,
			alertTime = 5, // In seconds
			totalPlayers = this.gameMode;

		let msgStyle: CreatureHintType = 'msg_effects';

		p.totalTimePool = Math.max(p.totalTimePool, 0); // Clamp

		// Check all timepools
		// Check is always true for infinite time
		let playerStillHaveTime = this.timePool > 0 ? false : true;
		for (let i = 0; i < totalPlayers; i++) {
			// Each player
			playerStillHaveTime = this.players[i].totalTimePool > 0 || playerStillHaveTime;
		}

		// Check Match Time
		if (!playerStillHaveTime) {
			this.endGame();
			return;
		}

		this.UI.updateTimer();

		const startTime = p.startTime.valueOf();

		// Turn time and timepool not infinite
		if (this.timePool > 0 && this.turnTimePool > 0) {
			if (
				(date - startTime) / 1000 > this.turnTimePool ||
				p.totalTimePool - (date - startTime) < 0
			) {
				if (p.totalTimePool - (date - startTime) < 0) {
					p.deactivate(); // Only if timepool is empty
				}

				this.skipTurn();
				return;
			} else {
				if ((p.totalTimePool - (date - startTime)) / 1000 < alertTime) {
					msgStyle = 'damage';
				}

				if (this.turnTimePool - (date - startTime) / 1000 < alertTime && this.UI.dashopen) {
					// Alert
					this.UI.btnToggleDash.changeState('glowing');
					this.activeCreature.hint(
						// Math.ceil(this.turnTimePool - (date - p.startTime) / 1000),
						Math.ceil(this.turnTimePool - (date - startTime) / 1000).toString(),
						msgStyle,
					);
				}
			}
		} else if (this.turnTimePool > 0) {
			// Turn time is not infinite
			if ((date - startTime) / 1000 > this.turnTimePool) {
				this.skipTurn();
				return;
			} else {
				if (this.turnTimePool - (date - startTime) / 1000 < alertTime && this.UI.dashopen) {
					// Alert
					this.UI.btnToggleDash.changeState('glowing');
					this.activeCreature.hint(
						Math.ceil(this.turnTimePool - (date - startTime) / 1000).toString(),
						msgStyle,
					);
				}
			}
		} else if (this.timePool > 0) {
			// Timepool is not infinite
			if (p.totalTimePool - (date - startTime) < 0) {
				p.deactivate();
				this.skipTurn();
				return;
			} else {
				if (p.totalTimePool - (date - startTime) < alertTime) {
					msgStyle = 'damage';
				}

				if (this.turnTimePool - (date - startTime) / 1000 < alertTime && this.UI.dashopen) {
					// Alert
					this.UI.btnToggleDash.changeState('glowing');
					this.activeCreature.hint(
						Math.ceil(this.turnTimePool - (date - startTime) / 1000).toString(),
						msgStyle,
					);
				}
			}
		}
	}

	/**
	 * @param {CreatureType} type - Creature's type (ex: "--" for Dark Priest)
	 * Query the database for creature stats.
	 * Additonaly, ensure that a `type` property exists on each creature.
	 */
	retrieveCreatureStats(type: CreatureType) {
		const totalCreatures = this.creatureData.length;

		for (let i = totalCreatures - 1; i >= 0; i--) {
			if (
				this.creatureData[i].type == type ||
				this.creatureData[i].realm + this.creatureData[i].level == type
			) {
				if (!this.creatureData[i].type) {
					// When type property is missing, create it using formula: concat(realm + level)
					this.creatureData[i].type = this.creatureData[i].realm + this.creatureData[i].level;
				}
				return this.creatureData[i];
			}
		}
	}

	triggerAbility(trigger, arg, retValue?) {
		const [triggeredCreature, required] = arg;

		// For triggered creature
		triggeredCreature.abilities.forEach((ability) => {
			// If the creature is dead and the trigger is not onCreatureDeath, return
			if (triggeredCreature.dead === true && trigger !== 'onCreatureDeath') {
				return;
			}

			if (this.triggers[trigger].test(ability.getTrigger())) {
				if (ability.require(required)) {
					retValue = ability.animation(required);
				}
			}
		});

		// For other creatures
		this.creatures.forEach((creature) => {
			if (!creature || triggeredCreature === creature || creature.dead === true) {
				return;
			}

			creature.abilities.forEach((ability) => {
				if (this.triggers[trigger + '_other'].test(ability.getTrigger())) {
					if (ability.require(required)) {
						retValue = ability.animation(required, triggeredCreature);
					}
				}
			});
		});

		return retValue;
	}

	triggerEffect(trigger, arg, retValue?) {
		const [triggeredCreature, required] = arg;

		// For triggered creature
		triggeredCreature.effects.forEach((effect) => {
			if (triggeredCreature.dead === true) {
				return;
			}

			if (this.triggers[trigger].test(effect.trigger)) {
				retValue = effect.activate(required);
			}
		});

		// For other creatures
		this.creatures.forEach((creature) => {
			if (creature) {
				if (triggeredCreature === creature || creature.dead === true) {
					return;
				}

				creature.effects.forEach((effect) => {
					if (this.triggers[trigger + '_other'].test(effect.trigger)) {
						retValue = effect.activate(required);
					}
				});
			}
		});

		return retValue;
	}

	triggerTrap(trigger, arg) {
		const [triggeredCreature] = arg;

		triggeredCreature.hexagons.forEach((hex) => {
			hex.activateTrap(this.triggers[trigger], triggeredCreature);
		});
	}

	triggerDeleteEffect(trigger, creature) {
		const effects = creature == 'all' ? this.effects : creature.effects;
		let totalEffects = effects.length;

		for (let i = 0; i < totalEffects; i++) {
			const effect = effects[i];

			if (
				effect.turnLifetime > -1 &&
				trigger === effect.deleteTrigger &&
				this.turn - effect.creationTurn >= effect.turnLifetime
			) {
				effect.deleteEffect();
				// Updates UI in case effect changes it
				if (effect.target) {
					effect.target.updateHealth(); // Has no effect if target is a hex (such as when applied to a trap)
				}

				i--;
				totalEffects--;
			}
		}
	}

	onStepIn(creature, hex, opts) {
		this.triggerAbility('onStepIn', arguments);
		this.triggerEffect('onStepIn', arguments);
		// Check traps last; this is because traps adds effects triggered by
		// this event, which gets triggered again via G.triggerEffect. Otherwise
		// the trap's effects will be triggered twice.
		if (!opts || !opts.ignoreTraps) {
			this.triggerTrap('onStepIn', arguments);
		}
	}

	/**
	 * Be careful when using this trigger to apply damage as it can kill a creature
	 * before it has completed its movement, resulting in incorrect Drop placement
	 * and other bugs. Refer to Impaler Poisonous Vine ability for an example on how
	 * to delay damage until the end of movement.
	 *
	 * Removed individual args from definition because we are using the arguments variable.
	 */
	onStepOut(/* creature, hex, callback */) {
		this.triggerAbility('onStepOut', arguments);
		this.triggerEffect('onStepOut', arguments);
		// Check traps last; this is because traps add effects triggered by
		// this event, which gets triggered again via G.triggerEffect. Otherwise
		// the trap's effects will be triggered twice.
		this.triggerTrap('onStepOut', arguments);
	}

	onReset(creature) {
		this.triggerDeleteEffect('onReset', creature);
		this.triggerAbility('onReset', arguments);
		this.triggerEffect('onReset', [creature, creature]);
	}

	// Removed individual args from definition because we are using the arguments variable.
	onStartPhase(/* creature, callback */) {
		const creature = arguments[0],
			totalTraps = this.traps.length;

		let trap: Trap;

		for (let i = 0; i < totalTraps; i++) {
			trap = this.traps[i];

			if (trap === undefined) {
				continue;
			}

			if (trap.turnLifetime > 0) {
				if (this.turn - trap.creationTurn >= trap.turnLifetime) {
					if (trap.fullTurnLifetime) {
						if (trap.ownerCreature == this.activeCreature) {
							trap.destroy();
							i--;
						}
					} else {
						trap.destroy();
						i--;
					}
				}
			}
		}

		this.triggerDeleteEffect('onStartPhase', creature);
		this.triggerAbility('onStartPhase', arguments);
		this.triggerEffect('onStartPhase', [creature, creature]);
	}

	// Removed individual args from definition because we are using the arguments variable.
	onEndPhase(/* creature, callback */) {
		const creature = arguments[0];

		this.triggerDeleteEffect('onEndPhase', creature);
		this.triggerAbility('onEndPhase', arguments);
		this.triggerEffect('onEndPhase', [creature, creature]);
	}

	// Removed individual args from definition because we are using the arguments variable.
	onStartOfRound(/* creature, callback */) {
		this.triggerDeleteEffect('onStartOfRound', 'all');
	}

	// Removed individual args from definition because we are using the arguments variable.
	onCreatureMove(/* creature, hex, callback */) {
		this.triggerAbility('onCreatureMove', arguments);
	}

	// Removed individual args from definition because we are using the arguments variable.
	onCreatureDeath(/* creature, callback */) {
		const creature = arguments[0];

		this.triggerAbility('onCreatureDeath', [creature, creature]);
		this.triggerEffect('onCreatureDeath', arguments);

		// Looks for traps owned by this creature and destroy them
		this.traps
			.filter(
				(trap) => trap.turnLifetime > 0 && trap.fullTurnLifetime && trap.ownerCreature == creature,
			)
			.forEach((trap) => trap.destroy());

		// Look for effects owned by this creature and destroy them if necessary
		this.effects
			.filter((effect) => effect.owner === creature && effect.deleteOnOwnerDeath)
			.forEach((effect) => {
				effect.deleteEffect();
				// Update UI in case effect changes it
				if (effect.target) {
					// `this.effects` might be the wrong type or need to look at `EffectTarget` type definition
					effect.target.updateHealth();
				}
			});
	}

	onCreatureSummon(creature, callback) {
		this.triggerAbility('onCreatureSummon', [creature, creature, callback]);
		this.triggerEffect('onCreatureSummon', [creature, creature]);
	}

	// Removed individual args from definition because we are using the arguments variable.
	onEffectAttach(creature, effect /*, callback */) {
		this.triggerEffect('onEffectAttach', [creature, effect]);
	}

	onUnderAttack(creature, damage) {
		this.triggerAbility('onUnderAttack', arguments, damage);
		this.triggerEffect('onUnderAttack', arguments, damage);
		return damage;
	}

	// Removed individual args from definition because we are using the arguments variable.
	onDamage(/* creature, damage */) {
		this.triggerAbility('onDamage', arguments);
		this.triggerEffect('onDamage', arguments);
		this.botController.notifyDamage();
	}

	// Removed individual args from definition because we are using the arguments variable.
	onHeal(/* creature, amount */) {
		this.triggerAbility('onHeal', arguments);
		this.triggerEffect('onHeal', arguments);
	}

	onAttack(creature, damage) {
		this.triggerAbility('onAttack', arguments, damage);
		this.triggerEffect('onAttack', arguments, damage);
	}

	findCreature(o) {
		const ret: Creature[] = [],
			o2 = $j.extend(
				{
					team: -1, // No team
					type: '--', // Dark Priest
				},
				o,
			),
			creatures = this.creatures,
			totalCreatures = creatures.length;

		let creature: Creature, match: boolean, wrongTeam: boolean;

		for (let i = 0; i < totalCreatures; i++) {
			creature = creatures[i];

			if (creature) {
				match = true;

				$j.each(o2, function (key, val) {
					if (key == 'team') {
						if (val == -1) {
							return;
						}

						if (val instanceof Array) {
							wrongTeam = true;
							if (val.indexOf(creature[key]) != -1) {
								wrongTeam = false;
							}

							if (wrongTeam) {
								match = false;
							}

							return;
						}
					}

					if (creature[key] != val) {
						match = false;
					}
				});

				if (match) {
					ret.push(creature);
				}
			}
		}

		return ret;
	}

	clearOncePerDamageChain() {
		const creatures = this.creatures,
			totalCreatures = creatures.length,
			totalEffects = this.effects.length;

		let creature: Creature, totalAbilities;

		for (let i = totalCreatures - 1; i >= 0; i--) {
			creature = this.creatures[i];

			if (creature) {
				totalAbilities = creature.abilities.length;

				for (let j = totalAbilities - 1; j >= 0; j--) {
					creature.abilities[j].triggeredThisChain = false;
				}
			}
		}

		for (let i = 0; i < totalEffects; i++) {
			// @ts-expect-error 2339
			// `this.effects` might be the wrong type or need to look at `EffectTarget` type definition
			this.effects[i].triggeredThisChain = false;
		}
	}

	/* endGame()
	 *
	 * End the game and print stats
	 * reason - optional disconnect reason (e.g. "Host disconnected...")
	 */
	endGame(reason?: string) {
		if (this.gameState === 'ended') {
			return;
		}

		this.soundsys.stopMusic();
		this.endGameSound = this.soundsys.playSFX('sounds/drums');

		this.stopTimer();
		this.activeCreature = undefined;
		this.gameState = 'ended';
		this.disconnectReason = reason;

		// On disconnect, skip score calculation and go straight to UI
		if (reason) {
			this.UI.endGame(reason);
			return;
		}

		//-------End bonuses--------//
		for (let i = 0; i < this.gameMode; i++) {
			// Surviving Creature Bonus
			let immortal = true;
			for (let j = 0; j < this.players[i].creatures.length; j++) {
				if (!this.players[i].creatures[j].dead) {
					if (this.players[i].creatures[j].type != '--') {
						this.players[i].score.push({
							type: 'creaturebonus',
							creature: this.players[i].creatures[j],
						});
					} else {
						// Dark Priest Bonus
						this.players[i].score.push({
							type: 'darkpriestbonus',
						});
					}
				} else {
					immortal = false;
				}
			}

			// Immortal
			if (immortal && this.players[i].creatures.length > 1) {
				// At least 1 creature summoned
				this.players[i].score.push({
					type: 'immortal',
				});
			}
		}
		this.UI.endGame();
	}

	/**
	 * Apply a recorded/relayed "move" action to the current activeCreature.
	 * Shared by action() (saved-log replay) and handleLobbyMessage()'s
	 * 'action-move' case (live multiplayer relay) so there's exactly one place
	 * that knows how to turn a move record into a real move — see
	 * Creature.moveTo()'s `opts.path` handling for why replaying the exact
	 * recorded path (rather than recalculating pathfinding) matters for
	 * multiplayer sync.
	 */
	private applyMoveRecord(
		record: { target: { x: number; y: number }; path?: Array<{ x: number; y: number }> },
		callback?: () => void,
	) {
		const hex = this.grid.hexes[record.target.y][record.target.x];
		const path = record.path
			?.map((p) => this.grid.hexes[p.y]?.[p.x])
			.filter((pathHex): pathHex is Hex => Boolean(pathHex));
		this.activeCreature.moveTo(hex, {
			path: path && path.length ? path : undefined,
			// eslint-disable-next-line @typescript-eslint/no-empty-function
			callback: callback ?? function () {},
		});
	}

	action(o, opt) {
		const defaultOpt = {
			// eslint-disable-next-line @typescript-eslint/no-empty-function
			callback: function () {},
		};

		opt = $j.extend(defaultOpt, opt);

		this.clearOncePerDamageChain();
		switch (o.action) {
			case 'move':
				this.applyMoveRecord(o, opt.callback);
				break;
			case 'skip':
				this.skipTurn(
					{
						callback: opt.callback,
					},
					true,
				);
				break;
			case 'delay':
				this.delayCreature(
					{
						callback: opt.callback,
					},
					true,
				);
				break;
			case 'flee':
				this.activeCreature.player.flee({
					callback: opt.callback,
				});
				break;
			case 'ability': {
				// Reconstruct the live ability args. The recorded action stores
				// `args` as everything AFTER the target (gamelog: `args.slice(1)`),
				// so the full live arg array is `[target, ...o.args]`. This mirrors
				// handleLobbyMessage's action-ability path; the previous
				// `$j.makeArray(o.args[1])` reconstruction dropped `arg[1]` and all
				// later args, breaking replay of multi-argument abilities.
				const ability = this.activeCreature.abilities[o.id];
				if (!ability) break;

				const args = Array.isArray(o.args) ? [...o.args] : [];

				if (o.target.type == 'hex') {
					args.unshift(this.grid.hexes[o.target.y][o.target.x]);
					ability.animation2({
						callback: opt.callback,
						arg: args,
					});
				} else if (o.target.type == 'creature') {
					const targetCreature = this.creatures[o.target.crea];
					if (targetCreature) {
						args.unshift(targetCreature);
						ability.animation2({
							callback: opt.callback,
							arg: args,
						});
					}
				} else if (o.target.type == 'array') {
					const array = o.target.array.map((item) => this.grid.hexes[item.y][item.x]);

					args.unshift(array);
					ability.animation2({
						callback: opt.callback,
						arg: args,
					});
				}
				break;
			}
		}
	}

	getImage(url) {
		const img = new Image();
		img.src = url;
		img.onload = function () {
			// No-op
		};
	}

	resetGame() {
		this.UI?.metaPowers?._clearPowers();
		this.UI.showGameSetup();
		this.stopTimer();
		this.players = [];
		this.creatures = [];
		this.effects = [];
		this.activeCreature = undefined;
		this.matchid = null;
		this.playersReady = false;
		this.preventSetup = false;
		this.animations = new Animations(this);
		this.queue = new CreatureQueue(() => this.creatures);
		this.creatureData = [];
		this.pause = false;
		this.gameState = 'initialized';
		this.availableCreatures = [];
		this.lastSummonedType = null;
		this.animationQueue = [];
		this.configData = {};
		this.match = {};
		this.lobby = null;
		this.lobbyCode = '';
		this.lobbyState = null;
		this.firstKill = false;
		this.freezedInput = false;
		this.isReplayInProgress = false;
		this.turnThrottle = false;
		this.turn = 0;

		// Destroy existing traps and drops to avoid invisible remnants after restart.
		this.traps.forEach((trap) => trap.destroy());
		this.drops.forEach((drop) => drop.destroy());
		this.traps = [];
		this.drops = [];

		// Recreate signal channels to avoid accumulating UI listeners between restarts.
		const signalChannels = ['ui', 'metaPowers', 'creature', 'hex'];
		this.signals = this.setupSignalChannels(signalChannels);
		this.botController = new BotController(this);

		this.gamelog.reset();
	}

	restartMatch() {
		if (this.multiplayer) {
			this.resetGame();
			return;
		}

		const restartConfig = {
			...this.configData,
			players: Array.isArray(this.configData.players)
				? [...this.configData.players]
				: this.configData.players,
		};

		this.resetGame();
		this.loadGame(restartConfig);
	}

	/**
	 * Setup signal channels based on a list of channel names.
	 *
	 * @example setupSignalChannels(['ui', 'game'])
	 * // ... another file
	 * this.game.signals.ui.add((message, payload) => console.log(message, payload), this);
	 *
	 * @see https://photonstorm.github.io/phaser-ce/Phaser.Signal.html
	 *
	 * @param {array} channels List of channel names.
	 * @returns {object} Phaser signals keyed by channel name.
	 */
	setupSignalChannels(channels) {
		const signals = channels.reduce((acc, curr) => {
			return {
				...acc,
				[curr]: new Signal(),
			};
		}, {});

		return signals;
	}

	onLogSave(log) {
		log.custom.configData = this.configData;
	}

	onLogLoad(log) {
		if (this.gameState !== 'initialized') {
			alert('Can only load game from configuration menu.');
			return;
		}

		this.isReplayInProgress = true;

		const actions = [...log.actions];
		const numTotalActions = actions.length;
		const configData = log.custom.configData;
		this.configData = log.custom.configData ?? this.configData;

		const restoreInteractiveState = (pollAttempt = 0) => {
			if (this.gameState !== 'playing' || this.pause || !this.activeCreature) {
				return;
			}

			this._deferredQueryMovePending = 0;
			this.turnThrottle = false;
			this.freezedInput = false;

			const activeCreatureId = this.activeCreature.id;
			const activeQueryInstalled =
				activeCreatureId !== undefined && this.grid?.lastQueryOpt?.id === activeCreatureId;
			if (activeQueryInstalled) {
				this.grid?.refreshHoverState();
				return;
			}

			// Turn handoffs (skip/delay) install the next unit query asynchronously.
			// Wait briefly to avoid issuing a duplicate queryMove() that can lock input.
			if (pollAttempt < 20) {
				setTimeout(() => restoreInteractiveState(pollAttempt + 1), 100);
				return;
			}

			this.activeCreature.queryMove();
			this.grid?.refreshHoverState();
		};

		const nextAction = () => {
			if (actions.length === 0) {
				this.isReplayInProgress = false;
				// Replay finishes between turns for some logs; explicitly re-arm the
				// active creature query to restore live input controls.
				setTimeout(() => restoreInteractiveState(), 0);
				return;
			}

			if (!DEBUG_DISABLE_GAME_STATUS_CONSOLE_LOG) {
				console.log(`${1 + numTotalActions - actions.length} / ${numTotalActions}`);
			}

			const interval = setInterval(() => {
				if (!this.freezedInput && !this.turnThrottle) {
					clearInterval(interval);
					this.activeCreature.queryMove();
					this.action(actions.shift(), {
						callback: nextAction,
					});
				}
			}, 100);
		};

		this.loadGame(configData, undefined, undefined, () => {
			setTimeout(() => nextAction(), 3000);
		});
	}
}
