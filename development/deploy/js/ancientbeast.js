/*	Ability Class
*
*	Class parsing function from creature abilities
*
*/
var Ability = Class.create({
	initialize: function(creature,abilityID) {
		this.creature = creature;
		this.used = false;
		this.id = abilityID;
		this.priority = 0; // Priority for same trigger
		var datas = G.retreiveCreatureStats(creature.type);
		$j.extend(true,this,G.abilities[datas.id][abilityID],datas.ability_info[abilityID]);
		if( this.requirements === undefined && this.costs !== undefined ) {
			this.requirements = this.costs;
		}
	},


	/* use()
	*
	*	Test and use the ability
	*
	*/
	use: function() {
		if( this.trigger != "onQuery" ) return;
		if( !this.require() ) return;
		if( this.used === true ) { G.log("Ability already used!"); return; }
		G.grid.clearHexViewAlterations();
		G.clearOncePerDamageChain();
		G.UI.selectAbility(this.id);
		G.activeCreature.hint(this.title,"msg_effects");
		return this.query();
	},

	/*	end()
	*
	*	End the ability. Must be called at the end of each ability function;
	*
	*/
	end: function(desableLogMsg,deferedEnding) {
		if(!desableLogMsg) G.log("%CreatureName"+this.creature.id+"% uses "+this.title);
		this.applyCost();
		this.setUsed(true); // Should always be here
		G.UI.updateInfos(); // Just in case
		G.UI.btnDelay.changeState("disabled");
		G.activeCreature.delayable = false;
		if(this.trigger == "onQuery" && !deferedEnding) {
			G.UI.selectAbility(-1);
			G.activeCreature.queryMove();
		}
	},


	/*	setUsed(val)
	*
	*	val :	Boolean :	set the used attriute to the desired value
	*
	*/
	setUsed: function(val) {
		if(val){
			this.used = true;
			if(this.creature.id == G.activeCreature.id) // Avoid dimmed passive for current creature
				G.UI.abilitiesButtons[this.id].changeState("disabled");
		}else{
			this.used = false;
			if(this.creature.id == G.activeCreature.id) {
				if(this.id === 0) { // Passive
					G.UI.abilitiesButtons[this.id].changeState("noclick");
				}else{
					G.UI.abilitiesButtons[this.id].changeState("normal");
				}
			}
		}
	},

	/*	animation()
	*
	*	Animate the creature
	*
	*/
	animation: function() {

		// Gamelog Event Registration
		if( G.triggers.onQuery.test(this.trigger) ) {
			if(arguments[0] instanceof Hex){
				var args = $j.extend({},arguments);
				delete args[0];
				G.gamelog.add({action:"ability",target:{type:"hex",x:arguments[0].x,y:arguments[0].y},id:this.id,args:args});
			}
			if(arguments[0] instanceof Creature) {
				var args = $j.extend({},arguments);
				delete args[0];
				G.gamelog.add({action:"ability",target:{type:"creature",crea:arguments[0].id},id:this.id,args:args});
			}
			if(arguments[0] instanceof Array) {
				var args = $j.extend({},arguments);
				delete args[0];
				var array = [];
				arguments[0].each(function() { array.push({x:this.x,y:this.y}); });
				G.gamelog.add({action:"ability",target:{type:"array",array:array},id:this.id,args:args});
			}
		} else {
			// Test for materialization sickness
			if(this.creature.materializationSickness && this.affectedByMatSickness) return false;
		}

		return this.animation2({arg:arguments});
	},

	animation2: function(o) {

		var opt = $j.extend({
			callback: function() {},
			arg: {},
		},o);

		var ab = this;
		var args = opt.arg;

		G.freezedInput = true;

		// Animate
		var p0 = this.creature.sprite.x;
		var p1 = p0;
		var p2 = p0;

		p1 += (this.creature.player.flipped)? 5 : -5;
		p2 += (this.creature.player.flipped)? -5 : 5;

		if( !this.noAnimation ){
			var anim_id = Math.random();

			G.animationQueue.push(anim_id);

			if(this.animation_datas === undefined) {
				this.animation_datas = {
					visual : function() {},
					duration : 500,
					delay : 350,
				};
			}

			var tween = G.Phaser.add.tween(this.creature.sprite)
			.to({x:p1}, 250, Phaser.Easing.Linear.None)
			.to({x:p2}, 100, Phaser.Easing.Linear.None)
			.to({x:p0}, 150, Phaser.Easing.Linear.None)
			.start();

			ab.animation_datas.visual.apply(ab,args);

			setTimeout(function() {
				if( !G.triggers.onAttack.test(ab.trigger) ) {
					G.soundsys.playSound(G.soundLoaded[2],G.soundsys.effectsGainNode);
					ab.activate.apply(ab,args);
				}
			},this.animation_datas.delay);

			setTimeout(function() {
				G.animationQueue.filter(function() { return (this!=anim_id); });
				if( G.animationQueue.length === 0 ) {
					G.freezedInput = false;
				}
			},this.animation_datas.duration);

		}else{
			ab.activate.apply(ab,args);
			G.freezedInput = false;
		}

		var interval = setInterval(function() {
			if(!G.freezedInput){
				clearInterval(interval);
				opt.callback();
			}
		},100);

		if( G.triggers.onAttack.test(ab.trigger) ) return ab.activate.apply(ab,args);
	},


	/*	getTargets(hexs)
	*
	*	hexs : Array : Contains the targeted hexagons
	*
	*	return : Array : Contains the target units
	*
	*/
	getTargets: function(hexs) {
		var targets = [];
		hexs.each(function() { // For each hex
			if( this.creature instanceof Creature ) {
				if( targets[this.creature.id] === undefined ) {
					targets[this.creature.id] = {
						hexsHit : 0,
						target : this.creature
					};
				}
				targets[this.creature.id].hexsHit += 1; // Unit has been found
			}
		});
		return targets;
	},

	getFormatedCosts : function() {
		if( !this.costs ) return false;
		return this.getFormatedDamages(this.costs);
	},

	getFormatedDamages : function(obj) {
		if( !this.damages && !obj ) return false;
		var obj = obj || this.damages;
		var string = "";

		$j.each(obj,function(key,value) {

			if(key == "special") {
				string += value.replace(/%(health|regrowth|endurance|energy|meditation|initiative|offense|defense|movement|pierce|slash|crush|shock|burn|frost|poison|sonic|mental)%/g,'<span class="$1"></span>');
				return;
			}

			if(string !== "") string += ", ";
			string += (value+'<span class="'+key+'"></span>');
		});
		return string;
	},

	getFormatedEffects : function() {
		if( !this.effects ) return false;
		var string = "";
		for (var i = this.effects.length - 1; i >= 0; i--) {

			if(this.effects[i].special) {
				string += this.effects[i].special.replace(/%(health|regrowth|endurance|energy|meditation|initiative|offense|defense|movement|pierce|slash|crush|shock|burn|frost|poison|sonic|mental)%/g,'<span class="$1"></span>');
				continue;
			}

			$j.each(this.effects[i],function(key,value) {
			if(string !== "") string += ", ";
			string += (value+'<span class="'+key+'"></span>');
		});
		}

		return string;
	},

	/*	areaDamages(targets)
	*
	*	targets : Array : Example : target = [{target:crea1,hexsHit:2},{target:crea2,hexsHit:1}]
	*/
	areaDamage : function(attacker,type,damages,effects,targets,notrigger) {
		var multiKill = 0;
		for (var i = 0; i < targets.length; i++) {
			if(targets[i]===undefined) continue;
			dmg = new Damage(attacker,type,damages,targets[i].hexsHit,effects);
			multiKill += (targets[i].target.takeDamage(dmg, notrigger).kill+0);
		}
		if(multiKill>1)	attacker.player.score.push({type:"combo",kills:multiKill});
	},

	/*	atLeastOneTarget(hexs,team)
	*
	*	hexs : Array : set of hex to test
	*	team : String : ennemy, ally, both
	*/
	atLeastOneTarget : function(hexs,team) {
		for (var i = 0; i < hexs.length; i++) {
			if(hexs[i].creature instanceof Creature) {
				var crea = hexs[i].creature;
				switch(team) {
					case "ally":
						if( this.creature.isAlly(crea.team) ) return true;
						break;
					case "ennemy":
						if( !this.creature.isAlly(crea.team) ) return true;
						break;
					case "both":
						return true;
				}
			}
		}
		this.message = G.msg.abilities.notarget;
		return false;
	},


	/*	testRequirements()
	*
	*	test the requirement for this abilities. negatives values mean maximum value of the stat
	*	For instance : energy = -5 means energy must be lower than 5.
	*	If one requirement fails it returns false.
	*/
	testRequirements : function() {
		var def = {
			plasma : 0,
			energy:0,
			endurance:0,
			remainingMovement:0,
			stats : {
				health:0,
				regrowth:0,
				endurance:0,
				energy:0,
				meditation:0,
				initiative:0,
				offense:0,
				defense:0,
				movement:0,
				pierce:0,
				slash:0,
				crush:0,
				shock:0,
				burn:0,
				frost:0,
				poison:0,
				sonic:0,
				mental:0,
			},
		};

		var r = this.requirements || this.costs;

		var req = $j.extend(def,this.requirements);

		// Plasma
		if(req.plasma > 0 ) {
			if( this.creature.player.plasma < req.plasma ) {
				this.message = G.msg.abilities.notenough.replace("%stat%","plasma");
				return false;
			}
		}else if(req.plasma < 0 ) {
			if( this.creature.player.plasma > -req.plasma ) {
				this.message = G.msg.abilities.toomuch.replace("%stat%","plasma");
				return false;
			}
		}

		// Energy
		if(req.energy  > 0 ) {
			if( this.creature.energy < req.energy ) {
				this.message = G.msg.abilities.notenough.replace("%stat%","energy");
				return false;
			}
		}else if(req.energy  < 0 ) {
			if( this.creature.energy > -req.energy ) {
				this.message = G.msg.abilities.toomuch.replace("%stat%","energy");
				return false;
			}
		}

		// Endurance
		if(req.endurance  > 0 ) {
			if( this.creature.endurance < req.endurance ) {
				this.message = G.msg.abilities.notenough.replace("%stat%","endurance");
				return false;
			}
		}else if(req.endurance  < 0 ) {
			if( this.creature.endurance > -req.endurance ) {
				this.message = G.msg.abilities.toomuch.replace("%stat%","endurance");
				return false;
			}
		}

		// Health
		if(req.health  > 0 ) {
			if( this.creature.health <= req.health ) {
				this.message = G.msg.abilities.notenough.replace("%stat%","health");
				return false;
			}
		}else if(req.health  < 0 ) {
			if( this.creature.health > -req.health ) {
				this.message = G.msg.abilities.toomuch.replace("%stat%","health");
				return false;
			}
		}

		$j.each(req.stats,function(key,value) {
			if(value > 0 ) {
				if( this.creature.stats[key] < value ) return false;
			}else if(value < 0 ) {
				if( this.creature.stats[key] > value ) return false;
			}
		});

		return true;
	},

	applyCost : function() {
		var crea = this.creature;
		if( this.costs === undefined ) return;
		$j.each(this.costs,function(key,value) {
			if( typeof(value) == "number" ) {
				if(key == 'health') {
					crea.hint(value,'damage d'+value);
					G.log("%CreatureName"+crea.id+"% loses "+value+" health");
				}
				crea[key] = Math.max( crea[key]-value, 0 ); // Cap
			}
		});
		crea.updateHealth();
		if( crea.id == G.activeCreature.id ) G.UI.energyBar.animSize( crea.energy/crea.stats.energy );
	},

	testDirection : function(o) {
		var defaultOpt = {
			team : "ennemy",
			id : this.creature.id,
			flipped : this.creature.player.flipped,
			x : this.creature.x,
			y : this.creature.y,
			directions : [1,1,1,1,1,1],
			includeCrea : true,
			stopOnCreature : true,
			distance : 0,
			sourceCreature : undefined,
		};

		o = $j.extend(defaultOpt,o);

		var choices = [];

		for (var i = 0; i < o.directions.length; i++) {
			if(!!o.directions[i]) {
				var dir = [];
				var fx = 0;

				if( o.sourceCreature instanceof Creature ) {
					if( (!o.sourceCreature.player.flipped && i>2) || (o.sourceCreature.player.flipped && i<3) ) {
						fx =  -1*(o.sourceCreature.size-1);
					}
				}

				switch(i) {
					case 0: // Upright
						dir = G.grid.getHexMap(o.x+fx,o.y-8,0,o.flipped,diagonalup).reverse();
						break;
					case 1: // StraitForward
						dir = G.grid.getHexMap(o.x+fx,o.y,0,o.flipped,straitrow);
						break;
					case 2: // Downright
						dir = G.grid.getHexMap(o.x+fx,o.y,0,o.flipped,diagonaldown);
						break;
					case 3: // Downleft
						dir = G.grid.getHexMap(o.x+fx,o.y,-4,o.flipped,diagonalup);
						break;
					case 4: // StraitBackward
						dir = G.grid.getHexMap(o.x+fx,o.y,0,!o.flipped,straitrow);
						break;
					case 5: // Upleft
						dir = G.grid.getHexMap(o.x+fx,o.y-8,-4,o.flipped,diagonaldown).reverse();
						break;
					default:
						break;
				}

				if( o.distance > 0 ) dir = dir.slice(0,o.distance+1);

				choices = choices.concat(dir.filterCreature(o.includeCrea,o.stopOnCreature,o.id,o.team));
			}
		}
		return this.atLeastOneTarget(choices,o.team);
	},


});

abilities = []; // Array containing all javascript methods for abilities

/*
* Damage Class
*/
var Damage = Class.create({

	/* Constructor(amount,type,effects)
	*
	*	attacker :	Creature : Unit that initiated the damage
	*	type :	String : Can be "target", "zone" or "effect"
	*	damages :	Object : Object containing the damage by type {frost : 5} for example
	*	area :	Integer : Number of hexagons being hit
	*	effects :	Array : Contains Effect object to apply to the target
	*/
	initialize: function(attacker,type,damages,area,effects) {
		this.attacker = attacker;
		this.type = type;
		this.damages = damages;
		this.status = "";
		this.effects = effects;
		this.area = area;
	},

	/* apply(target)
	*
	*	target :	Creature : Targeted creature
	*/
	apply: function(target) {
		var trg = target.stats;
		var dmg = this;
		var atk = dmg.attacker.stats;
		var returnObj = {total:0};

		// DAMAGE CALCULATION
		$j.each(this.damages,function(key,value) {
			if(key=="pure") { // Bypass defense calculation
				var points = value;
			} else {
				var points = Math.round(value * (1 + (atk.offense - trg.defense / dmg.area + atk[key] - trg[key] )/100));
				//For Debuging
				if( G.debugMode ) console.log("damage = "+value+key+"dmg * (1 + ("+atk.offense+"atkoffense - "+trg.defense+"trgdefense / "+dmg.area+"area + "+atk[key]+"atk"+key+" - "+trg[key]+"trg"+key+" )/100)");
			}
			returnObj[key] = points;
			returnObj.total += points;
		});

		returnObj.total = Math.max(returnObj.total,1); // Minimum of 1 damage

		return returnObj;
	},

	dmgIsType :function(type) {
		return G.dmgType[type].test(this.type);
	},

});


/*
* Effect Class
*/
var Effect = Class.create({

	/* Constructor(owner,parent,trigger,effectFn)
	*
	*	owner :	Creature : Creature that casted the effect
	*	target :	Object : Creature or Hex : the object that possess the effect
	*	trigger :	String : Event that trigger the effect
	*	effectFn :	Function : Function to trigger
	*/
	initialize: function(name,owner,target,trigger,optArgs) {
		this.id = effectId++;

		this.name = name;
		this.owner = owner;
		this.target = target;
		this.trigger = trigger;
		this.creationTurn = G.turn;

		var args = $j.extend({
			// Default Arguments
			requireFn : function() {return true;},
			effectFn : function() {},
			alterations : {},
			turnLifetime : 0,
			deleteTrigger : "onStartOfRound",
			stackable : true,
			noLog : false,
			specialHint : undefined // Special hint for log
		},optArgs);

		$j.extend(this,args);

		G.effects.push(this);
	},

	animation: function() {
		this.activate.apply(this,arguments);
	},

	activate: function(arg) {
		if( !this.requireFn(arg) ) return false;
		if( !this.noLog ) console.log("Effect "+this.name+" triggered");
		this.effectFn(this,arg);
	},

	deleteEffect: function() {
		var i = this.target.effects.indexOf(this);
		this.target.effects.splice(i,1);
		i = G.effects.indexOf(this);
		G.effects.splice(i,1);
		this.target.updateAlteration();
		console.log("Effect "+this.name+" deleted");
	},

});

