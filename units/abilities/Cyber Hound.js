/*
*
*	Cyber Hound abilities
*
*/
abilities[31] =[

// 	First Ability: Bad Dog
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onOtherCreatureMove onOtherCreatureSummon",

	// 	require() :
	require : function(hex){
		if( !this.testRequirements() ) return false;

		//OnSummon Fix
		if( hex instanceof Creature){
			var hex = {creature : hex};
		}

		if( hex instanceof Hex && hex.creature instanceof Creature ){

			if( this.creature.isAlly( hex.creature.team ) ) return false; //Don't bite ally

			var isAdj = false;

			//Search if Cyber hound is adjacent to the creature that is moving
			if( hex.creature.hexagons.indexOf( this.creature.getHexMap(inlinefront2hex)[0] ) != -1) isAdj = true;

			if( !isAdj ) return false;
		}
		return true;
	},

	//	activate() : 
	activate : function(hex) {
		var ability = this;
		ability.end();

		var target = this.creature.getHexMap(inlinefront2hex)[0].creature;

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



// 	Second Ability: Metal Hand
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( this.creature.getHexMap(frontnback2hex), "ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		
		var ability = this;
		var crea = this.creature;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); }, //fnOnConfirm
			team : 0, //Team, 0 = ennemies
			id : crea.id,
			flipped : crea.player.flipped,
			hexs : crea.getHexMap(frontnback2hex)
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



// 	Third Ability: Rocket Launcher
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	require : function(){
		return this.testRequirements();
	},

	token : 0,

	// 	query() :
	query : function(){
		
		var ability = this;
		var crea = this.creature;

		var choices = [
			//Front
			G.grid.getHexMap(crea.x,crea.y-2,0,false,bellowrow).filterCreature(true,true,crea.id).concat(
			G.grid.getHexMap(crea.x,crea.y,0,false,straitrow).filterCreature(true,true,crea.id),
			G.grid.getHexMap(crea.x,crea.y,0,false,bellowrow).filterCreature(true,true,crea.id)),
			//Behind
			G.grid.getHexMap(crea.x-1,crea.y-2,0,true,bellowrow).filterCreature(true,true,crea.id).concat(
			G.grid.getHexMap(crea.x-1,crea.y,0,true,straitrow).filterCreature(true,true,crea.id),
			G.grid.getHexMap(crea.x-1,crea.y,0,true,bellowrow).filterCreature(true,true,crea.id))
		];

		choices[0].choiceId = 0;
		choices[1].choiceId = 1;
						
		G.grid.queryChoice({
			fnOnCancel : function(){ G.activeCreature.queryMove(); G.grid.clearHexViewAlterations(); },
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 4, //both
			id : crea.id,
			requireCreature : false,
			choices : choices
		});
	},


	//	activate() : 
	activate : function(choice,args) {
		var ability = this;
		ability.end();

		var crea = this.creature;

		if( choice.choiceId == 0 ){
			//Front
			var rows = [
				G.grid.getHexMap(crea.x,crea.y-2,0,false,bellowrow).filterCreature(true,true,crea.id),
				G.grid.getHexMap(crea.x,crea.y,0,false,straitrow).filterCreature(true,true,crea.id),
				G.grid.getHexMap(crea.x,crea.y,0,false,bellowrow).filterCreature(true,true,crea.id)
			];
		}else{
			//Back
			var rows = [
				G.grid.getHexMap(crea.x-1,crea.y-2,0,true,bellowrow).filterCreature(true,true,crea.id),
				G.grid.getHexMap(crea.x-1,crea.y,0,true,straitrow).filterCreature(true,true,crea.id),
				G.grid.getHexMap(crea.x-1,crea.y,0,true,bellowrow).filterCreature(true,true,crea.id)
			];
		}


		for (var i = 0; i < rows.length; i++) {
			if( rows[i].length == 0 || !(rows[i][ rows[i].length-1 ].creature instanceof Creature) ) {
				//Miss
				this.token += 1;
				continue;
			}

			var target = rows[i][ rows[i].length-1 ].creature;

			var damage = new Damage(
				ability.creature, //Attacker
				"target", //Attack Type
				ability.damages, //Damage Type
				1, //Area
				[]	//Effects
			);
			target.takeDamage(damage);
		};

		G.UI.checkAbilities();
	},
},



// 	Forth Ability: Targeting System
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if(this.creature.abilities[2].token == 0){
			this.message = "No rocket launched."
			return false;
		}

		return true;
	},

	// 	query() :
	query : function(){

		var ability = this;
		var crea = this.creature;

		var hexs = G.grid.allHexs.slice(0); //Copy array
		
		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); }, //fnOnConfirm
			team : 0, //Team, 0 = ennemies
			id : crea.id,
			flipped : crea.player.flipped,
			hexs : hexs
		});
	},


	//	activate() : 
	activate : function(crea,args) {
		var ability = this;
		ability.end();

		var target = crea;

		this.creature.abilities[2].token -= 1;

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			this.creature.abilities[2].damages, //Damage Type
			1, //Area
			[]	//Effects
		);
		target.takeDamage(damage);
	},
}

];
