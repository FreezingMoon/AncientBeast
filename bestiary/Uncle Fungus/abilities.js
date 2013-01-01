/*
*
*	Uncle Fungus abilities
*
*/
abilities["G3"] =[

// 	First Ability Frogger
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "",

	// 	require() :
	require : function(){return true;},

	//	activate() : 
	activate : function() {

	},
},



// 	Second Ability Chomp
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
		var uncle = this.creature;

		var map = [	 [0,0,0,0],
					[0,1,0,1],
					 [1,0,0,1], //origin line
					[0,1,0,1]];

		G.grid.queryCreature({
			fnOnConfirm : this.activate, //fnOnConfirm
			team : 0, //Team, 0 = ennemies
			id : uncle.id,
			flipped : uncle.flipped,
			hexs : G.grid.getHexMap(uncle.x-2,uncle.y-2,0,false,map),
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



// 	Third Ability Blade Kick
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
		var uncle = this.creature;

		var map = [	 [0,0,0,0],
					[0,1,0,1],
					 [1,0,0,1], //origin line
					[0,1,0,1]];

		G.grid.queryCreature({
			fnOnConfirm : this.activate, //fnOnConfirm
			team : 0, //Team, 0 = ennemies
			id : uncle.id,
			flipped : uncle.flipped,
			hexs : G.grid.getHexMap(uncle.x-2,uncle.y-2,0,false,map),
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



// 	Fourth Ability Goo Blast
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		poison : 20,
	},

	require : function(){return true;},

	// 	query() :
	query : function(){
		var ability = this;
		var uncle = this.creature;

		var x = (uncle.player.flipped) ? uncle.x-1 : uncle.x ;

		G.grid.queryDirection({
			fnOnConfirm : ability.activate, //fnOnConfirm
			flipped : uncle.player.flipped,
			team : 0, //enemies
			id : uncle.id,
			requireCreature : true,
			x : x,
			y : uncle.y,
			directions : [1,1,1,1,1,1],
			args : {ability: ability}
		});
	},


	//	activate() : 
	activate : function(path,args) {
		var ability = args.ability;
		ability.end();		

		var target = G.creatures[path.last().creature];

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[new Effect("Goo Blast",ability.creature.player,target,"persistant",{
				alterations : { poison: -1, offense : -1, defense : -1 }
			})]	//Effects
		);
		target.takeDamage(damage);
	},
}

];