var Animations = Class.create({

	initialize: function() {},

	movements : {

		walk : function(crea,path,opts){

			if( opts.customMovementPoint > 0 ){

				path = path.slice(0,opts.customMovementPoint);
				// For compatibility
				var savedMvtPoints = creature.remainingMove;
				creature.remainingMove = opts.customMovementPoint;
			}

			G.freezedInput = true;

			var anim_id = Math.random();
			G.animationQueue.push(anim_id);

			var hexId = 0;

			crea.healthHide();

			var anim = function() {

				var hex = path[hexId];

				if( hexId < path.length && crea.remainingMove > 0 ){
					G.animations.movements.leaveHex(crea,hex,opts);
				}else{
					G.animations.movements.movementComplete(crea,hex,anim_id,opts); return;
				}

				var nextPos = G.grid.hexs[hex.y][hex.x-crea.size+1];
				var speed = !opts.overrideSpeed ? crea.animation.walk_speed : opts.overrideSpeed;

				var tween = G.Phaser.add.tween(crea.grp)
				.to(nextPos.displayPos, parseInt(speed), Phaser.Easing.Linear.None)
				.start();

				tween.onComplete.add(function() {
					// Sound Effect
					G.soundsys.playSound(G.soundLoaded[0],G.soundsys.effectsGainNode);

					if(!opts.ignoreMovementPoint){
						crea.remainingMove--;
						if(opts.customMovementPoint === 0) crea.travelDist++;
					}

					G.animations.movements.enterHex(crea,hex,opts);


					anim(); // Next tween
				});

				hexId++;
			};

			anim();
		},


		fly : function(crea,path,opts){

			if( opts.customMovementPoint > 0 ){

				path = path.slice(0,opts.customMovementPoint);
				// For compatibility
				var savedMvtPoints = crea.remainingMove;
				crea.remainingMove = opts.customMovementPoint;
			}

			G.freezedInput = true;

			var anim_id = Math.random();
			G.animationQueue.push(anim_id);

			var hexId = 0;

			crea.healthHide();

			var hex = path[0];

			var start = G.grid.hexs[crea.y][crea.x-crea.size+1];
			var currentHex = G.grid.hexs[hex.y][hex.x-crea.size+1];

			var speed = !opts.overrideSpeed ? crea.animation.walk_speed : opts.overrideSpeed;

			var tween = G.Phaser.add.tween(crea.grp)
			.to(currentHex.displayPos, parseInt(speed), Phaser.Easing.Linear.None)
			.start();

			tween.onComplete.add(function() {
				// Sound Effect
				G.soundsys.playSound(G.soundLoaded[0],G.soundsys.effectsGainNode);

				if(!opts.ignoreMovementPoint){
					// Determine distance
					var distance = 0;
					var k = 0;
					while(!distance && start != currentHex){
						k++;
						if( start.adjacentHex(k).findPos(currentHex) ) distance = k;
					}

					crea.remainingMove -= distance;
					if(opts.customMovementPoint === 0) crea.travelDist += distance;
				}

				G.animations.movements.enterHex(crea,hex,opts);
				G.animations.movements.movementComplete(crea,hex,anim_id,opts); return;
			});
		},


		teleport : function(crea,path,opts){

			var hex = path[0];

			var currentHex = G.grid.hexs[hex.y][hex.x-crea.size+1];

			var anim_id = Math.random();
			G.animationQueue.push(anim_id);

			// FadeOut
			var tween = G.Phaser.add.tween(crea.grp)
			.to({alpha: 0}, 500, Phaser.Easing.Linear.None)
			.start();

			tween.onComplete.add(function() {
				// Sound Effect
				G.soundsys.playSound(G.soundLoaded[0],G.soundsys.effectsGainNode);

				// position
				crea.grp.x = currentHex.displayPos.x;
				crea.grp.y = currentHex.displayPos.y;

				// FadeIn
				var tween = G.Phaser.add.tween(crea.grp)
				.to({alpha: 1}, 500, Phaser.Easing.Linear.None)
				.start();

				G.animations.movements.enterHex(crea,hex,opts);
				G.animations.movements.movementComplete(crea,hex,anim_id,opts); return;
			});
		},

		push : function(crea,path,opts){
			opts.pushed = true;
			this.walk(crea,path,opts);
		},

		//--------Special Functions---------//

		enterHex : function(crea,hex,opts){
			crea.cleanHex();
			crea.x		= hex.x - 0;
			crea.y		= hex.y - 0;
			crea.pos	= hex.pos;
			crea.updateHex();

			if(!opts.ignoreMovementPoint){
				// Trigger
				G.triggersFn.onStepIn(crea,hex);
			}

			crea.pickupDrop();

			opts.callbackStepIn(hex);

			G.grid.orderCreatureZ();
		},

		leaveHex : function(crea,hex,opts){
			if(!opts.pushed) crea.faceHex(hex,crea.hexagons[0]); // Determine facing
			G.triggersFn.onStepOut(crea,crea.hexagons[0]); // Trigger

			G.grid.orderCreatureZ();
		},

		movementComplete : function(crea,hex,anim_id,opts){

			if(opts.customMovementPoint > 0){
				crea.remainingMove = savedMvtPoints;
			}

			G.grid.updateDisplay();

			//TODO turn around animation
			crea.facePlayerDefault();

			//TODO reveal healh indicator
			crea.healthShow();

			G.triggersFn.onCreatureMove(crea,hex); // Trigger

			crea.hexagons.each(function() {this.pickupDrop(crea);});

			G.grid.orderCreatureZ();

			G.animationQueue.filter(function() { return (this!=anim_id); });
			if( G.animationQueue.length === 0 ) G.freezedInput = false;
		}
	}
});

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
	initialize: function(obj){
		// Engine
		this.name		= obj.name;
		this.id			= G.creaIdCounter++;
		this.x			= obj.x - 0;
		this.y			= obj.y - 0;
		this.pos		= {x:this.x, y:this.y};
		this.size		= obj.size - 0;
		this.type		= obj.type; //Which creature it is
		this.lvl		= (obj.lvl == "-")?1:obj.lvl-0; //Which creature it is
		this.realm		= obj.realm; //Which creature it is
		this.animation	= obj.animation;
		this.display	= obj.display;
		this.drop		= obj.drop;
		this.canFly		= obj.canFly;

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

			moveable:true,
			fatigueImmunity:false
		},
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
		this.grp = G.Phaser.add.group(G.grid.creatureGroup, "creatureGrp_"+this.id);
		this.grp.alpha = 0;
		// Adding sprite
		this.sprite = this.grp.create(0,0, this.name+dp+'_cardboard');
		this.sprite.anchor.setTo(0.5,1);
		// Placing sprite
		this.sprite.x = ((!this.player.flipped) ? this.display["offset-x"] : 90*this.size-this.sprite.texture.width-this.display["offset-x"]) +this.sprite.texture.width/2;
		this.sprite.y = this.display["offset-y"] + this.sprite.texture.height;
		// Placing Group
		this.grp.x = this.hexagons[this.size-1].displayPos.x;
		this.grp.y = this.hexagons[this.size-1].displayPos.y;

		this.facePlayerDefault();

		// Hint Group
		this.hintGrp = G.Phaser.add.group(this.grp, "creatureHintGrp_"+this.id);
		this.hintGrp.x = 45 * this.size;
		this.hintGrp.y = -this.sprite.texture.height+5;

		// Health indicator
		this.healtIndicatorGrp = G.Phaser.add.group(this.grp, "creatureHealthGrp_"+this.id);
		// Adding background sprite
		this.healtIndicatorSprite = this.healtIndicatorGrp.create( (this.player.flipped) ? 19 : 19 + 90*(this.size-1), 49, "p"+this.team+'_health');
		// Add text
		this.healtIndicatorText = G.Phaser.add.text( (this.player.flipped) ? 45 : 45 + 90*(this.size-1), 59, this.health, {font: "bold 15pt Play", fill: "#ffffff", align: "center"});
		this.healtIndicatorText.anchor.setTo(0.5, 0.5);
		this.healtIndicatorGrp.add(this.healtIndicatorText);
		// Hide It
		this.healtIndicatorGrp.alpha = 0;

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

		G.nextQueue.push(this);
		G.reorderQueue();

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
		this.healtIndicatorGrp.alpha = 0;
	},

	healthShow: function() {
		var offsetX = (this.player.flipped) ? this.x - this.size + 1: this.x ;
		var hex = G.grid.hexs[this.y][offsetX];
		// this.healtIndicatorGrp.x = hex.displayPos.x;
		// this.healtIndicatorGrp.y = hex.displayPos.y;
		this.healtIndicatorGrp.alpha = 1;
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
			// Variables reset
			crea.updateAlteration();
			crea.remainingMove = crea.stats.movement;

			if(!crea.materializationSickness){
				if(crea.endurance > 0){
					crea.heal(crea.stats.regrowth, true);
				}else{
					if(crea.stats.regrowth < 0){
						crea.heal(crea.stats.regrowth, true);
					}else{
						crea.hint("♦", 'damage');
					}
				}

				if(crea.stats.meditation > 0){
					crea.energy = Math.min( crea.stats.energy, crea.energy + crea.stats.meditation ); //cap
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
				this.setUsed(false);
				this.token = 0;
			});
		};


		// Freezed effect
		if(this.freezed){
			varReset();
			var interval = setInterval(function() {
				if(!G.turnThrottle){
					clearInterval(interval);
					G.skipTurn({tooltip:"Frozen"});
				}
			}, 50);
			return;
		}

		if(!this.hasWait){
			varReset();

			// Trigger
			G.triggersFn.onStartPhase(crea);
		}

		this.materializationSickness = false;

		var interval = setInterval(function() {
			if(!G.freezedInput){
				clearInterval(interval);
				if(G.turn >= G.minimumTurnBeforeFleeing){ G.UI.btnFlee.changeState("normal"); }
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
	deactivate: function(wait){
		this.hasWait = this.delayed = !!wait;
		G.grid.updateDisplay(); // Retrace players creatures

		// Effects triggers
		if(!wait) G.triggersFn.onEndPhase(this);

		this.delayable = false;
	},


	/*	wait()
	*
	*	Add the creature to the delayQueue
	*
	*/
	wait: function() {
		if(this.delayed) return;

		var abilityAvailable = false;

		// If at least one ability has not been used
		this.abilities.each(function() {	abilityAvailable = abilityAvailable || !this.used; });

		if( this.remainingMove>0 && abilityAvailable ){
			this.delay();
			this.deactivate(true);
		}
	},

	delay : function() {
		G.delayQueue.push(this);
		G.queue.removePos(this);
		this.delayable = false;
		this.delayed = true;
		this.hint("Delayed", "msg_effects");
		G.reorderQueue(); // Update UI and Queue order
	},

	/*	queryMove()
	*
	*	launch move action query
	*
	*/
	queryMove: function(o){

		// Once Per Damage Abilities recover
		G.creatures.each(function() { //For all Creature
			if(this instanceof Creature){
				this.abilities.each(function() {
					if( G.triggers.oncePerDamageChain.test(this.trigger) ){
						this.setUsed(false);
					}
				});
			}
		});

		o = $j.extend({
			noPath : false,
			isAbility : false,
			ownCreatureHexShade : true,
			range : G.grid.getMovementRange(this.x, this.y, this.remainingMove, this.size, this.id),
			callback : function(hex, args){
				if( hex.x == args.creature.x && hex.y == args.creature.y ){
					// Prevent null movement
					G.activeCreature.queryMove();
					return;
				}
				G.gamelog.add({action:"move",target:{x:hex.x,y:hex.y}});
				args.creature.delayable = false;
				G.UI.btnDelay.changeState("disabled");
				args.creature.moveTo(hex, {
					animation : args.creature.canFly ? "fly" : "walk",
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

		if(this.canFly){
			o.range = G.grid.getFlyingRange(this.x,this.y,this.remainingMove,this.size,this.id);
		}

		var select = (o.noPath || this.canFly)
		? function(hex,args){ args.creature.tracePosition({ x: hex.x, y: hex.y, overlayClass: "creature moveto selected player"+args.creature.team }); }
		: function(hex,args){ args.creature.tracePath(hex); };

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
				args : { creature:this, args: o.args }, // Optional args
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
	previewPosition: function(hex){
		var crea = this;
		G.grid.cleanOverlay("hover h_player"+crea.team);
		if(!G.grid.hexs[hex.y][hex.x].isWalkable(crea.size, crea.id)) return; // Break if not walkable
		crea.tracePosition({ x: hex.x, y: hex.y, overlayClass: "hover h_player"+crea.team });
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

		if(faceto instanceof Creature) faceto = (faceto.size < 2)? faceto.hexagons[0]: faceto.hexagons[1];

		if( faceto.x == facefrom.x && faceto.y == facefrom.y ){
			this.facePlayerDefault();
			return;
		}

		if(attackFix && this.size>1){
			//only works on 2hex creature targeting the adjacent row
			if( facefrom.y%2 === 0 ){
				if( faceto.x-this.player.flipped == facefrom.x ){
					this.facePlayerDefault();
					return;
				}
			}else{
				if( faceto.x+1-this.player.flipped == facefrom.x ){
					this.facePlayerDefault();
					return;
				}
			}
		}

		if(facefrom.y%2 === 0){
			var flipped = ( faceto.x <= facefrom.x );
		}else{
			var flipped = ( faceto.x < facefrom.x );
		}


		if(flipped){
			this.sprite.scale.setTo(-1,1);
		}else{
			this.sprite.scale.setTo(1,1);
		}
		this.sprite.x = ((!flipped) ? this.display["offset-x"] : 90*this.size-this.sprite.texture.width-this.display["offset-x"]) +this.sprite.texture.width/2;
	},

	/*	facePlayerDefault()
	*
	*	Face default direction
	*
	*/
	facePlayerDefault: function() {
		if(this.player.flipped){
			this.sprite.scale.setTo(-1,1);
		}else{
			this.sprite.scale.setTo(1,1);
		}
		this.sprite.x = ((!this.player.flipped) ? this.display["offset-x"] : 90*this.size-this.sprite.texture.width-this.display["offset-x"]) +this.sprite.texture.width/2;
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
			callback : function() {return true;},
			callbackStepIn : function() {return true;},
			animation : this.canFly ? "fly" : "walk",
			ignoreMovementPoint : false,
			ignorePath : false,
			customMovementPoint : 0,
			overrideSpeed : 0,
		};

		opts = $j.extend(defaultOpt,opts);

		if(this.stats.moveable){
			var creature = this;

			var x = hex.x;
			var y = hex.y;

			if(opts.ignorePath || opts.animation == "fly"){
				var path = [hex];
			}else{
				var path = creature.calculatePath(x,y);
			}

			if( path.length === 0 ) return; // Break if empty path

			G.grid.xray( new Hex(0,0) ); // Clean Xray

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
	tracePath: function(hex){
		var creature = this;

		var x = hex.x;
		var y = hex.y;
		var path = creature.calculatePath(x,y); // Store path in grid to be able to compare it later

		G.grid.updateDisplay(); // Retrace players creatures

		if( path.length === 0 ) return; // Break if empty path

		path.each(function() {
			creature.tracePosition({ x: this.x, y: this.y, displayClass: "adj" });
		}); // Trace path


		// Highlight final position
		var last = path.last();

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
	calculatePath: function(x,y){
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
	calcOffset: function(x,y){
		var offset = (G.players[this.team].flipped) ? this.size-1 : 0 ;
		var mult = (G.players[this.team].flipped) ? 1 : -1 ; // For FLIPPED player
		for (var i = 0; i < this.size; i++) { // Try next hexagons to see if they fit
			if( (x+offset-i*mult >= G.grid.hexs[y].length) || (x+offset-i*mult < 0) ) continue;
			if(G.grid.hexs[y][x+offset-i*mult].isWalkable(this.size, this.id)){
				x += offset-i*mult;
				break;
			}
		}
		return {x:x, y:y};
	},


	/*	getInitiative(dist)
	*
	*	wait :		Boolean :	Take account of the hasWait attribute
	*
	*	return :	Integer :	Initiative value to order the queue
	*
	*/
	getInitiative: function(wait){
		return (this.stats.initiative*500-this.id)+(500000*!(!!wait && !!this.delayed)); // To avoid 2 identical initiative
	},


	/*	adjacentHexs(dist)
	*
	*	dist :		Integer :	Distance in hexagons
	*
	*	return :	Array :		Array of adjacent hexagons
	*
	*/
	adjacentHexs: function(dist, clockwise){

		// TODO Review this algo to allow distance
		if(!!clockwise){
			var Hexs = [];
			var o = (this.y%2 === 0)?1:0;

			if(this.size == 1) {
				var c = [{y:this.y,x:this.x+1},
				{y:this.y-1,x:this.x+o},
				{y:this.y-1,x:this.x-1+o},
				{y:this.y,x:this.x-1},
				{y:this.y+1,x:this.x-1+o},
				{y:this.y+1,x:this.x+o}];
			}
			if(this.size == 2) {
				var c = [{y:this.y,x:this.x+1},
				{y:this.y-1,x:this.x+o},
				{y:this.y-1,x:this.x-1+o},
				{y:this.y-1,x:this.x-2+o},
				{y:this.y,x:this.x-2},
				{y:this.y+1,x:this.x-2+o},
				{y:this.y+1,x:this.x-1+o},
				{y:this.y+1,x:this.x+o}];
			}
			if(this.size == 3) {
				var c = [{y:this.y,x:this.x+1},
				{y:this.y-1,x:this.x+o},
				{y:this.y-1,x:this.x-1+o},
				{y:this.y-1,x:this.x-2+o},
				{y:this.y-1,x:this.x-3+o},
				{y:this.y,x:this.x-3},
				{y:this.y+1,x:this.x-3+o},
				{y:this.y+1,x:this.x-2+o},
				{y:this.y+1,x:this.x-1+o},
				{y:this.y+1,x:this.x+o}];
			}
			for (var i = 0; i < c.length; i++) {
				x = c[i].x;	y = c[i].y;
				if(G.grid.hexExists(y,x)) Hexs.push(G.grid.hexs[y][x]);
			}
			return Hexs;
		}

		if(this.size > 1) {
			var creature = this;
			var Hexs = this.hexagons[0].adjacentHex(dist);
			var lastHexs = this.hexagons[this.size-1].adjacentHex(dist);
			Hexs.each(function() {
				if(creature.hexagons.findPos(this)){Hexs.removePos(this);} // Remove from array if own creature hex
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



	/*	heal(amount)
	*
	*	amount :	Damage :	Amount of health point to restore
	*/
	heal: function(amount,isRegrowth){
		if(this.health + amount > this.baseStats.health)
			amount = this.stats.health - this.health; // Cap health point

		if(this.health + amount < 1)
			amount = this.health-1; // Cap to 1hp

		// if(amount == 0) return;

		this.health += amount;

		// Health display Update
		this.updateHealth(isRegrowth);

		if(amount > 0){
			if(isRegrowth) this.hint(amount+" ♥",'healing d'+amount);
			else this.hint(amount,'healing d'+amount);
			G.log("%CreatureName"+this.id+"% recovers +"+amount+" health");
		}else if(amount === 0){
			if(isRegrowth) this.hint("♦",'msg_effects');
			else this.hint("!",'msg_effects');
		}else{
			if(isRegrowth) this.hint(amount+" ♠",'damage d'+amount);
			else this.hint(amount,'damage d'+amount);
			G.log("%CreatureName"+this.id+"% loses "+amount+" health");
		}


	},


	/*	takeDamage(damage)
	*
	*	damage :	Damage : 	Damage object
	*
	*	return :	Object :	Contains damages dealed and if creature is killed or not
	*/
	takeDamage: function(damage,ignoreRetaliation){
		var creature = this;

		// Determine if melee attack
		damage.melee = false;
		this.adjacentHexs(1).each(function() {
			if( damage.attacker == this.creature ) damage.melee = true;
		});

		// Trigger
		G.triggersFn.onAttack(this, damage);

		// Calculation
		if( damage.status === "" ) {

			// Damages
			var dmg = damage.apply(this);
			var dmgAmount = dmg.total;

			if( !isFinite(dmgAmount) ) { // Check for Damage Errors
				this.hint("Error",'damage');
				G.log("Oops something went wrong !");
				return {damages:0, kill:false};
			}

			this.health -= dmgAmount;
			this.health = (this.health < 0) ? 0 : this.health; // Cap

			if( !this.stats.fatigueImmunity ){
				this.endurance -= dmgAmount;
				this.endurance = (this.endurance < 0) ? 0 : this.endurance; // Cap
			}

			G.UI.updateFatigue();

			// Display
			var nbrDisplayed = (dmgAmount) ? "-"+dmgAmount : 0;
			this.hint(nbrDisplayed,'damage d'+dmgAmount);

			if(!damage.noLog) G.log("%CreatureName"+this.id+"% is hit : "+nbrDisplayed+" health");

			// Health display Update
			this.updateHealth();

			// If Health is empty
			if(this.health <= 0){
				this.die(damage.attacker);
				return {damages:dmg, damageObj:damage, kill:true}; // Killed
			}

			// Add Fatigue effect
			if( this.endurance === 0 && this.findEffect('Fatigue').length === 0 ){
				this.addEffect( new Effect(
					"Fatigue",
					this,
					this,
					"",
					{
						alterations : { regrowth : -1*this.baseStats.regrowth } ,
						creationTurn : G.turn-1,
						turnLifetime : 1,
						deleteTrigger : "onEndPhase"
					}
				) );

			} // Fatigued effect

			// Effects
			damage.effects.each(function() {
				creature.addEffect(this);
			});

			// Trigger
			if(!ignoreRetaliation) G.triggersFn.onDamage(this, damage);

			return {damages: dmg, damageObj: damage, kill: false}; // Not Killed
		}else{
			if(damage.status == "Dodged"){ // If dodged
				if(!damage.noLog) G.log("%CreatureName"+this.id+"% dodged the attack");
			}

			if(damage.status == "Shielded"){ // If Shielded
				if(!damage.noLog) G.log("%CreatureName"+this.id+"% shielded the attack");
			}

			if(damage.status == "Disintegrated"){ // If Disintegrated
				if(!damage.noLog) G.log("%CreatureName"+this.id+"% has been disintegrated");
				this.die(damage.attacker);
			}

			// Hint
			this.hint(damage.status,'damage '+damage.status.toLowerCase());
		}

		return {damageObj:damage, kill:false}; // Not killed
	},


	updateHealth: function(noAnimBar){
		if(this == G.activeCreature && !noAnimBar){
			G.UI.healthBar.animSize( this.health / this.stats.health );
		}

		if( this.type == "--" && this.player.plasma > 0 ){
			this.healtIndicatorSprite.loadTexture("p"+this.player.id+"_plasma");
			this.healtIndicatorText.setText(this.player.plasma);
		}else{
			this.healtIndicatorSprite.loadTexture("p"+this.player.id+"_health");
			this.healtIndicatorText.setText(this.health);
		}
	},

	/*	addEffect(effect)
	*
	*	effect :		Effect :	Effect object
	*
	*/
	addEffect: function(effect, specialString, specialHint){
		if( !effect.stackable && this.findEffect(effect.name).length !== 0 ){
			//G.log(this.player.name+"'s "+this.name+" is already affected by "+effect.name);
			return false;
		}

		effect.target = this;
		this.effects.push(effect);

		G.triggersFn.onEffectAttachement(this, effect);

		this.updateAlteration();

		if(effect.name !== ""){
			if(specialHint || effect.specialHint){
				this.hint(specialHint,'msg_effects');
			}else{
				this.hint(effect.name,'msg_effects');
			}
			if(specialString){
				G.log(specialString);
			}else{
				G.log("%CreatureName"+this.id+"% is affected by "+effect.name);
			}
		}
	},

	hint: function(text,cssClass){
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
		this.hintGrp.forEach(function(grpHintElem){
			if(grpHintElem.cssClass == 'confirm'){
				grpHintElem.cssClass = "confirm_deleted";
				grpHintElem.tweenAlpha = G.Phaser.add.tween(grpHintElem).to( {alpha:0}, tooltipSpeed, tooltipTransition ).start();
				grpHintElem.tweenAlpha.onComplete.add(function() { this.destroy(); },grpHintElem);
			}
		},this,true);

		var hint = G.Phaser.add.text(0,50, text, style);
		hint.anchor.setTo(0.5, 0.5);

		hint.alpha = 0;
		hint.cssClass = cssClass;

		if(cssClass == 'confirm'){
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
		this.hintGrp.forEach(function(grpHintElem){
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
		crea.stats = $j.extend({},this.baseStats); // Copy

		var buffDebuffArray = this.effects.concat(this.dropCollection);

		// Multiplication Buff
		buffDebuffArray.each(function() {
			$j.each(this.alterations,function(key, value){
				if( ( typeof value ) == "string" ) {
					if( value.match(/\*/) ) {
						crea.stats[key] = eval(crea.stats[key]+value);
					}
				}
			});
		});

		// Usual Buff/Debuff
		buffDebuffArray.each(function() {
			$j.each(this.alterations,function(key, value){
				if( ( typeof value ) == "number" ) {
					crea.stats[key] += value;
				}
			});
		});

		// Division Debuff
		buffDebuffArray.each(function() {
			$j.each(this.alterations,function(key, value){
				if( ( typeof value ) == "string" ) {
					if( value.match(/\//) ) {
						crea.stats[key] = eval(crea.stats[key]+value);
					}
				}
			});
		});

		// Boolean Buff/Debuff
		buffDebuffArray.each(function() {
			$j.each(this.alterations,function(key, value){
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
	die: function(killer){

		var crea = this;

		G.log("%CreatureName"+this.id+"% is dead");

		this.dead = true;

		// Triggers
		G.triggersFn.onCreatureDeath(this);

		this.killer = killer.player;
		var isDeny = (this.killer.flipped == this.player.flipped);


		// Drop item
		if( this.drop ){
			var offsetX = (this.player.flipped) ? this.x - this.size + 1: this.x ;
			new Drop( this.drop.name, this.drop.alterations, offsetX, this.y );
		}


		if(!G.firstKill && !isDeny){ // First Kill
			this.killer.score.push({type: "firstKill"});
			G.firstKill = true;
		}

		if(this.type == "--"){ // If Dark Priest
			if(isDeny){
				// TEAM KILL (DENY)
				this.killer.score.push({type: "deny", creature: this});
			}else{
				// Humiliation
				this.killer.score.push({type:"humiliation", player: this.team});
			}
		}

		if(!this.undead){ // Only if not undead
			if(isDeny){
				// TEAM KILL (DENY)
				this.killer.score.push({type: "deny", creature: this});
			}else{
				// KILL
				this.killer.score.push({type: "kill", creature: this});
			}
		}

		if( this.player.isAnnihilated() ){
			// Remove humiliation as annihilation is an upgrade
			for(var i = 0; i < this.killer.score.length; i++){
				var s = this.killer.score[i];
				if(s.type == "humiliation"){
					if(s.player == this.team) this.killer.score.splice(i, 1);
					break;
				}
			}
			// ANNIHILATION
			this.killer.score.push({type:"annihilation",player:this.team});
		}

		if(this.type == "--") this.player.deactivate(); // Here because of score calculation

		// Kill animation
		var tweenSprite = G.Phaser.add.tween(this.sprite).to( {alpha:0}, 500, Phaser.Easing.Linear.None ).start();
		var tweenHealth = G.Phaser.add.tween(this.healtIndicatorGrp).to( {alpha:0}, 500, Phaser.Easing.Linear.None ).start();
		tweenSprite.onCompleteCallback(function() { crea.sprite.destroy(); });
		tweenHealth.onCompleteCallback(function() { crea.healtIndicatorGrp.destroy(); });

		this.cleanHex();

		G.queue.removePos(this);
		G.nextQueue.removePos(this);
		G.delayQueue.removePos(this);
		G.reorderQueue();
		G.grid.updateDisplay();

		if(G.activeCreature === this){ G.nextCreature(); return; } //End turn if current active creature die

		// As hex occupation changes, path must be recalculated for the current creature not the dying one
		G.activeCreature.queryMove();

		// Queue cleaning
		G.UI.updateActivebox();
		G.UI.updateQueueDisplay(); // Just in case
	},


	/*	isAlly(team)
	*
	*	team :		Integer :	id of the player
	*
	*	return :	Boolean :	True if ally and false for ennemies
	*/
	isAlly : function(team){
		return ( team%2 == this.team%2 );
	},


	/*	getHexMap(team)
	*
	*	shortcut convenience function to grid.getHexMap
	*/
	getHexMap : function(map, invertFlipped){
		var x = ( this.player.flipped ? !invertFlipped : invertFlipped ) ? this.x+1-this.size : this.x;
		return G.grid.getHexMap( x , this.y - map.origin[1] , 0-map.origin[0] , ( this.player.flipped ? !invertFlipped : invertFlipped ) , map );
	},

	getBuffDebuff : function(stat){
		var crea = this;

		var buffDebuffArray = this.effects.concat(this.dropCollection);
		var buff = 0;
		var debuff = 0;
		var buffObjs = { effects: [], drops: [] };

		var addToBuffObjs = function(obj){
			if(obj instanceof Effect){
				buffObjs.effects.push(obj);
			}else if(obj instanceof Drop){
				buffObjs.drops.push(obj);
			}
		};

		// Multiplication Buff
		buffDebuffArray.each(function() {
			var o = this;
			$j.each(this.alterations,function(key,value){
				if( ( typeof value ) == "string" ) {
					if( value.match(/\*/) ) {
						if( key === stat || stat === undefined){
							addToBuffObjs(o);
							var base = crea.stats[key];
							var result = eval(crea.stats[key]+value);
							if(result > base){
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
			$j.each(this.alterations,function(key, value){
				if( ( typeof value ) == "number" ) {
					if( key === stat || stat === undefined){
						addToBuffObjs(o);
						if(value > 0){
							buff += value;
						}else{
							debuff += value;
						}
					}
				}
			});
		});

		// Division Debuff
		buffDebuffArray.each(function() {
			var o = this;
			$j.each(this.alterations,function(key, value){
				if( ( typeof value ) == "string" ) {
					if( key === stat || stat === undefined){
						if( value.match(/\//) ) {
							addToBuffObjs(o);
							var base = crea.stats[key];
							var result = eval(crea.stats[key]+value);
							if(result > base){
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

	findEffect : function(name){
		var ret = [];
		this.effects.each(function() {
			if( this.name == name ){
				ret.push(this);
			}
		});
		return ret;
	},

	// Make units transparent
	xray : function(enable){
		if(enable){
			G.Phaser.add.tween(this.grp)
				.to({alpha: 0.5}, 250, Phaser.Easing.Linear.None)
				.start();
		}else{
			G.Phaser.add.tween(this.grp)
				.to({alpha:1}, 250, Phaser.Easing.Linear.None)
				.start();
		}
	},

	pickupDrop : function() {
		var crea = this;
		this.hexagons.each(function() {this.pickupDrop(crea);});
	}

});

var Drop = Class.create({

	initialize : function(name,alterations,x,y){

		this.name 			= name;
		this.id 			= dropID++;
		this.x 				= x;
		this.y 				= y;
		this.pos 			= { x:x, y:y };
		this.alterations 	= alterations;
		this.hex 			= G.grid.hexs[this.y][this.x];

		this.hex.drop = this;

		this.display = G.grid.dropGroup.create(this.hex.displayPos.x+54, this.hex.displayPos.y+15, 'drop_'+this.name);
		this.display.alpha = 0;
		this.display.anchor.setTo(.5,.5);
		this.display.scale.setTo(1.5,1.5);
		G.Phaser.add.tween(this.display).to( {alpha:1}, 500, Phaser.Easing.Linear.None ).start();
	},

	pickup : function(creature) {

		G.log("%CreatureName"+creature.id+"% picks up "+this.name);
		creature.hint(this.name,"msg_effects");
		creature.dropCollection.push(this);

		creature.updateAlteration();

		this.hex.drop = undefined;

		// Fills up consumable stats
		$j.each( this.alterations, function(key, value){
			switch(key){
				case "health" : 
					creature.heal(value);
					break;
				case "endurance" : 
					creature.endurance += value;
					break;
				case "energy" : 
					creature.energy += value;
					break;
				case "movement" : 
					creature.remainingMove += value;
					break;
			}
			G.log("%CreatureName"+creature.id+"% gains "+value+" "+key);
		});

		creature.updateAlteration(); // Will cap the stats

		var drop = this;
		var tween = G.Phaser.add.tween(this.display).to( {alpha:0}, 500, Phaser.Easing.Linear.None ).start();
		tween.onCompleteCallback(function() { drop.display.destroy(); });
	}
});

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
var Game = Class.create({
	/*	Attributes
	*
	*	NOTE : attributes and variables starting with $ are jquery elements
	*	and jquery functions can be called dirrectly from them.
	*
	*	//Jquery attributes
	*	$combatFrame :	Combat element containing all graphics except the UI
	*
	*	//Game elements
	*	players :			Array :	Containing Player objects ordered by player ID (0 to 3)
	*	creatures :			Array :	Contain creatures (creatures[creature.id]) start at index 1
	*
	*	grid :				Grid :	Grid object
	*	UI :				UI :	UI object
	*
	*	queue :				Array :	Current array of Creature ordered by initiative
	*	delayQueue :		Array :	Array of Creature who has wait during the turn
	*	nextQueue :			Array :	Array containing ALL creature ordered by initiative
	*
	*	turn :				Integer :	Number of the current turn
	*
	*	//normal attributes
	*	nbrPlayer :			Integer :	Number of player in the game
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
		this.activeCreature = {id:0};
		this.animations = new Animations();
		this.turn = 0;
		this.queue = [];
		this.delayQueue = [];
		this.nextQueue = []; // Next round queue
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
		this.realms = ["A","E","G","L","P","S","W"];
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
			//44, // Scavenger
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
		this.Phaser = new Phaser.Game(1920, 1080, Phaser.AUTO, 'combatwrapper', {update:function() { G.phaserUpdate(); }, render:function() { G.phaserRender(); }});

		// Msg (TODO External file)
		this.msg = {
			abilities : {
				notarget	: "No targets available.",
				noplasma	: "Not enough plasma.",
				nopsy		: "Psyhelm overload: too many units!",
				alreadyused	: "Ability already used.",
				toomuch		: "Too much %stat%.",
				notenough	: "Not enough %stat%."
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
	loadGame: function(setupOpt){
		var defaultOpt = {
			nbrPlayer : 2,
			timePool : 5*60,
			turnTimePool : 60,
			background_image : "Frozen Skull",
			plasma_amount : 50,
			creaLimitNbr : 7,
		};

		this.gameState = "loading";
		setupOpt = $j.extend(defaultOpt,setupOpt);
		$j.extend(this,setupOpt);

		G.startLoading();

		dpcolor = ["blue","orange","green","red"];

		this.loadingSrc = this.availableMusic.length // Music
		+ this.soundEffects.length // Sound effects
		+ 1 // Background
		+ 12 // Hexagons
		+ 8 // Health Frames
		+ 3 // Traps
		+ 2 // Effects
		;

		// Music Loading
		this.soundLoaded = {};
		this.soundsys = new Soundsys();
		for (var i = 0; i < this.availableMusic.length; i++) {
			this.soundsys.getSound("../media/music/"+this.availableMusic[i],i,function() { G.loadFinish(); });
		}

		for (var i = 0; i < this.soundEffects.length; i++) {
			this.soundsys.getSound("./sounds/"+this.soundEffects[i],this.availableMusic.length+i,function() { G.loadFinish(); });
		}

		this.Phaser.load.onFileComplete.add(G.loadFinish,G);

		// Health
		this.Phaser.load.image('p0_health', './frames/p0_health.png');
		this.Phaser.load.image('p1_health', './frames/p1_health.png');
		this.Phaser.load.image('p2_health', './frames/p2_health.png');
		this.Phaser.load.image('p3_health', './frames/p3_health.png');
		this.Phaser.load.image('p0_plasma', './frames/p0_plasma.png');
		this.Phaser.load.image('p1_plasma', './frames/p1_plasma.png');
		this.Phaser.load.image('p2_plasma', './frames/p2_plasma.png');
		this.Phaser.load.image('p3_plasma', './frames/p3_plasma.png');

		// Grid
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

		// Traps
		this.Phaser.load.image('trap_royal-seal', './grid/royal-seal.png');
		this.Phaser.load.image('trap_mud-bath', './grid/mud-bath.png');
		this.Phaser.load.image('trap_scorched-ground', './grid/scorched-ground.png');
		this.Phaser.load.image('trap_firewall', './grid/scorched-ground.png');

		// Effects
		this.Phaser.load.image('effects_fissure-vent', './grid/fissure-vent.png');
		this.Phaser.load.image('effects_chilling-spit', '../units/sprites/Snow Bunny Chilling Spit.png');

		// Background
		this.Phaser.load.image('background', "locations/"+this.background_image+"/bg.jpg");

		// Get JSON files
		$j.getJSON("../units/data.json", function(json_in) {
			G.creatureJSON = json_in;

			G.creatureDatas = G.creatureJSON;

			for (var j = 0; j < G.loadedCreatures.length; j++) {

				var data = G.creatureJSON[G.loadedCreatures[j]];

				G.loadingSrc += 2;

				// Load unit shouts
				G.soundsys.getSound('../units/shouts/'+data.name+'.ogg', 1000+G.loadedCreatures[j],function() { G.loadFinish(); });
				// Load unit abilities
				//getScript('abilities/'+data.name+'.js', function() { G.loadFinish(); });
				// Load artwork
				getImage('../units/artwork/'+data.name+'.jpg', function() { G.loadFinish(); });

				if(data.name == "Dark Priest"){
					for (var i = 0; i < dpcolor.length; i++) {
						G.loadingSrc += 2;
						G.Phaser.load.image(data.name+dpcolor[i]+'_cardboard', '../units/cardboards/'+data.name+' '+dpcolor[i]+'.png');
						getImage('../units/avatars/'+data.name+' '+dpcolor[i]+'.jpg', function() { G.loadFinish(); });
					}
				}else{
					if(data.drop){
						G.loadingSrc += 1;
						G.Phaser.load.image('drop_'+data.drop.name, 'drops/'+data.drop.name+'.png');
					}
					G.loadingSrc += 2;
					G.Phaser.load.image(data.name+'_cardboard', '../units/cardboards/'+data.name+'.png');
					getImage('../units/avatars/'+data.name+'.jpg', function() { G.loadFinish(); });
				}

				// For code compatibility
				G.availableCreatures[j] = data.type;
			}

			G.Phaser.load.start();
		});

	},

	startLoading: function() {
		$j("#gamesetupcontainer").hide();
		$j("#loader").show();
	},

	loadFinish: function() {
		this.loadedSrc++;
		if(this.loadingSrc==this.loadedSrc){
			$j("#loader").hide();
			G.setup(G.nbrPlayer);
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


	/*	Setup(nbrPlayer)
	*
	*	nbrPlayer :		Integer :	Ideally 2 or 4, number of players to setup the game
	*
	*	Launch the game with the given number of player.
	*
	*/
	setup: function(nbrPlayer) {

		// Phaser
		this.Phaser.scale.pageALignHorizontally = true;
	  this.Phaser.scale.pageAlignVertically = true;
	  this.Phaser.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
	  this.Phaser.stage.forcePortrait = true;
	  this.Phaser.scale.setScreenSize(true);

		var bg = this.Phaser.add.sprite(0, 0, 'background');
		bg.inputEnabled = true;
		bg.events.onInputUp.add(function(Sprite,Pointer) {
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
		$j("#matchmaking").hide();

		for (var i = 0; i < nbrPlayer; i++) {
			var player = new Player(i);
			this.players.push(player);

			//starting position
			var pos = {};
			if(nbrPlayer>2) { // If 4 players
				switch(player.id) {
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
			}else{ // If 2 players
				switch(player.id) {
					case 0:
						pos = {x:0	,y:4};
						break;
					case 1:
						pos = {x:14	,y:4};
						break;
				}
			}

			player.summon("--",pos); // Summon Dark Priest

		}

		this.activeCreature = this.players[0].creatures[0]; // Prevent errors

		this.UI = new UI(); // Creating UI not before because certain function requires creature to exists

		// DO NOT CALL LOG BEFORE UI CREATION
		this.gameState = "playing";

		this.log("Welcome to Ancient Beast pre-Alpha");
		this.log("Setting up a "+nbrPlayer+" player match");

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
		// if( ($j(window).width() / 1920) > ($j(window).height() / 1080) ){
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
		this.log("Round "+this.turn,"roundmarker");
		this.queue = this.nextQueue.slice(0); // Copy queue

		this.delayQueue = [];

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
		G.grid.xray( new Hex(-1,-1) ); // Clear Xray

		if(this.gameState == "ended") return;

		G.stopTimer();
		// Delay
		setTimeout(function() {
			var interval = setInterval(function() {
				if(!G.freezedInput) {
					clearInterval(interval);

					var differentPlayer = false;

					if(G.queue.length === 0) { // If no creature in queue
						if(G.delayQueue.length > 0){
							if( G.activeCreature ) differentPlayer = ( G.activeCreature.player != G.delayQueue[0].player );
							else differentPlayer = true;
							G.activeCreature = G.delayQueue[0]; //set new creature active
							G.delayQueue = G.delayQueue.slice(1); //and remove it from the queue
							console.log("Delayed Creature");
						}else{
							G.nextRound(); // Go to next Round
							return; // End function
						}
					}else{
						if( G.activeCreature ) differentPlayer = ( G.activeCreature.player != G.queue[0].player );
						else differentPlayer = true;
						G.activeCreature = G.queue[0]; // Set new creature active
						G.queue = G.queue.slice(1); // And remove it from the queue
					}

					if(G.activeCreature.player.hasLost) {
						G.nextCreature();
						return;
					}

					// Heart Beat sound for different player turns
					if(differentPlayer) {
						G.soundsys.playSound(G.soundLoaded[4],G.soundsys.heartbeatGainNode);
					}

					G.log("Active Creature : %CreatureName"+G.activeCreature.id+"%");
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
						G.log("%CreatureName"+G.activeCreature.id+"%, press here to toggle tutorial!");
					}

					// Update UI to match new creature
					G.UI.updateActivebox();
					G.reorderQueue(); // Update UI and Queue order
				}
			},50);
		},300);
	},


	/*	reorderQueue()
	*
	*	Do what it says xD
	*
	*/
	reorderQueue: function() {
		this.queue.orderByInitiative();
		this.nextQueue.orderByInitiative();
		if ( this.UI ) {
			this.UI.updateQueueDisplay();
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
				stringConsole = stringConsole.replace("%CreatureName"+i+"%",this.creatures[i].player.name+"'s "+this.creatures[i].name);
				stringLog = stringLog.replace("%CreatureName"+i+"%","<span class='"+this.creatures[i].player.color+"'>"+this.creatures[i].name+"</span>");
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

		if(!o.noTooltip) G.activeCreature.hint(o.tooltip,"msg_effects");

		setTimeout(function() {
			G.turnThrottle=false;
			G.UI.btnSkipTurn.changeState("normal");
			if(!G.activeCreature.hasWait && G.activeCreature.delayable && (G.delayQueue.length+G.queue.length !== 0) ) G.UI.btnDelay.changeState("normal");
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
		if(G.turnThrottle) return;
		if(this.activeCreature.hasWait || !this.activeCreature.delayable || G.delayQueue.length + G.queue.length ===0 ) return;

		o = $j.extend({
			callback: function() {},
		},o);

		G.turnThrottle = true;
		G.UI.btnSkipTurn.changeState("disabled");
		G.UI.btnDelay.changeState("disabled");

		setTimeout(function() {
			G.turnThrottle=false;
			G.UI.btnSkipTurn.changeState("normal");
			if(!G.activeCreature.hasWait && G.activeCreature.delayable && (G.delayQueue.length+G.queue.length !== 0) ) G.UI.btnDelay.changeState("normal");
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

		p.totalTimePool = Math.max(p.totalTimePool,0); // Clamp

		// Check all timepool
		var playerStillHaveTime = (this.timePool>0) ? false : true ; // So check is always true for infinite time
		for(var i = 0; i < this.nbrPlayer; i++) { // Each player
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
		}else if( this.timePool > 0 ){ // Timepool not infinite
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

	triggerAbility : function( trigger, arg, retValue ) {

		// For triggered creature
		arg[0].abilities.each(function() {
			if( arg[0].dead === true ) return;
			if( G.triggers[trigger].test(this.trigger) ) {
				if( this.require(arg[1]) ){
					retValue = this.animation(arg[1]);
				}
			}
		});

		// For other creatures
		G.creatures.each(function() {
			if( arg[0] === this || this.dead === true ) return;
			this.abilities.each(function() {
				if( G.triggers[trigger+"_other"].test(this.trigger) ) {
					if( this.require(arg[1]) ) {
						retValue = this.animation(arg[1]);
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
			this.activateTrap(G.triggers[trigger],arg[0]);
		});
	},

	triggerDeleteEffect : function( trigger, creature ) {
		if( creature == "all" ) {
			for (var i = 0; i < G.effects.length; i++) {
				effect = G.effects[i];
				if(effect.turnLifetime > 0 && trigger == effect.deleteTrigger) {
					if(G.turn-effect.creationTurn >= effect.turnLifetime) {
						effect.deleteEffect();
						i--;
					}
				}
			}
			return;
		}

		for (var i = 0; i < creature.effects.length; i++) {
			if(creature.effects[i].turnLifetime > 0 && trigger == creature.effects[i].deleteTrigger) {
				if(G.turn-creature.effects[i].creationTurn >= creature.effects[i].turnLifetime) {
					creature.effects[i].deleteEffect();
					i--;
				}
			}
		}
	},

	triggersFn : {

		onStepIn : function( creature, hex, callback ) {
			G.triggerTrap("onStepIn",arguments);
			G.triggerAbility("onStepIn",arguments);
			G.triggerEffect("onStepIn",arguments);
		},

		onStepOut : function( creature, hex, callback ) {
			G.triggerTrap("onStepOut",arguments);
			G.triggerAbility("onStepOut",arguments);
			G.triggerEffect("onStepOut",arguments);
		},

		onStartPhase : function( creature, callback ) {
			for (var i = 0; i < G.grid.traps.length; i++) {
				trap = G.grid.traps[i];
				if(trap === undefined) continue;
				if(trap.turnLifetime > 0) {
					if(G.turn-trap.creationTurn >= trap.turnLifetime) {
						if(trap.fullTurnLifetime){
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
			G.triggerDeleteEffect("onStartPhase",creature);
			G.triggerAbility("onStartPhase",arguments);
			G.triggerEffect("onStartPhase",[creature,creature]);
		},

		onEndPhase : function( creature, callback ) {
			G.triggerDeleteEffect("onEndPhase",creature);
			G.triggerAbility("onEndPhase",arguments);
			G.triggerEffect("onEndPhase",[creature,creature]);
		},

		onStartOfRound : function( creature, callback ) {
			G.triggerDeleteEffect("onStartOfRound","all");
		},

		onCreatureMove : function( creature, hex, callback ) {
			G.triggerAbility("onCreatureMove",arguments);
		},

		onCreatureDeath : function( creature, callback ) {
			G.triggerAbility("onCreatureDeath",arguments);
			G.triggerEffect("onCreatureDeath",[creature,creature]);
		},

		onCreatureSummon : function( creature, callback ) {
			G.triggerAbility("onCreatureSummon",[creature,creature,callback]);
			G.triggerEffect("onCreatureSummon",[creature,creature]);
		},

		onEffectAttachement : function( creature, effect, callback ) {
			G.triggerEffect("onEffectAttachement",[creature,effect]);
		},


		onAttack : function( creature, damage ) {
			damage = G.triggerAbility("onAttack",arguments,damage);
			damage = G.triggerEffect("onAttack",arguments,damage);
			return damage;
		},

		onDamage : function( creature, damage ) {
			G.triggerAbility("onDamage",arguments);
			G.triggerEffect("onDamage",arguments);
		}
	},


	findCreature: function( o ) {
		var o = $j.extend({
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


	/*	Regex Test for damage type */
	dmgType : {
		area : new RegExp('area', 'i'),
		target : new RegExp('target', 'i'),
		retaliation : new RegExp('retaliation', 'i'),
	},

	clearOncePerDamageChain: function() {
		for (var i = this.creatures.length - 1; i >= 0; i--) {
			if(this.creatures[i] instanceof Creature){
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

		if(this.nbrPlayer==2) { // If Only 2 players remove the other 2 columns
			$table.children("tr").children("td:nth-child(even)").remove();
			var $table = $j("#endscreen table tbody");
		}

		// FILLING THE BOARD
		for(var i = 0; i < this.nbrPlayer; i++) { // Each player

			// TimeBonus
			if(this.timePool > 0)
				this.players[i].bonusTimePool = Math.round(this.players[i].totalTimePool/1000);

			//-------Ending bonuses--------//
			// No fleeing
			if(!this.players[i].hasFled && !this.players[i].hasLost)
				this.players[i].score.push({type:"nofleeing"});
			// Surviving Creature Bonus
			var immortal = true;
			for(var j = 0; j < this.players[i].creatures.length; j++) {
				if(!this.players[i].creatures[j].dead) {
					if(this.players[i].creatures[j].type != "--")
						this.players[i].score.push({type:"creaturebonus",creature:this.players[i].creatures[j]});
					else // Dark Priest Bonus
						this.players[i].score.push({type:"darkpriestbonus"});
				}else{
					immortal = false;
				}
			}
			// Immortal
			if(immortal && this.players[i].creatures.length > 1) // At least 1 creature summoned
				this.players[i].score.push({type:"immortal"});

			//----------Display-----------//
			var colId = (this.nbrPlayer>2) ?( i+2+((i%2)*2-1)*Math.min(1,i%3) ):i+2;

			// Change Name
			$table.children("tr.player_name").children("td:nth-child("+colId+")") // Weird expression swap 2nd and 3rd player
			.text(this.players[i].name);

			//Change score
			$j.each(this.players[i].getScore(),function(index,val){
				var text = ( val === 0 && index !== "total") ? "--" : val ;
				$table.children("tr."+index).children("td:nth-child("+colId+")") // Weird expression swap 2nd and 3rd player
				.text(text);
			});
		}

		// Defining winner
		if(this.nbrPlayer > 2) { //2vs2
			var score1 = this.players[0].getScore().total + this.players[2].getScore().total;
			var score2 = this.players[1].getScore().total + this.players[3].getScore().total;

			if( score1 > score2 ) {
				// Left side wins
				$j("#endscreen p").text(this.players[0].name+" and "+this.players[2].name+" won the match!");
			}else if( score1 < score2 ) {
				// Right side wins
				$j("#endscreen p").text(this.players[1].name+" and "+this.players[3].name+" won the match!");
			}else if( score1 == score2 ) {
				// Draw
				$j("#endscreen p").text("Draw!");
			}
		}else{ // 1vs1
			var score1 = this.players[0].getScore().total;
			var score2 = this.players[1].getScore().total;

			if( score1 > score2 ) {
				// Left side wins
				$j("#endscreen p").text(this.players[0].name+" won the match!");
			}else if( score1 < score2 ) {
				// Right side wins
				$j("#endscreen p").text(this.players[1].name+" won the match!");
			}else if( score1 == score2 ) {
				// Draw
				$j("#endscreen p").text("Draw!");
			}
		}
	},

	action : function(o,opt){

		var defaultOpt = {
			callback : function() {},
		};
		opt = $j.extend(defaultOpt,opt);

		G.clearOncePerDamageChain();
		switch(o.action) {
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
				if(o.target.type=="hex") {
					args.unshift(G.grid.hexs[o.target.y][o.target.x]);
					G.activeCreature.abilities[o.id].animation2({callback:opt.callback,arg:args});
				}
				if(o.target.type=="creature") {
					args.unshift(G.creatures[o.target.crea]);
					G.activeCreature.abilities[o.id].animation2({callback:opt.callback,arg:args});
				}
				if(o.target.type=="array") {
					var array = [];
					o.target.array.each(function() { array.push(G.grid.hexs[this.y][this.x]); });
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
	*	id :		Integer :	Id of the player 1, 2, 3 or 4
	*	creature :	Array :		Array containing players creatures
	*	plasma :	Integer :	Plasma amount for the player
	*	flipped :	Boolean :	Player side of the battlefield (affects displayed creature)
	*
	*/
	initialize: function(id) {
		this.id = id;
		this.creatures = [];
		this.name = "Player"+(id+1);
		this.color =
		(this.id === 0)? "red"
		:(this.id == 1)? "blue"
		:(this.id == 2)? "orange"
		: "green";
		this.avatar = "../units/avatars/Dark Priest "+this.color+".jpg";
		this.score = [];
		this.plasma = G.plasma_amount;
		this.flipped = !!(id%2); // Convert odd/even to true/false
		this.availableCreatures = G.availableCreatures;
		this.hasLost = false;
		this.hasFleed = false;
		this.bonusTimePool = 0;
		this.totalTimePool = G.timePool*1000;
		this.startTime = new Date();

		this.score = [{type:"timebonus"}];
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
	summon: function(type,pos) {
		var data = G.retreiveCreatureStats(type);
		data = $j.extend(data,pos,{team:this.id}); // Create the full data for creature creation
		for (var i = G.creatureJSON.length - 1; i >= 0; i--) {
			if(
				G.creatureJSON[i].type == type &&
				i !== 0 ) // Avoid Dark Priest shout at the begining of a match
			{
				G.soundsys.playSound(G.soundLoaded[1000+i],G.soundsys.announcerGainNode);
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
					points += Math.round(this.bonusTimePool * 0.5);
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
	isLeader: function() {

		for(var i = 0; i < G.nbrPlayer; i++) { // Each player
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
				G.queue.removePos(crea);
				G.nextQueue.removePos(crea);
				G.delayQueue.removePos(crea);
			}
		}
		G.reorderQueue();

		// Test if allie Dark Priest is dead
		if( G.nbrPlayer > 2) {
			// 2vs2
			if( G.players[ (this.id+2)%4 ].hasLost )
				G.endGame();
		}else{
			// 1vs1
			G.endGame();
		}
	},
});


var Gamelog = Class.create({

	initialize: function(id) {
		this.datas = [];
		this.playing = false;
		this.timeCursor = -1;
	},

	add: function(action) {
		this.datas.push(action);
	},

	play: function(log) {

		if(log){
			this.datas = log;
		}

		var fun = function() {
			G.gamelog.timeCursor++;
			if(G.debugMode) console.log(G.gamelog.timeCursor+"/"+G.gamelog.datas.length);
			if(G.gamelog.timeCursor>G.gamelog.datas.length-1) {
				G.activeCreature.queryMove(); // Avoid bug
				return;
			}
			var interval = setInterval(function() {
				if(!G.freezedInput && !G.turnThrottle) {
					clearInterval(interval);
					G.activeCreature.queryMove(); // Avoid bug
					G.action(G.gamelog.datas[G.gamelog.timeCursor],{callback:fun});
				}
			},100);
		};
		fun();
	},

	next: function() {
		if(G.freezedInput || G.turnThrottle) return false;

		G.gamelog.timeCursor++;
		if(G.debugMode) console.log(G.gamelog.timeCursor+"/"+G.gamelog.datas.length);
		if(G.gamelog.timeCursor>G.gamelog.datas.length-1){
			G.activeCreature.queryMove(); // Avoid bug
			return;
		}
		var interval = setInterval(function() {
			if(!G.freezedInput && !G.turnThrottle) {
				clearInterval(interval);
				G.activeCreature.queryMove(); // Avoid bug
				G.action(G.gamelog.datas[G.gamelog.timeCursor],{callback: function() { G.activeCreature.queryMove(); } });
			}
		},100);
	},

	get: function() {
		console.log(JSON.stringify(this.datas));
	}
});



var Soundsys = Class.create({

	initialize: function(o) {
		o = $j.extend({
			music_volume : 0.1,
			effects_volume : 0.6,
			heartbeats_volume : 0.2,
			announcer_volume : 0.6
		},o);

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

	getSound: function(url,id,success) {
		if(!window.AudioContext) success();
		var id = id;
		bufferLoader = new BufferLoader(this.context,[url],function(arraybuffer) {
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


// Zfill like in python
function zfill(num, size) {
    var s = "000000000" + num;
    return s.substr(s.length-size);
}

// Cross Browser script loader
// From http://stackoverflow.com/a/5853358
function getScript(url,success){
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
function print_r(arr,level) {
	var dumped_text = "";
	if(!level) level = 0;

	// The padding given at the beginning of the line.
	var level_padding = "";
	for(var j=0;j<level+1;j++) level_padding += "    ";

	if(typeof(arr) == 'object') { // Array/Hashes/Objects
		for(var item in arr) {
			var value = arr[item];

			if(typeof(value) == 'object') { // If it is an array,
				dumped_text += level_padding + "'" + item + "' ...\n";
				dumped_text += dump(value,level+1);
			} else {
				dumped_text += level_padding + "'" + item + "' => \"" + value + "\"\n";
			}
		}
	} else { // Strings/Chars/Numbers etc.
		dumped_text = "===>"+arr+"<===("+typeof(arr)+")";
	}
	return dumped_text;
}

/** Initialize the game global variable */
var G = new Game();
/*****************************************/

$j(document).ready(function() {
	$j(".typeradio").buttonset();
	$j("#startbutton").button();

	$j("form#gamesetup").submit(function(e) {
		e.preventDefault(); // Prevent submit
		var gameconfig = {
			nbrPlayer : $j('input[name="nbrplayer"]:checked').val()-0,
			background_image : $j('input[name="location"]:checked').val(),
			plasma_amount : $j('input[name="plasma"]:checked').val()-0,
			timePool : $j('input[name="time_pool"]:checked').val()*60,
			turnTimePool : $j('input[name="time_turn"]:checked').val()-0,
			creaLimitNbr : $j('input[name="active_units"]:checked').val()-0, // DP counts as One
		};

		if( gameconfig.background_image == "random" ) {
			var index = Math.floor(Math.random() * ($j('input[name="location"]').length - 1) ) + 1;  // nth-child indices start at 1
			gameconfig.background_image = $j('input[name="location"]').slice(index,index+1).attr("value");
		}
		G.loadGame(gameconfig);
		return false; // Prevent submit
	});
});

/*	Class UI
*
*	Object containing UI DOM element, update functions and event managment on UI.
*
*/
var UI = Class.create({

	/*	Attributes
	*
	*	NOTE : attributes and variables starting with $ are jquery element
	*	and jquery function can be called dirrectly from them.
	*
	*	$display :		UI container
	*	$queue :		Queue container
	*	$textbox :		Chat and log container
	*	$activebox :	Current active creature panel (left panel) container
	*	$dash :			Overview container
	*	$grid :			Creature grid container
	*
	*	selectedCreature :	String :	ID of the visible creature card
	*	selectedPlayer :	Integer :	ID of the selected player in the dash
	*
	*/


	/*	Constructor
	*
	*	Create attributes and default buttons
	*
	*/
	initialize: function() {
		this.$display = $j("#ui");
		this.$queue = $j("#queuewrapper");
		this.$dash = $j("#dash");
		this.$grid = $j("#creaturegrid");
		this.$activebox = $j("#activebox");

		// Chat
		this.chat = new Chat();

		// Buttons Objects
		this.buttons = [];
		this.abilitiesButtons = [];

		// Dash Button
		this.btnToggleDash = new Button({
			$button : $j(".toggledash"),
			click : function(e) {G.UI.toggleDash();},
		});
		this.buttons.push(this.btnToggleDash);

		// Audio Button
		this.btnFlee = new Button({
			$button : $j("#audio.button"),
			click : function(e) { if(!G.UI.dashopen){
				G.UI.showMusicPlayer();
			}}
		});
		this.buttons.push(this.btnFlee);

		// Skip Turn Button
		this.btnSkipTurn = new Button({
			$button : $j("#skip.button"),
			click : function(e) { if(!G.UI.dashopen){
				if(G.turnThrottle) return;
				G.gamelog.add({action:"skip"});
				G.skipTurn();
			}},
		});
		this.buttons.push(this.btnSkipTurn);

		// Delay Unit Button
		this.btnDelay = new Button({
			$button : $j("#delay.button"),
			click : function(e) { if(!G.UI.dashopen) {
				if(G.turnThrottle) return;
				if(G.activeCreature.hasWait || !G.activeCreature.delayable || G.delayQueue.length + G.queue.length ===0 ) return;
				G.gamelog.add({action:"delay"});
				G.delayCreature();
			}},
		});
		this.buttons.push(this.btnDelay);

		// Flee Match Button
		this.btnFlee = new Button({
			$button : $j("#flee.button"),
			click : function(e){ if(!G.UI.dashopen) {
				if( G.turn < G.minimumTurnBeforeFleeing ) {
					alert("You cannot flee the match in the first 10 rounds.");
					return;
				}
				if( G.activeCreature.player.isLeader() ) {
					alert("You cannot flee the match while being in lead.");
					return;
				}

				if(window.confirm("Are you sure you want to flee the match?")) {
					G.gamelog.add({action:"flee"});
					G.activeCreature.player.flee();
				}
			}},
			state : "disabled",
		});
		this.buttons.push(this.btnFlee);

		// ProgessBar
		this.healthBar = new ProgessBar({$bar : $j("#leftpanel .progressbar .bar.healthbar"), color : "red" });
		this.energyBar = new ProgessBar({$bar : $j("#leftpanel .progressbar .bar.energybar"), color : "yellow" });
		this.timeBar = new ProgessBar({$bar : $j("#rightpanel .progressbar .timebar"), color : "white" });
		this.poolBar = new ProgessBar({$bar : $j("#rightpanel .progressbar .poolbar"), color : "grey" });

		// Volume Sliders
		$j("#effects_volume").slider({
			step: 0.2,
			value: 5,
			min: 0,
			max: 10,
			slide: function( event, ui ) {
				G.soundsys.setEffectsVolume( ui.value/5 );
			}
		});

		// Binding Hotkeys
		$j(document).keydown(function(e) {
			if(G.freezedInput) return;

			var keypressed = e.keyCode || e.which;
			//console.log(keypressed);

			hotkeys = {
				overview: 9, // Tab
				cycle: 81, // Q
				attack: 87, // W
				ability: 69, // E
				ultimate: 82, // R
				audio: 65, // A
				skip: 83, // S
				delay: 68, // D
				flee: 70, // F
				chat: 13, // Return
				//pause: 80, // P, might get deprecated
				dash_up: 38, // Up arrow
				dash_down: 40, // Down arrow
				dash_left: 37, // Left arrow
				dash_right: 39, // Right arrow
				dash_materializeButton: 13, // Return

				grid_up: 38, // Up arrow
				grid_down: 40, // Down arrow
				grid_left: 37, // Left arrow
				grid_right: 39, // Right arrow
				grid_confirm: 32 // Space
			};

			var prevD = false;

			$j.each(hotkeys,function(k,v) {
				if(v==keypressed){
					// Context filter
					if(G.UI.dashopen) {
						switch(k) {
							case "dash_materializeButton": G.UI.materializeButton.triggerClick(); break;
							case "dash_up": G.UI.gridSelectUp(); break;
							case "dash_down": G.UI.gridSelectDown(); break;
							case "dash_left": G.UI.gridSelectLeft(); break;
							case "dash_right": G.UI.gridSelectRight(); break;
						}
					}else{
						switch(k){
							case "cycle": G.UI.abilitiesButtons[0].triggerClick(); break; // Not usable atm :(
							case "attack": G.UI.abilitiesButtons[1].triggerClick(); break;
							case "ability": G.UI.abilitiesButtons[2].triggerClick(); break;
							case "ultimate": G.UI.abilitiesButtons[3].triggerClick(); break;
							case "overview": G.UI.btnToggleDash.triggerClick(); break;
							case "skip": G.UI.btnSkipTurn.triggerClick(); break;
							case "delay": G.UI.btnDelay.triggerClick(); break;
							case "flee": G.UI.btnFlee.triggerClick(); break;
							case "chat": G.UI.chat.toggle(); break;
							case "pause": G.togglePause(); break; // Might get deprecated

							case "grid_up": G.grid.selectHexUp(); break;
							case "grid_down": G.grid.selectHexDown(); break;
							case "grid_left": G.grid.selectHexLeft(); break;
							case "grid_right": G.grid.selectHexRight(); break;

							case "grid_confirm": G.grid.confirmHex(); break;
						}
					}
					prevD = true;
				}
			});
			if(prevD){
				e.preventDefault();
				return false;
			}
		});

		// Mouse Shortcut
		$j("#dash").bind('mouseup', function(e) {
			if(G.freezedInput) return;

			switch (e.which) {
				case 1:
					// Left mouse button pressed
					break;
				case 2:
					// Middle mouse button pressed
					if(G.UI.dashopen) {
						G.UI.materializeButton.triggerClick();
					}
					break;
				case 3:
					// Right mouse button pressed
					if(G.UI.dashopen) {
						G.UI.closeDash();
					}
					break;
			}
		});
		// TODO: Function to exit dash via Tab or Esc hotkeys

		$j("#combatwrapper, #dash, #toppanel").bind('mousewheel', function(e, delta, deltaX, deltaY) {
			if(G.freezedInput) return;

			// Dash
			if(G.UI.dashopen ){
				if(delta > 0) { // Wheel up
					G.UI.gridSelectPrevious();
				}else if(delta < 0) { // Wheel down
					G.UI.gridSelectNext();
				}

			// Abilities
			}else{
				if(delta > 0) { // Wheel up
					var b = ( G.UI.selectedAbility == -1 ) ? 4 :  G.UI.selectedAbility ;

					for (var i = (b-1); i > 0; i--) {
						if( G.activeCreature.abilities[i].require() && !G.activeCreature.abilities[i].used ) {
							G.UI.abilitiesButtons[i].triggerClick();
							return;
						}
					}

					G.activeCreature.queryMove();
				// TODO: Allow to cycle between the usable active abilities by pressing the passive one's icon
				}else if(delta < 0) { // Wheel down
					var b = ( G.UI.selectedAbility == -1 ) ? 0 :  G.UI.selectedAbility ;

					for (var i = (b+1); i < 4; i++) {
						if( G.activeCreature.abilities[i].require() && !G.activeCreature.abilities[i].used ) {
							G.UI.abilitiesButtons[i].triggerClick();
							return;
						}
					}

					G.activeCreature.queryMove();

				}
			}
		});

		for (var i = 0; i < 4; i++) {
			var b = new Button({
				$button : $j("#abilities > div:nth-child("+(i+1)+") > .ability"),
				abilityId : i,
				css : {
					disabled	: {},
					glowing		: { "cursor": "pointer" },
					selected	: {},
					active		: {},
					noclick		: {},
					normal		: { "cursor": "default" },
				}
			});
			this.buttons.push(b);
			this.abilitiesButtons.push(b);
		}

		this.materializeButton = new Button({
			$button : $j("#materialize_button"),
			css : {
				disabled	: {},
				glowing		: { "cursor": "pointer" },
				selected	: {},
				active		: {},
				noclick		: {},
				normal		: { "cursor": "default" },
			}
		});

		this.$dash.children("#playertabswrapper").addClass("numplayer"+G.nbrPlayer);

		this.selectedCreature = "";
		this.selectedPlayer = 0;
		this.selectedAbility = -1;

		this.queueAnimSpeed = 500; // ms
		this.dashAnimSpeed = 250; // ms

		this.materializeToggled = false;
		this.dashopen = false;

		this.glowInterval = setInterval(function(){

			var opa =  0.5+Math.floor( (1 + Math.sin(  Math.floor( new Date()*Math.PI*0.20 )/100 ) ) / 4 *100)/100;

			G.UI.buttons.each(function() {
				this.$button.css("opacity","");

				if(this.state == "glowing") {
					this.$button.css("opacity",opa);
				}
			});

			opaWeak = opa/2;

			G.grid.allHexs.each(function() {

				if( this.overlayClasses.match(/creature/) ) {

					if( this.overlayClasses.match(/selected|active/) ) {

						if( this.overlayClasses.match(/weakDmg/) ) {

							this.overlay.alpha = opaWeak;
							return;
						}

						this.overlay.alpha = opa;
					}
				}
			});
		},10);


		if(G.turnTimePool) $j(".turntime").text(zfill(Math.floor(G.turnTimePool/60),2)+":"+zfill(G.turnTimePool%60,2));
		if(G.timePool) $j(".timepool").text(zfill(Math.floor(G.timePool/60),2)+":"+zfill(G.timePool%60,2));

		$j("#tabwrapper a").removeAttr("href"); // Empty links

		// Show UI
		this.$display.show();
		this.$dash.hide();
	},


	resizeDash: function(){
		var zoom1 = $j("#cardwrapper").innerWidth() / $j("#card").outerWidth();
		var zoom2 = $j("#cardwrapper").innerHeight() / ( $j("#card").outerHeight() + $j("#materialize_button").outerHeight() );
		var zoom = Math.min(zoom1,zoom2);
		zoom = Math.min(zoom,1);
		$j("#cardwrapper_inner").css({
			scale: zoom,
			"left": ($j("#cardwrapper").innerWidth()-$j("#card").innerWidth()*zoom)/2,
			position: "absolute",
			margin: 0
		});

		var zoom1 = $j("#creaturegridwrapper").innerWidth()/$j("#creaturegrid").innerWidth();
		var zoom2 = $j("#creaturegridwrapper").innerHeight()/$j("#creaturegrid").innerHeight();
		zoom = Math.min(zoom1,zoom2);
		zoom = Math.min(zoom,1);
		$j("#creaturegrid").css({
			scale: zoom,
			"left": ($j("#creaturegridwrapper").innerWidth()-$j("#creaturegrid").innerWidth()*zoom)/2,
			position: "absolute",
			margin: 0
		});
	},


	/*	showCreature(creatureType,player)
	*
	*	creatureType :	String :	Creature type
	*	player :		Integer :	Player ID
	*
	*	Query a creature in the available creatures of the active player
	*
	*/
	showCreature: function(creatureType,player){

		if(!this.dashopen){
			this.$dash.show().css("opacity",0);
			this.$dash.transition({opacity:1},this.dashAnimSpeed,"linear");
		}

		this.dashopen = true;

		if( player === undefined ) {
			player = G.activeCreature.player.id;
		}

		// Set dash active
		this.$dash.addClass("active");
		this.$dash.children("#tooltip").removeClass("active");
		this.$dash.children("#playertabswrapper").addClass("active");
		this.changePlayerTab(G.activeCreature.team);
		this.resizeDash();

		this.$dash.children("#playertabswrapper").children(".playertabs").unbind('click').bind('click',function(e){
			if(G.freezedInput) return;
			G.UI.showCreature("--",$j(this).attr("player")-0);
		});

		// Update player info
		for (var i = G.players.length - 1; i >= 0; i--) {
			$j("#dash .playertabs.p"+i+" .vignette").css("background-image","url('"+G.players[i].avatar+"')");
			$j("#dash .playertabs.p"+i+" .name").text(G.players[i].name);
			$j("#dash .playertabs.p"+i+" .plasma").text("Plasma "+G.players[i].plasma);
			$j("#dash .playertabs.p"+i+" .score").text("Score "+G.players[i].getScore().total);
			$j("#dash .playertabs.p"+i+" .units").text("Units "+G.players[i].getNbrOfCreatures()+" / "+G.creaLimitNbr);
		}

		// Change to the player tab
		if(player != G.UI.selectedPlayer) {this.changePlayerTab(player);}

		this.$grid.children(".vignette").removeClass("active")
		.filter("[creature='"+creatureType+"']").addClass("active");

		this.selectedCreature = creatureType;

		var stats = G.retreiveCreatureStats(creatureType);

		// TODO card animation
		if( $j.inArray(creatureType, G.players[player].availableCreatures)>0 || creatureType=="--"){
			// Retreive the selected unit
			var crea = undefined;
			G.UI.selectedCreatureObj = undefined;
			G.players[player].creatures.each(function() {
				if(this.type == creatureType) {
					crea = this;
					G.UI.selectedCreatureObj = this;
				}
			});

			// Card A
			$j("#card .sideA").css({"background-image":"url('../images/cards/margin.png'), url('../units/artwork/"+stats.name+".jpg')"});
			$j("#card .sideA audio").attr("src", "../units/shouts/"+stats.name+".ogg")
			$j("#card .sideA .section.info").removeClass("sin- sinA sinE sinG sinL sinP sinS sinW").addClass("sin"+stats.type.substring(0,1));
			$j("#card .sideA .type").text(stats.type);
			$j("#card .sideA .name").text(stats.name);
			$j("#card .sideA .hexs").text(stats.size+"H");

			// Card B
			$j("#card .sideB").css({"background-image":"url('../images/cards/margin.png'), url('../images/cards/"+stats.type.substring(0,1)+".jpg')"});
			$j.each(stats.stats,function(key,value) {
				var $stat = $j("#card .sideB ."+key+" .value");
				$stat.removeClass("buff debuff");
				if(crea){
					if(key=="health"){
						$stat.text(crea.health+"/"+crea.stats[key]);
					}else if(key=="movement") {
						$stat.text(crea.remainingMove+"/"+crea.stats[key]);
					}else if(key=="energy") {
						$stat.text(crea.energy+"/"+crea.stats[key]);
					}else if(key=="endurance") {
						$stat.text(crea.endurance+"/"+crea.stats[key]);
					}else{
						$stat.text(crea.stats[key]);
					}
					if(crea.stats[key]>value) { // Buff
						$stat.addClass("buff");
					}else if(crea.stats[key]<value) { // Debuff
						$stat.addClass("debuff");
					}
				}else{
					$stat.text(value);
				}
			});
			$j.each(G.abilities[stats.id],function(key,value) {
				$ability = $j("#card .sideB .abilities .ability:eq("+key+")");
				$ability.children('.icon').css({"background-image":"url('../units/icons/"+stats.name+" "+key+".svg')"});
				$ability.children(".wrapper").children(".info").children("h3").text(stats.ability_info[key].title);
				$ability.children(".wrapper").children(".info").children("#desc").text(stats.ability_info[key].desc);
				$ability.children(".wrapper").children(".info").children("#info").text(stats.ability_info[key].info);
			});

			var summonedOrDead = false;
			G.players[player].creatures.each(function() {
				if(this.type == creatureType){
					summonedOrDead = true;
				}
			});

			// Materialize button
			this.materializeButton.changeState("disabled");

			if(G.activeCreature.player.getNbrOfCreatures() > G.creaLimitNbr){
				$j('#materialize_button p').text(G.msg.ui.dash.materialize_overload);
			}else if(
				!summonedOrDead &&
				G.activeCreature.player.id === player &&
				G.activeCreature.type === "--" &&
				G.activeCreature.abilities[3].used === false
			)
			{
				var lvl = creatureType.substring(1,2)-0;
				var size = G.retreiveCreatureStats(creatureType).size-0;
				plasmaCost = lvl+size;

				// Messages (TODO: text strings in a new language file)
				if(plasmaCost>G.activeCreature.player.plasma) {
					$j('#materialize_button p').text("Low Plasma! Cannot materialize the selected unit");
				}else{
					$j('#materialize_button p').text("Materialize unit at target location for "+plasmaCost+" plasma");

					// Bind button
					this.materializeButton.click = function(e) {
						G.UI.materializeToggled = true;
						G.UI.selectAbility(3);
						G.UI.closeDash(true);
						G.activeCreature.abilities[3].materialize(G.UI.selectedCreature);
					};
					this.materializeButton.changeState("glowing");

				}

			}else{
				if (
					G.activeCreature.player.id === player &&
					G.activeCreature.type === "--" &&
					G.activeCreature.abilities[3].used === true
				){
					$j('#materialize_button p').text("Materialization has already been used this round");
				}else if(
					G.activeCreature.player.id === player &&
					G.activeCreature.type === "--"
				){
					$j('#materialize_button p').text("Please select an available unit from the left grid");
				}else if (G.activeCreature.type != "--") {
					$j('#materialize_button p').text("The current active unit cannot materialize others");
				}else if (
					G.activeCreature.type ==="--" &&
					G.activeCreature.player.id != player
				){
					$j('#materialize_button p').text("Switch to your own tab to be able to materialize");

					// Bind button
					this.materializeButton.click = function(e) {
						G.UI.showCreature("--", G.activeCreature.player.id);
					};
					this.materializeButton.changeState("glowing");

				}
			}

		}else{

			// Card A
			$j("#card .sideA").css({"background-image":"url('../images/cards/margin.png'), url('../units/artwork/"+stats.name+".jpg')"});
			$j("#card .sideA .section.info").removeClass("sin- sinA sinE sinG sinL sinP sinS sinW").addClass("sin"+stats.type.substring(0,1));
			$j("#card .sideA .type").text(stats.type);
			$j("#card .sideA .name").text(stats.name);
			$j("#card .sideA .hexs").text(stats.size+"H");

			// Card B
			$j.each(stats.stats,function(key,value) {
				var $stat = $j("#card .sideB ."+key+" .value");
				$stat.removeClass("buff debuff");
				$stat.text(value);
			});

			// Abilities
			$j.each(stats.ability_info,function(key,value) {
				$ability = $j("#card .sideB .abilities .ability:eq("+key+")");
				$ability.children('.icon').css({"background-image":"url('../units/icons/"+stats.name+" "+key+".svg')"});
				$ability.children(".wrapper").children(".info").children("h3").text(stats.ability_info[key].title);
				$ability.children(".wrapper").children(".info").children("#desc").html(stats.ability_info[key].desc);
				$ability.children(".wrapper").children(".info").children("#info").html(stats.ability_info[key].info);
			});

			// Materialize button
			$j('#materialize_button').removeClass("glowing").unbind('click');
			$j('#materialize_button p').text("This unit is currently under heavy development");
		}
	},


	selectAbility: function(i){
		this.checkAbilities();
		this.selectedAbility = i;
		if( i>-1 )
			this.abilitiesButtons[i].changeState("active");
	},


	/*	changePlayerTab(id)
	*
	*	id :	Integer :	player id
	*
	*	Change to the specified player tab in the dash
	*
	*/
	changePlayerTab: function(id){
		this.selectedPlayer = id;
		this.$dash // Dash class
		.removeClass("selected0 selected1 selected2 selected3")
		.addClass("selected"+id);

		this.$grid.find(".vignette") // Vignettes class
		.removeClass("active dead queued notsummonable")
		.addClass("locked");

		$j("#tabwrapper").show();
		$j("#musicplayerwrapper").hide();

		// Change creature status
		G.players[id].availableCreatures.each(function() {
			G.UI.$grid.find(".vignette[creature='"+this+"']").removeClass("locked");

			var lvl = this.substring(1,2)-0;
			var size = G.retreiveCreatureStats(this).size-0;
			plasmaCost = lvl+size;

			if( plasmaCost > G.players[id].plasma ) {
				G.UI.$grid.find(".vignette[creature='"+this+"']").addClass("notsummonable");
			}
		});

		G.players[id].creatures.each(function() {
			var $crea = G.UI.$grid.find(".vignette[creature='"+this.type+"']");
			$crea.removeClass("notsummonable");
			if(this.dead === true){
				$crea.addClass("dead");
			}else{
				$crea.addClass("queued");
			}
		});

		// Bind creature vignette click
		this.$grid.find(".vignette").unbind('click').bind("click",function(e) {
			e.preventDefault();
			if(G.freezedInput) return;

			if($j(this).hasClass("locked")) {
				G.UI.$dash.children("#tooltip").text("Creature locked.");
			}

			var creatureType = $j(this).attr("creature");
			G.UI.showCreature(creatureType,G.UI.selectedPlayer);
		});

	},

	showMusicPlayer: function() {
		this.$dash.addClass("active");

		this.showCreature(G.activeCreature.type,G.activeCreature.team);

		this.selectedPlayer = -1;

		this.$dash // Dash class
			.removeClass("selected0 selected1 selected2 selected3");

		$j("#tabwrapper").hide();
		$j("#musicplayerwrapper").show();
	},

	/*	toggleDash()
	*
	*	Show the dash and hide some buttons
	*
	*/
	toggleDash: function() {
		if(!this.$dash.hasClass("active")) {
			this.showCreature(G.activeCreature.type,G.activeCreature.team);
		}else{
			this.closeDash();
		}

	},

	closeDash: function(materialize) {
		this.$dash.removeClass("active");
		this.$dash.transition({opacity:0,queue:false},this.dashAnimSpeed,"linear",function() {
			G.UI.$dash.hide();
		});
		if(!materialize && G.activeCreature ) {
			G.activeCreature.queryMove();
		}
		this.dashopen = false;
		this.materializeToggled = false;
	},

	gridSelectUp: function() {
		var b = G.UI.selectedCreature ;

		if( b == "--"){
			G.UI.showCreature("W1");
			return;
		}

		if( G.realms.indexOf(b[0])-1 > -1 ) {
			var r = G.realms[ G.realms.indexOf(b[0])-1 ];
			G.UI.showCreature(r+b[1]);
		}else{ // End of the grid
			//G.UI.showCreature("--");
		}
	},

	gridSelectDown: function() {
		var b = G.UI.selectedCreature ;

		if( b == "--"){
			G.UI.showCreature("A1");
			return;
		}

		if( G.realms.indexOf(b[0])+1 < G.realms.length ) {
			var r = G.realms[ G.realms.indexOf(b[0])+1 ];
			G.UI.showCreature(r+b[1]);
		}else{ // End of the grid
			//G.UI.showCreature("--");
		}
	},

	gridSelectLeft: function() {
		var b = ( G.UI.selectedCreature == "--" ) ? "A0" :  G.UI.selectedCreature ;

		if( b[1]-1 < 1 ) { // End of row
			return;
		}else{
			G.UI.showCreature( b[0] + (b[1]-1) );
		}
	},

	gridSelectRight: function() {
		var b = ( G.UI.selectedCreature == "--" ) ? "A8" :  G.UI.selectedCreature ;

		if( b[1]-0+1 > 7 ) { // End of row
			return;
		}else{
			G.UI.showCreature( b[0] + (b[1]-0+1) );
		}
	},

	gridSelectNext: function() {
		var b = ( G.UI.selectedCreature == "--" ) ? "A0" :  G.UI.selectedCreature ;

		if( b[1]-0+1 > 7 ){ // End of row
			if( G.realms.indexOf(b[0])+1 < G.realms.length ) {
				var r = G.realms[ G.realms.indexOf(b[0])+1 ];

				// Test If Valid Creature
				if( $j.inArray( r+"1" , G.players[this.selectedPlayer].availableCreatures)>0	) {
					var valid = true;
					for (var i = 0; i < G.players[ this.selectedPlayer ].creatures.length; i++) {
						var crea = G.players[ this.selectedPlayer ].creatures[i];
						if( crea instanceof Creature && crea.type == r+"1" && crea.dead ) {
							var valid = false;
						}
					}

					if( valid ){
						G.UI.showCreature( r+"1" );
						return;
					}
				}
				G.UI.selectedCreature = r+"1";
			}else{
				return;
			}
		}else{

			// Test If Valid Creature
			if( $j.inArray( b[0]+(b[1]-0+1) , G.players[this.selectedPlayer].availableCreatures)>0	) {
				var valid = true;
				for (var i = 0; i < G.players[ this.selectedPlayer ].creatures.length; i++) {
					var crea = G.players[ this.selectedPlayer ].creatures[i];
					if( crea instanceof Creature && crea.type == b[0]+(b[1]-0+1) && crea.dead ) {
						var valid = false;
					}
				}

				if( valid ){
					G.UI.showCreature( b[0] + (b[1]-0+1) );
					return;
				}
			}
			G.UI.selectedCreature = b[0] + (b[1]-0+1);
		}
		G.UI.gridSelectNext();
	},

	gridSelectPrevious: function(){
		var b = ( G.UI.selectedCreature == "--" ) ? "W8" :  G.UI.selectedCreature ;

		if( b[1]-1 < 1 ) { // End of row
			if( G.realms.indexOf(b[0])-1 > -1 ) {
				var r = G.realms[ G.realms.indexOf(b[0])-1 ];

				// Test If Valid Creature
				if( $j.inArray( r+"7" , G.players[this.selectedPlayer].availableCreatures)>0	) {
					var valid = true;
					for (var i = 0; i < G.players[ this.selectedPlayer ].creatures.length; i++) {
						var crea = G.players[ this.selectedPlayer ].creatures[i];
						if( crea instanceof Creature && crea.type == r+"7" && crea.dead ) {
							var valid = false;
						}
					}

					if( valid ){
						G.UI.showCreature( r+"7" );
						return;
					}
				}
				G.UI.selectedCreature = r+"7";
			}else{
				return;
			}
		}else{

			// Test If Valid Creature
			if( $j.inArray( b[0]+(b[1]-1) , G.players[this.selectedPlayer].availableCreatures)>0 ) {
				var valid = true;
				for (var i = 0; i < G.players[ this.selectedPlayer ].creatures.length; i++) {
					var crea = G.players[ this.selectedPlayer ].creatures[i];
					if( crea instanceof Creature && crea.type == b[0]+(b[1]-1) && crea.dead ) {
						var valid = false;
					}
				}

				if( valid ){
					G.UI.showCreature( b[0] + (b[1]-1) );
					return;
				}
			}
			G.UI.selectedCreature = b[0] + (b[1]-1);
		}
		G.UI.gridSelectPrevious();
	},

	/*	updateActiveBox()
	*
	*	Update activebox with new current creature's abilities
	*
	*/
	updateActivebox: function() {
		var $abilitiesButtons = $j("#abilities .ability");
		$abilitiesButtons.unbind("click");

		this.$activebox.find("#abilities").clearQueue().transition({y:"-420px"},500,'easeInQuart',function() { // Hide panel
			$j(this).removeClass("p0 p1 p2 p3").addClass("p"+G.activeCreature.player.id);

			G.UI.energyBar.setSize( G.activeCreature.oldEnergy/G.activeCreature.stats.energy );
			G.UI.healthBar.setSize( G.activeCreature.oldHealth/G.activeCreature.stats.health );

			// Change ability buttons
			G.UI.abilitiesButtons.each(function() {
				var ab = G.activeCreature.abilities[this.abilityId];
				this.css.normal = {"background-image":"url('../units/icons/"+G.activeCreature.name+" "+this.abilityId+".svg')"};
				this.$button.next(".desc").find("span").text(ab.title);
				this.$button.next(".desc").find("p").html(ab.desc);

				var costs_string = ab.getFormatedCosts();
				var dmg_string = ab.getFormatedDamages();
				var special_string = ab.getFormatedEffects();

				// Removing elements
				this.$button.next(".desc").find(".costs , .damages , .special").remove();

				// Add if needed
				if(costs_string){
					this.$button.next(".desc").find(".abilityinfo_content").append('<div class="costs"></div>');
					this.$button.next(".desc").find(".costs").html("Costs : "+costs_string);
				}
				if(dmg_string){
					this.$button.next(".desc").find(".abilityinfo_content").append('<div class="damages"></div>');
					this.$button.next(".desc").find(".damages").html("Damages : "+dmg_string);
				}
				if(special_string){
					this.$button.next(".desc").find(".abilityinfo_content").append('<div class="special"></div>');
					this.$button.next(".desc").find(".special").html("Effects : "+special_string);
				}

				this.click = function() {
					if(G.UI.selectedAbility!=this.abilityId) {
						if(G.UI.dashopen) return false;
						G.grid.clearHexViewAlterations();
						// Activate Ability
						G.activeCreature.abilities[this.abilityId].use();
					}else{
						G.grid.clearHexViewAlterations();
						// Cancel Ability
						G.UI.closeDash();
						G.activeCreature.queryMove();
					}
				};

				this.mouseover = function() {
					var ab = G.activeCreature.abilities[this.abilityId];
					if(ab.costs !== undefined) {
						if( typeof ab.costs.energy == "number" ) {
							G.UI.energyBar.previewSize( ab.costs.energy / G.activeCreature.stats.energy );
						}else{
							G.UI.energyBar.previewSize( 0 );
						}
						if( typeof ab.costs.health == "number" ) {
							G.UI.healthBar.previewSize( ab.costs.health / G.activeCreaturestats.stats.health );
						}else{
							G.UI.healthBar.previewSize( 0 );
						}
					}
				};
				this.mouseleave = function(){
					G.UI.energyBar.previewSize( 0 );
					G.UI.healthBar.previewSize( 0 );
				};
				this.changeState(); // Apply changes
			});
			G.UI.$activebox.children("#abilities").transition({y:"0px"},500,'easeOutQuart'); // Show panel
		});

		G.UI.checkAbilitiesTooltip();

		this.updateInfos();
	},

	checkAbilitiesTooltip : function() {
		for (var i = 0; i < 4; i++) {
			var ab = G.activeCreature.abilities[i];

			var costs_string = ab.getFormatedCosts();
			var dmg_string = ab.getFormatedDamages();
			var special_string = ab.getFormatedEffects();

			// Removing elements
			this.abilitiesButtons[i].$button.next(".desc").find(".costs , .damages , .special").remove();

			// Add if needed
			if(costs_string){
				this.abilitiesButtons[i].$button.next(".desc").find(".abilityinfo_content").append('<div class="costs"></div>');
				this.abilitiesButtons[i].$button.next(".desc").find(".costs").html("Costs : "+costs_string);
			}
			if(dmg_string){
				this.abilitiesButtons[i].$button.next(".desc").find(".abilityinfo_content").append('<div class="damages"></div>');
				this.abilitiesButtons[i].$button.next(".desc").find(".damages").html("Damages : "+dmg_string);
			}
			if(special_string){
				this.abilitiesButtons[i].$button.next(".desc").find(".abilityinfo_content").append('<div class="special"></div>');
				this.abilitiesButtons[i].$button.next(".desc").find(".special").html("Effects : "+special_string);
			}
		}
	},

	checkAbilities : function() {
		var oneUsableAbility = false;

		G.UI.checkAbilitiesTooltip();

		for (var i = 0; i < 4; i++) {
			var ab = G.activeCreature.abilities[i];
			ab.message = "";
			var req = ab.require();
			ab.message = (ab.used) ? G.msg.abilities.alreadyused : ab.message;
			if( req && !ab.used && ab.trigger=="onQuery") {
				this.abilitiesButtons[i].changeState("glowing");
				oneUsableAbility = true;
			}else if( ab.message==G.msg.abilities.notarget || ( ab.trigger!="onQuery" && req && !ab.used ) ) {
				this.abilitiesButtons[i].changeState("noclick");
			}else{
				this.abilitiesButtons[i].changeState("disabled");
			}

			// Charge
			this.abilitiesButtons[i].$button.next(".desc").find(".charge").remove();
			if( ab.getCharge !== undefined ) {
				this.abilitiesButtons[i].$button.next(".desc").append('<div class="charge">Charge : '+ab.getCharge().value+"/"+ab.getCharge().max+'</div>');
			}

			// Message
			this.abilitiesButtons[i].$button.next(".desc").find(".message").remove();
			if( ab.message !== "" ) {
				this.abilitiesButtons[i].$button.next(".desc").append('<div class="message">'+ab.message+'</div>');
			}
		}

		// No action possible
		if( !oneUsableAbility && G.activeCreature.remainingMove === 0 ) {
			//G.skipTurn({tooltip:"Finished"}); // Autoskip
			G.activeCreature.noActionPossible = true;
			this.btnSkipTurn.changeState("glowing");
		}
	},

	/*	updateInfos()
	*
	*/
	updateInfos:function() {
		$j("#playerbutton, #playerinfos")
			.removeClass("p0 p1 p2 p3")
			.addClass("p"+G.activeCreature.player.id);
		$j("#playerinfos .name").text(G.activeCreature.player.name);
		$j("#playerinfos .points span").text(G.activeCreature.player.getScore().total);
		$j("#playerinfos .plasma span").text(G.activeCreature.player.plasma);
		$j("#playerinfos .units span").text(G.activeCreature.player.getNbrOfCreatures()+" / "+G.creaLimitNbr); // TODO: needs to update instantly!
	},

	showStatModifiers: function(stat) {

		if( G.UI.selectedCreatureObj instanceof Creature ) {
			var buffDebuff = G.UI.selectedCreatureObj.getBuffDebuff(stat);
			var atLeastOneBuff = false;
			// Might not be needed
			$j(card).find("."+stat+" .modifiers").html("");
			// Effects
			$j.each(buffDebuff.objs.effects, function(key,value) {
				//var string = G.UI.selectedCreatureObj.abilities[0].getFormatedDamages(value.alterations);
				if( value.alterations[stat] ) $j(card).find("."+stat+" .modifiers").append("<div>"+value.name+" : "+(value.alterations[stat]>0?"+":"")+value.alterations[stat]+"</div>");
				atLeastOneBuff = true;
			});
			// Drops
			$j.each(buffDebuff.objs.drops, function(key,value) {
				//var string = G.UI.selectedCreatureObj.abilities[0].getFormatedDamages(value.alterations);
				if( value.alterations[stat] ) $j(card).find("."+stat+" .modifiers").append("<div>"+value.name+" : "+(value.alterations[stat]>0?"+":"")+value.alterations[stat]+"</div>");
				atLeastOneBuff = true;
			});

			if(!atLeastOneBuff) {
				$j(card).find("."+stat+" .modifiers").html('This stat doesn\'t have any modifiers');
			}
		}

	},

	/*	updateTimer()
	*
	*/
	updateTimer:function() {
		var date = new Date() - G.pauseTime;

		// TurnTimePool
		if( G.turnTimePool >= 0 ) {
			var remainingTime = G.turnTimePool - Math.round((date - G.activeCreature.player.startTime)/1000);
			if(G.timePool > 0)
				remainingTime = Math.min(remainingTime, Math.round( (G.activeCreature.player.totalTimePool-(date - G.activeCreature.player.startTime))/1000) );
			var minutes = Math.floor(remainingTime/60);
			var seconds = remainingTime-minutes*60;
			var id = G.activeCreature.player.id;
			$j(".p"+id+" .turntime").text(zfill(minutes,2)+":"+zfill(seconds,2));
			// Time Alert
			if( remainingTime < 6 )
				$j(".p"+id+" .turntime").addClass("alert");
			else
				$j(".p"+id+" .turntime").removeClass("alert");

			// Time Bar
			var timeRatio = ( (date - G.activeCreature.player.startTime) / 1000 ) / G.turnTimePool;
			G.UI.timeBar.setSize( 1 - timeRatio );
		}else{
			$j(".turntime").text("∞");
		}

		// TotalTimePool
		if( G.timePool >= 0 ) {
			G.players.each(function() {
				var remainingTime = (this.id == G.activeCreature.player.id) ? this.totalTimePool - (date - this.startTime) : this.totalTimePool;
				remainingTime = Math.max(Math.round(remainingTime/1000),0);
				var minutes = Math.floor(remainingTime/60);
				var seconds = remainingTime-minutes*60;
				$j(".p"+this.id+" .timepool").text(zfill(minutes,2)+":"+zfill(seconds,2));
			});

			// Time Bar
			var poolRatio = ( G.activeCreature.player.totalTimePool - (date - G.activeCreature.player.startTime) ) / 1000 / G.timePool;
			G.UI.poolBar.setSize( poolRatio );
		}else{
			$j(".timepool").text("∞");
		}

	},


	/*	updateQueueDisplay()
	*
	*	Delete and add element to the Queue container based on the game's queues
	*
	*/
	updateQueueDisplay: function() { // Ugly as hell need rewrite

		if(!G.nextQueue.length || !G.activeCreature ) return false; // Abort to avoid infinite loop

		var queueAnimSpeed = this.queueAnimSpeed;
		var transition = "linear";
		var nbrOfQueue = 2;

		// Set transition duration for stat indicators
		this.$queue.find('.vignette .stats').css({transition: "height "+queueAnimSpeed+"ms"});

		// Updating
		var $vignettes = this.$queue.find('.vignette[verified!="-1"]').attr("verified",0);

		var deleteVignette = function(vignette) {

			if( $j( vignette ).hasClass("roundmarker") ) {
					$j( vignette ).attr("verified",-1).transition({x:-80, queue: false },queueAnimSpeed,transition,function(){ this.remove(); });
			}else{
				if( $j( vignette ).hasClass("active") ) {
					$j( vignette ).attr("verified",-1).transition({x:-100, queue: false },queueAnimSpeed,transition,function(){ this.remove(); });
				}else{
					$j( vignette ).attr("verified",-1).transition({x:"-=80", queue: false },queueAnimSpeed,transition,function(){ this.remove(); });
				}
			}

			// Updating
			$vignettes = G.UI.$queue.find('.vignette[verified!="-1"]');
		};

		var appendVignette = function(pos,vignette) {

			// Create element
			if( $vignettes.length === 0 ) {
				var $v = $j( vignette ).prependTo( G.UI.$queue );
				var index = $v.index('#queuewrapper .vignette[verified!="-1"]');
				var offset = (index-(!!index))*80 + (!!index)*100 -80;

			}else if( $vignettes[pos] ) {
				var $v = $j( vignette ).insertAfter( $vignettes[pos] );
				var index = $v.index('#queuewrapper .vignette[verified!="-1"]');
				var offset = (index-(!!index))*80 + (!!index)*100 -80;

			}else{
				var $v = $j( vignette ).appendTo( G.UI.$queue );
				var index = $v.index('#queuewrapper .vignette[verified!="-1"]');
				var offset = (index-(!!index))*80 + (!!index)*100 +1000;
			}

			// Animation
			$v.attr("verified",1)
				.css({x: offset})
				.transition({queue: true},queueAnimSpeed,transition); // Dont know why but it must be here

			// Updating
			$vignettes = G.UI.$queue.find('.vignette[verified!="-1"]');
		};

		var updatePos = function(){

			$vignettes.each(function() {
				var index = $j(this).index('#queuewrapper .vignette[verified!="-1"]');
				var offset = (index-(!!index))*80 + (!!index)*100;
				$j(this).css({"z-index": 0-index}).transition({x:offset, queue: false },queueAnimSpeed,transition);
			});
		};

		this.$queue.find('.vignette[verified!="-1"]').each(function(){
			if( $j(this).attr("turn") < G.turn ){
				deleteVignette( this );
			}
		});

		// Prepend current unit to queue after copying it
		var completeQueue = G.queue.slice(0);
		completeQueue.unshift(G.activeCreature);
		completeQueue = completeQueue.concat(G.delayQueue);

		for (var i = 1; i < nbrOfQueue; i++) {
			completeQueue = completeQueue.concat(["nextround"],G.nextQueue);
		}

		var u = 0;

		// Updating
		$vignettes = this.$queue.find('.vignette[verified!="-1"]').attr("verified",0);

		for (var i = 0; i < completeQueue.length; i++) {

			// Round Marker
			if( typeof completeQueue[i] == "string" ) {

				var queueElem = '<div turn="'+(G.turn+u)+'" roundmarker="1" class="vignette roundmarker"><div class="frame"></div><div class="stats">Round '+(G.turn+1)+'</div></div>';

				// If this element does not exists
				if( $vignettes[i] === undefined ) {
					// Create it
					appendVignette(i,queueElem);
				}else{
					// While its not the round marker
					while( $j( $vignettes[i] ).attr("roundmarker") === undefined ) {
						deleteVignette( $vignettes[i] );
					}
				}
				u++;

			// Creature Vignette
			}else{

				var initiative =  completeQueue[i].getInitiative( (u === 0) );
				var queueElem = '<div turn="'+(G.turn+u)+'" creatureid="'+completeQueue[i].id+'" initiative="'+initiative+'" class="vignette hidden p'+completeQueue[i].team+" type"+completeQueue[i].type+'"><div class="frame"></div><div class="overlay_frame"></div><div class="stats"></div></div>';

				// If this element does not exists
				if( $vignettes[i] === undefined ) {
					// Create it
					appendVignette(i,queueElem);
				}else{
					// While it'ss not the right creature
					while( $j($vignettes[i]).attr("creatureid") != completeQueue[i].id ) {

						if( $j($vignettes[i]).attr("creatureid") === undefined ){ // Is Round Marker
							// Create element before
							appendVignette(i-1,queueElem);
						}else if( $j($vignettes[i]).attr("initiative") < initiative ){ // Initiative is lower
							// Create element before
							appendVignette(i-1,queueElem);
						}else{
							// Remove element
							deleteVignette( $vignettes[i] );
						}
					}
				}
			}

			// Tag as verified
			$j($vignettes[i]).attr("verified",1);
		}

		// Delete non verified
		deleteVignette( this.$queue.find('.vignette[verified="0"]') );

		updatePos();

		this.updateFatigue();

		// Set active creature
		this.$queue.find('.vignette.active').removeClass("active"); // Avoid bugs
		this.$queue.find('.vignette[verified="1"]')
			.first().clearQueue().addClass("active")
			.css({ transformOrigin: '0px 0px' })
			.transition({ scale : 1.25, x : 0 },queueAnimSpeed,transition);

		// Add mouseover effect

		this.$queue.find('.vignette.roundmarker').unbind("mouseover").unbind("mouseleave").bind("mouseover",function() {
			G.grid.showGrid(true);
		}).bind("mouseleave",function() {
			G.grid.showGrid(false);
		});

		this.$queue.find('.vignette').not(".roundmarker").unbind("click").unbind("mouseover").unbind("mouseleave").bind("mouseover",function() {
			if(G.freezedInput) return;
			var creaID = $j(this).attr("creatureid")-0;
			G.grid.showMovementRange(creaID);
			G.creatures.each(function() {
				if(this instanceof Creature) {
					this.xray(false);
					if(this.id != creaID) { this.xray(true); }
				}
			});
			G.UI.xrayQueue(creaID);
		}).bind("mouseleave",function() { // On mouseleave cancel effect
			if(G.freezedInput) return;
			G.grid.redoLastQuery();
			G.creatures.each(function() {
				if(this instanceof Creature) {
					this.xray(false);
				}
			});
			G.UI.xrayQueue(-1);
		}).bind("click",function() { // Show dash on click
			if(G.freezedInput) return;
			var creaID = $j(this).attr("creatureid")-0;
			G.UI.showCreature(G.creatures[creaID].type,G.creatures[creaID].player.id);
		});

	},

	xrayQueue : function(creaID) {
		this.$queue.find('.vignette').removeClass("xray");
		if(creaID>0) this.$queue.find('.vignette[creatureid="'+creaID+'"]').addClass("xray");
	},

	updateFatigue : function() {

		G.creatures.each(function() {
			if(this instanceof Creature) {
				var text = (this.endurance > 0) ? this.endurance + "/" + this.stats.endurance : "Fatigued";

				if(this.type == "--") { // If Dark Priest
					this.abilities[0].require(); // Update protectedFromFatigue
				}

				text = ( this.protectedFromFatigue || this.stats.fatigueImmunity ) ? "Protected" : text;
				text = ( this.materializationSickness ) ? "Sickened" : text;
				$j('#queuewrapper .vignette[creatureid="'+this.id+'"]').children(".stats").text(text);
			}
		});

	}

});

var Chat = Class.create({
	/*	Constructor
	*
	*	Chat/Log Functions
	*
	*/
	initialize: function() {
		this.$chat = $j("#chat");
		this.$content = $j("#chatcontent");
		this.$chat.bind('click',function() {G.UI.chat.toggle();});
		$j("#combatwrapper,#toppanel,#dash,#endscreen").bind('click',function() {G.UI.chat.hide();});
	},


	show : function() { this.$chat.addClass("focus"); },
	hide : function() { this.$chat.removeClass("focus"); },
	toggle : function() { this.$chat.toggleClass("focus"); this.$content.parent().scrollTop(this.$content.height());},

	addMsg : function(msg,htmlclass) {
		var time = new Date(new Date() - G.startMatchTime);
		this.$content.append("<p class='"+htmlclass+"'><i>"+zfill(time.getUTCHours(),2)+":"+zfill(time.getMinutes(),2)+":"+zfill(time.getSeconds(),2)+"</i> "+msg+"</p>");
		this.$content.parent().scrollTop(this.$content.height());
	},
});


var Button = Class.create({
	/*	Constructor
	*
	*	Create attributes and default buttons
	*
	*/
	initialize: function(opts) {

		defaultOpts = {
			click : function() {},
			mouseover : function() {},
			mouseleave : function() {},
			clickable : true,
			state : "normal", // disabled,normal,glowing,selected,active
			$button : undefined,
			attributes : {},
			css : {
				disabled	: {},
				glowing		: {},
				selected	: {},
				active		: {},
				normal		: {},
			}
		};

		opts = $j.extend(defaultOpts,opts);
		$j.extend(this,opts);
		this.changeState(this.state);
	},


	changeState : function(state) {
		var btn = this;

		state = state || this.state;
		this.state = state;
		this.$button.unbind("click").unbind("mouseover").unbind("mouseleave");
		if( state != "disabled" ) {
			this.$button.bind("click",function() {
				if(G.freezedInput || !btn.clickable) return;
				btn.click();
			} );
			this.$button.bind("mouseover",function() {
				if(G.freezedInput || !btn.clickable) return;
				btn.mouseover();
			} );
			this.$button.bind("mouseleave",function() {
				if(G.freezedInput || !btn.clickable) return;
				btn.mouseleave();
			} );
		}
		this.$button.removeClass("disabled glowing selected active noclick");
		this.$button.css( this.css["normal"] );

		if( state != "normal" ) {
			this.$button.addClass(state);
			this.$button.css( this.css[state] );
		}
	},

	triggerClick : function() {
		if(G.freezedInput || !this.clickable) return;
		this.click();
	},

	triggerMouseover : function() {
		if(G.freezedInput || !this.clickable) return;
		this.mouseover();
	},

	triggerMouseleave : function() {
		if(G.freezedInput || !this.clickable) return;
		this.mouseleave();
	},
});

var ProgessBar = Class.create({

	initialize: function(opts) {
		defaultOpts = {
			height : 318,
			width : 9,
			color : "red",
			$bar : undefined
		};

		opts = $j.extend(defaultOpts,opts);
		$j.extend(this,opts);

		this.$bar.append('<div class="previewbar"></div>');
		this.$preview = this.$bar.children(".previewbar");

		this.setSize(1);
	},

	/*	setSize
	*
	*	percentage :	Float :	Size between 0 and 1
	*
	*/
	setSize: function(percentage) {
		this.$bar.css({
			width : this.width,
			height : this.height*percentage,
			"background-color" : this.color,
		});
	},

	/*	animSize
	*
	*	percentage :	Float :	size between 0 and 1
	*
	*/
	animSize: function(percentage) {
		this.$bar.transition({
			queue : false,
			width : this.width,
			height : this.height*percentage,
		},500,"linear");
	},

	/*	previewSize
	*
	*	percentage :	Float :	size between 0 and 1
	*
	*/
	previewSize: function(percentage) {
		this.$preview.css({
			width : this.width-2,
			height : (this.height-2)*percentage,
		},500,"linear");
	}
});

/*	HexGrid Class
*
*	Object containing grid and hexagons DOM element and methods concerning the whole grid
*	Should only have one instance during the game.
*
*/
var HexGrid = Class.create({

	/*	Attributes
	*
	*	NOTE : attributes and variables starting with $ are jquery element
	*	and jquery function can be called dirrectly from them.
	*
	*	//Jquery attributes
	*	$display : 		Grid container
	*	$creatureW : 	Creature Wrapper container
	*	$inptHexsW : 	Input Hexagons container
	*	$dispHexsW : 	Display Hexagons container
	*	$overHexsW : 	Overlay Hexagons container
	*	$allInptHex : 	Shortcut to all input hexagons DOM elements (for input events)
	*	$allDispHex : 	Shortcut to all display hexagons DOM elements (to change style of hexagons)
	*
	*	//Normal attributes
	*	hexs : 				Array : 	Contain all hexs in row arrays (hexs[y][x])
	*	lastClickedHex : 	Hex : 		Last hex clicked!
	*
	*/


	/*	Constructor
	*
	* 	Create attributes and populate JS grid with Hex objects
	*
	*/
	initialize: function(opts) {
		defaultOpt = {
			nbrRow  		: 9,
			nbrHexsPerRow 	: 16,
			firstRowFull	: false,
		}

		opts = $j.extend(defaultOpt,opts);

		this.hexs 				= new Array(); // Hex Array
		this.traps 				= new Array(); // Traps Array
		this.allHexs			= new Array(); // All hexs
		this.lastClickedHex 	= []; // Array of hexagons containing last calculated pathfinding

		this.display 			= G.Phaser.add.group(undefined,"displayGrp");
		this.display.x = 230;
		this.display.y = 380;

		this.gridGroup 			= G.Phaser.add.group(this.display,"gridGrp");
		this.gridGroup.scale.set(1, .75);

		this.trapGroup			= G.Phaser.add.group(this.gridGroup ,"trapGrp");
		this.trapGroup.x = -10;
		this.dispHexsGroup		= G.Phaser.add.group(this.gridGroup ,"dispHexsGrp");
		this.overHexsGroup		= G.Phaser.add.group(this.gridGroup, "overHexsGrp");
		this.dropGroup 			= G.Phaser.add.group(this.display, "dropGrp");
		this.creatureGroup 		= G.Phaser.add.group(this.display, "creaturesGrp");
		this.inptHexsGroup		= G.Phaser.add.group(this.gridGroup, "inptHexsGrp");

		// Populate grid
		for (var row = 0; row < opts.nbrRow; row++) {
			this.hexs.push(new Array());
			for (var hex = 0; hex < opts.nbrHexsPerRow; hex++) {
				if( hex == opts.nbrHexsPerRow-1 ) {
					if( row % 2 == 0 && !opts.firstRowFull ) continue;
					if( row % 2 == 1 && opts.firstRowFull ) continue;
				}
				this.hexs[row][hex] = new Hex(hex,row,this);
				this.allHexs.push(this.hexs[row][hex]);
			};
		};

		this.selectedHex = this.hexs[0][0];
	},

	querySelf: function(o){
		var defaultOpt = {
			fnOnConfirm : function(crea,args) {},
			fnOnSelect : function(crea,args) {
				crea.hexagons.each(function() {
					this.overlayVisualState("creature selected player"+this.creature.team);
				});
			},
			fnOnCancel : function() {G.activeCreature.queryMove()},
			args : {},
			confirmText : "Confirm",
			id : G.activeCreature.id
		};

		o = $j.extend(defaultOpt,o);

		//o.fnOnConfirm(G.activeCreature,o.args); // Autoconfirm

		G.activeCreature.hint(o.confirmText,"confirm");

		this.queryHexs({
			fnOnConfirm : function(hex,args){args.opt.fnOnConfirm(G.activeCreature,args.opt.args);},
			fnOnSelect : function(hex,args){args.opt.fnOnSelect(G.activeCreature,args.opt.args);},
			fnOnCancel : function(hex,args){args.opt.fnOnCancel(G.activeCreature,args.opt.args);},
			args : {opt : o},
			hexs : G.activeCreature.hexagons,
			hideNonTarget : true,
			id : o.id
		});
	},

	/* 	queryDirection(o)
	*
	*	Shortcut to queryChoice with specific directions
	*
	*	fnOnSelect : 		Function : 	Function applied when clicking on one of the available hexs.
	*	fnOnConfirm : 		Function : 	Function applied when clicking again on the same hex.
	*	fnOnCancel : 		Function : 	Function applied when clicking a non reachable hex
	*	team : 				Integer : 	0 = ennemies, 1 = allies, 2 = same team, 3 = both
	*	requireCreature : 	Boolean : 	Disable a choice if it does not contain a creature matching the team argument
	* 	args : 				Object : 	Object given to the events function (to easily pass variable for these function)
	*/
	queryDirection: function(o) {
		var defaultOpt = {
			team : 0,
			id : 0,
			flipped : false,
			x : 0,
			y : 0,
			hexsDashed : [],
			directions : [1,1,1,1,1,1],
			includeCrea : true,
			stopOnCreature : true,
			distance : 0,
			sourceCreature : undefined,
		};

		o = $j.extend(defaultOpt,o);

		// This is alway true
		o.isDirectionsQuery = true;

		// Clean Direction
		G.grid.forEachHexs(function() { this.direction = -1; });

		var choices = []

		for (var i = 0; i < o.directions.length; i++) {
			if(!!o.directions[i]){
				var dir = []
				var fx = 0

				if( o.sourceCreature instanceof Creature ) {
					if( (!o.sourceCreature.player.flipped && i>2) || (o.sourceCreature.player.flipped && i<3) ) {
						fx =  -1*(o.sourceCreature.size-1);
					}
				}

				switch(i) {
					case 0: // Upright
						dir = G.grid.getHexMap(o.x+fx,o.y-8,0,o.flipped,diagonalup).reverse();
						break;
					case 1: // StraitForward
						dir = G.grid.getHexMap(o.x+fx,o.y,0,o.flipped,straitrow);
						break;
					case 2: // Downright
						dir = G.grid.getHexMap(o.x+fx,o.y,0,o.flipped,diagonaldown);
						break;
					case 3: // Downleft
						dir = G.grid.getHexMap(o.x+fx,o.y,-4,o.flipped,diagonalup);
						break;
					case 4: // StraitBackward
						dir = G.grid.getHexMap(o.x+fx,o.y,0,!o.flipped,straitrow);
						break;
					case 5: // Upleft
						dir = G.grid.getHexMap(o.x+fx,o.y-8,-4,o.flipped,diagonaldown).reverse();
						break;
					default:
						break;
				}

				if( o.distance > 0 ) dir = dir.slice(0,o.distance+1);

				dir.each(function() {
					this.direction = (o.flipped)?5-i:i;
					if(o.stopOnCreature) o.hexsDashed.push(this);
				});

				dir.filterCreature(o.includeCrea,o.stopOnCreature,o.id,o.team);

				if(dir.length==0) continue;

				if( o.stopOnCreature && o.includeCrea && (i==1 || i==4)){ // Only straight direction
					if(dir.last().creature instanceof Creature)
						dir = dir.concat(dir.last().creature.hexagons); // Add full creature
				}

				dir.each(function() { o.hexsDashed.removePos(this); });

				choices.push(dir);
			}
		};

		o.choices = choices;

		G.grid.queryChoice(o);
	},


	/*
	*	queryChoice(o)
	*
	*	fnOnSelect : 		Function : 	Function applied when clicking on one of the available hexs.
	*	fnOnConfirm : 		Function : 	Function applied when clicking again on the same hex.
	*	fnOnCancel : 		Function : 	Function applied when clicking a non reachable hex
	*	team : 				Integer : 	0 = ennemies, 1 = allies, 2 = same team, 3 = both
	*	requireCreature : 	Boolean : 	Disable a choice if it does not contain a creature matching the team argument
	* 	args : 				Object : 	Object given to the events function (to easily pass variable for these function)
	*/
	queryChoice: function(o) {
		var defaultOpt = {
			fnOnConfirm : function(choice,args) { G.activeCreature.queryMove(); },
			fnOnSelect : function(choice,args) {
				choice.each(function() {
					if(this.creature instanceof Creature) {
						this.overlayVisualState("creature selected player"+this.creature.team);
					}else{
						this.displayVisualState("adj");
					}

				});
			},
			fnOnCancel : function(hex,args) {G.activeCreature.queryMove()},
			team : 0,
			requireCreature : 1,
			id : 0,
			args : {},
			flipped : false,
			choices : [],
			hexsDashed : [],
			isDirectionsQuery : false,
		};

		o = $j.extend(defaultOpt,o);

		var hexs = [];
		for (var i = 0; i < o.choices.length; i++) {
			var validChoice = true;

			if(o.requireCreature) {
				validChoice = false;
				// Search each hex for a creature that matches the team argument
				for (var j = 0; j < o.choices[i].length; j++) {
					if( o.choices[i][j].creature instanceof Creature && o.choices[i][j].creature!=o.id ) {
						var creaSource = G.creatures[o.id];
						var creaTarget = o.choices[i][j].creature;

						var isAllie = ( creaSource.team%2 == creaTarget.team%2 );
						switch(o.team) {
							case 0: // Ennemies
								if(creaSource.team%2!=creaTarget.team%2) validChoice = true;
								break;
							case 1: // Allies
								if(creaSource.team%2==creaTarget.team%2) validChoice = true;
								break;
							case 2: // Same team
								if(creaSource.team==creaTarget.team) validChoice = true;
								break;
							case 3: // Both
								validChoice = true;
								break;
						}
					}
				}
			}

			if(validChoice) hexs = hexs.concat(o.choices[i]);
			else if(o.isDirectionsQuery) {
				G.grid.forEachHexs(function() {
					if(o.choices[i][0].direction==this.direction)
						o.hexsDashed.removePos(this);
				});
			}
		};

		this.queryHexs({
			fnOnConfirm : function(hex,args) {
				// Determine which set of hexs (choice) the hex is part of
				for (var i = 0; i < args.opt.choices.length; i++) {
					for (var j = 0; j < args.opt.choices[i].length; j++) {
						if(hex.pos==args.opt.choices[i][j].pos) {
							args.opt.args.direction = hex.direction;
							args.opt.fnOnConfirm(args.opt.choices[i],args.opt.args);
							break;
						}
					};
				};
			},
			fnOnSelect : function(hex,args) {
				// Determine which set of hexs (choice) the hex is part of
				for (var i = 0; i < args.opt.choices.length; i++) {
					for (var j = 0; j < args.opt.choices[i].length; j++) {
						if(hex.pos==args.opt.choices[i][j].pos) {
							args.opt.args.direction = hex.direction;
							args.opt.fnOnSelect(args.opt.choices[i],args.opt.args);
							break;
						}
					};
				};
			},
			fnOnCancel : o.fnOnCancel,
			args : {opt : o},
			hexs : hexs,
			hexsDashed : o.hexsDashed,
			flipped : o.flipped,
			hideNonTarget : true,
			id : o.id
		});
	},

	/* 	queryCreature(o)
	*
	*	fnOnSelect : 	Function : 	Function applied when clicking on one of the available hexs.
	*	fnOnConfirm : 	Function : 	Function applied when clicking again on the same hex.
	*	fnOnCancel : 	Function : 	Function applied when clicking a non reachable hex
	*	team : 			Integer : 	0 = ennemies, 1 = allies, 2 = same team, 3 = both
	*	id : 			Integer : 	Creature ID
	* 	args : 			Object : 	Object given to the events function (to easily pass variable for these function)
	*/
	queryCreature: function(o){

		var defaultOpt = {
			fnOnConfirm : function(crea,args) { G.activeCreature.queryMove(); },
			fnOnSelect : function(crea,args) { crea.tracePosition({ overlayClass: "creature selected player"+crea.team }); },
			fnOnCancel : function(hex,args) {G.activeCreature.queryMove()},
			optTest : function(crea) { return true; },
			args : {},
			hexs : [],
			hexsDashed : [],
			flipped : false,
			id : 0,
			team : 0,
		};

		o = $j.extend(defaultOpt,o);

		// Exclude everything but the creatures
		o.hexs.filter(function() {
			if( this.creature instanceof Creature && this.creature.id!=o.id ) {

				if( !o.optTest(this) ) return false;

				var creaSource = G.creatures[o.id];
				var creaTarget = this.creature;

				var isAllie = creaSource.isAlly( creaTarget.team );
				switch(o.team){
					case 0: // Ennemies
						if( !isAllie ) return true;
						break;
					case 1: // Allies
						if( isAllie ) return true;
						break;
					case 2: // Same team
						if( creaSource.team==creaTarget.team ) return true;
						break;
					case 3: // Both
						return true;
						break;
				}
			}
			return false;
		});

		var extended = [];
		o.hexs.each(function() { extended = extended.concat(this.creature.hexagons); });

		o.hexs = extended;

		this.queryHexs({
			fnOnConfirm : function(hex,args) {
				var crea = hex.creature;
				args.opt.fnOnConfirm(crea,args.opt.args);
			},
			fnOnSelect : function(hex,args) {
				var crea = hex.creature;
				args.opt.fnOnSelect(crea,args.opt.args);
			},
			fnOnCancel : o.fnOnCancel,
			args : {opt : o},
			hexs : o.hexs,
			hexsDashed : o.hexsDashed,
			flipped : o.flipped,
			hideNonTarget : true,
			id : o.id
		});

	},

	redoLastQuery: function() {
		this.queryHexs(this.lastQueryOpt);
	},


	/*	queryHexs(x, y, distance, size)
	*
	*	fnOnSelect : 	Function : 	Function applied when clicking on one of the available hexs.
	*	fnOnConfirm : 	Function : 	Function applied when clicking again on the same hex.
	*	fnOnCancel : 	Function : 	Function applied when clicking a non reachable hex
	* 	args : 			Object : 	Object given to the events function (to easily pass variable for these function)
	*	hexs : 			Array : 	Reachable hexs
	*/
	queryHexs: function(o) {

		var defaultOpt = {
			fnOnConfirm : function(hex,args) { G.activeCreature.queryMove(); },
			fnOnSelect : function(hex,args) {
				G.activeCreature.faceHex(hex,undefined,true);
				hex.overlayVisualState("creature selected player"+G.activeCreature.team);
			},
			fnOnCancel : function(hex,args) {G.activeCreature.queryMove()},
			args : {},
			hexs : [],
			hexsDashed : [],
			size : 1,
			id : 0,
			flipped : false,
			hideNonTarget : false,
			ownCreatureHexShade : false,
		};

		o = $j.extend(defaultOpt,o);

		G.grid.lastClickedHex = [];

		// Save the last Query
		this.lastQueryOpt = $j.extend({},o); // Copy Obj

		// Block all hexs
		this.forEachHexs(function() {
			this.unsetReachable();
			if(o.hideNonTarget) this.setNotTarget();
			else this.unsetNotTarget();
			if( o.hexsDashed.indexOf(this) != -1 ){
				this.displayVisualState("dashed");
			}else{
				this.cleanDisplayVisualState("dashed");
			}
		});

		// Cleanup
		if(G.grid.materialize_overlay) G.grid.materialize_overlay.alpha = 0;

		// Creature hex shade
		//this.$allOverHex.removeClass("ownCreatureHexShade");

		if( !o.ownCreatureHexShade ) {
			if( o.id instanceof Array ) {
				o.id.each(function() {
					G.creatures[this].hexagons.each(function() {
						this.overlayVisualState('ownCreatureHexShade')
					})
				});
			}else{
				if( o.id != 0 ) {
					G.creatures[o.id].hexagons.each(function() {
						this.overlayVisualState('ownCreatureHexShade')
					})
				}
			}
		}




		// Set reachable the given hexs
		o.hexs.each(function() {
			this.setReachable();
			if(o.hideNonTarget) this.unsetNotTarget();
		});


		// ONCLICK
		var onConfirmFn = function() {
			var hex = this;
			var y = hex.y;
			var x = hex.x;

			// Clear display and overlay
			G.grid.updateDisplay();

			// Not reachable hex
			if( !hex.reachable ) {
				G.grid.lastClickedHex = [];
				if(hex.creature instanceof Creature) { // If creature
					var crea = hex.creature;
					// G.UI.showCreature(crea.type,crea.team);
				}else{ // If nothing
					o.fnOnCancel(hex,o.args); // ON CANCEL
				}
			}

			// Reachable hex
			else{

				// Offset Pos
				var offset = (o.flipped) ? o.size-1 : 0 ;
				var mult = (o.flipped) ? 1 : -1 ; // For FLIPPED player
				var availablePos = false;

				for (var i = 0; i < o.size; i++) {	// Try next hexagons to see if they fits
					if( (x+offset-i*mult >= G.grid.hexs[y].length) || (x+offset-i*mult < 0) ) continue;
					if(G.grid.hexs[y][x+offset-i*mult].isWalkable(o.size,o.id)) {
						x += offset-i*mult;
						availablePos = true;
						break;
					}
				};

				// if(!availablePos){
				// 	//Prevent Bugs
				// 	console.log("nowhere to go");
				// 	return;
				// }

				hex = G.grid.hexs[y][x]; // New coords
				var clickedtHex = hex;

				G.activeCreature.faceHex(clickedtHex,undefined,true,true);

				if( clickedtHex != G.grid.lastClickedHex ) {
					G.grid.lastClickedHex = clickedtHex;
					// ONCLICK
					o.fnOnConfirm(clickedtHex,o.args);
				}else{
					// ONCONFIRM
					o.fnOnConfirm(clickedtHex,o.args);
				}

			}
		};


		// ONMOUSEOVER
		var onSelectFn = function() {
			var hex = this;
			var y = hex.y;
			var x = hex.x;

			// Xray
			G.grid.xray(hex);

			// Clear display and overlay
			G.grid.updateDisplay();
			G.UI.xrayQueue(-1);

			// Not reachable hex
			if( !hex.reachable ) {
				if(G.grid.materialize_overlay) G.grid.materialize_overlay.alpha = 0;
				if(hex.creature instanceof Creature) { // If creature
					var crea = hex.creature;
					crea.hexagons.each(function() {
						this.overlayVisualState("hover h_player"+crea.team);
					});
					G.UI.xrayQueue(crea.id);
				}else{ // If nothing
					hex.overlayVisualState("hover");
				}
			}else{ // Reachable hex


				//Offset Pos
				var offset = (o.flipped) ? o.size-1 : 0 ;
				var mult = (o.flipped) ? 1 : -1 ; // For FLIPPED player
				var availablePos = false;

				for (var i = 0; i < o.size; i++) {	// Try next hexagons to see if they fit
					if( (x+offset-i*mult >= G.grid.hexs[y].length) || (x+offset-i*mult < 0) ) continue;
					if(G.grid.hexs[y][x+offset-i*mult].isWalkable(o.size,o.id)) {
						x += offset-i*mult;
						availablePos = true;
						break;
					}
				};

				// if(!availablePos){
				// 	//Prevent Bugs
				// 	console.log("nowhere to go");
				// 	return;
				// }

				hex = G.grid.hexs[y][x]; // New coords
				o.fnOnSelect(hex,o.args);
			}
		};

		// ONRIGHTCLICK
		var onRightClickFn = function() {
			var hex = this;
			var y = hex.y;
			var x = hex.x;

			if(hex.creature instanceof Creature) { // If creature
				G.UI.showCreature( hex.creature.type, hex.creature.player.id );
			}else{
				G.UI.showCreature( G.activeCreature.type, G.activeCreature.player.id );
			}
		};


		this.forEachHexs(function() {
			this.onSelectFn	 = onSelectFn;
			this.onConfirmFn = onConfirmFn;
			this.onRightClickFn = onRightClickFn;
		});

	},


	/*	xray(hex)
	*
	*	hex : 	Hex : 	Hexagon to emphase
	*
	*	If hex contain creature call ghostOverlap for each creature hexs
	*
	*/
	xray: function(hex) {
		//Clear previous ghost
		G.creatures.each(function() {
			if( this instanceof Creature ) {
				this.xray(false);
			}
		});

		if(hex.creature instanceof Creature) {
			hex.creature.hexagons.each(function() { this.ghostOverlap(); });
		}else{
			hex.ghostOverlap();
		}
	},

	/*	hideCreatureHexs()
	*
	*	Ghosts hexs with creatures
	*
	*/
	hideCreatureHexs: function(except) {
		G.creatures.each(function() {
			if( this instanceof Creature ) {
				var hide = true;
				if(except instanceof Creature) {
					if(except.id == this.id) {
						hide = false;
					}
				}
				if(hide){
					// this.$display.addClass("ghosted_hidden");
					// this.$health.addClass("ghosted_hidden");
					for (var i = 0; i < this.size; i++) {
						if(this.hexagons[i]) {
							// this.hexagons[i].$display.hide();
							// this.hexagons[i].$overlay.hide();
						}
					}
				}
			}
		});
	},

	/*	showCreatureHexs()
	*
	*	Unghosts hexs with creatures
	*
	*/
	showCreatureHexs: function() {
		G.creatures.each(function() {
			if( this instanceof Creature ) {
				// this.display.overlayVisualState("ghosted_hidden");
				// this.health.overlayVisualState("ghosted_hidden");
				for (var i = 0; i < this.size; i++) {
					// if(this.hexagons[i]) {
					// 	this.hexagons[i].display.alpha = 1;
					// 	this.hexagons[i].overlay.alpha = 1;
					// }
				}
			}
		});
	},

	/*	clearHexViewAlterations()
	*
	*	Removes all hex view alterations like hideCreatureHexs used
	*	Squashes bugs by making sure all view alterations are removed
	*	on a change of ability/change of turn/etc
	*	If you make a new hex view alteration call the function to remove
	*	the alteration in here to ensure it gets cleared at the right time
	*
	*/
	clearHexViewAlterations: function() {
		this.showCreatureHexs();
	},

	/*	updateDisplay()
	*
	*	Update overlay hexs with creature positions
	*
	*/
	updateDisplay: function() {
		this.cleanDisplay();
		this.cleanOverlay();
		this.hexs.each(function() { this.each(function() {
			if( this.creature instanceof Creature ) {
				if( this.creature.id == G.activeCreature.id ) {
					this.overlayVisualState("active creature player"+this.creature.team);
					this.displayVisualState("creature player"+this.creature.team);
				}else{
					this.displayVisualState("creature player"+this.creature.team);
				}
			}
		}); });
	},


	/*	hexExists(y,x)
	*
	*	x : 	Integer : 	Coordinates to test
	*	y : 	Integer : 	Coordinates to test
	*
	*	Test if hex exists
	*
	*/
	hexExists: function(y,x) {
		if( (y>=0) && (y<this.hexs.length) ) {
			if( (x>=0) && (x<this.hexs[y].length) ) return true;
		}
		return false;
	},


	/*	isHexIn(hex,hexArray)
	*
	*	hex : 		Hex : 		Hex to look for
	*	hexarray : 	Array : 	Array of hexes to look for hex in
	*
	*	Test if hex exists inside array of hexes
	*
	*/
	isHexIn: function(hex,hexArray) {
		for (var i = 0; i < hexArray.length; i++) {
			if(hexArray[i].x == hex.x && hexArray[i].y == hex.y) {
				return true;
			}
		}
		return false;
	},


	/* 	getMovementRange(x,y,distance,size,id)
	*
	*	x : 		Integer : 	Start position
	*	y : 		Integer : 	Start position
	*	distance : 	Integer : 	Distance from the start position
	*	size : 		Integer : 	Creature size
	*	id : 		Integer : 	Creature ID
	*
	*	return : 	Array : 	Set of the reachable hexs
	*/
	getMovementRange: function(x,y,distance,size,id) {
		//	Populate distance (hex.g) in hexs by asking an impossible
		//	destination to test all hexagons
		this.cleanReachable(); // If not pathfinding will bug
		this.cleanPathAttr(true); // Erase all pathfinding datas
		astar.search(G.grid.hexs[y][x],new Hex(-2,-2,null),size,id);

		// Gather all the reachable hexs
		var hexs = [];
		this.forEachHexs(function() {
			// If not Too far or Impossible to reach
			if( this.g <= distance && this.g != 0 )
				hexs.push(G.grid.hexs[this.y][this.x]);
		});

		return hexs.extendToLeft(size);
	},


	/* 	getFlyingRange(x,y,distance,size,id)
	*
	*	x : 		Integer : 	Start position
	*	y : 		Integer : 	Start position
	*	distance : 	Integer : 	Distance from the start position
	*	size : 		Integer : 	Creature size
	*	id : 		Integer : 	Creature ID
	*
	*	return : 	Array : 	Set of the reachable hexs
	*/
	getFlyingRange: function(x,y,distance,size,id) {

		// Gather all the reachable hexs
		var hexs = G.grid.hexs[y][x].adjacentHex(distance);

		hexs.filter(function() {
			return this.isWalkable(size,id,true);
		});

		return hexs.extendToLeft(size);
	},


	/*	getHexMap(originx,originy,array)
	*
	*	array : 	Array : 	2-dimentions Array containing 0 or 1 (boolean)
	*	originx : 	Integer : 	Position of the array on the grid
	*	originy : 	Integer : 	Position of the array on the grid
	* 	offsetx : 	Integer : 	offset flipped for flipped players
	*	flipped : 	Boolean : 	If player is flipped or not
	*
	*	return : 	Array : 	Set of corresponding hexs
	*/
	getHexMap: function(originx,originy,offsetx,flipped,array) { // Heavy logic in here

		var array = array.slice(0); // Copy to not modify original
		originx += (flipped) ? 1-array[0].length-offsetx : -1+offsetx;
		var hexs = [];

		for (var y = 0; y < array.length; y++) {

			array[y] = array[y].slice(0); // Copy Row

			// Translating to flipped patern
			if(flipped && y%2!=0) { // Odd rows
				array[y].push(0);
			}

			// Translating even to odd row patern
			array[y].unshift(0);
			if(originy%2!=0 && y%2!=0) { // Even rows
				if(flipped)
					array[y].pop(); // Remove last element as the array will be parse backward
				else
					array[y].splice(0,1); // Remove first element
			}

			// Gathering hexs
			for (var x = 0; x < array[y].length; x++) {
				if( !!array[y][x] ){
					xfinal = (flipped) ? array[y].length-1-x : x ; // Parse the array backward for flipped player
					if( this.hexExists(originy+y,originx+xfinal) ) {
						hexs.push(this.hexs[originy+y][originx+xfinal]);
					}
				}
			}
		}

		return hexs;
	},


	showGrid : function(val){
		this.forEachHexs(function() {
			if(this.creature) this.creature.xray(val);
			if(this.drop) return;
			if(val) this.displayVisualState("showGrid");
			else this.cleanDisplayVisualState("showGrid");
		});
	},

	showMovementRange : function(id) {
		var crea = G.creatures[id];
		if( crea.canFly ) {
			var hexs = this.getFlyingRange(crea.x,crea.y,crea.stats.movement,crea.size,crea.id);
		}else{
			var hexs = this.getMovementRange(crea.x,crea.y,crea.stats.movement,crea.size,crea.id);
		}

		// Block all hexs
		this.forEachHexs(function() {
			this.unsetReachable();
		});

		// Set reachable the given hexs
		hexs.each(function() {
			this.setReachable();
		});

	},

	selectHexUp : function() {
		if( this.hexExists(this.selectedHex.y-1,this.selectedHex.x) ) {
			var hex =  this.hexs[this.selectedHex.y-1][this.selectedHex.x];
			this.selectedHex = hex;
			hex.onSelectFn();
		}
	},

	selectHexDown : function() {
		if( this.hexExists(this.selectedHex.y+1,this.selectedHex.x) ) {
			var hex =  this.hexs[this.selectedHex.y+1][this.selectedHex.x];
			this.selectedHex = hex;
			hex.onSelectFn();
		}
	},

	selectHexLeft : function() {
		if( this.hexExists(this.selectedHex.y,this.selectedHex.x-1) ) {
			var hex =  this.hexs[this.selectedHex.y][this.selectedHex.x-1];
			this.selectedHex = hex;
			hex.onSelectFn();
		}
	},

	selectHexRight : function() {
		if( this.hexExists(this.selectedHex.y,this.selectedHex.x+1) ) {
			var hex =  this.hexs[this.selectedHex.y][this.selectedHex.x+1];
			this.selectedHex = hex;
			hex.onSelectFn();
		}
	},

	confirmHex : function() {
		if(G.freezedInput) return;
		this.selectedHex.onConfirmFn();
	},

	orderCreatureZ : function() {

		var index = 0;

		for (var y = 0; y < this.hexs.length; y++) {
			for (var i = 1; i < G.creatures.length; i++) {

				if( G.creatures[i].y == y ) {
					console.log(G.creatures[i].grp);
					this.creatureGroup.remove( G.creatures[i].grp);
					this.creatureGroup.addAt( G.creatures[i].grp, index++ );
				}
			};

			if( this.materialize_overlay && this.materialize_overlay.posy == y) {
				this.creatureGroup.remove( this.materialize_overlay);
				this.creatureGroup.addAt( this.materialize_overlay, index++ );
			}
		};

		// G.grid.creatureGroup.sort();
	},

	//******************//
	//Shortcut functions//
	//******************//

	/*	forEachHexs(f)
	*
	*	f : Function : 	Function to execute
	*
	*	Execute f for each hexs
	*/
	forEachHexs: function(f) { this.hexs.each(function() { this.each(function() { f.apply(this); }); }); },

	/*	cleanPathAttr(includeG)
	*
	*	includeG : 	Boolean : 	Include hex.g attribute
	*
	*	Execute hex.cleanPathAttr() function for all the grid. Refer to the Hex class for more info
	*/
	cleanPathAttr: function(includeG) { this.hexs.each(function() { this.each(function() { this.cleanPathAttr(includeG); }); }); },

	/*	cleanReachable()
	*
	*	Execute hex.setReachable() function for all the grid. Refer to the Hex class for more info
	*/
	cleanReachable: function() { this.hexs.each(function() { this.each(function() { this.setReachable(); }); });	},

	/*	cleanDisplay(cssClass)
	*
	*	cssClass : 	String : 	Class(es) name(s) to remove with jQuery removeClass function
	*
	*	Shorcut for $allDispHex.removeClass()
	*/
	cleanDisplay: function(cssClass){
		this.forEachHexs(function() { this.cleanDisplayVisualState(cssClass) });
	},
	cleanOverlay: function(cssClass){
		this.forEachHexs(function() { this.cleanOverlayVisualState(cssClass) });
	},

	/*	previewCreature(creatureData)
	*
	*	pos : 			Object : 	Coordinates {x,y}
	*	creatureData : 	Object : 	Object containing info from the database (G.retreiveCreatureStats)
	*
	*	Draw a preview of the creature at the given coordinates
	*/
	previewCreature:function(pos,creatureData,player) {

		this.updateDisplay(); // Retrace players creatures

		var creaHex = this.hexs[pos.y][pos.x-(creatureData.size-1)];

		if( !G.grid.materialize_overlay ) { // If sprite does not exists
			// Adding sprite
			this.materialize_overlay = this.creatureGroup.create(0,0, creatureData.name+'_cardboard');
			this.materialize_overlay.anchor.setTo(0.5,1);
			this.materialize_overlay.posy = pos.y;
		}else{
			this.materialize_overlay.loadTexture(creatureData.name+'_cardboard');
			if( this.materialize_overlay.posy != pos.y) {
				this.materialize_overlay.posy = pos.y;
				this.orderCreatureZ();
			}
		}


		// Placing sprite
		this.materialize_overlay.x = creaHex.displayPos.x + ((!player.flipped) ? creatureData.display["offset-x"] : 90*creatureData.size-this.materialize_overlay.texture.width-creatureData.display["offset-x"]) +this.materialize_overlay.texture.width/2;
		this.materialize_overlay.y = creaHex.displayPos.y + creatureData.display["offset-y"] + this.materialize_overlay.texture.height;
		this.materialize_overlay.alpha = 0.5;

		if(player.flipped){
			this.materialize_overlay.scale.setTo(-1,1);
		}else{
			this.materialize_overlay.scale.setTo(1,1);
		}

		for (var i = 0; i < creatureData.size; i++) {
			this.hexs[pos.y][pos.x-i].overlayVisualState("creature selected player"+G.activeCreature.team);
		}
	},

	debugHex: function(hexs) {
		$j(".debug").remove();
		var i = 0;
		hexs.each(function() {
			var a = G.grid.$creatureW.append('<div class=".debug" id="debug'+i+'"></div>').children("#debug"+i);
			a.css({
				position: 'absolute',
				width: 20,
				height: 20,
				"background-color": 'yellow'
			});
			a.css(this.displayPos);
			i++;
		});
	}

}); // End of HexGrid Class


/*	Hex Class
*
*	Object containing hex informations, positions and DOM elements
*
*/
var Hex = Class.create({

	/*	Attributes
	*
	*	NOTE : attributes and variables starting with $ are jquery element
	*	and jquery function can be called dirrectly from them.
	*
	*	//Jquery attributes
	*	$display : 		Hex display element
	*	$overlay : 		Hex overlay element
	*	$input : 		Hex input element (bind controls on it)
	*
	*	//Normal attributes
	*	x : 			Integer : 	Hex coordinates
	*	y : 			Integer : 	Hex coordinates
	*	pos : 			Object : 	Pos object for hex comparison {x,y}
	*
	*	f : 			Integer : 	Pathfinding score f = g + h
	*	g : 			Integer : 	Pathfinding distance from start
	*	h : 			Integer : 	Pathfinding distance to finish
	*	pathparent : 	Hex : 		Pathfinding parent hex (the one you came from)
	*
	*	blocked : 		Boolean : 	Set to true if an obstacle it on it. Restrict movement.
	*	creature : 		Creature : 	Creature object , undefined if empty
	*	reachable : 	Boolean : 	Set to true if accessible by current action
	*
	*	displayPos : 	Object : 	Pos object to position creature with absolute coordinates {left,top}
	*
	*/


	/*	Constructor(x,y)
	*
	*	x : 			Integer : 	Hex coordinates
	*	y : 			Integer : 	Hex coordinates
	*
	*/
	initialize: function(x, y, grid) {

		this.x = x;
		this.y = y;
		this.pos = {x:x, y:y};
		this.coord = String.fromCharCode(64+this.y+1)+(this.x+1);

		// Pathfinding
		this.f = 0;
		this.g = 0;
		this.h = 0;
		this.pathparent = null;

		this.blocked = false;
		this.creature = undefined;
		this.reachable = true;
		this.direction = -1; // Used for queryDirection
		this.drop = undefined; // Drop items
		this.displayClasses = "";
		this.overlayClasses = "";

		this.displayPos = {y:y*78};
		this.displayPos.x = (y%2 == 0) ? 46+x*90 : x*90;

		this.originalDisplayPos = $j.extend({},this.displayPos);

		this.tween = null;

		if(grid){

			// 10px is the offset from the old version

			this.display 	= grid.dispHexsGroup.create(this.displayPos.x-10, this.displayPos.y, 'hex');
			this.display.alpha = 0;

			this.overlay 	= grid.overHexsGroup.create(this.displayPos.x-10, this.displayPos.y, 'hex');
			this.overlay.alpha = 0;

			this.input 		= grid.inptHexsGroup.create(this.displayPos.x-10, this.displayPos.y, 'input');
			this.input.inputEnabled = true;
			this.input.input.pixelPerfect = true;
			this.input.input.pixelPerfectAlpha = 1;
			this.input.input.useHandCursor = false;

			// Binding Events
			this.input.events.onInputOver.add(function() {
				if(G.freezedInput || G.UI.dashopen) return;
				G.grid.selectedHex = this;
				this.onSelectFn();
			}, this);

			this.input.events.onInputOut.add(function() {
				if(G.freezedInput || G.UI.dashopen) return;
				G.grid.redoLastQuery();
				G.grid.xray( new Hex(-1,-1) ); // Clear Xray
				G.UI.xrayQueue( -1 ); // Clear Xray Queue
			}, this);

			this.input.events.onInputUp.add(function(Sprite,Pointer) {
				if(G.freezedInput || G.UI.dashopen) return;
				switch (Pointer.button) {
					case 0:
						// Left mouse button pressed
						this.onConfirmFn();
						break;
					case 1:
						// Middle mouse button pressed
						break;
					case 2:
						// Right mouse button pressed
						this.onRightClickFn();
						break;
				}
			}, this);

		}

		this.displayPos.y = this.displayPos.y*.75+30;

		this.onSelectFn = function() {};
		this.onConfirmFn = function() {};
		this.onRightClickFn = function() {};

		this.trap = undefined;
	},


	/*	adjacentHex(distance)
	*
	*	distance : 	integer : 	Distance form the current hex
	*
	*	return : 	Array : 	Array containing Hexs
	*
	*	This function return an array containing all hexs of the grid
	* 	at the distance given of the current hex.
	*
	*/
	adjacentHex: function(distance) {
		var adjHex = [];
		for (var i = -distance; i <= distance; i++) {
			var deltaY = i;
			if(this.y%2 == 0) {
				// Evenrow
				for ( var deltaX = ( Math.ceil(Math.abs(i)/2) - distance );
				deltaX <= ( distance - Math.floor(Math.abs(i)/2) );
				deltaX++) {
					var x = this.x + deltaX;
					var y = this.y + deltaY;
					if(!(deltaY == 0 && deltaX == 0) && // Exclude current hex
					y < G.grid.hexs.length && y >= 0 &&	x < G.grid.hexs[y].length && x >=0){  // Exclude inexisting hexs
						adjHex.push(G.grid.hexs[y][x]);
					};
				};
			}else{
				// Oddrow
				for ( var deltaX = ( Math.floor(Math.abs(i)/2) - distance );
				deltaX <= ( distance - Math.ceil(Math.abs(i)/2) );
				deltaX++) {
					var x = this.x + deltaX;
					var y = this.y + deltaY;
					if(!(deltaY == 0 && deltaX == 0) && // Exclude current hex
					y < G.grid.hexs.length && y >= 0 && x < G.grid.hexs[y].length && x >=0){ // Exclude inexisting hexs
						adjHex.push(G.grid.hexs[y][x]);
					};
				};
			}
		};
		return adjHex;
	},


	/*	ghostOverlap()
	*
	*	add ghosted class to creature on hexs behind this hex
	*
	*/
	ghostOverlap: function() {
		for (var i = 1; i <= 3; i++) {
			if(this.y%2 == 0) {
				if(i == 1){
					for (var j = 0; j <= 1; j++) {
						if(G.grid.hexExists(this.y+i,this.x+j)) {
							if(G.grid.hexs[this.y+i][this.x+j].creature instanceof Creature){
								var ghostedCreature = G.grid.hexs[this.y+i][this.x+j].creature;
							}
						}
					}
				}else{
					if(G.grid.hexExists(this.y+i,this.x)) {
						if(G.grid.hexs[this.y+i][this.x].creature instanceof Creature){
							var ghostedCreature = G.grid.hexs[this.y+i][this.x].creature;
						}
					}
				}
			}else{
				if(i == 1){
					for (var j = 0; j <= 1; j++) {
						if(G.grid.hexExists(this.y+i,this.x-j)) {
							if(G.grid.hexs[this.y+i][this.x-j].creature instanceof Creature){
								var ghostedCreature = G.grid.hexs[this.y+i][this.x-j].creature;
							}
						}
					}
				}else{
					if(G.grid.hexExists(this.y+i,this.x)) {
						if(G.grid.hexs[this.y+i][this.x].creature instanceof Creature){
							var ghostedCreature = G.grid.hexs[this.y+i][this.x].creature;
						}
					}
				}
			}
			if(ghostedCreature instanceof Creature) {
				ghostedCreature.xray(true);
			}
		};
	},


	/*	cleanPathAttr(includeG)
	*
	*	includeG : 	Boolean : 	Set includeG to True if you change the start of the calculated path.
	*
	*	This function reset all the pathfinding attribute to
	*	0 to calculate new path to another hex.
	*
	*/
	cleanPathAttr: function(includeG) {
		this.f = 0;
		this.g = (includeG) ? 0 : this.g ;
		this.h = 0;
		this.pathparent = null;
	},


	/*	isWalkable(size, id)
	*
	*	size : 				Integer : 	Size of the creature
	*	id : 				Integer : 	ID of the creature
	* 	ignoreReachable : 	Boolean : 	Take into account the reachable property
	*
	*	return : 	Boolean : 	True if this hex is walkable
	*
	*/
	isWalkable: function(size,id,ignoreReachable) {
		var blocked = false;

		for (var i = 0; i < size; i++) {
			// For each Hex of the creature
			if( (this.x-i) >= 0 && (this.x-i) < G.grid.hexs[this.y].length ){ //if hex exists
				var hex = G.grid.hexs[this.y][this.x-i];
				// Verify if blocked. If it's blocked by one attribute, OR statement will keep it status
				blocked = blocked || hex.blocked ;
				if(!ignoreReachable){ blocked = blocked || !hex.reachable ; }
				if(hex.creature instanceof Creature){

					if( id instanceof Array ) {
						var isNotMovingCreature = ( id.indexOf(hex.creature.id) == -1);
					}else{
						var isNotMovingCreature = ( hex.creature.id != id );
					}

					blocked = blocked || isNotMovingCreature; // Not blocked if this block contains the moving creature
				}

			}else{
				// Blocked by grid boundaries
				blocked = true;
			}
		};
		return !blocked; // Its walkable if it's NOT blocked
	},


	/*	setBlocked()
	*
	*	Set Hex.blocked to True for this hex and change $display class
	*
	*/
	setBlocked: function() {
		this.blocked = true;
		this.updateStyle();
	},


	/*	unsetBlocked()
	*
	*	Set Hex.blocked to False for this hex and change $display class
	*
	*/
	unsetBlocked: function() {
		this.blocked = false;
		this.updateStyle();
	},


	/*	overlayVisualState
	*
	*	Change the appearance of the overlay hex
	*
	*/
	overlayVisualState: function(classes) {
		classes=(classes)?classes:"";
		this.overlayClasses += " "+classes+" ";
		this.updateStyle();
	},

	/*	displayVisualState
	*
	*	Change the appearance of the display hex
	*
	*/
	displayVisualState: function(classes) {
		classes=(classes)?classes:"";
		this.displayClasses += " "+classes+" ";
		this.updateStyle();
	},

	/*	cleanOverlayVisualState
	*
	*	Clear the appearance of the overlay hex
	*
	*/
	cleanOverlayVisualState: function(classes) {
		var classes = classes || "creature weakDmg active moveto selected hover h_player0 h_player1 h_player2 h_player3 player0 player1 player2 player3";

		var a = classes.split(' ');
		for (var i = 0; i < a.length; i++) {
			var regex = new RegExp("\\b"+a[i]+"\\b", 'g');
			this.overlayClasses = this.overlayClasses.replace(regex,'');
		};

		this.updateStyle();
	},

	/*	cleanDisplayVisualState
	*
	*	Clear the appearance of the display hex
	*
	*/
	cleanDisplayVisualState: function(classes){
		classes = classes || "adj hover creature player0 player1 player2 player3";

		var a = classes.split(' ');
		for (var i = 0; i < a.length; i++) {
			var regex = new RegExp("\\b"+a[i]+"\\b", 'g');
			this.displayClasses = this.displayClasses.replace(regex,'');
		};

		this.updateStyle();
	},


	/*	setReachable()
	*
	*	Set Hex.reachable to True for this hex and change $display class
	*
	*/
	setReachable: function() {
		this.reachable = true;
		this.input.input.useHandCursor = true;
		this.updateStyle();
	},

	/*	unsetReachable()
	*
	*	Set Hex.reachable to False for this hex and change $display class
	*
	*/
	unsetReachable: function() {
		this.reachable = false;
		this.input.input.useHandCursor = false;
		this.updateStyle();
	},


	unsetNotTarget: function() {
		this.displayClasses = this.displayClasses.replace(/\bhidden\b/g,'');
		this.updateStyle();
	},

	setNotTarget: function() {
		this.displayClasses += " hidden ";
		this.updateStyle();
	},

	updateStyle: function() {

		// Display Hex

		var targetAlpha = 0;

		targetAlpha = this.reachable || !!this.displayClasses.match(/creature/g);
		targetAlpha = !this.displayClasses.match(/hidden/g) && targetAlpha;
		targetAlpha = !!this.displayClasses.match(/showGrid/g) || targetAlpha;
		targetAlpha = !!this.displayClasses.match(/dashed/g) || targetAlpha;

		if(this.displayClasses.match(/0|1|2|3/)){
			var p = this.displayClasses.match(/0|1|2|3/);
			this.display.loadTexture("hex_p"+p);
			G.grid.dispHexsGroup.bringToTop(this.display);
		}else if(this.displayClasses.match(/adj/)){
			this.display.loadTexture("hex_path");
		}else if(this.displayClasses.match(/dashed/)){
			this.display.loadTexture("hex_dashed");
		}else{
			this.display.loadTexture("hex");
		}

		this.display.alpha = targetAlpha;
		// Too slow
		// if(this.display.alpha != targetAlpha){
		// 	if(this.tween) this.tween.stop();
		// 	this.tween = G.Phaser.add.tween(this.display)
		// 		.to({alpha:targetAlpha-0}, 250, Phaser.Easing.Linear.None)
		// 		.start();
		// }


		// Display Coord
		if( !!this.displayClasses.match(/showGrid/g) ) {
			if( !(this.coordText && this.coordText.exists) ) {
				this.coordText = G.Phaser.add.text(this.originalDisplayPos.x+45, this.originalDisplayPos.y+63, this.coord, {font: "30pt Play", fill: "#000000", align: "center"});
				this.coordText.anchor.setTo(0.5, 0.5);
				G.grid.overHexsGroup.add(this.coordText);
			}
		}else if(this.coordText && this.coordText.exists) {
			this.coordText.destroy();
		}


		// Overlay Hex

		var targetAlpha = 0;

		targetAlpha = !!this.overlayClasses.match(/hover|creature/g);

		if( this.overlayClasses.match(/0|1|2|3/) ) {
			var p = this.overlayClasses.match(/0|1|2|3/);

			if( this.overlayClasses.match(/hover/) ) {
				this.overlay.loadTexture("hex_hover_p"+p);
			}else{
				this.overlay.loadTexture("hex_p"+p);
			}
			G.grid.overHexsGroup.bringToTop(this.overlay);
		}else{
			this.overlay.loadTexture("hex");
		}

		this.overlay.alpha = targetAlpha;

	},

	//---------TRAP FUNCTION---------//

	createTrap: function(type, effects, owner, opt) {
		if(!!this.trap) this.destroyTrap();
		this.trap = new Trap(this.x,this.y,type,effects,owner,opt);
		return this.trap;
	},

	activateTrap: function(trigger, target) {
		if(!this.trap) return;
		this.trap.effects.each(function() {
			if( trigger.test(this.trigger) &&  this.requireFn() ) {
				G.log("Trap triggered");
				this.activate(target);
			}
		});
	},

	destroyTrap: function() {
		if(!this.trap) return;
		delete G.grid.traps[this.trap.id];
		this.trap.destroy();
		delete this.trap;
	},

	//---------DROP FUNCTION---------//

	pickupDrop: function(crea){
		if(!this.drop) return;
		this.drop.pickup(crea);
	},

}); // End of Hex Class


/*	Trap Class
*
*	Object containing hex informations, positions and DOM elements
*
*/
var Trap = Class.create({

	/*	Constructor(x,y)
	*
	*	x : 			Integer : 	Hex coordinates
	*	y : 			Integer : 	Hex coordinates
	*
	*/
	initialize: function(x, y, type, effects, owner, opt) {
		this.hex 		= G.grid.hexs[y][x];
		this.type 		= type;
		this.effects 	= effects;
		this.owner 		= owner;

		this.creationTurn = G.turn;

		var o = {
			turnLifetime : 0,
			fullTurnLifetime : false,
			ownerCreature : undefined, // Needed for fullTurnLifetime
		};

		$j.extend(this,o,opt);

		// Register
		G.grid.traps.push(this);
		this.id 		= trapID++;
		this.hex.trap 	= this;

		for (var i = this.effects.length - 1; i >= 0; i--) {
			this.effects[i].trap = this;
		};

		this.display = G.grid.trapGroup.create(this.hex.originalDisplayPos.x, this.hex.originalDisplayPos.y, 'trap_'+type);

	},

	destroy: function() {
		this.display.destroy();

		// Unregister
		var i = G.grid.traps.indexOf(this);
		G.grid.traps.splice(i,1);
		this.hex.trap 	= undefined;
		delete this;
	},

	hide: function(duration, timer) {
		timer = timer-0; // Avoid undefined
		duration = duration-0; // Avoid undefined
		G.Phaser.add.tween(this.display).to({alpha:0}, duration, Phaser.Easing.Linear.None)
	},

	show: function(duration) {
		duration = duration-0; // Avoid undefined
		G.Phaser.add.tween(this.display).to({alpha:1}, duration, Phaser.Easing.Linear.None)
	},

});


/*	Array Prototypes
*
*	Extend Array type for more flexibility and ease of use
*
*/

	/*	findPos(obj)
	*
	*	obj : 		Object : 	Anything with pos attribute. Could be Hex of Creature.
	*
	*	return : 	Object : 	Object found in the array. False if nothing
	*
	*	Find an object in the current Array based on its pos attribute
	*
	*/
	Array.prototype.findPos = function(obj) {
	  for(var i=0;i<this.length;i++) {
		if(this[i].pos == obj.pos) { return this[i]; }
	  }
	  return false;
	};


	/*	removePos(obj)
	*
	*	obj : 		Object : 	Anything with pos attribute. Could be Hex of Creature.
	*
	*	return : 	Boolean : 	True if success. False if failed.
	*
	*	Remove an object in the current Array based on its pos attribute
	*
	*/
	Array.prototype.removePos = function(obj) {
	  for(var i=0;i<this.length;i++) {
		if(this[i].pos == obj.pos) { this.splice(i,1); return true;}
	  }
	  return false;
	};


	/*	each(f)
	*
	*	f : 		Function : 	Function to apply to each array's entry
	*
	*	Apply a function for each entries of the array
	*
	*/
	Array.prototype.each = function(f) {
		if(!f.apply) return;
		for(var i=0;i<this.length;i++) {
			f.apply(this[i], [i, this]);
		}
		return this;
	};


	/*	filter(f)
	*
	*	f : 		Function : 	Function to apply to each array's entry
	*
	*	If f return false remove the element from the array
	*
	*/
	Array.prototype.filter = function(f) {
		if(!f.apply) return;
		for(var i=0;i<this.length;i++) {
			if( !f.apply(this[i], [i, this]) ) {
				this.splice(i,1);
				i--;
			}
		}
		return this;
	};

	/*	filterCreature(hexs,reverse,includeCrea,stopOnCreature)
	*
	*	includeCrea : 		Boolean : 	Add creature hexs to the array
	*	stopOnCreature : 	Boolean : 	Cut the array when finding a creature
	*	id : 				Integer : 	Creature id to remove
	*
	*	return : 		Array : 	filtered array
	*/
	Array.prototype.filterCreature = function(includeCrea,stopOnCreature,id) {
		var creaHexs = [];

		for (var i = 0; i < this.length; i++) {
		 	if(this[i].creature instanceof Creature) {
		 		if(!includeCrea || this[i].creature.id==id) {
		 			if(this[i].creature.id==id) {
		 				this.splice(i,1);
		 				i--;
		 				continue;
		 			}else{
		 				this.splice(i,1);
		 				i--;
		 			}
		 		}else{
		 			creaHexs = creaHexs.concat(this[i].creature.hexagons);
		 		}
		 		if(stopOnCreature){
		 			this.splice(i+1,99);
		 			break;
		 		}
		 	}
		}
		return this.concat(creaHexs);
	},


	/*	extendToLeft(size)
	*
	*	size : 		Integer : 	Size to extend
	*
	*	return : 	Array : 	The hex array with all corresponding hexs at the left
	*/
	Array.prototype.extendToLeft = function(size) {
		var ext = [];
		for(var i=0;i<this.length;i++) {
			for (var j = 0; j < size; j++) {
				// NOTE : This code produce array with doubles.
				if( G.grid.hexExists(this[i].y,this[i].x-j) )
					ext.push(G.grid.hexs[this[i].y][this[i].x-j]);
			}
		}
		return ext;
	};


	/*	extendToLeft(size)
	*
	*	size : 		Integer : 	Size to extend
	*
	*	return : 	Array : 	The hex array with all corresponding hexs at the left
	*/
	Array.prototype.extendToRight = function(size) {
		var ext = [];
		for(var i=0;i<this.length;i++) {
			for (var j = 0; j < size; j++) {
				// NOTE : This code produces array with doubles.
				if( G.grid.hexExists(this[i].y,this[i].x+j) )
					ext.push(G.grid.hexs[this[i].y][this[i].x+j]);
			}
		}
		return ext;
	};



	/*	each()
	*
	*	Return the last element of the array
	*
	*/
	Array.prototype.last = function() {
		return this[this.length-1];
	};


	/*	orderByInitiative()
	*
	*	Used by game.queue
	*	TODO need a separate class to not add confusion
	*
	*/
	Array.prototype.orderByInitiative = function() {
		// Bubble sorting
	    var swapped;
	    do {
	        swapped = false;
	        for (var i=0; i < this.length-1; i++) {
	            if ( this[i].getInitiative() < this[i+1].getInitiative() ) {
	                var temp = this[i];
	                this[i] = this[i+1];
	                this[i+1] = temp;
	                swapped = true;
	            }
	        }
	    } while (swapped);
	};


//-----------------//
// USEFUL MATRICES //
//-----------------//

diagonalup = 	 [[ 0,0,0,0,1 ], // Origin line
				 [ 0,0,0,0,1 ],
				  [ 0,0,0,1,0 ],
				 [ 0,0,0,1,0 ],
				  [ 0,0,1,0,0 ],
				 [ 0,0,1,0,0 ],
				  [ 0,1,0,0,0 ],
				 [ 0,1,0,0,0 ],
				  [ 1,0,0,0,0 ]];
diagonalup.origin = [4,0];

diagonaldown = 	 [[ 1,0,0,0,0 ], // Origin line
				 [ 0,1,0,0,0 ],
				  [ 0,1,0,0,0 ],
				 [ 0,0,1,0,0 ],
				  [ 0,0,1,0,0 ],
				 [ 0,0,0,1,0 ],
				  [ 0,0,0,1,0 ],
				 [ 0,0,0,0,1 ],
				  [ 0,0,0,0,1 ]];
diagonaldown.origin = [0,0];

straitrow = 	[[ 1,1,1, 1,1,1, 1,1,1, 1,1,1, 1,1,1, 1 ]]; // Origin line
straitrow.origin = [0,0];


bellowrow = 	[  [ 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0 ], // Origin line
				  [ 0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1 ]];
bellowrow.origin = [0,0];

frontnback2hex = [	 [0,0,0,0],
					[0,1,0,1],
					 [1,0,0,1], // Origin line
					[0,1,0,1]];
frontnback2hex.origin = [2,2];

frontnback3hex = [	 [0,0,0,0,0],
					[0,1,0,0,1],
					 [1,0,0,0,1], // Origin line
					[0,1,0,0,1]];
frontnback3hex.origin = [3,2];

front2hex 		= [	 [0,0,0,0],
					[0,0,0,1],
					 [0,0,0,1], // Origin line
					[0,0,0,1]];
front2hex.origin = [2,2];

inlinefront2hex = [	 [0,0,0,0],
					[0,0,0,0],
					 [0,0,0,1], // Origin line
					[0,0,0,0]];
inlinefront2hex.origin = [2,2];

inlineback2hex = [	 [0,0,0,0],
					[0,0,0,0],
					 [1,0,0,0], // Origin line
					[0,0,0,0]];
inlineback2hex.origin = [2,2];

inlinefrontnback2hex = [ [0,0,0,0],
						[0,0,0,0],
						 [1,0,0,1], // Origin line
						[0,0,0,0]];
inlinefrontnback2hex.origin = [2,2];

front1hex = [	 [0,0,0],
				[0,0,1],
				 [0,0,1], // Origin line
				[0,0,1]];
front1hex.origin = [1,2];

backtop1hex = [	 [0,0,0],
				[0,1,0],
				 [0,0,0], // Origin line
				[0,0,0]];
backtop1hex.origin = [1,2];

inlineback1hex = [	 [0,0,0],
					[0,0,0],
					 [1,0,0], // Origin line
					[0,0,0]];
inlineback1hex.origin = [1,2];

backbottom1hex = [	 [0,0,0],
					[0,0,0],
					 [0,0,0], // Origin line
					[0,1,0]];
backbottom1hex.origin = [1,2];

fronttop1hex = [ [0,0,0],
				[0,0,1],
				 [0,0,0], // Origin line
				[0,0,0]];
fronttop1hex.origin = [1,2];

inlinefront1hex = [	 [0,0,0],
					[0,0,0],
					 [0,0,1], // Origin line
					[0,0,0]];
inlinefront1hex.origin = [1,2];

frontbottom1hex = [	 [0,0,0],
					[0,0,0],
					 [0,0,0], // Origin line
					[0,0,1]];
frontbottom1hex.origin = [1,2];

/*
    json2.js
    2013-05-26

    Public Domain.

    NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.

    See http://www.JSON.org/js.html


    This code should be minified before deployment.
    See http://javascript.crockford.com/jsmin.html

    USE YOUR OWN COPY. IT IS EXTREMELY UNWISE TO LOAD CODE FROM SERVERS YOU DO
    NOT CONTROL.


    This file creates a global JSON object containing two methods: stringify
    and parse.

        JSON.stringify(value, replacer, space)
            value       any JavaScript value, usually an object or array.

            replacer    an optional parameter that determines how object
                        values are stringified for objects. It can be a
                        function or an array of strings.

            space       an optional parameter that specifies the indentation
                        of nested structures. If it is omitted, the text will
                        be packed without extra whitespace. If it is a number,
                        it will specify the number of spaces to indent at each
                        level. If it is a string (such as '\t' or '&nbsp;'),
                        it contains the characters used to indent at each level.

            This method produces a JSON text from a JavaScript value.

            When an object value is found, if the object contains a toJSON
            method, its toJSON method will be called and the result will be
            stringified. A toJSON method does not serialize: it returns the
            value represented by the name/value pair that should be serialized,
            or undefined if nothing should be serialized. The toJSON method
            will be passed the key associated with the value, and this will be
            bound to the value

            For example, this would serialize Dates as ISO strings.

                Date.prototype.toJSON = function (key) {
                    function f(n) {
                        // Format integers to have at least two digits.
                        return n < 10 ? '0' + n : n;
                    }

                    return this.getUTCFullYear()   + '-' +
                         f(this.getUTCMonth() + 1) + '-' +
                         f(this.getUTCDate())      + 'T' +
                         f(this.getUTCHours())     + ':' +
                         f(this.getUTCMinutes())   + ':' +
                         f(this.getUTCSeconds())   + 'Z';
                };

            You can provide an optional replacer method. It will be passed the
            key and value of each member, with this bound to the containing
            object. The value that is returned from your method will be
            serialized. If your method returns undefined, then the member will
            be excluded from the serialization.

            If the replacer parameter is an array of strings, then it will be
            used to select the members to be serialized. It filters the results
            such that only members with keys listed in the replacer array are
            stringified.

            Values that do not have JSON representations, such as undefined or
            functions, will not be serialized. Such values in objects will be
            dropped; in arrays they will be replaced with null. You can use
            a replacer function to replace those with JSON values.
            JSON.stringify(undefined) returns undefined.

            The optional space parameter produces a stringification of the
            value that is filled with line breaks and indentation to make it
            easier to read.

            If the space parameter is a non-empty string, then that string will
            be used for indentation. If the space parameter is a number, then
            the indentation will be that many spaces.

            Example:

            text = JSON.stringify(['e', {pluribus: 'unum'}]);
            // text is '["e",{"pluribus":"unum"}]'


            text = JSON.stringify(['e', {pluribus: 'unum'}], null, '\t');
            // text is '[\n\t"e",\n\t{\n\t\t"pluribus": "unum"\n\t}\n]'

            text = JSON.stringify([new Date()], function (key, value) {
                return this[key] instanceof Date ?
                    'Date(' + this[key] + ')' : value;
            });
            // text is '["Date(---current time---)"]'


        JSON.parse(text, reviver)
            This method parses a JSON text to produce an object or array.
            It can throw a SyntaxError exception.

            The optional reviver parameter is a function that can filter and
            transform the results. It receives each of the keys and values,
            and its return value is used instead of the original value.
            If it returns what it received, then the structure is not modified.
            If it returns undefined then the member is deleted.

            Example:

            // Parse the text. Values that look like ISO date strings will
            // be converted to Date objects.

            myData = JSON.parse(text, function (key, value) {
                var a;
                if (typeof value === 'string') {
                    a =
/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/.exec(value);
                    if (a) {
                        return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4],
                            +a[5], +a[6]));
                    }
                }
                return value;
            });

            myData = JSON.parse('["Date(09/09/2001)"]', function (key, value) {
                var d;
                if (typeof value === 'string' &&
                        value.slice(0, 5) === 'Date(' &&
                        value.slice(-1) === ')') {
                    d = new Date(value.slice(5, -1));
                    if (d) {
                        return d;
                    }
                }
                return value;
            });


    This is a reference implementation. You are free to copy, modify, or
    redistribute.
*/

/*jslint evil: true, regexp: true */

/*members "", "\b", "\t", "\n", "\f", "\r", "\"", JSON, "\\", apply,
    call, charCodeAt, getUTCDate, getUTCFullYear, getUTCHours,
    getUTCMinutes, getUTCMonth, getUTCSeconds, hasOwnProperty, join,
    lastIndex, length, parse, prototype, push, replace, slice, stringify,
    test, toJSON, toString, valueOf
*/


// Create a JSON object only if one does not already exist. We create the
// methods in a closure to avoid creating global variables.

if (typeof JSON !== 'object') {
    JSON = {};
}

(function () {
    'use strict';

    function f(n) {
        // Format integers to have at least two digits.
        return n < 10 ? '0' + n : n;
    }

    if (typeof Date.prototype.toJSON !== 'function') {

        Date.prototype.toJSON = function () {

            return isFinite(this.valueOf())
                ? this.getUTCFullYear()     + '-' +
                    f(this.getUTCMonth() + 1) + '-' +
                    f(this.getUTCDate())      + 'T' +
                    f(this.getUTCHours())     + ':' +
                    f(this.getUTCMinutes())   + ':' +
                    f(this.getUTCSeconds())   + 'Z'
                : null;
        };

        String.prototype.toJSON      =
            Number.prototype.toJSON  =
            Boolean.prototype.toJSON = function () {
                return this.valueOf();
            };
    }

    var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        gap,
        indent,
        meta = {    // table of character substitutions
            '\b': '\\b',
            '\t': '\\t',
            '\n': '\\n',
            '\f': '\\f',
            '\r': '\\r',
            '"' : '\\"',
            '\\': '\\\\'
        },
        rep;


    function quote(string) {

// If the string contains no control characters, no quote characters, and no
// backslash characters, then we can safely slap some quotes around it.
// Otherwise we must also replace the offending characters with safe escape
// sequences.

        escapable.lastIndex = 0;
        return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
            var c = meta[a];
            return typeof c === 'string'
                ? c
                : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
        }) + '"' : '"' + string + '"';
    }


    function str(key, holder) {

// Produce a string from holder[key].

        var i,          // The loop counter.
            k,          // The member key.
            v,          // The member value.
            length,
            mind = gap,
            partial,
            value = holder[key];

// If the value has a toJSON method, call it to obtain a replacement value.

        if (value && typeof value === 'object' &&
                typeof value.toJSON === 'function') {
            value = value.toJSON(key);
        }

// If we were called with a replacer function, then call the replacer to
// obtain a replacement value.

        if (typeof rep === 'function') {
            value = rep.call(holder, key, value);
        }

// What happens next depends on the value's type.

        switch (typeof value) {
        case 'string':
            return quote(value);

        case 'number':

// JSON numbers must be finite. Encode non-finite numbers as null.

            return isFinite(value) ? String(value) : 'null';

        case 'boolean':
        case 'null':

// If the value is a boolean or null, convert it to a string. Note:
// typeof null does not produce 'null'. The case is included here in
// the remote chance that this gets fixed someday.

            return String(value);

// If the type is 'object', we might be dealing with an object or an array or
// null.

        case 'object':

// Due to a specification blunder in ECMAScript, typeof null is 'object',
// so watch out for that case.

            if (!value) {
                return 'null';
            }

// Make an array to hold the partial results of stringifying this object value.

            gap += indent;
            partial = [];

// Is the value an array?

            if (Object.prototype.toString.apply(value) === '[object Array]') {

// The value is an array. Stringify every element. Use null as a placeholder
// for non-JSON values.

                length = value.length;
                for (i = 0; i < length; i += 1) {
                    partial[i] = str(i, value) || 'null';
                }

// Join all of the elements together, separated with commas, and wrap them in
// brackets.

                v = partial.length === 0
                    ? '[]'
                    : gap
                    ? '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']'
                    : '[' + partial.join(',') + ']';
                gap = mind;
                return v;
            }

// If the replacer is an array, use it to select the members to be stringified.

            if (rep && typeof rep === 'object') {
                length = rep.length;
                for (i = 0; i < length; i += 1) {
                    if (typeof rep[i] === 'string') {
                        k = rep[i];
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            } else {

// Otherwise, iterate through all of the keys in the object.

                for (k in value) {
                    if (Object.prototype.hasOwnProperty.call(value, k)) {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            }

// Join all of the member texts together, separated with commas,
// and wrap them in braces.

            v = partial.length === 0
                ? '{}'
                : gap
                ? '{\n' + gap + partial.join(',\n' + gap) + '\n' + mind + '}'
                : '{' + partial.join(',') + '}';
            gap = mind;
            return v;
        }
    }

// If the JSON object does not yet have a stringify method, give it one.

    if (typeof JSON.stringify !== 'function') {
        JSON.stringify = function (value, replacer, space) {

// The stringify method takes a value and an optional replacer, and an optional
// space parameter, and returns a JSON text. The replacer can be a function
// that can replace values, or an array of strings that will select the keys.
// A default replacer method can be provided. Use of the space parameter can
// produce text that is more easily readable.

            var i;
            gap = '';
            indent = '';

// If the space parameter is a number, make an indent string containing that
// many spaces.

            if (typeof space === 'number') {
                for (i = 0; i < space; i += 1) {
                    indent += ' ';
                }

// If the space parameter is a string, it will be used as the indent string.

            } else if (typeof space === 'string') {
                indent = space;
            }

// If there is a replacer, it must be a function or an array.
// Otherwise, throw an error.

            rep = replacer;
            if (replacer && typeof replacer !== 'function' &&
                    (typeof replacer !== 'object' ||
                    typeof replacer.length !== 'number')) {
                throw new Error('JSON.stringify');
            }

// Make a fake root object containing our value under the key of ''.
// Return the result of stringifying the value.

            return str('', {'': value});
        };
    }


// If the JSON object does not yet have a parse method, give it one.

    if (typeof JSON.parse !== 'function') {
        JSON.parse = function (text, reviver) {

// The parse method takes a text and an optional reviver function, and returns
// a JavaScript value if the text is a valid JSON text.

            var j;

            function walk(holder, key) {

// The walk method is used to recursively walk the resulting structure so
// that modifications can be made.

                var k, v, value = holder[key];
                if (value && typeof value === 'object') {
                    for (k in value) {
                        if (Object.prototype.hasOwnProperty.call(value, k)) {
                            v = walk(value, k);
                            if (v !== undefined) {
                                value[k] = v;
                            } else {
                                delete value[k];
                            }
                        }
                    }
                }
                return reviver.call(holder, key, value);
            }


// Parsing happens in four stages. In the first stage, we replace certain
// Unicode characters with escape sequences. JavaScript handles many characters
// incorrectly, either silently deleting them, or treating them as line endings.

            text = String(text);
            cx.lastIndex = 0;
            if (cx.test(text)) {
                text = text.replace(cx, function (a) {
                    return '\\u' +
                        ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
                });
            }

// In the second stage, we run the text against regular expressions that look
// for non-JSON patterns. We are especially concerned with '()' and 'new'
// because they can cause invocation, and '=' because it can cause mutation.
// But just to be safe, we want to reject all unexpected forms.

// We split the second stage into 4 regexp operations in order to work around
// crippling inefficiencies in IE's and Safari's regexp engines. First we
// replace the JSON backslash pairs with '@' (a non-JSON character). Second, we
// replace all simple value tokens with ']' characters. Third, we delete all
// open brackets that follow a colon or comma or that begin the text. Finally,
// we look to see that the remaining characters are only whitespace or ']' or
// ',' or ':' or '{' or '}'. If that is so, then the text is safe for eval.

            if (/^[\],:{}\s]*$/
                    .test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@')
                        .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']')
                        .replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {

// In the third stage we use the eval function to compile the text into a
// JavaScript structure. The '{' operator is subject to a syntactic ambiguity
// in JavaScript: it can begin a block or an object literal. We wrap the text
// in parens to eliminate the ambiguity.

                j = eval('(' + text + ')');

// In the optional fourth stage, we recursively walk the new structure, passing
// each name/value pair to a reviver function for possible transformation.

                return typeof reviver === 'function'
                    ? walk({'': j}, '')
                    : j;
            }

// If the text is not JSON parseable, then a SyntaxError is thrown.

            throw new SyntaxError('JSON.parse');
        };
    }
}());

var astar = {

	// Start and end must be Hex type
	search: function(start, end, creatureSize, creatureId) {
		var openList   = [];
		var closedList = [];
		openList.push(start);

		if(start == end) {
			//console.log("Same coordinates");
			return [];
		}
			
		while(openList.length > 0) {
					
			// Grab the lowest f(x) to process next
			var lowInd = 0;
			for(var i=0; i<openList.length; i++) {
				if(openList[i].f < openList[lowInd].f) { lowInd = i; }
			}
			var currentNode = openList[lowInd];
 
			// End case -- result has been found, return the traced path
			if( currentNode.pos == end.pos ) {
				var curr = currentNode;
				var ret = [];
				while(curr.pathparent) {
					ret.push(curr);
					curr = curr.pathparent;
				}
				G.grid.cleanPathAttr(false);
				return ret.reverse();
			}
 
			// Normal case -- move currentNode from open to closed, process each of its neighbors
			openList.removePos(currentNode);
			closedList.push(currentNode);
			var neighbors = currentNode.adjacentHex(1);
 			
			for(var i=0; i<neighbors.length;i++) {
				var neighbor = neighbors[i];

				if( closedList.findPos(neighbor) || !neighbor.isWalkable(creatureSize,creatureId) ) {
					// Not a valid node to process, skip to next neighbor
					continue;
				}
 
				// g score is the shortest distance from start to current node, we need to check if
				//	 the path we have arrived at this neighbor is the shortest one we have seen yet
				var gScore = currentNode.g + 1; // 1 is the distance from a node to it's neighbor
				var gScoreIsBest = false;
 
 
				if(!openList.findPos(neighbor)) {
					// This the the first time we have arrived at this node, it must be the best
					// Also, we need to take the h (heuristic) score since we haven't done so yet
 
					gScoreIsBest = true;
					neighbor.h = astar.heuristic(neighbor.pos, end.pos);
					openList.push(neighbor);
				}
				else if(gScore < neighbor.g) {
					// We have already seen the node, but last time it had a worse g (distance from start)
					gScoreIsBest = true;
				}
 
				if(gScoreIsBest) {
					// Found an optimal (so far) path to this node.	 Store info on how we got here and
					//	just how good it really is...
					neighbor.pathparent = currentNode;
					neighbor.g = gScore;
					neighbor.f = neighbor.g + neighbor.h;
					//neighbor.$display.children(".physical").text(neighbor.g); // Debug
				}
			}
		}
		G.grid.cleanPathAttr(false);
		// No result was found -- empty array signifies failure to find path
		return [];
	},

	heuristic: function(pos0, pos1) {
		// This is the Manhattan distance
		var d1 = Math.abs (pos1.x - pos0.x);
		var d2 = Math.abs (pos1.y - pos0.y);
		return 0; // Dijkstra algo "better" but slower
		//return d1 + d2; // Not good for range prediction
	},
};

/*
*
*	Abolished abilities
*
*/
G.abilities[7] =[

// 	First Ability: Burning Heart
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onDamage",

	// 	require() :
	require : function(damage){
		if( this.used ) return false;
		if( !this.testRequirements() ) return false;
		if( damage == undefined ) damage = {type:"target"}; // For the test function to work
		return true;
	},

	//	activate() :
	activate : function(damage){
		if(this.triggeredThisChain) return damage;

		var targets = this.getTargets(this.creature.adjacentHexs(1));
		this.end();

		this.areaDamage(
			this.creature, // Attacker
			"area retaliation", // Attack Type
			this.damages, // Damage Type
			[],	// Effects
			targets
		);

		return damage;
	},
},


// 	Second Ability: Fiery Claw
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	distance : 2,

	// 	require() :
	require : function(){
		if(!this.testRequirements()) return false;
		var test = this.testDirection({
			team : "ennemy",
			distance : this.distance,
			sourceCreature : this.creature,
		});
		if(!test){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;
		var crea = this.creature;

		G.grid.queryDirection({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			flipped : crea.player.flipped,
			team : 0, // enemies
			id : this.creature.id,
			requireCreature : true,
			x : crea.x,
			y : crea.y,
			distance : this.distance,
			sourceCreature : crea,
		});
	},


	//	activate() :
	activate : function(path,args) {
		var ability = this;
		ability.end();

		var target = path.last().creature;

		var damage = new Damage(
			ability.creature, // Attacker
			"target", // Attack Type
			ability.damages, // Damage Type
			1, // Area
			[]	// Effects
		);
		target.takeDamage(damage);
	},
},



// 	Thirt Ability: Wild Fire
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		return this.testRequirements();
	},

	// 	query() :
	query : function(){
		var ability = this;
		var crea = this.creature;

		crea.queryMove({
			noPath : true,
			isAbility : true,
			range : G.grid.getFlyingRange(crea.x,crea.y,50,crea.size,crea.id),
			callback : function(){ delete arguments[1]; ability.animation.apply(ability,arguments); },
		});
	},


	//	activate() :
	activate : function(hex,args) {
		var ability = this;
		ability.end();


		var targets = ability.getTargets(ability.creature.adjacentHexs(1));

		targets.each(function(){

			if( !(this.target instanceof Creature) ) return;

			var trg = this.target;

		})

		ability.creature.moveTo(hex,{
			ignoreMovementPoint : true,
			ignorePath : true,
			animation : "teleport",
			callback : function(){
				G.activeCreature.queryMove()
			},
			callbackStepIn  : function(){
				var targets = ability.getTargets(ability.creature.adjacentHexs(1));

				targets.each(function(){
				if( !(this.target instanceof Creature) ) return;

					var trg = this.target;

					if(trg.team%2 != ability.creature.team%2){ // If Foe

						var optArg = { alterations : {burn : -5} };

						// Roasted effect
						var effect = new Effect(
							"Roasted", // Name
							ability.creature, // Caster
							trg, // Target
							"", // Trigger
							optArg // Optional arguments
						);
						trg.addEffect(effect,"%CreatureName"+trg.id+"% got roasted : -5 burn stat");
					}
				})
			},
		});

		// Leave a Firewall in old location
		var effectFn = function(effect,crea){
			crea.takeDamage(new Damage( effect.attacker, "effect", ability.damages , 1,[] ));
			this.trap.destroy();
		};

		var requireFn = function(){
			if(this.trap.hex.creature==0) return false;
			return this.trap.hex.creature.type != "P7";
		};

		this.creature.hexagons[1].createTrap("firewall",[
			new Effect(
				"Firewall",this.creature,this.creature.hexagons[1],"onStepIn",
				{ requireFn: requireFn, effectFn: effectFn,	attacker: this.creature }
			),
		],this.creature.player, { turnLifetime : 1, ownerCreature : this.creature, fullTurnLifetime : true } );

		var hex = this.creature.hexagons[2];

		hex.createTrap("firewall",[
			new Effect(
				"Firewall",this.creature,hex,"onStepIn",
				{ requireFn: requireFn, effectFn: effectFn,	attacker: this.creature }
			),
		],this.creature.player, { turnLifetime : 1, ownerCreature : this.creature, fullTurnLifetime : true } );
	},
},



// 	Fourth Ability: Greater Pyre
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		return this.testRequirements();
	},

	// 	query() :
	query : function(){
		var ability = this;
		var crea = this.creature;

		inRangeCreatures = crea.hexagons[1].adjacentHex(1);;

		var range = crea.hexagons[1].adjacentHex(1);

		var head = range.indexOf(crea.hexagons[0]);
		var tail = range.indexOf(crea.hexagons[2]);
		range.splice(head,1);
		range.splice(tail,1);

		G.grid.queryHexs({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			fnOnSelect : function(hex,args){
				hex.adjacentHex(1).each(function(){
					if( this.creature instanceof Creature ){
						if( this.creature == crea ){ // If it is Abolished
							crea.adjacentHexs(1).each(function(){
								if( this.creature instanceof Creature ){
									if( this.creature == crea ){ // If it is Abolished
										crea.adjacentHexs(1).overlayVisualState("creature selected weakDmg player"+this.creature.team);
										this.overlayVisualState("creature selected weakDmg player"+this.creature.team);
									}else{
										this.overlayVisualState("creature selected weakDmg player"+this.creature.team);
									}
								}else{
									this.overlayVisualState("creature selected weakDmg player"+G.activeCreature.team);
								}
							});
						}else{
							this.overlayVisualState("creature selected weakDmg player"+this.creature.team);
						}
					}else{
						this.overlayVisualState("creature selected weakDmg player"+G.activeCreature.team);
					}
				});

				hex.cleanOverlayVisualState();
				if( hex.creature instanceof Creature ){
					hex.overlayVisualState("creature selected player"+hex.creature.team);
				}else{
					hex.overlayVisualState("creature selected player"+G.activeCreature.team);
				}
			},
			id : this.creature.id,
			hexs : range,
			hideNonTarget : true,
		});
	},


	//	activate() :
	activate : function(hex,args) {
		var ability = this;
		ability.end();

		var aoe = hex.adjacentHex(1);

		var targets = ability.getTargets(aoe);

		if(hex.creature instanceof Creature){
			hex.creature.takeDamage(new Damage(
				ability.creature, // Attacker
				"area", // Attack Type
				ability.damages1, // Damage Type
				1, // Area
				[]	// Effects
			));
		}


		ability.areaDamage(
			ability.creature,
			"area",
			ability.damages2,
			[],	// Effects
			targets
		);

	},
}

];

/*
*
*	Chimera abilities
*
*/
G.abilities[45] =[

// 	First Ability: Cyclic Duality
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onStartPhase",

	noAnimation : true,

	//	require() :
	require : function(){
		return this.testRequirements();
	},

	//	activate() :
	activate : function() {
		this.tokens = [false,false,false];
	},

	abilityTriggered : function(id){
		if(this.used) return;
		if(this.tokens[id]){
			this.end();
			for (var i = 0; i < this.tokens.length; i++) {
				this.creature.abilities[i+1].used  = this.tokens[i];
			};
			G.UI.checkAbilities();
		}else{
			this.tokens[id] = true;
			this.creature.abilities[id+1].setUsed(false);
		}
	},

	tokens : [false,false,false],
},



//	Second Ability: Tooth Fairy
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( G.grid.getHexMap(this.creature.x-3,this.creature.y-2,0,false,frontnback3hex),"ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}

		// Duality
		if( this.creature.abilities[0].used ){
			//this.message = "Duality has already been used";
			//return false;
		}else{
			this.setUsed(false);
		}

		return true;
	},

	//	query() :
	query : function(){
		var ability = this;
		var chimera = this.creature;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, // Team, 0 = ennemies
			id : chimera.id,
			flipped : chimera.flipped,
			hexs : G.grid.getHexMap(chimera.x-3,chimera.y-2,0,false,frontnback3hex),
		});
	},


	//	activate() :
	activate : function(target,args) {
		var ability = this;

		ability.creature.abilities[0].abilityTriggered(0);

		ability.end();

		var damage = new Damage(
			ability.creature, // Attacker
			"target", // Attack Type
			ability.damages, // Damage Type
			1, // Area
			[]	// Effects
		);
		target.takeDamage(damage);
	},
},



//	Thirt Ability: Power Note
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	directions : [0,1,0,0,1,0],

	//	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.testDirection({ team : "both", directions : this.directions }) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		// Duality
		if( this.creature.abilities[0].used ){
			//this.message = "Duality has already been used";
			//return false;
		}else{
			this.setUsed(false);
		}
		return true;
	},

	//	query() :
	query : function(){
		var ability = this;
		var chimera = this.creature;

		G.grid.queryDirection({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			flipped : chimera.player.flipped,
			team : 3, // Everyone
			id : chimera.id,
			requireCreature : true,
			x : chimera.x,
			y : chimera.y,
			directions : this.directions,
		});
	},


	//	activate() :
	activate : function(path,args) {
		var ability = this;

		ability.creature.abilities[0].abilityTriggered(1);
		ability.end();

		var invertFlipped = (
			( path[0].direction == 4 && !ability.creature.player.flipped )  ||
			( path[0].direction == 1 && ability.creature.player.flipped )
		);
		console.log(invertFlipped)

		var target = path.last().creature;

		var damage = new Damage(
			ability.creature, // Attacker
			"target", // Attack Type
			ability.damages, // Damage Type
			1, // Area
			[]	// Effects
		);
		result = target.takeDamage(damage);

		while(result.kill){

			var hexs = ability.creature.getHexMap(straitrow,invertFlipped);
			var newTarget = false;
			for (var i = 0; i < hexs.length; i++) {
				if(hexs[i].creature instanceof Creature) {
					if(hexs[i].creature == ability.creature) continue;
					var target = hexs[i].creature;
					newTarget = true;
					break;
				}
			};

			if(!newTarget) break;

			var damage = new Damage(
				ability.creature, // Attacker
				"target", // Attack Type
				{sonic:result.damages.sonic}, // Damage Type
				1, // Area
				[]	// Effects
			);
			result = target.takeDamage(damage);

		}
	},
},



//	Fourth Ability: Chain Lightning
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	directions : [0,1,0,0,1,0],

	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.testDirection({ team : "both", directions : this.directions }) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		// Duality
		if( this.creature.abilities[0].used ){
			//this.message = "Duality has already been used";
			//return false;
		}else{
			this.setUsed(false);
		}
		return true;
	},

	//	query() :
	query : function(){
		var ability = this;
		var chimera = this.creature;

		G.grid.queryDirection({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			flipped : chimera.player.flipped,
			team : 3, // Everyone
			id : chimera.id,
			requireCreature : true,
			x : chimera.x,
			y : chimera.y,
			directions : this.directions,
		});
	},


	//	activate() :
	activate : function(path,args) {
		var ability = this;

		ability.creature.abilities[0].abilityTriggered(2);

		ability.end();

		var targets = [];
		targets.push(path.last().creature); // Add First creature hit
		var nextdmg = $j.extend({},ability.damages); // Copy the object

		// For each Target
		for (var i = 0; i < targets.length; i++) {
			var trg = targets[i];

			var damage = new Damage(
				ability.creature, // Attacker
				"target", // Attack Type
				nextdmg, // Damage Type
				1, // Area
				[] // Effects
			);
			nextdmg = trg.takeDamage(damage);

			if(nextdmg.damages == undefined) break; // If attack is dodge
			if(nextdmg.kill) break; // If target is killed
			if(nextdmg.damages.total <= 0) break; // If damage is too weak
			if(nextdmg.damageObj.status != "") break;
			delete nextdmg.damages.total;
			nextdmg = nextdmg.damages;

			// Get next available targets
			nextTargets = ability.getTargets(trg.adjacentHexs(1,true));

			nextTargets.filter(function(){
				if ( this.hexsHit == undefined ) return false; // Remove empty ids
				return (targets.indexOf(this.target) == -1) ; // If this creature has already been hit
			})

			// If no target
			if(nextTargets.length == 0) break;

			// Best Target
			var bestTarget = { size: 0, stats:{ defense:-99999, shock:-99999 } };
			for (var j = 0; j < nextTargets.length; j++) { // For each creature
				if (typeof nextTargets[j] == "undefined") continue; // Skip empty ids.

				var t = nextTargets[j].target;
				// Compare to best target
				if(t.stats.shock > bestTarget.stats.shock){
					if( ( t == ability.creature && nextTargets.length == 1 ) || // If target is chimera and the only target
						t != ability.creature ) { // Or this is not chimera
						bestTarget = t;
					}
				} else {
					continue;
				}

			};

			if( bestTarget instanceof Creature ){
				targets.push(bestTarget);
			}else{
				break;
			}
		};

	},
}

];

/*
*
*	Cyber Hound abilities
*
*/
G.abilities[31] =[

// 	First Ability: Bad Dog
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onOtherCreatureMove onOtherCreatureSummon",

	// 	require() :
	require : function(hex){
		if( !this.testRequirements() ) return false;

		//OnSummon Fix
		if( hex instanceof Creature){
			var hex = {creature : hex};
		}

		if( hex instanceof Hex && hex.creature instanceof Creature ){

			if( this.creature.isAlly( hex.creature.team ) ) return false; //Don't bite ally

			var isAdj = false;

			//Search if Cyber hound is adjacent to the creature that is moving
			if( hex.creature.hexagons.indexOf( this.creature.getHexMap(inlinefront2hex)[0] ) != -1) isAdj = true;

			if( !isAdj ) return false;
		}
		return true;
	},

	//	activate() :
	activate : function(hex) {
		var ability = this;
		ability.end();

		var target = this.creature.getHexMap(inlinefront2hex)[0].creature;

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);
		target.takeDamage(damage);
	},
},



// 	Second Ability: Metal Hand
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( this.creature.getHexMap(frontnback2hex), "ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){

		var ability = this;
		var crea = this.creature;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); }, //fnOnConfirm
			team : 0, //Team, 0 = ennemies
			id : crea.id,
			flipped : crea.player.flipped,
			hexs : crea.getHexMap(frontnback2hex)
		});
	},


	//	activate() :
	activate : function(target,args) {
		var ability = this;
		ability.end();

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);
		target.takeDamage(damage);
	},
},



// 	Third Ability: Rocket Launcher
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	require : function(){
		return this.testRequirements();
	},

	token : 0,

	// 	query() :
	query : function(){

		var ability = this;
		var crea = this.creature;

		var choices = [
			//Front
			G.grid.getHexMap(crea.x,crea.y-2,0,false,bellowrow).filterCreature(true,true,crea.id).concat(
			G.grid.getHexMap(crea.x,crea.y,0,false,straitrow).filterCreature(true,true,crea.id),
			G.grid.getHexMap(crea.x,crea.y,0,false,bellowrow).filterCreature(true,true,crea.id)),
			//Behind
			G.grid.getHexMap(crea.x-1,crea.y-2,0,true,bellowrow).filterCreature(true,true,crea.id).concat(
			G.grid.getHexMap(crea.x-1,crea.y,0,true,straitrow).filterCreature(true,true,crea.id),
			G.grid.getHexMap(crea.x-1,crea.y,0,true,bellowrow).filterCreature(true,true,crea.id))
		];

		choices[0].choiceId = 0;
		choices[1].choiceId = 1;

		G.grid.queryChoice({
			fnOnCancel : function(){ G.activeCreature.queryMove(); G.grid.clearHexViewAlterations(); },
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 4, //both
			id : crea.id,
			requireCreature : false,
			choices : choices
		});
	},


	//	activate() :
	activate : function(choice,args) {
		var ability = this;
		ability.end();

		var crea = this.creature;

		if( choice.choiceId == 0 ){
			//Front
			var rows = [
				G.grid.getHexMap(crea.x,crea.y-2,0,false,bellowrow).filterCreature(true,true,crea.id),
				G.grid.getHexMap(crea.x,crea.y,0,false,straitrow).filterCreature(true,true,crea.id),
				G.grid.getHexMap(crea.x,crea.y,0,false,bellowrow).filterCreature(true,true,crea.id)
			];
		}else{
			//Back
			var rows = [
				G.grid.getHexMap(crea.x-1,crea.y-2,0,true,bellowrow).filterCreature(true,true,crea.id),
				G.grid.getHexMap(crea.x-1,crea.y,0,true,straitrow).filterCreature(true,true,crea.id),
				G.grid.getHexMap(crea.x-1,crea.y,0,true,bellowrow).filterCreature(true,true,crea.id)
			];
		}


		for (var i = 0; i < rows.length; i++) {
			if( rows[i].length == 0 || !(rows[i][ rows[i].length-1 ].creature instanceof Creature) ) {
				//Miss
				this.token += 1;
				continue;
			}

			var target = rows[i][ rows[i].length-1 ].creature;

			var damage = new Damage(
				ability.creature, //Attacker
				"target", //Attack Type
				ability.damages, //Damage Type
				1, //Area
				[]	//Effects
			);
			target.takeDamage(damage);
		};

		G.UI.checkAbilities();
	},
},



// 	Forth Ability: Targeting System
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if(this.creature.abilities[2].token == 0){
			this.message = "No rocket launched."
			return false;
		}

		return true;
	},

	// 	query() :
	query : function(){

		var ability = this;
		var crea = this.creature;

		var hexs = G.grid.allHexs.slice(0); //Copy array

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); }, //fnOnConfirm
			team : 0, //Team, 0 = ennemies
			id : crea.id,
			flipped : crea.player.flipped,
			hexs : hexs
		});
	},


	//	activate() :
	activate : function(crea,args) {
		var ability = this;
		ability.end();

		var target = crea;

		this.creature.abilities[2].token -= 1;

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			this.creature.abilities[2].damages, //Damage Type
			1, //Area
			[]	//Effects
		);
		target.takeDamage(damage);
	},
}

];

/*
*
*	Dark Priest abilities
*
*/
G.abilities[0] =[

// 	First Ability: Plasma Shield
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onAttack",

	// 	require() :
	require : function(damage){
		this.setUsed(false); //Can be triggered as many times
		this.creature.protectedFromFatigue = this.testRequirements();
		return this.creature.protectedFromFatigue;
	},

	//	activate() :
	activate : function(damage) {
		this.creature.player.plasma  -= 1;

		this.creature.protectedFromFatigue = this.testRequirements();


		damage.damages = {total:0};
		damage.status = "Shielded";
		damage.effect = [];

		damage.noLog = true;

		this.end(true); //desable message

		G.log("%CreatureName"+this.creature.id+"% is protected by Plasma Shield");

		return damage; //Return Damage
	},
},



// 	Second Ability: Electro Shocker
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( this.creature.adjacentHexs(1),"ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){

		var ability = this;
		var dpriest = this.creature;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //Team, 0 = ennemies
			id : dpriest.id,
			flipped : dpriest.player.flipped,
			hexs : dpriest.adjacentHexs(1),
		});
	},

	//	activate() :
	activate : function(target,args) {
		var ability = this;
		ability.end();

		var damage = {shock: 12*target.size};

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			damage, //Damage Type
			1, //Area
			[]	//Effects
		);

		target.takeDamage(damage);
	},
},



// 	Third Ability: Particle Disruptor
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if(!this.testRequirements()) return false;

		var range = this.creature.adjacentHexs(2);

		//At least one target
		if(!this.atLeastOneTarget(range,"ennemy")){
			this.message = G.msg.abilities.notarget;
			return false;
		}

		//Search Lowest target cost
		var lowestCost = 99;
		var targets = this.getTargets(range);

		targets.each(function(){
			if(!(this.target instanceof Creature)) return false;
			if(lowestCost > this.target.size) lowestCost = this.target.size;
		});

		if(this.creature.player.plasma < lowestCost){
			this.message = G.msg.abilities.noplasma;
			return false;
		}

		return true;
	},

	// 	query() :
	query : function(){

		var ability = this;
		var dpriest = this.creature;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			optTest : function(hex){ return (hex.creature.size <= dpriest.player.plasma) ; },
			team : 0, //Team, 0 = ennemies
			id : dpriest.id,
			flipped : dpriest.player.flipped,
			hexs : dpriest.adjacentHexs(2),
		});
	},

	//	activate() :
	activate : function(target,args) {
		var ability = this;
		ability.end();

		var plasmaCost = target.size;
		var damage = {pure: 25+target.baseStats.health-target.health};

		ability.creature.player.plasma -= plasmaCost;

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			damage, //Damage Type
			1, //Area
			[]	//Effects
		);

		ability.end();

		target.takeDamage(damage);
	},
},



// 	Fourth Ability: Unit Maker
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if(this.creature.player.plasma <= 1){
			this.message = G.msg.abilities.noplasma;
			return false;
		}
		if(this.creature.player.getNbrOfCreatures() == G.creaLimitNbr){
			this.message = G.msg.abilities.nopsy;
			return false;
		}
		return true;
	},

	summonRange : 6,

	// 	query() :
	query : function(){
		var ability = this;
		G.grid.updateDisplay(); //Retrace players creatures

		//Ask the creature to summon
		G.UI.materializeToggled = true;
		G.UI.toggleDash();
	},

	fnOnSelect : function(hex,args){
		var crea = G.retreiveCreatureStats(args.creature);
		G.grid.previewCreature(hex.pos,crea,this.creature.player);
	},

	//Callback function to queryCreature
	materialize : function(creature){
		var crea = G.retreiveCreatureStats(creature);
		var ability = this;
		var dpriest = this.creature;

		G.grid.forEachHexs(function(){ this.unsetReachable(); });

		var spawnRange = dpriest.hexagons[0].adjacentHex(this.summonRange);

		spawnRange.each(function(){ this.setReachable(); });
		spawnRange.filter(function(){ return this.isWalkable(crea.size,0,false);	});
		spawnRange = spawnRange.extendToLeft(crea.size);

		G.grid.queryHexs({
			fnOnSelect : function(){ ability.fnOnSelect.apply(ability,arguments); },
			fnOnCancel : function(){ G.activeCreature.queryMove(); },
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			args : {creature:creature, cost: (crea.size-0)+(crea.lvl-0)}, //OptionalArgs
			size : crea.size,
			flipped : dpriest.player.flipped,
			hexs : spawnRange
		});
	},

	//	activate() :
	activate : function(hex,args) {
		var creature = args.creature;
		var ability = this;

		var creaStats = G.retreiveCreatureStats(creature);
		var dpriest = this.creature;

		var pos = { x:hex.x, y:hex.y };

		ability.creature.player.plasma -= args.cost;

		//TODO: make the UI show the updated number instantly

		ability.end();

		ability.creature.player.summon(creature,pos);
	},
}

];

/*
*
*	Golden Wyrm abilities
*
*/
G.abilities[33] =[

// 	First Ability: Percussion Spear
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onStepIn onStartPhase",

	// 	require() :
	require : function(){
		return this.testRequirements();
	},

	//	activate() :
	activate : function() {
		var creature = this.creature;
		var targets = this.getTargets(this.creature.adjacentHexs(1));

		if( this.atLeastOneTarget( this.creature.adjacentHexs(1),"ennemy" ) ){
			this.end();
			this.setUsed(false); //Infinite triggering
		}else{
			return false;
		}

		targets.each(function(){
			if( !(this.target instanceof Creature) ) return;

			var trg = this.target;

			if(trg.team%2 != creature.team%2){ //If Foe

				var optArg = {
					effectFn : function(effect,crea){
						var nearFungus = false;
						crea.adjacentHexs(1).each(function(){
							if(trg.creature instanceof Creature){
								if(G.creatures[trg.creature] === effect.owner)
									nearFungus = true;
							}
						});

						if(!nearFungus){
							for (var i = 0; i < crea.effects.length; i++) {
								if(crea.effects[i].name == "Contaminated"){
									crea.effects[i].deleteEffect();
									break;
								}
							}
						}
					},
					alterations : {regrowth : -5},
					turn : G.turn,
				};

				//Spore Contamination
				var effect = new Effect(
					"Contaminated", //Name
					creature, //Caster
					trg, //Target
					"onStartPhase", //Trigger
					optArg //Optional arguments
				);

				var validTarget = true;
				trg.effects.each(function(){
					if(this.name == "Contaminated"){
						if(this.turn == G.turn)
							validTarget = false;
					}
				});

				if(validTarget){
					trg.addEffect(effect);
				}
			}
		})
	},
},



// 	Second Ability: Executioner Axe
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		slash : 40,
	},

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		//At least one target
		if( !this.atLeastOneTarget(this.creature.adjacentHexs(1),"ennemy") ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var wyrm = this.creature;
		var ability = this;

		var map = [  [0,0,0,0],
					[0,1,0,1],
				 	 [1,0,0,1], //origin line
					[0,1,0,1]];

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //Team, 0 = ennemies
			id : wyrm.id,
			flipped : wyrm.flipped,
			hexs : G.grid.getHexMap(wyrm.x-2,wyrm.y-2,0,false,map),
		});
	},


	//	activate() :
	activate : function(target,args) {
		var ability = this;
		ability.end();

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);

		var dmg = target.takeDamage(damage);

		if(dmg.status == ""){
			//Regrowth bonus
			ability.creature.addEffect( new Effect(
				"Regrowth++", //Name
				ability.creature, //Caster
				ability.creature, //Target
				"onStartPhase", //Trigger
				{
					effectFn : function(effect,crea){
						effect.deleteEffect();
					},
					alterations : {regrowth : Math.round(dmg.damages.total/4)}
				} //Optional arguments
			) );
		}

		//remove frogger bonus if its found
		ability.creature.effects.each(function(){
			if(this.name == "Frogger Bonus"){
				this.deleteEffect();
			}
		});
	},
},



// 	Third Ability: Dragon Flight
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	require : function(){return this.testRequirements();},

	fnOnSelect : function(hex,args){
		this.creature.tracePosition({ x: hex.x, y: hex.y, overlayClass: "creature moveto selected player"+this.creature.team })
	},

	// 	query() :
	query : function(){
		var ability = this;
		var wyrm = this.creature;

		var range = G.grid.getFlyingRange(wyrm.x,wyrm.y,50,wyrm.size,wyrm.id);
		range.filter(function(){ return wyrm.y == this.y; });

		G.grid.queryHexs({
			fnOnSelect : function(){ ability.fnOnSelect.apply(ability,arguments); },
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			size :  wyrm.size,
			flipped :  wyrm.player.flipped,
			id :  wyrm.id,
			hexs : range,
		});
	},


	//	activate() :
	activate : function(hex,args) {
		var ability = this;
		ability.end();

		ability.creature.moveTo(hex,{
			ignoreMovementPoint : true,
			ignorePath : true,
			callback : function(){
				G.activeCreature.queryMove();
			},
		});

		//Frogger Leap bonus
		ability.creature.addEffect( new Effect(
			"Offense++", //Name
			ability.creature, //Caster
			ability.creature, //Target
			"onStepIn onEndPhase", //Trigger
			{
				effectFn : function(effect,crea){
					effect.deleteEffect();
				},
				alterations : {offense : 25}
			} //Optional arguments
		) );
	},
},



// 	Fourth Ability: Battle Cry
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		pierce : 15,
		slash : 10,
		crush : 5,
	},

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		var map = G.grid.getHexMap(this.creature.x-2,this.creature.y-2,0,false,frontnback2hex);
		//At least one target
		if( !this.atLeastOneTarget(map,"ennemy") ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;
		var wyrm = this.creature;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //Team, 0 = ennemies
			id : wyrm.id,
			flipped : wyrm.flipped,
			hexs : G.grid.getHexMap(wyrm.x-2,wyrm.y-2,0,false,frontnback2hex),
		});
	},


	//	activate() :
	activate : function(target,args) {
		var ability = this;
		ability.end();

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);
		target.takeDamage(damage);

		//remove frogger bonus if its found
		ability.creature.effects.each(function(){
			if(this.name == "Offense++"){
				this.deleteEffect();
			}
		});
	},
}
];

/*
*
*	Gumble abilities
*
*/
G.abilities[14] =[

// 	First Ability: Gooey Body
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onStartPhase",

	// 	require() :
	require : function(damage){
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( this.creature.adjacentHexs(1),"ally" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}

		return true;
	},

	//	activate() :
	activate : function() {
		var ability = this;
		ability.end();

		var crea = this.creature;
		var targets = this.getTargets(crea.adjacentHexs(1));
		var nbrAlly = 0;
		for (var i = 0; i < targets.length; i++) {
			if(targets[i]===undefined) continue;
			if(targets[i].target.isAlly(crea.team)) nbrAlly++;
		};
		crea.heal(crea.stats.health*nbrAlly/6);
	},
},


// 	Second Ability: Gummy Mallet
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( this.creature.adjacentHexs(1),"ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;
		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //Team, 0 = ennemies
			id : this.creature.id,
			flipped : this.creature.player.flipped,
			hexs : this.creature.adjacentHexs(1),
		});
	},


	//	activate() :
	activate : function(target,args) {
		var ability = this;
		ability.end();

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);
		target.takeDamage(damage);
	},
},


// 	Thirt Ability: Royal Seal
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		return this.testRequirements();
	},

	// 	query() :
	query : function(){
		var ability = this;
		var creature = this.creature;

		creature.hint("Confirm","confirm constant");

		G.grid.queryHexs({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			size : creature.size,
			flipped : creature.player.flipped,
			id : creature.id,
			hexs : creature.hexagons,
			ownCreatureHexShade : true,
			hideNonTarget : true
		});
	},


	//	activate() :
	activate : function(hex) {
		var hex = this.creature.hexagons[0];
		this.end();

		var effects = [
			new Effect(
				"Royal Seal",this.creature,hex,"onStepIn",
				{
					requireFn: function(crea){ return crea !== this.owner; },
					effectFn: function(effect,crea){
						crea.remainingMove = 0;
						this.trap.destroy();
					},
				}
			),
		]

		var trap = hex.createTrap("royal-seal",effects,this.creature.player);
		trap.hide();
	},
},


// 	Fourth Ability: Boom Box
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	directions : [1,1,1,1,1,1],

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		var test = this.testDirection({
			team : "ennemy",
			directions : this.directions,
		});
		if( !test ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;
		var crea = this.creature;

		G.grid.queryDirection({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			flipped : crea.player.flipped,
			team : 0, //enemies
			id : this.creature.id,
			requireCreature : true,
			x : crea.x,
			y : crea.y,
			directions : this.directions,
		});
	},


	//	activate() :
	activate : function(path,args) {
		var ability = this;
		ability.end();

		var target = path.last().creature;
		var melee = (path[0].creature === target);

		var d = (melee) ? {sonic:20,crush:10} : {sonic:20};

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			d, //Damage Type
			1, //Area
			[]	//Effects
		);

		var result = target.takeDamage(damage,true);

		// if( result.kill ) return; // if creature die stop here

		var dir = [];
		switch( args.direction ){
			case 3: //Upright
				dir = G.grid.getHexMap(ability.creature.x,ability.creature.y-8,0,ability.creature.flipped,diagonalup).reverse();
				break;
			case 4: //StraitForward
				dir = G.grid.getHexMap(ability.creature.x,ability.creature.y,0,ability.creature.flipped,straitrow);
				break;
			case 5: //Downright
				dir = G.grid.getHexMap(ability.creature.x,ability.creature.y,0,ability.creature.flipped,diagonaldown);
				break;
			case 0: //Downleft
				dir = G.grid.getHexMap(ability.creature.x,ability.creature.y,-4,ability.creature.flipped,diagonalup);
				break;
			case 1: //StraitBackward
				dir = G.grid.getHexMap(ability.creature.x,ability.creature.y,0,!ability.creature.flipped,straitrow);
				break;
			case 2: //Upleft
				dir = G.grid.getHexMap(ability.creature.x,ability.creature.y-8,-4,ability.creature.flipped,diagonaldown).reverse();
				break;
			default:
				break;
		}

		var pushed = false;

		//Recoil
		if(dir.length > 1) {
			if(dir[1].isWalkable(ability.creature.size,ability.creature.id,true)){
				ability.creature.moveTo(dir[1],{
					ignoreMovementPoint : true,
					ignorePath : true,
					callback : function(){
						if( result.damageObj instanceof Damage )
							G.triggersFn.onDamage(target,result.damageObj);

						G.activeCreature.queryMove();
					},
					animation : "push",
				});
				pushed = true;
			}
		}

	},
}

];

/*
*
*	Headless abilities
*
*/
G.abilities[39] =[

// 	First Ability: Maggot Infestation
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onStartPhase",

	// 	require() :
	require : function(){
		if( !this.atLeastOneTarget( this.creature.getHexMap(inlineback2hex),"ennemy" ) ) return false;
		return this.testRequirements();
	},

	//	activate() :
	activate : function() {
		var ability = this;
		var creature = this.creature;

		if( this.atLeastOneTarget( this.creature.getHexMap(inlineback2hex),"ennemy" ) ){
			this.end();
			this.setUsed(false); //Infinite triggering
		}else{
			return false;
		}

		var targets = this.getTargets(this.creature.getHexMap(inlineback2hex));

		targets.each(function(){
			if( !(this.target instanceof Creature) ) return;

			var trg = this.target;

			var effect = new Effect(
				"Infested", //Name
				creature, //Caster
				trg, //Target
				"onStartPhase", //Trigger
				{ alterations : ability.effects[0] } //Optional arguments
			);

			trg.addEffect(effect,"%CreatureName"+trg.id+"% has been infested");
		});
	},
},



// 	Second Ability: Scapel Limbs
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		var crea = this.creature;

		if( !this.testRequirements() ) return false;

		//At least one target
		if( !this.atLeastOneTarget(crea.getHexMap(frontnback2hex),"ennemy") ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;
		var crea = this.creature;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //Team, 0 = ennemies
			id : crea.id,
			flipped : crea.flipped,
			hexs : crea.getHexMap(frontnback2hex),
		});
	},


	//	activate() :
	activate : function(target,args) {
		var ability = this;
		ability.end();

		var d = { pierce : 12 };

		//Bonus for fatigued foe
		d.pierce = target.endurance <= 0 ? d.pierce * 2 : d.pierce;

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			d, //Damage Type
			1, //Area
			[]	//Effects
		);

		var dmg = target.takeDamage(damage);
	},
},



// 	Third Ability: Whip Slash
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	directions : [0,1,0,0,1,0],

	require : function(){
		if( !this.testRequirements() ) return false;

		var crea = this.creature;
		var x = (crea.player.flipped) ? crea.x-crea.size+1 : crea.x ;

		var test = this.testDirection({
			team : "ennemy",
			x : x,
			directions : this.directions,
			distance : 5
		});

		if( !test ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;
		var crea = this.creature;

		G.grid.queryDirection({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //enemies
			id : crea.id,
			requireCreature : true,
			sourceCreature : crea,
			x : crea.x,
			y : crea.y,
			directions : this.directions,
			distance : 5
		});
	},


	//	activate() :
	activate : function(path,args) {
		var ability = this;
		var crea = this.creature;


		var path = path;
		var target = path.last().creature;
		path = path.filter( function(){	return !this.creature; }); //remove creatures
		ability.end();

		console.log(path);

		//Damage
		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			{ slash : 12, crush : 5*path.length }, //Damage Type
			1, //Area
			[]	//Effects
		);

		//Movement
		var creature = (args.direction==4) ? crea.hexagons[crea.size-1] : crea.hexagons[0] ;
		path.filterCreature(false,false);
		path.unshift(creature); //prevent error on empty path
		var destination = path.last();
		var x = (args.direction==4) ? destination.x+crea.size-1 : destination.x ;
		destination = G.grid.hexs[destination.y][x];

		crea.moveTo(destination,{
			ignoreMovementPoint : true,
			ignorePath : true,
			callback : function(){
				var ret = target.takeDamage(damage,true);

				if( ret.damageObj instanceof Damage )
					G.triggersFn.onDamage(target,ret.damageObj);

				var interval = setInterval(function(){
					if(!G.freezedInput){
						clearInterval(interval);
						G.activeCreature.queryMove();
					}
				},100);
			},
		});
	},
},



// 	Fourth Ability: Boomerang Throw
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		slash : 10,
		crush : 5,
	},

	map : [ [0,0,0,0,0],
		   [0,1,1,1,1],
			[0,1,1,1,1],//origin line
		   [0,1,1,1,1]],

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;
		var crea = this.creature;

		this.map.origin = [0,2];

		G.grid.queryChoice({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 3,
			requireCreature : 0,
			id : crea.id,
			flipped : crea.flipped,
			choices : [
				crea.getHexMap(this.map),
				crea.getHexMap(this.map,true),
			],
		})

	},


	//	activate() :
	activate : function(hexs) {

		damages = {
			slash : 5,
			crush : 5,
		}

		var ability = this;
		ability.end();

		ability.areaDamage(
			ability.creature, //Attacker
			"zone", //Attack Type
			damages, //Damage Type
			[],	//Effects
			ability.getTargets(hexs), //Targets
			true //Notriggers avoid double retailiation
		);

		ability.areaDamage(
			ability.creature, //Attacker
			"zone", //Attack Type
			damages, //Damage Type
			[],	//Effects
			ability.getTargets(hexs) //Targets
		);
	},
}
];

/*
*
*	Ice Demon abilities
*
*/
G.abilities[6] =[

// 	First Ability: Frost Bite
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onEndPhase",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;
		return true;
	},

	//	activate() :
	activate : function(){
		var ability = this;
		this.end();

		//Check all creatures
		for (var i = 1; i < G.creatures.length; i++) {
			if( G.creatures[i] instanceof Creature ){
				var crea = G.creatures[i];

				if( !crea.isAlly( ability.creature.team ) && !crea.dead && crea.findEffect( "Snow Storm" ).length == 0 ){
					var effect = new Effect(
						"Snow Storm", //Name
						ability.creature, //Caster
						crea, //Target
						"onOtherCreatureDeath", //Trigger
						{
							effectFn: function(effect,crea){
								var trg = effect.target;

								var iceDemonArray = G.findCreature({
									type:"S7", //Ice Demon
									dead:false, //Still Alive
									team:[ 1-(trg.team%2), 1-(trg.team%2)+2 ] //oposite team
								});

								if( iceDemonArray.length == 0 ){
									this.deleteEffect();
								}
							},
							alterations: ability.effects[0],
							noLog: true
						} //Optional arguments
					);
					crea.addEffect(effect);
				}
			}
		};
	},
},


// 	Second Ability: Head Bash
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	distance : 1,

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;
		var test = this.testDirection({
			team : "ennemy",
			distance : this.distance,
			sourceCreature : this.creature,
		});
		if( !test ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;
		var crea = this.creature;

		G.grid.queryDirection({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			flipped : crea.player.flipped,
			team : 0, //enemies
			id : this.creature.id,
			requireCreature : true,
			x : crea.x,
			y : crea.y,
			distance : this.distance,
			sourceCreature : crea,
		});
	},


	//	activate() :
	activate : function(path,args) {
		var ability = this;
		ability.end();

		var direction = path.last().direction;
		var target = path.last().creature;

		var dir = [];
		switch( direction ){
			case 0: //Upright
				dir = G.grid.getHexMap(target.x,target.y-8,0,target.flipped,diagonalup).reverse();
				break;
			case 1: //StraitForward
				dir = G.grid.getHexMap(target.x,target.y,0,target.flipped,straitrow);
				break;
			case 2: //Downright
				dir = G.grid.getHexMap(target.x,target.y,0,target.flipped,diagonaldown);
				break;
			case 3: //Downleft
				dir = G.grid.getHexMap(target.x,target.y,-4,target.flipped,diagonalup);
				break;
			case 4: //StraitBackward
				dir = G.grid.getHexMap(target.x,target.y,0,!target.flipped,straitrow);
				break;
			case 5: //Upleft
				dir = G.grid.getHexMap(target.x,target.y-8,-4,target.flipped,diagonaldown).reverse();
				break;
			default:
				break;
		}

		var pushed = false;

		if(dir.length > 1) {
			if(dir[1].isWalkable(target.size,target.id,true)){
				target.moveTo(dir[1],{
					ignoreMovementPoint : true,
					ignorePath : true,
					callback : function(){
						G.activeCreature.queryMove();
					},
					animation : "push",
				});
				pushed = true;
			}
		}
		var d = $j.extend({},ability.damages);

		if(!pushed){
			d.crush = d.crush * 2;
		}

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			d, //Damage Type
			1, //Area
			[]	//Effects
		);
		target.takeDamage(damage);
	},
},



