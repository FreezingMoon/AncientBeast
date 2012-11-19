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
		if( !this.require() ) return;
		if( this.used == true ){ G.log("Ability already used!"); return; }
		return this.query();
	},

	/* 	end()
	*
	*	End the ability. Must be called at the end of each ability function;
	*
	*/
	end: function(){
		if(this.trigger == "onQuery") G.activeCreature.queryMove();

		G.log(this.creature.player.name+"'s "+this.creature.name+" uses "+this.title);
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

/*	
* Damage Class
*/
var Damage = Class.create({

	/* Constructor(amount,type,effects)
	*	
	*	attacker : 		Creature : 	Creature that initiated the damage
	*	amount : 		Integer : 	Amount of damage to deal with
	*	type : 			String : 	Can be "target","zone" or "effect"
	* 	damageType : 	Object : 	Object containing the damage type {frost : 5} for example
	*	effects : 		Array : 	Array containing Effect object to apply to the target
	*/
	initialize: function(attacker,amount,type,damageType,effects){
		this.attacker 	= attacker;
		this.amount 	= amount;
		this.type 		= type;
		this.damageType = damageType;
		this.effects 	= effects;
	},

	/* apply(target)
	*
	*	target : 	Creature : 	Targeted creature
	*/
	apply: function(target){
		//DAMAGE CALCULATION
		target.health -= this.amount;
	},

});


effectId = 0;
/*	
* Effect Class
*/
var Effect = Class.create({

	/* Constructor(owner,parent,trigger,effectFn)
	*	
	*	owner : 		Creature : 	Creature that casted the effect
	*	parent : 		Object : 	Creature or Hex the object that possess the effect
	*	trigger : 		String : 	Event that trigger the effect
	*	effectFn : 		Function : 	Function to trigger
	*/
	initialize: function(owner,parent,trigger,effectFn){
		this.id 		= effectId;
		this.owner 		= owner;
		this.parent 	= parent;
		this.trigger 	= trigger;
		this.effectFn 	= effectFn;
		G.effects.push(this);
		effectId++;
	},

	activate: function(){
		this.effectFn(this);
	},

	deleteEffect: function(){
		var i = this.parent.effects.indexOf(this);
		this.parent.effects.splice(i,1);
		i = G.effects.indexOf(this);
		G.effects.splice(i,1);
	},

});