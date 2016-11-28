/*	Game Class
*
*	Game contains all Game element and Game mechanism function.
*	Its the root element and defined only one time through the G variable.
*
*	NOTE: Constructor does nothing because the G object must be defined
*	before creating other classes instances. The game setup is triggered
*	to really start the game
*
*/
var Game = Class.create( {
	/*	Attributes
	*
	*	NOTE : attributes and variables starting with $ are jquery elements
	*	and jquery functions can be called dirrectly from them.
	*
	*	// Jquery attributes
	*	$combatFrame :	Combat element containing all graphics except the UI
	*
	*	// Game elements
	*	players :			Array :	Containing Player objects ordered by player ID (0 to 3)
	*	creatures :			Array :	Contain creatures (creatures[creature.id]) start at index 1
	*
	*	grid :				Grid :	Grid object
	*	UI :				UI :	UI object
	*
	*	queue :				CreatureQueue :	queue of creatures to manage phase order
	*
	*	turn :				Integer :	Number of the current turn
	*
	*	// Normal attributes
	*	playerMode :		Integer :	Number of player in the game
	*	activeCreature :	Creature :	Current active creature object reference
	*	creaIdCounter :		Integer :	Creature ID counter used for creature creation
	*	creatureDatas :		Array :		Array containing all datas for the creatures
	*
	*/


	/*	Constructor
	*
	*	Only create few attributes
	*
	*/
	initialize: function() {
		this.abilities = [];
		this.players = [];
		this.p = this.players; // Convenience
		this.creatures = [];
		this.c = this.creatures; // Convenience
		this.effects = [];
		this.activeCreature = { id: 0 };
		this.animations = new Animations();
		this.turn = 0;
		this.queue = new CreatureQueue();
		this.creaIdCounter = 1;
		this.creatureDatas = [];
		this.creatureJSON = [];
		this.loadedSrc = 0;
		this.loadingSrc = 0;
		this.pause = false;
		this.gameState = "initialized";
		this.pauseTime = 0;
		this.minimumTurnBeforeFleeing = 12;
		this.availableCreatures = [];
		this.animationQueue = [];
		this.checkTimeFrequency = 1000;
		this.gamelog = new Gamelog();
		this.debugMode = false;
		this.realms = ["A", "E", "G", "L", "P", "S", "W"];
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
			31, // Cyber Hound
			//6, // Ice Demon
			//22, // Lava Mollusk
			//33, // Golden Wyrm
		];
		this.availableMusic = [];
		this.soundEffects = [
			"step.ogg",
			"swing.ogg",
			"swing2.ogg",
			"swing3.ogg",
			"heartbeat.ogg",
		];
		this.inputMethod = "Mouse";

		// Gameplay
		this.firstKill = false;
		this.freezedInput = false;
		this.turnThrottle = false;

		// Phaser
		this.Phaser = new Phaser.Game(1920, 1080, Phaser.AUTO, 'combatwrapper', { update:function() { G.phaserUpdate(); }, render:function() { G.phaserRender(); } });

		// Msg (TODO External file)
		this.msg = {
			abilities : {
				notarget	   : "No targets available.",
				noplasma	   : "Not enough plasma.",
				nopsy		   : "Psyhelm overload: too many units!",
				alreadyused	   : "Ability already used.",
				toomuch		   : "Too much %stat%.",
				notenough	   : "Not enough %stat%.",
				notmoveable        : "This creature cannot be moved.",
				passivecycle       : "Switch between any usable abilities.",
				passiveunavailable : "No usable abilities to switch to."
			},
			ui : {
				dash : {
					materialize_overload : "Overload! Maximum number of units controlled",
				}
			}
		};
	},


	/*	loadGame(setupOpt)
	*
	*	setupOpt :	Object :	Setup options from matchmaking menu
	*
	*	Load all required game files
	*/
	loadGame: function(setupOpt) {
		var defaultOpt = {
			playerMode : 2,
			creaLimitNbr : 7,
			unitDrops : 1,
			abilityUpgrades : 4,
			plasma_amount : 50,
			turnTimePool : 60,
			timePool : 5*60,
			background_image : "Frozen Skull",
		};

		this.gameState = "loading";
		setupOpt = $j.extend(defaultOpt,setupOpt);
		$j.extend(this,setupOpt);

		G.startLoading();

		dpcolor = ["blue", "orange", "green", "red"];

		this.loadingSrc = this.availableMusic.length // Music
		+ this.soundEffects.length // Sound effects
		+ 1 // Background
		+ 12 // Hexagons
		+ 8 // Health Frames
		+ 3 // Traps
		+ 2 // Effects
		;

		var i;

		// Music Loading
		this.soundLoaded = {};
		this.soundsys = new Soundsys();
		for (i = 0; i < this.availableMusic.length; i++) {
			this.soundsys.getSound("../media/music/" + this.availableMusic[i], i, function() { G.loadFinish(); } );
		}

		for (i = 0; i < this.soundEffects.length; i++) {
			this.soundsys.getSound("./sounds/" + this.soundEffects[i], this.availableMusic.length + i, function() { G.loadFinish(); } );
		}

		this.Phaser.load.onFileComplete.add(G.loadFinish,G);

		// Health
		var playerColors = ['red', 'blue', 'orange', 'green'];
		for (i = 0; i < 4; i++) {
			this.Phaser.load.image(
				'p' + i + '_health',
				'./interface/rectangle_' + playerColors[i] + '.png');
			this.Phaser.load.image(
				'p' + i + '_plasma',
				'./interface/capsule_' + playerColors[i] + '.png');
			this.Phaser.load.image(
				'p' + i + '_frozen',
				'./interface/rectangle_frozen_' + playerColors[i] + '.png');
		}

		// Grid
		this.Phaser.load.image('hex', './interface/hex.png');
		this.Phaser.load.image('hex_dashed', './interface/hex_dashed.png');
		this.Phaser.load.image('hex_path', './interface/hex_path.png');
		this.Phaser.load.image('cancel', './interface/cancel.png');
		this.Phaser.load.image('input', './interface/hex_input.png');
		for (i = 0; i < 4; i++) {
			this.Phaser.load.image(
				'hex_p' + i,
				'./interface/hex_glowing_' + playerColors[i] + '.png');
			this.Phaser.load.image(
				'hex_hover_p' + i,
				'./interface/hex_outline_' + playerColors[i] + '.png');
		}

		// Traps
		// TODO: Load these sprites only after the specific unit has been materialized
		this.Phaser.load.image('trap_royal-seal', './units/sprites/Gumble - Royal Seal.png');
		this.Phaser.load.image('trap_mud-bath', './units/sprites/Swine Thug - Mud Bath.png');
		this.Phaser.load.image('trap_scorched-ground', './units/sprites/Magma Spawn - Scorched Ground.png');
		this.Phaser.load.image('trap_firewall', './units/sprites/Magma Spawn - Scorched Ground.png');
		this.Phaser.load.image('trap_poisonous-vine', './units/sprites/Impaler - Poisonous Vine.png');

		// Effects
		this.Phaser.load.image('effects_fiery-touch', './units/sprites/Abolished - Fiery Touch.png');
		this.Phaser.load.image('effects_fissure-vent', './units/sprites/Magma Spawn - Fissure Vent.png');
		this.Phaser.load.image('effects_freezing-spit', './units/sprites/Snow Bunny - Freezing Spit.png');

		// Background
		this.Phaser.load.image('background', "locations/" + this.background_image + "/bg.jpg");

		// Get JSON files
		$j.getJSON("../units/data.json", function(json_in) {
			G.creatureJSON = json_in;

			G.creatureDatas = G.creatureJSON;

			for (var j = 0; j < G.loadedCreatures.length; j++) {

				var data = G.creatureJSON[G.loadedCreatures[j]];

				G.loadingSrc += 2;

				// Load unit shouts
				G.soundsys.getSound('../units/shouts/'+data.name+'.ogg', 1000+G.loadedCreatures[j], function() { G.loadFinish(); });
				// Load unit abilities
				//getScript('abilities/'+data.name+'.js', function() { G.loadFinish(); });
				// Load artwork
				getImage('../units/artwork/'+data.name+'.jpg', function() { G.loadFinish(); });

				if(data.name == "Dark Priest") {
					for (var i = 0; i < dpcolor.length; i++) {
						G.loadingSrc += 2;
						G.Phaser.load.image(data.name+dpcolor[i] + '_cardboard', '../units/cardboards/' + data.name+' ' + dpcolor[i] + '.png');
						getImage('../units/avatars/' + data.name+' ' + dpcolor[i] + '.jpg', function() { G.loadFinish(); });
					}
				}else{
					if(data.drop) {
						G.loadingSrc += 1;
						G.Phaser.load.image('drop_' + data.drop.name, 'drops/' + data.drop.name+'.png');
					}
					G.loadingSrc += 2;
					G.Phaser.load.image(data.name + '_cardboard', '../units/cardboards/' + data.name+'.png');
					getImage('../units/avatars/' + data.name + '.jpg', function() { G.loadFinish(); });
				}

				// For code compatibility
				G.availableCreatures[j] = data.type;
			}

			G.Phaser.load.start();
		});

	},

	startLoading: function() {
		$j("#gameSetupContainer").hide();
		$j("#loader").show();
	},

	loadFinish: function() {
		this.loadedSrc++;
		if(this.loadingSrc==this.loadedSrc) {
			$j("#loader").hide();
			G.setup(G.playerMode);
		}
	},

	phaserUpdate : function() {
		if( this.gameState != "playing" ) return;
	},

	phaserRender : function() {
		for (var i = 1; i < G.creatures.length; i++) {
			//G.Phaser.debug.renderSpriteBounds(G.creatures[i].sprite);
		}
	},


	/*	Setup(playerMode)
	*
	*	playerMode :		Integer :	Ideally 2 or 4, number of players to setup the game
	*
	*	Launch the game with the given number of player.
	*
	*/
	setup: function(playerMode) {

		// Phaser
		this.Phaser.scale.pageAlignHorizontally = true;
	  this.Phaser.scale.pageAlignVertically = true;
	  this.Phaser.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
	  this.Phaser.scale.setScreenSize(true);
		this.Phaser.stage.disableVisibilityChange = true;
		if (!this.Phaser.device.desktop) {
			this.Phaser.stage.forcePortrait = true;
		}

		var bg = this.Phaser.add.sprite(0, 0, 'background');
		bg.inputEnabled = true;
		bg.events.onInputUp.add(function(Sprite, Pointer) {
			if(G.freezedInput || G.UI.dashopen) return;
			switch (Pointer.button) {
				case 0:
					// Left mouse button pressed
					break;
				case 1:
					// Middle mouse button pressed
					break;
				case 2:
					// Right mouse button pressed
					G.UI.showCreature( G.activeCreature.type, G.activeCreature.player.id );
					break;
			}
		}, G);

		// Reseting global counters
		trapID = 0;
		effectId = 0;
		dropID = 0;
		this.creaIdCounter = 1;

		this.grid = new HexGrid(); // Creating Hexgrid

		this.startMatchTime = new Date();

		this.$combatFrame = $j("#combatframe");
		this.$combatFrame.show();

		// Remove loading screen
		$j("#matchMaking").hide();

		for (var i = 0; i < playerMode; i++) {
			var player = new Player(i);
			this.players.push(player);

			// Starting position
			var pos = {};
			if(playerMode>2) { // If 4 players
				switch(player.id) {
					case 0:
						pos = { x: 0, y: 1} ;
						break;
					case 1:
						pos = { x: 15, y: 1 };
						break;
					case 2:
						pos = { x: 0, y: 7 };
						break;
					case 3:
						pos = { x: 15, y: 7 };
						break;
				}
			}else{ // If 2 players
				switch(player.id) {
					case 0:
						pos = {x: 0, y: 4};
						break;
					case 1:
						pos = {x: 14, y: 4};
						break;
				}
			}

			player.summon("--", pos); // Summon Dark Priest

		}

		this.activeCreature = this.players[0].creatures[0]; // Prevent errors

		this.UI = new UI(); // Creating UI not before because certain function requires creature to exists

		// DO NOT CALL LOG BEFORE UI CREATION
		this.gameState = "playing";

		this.log("Welcome to Ancient Beast pre-Alpha");
		this.log("Setting up a " + playerMode + " player match");

		this.timeInterval = setInterval(function() {
			G.checkTime();
		},G.checkTimeFrequency);

		this.nextCreature();

		G.resizeCombatFrame(); // Resize while the game start
		G.UI.resizeDash();

		// Resize event
		$j(window).resize(function () {
			// Throttle down to 1 event every 500ms of inactivity
			clearTimeout(this.windowResizeTimeout);
			this.windowResizeTimeout = setTimeout(function() {
				G.resizeCombatFrame();
				G.UI.resizeDash();
			}, 100);
		});

		G.soundsys.playMusic();
	},


	/*	resizeCombatFrame()
	*
	*	Resize the combat frame
	*
	*/
	resizeCombatFrame: function() {
		// if( ($j(window).width() / 1920) > ($j(window).height() / 1080) ) {
		//	// $j("#tabwrapper").css({scale: $j(window).height() / 1080});
		//	this.$combatFrame.css({
		//		scale: $j(window).height() / 1080,
		//		"margin-left": -1920*($j(window).height()/1080)/2,
		//		"margin-top": -1080*($j(window).height()/1080)/2,
		//	});
		// }else{
		//	// $j("#tabwrapper").css({scale: $j(window).width() / 1080});
		//	this.$combatFrame.css({
		//		scale: $j(window).width() / 1920,
		//		"margin-left": -1920*($j(window).width()/1920)/2,
		//		"margin-top": -1080*($j(window).width()/1920)/2,
		//	});
		// }

		if( $j("#cardwrapper").width() < $j("#card").width() ) {
			$j("#cardwrapper_inner").width();
		}
	},


	/*	nextRound()
	*
	*	Replace the current Queue with the next queue.
	*
	*/
	nextRound: function() {
		G.grid.clearHexViewAlterations();
		this.turn++;
		this.log("Round " + this.turn, "roundmarker");
		this.queue.nextRound();

		// Resetting values
		for (var i = 0; i < this.creatures.length; i++) {
			if( this.creatures[i] instanceof Creature ) {
				this.creatures[i].delayable = true;
				this.creatures[i].delayed = false;
			}
		}

		G.triggersFn.onStartOfRound();

		this.nextCreature();
	},


	/*	nextCreature()
	*
	*	Activate the next creature in queue
	*
	*/
	nextCreature: function() {
		G.UI.closeDash(true); // True argument prevent calling the queryMove function before the next creature
		G.UI.btnToggleDash.changeState("normal");
		G.grid.xray( new Hex(-1, -1) ); // Clear Xray

		if(this.gameState == "ended") return;

		G.stopTimer();
		// Delay
		setTimeout(function() {
			var interval = setInterval(function() {
				if(!G.freezedInput) {
					clearInterval(interval);

					var differentPlayer = false;

					if (G.queue.isCurrentEmpty()) {
						G.nextRound(); // Go to next Round
						return; // End function
					} else {
						var next = G.queue.dequeue();
						if (G.activeCreature) {
							differentPlayer = G.activeCreature.player != next.player;
						} else {
							differentPlayer = true;
						}
						var last = G.activeCreature;
						G.activeCreature = next; // Set new creature active
						// Update health displays due to active creature change
						last.updateHealth();
					}

					if(G.activeCreature.player.hasLost) {
						G.nextCreature();
						return;
					}

					// Heart Beat sound for different player turns
					if(differentPlayer) {
						G.soundsys.playSound(G.soundLoaded[4], G.soundsys.heartbeatGainNode);
					}

					G.log("Active Creature : %CreatureName" + G.activeCreature.id + "%");
					G.activeCreature.activate();

					// Show mini tutorial in the first round for each player
					if(G.turn == 1) {
						G.log("The active unit has a flashing hexagon");
						G.log("It uses a plasma field to protect itself");
						G.log("Its portrait is displayed in the upper left");
						G.log("Under the portrait are the unit's abilities");
						G.log("The ones with flashing icons are usable");
						G.log("Use the last one to materialize a unit");
						G.log("Making units drains your plasma points");
						G.log("Press the hourglass icon to skip the turn");
						G.log("%CreatureName" + G.activeCreature.id + "%, press here to toggle tutorial!");
					}

					// Update UI to match new creature
					G.UI.updateActivebox();
					G.updateQueueDisplay();
				}
			},50);
		},300);
	},

	updateQueueDisplay: function(excludeActiveCreature) {
		if (this.UI) {
			this.UI.updateQueueDisplay(excludeActiveCreature);
		}
	},

	/*	log(obj)
	*
	*	obj :	Any :	Any variable to display in console and game log
	*
	*	Display obj in the console log and in the game log
	*
	*/
	log: function(obj,htmlclass) {
		// Formating
		var stringConsole = obj;
		var stringLog = obj;
		for (var i = 0; i < this.creatures.length; i++) {
			if( this.creatures[i] instanceof Creature ) {
				stringConsole = stringConsole.replace("%CreatureName" + i + "%", this.creatures[i].player.name + "'s " + this.creatures[i].name);
				stringLog = stringLog.replace("%CreatureName" + i + "%", "<span class='" + this.creatures[i].player.color + "'>" + this.creatures[i].name + "</span>");
			}
		}

		console.log(stringConsole);
		this.UI.chat.addMsg(stringLog,htmlclass);
	},

	togglePause: function() {
		if( G.freezedInput && G.pause ) {
			G.pause = false;
			G.freezedInput = false;
			G.pauseTime += new Date() - G.pauseStartTime;
			$j("#pause").remove();
			G.startTimer();
		}else if( !G.pause && !G.freezedInput ) {
			G.pause = true;
			G.freezedInput = true;
			G.pauseStartTime = new Date();
			G.stopTimer();
			$j("#ui").append('<div id="pause">Pause</div>');
		}
	},


	/*	skipTurn()
	*
	*	End turn for the current unit
	*
	*/
	skipTurn: function(o) {
		if(G.turnThrottle) return;

		o = $j.extend({
			callback: function() {},
			noTooltip: false,
			tooltip: 'Skipped'
		},o);

		G.turnThrottle = true;
		G.UI.btnSkipTurn.changeState("disabled");
		G.UI.btnDelay.changeState("disabled");

		if(!o.noTooltip) G.activeCreature.hint(o.tooltip, "msg_effects");

		setTimeout(function() {
			G.turnThrottle=false;
			G.UI.btnSkipTurn.changeState("normal");
			if (!G.activeCreature.hasWait &&
					G.activeCreature.delayable &&
					!G.queue.isCurrentEmpty()) {
				G.UI.btnDelay.changeState("normal");
			}
			o.callback.apply();
		},1000);
		G.grid.clearHexViewAlterations();
		this.activeCreature.facePlayerDefault();
		var skipTurn = new Date();
		var p = this.activeCreature.player;
		p.totalTimePool = p.totalTimePool - (skipTurn - p.startTime);
		G.pauseTime = 0;
		this.activeCreature.deactivate(false);
		this.nextCreature();
	},


	/*	delayCreature()
	*
	*	Delay the action turn of the current creature
	*
	*/
	delayCreature: function(o) {
		if (G.turnThrottle) return;
		if (this.activeCreature.hasWait ||
				!this.activeCreature.delayable ||
				G.queue.isCurrentEmpty()) {
			return;
		}

		o = $j.extend({
			callback: function() {},
		},o);

		G.turnThrottle = true;
		G.UI.btnSkipTurn.changeState("disabled");
		G.UI.btnDelay.changeState("disabled");

		setTimeout(function() {
			G.turnThrottle=false;
			G.UI.btnSkipTurn.changeState("normal");
			if (!G.activeCreature.hasWait &&
					G.activeCreature.delayable &&
					!G.queue.isCurrentEmpty()) {
				G.UI.btnDelay.changeState("normal");
			}
			o.callback.apply();
		},1000);
		var skipTurn = new Date();
		var p = this.activeCreature.player;
		p.totalTimePool = p.totalTimePool - (skipTurn - p.startTime);
		this.activeCreature.wait();
		this.nextCreature();
	},

	startTimer: function() {
		clearInterval(this.timeInterval);
		this.activeCreature.player.startTime = new Date() - G.pauseTime;
		G.checkTime();
		this.timeInterval = setInterval(function() {
			G.checkTime();
		},G.checkTimeFrequency);
	},

	stopTimer: function() {
		clearInterval(this.timeInterval);
	},

	/*	checkTime()
	*
	*/
	checkTime: function() {
		var date = new Date() - G.pauseTime;
		var p = this.activeCreature.player;
		var alertTime = 5; // In seconds
		var msgStyle = "msg_effects";

		p.totalTimePool = Math.max(p.totalTimePool, 0); // Clamp

		// Check all timepool
		var playerStillHaveTime = (this.timePool>0) ? false : true ; // So check is always true for infinite time
		for(var i = 0; i < this.playerMode; i++) { // Each player
			playerStillHaveTime = (this.players[i].totalTimePool > 0) || playerStillHaveTime;
		}

		// Check Match Time
		if( !playerStillHaveTime ) {
			G.endGame();
			return;
		}

		G.UI.updateTimer();

		if( this.timePool > 0 && this.turnTimePool > 0 ) { // Turn time and timepool not infinite
			if( (date - p.startTime)/1000 > this.turnTimePool || p.totalTimePool - (date - p.startTime) < 0 ) {
				if( p.totalTimePool - (date - p.startTime) < 0 )
					p.deactivate(); // Only if timepool is empty
				G.skipTurn();
				return;
			}else{
				if( (p.totalTimePool - (date - p.startTime))/1000 < alertTime ) {
					msgStyle = "damage";
				}
				if( this.turnTimePool - ((date - p.startTime)/1000) < alertTime && G.UI.dashopen) {
					// Alert
					G.UI.btnToggleDash.changeState("glowing");
					this.activeCreature.hint( Math.ceil( this.turnTimePool - ((date - p.startTime)/1000)),msgStyle);
				}
			}
		}else if( this.turnTimePool > 0 ) { // Turn time not infinite
			if( (date - p.startTime)/1000 > this.turnTimePool ) {
				G.skipTurn();
				return;
			}else{
				if( this.turnTimePool - ((date - p.startTime)/1000) < alertTime && G.UI.dashopen) {
					// Alert
					G.UI.btnToggleDash.changeState("glowing");
					this.activeCreature.hint( Math.ceil( this.turnTimePool - ((date - p.startTime)/1000)),msgStyle);
				}
			}
		}else if( this.timePool > 0 ) { // Timepool not infinite
			if( p.totalTimePool - (date - p.startTime) < 0 ) {
				p.deactivate();
				G.skipTurn();
				return;
			}else{
				if( p.totalTimePool - (date - p.startTime) < alertTime ) {
					msgStyle = "damage";
				}
				if( this.turnTimePool - ((date - p.startTime)/1000) < alertTime && G.UI.dashopen) {
					// Alert
					G.UI.btnToggleDash.changeState("glowing");
					this.activeCreature.hint( Math.ceil( this.turnTimePool - ((date - p.startTime)/1000)),msgStyle);
				}
			}
		}
	},


	/*	retreiveCreatureStats(type)
	*
	*	type :	String :	Creature type (ex: "0" for Dark Priest and "L2" for Magma Spawn)
	*
	*	Query the database for creature stats
	*
	*/
	retreiveCreatureStats: function(type) {
		for (var i = this.creatureDatas.length - 1; i >= 0; i--) {
			if(this.creatureDatas[i].type == type) return this.creatureDatas[i];
		}
	},

	/*	Regex Test for triggers */
	triggers : {
		onStepIn : /\bonStepIn\b/,
		onStepOut : /\bonStepOut\b/,
		onReset: /\bonReset\b/,
		onStartPhase : /\bonStartPhase\b/,
		onEndPhase : /\bonEndPhase\b/,
		onMovement : /\bonMovement\b/,
		onUnderAttack : /\bonUnderAttack\b/,
		onDamage : /\bonDamage\b/,
		onHeal: /\bonHeal\b/,
		onAttack : /\bonAttack\b/,
		onCreatureMove : /\bonCreatureMove\b/,
		onCreatureDeath : /\bonCreatureDeath\b/,
		onCreatureSummon : /\bonCreatureSummon\b/,

		onStepIn_other : /\bonOtherStepIn\b/,
		onStepOut_other : /\bonOtherStepOut\b/,
		onReset_other : /\bonOtherReset\b/,
		onStartPhase_other : /\bonOtherStartPhase\b/,
		onEndPhase_other : /\bonOtherEndPhase\b/,
		onMovement_other : /\bonOtherMovement\b/,
		onAttack_other : /\bonOtherAttack\b/,
		onDamage_other : /\bonOtherDamage\b/,
		onHeal_other : /\bonOtherHeal\b/,
		onUnderAttack_other : /\bonOtherUnderAttack\b/,
		onCreatureMove_other : /\bonOtherCreatureMove\b/,
		onCreatureDeath_other : /\bonOtherCreatureDeath\b/,
		onCreatureSummon_other : /\bonOtherCreatureSummon\b/,

		onEffectAttach: /\bonEffectAttach\b/,
		onEffectAttach_other : /\bonOtherEffectAttach\b/,

		onStartOfRound : /\bonStartOfRound\b/,
		onQuery : /\bonQuery\b/,
		oncePerDamageChain : /\boncePerDamageChain\b/
	},

	triggerAbility : function( trigger, arg, retValue ) {

		// For triggered creature
		arg[0].abilities.each(function() {
			if( arg[0].dead === true ) return;
			if( G.triggers[trigger].test(this.getTrigger()) ) {
				if( this.require(arg[1]) ) {
					retValue = this.animation(arg[1]);
				}
			}
		});

		// For other creatures
		G.creatures.each(function() {
			if( arg[0] === this || this.dead === true ) return;
			this.abilities.each(function() {
				if( G.triggers[trigger+"_other"].test(this.getTrigger()) ) {
					if( this.require(arg[1]) ) {
						retValue = this.animation(arg[1], arg[0]);
					}
				}
			});
		});
	},

	triggerEffect : function( trigger, arg, retValue ) {

		// For triggered creature
		arg[0].effects.each(function() {
			if( arg[0].dead === true ) return;
			if( G.triggers[trigger].test(this.trigger) ) {
				retValue = this.activate(arg[1]);
			}
		});

		// For other creatures
		G.creatures.each(function() {
			if( this instanceof Creature) {
				if( arg[0] === this || this.dead === true ) return;
				this.effects.each(function() {
					if( G.triggers[ trigger + "_other" ].test(this.trigger) ) {
						retValue = this.activate(arg[1]);
					}
				});
			}
		});
	},

	triggerTrap : function( trigger, arg ) {
		arg[0].hexagons.each(function() {
			this.activateTrap(G.triggers[trigger], arg[0]);
		});
	},

	triggerDeleteEffect: function(trigger, creature) {
		var effects;
		if (creature == "all") {
			effects = G.effects;
		} else {
			effects = creature.effects;
		}
		for (var i = 0; i < effects.length; i++) {
			var effect = effects[i];
			if (effect.turnLifetime > 0 && trigger === effect.deleteTrigger &&
					G.turn-effect.creationTurn >= effect.turnLifetime) {
				effect.deleteEffect();
				// Update UI in case effect changes it
				if (effect.target) {
					effect.target.updateHealth();
				}
				i--;
			}
		}
	},

	triggersFn : {

		onStepIn: function(creature, hex, opts) {
			G.triggerAbility("onStepIn", arguments);
			G.triggerEffect("onStepIn", arguments);
			// Check traps last; this is because traps add effects triggered by
			// this event, which get triggered again via G.triggerEffect. Otherwise
			// the trap's effects will be triggered twice.
			if (!opts || !opts.ignoreTraps) {
				G.triggerTrap("onStepIn", arguments);
			}
		},

		onStepOut : function( creature, hex, callback ) {
			G.triggerAbility("onStepOut", arguments);
			G.triggerEffect("onStepOut", arguments);
			// Check traps last; this is because traps add effects triggered by
			// this event, which get triggered again via G.triggerEffect. Otherwise
			// the trap's effects will be triggered twice.
			G.triggerTrap("onStepOut", arguments);
		},

		onReset: function(creature) {
			G.triggerDeleteEffect("onReset", creature);
			G.triggerAbility("onReset", arguments);
			G.triggerEffect("onReset", [creature, creature]);
		},

		onStartPhase : function( creature, callback ) {
			for (var i = 0; i < G.grid.traps.length; i++) {
				trap = G.grid.traps[i];
				if(trap === undefined) continue;
				if(trap.turnLifetime > 0) {
					if(G.turn-trap.creationTurn >= trap.turnLifetime) {
						if(trap.fullTurnLifetime) {
							if(trap.ownerCreature == G.activeCreature) {
								trap.destroy();
								i--;
							}
						}else{
							trap.destroy();
							i--;
						}
					}
				}
			}
			G.triggerDeleteEffect("onStartPhase", creature);
			G.triggerAbility("onStartPhase", arguments);
			G.triggerEffect("onStartPhase", [creature, creature]);
		},

		onEndPhase : function( creature, callback ) {
			G.triggerDeleteEffect("onEndPhase", creature);
			G.triggerAbility("onEndPhase", arguments);
			G.triggerEffect("onEndPhase", [creature, creature]);
		},

		onStartOfRound : function( creature, callback ) {
			G.triggerDeleteEffect("onStartOfRound", "all");
		},

		onCreatureMove : function( creature, hex, callback ) {
			G.triggerAbility("onCreatureMove", arguments);
		},

		onCreatureDeath: function(creature, callback) {
			var i;
			G.triggerAbility("onCreatureDeath", arguments);
			G.triggerEffect("onCreatureDeath", [creature, creature]);
			// Look for traps owned by this creature and destroy them
			for (i = 0; i < G.grid.traps.length; i++) {
				var trap = G.grid.traps[i];
				if (trap === undefined) continue;
				if (trap.turnLifetime > 0 && trap.fullTurnLifetime &&
						trap.ownerCreature == creature) {
					trap.destroy();
					i--;
				}
			}
			// Look for effects owned by this creature and destroy them if necessary
			for (i = 0; i < G.effects.length; i++) {
				var effect = G.effects[i];
				if (effect.owner === creature && effect.deleteOnOwnerDeath) {
					effect.deleteEffect();
					// Update UI in case effect changes it
					if (effect.target) {
						effect.target.updateHealth();
					}
					i--;
				}
			}
		},

		onCreatureSummon : function( creature, callback ) {
			G.triggerAbility("onCreatureSummon", [creature, creature, callback]);
			G.triggerEffect("onCreatureSummon", [creature, creature]);
		},

		onEffectAttach: function(creature, effect, callback) {
			G.triggerEffect("onEffectAttach", [creature, effect]);
		},


		onUnderAttack: function(creature, damage) {
			G.triggerAbility("onUnderAttack", arguments, damage);
			G.triggerEffect("onUnderAttack", arguments, damage);
			return damage;
		},

		onDamage : function( creature, damage ) {
			G.triggerAbility("onDamage", arguments);
			G.triggerEffect("onDamage", arguments);
		},

		onHeal: function(creature, amount) {
			G.triggerAbility("onHeal", arguments);
			G.triggerEffect("onHeal", arguments);
		},

		onAttack : function( creature, damage ) {
			damage = G.triggerAbility("onAttack", arguments, damage);
			damage = G.triggerEffect("onAttack", arguments, damage);
		}
	},


	findCreature: function( o ) {
		var o = $j.extend( {
			team : -1, // No team
			type : "--" // Dark Priest
		},o);

		var ret = [];

		for (var i = 0; i < this.creatures.length; i++) {
			if( this.creatures[i] instanceof Creature ) {
				var match = true;
				$j.each(o,function(key,val) {

					if( key == "team" ) {
						if(val == -1) return;

						if(val instanceof Array) {
							var wrongTeam = true;
							if( val.indexOf( G.creatures[i][key] ) != -1 ) {
								wrongTeam = false;
							}
							if( wrongTeam ) match = false;
							return;
						}
					}

					if( G.creatures[i][key] != val ) {
						match = false;
					}
				});
				if(match) ret.push( this.creatures[i] );
			}
		}

		return ret;
	},

	clearOncePerDamageChain: function() {
		for (var i = this.creatures.length - 1; i >= 0; i--) {
			if(this.creatures[i] instanceof Creature) {
				for (var j = this.creatures[i].abilities.length - 1; j >= 0; j--) {
					this.creatures[i].abilities[j].triggeredThisChain = false;
				}
			}
		}

		for (var i = 0; i < G.effects.length; i++) {
			G.effects[i].triggeredThisChain = false;
		}
	},

	/*	endGame()
	*
	*	End the game and print stats
	*
	*/
	endGame: function() {
		this.stopTimer();
		this.gameState = "ended";

		// Calculate The time cost of the end turn
		var skipTurn = new Date();
		var p = this.activeCreature.player;
		p.totalTimePool = p.totalTimePool - (skipTurn - p.startTime);

		// Show Score Table
		$j("#endscreen").show();

		var $table = $j("#endscreen table tbody");

		if(this.playerMode==2) { // If Only 2 players remove the other 2 columns
			$table.children("tr").children("td:nth-child(even)").remove();
			var $table = $j("#endscreen table tbody");
		}

		// FILLING THE BOARD
		for(var i = 0; i < this.playerMode; i++) { // Each player

			// TimeBonus
			if(this.timePool > 0)
				this.players[i].bonusTimePool = Math.round(this.players[i].totalTimePool/1000);

			//-------Ending bonuses--------//
			// No fleeing
			if(!this.players[i].hasFled && !this.players[i].hasLost)
				this.players[i].score.push( { type: "nofleeing" } );
			// Surviving Creature Bonus
			var immortal = true;
			for(var j = 0; j < this.players[i].creatures.length; j++) {
				if(!this.players[i].creatures[j].dead) {
					if(this.players[i].creatures[j].type != "--")
						this.players[i].score.push( { type: "creaturebonus", creature: this.players[i].creatures[j] } );
					else // Dark Priest Bonus
						this.players[i].score.push( { type: "darkpriestbonus" } );
				}else{
					immortal = false;
				}
			}
			// Immortal
			if(immortal && this.players[i].creatures.length > 1) // At least 1 creature summoned
				this.players[i].score.push( { type: "immortal" } );

			//----------Display-----------//
			var colId = (this.playerMode>2) ?( i+2+((i%2)*2-1)*Math.min(1, i%3) ):i+2;

			// Change Name
			$table.children("tr.player_name").children("td:nth-child(" + colId + ")") // Weird expression swap 2nd and 3rd player
			.text(this.players[i].name);

			//Change score
			$j.each(this.players[i].getScore(),function(index, val) {
				var text = ( val === 0 && index !== "total") ? "--" : val ;
				$table.children("tr."+index).children("td:nth-child(" + colId + ")") // Weird expression swap 2nd and 3rd player
				.text(text);
			});
		}

		// Defining winner
		if(this.playerMode > 2) { //2vs2
			var score1 = this.players[0].getScore().total + this.players[2].getScore().total;
			var score2 = this.players[1].getScore().total + this.players[3].getScore().total;

			if( score1 > score2 ) {
				// Left side wins
				$j("#endscreen p").text(this.players[0].name + " and " + this.players[2].name + " won the match!");
			}else if( score1 < score2 ) {
				// Right side wins
				$j("#endscreen p").text(this.players[1].name + " and " + this.players[3].name + " won the match!");
			}else if( score1 == score2 ) {
				// Draw
				$j("#endscreen p").text("Draw!");
			}
		}else{ // 1vs1
			var score1 = this.players[0].getScore().total;
			var score2 = this.players[1].getScore().total;

			if( score1 > score2 ) {
				// Left side wins
				$j("#endscreen p").text(this.players[0].name + " won the match!");
			}else if( score1 < score2 ) {
				// Right side wins
				$j("#endscreen p").text(this.players[1].name + " won the match!");
			}else if( score1 == score2 ) {
				// Draw
				$j("#endscreen p").text("Draw!");
			}
		}
	},

	action : function(o,opt) {

		var defaultOpt = {
			callback : function() {},
		};
		opt = $j.extend(defaultOpt,opt);

		G.clearOncePerDamageChain();
		switch(o.action) {
			case "move":
				G.activeCreature.moveTo(G.grid.hexs[o.target.y][o.target.x], { callback: opt.callback } );
				break;
			case "skip":
				G.skipTurn( { callback: opt.callback } );
				break;
			case "delay":
				G.delayCreature( { callback: opt.callback } );
				break;
			case "flee":
				G.activeCreature.player.flee( { callback: opt.callback } );
				break;
			case "ability":
				var args = $j.makeArray(o.args[1]);
				if(o.target.type=="hex") {
					args.unshift(G.grid.hexs[o.target.y][o.target.x]);
					G.activeCreature.abilities[o.id].animation2( { callback: opt.callback, arg: args } );
				}
				if(o.target.type=="creature") {
					args.unshift(G.creatures[o.target.crea]);
					G.activeCreature.abilities[o.id].animation2( { callback: opt.callback, arg: args } );
				}
				if(o.target.type=="array") {
					var array = [];
					o.target.array.each(function() { array.push(G.grid.hexs[this.y][this.x]); } );
					args.unshift(array);
					G.activeCreature.abilities[o.id].animation2( { callback: opt.callback, arg: args } );
				}
				break;
		}
	},
});

