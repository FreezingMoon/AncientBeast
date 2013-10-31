/*
*
*	Golden Wyrm abilities
*
*/
abilities[33] =[

// 	First Ability: Percussion Spear
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onStepIn onStartPhase",

	// 	require() :
	require : function(){
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
					effectFn : function(effect,crea){
						var nearFungus = false;
						crea.adjacentHexs(1).each(function(){
							if(trg.creature instanceof Creature){
								if(G.creatures[trg.creature] === effect.owner)
									nearFungus = true;
							}
						});

						if(!nearFungus){
							for (var i = 0; i < crea.effects.length; i++) {
								if(crea.effects[i].name == "Contaminated"){
									crea.effects[i].deleteEffect();
									break;
								}
							}
						}
					},
					alterations : {regrowth : -5},
					turn : G.turn,
				};

				//Spore Contamination
				var effect = new Effect(
					"Contaminated", //Name
					creature, //Caster
					trg, //Target
					"onStartPhase", //Trigger
					optArg //Optional arguments
				);

				var validTarget = true;
				trg.effects.each(function(){
					if(this.name == "Contaminated"){
						if(this.turn == G.turn)
							validTarget = false;
					}
				});

				if(validTarget){
					trg.addEffect(effect);
				}
			}
		})
	},
},



// 	Second Ability: Executioner Axe
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		slash : 40,
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
		var wyrm = this.creature;
		var ability = this;

		var map = [  [0,0,0,0],
					[0,1,0,1],
				 	 [1,0,0,1], //origin line
					[0,1,0,1]];

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //Team, 0 = ennemies
			id : wyrm.id,
			flipped : wyrm.flipped,
			hexs : G.grid.getHexMap(wyrm.x-2,wyrm.y-2,0,false,map),
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



// 	Third Ability: Dragon Flight
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
		var wyrm = this.creature;

		var range = G.grid.getFlyingRange(wyrm.x,wyrm.y,50,wyrm.size,wyrm.id);
		range.filter(function(){ return wyrm.y == this.y; });

		G.grid.queryHexs({
			fnOnSelect : function(){ ability.fnOnSelect.apply(ability,arguments); },
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			size :  wyrm.size,
			flipped :  wyrm.player.flipped,
			id :  wyrm.id,
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
				G.activeCreature.queryMove();
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



// 	Fourth Ability: Battle Cry
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
		var wyrm = this.creature;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //Team, 0 = ennemies
			id : wyrm.id,
			flipped : wyrm.flipped,
			hexs : G.grid.getHexMap(wyrm.x-2,wyrm.y-2,0,false,frontnback2hex),
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
