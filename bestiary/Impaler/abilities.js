/*
*
*	Impaler abilities
*
*/
abilities[5] =[

// 	First Ability: Electrified Hair
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "never", //Just for display purpose the effect is in 2nd Ability

	// 	require() :
	require : function(){return this.testRequirements();},
},



// 	Second Ability: Deadly Jab
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		pierce : 20
	},

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( G.grid.getHexMap(this.creature.x-3,this.creature.y-2,0,false,frontnback3hex),"ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		
		var ability = this;
		var creature = this.creature;

		G.grid.queryCreature({
			fnOnConfirm : ability.activate, //fnOnConfirm
			team : 0, //Team, 0 = ennemies
			id : creature.id,
			flipped : creature.flipped,
			hexs : G.grid.getHexMap(creature.x-3,creature.y-2,0,false,frontnback3hex),
			args : {creature:creature, ability: ability}
		});
	},


	//	activate() : 
	activate : function(target,args) {
		var ability = args.ability;
		ability.end();

		var finalDmg = $j.extend({ poison:0, shock:0 },ability.damages); //Copy object

		//Charge Calculation
		args.creature.effects.each(function(){
			if(this.trigger == "impaler_charge"){
				finalDmg.shock += (finalDmg.shock==0) ? 20 : 5 ;
				this.deleteEffect();
			}else if(this.trigger == "impaler_envenom"){
				finalDmg.poison += (finalDmg.poison==0) ? 20 : 5 ;
				this.deleteEffect();
			}
		});

		//Traveling Bonus
		finalDmg.pierce += args.creature.travelDist * 5;

		//Armor Penetration
		var effect = new Effect(
			"Armor Penetration", //Name
			this.creature, //Caster
			target, //Target
			"persistant", //Trigger
			{ alterations : {defense : -2} } //Optional arguments
		);

		var damage = new Damage(
			args.creature, //Attacker
			"target", //Attack Type
			finalDmg, //Damage Type
			1, //Area
			[effect] //Effects
		)
		target.takeDamage(damage);
	},
},



// 	Thirt Ability: Poisonous Vine
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){return this.testRequirements();},

	// 	query() :
	query : function(){
		this.activate()
	},


	//	activate() : 
	activate : function() {
		this.end();
		var effect = new Effect("Static Charge",this.creature,this.creature,"impaler_charge");
		this.creature.addEffect(effect);
		//TODO add animation
	},
},



// 	Fourth Ability: Super Slash
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){return this.testRequirements();},

	// 	query() :
	query : function(){
		this.activate()
	},


	//	activate() : 
	activate : function() {
		this.end();
		var effect = new Effect("Envenom",this.creature,this.creature,"impaler_envenom");
		this.creature.addEffect(effect);
		//TODO add animation
	},
}

];