/*	Player Class
*
*	Player object with attributes
*
*/
var Player = Class.create( {
	/*	Attributes
	*
	*	id :		Integer :	Id of the player 1, 2, 3 or 4
	*	creature :	Array :		Array containing players creatures
	*	plasma :	Integer :	Plasma amount for the player
	*	flipped :	Boolean :	Player side of the battlefield (affects displayed creature)
	*
	*/
	initialize: function(id) {
		this.id = id;
		this.creatures = [];
		this.name = "Player" + (id + 1);
		this.color =
		(this.id === 0)? "red"
		:(this.id == 1)? "blue"
		:(this.id == 2)? "orange"
		: "green";
		this.avatar = "../units/avatars/Dark Priest " + this.color + ".jpg";
		this.score = [];
		this.plasma = G.plasma_amount;
		this.flipped = !!(id%2); // Convert odd/even to true/false
		this.availableCreatures = G.availableCreatures;
		this.hasLost = false;
		this.hasFleed = false;
		this.bonusTimePool = 0;
		this.totalTimePool = G.timePool*1000;
		this.startTime = new Date();

		this.score = [{ type: "timebonus" }];
	},


	getNbrOfCreatures : function() {
		var nbr = -1;
		for(var i = 0; i < this.creatures.length; i++) {
			var crea = this.creatures[i];
			if( !crea.dead && !crea.undead ) nbr++;
		}
		return nbr;
	},


	/*	summon(type,pos)
	*
	*	type :	String :	Creature type (ex: "0" for Dark Priest and "L2" for Magma Spawn)
	*	pos :	Object :	Position {x,y}
	*
	*/
	summon: function(type, pos) {
		var data = G.retreiveCreatureStats(type);
		data = $j.extend(data, pos, { team: this.id }) ; // Create the full data for creature creation
		for (var i = G.creatureJSON.length - 1; i >= 0; i--) {
			if(
				G.creatureJSON[i].type == type &&
				i !== 0 ) // Avoid Dark Priest shout at the begining of a match
			{
				G.soundsys.playSound(G.soundLoaded[1000+i], G.soundsys.announcerGainNode);
			}
		}
		var creature = new Creature(data);
		this.creatures.push(creature);
		creature.summon();
		G.grid.updateDisplay(); // Retrace players creatures
		G.triggersFn.onCreatureSummon(creature);
	},

	/*	flee()
	*
	*	Ask if the player want to flee the match
	*
	*/
	flee: function(o) {
		this.hasFleed = true;
		this.deactivate();
		G.skipTurn(o);
	},


	/*	getScore()
	*
	*	return :	Integer :	The current score of the player
	*
	*	Return the total of the score events.
	*/
	getScore: function() {
		var totalScore = {
			firstKill : 0,
			kill : 0,
			deny : 0,
			humiliation : 0,
			annihilation : 0,
			timebonus : 0,
			nofleeing : 0,
			creaturebonus : 0,
			darkpriestbonus : 0,
			immortal : 0,
			total : 0,
		};
		for(var i = 0; i < this.score.length; i++) {
			var s = this.score[i];
			var points = 0;
			switch(s.type) {
				case "firstKill":
					points += 20;
					break;
				case "kill":
					points += s.creature.level*5;
					break;
				case "combo":
					points += s.kills*5;
					break;
				case "humiliation":
					points += 50;
					break;
				case "annihilation":
					points += 100;
					break;
				case "deny":
					points += -1*s.creature.size*5;
					break;
				case "timebonus":
					points += Math.round(this.bonusTimePool * 0.5);
					break;
				case "nofleeing":
					points += 25;
					break;
				case "creaturebonus":
					points += s.creature.level*5;
					break;
				case "darkpriestbonus":
					points += 50;
					break;
				case "immortal":
					points += 100;
					break;
			}
			totalScore[s.type] += points;
			totalScore.total += points;
		}
		return totalScore;
	},

	/*	isLeader()
	*
	*	Test if the player has the greater score.
	*	Return true if in lead. False if not.
	*/
	isLeader: function() {

		for(var i = 0; i < G.playerMode; i++) { // Each player
			// If someone has a higher score
			if(G.players[i].getScore().total > this.getScore().total) {
				return false; // He's not in lead
			}
		}

		return true; // If nobody has a better score he's in lead
	},


	/*	isAnnihilated()
	*
	*	A player is considered annihilated if all his creatures are dead DP included
	*/
	isAnnihilated: function() {
		var annihilated = (this.creatures.length>1);
		// annihilated is false if only one creature is not dead
		for(var i = 0; i < this.creatures.length; i++) {
			annihilated = annihilated && this.creatures[i].dead;
		}
		return annihilated;
	},

	/* deactivate()
	*
	*	Remove all player's creature from the queue
	*/
	deactivate: function() {
		this.hasLost = true;

		// Remove all player creatures from queues
		for(var i = 1; i < G.creatures.length; i++) {
			var crea = G.creatures[i];
			if(crea.player.id == this.id) {
				G.queue.remove(crea);
			}
		}
		G.updateQueueDisplay();

		// Test if allie Dark Priest is dead
		if( G.playerMode > 2) {
			// 2vs2
			if( G.players[ (this.id+2)%4 ].hasLost )
				G.endGame();
		}else{
			// 1vs1
			G.endGame();
		}
	},
});


