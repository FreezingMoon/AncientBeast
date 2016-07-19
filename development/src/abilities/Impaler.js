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

	// 	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if (!this.atLeastOneTarget(this._getHexes(), "enemy")) {
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

	// 	require() :
	require : function() {
		if (!this.atLeastOneTarget(this._getHexes(), "enemy")) {
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
			team: 0, // Team, 0 = enemies
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
		target.addEffect(new Effect(
			this.title,
			this.creature,
			target,
			"onStepOut onAttack",
			{
				effectFn: function(effect) {
					G.log("%CreatureName" + effect.target.id + "% is hit by " + effect.name);
					effect.target.takeDamage(new Damage(effect.owner, damages, 1, []));
					effect.deleteEffect();
				},
				turnLifetime: lifetime,
				deleteTrigger: "onEndPhase"
			}
		));
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

	require: function() {
		if (!this.testRequirements()) return false;
		if (!this.atLeastOneTarget(this._getHexes(), "both")) {
			return false;
		}
		return true;
	},

	//	query() :
	query : function(){
		var ability = this;

		G.grid.queryCreature( {
			fnOnConfirm: function() { ability.animation.apply(ability, arguments); },
			team: 3, // Team, 3 = both
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
			if (this.isUpgraded() && this.creature.isAlly(trg.team)) {
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
