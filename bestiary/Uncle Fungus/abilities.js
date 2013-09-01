/*
*
*	Uncle Fungus abilities
*
*/
abilities[3] =[

// 	First Ability: Spore Contamination
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onStepIn onStartPhase onOtherStepIn",

	// 	require() :
	require : function(hex){
		if( hex != this.creature.hexagons[0] && this.creature.adjacentHexs(1).indexOf(hex) == -1 ) return false;
		return this.testRequirements();
	},

	//	activate() : 
	activate : function() {
		var creature = this.creature;
		var targets = this.getTargets(this.creature.adjacentHexs(1));

		if( this.atLeastOneTarget( this.creature.adjacentHexs(1),"ennemy" ) ){
			this.end();
			this.setUsed(false); //Infinite triggering
		}else{
			return false;
		}

		targets.each(function(){
			if( !(this.target instanceof Creature) ) return;

			var trg = this.target;

			if(trg.team%2 != creature.team%2){ //If Foe

				var optArg = { 
					alterations : {regrowth : -5},
					creationTurn : G.turn-1,
					turnLifetime : 1,
					deleteTrigger : "onEndPhase"
				};

				//Spore Contamination
				var effect = new Effect(
					"Contaminated", //Name
					creature, //Caster
					trg, //Target
					"", //Trigger
					optArg //Optional arguments
				);

				if( trg.findEffect("Contaminated").length == 0 ){
					trg.addEffect(effect);
				}
			}
		})
	},
},



// 	Second Ability: Supper Chomp
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		pierce : 20,
	},

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		//At least one target
		if( !this.atLeastOneTarget(this.creature.adjacentHexs(1),"ennemy") ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var uncle = this.creature;
		var ability = this;

		var map = [  [0,0,0,0],
					[0,1,0,1],
				 	 [1,0,0,1], //origin line
					[0,1,0,1]];

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //Team, 0 = ennemies
			id : uncle.id,
			flipped : uncle.flipped,
			hexs : G.grid.getHexMap(uncle.x-2,uncle.y-2,0,false,map),
		});
	},


	//	activate() : 
	activate : function(target,args) {
		var ability = this;
		ability.end();

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);

		var dmg = target.takeDamage(damage);

		if(dmg.status == ""){
			//Regrowth bonus
			ability.creature.addEffect( new Effect(
				"Regrowth++", //Name
				ability.creature, //Caster
				ability.creature, //Target
				"onStartPhase", //Trigger
				{	
					effectFn : function(effect,crea){
						effect.deleteEffect();
					},
					alterations : {regrowth : Math.round(dmg.damages.total/4)}
				} //Optional arguments
			) );
		}

		//remove frogger bonus if its found
		ability.creature.effects.each(function(){
			if(this.name == "Frogger Bonus"){
				this.deleteEffect();
			}
		});
	},
},



// 	Third Ability: Frogger Jump
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	require : function(){return this.testRequirements();},

	fnOnSelect : function(hex,args){
		this.creature.tracePosition({ x: hex.x, y: hex.y, overlayClass: "creature moveto selected player"+this.creature.team })
	},

	// 	query() :
	query : function(){
		var ability = this;
		var uncle = this.creature;

		var range = G.grid.getFlyingRange(uncle.x,uncle.y,50,uncle.size,uncle.id);
		range.filter(function(){ return uncle.y == this.y; });

		G.grid.queryHexs({
			fnOnSelect : function(){ ability.fnOnSelect.apply(ability,arguments); },
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			size :  uncle.size,
			flipped :  uncle.player.flipped,
			id :  uncle.id,
			hexs : range,
		});
	},


	//	activate() : 
	activate : function(hex,args) {
		var ability = this;
		ability.end();

		ability.creature.moveTo(hex,{
			ignoreMovementPoint : true,
			ignorePath : true,
			callback : function(){
				G.triggersFn.onStepIn(ability.creature,ability.creature.hexagons[0]);

				var interval = setInterval(function(){
					if(!G.freezedInput){
						clearInterval(interval);
						G.activeCreature.queryMove();
					}
				},100)				
			},
		}); 

		//Frogger Leap bonus
		ability.creature.addEffect( new Effect(
			"Offense++", //Name
			ability.creature, //Caster
			ability.creature, //Target
			"onStepIn onEndPhase", //Trigger
			{	
				effectFn : function(effect,crea){
					effect.deleteEffect();
				},
				alterations : {offense : 25}
			} //Optional arguments
		) );
	},
},



// 	Fourth Ability: Blade Kick
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		pierce : 15,
		slash : 10,
		crush : 5,
	},

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		var map = G.grid.getHexMap(this.creature.x-2,this.creature.y-2,0,false,frontnback2hex);
		//At least one target
		if( !this.atLeastOneTarget(map,"ennemy") ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;
		var uncle = this.creature;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //Team, 0 = ennemies
			id : uncle.id,
			flipped : uncle.flipped,
			hexs : G.grid.getHexMap(uncle.x-2,uncle.y-2,0,false,frontnback2hex),
		});
	},


	//	activate() : 
	activate : function(target,args) {
		var ability = this;
		ability.end();

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);
		target.takeDamage(damage);

		//remove frogger bonus if its found
		ability.creature.effects.each(function(){
			if(this.name == "Offense++"){
				this.deleteEffect();
			}
		});
	},
}
];
