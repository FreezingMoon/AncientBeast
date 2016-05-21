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

	// 	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( this.creature.adjacentHexs(1), "ennemy" ) ) {
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function() {

		var ability = this;
		var swine = this.creature;

		G.grid.queryCreature( {
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); }, // fnOnConfirm
			team : 0, // Team, 0 = ennemies
			id : swine.id,
			flipped : swine.player.flipped,
			hexs : swine.adjacentHexs(1),
		});
	},


	//	activate() :
	activate : function(target, args) {
		var ability = this;
		ability.end();

		var damage = new Damage(
			ability.creature, // Attacker
			"target", // Attack Type
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

			// Calculate relative direction from creature to target
			var dx = target.x - ability.creature.x;
			var dy = target.y - ability.creature.y;
			// Due to target size, this could be off; limit dx
			if(dx > 1) dx = 1;
			if(dx < -1) dx = -1;
			var dir;
			if (dy === 0) {
				if (dx === 1) {
					dir = 1; // forward
				} else { // dx === -1
					dir = 4; // backward
				}
			} else {
				// Hex grid corrections
				if (target.y % 2 == 0 && dx < 1) {
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
			var hexes = G.grid.getHexLine(target.x, target.y, dir, target.flipped);
			var movementPoints = 0;
			var hex = null;
			// See how far the target can be knocked back
			// Skip the first hex as it is the same hex as the target
			for (var i = 1; i < hexes.length; i++) {
				// Check that the next knockback hex is valid
				if (!hexes[i].isWalkable(target.size, target.id, true)) break;

				movementPoints++;
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
					customMovementPoint: movementPoints, // Ignore target's movement points
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
		if( !this.atLeastOneTarget( hexs, "ennemy" ) ) {
			this.message = G.msg.abilities.notarget;
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
			this.filterCreature(true, true, swine.id, swine.team);
		});

		G.grid.queryChoice( {
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); }, // fnOnConfirm
			team : 0,
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
			G.log("%CreatureName"+target.id+"%'s meditation is lowered by 1");
		}

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
						if(this.trap.hex.creature == 0) return false;
						return (this.trap.hex.creature.type != "A1" && !this.trap.hex.creature.canFly);
					},
					effectFn: function(effect, crea) { crea.remainingMove--; },
				}
			),
		]


		hex.createTrap("mud-bath", effects, ability.creature.player);

		// Trigger trap immediately if on self
		if (isSelf) {
			// onCreatureMove is Spa Goggles' trigger event
			G.triggersFn.onCreatureMove(swine, hex);
		}

	},
}

];
