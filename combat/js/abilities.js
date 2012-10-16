/*	Ability Class
*
*	Class parsing function from creature abilities
*
*/
var Ability = Class.create({
	initialize: function(creature,abilityID){
		this.creature = creature;
		this.used = false;
		this.id = abilityID;
		$j.extend(this,abilities[creature.type][abilityID]);
	},


	/* 	user()
	*
	*	Test and use the ability
	*
	*/
	use: function(){
		if(this.used == true){ G.log("Ability already used!"); return; }

		G.log("Player"+this.creature.team+"'s "+this.creature.name+" uses "+this.title);
		this.activate();

		this.used = true; //Should always be here
	},


	/* 	getTargets(hexs)
	*
	*	hexs : 		Array : 	Array containing the targeted hexs
	*
	*	return : 	Array : 	Array containing the targets
	*
	*/
	getTargets: function(hexs){
		var targets = [];
		var targs = []
		hexs.each(function(){//For each hex
			if( (this.creature != 0) && !targets[this.creature] ){ //this.creature refers to hex creature not ability one
				targets[this.creature] = true; //creature has been found
				targs.push(G.creatures[this.creature]); //add to return array
			}
		});
		return targs;
	},
});



abilities = []; //array containing all javascript methods for abilities