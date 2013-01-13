/*
*
*	Uncle Fungus abilities
*
*/
abilities[3] =[

// 	First Ability Frogger
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onStepIn onStartPhase",

	// 	require() :
	require : function(){return true;},

	//	activate() : 
	activate : function() {
		var creature = this.creature;
		var targets = this.getTargets(this.creature.adjacentHexs(1));

		targets.each(function(){
			if( !(this.target instanceof Creature) ) return;

			var trg = this.target;

			if(trg.team%2 != creature.team%2){ //If Foe

				var optArg = { 
					effectFn : function(effect,crea){
						var nearFongus = false;
						crea.adjacentHexs(1).each(function(){
							if(trg.creature>0){
								if(G.creatures[trg.creature] === effect.owner)
									nearFongus = true;
							}
						});

						if(!nearFongus){
							for (var i = 0; i < crea.effects.length; i++) {
								if(crea.effects[i].name == "Spore Contamination"){
									crea.effects[i].deleteEffect();
									break;
								}
							}
						}
					},
					alterations : {regrowth : -1},
					turn : G.turn,
				};

				//Spore Contamination
				// 2 stack
				var effect1 = new Effect(
					"Spore Contamination", //Name
					creature, //Caster
					trg, //Target
					"onStartPhase", //Trigger
					optArg //Optional arguments
				);
				var effect2 = new Effect(
					"Spore Contamination", //Name
					creature, //Caster
					trg, //Target
					"onStartPhase", //Trigger
					optArg //Optional arguments
				);

				var validTarget = true;
				trg.effects.each(function(){
					if(this.name == "Spore Contamination"){
						if(this.turn == G.turn)
							validTarget = false;
					}
				});

				if(validTarget){ //2 stack
					trg.addEffect(effect1);
					trg.addEffect(effect2);	
				}
			}
		})
	},
},



// 	Second Ability Chomp
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		pierce : 20,
		slash : 5,
	},

	// 	require() :
	require : function(){return true;},

	// 	query() :
	query : function(){
		var uncle = this.creature;

		var map = [	 [0,0,0,0],
					[0,1,0,1],
					 [1,0,0,1], //origin line
					[0,1,0,1]];

		G.grid.queryCreature({
			fnOnConfirm : this.activate, //fnOnConfirm
			team : 0, //Team, 0 = ennemies
			id : uncle.id,
			flipped : uncle.flipped,
			hexs : G.grid.getHexMap(uncle.x-2,uncle.y-2,0,false,map),
			args : {ability: this}
		});
	},


	//	activate() : 
	activate : function(target,args) {
		var ability = args.ability;
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
			if(this.name == "Frogger Bonus"){
				this.deleteEffect();
			}
		});
	},
},



// 	Third Ability Blade Kick
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		pierce : 30,
		slash : 10,
	},

	// 	require() :
	require : function(){return true;},

	// 	query() :
	query : function(){
		var uncle = this.creature;

		var map = [	 [0,0,0,0],
					[0,1,0,1],
					 [1,0,0,1], //origin line
					[0,1,0,1]];

		G.grid.queryCreature({
			fnOnConfirm : this.activate, //fnOnConfirm
			team : 0, //Team, 0 = ennemies
			id : uncle.id,
			flipped : uncle.flipped,
			hexs : G.grid.getHexMap(uncle.x-2,uncle.y-2,0,false,map),
			args : {ability: this}
		});
	},


	//	activate() : 
	activate : function(target,args) {
		var ability = args.ability;
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
			if(this.name == "Frogger Bonus"){
				this.deleteEffect();
			}
		});
	},
},



// 	Fourth Ability Goo Blast
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		poison : 20,
	},

	require : function(){return true;},

	// 	query() :
	query : function(){
		var ability = this;
		var uncle = this.creature;

		var range = G.grid.getFlyingRange(uncle.x,uncle.y,50,uncle.size,uncle.id);
		range.filter(function(){ return uncle.y == this.y; });

		G.grid.queryHexs({
			fnOnSelect : function(hex,args){ args.ability.creature.tracePosition({ x: hex.x, y: hex.y, overlayClass: "creature moveto selected player"+args.ability.creature.team }) },
			fnOnConfirm : this.activate,
			args : {ability: this}, //Optional args
			size :  uncle.size,
			flipped :  uncle.player.flipped,
			id :  uncle.id,
			hexs : range,
		});
	},


	//	activate() : 
	activate : function(hex,args) {
		var ability = args.ability;
		ability.end();

		ability.creature.moveTo(hex,{
			ignoreMovementPoint : true,
			ignorePath : true,
			callback : function(){
				G.activeCreature.queryMove();
			},
		}); 

		//Frogger bonus
		ability.creature.addEffect( new Effect(
			"Frogger Bonus", //Name
			ability.creature, //Caster
			ability.creature, //Target
			"onStepIn onEndPhase", //Trigger
			{	
				effectFn : function(effect,crea){
					effect.deleteEffect();
				},
				alterations : {offense : 30}
			} //Optional arguments
		) );
	},
}

// 	Fourth Ability Goo Blast
// {
// 	//	Type : Can be "onQuery","onStartPhase","onDamage"
// 	trigger : "onQuery",

// 	damages : {
// 		poison : 20,
// 	},

// 	require : function(){return true;},

// 	// 	query() :
// 	query : function(){
// 		var ability = this;
// 		var uncle = this.creature;

// 		var x = (uncle.player.flipped) ? uncle.x-1 : uncle.x ;

// 		G.grid.queryDirection({
// 			fnOnConfirm : ability.activate, //fnOnConfirm
// 			flipped : uncle.player.flipped,
// 			team : 0, //enemies
// 			id : uncle.id,
// 			requireCreature : true,
// 			x : x,
// 			y : uncle.y,
// 			directions : [1,1,1,1,1,1],
// 			args : {ability: ability}
// 		});
// 	},


// 	//	activate() : 
// 	activate : function(path,args) {
// 		var ability = args.ability;
// 		ability.end();		

// 		var target = G.creatures[path.last().creature];

// 		var damage = new Damage(
// 			ability.creature, //Attacker
// 			"target", //Attack Type
// 			ability.damages, //Damage Type
// 			1, //Area
// 			[new Effect("Goo Blast",ability.creature.player,target,"persistant",{
// 				alterations : { poison: -1, offense : -1, defense : -1 }
// 			})]	//Effects
// 		);
// 		target.takeDamage(damage);
// 	},
// }

];