var Gamelog = Class.create( {

	initialize: function(id) {
		this.datas = [];
		this.playing = false;
		this.timeCursor = -1;
	},

	add: function(action) {
		this.datas.push(action);
	},

	play: function(log) {

		if(log) {
			this.datas = log;
		}

		var fun = function() {
			G.gamelog.timeCursor++;
			if(G.debugMode) console.log(G.gamelog.timeCursor + "/" + G.gamelog.datas.length);
			if(G.gamelog.timeCursor>G.gamelog.datas.length-1) {
				G.activeCreature.queryMove(); // Avoid bug
				return;
			}
			var interval = setInterval(function() {
				if(!G.freezedInput && !G.turnThrottle) {
					clearInterval(interval);
					G.activeCreature.queryMove(); // Avoid bug
					G.action(G.gamelog.datas[G.gamelog.timeCursor], { callback: fun } );
				}
			},100);
		};
		fun();
	},

	next: function() {
		if(G.freezedInput || G.turnThrottle) return false;

		G.gamelog.timeCursor++;
		if(G.debugMode) console.log(G.gamelog.timeCursor + "/" + G.gamelog.datas.length);
		if(G.gamelog.timeCursor>G.gamelog.datas.length-1) {
			G.activeCreature.queryMove(); // Avoid bug
			return;
		}
		var interval = setInterval(function() {
			if(!G.freezedInput && !G.turnThrottle) {
				clearInterval(interval);
				G.activeCreature.queryMove(); // Avoid bug
				G.action(G.gamelog.datas[G.gamelog.timeCursor], { callback: function() { G.activeCreature.queryMove(); } });
			}
		},100);
	},

	get: function() {
		console.log(JSON.stringify(this.datas));
	}
});



