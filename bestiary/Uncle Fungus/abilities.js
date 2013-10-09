/*
*
*	Uncle Fungus abilities
*
*/
abilities[3] =[

// 	First Ability: Toxic Spores
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onStepIn onStartPhase onOtherStepIn",

	priority : 10,

	// 	require() :
	require : function(hex){
		if( !this.atLeastOneTarget( this.creature.adjacentHexs(1),"ennemy" ) ) return false;
		
		if( hex instanceof Hex && hex.creature instanceof Creature && hex.creature != this.creature){

			var targets = this.getTargets(hex.creature.adjacentHexs(1));

			var isAdj = false;

			//Search if uncle is adjacent to the creature that is moving
			for (var i = 0; i < targets.length; i++) {
				if( targets[i] == undefined ) continue;
				if( !(targets[i].target instanceof Creature) ) continue;
				if( targets[i].target == this.creature ) isAdj = true;
			};

			if( !isAdj ) return false;
		}

		var targets = this.getTargets(this.creature.adjacentHexs(1));
		
		for (var i = 0; i < targets.length; i++) {
			if( targets[i] == undefined ) continue;
			if( !(targets[i].target instanceof Creature) ) continue;
			if( !targets[i].target.isAlly(this.creature.team) && targets[i].target.findEffect(this.title).length == 0 )
				return this.testRequirements();
		};

		return false
	},

	//	activate() : 
	activate : function(hex) {

		var ability = this;
		var creature = this.creature;
		var targets = this.getTargets(this.creature.adjacentHexs(1));

		targets.each(function(){
			if( !(this.target instanceof Creature) ) return;

			var trg = this.target;

			if(trg.team%2 != creature.team%2){ //If Foe

				var optArg = { 
					alterations : ability.effects[0],
					creationTurn : G.turn-1,
					turnLifetime : 1,
					deleteTrigger : "onEndPhase",
					stackable : false
				};

				ability.end();

				//Spore Contamination
				var effect = new Effect(
					ability.title, //Name
					creature, //Caster
					trg, //Target
					"", //Trigger
					optArg //Optional arguments
				);

				trg.addEffect(effect,undefined,"Contaminated");

				G.log("%CreatureName"+trg.id+"% regrowth is lowered by "+ability.effects[0].regrowth);

				ability.setUsed(false); //Infinite triggering
			}
		})
	},
},



// 	Second Ability: Supper Chomp
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		//At least one target
		if( !this.atLeastOneTarget(this.creature.getHexMap(frontnback2hex),"ennemy") ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var uncle = this.creature;
		var ability = this;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //Team, 0 = ennemies
			id : uncle.id,
			flipped : uncle.flipped,
			hexs : uncle.getHexMap(frontnback2hex),
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

		if(dmg.damageObj.status == ""){

			var amount = Math.max(Math.round(dmg.damages.total/4),1);
			
			//Regrowth bonus
			ability.creature.addEffect( new Effect(
				ability.title, //Name
				ability.creature, //Caster
				ability.creature, //Target
				"", //Trigger
				{	
					turnLifetime : 1,
					deleteTrigger : "onStartPhase",
					alterations : {regrowth : amount }
				} //Optional arguments
			), "%CreatureName"+ability.creature.id+"% gained "+amount+" temporary regrowth", //Custom Log
			"Regrowth++" );	//Custom Hint
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
			hideNonTarget : true
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
			callbackStepIn : function(hex){
				console.log(ability);
				if(ability.creature.abilities[0].require(hex)){
					ability.creature.abilities[0].activate(hex);
				}
			}
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
				alterations : ability.effects[0]
			} //Optional arguments
		) );
	},
},



// 	Fourth Ability: Blade Kick
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

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