// 	Thirt Ability: Snow Storm
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		var crea = this.creature;
		var hexs = G.grid.getHexMap(crea.x+2,crea.y-2,0,false,straitrow).filterCreature(true,true,crea.id,crea.team).concat(
			G.grid.getHexMap(crea.x+1,crea.y-2,0,false,bellowrow).filterCreature(true,true,crea.id,crea.team),
			G.grid.getHexMap(crea.x,crea.y,0,false,straitrow).filterCreature(true,true,crea.id,crea.team),
			G.grid.getHexMap(crea.x+1,crea.y,0,false,bellowrow).filterCreature(true,true,crea.id,crea.team),
			G.grid.getHexMap(crea.x+2,crea.y+2,0,false,straitrow).filterCreature(true,true,crea.id,crea.team),

			G.grid.getHexMap(crea.x-2,crea.y-2,2,true,straitrow).filterCreature(true,true,crea.id,crea.team),
			G.grid.getHexMap(crea.x-1,crea.y-2,2,true,bellowrow).filterCreature(true,true,crea.id,crea.team),
			G.grid.getHexMap(crea.x,crea.y,2,true,straitrow).filterCreature(true,true,crea.id,crea.team),
			G.grid.getHexMap(crea.x-1,crea.y,2,true,bellowrow).filterCreature(true,true,crea.id,crea.team),
			G.grid.getHexMap(crea.x-2,crea.y+2,2,true,straitrow).filterCreature(true,true,crea.id,crea.team));

		if( !this.atLeastOneTarget( hexs, "ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}

		return true;

	},

	// 	query() :
	query : function(){
		var ability = this;
		var crea = this.creature;

		var choices = [
			//Front
			G.grid.getHexMap(crea.x+2,crea.y-2,0,false,straitrow).filterCreature(true,true,crea.id,crea.team).concat(
			G.grid.getHexMap(crea.x+1,crea.y-2,0,false,bellowrow).filterCreature(true,true,crea.id,crea.team),
			G.grid.getHexMap(crea.x,crea.y,0,false,straitrow).filterCreature(true,true,crea.id,crea.team),
			G.grid.getHexMap(crea.x+1,crea.y,0,false,bellowrow).filterCreature(true,true,crea.id,crea.team),
			G.grid.getHexMap(crea.x+2,crea.y+2,0,false,straitrow).filterCreature(true,true,crea.id,crea.team)),
			//Behind
			G.grid.getHexMap(crea.x-2,crea.y-2,2,true,straitrow).filterCreature(true,true,crea.id,crea.team).concat(
			G.grid.getHexMap(crea.x-1,crea.y-2,2,true,bellowrow).filterCreature(true,true,crea.id,crea.team),
			G.grid.getHexMap(crea.x,crea.y,2,true,straitrow).filterCreature(true,true,crea.id,crea.team),
			G.grid.getHexMap(crea.x-1,crea.y,2,true,bellowrow).filterCreature(true,true,crea.id,crea.team),
			G.grid.getHexMap(crea.x-2,crea.y+2,2,true,straitrow).filterCreature(true,true,crea.id,crea.team))
		];

		G.grid.queryChoice({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); }, //fnOnConfirm
			team : 0,
			requireCreature : 1,
			id : crea.id,
			flipped : crea.flipped,
			choices : choices,
		});

	},


	//	activate() :
	activate : function(choice,args) {
		var ability = this;
		var crea = this.creature;

		var creaturesHit = []

		for (var i = 0; i < choice.length; i++) {
			if( choice[i].creature instanceof Creature &&
				creaturesHit.indexOf(choice[i].creature) == -1 ){ //Prevent Multiple Hit

				choice[i].creature.takeDamage(
					new Damage(
						ability.creature, //Attacker
						"area", //Attack Type
						ability.damages1, //Damage Type
						1, //Area
						[]	//Effects
					)
				);

				creaturesHit.push(choice[i].creature);
			}
		};
	},
},



