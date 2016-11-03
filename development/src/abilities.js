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
