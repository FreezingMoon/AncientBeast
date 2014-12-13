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
		$j.extend(true,this,abilities[datas.id][abilityID],datas.ability_info[abilityID]);
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
