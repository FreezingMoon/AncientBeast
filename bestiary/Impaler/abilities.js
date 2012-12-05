/*
*
*	Impaler abilities
*
*/
abilities["S6"] =[

// 	Passive Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "never", //Just for display purpose the effect is in 2nd Ability

	//	Title
	title : "Armor Penetration",

	//	Description
	desc : "Attacks gradually break through enemy defense.",

	// 	require() :
	require : function(){return true;},
},



// 	First Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Jab Attack",

	//	Description
	desc : "Horn attack that does bonus pierce damage based on distance traveled.",

	damages : {
		pierce : 20
	},

	// 	require() :
	require : function(){return true;},

	// 	query() :
	query : function(){
		
		var ability = this;
		var creature = this.creature;

		optionalTest = function(hex,args){
			var creature = args.creature;

			if (creature.player.flipped) {
				if( creature.y % 2 == 0 ){
					var test = ( hex.x < creature.x-creature.size+2 );
				}else{
					var test = ( hex.x < creature.x-creature.size+1 );
				}
			}else{
				if( creature.y % 2 == 0 ){
					var test = ( hex.x > creature.x );
				}else{
					var test = ( hex.x > creature.x-1 );
				}
			}
			return test;
		}

		var x = (creature.player.flipped) ? creature.x-creature.size+1 : creature.x ;

		G.grid.queryCreature({
			fnOnConfirm : ability.activate, //fnOnConfirm
			fnOptTest : optionalTest,//fnOptTest
			team : 0, //Team, 0 = ennemies
			distance : 1, //Distance
			x : x, y : creature.y, //coordinates
			id : creature.id,
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
			{ alterations : {defense : -1} } //Optional arguments
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



// 	Second Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Static Charge",

	//	Description
	desc : "Shakes hair to create friction and imbue next attack with lightning.",

	// 	require() :
	require : function(){return true;},

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



// 	Third Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Envenom",

	//	Description
	desc : "Makes use of tongue to smear the horn with highly venomous saliva.",

	// 	require() :
	require : function(){return true;},

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
