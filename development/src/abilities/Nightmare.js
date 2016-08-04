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

	// 	require() :
	require : function() {
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
				'Frostified',
				this.creature,
				this.creature,
				"",
				{
					alterations: { offense: 5, defense: 5 },
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

	// 	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( this.creature.getHexMap(frontnback2hex), "enemy" ) ) {
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

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( this.creature.getHexMap(frontnback2hex),"enemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //Team, 0 = enemies
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

		if( target.delayable ){
			target.delay();
		}
	},
},



// 	Fourth Ability: Icicle Spear
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	directions : [1,1,1,1,1,1],

	_getDistance: function() {
		// Upgraded ability has infinite range
		return this.isUpgraded() ? 0 : 6;
	},

	require : function(){
		if( !this.testRequirements() ) return false;

		var crea = this.creature;
		var x = (crea.player.flipped) ? crea.x-crea.size+1 : crea.x ;

		var test = this.testDirection({
			team : "both",
			x : x,
			directions : this.directions,
			distance: this._getDistance(),
			stopOnCreature : false
		});

		if( !test ){
			this.message = G.msg.abilities.notarget;
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
			team : "both",
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