// 	Fourth Ability: Frozen Orb
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	directions : [0,1,0,0,1,0],

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;
		var test = this.testDirection({
			team : "ennemy",
			directions : this.directions,
			sourceCreature : this.creature,
		});
		if( !test ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;
		var crea = this.creature;

		G.grid.queryDirection({
			fnOnSelect : function(path,args){
				var trg = path.last().creature;

				var hex = (ability.creature.player.flipped)
					? G.grid.hexs[path.last().y][path.last().x+trg.size-1]
					: path.last();

				hex.adjacentHex( ability.radius ).concat( [hex] ) .each(function(){
					if( this.creature instanceof Creature ){
						this.overlayVisualState("creature selected player"+this.creature.team);
					}else{
						this.overlayVisualState("creature selected player"+G.activeCreature.team);
					}
				});
			},
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			flipped : crea.player.flipped,
			team : 0, //enemies
			id : this.creature.id,
			requireCreature : true,
			x : crea.x,
			y : crea.y,
			sourceCreature : crea,
		});
	},


	//	activate() :
	activate : function(path,args) {
		var ability = this;
		ability.end();

		var trg = path.last().creature;

		var hex = (ability.creature.player.flipped)
			? G.grid.hexs[path.last().y][path.last().x+trg.size-1]
			: path.last();

		var trgs = ability.getTargets( hex.adjacentHex( ability.radius )
			.concat( [hex] ) ); //Include central hex

		// var target = path.last().creature;

		// var damage = new Damage(
		// 	ability.creature, //Attacker
		// 	"target", //Attack Type
		// 	ability.damages, //Damage Type
		// 	1, //Area
		// 	[]	//Effects
		// );
		// target.takeDamage(damage);

		var effect = new Effect(
			"Frozen", //Name
			ability.creature, //Caster
			undefined, //Target
			"onEffectAttachement", //Trigger
			{
				effectFn: function(effect){
					var trg = effect.target;
					trg.freezed = true;
					this.deleteEffect();
				}
			} //Optional arguments
		);

		ability.areaDamage(
			ability.creature,
			"area",
			ability.damages,
			[effect],	//Effects
			trgs
		);
	},
}

];

