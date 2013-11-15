/*
*
*	Impaler abilities
*
*/
abilities[5] =[

// 	First Ability: Electrified Hair
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onAttack", 

	// 	require() :
	require : function(){return this.testRequirements();},

	// 	require() :
	require : function(damage){
		this.setUsed(false); //Can be triggered as many times
		if( damage == undefined ) damage = { damages: {shock:1} }; //For checking to work

		if( this.creature.electrifiedHair >= this.maxCharge ) return false;
		if( !damage.damages.shock ) return false;
		return this.testRequirements();
	},

	//	activate() : 
	activate : function(damage) {
		if(!(this.creature.electrifiedHair+1)) this.creature.electrifiedHair = 0;
		var capacity = this.maxCharge-this.creature.electrifiedHair;
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

	getCharge : function() {
		return { min : 0 , max : this.maxCharge, value: ( this.creature.electrifiedHair || 0 ) };
	}
},



// 	Second Ability: Deadly Jab
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

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
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //Team, 0 = ennemies
			id : creature.id,
			flipped : creature.flipped,
			hexs : G.grid.getHexMap(creature.x-3,creature.y-2,0,false,frontnback3hex),
		});
	},


	//	activate() : 
	activate : function(target,args) {
		var ability = this;
		ability.end();

		var finalDmg = $j.extend({ poison:0, shock:0 },ability.damages1); //Copy object

		//Poison Bonus
		ability.creature.effects.each(function(){
			if(this.trigger == "poisonous_vine_perm"){
				finalDmg.poison += 1;
			}else if(this.trigger == "poisonous_vine"){
				finalDmg.poison += 5;
			}
		});

		//Jab Bonus
		finalDmg.pierce += ability.creature.travelDist*3;

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

		G.UI.checkAbilities();

		var damage = new Damage(
			ability.creature, //Attacker
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
		var ability = this;
		var creature = this.creature;

		G.grid.querySelf({fnOnConfirm : function(){ ability.animation.apply(ability,arguments); }});
	},


	//	activate() : 
	activate : function() {
		this.end();
		var effect = new Effect("Poisonous",this.creature,this.creature,"poisonous_vine",{
			turnLifetime : 1,
		});
		this.creature.addEffect(effect,"%CreatureName"+this.creature.id+"% gains poison damage");

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

		if( !this.atLeastOneTarget( G.grid.getHexMap(this.creature.x,this.creature.y-2,0,false,this.map).concat( G.grid.getHexMap(this.creature.x-this.creature.size+1,this.creature.y-2,0,true,this.map) ),"ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
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
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 3, 
			requireCreature : 1,
			id : this.creature.id,
			flipped : this.creature.flipped,
			choices : [
				G.grid.getHexMap(this.creature.x,this.creature.y-2,0,false,this.map),
				G.grid.getHexMap(this.creature.x-this.creature.size+1,this.creature.y-2,0,true,this.map)
			],
		})
	},


	//	activate() : 
	activate : function(hexs,args) {
		var ability = this;
		ability.end();

		var targets = ability.getTargets(hexs);

		targets.each(function(){
			if(this != window){

				var finalDmg = $j.extend({ poison:0, shock:0 },ability.damages); //Copy object

				//Poison Bonus
				ability.creature.effects.each(function(){
					if(this.trigger == "poisonous_vine_perm"){
						finalDmg.poison += 1;
					}else if(this.trigger == "poisonous_vine"){
						finalDmg.poison += 5;
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

				G.UI.checkAbilities();

				var damage = new Damage(
					ability.creature, //Attacker
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
