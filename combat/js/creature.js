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
		this.type 		= obj.type; //Wich creature it is

		this.hexagons 	= [];

		//Game
		this.team 		= obj.team; // = playerID (0,1,2,3)
		this.player 	= G.players[obj.team];
		this.dead		= false;
		this.asWait 	= false;

		//Statistics
		this.stats 		= obj.stats;
		this.remainingMove	= 0; //Default value recovered each turn

		//Abilities
		this.abilities 	= [];
		this.abilities[0] = new Ability(this,0);
		this.abilities[1] = new Ability(this,1);
		this.abilities[2] = new Ability(this,2);
		this.abilities[3] = new Ability(this,3);

		this.updateHex();

		//Creating Html representation of creature
		this.$display = G.grid.$creatureW.append('<div id="crea'+this.id +'" class="creature type_'+this.type+'"><div class="effects"></div></div>').children("#crea"+this.id).hide();
		this.$effects = this.$display.children(".effects");

		this.$display.css(this.hexagons[this.size-1].displayPos); //translate to its real position
		this.$display.css("z-index",this.y);
		if(this.team%2 == 1) this.$display.addClass("fliped");


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
		this.$display.show(1000);
	},

	/*	activate()
	*
	*	Activate the creature by showing movement range and binding controls to this creature
	*
	*/
	activate: function(){
		this.remainingMove = this.stats.movement;
		this.weightAll();
		this.bindMouseover();

		var creature = this; //Escape Jquery namespace

		this.abilities.each(function(){ this.used = false; });


		//Bind for movement
		G.grid.$allInptHex.bind('click', function(){
			var x = $j(this).attr("x")-0;
			var y = $j(this).attr("y")-0;
			var path = creature.calculatePath(x,y);

			if( path.length == 0 ){ 
				//G.grid.cleanDisplay("adj");
				G.debuglog("Empty path during test");
				return false;
			}

			if( path.length > creature.remainingMove ){
				G.log("Not enought move points");
				//rectify the end of the path
				x = path[creature.remainingMove-1].x;
				return false;
			}

			if( path.last() == G.grid.path.last() ){
				creature.moveTo(x,y);
				//if( creature.remainingMove == 0 ){ creature.deactivate(); return;}
				//creature.bindMouseover();
				creature.weightAll();
			}else{
				creature.tracePath(x,y);
				creature.highlightPosition(x,y);
			}
		});
	},


	/* 	deactivate()
	*
	*	Preview the creature position at the given coordinates
	*
	*/
	deactivate: function(){
		G.grid.cleanDisplay("adj hover h_player"+this.team); //In case of skip turn

		//Unbind UI and hexs
		G.grid.$allInptHex.unbind('click');
		G.grid.$allInptHex.unbind('mouseover');

		G.nextCreature();
	},


	/* 	bindMouseover()
	*
	*	Bind mouseover action for reachable hexs
	*
	*/
	bindMouseover: function(){
		var creature = this; //Escape Jquery namespace
		G.grid.$allInptHex.unbind('mouseover');
		G.grid.$allInptHex.filter(".hex:not(.not-reachable)").bind('mouseover', function(){
			var x = $j(this).attr("x")-0;
			var y = $j(this).attr("y")-0;
			creature.highlightPosition(x,y);
		});
	},


	/* 	highlightPosition(x,y)
	*
	*	x : 		Integer : 	Position coordinates
	*	y : 		Integer : 	Position coordinates
	*
	*	Preview the creature position at the given coordinates
	*
	*/
	highlightPosition: function(x,y){
		G.grid.cleanOverlay("hover h_player"+this.team);
		var pos = this.calcOffset(x,y);
		if(!G.grid.hexs[pos.y][pos.x].isWalkable(this.size,this.id)) return; //break if not walkable
		for (var i = 0; i < this.size; i++) {
			G.grid.hexs[pos.y][pos.x-i].$overlay.addClass("hover h_player"+this.team);
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
			this.$overlay.addClass("creature player"+creature.team);
			this.creature = creature.id;
		})
	},


	/* 	moveTo(x,y)
	*
	*	x : 		Integer : 	Destination coordinates
	*	y : 		Integer : 	Destination coordinates
	*
	* 	Move the creature along a calculated path to the given coordinates
	*
	*/
	moveTo: function(x,y){
		G.grid.path = this.calculatePath(x,y);

		G.grid.cleanDisplay("adj"); //Clean previous path
		G.grid.cleanOverlay("hover h_player"+this.team); //Clear path display and creature position preview
		if( G.grid.path.length == 0 ) return; //Break if empty path

		this.remainingMove -= G.grid.path.length;

		var creature = this; //Escape Jquery namespace
		var pos = G.grid.path[G.grid.path.length-1].pos;

		this.cleanHex();
		this.x 		= pos.x - 0;
		this.y 		= pos.y - 0;
		this.pos 	= pos;
		this.updateHex();

		//Translate creature with jquery animation
		G.grid.path.each(function(){
			var nextHex = G.grid.hexs[this.y][this.x-creature.size+1];
			creature.$display.animate(nextHex.displayPos,500,"linear",function(){
				//Callback function set the proper z-index;
				creature.$display.css("z-index",nextHex.y);
			});
		})

		G.grid.path = [];
	},


	/* 	tracePath(x,y)
	*
	*	x : 		Integer : 	Destination coordinates
	*	y : 		Integer : 	Destination coordinates
	*
	* 	Trace the path from the current possition to the given coordinates
	*
	*/
	tracePath: function(x,y){
		G.grid.path = this.calculatePath(x,y); //Store path in grid to be able to compare it later

		G.grid.cleanDisplay("adj"); //Clean previous path
		G.grid.updateDisplay(); //Retrace players creatures

		if( G.grid.path.length == 0 ) return; //Break if empty path

		var creature = this;
		G.grid.path.each(function(){ 
			for (var i = 0; i < creature.size; i++) {
				G.grid.hexs[this.y][this.x-i].$display.addClass("adj"); 
			};
		}) //trace path


		//highlight final position
		var last = G.grid.path.last()
		for (var i = 0; i < creature.size; i++) {
			G.grid.hexs[last.y][last.x-i].$overlay.addClass("creature player"+creature.team);
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
		var pos = this.calcOffset(x,y);
		x = pos.x;
		y = pos.y;
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
		var offset = (G.players[this.team].fliped) ? this.size-1 : 0 ;
		var mult = (G.players[this.team].fliped) ? 1 : -1 ; //For FLIPED player
		for (var i = 0; i < this.size; i++) {	//try next hexagons to see if they fits
			if( (x+offset-i*mult >= G.grid.hexs[y].length) || (x+offset-i*mult < 0) ) continue;
			if(G.grid.hexs[y][x+offset-i*mult].isWalkable(this.size,this.id)){ 
				x += offset-i*mult;
				break; 
			}
		};
		return {x:x, y:y};
	},


	/* 	getDelay(dist)
	*
	*	return : 	Integer : 	Delay value to order the queue
	*
	*/
	getDelay: function(){
		return this.stats.delay*1000+this.team+this.id; //
	},


	/* 	weightAll(dist)
	*
	*	Calculate and display movement range for this creature.
	*
	*/
	weightAll: function(){
		G.grid.highlightCreatureRange(this.x,this.y,this.remainingMove,this.size,this.id);
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
	* 	damage : 		Integer : 	Positive value, amount of damage
	*
	*/
	takeDamage: function(damage){//TODO Implement damage type
		//Calculation
		this.stats.health -= damage;
		//Display
		var $damage = this.$effects.append('<div class="damage">-'+damage+'</div>').children(".damage");
		$damage.transition({top:-20,opacity:0},2000,function(){//1sec animation
			//Then delete damage div
			$damage.remove();
		});
		G.log("Player"+(this.team+1)+"'s "+this.name+" is hit -"+damage+" health");
		if(this.stats.health <= 0){ this.die() }
	},


	/*	die()
	*
	*	kill animation. remove creature from queue and from hexs
	*
	*/
	die: function(){//TODO
		this.dead = true;
		this.$display.hide("fade");

		//As hex occupation changes, path must be recalculated for the current creature not the dying one
		this.cleanHex();
		G.activeCreature.weightAll(); 

		//Queue cleaning
		G.queue.removePos(this);
		G.nextQueue.removePos(this);
		G.reorderQueue();

		if(G.activeCreature === this){ G.nextCreature(); } //End turn if current active creature die

		//Debug Info
		G.log("Player"+(this.team+1)+"'s "+this.name+" is dead");
	},
});
