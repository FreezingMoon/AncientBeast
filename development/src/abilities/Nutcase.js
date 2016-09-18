/*
*
*	Nutcase abilities
*
*/
G.abilities[40] =[

//	First Ability: Tentacle Bush
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	require : function() {
		if( !this.testRequirements() ) return false;
		return true;
	},

	//	query() :
	query : function() {
		var ability = this;
		var creature = this.creature;

		G.grid.querySelf({fnOnConfirm : function(){ ability.animation.apply(ability, arguments); }});
	},


	//	activate() :
	activate : function() {
		var ability = this;
		ability.end();

		var effect = new Effect(
			"Curled", // Name
			ability.creature, // Caster
			ability.creature, // Target
			"onDamage", // Trigger
			{
				alterations : { moveable : false, fatigueImmunity : true },
				turn : G.turn,
				turnLifetime : 1,
				deleteTrigger : "onStartPhase"
			}
		);

		ability.creature.addEffect(effect);
		G.skipTurn({noTooltip: true});
	},
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
				this.creature.getHexMap(frontnback2hex), this._targetTeam)) {
			this.message = G.msg.abilities.notarget;
			return false;
		}

		return true;
	},

	//	query() :
	query : function(){
		var ability = this;

		G.grid.queryCreature( {
			fnOnConfirm : function(){ ability.animation.apply(ability, arguments); },
			team: this._targetTeam,
			id : this.creature.id,
			flipped : this.creature.flipped,
			hexs : this.creature.getHexMap(frontnback2hex)
		});
	},


	//	activate() :
	activate : function(target,args) {
		var ability = this;
		ability.end();

		var effect = new Effect(
			"Hammered", // Name
			ability.creature, // Caster
			target, // Target
			"", // Trigger
			{
				alterations : {movement : -1},
				turnLifetime : 1,
			}
		);

		var damage = new Damage(
			ability.creature, // Attacker
			ability.damages, // Damage Type
			1, // Area
			[effect]	// Effects
		);

		target.takeDamage(damage);
	},
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
		G.grid.queryDirection({
			fnOnConfirm: function() { ability.animation.apply(ability, arguments); },
			team: this._targetTeam,
			id: this.creature.id,
			requireCreature: true,
			sourceCreature: this.creature,
			x: this.creature.x,
			y: this.creature.y,
			directions: this._directions
		});
	},

	//	activate() :
	activate : function(path, args) {
		var ability = this;
		this.end();

		var target = path.last().creature;
		path = path.filterCreature(false, false);
		var destination = path.last();
		if (args.direction === 4) {
			destination =
				G.grid.hexagons[destination.y][destination.x + this.creature.size - 1];
		}

		// Calculate damage, extra damage per hex distance
		var damages = $j.extend({}, this.damages);
		damages.pierce += path.length;
		var damage = new Damage(this.creature, damages, 1, []);

		G.grid.cleanReachable();
		this.creature.moveTo(destination, {
			overrideSpeed: 100,
			customMovementPoint: path.length,
			callback: function() {
				var interval = setInterval(function() {
					if (!G.freezedInput) {
						clearInterval(interval);

						// Deal damage only if we have reached the end of the path
						if (destination.creature === ability.creature) {
							target.takeDamage(damage);
						}

						G.activeCreature.queryMove();
					}
				}, 100);
			},
		});
	}
},

//	Third Ability: Fishing Hook
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	_targetTeam: Team.enemy,

	//	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if (!this.atLeastOneTarget(
				this.creature.getHexMap(inlinefrontnback2hex), this._targetTeam)) {
			this.message = G.msg.abilities.notarget;
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
			hexs : this.creature.getHexMap(inlinefrontnback2hex),
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

		// Swap places
		if( target.size > 2 ) {
			target.takeDamage(damage);
			return;
		}

		var trgIsInfront = (G.grid.getHexMap(crea.x-inlinefront2hex.origin[0], crea.y-inlinefront2hex.origin[1], 0, false, inlinefront2hex)[0].creature == target);

		crea.moveTo(
			G.grid.hexs[target.y][ target.size == 1 && !trgIsInfront ? target.x+1 : target.x ],
			{
				ignorePath: true,
				ignoreMovementPoint: true,
				callback:function() {
					target.updateHex();
					G.grid.updateDisplay();
					target.takeDamage(damage);
				}
			}
		);
		target.moveTo(
			G.grid.hexs[crea.y][ target.size == 1 && trgIsInfront ? crea.x-1 : crea.x ],
			{
				ignorePath: true,
				ignoreMovementPoint: true,
				callback:function(){
					crea.updateHex();
					G.grid.updateDisplay();
					crea.queryMove();
				}
			}
		);
	},
}

];
