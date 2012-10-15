//Abilities Class
var Ability = Class.create({
	initialize: function(creature){
		this.creature = creature;
		this.used = false;
	},

	activate: function(){
		if(this.used == true){
			G.log("Ability already used!");
			return false;
		}

		var targets = [];//array of targets' ID

		//Basic Attack all nearby creatures
		this.creature.adjacentHexs(1).each(function(){//For each hex
			if( (this.creature != 0) && !targets[this.creature] ){ //this.creature refers to hex creature not ability one
				targets[this.creature]=this.creature;
				G.creatures[this.creature].takeDamage(5);
			}
		});

		this.used = true;
	},
});