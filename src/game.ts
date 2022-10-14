/* eslint-disable no-undef */
import * as $j from 'jquery';
import { Animations } from './animations';
import { CreatureQueue } from './creature_queue';
import { GameLog } from './utility/gamelog';
import { SoundSys } from './sound/soundsys';
import { MusicPlayer } from './sound/musicplayer';
import { Hex } from './utility/hex';
import { HexGrid } from './utility/hexgrid';
import { getUrl } from './assetLoader';
import { Player } from './player';
import { UI } from './ui/interface';
import { Creature } from './creature';
import dataJson from './data/units.json';
import 'pixi';
import 'p2';
import Phaser, { Signal } from 'phaser';
import MatchI from './multiplayer/match';
import Gameplay from './multiplayer/gameplay';
import { sleep } from './utility/time';
import { Ability } from './ability';
import { Effect } from './effect';
import { Client, Session } from '@heroiclabs/nakama-js';
import { MSGtype, TriggersObjectType } from './CreatureTypes';
import { Sprite } from 'phaser-ce';

/* Game Class
 *
 * Game contains all Game elements and functions.
 * It's the root element and defined only one time through the G variable.
 *
 * NOTE: Constructor does nothing because the G object must be defined
 * before creating other class instances. The game setup is triggered
 * to really start the game.
 */

export default class Game {
	/* Attributes
	 *
	 * NOTE : attributes and variables starting with $ are jQuery elements
	 * and jQuery functions can be called directly from them.
	 *
	 * // jQuery attributes
	 * $combatFrame :	Combat element containing all graphics except the UI
	 */
	// Game elements
	players: Array<Player>; // Contains Player objects ordered by player ID (0 to 3)
	creatures: Array<Creature>; // Contains Creature objects (creatures[creature.id]) start at index 1

	grid: any; //Grid object
	UI: UI; // UI object

	queue: CreatureQueue; // queue of creatures to manage phase order

	turn: number; // Current's turn number

	// Normal attributes
	playerMode: number; //Number of players in the game
	activeCreature: Creature; //Current active creature object reference
	creatureIdCounter: number; //Creature ID counter used for creature creation
	creatureData: Array<Creature>; //Array containing all data for the creatures

	//jQuery Elements
	$combatFrame: any;

	//Constructor Types
	version: string; //Current Development Version
	abilities: Array<Ability>; //List of all the abilities in the game
	effects: Array<Effect>; //List of all the Effects currently in the game
	matchid: number; //Current ID of the match
	playersReady: boolean; //True if all players have agreed to start
	preventSetup: boolean; //True if setup phase is over
	animations: Animations; //Create Animations for the game
	pause: boolean; ///True if the game if paused (offline)
	gameState: string; //Current Game State
	pauseTime: number; //Time the game has been paused for disconnect
	minimumTurnBeforeFleeing: number; //Turns before player is kicked
	availableCreatures: Array<Creature>; //Creatures each player can use
	animationQueue: Array<number>; //Animations animation ids
	checkTimeFrequency: number; //Time to check if an action has occured
	gamelog: GameLog; //Main Gamelog object
	configData: any; //All the preset settings for the game
	match: MatchI; //The main match info object
	gameplay: Gameplay; //The main gameplay object
	session: Session; //The main session information object
	client: Client; //The main client information object
	connect: any; //The main connect information object (Cannot Find it)
	debugMode: string | undefined | boolean; //Is the game in debug mode
	multiplayer: boolean; //Is the game in multiplayer
	matchInitialized: boolean; //Has the match loaded
	realms: Array<string>; //Array of Characters that represents which realm it is
	availableMusic: Array<string>; // Array of all the types of music the plyaer owns
	soundEffects: Array<string>; // Array containing all the sound effects that will be needed in the game
	inputMethod: string; //Controls the user will use
	startMatchTime: Date; //Current Time of when the match starts
	plasma_amount: number; //Amount of plasma current player can take from
	timePool: number; //Amount of time in the game
	turnTimePool: number; //Amount of time in the turn
	timeInterval: any;
	pauseStartTime: Date; //The exact time the game was paused
	windowResizeTimeout: NodeJS.Timeout; //Should there be a timeout when the player moves the corners of the screen
	abilityUpgrades: number; //How many times an ability has been upgraded
	unitDrops: number; //The amount of drops each unit has