/*
*
*	Impaler abilities
*
*/
G.abilities[5] =[

// 	First Ability: Electrified Hair
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onAttack",

	// 	require() :
	require : function(){return this.testRequirements();},

	// 	require() :
	require : function(damage){
		this.setUsed(false); //Can be triggered as many times
		if( damage == undefined ) damage = { damages: {shock:1} }; //For checking to work

		if( this.creature.electrifiedHair >= this.maxCharge ) return false;
		if( !damage.damages.shock ) return false;
		return this.testRequirements();
	},

	//	activate() :
	activate : function(damage) {
		if(!(this.creature.electrifiedHair+1)) this.creature.electrifiedHair = 0;
		var capacity = this.maxCharge-this.creature.electrifiedHair;
		if(damage.damages.shock){
			if(damage.damages.shock>0){
				this.creature.electrifiedHair += (damage.damages.shock/2>capacity)
				? capacity
				: damage.damages.shock/2;
				damage.damages.shock = (damage.damages.shock/2>capacity)
				? damage.damages.shock-capacity
				: damage.damages.shock/2;
			}
		}
		this.end();
		return damage; //Return Damage
	},

	getCharge : function() {
		return { min : 0 , max : this.maxCharge, value: ( this.creature.electrifiedHair || 0 ) };
	}
},



