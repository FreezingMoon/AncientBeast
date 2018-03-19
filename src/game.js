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
import dataJson from 'assets/units/data.json';

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
	 *
	 * // Game elements
	 * players :			Array :	Contains Player objects ordered by player ID (0 to 3)
	 * creatures :			Array :	Contains Creature objects (creatures[creature.id]) start at index 1
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
	 * creatureIdCounter :		Integer :	Creature ID counter used for creature creation
	 * creatureData :		Array :		Array containing all data for the creatures
	 *
	 */
	constructor(version) {
		this.version = version || 'dev';
		this.abilities = [];
		this.players = [];
		this.creatures = [];
		this.effects = [];
		this.activeCreature = {
			id: 0
		};
		this.preventSetup = true;
		this.animations = new Animations(this);
		this.turn = 0;
		this.queue = new CreatureQueue(this);
		this.creatureIdCounter = 1;
		this.creatureData = [];
		this.creatureJSON = [];
		this.pause = false;
		this.gameState = 'initialized';
		this.pauseTime = 0;
		this.minimumTurnBeforeFleeing = 12;
		this.availableCreatures = [];
		this.animationQueue = [];
		this.checkTimeFrequency = 1000;
		this.gamelog = new GameLog(null, this);
		this.debugMode = false;
		this.realms = ['A', 'E', 'G', 'L', 'P', 'S', 'W'];
		this.loadedCreatures = [
			0, // Dark Priest
			37, // Swine Thug
			3, // Uncle Fungus
			4, // Magma Spawn
			45, // Chimera
			12, // Snow Bunny
			5, // Impaler
			14, // Gumble
			7, // Abolished
			40, // Nutcase
			9, // Nightmare
			39, // Headless
			44, // Scavenger
			31 // Cyber Hound
			//6, // Ice Demon
			//22, // Lava Mollusk
			//33, // Golden Wyrm
		];
		this.availableMusic = [];
		this.soundEffects = [
			'sounds/step',
			'sounds/swing',
			'sounds/swing2',
			'sounds/swing3',
			'sounds/heartbeat'
		];
		this.inputMethod = 'Mouse';

		// Gameplay properties
		this.firstKill = false;
		this.freezedInput = false;
		this.turnThrottle = false;

		// Phaser
		this.Phaser = new Phaser.Game(1920, 1080, Phaser.AUTO, 'combatwrapper', {
			update: this.phaserUpdate.bind(this),
			render: this.phaserRender.bind(this)
		});

		// Messages
		// TODO: Move strings to external file in order to be able to support translations
		// https://github.com/FreezingMoon/AncientBeast/issues/923
		this.msg = {
			abilities: {
				notarget: 'No targets available.',
				noplasma: 'Not enough plasma.',
				nopsy: 'Psyhelm overload: too many units!',
				alreadyused: 'This ability has already been used.',
				toomuch: 'Too much %stat%.',
				notenough: 'Not enough %stat%.',
				notmoveable: 'This creature cannot be moved.',
				passivecycle: 'Switches between any usable abilities.',
				passiveunavailable: 'No usable abilities to switch to.'
			},
			ui: {
				dash: {
					materialize_overload: 'Overload! Maximum number of units controlled'
				}
			}
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
			oncePerDamageChain: /\boncePerDamageChain\b/
		};
	}

	dataLoaded(data) {
		let dpcolor = ['blue', 'orange', 'green', 'red'];

		this.creatureData = data;

		data.forEach((creature, idx, arr) => {
			let creatureId = creature.id,
				realm = creature.realm,
				level = creature.level,
				type = realm.toUpperCase() + level,
				name = creature.name,
				count,
				i;

			creature.type = type;

			if (this.loadedCreatures.indexOf(creatureId) === -1) {
				// No need to load sounds and artwork
				return;
			}
			// Load unit shouts
			this.soundsys.getSound(getUrl('units/shouts/' + name), 1000 + creatureId);

			// Load artwork
			this.getImage(getUrl('units/artwork/' + name));

			if (name == 'Dark Priest') {
				for (i = 0, count = dpcolor.length; i < count; i++) {
					this.Phaser.load.image(
						name + dpcolor[i] + '_cardboard',
						getUrl('units/cardboards/' + name + ' ' + dpcolor[i])
					);
					this.getImage(getUrl('units/avatars/' + name + ' ' + dpcolor[i]));
				}
			} else {
				if (creature.drop) {
					this.Phaser.load.image(
						'drop_' + creature.drop.name,
						getUrl('drops/' + creature.drop.name)
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
	loadGame(setupOpt) {
		let totalSoundEffects = this.soundEffects.length,
			defaultOpt = {
				playerMode: 2,
				creaLimitNbr: 7,
				unitDrops: 1,
				abilityUpgrades: 4,
				plasma_amount: 50,
				turnTimePool: 60,
				timePool: 5 * 60,
				background_image: 'Frozen Skull'
			},
			i;

		this.gamelog.gameConfig = setupOpt;
		this.gameState = 'loading';
		// setupOpt = $j.extend(defaultOpt, setupOpt);
		$j.extend(this, setupOpt);

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
		let playerColors = ['red', 'blue', 'orange', 'green'];
		for (i = 0; i < 4; i++) {
			this.Phaser.load.image('p' + i + '_health', getUrl('interface/rectangle_' + playerColors[i]));
			this.Phaser.load.image('p' + i + '_plasma', getUrl('interface/capsule_' + playerColors[i]));
			this.Phaser.load.image(
				'p' + i + '_frozen',
				getUrl('interface/rectangle_frozen_' + playerColors[i])
			);
		}

		// Ability SFX
		this.Phaser.load.audio('MagmaSpawn0', getUrl('units/sfx/Magma Spawn 0'));

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
		// TODO: Load these sprites only after the specific unit has been materialized
		this.Phaser.load.image('trap_royal-seal', getUrl('units/sprites/Gumble - Royal Seal'));
		this.Phaser.load.image('trap_mud-bath', getUrl('units/sprites/Swine Thug - Mud Bath'));
		this.Phaser.load.image(
			'trap_scorched-ground',
			getUrl('units/sprites/Magma Spawn - Scorched Ground')
		);
		this.Phaser.load.image('trap_firewall', getUrl('units/sprites/Magma Spawn - Scorched Ground'));
		this.Phaser.load.image('trap_poisonous-vine', getUrl('units/sprites/Impaler - Poisonous Vine'));

		// Effects
		this.Phaser.load.image('effects_fiery-touch', getUrl('units/sprites/Abolished - Fiery Touch'));
		this.Phaser.load.image(
			'effects_fissure-vent',
			getUrl('units/sprites/Magma Spawn - Scorched Ground')
		);
		this.Phaser.load.image(
			'effects_freezing-spit',
			getUrl('units/sprites/Snow Bunny - Freezing Spit')
		);

		// Background
		this.Phaser.load.image('background', getUrl('locations/' + this.background_image + '/bg'));

		// Get JSON files
		this.dataLoaded(dataJson);
	}

	startLoading() {
		$j('#gameSetupContainer').hide();
		$j('#loader').show();
		$j('body').css('cursor', 'wait');
	}

	loadFinish() {
		let progress = this.Phaser.load.progress,
			loadingBarWidth = 355,
			progressWidth = progress + '%';

		$j('#barLoader .progress').css('width', progressWidth);

		if (progress == 100) {
			setTimeout(() => {
				this.gameState = 'loaded';

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

		$j('#loader').hide();
		$j('body').css('cursor', 'default');
		this.setup(this.playerMode);
	}

	/* Setup(playerMode)
	 *
	 * playerMode :		Integer :	Ideally 2 or 4, number of players to configure
	 *
	 * Launch the game with the given number of player.
	 *
	 */
	setup(playerMode) {
		let bg, i;

		// Phaser
		this.Phaser.scale.pageAlignHorizontally = true;
		this.Phaser.scale.pageAlignVertically = true;
		this.Phaser.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
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
					this.UI.showCreature(this.activeCreature.type, this.activeCreature.player.id);
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
			let player = new Player(i, this);
			this.players.push(player);

			// Initialize players' starting positions
			let pos = {};

			if (playerMode > 2) {
				// If 4 players
				switch (player.id) {
					case 0:
						pos = {
							x: 0,
							y: 1
						};
						break;
					case 1:
						pos = {
							x: 15,
							y: 1
						};
						break;
					case 2:
						pos = {
							x: 0,
							y: 7
						};
						break;
					case 3:
						pos = {
							x: 15,
							y: 7
						};
						break;
				}
			} else {
				// If 2 players
				switch (player.id) {
					case 0:
						pos = {
							x: 0,
							y: 4
						};
						break;
					case 1:
						pos = {
							x: 14,
							y: 4
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

		this.log('Welcome to Ancient Beast pre-Alpha');
		this.log('Setting up a ' + playerMode + ' player match');

		this.timeInterval = setInterval(() => {
			this.checkTime();
		}, this.checkTimeFrequency);

		this.nextCreature();

		this.resizeCombatFrame(); // Resize while the game is starting
		this.UI.resizeDash();

		// Handle resize events
		$j(window).resize(() => {
			// Throttle down to 1 event every 100ms of inactivity
			clearTimeout(this.windowResizeTimeout);
			this.windowResizeTimeout = setTimeout(() => {
				this.resizeCombatFrame();
				this.UI.resizeDash();
			}, 100);
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
			i;

		this.grid.clearHexViewAlterations();
		this.turn++;
		this.log('Round ' + this.turn, 'roundmarker');
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
			let interval = setInterval(() => {
				if (!this.freezedInput) {
					clearInterval(interval);

					let differentPlayer = false;

					if (this.queue.isCurrentEmpty()) {
						this.nextRound(); // Switch to the next Round
						return;
					} else {
						let next = this.queue.dequeue();
						if (this.activeCreature) {
							differentPlayer = this.activeCreature.player != next.player;
						} else {
							differentPlayer = true;
						}

						let last = this.activeCreature;
						this.activeCreature = next; // Set new activeCreature
						// Update health display due to active creature change
						last.updateHealth();
					}

					if (this.activeCreature.player.hasLost) {
						this.nextCreature();
						return;
					}

					// Play heartbeat sound on other player's turn
					if (differentPlayer) {
						this.soundsys.playSound(this.soundLoaded[4], this.soundsys.heartbeatGainNode);
					}

					this.log('Active Creature : %CreatureName' + this.activeCreature.id + '%');
					this.activeCreature.activate();

					// Show mini tutorial in the first round for each player
					if (this.turn == 1) {
						this.log('The active unit has a flashing hexagon');
						this.log('It uses a plasma field to protect itself');
						this.log('Its portrait is displayed in the upper left');
						this.log("Under the portrait are the unit's abilities");
						this.log('The ones with flashing icons are usable');
						this.log('Use the last one to materialize a unit');
						this.log('Making units drains your plasma points');
						this.log('Press the hourglass icon to skip the turn');
						this.log(
							'%CreatureName' + this.activeCreature.id + '%, press here to toggle tutorial!'
						);
					}

					// Updates UI to match new creature
					this.UI.updateActivebox();
					this.updateQueueDisplay();
				}
			}, 50);
		}, 300);
	}

	updateQueueDisplay(excludeActiveCreature) {
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
	log(obj, htmlclass) {
		// Formating
		let stringConsole = obj,
			stringLog = obj,
			totalCreatures = this.creatures.length,
			creature,
			i;

		for (i = 0; i < totalCreatures; i++) {
			creature = this.creatures[i];

			if (creature instanceof Creature) {
				stringConsole = stringConsole.replace(
					'%CreatureName' + i + '%',
					creature.player.name + "'s " + creature.name
				);
				stringLog = stringLog.replace(
					'%CreatureName' + i + '%',
					"<span class='" + creature.player.color + "'>" + creature.name + '</span>'
				);
			}
		}

		console.log(stringConsole);
		this.UI.chat.addMsg(stringLog, htmlclass);
	}

	togglePause() {
		if (this.freezedInput && this.pause) {
			this.pause = false;
			this.freezedInput = false;
			this.pauseTime += new Date() - this.pauseStartTime;
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
	skipTurn(o) {
		if (this.turnThrottle) {
			return;
		}

		o = $j.extend(
			{
				callback: function() {},
				noTooltip: false,
				tooltip: 'Skipped'
			},
			o
		);

		this.turnThrottle = true;
		this.UI.btnSkipTurn.changeState('disabled');
		this.UI.btnDelay.changeState('disabled');

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

		this.grid.clearHexViewAlterations();
		this.activeCreature.facePlayerDefault();

		let skipTurn = new Date();
		let p = this.activeCreature.player;
		p.totalTimePool = p.totalTimePool - (skipTurn - p.startTime);
		this.pauseTime = 0;
		this.activeCreature.deactivate(false);
		this.nextCreature();
	}

	/* delayCreature()
	 *
	 * Delay the action turn of the current creature
	 */
	delayCreature(o) {
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
				callback: function() {}
			},
			o
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
				this.UI.btnDelay.changeState('normal');
			}

			o.callback.apply();
		}, 1000);

		let skipTurn = new Date(),
			p = this.activeCreature.player;

		p.totalTimePool = p.totalTimePool - (skipTurn - p.startTime);
		this.activeCreature.wait();
		this.nextCreature();
	}

	startTimer() {
		clearInterval(this.timeInterval);
		this.activeCreature.player.startTime = new Date() - this.pauseTime;
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
		let date = new Date() - this.pauseTime,
			p = this.activeCreature.player,
			alertTime = 5, // In seconds
			msgStyle = 'msg_effects',
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

		// Turn time and timepool not infinite
		if (this.timePool > 0 && this.turnTimePool > 0) {
			if (
				(date - p.startTime) / 1000 > this.turnTimePool ||
				p.totalTimePool - (date - p.startTime) < 0
			) {
				if (p.totalTimePool - (date - p.startTime) < 0) {
					p.deactivate(); // Only if timepool is empty
				}

				this.skipTurn();
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
						msgStyle
					);
				}
			}
		} else if (this.turnTimePool > 0) {
			// Turn time is not infinite
			if ((date - p.startTime) / 1000 > this.turnTimePool) {
				this.skipTurn();
				return;
			} else {
				if (this.turnTimePool - (date - p.startTime) / 1000 < alertTime && this.UI.dashopen) {
					// Alert
					this.UI.btnToggleDash.changeState('glowing');
					this.activeCreature.hint(
						Math.ceil(this.turnTimePool - (date - p.startTime) / 1000),
						msgStyle
					);
				}
			}
		} else if (this.timePool > 0) {
			// Timepool is not infinite
			if (p.totalTimePool - (date - p.startTime) < 0) {
				p.deactivate();
				this.skipTurn();
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
						msgStyle
					);
				}
			}
		}
	}

	/* retreiveCreatureStats(type)
	 *
	 * type :	String :	Creature's type (ex: "0" for Dark Priest and "L2" for Magma Spawn)
	 *
	 * Query the database for creature stats
	 */
	retreiveCreatureStats(type) {
		let totalCreatures = this.creatureData.length,
			i;

		for (i = totalCreatures - 1; i >= 0; i--) {
			if (this.creatureData[i].type == type) {
				return this.creatureData[i];
			}
		}
	}

	triggerAbility(trigger, arg, retValue) {
		let [triggeredCreature, required] = arg;

		// For triggered creature
		triggeredCreature.abilities.forEach(ability => {
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
		this.creatures.forEach(creature => {
			if (triggeredCreature === creature || creature.dead === true) {
				return;
			}

			creature.abilities.forEach(ability => {
				if (this.triggers[trigger + '_other'].test(ability.getTrigger())) {
					if (ability.require(required)) {
						retValue = ability.animation(required, triggeredCreature);
					}
				}
			});
		});
	}

	triggerEffect(trigger, arg, retValue) {
		let [triggeredCreature, required] = arg;

		// For triggered creature
		triggeredCreature.effects.forEach(effect => {
			if (triggeredCreature.dead === true) {
				return;
			}

			if (this.triggers[trigger].test(effect.trigger)) {
				retValue = effect.activate(required);
			}
		});

		// For other creatures
		this.creatures.forEach(creature => {
			if (creature instanceof Creature) {
				if (triggeredCreature === creature || creature.dead === true) {
					return;
				}

				creature.effects.forEach(effect => {
					if (this.triggers[trigger + '_other'].test(effect.trigger)) {
						retValue = effect.activate(required);
					}
				});
			}
		});
	}

	triggerTrap(trigger, arg) {
		let [triggeredCreature, required] = arg;

		triggeredCreature.hexagons.forEach(hex => {
			hex.activateTrap(this.triggers[trigger], triggeredCreature);
		});
	}

	triggerDeleteEffect(trigger, creature) {
		let effects = creature == 'all' ? this.effects : creature.effects,
			totalEffects = effects.length,
			i;

		for (i = 0; i < totalEffects; i++) {
			let effect = effects[i];

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

	onStepOut(creature, hex, callback) {
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

	onStartPhase(creature, callback) {
		let totalTraps = this.grid.traps.length,
			trap,
			i;

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
		this.triggerEffect('onStartPhase', [creature, creature]);
	}

	onEndPhase(creature, callback) {
		this.triggerDeleteEffect('onEndPhase', creature);
		this.triggerAbility('onEndPhase', arguments);
		this.triggerEffect('onEndPhase', [creature, creature]);
	}

	onStartOfRound(creature, callback) {
		this.triggerDeleteEffect('onStartOfRound', 'all');
	}

	onCreatureMove(creature, hex, callback) {
		this.triggerAbility('onCreatureMove', arguments);
	}

	onCreatureDeath(creature, callback) {
		let totalTraps = this.grid.traps.length,
			totalEffects = this.effects.length,
			trap,
			effect,
			i;

		this.triggerAbility('onCreatureDeath', arguments);
		this.triggerEffect('onCreatureDeath', [creature, creature]);
		// Looks for traps owned by this creature and destroy them
		for (i = 0; i < totalTraps; i++) {
			trap = this.grid.traps[i];

			if (trap === undefined) {
				continue;
			}

			if (trap.turnLifetime > 0 && trap.fullTurnLifetime && trap.ownerCreature == creature) {
				trap.destroy();
				i--;
			}
		}
		// Look for effects owned by this creature and destroy them if necessary
		for (i = 0; i < totalEffects; i++) {
			effect = this.effects[i];
			if (effect.owner === creature && effect.deleteOnOwnerDeath) {
				effect.deleteEffect();
				// Update UI in case effect changes it
				if (effect.target) {
					effect.target.updateHealth();
				}
				i--;
			}
		}
	}

	onCreatureSummon(creature, callback) {
		this.triggerAbility('onCreatureSummon', [creature, creature, callback]);
		this.triggerEffect('onCreatureSummon', [creature, creature]);
	}

	onEffectAttach(creature, effect, callback) {
		this.triggerEffect('onEffectAttach', [creature, effect]);
	}

	onUnderAttack(creature, damage) {
		this.triggerAbility('onUnderAttack', arguments, damage);
		this.triggerEffect('onUnderAttack', arguments, damage);
		return damage;
	}

	onDamage(creature, damage) {
		this.triggerAbility('onDamage', arguments);
		this.triggerEffect('onDamage', arguments);
	}

	onHeal(creature, amount) {
		this.triggerAbility('onHeal', arguments);
		this.triggerEffect('onHeal', arguments);
	}

	onAttack(creature, damage) {
		damage = this.triggerAbility('onAttack', arguments, damage);
		damage = this.triggerEffect('onAttack', arguments, damage);
	}

	findCreature(o) {
		let ret = [],
			o2 = $j.extend(
				{
					team: -1, // No team
					type: '--' // Dark Priest
				},
				o
			),
			creatures = this.creatures,
			totalCreatures = creatures.length,
			creature,
			match,
			wrongTeam,
			i;

		for (i = 0; i < totalCreatures; i++) {
			creature = creatures[i];

			if (creature instanceof Creature) {
				match = true;

				$j.each(o2, function(key, val) {
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
			creature,
			totalAbilities,
			i,
			j;

		for (i = totalCreatures - 1; i >= 0; i--) {
			creature = this.creatures[i];

			if (creature instanceof Creature) {
				totalAbilities = creature.abilities.length;

				for (j = totalAbilities - 1; j >= 0; j--) {
					creature.abilities[j].triggeredThisChain = false;
				}
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
		this.stopTimer();
		this.gameState = 'ended';

		// Calculate the time cost of the last turn
		let skipTurn = new Date(),
			p = this.activeCreature.player;

		p.totalTimePool = p.totalTimePool - (skipTurn - p.startTime);

		// Show Score Table
		$j('#endscreen').show();

		let $table = $j('#endscreen table tbody');

		// Delete uncessary columns if only 2 players
		if (this.playerMode == 2) {
			$table
				.children('tr')
				.children('td:nth-child(even)')
				.remove();
			$table = $j('#endscreen table tbody');
		}

		// Fill the board
		for (let i = 0; i < this.playerMode; i++) {
			// Each player
			// TimeBonus
			if (this.timePool > 0) {
				this.players[i].bonusTimePool = Math.round(this.players[i].totalTimePool / 1000);
			}
			//-------End bonuses--------//

			// No fleeing
			if (!this.players[i].hasFled && !this.players[i].hasLost) {
				this.players[i].score.push({
					type: 'nofleeing'
				});
			}

			// Surviving Creature Bonus
			let immortal = true;
			for (let j = 0; j < this.players[i].creatures.length; j++) {
				if (!this.players[i].creatures[j].dead) {
					if (this.players[i].creatures[j].type != '--') {
						this.players[i].score.push({
							type: 'creaturebonus',
							creature: this.players[i].creatures[j]
						});
					} else {
						// Dark Priest Bonus
						this.players[i].score.push({
							type: 'darkpriestbonus'
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
					type: 'immortal'
				});
			}

			//----------Display-----------//
			let colId = this.playerMode > 2 ? i + 2 + ((i % 2) * 2 - 1) * Math.min(1, i % 3) : i + 2;

			// Change Name
			$table
				.children('tr.player_name')
				.children('td:nth-child(' + colId + ')') // Weird expression swaps 2nd and 3rd player
				.text(this.players[i].name);

			// Change score
			$j.each(this.players[i].getScore(), function(index, val) {
				let text = val === 0 && index !== 'total' ? '--' : val;
				$table
					.children('tr.' + index)
					.children('td:nth-child(' + colId + ')') // Weird expression swaps 2nd and 3rd player
					.text(text);
			});
		}

		// Declare winner
		if (this.playerMode > 2) {
			// 2 vs 2
			let score1 = this.players[0].getScore().total + this.players[2].getScore().total,
				score2 = this.players[1].getScore().total + this.players[3].getScore().total;

			if (score1 > score2) {
				// Left side wins
				$j('#endscreen p').text(
					this.players[0].name + ' and ' + this.players[2].name + ' won the match!'
				);
			} else if (score1 < score2) {
				// Right side wins
				$j('#endscreen p').text(
					this.players[1].name + ' and ' + this.players[3].name + ' won the match!'
				);
			} else if (score1 == score2) {
				// Draw
				$j('#endscreen p').text('Draw!');
			}
		} else {
			// 1 vs 1
			let score1 = this.players[0].getScore().total,
				score2 = this.players[1].getScore().total;

			if (score1 > score2) {
				// Left side wins
				$j('#endscreen p').text(this.players[0].name + ' won the match!');
			} else if (score1 < score2) {
				// Right side wins
				$j('#endscreen p').text(this.players[1].name + ' won the match!');
			} else if (score1 == score2) {
				// Draw
				$j('#endscreen p').text('Draw!');
			}
		}
	}

	action(o, opt) {
		let defaultOpt = {
			callback: function() {}
		};

		opt = $j.extend(defaultOpt, opt);

		this.clearOncePerDamageChain();
		switch (o.action) {
			case 'move':
				this.activeCreature.moveTo(this.grid.hexes[o.target.y][o.target.x], {
					callback: opt.callback
				});
				break;
			case 'skip':
				this.skipTurn({
					callback: opt.callback
				});
				break;
			case 'delay':
				this.delayCreature({
					callback: opt.callback
				});
				break;
			case 'flee':
				this.activeCreature.player.flee({
					callback: opt.callback
				});
				break;
			case 'ability':
				let args = $j.makeArray(o.args[1]);

				if (o.target.type == 'hex') {
					args.unshift(this.grid.hexes[o.target.y][o.target.x]);
					this.activeCreature.abilities[o.id].animation2({
						callback: opt.callback,
						arg: args
					});
				}

				if (o.target.type == 'creature') {
					args.unshift(this.creatures[o.target.crea]);
					this.activeCreature.abilities[o.id].animation2({
						callback: opt.callback,
						arg: args
					});
				}

				if (o.target.type == 'array') {
					let array = o.target.array.map(item => this.grid.hexes[item.y][item.x]);

					args.unshift(array);
					this.activeCreature.abilities[o.id].animation2({
						callback: opt.callback,
						arg: args
					});
				}
				break;
		}
	}

	getImage(url) {
		let img = new Image();
		img.src = url;
		img.onload = function() {
			// No-op
		};
	}
}
