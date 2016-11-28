/*	Creature Class
*
*	Creature contains all creatures properties and attacks
*
*/
var Creature = Class.create( {

	/*	Attributes
	*
	*	NOTE : attributes and variables starting with $ are jquery element
	*	and jquery function can be called dirrectly from them.
	*
	*	//Jquery attributes
	*	$display :		Creature representation
	*	$effects :		Effects container (inside $display)
	*
	*	//Normal attributes
	*	x :				Integer :	Hex coordinates
	*	y :				Integer :	Hex coordinates
	*	pos :			Object :	Pos object for hex comparison {x,y}
	*
	*	name :			String :	Creature name
	*	id :			Integer :	Creature Id incrementing for each creature starting to 1
	*	size :			Integer :	Creature size in hexs (1,2 or 3)
	*	type :			Integer :	Type of the creature stocked in the database
	*	team :			Integer :	Owner's ID (0,1,2 or 3)
	*	player :		Player :	Player object shortcut
	*	hexagons :		Array :		Array containing the hexs where the creature is
	*
	*	dead :			Boolean :	True if dead
	*	stats :			Object :	Object containing stats of the creature
	*	statsAlt :		Object :	Object containing the alteration value for each stat //todo
	*	abilities :		Array :		Array containing the 4 abilities
	*	remainingMove : Integer :	Remaining moves allowed untill the end of turn
	*
	*/


	/* Constructor(obj)
	*
	*	obj :			Object :	Object containing all creature stats
	*
	*/
	initialize: function(obj) {
		// Engine
		this.name		= obj.name;
		this.id			= G.creaIdCounter++;
		this.x			= obj.x - 0;
		this.y			= obj.y - 0;
		this.pos		= {x: this.x, y: this.y};
		this.size		= obj.size - 0;
		this.type				= obj.type;
		this.level			= obj.level-0;
		this.realm			= obj.realm;
		this.animation	= obj.animation;
		this.display	= obj.display;
		this.drop		= obj.drop;
		this._movementType = "normal";
		if (obj.movementType) {
			this._movementType = obj.movementType;
		}

		this.hexagons	= [];

		// Game
		this.team		= obj.team; // = playerID (0,1,2,3)
		this.player		= G.players[obj.team];
		this.dead		= false;
		this.killer		= undefined;
		this.hasWait	= false;
		this.travelDist = 0;
		this.effects	= [];
		this.dropCollection	= [];
		this.protectedFromFatigue = (this.type == "--") ? true : false ;
		this.turnsActive = 0;

		// Statistics
		this.baseStats	= {
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

			moveable: true,
			fatigueImmunity: false,
			frozen: false,
			// Extra energy required for abilities
			reqEnergy: 0
		};
		this.stats		= $j.extend({}, this.baseStats); //Copy
		this.health		= obj.stats.health;
		this.endurance	= obj.stats.endurance;
		this.energy		= obj.stats.energy;
		this.remainingMove	= 0; //Default value recovered each turn

		// Abilities
		this.abilities	= [];
		this.abilities[0] = new Ability(this,0);
		this.abilities[1] = new Ability(this,1);
		this.abilities[2] = new Ability(this,2);
		this.abilities[3] = new Ability(this,3);

		this.updateHex();

		var dp = (this.type !== "--") ? ""
		:(this.team === 0)? "red"
		:(this.team === 1)? "blue"
		:(this.team === 2)? "orange" : "green" ;

		// Creature Container
		this.grp = G.Phaser.add.group(G.grid.creatureGroup, "creatureGrp_" + this.id);
		this.grp.alpha = 0;
		// Adding sprite
		this.sprite = this.grp.create(0, 0, this.name + dp + '_cardboard');
		this.sprite.anchor.setTo(0.5, 1);
		// Placing sprite
		this.sprite.x = ((!this.player.flipped) ? this.display["offset-x"] : 90*this.size-this.sprite.texture.width-this.display["offset-x"]) + this.sprite.texture.width/2;
		this.sprite.y = this.display["offset-y"] + this.sprite.texture.height;
		// Placing Group
		this.grp.x = this.hexagons[this.size-1].displayPos.x;
		this.grp.y = this.hexagons[this.size-1].displayPos.y;

		this.facePlayerDefault();

		// Hint Group
		this.hintGrp = G.Phaser.add.group(this.grp, "creatureHintGrp_" + this.id);
		this.hintGrp.x = 45 * this.size;
		this.hintGrp.y = -this.sprite.texture.height+5;

		// Health indicator
		this.healthIndicatorGroup = G.Phaser.add.group(this.grp, "creatureHealthGrp_" + this.id);
		// Adding background sprite
		this.healthIndicatorSprite = this.healthIndicatorGroup.create(
			this.player.flipped ? 19 : 19 + 90 * (this.size-1),
			49,
			"p" + this.team + '_health');
		// Add text
		this.healthIndicatorText = G.Phaser.add.text(
			this.player.flipped ? 45 : 45 + 90 * (this.size-1),
			63,
			this.health,
			{
				font: "bold 15pt Play", fill: "#fff", align: "center", stroke: "#000",
				strokeThickness: 6
			});
		this.healthIndicatorText.anchor.setTo(0.5, 0.5);
		this.healthIndicatorGroup.add(this.healthIndicatorText);
		// Hide It
		this.healthIndicatorGroup.alpha = 0;

		// State variable for displaying endurance/fatigue text
		this.fatigueText = "";

		// Adding Himself to creature arrays and queue
		G.creatures[this.id] = this;

		this.delayable = true;
		this.delayed = false;
		this.materializationSickness = (this.type == "--") ? false : true ;
		this.noActionPossible = false;

	},


	/*	summon()
	*
	*	Summon animation
	*
	*/
	summon: function() {

		G.queue.addByInitiative(this);
		G.updateQueueDisplay();

		G.grid.updateDisplay(); // Retrace players creatures
		G.grid.orderCreatureZ();

		if(G.grid.materialize_overlay) {
			G.grid.materialize_overlay.alpha = 0.5;
			G.Phaser.add.tween(G.grid.materialize_overlay)
				.to({alpha:0}, 500, Phaser.Easing.Linear.None)
				.start();
		}

		G.Phaser.add.tween(this.grp)
		.to({alpha:1}, 500, Phaser.Easing.Linear.None)
			.start();

		// Reveal and position health indicator
		this.updateHealth();
		this.healthShow();

		// Trigger trap under
		var crea = this;
		this.hexagons.each(function() {
			this.activateTrap(G.triggers.onStepIn, crea);
		});

		// Pickup drop
		this.pickupDrop();
	},


	healthHide: function() {
		this.healthIndicatorGroup.alpha = 0;
	},

	healthShow: function() {
		var offsetX = (this.player.flipped) ? this.x - this.size + 1 : this.x ;
		var hex = G.grid.hexs[this.y][offsetX];
		// this.healthIndicatorGroup.x = hex.displayPos.x;
		// this.healthIndicatorGroup.y = hex.displayPos.y;
		this.healthIndicatorGroup.alpha = 1;
	},

	/*	activate()
	*
	*	Activate the creature by showing movement range and binding controls to this creature
	*
	*/
	activate: function() {
		this.travelDist = 0;
		var crea = this;

		crea.oldEnergy = crea.energy;
		crea.oldHealth = crea.health;
		crea.noActionPossible = false;

		var varReset = function() {
			G.triggersFn.onReset(crea);
			// Variables reset
			crea.updateAlteration();
			crea.remainingMove = crea.stats.movement;

			if(!crea.materializationSickness) {
				// Fatigued creatures (endurance 0) should not regenerate, but fragile
				// ones (max endurance 0) should anyway
				if (!crea.isFatigued()) {
					crea.heal(crea.stats.regrowth, true);
					if (crea.stats.meditation > 0) {
						crea.recharge(crea.stats.meditation);
					}
				}else{
					if(crea.stats.regrowth < 0) {
						crea.heal(crea.stats.regrowth, true);
					}else{
						crea.hint("♦", 'damage');
					}
				}

			}else{
				crea.hint("♣", 'damage');
			}

			setTimeout(function() {
				G.UI.energyBar.animSize( crea.energy/crea.stats.energy );
				G.UI.healthBar.animSize( crea.health/crea.stats.health );
			},1000);

			crea.endurance = crea.stats.endurance;

			crea.abilities.each(function() {
				this.reset();
			});
		};

		// Frozen effect
		if (this.stats.frozen) {
			varReset();
			var interval = setInterval(function() {
				if(!G.turnThrottle) {
					clearInterval(interval);
					G.skipTurn( { tooltip: "Frozen" } );
				}
			}, 50);
			return;
		}

		if(!this.hasWait) {
			varReset();

			// Trigger
			G.triggersFn.onStartPhase(crea);
		}

		this.materializationSickness = false;

		var interval = setInterval(function() {
			if(!G.freezedInput) {
				clearInterval(interval);
				if(G.turn >= G.minimumTurnBeforeFleeing) { G.UI.btnFlee.changeState("normal"); }
				G.startTimer();
				crea.queryMove();
			}
		}, 50);

	},


	/*	deactivate(wait)
	*
	*	wait :	Boolean :	Deactivate while waiting or not
	*
	*	Preview the creature position at the given coordinates
	*
	*/
	deactivate: function(wait) {
		this.hasWait = this.delayed = !!wait;
		this.stats.frozen = false;
		G.grid.updateDisplay(); // Retrace players creatures

		// Effects triggers
		if(!wait) {
			this.turnsActive += 1;
			G.triggersFn.onEndPhase(this);
		}

		this.delayable = false;
	},


	/*	wait()
	*
	*	Move the creature to the end of the queue
	*
	*/
	wait: function() {
		if(this.delayed) return;

		var abilityAvailable = false;

		// If at least one ability has not been used
		this.abilities.each(function() { abilityAvailable = abilityAvailable || !this.used; } );

		if( this.remainingMove>0 && abilityAvailable ) {
			this.delay(G.activeCreature === this);
			this.deactivate(true);
		}
	},

	delay: function(excludeActiveCreature) {
		G.queue.delay(this);
		this.delayable = false;
		this.delayed = true;
		this.hint("Delayed", "msg_effects");
		G.updateQueueDisplay(excludeActiveCreature);
	},

	/*	queryMove()
	*
	*	launch move action query
	*
	*/
	queryMove: function(o) {

		if (this.dead) {
			// Creatures can die during their turns from trap effects; make sure this
			// function doesn't do anything
			return;
		}

		// Once Per Damage Abilities recover
		G.creatures.each(function() { //For all Creature
			if(this instanceof Creature) {
				this.abilities.each(function() {
					if( G.triggers.oncePerDamageChain.test(this.getTrigger()) ) {
						this.setUsed(false);
					}
				});
			}
		});

		var remainingMove = this.remainingMove;
		// No movement range if unmoveable
		if (!this.stats.moveable) {
			remainingMove = 0;
		}

		o = $j.extend( {
			noPath : false,
			isAbility : false,
			ownCreatureHexShade : true,
			range: G.grid.getMovementRange(
				this.x, this.y, remainingMove, this.size, this.id),
			callback : function(hex, args) {
				if( hex.x == args.creature.x && hex.y == args.creature.y ) {
					// Prevent null movement
					G.activeCreature.queryMove();
					return;
				}
				G.gamelog.add( { action:"move",target: { x: hex.x, y: hex.y } } );
				args.creature.delayable = false;
				G.UI.btnDelay.changeState("disabled");
				args.creature.moveTo(hex, {
					animation : args.creature.movementType() === "flying" ? "fly" : "walk",
					callback : function() { G.activeCreature.queryMove(); }
				});
			}
		},o);

		if( !o.isAbility ){
			if(G.UI.selectedAbility != -1){
				this.hint("Canceled", 'gamehintblack');
			}
			$j("#abilities .ability").removeClass("active");
			G.UI.selectAbility(-1);
			G.UI.checkAbilities();
			G.UI.updateQueueDisplay();
		}

		G.grid.updateDisplay(); //Retrace players creatures
		G.grid.orderCreatureZ();
		this.facePlayerDefault();
		this.updateHealth();

		if (this.movementType() === "flying") {
			o.range = G.grid.getFlyingRange(
				this.x, this.y, remainingMove, this.size, this.id);
		}

		var selectNormal = function(hex, args) { args.creature.tracePath(hex); };
		var selectFlying = function(hex, args) {
			args.creature.tracePosition({
				x: hex.x,
				y: hex.y,
				overlayClass: "creature moveto selected player" + args.creature.team
			});
		};
		var select = (o.noPath || this.movementType() === "flying") ? selectFlying : selectNormal;

		if(this.noActionPossible){
			G.grid.querySelf({
				fnOnConfirm : function() { G.UI.btnSkipTurn.click(); },
				fnOnCancel : function() {},
				confirmText : "Skip turn"
			});
		}else{
			G.grid.queryHexs({
				fnOnSelect : select,
				fnOnConfirm : o.callback,
				args : { creature: this, args: o.args }, // Optional args
				size : this.size,
				flipped : this.player.flipped,
				id : this.id,
				hexs : o.range,
				ownCreatureHexShade : o.ownCreatureHexShade
			});
		}
	},


	/*	previewPosition(hex)
	*
	*	hex :		Hex :		Position
	*
	*	Preview the creature position at the given Hex
	*
	*/
	previewPosition: function(hex) {
		var crea = this;
		G.grid.cleanOverlay("hover h_player" + crea.team);
		if(!G.grid.hexs[hex.y][hex.x].isWalkable(crea.size, crea.id)) return; // Break if not walkable
		crea.tracePosition({ x: hex.x, y: hex.y, overlayClass: "hover h_player" + crea.team });
	},


	/*	cleanHex()
	*
	*	Clean current creature hexagons
	*
	*/
	cleanHex: function() {
		var creature = this; // Escape Jquery namespace
		this.hexagons.each(function() { this.creature = undefined; });
		this.hexagons = [];
	},


	/*	updateHex()
	*
	*	Update the current hexs containing the creature and their display
	*
	*/
	updateHex: function() {
		var creature = this; // Escape Jquery namespace
		for (var i = 0; i < this.size; i++) {
			this.hexagons.push(G.grid.hexs[this.y][this.x-i]);
		}

		this.hexagons.each(function() {
			this.creature = creature;
		});
	},

	/*	faceHex(facefrom,faceto)
	*
	*	facefrom :	Hex or Creature :	Hex to face from
	*	faceto :	Hex or Creature :	Hex to face
	*
	*	Face creature at given hex
	*
	*/
	faceHex: function(faceto,facefrom,ignoreCreaHex,attackFix){

		if( !facefrom )	facefrom = (this.player.flipped) ? this.hexagons[this.size-1] : this.hexagons[0];

		if( ignoreCreaHex && this.hexagons.indexOf(faceto) != -1 &&  this.hexagons.indexOf(facefrom) != -1 ){
			this.facePlayerDefault();
			return;
		}

		if(faceto instanceof Creature) faceto = (faceto.size < 2) ? faceto.hexagons[0] : faceto.hexagons[1];

		if( faceto.x == facefrom.x && faceto.y == facefrom.y ) {
			this.facePlayerDefault();
			return;
		}

		if(attackFix && this.size>1) {
			//only works on 2hex creature targeting the adjacent row
			if( facefrom.y%2 === 0 ) {
				if( faceto.x-this.player.flipped == facefrom.x ) {
					this.facePlayerDefault();
					return;
				}
			}else{
				if( faceto.x+1-this.player.flipped == facefrom.x ) {
					this.facePlayerDefault();
					return;
				}
			}
		}

		if(facefrom.y%2 === 0) {
			var flipped = ( faceto.x <= facefrom.x );
		}else{
			var flipped = ( faceto.x < facefrom.x );
		}


		if(flipped) {
			this.sprite.scale.setTo(-1, 1);
		}else{
			this.sprite.scale.setTo(1, 1);
		}
		this.sprite.x = ((!flipped) ? this.display["offset-x"] : 90 * this.size-this.sprite.texture.width-this.display["offset-x"]) + this.sprite.texture.width/2;
	},

	/*	facePlayerDefault()
	*
	*	Face default direction
	*
	*/
	facePlayerDefault: function() {
		if(this.player.flipped){
			this.sprite.scale.setTo(-1, 1);
		}else{
			this.sprite.scale.setTo(1, 1);
		}
		this.sprite.x = ((!this.player.flipped) ? this.display["offset-x"] : 90 * this.size-this.sprite.texture.width - this.display["offset-x"]) + this.sprite.texture.width/2;
	},

	/*	moveTo(hex,opts)
	*
	*	hex :		Hex :		Destination Hex
	*	opts :		Object :	Optional args object
	*
	*	Move the creature along a calculated path to the given coordinates
	*
	*/
	moveTo: function(hex,opts){

		defaultOpt = {
			callback : function() { return true; },
			callbackStepIn : function() { return true; },
			animation : this.movementType() === "flying" ? "fly" : "walk",
			ignoreMovementPoint : false,
			ignorePath : false,
			customMovementPoint : 0,
			overrideSpeed: 0,
			turnAroundOnComplete: true
		};

		opts = $j.extend(defaultOpt, opts);

		// Teleportation ignores moveable
		if (this.stats.moveable || opts.animation === "teleport") {
			var creature = this;

			var x = hex.x;
			var y = hex.y;

			if(opts.ignorePath || opts.animation == "fly") {
				var path = [hex];
			}else{
				var path = creature.calculatePath(x, y);
			}

			if( path.length === 0 ) return; // Break if empty path

			G.grid.xray( new Hex(0, 0) ); // Clean Xray

			creature.travelDist = 0;

			G.animations.movements[opts.animation](this, path, opts);

		}else{
			G.log("This creature cannot be moved");
		}

		var interval = setInterval(function() {
			if(!G.freezedInput){
				clearInterval(interval);
				opts.callback();
			}
		},100);

	},


	/*	tracePath(hex)
	*
	*	hex :	Hex :	Destination Hex
	*
	*	Trace the path from the current possition to the given coordinates
	*
	*/
	tracePath: function(hex) {
		var creature = this;

		var x = hex.x;
		var y = hex.y;
		var path = creature.calculatePath(x, y); // Store path in grid to be able to compare it later

		G.grid.updateDisplay(); // Retrace players creatures

		if( path.length === 0 ) return; // Break if empty path

		path.each(function() {
			creature.tracePosition({ x: this.x, y: this.y, displayClass: "adj" });
		}); // Trace path


		// Highlight final position
		var last = path.last();

		creature.tracePosition({ x: last.x, y: last.y, overlayClass: "creature moveto selected player" + creature.team });

	},


	tracePosition: function(args) {
		var crea = this;

		var defaultArgs = {
			x : crea.x,
			y : crea.y,
			overlayClass : "",
			displayClass : "",
		};

		args = $j.extend(defaultArgs, args);

		for (var i = 0; i < crea.size; i++) {
			var hex = G.grid.hexs[args.y][args.x-i];
			hex.overlayVisualState(args.overlayClass);
			hex.displayVisualState(args.displayClass);
		}
	},


	/*	calculatePath(x,y)
	*
	*	x :		Integer :	Destination coordinates
	*	y :		Integer :	Destination coordinates
	*
	*	return :	Array :	Array containing the path hexs
	*
	*/
	calculatePath: function(x, y) {
		return astar.search(G.grid.hexs[this.y][this.x], G.grid.hexs[y][x], this.size, this.id); // Calculate path
	},


	/*	calcOffset(x,y)
	*
	*	x :		Integer :	Destination coordinates
	*	y :		Integer :	Destination coordinates
	*
	*	return :	Object :	New position taking into acount the size, orientation and obstacle {x,y}
	*
	*	Return the first possible position for the creature at the given coordinates
	*
	*/
	calcOffset: function(x, y) {
		var offset = (G.players[this.team].flipped) ? this.size-1 : 0 ;
		var mult = (G.players[this.team].flipped) ? 1 : -1 ; // For FLIPPED player
		for (var i = 0; i < this.size; i++) { // Try next hexagons to see if they fit
			if( (x+offset-i*mult >= G.grid.hexs[y].length) || (x+offset-i*mult < 0) ) continue;
			if(G.grid.hexs[y][x+offset-i*mult].isWalkable(this.size, this.id)) {
				x += offset-i*mult;
				break;
			}
		}
		return {x: x, y: y};
	},


	/*	getInitiative()
	*
	*	return :	Integer :	Initiative value to order the queue
	*
	*/
	getInitiative: function() {
		// To avoid 2 identical initiative
		return this.stats.initiative*500 - this.id;
	},


	/*	adjacentHexs(dist)
	*
	*	dist :		Integer :	Distance in hexagons
	*
	*	return :	Array :		Array of adjacent hexagons
	*
	*/
	adjacentHexs: function(dist, clockwise) {

		// TODO Review this algo to allow distance
		if(!!clockwise) {
			var Hexs = [];
			var o = (this.y%2 === 0)?1:0;

			if(this.size == 1) {
				var c = [{y:this.y, x:this.x+1},
				{y:this.y-1, x:this.x+o},
				{y:this.y-1, x:this.x-1+o},
				{y:this.y, x:this.x-1},
				{y:this.y+1, x:this.x-1+o},
				{y:this.y+1, x:this.x+o}];
			}
			if(this.size == 2) {
				var c = [{y:this.y, x:this.x+1},
				{y:this.y-1, x:this.x+o},
				{y:this.y-1, x:this.x-1+o},
				{y:this.y-1, x:this.x-2+o},
				{y:this.y, x:this.x-2},
				{y:this.y+1, x:this.x-2+o},
				{y:this.y+1, x:this.x-1+o},
				{y:this.y+1, x:this.x+o}];
			}
			if(this.size == 3) {
				var c = [{y:this.y,x:this.x+1},
				{y:this.y-1, x:this.x+o},
				{y:this.y-1, x:this.x-1+o},
				{y:this.y-1, x:this.x-2+o},
				{y:this.y-1, x:this.x-3+o},
				{y:this.y, x:this.x-3},
				{y:this.y+1, x:this.x-3+o},
				{y:this.y+1, x:this.x-2+o},
				{y:this.y+1, x:this.x-1+o},
				{y:this.y+1, x:this.x+o}];
			}
			for (var i = 0; i < c.length; i++) {
				x = c[i].x;	y = c[i].y;
				if(G.grid.hexExists(y, x)) Hexs.push(G.grid.hexs[y][x]);
			}
			return Hexs;
		}

		if(this.size > 1) {
			var creature = this;
			var Hexs = this.hexagons[0].adjacentHex(dist);
			var lastHexs = this.hexagons[this.size-1].adjacentHex(dist);
			Hexs.each(function() {
				if(creature.hexagons.findPos(this)) { Hexs.removePos(this); } // Remove from array if own creature hex
			});
			lastHexs.each(function() {
				if(!Hexs.findPos(this) && !creature.hexagons.findPos(this)) { // If node doesnt already exist in final collection and if it's not own creature hex
					Hexs.push(this);
				}
			});
			return Hexs;
		}else{
			return this.hexagons[0].adjacentHex(dist);
		}
	},

	/**
	 * Restore energy up to the max limit
	 * @param {Number} amount: amount of energy to restore
	 */
	recharge: function(amount) {
		this.energy = Math.min(this.stats.energy, this.energy + amount);
	},

	/*	heal(amount)
	*
	*	amount :	Damage :	Amount of health point to restore
	*/
	heal: function(amount, isRegrowth) {
		// Cap health point
		amount = Math.min(amount, this.stats.health - this.health);

		if(this.health + amount < 1)
			amount = this.health-1; // Cap to 1hp

		// if(amount == 0) return;

		this.health += amount;

		// Health display Update
		this.updateHealth(isRegrowth);

		if(amount > 0) {
			if(isRegrowth) this.hint(amount + " ♥", 'healing d' + amount);
			else this.hint(amount,'healing d'+amount);
			G.log("%CreatureName" + this.id + "% recovers +" + amount + " health");
		}else if(amount === 0) {
			if(isRegrowth) this.hint("♦", 'msg_effects');
			else this.hint("!", 'msg_effects');
		}else{
			if(isRegrowth) this.hint(amount + " ♠", 'damage d' + amount);
			else this.hint(amount, 'damage d '+ amount);
			G.log("%CreatureName" + this.id + "% loses " + amount + " health");
		}

		G.triggersFn.onHeal(this, amount);
	},


	/*	takeDamage(damage)
	*
	*	damage :	Damage : 	Damage object
	*
	*	return :	Object :	Contains damages dealed and if creature is killed or not
	*/
	takeDamage: function(damage, o) {
		var defaultOpt = {
			ignoreRetaliation: false,
			isFromTrap: false
		};
		o = $j.extend(defaultOpt, o);
		var creature = this;

		// Determine if melee attack
		damage.melee = false;
		this.adjacentHexs(1).each(function() {
			if( damage.attacker == this.creature ) damage.melee = true;
		});
		damage.target = this;
		damage.isFromTrap = o.isFromTrap;

		// Trigger
		G.triggersFn.onUnderAttack(this, damage);
		G.triggersFn.onAttack(damage.attacker, damage);

		// Calculation
		if( damage.status === "" ) {

			// Damages
			var dmg = damage.applyDamage();
			var dmgAmount = dmg.total;

			if( !isFinite(dmgAmount) ) { // Check for Damage Errors
				this.hint("Error", 'damage');
				G.log("Oops something went wrong !");
				return { damages: 0, kill: false };
			}

			this.health -= dmgAmount;
			this.health = (this.health < 0) ? 0 : this.health; // Cap

			this.addFatigue(dmgAmount);

			// Display
			var nbrDisplayed = (dmgAmount) ? "-" + dmgAmount : 0;
			this.hint(nbrDisplayed, 'damage d' + dmgAmount);

			if(!damage.noLog) G.log("%CreatureName" + this.id + "% is hit : " + nbrDisplayed + " health");

			// If Health is empty
			if(this.health <= 0) {
				this.die(damage.attacker);
				return {damages: dmg, damageObj: damage, kill: true}; // Killed
			}

			// Effects
			damage.effects.each(function() {
				creature.addEffect(this);
			});

			// Unfreeze if taking non-zero damage
			if (dmgAmount > 0) {
				this.stats.frozen = false;
			}

			// Health display Update
			// Note: update health after adding effects as some effects may affect
			// health display
			this.updateHealth();
			G.UI.updateFatigue();

			// Trigger
			if (!o.ignoreRetaliation) {
				G.triggersFn.onDamage(this, damage);
			}

			return { damages: dmg, damageObj: damage, kill: false }; // Not Killed
		}else{
			if(damage.status == "Dodged") { // If dodged
				if(!damage.noLog) G.log("%CreatureName" + this.id + "% dodged the attack");
			}

			if(damage.status == "Shielded") { // If Shielded
				if(!damage.noLog) G.log("%CreatureName" + this.id + "% shielded the attack");
			}

			if(damage.status == "Disintegrated") { // If Disintegrated
				if(!damage.noLog) G.log("%CreatureName" + this.id + "% has been disintegrated");
				this.die(damage.attacker);
			}

			// Hint
			this.hint(damage.status, 'damage ' + damage.status.toLowerCase());
		}

		return { damageObj: damage, kill: false }; // Not killed
	},


	updateHealth: function(noAnimBar) {
		if(this == G.activeCreature && !noAnimBar) {
			G.UI.healthBar.animSize( this.health / this.stats.health );
		}

		// Dark Priest plasma shield when inactive
		if (this.type == "--" && this.player.plasma > 0 &&
				this !== G.activeCreature) {
			this.healthIndicatorSprite.loadTexture("p" + this.team + "_plasma");
			this.healthIndicatorText.setText(this.player.plasma);
		} else {
			if (this.stats.frozen) {
				this.healthIndicatorSprite.loadTexture("p" + this.team + "_frozen");
			} else {
				this.healthIndicatorSprite.loadTexture("p" + this.team + "_health");
			}
			this.healthIndicatorText.setText(this.health);
		}
	},

	addFatigue: function(dmgAmount) {
		if (!this.stats.fatigueImmunity) {
			this.endurance -= dmgAmount;
			this.endurance = this.endurance < 0 ? 0 : this.endurance; // Cap
		}

		G.UI.updateFatigue();
	},

	/*	addEffect(effect)
	*
	*	effect :		Effect :	Effect object
	*
	*/
	addEffect: function(effect, specialString, specialHint) {
		if( !effect.stackable && this.findEffect(effect.name).length !== 0 ) {
			//G.log(this.player.name+"'s "+this.name+" is already affected by "+effect.name);
			return false;
		}

		effect.target = this;
		this.effects.push(effect);

		G.triggersFn.onEffectAttach(this, effect);

		this.updateAlteration();

		if(effect.name !== "") {
			if(specialHint || effect.specialHint) {
				this.hint(specialHint, 'msg_effects');
			}else{
				this.hint(effect.name, 'msg_effects');
			}
			if(specialString) {
				G.log(specialString);
			}else{
				G.log("%CreatureName" + this.id + "% is affected by " + effect.name);
			}
		}
	},

	/**
	 * Add effect, but if the effect is already attached, replace it with the new
	 * effect.
	 * Note that for stackable effects, this is the same as addEffect()
	 *
	 * @param {Effect} effect - the effect to add
	 */
	replaceEffect: function(effect) {
		if (!effect.stackable && this.findEffect(effect.name).length !== 0) {
			this.removeEffect(effect.name);
		}
		this.addEffect(effect);
	},

	/**
	 * Remove an effect by name
	 *
	 * @param {string} name - name of effect
	 */
	removeEffect: function(name) {
		for (var i = 0; i < this.effects.length; i++) {
			if (this.effects[i].name === name) {
				this.effects.splice(i, 1);
				break;
			}
		}
	},

	hint: function(text,cssClass) {
		var crea = this;

		var tooltipSpeed = 250;
		var tooltipDisplaySpeed = 500;
		var tooltipTransition = Phaser.Easing.Linear.None;

		var hintColor = {
			confirm : { fill: "#ffffff", stroke: "#000000" },
			gamehintblack : { fill: "#ffffff", stroke: "#000000" },
			healing : { fill: "#00ff00" },
			msg_effects : { fill: "#ffff00" }
		};

		var style = $j.extend( {
			font: "bold 20pt Play",
			fill: "#ff0000",
			align: "center",
			stroke: "#000000",
			strokeThickness: 2
		}, hintColor[cssClass] );

		// Remove constant element
		this.hintGrp.forEach(function(grpHintElem) {
			if(grpHintElem.cssClass == 'confirm') {
				grpHintElem.cssClass = "confirm_deleted";
				grpHintElem.tweenAlpha = G.Phaser.add.tween(grpHintElem).to(  {alpha: 0 }, tooltipSpeed, tooltipTransition ).start();
				grpHintElem.tweenAlpha.onComplete.add(function() { this.destroy(); }, grpHintElem);
			}
		},this,true);

		var hint = G.Phaser.add.text(0,50, text, style);
		hint.anchor.setTo(0.5, 0.5);

		hint.alpha = 0;
		hint.cssClass = cssClass;

		if(cssClass == 'confirm') {
			hint.tweenAlpha = G.Phaser.add.tween(hint)
			.to( {alpha:1}, tooltipSpeed, tooltipTransition )
			.start();
		}else{
			hint.tweenAlpha = G.Phaser.add.tween(hint)
			.to( {alpha:1}, tooltipSpeed, tooltipTransition )
			.to( {alpha:1}, tooltipDisplaySpeed, tooltipTransition )
			.to( {alpha:0}, tooltipSpeed, tooltipTransition ).start();
			hint.tweenAlpha.onComplete.add(function() { this.destroy(); },hint);
		}


		this.hintGrp.add(hint);

		// Stacking
		this.hintGrp.forEach(function(grpHintElem) {
			var index = this.hintGrp.total - this.hintGrp.getIndex(grpHintElem) - 1;
			var offset = -50 * index;
			if(grpHintElem.tweenPos) grpHintElem.tweenPos.stop();
			grpHintElem.tweenPos = G.Phaser.add.tween(grpHintElem).to( {y:offset}, tooltipSpeed, tooltipTransition ).start();
		},this,true);

	},

	/*	updateAlteration()
	*
	*	Update the stats taking into account the effects' alteration
	*
	*/
	updateAlteration: function() {
		var crea = this;
		crea.stats = $j.extend({}, this.baseStats); // Copy

		var buffDebuffArray = this.effects;

		// Multiplication Buff
		buffDebuffArray.each(function() {
			$j.each(this.alterations,function(key, value) {
				if( ( typeof value ) == "string" ) {
					if( value.match(/\*/) ) {
						crea.stats[key] = eval(crea.stats[key]+value);
					}
				}
			});
		});

		// Usual Buff/Debuff
		buffDebuffArray.each(function() {
			$j.each(this.alterations,function(key, value) {
				if( ( typeof value ) == "number" ) {
					crea.stats[key] += value;
				}
			});
		});

		// Division Debuff
		buffDebuffArray.each(function() {
			$j.each(this.alterations,function(key, value) {
				if( ( typeof value ) == "string" ) {
					if( value.match(/\//) ) {
						crea.stats[key] = eval(crea.stats[key]+value);
					}
				}
			});
		});

		// Boolean Buff/Debuff
		buffDebuffArray.each(function() {
			$j.each(this.alterations, function(key, value) {
				if( ( typeof value ) == "boolean" ) {
					crea.stats[key] = value;
				}
			});
		});

		this.stats.endurance = Math.max(this.stats.endurance,0);

		this.endurance = Math.min( this.endurance, this.stats.endurance );
		this.energy = Math.min( this.energy, this.stats.energy );
		this.remainingMove = Math.min( this.remainingMove, this.stats.movement );
	},

	/*	die()
	*
	*	kill animation. remove creature from queue and from hexs
	*
	*	killer :	Creature :	Killer of this creature
	*
	*/
	die: function(killer) {

		var crea = this;

		G.log("%CreatureName" + this.id + "% is dead");

		this.dead = true;

		// Triggers
		G.triggersFn.onCreatureDeath(this);

		this.killer = killer.player;
		var isDeny = (this.killer.flipped == this.player.flipped);


		// Drop item
		if( G.unitDrops == 1 && this.drop ) {
			var offsetX = (this.player.flipped) ? this.x - this.size + 1 : this.x ;
			new Drop( this.drop.name, this.drop.health, this.drop.energy, offsetX, this.y );
		}


		if(!G.firstKill && !isDeny) { // First Kill
			this.killer.score.push( { type: "firstKill" } );
			G.firstKill = true;
		}

		if(this.type == "--") { // If Dark Priest
			if(isDeny){
				// TEAM KILL (DENY)
				this.killer.score.push( { type: "deny", creature: this } );
			}else{
				// Humiliation
				this.killer.score.push( { type: "humiliation", player: this.team } );
			}
		}

		if(!this.undead) { // Only if not undead
			if(isDeny) {
				// TEAM KILL (DENY)
				this.killer.score.push( { type: "deny", creature: this } );
			}else{
				// KILL
				this.killer.score.push( { type: "kill", creature: this } );
			}
		}

		if( this.player.isAnnihilated() ) {
			// Remove humiliation as annihilation is an upgrade
			for(var i = 0; i < this.killer.score.length; i++) {
				var s = this.killer.score[i];
				if(s.type == "humiliation") {
					if(s.player == this.team) this.killer.score.splice(i, 1);
					break;
				}
			}
			// ANNIHILATION
			this.killer.score.push( { type: "annihilation", player: this.team } );
		}

		if(this.type == "--") this.player.deactivate(); // Here because of score calculation

		// Kill animation
		var tweenSprite = G.Phaser.add.tween(this.sprite).to( {alpha:0}, 500, Phaser.Easing.Linear.None ).start();
		var tweenHealth = G.Phaser.add.tween(this.healthIndicatorGroup).to( { alpha: 0 }, 500, Phaser.Easing.Linear.None ).start();
		tweenSprite.onComplete.add( function() { crea.sprite.destroy(); } );
		tweenHealth.onComplete.add( function() { crea.healthIndicatorGroup.destroy(); } );

		this.cleanHex();

		G.queue.remove(this);
		G.updateQueueDisplay();
		G.grid.updateDisplay();

		if(G.activeCreature === this) { G.nextCreature(); return; } //End turn if current active creature die

		// As hex occupation changes, path must be recalculated for the current creature not the dying one
		G.activeCreature.queryMove();

		// Queue cleaning
		G.UI.updateActivebox();
		G.UI.updateQueueDisplay(); // Just in case
	},

	isFatigued: function() {
		return this.endurance === 0 && !this.isFragile();
	},

	isFragile: function() {
		return this.stats.endurance === 0;
	},

	/*	getHexMap()
	*
	*	shortcut convenience function to grid.getHexMap
	*/
	getHexMap : function(map, invertFlipped) {
		var x = ( this.player.flipped ? !invertFlipped : invertFlipped ) ? this.x+1-this.size : this.x;
		return G.grid.getHexMap( x , this.y - map.origin[1] , 0-map.origin[0] , ( this.player.flipped ? !invertFlipped : invertFlipped ) , map );
	},

	getBuffDebuff : function(stat) {
		var crea = this;

		var buffDebuffArray = this.effects.concat(this.dropCollection);
		var buff = 0;
		var debuff = 0;
		var buffObjs = { effects: [], drops: [] };

		var addToBuffObjs = function(obj) {
			if(obj instanceof Effect) {
				buffObjs.effects.push(obj);
			}else if(obj instanceof Drop) {
				buffObjs.drops.push(obj);
			}
		};

		// Multiplication Buff
		buffDebuffArray.each(function() {
			var o = this;
			$j.each(this.alterations,function(key,value) {
				if( ( typeof value ) == "string" ) {
					if( value.match(/\*/) ) {
						if( key === stat || stat === undefined) {
							addToBuffObjs(o);
							var base = crea.stats[key];
							var result = eval(crea.stats[key]+value);
							if(result > base) {
								buff += result-base;
							}else{
								debuff += result-base;
							}
						}
					}
				}
			});
		});

		// Usual Buff/Debuff
		buffDebuffArray.each(function() {
			var o = this;
			$j.each(this.alterations,function(key, value) {
				if( ( typeof value ) == "number" ) {
					if( key === stat || stat === undefined) {
						addToBuffObjs(o);
						if(value > 0) {
							buff += value;
						} else {
							debuff += value;
						}
					}
				}
			});
		});

		// Division Debuff
		buffDebuffArray.each(function() {
			var o = this;
			$j.each(this.alterations,function(key, value) {
				if( ( typeof value ) == "string" ) {
					if( key === stat || stat === undefined) {
						if( value.match(/\//) ) {
							addToBuffObjs(o);
							var base = crea.stats[key];
							var result = eval(crea.stats[key]+value);
							if(result > base) {
								buff += result-base;
							}else{
								debuff += result-base;
							}
						}
					}
				}
			});
		});

		return {buff: buff, debuff: debuff, objs: buffObjs};
	},

	findEffect : function(name) {
		var ret = [];
		this.effects.each(function() {
			if( this.name == name ) {
				ret.push(this);
			}
		});
		return ret;
	},

	// Make units transparent
	xray : function(enable) {
		if(enable) {
			G.Phaser.add.tween(this.grp)
				.to( { alpha: 0.5 }, 250, Phaser.Easing.Linear.None)
				.start();
		} else {
			G.Phaser.add.tween(this.grp)
				.to( { alpha:1 }, 250, Phaser.Easing.Linear.None)
				.start();
		}
	},

	pickupDrop : function() {
		var crea = this;
		this.hexagons.each(function() { this.pickupDrop(crea); } );
	},

	/**
	 * Get movement type for this creature
	 * @return {string} "normal", "hover", or "flying"
	 */
	movementType: function() {
		// If the creature has an ability that modifies movement type, use that,
		// otherwise use the creature's base movement type
		for (var i = 0; i < this.abilities.length; i++) {
			if ('movementType' in this.abilities[i]) {
				return this.abilities[i].movementType();
			}
		}
		return this._movementType;
	}

});
