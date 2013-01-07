/*
*
*	Chimera abilities
*
*/
abilities["P6"] =[

// 	First Ability Duality
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "",

	// 	require() :
	require : function(){return true;},

	//	activate() : 
	activate : function() {

	},
},



// 	Second Ability Tooth Fairy
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		pierce : 20,
		slash : 5,
	},

	// 	require() :
	require : function(){return true;},

	// 	query() :
	query : function(){
		var chimera = this.creature;

		var map = [	 [0,0,0,0],
					[0,1,0,1],
					 [1,0,0,1], //origin line
					[0,1,0,1]];

		G.grid.queryCreature({
			fnOnConfirm : this.activate, //fnOnConfirm
			team : 0, //Team, 0 = ennemies
			id : chimera.id,
			flipped : chimera.flipped,
			hexs : G.grid.getHexMap(chimera.x-2,chimera.y-2,0,false,map),
			args : {ability: this}
		});
	},


	//	activate() : 
	activate : function(target,args) {
		var ability = args.ability;
		ability.end();

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);
		target.takeDamage(damage);
	},
},



// 	Third Ability Power Note
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		pierce : 30,
		slash : 10,
	},

	// 	require() :
	require : function(){return true;},

	// 	query() :
	query : function(){
		var chimera = this.creature;

		var map = [	 [0,0,0,0],
					[0,1,0,1],
					 [1,0,0,1], //origin line
					[0,1,0,1]];

		G.grid.queryCreature({
			fnOnConfirm : this.activate, //fnOnConfirm
			team : 0, //Team, 0 = ennemies
			id : chimera.id,
			flipped : chimera.flipped,
			hexs : G.grid.getHexMap(chimera.x-2,chimera.y-2,0,false,map),
			args : {ability: this}
		});
	},


	//	activate() : 
	activate : function(target,args) {
		var ability = args.ability;
		ability.end();

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);
		target.takeDamage(damage);
	},
},



// 	Fourth Ability Chain Lightning
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		poison : 20,
	},

	require : function(){return true;},

	// 	query() :
	query : function(){

	},


	//	activate() : 
	activate : function(path,args) {

	},
}

];