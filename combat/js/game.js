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
		this.availableCreatures = ["--","L2","S1","S6"];
		this.zoomed = false;

		//Gameplay
		this.firstKill = false;
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

		$j("#loader").show();

		//Get JSON files
		var i = 0;
		this.availableCreatures.each(function(){
			$j.getJSON("./datas.php?id="+this, function(data) {
				G.creatureDatas.push(data);
				i++;
				if(i==G.availableCreatures.length){ //If all creature are loaded
					G.setup(G.nbrPlayer);
				}
			});
		});
	},


	/*	Setup(nbrPlayer)
	*	
	*	nbrPlayer : 		Integer : 	Ideally 2 or 4, number of players to setup the game
	*
	* 	Launch the game with the given number of player.
	*
	*/
	setup: function(nbrPlayer){
		this.grid = new HexGrid();//Creating Hexgrid

		$j("#combatframe").css("background-image","url('../locations/"+this.background_image+"/bg.jpg')");

		this.startMatchTime = new Date();

		this.$combatFrame = $j("#combatframe");
		this.$combatFrame.show();

		//Remove loading screen
		$j("#matchmaking").remove();

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
			this.windowResizeTimeout = setTimeout(function() { G.resizeCombatFrame(); }, 500);
		});

		$j("#combatwrapper").kinetic({slowmdown: 0,throttleFPS: 30}); //Allow nice dragging effect

		zooming = false;
		$j("#combatwrapper").mousewheel(function(event,delta){
			if(event.originalEvent.wheelDelta > 0){
				//Positive scrolling
				G.zoomed = true;
			}else{
				//Negative scrolling
				G.zoomed = false;
			}

			if(!zooming) G.resizeCombatFrame();
			zooming = true;
			//Throttle down to 1 event every 500ms of inactivity
			clearTimeout(this.windowResizeTimeout);
			this.windowResizeTimeout = setTimeout(function() { zooming = false; }, 250);
		});
	},


	/*	resizeCombatFrame()
	*
	* 	Resize the combat frame
	*
	*/
	resizeCombatFrame: function(){
		if(!this.zoomed){
			if( ($j(window).width() / 1920) > ($j(window).height() / 1080) ){
				this.$combatFrame.transition({ scale: $j(window).height() / 1080  });
			}else{
				this.$combatFrame.transition({ scale: $j(window).width() / 1920  });	
			}
		}else{
			this.$combatFrame.transition({ scale: 1 });
		}
	},


	/*	nextRound()
	*
	* 	Replace the current Queue with the next queue.
	*
	*/
	nextRound: function(){
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
				this.debuglog("Delayed Creature");
			}else{
				this.nextRound(); //Go to next Round
				return; //End function
			}
		}else{
			this.activeCreature = this.queue[0]; //set new creature active
			this.queue = this.queue.slice(1); //and remove it from the queue
		}

		this.activeCreature.activate();

		this.log("Active Creature : "+this.activeCreature.player.name+"'s "+this.activeCreature.name);

		//Update UI to match new creature
		this.UI.updateActivebox();
		this.reorderQueue(); //Update UI and Queue order

		G.checkTime();
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


		if( this.timePool > 0 && this.turnTimePool > 0 ){
			if( (date - p.startTime)/1000 > this.turnTimePool || p.totalTimePool - (date - p.startTime) < 0 ){
				G.endTurn();
				return;
			}
		}else if( this.turnTimePool > 0 ){
			if( (date - p.startTime)/1000 > this.turnTimePool ){
				G.endTurn();
				return;
			}
		}else if( this.timePool > 0 ){
			if( p.totalTimePool - (date - p.startTime) < 0 ){
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


	/*	endGame()
	*
	*	End the game and print stats
	*
	*/
	endGame: function(){
		clearInterval(this.timeInterval);
		
		//Show Score Table
		$j("#endscreen").show();

		var $table = $j("#endscreen table tbody");

		if(this.nbrPlayer==2){ //If Only 2 players remove the other 2 columns
			$table.children("tr").children("td:nth-child(even)").remove();
			var $table = $j("#endscreen table tbody");
		}

		//FILLING THE BOARD
		for(var i = 0; i < this.nbrPlayer; i++){ //Each player 

			//change Name
			$table.children("tr.player_name").children("td:nth-child("+(i+2)+")")
			.text(this.players[i].name); 

			//Change score
			$j.each(this.players[i].getScore(),function(index,val){
				var text = ( val == 0 && index != "total") ? "--" : val ;
				$table.children("tr."+index).children("td:nth-child("+(i+2)+")")
				.text(text);
			});
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
		this.score = [];
		this.plasma = G.plasma_amount;
		this.flipped = !!(id%2); //Convert odd/even to true/false
		this.availableCreatures = G.availableCreatures;
		this.bonusTimePool = 0;
		this.totalTimePool = G.timePool*1000;
		this.startTime = new Date();

		this.score = [];
	},

	/*	summon()
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
		if(window.confirm("Are you sure you want to surrender?")){
			G.endGame();
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
			teamkill : 0,
			humiliation : 0,
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
				case "deny":
					points -= s.creature.lvl*5;
					break;
				case "humiliation":
					points += 50;
					break;
			}
			totalScore[s.type] += points;
			totalScore.total += points;
		}
		return totalScore;
	},

});

//Zfill like in python
function zfill(num, size) {
    var s = "000000000" + num;
    return s.substr(s.length-size);
}