var Soundsys = Class.create( {

	initialize: function(o) {
		o = $j.extend( {
			music_volume : 0.1,
			effects_volume : 0.6,
			heartbeats_volume : 0.3,
			announcer_volume : 0.6
		}, o);

		$j.extend(this,o);

		window.AudioContext = window.AudioContext || window.webkitAudioContext;

		if(!window.AudioContext) return false;

		this.context = new AudioContext();

		// Music
		this.musicGainNode = this.context.createGain();
		this.musicGainNode.connect(this.context.destination);
		this.musicGainNode.gain.value = this.music_volume;

		// Effects
		this.effectsGainNode = this.context.createGain();
		this.effectsGainNode.connect(this.context.destination);
		this.effectsGainNode.gain.value = this.effects_volume;

		// HeartBeat
		this.heartbeatGainNode = this.context.createGain();
		this.heartbeatGainNode.connect(this.context.destination);
		this.heartbeatGainNode.gain.value = this.heartbeats_volume;

		// Announcner
		this.announcerGainNode = this.context.createGain();
		this.announcerGainNode.connect(this.context.destination);
		this.announcerGainNode.gain.value = this.announcer_volume;
	},

	playMusic: function() {
		//if(!window.AudioContext) return false;
		//this.playSound(G.soundLoaded[0],this.musicGainNode);
		musicPlayer.playRandom();
	},

	getSound: function(url, id, success) {
		if(!window.AudioContext) success();
		var id = id;
		bufferLoader = new BufferLoader(this.context,[url],function(arraybuffer) {
			G.soundLoaded[id] = arraybuffer[0];
			success();
		});

		bufferLoader.load();
	},

	playSound: function(sound, node, o) {
		if(!window.AudioContext) return false;
		o = $j.extend( {
			music_volume : 1,
			effects_volume : 1,
		}, o);

		var source = this.context.createBufferSource();
		source.buffer = sound;
		source.connect(node);
		source.start(0);
		return source;
	},

	setEffectsVolume: function(value) {
		this.effectsGainNode.gain.value = this.effects_volume * value;
		this.heartbeatGainNode.gain.value = this.heartbeats_volume * value;
		this.announcerGainNode.gain.value = this.announcer_volume * value;
	}
});


