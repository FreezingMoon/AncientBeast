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

		// Check that attack is melee
		return damage && damage.melee;
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

	// require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		// At least one target
		if( !this.atLeastOneTarget(this.creature.getHexMap(frontnback2hex), "enemy") ) {
			this.message = G.msg.abilities.notarget;
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
			team : 0, // Team, 0 = enemies
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

		if(dmg.damageObj.status == "") {

			var amount = Math.max(Math.round(dmg.damages.total / 4), 1);

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
			), "%CreatureName" + ability.creature.id + "% gained " + amount + " regrowth for now", //Custom Log
			"Regrowth++" );	// Custom Hint
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

	require : function() { return this.testRequirements(); },

	fnOnSelect : function(hex,args){
		this.creature.tracePosition({ x: hex.x, y: hex.y, overlayClass: "creature moveto selected player" + this.creature.team })
	},

	// query() :
	query : function() {
		var ability = this;
		var uncle = this.creature;

		var hexsDashed = [];

		var range = G.grid.allHexs.slice(0); // Copy
		range.filter(function() {
			if(uncle.y == this.y) {
				if(this.creature instanceof Creature && this.creature != uncle){
					hexsDashed.push(this);
					return false;
				}
				return true;
			}
			return false;
		});

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
			hexs : range,
			hexsDashed : hexsDashed,
			hideNonTarget : true
		});
	},


	// activate() :
	activate : function(hex, args) {

		var ability = this;
		ability.end(false,true); // Defered ending

		ability.creature.moveTo(hex, {
			ignoreMovementPoint : true,
			ignorePath : true,
			callback : function() {
				G.triggersFn.onStepIn(ability.creature,ability.creature.hexagons[0]);

				var interval = setInterval(function() {
					if(!G.freezedInput) {
						clearInterval(interval);
						G.UI.selectAbility(-1);
						G.activeCreature.queryMove();
					}
				},100)
			},
			callbackStepIn : function(hex) {
				if(ability.creature.abilities[0].require(hex)) {
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
				effectFn : function(effect,crea) {
					effect.deleteEffect();
				},
				alterations : ability.effects[0]
			} // Optional arguments
		) );
	},
},



// Fourth Ability: Blade Kick
{
	// Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	// require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		var map = G.grid.getHexMap(this.creature.x-2, this.creature.y-2, 0, false, frontnback2hex);
		// At least one target
		if( !this.atLeastOneTarget(map, "enemy") ) {
			this.message = G.msg.abilities.notarget;
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
			team : 0, // Team, 0 = enemies
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
			"target", // Attack Type
			ability.damages, // Damage Type
			1, // Area
			[]	// Effects
		);
		target.takeDamage(damage);

		// Remove frogger bonus if its found
		ability.creature.effects.each(function() {
			if(this.name == "Offense++") {
				this.deleteEffect();
			}
		});
	},
}
];
