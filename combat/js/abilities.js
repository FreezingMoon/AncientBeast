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


	/* 	use()
	*
	*	Test and use the ability
	*
	*/
	use: function(){
		if( this.trigger != "onQuery" ) return;
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
		hexs.each(function(){//For each hex
			if( (this.creature != 0) ){ //this.creature refers to hex creature not ability one
				if( targets[this.creature] == undefined ) {
					targets[this.creature] = {
						hexsHit : 0,
						target : G.creatures[this.creature]
					};
				}
				targets[this.creature].hexsHit += 1; //creature has been found
			}
		});
		return targets;
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
	*	type : 			String : 	Can be "target","zone" or "effect"
	* 	damages : 		Object : 	Object containing the damage by type {frost : 5} for example
	*	area : 			Integer : 	Number of hex hit
	*	effects : 		Array : 	Array containing Effect object to apply to the target
	*/
	initialize: function(attacker,type,damages,area,effects){
		this.attacker 	= attacker;
		this.type 		= type;
		this.damages 	= damages;
		this.effects 	= effects;
		this.area 		= area;
		this.dodged 	= false;
	},

	/* apply(target)
	*
	*	target : 	Creature : 	Targeted creature
	*/
	apply: function(target){
		var trg = target.stats;
		var dmg = this;
		var atk = dmg.attacker.stats;
		var dmgTotal = 0;

		//DAMAGE CALCULATION
		$j.each(this.damages,function(key,value){
			dmgTotal += Math.round(value * (1 + (atk.offense - trg.defense / dmg.area + atk[key] - trg[key] )/100));
		});

		return dmgTotal;
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