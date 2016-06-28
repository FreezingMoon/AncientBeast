/*
*
*	Gumble abilities
*
*/
G.abilities[14] =[

// 	First Ability: Gooey Body
{
	require : function() {
		// Always active
		return true;
	},

	activate: function() {
		// Do nothing; ability is passive buff only
	},

	_getModifiedStats: function(stats) {
		// This ability modifies the creature's stats when damage is applied
		// Bonus points to pierce, slash and crush based on remaining health
		var healthBonusDivisor = this.isUpgraded() ? 5 : 10;
		var bonus = Math.floor(stats.health / healthBonusDivisor);
		var statsToApplyBonus = ['pierce', 'slash', 'crush'];
		for (var i = 0; i < statsToApplyBonus.length; i++) {
			var key = statsToApplyBonus[i];
			stats[key] = stats[key] + bonus;
		}
		return stats;
	}
},


// 	Second Ability: Gummy Mallet
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( this.creature.adjacentHexs(1), "enemy" ) ) {
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;
		G.grid.queryCreature( {
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			team : 0, // Team, 0 = enemies
			id : this.creature.id,
			flipped : this.creature.player.flipped,
			hexs : this.creature.adjacentHexs(1),
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
			[] // Effects
		);
		target.takeDamage(damage);
	},
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

		creature.hint("Confirm", "confirm constant");

		G.grid.queryHexs({
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
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
				"Royal Seal", this.creature, hex, "onStepIn",
				{
					requireFn: function(crea) { return crea !== this.owner; },
					effectFn: function(effect, crea) {
						crea.remainingMove = 0;
						this.trap.destroy();
					},
				}
			),
		]

		var trap = hex.createTrap("royal-seal", effects, this.creature.player);
		trap.hide();
	},
},


// 	Fourth Ability: Boom Box
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	directions : [1, 1, 1, 1, 1, 1],

	// 	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		var test = this.testDirection( {
			team : "enemy",
			directions : this.directions,
		});
		if( !test ){
			this.message = G.msg.abilities.notarget;
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
			team : "enemy",
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

		var damage = new Damage(
			ability.creature, // Attacker
			"target", // Attack Type
			d, // Damage Type
			1, // Area
			[] // Effects
		);

		var result = target.takeDamage(damage, true);

		// if( result.kill ) return; // if creature die stop here

		var dir = [];
		switch( args.direction ) {
			case 3: // Upright
				dir = G.grid.getHexMap(ability.creature.x, ability.creature.y-8, 0, ability.creature.flipped, diagonalup).reverse();
				break;
			case 4: // StraitForward
				dir = G.grid.getHexMap(ability.creature.x, ability.creature.y, 0, ability.creature.flipped, straitrow);
				break;
			case 5: // Downright
				dir = G.grid.getHexMap(ability.creature.x, ability.creature.y, 0, ability.creature.flipped, diagonaldown);
				break;
			case 0: // Downleft
				dir = G.grid.getHexMap(ability.creature.x, ability.creature.y, -4, ability.creature.flipped, diagonalup);
				break;
			case 1: // StraitBackward
				dir = G.grid.getHexMap(ability.creature.x, ability.creature.y, 0, !ability.creature.flipped, straitrow);
				break;
			case 2: // Upleft
				dir = G.grid.getHexMap(ability.creature.x, ability.creature.y-8, -4, ability.creature.flipped, diagonaldown).reverse();
				break;
			default:
				break;
		}

		var pushed = false;

		//Recoil
		if(dir.length > 1) {
			if(dir[1].isWalkable(ability.creature.size,ability.creature.id,true)) {
				ability.creature.moveTo(dir[1], {
					ignoreMovementPoint : true,
					ignorePath : true,
					callback : function() {
						if( result.damageObj instanceof Damage )
							G.triggersFn.onDamage(target, result.damageObj);

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