// 	Second Ability: Deadly Jab
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( G.grid.getHexMap(this.creature.x-3,this.creature.y-2,0,false,frontnback3hex),"ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){

		var ability = this;
		var creature = this.creature;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //Team, 0 = ennemies
			id : creature.id,
			flipped : creature.flipped,
			hexs : G.grid.getHexMap(creature.x-3,creature.y-2,0,false,frontnback3hex),
		});
	},


	//	activate() :
	activate : function(target,args) {
		var ability = this;
		ability.end();

		var finalDmg = $j.extend({ poison:0, shock:0 },ability.damages1); //Copy object

		//Poison Bonus
		ability.creature.effects.each(function(){
			if(this.trigger == "poisonous_vine_perm"){
				finalDmg.poison += 1;
			}else if(this.trigger == "poisonous_vine"){
				finalDmg.poison += 5;
			}
		});

		//Jab Bonus
		finalDmg.pierce += ability.creature.travelDist*3;

		//Electrified Hair Bonus
		if(ability.creature.electrifiedHair){
			if(ability.creature.electrifiedHair>25){
				finalDmg.shock += 25;
				ability.creature.electrifiedHair -= 25;
			}else if(ability.creature.electrifiedHair>0){
				finalDmg.shock += ability.creature.electrifiedHair;
				ability.creature.electrifiedHair = 0;
			}
		}

		G.UI.checkAbilities();

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			finalDmg, //Damage Type
			1, //Area
			[] //Effects
		)
		target.takeDamage(damage);
	},
},



