/*	Ability Class
*
*	Class parsing function from creature abilities
*
*/
var Ability = Class.create({
	initialize: function(creature,abilityID) {
		this.creature = creature;
		this.used = false;
		this.id = abilityID;
		var datas = G.retreiveCreatureStats(creature.type);
		$j.extend(this,abilities[datas.id][abilityID],datas.ability_info[abilityID]);
	},


	/* 	use()
	*
	*	Test and use the ability
	*
	*/
	use: function() {
		if( this.trigger != "onQuery" ) return;
		if( !this.require() ) return;
		if( this.used == true ){ G.log("Ability already used!"); return; }
		G.grid.clearHexViewAlterations();
		$j("#abilities .ability").removeClass("active");
		$j("#abilities .ability:nth-child("+(this.id+1)+")").addClass("active");
		return this.query();
	},

	/* 	end()
	*
	*	End the ability. Must be called at the end of each ability function;
	*
	*/
	end: function() {
		if(this.trigger == "onQuery") G.activeCreature.queryMove();

		G.log(this.creature.player.name+"'s "+this.creature.name+" uses "+this.title);
		this.setUsed(true) //Should always be here
		G.UI.updateInfos(); //Just in case
	},


	/* 	setUsed(val)
	*	
	*	val : 	Boolean : 	set the used attriute to the desired value
	*	
	*/
	setUsed: function(val) {
		if(val){
			this.used = true;
			if(this.creature.id == G.activeCreature.id) //avoid dimmed passive for current creature
				$j("#abilities .ability:nth-child("+(this.id+1)+")").addClass("used").removeClass("blink");
		}else{
			this.used = false;
			if(this.creature.id == G.activeCreature.id) //avoid dimmed passive for current creature
				$j("#abilities .ability:nth-child("+(this.id+1)+")").removeClass("used blink");
		}
	},


	/* 	getTargets(hexs)
	*
	*	hexs : 		Array : 	Array containing the targeted hexs
	*
	*	return : 	Array : 	Array containing the targets
	*
	*/
	getTargets: function(hexs) {
		var targets = [];
		hexs.each(function(){//For each hex
			if( (this.creature != 0) ) { //this.creature refers to hex creature not ability one
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

	/* 	areaDamages(targets)
	*
	*	targets : 	Array : 	Example : target = [{target:crea1,hexsHit:2},{target:crea2,hexsHit:1}]
	*/
	areaDamage : function(attacker,type,damages,effects,targets) {
		var multiKill = 0;
		for (var i = 0; i < targets.length; i++) {
			if(targets[i]===undefined) continue;
			dmg = new Damage(attacker,type,damages,targets[i].hexsHit,effects)
			multiKill += (targets[i].target.takeDamage(dmg).kill+0);
		};
		if(multiKill>1)	attacker.player.score.push({type:"combo",kills:multiKill});
	}
});



abilities = []; //array containing all javascript methods for abilities

/*	
* Damage Class
*/
var Damage = Class.create({

	/* Constructor(amount,type,effects)
	*	
	*	attacker : 		Creature : 	Creature that initiated the damage
	*	type : 			String : 	Can be "target", "zone" or "effect"
	* 	damages : 		Object : 	Object containing the damage by type {frost : 5} for example
	*	area : 			Integer : 	Number of hex hit
	*	effects : 		Array : 	Array containing Effect object to apply to the target
	*/
	initialize: function(attacker,type,damages,area,effects) {
		this.attacker 	= attacker;
		this.type 	= type;
		this.damages 	= damages;
		this.status 	= "";
		this.effects 	= effects;
		this.area 	= area;
	},

	/* apply(target)
	*
	*	target : 	Creature : 	Targeted creature
	*/
	apply: function(target) {
		var trg = target.stats;
		var dmg = this;
		var atk = dmg.attacker.stats;
		var returnObj = {total:0};

		//DAMAGE CALCULATION
		$j.each(this.damages,function(key,value) {
			if(key=="pure") { //Bypass defense calculation
				var points = value;
			} else {
				var points = Math.round(value * (1 + (atk.offense - trg.defense / dmg.area + atk[key] - trg[key] )/100));
			}
			returnObj[key] = points;
			returnObj.total += points;
		});

		return returnObj;
	},

});


/*	
* Effect Class
*/
var Effect = Class.create({

	/* Constructor(owner,parent,trigger,effectFn)
	*	
	*	owner : 		Creature : 	Creature that casted the effect
	*	target : 		Object : 	Creature or Hex : the object that possess the effect
	*	trigger : 		String : 	Event that trigger the effect
	*	effectFn : 		Function : 	Function to trigger
	*/
	initialize: function(name,owner,target,trigger,optArgs){
		this.id 		= effectId++;

		this.name 		= name;
		this.owner 		= owner;
		this.target 	= target;
		this.trigger 	= trigger;

		var args = $j.extend({
			//Default Arguments
			effectFn : function(){},
			alterations : {}
		},optArgs);

		$j.extend(this,args);

		G.effects.push(this);
	},

	activate: function(arg){
		console.log("Effect "+this.name+" triggered");
		this.effectFn(this,arg);
	},

	deleteEffect: function(){
		var i = this.target.effects.indexOf(this);
		this.target.effects.splice(i,1);
		i = G.effects.indexOf(this);
		G.effects.splice(i,1);
		this.target.updateAlteration();
		console.log("Effect "+this.name+" deleted");
	},

});
