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
	},
},



// 	Second Ability: Power Bat
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
			// For unupgraded ability, this is only 1 hex
			// For upgraded, as long as the target is over a mud tile, keep pushing
			// them back
			var x = target.x;
			var y = target.y;
			var xLast = ability.creature.x;
			var yLast = ability.creature.y;
			var movementPoints = 0;
			while(true) {
				// Knock the target in the opposite direction of the attacker
				var dx = x - xLast;
				var dy = y - yLast;
				// Hex grid corrections
				if(dy !== 0) {
					if(y%2 == 0) {
						// Even row
						dx++;
					} else {
						// Odd row
						dx--;
					}
				}
				// Due to target size, this could be off; limit dx
				if(dx > 1) dx = 1;
				if(dx < -1) dx = -1;
				xLast = x;
				yLast = y;
				// Check that the next knockback hex is valid
				var xNext = x + dx;
				var yNext = y + dy;
				if(yNext < 0 || yNext >= G.grid.hexs.length) break;
				if(xNext < 0 || xNext >= G.grid.hexs[yNext].length) break;
				var hex = G.grid.hexs[yNext][xNext];
				if(!hex.isWalkable(target.size, target.id, true)) break;

				movementPoints++;
				x = xNext;
				y = yNext;

				if(!this.isUpgraded()) break;
				// Check if we are over a mud bath
				// The target must be completely over mud baths to keep sliding
				var mudSlide = true;
				for (var i = 0; i < target.size; i++) {
					hex = G.grid.hexs[y][x-i];
					if(!hex.trap || hex.trap.type !== "mud-bath") {
						mudSlide = false;
						break;
					}
				}
				if (!mudSlide) break;
			}
			if(x !== target.x || y !== target.y) {
				target.moveTo(G.grid.hexs[y][x], {
					ignoreMovementPoint : true,
					ignorePath : true,
					customMovementPoint: movementPoints,	// Ignore target's movement points
					callback : function() {
						G.activeCreature.queryMove();
					},
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
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	require : function() {
		// If upgraded, self cost is less
		if (this.isUpgraded()) {
			this.requirements = { energy: 10 };
			this.costs = { energy: 10 };
		}else{
			this.requirements = { energy: 30 };
			this.costs = { energy: 30 };
		}
		return this.testRequirements();
	},

	// 	query() :
	query : function() {

		var ability = this;
		var swine = this.creature;
		var size = 1;

		// Check if we are upgraded; self cost is less so if we only have enough
		// energy to cast on self, restrict range to self
		var selfOnly = this.isUpgraded() && this.creature.energy < 30;

		var hexs;
		if (selfOnly) {
			hexs = [G.grid.hexs[swine.y][swine.x]];
		}else{
			// Gather all the reachable hexs, including the current one
			hexs = G.grid.hexs[swine.y][swine.x].adjacentHex(50, true);
		}

		//TODO: Filtering corpse hexs
		hexs.filter(function() { return true; } );

		G.grid.hideCreatureHexs(this.creature);

		G.grid.queryHexs({
			fnOnCancel : function() { G.activeCreature.queryMove(); G.grid.clearHexViewAlterations(); },
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			hexs : hexs,
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
			this.requirements = { energy: 10 };
			this.costs = { energy: 10 };
		}else{
			this.requirements = { energy: 30 };
			this.costs = { energy: 30 };
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

	},
}

];