// Zfill like in python
function zfill(num, size) {
    var s = "000000000" + num;
    return s.substr(s.length-size);
}

// Cross Browser script loader
// From http://stackoverflow.com/a/5853358
function getScript(url,success) {
	var script = document.createElement('script');
	script.src = url;
	var head = document.getElementsByTagName('head')[0];
	var done = false;
	script.onload = script.onreadystatechange = function() {
		if ( !done && (!this.readyState || this.readyState == 'loaded' || this.readyState == 'complete') ) {
			done = true;
			success();
			script.onload = script.onreadystatechange = null;
			head.removeChild(script);
		}
	};
	head.appendChild(script);
}

function getImage(url,success) {
	var img = new Image();
	img.src = url;
	img.onload = function() {
		success();
	};
}


function BufferLoader(context, urlList, callback) {
  this.context = context;
  this.urlList = urlList;
  this.onload = callback;
  this.bufferList = new Array();
  this.loadCount = 0;
}

BufferLoader.prototype.loadBuffer = function(url, index) {
  // Load buffer asynchronously
  var request = new XMLHttpRequest();
  request.open("GET", url, true);
  request.responseType = "arraybuffer";

  var loader = this;

  request.onload = function() {
    // Asynchronously decode the audio file data in request.response
    loader.context.decodeAudioData(
      request.response,
      function(buffer) {
        if (!buffer) {
          alert('error decoding file data: ' + url);
          return;
        }
        loader.bufferList[index] = buffer;
        if (++loader.loadCount == loader.urlList.length)
          loader.onload(loader.bufferList);
      },
      function(error) {
        console.error('decodeAudioData error', error);
      }
    );
  };

  request.onerror = function() {
    alert('BufferLoader: XHR error');
  };

  request.send();
};

BufferLoader.prototype.load = function() {
  for (var i = 0; i < this.urlList.length; ++i)
  this.loadBuffer(this.urlList[i], i);
};

// http://www.openjs.com/scripts/others/dump_function_php_print_r.php
function print_r(arr, level) {
	var dumped_text = "";
	if(!level) level = 0;

	// The padding given at the beginning of the line.
	var level_padding = "";
	for(var j=0; j<level+1; j++) level_padding += "    ";

	if(typeof(arr) == 'object') { // Array/Hashes/Objects
		for(var item in arr) {
			var value = arr[item];

			if(typeof(value) == 'object') { // If it is an array,
				dumped_text += level_padding + "'" + item + "' ...\n";
				dumped_text += dump(value, level+1);
			} else {
				dumped_text += level_padding + "'" + item + "' => \"" + value + "\"\n";
			}
		}
	} else { // Strings/Chars/Numbers etc.
		dumped_text = "===>" + arr + "<===(" + typeof(arr) + ")";
	}
	return dumped_text;
}
