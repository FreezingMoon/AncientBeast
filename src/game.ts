import * as $j from 'jquery';
import { Animations } from './animations';
import { CreatureQueue } from './creature_queue';
import { GameLog } from './utility/gamelog';
import { SoundSys } from './sound/soundsys';
import { MusicPlayer } from './sound/musicplayer';
import { Hex } from './utility/hex';
import { HexGrid } from './utility/hexgrid';
import { getUrl, use as assetsUse } from './assets';
import { Player, PlayerColor } from './player';
import { UI } from './ui/interface';
import { Creature, CreatureHintType } from './creature';
import { unitData } from './data/units';
import 'pixi';
import 'p2';
// @ts-expect-error 2307
import Phaser, { Signal } from 'phaser';
import MatchI from './multiplayer/match';
import Gameplay from './multiplayer/gameplay';
import { sleep } from './utility/time';
import { DEBUG_DISABLE_GAME_STATUS_CONSOLE_LOG, DEBUG_DISABLE_MUSIC } from './debug';
import { Point, configure as configurePointFacade } from './utility/pointfacade';
import { pretty as version } from './utility/version';
import { Ability } from './ability';
import { Effect } from './effect';
import { GameConfig } from './script';
import { Trap } from './utility/trap';
import { Drop } from './drop';
import { CreatureType, Realm, UnitData } from './data/types';

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

export default class Game {
	/* Attributes
	 *
	 * NOTE : attributes and variables starting with $ are jQuery elements
	 * and jQuery functions can be called directly from them.
	 *
	 * // jQuery attributes
	 * $combatFrame :	Combat element containing all graphics except the UI
	 *
	 * // Game elements
	 * players :			Array :	Contains Player objects ordered by player ID (0 to 3)
	 * creatures :			Array :	Contains Creature objects (creatures[creature.id]) start at index 1
	 * traps :				Array : Contains Trap objects
	 *
	 * grid :				Grid :	Grid object
	 * UI :				UI :	UI object
	 *
	 * queue :				CreatureQueue :	queue of creatures to manage phase order
	 *
	 * turn :				Integer :	Current's turn number
	 *
	 * // Normal attributes
	 * playerMode :		Integer :	Number of players in the game
	 * activeCreature :	Creature :	Current active creature object reference
	 * creatureData :		Array :		Array containing all data for the creatures
	 *
	 */
	abilities: Array<Partial<Ability>[]>;
	players: Player[];
	creatures: Creature[];
	traps: Trap[];
	drops: Drop[];
	effects: Effect[];
	activeCreature: Creature | undefined;
	matchid: number;
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
	animationQueue: (Animation | AnimationID)[];
	checkTimeFrequency: number;
	gamelog: GameLog;
	configData: object;
	match: MatchI | object;
	gameplay: Gameplay;
	session = null;
	client = null;
	connect = null;
	multiplayer: boolean;
	matchInitialized: boolean;
	realms: Realm[];
	availableMusic = [];
	inputMethod = 'Mouse';
	firstKill: boolean;
	freezedInput: boolean;
	turnThrottle: boolean;
	turn: number;
	Phaser: Phaser;
	msg: any; // type this properly
	triggers: Record<string, RegExp>;
	signals: any;

	// The optionals below are created by the various methods of `Game`, mainly by `setup` and `loadGame`

	musicPlayer?: any;
	soundsys?: any;

	background_image?: string;

	playerMode?: number;

	UI?: any;

	trapId?: number;
	effectId?: number;
	dropId?: number;
	grid?: HexGrid;

	startMatchTime?: Date;
	$combatFrame?: JQuery<HTMLElement>; //eslint-disable-line no-undef
	timeInterval?: NodeJS.Timer; //eslint-disable-line no-undef

	windowResizeTimeout?: string | number | NodeJS.Timer; //eslint-disable-line no-undef

	pauseStartTime?: Date;

	timePool?: number;
	turnTimePool?: number;

