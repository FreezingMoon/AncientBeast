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
		this.creatures = [];
		this.effects = [];
		this.activeCreature = undefined;
		this.turn = 0;
		this.queue = [];
		this.delayQueue = [];
		this.nextQueue = []; //next round queue
		this.creaIdCounter = 1;
		this.creatureDatas = [];
		this.availableCreatures = [
			0, //Dark Priest
			37, //Swine Thug
			3, //Uncle Fungus
			4, //Magma Spawn
			45, //Chimera
			12, //Snow Bunny
			5]; //Impaler
		this.inputMethod = "Mouse";

		//Gameplay
		this.firstKill = false;
		this.freezedInput = false;

		$j("#loader").show();
		$j("#gamesetupcontainer").hide();

		//Get JSON files
		var i = 0;
		this.availableCreatures.each(function(){
			$j.getJSON("./datas.php?id="+this, function(data) {
				G.creatureDatas.push(data);
				i++;

				var d=document,
				h=d.getElementsByTagName('head')[0],
				s=d.createElement('script');
				s.type='text/javascript';
				s.defer=true;
				s.src='../bestiary/'+data.name+'/abilities.js';
				h.appendChild(s);
				//TODO We should wait before this loads up

				//For code compatibility
				var index = G.availableCreatures.indexOf(data.id);
				G.availableCreatures[index] = data.type;

				if(i==G.availableCreatures.length){ //If all creature are loaded
					$j("#loader").hide();
					$j("#gamesetupcontainer").show();
				}
			});
		});

	},


	/*	loadGame(setupOpt)
	*	
	*	setupOpt : 	Object : 	Setup options from matchmaking menu
	*
	* 	Load all required game files
	*
	*	TODO : Loading bar or spinner
	*
	*/
	loadGame: function(setupOpt){

		var defaultOpt = {
			nbrPlayer : 2,
			timePool : 5*60,
			turnTimePool : 60,
			background_image : "Frozen Skull",
			plasma_amount : 50,
		}
		setupOpt = $j.extend(defaultOpt,setupOpt);
		$j.extend(this,setupOpt);
		
		G.setup(G.nbrPlayer);
	},


	/*	Setup(nbrPlayer)
	*	
	*	nbrPlayer : 		Integer : 	Ideally 2 or 4, number of players to setup the game
	*
	* 	Launch the game with the given number of player.
	*
	*/
	setup: function(nbrPlayer){
		//reseting global counters
		trapID = 0;
		effectId = 0;
		this.creaIdCounter = 1;

		this.grid = new HexGrid();//Creating Hexgrid

		$j("#combatframe").css("background-image","url('../locations/"+this.background_image+"/bg.jpg')");

		this.startMatchTime = new Date();

		this.$combatFrame = $j("#combatframe");
		this.$combatFrame.show();

		//Remove loading screen
		$j("#matchmaking").hide();

		for (var i = 0; i < nbrPlayer; i++) {
			var player = new Player(i)
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

		this.UI = new UI(); //Creating UI not before because certain function requires creature to exists

		//DO NOT CALL LOG BEFORE UI CREATION

		this.log("Welcome to Ancient Beast pre-Alpha");
		this.log("Setting up a "+nbrPlayer+" player match");

		this.timeInterval = setInterval(function(){
			G.checkTime();
		},1000);

		this.nextCreature();

		G.resizeCombatFrame(); //Resize while the game start
		//Resize event
		$j(window).resize(function () {
			//Throttle down to 1 event every 500ms of inactivity
			clearTimeout(this.windowResizeTimeout);
			this.windowResizeTimeout = setTimeout(function() { G.resizeCombatFrame(); }, 100);
		});
	},


	/*	resizeCombatFrame()
	*
	* 	Resize the combat frame
	*
	*/
	resizeCombatFrame: function(){
		if( ($j(window).width() / 1920) > ($j(window).height() / 1080) ){
			// $j("#tabwrapper").css({scale: $j(window).height() / 1080});
			this.$combatFrame.css({ 
				scale: $j(window).height() / 1080, 
				"margin-left": -1920*($j(window).height()/1080)/2, 
				"margin-top": -1080*($j(window).height()/1080)/2, 
			});
		}else{
			// $j("#tabwrapper").css({scale: $j(window).width() / 1080});
			this.$combatFrame.css({ 
				scale: $j(window).width() / 1920, 
				"margin-left": -1920*($j(window).width()/1920)/2, 
				"margin-top": -1080*($j(window).width()/1920)/2, 
			});	
		}

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
		this.log("Round "+this.turn);
		this.queue = this.nextQueue.slice(0); //Copy queue

		this.delayQueue = [];
		this.nextCreature();
	},


	/*	nextCreature()
	*
	* 	Activate the next creature in queue
	*
	*/
	nextCreature: function(){
		if(this.queue.length == 0){ //If no creature in queue
			if(this.delayQueue.length > 0){
				this.activeCreature = this.delayQueue[0]; //set new creature active
				this.delayQueue = this.delayQueue.slice(1); //and remove it from the queue
				console.log("Delayed Creature");
			}else{
				this.nextRound(); //Go to next Round
				return; //End function
			}
		}else{
			this.activeCreature = this.queue[0]; //set new creature active
			this.queue = this.queue.slice(1); //and remove it from the queue
		}

		if(this.activeCreature.player.hasLost){
			this.nextCreature();
			return;
		}

		this.activeCreature.activate();
		G.checkTime();

		this.log("Active Creature : "+this.activeCreature.player.name+"'s "+this.activeCreature.name);

		//Update UI to match new creature
		this.UI.updateActivebox();
		this.reorderQueue(); //Update UI and Queue order
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
	log: function(obj){	
		console.log(obj);
		var time = new Date(new Date() - this.startMatchTime);
		
		this.UI.$textbox.append("<p>"+zfill(time.getHours()-1,2)+":"+zfill(time.getMinutes(),2)+":"+zfill(time.getSeconds(),2)+" "+obj+"</p>"); 
		this.UI.$textbox.parent().scrollTop(this.UI.$textbox.height());
	},


	/*	endTurn()
	*
	* 	End turn for the current creature
	*
	*/
	endTurn: function(){
		// if(G.turnThrottle) return;
		// G.turnThrottle = true
		// setTimeout(function(){G.turnThrottle=false},300)
		G.grid.clearHexViewAlterations();
		var endTurn = new Date();
		var p = this.activeCreature.player;
		p.totalTimePool = p.totalTimePool - (endTurn - p.startTime);
		this.activeCreature.deactivate(false);
		this.nextCreature();
	},


	/*	delayTurn()
	*
	* 	Delay the action turn of the current creature
	*
	*/
	delayTurn: function(){
		// if(G.turnThrottle) return;
		// G.turnThrottle = true
		// setTimeout(function(){G.turnThrottle=false},300)
		var endTurn = new Date();
		var p = this.activeCreature.player;
		p.totalTimePool = p.totalTimePool - (endTurn - p.startTime);
		this.activeCreature.wait();
		this.nextCreature();
	},


	/*	checkTime()
	*	
	*/
	checkTime: function(){
		var date = new Date();
		var p = this.activeCreature.player;

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

		if( this.timePool > 0 && this.turnTimePool > 0 ){ //Turn time and timepool not infinite
			if( (date - p.startTime)/1000 > this.turnTimePool || p.totalTimePool - (date - p.startTime) < 0 ){
				if( p.totalTimePool - (date - p.startTime) < 0 )
					p.deactivate(); //Only if timepool is empty
				G.endTurn();
				return;
			}
		}else if( this.turnTimePool > 0 ){ //Turn time not infinite
			if( (date - p.startTime)/1000 > this.turnTimePool ){
				G.endTurn();
				return;
			}
		}else if( this.timePool > 0 ){ //timepool not infinite
			if( p.totalTimePool - (date - p.startTime) < 0 ){
				p.deactivate();
				G.endTurn();
				return;
			}
		}

		G.UI.updateTimer();
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
		onStartPhase : new RegExp('onStartPhase', 'i'),
		onEndPhase : new RegExp('onEndPhase', 'i'),
		onMovement : new RegExp('onMovement', 'i'),
		onQuery : new RegExp('onQuery', 'i'),
		onDamage : new RegExp('onDamage', 'i'),
	},
	

	/*	endGame()
	*
	*	End the game and print stats
	*
	*/
	endGame: function(){
		clearInterval(this.timeInterval);

		//Calculate The time cost of the end turn
		var endTurn = new Date();
		var p = this.activeCreature.player;
		p.totalTimePool = p.totalTimePool - (endTurn - p.startTime);

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
			//No surrender
			if(!this.players[i].hasSurrendered && !this.players[i].hasLost)
				this.players[i].score.push({type:"nosurrender"});
			//Surviving Creature Bonus
			var immortal = true;
			for(var j = 0; j < this.players[i].creatures.length; j++){
				if(!this.players[i].creatures[j].dead){
					if(this.players[i].creatures[j].type != "--")
						this.players[i].score.push({type:"creaturebonus",creature:this.players[i].creatures[j]});
					else //Darkpreist Bonus
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
});


/*	Player Class
*
*	Player object with attributes
*
*/
var Player = Class.create({
	/*	Attributes
	*
	*	id : 		Integer : 	Id of the player 0,1,2 or 3
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
		this.hasSurrendered = false;
		this.bonusTimePool = 0;
		this.totalTimePool = G.timePool*1000;
		this.startTime = new Date();

		this.score = [{type:"timebonus"}];
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
		
		var creature = new Creature(data);

		this.creatures.push(creature);
	},

	/*	surrender()
	*
	*	Ask if the player want to surrender
	*
	*/
	surrender: function(){
		if( G.turn < 10 ){
			alert("You cannot surrender in the first 10 rounds.");
			return;
		}
		if( this.isLeader() ){
			alert("You cannot surrender while being in lead.");
			return;
		}

		if(window.confirm("Are you sure you want to surrender?")){
			this.hasSurrendered = true;
			this.deactivate();
			G.endTurn();
		}
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
			nosurrender : 0,
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
				case "nosurrender":
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

//Zfill like in python
function zfill(num, size) {
    var s = "000000000" + num;
    return s.substr(s.length-size);
}
