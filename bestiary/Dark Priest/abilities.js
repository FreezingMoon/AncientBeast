/*
*
*	Dark Priest abilities
*
*/
abilities["0"] =[

// 	First Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Plasma Shield",

	//	Description
	desc : "The shield protects from any harm.",

	//	activate() : 
	activate : function() {
	},
},



// 	Second Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Disintegrate",

	//	Description
	desc : "Turns any nearby foe into a pile of dust by using plasma in exchange.",

	//	activate() : 
	activate : function() {
	},
},



// 	Third Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Materialize",

	//	Description
	desc : "Summons a creature right in front.",

	//	activate() : 
	activate : function() {
		var pos = (this.creature.player.fliped)? 
		{
			x:this.creature.x-1,
			y:this.creature.y
		} : 
		{
			x:this.creature.x+3,
			y:this.creature.y
		};

		this.creature.player.summon("L2",pos);
		G.activeCreature.weightAll(); 
	},
},



// 	Fourth Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Energize",

	//	Description
	desc : "Satellite beams down a creature to any specified non-occupied location.",

	//	activate() : 
	activate : function() {
	},
}

];