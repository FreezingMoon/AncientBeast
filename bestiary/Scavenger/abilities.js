/*
*
*	Scavenger abilities
*
*/
abilities[44] =[

// 	First Ability: Feathered Body
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "",

	// 	require() :
	require : function(){
		return true;
	},

	//	activate() : 
	activate : function(){
	},
},



// 	Second Ability: Slicing Talon
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( this.creature.getHexMap(frontnback2hex),"ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //Team, 0 = ennemies
			id : this.creature.id,
			flipped : this.creature.flipped,
			hexs : this.creature.getHexMap(frontnback2hex),
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



// 	Third Ability: Escort Service
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		var crea = this.creature;
		var hexs = crea.getHexMap(inlinefrontnback2hex)

		//Filter 3h creatures
		var hexs = crea.getHexMap(inlinefrontnback2hex).filter(function(){
			if( !this.creature ) return false;
			return (this.creature.size > 2);
		});

		if( !this.atLeastOneTarget( hexs, "ally" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}

		return true;
	},

	// 	query() :
	query : function(){

		var ability = this;
		var crea = this.creature;

		//Filter 3h creatures
		var hexs = crea.getHexMap(inlinefrontnback2hex).filter(function(){
			if( !this.creature ) return false;
			return (this.creature.size > 2);
		});
		
		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.query2.apply(ability,arguments); }, //fnOnConfirm
			team : 1, //Ally
			id : crea.id,
			flipped : crea.flipped,
			hexs : hexs,
		});
	},

	// 	query() :
	query2 : function(target,args){

		var ability = this;
		var crea = this.creature;

		var trg = target;
		var distance = Math.floor(crea.remainingMove/trg.size);
		var size = crea.size+trg.size;

		var trgIsInfront = (G.grid.getHexMap(crea.x-inlinefront2hex.origin[0],crea.y-inlinefront2hex.origin[1],0,false,inlinefront2hex)[0].creature == trg);

		var select = function(hex,args){
			for (var i = 0; i < size; i++) {
				var h = G.grid.hexs[hex.y][hex.x-i];
				if(trgIsInfront){
					var color = i<trg.size ? trg.team : crea.team;	
				}else{
					var color = i>1 ? trg.team : crea.team;	
				}
				h.overlayVisualState("creature moveto selected player"+color);
			};
		}
		
		G.grid.queryHexs({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); }, //fnOnConfirm
			fnOnSelect : select, //fnOnSelect,
			team : 1, //Ally
			id : crea.id,
			size : size,
			flipped : crea.flipped,
			hexs : G.grid.getFlyingRange(crea.x,crea.y,distance,size,crea.id),
			args : {trg : trg.id, trgIsInfront: trgIsInfront}
		});
	},


	//	activate() : 
	activate : function(hex,args) {
		var ability = this;
		ability.end();
	
		var crea = this.creature;

		var trg = G.creatures[args.trg];
		var size = crea.size+trg.size;

		var trgIF = args.trgIsInfront;

		var crea_dest 	= G.grid.hexs[hex.y][ trgIF ? hex.x-trg.size : hex.x ];
		var trg_dest 	= G.grid.hexs[hex.y][ trgIF ? hex.x : hex.x-crea.size ];

		//Determine distance
		var distance = 0;
		var k = 0;
		var start = G.grid.hexs[crea.y][crea.x];
		while(!distance){
			k++;
			if( start.adjacentHex(k).findPos(crea_dest) ) distance = k;
		}

		//substract from movement points
		crea.remainingMove -= distance*trg.size;

		crea.moveTo(crea_dest,{
			animation : "fly",
			callback : function(){ G.activeCreature.queryMove() },
			ignoreMovementPoint : true
		});

		trg.moveTo(trg_dest,{
			animation : "fly",
			callback : function(){ G.activeCreature.queryMove() },
			ignoreMovementPoint : true,
			overrideSpeed : crea.animation.walk_speed
		});

	},
},



// 	Fourth Ability: Venom Strike
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( this.creature.getHexMap(frontnback2hex),"ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var ability = this;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //Team, 0 = ennemies
			id : this.creature.id,
			flipped : this.creature.flipped,
			hexs : this.creature.getHexMap(frontnback2hex),
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

		ability.damages.poison -= ability.damages.poison == 10 ? 0 : 10;
		G.UI.checkAbilities();
	},
}

];
