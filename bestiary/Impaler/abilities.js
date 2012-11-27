/*
*
*	Magma Spawn abilities
*
*/
abilities["S6"] =[

// 	First Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Armor Penetration",

	//	Description
	desc : "Attacks gradually break through enemy defense.",

	//	activate() : 
	activate : function() {
	},
},



// 	Second Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Jab Attack",

	//	Description
	desc : "A powerful strike with it's javelin-like horn.",

	damages : {
		pierce : 10
	},

	// 	require() :
	require : function(){return true;},

	// 	query() :
	query : function(){
		
		var ability = this;
		var creature = this.creature;

		G.grid.queryCreature(
			ability.activate, //fnOnConfirm
			function(){return true},//fnOptTest
			0, //Team, 0 = ennemies
			1, //Distance
			creature.x,creature.y, //coordinates
			creature.id,
			{creature:creature, ability: ability}
		);
	},


	//	activate() : 
	activate : function(target,args) {
		var ability = args.ability;
		ability.end();

		var damage = new Damage(
			args.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		)
		target.takeDamage(damage);
	},
},



// 	Third Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Static Charge",

	//	Description
	desc : "Shakes hair to create friction and imbue next attack with lightning.",

	//	activate() : 
	activate : function() {
	},
},



// 	Fourth Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Envenom",

	//	Description
	desc : "Makes use of tongue to smear the horn with highly venomous saliva.",

	//	activate() : 
	activate : function() {
	},
}

];