	//Gameplay properties
	firstKill: boolean; //True if that was the first kill
	freezedInput: boolean; //True if a player's input is frozen
	turnThrottle: boolean; //True if turnThrottle is on

	Phaser: Phaser.Game; //The main Phaser Object
	//Additional Object Types
	triggers: TriggersObjectType; //All of the current Triggers currently happening
	msg: MSGtype; //MSG with data of current actions in game

	//Sound Types
	musicPlayer: MusicPlayer; //The main music player object
	soundsys: SoundSys; //The main sound system object
	signals: any;
	soundLoaded: any; //Object to see what sounds work
	endGameSound: any; //What sound should the game play when it's over

	background_image: string; //The location of the image the user needdsx

	//ID types
	trapId: number; //ID of each trap set
	effectId: number; //ID of each effect currently in the game
	dropId: number; //ID of each drop in the game

	constructor(version: string) {
		this.version = version || 'dev';
		this.abilities = [];
		this.players = [];
		this.creatures = [];
		this.effects = [];
		this.activeCreature = {} as Creature;
		this.activeCreature.id = 0;
		this.matchid = null;
		this.playersReady = false;
		this.preventSetup = false;
		this.animations = new Animations(this);
		this.queue = new CreatureQueue(this);
		this.creatureIdCounter = 1;
		this.creatureData = [];
		this.pause = false;
		this.gameState = 'initialized';
		this.pauseTime = 0;
		this.minimumTurnBeforeFleeing = 12;
		this.availableCreatures = [];
		this.animationQueue = [];
		this.checkTimeFrequency = 1000;
		this.gamelog = new GameLog(null, this);
		this.configData = {};
		this.match = {} as MatchI;
		this.gameplay = {} as Gameplay;
		this.session = null;
		this.client = null;
		this.connect = null;
		this.debugMode = process.env.DEBUG_MODE;
		this.multiplayer = false;
		this.matchInitialized = false;
		this.realms = ['A', 'E', 'G', 'L', 'P', 'S', 'W'];
		this.availableMusic = [];
		this.soundEffects = [
			'sounds/step',
			'sounds/swing',
			'sounds/swing2',
			'sounds/swing3',
			'sounds/heartbeat',
			'sounds/drums',
			'sounds/upgrade',
		];
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
					materializeUnit: (plasmaCost) => {
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

		const signalChannels = ['ui', 'metaPowers', 'creature'];
		this.signals = this.setupSignalChannels(signalChannels);
	}

	dataLoaded(data: any[]) {
		const dpcolor = ['blue', 'orange', 'green', 'red'];

		this.creatureData = data;

		data.forEach((creature: { playable: any; id: any; realm: any; level: any; name: any; type: any; drop: { name: string; }; }) => {
			if (!creature.playable) {
				return;
			}

			let creatureId = creature.id,
				realm = creature.realm,
				level = creature.level,
				type = realm.toUpperCase() + level,
				name = creature.name,
				count: number,
				i: number;

			creature.type = type;

			// Load unit shouts
			this.soundsys.getSound(getUrl('units/shouts/' + name), 1000 + creatureId);

			// Load artwork
			this.getImage(getUrl('units/artwork/' + name));

			if (name == 'Dark Priest') {
				for (i = 0, count = dpcolor.length; i < count; i++) {
					this.Phaser.load.image(
						name + dpcolor[i] + '_cardboard',
						getUrl('units/cardboards/' + name + ' ' + dpcolor[i]),
					);
					this.getImage(getUrl('units/avatars/' + name + ' ' + dpcolor[i]));
				}
			} else {
				if (creature.drop) {
					this.Phaser.load.image(
						'drop_' + creature.drop.name,
						getUrl('drops/' + creature.drop.name),
					);
				}

				this.Phaser.load.image(name + '_cardboard', getUrl('units/cardboards/' + name));
				this.getImage(getUrl('units/avatars/' + name));
			}

			// For code compatibility
			this.availableCreatures[creatureId] = type;
		});

		this.Phaser.load.start();
	}

	/* loadGame(setupOpt) preload
	 *
	 * setupOpt :	Object :	Setup options from matchmaking menu
	 *
	 * Load all required game files
	 */

	loadGame(setupOpt: Phaser.IGameConfig | { playerMode: number; creaLimitNbr: number; unitDrops: number; abilityUpgrades: number; plasma_amount: number; turnTimePool: number; timePool: number; background_image: string | number | string[]; fullscreenMode: boolean; }, matchInitialized: boolean, matchid: number) {
		// Need to remove keydown listener before new game start
		// to prevent memory leak and mixing hotkeys between start screen and game
		$j(document).off('keydown');

		if (this.multiplayer && !matchid) {
			this.matchInitialized = matchInitialized;
		}
		if (matchid) {
			this.matchid = matchid;
		}

		let totalSoundEffects = this.soundEffects.length,
			i: number;
		this.gameState = 'loading';
		if (setupOpt) {
			this.gamelog.gameConfig = setupOpt;
			this.configData = setupOpt;
			$j.extend(this, setupOpt);
		}
		// console.log(this);
		this.startLoading();

		// Sounds
		this.musicPlayer = new MusicPlayer();
		this.soundLoaded = {};
		this.soundsys = new SoundSys({}, this);

		for (i = 0; i < totalSoundEffects; i++) {
			this.soundsys.getSound(getUrl(this.soundEffects[i]), this.availableMusic.length + i);
		}

		this.Phaser.load.onFileComplete.add(this.loadFinish, this);

		// Health
		const playerColors = ['red', 'blue', 'orange', 'green'];
		for (i = 0; i < 4; i++) {
			this.Phaser.load.image('p' + i + '_health', getUrl('interface/rectangle_' + playerColors[i]));
			this.Phaser.load.image('p' + i + '_plasma', getUrl('interface/capsule_' + playerColors[i]));
			this.Phaser.load.image(
				'p' + i + '_frozen',
				getUrl('interface/rectangle_frozen_' + playerColors[i]),
			);
		}

		// Ability SFX
		this.Phaser.load.audio('MagmaSpawn0', getUrl('units/sfx/Infernal 0'));

		// Grid
		this.Phaser.load.image('hex', getUrl('interface/hex'));
		this.Phaser.load.image('hex_dashed', getUrl('interface/hex_dashed'));
		this.Phaser.load.image('hex_path', getUrl('interface/hex_path'));
		this.Phaser.load.image('cancel', getUrl('interface/cancel'));
		this.Phaser.load.image('input', getUrl('interface/hex_input'));
		for (i = 0; i < 4; i++) {
			this.Phaser.load.image('hex_p' + i, getUrl('interface/hex_glowing_' + playerColors[i]));
			this.Phaser.load.image('hex_hover_p' + i, getUrl('interface/hex_outline_' + playerColors[i]));
		}

		// Traps
		this.Phaser.load.image('trap_royal-seal', getUrl('units/sprites/Gumble - Royal Seal'));
		this.Phaser.load.image('trap_mud-bath', getUrl('units/sprites/Swine Thug - Mud Bath'));
		this.Phaser.load.image(
			'trap_scorched-ground',
			getUrl('units/sprites/Infernal - Scorched Ground'),
		);
		this.Phaser.load.image('trap_firewall', getUrl('units/sprites/Infernal - Scorched Ground'));
		this.Phaser.load.image('trap_poisonous-vine', getUrl('units/sprites/Impaler - Poisonous Vine'));

		// Effects
		this.Phaser.load.image('effects_fiery-touch', getUrl('units/sprites/Abolished - Fiery Touch'));
		this.Phaser.load.image(
			'effects_fissure-vent',
			getUrl('units/sprites/Infernal - Scorched Ground'),
		);
		this.Phaser.load.image(
			'effects_freezing-spit',
			getUrl('units/sprites/Snow Bunny - Freezing Spit'),
		);

		// Background
		this.Phaser.load.image('background', getUrl('locations/' + this.background_image + '/bg'));

		// Get JSON files
		this.dataLoaded(dataJson);
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
			i: number;

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

	/* Setup(playerMode)
	 *
	 * playerMode :	Ideally 2 or 4, number of players to configure
	 *
	 * Launch the game with the given number of player.
	 *
	 */
	setup(playerMode: number) {
		let bg, i: number;

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
		bg.events.onInputUp.add((Sprite: Sprite, Pointer: { button: any; }) => {
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
					this.UI.showCreature(this.activeCreature.type, this.activeCreature.player.id, 'portrait');
					break;
			}
		}, this);

		// Reset global counters
		this.trapId = 0;
		this.effectId = 0;
		this.dropId = 0;
		this.creatureIdCounter = 1;

		this.grid = new HexGrid({}, this); // Create Hexgrid

		this.startMatchTime = new Date();

		this.$combatFrame = $j('#combatframe');
		this.$combatFrame.show();

		// Remove loading screen
		$j('#matchMaking').hide();

		for (i = 0; i < playerMode; i++) {
			const player = new Player(i, this);
			this.players.push(player);

			// Initialize players' starting positions
			let pos = {};

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

		this.UI = new UI(this); // Create UI (not before because some functions require creatures to already exist)

		// DO NOT CALL LOG BEFORE UI CREATION
		this.gameState = 'playing';

		this.log('Welcome to Ancient Beast pre-Alpha', "");
		this.log('Setting up a ' + playerMode + ' player match', "");

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
		}.bind: any(this);

		// Handle resize events
		$j(window).resize(() => {
			// Throttle down to 1 event every 100ms of inactivity
			resizeGame();
		});

		this.soundsys.playMusic();
		if (this.gamelog.data) {
			// TODO: Remove the need for a timeout here by having a proper
			// "game is ready to play" event that can trigger log replays if
			// they are queued. -- ktiedt
			setTimeout(() => {
				this.gamelog.play.apply(this.gamelog);
			}, 1000);
		}

		this.matchInit();
	}
	async matchInit() {
		if (this.multiplayer) {
			if (Object.keys(this.match).length === 0) {
				await this.connect.serverConnect(this.session);
				const match = new MatchI(this.connect, this, this.session);
				const gameplay = new Gameplay(this, match);
				match.gameplay = gameplay;
				this.gameplay = gameplay;
				this.match = match;

				// Only host
				if (this.matchInitialized) {
					const n = await this.match.matchCreate();

					console.log('created match', n);
					await match.matchMaker(n, this.configData);
				}
			}
			// Non-host
			if (this.matchid) {
				const n = await this.match.matchJoin(this.matchid);
				console.log('joined match', n);
			}
		}
	}
	async matchJoin() {
		await this.matchInit();
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

		if (!this.match.matchUsers.length) {
			$j('.lobby-no-matches').removeClass('hide');
			return;
		}

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
	/* resizeCombatFrame()
	 *
	 * Resize the combat frame
	 */
	resizeCombatFrame() {
		if ($j('#cardwrapper').width() < $j('#card').width()) {
			$j('#cardwrapper_inner').width();
		}
	}

	/* nextRound()
	 *
	 * Replace the current queue with the next queue
	 */
	nextRound() {
		let totalCreatures = this.creatures.length,
			i: number;

		this.turn++;
		this.log('Round ' + this.turn, 'roundmarker', true);
		this.queue.nextRound();

		// Resets values
		for (i = 0; i < totalCreatures; i++) {
			if (this.creatures[i] instanceof Creature) {
				this.creatures[i].delayable = true;
				this.creatures[i].delayed = false;
			}
		}

		this.onStartOfRound();

		this.nextCreature();
	}

	/* nextCreature()
	 *
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

				if (this.queue.isCurrentEmpty()) {
					this.nextRound(); // Switch to the next Round
					return;
				} else {
					const next = this.queue.dequeue();
					if (this.activeCreature) {
						differentPlayer = this.activeCreature.player != next.player;
					} else {
						differentPlayer = true;
					}

					const last = this.activeCreature;
					this.activeCreature = next; // Set new activeCreature

					if (!last.dead) {
						last.updateHealth(false); // Update health display due to active creature change
					}
				}

				if (this.activeCreature.player.hasLost) {
					this.nextCreature();
					return;
				}

				// Play heartbeat sound on other player's turn
				if (differentPlayer) {
					this.soundsys.playSound(this.soundLoaded[4], this.soundsys.heartbeatGainNode);
				}

				this.log('Active Creature : %CreatureName' + this.activeCreature.id + '%', "");
				this.activeCreature.activate();
				// console.log(this.activeCreature);

				// Show mini tutorial in the first round for each player
				if (this.turn == 1) {
					this.log('The active unit has a flashing hexagon', "");
					this.log('It uses a plasma field to protect itself', "");
					this.log('Its portrait is displayed in the upper left', "");
					this.log("Under the portrait are the unit's abilities", "");
					this.log('The ones with revealed icons are usable', "");
					this.log('Use the last one to materialize a creature', "");
					this.log('Making units drains your plasma points', "");
					this.log('Press the hourglass icon to skip the turn', "");
					this.log('%CreatureName' + this.activeCreature.id + '%, press here to toggle tutorial!', "");
				}

				// Updates UI to match new creature
				this.UI.updateActivebox();
				this.updateQueueDisplay(null);
				if (this.multiplayer && this.playersReady) {
					this.gameplay.updateTurn();
				} else {
					this.playersReady = true;
				}
			}, 50);
		}, 300);
	}

	updateQueueDisplay(excludeActiveCreature: null) {
		if (this.UI) {
			this.UI.updateQueueDisplay(excludeActiveCreature);
		}
	}

	/* log(obj)
	 *
	 * obj :	Any :	Any variable to display in console and game log
	 *
	 * Display obj in the console log and in the game log
	 */
	log(obj: any, htmlclass: string, ifNoTimestamp = false) {
		// Formating
		let stringConsole = obj,
			stringLog = obj,
			totalCreatures = this.creatures.length,
			creature: Creature,
			i: string | number;

		for (i = 0; i < totalCreatures; i++) {
			creature = this.creatures[i];

			if (creature instanceof Creature) {
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

		console.log(stringConsole);
		this.UI.chat.addMsg(stringLog, htmlclass, ifNoTimestamp);
	}

	togglePause() {
		if (this.freezedInput && this.pause) {
			this.pause = false;
			this.freezedInput = false;
			this.pauseTime += new Date().getTime() - this.pauseStartTime.getTime();
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

	/* skipTurn()
	 *
	 * End turn for the current unit
	 */
	skipTurn(o: { tooltip?: any; callback?: any; noTooltip?: any; }) {
		// Removes temporary Creature from queue when Player skips turn
		// while choosing materialize location for Creature
		this.queue.removeTempCreature();

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

		if (!o.noTooltip) {
			this.activeCreature.hint(o.tooltip, 'msg_effects');
		}

		setTimeout(() => {
			this.turnThrottle = false;
			this.UI.btnSkipTurn.changeState('normal');

			if (
				!this.activeCreature.hasWait &&
				this.activeCreature.delayable &&
				!this.queue.isCurrentEmpty()
			) {
				this.UI.btnDelay.changeState('normal');
			}

			o.callback.apply();
		}, 1000);

		this.activeCreature.facePlayerDefault();

		const skipTurn = new Date();
		const p = this.activeCreature.player;
		p.totalTimePool = p.totalTimePool - (skipTurn.getTime() - p.startTime);
		this.pauseTime = 0;
		this.activeCreature.deactivate(false);
		this.nextCreature();

		// Reset temporary Creature
		this.queue.tempCreature = {} as Creature;
	}

	/* delayCreature()
	 *
	 * Delay the action turn of the current creature
	 */
	delayCreature(o: { callback: any; }) {
		// Send skip turn to server
		if (this.multiplayer) {
			this.gameplay.delay();
		}

		if (this.turnThrottle) {
			return;
		}

		if (
			this.activeCreature.hasWait ||
			!this.activeCreature.delayable ||
			this.queue.isCurrentEmpty()
		) {
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
			if (
				!this.activeCreature.hasWait &&
				this.activeCreature.delayable &&
				!this.queue.isCurrentEmpty()
			) {
				this.UI.btnDelay.changeState('slideIn');
			}

			o.callback.apply();
		}, 1000);

		const skipTurn = new Date(),
			p = this.activeCreature.player;

		p.totalTimePool = p.totalTimePool - (skipTurn.getTime() - p.startTime);
		this.activeCreature.wait();
		this.nextCreature();
	}

	startTimer() {
		clearInterval(this.timeInterval);
		this.activeCreature.player.startTime = new Date().getTime() - this.pauseTime;
		this.checkTime();

		this.timeInterval = setInterval(() => {
			this.checkTime();
		}, this.checkTimeFrequency);
	}

	stopTimer() {
		clearInterval(this.timeInterval);
	}

	/* checkTime()
	 */
	checkTime() {
		let date = new Date().getTime() - this.pauseTime,
			p = this.activeCreature.player,
			alertTime = 5, // In seconds
			msgStyle = 'msg_effects',
			totalPlayers = this.playerMode,
			i: number;

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

		// Turn time and timepool not infinite
		if (this.timePool > 0 && this.turnTimePool > 0) {
			if (
				(date - p.startTime) / 1000 > this.turnTimePool ||
				p.totalTimePool - (date - p.startTime) < 0
			) {
				if (p.totalTimePool - (date - p.startTime) < 0) {
					p.deactivate(); // Only if timepool is empty
				}

				this.skipTurn(null);
				return;
			} else {
				if ((p.totalTimePool - (date - p.startTime)) / 1000 < alertTime) {
					msgStyle = 'damage';
				}

				if (this.turnTimePool - (date - p.startTime) / 1000 < alertTime && this.UI.dashopen) {
					// Alert
					this.UI.btnToggleDash.changeState('glowing');
					this.activeCreature.hint(
						Math.ceil(this.turnTimePool - (date - p.startTime) / 1000),
						msgStyle,
					);
				}
			}
		} else if (this.turnTimePool > 0) {
			// Turn time is not infinite
			if ((date - p.startTime) / 1000 > this.turnTimePool) {
				this.skipTurn(null);
				return;
			} else {
				if (this.turnTimePool - (date - p.startTime) / 1000 < alertTime && this.UI.dashopen) {
					// Alert
					this.UI.btnToggleDash.changeState('glowing');
					this.activeCreature.hint(
						Math.ceil(this.turnTimePool - (date - p.startTime) / 1000),
						msgStyle,
					);
				}
			}
		} else if (this.timePool > 0) {
			// Timepool is not infinite
			if (p.totalTimePool - (date - p.startTime) < 0) {
				p.deactivate();
				this.skipTurn(null);
				return;
			} else {
				if (p.totalTimePool - (date - p.startTime) < alertTime) {
					msgStyle = 'damage';
				}

				if (this.turnTimePool - (date - p.startTime) / 1000 < alertTime && this.UI.dashopen) {
					// Alert
					this.UI.btnToggleDash.changeState('glowing');
					this.activeCreature.hint(
						Math.ceil(this.turnTimePool - (date - p.startTime) / 1000),
						msgStyle,
					);
				}
			}
		}
	}

	/* retrieveCreatureStats(type)
	 *
	 * type :	Creature's type (ex: "0" for Dark Priest and "L2" for Magma Spawn)
	 *
	 * Query the database for creature stats
	 */
	retrieveCreatureStats(type: string) {
		let totalCreatures = this.creatureData.length,
			i: number;

		for (i = totalCreatures - 1; i >= 0; i--) {
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

	triggerAbility(trigger: string, arg: IArguments | any[], retValue: boolean | void) {
		const [triggeredCreature, required] = arg;

		// For triggered creature
		triggeredCreature.abilities.forEach((ability: { getTrigger: () => any; require: (arg0: any) => any; animation: (arg0: any) => any; }) => {
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
						retValue = ability.animation();
					}
				}
			});
		});

		return retValue;
	}

	triggerEffect(trigger: string, arg: IArguments | any[], retValue: boolean) : boolean {
		const [triggeredCreature, required] = arg;

		// For triggered creature
		triggeredCreature.effects.forEach((effect: { trigger: any; activate: (arg0: any) => any; }) => {
			if (triggeredCreature.dead === true) {
				return;
			}

			if (this.triggers[trigger].test(effect.trigger)) {
				retValue = effect.activate(required);
			}
		});

		// For other creatures
		this.creatures.forEach((creature) => {
			if (creature instanceof Creature) {
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

	triggerTrap(trigger: string, arg: IArguments | [any]) {
		const [triggeredCreature] = arg;

		triggeredCreature.hexagons.forEach((hex: { activateTrap: (arg0: any, arg1: any) => void; }) => {
			hex.activateTrap(this.triggers[trigger], triggeredCreature);
		});
	}

	triggerDeleteEffect(trigger: string, creature: Creature) {

		let effects = trigger == 'all' ? this.effects : creature.effects,
			totalEffects = effects.length,
			i: number;

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
					effect.target.updateHealth(false);
				}

				i--;
				totalEffects--;
			}
		}
	}

	onStepIn(creature: Creature, hex: Hex, opts: { callbackStepIn?: (arg0: Hex) => void; ignoreTraps?: any; }) {
		this.triggerAbility('onStepIn', arguments);
		this.triggerEffect('onStepIn', arguments, null);
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
		this.triggerEffect('onStepOut', arguments, null);
		// Check traps last; this is because traps add effects triggered by
		// this event, which gets triggered again via G.triggerEffect. Otherwise
		// the trap's effects will be triggered twice.
		this.triggerTrap('onStepOut', arguments);
	}

	onReset(creature: Creature) {
		this.triggerDeleteEffect('onReset', creature);
		this.triggerAbility('onReset', arguments);
		this.triggerEffect('onReset', [creature, creature], null);
	}

	// Removed individual args from definition because we are using the arguments variable.
	onStartPhase(/* creature, callback */) {
		let creature = arguments[0],
			totalTraps = this.grid.traps.length,
			trap: { turnLifetime: number; creationTurn: number; fullTurnLifetime: any; ownerCreature: Creature; destroy: () => void; },
			i: number;

		for (i = 0; i < totalTraps; i++) {
			trap = this.grid.traps[i];

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
		this.triggerEffect('onStartPhase', [creature, creature], null);
	}

	// Removed individual args from definition because we are using the arguments variable.
	onEndPhase(/* creature, callback */) {
		const creature = arguments[0];

		this.triggerDeleteEffect('onEndPhase', creature);
		this.triggerAbility('onEndPhase', arguments);
		this.triggerEffect('onEndPhase', [creature, creature], null);
	}

	// Removed individual args from definition because we are using the arguments variable.
	onStartOfRound(/* creature, callback */) {
		this.triggerDeleteEffect('all', this.activeCreature);
	}

	// Removed individual args from definition because we are using the arguments variable.
	onCreatureMove(/* creature, hex, callback */) {
		this.triggerAbility('onCreatureMove', arguments);
	}

	// Removed individual args from definition because we are using the arguments variable.
	onCreatureDeath(/* creature, callback */) {
		const creature = arguments[0];

		this.triggerAbility('onCreatureDeath', arguments);
		this.triggerEffect('onCreatureDeath', [creature, creature], null);

		// Looks for traps owned by this creature and destroy them
		this.grid.traps
			.filter(
				(trap: { turnLifetime: number; fullTurnLifetime: any; ownerCreature: any; }) => trap.turnLifetime > 0 && trap.fullTurnLifetime && trap.ownerCreature == creature,
			)
			.forEach((trap: { destroy: () => any; }) => trap.destroy());

		// Look for effects owned by this creature and destroy them if necessary
		this.effects
			.filter((effect) => effect.owner === creature && effect.deleteOnOwnerDeath)
			.forEach((effect) => {
				effect.deleteEffect();
				// Update UI in case effect changes it
				if (effect.target) {
					effect.target.updateHealth(false);
				}
			});
	}

	onCreatureSummon(creature: Creature, callback: any) {
		this.triggerAbility('onCreatureSummon', [creature, creature, callback]);
		this.triggerEffect('onCreatureSummon', [creature, creature], null);
	}

	// Removed individual args from definition because we are using the arguments variable.
	onEffectAttach(creature: Creature, effect: any /*, callback */) {
		this.triggerEffect('onEffectAttach', [creature, effect], null);
	}

	onUnderAttack(creature: Creature, damage: any) {
		this.triggerAbility('onUnderAttack', arguments, damage);
		this.triggerEffect('onUnderAttack', arguments, damage);
		return damage;
	}

	// Removed individual args from definition because we are using the arguments variable.
	onDamage(/* creature, damage */) {
		this.triggerAbility('onDamage', arguments);
		this.triggerEffect('onDamage', arguments, null);
	}

	// Removed individual args from definition because we are using the arguments variable.
	onHeal(/* creature, amount */) {
		this.triggerAbility('onHeal', arguments);
		this.triggerEffect('onHeal', arguments, null);
	}

	onAttack(creature: Creature, damage: any) {
		this.triggerAbility('onAttack', arguments, damage);
		this.triggerEffect('onAttack', arguments, damage);
	}

	findCreature(o: any) {
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
			creature: Creature,
			match: boolean,
			wrongTeam: boolean,
			i: number;

		for (i = 0; i < totalCreatures; i++) {
			creature = creatures[i];

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

		return ret;
	}

	clearOncePerDamageChain() {
		let creatures = this.creatures,
			totalCreatures = creatures.length,
			totalEffects = this.effects.length,
			creature: Creature,
			totalAbilities: number,
			i: number,
			j: number;

			console.log("Vob: ",this.creatures)

		for (i = totalCreatures - 1; i >= 0; i--) {
			creature = this.creatures[i];

			totalAbilities = creature.abilities.length;

			for (j = totalAbilities - 1; j >= 0; j--) {
				creature.abilities[j].triggeredThisChain = false;
			}
		}

		for (i = 0; i < totalEffects; i++) {
			this.effects[i].triggeredThisChain = false;
		}
	}

	/* endGame()
	 *
	 * End the game and print stats
	 */
	endGame() {
		this.soundsys.stopMusic();
		this.endGameSound = this.soundsys.playSound(this.soundLoaded[5], this.soundsys.effectsGainNode);

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

	action(o: any, opt: { callback: any; }) {
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
					const array = o.target.array.map((item: { y: string | number; x: string | number; }) => this.grid.hexes[item.y][item.x]);

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

	getImage(url: string) {
		const img = new Image();
		img.src = url;
		img.onload = function () {
			// No-op
		};
	}

	resetGame() {
		this.endGameSound.stop();
		this.UI.showGameSetup();
		this.stopTimer();
		this.players = [];
		this.creatures = [];
		this.effects = [];
		this.activeCreature.id = 0;
		this.matchid = null;
		this.playersReady = false;
		this.preventSetup = false;
		this.animations = new Animations(this);
		this.queue = new CreatureQueue(this);
		this.creatureIdCounter = 1;
		this.creatureData = [];
		this.pause = false;
		this.gameState = 'initialized';
		this.availableCreatures = [];
		this.animationQueue = [];
		this.configData = {};
		this.match = {} as MatchI;
		this.gameplay = {} as Gameplay;
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
	setupSignalChannels(channels: any[]) {
		const signals = channels.reduce((acc: any, curr: any) => {
			return {
				...acc,
				[curr]: new Signal(),
			};
		}, {});

		return signals;
	}
}
