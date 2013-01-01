/*
*
*	Swine Thug abilities
*
*/
abilities["A1"] =[

// 	First Ability  Spa Mud
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onStepIn",

	// 	require() :
	require : function(hex){
		if(hex.trap){
			if(hex.trap.type == "mud-bath"){ 
				return true; 
			}
		}

		this.creature.effects.each(function(){
			if(this.trigger == "mud-bath")
				this.deleteEffect();
		});
		return false;
	},

	//	activate() : 
	activate : function(hex) {		
		var effect = new Effect("Spa Mud",this.creature,this.creature,"mud-bath",{
			alterations : { regrowth : 5, defense : 5 }
		});
		this.creature.addEffect(effect);
	},
},



// 	Second Ability Power Bat
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		crush : 15
	},

	// 	require() :
	require : function(){return true;},

	// 	query() :
	query : function(){
		
		var ability = this;
		var swine = this.creature;

		G.grid.queryCreature({
			fnOnConfirm : ability.activate, //fnOnConfirm
			team : 0, //Team, 0 = ennemies
			id : swine.id,
			flipped : swine.player.flipped,
			hexs : swine.hexagons[0].adjacentHex(1),
			args : {ability: ability}
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
	},
},



// 	Third Ability Ground Ball
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		burn : 15,
	},

	// 	require() :
	require : function(){return true;},

	// 	query() :
	query : function(){

		var ability = this;
		var swine = this.creature;

		var map = [  [ 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0 ],
					[ 0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1 ]];

		var choices = [
			//Front
			G.grid.getHexMap(swine.x,swine.y-2,0,false,map),
			G.grid.getHexMap(swine.x,swine.y,0,false,straitrow),
			G.grid.getHexMap(swine.x,swine.y,0,false,map),
			//Behind
			G.grid.getHexMap(swine.x,swine.y-2,0,true,map),
			G.grid.getHexMap(swine.x,swine.y,0,true,straitrow),
			G.grid.getHexMap(swine.x,swine.y,0,true,map),
		];

		choices.each(function(){
			this.filterCreature(true,true,swine.id,swine.team);
		});
		
		G.grid.queryChoice({
			fnOnConfirm : ability.activate,
			team : 0, 
			requireCreature : 1,
			id : swine.id,
			args : {creature:swine, ability:ability},
			flipped : swine.flipped,
			choices : choices,
		});
	},


	//	activate() : 
	activate : function(path,args) {
		var ability = args.ability;
		ability.end();

		var target = G.creatures[path.last().creature];

		var damage = new Damage(
			args.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);
		target.takeDamage(damage);
	},
},



// 	Fourth Ability Mud Bath
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	require : function(){return true;},

	// 	query() :
	query : function(){
		
		var ability = this;
		var swine = this.creature;

		var hexs = G.grid.getFlyingRange(swine.x,swine.y,50,1,0);
		//TODO Filtering corpse hexs
		hexs.filter(function(){return true;});

		G.grid.queryHexs({
			fnOnCancel : function(){ G.activeCreature.queryMove() },
			fnOnConfirm : this.activate,
			args : {ability:this}, //OptionalArgs
			hexs : hexs,
		});
	},


	//	activate() : 
	activate : function(hex,args) {
		var ability = args.ability;
		ability.end();

		var effects = [
			new Effect(
				"Slow Down",ability.creature.player,hex,"onStepIn",
				{ 
					effectFn: function(effect,crea){ if( crea.type != "A1" ) crea.remainingMove--; },
				}
			),
		]


		hex.createTrap("mud-bath",effects,ability.creature.player);

	},
}

];