	endGameSound?: any;

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
		this.animationQueue = [];
		this.checkTimeFrequency = 1000;
		this.gamelog = new GameLog(
			(log) => this.onLogSave(log),
			(log) => this.onLogLoad(log),
		);
		this.configData = {};
		this.match = {};
		this.gameplay = undefined;
		this.session = null;
		this.client = null;
		this.connect = null;
		this.multiplayer = false;
		this.matchInitialized = false;
		this.realms = ['-', 'A', 'E', 'G', 'L', 'P', 'S', 'W'];
		this.availableMusic = [];
		this.inputMethod = 'Mouse';

		// Gameplay properties
		this.firstKill = false;
		this.freezedInput = false;
		this.turnThrottle = false;
		this.turn = 0;

		// Phaser
		this.Phaser = new Phaser.Game(1920, 1080, Phaser.AUTO, 'combatwrapper', {
			update: this.phaserUpdate.bind(this),
			render: this.phaserRender.bind(this),
		});

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
	}

	loadUnitData(data: UnitData) {
		const dpcolor = ['blue', 'orange', 'green', 'red'];

		this.creatureData = data;

		data.forEach((creature) => {
			if (!creature.playable) {
				return;
			}

			let creatureId = creature.id,
				realm = creature.realm,
				level = creature.level,
				type = (realm.toUpperCase() + level) as CreatureType,
				name = creature.name,
				count,
				i;

			// Create the `creature.type` property
			creature['type'] = type;

			// Load unit shouts
			this.soundsys.loadSound('units/shouts/' + name);

			// Load artwork
			this.getImage(getUrl('units/artwork/' + name));

			if (name == 'Dark Priest') {
				for (i = 0, count = dpcolor.length; i < count; i++) {
					this.getImage(getUrl('units/avatars/' + name + ' ' + dpcolor[i]));
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
		matchid?: number,
		onLoadCompleteFn = () => {},
	) {
		// Need to remove keydown listener before new game start
		// to prevent memory leak and mixing hotkeys between start screen and game
		$j(document).off('keydown');

		if (this.multiplayer && !matchid) {
			this.matchInitialized = matchInitialized;
		}
		if (matchid) {
			this.matchid = matchid;
		}

		this.gameState = 'loading';
		if (setupOpt) {
			this.configData = setupOpt;
			$j.extend(this, setupOpt);
		}
		// console.log(this);
		this.startLoading();

		// Sounds
		const paths = [
			'sounds/step',
			'sounds/swing',
			'sounds/swing2',
			'sounds/swing3',
			'sounds/heartbeat',
			'sounds/drums',
			'sounds/upgrade',
			'sounds/mudbath',
			'sounds/AncientBeast',
		];

		this.soundsys = new SoundSys({ paths });
		this.musicPlayer = this.soundsys.musicPlayer;

		this.Phaser.load.onFileComplete.add(this.loadFinish, this);
		this.Phaser.load.onLoadComplete.add(onLoadCompleteFn);

		assetsUse(this.Phaser);

		// Ability SFX
		this.Phaser.load.audio('MagmaSpawn0', getUrl('units/sfx/Infernal 0'));

		// Background
		this.Phaser.load.image('background', getUrl('locations/' + this.background_image + '/bg'));

		// Load artwork, shout and avatar for each unit
		this.loadUnitData(unitData);
	}

	hexAt(x: number, y: number): Hex | undefined {
		return this.grid.hexAt(x, y);
	}

	get activePlayer() {
		if (this.multiplayer) {
			if (this.players && this.match instanceof MatchI && this.match.userTurn) {
				return this.players[this.match.userTurn];
			}
			return undefined;
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
	}

	loadFinish() {
		const progress = this.Phaser.load.progress,
			progressWidth = progress + '%';

		$j('#barLoader .progress').css('width', progressWidth);

		if (progress == 100) {
			setTimeout(() => {
				this.gameState = 'loaded';
				$j('#combatwrapper').show();

				$j('body').css('cursor', 'default');

				// Do not call setup if we are not active.
				if (!this.preventSetup) {
					this.setup(this.playerMode);
				}
			}, 100);
		}
	}

	phaserUpdate() {
		if (this.gameState != 'playing') {
			return;
		}
	}

	phaserRender() {
		let count = this.creatures.length,
			i;

		for (i = 1; i < count; i++) {
			//G.Phaser.debug.renderSpriteBounds(G.creatures[i].sprite);
		}
	}

	// Catch the browser being made inactive to prevent initial rendering bugs.
	onBlur() {
		this.preventSetup = true;
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
	}

	// If no red flags, remove the loading bar and begin rendering the game.
	maybeSetup() {
		if (this.preventSetup) {
			return;
		}

		$j('#loader').addClass('hide');
		$j('body').css('cursor', 'default');
		this.setup(this.playerMode);
	}

	/**
	 * @param {number} playerMode - Ideally 2 or 4, number of players to configure
	 * Launch the game with the given number of player.
	 */
	setup(playerMode: number) {
		let bg, i;

		// Phaser
		this.Phaser.scale.parentIsWindow = true;
		this.Phaser.scale.pageAlignHorizontally = true;
		this.Phaser.scale.pageAlignVertically = true;
		this.Phaser.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
		this.Phaser.scale.fullScreenScaleMode = Phaser.ScaleManager.SHOW_ALL;
		this.Phaser.scale.refresh();
		this.Phaser.stage.disableVisibilityChange = true;

		if (!this.Phaser.device.desktop) {
			this.Phaser.stage.forcePortrait = true;
		}

		bg = this.Phaser.add.sprite(0, 0, 'background');
		bg.inputEnabled = true;
		bg.events.onInputUp.add((Sprite, Pointer) => {
			if (this.freezedInput || this.UI.dashopen) {
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
			getCreatures: () => this.creatures,
			getCreaturePassablePoints: (creature) => [],
			getCreatureBlockedPoints: (creature) => {
				if (creature.dead || creature.temp) {
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
			getTrapBlockedPoints: (trap) => [],
			getDrops: () => this.drops,
			getDropPassablePoints: (drop) => [drop],
			getDropBlockedPoints: (drop) => [],
		});

		this.startMatchTime = new Date();

		this.$combatFrame = $j('#combatframe');
		this.$combatFrame.show();

		// Remove loading screen
		$j('#matchMaking').hide();

		for (i = 0; i < playerMode; i++) {
			const player = new Player(i, this);
			this.players.push(player);

			// Initialize players' starting positions
			let pos: Point;

			if (playerMode > 2) {
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

		this.activeCreature = this.players[0].creatures[0]; // Prevent errors

		{
			const self = this;
			this.UI = new UI(
				{
					get isAcceptingInput() {
						return !self.freezedInput;
					},
				},
				this,
			); // Create UI (not before because some functions require creatures to already exist)
		}

		// DO NOT CALL LOG BEFORE UI CREATION
		this.gameState = 'playing';

		this.log(`Welcome to Ancient Beast ${version}`);
		this.log('Setting up a ' + playerMode + ' player match');

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
		});

		this.soundsys.playMusic();
		if (DEBUG_DISABLE_MUSIC) {
			this.musicPlayer.audio.pause();
		}

		this.matchInit();
	}

	async matchInit() {
		if (this.multiplayer) {
			if (Object.keys(this.match).length === 0) {
				await this.connect.serverConnect(this.session);
				const match = new MatchI(this.connect, this, this.session);
				const gameplay = new Gameplay(this, match);
				// @ts-expect-error 2339
				match.gameplay = gameplay;
				this.gameplay = gameplay;
				this.match = match;

				// Only host
				if (this.matchInitialized && this.match instanceof MatchI) {
					const n = await this.match.matchCreate();

					console.log('created match', n);
					await match.matchMaker(n, this.configData);
				}
			}
			// Non-host
			if (this.matchid && this.match instanceof MatchI) {
				const n = await this.match.matchJoin(this.matchid);
				console.log('joined match', n);
			}
		}
	}
	async matchJoin() {
		await this.matchInit();
		// @ts-expect-error 2339
		await this.match.matchMaker();
	}
	async updateLobby() {
		if (this.matchInitialized) return;
		const self = this;

		$j('.lobby-match-list').html('').addClass('refreshing');
		$j('#refreshMatchButton').addClass('disabled');
		$j('.lobby-loader').removeClass('hide');
		$j('.lobby-no-matches').addClass('hide');

		// Short delay to let the user know something has happened.
		await sleep(Phaser.Timer.SECOND * 2);

		$j('.lobby-match-list').removeClass('refreshing');
		$j('#refreshMatchButton').removeClass('disabled');
		$j('.lobby-loader').addClass('hide');

		if (this.match && this.match instanceof MatchI && !this.match.matchUsers.length) {
			$j('.lobby-no-matches').removeClass('hide');
			return;
		}

		// @ts-expect-error 2339
		this.match.matchUsers.forEach((v) => {
			const isAvailableMatch = v.string_properties && v.string_properties.match_id;

			if (!isAvailableMatch) {
				return;
			}

			const gameConfig = {
				background_image: v.string_properties.background_image,
				abilityUpgrades: v.numeric_properties.abilityUpgrades,
				creaLimitNbr: v.numeric_properties.creaLimitNbr,
				plasma_amount: v.numeric_properties.plasma_amount,
				playerMode: v.numeric_properties.playerMode,
				timePool: v.numeric_properties.timePool,
				turnTimePool: v.numeric_properties.turnTimePool,
				unitDrops: v.numeric_properties.unitDrops,
			};
			const turntimepool =
				v.numeric_properties.turnTimePool < 0 ? '∞' : v.numeric_properties.timePool;
			const timepool = v.numeric_properties.timePool < 0 ? '∞' : v.numeric_properties.timePool;
			const unitdrops = v.numeric_properties.unitDrops < 0 ? 'off' : 'on';
			this.unitDrops = v.numeric_properties.unitDrops;
			const _matchBtn =
				$j(`<a class="user-match"><div class="avatar"></div><div class="user-match__col">
        Host: ${v.presence.username}<br />
        Player Mode: ${v.numeric_properties.playerMode}<br />
        Active Units: ${v.numeric_properties.creaLimitNbr}<br />
        Ability Upgrades: ${v.numeric_properties.abilityUpgrades}<br />
        </div><div class="user-match__col">
        Plasma Points: ${v.numeric_properties.plasma_amount}<br />
        Turn Time(seconds): ${turntimepool}<br />
        Turn Pools(minutes): ${timepool}<br />
        Unit Drops: ${unitdrops}<br /></div></a>
        `);
			_matchBtn.on('click', () => {
				$j('.lobby').hide();
				this.loadGame(gameConfig, false, v.string_properties.match_id);
			});
			$j('.lobby-match-list').append(_matchBtn);
		});
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
	nextRound() {
		this.turn++;
		this.log(`Round ${this.turn}`, 'roundmarker', true);
		this.onStartOfRound();
		this.nextCreature();
	}

	/**
	 * Activate the next creature in queue
	 */
	nextCreature() {
		this.UI.closeDash();
		this.UI.btnToggleDash.changeState('normal');
		this.grid.xray(new Hex(-1, -1, null, this)); // Clear Xray

		if (this.gameState == 'ended') {
			return;
		}

		this.stopTimer();
		// Delay
		setTimeout(() => {
			const interval = setInterval(() => {
				clearInterval(interval);

				let differentPlayer = false;

				if (this.queue.isCurrentEmpty() || this.turn === 0) {
					this.nextRound(); // Switch to the next Round
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

				if (this.activeCreature.player.hasLost) {
					this.nextCreature();
					return;
				}

				// Play heartbeat sound on other player's turn
				if (differentPlayer) {
					this.soundsys.playHeartBeat('sounds/heartbeat');
				}

				this.log('Active Creature : %CreatureName' + this.activeCreature.id + '%');
				this.activeCreature.activate();
				// console.log(this.activeCreature);

				// Show mini tutorial in the first round for each player
				if (this.turn == 1) {
					this.log('The active unit has a flashing hexagon');
					this.log('It uses a plasma field to protect itself');
					this.log('Its portrait is displayed in the upper left');
					this.log("Under the portrait are the unit's abilities");
					this.log('The ones with revealed icons are usable');
					this.log('Use the last one to materialize a creature');
					this.log('Making units drains your plasma points');
					this.log('Press the hourglass icon to skip the turn');
					this.log('%CreatureName' + this.activeCreature.id + '%, press here to toggle tutorial!');
				}
				// Updates UI to match new creature
				this.UI.updateActivebox();
				this.updateQueueDisplay();
				this.signals.creature.dispatch('activate', { creature: this.activeCreature });
				if (this.multiplayer && this.playersReady && this.gameplay instanceof Gameplay) {
					this.gameplay.updateTurn();
				} else {
					this.playersReady = true;
				}
			}, 50);
		}, 300);
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
			totalCreatures = this.creatures.length,
			creature: Creature,
			i;

		for (i = 0; i < totalCreatures; i++) {
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
	 * End turn for the current unit
	 */
	skipTurn(o?) {
		// NOTE: If skipping a turn and there is a temp creature, destroy it.
		this.creatures.filter((c) => c.temp).forEach((c) => c.destroy());

		// Send skip turn to server

		if (this.turnThrottle) {
			return;
		}

		o = $j.extend(
			{
				callback: function () {},
				noTooltip: false,
				tooltip: 'Skipped',
			},
			o,
		);

		this.turnThrottle = true;
		this.UI.btnSkipTurn.changeState('disabled');
		this.UI.btnDelay.changeState('disabled');
		this.UI.btnAudio.changeState('disabled');

		if (!o.noTooltip && this.activeCreature) {
			this.activeCreature.hint(o.tooltip, 'msg_effects');
		}

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
			this.activeCreature.deactivate('turn-end');
			this.nextCreature();
		}
	}

	/**
	 * Delay the action turn of the current creature
	 */
	delayCreature(o) {
		// Send skip turn to server
		if (this.multiplayer && this.gameplay instanceof Gameplay) {
			this.gameplay.delay();
		}

		if (this.turnThrottle) {
			return;
		}

		if (!this.activeCreature?.canWait || this.queue.isCurrentEmpty()) {
			return;
		}

		o = $j.extend(
			{
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
		this.nextCreature();
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
		let date = new Date().valueOf() - this.pauseTime,
			p = this.activeCreature.player,
			alertTime = 5, // In seconds
			msgStyle: CreatureHintType = 'msg_effects',
			totalPlayers = this.playerMode,
			i;

		p.totalTimePool = Math.max(p.totalTimePool, 0); // Clamp

		// Check all timepools
		// Check is always true for infinite time
		let playerStillHaveTime = this.timePool > 0 ? false : true;
		for (i = 0; i < totalPlayers; i++) {
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
	 * @param {CreatureType} type -	Creature's type (ex: "--" for Dark Priest)
	 * Query the database for creature stats.
	 * Additonaly, ensure that a `type` property exists on each creature.
	 */
	retrieveCreatureStats(type: CreatureType) {
		let totalCreatures = this.creatureData.length,
			i: number;

		for (i = totalCreatures - 1; i >= 0; i--) {
			if (
				//@ts-expect-error 2339 `type` does not exist on units in `units.ts`
				this.creatureData[i].type == type ||
				this.creatureData[i].realm + this.creatureData[i].level == type
			) {
				//@ts-expect-error 2339
				if (!this.creatureData[i].type) {
					//@ts-expect-error 2339
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
			if (triggeredCreature.dead === true) {
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
			if (triggeredCreature === creature || creature.dead === true) {
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
		let effects = creature == 'all' ? this.effects : creature.effects,
			totalEffects = effects.length,
			i;

		for (i = 0; i < totalEffects; i++) {
			const effect = effects[i];

			if (
				effect.turnLifetime > 0 &&
				trigger === effect.deleteTrigger &&
				this.turn - effect.creationTurn >= effect.turnLifetime
			) {
				effect.deleteEffect();
				// Updates UI in case effect changes it
				if (effect.target) {
					effect.target.updateHealth();
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
		let creature = arguments[0],
			totalTraps = this.traps.length,
			trap,
			i;

		for (i = 0; i < totalTraps; i++) {
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

		this.triggerAbility('onCreatureDeath', arguments);
		this.triggerEffect('onCreatureDeath', [creature, creature]);

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
					// @ts-expect-error 2339
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
		let ret = [],
			o2 = $j.extend(
				{
					team: -1, // No team
					type: '--', // Dark Priest
				},
				o,
			),
			creatures = this.creatures,
			totalCreatures = creatures.length,
			creature,
			match,
			wrongTeam,
			i;

		for (i = 0; i < totalCreatures; i++) {
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
		let creatures = this.creatures,
			totalCreatures = creatures.length,
			totalEffects = this.effects.length,
			creature: Creature,
			totalAbilities,
			i,
			j;

		for (i = totalCreatures - 1; i >= 0; i--) {
			creature = this.creatures[i];

			if (creature) {
				totalAbilities = creature.abilities.length;

				for (j = totalAbilities - 1; j >= 0; j--) {
					creature.abilities[j].triggeredThisChain = false;
				}
			}
		}

		for (i = 0; i < totalEffects; i++) {
			// @ts-expect-error 2339
			// `this.effects` might be the wrong type or need to look at `EffectTarget` type definition
			this.effects[i].triggeredThisChain = false;
		}
	}

	/* endGame()
	 *
	 * End the game and print stats
	 */
	endGame() {
		this.soundsys.stopMusic();
		this.endGameSound = this.soundsys.playSFX('sounds/drums');

		this.stopTimer();
		this.gameState = 'ended';

		//-------End bonuses--------//
		for (let i = 0; i < this.playerMode; i++) {
			// No fleeing
			if (!this.players[i].hasFled) {
				this.players[i].score.push({
					type: 'nofleeing',
				});
			}

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

	action(o, opt) {
		const defaultOpt = {
			callback: function () {},
		};

		opt = $j.extend(defaultOpt, opt);

		this.clearOncePerDamageChain();
		switch (o.action) {
			case 'move':
				this.activeCreature.moveTo(this.grid.hexes[o.target.y][o.target.x], {
					callback: opt.callback,
				});
				break;
			case 'skip':
				this.skipTurn({
					callback: opt.callback,
				});
				break;
			case 'delay':
				this.delayCreature({
					callback: opt.callback,
				});
				break;
			case 'flee':
				this.activeCreature.player.flee({
					callback: opt.callback,
				});
				break;
			case 'ability': {
				const args = $j.makeArray(o.args[1]);

				if (o.target.type == 'hex') {
					args.unshift(this.grid.hexes[o.target.y][o.target.x]);
					this.activeCreature.abilities[o.id].animation2({
						callback: opt.callback,
						arg: args,
					});
				}

				if (o.target.type == 'creature') {
					args.unshift(this.creatures[o.target.crea]);
					this.activeCreature.abilities[o.id].animation2({
						callback: opt.callback,
						arg: args,
					});
				}

				if (o.target.type == 'array') {
					const array = o.target.array.map((item) => this.grid.hexes[item.y][item.x]);

					args.unshift(array);
					this.activeCreature.abilities[o.id].animation2({
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
		this.endGameSound.pause();
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
		this.animationQueue = [];
		this.configData = {};
		this.match = {};
		this.gameplay = undefined;
		this.matchInitialized = false;
		this.firstKill = false;
		this.freezedInput = false;
		this.turnThrottle = false;
		this.turn = 0;

		this.gamelog.reset();
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

		const actions = [...log.actions];
		const numTotalActions = actions.length;
		const game = this;
		const configData = log.custom.configData;
		game.configData = log.custom.configData ?? game.configData;

		const nextAction = () => {
			if (actions.length === 0) {
				// this.activeCreature.queryMove(); // Avoid bug: called twice breaks opening UI (may need to revisit)
				return;
			}

			if (!DEBUG_DISABLE_GAME_STATUS_CONSOLE_LOG) {
				console.log(`${1 + numTotalActions - actions.length} / ${numTotalActions}`);
			}

			const interval = setInterval(() => {
				if (!game.freezedInput && !game.turnThrottle) {
					clearInterval(interval);
					game.activeCreature.queryMove();
					game.action(actions.shift(), {
						callback: nextAction,
					});
				}
			}, 100);
		};

		game.loadGame(configData, undefined, undefined, () => {
			setTimeout(() => nextAction(), 3000);
		});
	}
}
