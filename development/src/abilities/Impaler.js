/*
*
*	Impaler abilities
*
*/
G.abilities[5] =[

// 	First Ability: Electrified Hair
{
	trigger: "onUnderAttack",

	require: function(damage) {
		if (damage === undefined) return false;
		if (!damage.damages.shock) return false;
		return this.testRequirements();
	},

	activate: function(damage) {
		this.end();
		var converted = Math.floor(damage.damages.shock / 4);
		// Lower damage
		damage.damages.shock -= converted;
		// Replenish energy
		this.creature.recharge(converted);
		G.log("%CreatureName" + this.creature.id + "% absorbs " + converted + " shock damage into energy");
		return damage;
	}
},



// 	Second Ability: Hasted Jab
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( G.grid.getHexMap(this.creature.x-3, this.creature.y-2, 0, false, frontnback3hex), "enemy" ) ) {
			this.message = G.msg.abilities.notarget;
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
			team : 0, // Team, 0 = enemies
			id : creature.id,
			flipped : creature.flipped,
			hexs : G.grid.getHexMap(creature.x-3, creature.y-2, 0, false, frontnback3hex),
		});
	},


	//	activate() :
	activate : function(target, args) {
		var ability = this;
		ability.end();

		var finalDmg = $j.extend( { poison: 0, shock: 0 }, ability.damages1); // Copy object

		// Poison Bonus
		ability.creature.effects.each(function() {
			if(this.trigger == "poisonous_vine_perm") {
				finalDmg.poison += 1;
			}else if(this.trigger == "poisonous_vine") {
				finalDmg.poison += 5;
			}
		});

		// Jab Bonus
		finalDmg.pierce += ability.creature.travelDist*5;

		// Electrified Hair Bonus
		if(ability.creature.electrifiedHair) {
			if(ability.creature.electrifiedHair>25) {
				finalDmg.shock += 25;
				ability.creature.electrifiedHair -= 25;
			} else if(ability.creature.electrifiedHair>0) {
				finalDmg.shock += ability.creature.electrifiedHair;
				ability.creature.electrifiedHair = 0;
			}
		}

		G.UI.checkAbilities();

		var damage = new Damage(
			ability.creature, // Attacker
			finalDmg, // Damage Type
			1, // Area
			[] // Effects
		)
		target.takeDamage(damage);
	},
},



// 	Thirt Ability: Poisonous Vine
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function() { return this.testRequirements(); },

	// 	query() :
	query : function() {
		var ability = this;
		var creature = this.creature;

		G.grid.querySelf({fnOnConfirm : function() { ability.animation.apply(ability, arguments); } });
	},


	//	activate() :
	activate : function() {
		this.end();
		var effect = new Effect("Poisonous", this.creature, this.creature, "poisonous_vine", {
			turnLifetime : 1,
		});
		this.creature.addEffect(effect, "%CreatureName" + this.creature.id + "% gains poison damage");

		var effect = new Effect("", this.creature,this.creature, "poisonous_vine_perm", {
		});
		this.creature.addEffect(effect);
		// TODO: Add animation
	},
},



//	Fourth Ability: Chain Lightning
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	directions : [0,1,0,0,1,0],

	require : function() {
		if( !this.testRequirements() ) return false;

		if( !this.testDirection({ team : "both", directions : this.directions }) ) {
			this.message = G.msg.abilities.notarget;
			return false;
		}
		// Duality
		if( this.creature.abilities[0].used ) {
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

		G.grid.queryDirection( {
			fnOnConfirm : function(){ ability.animation.apply(ability, arguments); },
			flipped : chimera.player.flipped,
			team : "both",
			id : chimera.id,
			requireCreature : true,
			x : chimera.x,
			y : chimera.y,
			directions : this.directions,
		});
	},


	//	activate() :
	activate : function(path, args) {
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

			nextTargets.filter(function() {
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
