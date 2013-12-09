/*	Game Class
*
*	Game contains all Game element and Game mechanism function.
* 	Its the root element and defined only one time through the G variable.
*
*	NOTE: Constructor does nothing because the G object must be defined 
*	before creating other classes instances. The game setup is triggered
*	to realy start the game
*
*/
var Game = Class.create({
	/*	Attributes
	*
	*	NOTE : attributes and variables starting with $ are jquery element 
	*	and jquery function can be called dirrectly from them.
	*	
	*	//Jquery attributes
	*	$combatFrame : 	Combat element containing all graphics except the UI
	*
	*	//Game elements
	*	players : 			Array : 	Containing Player objects ordered by player ID (0 to 3)
	*	creatures : 		Array : 	Contain creatures (creatures[creature.id]) start at index 1
	*	
	* 	grid : 				Grid : 		Grid object
	*	UI : 				UI : 		UI object
	*
	*	queue : 			Array : 	Current array of Creature ordered by initiative
	*	delayQueue : 		Array : 	Array of Creature who has wait during the turn
	*	nextQueue : 		Array : 	Array containing ALL creature ordered by initiative
	*
	*	turn : 				Integer : 	Number of the current turn
	*
	*	//normal attributes
	*	nbrPlayer : 		Integer : 	Number of player in the game
	*	activeCreature : 	Creature : 	Current active creature object reference
	*	creaIdCounter : 	Integer : 	Creature ID counter used for creature creation
	*	creatureDatas : 	Array : 	Array containing all datas for the creatures
	*
	*/


	/*	Constructor
	*	
	* 	Only create few attributes
	*
	*/
	initialize: function(){
		this.players = [];
		this.p = this.players; //Convienience
		this.creatures = [];
		this.c = this.creatures; //Convienience
		this.effects = [];
		this.activeCreature = undefined;
		this.animations = new Animations();
		this.turn = 0;
		this.queue = [];
		this.delayQueue = [];
		this.nextQueue = []; //next round queue
		this.creaIdCounter = 1;
		this.creatureDatas = [];
		this.creatureJSON;
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
		this.realms = ["A","E","G","L","P","S","W"];
		this.loadedCreatures = [
			0, //Dark Priest
			37, //Swine Thug
			3, //Uncle Fungus
			4, //Magma Spawn
			45, //Chimera
			12, //Snow Bunny
			5, //Impaler
			14, //Gumble
			7, //Abolished
			40, //Nutcase
			9, //Nightmare
			39, //Headless
			44, //Scavenger
			31, //Cyber Hound
			//6, //Ice Demon
			//33, //Golden Wyrm
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

		//Gameplay
		this.firstKill = false;
		this.freezedInput = false;
		this.turnThrottle = false;

		//Phaser
		this.Phaser = new Phaser.Game(1920, 1080, Phaser.WEBGL, 'combatwrapper', {update:function(){ G.phaserUpdate(); }, render:function(){ G.phaserRender(); }});

		//Msg (TODO External file)
		this.msg = {
			abilities : {
				notarget : "No targets available.",
				noplasma : "Not enough plasma.",
				nopsy	 : "Psyhelm overload: too many creatures controlled", //is this string needed anymore?
				alreadyused : "Ability already used.",
				toomuch : "Too much %stat%.",
				notenough : "Not enough %stat%."
			},
			ui : {
				dash : {
					materialize_overload : "Overload! Maximum number of units controlled",
				}
			}
		}
	},


	/*	loadGame(setupOpt)
	*	
	*	setupOpt : 	Object : 	Setup options from matchmaking menu
	*
	* 	Load all required game files
	*/
	loadGame: function(setupOpt){
		var defaultOpt = {
			nbrPlayer : 2,
			timePool : 5*60,
			turnTimePool : 60,
			background_image : "Frozen Skull",
			plasma_amount : 50,
			creaLimitNbr : 7,
		}

		this.gameState = "loading";
		setupOpt = $j.extend(defaultOpt,setupOpt);
		$j.extend(this,setupOpt);

		G.startLoading();

		dpcolor = ["blue","orange","green","red"];

		this.loadingSrc = (G.loadedCreatures.length-1) * 5 
		+ dpcolor.length*2 + 3 //Darkpriest
		+ this.availableMusic.length //Music
		+ this.soundEffects.length //Sound effects
		+ 1 //Background
		+ 12 //Hexagons
		+ 4 //Health Frames
		+ 3 //Traps
		+ 2 //Effects
		+ 26 //drops
		;

		//Music Loading
		this.soundLoaded = {};
		this.soundsys = new Soundsys();
		for (var i = 0; i < this.availableMusic.length; i++) {
		 	this.soundsys.getSound("../media/music/"+this.availableMusic[i],i,function(){ G.loadFinish() });
		};
		
		for (var i = 0; i < this.soundEffects.length; i++) {
		 	this.soundsys.getSound("./sounds/"+this.soundEffects[i],this.availableMusic.length+i,function(){ G.loadFinish() });
		};

		this.Phaser.load.onFileComplete.add(G.loadFinish,G);

		//Health
		this.Phaser.load.image('p0_health', './frames/p0_health.png');
		this.Phaser.load.image('p1_health', './frames/p1_health.png');
		this.Phaser.load.image('p2_health', './frames/p2_health.png');
		this.Phaser.load.image('p3_health', './frames/p3_health.png');

		//Grid
		this.Phaser.load.image('hex', './grid/hex.png');
		this.Phaser.load.image('hex_dashed', './grid/hex_dashed.png');
		this.Phaser.load.image('hex_path', './grid/hex_path.png');
		this.Phaser.load.image('input', './grid/hex_input.png');
		this.Phaser.load.image('hex_p0', './grid/hex_p0.png');
		this.Phaser.load.image('hex_p1', './grid/hex_p1.png');
		this.Phaser.load.image('hex_p2', './grid/hex_p2.png');
		this.Phaser.load.image('hex_p3', './grid/hex_p3.png');
		this.Phaser.load.image('hex_hover_p0', './grid/hex_hover_p0.png');
		this.Phaser.load.image('hex_hover_p1', './grid/hex_hover_p1.png');
		this.Phaser.load.image('hex_hover_p2', './grid/hex_hover_p2.png');
		this.Phaser.load.image('hex_hover_p3', './grid/hex_hover_p3.png');

		//Traps
		this.Phaser.load.image('trap_royal-seal', './grid/royal-seal.png');
		this.Phaser.load.image('trap_mud-bath', './grid/mud-bath.png');
		this.Phaser.load.image('trap_scorched-ground', './grid/scorched-ground.png');

		//Effects
		this.Phaser.load.image('effects_fissure-vent', './grid/fissure-vent.png');
		this.Phaser.load.image('effects_chilling-spit', '../bestiary/Snow Bunny/Chilling Spit.png');

		//Drops
		this.Phaser.load.image('drop_Apple','../drops/Apple.png');
		this.Phaser.load.image('drop_Bone.','../drops/Bone.png');
		this.Phaser.load.image('drop_Cherry','../drops/Cherry.png');
		this.Phaser.load.image('drop_Fish.','../drops/Fish.png');
		this.Phaser.load.image('drop_Lemon','../drops/Lemon.png');
		this.Phaser.load.image('drop_Mushroom','../drops/Mushroom.png');
		this.Phaser.load.image('drop_Pear.','../drops/Pear.png');
		this.Phaser.load.image('drop_Red Pepper','../drops/Red Pepper.png');
		this.Phaser.load.image('drop_Watermellon','../drops/Watermellon.png');
		this.Phaser.load.image('drop_Bat Wing','../drops/Bat Wing.png');
		this.Phaser.load.image('drop_Candy','../drops/Candy.png');
		this.Phaser.load.image('drop_Fang.','../drops/Fang.png');
		this.Phaser.load.image('drop_Frog Leg','../drops/Frog Leg.png');
		this.Phaser.load.image('drop_Meat.','../drops/Meat.png');
		this.Phaser.load.image('drop_Nut.png','../drops/Nut.png');
		this.Phaser.load.image('drop_Pineapple','../drops/Pineapple.png');
		this.Phaser.load.image('drop_Spear','../drops/Spear.png');
		this.Phaser.load.image('drop_Yellow Pepper','../drops/Yellow Pepper.png');
		this.Phaser.load.image('drop_Bird Beak','../drops/Bird Beak.png');
		this.Phaser.load.image('drop_Carrot','../drops/Carrot.png');
		this.Phaser.load.image('drop_Feather','../drops/Feather.png');
		this.Phaser.load.image('drop_Green Apple','../drops/Green Apple.png');
		this.Phaser.load.image('drop_Milk Bottle','../drops/Milk Bottle.png');
		this.Phaser.load.image('drop_Orange','../drops/Orange.png');
		this.Phaser.load.image('drop_Radish','../drops/Radish.png');
		this.Phaser.load.image('drop_Strawberry','../drops/Strawberry.png');

		//Background
		this.Phaser.load.image('background',"../locations/"+this.background_image+"/bg.jpg");

		//Get JSON files
		$j.getJSON("../data/creatures.json", function(json_in) {
			G.creatureJSON = json_in;

			G.creatureDatas = G.creatureJSON;

			for (var j = 0; j < G.loadedCreatures.length; j++) {
			
				var data = G.creatureJSON[G.loadedCreatures[j]];

				//Load Creature Sound
				G.soundsys.getSound("../bestiary/"+data.name+'/'+data.name+'.ogg',1000+G.loadedCreatures[j],function(){ G.loadFinish() });

				//Loads Creature abilities
				getScript('../bestiary/'+data.name+'/abilities.js',function(){ G.loadFinish() });

				//Load Sprites
				getImage('../bestiary/'+data.name+'/artwork.jpg',function(){ G.loadFinish() });
				if(data.name == "Dark Priest"){
					for (var i = 0; i < dpcolor.length; i++) {
						G.Phaser.load.image(data.name+dpcolor[i]+'_cardboard','../bestiary/'+data.name+'/cardboard-'+dpcolor[i]+'.png');
						getImage('../bestiary/'+data.name+'/avatar-'+dpcolor[i]+'.jpg',function(){ G.loadFinish() });
					};
				}else{
					G.Phaser.load.image(data.name+'_cardboard','../bestiary/'+data.name+'/cardboard.png');
					getImage('../bestiary/'+data.name+'/avatar.jpg',function(){ G.loadFinish() });
				}

				//For code compatibility
				G.availableCreatures[j] = data.type;
			};

			G.Phaser.load.start();
		});

	},

	startLoading: function(){
		$j("#gamesetupcontainer").hide();
		$j("#loader").show();
	},

	loadFinish: function(){
		this.loadedSrc++;
		if(this.loadingSrc==this.loadedSrc){
			$j("#loader").hide();
			G.setup(G.nbrPlayer);
		}
	},

	phaserUpdate : function(){
		if( this.gameState != "playing" ) return;
	},

	phaserRender : function(){
		for (var i = 1; i < G.creatures.length; i++) {
			//G.Phaser.debug.renderSpriteBounds(G.creatures[i].sprite);
		};
	},


	/*	Setup(nbrPlayer)
	*	
	*	nbrPlayer : 		Integer : 	Ideally 2 or 4, number of players to setup the game
	*
	* 	Launch the game with the given number of player.
	*
	*/
	setup: function(nbrPlayer){

		//Phaser
		this.Phaser.stage.scaleMode = Phaser.StageScaleMode.SHOW_ALL;
		this.Phaser.stage.scale.setShowAll();
		this.Phaser.stage.scale.refresh();
		this.Phaser.stage.disableVisibilityChange = true;
		this.Phaser.add.sprite(0, 0, 'background');

		//reseting global counters
		trapID = 0;
		effectId = 0;
		dropID = 0;
		this.creaIdCounter = 1;
		
		this.grid = new HexGrid();//Creating Hexgrid

		this.startMatchTime = new Date();

		this.$combatFrame = $j("#combatframe");
		this.$combatFrame.show();

		//Remove loading screen
		$j("#matchmaking").hide();

		for (var i = 0; i < nbrPlayer; i++) {
			var player = new Player(i);
			this.players.push(player);

			//starting position
			var pos = {};
			if(nbrPlayer>2){//If 4 players
				switch(player.id){
					case 0: 
						pos = {x:0	,y:1};
						break;
					case 1: 
						pos = {x:15	,y:1};
						break;
					case 2: 
						pos = {x:0	,y:7};
						break;
					case 3: 
						pos = {x:15	,y:7};
						break;
				}
			}else{//If 2 players
				switch(player.id){
					case 0: 
						pos = {x:0	,y:4};
						break;
					case 1: 
						pos = {x:14	,y:4};
						break;
				}
			}

			player.summon("--",pos); //Summon Dark Priest
			
		};

		this.activeCreature = this.players[0].creatures[0]; //Prevent errors

		this.UI = new UI(); //Creating UI not before because certain function requires creature to exists

		//DO NOT CALL LOG BEFORE UI CREATION
		this.gameState = "playing";

		this.log("Welcome to Ancient Beast pre-Alpha");
		this.log("Setting up a "+nbrPlayer+" player match");

		this.timeInterval = setInterval(function(){
			G.checkTime();
		},G.checkTimeFrequency);

		this.nextCreature();

		G.resizeCombatFrame(); //Resize while the game start
		G.UI.resizeDash();

		//Resize event
		$j(window).resize(function () {
			//Throttle down to 1 event every 500ms of inactivity
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
	* 	Resize the combat frame
	*
	*/
	resizeCombatFrame: function(){
		// if( ($j(window).width() / 1920) > ($j(window).height() / 1080) ){
		// 	// $j("#tabwrapper").css({scale: $j(window).height() / 1080});
		// 	this.$combatFrame.css({ 
		// 		scale: $j(window).height() / 1080, 
		// 		"margin-left": -1920*($j(window).height()/1080)/2, 
		// 		"margin-top": -1080*($j(window).height()/1080)/2, 
		// 	});
		// }else{
		// 	// $j("#tabwrapper").css({scale: $j(window).width() / 1080});
		// 	this.$combatFrame.css({ 
		// 		scale: $j(window).width() / 1920, 
		// 		"margin-left": -1920*($j(window).width()/1920)/2, 
		// 		"margin-top": -1080*($j(window).width()/1920)/2, 
		// 	});	
		// }

		if( $j("#cardwrapper").width() < $j("#card").width() ){
			$j("#cardwrapper_inner").width()
		}
	},


	/*	nextRound()
	*
	* 	Replace the current Queue with the next queue.
	*
	*/
	nextRound: function(){
		G.grid.clearHexViewAlterations();
		this.turn++;
		this.log("Round "+this.turn,"roundmarker");
		this.queue = this.nextQueue.slice(0); //Copy queue

		this.delayQueue = [];

		//resetting values
		for (var i = 0; i < this.creatures.length; i++) {
			if( this.creatures[i] instanceof Creature ){
				this.creatures[i].delayable = true;
				this.creatures[i].delayed = false;
			}
		};

		G.triggersFn.onStartOfRound();

		this.nextCreature();
	},


	/*	nextCreature()
	*
	* 	Activate the next creature in queue
	*
	*/
	nextCreature: function(){
		G.UI.closeDash(true); // True argument prevent calling the queryMove function before the next creature
		G.UI.btnToggleDash.changeState("normal");
		G.grid.xray( new Hex(-1,-1) ); //Clear Xray

		if(this.gameState == "ended") return;

		G.stopTimer();
		//Delay
		setTimeout(function(){
			var interval = setInterval(function(){
				if(!G.freezedInput){
					clearInterval(interval);

					var differentPlayer = false;

					if(G.queue.length == 0){ //If no creature in queue
						if(G.delayQueue.length > 0){
							if( G.activeCreature ) differentPlayer = ( G.activeCreature.player != G.delayQueue[0].player );
							else differentPlayer = true;
							G.activeCreature = G.delayQueue[0]; //set new creature active
							G.delayQueue = G.delayQueue.slice(1); //and remove it from the queue
							console.log("Delayed Creature");
						}else{
							G.nextRound(); //Go to next Round
							return; //End function
						}
					}else{
						if( G.activeCreature ) differentPlayer = ( G.activeCreature.player != G.queue[0].player );
						else differentPlayer = true;
						G.activeCreature = G.queue[0]; //set new creature active
						G.queue = G.queue.slice(1); //and remove it from the queue
					}

					if(G.activeCreature.player.hasLost){
						G.nextCreature();
						return;
					}

					//Heart Beat
					if(differentPlayer){
						G.soundsys.playSound(G.soundLoaded[4],G.soundsys.heartbeatGainNode);
					}

					G.log("Active Creature : %CreatureName"+G.activeCreature.id+"%");
					G.activeCreature.activate();

					//Update UI to match new creature
					G.UI.updateActivebox();
					G.reorderQueue(); //Update UI and Queue order
				}
			},50);
		},300);
	},


	/*	reorderQueue()
	*
	* 	Do what it says xD
	*
	*/
	reorderQueue: function(){
		this.queue.orderByInitiative();
		this.nextQueue.orderByInitiative();
		if ( this.UI ) {
			this.UI.updateQueueDisplay();
		}
	},


	/*	log(obj)
	*
	*	obj : 	Any : 	Any variable to display in console and game log
	*
	* 	Display obj in the console log and in the game log
	*
	*/
	log: function(obj,htmlclass){
		//Formating
		var stringConsole = obj;
		var stringLog = obj;
		for (var i = 0; i < this.creatures.length; i++) {
			if( this.creatures[i] instanceof Creature ){
				stringConsole = stringConsole.replace("%CreatureName"+i+"%",this.creatures[i].player.name+"'s "+this.creatures[i].name);
				stringLog = stringLog.replace("%CreatureName"+i+"%","<span class='"+this.creatures[i].player.color+"'>"+this.creatures[i].name+"</span>");
			}
		};

		console.log(stringConsole);
		this.UI.chat.addMsg(stringLog,htmlclass);
	},

	togglePause: function(){
		if( G.freezedInput && G.pause ){
			G.pause = false;
			G.freezedInput = false;
			G.pauseTime += new Date() - G.pauseStartTime;
			$j("#pause").remove();
			G.startTimer();
		}else if( !G.pause && !G.freezedInput ){
			G.pause = true;
			G.freezedInput = true;
			G.pauseStartTime = new Date();
			G.stopTimer();
			$j("#ui").append('<div id="pause">Pause</div>');
		}
	},


	/*	skipTurn()
	*
	* 	End turn for the current creature
	*
	*/
	skipTurn: function(o){
		if(G.turnThrottle) return;

		o = $j.extend({
			callback: function(){},
			noTooltip: false,
			tooltip: 'Skipped'
		},o);

		G.turnThrottle = true;
		G.UI.btnSkipTurn.changeState("disabled");
		G.UI.btnDelay.changeState("disabled");

		if(!o.noTooltip) G.activeCreature.hint(o.tooltip,"msg_effects");

		setTimeout(function(){
			G.turnThrottle=false;
			G.UI.btnSkipTurn.changeState("normal");
			if(!G.activeCreature.hasWait && G.activeCreature.delayable && (G.delayQueue.length+G.queue.length!=0) ) G.UI.btnDelay.changeState("normal");
			o.callback.apply();
		},1000)
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
	* 	Delay the action turn of the current creature
	*
	*/
	delayCreature: function(o){
		if(G.turnThrottle) return;
		if(this.activeCreature.hasWait || !this.activeCreature.delayable || G.delayQueue.length + G.queue.length==0 ) return;

		o = $j.extend({
			callback: function(){},
		},o);

		G.turnThrottle = true;
		G.UI.btnSkipTurn.changeState("disabled");
		G.UI.btnDelay.changeState("disabled");

		setTimeout(function(){
			G.turnThrottle=false;
			G.UI.btnSkipTurn.changeState("normal");
			if(!G.activeCreature.hasWait && G.activeCreature.delayable && (G.delayQueue.length+G.queue.length!=0) ) G.UI.btnDelay.changeState("normal");
			o.callback.apply();
		},1000)
		var skipTurn = new Date();
		var p = this.activeCreature.player;
		p.totalTimePool = p.totalTimePool - (skipTurn - p.startTime);
		this.activeCreature.wait();
		this.nextCreature();
	},

	startTimer: function(){
		clearInterval(this.timeInterval);
		this.activeCreature.player.startTime = new Date() - G.pauseTime;
		G.checkTime();
		this.timeInterval = setInterval(function(){
			G.checkTime();
		},G.checkTimeFrequency);
	},

	stopTimer: function(){
		clearInterval(this.timeInterval);
	},

	/*	checkTime()
	*	
	*/
	checkTime: function(){
		var date = new Date() - G.pauseTime;
		var p = this.activeCreature.player;
		var alertTime = 6; //in seconds
		var msgStyle = "msg_effects";

		p.totalTimePool = Math.max(p.totalTimePool,0); //Clamp

		//Check all timepool
		var playerStillHaveTime = (this.timePool>0) ? false : true ; //So check is always true for infinite time
		for(var i = 0; i < this.nbrPlayer; i++){ //Each player 
			playerStillHaveTime = (this.players[i].totalTimePool > 0) || playerStillHaveTime;
		}

		//Check Match Time
		if( !playerStillHaveTime ){
			G.endGame();
			return;
		}

		G.UI.updateTimer();

		if( this.timePool > 0 && this.turnTimePool > 0 ){ //Turn time and timepool not infinite
			if( (date - p.startTime)/1000 > this.turnTimePool || p.totalTimePool - (date - p.startTime) < 0 ){
				if( p.totalTimePool - (date - p.startTime) < 0 )
					p.deactivate(); //Only if timepool is empty
				G.skipTurn();
				return;
			}else{
				if( (p.totalTimePool - (date - p.startTime))/1000 < alertTime ){
					msgStyle = "damage";
				}
				if( this.turnTimePool - ((date - p.startTime)/1000) < alertTime){
					//Alert
					G.UI.btnToggleDash.changeState("glowing");
					this.activeCreature.hint( Math.ceil( this.turnTimePool - ((date - p.startTime)/1000)),msgStyle);
				}
			}
		}else if( this.turnTimePool > 0 ){ //Turn time not infinite
			if( (date - p.startTime)/1000 > this.turnTimePool ){
				G.skipTurn();
				return;
			}else{
				if( this.turnTimePool - ((date - p.startTime)/1000) < alertTime){
					//Alert
					G.UI.btnToggleDash.changeState("glowing");
					this.activeCreature.hint( Math.ceil( this.turnTimePool - ((date - p.startTime)/1000)),msgStyle);
				}
			}
		}else if( this.timePool > 0 ){ //timepool not infinite
			if( p.totalTimePool - (date - p.startTime) < 0 ){
				p.deactivate();
				G.skipTurn();
				return;
			}else{
				if( p.totalTimePool - (date - p.startTime) < alertTime ){
					msgStyle = "damage";
				}
				if( this.turnTimePool - ((date - p.startTime)/1000) < alertTime){
					//Alert
					G.UI.btnToggleDash.changeState("glowing");
					this.activeCreature.hint( Math.ceil( this.turnTimePool - ((date - p.startTime)/1000)),msgStyle);
				}
			}
		}
	},


	/*	retreiveCreatureStats(type)
	*
	*	type : 	String : 	Creature type (ex: "0" for Dark Priest and "L2" for Magma Spawn)
	*
	*	Query the database for creature stats
	*
	*/
	retreiveCreatureStats: function(type){
		for (var i = this.creatureDatas.length - 1; i >= 0; i--) {
			if(this.creatureDatas[i].type == type) return this.creatureDatas[i];
		};
	},

	/* 	Regex Test for triggers */
	triggers : {
		onStepIn : new RegExp('onStepIn', 'i'),
		onStepOut : new RegExp('onStepOut', 'i'),
		onStartPhase : new RegExp('onStartPhase', 'i'),
		onEndPhase : new RegExp('onEndPhase', 'i'),
		onMovement : new RegExp('onMovement', 'i'),
		onAttack : new RegExp('onAttack', 'i'),
		onDamage : new RegExp('onDamage', 'i'),
		onCreatureMove : new RegExp('onCreatureMove', 'i'),
		onCreatureDeath : new RegExp('onCreatureDeath', 'i'),
		onCreatureSummon : new RegExp('onCreatureSummon', 'i'),

		onStepIn_other : new RegExp('onOtherStepIn', 'i'),
		onStepOut_other : new RegExp('onOtherStepOut', 'i'),
		onStartPhase_other : new RegExp('onOtherStartPhase', 'i'),
		onEndPhase_other : new RegExp('onOtherEndPhase', 'i'),
		onMovement_other : new RegExp('onOtherMovement', 'i'),
		onAttack_other : new RegExp('onOtherAttack', 'i'),
		onDamage_other : new RegExp('onOtherDamage', 'i'),
		onCreatureMove_other : new RegExp('onOtherCreatureMove', 'i'),
		onCreatureDeath_other : new RegExp('onOtherCreatureDeath', 'i'),
		onCreatureSummon_other : new RegExp('onOtherCreatureSummon', 'i'),

		onEffectAttachement : new RegExp('onEffectAttachement', 'i'),
		onEffectAttachement_other : new RegExp('onOtherEffectAttachement', 'i'),

		onStartOfRound : new RegExp('onStartOfRound', 'i'),
		onQuery : new RegExp('onQuery', 'i'),
		oncePerDamageChain : new RegExp('oncePerDamageChain', 'i')
	},

	triggerAbility : function( trigger, arg, retValue ){

		//For triggered creature
		arg[0].abilities.each(function(){
			if( arg[0].dead == true ) return;
			if( G.triggers[trigger].test(this.trigger) ){
				if( this.require(arg[1]) ){
					retValue = this.animation(arg[1]);
				}
			}
		});

		//For other creatures
		G.creatures.each(function(){
			if( arg[0] == this || this.dead == true ) return;
			this.abilities.each(function(){
				if( G.triggers[trigger+"_other"].test(this.trigger) ){
					if( this.require(arg[1]) ){
						retValue = this.animation(arg[1]);
					}
				}
			});
		});
	},

	triggerEffect : function( trigger, arg, retValue ){

		//For triggered creature
		arg[0].effects.each(function(){
			if( arg[0].dead == true ) return;
			if( G.triggers[trigger].test(this.trigger) ){
				retValue = this.activate(arg[1]);
			}
		});

		//For other creatures
		G.creatures.each(function(){
			if( this instanceof Creature){
				if( arg[0] == this || this.dead == true ) return;
				this.effects.each(function(){
					if( G.triggers[ trigger + "_other" ].test(this.trigger) ){
						retValue = this.activate(arg[1]);
					}
				});
			}
		});
	},

	triggerTrap : function( trigger, arg ){
		arg[0].hexagons.each(function(){
			this.activateTrap(G.triggers[trigger],arg[0]);
		});
	},

	triggerDeleteEffect : function( trigger, creature ){
		if( creature == "all" ){
			for (var i = 0; i < G.effects.length; i++) {
				effect = G.effects[i];
				if(effect.turnLifetime > 0 && trigger == effect.deleteTrigger){
					if(G.turn-effect.creationTurn >= effect.turnLifetime){
						effect.deleteEffect();
						i--;	
					} 
				}
			}
			return;
		}

		for (var i = 0; i < creature.effects.length; i++) {
			if(creature.effects[i].turnLifetime > 0 && trigger == creature.effects[i].deleteTrigger){
				if(G.turn-creature.effects[i].creationTurn >= creature.effects[i].turnLifetime){
					creature.effects[i].deleteEffect();
					i--;	
				} 
			}
		};
	},

	triggersFn : {

		onStepIn : function( creature, hex, callback ){
			G.triggerTrap("onStepIn",arguments);
			G.triggerAbility("onStepIn",arguments);
			G.triggerEffect("onStepIn",arguments);
		},

		onStepOut : function( creature, hex, callback ){
			G.triggerTrap("onStepOut",arguments);
			G.triggerAbility("onStepOut",arguments);
			G.triggerEffect("onStepOut",arguments);
		},

		onStartPhase : function( creature, callback ){
			for (var i = 0; i < G.grid.traps.length; i++) {
				trap = G.grid.traps[i];
				if(trap == undefined) continue;
				if(trap.turnLifetime > 0){
					if(G.turn-trap.creationTurn >= trap.turnLifetime){
						if(trap.fullTurnLifetime){
							if(trap.ownerCreature == G.activeCreature){
								trap.destroy();
								i--;
							}
						}else{
							trap.destroy();
							i--;
						}
					} 
				}
			};
			G.triggerDeleteEffect("onStartPhase",creature);
			G.triggerAbility("onStartPhase",arguments);
			G.triggerEffect("onStartPhase",[creature,creature]);
		},

		onEndPhase : function( creature, callback ){
			G.triggerDeleteEffect("onEndPhase",creature);
			G.triggerAbility("onEndPhase",arguments);
			G.triggerEffect("onEndPhase",[creature,creature]);
		},

		onStartOfRound : function( creature, callback ){
			G.triggerDeleteEffect("onStartOfRound","all");
		},

		onCreatureMove : function( creature, hex, callback ){
			G.triggerAbility("onCreatureMove",arguments);
		},

		onCreatureDeath : function( creature, callback ){
			G.triggerAbility("onCreatureDeath",arguments);	
			G.triggerEffect("onCreatureDeath",[creature,creature]);	
		},

		onCreatureSummon : function( creature, callback ){
			G.triggerAbility("onCreatureSummon",[creature,creature,callback]);	
			G.triggerEffect("onCreatureSummon",[creature,creature]);	
		},

		onEffectAttachement : function( creature, effect, callback ){
			G.triggerEffect("onEffectAttachement",[creature,effect]);	
		},


		onAttack : function( creature, damage ){
			damage = G.triggerAbility("onAttack",arguments,damage);
			damage = G.triggerEffect("onAttack",arguments,damage);
			return damage;
		},

		onDamage : function( creature, damage ){
			G.triggerAbility("onDamage",arguments);
			G.triggerEffect("onDamage",arguments);
		}
	},


	findCreature: function( o ){
		var o = $j.extend({
			team : -1, //No team
			type : "--" //Darkpriest
		},o);

		var ret = [];

		for (var i = 0; i < this.creatures.length; i++) {
			if( this.creatures[i] instanceof Creature ) {
				var match = true;
				$j.each(o,function(key,val){

					if( key == "team" ){
						if(val == -1) return;

						if(val instanceof Array){
							var wrongTeam = true;
							if( val.indexOf( G.creatures[i][key] ) != -1 ){
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
		};

		return ret;
	},


	/* 	Regex Test for damage type */
	dmgType : {
		area : new RegExp('area', 'i'),
		target : new RegExp('target', 'i'),
		retaliation : new RegExp('retaliation', 'i'),
	},

	clearOncePerDamageChain: function(){
		for (var i = this.creatures.length - 1; i >= 0; i--) {
			if(this.creatures[i] instanceof Creature){
				for (var j = this.creatures[i].abilities.length - 1; j >= 0; j--) {
					this.creatures[i].abilities[j].triggeredThisChain = false;
				};
			}
		};

		for (var i = 0; i < G.effects.length; i++) {
			G.effects[i].triggeredThisChain = false;
		}
	},

	/*	endGame()
	*
	*	End the game and print stats
	*
	*/
	endGame: function(){
		this.stopTimer();
		this.gameState = "ended";

		//Calculate The time cost of the end turn
		var skipTurn = new Date();
		var p = this.activeCreature.player;
		p.totalTimePool = p.totalTimePool - (skipTurn - p.startTime);

		//Show Score Table
		$j("#endscreen").show();

		var $table = $j("#endscreen table tbody");

		if(this.nbrPlayer==2){ //If Only 2 players remove the other 2 columns
			$table.children("tr").children("td:nth-child(even)").remove();
			var $table = $j("#endscreen table tbody");
		}

		//FILLING THE BOARD
		for(var i = 0; i < this.nbrPlayer; i++){ //Each player 

			//TimeBonus
			if(this.timePool > 0)
				this.players[i].bonusTimePool = Math.round(this.players[i].totalTimePool/1000);

			//-------Ending bonuses--------//
			//No fleeing
			if(!this.players[i].hasFled && !this.players[i].hasLost)
				this.players[i].score.push({type:"nofleeing"});
			//Surviving Creature Bonus
			var immortal = true;
			for(var j = 0; j < this.players[i].creatures.length; j++){
				if(!this.players[i].creatures[j].dead){
					if(this.players[i].creatures[j].type != "--")
						this.players[i].score.push({type:"creaturebonus",creature:this.players[i].creatures[j]});
					else //DarkPriest Bonus
						this.players[i].score.push({type:"darkpriestbonus"});
				}else{
					immortal = false;
				}
			}
			//Immortal
			if(immortal && this.players[i].creatures.length > 1) //At least 1 creature summoned
				this.players[i].score.push({type:"immortal"});

			//----------Display-----------//
			var colId = (this.nbrPlayer>2) ?( i+2+((i%2)*2-1)*Math.min(1,i%3) ):i+2;

			//change Name
			$table.children("tr.player_name").children("td:nth-child("+colId+")") //Weird expression swap 2nd and 3rd player
			.text(this.players[i].name); 

			//Change score
			$j.each(this.players[i].getScore(),function(index,val){
				var text = ( val == 0 && index != "total") ? "--" : val ;
				$table.children("tr."+index).children("td:nth-child("+colId+")") //Weird expression swap 2nd and 3rd player
				.text(text);
			});
		}

		//Defining winner
		if(this.nbrPlayer > 2){ //2vs2
			var score1 = this.players[0].getScore().total + this.players[2].getScore().total;
			var score2 = this.players[1].getScore().total + this.players[3].getScore().total;
			
			if( score1 > score2 ){
				//Left side wins
				$j("#endscreen p").text(this.players[0].name+" and "+this.players[2].name+" won the match!");
			}else if( score1 < score2 ){
				//Right side wins
				$j("#endscreen p").text(this.players[1].name+" and "+this.players[3].name+" won the match!");
			}else if( score1 == score2 ){
				//Draw
				$j("#endscreen p").text("Draw!");
			}
		}else{ //1vs1
			var score1 = this.players[0].getScore().total;
			var score2 = this.players[1].getScore().total;

			if( score1 > score2 ){
				//Left side wins
				$j("#endscreen p").text(this.players[0].name+" won the match!");
			}else if( score1 < score2 ){
				//Right side wins
				$j("#endscreen p").text(this.players[1].name+" won the match!");
			}else if( score1 == score2 ){
				//Draw
				$j("#endscreen p").text("Draw!");
			}
		}
	},

	action : function(o,opt){

		var defaultOpt = {
			callback : function(){},
		}
		opt = $j.extend(defaultOpt,opt);

		G.clearOncePerDamageChain();
		switch(o.action){
			case "move":
				G.activeCreature.moveTo(G.grid.hexs[o.target.y][o.target.x],{callback : opt.callback});
				break;
			case "skip":
				G.skipTurn({callback : opt.callback});
				break;
			case "delay":
				G.delayCreature({callback : opt.callback});
				break;
			case "flee":
				G.activeCreature.player.flee({callback : opt.callback});
				break;
			case "ability":
				var args = $j.makeArray(o.args[1]);
				if(o.target.type=="hex"){
					args.unshift(G.grid.hexs[o.target.y][o.target.x]);
					G.activeCreature.abilities[o.id].animation2({callback:opt.callback,arg:args});
				}
				if(o.target.type=="creature"){
					args.unshift(G.creatures[o.target.crea]);
					G.activeCreature.abilities[o.id].animation2({callback:opt.callback,arg:args});
				}
				if(o.target.type=="array"){
					var array = [];
					o.target.array.each(function(){ array.push(G.grid.hexs[this.y][this.x]); });
					args.unshift(array);
					G.activeCreature.abilities[o.id].animation2({callback:opt.callback,arg:args});
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
var Player = Class.create({
	/*	Attributes
	*
	*	id : 		Integer : 	Id of the player 1, 2, 3 or 4
	* 	creature : 	Array : 	Array containing players creatures
	*	plasma : 	Integer : 	Plasma amount for the player
	*	flipped : 	Boolean : 	Player side of the battlefield (affects displayed creature)
	*
	*/
	initialize: function(id){
		this.id = id;
		this.creatures = [];
		this.name = "Player"+(id+1);
		this.color = 
		(this.id == 0)? "red"
		:(this.id == 1)? "blue"
		:(this.id == 2)? "orange"
		: "green";
		this.avatar = "../bestiary/Dark Priest/avatar-"+this.color+".jpg";
		this.score = [];
		this.plasma = G.plasma_amount;
		this.flipped = !!(id%2); //Convert odd/even to true/false
		this.availableCreatures = G.availableCreatures;
		this.hasLost = false;
		this.hasFleed = false;
		this.bonusTimePool = 0;
		this.totalTimePool = G.timePool*1000;
		this.startTime = new Date();

		this.score = [{type:"timebonus"}];
	},


	getNbrOfCreatures : function(){
		var nbr = 0;
		for(var i = 0; i < this.creatures.length; i++){
			var crea = this.creatures[i];
			if( !crea.dead && !crea.undead ) nbr++;
		}
		return nbr;
	},


	/*	summon(type,pos)
	*
	*	type : 	String : 	Creature type (ex: "0" for Dark Priest and "L2" for Magma Spawn)
	*	pos : 	Object : 	Position {x,y}
	*
	*/
	summon: function(type,pos){
		var data = G.retreiveCreatureStats(type);
		data = $j.extend(data,pos,{team:this.id}); //create the full data for creature creation
		for (var i = G.creatureJSON.length - 1; i >= 0; i--) {
			if(
				G.creatureJSON[i].type == type && 
				i!=0 ) // Avoid Darkpriest Announce at the begining of a match
			{
				G.soundsys.playSound(G.soundLoaded[1000+i],G.soundsys.announcerGainNode);
			}
		};
		var creature = new Creature(data);
		this.creatures.push(creature);
		creature.summon();
		G.triggersFn.onCreatureSummon(creature);
	},

	/*	flee()
	*
	*	Ask if the player want to flee the match
	*
	*/
	flee: function(o){
		this.hasFleed = true;
		this.deactivate();
		G.skipTurn(o);
	},


	/*	getScore()
	*
	*	return : 	Integer : 	The current score of the player
	*
	*	Return the total of the score events.
	*/
	getScore: function(){
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
		for(var i = 0; i < this.score.length; i++){
			var s = this.score[i];
			var points = 0;
			switch(s.type){
				case "firstKill":
					points += 20;
					break;
				case "kill":
					points += s.creature.lvl*5;
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
					points += Math.round(this.bonusTimePool * .5);
					break;
				case "nofleeing":
					points += 25;
					break;
				case "creaturebonus":
					points += s.creature.lvl*5;
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
	isLeader: function(){

		for(var i = 0; i < G.nbrPlayer; i++){ //Each player 
			//If someone has a higher score
			if(G.players[i].getScore().total > this.getScore().total){
				return false; //he's not in lead
			}
		};

		return true; //If nobody has a better score he's in lead
	},


	/*	isAnnihilated()
	*
	*	A player is considered annihilated if all his creatures are dead DP included
	*/
	isAnnihilated: function(){
		var annihilated = (this.creatures.length>1);
		//annihilated is false if only one creature is not dead
		for(var i = 0; i < this.creatures.length; i++){
			annihilated = annihilated && this.creatures[i].dead;
		}
		return annihilated;
	},

	/* deactivate()
	*
	*	Remove all player's creature from the queue
	*/
	deactivate: function(){
		this.hasLost = true;

		//Remove all player creatures from queues
		for(var i = 1; i < G.creatures.length; i++){
			var crea = G.creatures[i];
			if(crea.player.id == this.id){
				G.queue.removePos(crea);
				G.nextQueue.removePos(crea);
				G.delayQueue.removePos(crea);
			}
		}
		G.reorderQueue();

		//Test if allie darkpriest is dead
		if( G.nbrPlayer > 2){
			//2vs2
			if( G.players[ (this.id+2)%4 ].hasLost )
				G.endGame();
		}else{
			//1vs1
			G.endGame();
		}
	},
});


var Gamelog = Class.create({

	initialize: function(id){
		this.datas = [];
		this.playing = false;
		this.timeCursor = -1;
	},

	add: function(action){
		this.datas.push(action);
	},

	play: function(log){

		if(log){
			this.datas = log;
		}

		var fun = function(){
			G.gamelog.timeCursor++;
			if(G.debugMode) console.log(G.gamelog.timeCursor+"/"+G.gamelog.datas.length)
			if(G.gamelog.timeCursor>G.gamelog.datas.length-1){
				G.activeCreature.queryMove(); //Avoid bug
				return;	
			} 
			var interval = setInterval(function(){
				if(!G.freezedInput && !G.turnThrottle){
					clearInterval(interval);
					G.activeCreature.queryMove(); //Avoid bug
					G.action(G.gamelog.datas[G.gamelog.timeCursor],{callback:fun});
				}
			},100);
		};
		fun();
	},

	next: function(){
		if(G.freezedInput || G.turnThrottle) return false;

		G.gamelog.timeCursor++;
		if(G.debugMode) console.log(G.gamelog.timeCursor+"/"+G.gamelog.datas.length)
		if(G.gamelog.timeCursor>G.gamelog.datas.length-1){
			G.activeCreature.queryMove(); //Avoid bug
			return;	
		} 
		var interval = setInterval(function(){
			if(!G.freezedInput && !G.turnThrottle){
				clearInterval(interval);
				G.activeCreature.queryMove(); //Avoid bug
				G.action(G.gamelog.datas[G.gamelog.timeCursor],{callback: function(){ G.activeCreature.queryMove() } });
			}
		},100);
	},

	get: function(){
		console.log(JSON.stringify(this.datas));
	}
});



var Soundsys = Class.create({

	initialize: function(o){
		o = $j.extend({
			music_volume : .1,
			effects_volume : .6,
			heartbeats_volume : .2,
			announcer_volume : .6
		},o);

		$j.extend(this,o);

		window.AudioContext = window.AudioContext || window.webkitAudioContext;

		if(!window.AudioContext) return false;

		this.context = new AudioContext();

		//Music
		this.musicGainNode = this.context.createGain();
		this.musicGainNode.connect(this.context.destination);
		this.musicGainNode.gain.value = this.music_volume;

		//Effects
		this.effectsGainNode = this.context.createGain();
		this.effectsGainNode.connect(this.context.destination);
		this.effectsGainNode.gain.value = this.effects_volume;

		//HeartBeat
		this.heartbeatGainNode = this.context.createGain();
		this.heartbeatGainNode.connect(this.context.destination);
		this.heartbeatGainNode.gain.value = this.heartbeats_volume;

		//Announcner
		this.announcerGainNode = this.context.createGain();
		this.announcerGainNode.connect(this.context.destination);
		this.announcerGainNode.gain.value = this.announcer_volume;
	},

	playMusic: function(){
		//if(!window.AudioContext) return false;
		//this.playSound(G.soundLoaded[0],this.musicGainNode);
		musicPlayer.playRandom();
	},

	getSound: function(url,id,success){
		if(!window.AudioContext) success();
		var id = id;
		bufferLoader = new BufferLoader(this.context,[url],function(arraybuffer){
			G.soundLoaded[id] = arraybuffer[0];
			success();
		});

		bufferLoader.load();
	},

	playSound: function(sound,node,o) {
		if(!window.AudioContext) return false;
		o = $j.extend({
			music_volume : 1,
			effects_volume : 1,
		},o);

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


//Zfill like in python
function zfill(num, size) {
    var s = "000000000" + num;
    return s.substr(s.length-size);
}

//Cross Browser script loader
//From http://stackoverflow.com/a/5853358
function getScript(url,success){
	var script = document.createElement('script');
	script.src = url;
	var head = document.getElementsByTagName('head')[0];
	var done = false;
	script.onload = script.onreadystatechange = function(){
		if ( !done && (!this.readyState || this.readyState == 'loaded' || this.readyState == 'complete') ) {
			done = true;
			success();
			script.onload = script.onreadystatechange = null;
			head.removeChild(script);
		}
	};
	head.appendChild(script);
}

function getImage(url,success){
	var img = new Image();
	img.src = url;
	img.onload = function(){
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
  }

  request.onerror = function() {
    alert('BufferLoader: XHR error');
  }

  request.send();
}

BufferLoader.prototype.load = function() {
  for (var i = 0; i < this.urlList.length; ++i)
  this.loadBuffer(this.urlList[i], i);
}

//http://www.openjs.com/scripts/others/dump_function_php_print_r.php
function print_r(arr,level){
	var dumped_text = "";
	if(!level) level = 0;
	
	//The padding given at the beginning of the line.
	var level_padding = "";
	for(var j=0;j<level+1;j++) level_padding += "    ";
	
	if(typeof(arr) == 'object') { //Array/Hashes/Objects 
		for(var item in arr) {
			var value = arr[item];
			
			if(typeof(value) == 'object') { //If it is an array,
				dumped_text += level_padding + "'" + item + "' ...\n";
				dumped_text += dump(value,level+1);
			} else {
				dumped_text += level_padding + "'" + item + "' => \"" + value + "\"\n";
			}
		}
	} else { //Stings/Chars/Numbers etc.
		dumped_text = "===>"+arr+"<===("+typeof(arr)+")";
	}
	return dumped_text;
}
