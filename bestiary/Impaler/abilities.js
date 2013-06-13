/*
*
*	Impaler abilities
*
*/
abilities[5] =[

// 	First Ability: Electrified Hair
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onDamage", //Just for display purpose the effect is in 2nd Ability

	// 	require() :
	require : function(){return this.testRequirements();},

	// 	require() :
	require : function(damage){
		this.setUsed(false); //Can be triggered as many times
		if( this.creature.electrifiedHair == 100 ) return false;
		return this.testRequirements();
	},

	//	activate() : 
	activate : function(damage) {
		if(!(this.creature.electrifiedHair+1)) this.creature.electrifiedHair = 0;
		var capacity = 100-this.creature.electrifiedHair;
		if(damage.damages.shock){
			if(damage.damages.shock>0){
				this.creature.electrifiedHair += (damage.damages.shock/2>capacity)
				? capacity
				: damage.damages.shock/2;
				damage.damages.shock = (damage.damages.shock/2>capacity)
				? damage.damages.shock-capacity
				: damage.damages.shock/2;
			}
		}
		this.end();
		return damage; //Return Damage
	},
},



// 	Second Ability: Deadly Jab
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		pierce : 20
	},

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( G.grid.getHexMap(this.creature.x-3,this.creature.y-2,0,false,frontnback3hex),"ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		
		var ability = this;
		var creature = this.creature;

		G.grid.queryCreature({
			fnOnConfirm : ability.activate, //fnOnConfirm
			team : 0, //Team, 0 = ennemies
			id : creature.id,
			flipped : creature.flipped,
			hexs : G.grid.getHexMap(creature.x-3,creature.y-2,0,false,frontnback3hex),
			args : {creature:creature, ability: ability}
		});
	},


	//	activate() : 
	activate : function(target,args) {
		var ability = args.ability;
		ability.end();

		var finalDmg = $j.extend({ poison:0, shock:0 },ability.damages); //Copy object

		//Poison Bonus
		args.creature.effects.each(function(){
			if(this.trigger == "poisonous_vine_perm"){
				finalDmg.poison += 1;
			}else if(this.trigger == "poisonous_vine"){
				finalDmg.poison += 20;
			}
		});

		//Jab Bonus
		finalDmg.pierce += ability.creature.travelDist*2;

		//Electrified Hair Bonus
		if(ability.creature.electrifiedHair){
			if(ability.creature.electrifiedHair>25){
				finalDmg.shock += 25;
				ability.creature.electrifiedHair -= 25;
			}else if(ability.creature.electrifiedHair>0){
				finalDmg.shock += ability.creature.electrifiedHair;
				ability.creature.electrifiedHair = 0;
			}
		}

		var damage = new Damage(
			args.creature, //Attacker
			"target", //Attack Type
			finalDmg, //Damage Type
			1, //Area
			[] //Effects
		)
		target.takeDamage(damage);
	},
},



// 	Thirt Ability: Poisonous Vine
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){return this.testRequirements();},

	// 	query() :
	query : function(){
		this.activate()
	},


	//	activate() : 
	activate : function() {
		this.end();
		var effect = new Effect("Poisonous Vine",this.creature,this.creature,"poisonous_vine",{
			turnLifetime : 1,
		});
		this.creature.addEffect(effect);

		var effect = new Effect("",this.creature,this.creature,"poisonous_vine_perm",{
		});
		this.creature.addEffect(effect);
		//TODO add animation
	},
},



// 	Fourth Ability: Super Slash
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		return true;
	},

	damages : {
		slash : 20, 
		frost : 10
	},

	map : [  [0,0,0,0],
			[0,1,0,0],
			 [0,1,0,0],//origin line
			[0,1,0,0],
			 [0,0,0,0]],

	// 	query() :
	query : function(){
		var ability = this;

		G.grid.queryChoice({
			fnOnConfirm : ability.activate,
			team : 3, 
			requireCreature : 0,
			id : this.creature.id,
			args : {creature:this.creature, ability:ability},
			flipped : this.creature.flipped,
			choices : [
				G.grid.getHexMap(this.creature.x,this.creature.y-2,0,false,this.map),
				G.grid.getHexMap(this.creature.x-this.creature.size+1,this.creature.y-2,0,true,this.map)
			],
		})
	},


	//	activate() : 
	activate : function(hexs,args) {
		var ability = args.ability;
		ability.end();

		var targets = ability.getTargets(hexs);

		targets.each(function(){
			if(this != window){

				var finalDmg = $j.extend({ poison:0, shock:0 },ability.damages); //Copy object

				//Poison Bonus
				args.creature.effects.each(function(){
					if(this.trigger == "poisonous_vine_perm"){
						finalDmg.poison += 1;
					}else if(this.trigger == "poisonous_vine"){
						finalDmg.poison += 20;
					}
				});

				//Electrified Hair Bonus
				if(ability.creature.electrifiedHair){
					if(ability.creature.electrifiedHair>25){
						finalDmg.shock += 25;
						ability.creature.electrifiedHair -= 25;
					}else if(ability.creature.electrifiedHair>0){
						finalDmg.shock += ability.creature.electrifiedHair;
						ability.creature.electrifiedHair = 0;
					}
				}

				var damage = new Damage(
					args.creature, //Attacker
					"target", //Attack Type
					finalDmg, //Damage Type
					1, //Area
					[] //Effects
				)
				this.target.takeDamage(damage);
			}
		});
	},
}

];
