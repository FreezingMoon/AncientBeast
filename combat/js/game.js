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
	*	nextQueue : 		Array : 	Array containing ALL creature ordered by initiative
	*
	*	//normal attributes
	*	nbrPlayer : 		Integer : 	Number of player in the game
	*	activeCreature : 	Creature : 	Current active creature object reference
	*	creaIdCounter : 	Integer : 	Creature ID counter used for creature creation
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
		this.activeCreature = undefined;
		this.queue = [];
		this.nextQueue = []; //next round queue
		this.creaIdCounter = 1;
	},


	/*	Setup(nbrPlayer)
	*	
	*	nbrPlayer : 		Integer : 	Ideally 2 or 4, number of players to setup the game
	*
	* 	Launch the game with the given number of player.
	*
	*/
	setup: function(nbrPlayer){
		this.nbrPlayer = nbrPlayer; //To be able to access it in the future

		this.grid = new HexGrid();//Creating Hexgrid

		this.$combatFrame = $j("#combatframe");

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

			player.summon("0",pos); //Summon Dark Priest
			
		};

		this.UI = new UI(); //Creating UI not before because certain function requires creature to exists

		//DO NOT CALL LOG BEFORE UI CREATION

		this.log("Welcome to Ancient Beast pre-Alpha");
		this.log("Setting up a "+nbrPlayer+" player match");

		this.nextCreature();

	},


	/*	nextRound()
	*
	* 	Replace the current Queue with the next queue.
	*
	*/
	nextRound: function(){
		this.log("New Round");
		this.reorderQueue(); //Precaution
		this.queue = this.nextQueue.slice(0); //Copy queue
		this.nextCreature();
	},


	/*	nextCreature()
	*
	* 	Activate the next creature in queue
	*
	*/
	nextCreature: function(){
		if(this.queue.length == 0){ //If no creature in queue
			this.nextRound(); //Go to next Round
			return; //End function
		}

		this.log("Active Creature : Player"+(this.queue[0].team+1)+"'s "+this.queue[0].name);
		this.queue[0].activate(); //Activate first creature of the queue
		this.activeCreature = this.queue[0];
		this.queue = this.queue.slice(1); //and remove it from the queue
		this.UI.nextCreature(); //Update UI to match new creature
	},


	/*	reorderQueue()
	*
	* 	Do what it says xD
	*
	*/
	reorderQueue: function(){
		this.queue.orderByInitiative();
		this.nextQueue.orderByInitiative();
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
		this.UI.$textbox.append("<p>"+obj+"</p>"); 
		this.UI.$textbox.parent().scrollTop(this.UI.$textbox.height());
	},


	/*	log(obj)
	*
	*	obj : 	Any : 	Any variable to display in console
	*
	* 	Same as log() but only in console
	*
	*/
	debuglog: function(obj){ console.log(obj);},


	/*	endTurn()
	*
	* 	End turn for the current creature
	*
	*/
	endTurn: function(){
		this.activeCreature.deactivate();
	},


	/*	retreiveCre
	*
	*	type : 	String : 	Creature type (ex: "0" for Dark Priest and "L2" for Magma Spawn)
	*
	*	Query the database for creature stats
	*
	*/
	retreiveCreatureStats: function(type){
		//TEMPORARY SOLUTION
		var data = (type=="0")
		?{
			name: "Dark Priest",
			type: "0",
			size: 1,
			stats: {
				health: 100,
				initiative:10,
				movement:5,
			},
		}
		:{
			name: "Magma Spawn",
			type: "L2",
			size: 3,
			stats: {
				health: 10,
				initiative:15,
				movement:5,
			},
		};
		return data;
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
	*	fliped : 	Boolean : 	Player side of the battlefield (affects displayed creature)
	*
	*/
	initialize: function(id){
		this.id = id;
		this.creatures = [];
		this.plasma = 50;
		this.fliped = !!(id%2); //Convert odd/even to true/false
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

		this.creatures[creature.id] = creature;
	}
});