// 	Thirt Ability: Poisonous Vine
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){return this.testRequirements();},

	// 	query() :
	query : function(){
		var ability = this;
		var creature = this.creature;

		G.grid.querySelf({fnOnConfirm : function(){ ability.animation.apply(ability,arguments); }});
	},


	//	activate() :
	activate : function() {
		this.end();
		var effect = new Effect("Poisonous",this.creature,this.creature,"poisonous_vine",{
			turnLifetime : 1,
		});
		this.creature.addEffect(effect,"%CreatureName"+this.creature.id+"% gains poison damage");

		var effect = new Effect("",this.creature,this.creature,"poisonous_vine_perm",{
		});
		this.creature.addEffect(effect);
		//TODO add animation
	},
},



// 	Fourth Ability: Super Slash
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( G.grid.getHexMap(this.creature.x,this.creature.y-2,0,false,this.map).concat( G.grid.getHexMap(this.creature.x-this.creature.size+1,this.creature.y-2,0,true,this.map) ),"ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	map : [  [0,0,0,0],
			[0,1,0,0],
			 [0,1,0,0],//origin line
			[0,1,0,0],
			 [0,0,0,0]],

	// 	query() :
	query : function(){
		var ability = this;

		G.grid.queryChoice({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 3,
			requireCreature : 1,
			id : this.creature.id,
			flipped : this.creature.flipped,
			choices : [
				G.grid.getHexMap(this.creature.x,this.creature.y-2,0,false,this.map),
				G.grid.getHexMap(this.creature.x-this.creature.size+1,this.creature.y-2,0,true,this.map)
			],
		})
	},


	//	activate() :
	activate : function(hexs,args) {
		var ability = this;
		ability.end();

		var targets = ability.getTargets(hexs);

		targets.each(function(){
			if(this != window){

				var finalDmg = $j.extend({ poison:0, shock:0 },ability.damages); //Copy object

				//Poison Bonus
				ability.creature.effects.each(function(){
					if(this.trigger == "poisonous_vine_perm"){
						finalDmg.poison += 1;
					}else if(this.trigger == "poisonous_vine"){
						finalDmg.poison += 5;
					}
				});

				//Electrified Hair Bonus
				if(ability.creature.electrifiedHair){
					if(ability.creature.electrifiedHair>25){
						finalDmg.shock += 25;
						ability.creature.electrifiedHair -= 25;
					}else if(ability.creature.electrifiedHair>0){
						finalDmg.shock += ability.creature.electrifiedHair;
						ability.creature.electrifiedHair = 0;
					}
				}

				G.UI.checkAbilities();

				var damage = new Damage(
					ability.creature, //Attacker
					"target", //Attack Type
					finalDmg, //Damage Type
					1, //Area
					[] //Effects
				)
				this.target.takeDamage(damage);
			}
		});
	},
}

];

/*
*
*	Abolished abilities
*
*/
G.abilities[22] =[

// 	First Ability: Greater Pyre
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onDamage",

	// 	require() :
	require : function(damage){
		if( this.used ) return false;
		if( !this.testRequirements() ) return false;
		if( damage == undefined ) damage = {type:"target"}; //For the test function to work
		//if( this.triggeredThisChain ) return false;
		return true;
	},

	//	activate() :
	activate : function(damage){
		if(this.triggeredThisChain) return damage;

		var targets = this.getTargets(this.creature.adjacentHexs(1));
		this.end();
		this.triggeredThisChain = true;

		this.areaDamage(
			this.creature, //Attacker
			"area retaliation", //Attack Type
			this.damages, //Damage Type
			[],	//Effects
			targets
		);

		return damage;
	},
},


// 	Second Ability: Fiery Claw
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	distance : 2,

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;
		var test = this.testDirection({
			team : "ennemy",
			distance : this.distance,
			sourceCreature : this.creature,
		});
		if( !test ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;
		var crea = this.creature;

		G.grid.queryDirection({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			flipped : crea.player.flipped,
			team : 0, //enemies
			id : this.creature.id,
			requireCreature : true,
			x : crea.x,
			y : crea.y,
			distance : this.distance,
			sourceCreature : crea,
		});
	},


	//	activate() :
	activate : function(path,args) {
		var ability = this;
		ability.end();

		var target = path.last().creature;

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);
		target.takeDamage(damage);
	},
},



// 	Thirt Ability: Burning Eye
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		return this.testRequirements();
	},

	// 	query() :
	query : function(){
		var ability = this;
		var crea = this.creature;

		crea.queryMove({
			noPath : true,
			isAbility : true,
			range : G.grid.getFlyingRange(crea.x,crea.y,50,crea.size,crea.id),
			callback : function(){ delete arguments[1]; ability.animation.apply(ability,arguments); },
		});
	},


	//	activate() :
	activate : function(hex,args) {
		var ability = this;
		ability.end();


		var targets = ability.getTargets(ability.creature.adjacentHexs(1));

		targets.each(function(){

			if( !(this.target instanceof Creature) ) return;

			var trg = this.target;

			if(trg.team%2 != ability.creature.team%2){ //If Foe

				var optArg = { alterations : {burn : -1} };

				//Roasted effect
				var effect = new Effect(
					"Roasted", //Name
					ability.creature, //Caster
					trg, //Target
					"", //Trigger
					optArg //Optional arguments
				);
				trg.addEffect(effect);
			}
		})

		ability.creature.moveTo(hex,{
			ignoreMovementPoint : true,
			ignorePath : true,
			animation : "teleport",
			callback : function(){
				G.activeCreature.queryMove()
			},
			callbackStepIn  : function(){
				var targets = ability.getTargets(ability.creature.adjacentHexs(1));

				targets.each(function(){
				if( !(this.target instanceof Creature) ) return;

					var trg = this.target;

					if(trg.team%2 != ability.creature.team%2){ //If Foe

						var optArg = { alterations : {burn : -1} };

						//Roasted effect
						var effect = new Effect(
							"Roasted", //Name
							ability.creature, //Caster
							trg, //Target
							"", //Trigger
							optArg //Optional arguments
						);
						trg.addEffect(effect,"%CreatureName"+trg.id+"% got roasted : -1 burn stat debuff");
					}
				})
			},
		});
	},
},



// 	Fourth Ability: Fire Ball
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		return this.testRequirements();
	},

	// 	query() :
	query : function(){
		var ability = this;
		var crea = this.creature;

		inRangeCreatures = crea.hexagons[1].adjacentHex(4);;

		var range = crea.hexagons[1].adjacentHex(3);

		var head = range.indexOf(crea.hexagons[0]);
		var tail = range.indexOf(crea.hexagons[2]);
		range.splice(head,1);
		range.splice(tail,1);

		G.grid.queryHexs({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			fnOnSelect : function(hex,args){
				hex.adjacentHex(1).each(function(){
					if( this.creature instanceof Creature ){
						if( this.creature == crea ){ //If it is abolished
							crea.adjacentHexs(1).each(function(){
								if( this.creature instanceof Creature ){
									if( this.creature == crea ){ //If it is abolished
										crea.adjacentHexs(1).overlayVisualState("creature selected weakDmg player"+this.creature.team);
										this.overlayVisualState("creature selected weakDmg player"+this.creature.team);
									}else{
										this.overlayVisualState("creature selected weakDmg player"+this.creature.team);
									}
								}else{
									this.overlayVisualState("creature selected weakDmg player"+G.activeCreature.team);
								}
							});
						}else{
							this.overlayVisualState("creature selected weakDmg player"+this.creature.team);
						}
					}else{
						this.overlayVisualState("creature selected weakDmg player"+G.activeCreature.team);
					}
				});

				hex.cleanOverlayVisualState();
				if( hex.creature instanceof Creature ){
					hex.overlayVisualState("creature selected player"+hex.creature.team);
				}else{
					hex.overlayVisualState("creature selected player"+G.activeCreature.team);
				}
			},
			id : this.creature.id,
			hexs : range,
			hideNonTarget : true,
		});
	},


	//	activate() :
	activate : function(hex,args) {
		var ability = this;
		ability.end();

		var aoe = hex.adjacentHex(1);

		var targets = ability.getTargets(aoe);

		if(hex.creature instanceof Creature){
			hex.creature.takeDamage(new Damage(
				ability.creature, //Attacker
				"area", //Attack Type
				ability.damages1, //Damage Type
				1, //Area
				[]	//Effects
			));
		}


		ability.areaDamage(
			ability.creature,
			"area",
			ability.damages2,
			[],	//Effects
			targets
		);

	},
}

];

/*
*
*	Magma Spawn abilities
*
*/
G.abilities[4] =[

// 	First Ability: Scorched Ground
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onStartPhase",

	// 	require() :
	require : function(){return this.testRequirements();},

	//	activate() :
	activate : function() {
		var ability = this;

		var effectFn = function(effect,crea){
			crea.takeDamage(new Damage( effect.attacker, "effect", ability.damages , 1,[] ));
			this.trap.destroy();
		};

		var requireFn = function(){
			if(this.trap.hex.creature==0) return false;
			return this.trap.hex.creature.type != "L2";
		};

		this.creature.hexagons[1].createTrap("scorched-ground",[
			new Effect(
				"Scorched Ground",this.creature,this.creature.hexagons[1],"onStepIn",
				{ requireFn: requireFn, effectFn: effectFn,	attacker: this.creature }
			),
		],this.creature.player, { turnLifetime : 1, ownerCreature : this.creature, fullTurnLifetime : true } );

		var hex;
		if( this.creature.player.flipped )
			hex = this.creature.hexagons[0];
		else
			hex = this.creature.hexagons[2];


		hex.createTrap("scorched-ground",[
			new Effect(
				"Scorched Ground",this.creature,hex,"onStepIn",
				{ requireFn: requireFn, effectFn: effectFn,	attacker: this.creature }
			),
		],this.creature.player, { turnLifetime : 1, ownerCreature : this.creature, fullTurnLifetime : true } );
	},
},



// 	Second Ability: Pulverizing Punch
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( this.creature.getHexMap(frontnback3hex),"ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;
		var magmaSpawn = this.creature;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //Team, 0 = ennemies
			id : magmaSpawn.id,
			flipped : magmaSpawn.flipped,
			hexs : this.creature.getHexMap(frontnback3hex),
		});
	},


	//	activate() :
	activate : function(target,args) {
		var ability = this;
		ability.end();

		ability.creature.burnBoost = (ability.creature.burnBoost+1) ? ability.creature.burnBoost : 3;

		var d = {burn:ability.creature.burnBoost, crush:ability.damages.crush};

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			d, //Damage Type
			1, //Area
			[]	//Effects
		);

		target.takeDamage(damage);

		ability.creature.burnBoost++;
	},
},



