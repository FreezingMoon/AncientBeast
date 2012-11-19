/*
*
*	Snow Bunny abilities
*
*/
abilities["S1"] =[

// 	First Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onDamage",

	//	Title
	title : "Bunny Hopping",

	//	Description
	desc : "Avoids basic attack by moving to an available adjacent location.",

	// 	require() :
	require : function(damage){
		if(damage.type != "targeted") return false; //Not targeted 
		if(this.creature.remainingMove <= 0) return false; //Not enough move points
		var canDodge = false;
		var creature = this.creature;
		creature.adjacentHexs(1).each(function(){
			canDodge = canDodge || this.isWalkable(creature.id,creature.size,true);
		});
		return canDodge;
	},

	//	activate() : 
	activate : function(damage) {
		var creature = this.creature;
		var dodge = false;
		creature.adjacentHexs(1).each(function(){
			if(dodge) return;
			if(this.isWalkable(creature.id,creature.size,true)){
				creature.moveTo(this);
				dodge = true;
				damage.amount = 0;
				damage.damageType = {};
				damage.effect = [];
			}
		});
		this.end();
		return damage
	},
},



// 	Second Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Big Nip",

	//	Description
	desc : "Dents nearby foe using it's big teeth.",

	damageAmount : 6,

	// 	require() :
	require : function(){return true;},

	// 	query() :
	query : function(){
		
		var ability = this;
		var snowBunny = this.creature;

		G.grid.queryCreature(
			ability.activate, //fnOnConfirm
			function(){return true},//fnOptTest
			0, //Team, 0 = ennemies
			1, //Distance
			snowBunny.x,snowBunny.y, //coordinates
			snowBunny.id,
			{snowBunny:snowBunny, ability: ability}
		);
	},


	//	activate() : 
	activate : function(target,args) {
		var ability = args.ability;
		ability.end();

		var damage = new Damage(
			args.snowBunny, //Attacker
			ability.damageAmount, //Damage Amount
			"target", //Attack Type
			{}, //Damage Type
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
	title : "Blowing Wind",

	//	Description
	desc : "Pushes an inline creature several hexagons backwards, based on size.",

	// 	require() :
	require : function(){return true;},

	//	activate() : 
	activate : function() {
		//TODO
	},
},



// 	Fourth Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Chilling Spit",

	//	Description
	desc : "Spits inline foe with cold saliva. Bonus damage based on distance.",

	// 	require() :
	require : function(){return true;},

	//	activate() : 
	activate : function() {
		//TODO
	},
}

];
