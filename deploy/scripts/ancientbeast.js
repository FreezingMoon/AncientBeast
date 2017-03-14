/*	Ability Class
*
*	Class parsing function from creature abilities
*
*/
var Ability = Class.create( {
	initialize: function(creature, abilityID) {
		this.creature = creature;
		this.used = false;
		this.id = abilityID;
		this.priority = 0; // Priority for same trigger
		this.timesUsed = 0;
		this.timesUsedThisTurn = 0;
		this.token = 0;
		var datas = G.retreiveCreatureStats(creature.type);
		$j.extend(true,this,G.abilities[datas.id][abilityID],datas.ability_info[abilityID]);
		if( this.requirements === undefined && this.costs !== undefined ) {
			this.requirements = this.costs;
		}
	},

	hasUpgrade: function() {
		return G.abilityUpgrades >= 0 && this.upgrade;
	},

	/**
	 * Whether this ability upgrades after a certain number of uses. Otherwise it
	 * upgrades after a certain number of rounds.
	 * By default, this applies to active (onQuery) abilities.
	 */
	isUpgradedPerUse: function() {
		return this.trigger === "onQuery";
	},

	usesLeftBeforeUpgrade: function() {
		if (this.isUpgradedPerUse()) {
			return G.abilityUpgrades - this.timesUsed;
		}
		return G.abilityUpgrades - this.creature.turnsActive;
	},

	isUpgraded: function() {
		if (!this.hasUpgrade()) {
			return false;
		}
		return this.usesLeftBeforeUpgrade() <= 0;
	},

	getTrigger: function() {
		if (this.trigger !== undefined) {
			return this.trigger;
		} else if (this.triggerFunc !== undefined) {
			return this.triggerFunc();
		}
		return undefined;
	},

	/**
	 * Reset ability at start of turn.
	 */
	reset: function() {
		this.setUsed(false);
		this.token = 0;
		this.timesUsedThisTurn = 0;
	},

	/* use()
	*
	*	Test and use the ability
	*
	*/
	use: function() {
		if( this.getTrigger() !== "onQuery" ) return;
		if( !this.require() ) return;
		if( this.used === true ) { G.log("Ability already used!"); return; }
		G.grid.clearHexViewAlterations();
		G.clearOncePerDamageChain();
		G.activeCreature.hint(this.title,"msg_effects");
		return this.query();
	},

	/*	end()
	*
	*	End the ability. Must be called at the end of each ability function;
	*
	*/
	end: function(desableLogMsg, deferedEnding) {
		if(!desableLogMsg) G.log("%CreatureName" + this.creature.id + "% uses " + this.title);
		this.applyCost();
		this.setUsed(true); // Should always be here
		G.UI.updateInfos(); // Just in case
		G.UI.btnDelay.changeState("disabled");
		G.activeCreature.delayable = false;
		G.UI.selectAbility(-1);
		if(this.getTrigger() === "onQuery" && !deferedEnding) {
			G.activeCreature.queryMove();
		}
	},

	/*	setUsed(val)
	*
	*	val :	Boolean :	set the used attriute to the desired value
	*
	*/
	setUsed: function(val) {
		if(val) {
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

	/**
	 * Called after activate(); primarily to set times used so that isUpgraded is
	 * correct within activate().
	 */
	postActivate: function() {
		this.timesUsed++;
		this.timesUsedThisTurn++;
		// Update upgrade information
		G.UI.updateAbilityButtonsContent();
	},

	/*	animation()
	*
	*	Animate the creature
	*
	*/
	animation: function() {

		// Gamelog Event Registration
		if( G.triggers.onQuery.test(this.getTrigger()) ) {
			if(arguments[0] instanceof Hex) {
				var args = $j.extend( {}, arguments);
				delete args[0];
				G.gamelog.add( {action:"ability",target:{type: "hex", x: arguments[0].x, y: arguments[0].y }, id: this.id, args: args } );
			}
			if(arguments[0] instanceof Creature) {
				var args = $j.extend( {}, arguments);
				delete args[0];
				G.gamelog.add( { action: "ability", target: { type: "creature", crea: arguments[0].id }, id: this.id, args: args } );
			}
			if(arguments[0] instanceof Array) {
				var args = $j.extend( {}, arguments);
				delete args[0];
				var array = [];
				arguments[0].each(function() { array.push( {x: this.x, y: this.y } ); });
				G.gamelog.add( { action: "ability", target: { type: "array", array: array }, id: this.id, args: args } );
			}
		} else {
			// Test for materialization sickness
			if(this.creature.materializationSickness && this.affectedByMatSickness) return false;
		}

		return this.animation2( { arg: arguments } );
	},

	animation2: function(o) {

		var opt = $j.extend( {
			callback: function() {},
			arg: {},
		},o);

		var ab = this;
		var args = opt.arg;

		var activateAbility = function() {
			ab.activate.apply(ab,args);
			ab.postActivate();
		};

		G.freezedInput = true;

		// Animate
		var p0 = this.creature.sprite.x;
		var p1 = p0;
		var p2 = p0;

		p1 += (this.creature.player.flipped)? 5 : -5;
		p2 += (this.creature.player.flipped)? -5 : 5;

		// Play animations and sounds only for active abilities
		if( this.getTrigger() === 'onQuery' ) {
			var anim_id = Math.random();

			G.animationQueue.push(anim_id);

			var animationData = {
				duration: 500, delay: 350, activateAnimation: true
			};
			if (this.getAnimationData) {
				animationData = $j.extend(
					animationData, this.getAnimationData.apply(this, args));
			}

			if (animationData.activateAnimation) {
				var tween = G.Phaser.add.tween(this.creature.sprite)
				.to({x:p1}, 250, Phaser.Easing.Linear.None)
				.to({x:p2}, 100, Phaser.Easing.Linear.None)
				.to({x:p0}, 150, Phaser.Easing.Linear.None)
				.start();
			}

			setTimeout(function() {
				if( !G.triggers.onUnderAttack.test(ab.getTrigger()) ) {
					G.soundsys.playSound(G.soundLoaded[2], G.soundsys.effectsGainNode);
					activateAbility();
				}
			}, animationData.delay);

			setTimeout(function() {
				G.animationQueue.filter(function() { return (this!=anim_id); } );
				if( G.animationQueue.length === 0 ) {
					G.freezedInput = false;
				}
			}, animationData.duration);

		}else{
			activateAbility();
			G.freezedInput = false;
		}

		var interval = setInterval(function() {
			if(!G.freezedInput) {
				clearInterval(interval);
				opt.callback();
			}
		},100);
	},


	/*	getTargets(hexs)
	*
	*	hexs : Array : Contains the targeted hexagons
	*
	*	return : Array : Contains the target units
	*
	*/
	getTargets: function(hexs) {
		var targets = {};
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
		targetsList = [];
		for(id in targets) {
			targetsList.push(targets[id]);
		}
		return targetsList;
	},

	getFormatedCosts : function() {
		if( !this.costs ) return false;
		return this.getFormatedDamages(this.costs);
	},

	getFormatedDamages : function(obj) {
		if( !this.damages && !obj ) return false;
		var obj = obj || this.damages;
		var string = "";
		var creature = this.creature;

		$j.each(obj,function(key, value) {

			if(key == "special") {
				// TODO: don't manually list all the stats and masteries when needed
				string += value.replace(/%(health|regrowth|endurance|energy|meditation|initiative|offense|defense|movement|pierce|slash|crush|shock|burn|frost|poison|sonic|mental)%/g, '<span class="$1"></span>');
				return;
			}

			if (key === 'energy') {
				value += creature.stats.reqEnergy;
			}

			if(string !== "") string += ", ";
			string += (value+'<span class="' + key + '"></span>');
		});
		return string;
	},

	getFormatedEffects : function() {
		if( !this.effects ) return false;
		var string = "";
		for (var i = this.effects.length - 1; i >= 0; i--) {

			if(this.effects[i].special) {
				// TODO: don't manually list all the stats and masteries when needed
				string += this.effects[i].special.replace(/%(health|regrowth|endurance|energy|meditation|initiative|offense|defense|movement|pierce|slash|crush|shock|burn|frost|poison|sonic|mental)%/g, '<span class="$1"></span>');
				continue;
			}

			$j.each(this.effects[i],function(key, value) {
			if(string !== "") string += ", ";
			string += (value+'<span class="' + key + '"></span>');
		});
		}

		return string;
	},

	/*	areaDamage(targets)
	*
	*	targets : Array : Example : target = [ { target: crea1, hexsHit: 2 }, { target: crea2, hexsHit: 1 } ]
	*/
	areaDamage: function(attacker, damages, effects, targets, ignoreRetaliation) {
		var multiKill = 0;
		for (var i = 0; i < targets.length; i++) {
			if(targets[i]===undefined) continue;
			dmg = new Damage(attacker, damages, targets[i].hexsHit, effects);
			var damageResult = targets[i].target.takeDamage(
				dmg, { ignoreRetaliation: ignoreRetaliation });
			multiKill += damageResult.kill + 0;
		}
		if(multiKill>1)	attacker.player.score.push( { type: "combo", kills: multiKill } );
	},

	/**
	 * Return whether there is at least one creature in the hexes that satisfies
	 * various conditions, e.g. team.
	 * @param {Hex[]} hexes
	 * @param {object} o
	 */
	atLeastOneTarget: function(hexes, o) {
		var defaultOpt = {
			team: Team.both,
			optTest: function(creature) { return true; }
		};
		o = $j.extend(defaultOpt, o);
		for (var i = 0; i < hexes.length; i++) {
			var creature = hexes[i].creature;
			if (!creature) continue;
			if (!isTeam(this.creature, creature, o.team)) continue;
			if (!o.optTest(creature)) continue;
			return true;
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

		var req = $j.extend(def, this.requirements);

		// Plasma
		if(req.plasma > 0 ) {
			if( this.creature.player.plasma < req.plasma ) {
				this.message = G.msg.abilities.notenough.replace("%stat%", "plasma");
				return false;
			}
		}else if(req.plasma < 0 ) {
			if( this.creature.player.plasma > -req.plasma ) {
				this.message = G.msg.abilities.toomuch.replace("%stat%", "plasma");
				return false;
			}
		}

		// Energy
		var reqEnergy = req.energy + this.creature.stats.reqEnergy;
		if (reqEnergy > 0) {
			if (this.creature.energy < reqEnergy) {
				this.message = G.msg.abilities.notenough.replace("%stat%", "energy");
				return false;
			}
		} else if (reqEnergy < 0) {
			if (this.creature.energy > -reqEnergy) {
				this.message = G.msg.abilities.toomuch.replace("%stat%", "energy");
				return false;
			}
		}

		// Endurance
		if(req.endurance  > 0 ) {
			if( this.creature.endurance < req.endurance ) {
				this.message = G.msg.abilities.notenough.replace("%stat%", "endurance");
				return false;
			}
		}else if(req.endurance  < 0 ) {
			if( this.creature.endurance > -req.endurance ) {
				this.message = G.msg.abilities.toomuch.replace("%stat%", "endurance");
				return false;
			}
		}

		// Health
		if(req.health  > 0 ) {
			if( this.creature.health <= req.health ) {
				this.message = G.msg.abilities.notenough.replace("%stat%", "health");
				return false;
			}
		}else if(req.health  < 0 ) {
			if( this.creature.health > -req.health ) {
				this.message = G.msg.abilities.toomuch.replace("%stat%", "health");
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
		$j.each(this.costs, function(key, value) {
			if( typeof(value) == "number" ) {
				if(key == 'health') {
					crea.hint(value,'damage d'+value);
					G.log("%CreatureName" + crea.id + "% loses " + value + " health");
				} else if (key === 'energy') {
					value += crea.stats.reqEnergy;
				}
				crea[key] = Math.max( crea[key]-value, 0 ); // Cap
			}
		} );
		crea.updateHealth();
		if( crea.id == G.activeCreature.id ) G.UI.energyBar.animSize( crea.energy/crea.stats.energy );
	},

	/**
	 * Test and get directions where there are valid targets in directions, using
	 * direction queries
	 * @param o dict of arguments for direction query
	 * @returns array of ints, length of total directions, 1 if direction valid
	 * 	else 0
	 */
	testDirections: function(o) {
		var defaultOpt = {
			team: Team.enemy,
			id : this.creature.id,
			flipped : this.creature.player.flipped,
			x : this.creature.x,
			y : this.creature.y,
			directions : [1, 1, 1, 1, 1, 1],
			includeCrea : true,
			stopOnCreature : true,
			distance : 0,
			sourceCreature : undefined,
		};

		o = $j.extend(defaultOpt,o);

		var outDirections = [];

		for (var i = 0; i < o.directions.length; i++) {
			if (!o.directions[i]) {
				outDirections.push(0);
				continue;
			}
			var fx = 0;

			if( o.sourceCreature instanceof Creature ) {
				if( (!o.sourceCreature.player.flipped && i>2) || (o.sourceCreature.player.flipped && i<3) ) {
					fx =  -1*(o.sourceCreature.size-1);
				}
			}

			var dir = G.grid.getHexLine(o.x+fx, o.y, i, o.flipped);

			if( o.distance > 0 ) dir = dir.slice(0, o.distance+1);

			dir = dir.filterCreature(o.includeCrea, o.stopOnCreature, o.id);
			var isValid = this.atLeastOneTarget(dir, o);
			outDirections.push(isValid ? 1 : 0);
		}
		return outDirections;
	},

	/**
	 * Test whether there are valid targets in directions, using direction queries
	 * @param o dict of arguments for direction query
	 * @returns true if valid targets in at least one direction, else false
	 */
	testDirection : function(o) {
		var directions = this.testDirections(o);
		for (var i = 0; i < directions.length; i++) {
			if (directions[i] === 1) {
				this.message = "";
				return true;
			}
		}
		this.message = G.msg.abilities.notarget;
		return false;
	}
});

abilities = []; // Array containing all javascript methods for abilities

/*
* Damage Class
*
* TODO this documentation needs to be updated with things that are determined dynamically like #melee and #counter
*/
var Damage = Class.create( {

	/**
	*
	*	attacker :	Creature : Unit that initiated the damage
	*	damages :	Object : Object containing the damage by type {frost : 5} for example
	*	area :	Integer : Number of hexagons being hit
	*	effects :	Array : Contains Effect object to apply to the target
	*/
	initialize: function(attacker, damages, area, effects) {
		this.attacker = attacker;
		this.damages = damages;
		this.status = "";
		this.effects = effects;
		this.area = area;
		// Whether this is counter-damage
		this.counter = false;
	},

	/* applyDamage()
	*/
	applyDamage: function() {
		var trg = this.target.stats;
		var dmg = this;
		var atk = dmg.attacker.stats;
		var returnObj = {total:0};

		// DAMAGE CALCULATION
		$j.each(this.damages,function(key, value) {
			var points;
			if(key=="pure") { // Bypass defense calculation
				points = value;
			} else {
				points = Math.round(value * (1 + (atk.offense - trg.defense / dmg.area + atk[key] - trg[key] )/100));
				//For Debuging
				if( G.debugMode ) console.log("damage = " + value + key + "dmg * (1 + (" + atk.offense + "atkoffense - " + trg.defense + "trgdefense / " + dmg.area + "area + " + atk[key] + "atk" + key + " - " + trg[key] + "trg" + key + " )/100)");
			}
			returnObj[key] = points;
			returnObj.total += points;
		});

		returnObj.total = Math.max(returnObj.total, 1); // Minimum of 1 damage

		return returnObj;
	}
});

var Animations = Class.create({

	initialize: function() {},

	movements : {

		savedMvtPoints: 0,

		walk : function(crea,path,opts){

			if( opts.customMovementPoint > 0 ){

				path = path.slice(0,opts.customMovementPoint);
				// For compatibility
				this.savedMvtPoints = crea.remainingMove;
				crea.remainingMove = opts.customMovementPoint;
			}

			G.freezedInput = true;

			var anim_id = Math.random();
			G.animationQueue.push(anim_id);

			var hexId = 0;

			crea.healthHide();

			var anim = function() {

				var hex = path[hexId];

				if (hexId < path.length && (crea.remainingMove > 0 || opts.ignoreMovementPoint)) {
					G.animations.movements.leaveHex(crea,hex,opts);
				} else {
					G.animations.movements.movementComplete(
						crea, path[path.length - 1], anim_id, opts);
					return;
				}

				var nextPos = G.grid.hexs[hex.y][hex.x-crea.size+1];
				var speed = !opts.overrideSpeed ? crea.animation.walk_speed : opts.overrideSpeed;

				var tween = G.Phaser.add.tween(crea.grp)
				.to(nextPos.displayPos, parseInt(speed), Phaser.Easing.Linear.None)
				.start();

				// Ignore traps for hover creatures, unless this is the last hex
				var enterHexOpts = $j.extend({
					ignoreTraps: crea.movementType() !== "normal" && hexId < path.length - 1
				}, opts);
				tween.onComplete.add(function() {

					if (crea.dead) {
						// Stop moving if creature has died while moving
						G.animations.movements.movementComplete(crea, hex, anim_id, opts);
						return;
					}

					// Sound Effect
					G.soundsys.playSound(G.soundLoaded[0],G.soundsys.effectsGainNode);

					if(!opts.ignoreMovementPoint){
						crea.remainingMove--;
						if(opts.customMovementPoint === 0) crea.travelDist++;
					}

					G.animations.movements.enterHex(crea, hex, enterHexOpts);


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
				this.savedMvtPoints = crea.remainingMove;
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

			G.animations.movements.leaveHex(crea, start, opts);

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

			G.animations.movements.leaveHex(crea, currentHex, opts);

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

			G.triggersFn.onStepIn(crea, hex, opts);

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
				crea.remainingMove = this.savedMvtPoints;
			}

			G.grid.updateDisplay();

			//TODO turn around animation
			if (opts.turnAroundOnComplete) {
				crea.facePlayerDefault();
			}

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

var CreatureQueue = Class.create({
	initialize: function() {
		this.queue = [];
		this.nextQueue = [];
	},

	/**
	 * Add a creature to the next turn's queue by initiative
	 * @param {Creature} creature - The creature to add
	 */
	addByInitiative: function(creature) {
		for (var i = 0; i < this.nextQueue.length; i++) {
			if (this.nextQueue[i].delayed ||
					this.nextQueue[i].getInitiative() < creature.getInitiative()) {
				this.nextQueue.splice(i, 0, creature);
				return;
			}
		}
		this.nextQueue.push(creature);
	},
	dequeue: function() {
		return this.queue.splice(0, 1)[0];
	},
	remove: function(creature) {
		this.queue.removePos(creature);
		this.nextQueue.removePos(creature);
	},
	nextRound: function() {
		// Copy next queue into current queue
		this.queue = this.nextQueue.slice(0);
		// Sort next queue by initiative (current queue may be reordered)
		this.nextQueue = this.nextQueue.sort(function(a, b) {
			// Sort by initiative descending
			return b.getInitiative() - a.getInitiative();
		});
	},
	isCurrentEmpty: function() {
		return this.queue.length === 0;
	},
	isNextEmpty: function() {
		return this.nextQueue.length === 0;
	},
	delay: function(creature) {
		// Find out if the creature is in the current queue or next queue; remove
		// it from the queue and replace it at the end
		var inQueue = this.queue.removePos(creature) || creature === G.activeCreature;
		var queue = this.queue;
		if (!inQueue) {
			queue = this.nextQueue;
			this.nextQueue.removePos(creature);
		}
		// Move creature to end of queue but in order w.r.t. other delayed creatures
		for (var i = 0; i < queue.length; i++) {
			if (!queue[i].delayed) {
				continue;
			}
			if (queue[i].getInitiative() < creature.getInitiative()) {
				queue.splice(i, 0, creature);
				return;
			}
		}
		queue.push(creature);
	}
});

var Drop = Class.create({

	initialize : function(name,health,energy,x,y){

		this.name 			= name;
		this.id 			= dropID++;
		this.x 				= x;
		this.y 				= y;
		this.pos 			= { x:x, y:y };
		this.health			= health;
		this.energy			= energy;
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

		if(this.health) {
			creature.heal(this.health);
			G.log("%CreatureName"+creature.id+"% gains "+this.health+" health");
		}
		if(this.energy) {
			creature.energy += this.energy;
			G.log("%CreatureName"+creature.id+"% gains "+this.energy+" energy");
		}

		creature.updateAlteration(); // Will cap the stats

		var drop = this;
		var tween = G.Phaser.add.tween(this.display).to( {alpha:0}, 500, Phaser.Easing.Linear.None ).start();
		tween.onComplete.add(function() { drop.display.destroy(); });
	}
});

/*
* Effect Class
*/
var Effect = Class.create( {

	/* Constructor(name, owner, target, trigger, optArgs)
	*
	* @param {string} name: name of the effect
	*	owner :	Creature : Creature that casted the effect
	*	target :	Object : Creature or Hex : the object that possess the effect
	*	trigger :	String : Event that trigger the effect
	*	@param {object} optArgs: dictionary of optional arguments
	*/
	initialize: function(name, owner, target, trigger, optArgs) {
		this.id = effectId++;

		this.name = name;
		this.owner = owner;
		this.target = target;
		this.trigger = trigger;
		this.creationTurn = G.turn;

		var args = $j.extend( {
			// Default Arguments
			requireFn : function() { return true; },
			effectFn : function() {},
			alterations : {},
			turnLifetime : 0,
			deleteTrigger : "onStartOfRound",
			stackable : true,
			noLog : false,
			specialHint : undefined, // Special hint for log
			deleteOnOwnerDeath: false
		},optArgs);

		$j.extend(this,args);

		G.effects.push(this);
	},

	animation: function() {
		this.activate.apply(this, arguments);
	},

	activate: function(arg) {
		if( !this.requireFn(arg) ) return false;
		if( !this.noLog ) console.log("Effect " + this.name + " triggered");
		if (arg instanceof Creature) {
			arg.addEffect(this);
		}
		this.effectFn(this,arg);
	},

	deleteEffect: function() {
		var i = this.target.effects.indexOf(this);
		this.target.effects.splice(i, 1);
		i = G.effects.indexOf(this);
		G.effects.splice(i, 1);
		this.target.updateAlteration();
		console.log("Effect " + this.name + " deleted");
	},

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
var Game = Class.create( {
	/*	Attributes
	*
	*	NOTE : attributes and variables starting with $ are jquery elements
	*	and jquery functions can be called dirrectly from them.
	*
	*	// Jquery attributes
	*	$combatFrame :	Combat element containing all graphics except the UI
	*
	*	// Game elements
	*	players :			Array :	Containing Player objects ordered by player ID (0 to 3)
	*	creatures :			Array :	Contain creatures (creatures[creature.id]) start at index 1
	*
	*	grid :				Grid :	Grid object
	*	UI :				UI :	UI object
	*
	*	queue :				CreatureQueue :	queue of creatures to manage phase order
	*
	*	turn :				Integer :	Number of the current turn
	*
	*	// Normal attributes
	*	playerMode :		Integer :	Number of player in the game
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
		this.activeCreature = { id: 0 };
		this.animations = new Animations();
		this.turn = 0;
		this.queue = new CreatureQueue();
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
		this.realms = ["A", "E", "G", "L", "P", "S", "W"];
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
			44, // Scavenger
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
		this.Phaser = new Phaser.Game(1920, 1080, Phaser.AUTO, 'combatwrapper', { update:function() { G.phaserUpdate(); }, render:function() { G.phaserRender(); } });

		// Msg (TODO External file)
		this.msg = {
			abilities : {
				notarget	   : "No targets available.",
				noplasma	   : "Not enough plasma.",
				nopsy		   : "Psyhelm overload: too many units!",
				alreadyused	   : "Ability already used.",
				toomuch		   : "Too much %stat%.",
				notenough	   : "Not enough %stat%.",
				notmoveable        : "This creature cannot be moved.",
				passivecycle       : "Switch between any usable abilities.",
				passiveunavailable : "No usable abilities to switch to."
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
	loadGame: function(setupOpt) {
		var defaultOpt = {
			playerMode : 2,
			creaLimitNbr : 7,
			unitDrops : 1,
			abilityUpgrades : 4,
			plasma_amount : 50,
			turnTimePool : 60,
			timePool : 5*60,
			background_image : "Frozen Skull",
		};

		this.gameState = "loading";
		setupOpt = $j.extend(defaultOpt,setupOpt);
		$j.extend(this,setupOpt);

		G.startLoading();

		dpcolor = ["blue", "orange", "green", "red"];

		this.loadingSrc = this.availableMusic.length // Music
		+ this.soundEffects.length // Sound effects
		+ 1 // Background
		+ 12 // Hexagons
		+ 8 // Health Frames
		+ 3 // Traps
		+ 2 // Effects
		;

		var i;

		// Music Loading
		this.soundLoaded = {};
		this.soundsys = new Soundsys();
		for (i = 0; i < this.availableMusic.length; i++) {
			this.soundsys.getSound("../media/music/" + this.availableMusic[i], i, function() { G.loadFinish(); } );
		}

		for (i = 0; i < this.soundEffects.length; i++) {
			this.soundsys.getSound("./sounds/" + this.soundEffects[i], this.availableMusic.length + i, function() { G.loadFinish(); } );
		}

		this.Phaser.load.onFileComplete.add(G.loadFinish,G);

		// Health
		var playerColors = ['red', 'blue', 'orange', 'green'];
		for (i = 0; i < 4; i++) {
			this.Phaser.load.image(
				'p' + i + '_health',
				'./interface/rectangle_' + playerColors[i] + '.png');
			this.Phaser.load.image(
				'p' + i + '_plasma',
				'./interface/capsule_' + playerColors[i] + '.png');
			this.Phaser.load.image(
				'p' + i + '_frozen',
				'./interface/rectangle_frozen_' + playerColors[i] + '.png');
		}

		// Grid
		this.Phaser.load.image('hex', './interface/hex.png');
		this.Phaser.load.image('hex_dashed', './interface/hex_dashed.png');
		this.Phaser.load.image('hex_path', './interface/hex_path.png');
		this.Phaser.load.image('cancel', './interface/cancel.png');
		this.Phaser.load.image('input', './interface/hex_input.png');
		for (i = 0; i < 4; i++) {
			this.Phaser.load.image(
				'hex_p' + i,
				'./interface/hex_glowing_' + playerColors[i] + '.png');
			this.Phaser.load.image(
				'hex_hover_p' + i,
				'./interface/hex_outline_' + playerColors[i] + '.png');
		}

		// Traps
		// TODO: Load these sprites only after the specific unit has been materialized
		this.Phaser.load.image('trap_royal-seal', './units/sprites/Gumble - Royal Seal.png');
		this.Phaser.load.image('trap_mud-bath', './units/sprites/Swine Thug - Mud Bath.png');
		this.Phaser.load.image('trap_scorched-ground', './units/sprites/Magma Spawn - Scorched Ground.png');
		this.Phaser.load.image('trap_firewall', './units/sprites/Magma Spawn - Scorched Ground.png');
		this.Phaser.load.image('trap_poisonous-vine', './units/sprites/Impaler - Poisonous Vine.png');

		// Effects
		this.Phaser.load.image('effects_fiery-touch', './units/sprites/Abolished - Fiery Touch.png');
		this.Phaser.load.image('effects_fissure-vent', './units/sprites/Magma Spawn - Fissure Vent.png');
		this.Phaser.load.image('effects_freezing-spit', './units/sprites/Snow Bunny - Freezing Spit.png');

		// Background
		this.Phaser.load.image('background', "locations/" + this.background_image + "/bg.jpg");

		// Get JSON files
		$j.getJSON("../units/data.json", function(json_in) {
			G.creatureJSON = json_in;

			G.creatureDatas = G.creatureJSON;

			for (var j = 0; j < G.loadedCreatures.length; j++) {

				var data = G.creatureJSON[G.loadedCreatures[j]];

				G.loadingSrc += 2;

				// Load unit shouts
				G.soundsys.getSound('../units/shouts/'+data.name+'.ogg', 1000+G.loadedCreatures[j], function() { G.loadFinish(); });
				// Load unit abilities
				//getScript('abilities/'+data.name+'.js', function() { G.loadFinish(); });
				// Load artwork
				getImage('../units/artwork/'+data.name+'.jpg', function() { G.loadFinish(); });

				if(data.name == "Dark Priest") {
					for (var i = 0; i < dpcolor.length; i++) {
						G.loadingSrc += 2;
						G.Phaser.load.image(data.name+dpcolor[i] + '_cardboard', '../units/cardboards/' + data.name+' ' + dpcolor[i] + '.png');
						getImage('../units/avatars/' + data.name+' ' + dpcolor[i] + '.jpg', function() { G.loadFinish(); });
					}
				}else{
					if(data.drop) {
						G.loadingSrc += 1;
						G.Phaser.load.image('drop_' + data.drop.name, 'drops/' + data.drop.name+'.png');
					}
					G.loadingSrc += 2;
					G.Phaser.load.image(data.name + '_cardboard', '../units/cardboards/' + data.name+'.png');
					getImage('../units/avatars/' + data.name + '.jpg', function() { G.loadFinish(); });
				}

				// For code compatibility
				G.availableCreatures[j] = data.type;
			}

			G.Phaser.load.start();
		});

	},

	startLoading: function() {
		$j("#gameSetupContainer").hide();
		$j("#loader").show();
	},

	loadFinish: function() {
		this.loadedSrc++;
		if(this.loadingSrc==this.loadedSrc) {
			$j("#loader").hide();
			G.setup(G.playerMode);
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


	/*	Setup(playerMode)
	*
	*	playerMode :		Integer :	Ideally 2 or 4, number of players to setup the game
	*
	*	Launch the game with the given number of player.
	*
	*/
	setup: function(playerMode) {

		// Phaser
		this.Phaser.scale.pageAlignHorizontally = true;
	  this.Phaser.scale.pageAlignVertically = true;
	  this.Phaser.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
	  this.Phaser.scale.setScreenSize(true);
		this.Phaser.stage.disableVisibilityChange = true;
		if (!this.Phaser.device.desktop) {
			this.Phaser.stage.forcePortrait = true;
		}

		var bg = this.Phaser.add.sprite(0, 0, 'background');
		bg.inputEnabled = true;
		bg.events.onInputUp.add(function(Sprite, Pointer) {
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
		$j("#matchMaking").hide();

		for (var i = 0; i < playerMode; i++) {
			var player = new Player(i);
			this.players.push(player);

			// Starting position
			var pos = {};
			if(playerMode>2) { // If 4 players
				switch(player.id) {
					case 0:
						pos = { x: 0, y: 1} ;
						break;
					case 1:
						pos = { x: 15, y: 1 };
						break;
					case 2:
						pos = { x: 0, y: 7 };
						break;
					case 3:
						pos = { x: 15, y: 7 };
						break;
				}
			}else{ // If 2 players
				switch(player.id) {
					case 0:
						pos = {x: 0, y: 4};
						break;
					case 1:
						pos = {x: 14, y: 4};
						break;
				}
			}

			player.summon("--", pos); // Summon Dark Priest

		}

		this.activeCreature = this.players[0].creatures[0]; // Prevent errors

		this.UI = new UI(); // Creating UI not before because certain function requires creature to exists

		// DO NOT CALL LOG BEFORE UI CREATION
		this.gameState = "playing";

		this.log("Welcome to Ancient Beast pre-Alpha");
		this.log("Setting up a " + playerMode + " player match");

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
		// if( ($j(window).width() / 1920) > ($j(window).height() / 1080) ) {
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
		this.log("Round " + this.turn, "roundmarker");
		this.queue.nextRound();

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
		G.grid.xray( new Hex(-1, -1) ); // Clear Xray

		if(this.gameState == "ended") return;

		G.stopTimer();
		// Delay
		setTimeout(function() {
			var interval = setInterval(function() {
				if(!G.freezedInput) {
					clearInterval(interval);

					var differentPlayer = false;

					if (G.queue.isCurrentEmpty()) {
						G.nextRound(); // Go to next Round
						return; // End function
					} else {
						var next = G.queue.dequeue();
						if (G.activeCreature) {
							differentPlayer = G.activeCreature.player != next.player;
						} else {
							differentPlayer = true;
						}
						var last = G.activeCreature;
						G.activeCreature = next; // Set new creature active
						// Update health displays due to active creature change
						last.updateHealth();
					}

					if(G.activeCreature.player.hasLost) {
						G.nextCreature();
						return;
					}

					// Heart Beat sound for different player turns
					if(differentPlayer) {
						G.soundsys.playSound(G.soundLoaded[4], G.soundsys.heartbeatGainNode);
					}

					G.log("Active Creature : %CreatureName" + G.activeCreature.id + "%");
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
						G.log("%CreatureName" + G.activeCreature.id + "%, press here to toggle tutorial!");
					}

					// Update UI to match new creature
					G.UI.updateActivebox();
					G.updateQueueDisplay();
				}
			},50);
		},300);
	},

	updateQueueDisplay: function(excludeActiveCreature) {
		if (this.UI) {
			this.UI.updateQueueDisplay(excludeActiveCreature);
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
				stringConsole = stringConsole.replace("%CreatureName" + i + "%", this.creatures[i].player.name + "'s " + this.creatures[i].name);
				stringLog = stringLog.replace("%CreatureName" + i + "%", "<span class='" + this.creatures[i].player.color + "'>" + this.creatures[i].name + "</span>");
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

		if(!o.noTooltip) G.activeCreature.hint(o.tooltip, "msg_effects");

		setTimeout(function() {
			G.turnThrottle=false;
			G.UI.btnSkipTurn.changeState("normal");
			if (!G.activeCreature.hasWait &&
					G.activeCreature.delayable &&
					!G.queue.isCurrentEmpty()) {
				G.UI.btnDelay.changeState("normal");
			}
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
		if (G.turnThrottle) return;
		if (this.activeCreature.hasWait ||
				!this.activeCreature.delayable ||
				G.queue.isCurrentEmpty()) {
			return;
		}

		o = $j.extend({
			callback: function() {},
		},o);

		G.turnThrottle = true;
		G.UI.btnSkipTurn.changeState("disabled");
		G.UI.btnDelay.changeState("disabled");

		setTimeout(function() {
			G.turnThrottle=false;
			G.UI.btnSkipTurn.changeState("normal");
			if (!G.activeCreature.hasWait &&
					G.activeCreature.delayable &&
					!G.queue.isCurrentEmpty()) {
				G.UI.btnDelay.changeState("normal");
			}
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

		p.totalTimePool = Math.max(p.totalTimePool, 0); // Clamp

		// Check all timepool
		var playerStillHaveTime = (this.timePool>0) ? false : true ; // So check is always true for infinite time
		for(var i = 0; i < this.playerMode; i++) { // Each player
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
		}else if( this.timePool > 0 ) { // Timepool not infinite
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
		onStepIn : /\bonStepIn\b/,
		onStepOut : /\bonStepOut\b/,
		onReset: /\bonReset\b/,
		onStartPhase : /\bonStartPhase\b/,
		onEndPhase : /\bonEndPhase\b/,
		onMovement : /\bonMovement\b/,
		onUnderAttack : /\bonUnderAttack\b/,
		onDamage : /\bonDamage\b/,
		onHeal: /\bonHeal\b/,
		onAttack : /\bonAttack\b/,
		onCreatureMove : /\bonCreatureMove\b/,
		onCreatureDeath : /\bonCreatureDeath\b/,
		onCreatureSummon : /\bonCreatureSummon\b/,

		onStepIn_other : /\bonOtherStepIn\b/,
		onStepOut_other : /\bonOtherStepOut\b/,
		onReset_other : /\bonOtherReset\b/,
		onStartPhase_other : /\bonOtherStartPhase\b/,
		onEndPhase_other : /\bonOtherEndPhase\b/,
		onMovement_other : /\bonOtherMovement\b/,
		onAttack_other : /\bonOtherAttack\b/,
		onDamage_other : /\bonOtherDamage\b/,
		onHeal_other : /\bonOtherHeal\b/,
		onUnderAttack_other : /\bonOtherUnderAttack\b/,
		onCreatureMove_other : /\bonOtherCreatureMove\b/,
		onCreatureDeath_other : /\bonOtherCreatureDeath\b/,
		onCreatureSummon_other : /\bonOtherCreatureSummon\b/,

		onEffectAttach: /\bonEffectAttach\b/,
		onEffectAttach_other : /\bonOtherEffectAttach\b/,

		onStartOfRound : /\bonStartOfRound\b/,
		onQuery : /\bonQuery\b/,
		oncePerDamageChain : /\boncePerDamageChain\b/
	},

	triggerAbility : function( trigger, arg, retValue ) {

		// For triggered creature
		arg[0].abilities.each(function() {
			if( arg[0].dead === true ) return;
			if( G.triggers[trigger].test(this.getTrigger()) ) {
				if( this.require(arg[1]) ) {
					retValue = this.animation(arg[1]);
				}
			}
		});

		// For other creatures
		G.creatures.each(function() {
			if( arg[0] === this || this.dead === true ) return;
			this.abilities.each(function() {
				if( G.triggers[trigger+"_other"].test(this.getTrigger()) ) {
					if( this.require(arg[1]) ) {
						retValue = this.animation(arg[1], arg[0]);
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
			this.activateTrap(G.triggers[trigger], arg[0]);
		});
	},

	triggerDeleteEffect: function(trigger, creature) {
		var effects;
		if (creature == "all") {
			effects = G.effects;
		} else {
			effects = creature.effects;
		}
		for (var i = 0; i < effects.length; i++) {
			var effect = effects[i];
			if (effect.turnLifetime > 0 && trigger === effect.deleteTrigger &&
					G.turn-effect.creationTurn >= effect.turnLifetime) {
				effect.deleteEffect();
				// Update UI in case effect changes it
				if (effect.target) {
					effect.target.updateHealth();
				}
				i--;
			}
		}
	},

	triggersFn : {

		onStepIn: function(creature, hex, opts) {
			G.triggerAbility("onStepIn", arguments);
			G.triggerEffect("onStepIn", arguments);
			// Check traps last; this is because traps add effects triggered by
			// this event, which get triggered again via G.triggerEffect. Otherwise
			// the trap's effects will be triggered twice.
			if (!opts || !opts.ignoreTraps) {
				G.triggerTrap("onStepIn", arguments);
			}
		},

		onStepOut : function( creature, hex, callback ) {
			G.triggerAbility("onStepOut", arguments);
			G.triggerEffect("onStepOut", arguments);
			// Check traps last; this is because traps add effects triggered by
			// this event, which get triggered again via G.triggerEffect. Otherwise
			// the trap's effects will be triggered twice.
			G.triggerTrap("onStepOut", arguments);
		},

		onReset: function(creature) {
			G.triggerDeleteEffect("onReset", creature);
			G.triggerAbility("onReset", arguments);
			G.triggerEffect("onReset", [creature, creature]);
		},

		onStartPhase : function( creature, callback ) {
			for (var i = 0; i < G.grid.traps.length; i++) {
				trap = G.grid.traps[i];
				if(trap === undefined) continue;
				if(trap.turnLifetime > 0) {
					if(G.turn-trap.creationTurn >= trap.turnLifetime) {
						if(trap.fullTurnLifetime) {
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
			G.triggerDeleteEffect("onStartPhase", creature);
			G.triggerAbility("onStartPhase", arguments);
			G.triggerEffect("onStartPhase", [creature, creature]);
		},

		onEndPhase : function( creature, callback ) {
			G.triggerDeleteEffect("onEndPhase", creature);
			G.triggerAbility("onEndPhase", arguments);
			G.triggerEffect("onEndPhase", [creature, creature]);
		},

		onStartOfRound : function( creature, callback ) {
			G.triggerDeleteEffect("onStartOfRound", "all");
		},

		onCreatureMove : function( creature, hex, callback ) {
			G.triggerAbility("onCreatureMove", arguments);
		},

		onCreatureDeath: function(creature, callback) {
			var i;
			G.triggerAbility("onCreatureDeath", arguments);
			G.triggerEffect("onCreatureDeath", [creature, creature]);
			// Look for traps owned by this creature and destroy them
			for (i = 0; i < G.grid.traps.length; i++) {
				var trap = G.grid.traps[i];
				if (trap === undefined) continue;
				if (trap.turnLifetime > 0 && trap.fullTurnLifetime &&
						trap.ownerCreature == creature) {
					trap.destroy();
					i--;
				}
			}
			// Look for effects owned by this creature and destroy them if necessary
			for (i = 0; i < G.effects.length; i++) {
				var effect = G.effects[i];
				if (effect.owner === creature && effect.deleteOnOwnerDeath) {
					effect.deleteEffect();
					// Update UI in case effect changes it
					if (effect.target) {
						effect.target.updateHealth();
					}
					i--;
				}
			}
		},

		onCreatureSummon : function( creature, callback ) {
			G.triggerAbility("onCreatureSummon", [creature, creature, callback]);
			G.triggerEffect("onCreatureSummon", [creature, creature]);
		},

		onEffectAttach: function(creature, effect, callback) {
			G.triggerEffect("onEffectAttach", [creature, effect]);
		},


		onUnderAttack: function(creature, damage) {
			G.triggerAbility("onUnderAttack", arguments, damage);
			G.triggerEffect("onUnderAttack", arguments, damage);
			return damage;
		},

		onDamage : function( creature, damage ) {
			G.triggerAbility("onDamage", arguments);
			G.triggerEffect("onDamage", arguments);
		},

		onHeal: function(creature, amount) {
			G.triggerAbility("onHeal", arguments);
			G.triggerEffect("onHeal", arguments);
		},

		onAttack : function( creature, damage ) {
			damage = G.triggerAbility("onAttack", arguments, damage);
			damage = G.triggerEffect("onAttack", arguments, damage);
		}
	},


	findCreature: function( o ) {
		var o = $j.extend( {
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

	clearOncePerDamageChain: function() {
		for (var i = this.creatures.length - 1; i >= 0; i--) {
			if(this.creatures[i] instanceof Creature) {
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

		if(this.playerMode==2) { // If Only 2 players remove the other 2 columns
			$table.children("tr").children("td:nth-child(even)").remove();
			var $table = $j("#endscreen table tbody");
		}

		// FILLING THE BOARD
		for(var i = 0; i < this.playerMode; i++) { // Each player

			// TimeBonus
			if(this.timePool > 0)
				this.players[i].bonusTimePool = Math.round(this.players[i].totalTimePool/1000);

			//-------Ending bonuses--------//
			// No fleeing
			if(!this.players[i].hasFled && !this.players[i].hasLost)
				this.players[i].score.push( { type: "nofleeing" } );
			// Surviving Creature Bonus
			var immortal = true;
			for(var j = 0; j < this.players[i].creatures.length; j++) {
				if(!this.players[i].creatures[j].dead) {
					if(this.players[i].creatures[j].type != "--")
						this.players[i].score.push( { type: "creaturebonus", creature: this.players[i].creatures[j] } );
					else // Dark Priest Bonus
						this.players[i].score.push( { type: "darkpriestbonus" } );
				}else{
					immortal = false;
				}
			}
			// Immortal
			if(immortal && this.players[i].creatures.length > 1) // At least 1 creature summoned
				this.players[i].score.push( { type: "immortal" } );

			//----------Display-----------//
			var colId = (this.playerMode>2) ?( i+2+((i%2)*2-1)*Math.min(1, i%3) ):i+2;

			// Change Name
			$table.children("tr.player_name").children("td:nth-child(" + colId + ")") // Weird expression swap 2nd and 3rd player
			.text(this.players[i].name);

			//Change score
			$j.each(this.players[i].getScore(),function(index, val) {
				var text = ( val === 0 && index !== "total") ? "--" : val ;
				$table.children("tr."+index).children("td:nth-child(" + colId + ")") // Weird expression swap 2nd and 3rd player
				.text(text);
			});
		}

		// Defining winner
		if(this.playerMode > 2) { //2vs2
			var score1 = this.players[0].getScore().total + this.players[2].getScore().total;
			var score2 = this.players[1].getScore().total + this.players[3].getScore().total;

			if( score1 > score2 ) {
				// Left side wins
				$j("#endscreen p").text(this.players[0].name + " and " + this.players[2].name + " won the match!");
			}else if( score1 < score2 ) {
				// Right side wins
				$j("#endscreen p").text(this.players[1].name + " and " + this.players[3].name + " won the match!");
			}else if( score1 == score2 ) {
				// Draw
				$j("#endscreen p").text("Draw!");
			}
		}else{ // 1vs1
			var score1 = this.players[0].getScore().total;
			var score2 = this.players[1].getScore().total;

			if( score1 > score2 ) {
				// Left side wins
				$j("#endscreen p").text(this.players[0].name + " won the match!");
			}else if( score1 < score2 ) {
				// Right side wins
				$j("#endscreen p").text(this.players[1].name + " won the match!");
			}else if( score1 == score2 ) {
				// Draw
				$j("#endscreen p").text("Draw!");
			}
		}
	},

	action : function(o,opt) {

		var defaultOpt = {
			callback : function() {},
		};
		opt = $j.extend(defaultOpt,opt);

		G.clearOncePerDamageChain();
		switch(o.action) {
			case "move":
				G.activeCreature.moveTo(G.grid.hexs[o.target.y][o.target.x], { callback: opt.callback } );
				break;
			case "skip":
				G.skipTurn( { callback: opt.callback } );
				break;
			case "delay":
				G.delayCreature( { callback: opt.callback } );
				break;
			case "flee":
				G.activeCreature.player.flee( { callback: opt.callback } );
				break;
			case "ability":
				var args = $j.makeArray(o.args[1]);
				if(o.target.type=="hex") {
					args.unshift(G.grid.hexs[o.target.y][o.target.x]);
					G.activeCreature.abilities[o.id].animation2( { callback: opt.callback, arg: args } );
				}
				if(o.target.type=="creature") {
					args.unshift(G.creatures[o.target.crea]);
					G.activeCreature.abilities[o.id].animation2( { callback: opt.callback, arg: args } );
				}
				if(o.target.type=="array") {
					var array = [];
					o.target.array.each(function() { array.push(G.grid.hexs[this.y][this.x]); } );
					args.unshift(array);
					G.activeCreature.abilities[o.id].animation2( { callback: opt.callback, arg: args } );
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
var Player = Class.create( {
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
		this.name = "Player" + (id + 1);
		this.color =
		(this.id === 0)? "red"
		:(this.id == 1)? "blue"
		:(this.id == 2)? "orange"
		: "green";
		this.avatar = "../units/avatars/Dark Priest " + this.color + ".jpg";
		this.score = [];
		this.plasma = G.plasma_amount;
		this.flipped = !!(id%2); // Convert odd/even to true/false
		this.availableCreatures = G.availableCreatures;
		this.hasLost = false;
		this.hasFleed = false;
		this.bonusTimePool = 0;
		this.totalTimePool = G.timePool*1000;
		this.startTime = new Date();

		this.score = [{ type: "timebonus" }];
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
	summon: function(type, pos) {
		var data = G.retreiveCreatureStats(type);
		data = $j.extend(data, pos, { team: this.id }) ; // Create the full data for creature creation
		for (var i = G.creatureJSON.length - 1; i >= 0; i--) {
			if(
				G.creatureJSON[i].type == type &&
				i !== 0 ) // Avoid Dark Priest shout at the begining of a match
			{
				G.soundsys.playSound(G.soundLoaded[1000+i], G.soundsys.announcerGainNode);
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
					points += s.creature.level*5;
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
					points += s.creature.level*5;
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

		for(var i = 0; i < G.playerMode; i++) { // Each player
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
				G.queue.remove(crea);
			}
		}
		G.updateQueueDisplay();

		// Test if allie Dark Priest is dead
		if( G.playerMode > 2) {
			// 2vs2
			if( G.players[ (this.id+2)%4 ].hasLost )
				G.endGame();
		}else{
			// 1vs1
			G.endGame();
		}
	},
});


var Gamelog = Class.create( {

	initialize: function(id) {
		this.datas = [];
		this.playing = false;
		this.timeCursor = -1;
	},

	add: function(action) {
		this.datas.push(action);
	},

	play: function(log) {

		if(log) {
			this.datas = log;
		}

		var fun = function() {
			G.gamelog.timeCursor++;
			if(G.debugMode) console.log(G.gamelog.timeCursor + "/" + G.gamelog.datas.length);
			if(G.gamelog.timeCursor>G.gamelog.datas.length-1) {
				G.activeCreature.queryMove(); // Avoid bug
				return;
			}
			var interval = setInterval(function() {
				if(!G.freezedInput && !G.turnThrottle) {
					clearInterval(interval);
					G.activeCreature.queryMove(); // Avoid bug
					G.action(G.gamelog.datas[G.gamelog.timeCursor], { callback: fun } );
				}
			},100);
		};
		fun();
	},

	next: function() {
		if(G.freezedInput || G.turnThrottle) return false;

		G.gamelog.timeCursor++;
		if(G.debugMode) console.log(G.gamelog.timeCursor + "/" + G.gamelog.datas.length);
		if(G.gamelog.timeCursor>G.gamelog.datas.length-1) {
			G.activeCreature.queryMove(); // Avoid bug
			return;
		}
		var interval = setInterval(function() {
			if(!G.freezedInput && !G.turnThrottle) {
				clearInterval(interval);
				G.activeCreature.queryMove(); // Avoid bug
				G.action(G.gamelog.datas[G.gamelog.timeCursor], { callback: function() { G.activeCreature.queryMove(); } });
			}
		},100);
	},

	get: function() {
		console.log(JSON.stringify(this.datas));
	}
});



var Soundsys = Class.create( {

	initialize: function(o) {
		o = $j.extend( {
			music_volume : 0.1,
			effects_volume : 0.6,
			heartbeats_volume : 0.3,
			announcer_volume : 0.6
		}, o);

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

	getSound: function(url, id, success) {
		if(!window.AudioContext) success();
		var id = id;
		bufferLoader = new BufferLoader(this.context,[url],function(arraybuffer) {
			G.soundLoaded[id] = arraybuffer[0];
			success();
		});

		bufferLoader.load();
	},

	playSound: function(sound, node, o) {
		if(!window.AudioContext) return false;
		o = $j.extend( {
			music_volume : 1,
			effects_volume : 1,
		}, o);

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
function getScript(url,success) {
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
function print_r(arr, level) {
	var dumped_text = "";
	if(!level) level = 0;

	// The padding given at the beginning of the line.
	var level_padding = "";
	for(var j=0; j<level+1; j++) level_padding += "    ";

	if(typeof(arr) == 'object') { // Array/Hashes/Objects
		for(var item in arr) {
			var value = arr[item];

			if(typeof(value) == 'object') { // If it is an array,
				dumped_text += level_padding + "'" + item + "' ...\n";
				dumped_text += dump(value, level+1);
			} else {
				dumped_text += level_padding + "'" + item + "' => \"" + value + "\"\n";
			}
		}
	} else { // Strings/Chars/Numbers etc.
		dumped_text = "===>" + arr + "<===(" + typeof(arr) + ")";
	}
	return dumped_text;
}

/*	Class UI
*
*	Object containing UI DOM element, update functions and event managment on UI.
*
*/
var UI = Class.create( {

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
		this.btnToggleDash = new Button( {
			$button : $j(".toggledash"),
			click : function(e) { G.UI.toggleDash(); },
		});
		this.buttons.push(this.btnToggleDash);

		// Audio Button
		this.btnAudio = new Button( {
			$button : $j("#audio.button"),
			click : function(e) { if(!G.UI.dashopen) {
				G.UI.showMusicPlayer();
			}}
		});
		this.buttons.push(this.btnAudio);

		// Skip Turn Button
		this.btnSkipTurn = new Button( {
			$button : $j("#skip.button"),
			click : function(e) { if(!G.UI.dashopen) {
				if(G.turnThrottle) return;
				G.gamelog.add( { action: "skip" } );
				G.skipTurn();
			}},
		});
		this.buttons.push(this.btnSkipTurn);

		// Delay Unit Button
		this.btnDelay = new Button( {
			$button : $j("#delay.button"),
			click : function(e) { if(!G.UI.dashopen) {
				if (G.turnThrottle) return;
				if (G.activeCreature.hasWait ||
						!G.activeCreature.delayable ||
						G.queue.isCurrentEmpty()) {
					return;
				}
				G.gamelog.add( { action: "delay" } );
				G.delayCreature();
			}},
		});
		this.buttons.push(this.btnDelay);

		// Flee Match Button
		this.btnFlee = new Button( {
			$button : $j("#flee.button"),
			click : function(e) { if(!G.UI.dashopen) {
				if( G.turn < G.minimumTurnBeforeFleeing ) {
					alert("You cannot flee the match in the first 10 rounds.");
					return;
				}
				if( G.activeCreature.player.isLeader() ) {
					alert("You cannot flee the match while being in lead.");
					return;
				}

				if(window.confirm("Are you sure you want to flee the match?")) {
					G.gamelog.add( {action: "flee" } );
					G.activeCreature.player.flee();
				}
			} },
			state : "disabled",
		});
		this.buttons.push(this.btnFlee);

		// ProgessBar
		this.healthBar = new ProgessBar( { $bar : $j("#leftpanel .progressbar .bar.healthbar"), color : "red" } );
		this.energyBar = new ProgessBar( { $bar : $j("#leftpanel .progressbar .bar.energybar"), color : "yellow" } );
		this.timeBar = new ProgessBar( { $bar : $j("#rightpanel .progressbar .timebar"), color : "white" } );
		this.poolBar = new ProgessBar( { $bar : $j("#rightpanel .progressbar .poolbar"), color : "grey" } );

		this.showAbilityCosts = function(abilityId) {
			var creature = G.activeCreature;
			var ab = creature.abilities[abilityId];
			if(ab.costs !== undefined) {
				if( typeof ab.costs.energy == "number" ) {
					var costsEnergy = ab.costs.energy + creature.stats.reqEnergy;
					G.UI.energyBar.previewSize(costsEnergy / creature.stats.energy);
				}else{
					G.UI.energyBar.previewSize( 0 );
				}
				if( typeof ab.costs.health == "number" ) {
					G.UI.healthBar.previewSize(ab.costs.health / creature.stats.health);
				}else{
					G.UI.healthBar.previewSize( 0 );
				}
			}
		};

		this.hideAbilityCosts = function() {
			G.UI.energyBar.previewSize( 0 );
			G.UI.healthBar.previewSize( 0 );
		};

		// Volume Sliders
		$j("#effects_volume").slider( {
			step: 0.2,
			value: 5,
			min: 0,
			max: 10,
			slide: function( event, ui ) {
				G.soundsys.setEffectsVolume( ui.value/5 );
			}
		});

		var hotkeys = {
			overview: 9, // Tab TODO: This should open/close score screen
			cycle: 81, // Q TODO: Make this work
			attack: 87, // W
			ability: 69, // E
			ultimate: 82, // R
			audio: 65, // A TODO: Make this work
			skip: 83, // S
			delay: 68, // D
			flee: 70, // F
			chat: 13, // Return TODO: Should open, send & hide chat
			close: 27, // Escape
			//pause: 80, // P, might get deprecated
			show_grid: 16, // Shift
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

		// Binding Hotkeys
		$j(document).keydown(function(e) {
			if(G.freezedInput) return;

			var keypressed = e.keyCode || e.which;
			//console.log(keypressed); // For debugging

			var prevD = false;

			$j.each(hotkeys, function(k, v) {
				if(v==keypressed) {
					// Context filter
					if(G.UI.dashopen) {
						switch(k) {
							case "close": G.UI.closeDash(); break;
							case "ultimate": G.UI.closeDash(); break;
							case "dash_materializeButton": G.UI.materializeButton.triggerClick(); break;
							case "dash_up": G.UI.gridSelectUp(); break;
							case "dash_down": G.UI.gridSelectDown(); break;
							case "dash_left": G.UI.gridSelectLeft(); break;
							case "dash_right": G.UI.gridSelectRight(); break;
						}
					}else{
						switch(k) {
							case "close": G.UI.chat.hide(); break; // Close chat if opened
							case "cycle": G.UI.abilitiesButtons[0].triggerClick(); break; // TODO: Make this cycle through usable abilities
							case "attack": G.UI.abilitiesButtons[1].triggerClick(); break;
							case "ability": G.UI.abilitiesButtons[2].triggerClick(); break;
							case "ultimate": G.UI.abilitiesButtons[3].triggerClick(); break;
							case "overview": G.UI.btnToggleDash.triggerClick(); break;
							case "audio": G.UI.btnAudio.triggerClick(); break;
							case "skip": G.UI.btnSkipTurn.triggerClick(); break;
							case "delay": G.UI.btnDelay.triggerClick(); break;
							case "flee": G.UI.btnFlee.triggerClick(); break;
							case "chat": G.UI.chat.toggle(); break;
							case "pause": G.togglePause(); break; // Might get deprecated
							case "show_grid": G.grid.showGrid(true); break;

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
			if(prevD) {
				e.preventDefault();
				return false;
			}
		});

		$j(document).keyup(function(e) {
			if(G.freezedInput) return;

			var keypressed = e.keyCode || e.which;

			$j.each(hotkeys,function(k, v) {
				if(v==keypressed) {
					switch(k) {
						case "show_grid": G.grid.showGrid(false); break;
					}
				}
			});
		});

		// Mouse Shortcut
		$j("#dash").bind('mousedown', function(e) {
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
			if(G.UI.dashopen ) {
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
			var b = new Button( {
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

		this.materializeButton = new Button( {
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

		this.$dash.children("#playertabswrapper").addClass("numplayer"+G.playerMode);

		this.selectedCreature = "";
		this.selectedPlayer = 0;
		this.selectedAbility = -1;

		this.queueAnimSpeed = 500; // ms
		this.dashAnimSpeed = 250; // ms

		this.materializeToggled = false;
		this.dashopen = false;

		this.glowInterval = setInterval(function() {

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


		if(G.turnTimePool) $j(".turntime").text(zfill(Math.floor(G.turnTimePool/60), 2)+":"+zfill(G.turnTimePool%60, 2));
		if(G.timePool) $j(".timepool").text(zfill(Math.floor(G.timePool/60), 2)+":"+zfill(G.timePool%60, 2));

		$j("#tabwrapper a").removeAttr("href"); // Empty links

		// Show UI
		this.$display.show();
		this.$dash.hide();
	},


	resizeDash: function() {
		var zoom1 = $j("#cardwrapper").innerWidth() / $j("#card").outerWidth();
		var zoom2 = $j("#cardwrapper").innerHeight() / ( $j("#card").outerHeight() + $j("#materialize_button").outerHeight() );
		var zoom = Math.min(zoom1, zoom2);
		zoom = Math.min(zoom,1);
		$j("#cardwrapper_inner").css( {
			scale: zoom,
			"left": ($j("#cardwrapper").innerWidth()-$j("#card").innerWidth()*zoom)/2,
			position: "absolute",
			margin: 0
		});

		var zoom1 = $j("#creaturegridwrapper").innerWidth()/$j("#creaturegrid").innerWidth();
		var zoom2 = $j("#creaturegridwrapper").innerHeight()/$j("#creaturegrid").innerHeight();
		zoom = Math.min(zoom1, zoom2);
		zoom = Math.min(zoom, 1);
		$j("#creaturegrid").css( {
			scale: zoom,
			"left": ($j("#creaturegridwrapper").innerWidth()-$j("#creaturegrid").innerWidth()*zoom)/2,
			position: "absolute",
			margin: 0
		});
	},


	/*	showCreature(creatureType, player)
	*
	*	creatureType :	String :	Creature type
	*	player :		Integer :	Player ID
	*
	*	Query a creature in the available creatures of the active player
	*
	*/
	showCreature: function(creatureType, player) {

		if(!this.dashopen) {
			this.$dash.show().css("opacity", 0);
			this.$dash.transition( { opacity: 1 }, this.dashAnimSpeed, "linear");
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

		this.$dash.children("#playertabswrapper").children(".playertabs").unbind('click').bind('click', function(e) {
			if(G.freezedInput) return;
			G.UI.showCreature("--", $j(this).attr("player")-0);
		});

		// Update player info
		for (var i = G.players.length - 1; i >= 0; i--) {
			$j("#dash .playertabs.p"+i+" .vignette").css("background-image","url('" + G.players[i].avatar + "')");
			$j("#dash .playertabs.p"+i+" .name").text(G.players[i].name);
			$j("#dash .playertabs.p"+i+" .plasma").text("Plasma "+G.players[i].plasma);
			$j("#dash .playertabs.p"+i+" .score").text("Score "+G.players[i].getScore().total);
			$j("#dash .playertabs.p"+i+" .units").text("Units "+G.players[i].getNbrOfCreatures()+" / "+G.creaLimitNbr);
		}

		// Change to the player tab
		if(player != G.UI.selectedPlayer) { this.changePlayerTab(player); }

		this.$grid.children(".vignette").removeClass("active")
		.filter("[creature='"+creatureType+"']").addClass("active");

		this.selectedCreature = creatureType;

		var stats = G.retreiveCreatureStats(creatureType);

		// TODO card animation
		if( $j.inArray(creatureType, G.players[player].availableCreatures)>0 || creatureType=="--") {
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
			$j("#card .sideA").css( { "background-image": "url('../cards/margin.png'), url('../units/artwork/" + stats.name + ".jpg')" } );
			$j("#card .sideA .section.info").removeClass("sin- sinA sinE sinG sinL sinP sinS sinW").addClass("sin" + stats.type.substring(0, 1));
			$j("#card .sideA .type").text(stats.type);
			$j("#card .sideA .name").text(stats.name);
			$j("#card .sideA .hexs").html(stats.size + "&#11041;");

			// Card B
			$j("#card .sideB").css( { "background-image": "url('../cards/margin.png'), url('../cards/" + stats.type.substring(0, 1) + ".jpg')" } );
			$j.each(stats.stats,function(key, value) {
				var $stat = $j("#card .sideB ." + key + " .value");
				$stat.removeClass("buff debuff");
				if(crea) {
					if(key=="health") {
						$stat.text(crea.health + "/" + crea.stats[key]);
					}else if(key=="movement") {
						$stat.text(crea.remainingMove + "/" + crea.stats[key]);
					}else if(key=="energy") {
						$stat.text(crea.energy + "/" + crea.stats[key]);
					}else if(key=="endurance") {
						$stat.text(crea.endurance + "/" + crea.stats[key]);
					}else{
						$stat.text(crea.stats[key]);
					}
					if(crea.stats[key] > value) { // Buff
						$stat.addClass("buff");
					}else if(crea.stats[key] < value) { // Debuff
						$stat.addClass("debuff");
					}
				}else{
					$stat.text(value);
				}
			});
			$j.each(G.abilities[stats.id],function(key, value) {
				$ability = $j("#card .sideB .abilities .ability:eq(" + key + ")");
				$ability.children('.icon').css( { "background-image": "url('../units/abilities/" + stats.name + " " + key + ".svg')" } );
				$ability.children(".wrapper").children(".info").children("h3").text(stats.ability_info[key].title);
				$ability.children(".wrapper").children(".info").children("#desc").text(stats.ability_info[key].desc);
				$ability.children(".wrapper").children(".info").children("#info").text(stats.ability_info[key].info);
				$ability.children(".wrapper").children(".info").children("#upgrade").text("Upgrade: " + stats.ability_info[key].upgrade);

				if( key !== 0){
					$ability.children(".wrapper").children(".info").children("#cost").text(" - costs " + stats.ability_info[key].costs.energy + " energy pts.");
				}
				else{
					$ability.children(".wrapper").children(".info").children("#cost").text(" - this ability is passive.");
				}
			});

			var summonedOrDead = false;
			G.players[player].creatures.each(function() {
				if(this.type == creatureType) {
					summonedOrDead = true;
				}
			});

			// Materialize button
			this.materializeButton.changeState("disabled");
			$j("#card .sideA").addClass("disabled").unbind("click");

			if(G.activeCreature.player.getNbrOfCreatures() > G.creaLimitNbr) {
				$j('#materialize_button p').text(G.msg.ui.dash.materialize_overload);
			}else if(
				!summonedOrDead &&
				G.activeCreature.player.id === player &&
				G.activeCreature.type === "--" &&
				G.activeCreature.abilities[3].used === false
			)
			{
				var lvl = creatureType.substring(1, 2)-0;
				var size = G.retreiveCreatureStats(creatureType).size-0;
				plasmaCost = lvl+size;

				// Messages (TODO: text strings in a new language file)
				if(plasmaCost>G.activeCreature.player.plasma) {
					$j('#materialize_button p').text("Low Plasma! Cannot materialize the selected unit");
				}else{
					$j('#materialize_button p').text("Materialize unit at target location for " + plasmaCost + " plasma");

					// Bind button
					this.materializeButton.click = function(e) {
						G.UI.materializeToggled = true;
						G.UI.selectAbility(3);
						G.UI.closeDash(true);
						G.activeCreature.abilities[3].materialize(G.UI.selectedCreature);
					};
					$j("#card .sideA").on("click",this.materializeButton.click);
					$j("#card .sideA").removeClass("disabled");
					this.materializeButton.changeState("glowing");

				}

			}else{
				if (
					G.activeCreature.player.id === player &&
					G.activeCreature.type === "--" &&
					G.activeCreature.abilities[3].used === true
				) {
					$j('#materialize_button p').text("Materialization has already been used this round");
				}else if(
					G.activeCreature.player.id === player &&
					G.activeCreature.type === "--"
				) {
					$j('#materialize_button p').text("Please select an available unit from the left grid");
				}else if (G.activeCreature.type != "--") {
					$j('#materialize_button p').text("The current active unit cannot materialize others");
				}else if (
					G.activeCreature.type ==="--" &&
					G.activeCreature.player.id != player
				) {
					$j('#materialize_button p').text("Switch to your own tab to be able to materialize");

					// Bind button
					this.materializeButton.click = function(e) {
						G.UI.showCreature("--", G.activeCreature.player.id);
					};
					$j("#card .sideA").on("click",this.materializeButton.click);
					$j("#card .sideA").removeClass("disabled");
					this.materializeButton.changeState("glowing");

				}
			}

		}else{

			// Card A
			$j("#card .sideA").css( { "background-image": "url('../cards/margin.png'), url('../units/artwork/" + stats.name + ".jpg')" } );
			$j("#card .sideA .section.info").removeClass("sin- sinA sinE sinG sinL sinP sinS sinW").addClass("sin"+stats.type.substring(0, 1));
			$j("#card .sideA .type").text(stats.type);
			$j("#card .sideA .name").text(stats.name);
			$j("#card .sideA .hexs").text(stats.size + "H");

			// Card B
			$j.each(stats.stats,function(key, value) {
				var $stat = $j("#card .sideB ." + key + " .value");
				$stat.removeClass("buff debuff");
				$stat.text(value);
			});

			// Abilities
			$j.each(stats.ability_info,function(key, value) {
				$ability = $j("#card .sideB .abilities .ability:eq(" + key + ")");
				$ability.children('.icon').css( { "background-image": "url('../units/abilities/" + stats.name+" " + key + ".svg')" } );
				$ability.children(".wrapper").children(".info").children("h3").text(stats.ability_info[key].title);
				$ability.children(".wrapper").children(".info").children("#desc").html(stats.ability_info[key].desc);
				$ability.children(".wrapper").children(".info").children("#info").html(stats.ability_info[key].info);
			});

			// Materialize button
			$j('#materialize_button').removeClass("glowing").unbind('click');
			$j("#card .sideA").addClass("disabled").unbind('click');
			$j('#materialize_button p').text("This unit is currently under heavy development");
		}
	},


	selectAbility: function(i) {
		this.checkAbilities();
		this.selectedAbility = i;
		if( i>-1 ) {
			G.UI.showAbilityCosts(i);
			this.abilitiesButtons[i].changeState("active");
		}
		else {
			G.UI.hideAbilityCosts();
		}
	},


	/*	changePlayerTab(id)
	*
	*	id :	Integer :	player id
	*
	*	Change to the specified player tab in the dash
	*
	*/
	changePlayerTab: function(id) {
		this.selectedPlayer = id;
		this.$dash // Dash class
		.removeClass("selected0 selected1 selected2 selected3")
		.addClass("selected" + id);

		this.$grid.find(".vignette") // Vignettes class
		.removeClass("active dead queued notsummonable")
		.addClass("locked");

		$j("#tabwrapper").show();
		$j("#musicplayerwrapper").hide();

		// Change creature status
		G.players[id].availableCreatures.each(function() {
			G.UI.$grid.find(".vignette[creature='"+this+"']").removeClass("locked");

			var lvl = this.substring(1, 2)-0;
			var size = G.retreiveCreatureStats(this).size-0;
			plasmaCost = lvl+size;

			if( plasmaCost > G.players[id].plasma ) {
				G.UI.$grid.find(".vignette[creature='"+this+"']").addClass("notsummonable");
			}
		});

		G.players[id].creatures.each(function() {
			var $crea = G.UI.$grid.find(".vignette[creature='" + this.type + "']");
			$crea.removeClass("notsummonable");
			if(this.dead === true) {
				$crea.addClass("dead");
			}else{
				$crea.addClass("queued");
			}
		});

		// Bind creature vignette click
		this.$grid.find(".vignette").unbind('click').bind("click", function(e) {
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

		this.showCreature(G.activeCreature.type, G.activeCreature.team);

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
			this.showCreature(G.activeCreature.type, G.activeCreature.team);
		}else{
			this.closeDash();
		}

	},

	closeDash: function(materialize) {
		this.$dash.removeClass("active");
		this.$dash.transition( { opacity: 0, queue: false }, this.dashAnimSpeed, "linear", function() {
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

		if( b == "--") {
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

		if( b == "--") {
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

		if( b[1]-0+1 > 7 ) { // End of row
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

					if( valid ) {
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
			if( $j.inArray( b[0]+(b[1]-0+1), G.players[this.selectedPlayer].availableCreatures)>0	) {
				var valid = true;
				for (var i = 0; i < G.players[ this.selectedPlayer ].creatures.length; i++) {
					var crea = G.players[ this.selectedPlayer ].creatures[i];
					if( crea instanceof Creature && crea.type == b[0]+(b[1]-0+1) && crea.dead ) {
						var valid = false;
					}
				}

				if( valid ) {
					G.UI.showCreature( b[0] + (b[1]-0+1) );
					return;
				}
			}
			G.UI.selectedCreature = b[0] + (b[1]-0+1);
		}
		G.UI.gridSelectNext();
	},

	gridSelectPrevious: function() {
		var b = ( G.UI.selectedCreature == "--" ) ? "W8" :  G.UI.selectedCreature ;

		if( b[1]-1 < 1 ) { // End of row
			if( G.realms.indexOf(b[0])-1 > -1 ) {
				var r = G.realms[ G.realms.indexOf(b[0])-1 ];

				// Test if valid creature
				if( $j.inArray( r+"7", G.players[this.selectedPlayer].availableCreatures)>0	) {
					var valid = true;
					for (var i = 0; i < G.players[ this.selectedPlayer ].creatures.length; i++) {
						var crea = G.players[ this.selectedPlayer ].creatures[i];
						if( crea instanceof Creature && crea.type == r+"7" && crea.dead ) {
							var valid = false;
						}
					}

					if( valid ) {
						G.UI.showCreature( r+"7" );
						return;
					}
				}
				G.UI.selectedCreature = r+"7";
			}else{
				return;
			}
		}else{

			// Test if valid creature
			if( $j.inArray( b[0] + (b[1]-1), G.players[this.selectedPlayer].availableCreatures)>0 ) {
				var valid = true;
				for (var i = 0; i < G.players[ this.selectedPlayer ].creatures.length; i++) {
					var crea = G.players[ this.selectedPlayer ].creatures[i];
					if( crea instanceof Creature && crea.type == b[0] + (b[1]-1) && crea.dead ) {
						var valid = false;
					}
				}

				if( valid ) {
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
		var creature = G.activeCreature;
		var $abilitiesButtons = $j("#abilities .ability");
		$abilitiesButtons.unbind("click");

		this.$activebox.find("#abilities").clearQueue().transition( { y: "-420px" }, 500, 'easeInQuart', function() { // Hide panel
			$j(this).removeClass("p0 p1 p2 p3").addClass("p"+creature.player.id);

			G.UI.energyBar.setSize(creature.oldEnergy/creature.stats.energy);
			G.UI.healthBar.setSize(creature.oldHealth/creature.stats.health);

			G.UI.updateAbilityButtonsContent();

			// Change ability buttons
			G.UI.abilitiesButtons.each(function() {
				var ab = creature.abilities[this.abilityId];
				this.css.normal = {
					"background-image": "url('../units/abilities/" + creature.name + " " + this.abilityId + ".svg')"				};
				var $desc = this.$button.next(".desc");
				$desc.find("span.title").text(ab.title);
				$desc.find("p").html(ab.desc);

				this.click = function() {
					if(G.UI.selectedAbility != this.abilityId) {
						if(G.UI.dashopen) return false;
						G.grid.clearHexViewAlterations();
						var ab = G.activeCreature.abilities[this.abilityId];
					// Passive ability icon can cycle between usable abilities
                                        if(this.abilityId == 0)
                                                {
							var b = ( G.UI.selectedAbility == -1 ) ? 4 :  G.UI.selectedAbility ;
							for (var i = (b-1); i > 0; i--)
							{
							if( G.activeCreature.abilities[i].require() && !G.activeCreature.abilities[i].used )
								{
								G.UI.abilitiesButtons[i].triggerClick();
								}
							}
						}
					if(ab.require() == true && this.abilityId != 0) // Colored frame around selected ability
						{
							G.UI.selectAbility(this.abilityId);
						}
						// Activate Ability
						G.activeCreature.abilities[this.abilityId].use();
					}else{
						G.grid.clearHexViewAlterations();
						G.UI.selectAbility(-1);
						// Cancel Ability
						G.UI.closeDash();
						G.activeCreature.queryMove();
					}
				};

				this.mouseover = function() {
					if(G.UI.selectedAbility == -1) {
						G.UI.showAbilityCosts(this.abilityId);
					};
				}
				this.mouseleave = function() {
					if(G.UI.selectedAbility == -1) {
						G.UI.hideAbilityCosts();
					}
				}
				this.changeState(); // Apply changes
			});
			G.UI.$activebox.children("#abilities").transition( { y: "0px" }, 500, 'easeOutQuart'); // Show panel
		});

		this.updateInfos();
	},

	updateAbilityButtonsContent: function() {
		var creature = G.activeCreature;

		// Change ability buttons
		this.abilitiesButtons.each(function() {
			var ab = creature.abilities[this.abilityId];
			var $desc = this.$button.next(".desc");

			// Change the ability's frame when it gets upgraded
			if(ab.isUpgraded()) this.$button.addClass('upgraded');
			else this.$button.removeClass('upgraded');

			// Add extra ability info
			var $abilityInfo = $desc.find(".abilityinfo_content");
			$abilityInfo.find(".info").remove();

			var costs_string = ab.getFormatedCosts();
			if (costs_string) {
				$abilityInfo.append(
					'<div class="info costs">' +
					'Costs : ' + costs_string +
					'</div>'
				);
			}
			var dmg_string = ab.getFormatedDamages();
			if (dmg_string) {
				$abilityInfo.append(
					'<div class="info damages">' +
					'Damages : ' + dmg_string +
					'</div>'
				);
			}
			var special_string = ab.getFormatedEffects();
			if (special_string) {
				$abilityInfo.append(
					'<div class="info special">' +
					'Effects : ' + special_string +
					'</div>'
				);
			}
			if (ab.hasUpgrade()) {
				if (!ab.isUpgraded()) {
					$abilityInfo.append(
						'<div class="info upgrade">' +
						(ab.isUpgradedPerUse() ? 'Uses' : 'Rounds') +
						' left before upgrading : ' + ab.usesLeftBeforeUpgrade() +
						'</div>'
					);
				}
				$abilityInfo.append(
					'<div class="info upgrade">' +
					'Upgrade : ' + ab.upgrade +
					'</div>'
				);
			}
		});
	},

	checkAbilities : function() {
		var oneUsableAbility = false;

		for (var i = 0; i < 4; i++) {
			var ab = G.activeCreature.abilities[i];
			ab.message = "";
			var req = ab.require();
			ab.message = (ab.used) ? G.msg.abilities.alreadyused : ab.message;
			if( req && !ab.used && ab.trigger == "onQuery") {
				this.abilitiesButtons[i].changeState("glowing");
				oneUsableAbility = true;
			}else if( ab.message==G.msg.abilities.notarget || ( ab.trigger != "onQuery" && req && !ab.used ) ) {
				this.abilitiesButtons[i].changeState("noclick");
			}else{
				this.abilitiesButtons[i].changeState("disabled");
			}
			if(i===0) // Tooltip for passive ability to display if there is any usable abilities or not
				{
					var b = ( G.UI.selectedAbility == -1 ) ? 4 :  G.UI.selectedAbility ; // Checking usable abilities
					for (var j = (b-1); j > 0; j--)
					{
						if( G.activeCreature.abilities[j].require() && !G.activeCreature.abilities[j].used )
						{
							ab.message =G.msg.abilities.passivecycle; // Message if there is any usable abilities
							break;
						}
						else
						{
							ab.message =G.msg.abilities.passiveunavailable; // Message if there is no usable abilities
						}
					}
				}

			// Charge
			this.abilitiesButtons[i].$button.next(".desc").find(".charge").remove();
			if( ab.getCharge !== undefined ) {
				this.abilitiesButtons[i].$button.next(".desc").append('<div class="charge">Charge : ' + ab.getCharge().value + "/" + ab.getCharge().max + '</div>');
			}

			// Message
			this.abilitiesButtons[i].$button.next(".desc").find(".message").remove();
			if( ab.message !== "" ) {
				this.abilitiesButtons[i].$button.next(".desc").append('<div class="message">' + ab.message + '</div>');
			}
		}

		// No action possible
		if( !oneUsableAbility && G.activeCreature.remainingMove === 0 ) {
			//G.skipTurn( { tooltip: "Finished" } ); // Autoskip
			G.activeCreature.noActionPossible = true;
			this.btnSkipTurn.changeState("glowing");
		}
	},

	/*	updateInfos()
	*
	*/
	updateInfos:function() {
		$j("#playerbutton, #playerinfo")
			.removeClass("p0 p1 p2 p3")
			.addClass("p"+G.activeCreature.player.id);
		$j("#playerinfo .name").text(G.activeCreature.player.name);
		$j("#playerinfo .points span").text(G.activeCreature.player.getScore().total);
		$j("#playerinfo .plasma span").text(G.activeCreature.player.plasma);
		$j("#playerinfo .units span").text(G.activeCreature.player.getNbrOfCreatures()+" / "+G.creaLimitNbr); // TODO: Needs to update instantly!
	},

	showStatModifiers: function(stat) { // Broken and deprecated

		if( G.UI.selectedCreatureObj instanceof Creature ) {
			var buffDebuff = G.UI.selectedCreatureObj.getBuffDebuff(stat);
			var atLeastOneBuff = false;
			// Might not be needed
			$j(card).find("."+stat+" .modifiers").html("");
			// Effects
			$j.each(buffDebuff.objs.effects, function(key, value) {
				//var string = G.UI.selectedCreatureObj.abilities[0].getFormatedDamages(value.alterations);
				if( value.alterations[stat] ) $j(card).find("." + stat + " .modifiers").append("<div>" + value.name + " : " + (value.alterations[stat] > 0 ? "+" : "")+value.alterations[stat] + "</div>");
				atLeastOneBuff = true;
			});
			// Drops
			$j.each(buffDebuff.objs.drops, function(key, value) {
				//var string = G.UI.selectedCreatureObj.abilities[0].getFormatedDamages(value.alterations);
				if( value.alterations[stat] ) $j(card).find("." + stat + " .modifiers").append("<div>" + value.name + " : "+(value.alterations[stat] > 0 ? "+" : "")+value.alterations[stat] + "</div>");
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
			var remainingTime = G.turnTimePool - Math.round((date - G.activeCreature.player.startTime) / 1000);
			if(G.timePool > 0)
				remainingTime = Math.min(remainingTime, Math.round( (G.activeCreature.player.totalTimePool-(date - G.activeCreature.player.startTime)) / 1000) );
			var minutes = Math.floor(remainingTime / 60);
			var seconds = remainingTime - minutes * 60;
			var id = G.activeCreature.player.id;
			$j(".p"+id+" .turntime").text(zfill(minutes, 2)+ ":" + zfill(seconds, 2));
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
				remainingTime = Math.max(Math.round(remainingTime / 1000), 0);
				var minutes = Math.floor(remainingTime / 60);
				var seconds = remainingTime - minutes * 60;
				$j(".p" + this.id + " .timepool").text(zfill(minutes, 2) + ":" + zfill(seconds, 2));
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
	updateQueueDisplay: function(excludeActiveCreature) { // Ugly as hell need rewrite

		if (G.queue.isNextEmpty() || !G.activeCreature) return false; // Abort to avoid infinite loop

		var queueAnimSpeed = this.queueAnimSpeed;
		var transition = "linear";

		// Set transition duration for stat indicators
		this.$queue.find('.vignette .stats').css( { transition: "height " + queueAnimSpeed + "ms" } );

		// Updating
		var $vignettes = this.$queue.find('.vignette[verified!="-1"]').attr("verified", 0);

		var deleteVignette = function(vignette) {

			if( $j( vignette ).hasClass("roundmarker") ) {
					$j( vignette ).attr("verified", -1).transition( { x: -80, queue: false }, queueAnimSpeed, transition, function() { this.remove(); } );
			}else{
				if( $j( vignette ).hasClass("active") ) {
					$j( vignette ).attr("verified", -1).transition( { x: -100, queue: false }, queueAnimSpeed, transition, function() { this.remove(); } );
				}else{
					$j( vignette ).attr("verified", -1).transition( { x: "-=80", queue: false }, queueAnimSpeed, transition, function() { this.remove(); } );
				}
			}

			// Updating
			$vignettes = G.UI.$queue.find('.vignette[verified!="-1"]');
		};

		var appendVignette = function(pos, vignette) {
			var $v, index, offset;
			// Create element
			if( $vignettes.length === 0 ) {
				$v = $j( vignette ).prependTo( G.UI.$queue );
				index = $v.index('#queuewrapper .vignette[verified != "-1"]');
				offset = (index-(!!index))*80 + (!!index)*100 -80;
			}else if( $vignettes[pos] ) {
				$v = $j( vignette ).insertAfter( $vignettes[pos] );
				index = $v.index('#queuewrapper .vignette[verified != "-1"]');
				offset = (index-(!!index))*80 + (!!index)*100 -80;

			}else{
				$v = $j( vignette ).appendTo( G.UI.$queue );
				index = $v.index('#queuewrapper .vignette[verified != "-1"]');
				offset = (index-(!!index)) * 80 + (!!index) * 100 + 1000;
			}

			// Animation
			$v.attr("verified",1)
				.css( { x: offset } )
				.transition( { queue: true }, queueAnimSpeed, transition); // Dont know why but it must be here

			// Updating
			$vignettes = G.UI.$queue.find('.vignette[verified != "-1"]');
		};

		var updatePos = function() {

			$vignettes.each(function() {
				var index = $j(this).index('#queuewrapper .vignette[verified != "-1"]');
				var offset = (index-(!!index)) * 80 + (!!index) * 100;
				$j(this).css( { "z-index": 0-index } ).transition( { x: offset, queue: false }, queueAnimSpeed, transition);
			});
		};

		this.$queue.find('.vignette[verified != "-1"]').each(function() {
			if( $j(this).attr("turn") < G.turn ) {
				deleteVignette( this );
			}
		});

		var completeQueue = G.queue.queue.slice(0);
		if (!excludeActiveCreature) {
			completeQueue.unshift(G.activeCreature);
		}
		completeQueue = completeQueue.concat(["nextround"], G.queue.nextQueue);

		var u = 0;

		// Updating
		for (var i = 0; i < completeQueue.length; i++) {
			var queueElem;
			// Round Marker
			if( typeof completeQueue[i] == "string" ) {

				queueElem = '<div turn="' + (G.turn+u) + '" roundmarker="1" class="vignette roundmarker"><div class="frame"></div><div class="stats">Round ' + (G.turn + 1) + '</div></div>';

				// If this element does not exists
				if( $vignettes[i] === undefined ) {
					// Create it
					appendVignette(i, queueElem);
				}else{
					// While its not the round marker
					while (i < $vignettes.length &&
							$j($vignettes[i]).attr("roundmarker") === undefined) {
						deleteVignette($vignettes[i]);
					}
				}
				u++;

			// Creature Vignette
			}else{

				queueElem = '<div turn="' + (G.turn+u) + '" creatureid="' + completeQueue[i].id + '" class="vignette hidden p' + completeQueue[i].team + " type" + completeQueue[i].type + '"><div class="frame"></div><div class="overlay_frame"></div><div class="stats"></div></div>';

				// If this element does not exists
				if( $vignettes[i] === undefined ) {
					// Create it
					appendVignette(i, queueElem);
				}else{
					// While it's not the right creature
					while (true) {
						var v = $vignettes[i];
						var $v = $j(v);
						var vid = parseInt($v.attr("creatureid"));
						if (vid === completeQueue[i].id) {
							break;
						}

						// Check if the vignette exists at all; if not delete
						if (!isNaN(vid) && $j.grep(completeQueue, function(item) {
							return item.id === vid;
						}).length === 0) {
							deleteVignette(v);
							continue;
						}

						if (isNaN(vid)) { // Is Round Marker
							// Create element before
							appendVignette(i-1, queueElem);
						} else {
							// See if the creature has moved up the queue
							var found = false;
							for (var j = 0; j < i && !found; j++) {
								if (vid === completeQueue[j].id) {
									found = true;
								}
							}
							if (found) {
								// Create element before
								appendVignette(i-1, queueElem);
							} else {
								// Remove element
								deleteVignette(v);
							}
						}
					}
				}
			}

			// Tag as verified
			$j($vignettes[i]).attr("verified", 1);
		}

		// Delete non verified
		deleteVignette( this.$queue.find('.vignette[verified="0"]') );

		updatePos();

		this.updateFatigue();

		// Set active creature
		this.$queue.find('.vignette.active').removeClass("active"); // Avoid bugs
		this.$queue.find('.vignette[verified="1"]')
			.first().clearQueue().addClass("active")
			.css( { transformOrigin: '0px 0px' } )
			.transition( { scale : 1.25, x : 0 }, queueAnimSpeed, transition);

		// Add mouseover effect

		this.$queue.find('.vignette.roundmarker').unbind("mouseover").unbind("mouseleave").bind("mouseover", function() {
			G.grid.showGrid(true);
		}).bind("mouseleave",function() {
			G.grid.showGrid(false);
		});

		this.$queue.find('.vignette').not(".roundmarker").unbind("mousedown").unbind("mouseover").unbind("mouseleave").bind("mouseover", function() {
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
		}).bind("mousedown",function() { // Show dash on click
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
			if (this instanceof Creature) {
				var textElement = $j('#queuewrapper .vignette[creatureid="' + this.id + '"]').children(".stats");
				textElement.css({background: 'black'});
				var text;
				if (this.stats.frozen) {
					text = "Frozen";
					textElement.css({background: 'darkturquoise'});
				} else if (this.materializationSickness) {
					text = "Sickened";
				} else if (this.protectedFromFatigue || this.stats.fatigueImmunity) {
					text = "Protected";
				} else if (this.endurance > 0) {
					text = this.endurance + "/" + this.stats.endurance;
				} else if (this.stats.endurance === 0) {
					text = "Fragile";
					// Display message if the creature has first become fragile
					if (this.fatigueText !== text) {
						G.log("%CreatureName" + this.id + "% has become fragile");
					}
				} else {
					text = "Fatigued";
				}

				if(this.type == "--") { // If Dark Priest
					this.abilities[0].require(); // Update protectedFromFatigue
				}

				textElement.text(text);
				this.fatigueText = text;
			}
		});

	}

});

var Chat = Class.create( {
	/*	Constructor
	*
	*	Chat/Log Functions
	*
	*/
	initialize: function() {
		this.$chat = $j("#chat");
		this.$content = $j("#chatcontent");
		this.$chat.bind( 'click',function() { G.UI.chat.toggle(); } );
		$j("#combatwrapper, #toppanel, #dash, #endscreen").bind('click',function() { G.UI.chat.hide(); } );
	},


	show : function() { this.$chat.addClass("focus"); },
	hide : function() { this.$chat.removeClass("focus"); },
	toggle : function() { this.$chat.toggleClass("focus"); this.$content.parent().scrollTop(this.$content.height()); },

	addMsg : function(msg,htmlclass) {
		var time = new Date(new Date() - G.startMatchTime);
		this.$content.append("<p class='"+htmlclass+"'><i>"+zfill(time.getUTCHours(), 2)+":"+zfill(time.getMinutes(), 2)+":"+zfill(time.getSeconds(), 2)+"</i> "+msg+"</p>");
		this.$content.parent().scrollTop(this.$content.height());
	},
});


var Button = Class.create( {
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

		opts = $j.extend(defaultOpts, opts);
		$j.extend(this, opts);
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

var ProgessBar = Class.create( {

	initialize: function(opts) {
		defaultOpts = {
			height : 318,
			width : 9,
			color : "red",
			$bar : undefined
		};

		opts = $j.extend(defaultOpts, opts);
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
		this.$bar.css( {
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
		this.$bar.transition( {
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
		this.$preview.css( {
			width : this.width-2,
			height : (this.height-2)*percentage,
		},500,"linear");
	}
});

jQuery(document).ready(function() { 
    musicPlayer.init();
});

var musicPlayer = {
    init: function() {

        var mp = this;

        this.current = 0;
        this.audio = jQuery('#audio')[0];
        this.playlist = jQuery('#playlist');
        this.tracks = this.playlist.find('li a');

        this.repeat = true;
        this.shuffle = true;

        this.audio.volume = .25;
        this.audio.pause();

        jQuery('#mp_shuffle').addClass("active").click(function(e) {
            jQuery(this).toggleClass("active");
            mp.shuffle = !mp.shuffle;
        });

        this.playlist.find('a').click(function(e) {
            e.preventDefault();
            mp.current = jQuery(this).parent().index();
            mp.run( jQuery(this) );
        });

        this.audio.addEventListener('ended',function(e) {
            if(mp.shuffle){
                mp.playRandom();
            } else {
                mp.playNext();
            }
        });
    },

    playRandom: function() {
        do {
            var rand = Math.floor( Math.random() * ( this.tracks.length - 1 ) );
        } while(rand == this.current); // Don't play the same track twice in a row
        this.current = rand;
        var link = this.playlist.find('a')[this.current];
        this.run( jQuery(link) );
    },

    playNext: function() {
        this.current++;
        if(this.current == this.tracks.length && this.repeat) {
            this.current = 0;
        }
        var link = this.playlist.find('a')[this.current];
        this.run( jQuery(link) );
    },

    run: function(link) {
        // Style the active track in the playlist
        par = link.parent();
        par.addClass('active').siblings().removeClass('active');

        this.audio.src = link.attr("href");
        this.audio.load();
        this.audio.play();
    }

};

/** Initialize the game global variable */
var G = new Game();
/*****************************************/

$j(document).ready(function() {
	$j(".typeRadio").buttonset();
	$j("#startButton").button();

	$j("form#gameSetup").submit(function(e) {
		e.preventDefault(); // Prevent submit
		var gameconfig = {
			playerMode : $j('input[name="playerMode"]:checked').val()-0,
			creaLimitNbr : $j('input[name="activeUnits"]:checked').val()-0, // DP counts as One
			unitDrops : $j('input[name="unitDrops"]:checked').val()-0,
			abilityUpgrades : $j('input[name="abilityUpgrades"]:checked').val()-0,
			plasma_amount : $j('input[name="plasmaPoints"]:checked').val()-0,
			turnTimePool : $j('input[name="turnTime"]:checked').val()-0,
			timePool : $j('input[name="timePool"]:checked').val()*60,
			background_image : $j('input[name="combatLocation"]:checked').val(),

		};

		if( gameconfig.background_image == "random" ) {
			var index = Math.floor(Math.random() * ($j('input[name="combatLocation"]').length - 1) ) + 1;  // nth-child indices start at 1
			gameconfig.background_image = $j('input[name="combatLocation"]').slice(index, index+1).attr("value");
		}
		G.loadGame(gameconfig);
		return false; // Prevent submit
	});
});

/*	HexGrid Class
*
*	Object containing grid and hexagons DOM element and methods concerning the whole grid
*	Should only have one instance during the game.
*
*/
var HexGrid = Class.create( {

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

		this.display 			= G.Phaser.add.group(undefined, "displayGrp");
		this.display.x = 230;
		this.display.y = 380;

		this.gridGroup 			= G.Phaser.add.group(this.display, "gridGrp");
		this.gridGroup.scale.set(1, 0.75);

		this.trapGroup			= G.Phaser.add.group(this.gridGroup, "trapGrp");
		this.dispHexsGroup		= G.Phaser.add.group(this.gridGroup, "dispHexsGrp");
		this.overHexsGroup		= G.Phaser.add.group(this.gridGroup, "overHexsGrp");
		this.dropGroup 			= G.Phaser.add.group(this.display, "dropGrp");
		this.creatureGroup 		= G.Phaser.add.group(this.display, "creaturesGrp");
		// Parts of traps displayed over creatures
		this.trapOverGroup 		= G.Phaser.add.group(this.display, "trapOverGrp");
		this.trapOverGroup.scale.set(1, 0.75);
		this.inptHexsGroup		= G.Phaser.add.group(this.gridGroup, "inptHexsGrp");

		// Populate grid
		for (var row = 0; row < opts.nbrRow; row++) {
			this.hexs.push(new Array());
			for (var hex = 0; hex < opts.nbrHexsPerRow; hex++) {
				if( hex == opts.nbrHexsPerRow - 1 ) {
					if( row % 2 == 0 && !opts.firstRowFull ) continue;
					if( row % 2 == 1 && opts.firstRowFull ) continue;
				}
				this.hexs[row][hex] = new Hex(hex, row, this);
				this.allHexs.push(this.hexs[row][hex]);
			};
		};

		this.selectedHex = this.hexs[0][0];
	},

	querySelf: function(o) {
		var defaultOpt = {
			fnOnConfirm : function(crea, args) {},
			fnOnSelect : function(crea, args) {
				crea.hexagons.each(function() {
					this.overlayVisualState("creature selected player" + this.creature.team);
				});
			},
			fnOnCancel: function() {
				G.activeCreature.queryMove();
			},
			args : {},
			confirmText : "Confirm",
			id : G.activeCreature.id
		};

		o = $j.extend(defaultOpt,o);

		//o.fnOnConfirm(G.activeCreature,o.args); // Autoconfirm

		G.activeCreature.hint(o.confirmText, "confirm");

		this.queryHexs({
			fnOnConfirm : function(hex, args) { args.opt.fnOnConfirm(G.activeCreature, args.opt.args); },
			fnOnSelect : function(hex, args) { args.opt.fnOnSelect(G.activeCreature, args.opt.args); },
			fnOnCancel : function(hex, args) { args.opt.fnOnCancel(G.activeCreature, args.opt.args); },
			args : { opt : o },
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
	*	team : 				Team
	*	requireCreature : 	Boolean : 	Disable a choice if it does not contain a creature matching the team argument
	*	distance :			Integer :	if defined, maximum distance of query in hexes
	*	minDistance :		Integer :	if defined, minimum distance of query, 1 = 1 hex gap required
	* 	args : 				Object : 	Object given to the events function (to easily pass variable for these function)
	*/
	queryDirection: function(o) {
		var defaultOpt = {
			team: Team.enemy,
			requireCreature: true,
			id : 0,
			flipped : false,
			x : 0,
			y : 0,
			hexesDashed: [],
			directions : [1, 1, 1, 1, 1, 1],
			includeCrea : true,
			stopOnCreature: true,
			dashedHexesAfterCreatureStop: true,
			distance : 0,
			minDistance: 0,
			sourceCreature : undefined,
		};

		// This is alway true
		o.isDirectionsQuery = true;

		o = this.getDirectionChoices(o);

		G.grid.queryChoice(o);
	},

	/**
	 * Get an object that contains the choices and hexesDashed for a direction
	 * query.
	 * @param {Object} o
	 * @returns {Object}
	 */
	getDirectionChoices: function(o) {
		var defaultOpt = {
			team: Team.enemy,
			requireCreature: true,
			id : 0,
			flipped : false,
			x : 0,
			y : 0,
			hexesDashed: [],
			directions : [1, 1, 1, 1, 1, 1],
			includeCrea : true,
			stopOnCreature: true,
			dashedHexesAfterCreatureStop: true,
			distance : 0,
			minDistance: 0,
			sourceCreature : undefined,
		};
		o = $j.extend(defaultOpt, o);

		// Clean Direction
		G.grid.forEachHexs(function() { this.direction = -1; });

		o.choices = [];
		for (var i = 0; i < o.directions.length; i++) {
			if(!!o.directions[i]) {
				var dir = [];
				var fx = 0;

				if( o.sourceCreature instanceof Creature ) {
					if( (!o.sourceCreature.player.flipped && i > 2) || (o.sourceCreature.player.flipped && i < 3) ) {
						fx =  - 1 * (o.sourceCreature.size - 1);
					}
				}

				dir = G.grid.getHexLine(o.x + fx, o.y, i, o.flipped);

				// Limit hexes based on distance
				if (o.distance > 0) {
					dir = dir.slice(0, o.distance + 1);
				}
				if (o.minDistance > 0) {
					// Exclude current hex
					dir = dir.slice(o.minDistance + 1);
				}

				var hexesDashed = [];
				dir.each(function() {
					this.direction = (o.flipped) ? 5 - i : i;
					if (o.stopOnCreature && o.dashedHexesAfterCreatureStop) {
						hexesDashed.push(this);
					}
				});

				dir.filterCreature(o.includeCrea, o.stopOnCreature, o.id);

				if (dir.length === 0) continue;

				if (o.requireCreature) {
					var validChoice = false;
					// Search each hex for a creature that matches the team argument
					for (var j = 0; j < dir.length; j++) {
						var creaTarget = dir[j].creature;
						if (creaTarget instanceof Creature && creaTarget.id !== o.id) {
							var creaSource = G.creatures[o.id];
							if (isTeam(creaSource, creaTarget, o.team)) {
								validChoice = true;
								break;
							}
						}
					}
					if (!validChoice) {
						continue;
					}
				}

				if (o.stopOnCreature && o.includeCrea && (i === 1 || i === 4)) {
					// Only straight direction
					if(dir.last().creature instanceof Creature) {
						// Add full creature
						var creature = dir.last().creature;
						dir.pop();
						dir = dir.concat(creature.hexagons);
					}
				}

				dir.each(function() { hexesDashed.removePos(this); });

				o.hexesDashed = o.hexesDashed.concat(hexesDashed);
				o.choices.push(dir);
			}
		}

		return o;
	},


	/*
	*	queryChoice(o)
	*
	*	fnOnSelect : 		Function : 	Function applied when clicking on one of the available hexs.
	*	fnOnConfirm : 		Function : 	Function applied when clicking again on the same hex.
	*	fnOnCancel : 		Function : 	Function applied when clicking a non reachable hex
	*	requireCreature : 	Boolean : 	Disable a choice if it does not contain a creature matching the team argument
	* 	args : 				Object : 	Object given to the events function (to easily pass variable for these function)
	*/
	queryChoice: function(o) {
		var defaultOpt = {
			fnOnConfirm : function(choice, args) { G.activeCreature.queryMove(); },
			fnOnSelect : function(choice, args) {
				choice.each(function() {
					if(this.creature instanceof Creature) {
						this.overlayVisualState("creature selected player" + this.creature.team);
					}else{
						this.displayVisualState("adj");
					}

				});
			},
			fnOnCancel: function(hex,args) { G.activeCreature.queryMove(); },
			team: Team.enemy,
			requireCreature : 1,
			id : 0,
			args : {},
			flipped : false,
			choices : [],
			hexesDashed: [],
			isDirectionsQuery : false,
			hideNonTarget: true
		};

		o = $j.extend(defaultOpt, o);

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
						if (isTeam(creaSource, creaTarget, o.team)) {
							validChoice = true;
						}
					}
				}
			}

			if(validChoice) hexs = hexs.concat(o.choices[i]);
			else if(o.isDirectionsQuery) {
				G.grid.forEachHexs(function() {
					if(o.choices[i][0].direction == this.direction)
						o.hexesDashed.removePos(this);
				});
			}
		}

		this.queryHexs({
			fnOnConfirm : function(hex, args) {
				// Determine which set of hexs (choice) the hex is part of
				for (var i = 0; i < args.opt.choices.length; i++) {
					for (var j = 0; j < args.opt.choices[i].length; j++) {
						if(hex.pos == args.opt.choices[i][j].pos) {
							args.opt.args.direction = hex.direction;
							args.opt.fnOnConfirm(args.opt.choices[i], args.opt.args);
							return;
						}
					}
				}
			},
			fnOnSelect : function(hex, args) {
				// Determine which set of hexs (choice) the hex is part of
				for (var i = 0; i < args.opt.choices.length; i++) {
					for (var j = 0; j < args.opt.choices[i].length; j++) {
						if(hex.pos==args.opt.choices[i][j].pos) {
							args.opt.args.direction = hex.direction;
							args.opt.args.hex = hex;
							args.opt.args.choiceIndex = i;
							args.opt.fnOnSelect(args.opt.choices[i], args.opt.args);
							return;
						}
					}
				}
			},
			fnOnCancel : o.fnOnCancel,
			args : { opt : o },
			hexs : hexs,
			hexesDashed: o.hexesDashed,
			flipped : o.flipped,
			hideNonTarget: o.hideNonTarget,
			id : o.id
		});
	},

	/* 	queryCreature(o)
	*
	*	fnOnSelect : 	Function : 	Function applied when clicking on one of the available hexs.
	*	fnOnConfirm : 	Function : 	Function applied when clicking again on the same hex.
	*	fnOnCancel : 	Function : 	Function applied when clicking a non reachable hex
	*	team : 			Team
	*	id : 			Integer : 	Creature ID
	* 	args : 			Object : 	Object given to the events function (to easily pass variable for these function)
	*/
	queryCreature: function(o) {

		var defaultOpt = {
			fnOnConfirm : function(crea, args) { G.activeCreature.queryMove(); },
			fnOnSelect : function(crea, args) { crea.tracePosition({ overlayClass: "creature selected player" + crea.team }); },
			fnOnCancel : function(hex, args) { G.activeCreature.queryMove(); },
			optTest : function(crea) { return true; },
			args : {},
			hexs : [],
			hexesDashed: [],
			flipped : false,
			id : 0,
			team: Team.enemy,
		};

		o = $j.extend(defaultOpt,o);

		// Exclude everything but the creatures
		o.hexs.filter(function() {
			if( this.creature instanceof Creature && this.creature.id!=o.id ) {

				if (!o.optTest(this.creature)) return false;

				var creaSource = G.creatures[o.id];
				var creaTarget = this.creature;

				if (isTeam(creaSource, creaTarget, o.team)) {
					return true;
				}
			}
			return false;
		});

		var extended = [];
		o.hexs.each(function() { extended = extended.concat(this.creature.hexagons); });

		o.hexs = extended;

		this.queryHexs({
			fnOnConfirm : function(hex, args) {
				var crea = hex.creature;
				args.opt.fnOnConfirm(crea, args.opt.args);
			},
			fnOnSelect : function(hex, args) {
				var crea = hex.creature;
				args.opt.fnOnSelect(crea, args.opt.args);
			},
			fnOnCancel : o.fnOnCancel,
			args : { opt : o },
			hexs : o.hexs,
			hexesDashed: o.hexesDashed,
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
			fnOnConfirm : function(hex, args) { G.activeCreature.queryMove(); },
			fnOnSelect : function(hex, args) {
				G.activeCreature.faceHex(hex, undefined, true);
				hex.overlayVisualState("creature selected player" + G.activeCreature.team);
			},
			fnOnCancel : function(hex,args) { G.activeCreature.queryMove(); },
			args : {},
			hexs : [],
			hexesDashed: [],
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
			if (o.hexesDashed.indexOf(this) !== -1) {
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
					if( (x + offset - i *mult >= G.grid.hexs[y].length) || (x + offset - i * mult < 0) ) continue;
					if(G.grid.hexs[y][x + offset - i * mult].isWalkable(o.size, o.id)) {
						x += offset - i * mult;
						availablePos = true;
						break;
					}
				};

				// if(!availablePos) {
				// 	//Prevent Bugs
				// 	console.log("nowhere to go");
				// 	return;
				// }

				hex = G.grid.hexs[y][x]; // New coords
				var clickedtHex = hex;

				G.activeCreature.faceHex(clickedtHex, undefined, true, true);

				if( clickedtHex != G.grid.lastClickedHex ) {
					G.grid.lastClickedHex = clickedtHex;
					// ONCLICK
					o.fnOnConfirm(clickedtHex, o.args);
				}else{
					// ONCONFIRM
					o.fnOnConfirm(clickedtHex, o.args);
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
						this.overlayVisualState("hover h_player" + crea.team);
					});
					G.UI.xrayQueue(crea.id);
				}else{ // If nothing
					hex.overlayVisualState("hover");
				}
			}else{ // Reachable hex


				//Offset Pos
				var offset = (o.flipped) ? o.size - 1 : 0 ;
				var mult = (o.flipped) ? 1 : -1 ; // For FLIPPED player
				var availablePos = false;

				for (var i = 0; i < o.size; i++) {	// Try next hexagons to see if they fit
					if( (x + offset - i * mult >= G.grid.hexs[y].length) || (x + offset - i * mult < 0) ) continue;
					if(G.grid.hexs[y][x + offset - i * mult].isWalkable(o.size, o.id)) {
						x += offset - i * mult;
						availablePos = true;
						break;
					}
				};

				// if(!availablePos) {
				// 	//Prevent Bugs
				// 	console.log("nowhere to go");
				// 	return;
				// }

				hex = G.grid.hexs[y][x]; // New coords
				o.fnOnSelect(hex, o.args);
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
		// Clear previous ghost
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
				if(hide) {
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

	/* getHexLine(x, y, dir, flipped)
	*
	* Gets a line of hexes given a start point and a direction
	* The result is an array of hexes, starting from the start point's hex, and
	* extending out in a straight line.
	* If the coordinate is erroneous, returns an empty array.
	*
	* x, y: coordinate of start hex
	* dir: direction number (0 = upright, continues clockwise to 5 = upleft)
	* flipped
	*/
	getHexLine: function(x, y, dir, flipped) {
		switch (dir) {
			case 0: // Upright
				return G.grid.getHexMap(x, y-8, 0, flipped, diagonalup).reverse();
			case 1: // StraitForward
				return G.grid.getHexMap(x, y, 0, flipped, straitrow);
			case 2: // Downright
				return G.grid.getHexMap(x, y, 0, flipped, diagonaldown);
			case 3: // Downleft
				return G.grid.getHexMap(x, y, -4, flipped, diagonalup);
			case 4: // StraitBackward
				return G.grid.getHexMap(x, y, 0, !flipped, straitrow);
			case 5: // Upleft
				return G.grid.getHexMap(x, y-8, -4, flipped, diagonaldown).reverse();
			default:
				return [];
		}
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
					//if(this.hexagons[i]) {
					//	this.hexagons[i].display.alpha = 1;
					//	this.hexagons[i].overlay.alpha = 1;
					//}
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
					this.overlayVisualState("active creature player" + this.creature.team);
					this.displayVisualState("creature player" + this.creature.team);
				}else{
					this.displayVisualState("creature player" + this.creature.team);
				}
			}
		}); });
	},


	/*	hexExists(y, x)
	*
	*	x : 	Integer : 	Coordinates to test
	*	y : 	Integer : 	Coordinates to test
	*
	*	Test if hex exists
	*
	*/
	hexExists: function(y, x) {
		if( (y >= 0) && (y < this.hexs.length) ) {
			if( (x >= 0) && (x < this.hexs[y].length) ) return true;
		}
		return false;
	},


	/*	isHexIn(hex, hexArray)
	*
	*	hex : 		Hex : 		Hex to look for
	*	hexarray : 	Array : 	Array of hexes to look for hex in
	*
	*	Test if hex exists inside array of hexes
	*
	*/
	isHexIn: function(hex, hexArray) {
		for (var i = 0; i < hexArray.length; i++) {
			if(hexArray[i].x == hex.x && hexArray[i].y == hex.y) {
				return true;
			}
		}
		return false;
	},


	/* 	getMovementRange(x, y, distance, size, id)
	*
	*	x : 		Integer : 	Start position
	*	y : 		Integer : 	Start position
	*	distance : 	Integer : 	Distance from the start position
	*	size : 		Integer : 	Creature size
	*	id : 		Integer : 	Creature ID
	*
	*	return : 	Array : 	Set of the reachable hexs
	*/
	getMovementRange: function(x, y, distance, size, id) {
		//	Populate distance (hex.g) in hexs by asking an impossible
		//	destination to test all hexagons
		this.cleanReachable(); // If not pathfinding will bug
		this.cleanPathAttr(true); // Erase all pathfinding datas
		astar.search(G.grid.hexs[y][x], new Hex(-2, -2, null), size, id);

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
	getFlyingRange: function(x, y, distance, size, id) {

		// Gather all the reachable hexs
		var hexs = G.grid.hexs[y][x].adjacentHex(distance);

		hexs.filter(function() {
			return this.isWalkable(size, id, true);
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
	getHexMap: function(originx, originy, offsetx, flipped, array) { // Heavy logic in here

		var array = array.slice(0); // Copy to not modify original
		originx += (flipped) ? 1 - array[0].length-offsetx : -1 + offsetx;
		var hexs = [];

		for (var y = 0; y < array.length; y++) {

			array[y] = array[y].slice(0); // Copy Row

			// Translating to flipped patern
			if(flipped && y % 2 != 0) { // Odd rows
				array[y].push(0);
			}

			// Translating even to odd row patern
			array[y].unshift(0);
			if(originy % 2 != 0 && y % 2 != 0) { // Even rows
				if(flipped)
					array[y].pop(); // Remove last element as the array will be parse backward
				else
					array[y].splice(0, 1); // Remove first element
			}

			// Gathering hexs
			for (var x = 0; x < array[y].length; x++) {
				if( !!array[y][x] ) {
					xfinal = (flipped) ? array[y].length - 1 - x : x ; // Parse the array backward for flipped player
					if( this.hexExists(originy + y, originx + xfinal) ) {
						hexs.push(this.hexs[originy + y][originx + xfinal]);
					}
				}
			}
		}

		return hexs;
	},


	showGrid : function(val) {
		this.forEachHexs(function() {
			if(this.creature) this.creature.xray(val);
			if(this.drop) return;
			if(val) this.displayVisualState("showGrid");
			else this.cleanDisplayVisualState("showGrid");
		});
	},

	showMovementRange : function(id) {
		var crea = G.creatures[id];
		var hexs;
		if (crea.movementType() === "flying") {
			hexs = this.getFlyingRange(
				crea.x, crea.y, crea.stats.movement, crea.size, crea.id
			);
		} else {
			hexs = this.getMovementRange(
				crea.x, crea.y, crea.stats.movement, crea.size, crea.id
			);
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
		if( this.hexExists(this.selectedHex.y - 1, this.selectedHex.x) ) {
			var hex =  this.hexs[this.selectedHex.y - 1][this.selectedHex.x];
			this.selectedHex = hex;
			hex.onSelectFn();
		}
	},

	selectHexDown : function() {
		if( this.hexExists(this.selectedHex.y + 1, this.selectedHex.x) ) {
			var hex =  this.hexs[this.selectedHex.y + 1][this.selectedHex.x];
			this.selectedHex = hex;
			hex.onSelectFn();
		}
	},

	selectHexLeft : function() {
		if( this.hexExists(this.selectedHex.y, this.selectedHex.x - 1) ) {
			var hex =  this.hexs[this.selectedHex.y][this.selectedHex.x - 1];
			this.selectedHex = hex;
			hex.onSelectFn();
		}
	},

	selectHexRight : function() {
		if( this.hexExists(this.selectedHex.y, this.selectedHex.x + 1) ) {
			var hex =  this.hexs[this.selectedHex.y][this.selectedHex.x + 1];
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
	cleanDisplay: function(cssClass) {
		this.forEachHexs(function() { this.cleanDisplayVisualState(cssClass) });
	},
	cleanOverlay: function(cssClass) {
		this.forEachHexs(function() { this.cleanOverlayVisualState(cssClass) });
	},

	/*	previewCreature(creatureData)
	*
	*	pos : 			Object : 	Coordinates {x,y}
	*	creatureData : 	Object : 	Object containing info from the database (G.retreiveCreatureStats)
	*
	*	Draw a preview of the creature at the given coordinates
	*/
	previewCreature:function(pos, creatureData, player) {

		this.updateDisplay(); // Retrace players creatures

		var creaHex = this.hexs[pos.y][pos.x-(creatureData.size-1)];

		if( !G.grid.materialize_overlay ) { // If sprite does not exists
			// Adding sprite
			this.materialize_overlay = this.creatureGroup.create(0, 0, creatureData.name + '_cardboard');
			this.materialize_overlay.anchor.setTo(0.5,1);
			this.materialize_overlay.posy = pos.y;
		}else{
			this.materialize_overlay.loadTexture(creatureData.name + '_cardboard');
			if( this.materialize_overlay.posy != pos.y) {
				this.materialize_overlay.posy = pos.y;
				this.orderCreatureZ();
			}
		}


		// Placing sprite
		this.materialize_overlay.x = creaHex.displayPos.x + ((!player.flipped) ? creatureData.display["offset-x"] : 90*creatureData.size-this.materialize_overlay.texture.width-creatureData.display["offset-x"]) +this.materialize_overlay.texture.width/2;
		this.materialize_overlay.y = creaHex.displayPos.y + creatureData.display["offset-y"] + this.materialize_overlay.texture.height;
		this.materialize_overlay.alpha = 0.5;

		if(player.flipped) {
			this.materialize_overlay.scale.setTo(-1, 1);
		}else{
			this.materialize_overlay.scale.setTo(1, 1);
		}

		for (var i = 0; i < creatureData.size; i++) {
			this.hexs[pos.y][pos.x-i].overlayVisualState("creature selected player" + G.activeCreature.team);
		}
	},

	debugHex: function(hexs) {
		$j(".debug").remove();
		var i = 0;
		hexs.each(function() {
			var a = G.grid.$creatureW.append('<div class=".debug" id="debug' + i + '"></div>').children("#debug" + i);
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
		this.coord = String.fromCharCode(64+this.y + 1) + (this.x + 1);

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

		// Horizontal hex grid, width is distance between opposite sides
		this.width = 90;
		this.height = this.width / Math.sqrt(3) * 2 * 0.75;
		this.displayPos = {
			x: ((y%2 === 0) ? x + 0.5 : x) * this.width,
			y: y * this.height
		};

		this.originalDisplayPos = $j.extend({}, this.displayPos);

		this.tween = null;

		if(grid) {

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
				G.grid.xray( new Hex(-1, -1) ); // Clear Xray
				G.UI.xrayQueue( -1 ); // Clear Xray Queue
			}, this);

			this.input.events.onInputUp.add(function(Sprite, Pointer) {
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
			var startX, endX;
			if(this.y%2 == 0) {
				// Evenrow
				startX = Math.ceil(Math.abs(i)/2) - distance;
				endX = distance - Math.floor(Math.abs(i)/2);
			}else{
				// Oddrow
				startX = Math.floor(Math.abs(i)/2) - distance;
				endX = distance - Math.ceil(Math.abs(i)/2);
			}
			for ( var deltaX = startX; deltaX <= endX; deltaX++) {
				var x = this.x + deltaX;
				var y = this.y + deltaY;
				// Exclude current hex
				if (deltaY == 0 && deltaX == 0) {
					continue;
				}
				if(y < G.grid.hexs.length && y >= 0 &&	x < G.grid.hexs[y].length && x >=0) {  // Exclude inexisting hexs
					adjHex.push(G.grid.hexs[y][x]);
				}
			}
		}
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
				if(i == 1) {
					for (var j = 0; j <= 1; j++) {
						if(G.grid.hexExists(this.y+i, this.x+j)) {
							if(G.grid.hexs[this.y+i][this.x+j].creature instanceof Creature) {
								var ghostedCreature = G.grid.hexs[this.y+i][this.x+j].creature;
							}
						}
					}
				}else{
					if(G.grid.hexExists(this.y+i, this.x)) {
						if(G.grid.hexs[this.y+i][this.x].creature instanceof Creature) {
							var ghostedCreature = G.grid.hexs[this.y+i][this.x].creature;
						}
					}
				}
			}else{
				if(i == 1) {
					for (var j = 0; j <= 1; j++) {
						if(G.grid.hexExists(this.y+i, this.x-j)) {
							if(G.grid.hexs[this.y+i][this.x-j].creature instanceof Creature) {
								var ghostedCreature = G.grid.hexs[this.y+i][this.x-j].creature;
							}
						}
					}
				}else{
					if(G.grid.hexExists(this.y+i, this.x)) {
						if(G.grid.hexs[this.y+i][this.x].creature instanceof Creature) {
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
	isWalkable: function(size, id, ignoreReachable) {
		var blocked = false;

		for (var i = 0; i < size; i++) {
			// For each Hex of the creature
			if( (this.x-i) >= 0 && (this.x-i) < G.grid.hexs[this.y].length ) { //if hex exists
				var hex = G.grid.hexs[this.y][this.x-i];
				// Verify if blocked. If it's blocked by one attribute, OR statement will keep it status
				blocked = blocked || hex.blocked ;
				if(!ignoreReachable) { blocked = blocked || !hex.reachable ; }
				if(hex.creature instanceof Creature) {

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

	/*	overlayVisualState
	*
	*	Change the appearance of the overlay hex
	*
	*/
	overlayVisualState: function(classes) {
		classes = (classes) ? classes: "";
		this.overlayClasses += " " + classes + " ";
		this.updateStyle();
	},

	/*	displayVisualState
	*
	*	Change the appearance of the display hex
	*
	*/
	displayVisualState: function(classes) {
		classes = (classes) ? classes: "";
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
			this.overlayClasses = this.overlayClasses.replace(regex, '');
		};

		this.updateStyle();
	},

	/*	cleanDisplayVisualState
	*
	*	Clear the appearance of the display hex
	*
	*/
	cleanDisplayVisualState: function(classes) {
		classes = classes || "adj hover creature player0 player1 player2 player3";

		var a = classes.split(' ');
		for (var i = 0; i < a.length; i++) {
			var regex = new RegExp("\\b"+a[i]+"\\b", 'g');
			this.displayClasses = this.displayClasses.replace(regex, '');
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

		if(this.displayClasses.match(/0|1|2|3/)) {
			var p = this.displayClasses.match(/0|1|2|3/);
			this.display.loadTexture("hex_p"+p);
			G.grid.dispHexsGroup.bringToTop(this.display);
		}else if(this.displayClasses.match(/adj/)) {
			this.display.loadTexture("hex_path");
		}else if(this.displayClasses.match(/dashed/)) {
			this.display.loadTexture("hex_dashed");
		}else{
			this.display.loadTexture("hex");
		}

		this.display.alpha = targetAlpha;
		// Too slow
		// if(this.display.alpha != targetAlpha) {
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
			this.overlay.loadTexture("cancel");
		}

		this.overlay.alpha = targetAlpha;

	},

	/**
	 * Add a trap to a hex.
	 * @param {string} type - name of sprite to use; see Phaser.load.image usage
	 * @param {Effect[]} effects - effects to activate when trap triggered
	 * @param {Player} owner - owner of trap
	 * @param {Object} opt - optional arguments merged into the Trap object
	 * Examples:
	 * - turnLifetime
	 * - fullTurnLifetime
	 * - ownerCreature
	 * - destroyOnActivate
	 * - typeOver
	 * @returns {Trap}
	 */
	createTrap: function(type, effects, owner, opt) {
		if(!!this.trap) this.destroyTrap();
		this.trap = new Trap(this.x,this.y,type,effects,owner,opt);
		return this.trap;
	},

	activateTrap: function(trigger, target) {
		if(!this.trap) return;
		var activated = false;
		this.trap.effects.each(function() {
			if( trigger.test(this.trigger) &&  this.requireFn() ) {
				G.log("Trap triggered");
				this.activate(target);
				activated = true;
			}
		});
		if (this.trap && this.trap.destroyOnActivate) {
			this.destroyTrap();
		}
	},

	destroyTrap: function() {
		if(!this.trap) return;
		delete G.grid.traps[this.trap.id];
		this.trap.destroy();
		delete this.trap;
	},

	//---------DROP FUNCTION---------//

	pickupDrop: function(crea) {
		if(!this.drop) return;
		this.drop.pickup(crea);
	},

	/**
	 * Override toJSON to avoid circular references when outputting to game log
	 * Used by game log only
	 */
	toJSON: function() {
		return {x: this.x, y: this.y};
	}
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
			destroyOnActivate: false,
			typeOver: undefined,
			destroyAnimation: undefined
		};

		$j.extend(this,o,opt);

		// Register
		G.grid.traps.push(this);
		this.id 		= trapID++;
		this.hex.trap 	= this;

		for (var i = this.effects.length - 1; i >= 0; i--) {
			this.effects[i].trap = this;
		};

		var spriteName = 'trap_' + type;
		var pos = this.hex.originalDisplayPos;
		this.display = G.grid.trapGroup.create(
			pos.x + this.hex.width / 2, pos.y + 60, spriteName);
		this.display.anchor.setTo(0.5);
		if (this.typeOver) {
			this.displayOver = G.grid.trapOverGroup.create(
				pos.x + this.hex.width / 2, pos.y + 60, spriteName);
			this.displayOver.anchor.setTo(0.5);
			this.displayOver.scale.x *= -1;
		}
	},

	destroy: function() {
		var tweenDuration = 500;
		var destroySprite = function(sprite, animation) {
			if (animation === 'shrinkDown') {
				sprite.anchor.y = 1;
				sprite.y += sprite.height / 2;
				var tween = G.Phaser.add.tween(sprite.scale)
				.to({y: 0}, tweenDuration, Phaser.Easing.Linear.None)
				.start();
				tween.onComplete.add(function() { this.destroy(); }, sprite);
			} else {
				sprite.destroy();
			}
		};
		destroySprite(this.display, this.destroyAnimation);
		if (this.displayOver) {
			destroySprite(this.displayOver, this.destroyAnimation);
		}

		// Unregister
		var i = G.grid.traps.indexOf(this);
		G.grid.traps.splice(i,1);
		this.hex.trap = undefined;
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


/**
 * Return a direction number given a delta x/y
 * Deltas in [-1, 1] should be used, but due to creature size, x can be greater
 * - delta x will be clamped for the calculation.
 * Due to the hex grid, the starting y coordinate matters.
 * @param {number} y - y coordinate to calculate from
 * @param {number} dx - delta x
 * @param {number} dy - delta y, in range [-1, 1]
 * @return {number} the direction number
 */
function getDirectionFromDelta(y, dx, dy) {
	// Due to target size, this could be off; limit dx
	if (dx > 1) dx = 1;
	if (dx < -1) dx = -1;
	var dir;
	if (dy === 0) {
		if (dx === 1) {
			dir = 1; // forward
		} else { // dx === -1
			dir = 4; // backward
		}
	} else {
		// Hex grid corrections
		if (y % 2 === 0 && dx < 1) {
			dx++;
		}
		if (dx === 1) {
			if (dy === -1) {
				dir = 0; // upright
			} else { // dy === 1
				dir = 2; // downright
			}
		} else { // dx === 0
			if (dy === 1) {
				dir = 3; // downleft
			} else { // dy === -1
				dir = 5; // upleft
			}
		}
	}
	return dir;
}

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

	/*	filterCreature(includeCrea, stopOnCreature, id)
	*	Filters in-place an array of hexes based on creatures.
	* The array typically represents a linear sequence of hexes, to produce a
	* subset/superset of hexes that contain or don't contain creatures.
	*
	*	includeCrea : 		Boolean : 	Add creature hexs to the array
	*	stopOnCreature : 	Boolean : 	Cut the array when finding a creature
	*	id : 				Integer : 	Creature id to remove
	*
	*	return : 		Array : 	filtered array
	*/
	Array.prototype.filterCreature = function(includeCrea, stopOnCreature, id) {
		var creaHexs = [];

		for (var i = 0; i < this.length; i++) {
		 	if(this[i].creature instanceof Creature) {
		 		if(!includeCrea || this[i].creature.id==id) {
		 			if(this[i].creature.id==id) {
		 				this.splice(i, 1);
		 				i--;
		 				continue;
		 			}else{
		 				this.splice(i, 1);
		 				i--;
		 			}
		 		}else{
		 			creaHexs = creaHexs.concat(this[i].creature.hexagons);
		 		}
		 		if(stopOnCreature) {
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
		for(var i=0; i<this.length; i++) {
			for (var j = 0; j < size; j++) {
				// NOTE : This code produce array with doubles.
				if( G.grid.hexExists(this[i].y, this[i].x-j) )
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
		for(var i=0; i<this.length; i++) {
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

back2hex = [
	 [0,0,0,0],
	[0,1,0,0],
	 [1,0,0,0], // Origin line
	[0,1,0,0]
];
back2hex.origin = [2,2];

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

var Team = Object.freeze({
  enemy: 1,
  ally: 2,
  same: 3,
  both: 4
});

function isTeam(creature1, creature2, team) {
  switch (team) {
    case Team.enemy:
      return creature1.team % 2 !== creature2.team % 2;
    case Team.ally:
      return creaSource.team % 2 === creaTarget.team % 2;
    case Team.same:
      return creaSource.team === creaTarget.team;
    case Team.both:
      return true;
  }
}

/*
*
*	Abolished abilities
*
*/
G.abilities[7] =[

// 	First Ability: Burning Heart
{
	trigger: "onOtherDamage",

	// 	require() :
	require : function(damage) {
		if( !this.testRequirements() ) return false;
		if (damage === undefined) {
			damage = { type: "target" }; // For the test function to work
		}
		return true;
	},

	//  activate() :
	activate : function(damage, target) {
		if (this.creature.id !== damage.attacker.id) {
			return;
		}

		target.addEffect(new Effect(
			"Burning Heart", //Name
			this.creature, //Caster
			target, //Target
			"", //Trigger
			{ alterations: { burn: -1 } } //Optional arguments
		));
		target.stats.burn -= 1;
		if (this.isUpgraded()) {
			this.creature.addEffect(new Effect(
				"Burning Heart", //Name
				this.creature, //Caster
				this.creature, //Target
				"", //Trigger
				{ alterations: { burn: 1 } } //Optional arguments
			));
		}
	},
},


// 	Second Ability: Fiery Touch
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	distance : 3,
	_targetTeam: Team.enemy,

	// 	require() :
	require : function() {
		if(!this.testRequirements()) return false;
		if (!this.testDirection({
				team: this._targetTeam, distance: this.distance,
				sourceCreature: this.creature
			})) {
			return false;
		}
		return true;
	},

	// 	query() :
	query : function() {
		var ability = this;
		var crea = this.creature;

		if(this.isUpgraded()) this.distance = 5;

		G.grid.queryDirection({
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			flipped : crea.player.flipped,
			team: this._targetTeam,
			id : this.creature.id,
			requireCreature : true,
			x : crea.x,
			y : crea.y,
			distance : this.distance,
			sourceCreature : crea,
		});
	},


	//	activate() :
	activate : function(path, args) {
		var ability = this;
		ability.end();

		var target = path.last().creature;

		var damage = new Damage(
			ability.creature, // Attacker
			ability.damages, // Damage Type
			1, // Area
			[]	// Effects
		);
		target.takeDamage(damage);
	},
},



// 	Third Ability: Wild Fire
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function() {
		return this.testRequirements();
	},

	range : 6,

	// 	query() :
	query : function() {
		var ability = this;
		var crea = this.creature;

		// Teleport to any hex within range except for the current hex
		crea.queryMove({
			noPath : true,
			isAbility : true,
			range: G.grid.getFlyingRange(crea.x, crea.y, this.range, crea.size, crea.id),
			callback: function(hex, args) {
				if (hex.x == args.creature.x && hex.y == args.creature.y) {
					// Prevent null movement
					ability.query();
					return;
				}
				delete arguments[1];
				ability.animation.apply(ability, arguments);
			}
		});
	},


	//	activate() :
	activate : function(hex, args) {
		var ability = this;
		ability.end();

		if( this.isUpgraded() ) {
			this.range += 1;
		}


		var targets = ability.getTargets(ability.creature.adjacentHexs(1));

		targets.each(function() {
			if (!(this.target instanceof Creature)) return;
		});

		// Leave a Firewall in current location
		var effectFn = function(effect, creatureOrHex) {
			var creature = creatureOrHex;
			if (!(creatureOrHex instanceof Creature)) {
				creature = creatureOrHex.creature;
			}
			creature.takeDamage(
				new Damage(effect.attacker, ability.damages , 1, []),
				{ isFromTrap: true });
			this.trap.destroy();
		};

		var requireFn = function() {
			if (this.trap.hex.creature === 0) return false;
			return this.trap.hex.creature.type !== ability.creature.type;
		};

    var crea = this.creature;
		crea.hexagons.each(function() {
			this.createTrap("firewall", [
				new Effect(
					"Firewall",crea,this,"onStepIn",
					{ requireFn: requireFn, effectFn: effectFn,	attacker: crea }
				),
			],crea.player, { turnLifetime : 1, ownerCreature : crea, fullTurnLifetime : true } );
		});

		ability.creature.moveTo(hex, {
			ignoreMovementPoint : true,
			ignorePath : true,
			animation : "teleport",
			callback : function() {
				G.activeCreature.queryMove();
			}
		});
	},
},



// 	Fourth Ability: Greater Pyre
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function() {
		return this.testRequirements();
	},

	// 	query() :
	query : function() {
		var ability = this;
		var crea = this.creature;

		// var inRangeCreatures = crea.hexagons[1].adjacentHex(1);

		var range = crea.adjacentHexs(1);

		G.grid.queryHexs( {
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			fnOnSelect : function(hex, args) {
				range.each(function() {
					if (this.creature) {
						this.overlayVisualState("creature selected weakDmg player"+this.creature.team);
					}
				});
				hex.cleanOverlayVisualState();
				hex.overlayVisualState("creature selected player"+G.activeCreature.team);
			},
			id : this.creature.id,
			hexs : range,
			hideNonTarget : true,
		});
	},


	//	activate() :
	activate : function(hex, args) {
		var ability = this;
		ability.end();

		var crea = this.creature;
		var aoe = crea.adjacentHexs(1);
		var targets = ability.getTargets(aoe);

		if(this.isUpgraded()) this.damages.burn = 30;

		targets.each(function() {
			this.target.takeDamage(new Damage(
				ability.creature, // Attacker
				ability.damages, // Damage Type
				1, // Area
				[]	// Effects
			));
		});

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
	trigger: "onReset",

	//	require() :
	require : function(){
		return this.testRequirements();
	},

	activate: function() {
		// Only activate when fatigued
		if (!this.creature.isFatigued()) {
			return;
		}

		if (this.isUpgraded()) {
			this.creature.heal(Math.floor(this.creature.stats.regrowth / 2), true);
		}
		if (this.creature.stats.meditation > 0) {
			this.creature.recharge(Math.floor(this.creature.stats.meditation / 2));
		}
	}
},



//	Second Ability: Tooth Fairy
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	_targetTeam: Team.enemy,

	//	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if (!this.atLeastOneTarget(
					G.grid.getHexMap(
						this.creature.x - 3, this.creature.y - 2, 0, false, frontnback3hex),
					{ team: this._targetTeam })) {
			return false;
		}

		return true;
	},

	//	query() :
	query : function() {
		var ability = this;
		var chimera = this.creature;

		G.grid.queryCreature( {
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			team: this._targetTeam,
			id : chimera.id,
			flipped : chimera.flipped,
			hexs : G.grid.getHexMap(chimera.x - 3, chimera.y - 2, 0, false, frontnback3hex),
		});
	},


	//	activate() :
	activate : function(target, args) {
		var ability = this;

		ability.end();

		var damage = new Damage(
			ability.creature, // Attacker
			ability.damages, // Damage Type
			1, // Area
			[]	// Effects
		);
		target.takeDamage(damage);
		if (this.isUpgraded()) {
			// Second attack
			target.takeDamage(damage);
		}
	},
},

//	Third Ability: Disturbing Sound
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	_targetTeam: Team.both,

	//	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if (!this.testDirection(
				{ team: this._targetTeam, sourceCreature: this.creature })) {
			return false;
		}
		return true;
	},

	//	query() :
	query : function(){
		var ability = this;
		var chimera = this.creature;

		G.grid.queryDirection({
			fnOnConfirm : function(){ ability.animation.apply(ability, arguments); },
			flipped : chimera.player.flipped,
			team: this._targetTeam,
			id : chimera.id,
			requireCreature : true,
			x : chimera.x,
			y : chimera.y,
			sourceCreature: chimera
		});
	},


	//	activate() :
	activate : function(path, args) {
		var ability = this;

		ability.end();

		var target = path.last().creature;
		var hexes = G.grid.getHexLine(
			target.x, target.y, args.direction, target.flipped);

		var damage = new Damage(
			ability.creature, // Attacker
			ability.damages, // Damage Type
			1, // Area
			[]	// Effects
		);
		result = target.takeDamage(damage);

		var i = 0;
		while(result.kill) {
			i++;
			if (i >= hexes.length) {
				break;
			}
			var hex = hexes[i];
			if (!hex.creature) {
				continue;
			}
			target = hex.creature;

			// extra sonic damage if upgraded
			var sonic = ability.damages.sonic + (this.isUpgraded() ? 9 : 0);
			if (sonic <= 0) {
				break;
			}
			damage = new Damage(
				ability.creature, // Attacker
				{sonic: sonic}, // Damage Type
				1, // Area
				[]	// Effects
			);
			result = target.takeDamage(damage);
		}
	}
},

// Fourth Ability: Battering Ram
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	_targetTeam: Team.both,

	_getDirections: function() {
		return this.testDirections({
			flipped: this.creature.player.flipped,
			team: this._targetTeam,
			id: this.creature.id,
			requireCreature: true,
			x: this.creature.x,
			y: this.creature.y,
			distance: 1,
			sourceCreature: this.creature,
			directions: [1, 1, 1, 1, 1, 1],
			includeCrea: true,
			stopOnCreature: true
		});
	},

	require : function() {
		if( !this.testRequirements() ) return false;

		var directions = this._getDirections();
		for (var i = 0; i < directions.length; i++) {
			if (directions[i] === 1) {
				this.message = "";
				return true;
			}
		}
		this.message = G.msg.abilities.notarget;
		return false;
	},

	//	query() :
	query : function(){
		var ability = this;
		var chimera = this.creature;

		G.grid.queryDirection({
			fnOnConfirm : function(){ ability.animation.apply(ability, arguments); },
			flipped : chimera.player.flipped,
			team: this._targetTeam,
			id : chimera.id,
			directions: this._getDirections(),
			requireCreature : true,
			x : chimera.x,
			y : chimera.y,
			sourceCreature: chimera
		});
	},

	activate: function(path, args) {
		var ability = this;
		this.end();

		var knockback = function(_target, _crush, _range) {
			var damage = new Damage(
				ability.creature, // Attacker
				{crush: _crush}, // Damage Type
				1, // Area
				[]	// Effects
			);
			var result = _target.takeDamage(damage);
			// Knock the target back if they are still alive and there is enough range
			if (result.kill || _range <= 0) {
				return;
			}
			// See how far we can knock the target back
			var hexes = G.grid.getHexLine(
				_target.x, _target.y, args.direction, false);
			// Skip the first hex as it is the same hex as the target
			hexes = hexes.splice(1, _range + 1);
			var hex = null;
			var nextHex = null;
			// See how far the target can be knocked back
			for (var i = 0; i < hexes.length; i++) {
				nextHex = hexes[i];
				// Check that the next knockback hex is valid
				if (i === hexes.length - 1) break;
				if (!hexes[i].isWalkable(_target.size, _target.id, true)) break;
				hex = hexes[i];
			}

			var knockbackEnd = function() {
				// Special case when hitting left: the next hex is still the same
				// creature, so continue in this direction until we reach the next
				// creature
				if (nextHex.creature === _target && args.direction === 4) {
					var nextHexes = G.grid.getHexLine(
						_target.x, _target.y, args.direction, false);
					nextHexes = nextHexes.splice(_target.size);
					if (nextHexes.length > 0) {
						nextHex = nextHexes[0];
					}
				}
				if (nextHex !== null && nextHex !== hex && nextHex.creature) {
					// Diminishing crush damage if unupgraded
					var crush = ability.isUpgraded() ? _crush : _crush - 5;
					// Diminishing range if unupgraded
					var range = ability.isUpgraded() ? _range : _range - 1;
					knockback(nextHex.creature, crush, range);
				} else {
					G.activeCreature.queryMove();
				}
			};

			if (hex !== null) {
				_target.moveTo(hex, {
					callback: knockbackEnd,
					ignoreMovementPoint: true,
					ignorePath: true,
					overrideSpeed: 400, // Custom speed for knockback
					animation: "push"
				});
			} else {
				// No knockback distance, but there may be a creature behind the target
				knockbackEnd();
			}
		};

		var target = path.last().creature;
		var crush = this.damages.crush;
		var range = 3;
		knockback(target, crush, range);
	}
}

];

/*
*
*	Cyber Hound abilities
*
*/
G.abilities[31] =[

// 	First Ability: Bad Doggie
{
	triggerFunc: function() {
		// When upgraded, trigger both at start and end of turn
		// Otherwise just trigger at start
		if (this.isUpgraded()) {
			return "onStartPhase onEndPhase";
		}
		return "onStartPhase";
	},

	require: function() {
		// Check requirements in activate() so the ability is always highlighted
		return this.testRequirements();
	},

	activate: function() {
		// Check if there's an enemy creature in front
		var hexesInFront = this.creature.getHexMap(inlinefront2hex);
		if (hexesInFront.length < 1) return;
		var target = hexesInFront[0].creature;
		if (!target) return;
		if (!isTeam(this.creature, target, Team.enemy)) {
			return;
		}

		this.end();

		var damage = new Damage(
			this.creature, // Attacker
			this.damages, // Damage Type
			1, // Area
			[]	// Effects
		);
		target.takeDamage(damage);

		// Keep highlighted in UI
		this.setUsed(false);
	},
},



// 	Second Ability: Metal Hand
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	_targetTeam: Team.enemy,

	// 	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if (!this.atLeastOneTarget(
				this.creature.getHexMap(frontnback2hex), { team: this._targetTeam })) {
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){

		var ability = this;
		var crea = this.creature;

		G.grid.queryCreature({
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); }, // fnOnConfirm
			team: this._targetTeam,
			id : crea.id,
			flipped : crea.player.flipped,
			hexs : crea.getHexMap(frontnback2hex)
		});
	},


	//	activate() :
	activate : function(target, args) {
		var ability = this;
		ability.end();

		var damage = new Damage(
			ability.creature, // Attacker
			ability.damages, // Damage Type
			1, // Area
			[]	// Effects
		);
		target.takeDamage(damage);

		// If upgrade, also steal up to 8 energy
		if (this.isUpgraded()) {
			var energySteal = Math.min(8, target.energy);
			target.energy -= energySteal;
			this.creature.recharge(energySteal);
			G.log("%CreatureName" + this.creature.id + "% steals " + energySteal +
				" energy from %CreatureName" + target.id + "%");
		}
	},
},



// 	Third Ability: Rocket Launcher
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	require : function() {
		// Recalculate energy requirements/costs based on whether this is ugpraded
		if (this.isUpgraded()) {
			this.requirements = { energy: 30 };
			this.costs = { energy: 30 };
		} else {
			this.requirements = { energy: 40 };
			this.costs = { energy: 40 };
		}
		return this.testRequirements();
	},

	// 	query() :
	query : function() {

		var ability = this;
		var crea = this.creature;

		var choices = [
			//Front
			G.grid.getHexMap(crea.x, crea.y-2, 0, false, bellowrow).filterCreature(true, true, crea.id).concat(
			G.grid.getHexMap(crea.x, crea.y, 0, false, straitrow).filterCreature(true, true, crea.id),
			G.grid.getHexMap(crea.x, crea.y, 0, false, bellowrow).filterCreature(true, true, crea.id)),
			//Behind
			G.grid.getHexMap(crea.x-1, crea.y-2, 0, true, bellowrow).filterCreature(true, true, crea.id).concat(
			G.grid.getHexMap(crea.x-1, crea.y, 0, true, straitrow).filterCreature(true, true, crea.id),
			G.grid.getHexMap(crea.x-1, crea.y, 0, true, bellowrow).filterCreature(true, true, crea.id))
		];

		choices[0].choiceId = 0;
		choices[1].choiceId = 1;

		G.grid.queryChoice({
			fnOnCancel : function() { G.activeCreature.queryMove(); G.grid.clearHexViewAlterations(); },
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			team: Team.both,
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

		var rows;
		if (choice.choiceId === 0) {
			// Front
			rows = [
				G.grid.getHexMap(crea.x, crea.y-2, 0, false, bellowrow).filterCreature(true, true, crea.id),
				G.grid.getHexMap(crea.x, crea.y, 0, false, straitrow).filterCreature(true, true, crea.id),
				G.grid.getHexMap(crea.x, crea.y, 0, false, bellowrow).filterCreature(true, true, crea.id)
			];
		} else {
			// Back
			rows = [
				G.grid.getHexMap(crea.x-1, crea.y-2, 0,true, bellowrow).filterCreature(true, true, crea.id),
				G.grid.getHexMap(crea.x-1, crea.y, 0, true, straitrow).filterCreature(true, true, crea.id),
				G.grid.getHexMap(crea.x-1, crea.y, 0, true, bellowrow).filterCreature(true, true, crea.id)
			];
		}


		for (var i = 0; i < rows.length; i++) {
			if (rows[i].length === 0 ||
					!(rows[i][ rows[i].length-1 ].creature instanceof Creature) ) {
				//Miss
				this.token += 1;
				continue;
			}

			var target = rows[i][ rows[i].length-1 ].creature;

			var damage = new Damage(
				ability.creature, //Attacker
				ability.damages, //Damage Type
				1, //Area
				[]	//Effects
			);
			target.takeDamage(damage);
		}

		if (this.token > 0) {
			G.log("%CreatureName" + this.creature.id + "% missed " + this.token + " rocket(s)");
		}

		G.UI.checkAbilities();
	},
},



// 	Fourth Ability: Target Locking
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if (this.creature.abilities[2].token === 0) {
			this.message = "No rocket launched.";
			return false;
		}

		return true;
	},

	// 	query() :
	query : function() {

		var ability = this;
		var crea = this.creature;

		var hexs = G.grid.allHexs.slice(0); // Copy array

		G.grid.queryCreature( {
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); }, // fnOnConfirm
			team: Team.enemy,
			id : crea.id,
			flipped : crea.player.flipped,
			hexs : hexs
		});
	},


	//	activate() :
	activate : function(crea, args) {
		var ability = this;
		ability.end();

		var target = crea;

		// Use all rockets if upgraded, or up to 2 if not
		var rocketLauncherAbility = this.creature.abilities[2];
		var rocketsToUse = rocketLauncherAbility.token;
		if (!this.isUpgraded()) {
			rocketsToUse = Math.min(rocketsToUse, 2);
		}
		rocketLauncherAbility.token -= rocketsToUse;

		// Multiply damage by number of rockets
		var damages = $j.extend({}, rocketLauncherAbility.damages);
		for (var key in damages) {
			damages[key] *= rocketsToUse;
		}

		G.log("%CreatureName" + this.creature.id + "% redirects " + rocketsToUse + " rocket(s)");
		var damage = new Damage(
			ability.creature, // Attacker
			damages, // Damage Type
			1, // Area
			[]	// Effects
		);
		target.takeDamage(damage);
	}
}

];

/*
*
*	Dark Priest abilities
*
*/
G.abilities[0] =[

// 	First Ability: Plasma Field
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onUnderAttack",

	// 	require() :
	require : function(damage) {
		this.setUsed(false); // Can be triggered multiple times
		this.creature.protectedFromFatigue = this.testRequirements();
		return this.creature.protectedFromFatigue;
	},

	//	activate() :
	activate : function(damage) {
                if(G.activeCreature.id==this.creature.id){
                    /* only used when unit isn't active */
                    return damage; // Return Damage
                }

                if(this.isUpgraded()&&damage.melee&&!damage.counter){
                    //counter damage
                    var counter=new Damage(
                        this.creature, // Attacker
                        {pure:5}, // Damage Type
                        1, // Area
                        []	// Effects
                    );
                    counter.counter=true;
                    G.activeCreature.takeDamage(counter);
                }

                this.creature.player.plasma  -= 1;

                this.creature.protectedFromFatigue = this.testRequirements();


                damage.damages = {total:0};
                damage.status = "Shielded";
                damage.effect = [];

                damage.noLog = true;

                this.end(true); // Disable message

                G.log("%CreatureName"+this.creature.id+"% is protected by Plasma Field");
		return damage; // Return Damage
	},
},



// 	Second Ability: Electro Shocker
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	_targetTeam: Team.enemy,

	// 	require() :
	require : function() {
		if( !this.testRequirements() ) return false;
		if (!this.atLeastOneTarget(
					this.creature.adjacentHexs(this.isUpgraded() ? 4 : 1),
					{ team: this._targetTeam })) {
			return false;
		}
		return true;
	},

	// 	query() :
	query : function() {

		var ability = this;
		var dpriest = this.creature;

		G.grid.queryCreature( {
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			team: this._targetTeam,
			id : dpriest.id,
			flipped : dpriest.player.flipped,
			hexs : dpriest.adjacentHexs(this.isUpgraded()?4:1),
		});
	},

	//	activate() :
	activate : function(target, args) {
		var ability = this;
		ability.end();

		var damageAmount = {shock: 12*target.size};

		var damage = new Damage(
			ability.creature, // Attacker
			damageAmount, // Damage Type
			1, // Area
			[]	// Effects
		);

		target.takeDamage(damage);
	},
},



// 	Third Ability: Disruptor Beam
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	_targetTeam: Team.enemy,

	// 	require() :
	require : function() {
		if(!this.testRequirements()) return false;

		var range = this.creature.adjacentHexs(2);

		// At least one target
		if (!this.atLeastOneTarget(range, { team: this._targetTeam })) {
			return false;
		}

		// Search Lowest target cost
		var lowestCost = 99;
		var targets = this.getTargets(range);

		targets.each(function() {
			if(!(this.target instanceof Creature)) return false;
			if(lowestCost > this.target.size) lowestCost = this.target.size;
		});

		if(this.creature.player.plasma < lowestCost) {
			this.message = G.msg.abilities.noplasma;
			return false;
		}

		return true;
	},

	// 	query() :
	query : function() {

		var ability = this;
		var dpriest = this.creature;

		G.grid.queryCreature( {
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			optTest: function(creature) {
				return creature.size <= dpriest.player.plasma;
			},
			team: this._targetTeam,
			id : dpriest.id,
			flipped : dpriest.player.flipped,
			hexs : dpriest.adjacentHexs(2),
		});
	},

	//	activate() :
	activate : function(target, args) {
		var ability = this;
		ability.end();

		var plasmaCost = target.size;
		var damage = target.baseStats.health-target.health;

                if (this.isUpgraded() && damage<40) damage=40;

		ability.creature.player.plasma -= plasmaCost;

		damage = new Damage(
			ability.creature, // Attacker
			{ pure: damage }, // Damage Type
			1, // Area
			[]	// Effects
		);

		ability.end();

		target.takeDamage(damage);
	},
},



// 	Fourth Ability: Godlet Printer
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if(this.creature.player.plasma <= 1) {
			this.message = G.msg.abilities.noplasma;
			return false;
		}
		if(this.creature.player.getNbrOfCreatures() == G.creaLimitNbr) {
			this.message = G.msg.abilities.nopsy;
			return false;
		}
		return true;
	},

	summonRange : 4,

	// 	query() :
	query : function() {
		var ability = this;
		G.grid.updateDisplay(); // Retrace players creatures

                if(this.isUpgraded()) this.summonRange=6;

		// Ask the creature to summon
		G.UI.materializeToggled = true;
		G.UI.toggleDash();
	},

	fnOnSelect : function(hex,args) {
		var crea = G.retreiveCreatureStats(args.creature);
		G.grid.previewCreature(hex.pos, crea, this.creature.player);
	},

	// Callback function to queryCreature
	materialize : function(creature) {
		var crea = G.retreiveCreatureStats(creature);
		var ability = this;
		var dpriest = this.creature;

		G.grid.forEachHexs(function() { this.unsetReachable(); } );

		var spawnRange = dpriest.hexagons[0].adjacentHex(this.summonRange);

		spawnRange.each(function() { this.setReachable(); } );
		spawnRange.filter(function() { return this.isWalkable(crea.size, 0, false);	} );
		spawnRange = spawnRange.extendToLeft(crea.size);

		G.grid.queryHexs( {
			fnOnSelect : function() { ability.fnOnSelect.apply(ability, arguments); },
			fnOnCancel : function() { G.activeCreature.queryMove(); },
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			args : {creature:creature, cost: (crea.size-0)+(crea.level-0)}, // OptionalArgs
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

		//TODO: Make the UI show the updated number instantly

		ability.end();

		ability.creature.player.summon(creature, pos);
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
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onStepIn onStartPhase",

	_targetTeam: Team.enemy,

	// 	require() :
	require : function() {
		return this.testRequirements();
	},

	//	activate() :
	activate : function() {
		var creature = this.creature;
		var targets = this.getTargets(this.creature.adjacentHexs(1));

		if (this.atLeastOneTarget(
				this.creature.adjacentHexs(1), { team: this._targetTeam })) {
			this.end();
			this.setUsed(false); //Infinite triggering
		}else{
			return false;
		}

		targets.each(function(){
			if( !(this.target instanceof Creature) ) return;

			var trg = this.target;

			if (isTeam(creature, trg, this._targetTeam)) {

				var optArg = {
					effectFn : function(effect, crea) {
						var nearFungus = false;
						crea.adjacentHexs(1).each(function() {
							if(trg.creature instanceof Creature) {
								if(G.creatures[trg.creature] === effect.owner)
									nearFungus = true;
							}
						});

						if(!nearFungus) {
							for (var i = 0; i < crea.effects.length; i++) {
								if(crea.effects[i].name == "Contaminated") {
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
					"Contaminated", // Name
					creature, // Caster
					trg, // Target
					"onStartPhase", // Trigger
					optArg // Optional arguments
				);

				var validTarget = true;
				trg.effects.each(function(){
					if(this.name == "Contaminated") {
						if(this.turn == G.turn)
							validTarget = false;
					}
				});

				if(validTarget) {
					trg.addEffect(effect);
				}
			}
		});
	},
},



// 	Second Ability: Executioner Axe
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	damages : {
		slash : 40,
	},
	_targetTeam: Team.enemy,

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		//At least one target
		if (!this.atLeastOneTarget(
				this.creature.adjacentHexs(1), { team: this._targetTeam })) {
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
			fnOnConfirm : function(){ ability.animation.apply(ability, arguments); },
			team: this._targetTeam,
			id : wyrm.id,
			flipped : wyrm.flipped,
			hexs : G.grid.getHexMap(wyrm.x - 2, wyrm.y - 2, 0, false, map),
		});
	},


	//	activate() :
	activate : function(target, args) {
		var ability = this;
		ability.end();

		var damage = new Damage(
			ability.creature, // Attacker
			ability.damages, // Damage Type
			1, // Area
			[]	// Effects
		);

		var dmg = target.takeDamage(damage);

		if(dmg.status == "") {
			// Regrowth bonus
			ability.creature.addEffect( new Effect(
				"Regrowth++", // Name
				ability.creature, // Caster
				ability.creature, // Target
				"onStartPhase", // Trigger
				{
					effectFn : function(effect, crea) {
						effect.deleteEffect();
					},
					alterations : { regrowth : Math.round(dmg.damages.total / 4) }
				} //Optional arguments
			) );
		}

		//remove frogger bonus if its found
		ability.creature.effects.each(function() {
			if(this.name == "Frogger Bonus") {
				this.deleteEffect();
			}
		});
	},
},



// 	Third Ability: Dragon Flight
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	require : function() { return this.testRequirements(); },

	fnOnSelect : function(hex,args){
		this.creature.tracePosition( { x: hex.x, y: hex.y, overlayClass: "creature moveto selected player" + this.creature.team })
	},

	// 	query() :
	query : function(){
		var ability = this;
		var wyrm = this.creature;

		var range = G.grid.getFlyingRange(wyrm.x, wyrm.y, 50, wyrm.size, wyrm.id);
		range.filter(function(){ return wyrm.y == this.y; });

		G.grid.queryHexs({
			fnOnSelect : function() { ability.fnOnSelect.apply(ability, arguments); },
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			size :  wyrm.size,
			flipped :  wyrm.player.flipped,
			id :  wyrm.id,
			hexs : range,
		});
	},


	//	activate() :
	activate : function(hex, args) {
		var ability = this;
		ability.end();

		ability.creature.moveTo(hex, {
			ignoreMovementPoint : true,
			ignorePath : true,
			callback : function() {
				G.activeCreature.queryMove();
			},
		});

		// Frogger Leap bonus
		ability.creature.addEffect( new Effect(
			"Offense++", // Name
			ability.creature, // Caster
			ability.creature, // Target
			"onStepIn onEndPhase", // Trigger
			{
				effectFn : function(effect, crea) {
					effect.deleteEffect();
				},
				alterations : {offense : 25}
			} // Optional arguments
		) );
	},
},



// 	Fourth Ability: Battle Cry
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	damages : {
		pierce : 15,
		slash : 10,
		crush : 5,
	},
	_targetTeam: Team.enemy,

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		var map = G.grid.getHexMap(this.creature.x-2, this.creature.y-2, 0, false, frontnback2hex);
		// At least one target
		if (!this.atLeastOneTarget(map, { team: this._targetTeam })) {
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
			team: this._targetTeam,
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
	// Update stat buffs whenever health changes
	trigger: "onCreatureSummon onDamage onHeal",

	require : function() {
		// Always active
		return true;
	},

	activate: function() {
		if (this.creature.dead) {
			return;
		}
		// Attach a permanent effect that gives Gumble stat buffs
		// Bonus points to pierce, slash and crush based on remaining health
		var healthBonusDivisor = this.isUpgraded() ? 5 : 7;
		var bonus = Math.floor(this.creature.health / healthBonusDivisor * 3);
		// Log whenever the bonus applied changes
		var noLog = bonus == this._lastBonus;
		this._lastBonus = bonus;
		var statsToApplyBonus = ['pierce', 'slash', 'crush'];
		var alterations = {};
		for (var i = 0; i < statsToApplyBonus.length; i++) {
			var key = statsToApplyBonus[i];
			alterations[key] = bonus;
		}
		this.creature.replaceEffect(new Effect(
			"Gooey Body",	// name
			this.creature,	// Caster
			this.creature,	// Target
			"",				// Trigger
			{
				alterations: alterations,
				deleteTrigger: "",
				stackable: false,
				noLog: noLog
			}
		));
		if (!noLog) {
			G.log("%CreatureName" + this.creature.id + "% receives " + bonus + " pierce, slash and crush");
		}
	},

	_lastBonus: 0
},


// 	Second Ability: Gummy Mallet
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	require: function() {
		// Always usable, even if no targets
		return this.testRequirements();
	},

	// 	query() :
	query : function(){
		var ability = this;
		// Gummy Mallet can hit a 7-hexagon circular area in 6 directions, where the
		// center of each area is two hexes away. Each area can be chosen regardless
		// of whether targets are within.
		var area = [
			 [1,1],
			[1,1,1],
			 [1,1]
		];
		var dx = this.creature.y % 2 !== 0 ? -1 : 0;
		var dy = -1;
		var choices = [
			G.grid.getHexMap(
				this.creature.x+1+dx, this.creature.y-2+dy, 0, false, area),// up-right
			G.grid.getHexMap(
				this.creature.x+2+dx, this.creature.y+dy, 0, false, area),	// front
			G.grid.getHexMap(
				this.creature.x+1+dx, this.creature.y+2+dy, 0, false, area),// down-right
			G.grid.getHexMap(
				this.creature.x-1+dx, this.creature.y+2+dy, 0, false, area),// down-left
			G.grid.getHexMap(
				this.creature.x-2+dx, this.creature.y+dy, 0, false, area),	// back
			G.grid.getHexMap(
				this.creature.x-1+dx, this.creature.y-2+dy, 0, false, area),// up-left
		];
		// Reorder choices based on number of hexes
		// This ensures that if a choice contains overlapping hexes only, that
		// choice won't be available for selection.
		choices.sort(function(choice1, choice2) {
			return choice1.length < choice2.length;
		});
		G.grid.queryChoice({
			fnOnCancel: function() {
				G.activeCreature.queryMove();
				G.grid.clearHexViewAlterations();
			},
			fnOnConfirm: function() { ability.animation.apply(ability, arguments); },
			team: Team.both,
			id: this.creature.id,
			requireCreature: false,
			choices: choices
		});
	},

	activate: function(hexes, args) {
		var ability = this;
		ability.end();

		var targets = ability.getTargets(hexes);
		// Deal double damage to enemies if upgraded
		var enemyDamages = $j.extend({}, ability.damages);
		if (this.isUpgraded()) {
			for (var k in enemyDamages) {
				enemyDamages[k] *= 2;
			}
		}
		// See areaDamage()
		var kills = 0;
		for (var i = 0; i < targets.length; i++) {
			if (targets[i] === undefined) continue;
			var damages = this.damages;
			if (isTeam(this.creature, targets[i].target, Team.enemy)) {
				damages = enemyDamages;
			}
			var dmg = new Damage(this.creature, damages, targets[i].hexsHit, []);
			kills += (targets[i].target.takeDamage(dmg).kill+0);
		}
		if (kills > 1) {
			this.creature.player.score.push( { type: "combo", kills: kills } );
		}
	}
},


// 	Thirt Ability: Royal Seal
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function() {
		return this.testRequirements();
	},

	// 	query() :
	query : function() {
		var ability = this;
		var creature = this.creature;

		// Upgraded Royal Seal can target up to 3 hexagons range
		var range = this.isUpgraded() ? 3 : 1;
		hexes = creature.hexagons.concat(G.grid.getFlyingRange(
			creature.x, creature.y, range, creature.size, creature.id));

		G.grid.queryHexs({
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			size : creature.size,
			flipped : creature.player.flipped,
			id : creature.id,
			hexs: hexes,
			ownCreatureHexShade : true,
			hideNonTarget : true
		});
	},


	//	activate() :
	activate : function(hex) {
		this.end();
		var ability = this;

		var makeSeal = function() {
			var effect = new Effect(
				"Royal Seal", ability.creature, hex, "onStepIn",
				{
					// Gumbles immune
					requireFn: function() {
						var crea = this.trap.hex.creature;
						return crea && crea.type !== this.owner.type;
					},
					effectFn: function(effect, crea) {
						if (this.trap.turnLifetime === 0) {
							crea.remainingMove = 0;
							// Destroy the trap on the trapped creature's turn
							this.trap.turnLifetime = 1;
							this.trap.ownerCreature = crea;
						}
					},
					// Immobilize target so that they can't move and no
					// abilities/effects can move them
					alterations: { moveable: false },
					deleteTrigger: "onStartPhase",
					turnLifetime: 1
				}
			);

			var trap = hex.createTrap(
				"royal-seal", [effect], ability.creature.player,
				{ ownerCreature: ability.creature, fullTurnLifetime: true }
			);
			trap.hide();
		};

		// Move Gumble to the target hex if necessary
		if (hex.x !== this.creature.x || hex.y !== this.creature.y) {
			this.creature.moveTo(hex, {
				callback: function() {
					G.activeCreature.queryMove();
					makeSeal();
				},
				ignoreMovementPoint: true,
				ignorePath: true,
				overrideSpeed: 200, // Custom speed for jumping
				animation: "push"
			});
		} else {
			makeSeal();
		}
	},
},


// 	Fourth Ability: Boom Box
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	directions : [1, 1, 1, 1, 1, 1],
	_targetTeam: Team.enemy,

	// 	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if (!this.testDirection(
				{ team: this._targetTeam, directions: this.directions })) {
			return false;
		}
		return true;
	},

	// 	query() :
	query : function() {
		var ability = this;
		var crea = this.creature;

		G.grid.queryDirection({
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			flipped : crea.player.flipped,
			team: this._targetTeam,
			id : this.creature.id,
			requireCreature : true,
			x : crea.x,
			y : crea.y,
			directions : this.directions,
		});
	},


	//	activate() :
	activate : function(path, args) {
		var ability = this;
		ability.end();

		var target = path.last().creature;
		var melee = (path[0].creature === target);

		var d = (melee) ? { sonic: 20, crush: 10 } : { sonic: 20 };

		var dir = [];
		switch( args.direction ) {
			case 0: // Upright
				dir = G.grid.getHexMap(target.x, target.y-8, 0, target.flipped, diagonalup).reverse();
				break;
			case 1: // StraitForward
				dir = G.grid.getHexMap(target.x, target.y, 0, target.flipped, straitrow);
				break;
			case 2: // Downright
				dir = G.grid.getHexMap(target.x, target.y, 0, target.flipped, diagonaldown);
				break;
			case 3: // Downleft
				dir = G.grid.getHexMap(target.x, target.y, -4, target.flipped, diagonalup);
				break;
			case 4: // StraitBackward
				dir = G.grid.getHexMap(target.x, target.y, 0, !target.flipped, straitrow);
				break;
			case 5: // Upleft
				dir = G.grid.getHexMap(target.x, target.y-8, -4, target.flipped, diagonaldown).reverse();
				break;
			default:
				break;
		}

		var canKnockBack = dir.length > 1 &&
			dir[1].isWalkable(target.size, target.id, true) &&
			target.stats.moveable;

		// Perform extra damage if upgraded and cannot push back
		if (this.isUpgraded() && !canKnockBack) {
			d.sonic += 10;
		}

		var damage = new Damage(
			ability.creature, // Attacker
			d, // Damage Type
			1, // Area
			[] // Effects
		);

		var result = target.takeDamage(damage, { ignoreRetaliation: true });

		if (result.kill) return; // if creature die stop here

		// Knockback the target 1 hex
		if (canKnockBack) {
			target.moveTo(dir[1], {
				ignoreMovementPoint: true,
				ignorePath: true,
				callback: function() {
					G.activeCreature.queryMove();
				},
				animation : "push",
			});
		}
	}
}

];

/*
*
*	Headless abilities
*
*/
G.abilities[39] =[

// 	First Ability: Larva Infest
{
	trigger: "onStartPhase onEndPhase",

	_targetTeam: Team.enemy,
	_getHexes: function() {
		return this.creature.getHexMap(inlineback2hex);
	},

	require: function() {
		if (!this.atLeastOneTarget(this._getHexes(), { team: this._targetTeam })) {
			return false;
		}
		return this.testRequirements();
	},

	//	activate() :
	activate : function() {
		var ability = this;
		var creature = this.creature;

		if (this.atLeastOneTarget(this._getHexes(), { team: this._targetTeam })) {
			this.end();
			this.setUsed(false); // Infinite triggering
		}else{
			return false;
		}

		var targets = this.getTargets(this._getHexes());

		targets.each(function() {
			if( !(this.target instanceof Creature) ) return;

			var trg = this.target;

			if (ability.isUpgraded()) {
				// Upgraded ability causes fatigue - endurance set to 0
				trg.addFatigue(trg.endurance);
			}

			// Add an effect that triggers on the target's start phase and adds the
			// debuff
			var effect = new Effect(
				ability.title, // Name
				creature, // Caster
				trg, // Target
				"onStartPhase", // Trigger
				{
					effectFn: function() {
						// Activate debuff
						trg.addEffect(new Effect(
							"", // No name to prevent logging
							creature,
							trg,
							"",
							{
								deleteTrigger: "",
								stackable: true,
								alterations: { endurance: -5 }
							}
						));
						// Note: effect activate by default adds the effect on the target,
						// but target already has this effect, so remove the trigger to
						// prevent infinite addition of this effect.
						this.trigger = "";
						this.deleteEffect();
					}
				}
			);

			trg.addEffect(effect, "%CreatureName" + trg.id + "% has been infested");
		});
	},
},



// 	Second Ability: Cartilage Dagger
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	_targetTeam: Team.enemy,

	// 	require() :
	require : function() {
		var crea = this.creature;

		if( !this.testRequirements() ) return false;

		//At least one target
		if (!this.atLeastOneTarget(
				crea.getHexMap(frontnback2hex), { team: this._targetTeam })) {
			return false;
		}
		return true;
	},

	// 	query() :
	query : function() {
		var ability = this;
		var crea = this.creature;

		G.grid.queryCreature( {
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			team: this._targetTeam,
			id : crea.id,
			flipped : crea.flipped,
			hexs : crea.getHexMap(frontnback2hex),
		});
	},


	//	activate() :
	activate : function(target,args) {
		var ability = this;
		ability.end();

		var d = { pierce: 11 };
		//Bonus for fatigued foe
		d.pierce = target.endurance <= 0 ? d.pierce * 2 : d.pierce;
		// Extra pierce damage if upgraded
		if (this.isUpgraded()) {
			var bonus = this.creature.stats.endurance - target.stats.endurance;
			if (bonus > 0) {
				d.pierce += bonus;
			}
		}

		var damage = new Damage(
			ability.creature, //Attacker
			d, //Damage Type
			1, //Area
			[]	//Effects
		);

		var dmg = target.takeDamage(damage);
	},
},



// 	Third Ability: Whip Move
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	directions : [0,1,0,0,1,0],

	_minDistance: 2,
	_getMaxDistance: function() {
		if (this.isUpgraded()) {
			return 8;
		}
		return 6;
	},
	_targetTeam: Team.both,
	_getValidDirections: function() {
		// Get all directions where there are no targets within min distance,
		// and a target within max distance
		var crea = this.creature;
		var x = crea.player.flipped ? crea.x - crea.size + 1 : crea.x;
		var validDirections = [0, 0, 0, 0, 0, 0];
		for (var i = 0; i < this.directions.length; i++) {
			if (this.directions[i] === 0) {
				continue;
			}
			var directions = [0, 0, 0, 0, 0, 0];
			directions[i] = 1;
			var testMin = this.testDirection({
				team: this._targetTeam,
				x: x,
				directions: directions,
				distance: this._minDistance,
				sourceCreature: crea
			});
			var testMax = this.testDirection({
				team: this._targetTeam,
				x: x,
				directions: directions,
				distance: this._getMaxDistance(),
				sourceCreature: crea
			});
			if (!testMin && testMax) {
				// Target needs to be moveable
				var fx = 0;
				if ((!this.creature.player.flipped && i>2) ||
						(this.creature.player.flipped && i<3)) {
					fx =  -1*(this.creature.size-1);
				}
				var dir = G.grid.getHexLine(
					this.creature.x+fx, this.creature.y, i, this.creature.player.flipped);
				if (this._getMaxDistance() > 0) {
					dir = dir.slice(0,this._getMaxDistance()+1);
				}
				dir = dir.filterCreature(true, true, this.creature.id);
				var target = dir.last().creature;
				if (target.stats.moveable) {
					validDirections[i] = 1;
				}
			}
		}
		return validDirections;
	},

	require : function(){
		if( !this.testRequirements() ) return false;

		// Creature must be moveable
		if (!this.creature.stats.moveable) {
			this.message = G.msg.abilities.notmoveable;
			return false;
		}

		// There must be at least one direction where there is a target within
		// min/max range
		var validDirections = this._getValidDirections();
		if (!validDirections.some(function(e) { return e === 1; })) {
			this.message = G.msg.abilities.notarget;
			return false;
		}
		this.message = "";
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;
		var crea = this.creature;

		G.grid.queryDirection({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : this._targetTeam,
			id : crea.id,
			requireCreature : true,
			sourceCreature : crea,
			x : crea.x,
			y : crea.y,
			directions : this._getValidDirections(),
			distance: this._getMaxDistance()
		});
	},


	//	activate() :
	activate : function(path,args) {
		var ability = this;
		var crea = this.creature;
		var target = path.last().creature;
		path = path.filter( function(){	return !this.creature; }); //remove creatures
		ability.end();

		//Movement
		var creature = (args.direction==4) ? crea.hexagons[crea.size-1] : crea.hexagons[0] ;
		path.filterCreature(false, false);
		var destination = null;
		var destinationTarget = null;
		if (target.size === 1) {
			// Small creature, pull target towards self
			destinationTarget = path.first();
		} else if (target.size === 2) {
			// Medium creature, pull self and target towards each other half way,
			// rounding upwards for self (self move one extra hex if required)
			var midpoint = Math.floor((path.length - 1) / 2);
			destination = path[midpoint];
			if (midpoint < path.length - 1) {
				destinationTarget = path[midpoint + 1];
			}
		} else {
			// Large creature, pull self towards target
			destination = path.last();
		}

		var x;
		var hex;
		if (destination !== null) {
			x = (args.direction === 4) ? destination.x + crea.size - 1 : destination.x;
			hex = G.grid.hexs[destination.y][x];
			crea.moveTo(hex, {
				ignoreMovementPoint: true,
				ignorePath: true,
				callback: function() {
					var interval = setInterval(function() {
						if (!G.freezedInput) {
							clearInterval(interval);
							G.activeCreature.queryMove();
						}
					}, 100);
				},
			});
		}
		if (destinationTarget !== null) {
			x = (args.direction === 1) ? destinationTarget.x + target.size - 1 : destinationTarget.x;
			hex = G.grid.hexs[destinationTarget.y][x];
			target.moveTo(hex, {
				ignoreMovementPoint: true,
				ignorePath: true,
				callback: function() {
					var interval = setInterval(function() {
						if (!G.freezedInput) {
							clearInterval(interval);
							G.activeCreature.queryMove();
						}
					}, 100);
				},
			});
		}
	},
},



// 	Fourth Ability: Boomerang Tool
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		slash : 10,
		crush : 5,
	},

	_getHexes: function() {
		// extra range if upgraded
		var hexes;
		if (this.isUpgraded()) {
			hexes = [
				  [0,0,0,0,0,0],
				   [0,1,1,1,1,1],
					[0,1,1,1,1,1],//origin line
				   [0,1,1,1,1,1]];
		} else {
			hexes = [
				  [0,0,0,0,0],
				   [0,1,1,1,1],
					[0,1,1,1,1],//origin line
				   [0,1,1,1,1]];
		}
		hexes.origin = [0, 2];
		return hexes;
	},


	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;
		var crea = this.creature;

		var hexes = this._getHexes();

		G.grid.queryChoice({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team: Team.both,
			requireCreature : 0,
			id : crea.id,
			flipped : crea.player.flipped,
			choices: [
				crea.getHexMap(hexes),
				crea.getHexMap(hexes, true),
			],
		});
	},

	activate: function(hexs) {
		var damages = { slash : 10 };

		var ability = this;
		ability.end();

		ability.areaDamage(
			ability.creature, //Attacker
			damages, //Damage Type
			[],	//Effects
			ability.getTargets(hexs), //Targets
			true //Notriggers avoid double retailiation
		);

		ability.areaDamage(
			ability.creature, //Attacker
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
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
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
			if( G.creatures[i] instanceof Creature ) {
				var crea = G.creatures[i];

				if (isTeam(crea, ability.creature, Team.enemy) && !crea.dead &&
						crea.findEffect( "Snow Storm" ).length === 0) {
					var effect = new Effect(
						"Snow Storm", // Name
						ability.creature, // Caster
						crea, // Target
						"onOtherCreatureDeath", // Trigger
						{
							effectFn: function(effect,crea) {
								var trg = effect.target;

								var iceDemonArray = G.findCreature( {
									type:"S7", // Ice Demon
									dead:false, // Still Alive
									team:[ 1-(trg.team%2), 1 - (trg.team % 2) + 2 ] // Oposite team
								});

								if( iceDemonArray.length == 0 ) {
									this.deleteEffect();
								}
							},
							alterations: ability.effects[0],
							noLog: true
						} // Optional arguments
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
	_targetTeam: Team.enemy,

	// 	require() :
	require : function() {
		if( !this.testRequirements() ) return false;
		if (!this.testDirection({
				team: this._targetTeam,
				distance: this.distance,
				sourceCreature: this.creature
			})) {
			return false;
		}
		return true;
	},

	// 	query() :
	query : function() {
		var ability = this;
		var crea = this.creature;

		G.grid.queryDirection( {
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			flipped : crea.player.flipped,
			team: this._targetTeam,
			id : this.creature.id,
			requireCreature : true,
			x : crea.x,
			y : crea.y,
			distance : this.distance,
			sourceCreature : crea,
		});
	},


	//	activate() :
	activate : function(path, args) {
		var ability = this;
		ability.end();

		var direction = path.last().direction;
		var target = path.last().creature;

		var dir = [];
		switch( direction ){
			case 0: //Upright
				dir = G.grid.getHexMap(target.x, target.y-8, 0, target.flipped, diagonalup).reverse();
				break;
			case 1: //StraitForward
				dir = G.grid.getHexMap(target.x, target.y, 0, target.flipped, straitrow);
				break;
			case 2: //Downright
				dir = G.grid.getHexMap(target.x, target.y, 0,target.flipped, diagonaldown);
				break;
			case 3: //Downleft
				dir = G.grid.getHexMap(target.x, target.y, -4, target.flipped, diagonalup);
				break;
			case 4: //StraitBackward
				dir = G.grid.getHexMap(target.x, target.y, 0, !target.flipped, straitrow);
				break;
			case 5: //Upleft
				dir = G.grid.getHexMap(target.x, target.y-8, -4, target.flipped, diagonaldown).reverse();
				break;
			default:
				break;
		}

		var pushed = false;

		if(dir.length > 1) {
			if(dir[1].isWalkable(target.size,target.id, true)){
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

		if(!pushed) {
			d.crush = d.crush * 2;
		}

		var damage = new Damage(
			ability.creature, //Attacker
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

	_targetTeam: Team.enemy,

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		var crea = this.creature;
		var hexs = G.grid.getHexMap(crea.x+2, crea.y-2, 0, false, straitrow).filterCreature(true, true, crea.id, crea.team).concat(
			G.grid.getHexMap(crea.x+1, crea.y-2, 0, false, bellowrow).filterCreature(true, true, crea.id,crea.team),
			G.grid.getHexMap(crea.x, crea.y, 0, false, straitrow).filterCreature(true, true, crea.id,crea.team),
			G.grid.getHexMap(crea.x+1, crea.y, 0, false, bellowrow).filterCreature(true, true, crea.id,crea.team),
			G.grid.getHexMap(crea.x+2, crea.y+2, 0, false, straitrow).filterCreature(true, true, crea.id,crea.team),

			G.grid.getHexMap(crea.x-2,crea.y-2,2,true,straitrow).filterCreature(true,true,crea.id,crea.team),
			G.grid.getHexMap(crea.x-1,crea.y-2,2,true,bellowrow).filterCreature(true,true,crea.id,crea.team),
			G.grid.getHexMap(crea.x,crea.y,2,true,straitrow).filterCreature(true,true,crea.id,crea.team),
			G.grid.getHexMap(crea.x-1,crea.y,2,true,bellowrow).filterCreature(true,true,crea.id,crea.team),
			G.grid.getHexMap(crea.x-2,crea.y+2,2,true,straitrow).filterCreature(true,true,crea.id,crea.team));

		if (!this.atLeastOneTarget(hexs, { team: this._targetTeam })) {
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
			team: this._targetTeam,
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
				creaturesHit.indexOf(choice[i].creature) == -1 ){ // Prevent Multiple Hit

				choice[i].creature.takeDamage(
					new Damage(
						ability.creature, // Attacker
						ability.damages1, // Damage Type
						1, // Area
						[]	// Effects
					)
				);

				creaturesHit.push(choice[i].creature);
			}
		};
	},
},



// 	Fourth Ability: Frozen Orb
{
	//	Type : Can be "onQuery"," onStartPhase", "onDamage"
	trigger : "onQuery",

	directions : [0,1,0,0,1,0],
	_targetTeam: Team.enemy,

	// 	require() :
	require : function() {
		if( !this.testRequirements() ) return false;
		if (!this.testDirection({
				team: this._targetTeam, directions: this.directions,
				sourceCreature: this.creature
			})) {
			return false;
		}
		return true;
	},

	// 	query() :
	query : function() {
		var ability = this;
		var crea = this.creature;

		G.grid.queryDirection({
			fnOnSelect : function(path, args) {
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
			fnOnConfirm : function(){ ability.animation.apply(ability, arguments); },
			flipped : crea.player.flipped,
			team: this._targetTeam,
			id : this.creature.id,
			requireCreature : true,
			x : crea.x,
			y : crea.y,
			sourceCreature : crea,
		});
	},


	//	activate() :
	activate : function(path, args) {
		var ability = this;
		ability.end();

		var trg = path.last().creature;

		var hex = (ability.creature.player.flipped)
			? G.grid.hexs[path.last().y][path.last().x+trg.size - 1]
			: path.last();

		var trgs = ability.getTargets( hex.adjacentHex( ability.radius )
			.concat( [hex] ) ); // Include central hex

		// var target = path.last().creature;

		// var damage = new Damage(
		// 	ability.creature, //Attacker
		// 	ability.damages, //Damage Type
		// 	1, //Area
		// 	[]	//Effects
		// );
		// target.takeDamage(damage);

		var effect = new Effect(
			"Frozen", // Name
			ability.creature, // Caster
			undefined, // Target
			"", // Trigger
			{
				effectFn: function(effect) {
					effect.target.stats.frozen = true;
					this.deleteEffect();
				}
			}
		);

		ability.areaDamage(
			ability.creature,
			ability.damages,
			[effect], // Effects
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
	trigger: "onUnderAttack",

	require: function() {
		// Always true to highlight ability
		return true;
	},

	activate: function(damage) {
		if (damage === undefined) return false;
		if (!damage.damages.shock) return false;
		this.end();
		var converted = Math.floor(damage.damages.shock / 4);
		// Lower damage
		damage.damages.shock -= converted;
		// Replenish energy
		// Calculate overflow first; we may need it later
		var energyMissing = this.creature.stats.energy - this.creature.energy;
		var energyOverflow = converted - energyMissing;
		this.creature.recharge(converted);
		// If upgraded and energy overflow, convert into health
		if (this.isUpgraded() && energyOverflow > 0) {
			this.creature.heal(energyOverflow);
		}
		G.log("%CreatureName" + this.creature.id + "% absorbs " + converted + " shock damage into energy");
		return damage;
	}
},



// 	Second Ability: Hasted Javelin
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	_targetTeam: Team.enemy,

	// 	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if (!this.atLeastOneTarget(this._getHexes(), { team: this._targetTeam })) {
			return false;
		}
		return true;
	},

	// 	query() :
	query : function() {

		var ability = this;
		var creature = this.creature;

		G.grid.queryCreature({
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			team: this._targetTeam,
			id : creature.id,
			flipped : creature.flipped,
			hexs: this._getHexes()
		});
	},


	//	activate() :
	activate : function(target, args) {
		var ability = this;
		ability.end();

		var finalDmg = $j.extend({poison: 0}, ability.damages1);

		// Poison Bonus if upgraded
		if (this.isUpgraded()) {
			finalDmg.poison = this.damages1.poison;
		}

		G.UI.checkAbilities();

		var damage = new Damage(
			ability.creature, // Attacker
			finalDmg, // Damage Type
			1, // Area
			[] // Effects
		);
		var result = target.takeDamage(damage);
		// Recharge movement if any damage dealt
		if (result.damages && result.damages.total > 0) {
			this.creature.remainingMove = this.creature.stats.movement;
			G.log("%CreatureName" + this.creature.id + "%'s movement recharged");
			G.activeCreature.queryMove();
		}
	},

	_getHexes: function() {
		return G.grid.getHexMap(this.creature.x-3, this.creature.y-2, 0, false, frontnback3hex);
	}
},



// 	Thirt Ability: Poisonous Vine
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	_targetTeam: Team.enemy,

	// 	require() :
	require : function() {
		if (!this.atLeastOneTarget(this._getHexes(), { team: this._targetTeam })) {
			return false;
		}
		return this.testRequirements();
	},

	// 	query() :
	query : function() {
		var ability = this;
		var creature = this.creature;

		G.grid.queryCreature( {
			fnOnConfirm: function() { ability.animation.apply(ability, arguments); },
			team: this._targetTeam,
			id: creature.id,
			flipped: creature.flipped,
			hexs: this._getHexes()
		});
	},

	activate: function(target) {
		this.end();
		var damages = this.damages;
		// Last 1 turn, or indefinitely if upgraded
		var lifetime = this.isUpgraded() ? 0 : 1;
		var ability = this;
		// Add a trap to every hex of the target
		var effect = new Effect(
			ability.title, ability.creature, this, "onStepOut",
			{
				effectFn: function(effect) {
					G.log("%CreatureName" + effect.target.id + "% is hit by " + effect.name);
					effect.target.takeDamage(
						new Damage(effect.owner, damages, 1, []), { isFromTrap: true });
					// Hack: manually destroy traps so we don't activate multiple traps
					// and see multiple logs etc.
					target.hexagons.each(function() { this.destroyTrap(); });
					effect.deleteEffect();
				}
			}
		);
		target.hexagons.each(function() {
			this.createTrap(
				"poisonous-vine",
				[effect],
				ability.creature.player,
				{
					turnLifetime: lifetime,
					fullTurnLifetime: true,
					ownerCreature: ability.creature,
					destroyOnActivate: true,
					typeOver: 'poisonous-vine',
					destroyAnimation: 'shrinkDown'
				}
			);
		});
	},

	_getHexes: function() {
		// Target a creature within 2 hex radius
		var hexes = G.grid.hexs[this.creature.y][this.creature.x].adjacentHex(2);
		return hexes.extendToLeft(this.creature.size);
	}
},



//	Fourth Ability: Chain Lightning
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	_targetTeam: Team.both,

	require: function() {
		if (!this.testRequirements()) return false;
		if (!this.atLeastOneTarget(this._getHexes(), { team: this._targetTeam })) {
			return false;
		}
		return true;
	},

	//	query() :
	query : function(){
		var ability = this;

		G.grid.queryCreature( {
			fnOnConfirm: function() { ability.animation.apply(ability, arguments); },
			team: this._targetTeam,
			id: this.creature.id,
			flipped: this.creature.flipped,
			hexs: this._getHexes()
		});
	},


	//	activate() :
	activate : function(target) {
		var ability = this;
		ability.end();

		var targets = [];
		targets.push(target); // Add First creature hit
		var nextdmg = $j.extend({},ability.damages); // Copy the object

		// For each Target
		for (var i = 0; i < targets.length; i++) {
			var trg = targets[i];

			// If upgraded and the target is an ally, protect it with an effect that
			// reduces the damage to guarantee at least 1 health remaining
			if (this.isUpgraded() && isTeam(this.creature, trg, Team.ally)) {
				trg.addEffect(new Effect(
					this.title,
					this.creature,
					trg,
					"onUnderAttack",
					{
						effectFn: function(effect, damage) {
							// Simulate the damage to determine how much damage would have
							// been dealt; then reduce the damage so that it will not kill
							while (true) {
								var dmg = damage.applyDamage();
								// If we can't reduce any further, give up and have the damage
								// be zero
								if (dmg.total <= 0 || damage.damages.shock <= 0 ||
										trg.health <= 1) {
									damage.damages = {shock: 0};
									break;
								} else if (dmg.total >= trg.health) {
									// Too much damage, would have killed; reduce and try again
									damage.damages.shock--;
								} else {
									break;
								}
							}
						},
						deleteTrigger: "onEndPhase",
						noLog: true
					}
				));
			}

			var damage = new Damage(
				ability.creature, // Attacker
				nextdmg, // Damage Type
				1, // Area
				[] // Effects
			);
			nextdmg = trg.takeDamage(damage);

			if (nextdmg.damages === undefined) break; // If attack is dodge
			if(nextdmg.kill) break; // If target is killed
			if(nextdmg.damages.total <= 0) break; // If damage is too weak
			if (nextdmg.damageObj.status !== "") break;
			delete nextdmg.damages.total;
			nextdmg = nextdmg.damages;

			// Get next available targets
			nextTargets = ability.getTargets(trg.adjacentHexs(1,true));

			nextTargets.filter(function() {
				if (this.hexsHit === undefined) return false; // Remove empty ids
				return (targets.indexOf(this.target) == -1) ; // If this creature has already been hit
			});

			// If no target
			if (nextTargets.length === 0) break;

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

			}

			if( bestTarget instanceof Creature ){
				targets.push(bestTarget);
			}else{
				break;
			}
		}

	},

	_getHexes: function() {
		return G.grid.getHexMap(this.creature.x-3, this.creature.y-2, 0, false, frontnback3hex);
	}
}

];

/*
*
*	Lava Mollusk abilities
*
*/
G.abilities[22] =[

// 	First Ability: Greater Pyre
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onDamage",

	// 	require() :
	require : function(damage){
		if( this.used ) return false;
		if( !this.testRequirements() ) return false;
		if( damage == undefined ) damage = { type: "target" }; // For the test function to work
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
			this.creature, // Attacker
			this.damages, // Damage Type
			[],	// Effects
			targets
		);

		return damage;
	},
},


// 	Second Ability: Fiery Claw
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	distance : 2,
	_targetTeam: Team.enemy,

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;
		if (!this.testDirection({
				team: this._targetTeam, distance: this.distance,
				sourceCreature: this.creature
			})) {
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
			team: this._targetTeam,
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

	_targetTeam: Team.enemy,

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

			if (isTeam(ability.creature, trg, this._targetTeam)) {

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
		});

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

					if (isTeam(ability.creature, trg, this._targetTeam)) {

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
				ability.damages1, //Damage Type
				1, //Area
				[]	//Effects
			));
		}


		ability.areaDamage(
			ability.creature,
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

// 	First Ability: Boiling Point
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onStartPhase",

	// 	require() :
	require : function() { return this.testRequirements(); },

	//	activate() :
	activate : function() {
		// Leave two traps behind
		this._addTrap(this.creature.hexagons[1]);
		this._addTrap(this.creature.hexagons[this.creature.player.flipped ? 0 : 2]);
	},

	_addTrap: function(hex) {
		var ability = this;

		// Traps last forever if upgraded, otherwise 1 turn
		var lifetime = this.isUpgraded() ? 0 : 1;

		hex.createTrap(
			"scorched-ground",
			[
				new Effect(
					this.title, this.creature, hex, "onStepIn",
					{
						requireFn: function() {
							if (!this.trap.hex.creature) return false;
							// Magma Spawn immune to Scorched Ground
							return this.trap.hex.creature.id !== ability.creature.id;
						},
						effectFn: function(effect, target) {
							target.takeDamage(
								new Damage(effect.attacker, ability.damages, 1, []),
								{ isFromTrap: true });
							this.trap.destroy();
							effect.deleteEffect();
						},
						attacker: this.creature
					}
				)
			],
			this.creature.player,
			{
				turnLifetime: lifetime,
				ownerCreature: this.creature,
				fullTurnLifetime: true
			}
		);
	}
},

// 	Second Ability: Pulverizing Hit
{
	trigger: "onQuery",

	// Track the last target
	_lastTargetId: -1,

	_targetTeam: Team.enemy,

	// 	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if (!this.atLeastOneTarget(
				this.creature.getHexMap(frontnback3hex), { team: this._targetTeam })) {
			return false;
		}
		return true;
	},

	// 	query() :
	query : function() {
		var ability = this;
		var magmaSpawn = this.creature;

		G.grid.queryCreature( {
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			team: this._targetTeam,
			id : magmaSpawn.id,
			flipped : magmaSpawn.flipped,
			hexs : this.creature.getHexMap(frontnback3hex),
		});
	},

	activate: function(target, args) {
		var i;
		var ability = this;
		ability.end();

		var d = { burn: this.damages.burn, crush: this.damages.crush };
		// Deal extra burn damage based on number of stacks
		var stacksExisting = 0;
		for (i = 0; i < target.effects.length; i++) {
			if (target.effects[i].name === this.title &&
					target.effects[i].owner === this.creature) {
				stacksExisting++;
			}
		}
		d.burn += stacksExisting * this.damages.burn;

		var damage = new Damage(
			ability.creature, // Attacker
			d, // Damage Type
			1, // Area
			[]	// Effects
		);
		target.takeDamage(damage);

		// Add attack stacks
		var stacksToAdd = 1;
		// If upgraded, extra stacks if hitting the same target
		if (this.isUpgraded() && target.id === this._lastTargetId) {
			stacksToAdd = 2;
		}
		this._lastTargetId = target.id;

		for (i = 0; i < stacksToAdd; i++) {
			target.addEffect(new Effect(
				this.title,
				this.creature,
				target,
				"",
				{
					deleteTrigger: "",
					stackable: true
				}
			));
		}
	},
},



// 	Thirt Ability: Cracked Earth
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	map: [
		 [0,0,1,0],
		[0,0,1,1],
		 [1,1,1,0],//origin line
		[0,0,1,1],
		 [0,0,1,0]
	],

	require: function() {
		return this.testRequirements();
	},

	// 	query() :
	query : function() {
		var ability = this;
		var magmaSpawn = this.creature;

		this.map.origin = [0,2];

		G.grid.queryChoice( {
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			team: Team.both,
			requireCreature : 0,
			id : magmaSpawn.id,
			flipped : magmaSpawn.flipped,
			choices : [
				magmaSpawn.getHexMap(this.map),
				magmaSpawn.getHexMap(this.map, true)
			],
		});

	},


	//	activate() :
	activate : function(hexs, args) {
		var ability = this;
		ability.end();

		// Attack all creatures in area except for self
		var targets = ability.getTargets(hexs);
		for (var i = 0; i < targets.length; i++) {
			if (targets[i].target === this.creature) {
				targets.splice(i, 1);
				break;
			}
		}
		ability.areaDamage(
			ability.creature, // Attacker
			ability.damages1, // Damage Type
			[],	// Effects
			targets
		);

		// If upgraded, leave Boiling Point traps on all hexes that don't contain
		// another creature
		if (this.isUpgraded()) {
			hexs.each(function() {
				if (!this.creature || this.creature === ability.creature) {
					ability.creature.abilities[0]._addTrap(this);
				}
			});
		}
	}
},



// 	Fourth Ability: Molten Hurl
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	directions : [0,1,0,0,1,0],
	_targetTeam: Team.enemy,

	require : function() {
		if( !this.testRequirements() ) return false;

		// Creature must be moveable
		if (!this.creature.stats.moveable) {
			this.message = G.msg.abilities.notmoveable;
			return false;
		}

		var magmaSpawn = this.creature;
		var x = (magmaSpawn.player.flipped) ? magmaSpawn.x-magmaSpawn.size+1 : magmaSpawn.x ;

		if (!this.testDirection({
				team: this._targetTeam, x: x, directions: this.directions
			})) {
			return false;
		}
		return true;
	},

	// 	query() :
	query : function() {
		var ability = this;
		var magmaSpawn = this.creature;

		var x = (magmaSpawn.player.flipped) ? magmaSpawn.x-magmaSpawn.size+1 : magmaSpawn.x ;

		G.grid.queryDirection( {
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			team: this._targetTeam,
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

		ability.end(false,true);

		// Damage
		var damage = new Damage(
			ability.creature, // Attacker
			ability.damages, // Damage Type
			1, // Area
			[]	// Effects
		);

		// Destroy traps currently under self
		for (var i = 0; i < this.creature.hexagons.length; i++) {
			if (this.creature.hexagons[i].trap) {
				this.creature.hexagons[i].destroyTrap();
			}
		}

		// Movement
		var hurl = function(_path) {
			var target = _path.last().creature;

			var magmaHex = magmaSpawn.hexagons[
				args.direction === 4 ? magmaSpawn.size - 1 : 0];
			_path.filterCreature(false, false);
			_path.unshift(magmaHex); // Prevent error on empty path
			var destination = _path.last();
			var x = destination.x + (args.direction === 4 ? magmaSpawn.size - 1 : 0);
			destination = G.grid.hexs[destination.y][x];

			magmaSpawn.moveTo(destination, {
				ignoreMovementPoint: true,
				ignorePath: true,
				callback: function() {
					// Destroy traps along path
					_path.each(function() {
						if (!this.trap) return;
						this.destroyTrap();
					});

					var targetKilled = false;
					if (target !== undefined) {
						var ret = target.takeDamage(damage, true);
						targetKilled = ret.kill;
					}

					// If upgraded and target killed, keep going in the same direction and
					// find the next target to move into
					var continueHurl = false;
					if (ability.isUpgraded() && targetKilled) {
						var nextPath = G.grid.getHexLine(
							target.x, target.y, args.direction, false);
						nextPath.filterCreature(true, true, magmaSpawn.id);
						var nextTarget = nextPath.last().creature;
						// Continue only if there's a next enemy creature
						if (nextTarget &&
								isTeam(magmaSpawn, nextTarget, ability._targetTeam)) {
							continueHurl = true;
							hurl(nextPath);
						}
					}
					if (!continueHurl) {
						var interval = setInterval(function() {
							if(!G.freezedInput) {
								clearInterval(interval);
								G.UI.selectAbility(-1);
								G.activeCreature.queryMove();
							}
						}, 100);
					}
				},
			});
		};
		hurl(path);
	},
}

];

/*
*
*	Nightmare abilities
*
*/
G.abilities[9] =[

// 	First Ability: Frigid Tower
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onEndPhase",

	_effectName: 'Frostified',

	_getOffenseBuff: function() {
		return this.isUpgraded() ? 5 : 0;
	},

	// 	require() :
	require : function() {
		// Check whether this ability is upgraded; if so then make sure all existing
		// buffs include an offense buff
		var ability = this;
		this.creature.effects.each(function() {
			if (this.name === ability._effectName) {
				this.alterations.offense = ability._getOffenseBuff();
			}
		});
		if( this.creature.remainingMove < this.creature.stats.movement ) {
			this.message = "The creature moved this round.";
			return false;
		}
		return this.testRequirements();
	},

	//	activate() :
	activate : function() {

		this.creature.addEffect(
			new Effect(
				this._effectName,
				this.creature,
				this.creature,
				"",
				{
					alterations: {
						frost: 5, defense: 5, offense: this._getOffenseBuff()
					},
					stackable: true
				}
			)
		);
	}
},



// 	Second Ability: Icy Talons
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	_targetTeam: Team.enemy,

	// 	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if (!this.atLeastOneTarget(
				this.creature.getHexMap(frontnback2hex), { team: this._targetTeam })) {
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;

		G.grid.queryCreature( {
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			team: this._targetTeam,
			id : this.creature.id,
			flipped : this.creature.flipped,
			hexs : this.creature.getHexMap(frontnback2hex),
		});
	},


	//	activate() :
	activate : function(target, args) {
		var ability = this;
		ability.end();

		// Upgraded ability does pierce damage to smaller size or level targets
		var damages = ability.damages;
		if (!this.isUpgraded() ||
				!(target.size < this.creature.size || target.level < this.creature.level)) {
			damages.pierce = 0;
		}

		var damage = new Damage(
			ability.creature, // Attacker
			damages, // Damage Type
			1, //Area
			[
				new Effect(
					this.title,
					this.creature,
					this.target,
					"",
					{ alterations: { frost: -1 }, stackable: true }
				)
			]	//Effects
		);

		target.takeDamage(damage);
	},
},



// 	Third Ability: Sudden Uppercut
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	_targetTeam: Team.enemy,

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if (!this.atLeastOneTarget(
				this.creature.getHexMap(frontnback2hex), { team: this._targetTeam })) {
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team: this._targetTeam,
			id : this.creature.id,
			flipped : this.creature.flipped,
			hexs : this.creature.getHexMap(frontnback2hex),
		});
	},


	//	activate() :
	activate : function(target,args) {
		var ability = this;
		ability.end();

		var effects = [];
		// Upgraded ability adds a -10 defense debuff
		if (this.isUpgraded()) {
			effects.push(new Effect(
				this.title,
				this.creature,
				target,
				"",
				{
					alterations: { defense: -10 },
					stackable: true,
					turnLifetime: 1,
					deleteTrigger: "onStartPhase"
				}
			));
		}
		var damage = new Damage(
			ability.creature, //Attacker
			ability.damages, //Damage Type
			1, //Area
			effects
		);

		var result = target.takeDamage(damage);

		if (result.kill || result.damageObj.status !== "") return;

		target.delay();
	},
},



// 	Fourth Ability: Icicle Spear
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	directions : [1,1,1,1,1,1],
	_targetTeam: Team.both,

	_getDistance: function() {
		// Upgraded ability has infinite range
		return this.isUpgraded() ? 0 : 6;
	},

	require : function(){
		if( !this.testRequirements() ) return false;

		var crea = this.creature;
		var x = (crea.player.flipped) ? crea.x-crea.size+1 : crea.x ;

		if (!this.testDirection({
				team: this._targetTeam,
				x: x,
				directions: this.directions,
				distance: this._getDistance(),
				stopOnCreature: false
			})) {
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
			team: this._targetTeam,
			id : crea.id,
			requireCreature : true,
			x : x,
			y : crea.y,
			directions : this.directions,
			distance: this._getDistance(),
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

				var d = { pierce: ability.damages.pierce, frost : 6-i };
				if (d.frost < 0) {
					d.frost = 0;
				}

				//Damage
				var damage = new Damage(
					ability.creature, //Attacker
					d, //Damage Type
					1, //Area
					[]	//Effects
				);

				var result = trg.takeDamage(damage);

				// Stop propagating if no damage dealt
				if (result.damageObj.status === "Shielded" ||
						(result.damages && result.damages.total <= 0)) {
					break;
				}
			}
		}
	}
}

];

/*
*
*	Nutcase abilities
*
*/
G.abilities[40] =[

//	First Ability: Tentacle Bush
{
	trigger: "onUnderAttack",

	require: function() {
		// Always true to highlight ability
		return true;
	},

	activate: function(damage) {
		// Must take melee damage from a non-trap source
		if (damage === undefined) return false;
		if (!damage.melee) return false;
		if (damage.isFromTrap) return false;

		var ability = this;
		ability.end();

		// Target becomes unmoveable until end of their phase
		var o = {
			alterations: { moveable: false },
			deleteTrigger: "onEndPhase",
			// Delete this effect as soon as attacker's turn finishes
			turnLifetime: 1,
			creationTurn: G.turn - 1,
			deleteOnOwnerDeath: true
		};
		// If upgraded, target abilities cost more energy
		if (this.isUpgraded()) {
			o.alterations.reqEnergy = 5;
		}
		// Create a zero damage with debuff
		var counterDamage = new Damage(
			this.creature, {}, 1, [new Effect(
				this.title,
				this.creature, // Caster
				damage.attacker, // Target
				"", // Trigger
				o
			)]
		);
		counterDamage.counter = true;
		damage.attacker.takeDamage(counterDamage);
		// Making attacker unmoveable will change its move query, so update it
		if (damage.attacker === G.activeCreature) {
			damage.attacker.queryMove();
		}

		// If inactive, Nutcase becomes unmoveable until start of its phase
		if (G.activeCreature !== this.creature) {
			this.creature.addEffect(new Effect(
				this.title,
				this.creature,
				this.creature,
				"",
				{
					alterations: { moveable: false },
					deleteTrigger: "onStartPhase",
					turnLifetime: 1
				}
			));
		}
	}
},

//	Second Ability: Hammer Time
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	_targetTeam: Team.enemy,

	//	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if (!this.atLeastOneTarget(
				this.creature.getHexMap(frontnback2hex), { team: this._targetTeam })) {
			return false;
		}

		return true;
	},

	//	query() :
	query : function(){
		var ability = this;

		if (!this.isUpgraded()) {
			G.grid.queryCreature( {
				fnOnConfirm : function(){ ability.animation.apply(ability, arguments); },
				team: this._targetTeam,
				id : this.creature.id,
				flipped : this.creature.flipped,
				hexs : this.creature.getHexMap(frontnback2hex)
			});
		} else {
			// If upgraded, show choice of front and back hex groups
			var choices = [
				this.creature.getHexMap(front2hex),
				this.creature.getHexMap(back2hex)
			];
			G.grid.queryChoice({
				fnOnSelect: function(choice, args) {
					G.activeCreature.faceHex(args.hex, undefined, true);
					args.hex.overlayVisualState(
						"creature selected player" + G.activeCreature.team);
				},
				fnOnConfirm: function() {
					ability.animation.apply(ability, arguments);
				},
				team: this._targetTeam,
				id: this.creature.id,
				choices: choices
			});
		}
	},

	activate: function(targetOrChoice, args) {
		var ability = this;
		ability.end();

		if (!this.isUpgraded()) {
			this._activateOnTarget(targetOrChoice);
		} else {
			// We want to order the hexes in a clockwise fashion, unless the player
			// chose the last clockwise hex, in which case order counterclockwise.
			// Order by y coordinate, which means:
			// - y ascending if
			//   - front choice (choice 0) and not bottom hex chosen, or
			//   - back choice (choice 1) and top hex chosen
			// - otherwise, y descending
			var isFrontChoice = args.choiceIndex === 0;
			var yCoords = targetOrChoice.map(function(hex) { return hex.y; });
			var yMin = Math.min.apply(null, yCoords);
			var yMax = Math.max.apply(null, yCoords);
			var yAscending;
			if (isFrontChoice) {
				yAscending = args.hex.y !== yMax;
			} else {
				yAscending = args.hex.y === yMin;
			}
			targetOrChoice.sort(function(a, b) {
				return yAscending ? a.y - b.y : b.y - a.y;
			});
			for (var i = 0; i < targetOrChoice.length; i++) {
				var target = targetOrChoice[i].creature;
				// only attack enemies
				if (!target || !isTeam(this.creature, target, this._targetTeam)) {
					continue;
				}
				this._activateOnTarget(target);
			}
		}
	},

	_activateOnTarget: function(target) {
		var ability = this;

		// Target takes pierce damage if it ever moves
		var effect = new Effect(
			"Hammered", // Name
			this.creature, // Caster
			target, // Target
			"onStepOut", // Trigger
			{
				effectFn: function(effect) {
					effect.target.takeDamage(new Damage(
						effect.owner, { pierce: ability.damages.pierce }, 1, []));
					effect.deleteEffect();
				}
			}
		);

		var damage = new Damage(
			this.creature, // Attacker
			this.damages, // Damage Type
			1, // Area
			[effect]	// Effects
		);

		target.takeDamage(damage);
	}
},

// 	Third Ability: War Horn
{
	trigger: "onQuery",

	_directions : [0, 1, 0, 0, 1, 0],	// forward/backward
	_targetTeam: Team.enemy,

	//	require() :
	require : function() {
		if( !this.testRequirements() ) return false;
		if (!this.testDirection({
				team: this._targetTeam, directions: this._directions
			})) {
			return false;
		}
		return true;
	},

	query: function() {
		var ability = this;

		var o = {
			fnOnConfirm: function() {
				ability.animation.apply(ability, arguments);
			},
			team: this._targetTeam,
			requireCreature: true,
			id: this.creature.id,
			sourceCreature: this.creature,
			x: this.creature.x,
			y: this.creature.y,
			directions: this._directions,
			dashedHexesAfterCreatureStop: false
		};
		if (!this.isUpgraded()) {
			G.grid.queryDirection(o);
		} else {
			// Create custom choices containing normal directions plus hex choices
			// past the first creature, extending up to the next obstacle
			o = G.grid.getDirectionChoices(o);
			var newChoices = [];
			for (var i = 0; i < o.choices.length; i++) {
				var j;
				var direction = o.choices[i][0].direction;

				// Add dashed hexes up to the next obstacle for this direction choice
				var fx = 0;
				if (o.sourceCreature instanceof Creature) {
					if ((!o.sourceCreature.player.flipped && direction > 2) ||
							(o.sourceCreature.player.flipped && direction < 3)) {
						fx = -(o.sourceCreature.size - 1);
					}
				}
				var line = G.grid.getHexLine(o.x + fx, o.y, direction, o.flipped);
				o.choices[i].each(function() { line.removePos(this); });
				line.filterCreature(false, true, o.id);
				o.hexesDashed = o.hexesDashed.concat(line);

				// For each dashed hex, create a new choice composed of the original
				// choice, extended up to and including the dashed hex. This will be the
				// choice that pushes the target up to that hex.
				// Get a new hex line so that the hexes are in the right order
				var newChoice = G.grid.getHexLine(o.x + fx, o.y, direction, o.flipped);
				// Exclude creature
				ability.creature.hexagons.each(function() {
					if (newChoice.findPos(this)) {
						newChoice.removePos(this);
					}
				});
				// Exclude hexes that don't exist in the original choice
				for (j = 0; j < newChoice.length; j++) {
					if (!o.choices[i].findPos(newChoice[j])) {
						newChoice.removePos(newChoice[j]);
						j--;
					}
				}
				// Extend choice to include each dashed hex in succession
				for (j = 0; j < line.length; j++) {
					newChoice.push(line[j]);
					newChoices.push(newChoice.slice());
				}
			}
			o.choices = o.choices.concat(newChoices);
			o.requireCreature = false;
			G.grid.queryChoice(o);
		}
	},

	activate: function(path, args) {
		var i;
		var ability = this;
		this.end();

		// Find:
		// - the target which is the first creature in the path
		// - the run path which is up to the creature
		// - the push paths which start from the last creature hex and continues to
		//   the rest of the path
		var target;
		var runPath;
		var pushPath = [];
		for (i = 0; i < path.length; i++) {
			if (path[i].creature) {
				target = path[i].creature;
				runPath = path.slice(0, i);
				pushPath = path.slice(i);
				break;
			}
		}

		// Calculate damage, extra damage per hex distance
		var damages = $j.extend({}, this.damages);
		damages.pierce += runPath.length;
		var damage = new Damage(this.creature, damages, 1, []);

		// Move towards target if necessary
		if (runPath.length > 0) {
			var destination = runPath.last();
			if (args.direction === 4) {
				destination =
					G.grid.hexs[destination.y][destination.x + this.creature.size - 1];
			}

			G.grid.cleanReachable();
			this.creature.moveTo(destination, {
				overrideSpeed: 100,
				ignoreMovementPoint: true,
				callback: function() {
					var interval = setInterval(function() {
						if (!G.freezedInput) {
							clearInterval(interval);

							// Deal damage only if we have reached the end of the path
							if (destination.creature === ability.creature) {
								target.takeDamage(damage);
							}

							if (!ability._pushTarget(target, pushPath, args)) {
								G.activeCreature.queryMove();
							}
						}
					}, 100);
				},
			});
		} else {
			target.takeDamage(damage);
			if (!ability._pushTarget(target, pushPath, args)) {
				G.activeCreature.queryMove();
			}
		}
	},

	_pushTarget: function(target, pushPath, args) {
		var ability = this;
		var creature = this.creature;

		var targetPushPath = pushPath.slice();
		targetPushPath.filterCreature(false, false, creature.id);
		targetPushPath.filterCreature(false, false, target.id);
		if (targetPushPath.length === 0) {
			return false;
		}

		// Push the creature one hex at a time
		// As we need to move creatures simultaneously, we can't use the normal path
		// calculation as the target blocks the path
		var i = 0;
		var interval = setInterval(function() {
			if (!G.freezedInput) {
				if (i === targetPushPath.length ||
						creature.dead || target.dead ||
						!creature.stats.moveable || !target.stats.moveable) {
					clearInterval(interval);
					creature.facePlayerDefault();
					G.activeCreature.queryMove();
				} else {
					var hex = pushPath[i];
					var targetHex = targetPushPath[i];
					if (args.direction === 4) {
						hex = G.grid.hexs[hex.y][hex.x + creature.size - 1];
						targetHex = G.grid.hexs[targetHex.y][targetHex.x + target.size - 1];
					}
					ability._pushOneHex(target, hex, targetHex);
					i++;
				}
			}
		});

		return true;
	},

	_pushOneHex: function(target, hex, targetHex) {
		var opts = {
			overrideSpeed: 100,
			ignorePath: true,
			ignoreMovementPoint: true,
			turnAroundOnComplete: false
		};
		// Note: order matters here; moving ourselves first results on overlapping
		// hexes momentarily and messes up creature hex displays
		target.moveTo(targetHex, $j.extend({ animation: 'push' }, opts));
		this.creature.moveTo(hex, opts);
	}
},

//	Third Ability: Fishing Hook
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	_targetTeam: Team.enemy,

	require: function() {
		var ability = this;
		if (!this.testRequirements()) return false;

		if (!this.atLeastOneTarget(
				this.creature.getHexMap(inlinefrontnback2hex),
				{
					team: this._targetTeam,
					optTest: function(creature) {
						// Size restriction of 2 if unupgraded
						return ability.isUpgraded() ? true : creature.size <= 2;
					}
				})) {
			return false;
		}
		return true;
	},

	//	query() :
	query : function() {
		var ability = this;

		G.grid.queryCreature( {
			fnOnConfirm : function(){ ability.animation.apply(ability, arguments); },
			team: this._targetTeam,
			id : this.creature.id,
			flipped : this.creature.flipped,
			hexs: this.creature.getHexMap(inlinefrontnback2hex),
			optTest: function(creature) {
				// Size restriction of 2 if unupgraded
				return ability.isUpgraded() ? true : creature.size <= 2;
			}
		});
	},


	//	activate() :
	activate : function(target,args) {
		var ability = this;
		var crea = ability.creature;
		ability.end();

		var damage = new Damage(
			crea, // Attacker
			ability.damages, // Damage Type
			1, // Area
			[]	// Effects
		);

		var trgIsInfront = (G.grid.getHexMap(crea.x-inlinefront2hex.origin[0], crea.y-inlinefront2hex.origin[1], 0, false, inlinefront2hex)[0].creature == target);

		var creaX = target.x + (trgIsInfront ? 0 : crea.size - target.size);
		crea.moveTo(
			G.grid.hexs[target.y][creaX],
			{
				ignorePath: true,
				ignoreMovementPoint: true,
				callback:function() {
					crea.updateHex();
					G.grid.updateDisplay();
					crea.queryMove();
				}
			}
		);
		var targetX = crea.x + (trgIsInfront ? target.size - crea.size: 0);
		target.moveTo(
			G.grid.hexs[crea.y][targetX],
			{
				ignorePath: true,
				ignoreMovementPoint: true,
				callback:function(){
					target.updateHex();
					G.grid.updateDisplay();
					target.takeDamage(damage);
				}
			}
		);
	},
}

];

/*
*
*	Scavenger abilities
*
*/
G.abilities[44] =[

// 	First Ability: Wing Feathers
{
	/**
	 * Provides custom movement type given whether the ability is upgraded or not.
	 * Movement type is "hover" unless this ability is upgraded, then it's "flying"
	 * @return {string} movement type, "hover" or "flying"
	 */
	movementType: function() {
		return this.isUpgraded() ? "flying" : this.creature._movementType;
	},

	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "",

	// 	require() :
	require : function() {
		return true;
	},

	//	activate() :
	activate : function() {
	},
},



// 	Second Ability: Slicing Pounce
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	_targetTeam: Team.enemy,

	// 	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if (!this.atLeastOneTarget(
				this.creature.getHexMap(frontnback2hex), { team: this._targetTeam })) {
			return false;
		}
		return true;
	},

	// 	query() :
	query : function() {
		var ability = this;

		G.grid.queryCreature( {
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			team: this._targetTeam,
			id : this.creature.id,
			flipped : this.creature.flipped,
			hexs : this.creature.getHexMap(frontnback2hex),
		});
	},


	//	activate() :
	activate : function(target, args) {
		var ability = this;
		ability.end();

		// If upgraded, hits will debuff target with -1 offense
		if (this.isUpgraded()) {
			var effect = new Effect("Slicing Pounce", ability.creature, target, "onDamage", {
				alterations : { offense: -1 }
			});
			target.addEffect(effect);
			G.log("%CreatureName" + target.id + "%'s offense is lowered by 1");
		}

		var damage = new Damage(
			ability.creature, // Attacker
			ability.damages, // Damage Type
			1, // Area
			[]	// Effects
		);

		target.takeDamage(damage);
	},
},



// 	Third Ability: Escort Service
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	_targetTeam: Team.both,

	// 	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		var ability = this;
		var crea = this.creature;

		var hexs = crea.getHexMap(inlinefrontnback2hex);

		if( hexs.length < 2 ) {
			// At the border of the map
			return false;
		}

		if( hexs[0].creature && hexs[1].creature ) {
			// Sandwiched
			return false;
		}

		// Cannot escort large (size > 2) creatures unless ability is upgraded
		hexs.filter(function() {
			if( !this.creature ) return false;
			return this.creature.size < 3 || ability.isUpgraded();
		});

		if (!this.atLeastOneTarget(hexs, { team: this._targetTeam })) {
			return false;
		}

		var trg = hexs[0].creature || hexs[1].creature;

		if( !trg.stats.moveable ) {
			this.message = "Target is not moveable.";
			return false;
		}

		if( crea.remainingMove < trg.size ) {
			//Not enough move points
			this.message = "Not enough movement points.";
			return false;
		}

		return true;
	},

	query: function() {
		var ability = this;
		var crea = this.creature;

		var hexs = crea.getHexMap(inlinefrontnback2hex);
		var trg = hexs[0].creature || hexs[1].creature;

		var distance = Math.floor(crea.remainingMove/trg.size);
		var size = crea.size+trg.size;

		var trgIsInfront = (G.grid.getHexMap(crea.x - inlinefront2hex.origin[0], crea.y - inlinefront2hex.origin[1], 0, false, inlinefront2hex)[0].creature == trg);

		var select = function(hex,args) {
			for (var i = 0; i < size; i++) {
				if( !G.grid.hexExists(hex.y, hex.x - i) ) continue;
				var h = G.grid.hexs[hex.y][hex.x - i];
				var color;
				if (trgIsInfront) {
					color = i < trg.size ? trg.team : crea.team;
				} else {
					color = i > 1 ? trg.team : crea.team;
				}
				h.overlayVisualState("creature moveto selected player" + color);
			}
		};

		var x = ( trgIsInfront ? crea.x + trg.size : crea.x );

		G.grid.queryHexs({
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); }, // fnOnConfirm
			fnOnSelect : select, // fnOnSelect,
			team: this._targetTeam,
			id : [crea.id, trg.id],
			size : size,
			flipped : crea.player.flipped,
			hexs : G.grid.getFlyingRange(x,crea.y, distance, size, [crea.id, trg.id]).filter(function() {
				return crea.y == this.y &&
					( trgIsInfront ?
						 this.x < x :
						 this.x > x-crea.size-trg.size + 1
					);
				}),
			args : {trg : trg.id, trgIsInfront: trgIsInfront}
		});
	},


	//	activate() :
	activate : function(hex, args) {
		var ability = this;
		ability.end();

		var crea = this.creature;

		var trg = G.creatures[args.trg];
		var size = crea.size+trg.size;

		var trgIF = args.trgIsInfront;

		var crea_dest 	= G.grid.hexs[hex.y][ trgIF ? hex.x - trg.size : hex.x ];
		var trg_dest 	= G.grid.hexs[hex.y][ trgIF ? hex.x : hex.x-crea.size ];

		// Determine distance
		var distance = 0;
		var k = 0;
		var start = G.grid.hexs[crea.y][crea.x];
		while(!distance){
			k++;
			if( start.adjacentHex(k).findPos(crea_dest) ) distance = k;
		}

		// Substract from movement points
		crea.remainingMove -= distance * trg.size;

		crea.moveTo(crea_dest, {
			animation : "fly",
			callback : function() {
				trg.updateHex();
				G.grid.updateDisplay();
			},
			ignoreMovementPoint : true
		});

		trg.moveTo(trg_dest,{
			animation : "fly",
			callback : function() {
				ability.creature.updateHex();
				G.grid.updateDisplay();
				ability.creature.queryMove();
			},
			ignoreMovementPoint : true,
			overrideSpeed : crea.animation.walk_speed
		});

	},
},



// 	Fourth Ability: Deadly Toxin
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	_targetTeam: Team.enemy,

	// 	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if (!this.atLeastOneTarget(
				this.creature.getHexMap(frontnback2hex), { team: this._targetTeam })) {
			return false;
		}
		return true;
	},

	// 	query() :
	query : function() {
		var ability = this;

		G.grid.queryCreature( {
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			team: this._targetTeam,
			id : this.creature.id,
			flipped : this.creature.flipped,
			hexs : this.creature.getHexMap(frontnback2hex),
		});
	},


	//	activate() :
	activate : function(target,args) {
		var ability = this;
		ability.end();

		// Don't perform poison damage unless upgraded
		var damages = $j.extend({}, ability.damages);
		if (!this.isUpgraded()) {
			delete damages.poison;
		}

		var damage = new Damage(
			ability.creature, //Attacker
			damages, //Damage Type
			1, //Area
			[]	//Effects
		);

		target.takeDamage(damage);

		// Add poison damage debuff
		var effect = new Effect(this.title, this.creature, target, "onStartPhase", {
			stackable: false,
			effectFn: function(effect, creature) {
				G.log("%CreatureName" + creature.id + "% is affected by " + ability.title);
				creature.takeDamage(new Damage(
					effect.owner, {poison: ability.damages.poison}, 1, []
				));
			}
		});
		target.replaceEffect(effect);
		G.log("%CreatureName" + target.id + "% is poisoned by " + this.title);

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

// 	First Ability: Bunny Hop
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onOtherCreatureMove",

	require: function(fromHex) {
		if (!this.testRequirements()) {
			return false;
		}

		// If enough uses, jump away when an enemy has entered our trigger area, and
		// we have a space to jump back to
		return (
			this.timesUsedThisTurn < this._getUsesPerTurn() &&
			fromHex && fromHex.creature &&
			isTeam(fromHex.creature, this.creature, Team.enemy) &&
			this._getTriggerHexId(fromHex) >= 0 &&
			this._getHopHex(fromHex) !== undefined);
	},

	//	activate() :
	activate : function(destHex) {
		var ability = this;
		ability.end();

		this.creature.moveTo(
			this._getHopHex(destHex),
			{
				callbackStepIn: function() {
					G.activeCreature.queryMove();
				},
				ignorePath: true,
				ignoreMovementPoint: true
			}
		);
	},

	_getUsesPerTurn: function() {
		// If upgraded, useable twice per turn
		return this.isUpgraded() ? 2 : 1;
	},

	_getTriggerHexId: function(fromHex) {
		var hexes = this.creature.getHexMap(front1hex);

		// Find which hex we are hopping from
		var id = -1;
		fromHex.creature.hexagons.each(function() {
			id = hexes.indexOf(this) > id ? hexes.indexOf(this) : id;
		});

		return id;
	},

	_getHopHex: function(fromHex) {
		var id = this._getTriggerHexId(fromHex);

		// Try to hop away
		var hex;
		switch (id) {
			case 0:
				hex = this.creature.getHexMap(backbottom1hex)[0];
				break;
			case 1:
				hex = this.creature.getHexMap(inlineback1hex)[0];
				break;
			case 2:
				hex = this.creature.getHexMap(backtop1hex)[0];
				break;
		}

		// If we can't hop away, try hopping backwards
		if (id !== 1 &&
				(hex === undefined ||
					!hex.isWalkable(this.creature.size, this.creature.id, true))) {
			hex = this.creature.getHexMap(inlineback1hex)[0];
		}

		if (hex !== undefined &&
				!hex.isWalkable(this.creature.size, this.creature.id, true)) {
			return undefined;
		}
		return hex;
	}
},



// 	Second Ability: Big Pliers
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	_targetTeam: Team.enemy,

	// 	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if (!this.atLeastOneTarget(
				this.creature.adjacentHexs(1), { team: this._targetTeam })) {
			return false;
		}
		return true;
	},

	// 	query() :
	query : function() {

		var ability = this;
		var snowBunny = this.creature;

		G.grid.queryCreature( {
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			team: this._targetTeam,
			id : snowBunny.id,
			flipped : snowBunny.player.flipped,
			hexs : snowBunny.adjacentHexs(1),
		});
	},


	//	activate() :
	activate : function(target,args) {
		var ability = this;
		ability.end();

		var damages = ability.damages;
		// If upgraded, do pure damage against frozen targets
		if (this.isUpgraded() && target.stats.frozen) {
			damages = { pure: 0 };
			for (var type in ability.damages) {
				damages.pure += ability.damages[type];
			}
		}

		var damage = new Damage(
			ability.creature, // Attacker
			damages, // Damage Type
			1, // Area
			[]	// Effects
		);
		target.takeDamage(damage);
	},
},



// 	Third Ability: Blowing Wind
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	directions : [1,1,1,1,1,1],
	_targetTeam: Team.both,

	// 	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if (!this.testDirection(
				{ team: this._targetTeam, directions: this.directions })) {
			return false;
		}
		return true;
	},

	// 	query() :
	query : function() {
		var ability = this;
		var snowBunny = this.creature;

		G.grid.queryDirection( {
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			flipped : snowBunny.player.flipped,
			team: this._targetTeam,
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
		// No blow size penalty if upgraded and target is frozen
		var dist = 5 - (this.isUpgraded() && target.stats.frozen ? 0 : target.size);
		var dir = [];
		switch( args.direction ) {
			case 0: // Upright
				dir = G.grid.getHexMap(target.x, target.y-8, 0, target.flipped, diagonalup).reverse();
				break;
			case 1: // StraitForward
				dir = G.grid.getHexMap(target.x, target.y, 0, target.flipped, straitrow);
				break;
			case 2: // Downright
				dir = G.grid.getHexMap(target.x, target.y, 0, target.flipped, diagonaldown);
				break;
			case 3: // Downleft
				dir = G.grid.getHexMap(target.x, target.y, -4, target.flipped, diagonalup);
				break;
			case 4: // StraitBackward
				dir = G.grid.getHexMap(target.x, target.y, 0, !target.flipped, straitrow);
				break;
			case 5: // Upleft
				dir = G.grid.getHexMap(target.x, target.y-8, -4, target.flipped, diagonaldown).reverse();
				break;
			default:
				break;
		}

		dir = dir.slice(0, dist + 1);

		var hex = target.hexagons[0];
		for (var j = 0; j < dir.length; j++) {
			if(dir[j].isWalkable(target.size, target.id, true)) {
				hex = dir[j];
			}else{
				break;
			}
		}

		target.moveTo(hex, {
			ignoreMovementPoint : true,
			ignorePath : true,
			callback : function() {
				G.activeCreature.queryMove();
			},
			animation : "push",
		});
	},
},



// 	Fourth Ability: Freezing Spit
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	_targetTeam: Team.enemy,

	// 	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if (!this.testDirection(
				{ team: this._targetTeam, directions: this.directions })) {
			return false;
		}
		return true;
	},

	// 	query() :
	query : function() {

		var ability = this;
		var snowBunny = this.creature;

		G.grid.queryDirection( {
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			flipped : snowBunny.player.flipped,
			team: this._targetTeam,
			id : snowBunny.id,
			requireCreature : true,
			x : snowBunny.x,
			y : snowBunny.y,
			directions : [1,1,1,1,1,1],
		});
	},


	//	activate() :
	activate : function(path, args) {
		var ability = this;
		ability.end();

		var target = path.last().creature;
		var dist = path.slice(0).filterCreature(false, false).length;

		var emissionPoint = {
			x: ability.creature.grp.x + 52, y: ability.creature.grp.y - 20
		};
		var targetPoint = {
			x: target.grp.x + 52, y: target.grp.y - 20
		};
		var sprite = G.grid.creatureGroup.create(
			emissionPoint.x, emissionPoint.y, 'effects_freezing-spit');
		sprite.anchor.setTo(0.5);
		sprite.rotation = -Math.PI / 3 + args.direction * Math.PI / 3;
		var duration = dist * 75;
		var tween = G.Phaser.add.tween(sprite)
		.to({ x: targetPoint.x, y: targetPoint.y }, duration, Phaser.Easing.Linear.None)
		.start();
		tween.onComplete.add(function() {
			this.destroy();

			// Copy to not alter ability strength
			var dmg = $j.extend( {}, ability.damages);
			dmg.crush += 3*dist; // Add distance to crush damage

			var damage = new Damage(
				ability.creature, // Attacker
				dmg, // Damage Type
				1, // Area
				[]
			);
			var damageResult = target.takeDamage(damage);

			// If upgraded and melee range, freeze the target
			if (ability.isUpgraded() && damageResult.damageObj.melee) {
				target.stats.frozen = true;
				target.updateHealth();
				G.UI.updateFatigue();
			}
		}, sprite);
	},

	getAnimationData: function(path, args) {
		var dist = path.slice(0).filterCreature(false, false).length;
		return {
			duration: 500,
			delay: 0,
			activateAnimation: false
		};
	}
}

];

/*
*
*	Swine Thug abilities
*
*/
G.abilities[37] =[

// 	First Ability: Spa Goggles
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onCreatureMove",

	// 	require() :
	require : function(hex) {
		if( !this.testRequirements() ) return false;

		if(hex == undefined) hex = this.creature.hexagons[0];
		this.message = "";
		if(hex.trap) {
			if(hex.trap.type == "mud-bath") {
				return true;
			}
		}

		this.message = "Not in a mud bath.";

		this.creature.effects.each(function() {
			if(this.trigger == "mud-bath")
				this.deleteEffect();
		});
		return false;
	},

	//	activate() :
	activate : function(hex) {
		var alterations = $j.extend({}, this.effects[0]);
		// Double effect if upgraded
		if (this.isUpgraded()) {
			for (var k in alterations) {
				alterations[k] = alterations[k] * 2;
			}
		}
		var effect = new Effect("Spa Goggles", this.creature, this.creature, "mud-bath", {
			alterations : alterations
		});
		this.creature.addEffect(effect);

		// Log message, assume that all buffs are the same amount, and there are
		// only two buffs (otherwise the grammar doesn't make sense)
		var log = "%CreatureName" + this.creature.id + "%'s ";
		var first = true;
		var amount;
		for (var k in alterations) {
			if (!first) {
				log += "and ";
			}
			log += k + " ";
			first = false;
			amount = alterations[k];
		}
		log += "+" + amount;
		G.log(log);
	},
},



// 	Second Ability: Baseball Baton
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	_targetTeam: Team.enemy,

	// 	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if (!this.atLeastOneTarget(
				this.creature.adjacentHexs(1), { team: this._targetTeam })) {
			return false;
		}
		return true;
	},

	// 	query() :
	query : function() {

		var ability = this;
		var swine = this.creature;

		G.grid.queryDirection({
			fnOnConfirm: function(){ ability.animation.apply(ability, arguments); },
			flipped: swine.player.flipped,
			team: this._targetTeam,
			id: swine.id,
			requireCreature: true,
			x: swine.x,
			y: swine.y,
			sourceCreature: swine,
			stopOnCreature: false,
			distance: 1
		});
	},

	activate: function(path, args) {
		var ability = this;
		ability.end();

		var target = path.last().creature;
		var damage = new Damage(
			ability.creature, // Attacker
			ability.damages, // Damage Type
			1, // Area
			[]	// Effects
		);
		var result = target.takeDamage(damage);
		// Knock the target back if they are still alive
		if( !result.kill ) {
			// See how far we can knock the target back
			// For regular ability, this is only 1 hex
			// For upgraded, as long as the target is over a mud tile, keep sliding

			// See how far the target can be knocked back
			// Skip the first hex as it is the same hex as the target
			var hexes = G.grid.getHexLine(
				target.x, target.y, args.direction, target.flipped);
			hexes.splice(0, 1);
			var hex = null;
			for (var i = 0; i < hexes.length; i++) {
				// Check that the next knockback hex is valid
				if (!hexes[i].isWalkable(target.size, target.id, true)) break;

				hex = hexes[i];

				if(!this.isUpgraded()) break;
				// Check if we are over a mud bath
				// The target must be completely over mud baths to keep sliding
				var mudSlide = true;
				for (var j = 0; j < target.size; j++) {
					var mudHex = G.grid.hexs[hex.y][hex.x-j];
					if(!mudHex.trap || mudHex.trap.type !== "mud-bath") {
						mudSlide = false;
						break;
					}
				}
				if (!mudSlide) break;
			}
			if (hex !== null) {
				target.moveTo(hex, {
					callback : function() {
						G.activeCreature.queryMove();
					},
					ignoreMovementPoint : true,
					ignorePath : true,
					overrideSpeed: 1200, // Custom speed for knockback
					animation : "push",
				});
			}
		}
	},
},



// 	Third Ability: Ground Ball
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	_targetTeam: Team.enemy,

	// 	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		var swine = this.creature;
		var hexs = G.grid.getHexMap(swine.x,swine.y - 2, 0, false, bellowrow).filterCreature(true, true, swine.id, swine.team).concat(
			G.grid.getHexMap(swine.x,swine.y, 0, false, straitrow).filterCreature(true, true, swine.id, swine.team),
			G.grid.getHexMap(swine.x,swine.y, 0, false, bellowrow).filterCreature(true, true, swine.id, swine.team),
			G.grid.getHexMap(swine.x,swine.y - 2, 0, true, bellowrow).filterCreature(true,true, swine.id, swine.team),
			G.grid.getHexMap(swine.x,swine.y, 0, true, straitrow).filterCreature(true, true, swine.id, swine.team),
			G.grid.getHexMap(swine.x,swine.y, 0, true, bellowrow).filterCreature(true, true, swine.id, swine.team));
		if (!this.atLeastOneTarget(hexs, { team: this._targetTeam })) {
			return false;
		}

		return true;
	},

	// 	query() :
	query : function() {

		var ability = this;
		var swine = this.creature;

		var choices = [
			// Front
			G.grid.getHexMap(swine.x,swine.y - 2, 0, false, bellowrow),
			G.grid.getHexMap(swine.x,swine.y, 0, false, straitrow),
			G.grid.getHexMap(swine.x,swine.y, 0, false, bellowrow),
			// Behind
			G.grid.getHexMap(swine.x,swine.y - 2, 0, true, bellowrow),
			G.grid.getHexMap(swine.x,swine.y, 0, true, straitrow),
			G.grid.getHexMap(swine.x,swine.y, 0, true, bellowrow),
		];

		choices.each(function() {
			this.filterCreature(true, true, swine.id);
		});

		G.grid.queryChoice( {
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); }, // fnOnConfirm
			team: this._targetTeam,
			requireCreature : 1,
			id : swine.id,
			flipped : swine.flipped,
			choices : choices,
		});
	},


	//	activate() :
	activate : function(path, args) {
		var ability = this;
		ability.end();

		var target = path.last().creature;

		// If upgraded, hits will debuff target with -1 meditation
		if (this.isUpgraded()) {
			var effect = new Effect("Ground Ball", ability.creature, target, "onDamage", {
				alterations : { meditation: -1 }
			});
			target.addEffect(effect);
			G.log("%CreatureName" + target.id + "%'s meditation is lowered by 1");
		}

		var damage = new Damage(
			ability.creature, // Attacker
			ability.damages, // Damage Type
			1, // Area
			[]	// Effects
		);
		target.takeDamage(damage);
	},
},



// 	Fourth Ability: Mud Bath
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	_energyNormal: 30,
	_energySelfUpgraded: 10,

	require : function() {
		// If ability is upgraded, self cast energy cost is less
		if (this.isUpgraded()) {
			this.requirements = { energy: this._energySelfUpgraded };
			this.costs = { energy: this._energySelfUpgraded };
		}else{
			this.requirements = { energy: this._energyNormal };
			this.costs = { energy: this._energyNormal };
		}
		return this.testRequirements();
	},

	// 	query() :
	query : function() {

		var ability = this;
		var swine = this.creature;
		var size = 1;

		// Check if the ability is upgraded because then the self cast energy cost is less
		var selfOnly = this.isUpgraded() && this.creature.energy < this._energyNormal;

		var hexs = [];
		if (!selfOnly) {
			// Gather all the reachable hexs, including the current one
			hexs = G.grid.getFlyingRange(swine.x, swine.y, 50, 1, 0);
		}
		hexs.push(G.grid.hexs[swine.y][swine.x]);

		//TODO: Filtering corpse hexs
		hexs.filter(function() { return true; } );

		G.grid.hideCreatureHexs(this.creature);

		G.grid.queryHexs({
			fnOnCancel : function() { G.activeCreature.queryMove(); G.grid.clearHexViewAlterations(); },
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			hexs : hexs,
			hideNonTarget: true
		});
	},


	//	activate() :
	activate : function(hex, args) {
		G.grid.clearHexViewAlterations();
		var ability = this;
		var swine = this.creature;

		// If upgraded and cast on self, cost is less
		var isSelf = hex.x === swine.x && hex.y === swine.y;
		if (this.isUpgraded() && isSelf) {
			this.requirements = { energy: this._energySelfUpgraded };
			this.costs = { energy: this._energySelfUpgraded };
		}else{
			this.requirements = { energy: this._energyNormal };
			this.costs = { energy: this._energyNormal };
		}

		ability.end();

		var effects = [
			new Effect(
				"Slow Down", ability.creature, hex, "onStepIn",
				{
					requireFn: function() {
						if (!this.trap.hex.creature) return false;
						return this.trap.hex.creature.type != "A1";
					},
					effectFn: function(effect, crea) {
						crea.remainingMove--;
					},
				}
			),
		];


		hex.createTrap("mud-bath", effects, ability.creature.player);

		// Trigger trap immediately if on self
		if (isSelf) {
			// onCreatureMove is Spa Goggles' trigger event
			G.triggersFn.onCreatureMove(swine, hex);
		}

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
	// Type : Can be "onQuery", "onStartPhase", "onDamage"
	triggerFunc: function() {
		if (this.isUpgraded()) {
			return "onUnderAttack onAttack";
		}
		return "onUnderAttack";
	},

	priority : 10,

	// require() :
	require : function(damage) {
		if( !this.testRequirements() ) return false;

		// Check that attack is melee from actual creature, not from trap
		if (damage && damage.melee !== undefined) {
			return damage.melee && !damage.isFromTrap;
		}
		// Always return true so that ability is highlighted in UI
		return true;
	},

	// activate() :
	activate: function(damage) {
		var ability = this;
		var creature = this.creature;

		if (!damage || !damage.melee) return;

		// ability may trigger both onAttack and onUnderAttack;
		// the target should be the other creature
		var target = damage.attacker === creature ? damage.target : damage.attacker;

		var optArg = {
			alterations : ability.effects[0],
			creationTurn : G.turn-1,
			stackable : true
		};

		ability.end();

		// Spore Contamination
		var effect = new Effect(
			ability.title, // Name
			creature, // Caster
			target, // Target
			"", // Trigger
			optArg // Optional arguments
		);

		target.addEffect(effect, undefined, "Contaminated");

		G.log("%CreatureName" + target.id + "%'s regrowth is lowered by " + ability.effects[0].regrowth);

		ability.setUsed(false); // Infinite triggering
	},
},



//	Second Ability: Supper Chomp
{
	// Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	_targetTeam: Team.enemy,

	// require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		// At least one target
		if (!this.atLeastOneTarget(
				this.creature.getHexMap(frontnback2hex), { team: this._targetTeam })) {
			return false;
		}
		return true;
	},

	// query() :
	query : function(){
		var uncle = this.creature;
		var ability = this;

		G.grid.queryCreature( {
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			team: this._targetTeam,
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
			ability.damages, // Damage type
			1, // Area
			[]	// Effects
		);

		var dmg = target.takeDamage(damage);

		if (dmg.damageObj.status === "") {

			var amount = Math.max(Math.round(dmg.damages.total / 2), 1);

			// If upgraded, heal immediately up to the amount of health lost so far;
			// use the remainder as regrowth
			if (this.isUpgraded()) {
				var healthLost = this.creature.stats.health - this.creature.health;
				if (healthLost > 0) {
					var healAmount = Math.min(amount, healthLost);
					amount -= healAmount;
					this.creature.heal(healAmount, false);
				}
			}

			// Regrowth bonus
			if (amount > 0) {
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
				), "%CreatureName" + ability.creature.id + "% gained " + amount + " regrowth for now", //Custom Log
				"Regrowth++" );	// Custom Hint
			}
		}

		// Remove frogger bonus if its found
		ability.creature.effects.each(function() {
			if(this.name == "Frogger Bonus") {
				this.deleteEffect();
			}
		});
	},
},



// Third Ability: Frogger Jump
{
	// Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	require: function() {
		// Must be able to move
		if (!this.creature.stats.moveable) {
			this.message = G.msg.abilities.notmoveable;
			return false;
		}
		return this.testRequirements() && this.creature.stats.moveable;
	},

	fnOnSelect : function(hex,args){
		this.creature.tracePosition({
			x: hex.x,
			y: hex.y,
			overlayClass: "creature moveto selected player" + this.creature.team
		});
	},

	// query() :
	query : function() {
		var ability = this;
		var uncle = this.creature;

		// Don't jump over creatures if we're not upgraded, or we are in a second
		// "low" jump
		var stopOnCreature = !this.isUpgraded() || this._isSecondLowJump();
		var hexes = this._getHexRange(stopOnCreature);

		G.grid.queryHexs({
			fnOnSelect : function() { ability.fnOnSelect.apply(ability, arguments); },
			fnOnConfirm : function() {
				if( arguments[0].x == ability.creature.x && arguments[0].y == ability.creature.y ) {
					// Prevent null movement
					ability.query();
					return;
				}
				ability.animation.apply(ability, arguments);
			},
			size :  uncle.size,
			flipped :  uncle.player.flipped,
			id :  uncle.id,
			hexs : hexes,
			hexesDashed: [],
			hideNonTarget : true
		});
	},


	// activate() :
	activate : function(hex, args) {

		var ability = this;
		ability.end(false,true); // Defered ending

		// If upgraded and we haven't leapt over creatures/obstacles, allow a second
		// jump of the same kind
		if (this.isUpgraded() && !this._isSecondLowJump()) {
			// Check if we've leapt over creatures by finding all "low" jumps (jumps
			// not over creatures), and finding whether this jump was a "low" one
			var lowJumpHexes = this._getHexRange(true);
			var isLowJump = false;
			for (var i = 0; i < lowJumpHexes.length; i++) {
				if (lowJumpHexes[i].x === hex.x && lowJumpHexes[i].y === hex.y) {
					isLowJump = true;
				}
			}
			if (isLowJump) {
				this.setUsed(false);
			}
		}

		// Jump directly to hex
		ability.creature.moveTo(hex, {
			ignoreMovementPoint: true,
			ignorePath: true,
			callback : function() {
				G.triggersFn.onStepIn(ability.creature,ability.creature.hexagons[0]);

				var interval = setInterval(function() {
					if(!G.freezedInput) {
						clearInterval(interval);
						G.UI.selectAbility(-1);
						G.activeCreature.queryMove();
					}
				}, 100);
			}
		});

		// Frogger Leap bonus
		ability.creature.addEffect( new Effect(
			"Offense Bonus", // Name
			ability.creature, // Caster
			ability.creature, // Target
			"onStepIn onEndPhase", // Trigger
			{
				effectFn : function(effect,crea) {
					effect.deleteEffect();
				},
				alterations : ability.effects[0]
			} // Optional arguments
		) );
	},

	_getHexRange: function(stopOnCreature) {
		// Get the hex range of this ability
		var uncle = this.creature;
		var forward = G.grid.getHexMap(uncle.x, uncle.y, 0, false, straitrow);
		forward = forward.filterCreature(false, stopOnCreature, uncle.id);
		var backward = G.grid.getHexMap(uncle.x, uncle.y, 0, true, straitrow);
		backward = backward.filterCreature(false, stopOnCreature, uncle.id);
		// Combine and sort by X, left to right
		var hexes = forward.concat(backward).sort(function(a, b) {
			return a.x - b.x;
		});
		// Filter out any hexes that cannot accomodate the creature's size
		var run = 0;
		for (var i = 0; i < hexes.length; i++) {
			if (i === 0 || hexes[i-1].x + 1 === hexes[i].x) {
				run++;
			} else {
				if (run < this.creature.size) {
					hexes.splice(i - run, run);
					i -= run;
				}
				run = 1;
			}
		}
		if (run < this.creature.size) {
			hexes.splice(hexes.length - run, run);
		}
		return hexes;
	},

	_isSecondLowJump: function() {
		return this.timesUsedThisTurn === 1;
	}
},



// Fourth Ability: Sabre Kick
{
	// Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	_targetTeam: Team.enemy,

	// require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		var map = G.grid.getHexMap(this.creature.x-2, this.creature.y-2, 0, false, frontnback2hex);
		// At least one target
		if (!this.atLeastOneTarget(map, { team: this._targetTeam })) {
			return false;
		}
		return true;
	},

	// query() :
	query : function() {
		var ability = this;
		var uncle = this.creature;

		G.grid.queryCreature( {
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			team: this._targetTeam,
			id : uncle.id,
			flipped : uncle.flipped,
			hexs : G.grid.getHexMap(uncle.x-2, uncle.y-2, 0, false, frontnback2hex),
		});
	},


	// activate() :
	activate : function(target, args) {
		var ability = this;
		ability.end();

		var damage = new Damage(
			ability.creature, // Attacker
			ability.damages, // Damage Type
			1, // Area
			[]	// Effects
		);
		var result = target.takeDamage(damage);

		// If upgraded, knock back target by 1 hex
		if (this.isUpgraded() && !result.kill) {
			var dx = target.x - this.creature.x;
			var dy = target.y - this.creature.y;
			var dir = getDirectionFromDelta(target.y, dx, dy);
			var hexes = G.grid.getHexLine(target.x, target.y, dir, target.flipped);
			// The hex to knock back into is the second hex since the first is where
			// they are currently
			if (hexes.length >= 2 &&
					hexes[1].isWalkable(target.size, target.id, true)) {
				target.moveTo(hexes[1], {
					callback : function() {
						G.activeCreature.queryMove();
					},
					ignoreMovementPoint: true,
					ignorePath: true,
					overrideSpeed: 500, // Custom speed for knockback
					animation: "push"
				});
			}
		}

		// Remove Frogger Jump bonus if its found
		ability.creature.effects.each(function() {
			if(this.name == "Offense Bonus") {
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
