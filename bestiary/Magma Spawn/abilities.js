/*
*
*	Magma Spawn abilities
*
*/
abilities["L2"] =[

// 	First Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Infernal Temper",

	//	Description
	desc : "Bursts into flames when it's turn comes, damaging nearby foes.",

	//	activate() : 
	activate : function() {
		//Basic Attack all nearby creatures
		var targets = this.getTargets(this.creature.adjacentHexs(1));
		targets.each(function(){ this.takeDamage(5) });
	},
},



// 	Second Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Pulverize",

	//	Description
	desc : "Smacks a foe with its heavy hand.",

	//	activate() : 
	activate : function() {
	},
},



// 	Third Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Fissure",

	//	Description
	desc : "Smashes his fists into the ground, wreaking fierce havoc ahead.",

	//	activate() : 
	activate : function() {
	},
},



// 	Fourth Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Molten Hurl",

	//	Description
	desc : "Turns into a molten boulder, bowling itself into first foe in a straight line.",

	//	activate() : 
	activate : function() {
	},
}

];