// 	Thirt Ability: Fissure Vent
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	map : [  [0,0,1,0],
			[0,0,1,1],
			 [0,1,1,0],//origin line
			[0,0,1,1],
			 [0,0,1,0]],

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		this.map.origin = [0,2];

		// Require Ennemy
		var magmaSpawn = this.creature;
		var hexs = magmaSpawn.getHexMap(this.map).concat( magmaSpawn.getHexMap(this.map,true) );
		if( !this.atLeastOneTarget( hexs,"ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;
		var magmaSpawn = this.creature;

		this.map.origin = [0,2];

		G.grid.queryChoice({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 3,
			requireCreature : 0,
			id : magmaSpawn.id,
			flipped : magmaSpawn.flipped,
			choices : [
				magmaSpawn.getHexMap(this.map),
				magmaSpawn.getHexMap(this.map,true)
			],
		})

	},


	//	activate() :
	activate : function(hexs,args) {
		var ability = this;
		ability.end();

		//Basic Attack all nearby creatures
		ability.areaDamage(
			ability.creature, //Attacker
			"zone", //Attack Type
			ability.damages1, //Damage Type
			[],	//Effects
			ability.getTargets(hexs) //Targets
		);
	},

	animation_datas : {
		visual : function(hexs,args){

			setTimeout(function(){
				hexs.each(function(){
					var sprite = G.grid.trapGroup.create(this.originalDisplayPos.x, this.originalDisplayPos.y, "effects_fissure-vent");
					var tween = G.Phaser.add.tween(sprite)
					.to({alpha:1},500,Phaser.Easing.Linear.None)
					.to({alpha:0},500,Phaser.Easing.Linear.None)
					.start();
					tween._lastChild.onComplete.add(function(){ sprite.destroy() },this);
				});
			},this.animation_datas.delay);

		},
		duration : 500,
		delay : 350,
	},

},



// 	Fourth Ability: Molten Hurl
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	directions : [0,1,0,0,1,0],

	require : function(){
		if( !this.testRequirements() ) return false;

		var magmaSpawn = this.creature;
		var x = (magmaSpawn.player.flipped) ? magmaSpawn.x-magmaSpawn.size+1 : magmaSpawn.x ;

		var test = this.testDirection({
			team : "ennemy",
			x : x,
			directions : this.directions,
		});

		if( !test ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;
		var magmaSpawn = this.creature;

		var x = (magmaSpawn.player.flipped) ? magmaSpawn.x-magmaSpawn.size+1 : magmaSpawn.x ;

		G.grid.queryDirection({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //enemies
			id : magmaSpawn.id,
			requireCreature : true,
			x : x,
			y : magmaSpawn.y,
			directions : this.directions,
		});
	},


	//	activate() :
	activate : function(path,args) {
		var ability = this;
		var magmaSpawn = this.creature;


		var path = path;
		var target = path.last().creature;
		ability.end(false,true);

		//Damage
		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);


		//Movement
		var magmaHex = (args.direction==4) ? magmaSpawn.hexagons[magmaSpawn.size-1] : magmaSpawn.hexagons[0] ;
		path.filterCreature(false,false);
		path.unshift(magmaHex); //prevent error on empty path
		var destination = path.last();
		var x = (args.direction==4) ? destination.x+magmaSpawn.size-1 : destination.x ;
		destination = G.grid.hexs[destination.y][x];

		magmaSpawn.moveTo(destination,{
			ignoreMovementPoint : true,
			ignorePath : true,
			callback : function(){
				path.each(function(){
					if( !this.trap ) return;
					if( this.trap.owner =! magmaSpawn.player ){
						this.destroyTrap();
					}
				});

				var ret = target.takeDamage(damage,true);

				if( ret.damageObj instanceof Damage && ret.kill == false )
					G.triggersFn.onDamage(target,ret.damageObj);

				var interval = setInterval(function(){
					if(!G.freezedInput){
						clearInterval(interval);
						G.UI.selectAbility(-1);
						G.activeCreature.queryMove();
					}
				},100)

			},
		});
	},
}

];

/*
*
*	Nightmare abilities
*
*/
G.abilities[9] =[

// 	First Ability: Frozen Tower
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onEndPhase",

	// 	require() :
	require : function(){
		if( this.creature.remainingMove < this.creature.stats.movement ){
			this.message = "The creature moved this round.";
			return false;
		}
		if( this.creature.findEffect("Frostified").length >= this.maxCharge ){
			this.message = "Buff limit reached.";
			return false;
		}
		return this.testRequirements();
	},

	//	activate() :
	activate : function() {

		this.creature.addEffect(
			new Effect(
				'Frostified',
				this.creature,
				this.creature,
				"",
				{
					alterations : { offense : 5, defense : 5 }
				}
			)
		);
	},

	getCharge : function() {
		return { min : 0 , max : this.maxCharge, value: this.creature.findEffect("Frostified").length };
	}
},



// 	Second Ability: Icy Talons
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( this.creature.getHexMap(frontnback2hex),"ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //Team, 0 = ennemies
			id : this.creature.id,
			flipped : this.creature.flipped,
			hexs : this.creature.getHexMap(frontnback2hex),
		});
	},


	//	activate() :
	activate : function(target,args) {
		var ability = this;
		ability.end();

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[
				new Effect(
					'Icy Talons',
					this.creature,
					this.target,
					"",
					{ alterations : { frost : -1 } }
				)
			]	//Effects
		);

		target.takeDamage(damage);
	},
},



// 	Thirt Ability: Tail Uppercut
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( this.creature.getHexMap(frontnback2hex),"ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //Team, 0 = ennemies
			id : this.creature.id,
			flipped : this.creature.flipped,
			hexs : this.creature.getHexMap(frontnback2hex),
		});
	},


	//	activate() :
	activate : function(target,args) {
		var ability = this;
		ability.end();

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);

		var result = target.takeDamage(damage);

		if( result.kill == true || result.damageObj.status != "") return;

		if( target.delayable ){
			target.delay();
		}
	},
},



// 	Fourth Ability: Icicle Tongue
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	directions : [1,1,1,1,1,1],

	require : function(){
		if( !this.testRequirements() ) return false;

		var crea = this.creature;
		var x = (crea.player.flipped) ? crea.x-crea.size+1 : crea.x ;

		var test = this.testDirection({
			team : "both",
			x : x,
			directions : this.directions,
			distance : 6,
			stopOnCreature : false
		});

		if( !test ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;
		var crea = this.creature;

		var x = (crea.player.flipped) ? crea.x-crea.size+1 : crea.x ;

		G.grid.queryDirection({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 3, //enemies
			id : crea.id,
			requireCreature : true,
			x : x,
			y : crea.y,
			directions : this.directions,
			stopOnCreature : false
		});
	},


	//	activate() :
	activate : function(path,args) {
		var ability = this;

		ability.end();

		for (var i = 0; i < path.length; i++) {
			if(path[i].creature instanceof Creature){
				var trg = path[i].creature;

				var d = { pierce : 10, frost : 6-i };

				//Damage
				var damage = new Damage(
					ability.creature, //Attacker
					"target", //Attack Type
					d, //Damage Type
					1, //Area
					[]	//Effects
				);

				var result = trg.takeDamage(damage);

				if( result.damageObj.status == "Shielded" ) return;
			}
		};



	},
}

];

/*
*
*	Nutcase abilities
*
*/
G.abilities[40] =[

// 	First Ability: Hunting Horn
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onStartPhase",

	//	require() :
	require : function(){
		if( !this.testRequirements() ) return false;
		if( this.atLeastOneTarget( this.creature.adjacentHexs(1),"ennemy" ) ){
			return false;
		}
		return true;
	},

	//	activate() :
	activate : function() {
		this.end();

		for (var i = 1; i < 99; i++) {
			var hexs = this.creature.adjacentHexs(i);
			if( !this.atLeastOneTarget( hexs,"ennemy" ) ) continue;

			var targets = this.getTargets(hexs);

			if(targets.length>0){
				var target = (this.creature.flipped) ? { x : 9999 } : { x : -1 };
				for (var j = 0; j < targets.length; j++) {
					if(targets[j] == undefined) continue;
					if(targets[j].target.isAlly(this.creature.team)) continue;

					if(this.creature.flipped){
						if(targets[j].target.x < target.x) target = targets[j].target;
					}else{
						if(targets[j].target.x > target.x) target = targets[j].target;
					}
				};
				break;
			}
		};

		if( !(target instanceof Creature) ) return;


		//Search best hex
		G.grid.cleanReachable(); //If not pathfinding will bug
		G.grid.cleanPathAttr(true); //Erase all pathfinding datas
		astar.search(G.grid.hexs[this.creature.y][this.creature.x],new Hex(-2,-2,null),this.creature.size,this.creature.id);



		var bestHex = {g:9999};

		for (var i = 1; i < 99; i++) {
			var hexs = target.adjacentHexs(i).extendToRight(this.creature.size);

			for (var i = 0; i < hexs.length; i++) {
				if( hexs[i].g != 0 && hexs[i].g < bestHex.g ) { bestHex = hexs[i]; }
			};
			if(bestHex instanceof Hex) break;
		};

		if( bestHex.x == undefined ) return;

		this.creature.moveTo( bestHex, { customMovementPoint : 2 } );
		this.creature.delayable = false;
	},
},



//	Second Ability: Hammer Time
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( this.creature.getHexMap(frontnback2hex),"ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}

		return true;
	},

	//	query() :
	query : function(){
		var ability = this;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //Team, 0 = ennemies
			id : this.creature.id,
			flipped : this.creature.flipped,
			hexs : this.creature.getHexMap(frontnback2hex)
		});
	},


	//	activate() :
	activate : function(target,args) {
		var ability = this;
		ability.end();

		var effect = new Effect(
			"Hammered", //Name
			ability.creature, //Caster
			target, //Target
			"", //Trigger
			{
				alterations : {movement : -1},
				turnLifetime : 1,
			}
		);

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[effect]	//Effects
		);

		target.takeDamage(damage);
	},
},



//	Thirt Ability: Fishing Hook
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget(
				this.creature.getHexMap(inlinefrontnback2hex),"ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	//	query() :
	query : function(){
		var ability = this;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //Team, 0 = ennemies
			id : this.creature.id,
			flipped : this.creature.flipped,
			hexs : this.creature.getHexMap(inlinefrontnback2hex),
		});
	},


	//	activate() :
	activate : function(target,args) {
		var ability = this;
		var crea = ability.creature;
		ability.end();

		var damage = new Damage(
			crea, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);

		// Swap places
		if( target.size > 2 ){
			target.takeDamage(damage);
			return;
		}

		var trgIsInfront = (G.grid.getHexMap(crea.x-inlinefront2hex.origin[0],crea.y-inlinefront2hex.origin[1],0,false,inlinefront2hex)[0].creature == target);

		crea.moveTo(
			G.grid.hexs[target.y][ target.size == 1 && !trgIsInfront ? target.x+1 : target.x ],
			{
				ignorePath:true,
				ignoreMovementPoint:true,
				callback:function(){
					target.updateHex();
					G.grid.updateDisplay();
					target.takeDamage(damage);
				}
			}
		);
		target.moveTo(
			G.grid.hexs[crea.y][ target.size == 1 && trgIsInfront ? crea.x-1 : crea.x ],
			{
				ignorePath:true,
				ignoreMovementPoint:true,
				callback:function(){
					crea.updateHex();
					G.grid.updateDisplay();
					crea.queryMove();
				}
			}
		);
	},
},



//	Fourth Ability: Tentacle Bush
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	require : function(){
		if( !this.testRequirements() ) return false;
		return true;
	},

	//	query() :
	query : function(){
		var ability = this;
		var creature = this.creature;

		G.grid.querySelf({fnOnConfirm : function(){ ability.animation.apply(ability,arguments); }});
	},


	//	activate() :
	activate : function() {
		var ability = this;
		ability.end();

		var effect = new Effect(
			"Curled", //Name
			ability.creature, //Caster
			ability.creature, //Target
			"onDamage", //Trigger
			{
				alterations : { moveable : false, fatigueImmunity : true },
				turn : G.turn,
				turnLifetime : 1,
				deleteTrigger : "onStartPhase"
			}
		);

		ability.creature.addEffect(effect);
		G.skipTurn({noTooltip:true});
	},
}

];

/*
*
*	Scavenger abilities
*
*/
G.abilities[44] =[

// 	First Ability: Feathered Body
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "",

	// 	require() :
	require : function(){
		return true;
	},

	//	activate() :
	activate : function(){
	},
},



// 	Second Ability: Slicing Talon
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( this.creature.getHexMap(frontnback2hex),"ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //Team, 0 = ennemies
			id : this.creature.id,
			flipped : this.creature.flipped,
			hexs : this.creature.getHexMap(frontnback2hex),
		});
	},


	//	activate() :
	activate : function(target,args) {
		var ability = this;
		ability.end();

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);

		target.takeDamage(damage);
	},
},



// 	Third Ability: Escort Service
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		var crea = this.creature;

		var hexs = crea.getHexMap(inlinefrontnback2hex)

		if( hexs.length < 2 ){
			//At the border of the map
			return false;
		}

		if( hexs[0].creature && hexs[1].creature ){
			//Sandwiched
			return false;
		}

		//Filter 3h creatures
		hexs.filter(function(){
			if( !this.creature ) return false;
			return (this.creature.size < 3);
		});

		if( !this.atLeastOneTarget( hexs, "both" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}

		var trg = hexs[0].creature || hexs[1].creature;

		if( !trg.stats.moveable ){
			this.message = "Target is not moveable.";
			return false;
		}

		if( crea.remainingMove < trg.size ){
			//Not enough move points
			this.message = "Not enough movement points.";
			return false;
		}

		return true;
	},

	// 	query() :
	query : function(){

		var ability = this;
		var crea = this.creature;

		var hexs = crea.getHexMap(inlinefrontnback2hex);
		var trg = hexs[0].creature || hexs[1].creature;

		var ability = this;
		var crea = this.creature;

		var distance = Math.floor(crea.remainingMove/trg.size);
		var size = crea.size+trg.size;

		var trgIsInfront = (G.grid.getHexMap(crea.x-inlinefront2hex.origin[0],crea.y-inlinefront2hex.origin[1],0,false,inlinefront2hex)[0].creature == trg);

		var select = function(hex,args){
			for (var i = 0; i < size; i++) {
				if( !G.grid.hexExists(hex.y,hex.x-i) ) continue;
				var h = G.grid.hexs[hex.y][hex.x-i];
				if(trgIsInfront){
					var color = i<trg.size ? trg.team : crea.team;
				}else{
					var color = i>1 ? trg.team : crea.team;
				}
				h.overlayVisualState("creature moveto selected player"+color);
			};
		}

		var x = ( trgIsInfront ? crea.x+trg.size : crea.x );

		G.grid.queryHexs({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); }, //fnOnConfirm
			fnOnSelect : select, //fnOnSelect,
			team : 3, //Both
			id : [crea.id,trg.id],
			size : size,
			flipped : crea.player.flipped,
			hexs : G.grid.getFlyingRange(x,crea.y,distance,size,[crea.id,trg.id]).filter(function(){
				return crea.y == this.y &&
					( trgIsInfront ?
						 this.x < x :
						 this.x > x-crea.size-trg.size+1
					);
				}),
			args : {trg : trg.id, trgIsInfront: trgIsInfront}
		});
	},


	//	activate() :
	activate : function(hex,args) {
		var ability = this;
		ability.end();

		var crea = this.creature;

		var trg = G.creatures[args.trg];
		var size = crea.size+trg.size;

		var trgIF = args.trgIsInfront;

		var crea_dest 	= G.grid.hexs[hex.y][ trgIF ? hex.x-trg.size : hex.x ];
		var trg_dest 	= G.grid.hexs[hex.y][ trgIF ? hex.x : hex.x-crea.size ];

		//Determine distance
		var distance = 0;
		var k = 0;
		var start = G.grid.hexs[crea.y][crea.x];
		while(!distance){
			k++;
			if( start.adjacentHex(k).findPos(crea_dest) ) distance = k;
		}

		//substract from movement points
		crea.remainingMove -= distance*trg.size;

		crea.moveTo(crea_dest,{
			animation : "fly",
			callback : function(){
				trg.updateHex();
				G.grid.updateDisplay();
			},
			ignoreMovementPoint : true
		});

		trg.moveTo(trg_dest,{
			animation : "fly",
			callback : function(){
				ability.creature.updateHex();
				G.grid.updateDisplay();
				ability.creature.queryMove();
			},
			ignoreMovementPoint : true,
			overrideSpeed : crea.animation.walk_speed
		});

	},
},



// 	Fourth Ability: Venom Strike
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( this.creature.getHexMap(frontnback2hex),"ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //Team, 0 = ennemies
			id : this.creature.id,
			flipped : this.creature.flipped,
			hexs : this.creature.getHexMap(frontnback2hex),
		});
	},


	//	activate() :
	activate : function(target,args) {
		var ability = this;
		ability.end();

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);

		target.takeDamage(damage);

		ability.damages.poison -= ability.damages.poison == 10 ? 0 : 10;
		G.UI.checkAbilities();
	},
}

];

/*
*
*	Snow Bunny abilities
*
*/
G.abilities[12] = [

// 	First Ability: Bunny Hopping
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onOtherCreatureMove",

	// 	require() :
	require : function(destHex){
		if( !this.testRequirements() ) return false;

		if( this.used ) return false; //Once per turn

		if( !destHex ) return false; //If destHex is undefined

		if( destHex.creature.isAlly(this.creature.team) ) return false;

		var frontHexs = this.creature.getHexMap(front1hex);

		var id = -1;
		destHex.creature.hexagons.each(function(){
			id = ( frontHexs.indexOf(this) > id ) ? frontHexs.indexOf(this) : id;
		});

		switch( id ){
			case 0 :
				var hex = this.creature.getHexMap(backbottom1hex)[0];
				if( hex == undefined || !hex.isWalkable(this.creature.size,this.creature.id,true) ){
					var hex = this.creature.getHexMap(frontbottom1hex)[0];
				}
				break;
			case 1 :
				var hex = this.creature.getHexMap(inlineback1hex)[0];
				break;
			case 2 :
				var hex = this.creature.getHexMap(backtop1hex)[0];
				if( hex == undefined || !hex.isWalkable(this.creature.size,this.creature.id,true) ){
					var hex = this.creature.getHexMap(fronttop1hex)[0];
				}
				break;
			default : return false;
		}

		if( hex == undefined ) return false;

		return hex.isWalkable(this.creature.size,this.creature.id,true);
	},

	//	activate() :
	activate : function(destHex) {
		var ability = this;
		ability.end();

		var frontHexs = this.creature.getHexMap(front1hex);

		var id = -1;
		destHex.creature.hexagons.each(function(){
			id = ( frontHexs.indexOf(this) > id ) ? frontHexs.indexOf(this) : id;
		});

		switch( id ){
			case 0 :
				var hex = this.creature.getHexMap(backbottom1hex)[0];
				if( hex == undefined || !hex.isWalkable(this.creature.size,this.creature.id,true) ){
					var hex = this.creature.getHexMap(frontbottom1hex)[0];
				}
				break;
			case 1 :
				var hex = this.creature.getHexMap(inlineback1hex)[0];
				break;
			case 2 :
				var hex = this.creature.getHexMap(backtop1hex)[0];
				if( hex == undefined || !hex.isWalkable(this.creature.size,this.creature.id,true) ){
					var hex = this.creature.getHexMap(fronttop1hex)[0];
				}
				break;
			default : return false;
		}

		this.creature.moveTo(hex,{
			callback : function(){	G.activeCreature.queryMove(); },
			ignorePath : true,
		});

	},
},



// 	Second Ability: Big Nip
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( this.creature.adjacentHexs(1),"ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){

		var ability = this;
		var snowBunny = this.creature;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //Team, 0 = ennemies
			id : snowBunny.id,
			flipped : snowBunny.player.flipped,
			hexs : snowBunny.adjacentHexs(1),
		});
	},


	//	activate() :
	activate : function(target,args) {
		var ability = this;
		ability.end();

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);
		target.takeDamage(damage);
	},
},



// 	Third Ability: Blowing Wind
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	directions : [1,1,1,1,1,1],

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		var test = this.testDirection({
			team : "both",
			directions : this.directions,
		});
		if( !test ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;
		var snowBunny = this.creature;

		G.grid.queryDirection({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			flipped : snowBunny.player.flipped,
			team : 3, //Both
			id : snowBunny.id,
			requireCreature : true,
			x : snowBunny.x,
			y : snowBunny.y,
			directions : this.directions,
		});
	},


	//	activate() :
	activate : function(path,args) {
		var ability = this;
		ability.end();

		var target = path.last().creature;
		var dist = 5 - target.size;
		var dir = [];
		switch( args.direction ){
			case 0: //Upright
				dir = G.grid.getHexMap(target.x,target.y-8,0,target.flipped,diagonalup).reverse();
				break;
			case 1: //StraitForward
				dir = G.grid.getHexMap(target.x,target.y,0,target.flipped,straitrow);
				break;
			case 2: //Downright
				dir = G.grid.getHexMap(target.x,target.y,0,target.flipped,diagonaldown);
				break;
			case 3: //Downleft
				dir = G.grid.getHexMap(target.x,target.y,-4,target.flipped,diagonalup);
				break;
			case 4: //StraitBackward
				dir = G.grid.getHexMap(target.x,target.y,0,!target.flipped,straitrow);
				break;
			case 5: //Upleft
				dir = G.grid.getHexMap(target.x,target.y-8,-4,target.flipped,diagonaldown).reverse();
				break;
			default:
				break;
		}

		dir = dir.slice(0,dist+1);

		var hex = target.hexagons[0];
		for (var j = 0; j < dir.length; j++) {
			if(dir[j].isWalkable(target.size,target.id,true)){
				hex = dir[j];
			}else{
				break;
			}
		};

		target.moveTo(hex,{
			ignoreMovementPoint : true,
			ignorePath : true,
			callback : function(){
				G.activeCreature.queryMove();
			},
			animation : "push",
		});
	},
},



// 	Fourth Ability: Chilling Spit
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		var test = this.testDirection({
			team : "ennemy",
			directions : this.directions,
		});
		if( !test ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){

		var ability = this;
		var snowBunny = this.creature;

		G.grid.queryDirection({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			flipped : snowBunny.player.flipped,
			team : 0, //enemies
			id : snowBunny.id,
			requireCreature : true,
			x : snowBunny.x,
			y : snowBunny.y,
			directions : [1,1,1,1,1,1],
		});
	},


	//	activate() :
	activate : function(path,args) {
		var ability = this;
		ability.end();

		var crea = path.last().creature;
		var dist = path.slice(0).filterCreature(false,false).length;

		//Copy to not alter ability strength
 		var dmg = $j.extend({},ability.damages);
 		dmg.crush += 4*dist; //Add distance to crush damage

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			dmg, //Damage Type
			1, //Area
			[]	//Effects
		)

		crea.takeDamage(damage);
	},

	animation_datas : {
		visual : function(path,args){

			var crea = path.last().creature;
			if( args.direction == 1 || args.direction == 4 ){
				var targetHex = path[ path.length - 1 - crea.size ];
			}else{
				var targetHex = path.last();
			}
			var dist = path.slice(0).filterCreature(false,false).length;

			var emissionPoint = {x: this.creature.grp.x+52, y: this.creature.grp.y-20};
			var targetPoint = {x: targetHex.displayPos.x+52, y: targetHex.displayPos.y-20};

			var duration = this.animation_datas.delay = dist*75; //100ms for each hex
			this.animation_datas.delay += 350; //350ms for the creature animation before the projectile

			setTimeout(function(){
				var sprite = G.grid.creatureGroup.create(emissionPoint.x, emissionPoint.y, "effects_chilling-spit");
				sprite.anchor.setTo(0.5, 0.5);
				sprite.rotation = -Math.PI/3 + args.direction * Math.PI/3;
				var tween = G.Phaser.add.tween(sprite)
				.to({x:targetPoint.x,y:targetPoint.y},duration,Phaser.Easing.Linear.None)
				.start();
				tween._lastChild.onComplete.add(function(){ sprite.destroy() },this);
			},350);//350ms for the creature animation before the projectile

		},
		duration : 500,
		delay : 350,
	},
}

];

/*
*
*	Swine Thug abilities
*
*/
G.abilities[37] =[

// 	First Ability: Spa Mud
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onCreatureMove",

	// 	require() :
	require : function(hex){
		if( !this.testRequirements() ) return false;

		if(hex == undefined) hex = this.creature.hexagons[0];
		this.message = "";
		if(hex.trap){
			if(hex.trap.type == "mud-bath"){
				return true;
			}
		}

		this.message = "Not in a mud bath.";

		this.creature.effects.each(function(){
			if(this.trigger == "mud-bath")
				this.deleteEffect();
		});
		return false;
	},

	//	activate() :
	activate : function(hex) {
		var effect = new Effect("Spa Mud",this.creature,this.creature,"mud-bath",{
			alterations : this.effects[0]
		});
		this.creature.addEffect(effect);
	},
},



// 	Second Ability: Power Bat
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( this.creature.adjacentHexs(1), "ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){

		var ability = this;
		var swine = this.creature;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); }, //fnOnConfirm
			team : 0, //Team, 0 = ennemies
			id : swine.id,
			flipped : swine.player.flipped,
			hexs : swine.adjacentHexs(1),
		});
	},


	//	activate() :
	activate : function(target,args) {
		var ability = this;
		ability.end();

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);
		target.takeDamage(damage);
	},
},



// 	Third Ability: Ground Ball
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		var swine = this.creature;
		var hexs = G.grid.getHexMap(swine.x,swine.y-2,0,false,bellowrow).filterCreature(true,true,swine.id,swine.team).concat(
			G.grid.getHexMap(swine.x,swine.y,0,false,straitrow).filterCreature(true,true,swine.id,swine.team),
			G.grid.getHexMap(swine.x,swine.y,0,false,bellowrow).filterCreature(true,true,swine.id,swine.team),
			G.grid.getHexMap(swine.x,swine.y-2,0,true,bellowrow).filterCreature(true,true,swine.id,swine.team),
			G.grid.getHexMap(swine.x,swine.y,0,true,straitrow).filterCreature(true,true,swine.id,swine.team),
			G.grid.getHexMap(swine.x,swine.y,0,true,bellowrow).filterCreature(true,true,swine.id,swine.team));
		if( !this.atLeastOneTarget( hexs, "ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}

		return true;
	},

	// 	query() :
	query : function(){

		var ability = this;
		var swine = this.creature;

		var choices = [
			//Front
			G.grid.getHexMap(swine.x,swine.y-2,0,false,bellowrow),
			G.grid.getHexMap(swine.x,swine.y,0,false,straitrow),
			G.grid.getHexMap(swine.x,swine.y,0,false,bellowrow),
			//Behind
			G.grid.getHexMap(swine.x,swine.y-2,0,true,bellowrow),
			G.grid.getHexMap(swine.x,swine.y,0,true,straitrow),
			G.grid.getHexMap(swine.x,swine.y,0,true,bellowrow),
		];

		choices.each(function(){
			this.filterCreature(true,true,swine.id,swine.team);
		});

		G.grid.queryChoice({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); }, //fnOnConfirm
			team : 0,
			requireCreature : 1,
			id : swine.id,
			flipped : swine.flipped,
			choices : choices,
		});
	},


	//	activate() :
	activate : function(path,args) {
		var ability = this;
		ability.end();

		var target = path.last().creature;

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);
		target.takeDamage(damage);
	},
},



// 	Fourth Ability: Mud Bath
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	require : function(){
		return this.testRequirements();
	},

	// 	query() :
	query : function(){

		var ability = this;
		var swine = this.creature;

		var hexs = G.grid.getFlyingRange(swine.x,swine.y,50,1,0);

		//TODO Filtering corpse hexs
		hexs.filter(function(){return true;});

		G.grid.hideCreatureHexs(this.creature);

		G.grid.queryHexs({
			fnOnCancel : function(){ G.activeCreature.queryMove(); G.grid.clearHexViewAlterations(); },
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			hexs : hexs,
		});
	},


	//	activate() :
	activate : function(hex,args) {
		G.grid.clearHexViewAlterations();
		var ability = this;
		ability.end();

		var effects = [
			new Effect(
				"Slow Down",ability.creature,hex,"onStepIn",
				{
					requireFn: function(){
						if(this.trap.hex.creature==0) return false;
						return (this.trap.hex.creature.type != "A1" && !this.trap.hex.creature.canFly);
					},
					effectFn: function(effect,crea){ crea.remainingMove--; },
				}
			),
		]


		hex.createTrap("mud-bath",effects,ability.creature.player);

	},
}

];

/*
*
*	Uncle Fungus abilities
*
*/
G.abilities[3] =[

// First Ability: Toxic Spores
{
	// Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onStepIn onStartPhase onOtherStepIn",

	priority : 10,

	// require() :
	require : function(hex){
		if( !this.atLeastOneTarget( this.creature.adjacentHexs(1),"ennemy" ) ) return false;

		if( hex instanceof Hex && hex.creature instanceof Creature && hex.creature != this.creature){

			var targets = this.getTargets(hex.creature.adjacentHexs(1));

			var isAdj = false;

			// Search if Uncle is adjacent to the creature that is moving
			for (var i = 0; i < targets.length; i++) {
				if( targets[i] == undefined ) continue;
				if( !(targets[i].target instanceof Creature) ) continue;
				if( targets[i].target == this.creature ) isAdj = true;
			};

			if( !isAdj ) return false;
		}

		var targets = this.getTargets(this.creature.adjacentHexs(1));

		for (var i = 0; i < targets.length; i++) {
			if( targets[i] == undefined ) continue;
			if( !(targets[i].target instanceof Creature) ) continue;
			if( !targets[i].target.isAlly(this.creature.team) && targets[i].target.findEffect(this.title).length == 0 )
				return this.testRequirements();
		};

		return false
	},

	// activate() :
	activate : function(hex) {

		var ability = this;
		var creature = this.creature;
		var targets = this.getTargets(this.creature.adjacentHexs(1));

		targets.each(function(){
			if( !(this.target instanceof Creature) ) return;

			var trg = this.target;

			if(trg.team%2 != creature.team%2){ // If foe

				var optArg = {
					alterations : ability.effects[0],
					creationTurn : G.turn-1,
					turnLifetime : 1,
					deleteTrigger : "onEndPhase",
					stackable : false
				};

				ability.end();

				// Spore Contamination
				var effect = new Effect(
					ability.title, // Name
					creature, // Caster
					trg, // Target
					"", // Trigger
					optArg // Optional arguments
				);

				trg.addEffect(effect,undefined,"Contaminated");

				G.log("%CreatureName"+trg.id+"%'s regrowth is lowered by "+ability.effects[0].regrowth);

				ability.setUsed(false); // Infinite triggering
			}
		})
	},
},



//	Second Ability: Supper Chomp
{
	// Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		// At least one target
		if( !this.atLeastOneTarget(this.creature.getHexMap(frontnback2hex),"ennemy") ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// query() :
	query : function(){
		var uncle = this.creature;
		var ability = this;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, // Team, 0 = ennemies
			id : uncle.id,
			flipped : uncle.flipped,
			hexs : uncle.getHexMap(frontnback2hex),
		});
	},


	// activate() :
	activate : function(target,args) {
		var ability = this;
		ability.end();

		var damage = new Damage(
			ability.creature, // Attacker
			"target", // Attack Type
			ability.damages, // Damage type
			1, // Area
			[]	// Effects
		);

		var dmg = target.takeDamage(damage);

		if(dmg.damageObj.status == ""){

			var amount = Math.max(Math.round(dmg.damages.total/4),1);

			// Regrowth bonus
			ability.creature.addEffect( new Effect(
				ability.title, // Name
				ability.creature, // Caster
				ability.creature, // Target
				"", // Trigger
				{
					turnLifetime : 1,
					deleteTrigger : "onStartPhase",
					alterations : {regrowth : amount }
				} // Optional arguments
			), "%CreatureName"+ability.creature.id+"% gained "+amount+" temporary regrowth", //Custom Log
			"Regrowth++" );	// Custom Hint
		}

		// Remove frogger bonus if its found
		ability.creature.effects.each(function(){
			if(this.name == "Frogger Bonus"){
				this.deleteEffect();
			}
		});
	},
},



// Third Ability: Frogger Jump
{
	// Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	require : function(){return this.testRequirements();},

	fnOnSelect : function(hex,args){
		this.creature.tracePosition({ x: hex.x, y: hex.y, overlayClass: "creature moveto selected player"+this.creature.team })
	},

	// query() :
	query : function(){
		var ability = this;
		var uncle = this.creature;

		var hexsDashed = [];

		var range = G.grid.allHexs.slice(0); // Copy
		range.filter(function(){
			if(uncle.y == this.y){
				if(this.creature instanceof Creature && this.creature != uncle){
					hexsDashed.push(this);
					return false;
				}
				return true;
			}
			return false;
		});

		G.grid.queryHexs({
			fnOnSelect : function(){ ability.fnOnSelect.apply(ability,arguments); },
			fnOnConfirm : function(){
				if( arguments[0].x == ability.creature.x && arguments[0].y == ability.creature.y ){
					// Prevent null movement
					ability.query();
					return;
				}
				ability.animation.apply(ability,arguments);
			},
			size :  uncle.size,
			flipped :  uncle.player.flipped,
			id :  uncle.id,
			hexs : range,
			hexsDashed : hexsDashed,
			hideNonTarget : true
		});
	},


	// activate() :
	activate : function(hex,args) {

		var ability = this;
		ability.end(false,true); // Defered ending

		ability.creature.moveTo(hex,{
			ignoreMovementPoint : true,
			ignorePath : true,
			callback : function(){
				G.triggersFn.onStepIn(ability.creature,ability.creature.hexagons[0]);

				var interval = setInterval(function(){
					if(!G.freezedInput){
						clearInterval(interval);
						G.UI.selectAbility(-1);
						G.activeCreature.queryMove();
					}
				},100)
			},
			callbackStepIn : function(hex){
				if(ability.creature.abilities[0].require(hex)){
					ability.creature.abilities[0].activate(hex); // Toxic spores
				}
			}
		});

		// Frogger Leap bonus
		ability.creature.addEffect( new Effect(
			"Offense++", // Name
			ability.creature, // Caster
			ability.creature, // Target
			"onStepIn onEndPhase", // Trigger
			{
				effectFn : function(effect,crea){
					effect.deleteEffect();
				},
				alterations : ability.effects[0]
			} // Optional arguments
		) );
	},
},



// Fourth Ability: Blade Kick
{
	// Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		var map = G.grid.getHexMap(this.creature.x-2,this.creature.y-2,0,false,frontnback2hex);
		// At least one target
		if( !this.atLeastOneTarget(map,"ennemy") ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// query() :
	query : function(){
		var ability = this;
		var uncle = this.creature;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, // Team, 0 = ennemies
			id : uncle.id,
			flipped : uncle.flipped,
			hexs : G.grid.getHexMap(uncle.x-2,uncle.y-2,0,false,frontnback2hex),
		});
	},


	// activate() :
	activate : function(target,args) {
		var ability = this;
		ability.end();

		var damage = new Damage(
			ability.creature, // Attacker
			"target", // Attack Type
			ability.damages, // Damage Type
			1, // Area
			[]	// Effects
		);
		target.takeDamage(damage);

		// Remove frogger bonus if its found
		ability.creature.effects.each(function(){
			if(this.name == "Offense++"){
				this.deleteEffect();
			}
		});
	},
}
];

var socket = io();
var server = {};

// Whenever the server emits 'login', log the login message
  socket.on('login', function (data) {
    server.connected = true;
    // Display the welcome message
    var message = "Connected To Game Server as user: " + data;
    server.userName = data;
    console.log(message);
  });


  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', function (data) {
    log(data.username + ' joined');
    //addParticipantsMessage(data);
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', function (data) {
    log(data.username + ' left');
    //addParticipantsMessage(data);
    //removeChatTyping(data);
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on('typing', function (data) {
    //addChatTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('stop typing', function (data) {
    //removeChatTyping(data);
  });

  // Sends a chat message
function sendMessage () {
  //var message = $inputMessage.val();
  // Prevent markup from being injected into the message
  //message = cleanInput(message);
  // if there is a non-empty message and a socket connection
  //if (message && connected) {
  //  $inputMessage.val('');
  //  addChatMessage({
  //    username: username,
  //    message: message
  //  });
    // tell server to execute 'new message' and send along one parameter
  //  socket.emit('new message', message);
  //  }
}
