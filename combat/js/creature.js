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
		this.size 		= obj.size - 0;
		this.type 		= obj.type; //Which creature it is
		this.lvl 		= (obj.lvl == "-")?1:obj.lvl-0; //Which creature it is
		this.realm 		= obj.realm; //Which creature it is
		this.animation	= obj.animation;
		this.display	= obj.display;
		

		this.hexagons 	= [];

		//Game
		this.team 		= obj.team; // = playerID (0,1,2,3)
		this.player 	= G.players[obj.team];
		this.dead		= false;
		this.killer 	= undefined;
		this.hasWait 	= false;
		this.travelDist = 0;
		this.effects 	= [];
		

		//Statistics
		this.baseStats 	= {
			health:obj.stats.health-0,
			regrowth:obj.stats.regrowth-0,
			endurance:obj.stats.endurance-0,
			energy:obj.stats.energy-0,
			meditation:obj.stats.meditation-0,
			initiative:obj.stats.initiative-0,
			offense:obj.stats.offense-0,
			defense:obj.stats.defense-0,
			movement:obj.stats.movement-0,
			pierce:obj.stats.pierce-0,
			slash:obj.stats.slash-0,
			crush:obj.stats.crush-0,
			shock:obj.stats.shock-0,
			burn:obj.stats.burn-0,
			frost:obj.stats.frost-0,
			poison:obj.stats.poison-0,
			sonic:obj.stats.sonic-0,
			mental:obj.stats.mental-0,
		},
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
		this.$display = G.grid.$creatureW.append('<div id="crea'+this.id +'" class="creature ghosted p'+this.team+'"><div class="effects"></div></div>').children("#crea"+this.id);
		var dp = (this.type!="--") ? ""
		:(this.team==0)? "-red"
		:(this.team==1)? "-blue"
		:(this.team==2)? "-orange" : "-green" ;

		this.$display.css({
			"background-image" : "url('../bestiary/"+this.name+"/cardboard"+dp+".png')",
			height : this.display.height,
			width : this.display.width,
			"margin-top" : this.display["offset-y"],
			"margin-left" : (!this.player.flipped) ? this.display["offset-x"] : 90*this.size-this.display.width-this.display["offset-x"],
		});
		this.$effects = this.$display.children(".effects");

		this.$display.css(this.hexagons[this.size-1].displayPos); //translate to its real position
		this.$display.css("z-index",this.y);
		this.facePlayerDefault();

		//Health indicator
		this.$health = G.grid.$creatureW.append('<div creature="'+this.id+'" class="health p'+this.team+'">'+this.health+'</div>').children(".health[creature='"+this.id+"']");
		this.$health.hide();
		
		//Adding Himself to creature arrays and queue
		G.creatures[this.id] = this;
		G.nextQueue.push(this);
		G.reorderQueue();

		this.delayable = true;
		
		this.summon();
	},


	/*	summon()
	*
	*	Summon animation
	*
	*/
	summon: function(){
		//TODO Summon effect
		this.$display.removeClass("ghosted");
		$j("#crea_materialize_overlay").remove();

		//reveal and position health indicator
		var offsetX = (this.player.flipped) ? this.x - this.size + 1: this.x ;
		this.$health
			.css(G.grid.hexs[this.y][offsetX].displayPos)
			.css("z-index",this.y)
			.fadeIn(500);
	},

	/*	activate()
	*
	*	Activate the creature by showing movement range and binding controls to this creature
	*
	*/
	activate: function(){
		this.travelDist = 0;
		var crea = this;

		if(!this.hasWait){
			this.remainingMove = this.stats.movement;
			this.abilities.each(function(){ this.setUsed(false); });

			this.heal(this.stats.regrowth);

			//Passive abilities
			this.abilities.each(function(){
				if( G.triggers.onStartPhase.test(this.trigger) ){
					if( this.require() ){
						this.animation(crea);
					}
				}
			});

			//Passive effects
			this.effects.each(function(){
				if( G.triggers.onStartPhase.test(this.trigger) ){
					this.activate(crea);
				}
			});

			this.delayable = true;
		}

		if(G.turn >= G.minimumTurnBeforeFleeing){ G.UI.btnFlee.changeState("normal"); }

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
		G.grid.updateDisplay(); //Retrace players creatures

		//effects triggers
		if(!wait){
			this.effects.each(function(){
				if( G.triggers.onEndPhase.test(this.trigger) ){
					this.activate(this);
				}
			});
		}
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
	queryMove: function(o){

		//Once Per Damage Abilities recover
		G.creatures.each(function(){ 	//For all Creature
			if(this instanceof Creature){
				this.abilities.each(function(){
					if( G.triggers.oncePerDamageChain.test(this.trigger) ){
						this.setUsed(false);
					}
				});
			}
		});

		o = $j.extend({
			noPath : false,
			isAbility : false,
			range : G.grid.getMovementRange(this.x,this.y,this.remainingMove,this.size,this.id),
			callback : function(hex,args){
				G.gamelog.add({action:"move",target:{x:hex.x,y:hex.y}});
				args.creature.delayable = true;
				G.UI.btnDelay.changeState("disabled");
				args.creature.moveTo(hex,{
					callback : function(){ G.activeCreature.queryMove() }
				});
			},
		},o);

		if( !o.isAbility ){
			$j("#abilities .ability").removeClass("active");
			G.UI.selectAbility(-1);
			G.UI.checkAbilities();
		}

		G.grid.updateDisplay(); //Retrace players creatures

		var select = (o.noPath)
		? function(hex,args){ args.creature.tracePosition({ x: hex.x, y: hex.y, overlayClass: "creature moveto selected player"+args.creature.team }); }
		: function(hex,args){ args.creature.tracePath(hex); };

		G.grid.queryHexs({
			fnOnSelect : select,
			fnOnConfirm : o.callback,
			args : { creature:this, args: o.args }, //Optional args
			size : this.size,
			flipped : this.player.flipped,
			id : this.id,
			hexs : o.range
		});
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
		crea.tracePosition({ x: hex.x, y: hex.y, overlayClass: "hover h_player"+crea.team });
	},


	/* 	cleanHex()
	*
	* 	Clean current creature hexagons
	*
	*/
	cleanHex: function(){
		var creature = this; //Escape Jquery namespace
		this.hexagons.each(function(){ this.creature = undefined; })
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
			this.creature = creature;
		})
	},
	
	/* 	faceHex(facefrom,faceto)
	*
	*	facefrom : 	Hex or Creature :	Hex to face from
	*	faceto : 	Hex or Creature :	Hex to face
	*
	* 	Face creature at given hex
	*
	*/
	faceHex: function(faceto,facefrom){
		
		if( !facefrom )	facefrom = (this.size < 2)? this.hexagons[0]: this.hexagons[1];

		if(faceto instanceof Creature) faceto = (faceto.size < 2)? faceto.hexagons[0]: faceto.hexagons[1];

		if(facefrom.y%2==0){
			var flipped = ( faceto.x <= facefrom.x );
		}else{
			var flipped = ( faceto.x+1 <= facefrom.x );
		}

		if(flipped){ 
			this.$display.addClass("flipped").css("margin-left", 90*this.size-this.display.width-this.display["offset-x"]);
		}else{
			this.$display.removeClass("flipped").css("margin-left", this.display["offset-x"]);
		}
	},
	
	/* 	facePlayerDefault()
	*
	* 	Face default direction
	*
	*/
	facePlayerDefault: function(){
		if(this.player.flipped){ 
			this.$display.addClass("flipped").css("margin-left", 90*this.size-this.display.width-this.display["offset-x"]);
		}else{
			this.$display.removeClass("flipped").css("margin-left", this.display["offset-x"]);
		}
	},

	/* 	moveTo(hex,opts)
	*
	*	hex : 		Hex : 		Destination Hex
	*	opts : 		Object : 	Optional args object
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
		}

		if( path.length == 0 ) return; //Break if empty path

		G.freezedInput = true;

		var anim_id = Math.random();
		G.animationQueue.push(anim_id);

		var currentHex = creature.hexagons[0];

		//Determine facing
		creature.$display.animate({'margin-right':0,opacity:1},0,"linear",function(){ //To stack with other transforms
			//creature.facePlayerDefault();
			if(opts.animation!="push") creature.faceHex(path[0],currentHex);
		});

		//      STEP OUT
		//Trap
		creature.hexagons.each(function(){
			this.activateTrap(G.triggers.onStepOut,creature);
		});
		//Passive abilities
		creature.abilities.each(function(){
			if( G.triggers.onStepOut.test(this.trigger) ){
				if( this.require(currentHex) ){
					this.animation(currentHex);
				}
			}
		});

		//Passive effects
		creature.effects.each(function(){
			if( G.triggers.onStepOut.test(this.trigger) ){
				this.activate(currentHex);
			}
		});

		creature.cleanHex();
		G.grid.updateDisplay();
		G.grid.xray( new Hex(0,0) ); //Clean Xray

		creature.$health.hide();
		
		//TODO turn around animation

		//Translate creature with jquery animation
		creature.travelDist = 0;

		var hexId = 0;

		if( opts.animation == "teleport" ){
			var currentHex = G.grid.hexs[hex.y][hex.x-creature.size+1];

			creature.$display.css({opacity:0}).animate({'margin-right':0},500,"linear",function(){
				creature.$display
					.css(currentHex.displayPos)
					.css({"z-index":currentHex.y,opacity:1});
				
				creature.cleanHex();
				creature.x 	= hex.x - 0;
				creature.y 	= hex.y - 0;
				creature.pos 	= hex.pos;
				creature.updateHex();

				G.grid.updateDisplay();

				//TODO turn around animation
				creature.facePlayerDefault();

				//reveal and position healh idicator
				var offsetX = (creature.player.flipped) ? creature.x - creature.size + 1: creature.x ;
				creature.$health
					.css(G.grid.hexs[creature.y][offsetX].displayPos)
					.css("z-index",creature.y)
					.show();

				G.animationQueue.filter(function(){ return (this!=anim_id); });
				if( G.animationQueue.length == 0 ) G.freezedInput = false;
			});
		}else{
			path.each(function(){
				var nextPos = G.grid.hexs[this.y][this.x-creature.size+1];
				var thisHexId = hexId;
				creature.$display.animate(nextPos.displayPos,parseInt(creature.animation.walk_speed),"linear",function(){
					//Sound Effect
					G.soundsys.playSound(G.soundLoaded[1],G.soundsys.effectsGainNode);

					//creature.facePlayerDefault(creature);
					var currentHex = path[thisHexId];

					creature.cleanHex();
					creature.x 	= currentHex.x - 0;
					creature.y 	= currentHex.y - 0;
					creature.pos 	= currentHex.pos;
					creature.updateHex();

					if(!opts.ignoreMovementPoint){
						creature.travelDist++;
						creature.remainingMove--;

						//      STEP IN

						//Trap
						creature.hexagons.each(function(){
							this.activateTrap(G.triggers.onStepIn,creature);
						});
						//Passive abilities
						creature.abilities.each(function(){
							if( G.triggers.onStepIn.test(this.trigger) ){
								if( this.require(currentHex) ){
									this.animation(currentHex);
								}
							}
						});

						//Passive effects
						creature.effects.each(function(){
							if( G.triggers.onStepIn.test(this.trigger) ){
								this.activate(currentHex);
							}
						});
					}

					if( thisHexId < path.length-1 && creature.remainingMove > 0 ){
						//Determine facing
						if(opts.animation!="push") creature.faceHex(path[thisHexId+1],currentHex);

						//      STEP OUT
						//Trap
						creature.hexagons.each(function(){
							this.activateTrap(G.triggers.onStepOut,creature);
						});
						//Passive abilities
						creature.abilities.each(function(){
							if( G.triggers.onStepOut.test(this.trigger) ){
								if( this.require(currentHex) ){
									this.animation(currentHex);
								}
							}
						});

						//Passive effects
						creature.effects.each(function(){
							if( G.triggers.onStepOut.test(this.trigger) ){
								this.activate(currentHex);
							}
						});
					}else{
						creature.$display.clearQueue(); //Stop the creature

						G.grid.updateDisplay();

						//TODO turn around animation
						creature.facePlayerDefault();

						//reveal and position healh idicator
						var offsetX = (creature.player.flipped) ? creature.x - creature.size + 1: creature.x ;
						creature.$health
							.css(G.grid.hexs[creature.y][offsetX].displayPos)
							.css("z-index",creature.y)
							.show();

						G.animationQueue.filter(function(){ return (this!=anim_id); });
						if( G.animationQueue.length == 0 ) G.freezedInput = false;
					}

					//Set the proper z-index;
					creature.$display.css("z-index",nextPos.y);

				});
				hexId++;
			})
		}

		var interval = setInterval(function(){
			if(!G.freezedInput){
				clearInterval(interval);
				opts.callback();
			}
		},100)

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

		G.grid.updateDisplay(); //Retrace players creatures

		if( path.length == 0 ) return; //Break if empty path

		path.each(function(){ 
			creature.tracePosition({ x: this.x, y: this.y, displayClass: "adj" });
		}) //trace path


		//highlight final position
		var last = path.last()

		creature.tracePosition({ x: last.x, y: last.y, overlayClass: "creature moveto selected player"+creature.team });

	},


	tracePosition: function(args){
		var crea = this;

		var defaultArgs = {
			x : crea.x,
			y : crea.y,
			overlayClass : "",
			displayClass : "",
		};

		args = $j.extend(defaultArgs,args);

		for (var i = 0; i < crea.size; i++) {
			var hex = G.grid.hexs[args.y][args.x-i];
			hex.overlayVisualState(args.overlayClass);
			hex.displayVisualState(args.displayClass);
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



	/* 	heal(amount)
	*
	* 	amount : 	Damage : 	Amount of health point to restore
	*/
	heal: function(amount){
		if(this.health + amount > this.baseStats.health)
			amount = this.baseStats.health - this.health; //Cap health point

		if(this.health + amount < 1)
			amount = this.health-1; //Cap to 1hp

		//if(amount == 0) return;

		this.health += amount; 

		//Health display Update
		this.updateHealth();

		if(amount>0){
			this.hint(amount,'healing d'+amount);
			G.log(this.player.name+"'s "+this.name+" recovers +"+amount+" health");
		}else if(amount==0){
			this.hint("!",'msg_effects');
		}else{
			this.hint(amount,'dammage d'+amount);
			G.log(this.player.name+"'s "+this.name+" loses -"+amount+" health");
		}
		

	},


	/* 	takeDamage(damage)
	*
	* 	damage : 	Damage : 	Damage object
	*
	*	return : 	Object : 	Contains damages dealed and if creature is killed or not
	*/
	takeDamage: function(damage){
		var creature = this;

		//Passive abilities
		this.abilities.each(function(){
			if( G.triggers.onAttack.test(this.trigger) ){
				if( this.require(damage) ){
					damage = this.animation(damage);
				}
			}
		});

		//Calculation
		if(damage.status == ""){

			//Damages
			var dmg = damage.apply(this);
			var dmgAmount = dmg.total;
			this.health -= dmgAmount;
			this.health = (this.health < 0) ? 0 : this.health; //Cap

			//Effects
			damage.effects.each(function(){
				creature.addEffect(this);
			})

			//Display
			var nbrDisplayed = (dmgAmount) ? "-"+dmgAmount : 0;
			this.hint(nbrDisplayed,'damage d'+dmgAmount);

			G.log(this.player.name+"'s "+this.name+" is hit "+nbrDisplayed+" health");

			//Health display Update
			this.updateHealth();

			//If Health is empty
			if(this.health <= 0){
				this.die(damage.attacker);
				return {damages:dmg, kill:true}; //Killed
			}

			//Passive abilities
			this.abilities.each(function(){
				if( G.triggers.onDamage.test(this.trigger) ){
					if( this.require(damage) ){
						damage = this.animation(damage);
					}
				}
			});

			return {damages:dmg, kill:false}; //Not Killed
		}else{
			if(damage.status == "Dodged"){ //If dodged
				G.log(this.player.name+"'s "+this.name+" dodged the attack");
			}

			if(damage.status == "Shielded"){ //If Shielded
				G.log(this.player.name+"'s "+this.name+" shielded the attack");
			}

			if(damage.status == "Disintegrated"){ //If Disintegrated
				G.log(this.player.name+"'s "+this.name+" has been disintegrated");
				this.die(damage.attacker);
			}

			//Hint
			this.hint(damage.status,'damage '+damage.status.toLowerCase());
		}

		return {kill:false}; //Not killed
	},


	updateHealth: function(){
		this.$health.text(this.health);
	},

	/* 	addEffect(effect)
	*
	* 	effect : 		Effect : 	Effect object
	*
	*/
	addEffect: function(effect){
		this.effects.push(effect);
		this.updateAlteration();

		this.hint(effect.name,'msg_effects');

		G.log(this.player.name+"'s "+this.name+" is affected by "+effect.name);
	},

	hint: function(text,cssclass){
		var id = this.$effects.children().length;
		var $tooltip = this.$effects.append('<div id="hint'+id+1+'" class="'+cssclass+'">'+text+'</div>').children('#hint'+id+1);
		$tooltip.css({"margin-left": -250+(this.display.width/2)});
		$tooltip.transition({opacity:0},2000,function(){ this.remove(); }); 
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
	*	killer : 	Creature : 	Killer of this creature
	*
	*/
	die: function(killer){
		this.dead = true;		

		this.killer = killer.player;
		var isDeny = (this.killer.flipped == this.player.flipped);

		if(!G.firstKill && !isDeny){ //First Kill
			this.killer.score.push({type:"firstKill"});
			G.firstKill = true;
		}

		if(this.type == "--"){ //IF darkpriest
			if(isDeny){
				//TEAM KILL (DENY)
				this.killer.score.push({type:"deny",creature:this});
			}else{
				//humiliation
				this.killer.score.push({type:"humiliation",player:this.team});
			}
		}

		if(!this.undead){//only if not undead
			if(isDeny){
				//TEAM KILL (DENY)
				this.killer.score.push({type:"deny",creature:this});
			}else{
				//KILL
				this.killer.score.push({type:"kill",creature:this});
			}
		}

		if( this.player.isAnnihilated() ){
			//remove humiliation as annihilation is an upgrade
			for(var i = 0; i < this.killer.score.length; i++){
				var s = this.killer.score[i];
				if(s.type == "humiliation"){
					if(s.player == this.team) this.killer.score.splice(i,1);	
					break;
				}
			}
			//ANNIHILATION
			this.killer.score.push({type:"annihilation",player:this.team});
		}

		if(this.type == "--") this.player.deactivate(); //Here because of score calculation

		//Kill animation
		this.$display.fadeOut(500);
		this.$health.fadeOut(500);

		//As hex occupation changes, path must be recalculated for the current creature not the dying one
		this.cleanHex();
		G.activeCreature.queryMove(); 

		//Queue cleaning
		G.queue.removePos(this);
		G.nextQueue.removePos(this);
		G.delayQueue.removePos(this);
		G.reorderQueue();

		if(G.activeCreature === this){ G.nextCreature(); } //End turn if current active creature die

		G.UI.updateActivebox();
		//Debug Info
		G.log("Player"+(this.team+1)+"'s "+this.name+" is dead");
	},


	/*	isAlly(team)
	*
	*	team : 		Integer : 	id of the player
	*
	*	return : 	Boolean : 	True if ally and false for ennemies
	*/
	isAlly : function(team){
		return ( team%2 == this.team%2 );
	},

});
