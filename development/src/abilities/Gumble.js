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
		var healthBonusDivisor = this.isUpgraded() ? 5 : 10;
		var bonus = Math.floor(this.creature.health / healthBonusDivisor);
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
			"Gooey Body",		// name
			this.creature,	// Caster
			this.creature,	// Target
			"",							// Trigger
			{
				alterations: alterations,
				deleteTrigger: "",
				stackable: false,
				noLog: noLog
			}
		));
		if (!noLog) {
			G.log("%CreatureName" + this.creature.id + "%'s pierce, slash and crush are buffed by " + bonus);
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
				this.creature.x+1+dx, this.creature.y-2+dy, 0, false, area),	// up-right
			G.grid.getHexMap(
				this.creature.x+2+dx, this.creature.y+dy, 0, false, area),	// front
			G.grid.getHexMap(
				this.creature.x+1+dx, this.creature.y+2+dy, 0, false, area),	// down-right
			G.grid.getHexMap(
				this.creature.x-1+dx, this.creature.y+2+dy, 0, false, area),	// down-left
			G.grid.getHexMap(
				this.creature.x-2+dx, this.creature.y+dy, 0, false, area),	// back
			G.grid.getHexMap(
				this.creature.x-1+dx, this.creature.y-2+dy, 0, false, area),	// up-left
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
			team: "both",
			id: this.creature.id,
			requireCreature: false,
			choices: choices
		});
	},

	activate: function(hexes, args) {
		var ability = this;
		ability.end();

		ability.areaDamage(
			ability.creature, //Attacker
			ability.damages, //Damage Type
			[],	//Effects
			ability.getTargets(hexes) //Targets
		);
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

		var hexes = creature.hexagons;
		var showConfirm = true;
		if (this.isUpgraded()) {
			// Upgraded Royal Seal can target up to 4 hexes range
			hexes = creature.hexagons[0].adjacentHex(4);
			showConfirm = false;
		}
		// If we can only target one hex (unupgraded) then show a confirm hint
		if (showConfirm) {
			creature.hint("Confirm", "confirm constant");
		}

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

		var effect = new Effect(
			"Royal Seal", this.creature, hex, "onStepIn",
			{
				requireFn: function(crea) { return crea !== this.owner; },
				effectFn: function(effect, crea) {
					crea.remainingMove = 0;
					this.trap.destroy();
				},
			}
		);

		var trap = hex.createTrap("royal-seal", [effect], this.creature.player);
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
