/*	Creature Class
*
*	Creature contains all creatures properties and attacks
*
*/
var Creature = Class.create({

	/*	Attributes
	*	
	*	NOTE : attributes and variables starting with $ are jquery element 
	*	and jquery function can be called dirrectly from them.
	*
	*	//Jquery attributes
	*	$display : 		Creature representation
	*	$effects : 		Effects container (inside $display)
	*	
	*	//Normal attributes
	*	x : 			Integer : 	Hex coordinates
	*	y : 			Integer : 	Hex coordinates
	*	pos : 			Object : 	Pos object for hex comparison {x,y}
	*
	*	name : 			String : 	Creature name
	*	id : 			Integer : 	Creature Id incrementing for each creature starting to 1
	*	size : 			Integer : 	Creature size in hexs (1,2 or 3)
	*	type : 			Integer : 	Type of the creature stocked in the database
	*	team : 			Integer : 	Owner's ID (0,1,2 or 3)
	*	player : 		Player : 	Player object shortcut
	*	hexagons :		Array : 	Array containing the hexs where the creature is
	*
	* 	dead : 			Boolean : 	True if dead
	* 	stats : 		Object : 	Object containing stats of the creature
	*	statsAlt : 		Object : 	Object containing the alteration value for each stat //todo
	*	abilities : 	Array : 	Array containing the 4 abilities
	*	remainingMove : Integer : 	Remaining moves allowed untill the end of turn
	*
	*/


	/* Constructor(obj)
	*
	*	obj : 			Object : 	Object containing all creature stats
	*
	*/
	initialize: function(obj){
		//Engine
		this.name 		= obj.name;
		this.id 		= G.creaIdCounter++;
		this.x 			= obj.x - 0;
		this.y 			= obj.y - 0;
		this.pos 		= {x:this.x, y:this.y};
		this.size 		= obj.size;
		this.type 		= obj.type; //Which creature it is
		this.lvl 		= obj.lvl; //Which creature it is
		this.realm 		= obj.realm; //Which creature it is


		this.hexagons 	= [];

		//Game
		this.team 		= obj.team; // = playerID (0,1,2,3)
		this.player 	= G.players[obj.team];
		this.dead		= false;
		this.hasWait 	= false;
		this.travelDist = 0;
		this.effects 	= [];

		//Statistics
		this.baseStats 	= obj.stats;
		this.stats 		= $j.extend({},this.baseStats);//Copy
		this.health		= obj.stats.health;
		this.remainingMove	= 0; //Default value recovered each turn

		//Abilities
		this.abilities 	= [];
		this.abilities[0] = new Ability(this,0);
		this.abilities[1] = new Ability(this,1);
		this.abilities[2] = new Ability(this,2);
		this.abilities[3] = new Ability(this,3);

		this.updateHex();

		//Creating Html representation of creature
		this.$display = G.grid.$creatureW.append('<div id="crea'+this.id +'" class="creature type_'+this.type+' p'+this.team+'"><div class="effects"></div></div>').children("#crea"+this.id).hide();
		this.$effects = this.$display.children(".effects");

		this.$display.css(this.hexagons[this.size-1].displayPos); //translate to its real position
		this.$display.css("z-index",this.y);
		if(this.player.flipped) this.$display.addClass("flipped");


		//Adding Himself to creature arrays and queue
		G.creatures[this.id] = this;
		G.nextQueue.push(this);
		G.reorderQueue();

		this.summon();
	},


	/*	summon()
	*
	*	Summon animation
	*
	*/
	summon: function(){
		//TODO Summon effect
		this.$display.fadeIn(500);
	},

	/*	activate()
	*
	*	Activate the creature by showing movement range and binding controls to this creature
	*
	*/
	activate: function(){
		this.travelDist = 0;

		if(!this.hasWait){
			this.remainingMove = this.stats.movement;
			this.abilities.each(function(){ this.used = false; });

			//Passive abilities
			this.abilities.each(function(){
				if(this.trigger == "onStartPhase"){
					if( this.require() ){
						this.activate();
					}
				}
			});

		}
		this.player.startTime = new Date();
		this.queryMove();
	},


	/* 	deactivate(wait)
	*
	*	wait : 	Boolean : 	Deactivate while waiting or not
	*
	*	Preview the creature position at the given coordinates
	*
	*/
	deactivate: function(wait){

		this.hasWait = !!wait;

		G.grid.cleanDisplay("adj"); //In case of skip turn
		G.grid.cleanOverlay("creature selected hover h_player0 h_player1 h_player2 h_player3");
		G.grid.updateDisplay(); //Retrace players creatures

		G.nextCreature();
	},


	/* 	wait()
	*
	*	Add the creature to the delayQueue
	*
	*/
	wait: function(){
		if(this.hasWait) return;

		var abilityAvailable = false;

		//If at least one ability has not been used
		this.abilities.each(function(){	abilityAvailable = abilityAvailable || !this.used; });

		if( this.remainingMove>0 && abilityAvailable ){
			G.delayQueue.push(this);
			this.deactivate(true);
		}
	},

	/* 	queryMove()
	*
	*	launch move action query
	*
	*/
	queryMove: function(){

		G.grid.cleanOverlay("creature player"+G.activeCreature.team);
		G.grid.cleanDisplay("adj");
		G.grid.updateDisplay(); //Retrace players creatures

		G.grid.queryHexs(
			function(hex,creature){ creature.tracePath(hex); },
			function(hex,creature){ creature.previewPosition(hex); },
			function(){ 
				G.log("You can't do this."); 
				G.grid.cleanDisplay("adj"); //In case of skip turn
				G.grid.cleanOverlay("creature selected hover h_player0 h_player1 h_player2 h_player3");
				G.grid.updateDisplay(); //Retrace players creatures
			},
			function(hex,creature){ creature.moveTo(hex,{
					callback : function(){
						G.activeCreature.queryMove();
					}
				}); 
			},
			function(){return true;}, //Optional test return true (no test)
			this, //Optional args
			false, //true for flying creatures
			false,
			this.x,this.y,
			this.remainingMove,
			this.id,
			this.size,
			[],
			this.player.flipped
		);
	},


	/* 	previewPosition(hex)
	*
	*	hex : 		Hex : 		Position
	*
	*	Preview the creature position at the given Hex
	*
	*/
	previewPosition: function(hex){
		var crea = this;
		G.grid.cleanOverlay("hover h_player"+crea.team);
		if(!G.grid.hexs[hex.y][hex.x].isWalkable(crea.size,crea.id)) return; //break if not walkable
		for (var i = 0; i < crea.size; i++) {
			G.grid.hexs[hex.y][hex.x-i].$overlay.addClass("hover h_player"+crea.team);
		}
	},


	/* 	cleanHex()
	*
	* 	Clean current creature hexagons
	*
	*/
	cleanHex: function(){
		var creature = this; //Escape Jquery namespace
		this.hexagons.each(function(){ 
			this.$overlay.removeClass("creature player"+creature.team); 
			this.creature = 0;
		})
		this.hexagons = [];
	},


	/* 	updateHex()
	*
	* 	Update the current hexs containing the creature and their display
	*
	*/
	updateHex: function(){
		var creature = this; //Escape Jquery namespace
		for (var i = 0; i < this.size; i++) {
			this.hexagons.push(G.grid.hexs[this.y][this.x-i]);
		}

		this.hexagons.each(function(){ 
			this.$display.addClass("creature player"+creature.team);
			this.creature = creature.id;
		})
	},


	/* 	moveTo(hex)
	*
	*	hex : 		Hex : 		Destination Hex
	*	opt : 		Object : 	Optional args object
	*
	* 	Move the creature along a calculated path to the given coordinates
	*
	*/
	moveTo: function(hex,opts){
		defaultOpt = {
			callback : function(){return true;},
			animation : "walk",
			ignoreMovementPoint : false,
			ignorePath : false,
		}

		opts = $j.extend(defaultOpt,opts);

		var creature = this;
		var x = hex.x;
		var y = hex.y;
		if(opts.ignorePath){
			var path = [hex];
		}else{
			var path = creature.calculatePath(x,y);
			creature.travelDist = path.length;
		}

		G.grid.cleanDisplay("adj"); //Clean previous path
		G.grid.cleanOverlay("hover h_player"+this.team); //Clear path display and creature position preview

		if( path.length == 0 ) return; //Break if empty path

		if(!opts.ignoreMovementPoint) creature.remainingMove -= path.length;

		var pos = path[path.length-1].pos;

		var currentHex = G.grid.hexs[creature.y][creature.x]; //Used further ahead to determine facing

		creature.cleanHex();
		creature.x 		= pos.x - 0;
		creature.y 		= pos.y - 0;
		creature.pos 	= pos;
		creature.updateHex();

		//Determine facing
		var nextHex = path[0];
		if(currentHex.y%2==0){
			var flipped = ( nextHex.x <= currentHex.x );
		}else{
			var flipped = ( nextHex.x+1 <= currentHex.x );
		}
		creature.$display.animate({'margin-right':0},0,"linear",function(){ //To stack with other transforms
			creature.$display.removeClass("flipped");
			if(flipped) creature.$display.addClass("flipped");
		})

		
		//TODO turn around animation

		//Translate creature with jquery animation
		var hexId = 0;
		path.each(function(){
			var nextPos = G.grid.hexs[this.y][this.x-creature.size+1];
			var thisHexId = hexId;

			creature.$display.animate(nextPos.displayPos,500,"linear",function(){
				creature.$display.removeClass("flipped");
				if( thisHexId < path.length-1 ){
					//Determine facing
					currentHex = path[thisHexId];
					nextHex = path[thisHexId+1];
					if(currentHex.y%2==0){
						var flipped = ( nextHex.x <= currentHex.x );
					}else{
						var flipped = ( nextHex.x+1 <= currentHex.x );
					}
					if(flipped) creature.$display.addClass("flipped");
				}else{
					//TODO turn around animation
					if(creature.player.flipped) creature.$display.addClass("flipped");
				}

				//Callback function set the proper z-index;
				creature.$display.css("z-index",nextPos.y);
			});
			hexId++;
		})

		opts.callback();
	},


	/* 	tracePath(hex)
	*
	*	hex : 	Hex : 	Destination Hex
	*
	* 	Trace the path from the current possition to the given coordinates
	*
	*/
	tracePath: function(hex){
		var creature = this;

		var x = hex.x;
		var y = hex.y;
		var path = creature.calculatePath(x,y); //Store path in grid to be able to compare it later

		G.grid.cleanDisplay("adj"); //Clean previous path
		G.grid.cleanOverlay("creature selected player"+creature.team); //Clean previous path
		G.grid.updateDisplay(); //Retrace players creatures

		if( path.length == 0 ) return; //Break if empty path

		path.each(function(){ 
			for (var i = 0; i < creature.size; i++) {
				G.grid.hexs[this.y][this.x-i].$display.addClass("adj"); 
			};
		}) //trace path


		//highlight final position
		var last = path.last()
		for (var i = 0; i < creature.size; i++) {
			G.grid.hexs[last.y][last.x-i].$overlay.addClass("creature selected player"+creature.team);
		};

	},


	/* 	calculatePath(x,y)
	*
	*	x : 		Integer : 	Destination coordinates
	*	y : 		Integer : 	Destination coordinates
	*
	*	return : 	Array : 	Array containing the path hexs
	*
	*/
	calculatePath: function(x,y){
		return astar.search(G.grid.hexs[this.y][this.x],G.grid.hexs[y][x],this.size,this.id); //calculate path
	},


	/* 	calcOffset(x,y)
	*
	*	x : 		Integer : 	Destination coordinates
	*	y : 		Integer : 	Destination coordinates
	*
	*	return : 	Object : 	New position taking into acount the size, orientation and obstacle {x,y}
	*
	* 	Return the first possible position for the creature at the given coordinates
	*
	*/
	calcOffset: function(x,y){
		var offset = (G.players[this.team].flipped) ? this.size-1 : 0 ;
		var mult = (G.players[this.team].flipped) ? 1 : -1 ; //For FLIPPED player
		for (var i = 0; i < this.size; i++) {	//try next hexagons to see if they fits
			if( (x+offset-i*mult >= G.grid.hexs[y].length) || (x+offset-i*mult < 0) ) continue;
			if(G.grid.hexs[y][x+offset-i*mult].isWalkable(this.size,this.id)){ 
				x += offset-i*mult;
				break; 
			}
		};
		return {x:x, y:y};
	},


	/* 	getInitiative(dist)
	*
	*	wait : 		Boolean : 	Take account of the hasWait attribute
	*
	*	return : 	Integer : 	Initiative value to order the queue
	*
	*/
	getInitiative: function(wait){
		return ((this.stats.initiative*4-this.team)+(1000*!(!!wait*!!this.hasWait)))*1000-this.id; //To avoid 2 identical initiative
	},


	/* 	adjacentHexs(dist)
	*
	* 	dist : 		Integer : 	Distance in hexs
	*
	*	return : 	Array : 	Array of adjacent hexs
	*
	*/
	adjacentHexs: function(dist){
		if(this.size > 1){
			var creature = this;
			var Hexs = this.hexagons[0].adjacentHex(dist);
			var lastHexs = this.hexagons[this.size-1].adjacentHex(dist);
			Hexs.each(function(){
				if(creature.hexagons.findPos(this)){Hexs.removePos(this)}//remove from array if own creature hex
			});
			lastHexs.each(function(){
				if(!Hexs.findPos(this) && !creature.hexagons.findPos(this)){ //If node doesnt already exist in final collection and if it's not own creature hex
					Hexs.push(this);
				}
			});
			return Hexs;
		}else{
			return this.hexagons[0].adjacentHex(dist);
		}
	},


	/* 	takeDamage(damage)
	*
	* 	damage : 		Damage : 	Damage object
	*
	*/
	takeDamage: function(damage){
		var creature = this;

		//Passive abilities
		this.abilities.each(function(){
			if(this.trigger == "onDamage"){
				if( this.require(damage) ){
					damage = this.activate(damage);
				}
			}
		});

		//Calculation
		if(!damage.dodged){

			//Damages
			var dmgAmount = damage.apply(this);
			this.health -= dmgAmount;

			//Effects
			damage.effects.each(function(){
				creature.addEffect(this);
			})

			//Display
			var nbrDisplayed = (dmgAmount) ? "-"+dmgAmount : 0;
			var $damage = this.$effects.append('<div class="damage d'+dmgAmount+'">'+nbrDisplayed+'</div>').children(".damage");
			//Damage animation
			$damage.transition({top:-20,opacity:0},2000,function(){ $damage.remove(); }); 

			G.log(this.player.name+"'s "+this.name+" is hit "+nbrDisplayed+" health");

			//If Health is empty
			if(this.health <= 0){
				this.health = 0; //Cap
				this.die(damage.attacker);
			}
		}else{
			//If dodged
			G.log(this.player.name+"'s "+this.name+" dodged the attack");
			var $damage = this.$effects.append('<div class="damage dodged">Dodged</div>').children(".damage");
			$damage.transition({top:-20,opacity:0},2000,function(){ $damage.remove(); }); 
		}
	},


	/* 	addEffect(effect)
	*
	* 	effect : 		Effect : 	Effect object
	*
	*/
	addEffect: function(effect){
		this.effects.push(effect);
		this.updateAlteration();
		//TODO add visual feeback
	},

	/* 	updateAlteration()
	*
	* 	Update the stats taking into account the effects' alteration
	*
	*/
	updateAlteration: function(){
		var crea = this;
		crea.stats = $j.extend({},this.baseStats);//Copy
		this.effects.each(function(){
			$j.each(this.alterations,function(key,value){
				crea.stats[key] += value;
			})
		});
	},

	/*	die()
	*
	*	kill animation. remove creature from queue and from hexs
	*
	*/
	die: function(killer){//TODO
		this.dead = true;

		this.killer = killer.player.id;

		this.$display.fadeOut(500);

		//As hex occupation changes, path must be recalculated for the current creature not the dying one
		this.cleanHex();
		G.activeCreature.queryMove(); 

		//Queue cleaning
		G.queue.removePos(this);
		G.nextQueue.removePos(this);
		G.reorderQueue();

		if(G.activeCreature === this){ G.nextCreature(); } //End turn if current active creature die

		//Debug Info
		G.log("Player"+(this.team+1)+"'s "+this.name+" is dead");
	},
});