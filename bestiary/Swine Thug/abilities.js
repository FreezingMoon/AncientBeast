/*
*
*	Swine Thug abilities
*
*/
abilities[37] =[

// 	First Ability: Spa Mud
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onCreatureMove",

	// 	require() :
	require : function(hex){
		if( !this.testRequirements() ) return false;

		if(hex == undefined) hex = this.creature.hexagons[0];
		this.message = "";
		if(hex.trap){
			if(hex.trap.type == "mud-bath"){ 
				return true;
			}
		}

		this.message = "Not in a mud bath.";

		this.creature.effects.each(function(){
			if(this.trigger == "mud-bath")
				this.deleteEffect();
		});
		return false;
	},

	//	activate() : 
	activate : function(hex) {		
		var effect = new Effect("Spa Mud",this.creature,this.creature,"mud-bath",{
			alterations : this.effects[0]
		});
		this.creature.addEffect(effect);
	},
},



// 	Second Ability: Power Bat
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( this.creature.adjacentHexs(1), "ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		
		var ability = this;
		var swine = this.creature;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); }, //fnOnConfirm
			team : 0, //Team, 0 = ennemies
			id : swine.id,
			flipped : swine.player.flipped,
			hexs : swine.adjacentHexs(1),
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
	},
},



// 	Third Ability: Ground Ball
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		var swine = this.creature;
		var hexs = G.grid.getHexMap(swine.x,swine.y-2,0,false,bellowrow).filterCreature(true,true,swine.id,swine.team).concat(
			G.grid.getHexMap(swine.x,swine.y,0,false,straitrow).filterCreature(true,true,swine.id,swine.team),
			G.grid.getHexMap(swine.x,swine.y,0,false,bellowrow).filterCreature(true,true,swine.id,swine.team),
			G.grid.getHexMap(swine.x,swine.y-2,0,true,bellowrow).filterCreature(true,true,swine.id,swine.team),
			G.grid.getHexMap(swine.x,swine.y,0,true,straitrow).filterCreature(true,true,swine.id,swine.team),
			G.grid.getHexMap(swine.x,swine.y,0,true,bellowrow).filterCreature(true,true,swine.id,swine.team));
		if( !this.atLeastOneTarget( hexs, "ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}

		return true;
	},

	// 	query() :
	query : function(){

		var ability = this;
		var swine = this.creature;

		var choices = [
			//Front
			G.grid.getHexMap(swine.x,swine.y-2,0,false,bellowrow),
			G.grid.getHexMap(swine.x,swine.y,0,false,straitrow),
			G.grid.getHexMap(swine.x,swine.y,0,false,bellowrow),
			//Behind
			G.grid.getHexMap(swine.x,swine.y-2,0,true,bellowrow),
			G.grid.getHexMap(swine.x,swine.y,0,true,straitrow),
			G.grid.getHexMap(swine.x,swine.y,0,true,bellowrow),
		];

		choices.each(function(){
			this.filterCreature(true,true,swine.id,swine.team);
		});
		
		G.grid.queryChoice({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); }, //fnOnConfirm
			team : 0, 
			requireCreature : 1,
			id : swine.id,
			flipped : swine.flipped,
			choices : choices,
		});
	},


	//	activate() : 
	activate : function(path,args) {
		var ability = this;
		ability.end();

		var target = path.last().creature;

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



// 	Fourth Ability: Mud Bath
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	require : function(){
		return this.testRequirements();
	},

	// 	query() :
	query : function(){
		
		var ability = this;
		var swine = this.creature;

		var hexs = G.grid.getFlyingRange(swine.x,swine.y,50,1,0);
		
		//TODO Filtering corpse hexs
		hexs.filter(function(){return true;});
		
		G.grid.hideCreatureHexs(this.creature);
		
		G.grid.queryHexs({
			fnOnCancel : function(){ G.activeCreature.queryMove(); G.grid.clearHexViewAlterations(); },
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			hexs : hexs,
		});
	},


	//	activate() : 
	activate : function(hex,args) {
		G.grid.clearHexViewAlterations();
		var ability = this;
		ability.end();

		var effects = [
			new Effect(
				"Slow Down",ability.creature,hex,"onStepIn",
				{ 	
					requireFn: function(){ 
						if(this.trap.hex.creature==0) return false;
						return (this.trap.hex.creature.type != "A1" && !this.trap.hex.creature.canFly); 
					}, 
					effectFn: function(effect,crea){ crea.remainingMove--; },
				}
			),
		]


		hex.createTrap("mud-bath",effects,ability.creature.player);

	},
}

];
