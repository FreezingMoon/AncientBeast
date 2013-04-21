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
		G.UI.selectAbility(this.id);
		return this.query();
	},

	/* 	end()
	*
	*	End the ability. Must be called at the end of each ability function;
	*
	*/
	end: function() {
		if(this.trigger == "onQuery")
			G.activeCreature.queryMove();
			
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
				G.UI.abilitiesButtons[this.id].changeState("disabled");
		}else{
			this.used = false;
			if(this.creature.id == G.activeCreature.id) //avoid dimmed passive for current creature
				G.UI.abilitiesButtons[this.id].changeState("normal");
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
	},

	/* 	atLeastOneTarget(hexs,team)
	*
	*	hexs : 		Array : 	set of hex to test
	*	team : 		String : 	ennemy,ally,both
	*/
	atLeastOneTarget : function(hexs,team){
		var result = false;
		for (var i = 0; i < hexs.length; i++) {
			if(hexs[i].creature>0){
				var crea = G.creatures[hexs[i].creature];
				switch(team){
					case "ally":
						if( this.creature.isAlly(crea.team) ) return true;
						break;
					case "ennemy":
						if( !this.creature.isAlly(crea.team) ) return true;
						break;
					case "both":
						return true;
						break;
				}
			}
		};
		return result;
	},


	/* 	testRequirements()
	*
	*	test the requirement for this abilities. negatives values mean maximum value of the stat
	*	For instance : energy = -5 means energy must be lower than 5.
	*	If one requirement fails it returns false.
	*/
	testRequirements : function(){
		var def = {
			plasma : 0,
			stats : {
				health:0,
				regrowth:0,
				endurance:0,
				energy:0,
				meditation:0,
				initiative:0,
				offense:0,
				defense:0,
				movement:0,
				pierce:0,
				slash:0,
				crush:0,
				shock:0,
				burn:0,
				frost:0,
				poison:0,
				sonic:0,
				mental:0,
			},
		}
		
		var req = $j.extend(def,this.requirements);
		if(req.plasma > 0 ){
			if( this.creature.player.plasma < req.plasma ) return false;
		}else if(req.plasma < 0 ){
			if( this.creature.player.plasma > -req.plasma ) return false;
		}

		$j.each(req.stats,function(key,value) {
			if(value > 0 ){
				if( this.creature.stats[key] < value ) return false;
			}else if(value < 0 ){
				if( this.creature.stats[key] > value ) return false;
			}
		});

		return true;
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
