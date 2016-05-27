/*
*
*	Nightmare abilities
*
*/
G.abilities[9] =[

// 	First Ability: Frozen Tower
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onEndPhase",

	// 	require() :
	require : function() {
		if( this.creature.remainingMove < this.creature.stats.movement ) {
			this.message = "The creature moved this round.";
			return false;
		}
		if( this.creature.findEffect("Frostified").length >= this.maxCharge ) {
			this.message = "Buff limit reached.";
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
					alterations : { offense : 5, defense : 5 }
				}
			)
		);
	},

	getCharge : function() {
		return { min : 0 , max : this.maxCharge, value: this.creature.findEffect("Frostified").length };
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

		var damage = new Damage(
			ability.creature, // Attacker
			"target", // Attack Type
			ability.damages, // Damage Type
			1, //Area
			[
				new Effect(
					'Icy Talons',
					this.creature,
					this.target,
					"",
					{ alterations : { frost : -1 } }
				)
			]	//Effects
		);

		target.takeDamage(damage);
	},
},



// 	Thirt Ability: Tail Uppercut
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

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);

		var result = target.takeDamage(damage);

		if( result.kill == true || result.damageObj.status != "") return;

		if( target.delayable ){
			target.delay();
		}
	},
},



// 	Fourth Ability: Icicle Tongue
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	directions : [1,1,1,1,1,1],

	require : function(){
		if( !this.testRequirements() ) return false;

		var crea = this.creature;
		var x = (crea.player.flipped) ? crea.x-crea.size+1 : crea.x ;

		var test = this.testDirection({
			team : "both",
			x : x,
			directions : this.directions,
			distance : 6,
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

				var d = { pierce : 10, frost : 6-i };

				//Damage
				var damage = new Damage(
					ability.creature, //Attacker
					"target", //Attack Type
					d, //Damage Type
					1, //Area
					[]	//Effects
				);

				var result = trg.takeDamage(damage);

				if( result.damageObj.status == "Shielded" ) return;
			}
		};



	},
}

];
