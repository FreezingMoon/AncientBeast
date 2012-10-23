/*
*
*	Dark Priest abilities
*
*/
abilities["0"] =[

// 	First Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onDamage",

	//	Title
	title : "Plasma Shield",

	//	Description
	desc : "The shield protects from any harm.",

	// 	require() :
	require : function(){
		if(this.creature.player.plasma <= 0){
			G.log("Not enough plasma");
			return false;
		}
		return true;
	},

	//	activate() : 
	activate : function(damage,target,attacker) {
		this.creature.player.plasma  -= 1;
		return 0; //Return Damage
	},
},



// 	Second Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Disintegrate",

	//	Description
	desc : "Turns any nearby foe into a pile of dust by using plasma in exchange.",

	// 	require() :
	require : function(){
		// if(this.creature.player.plasma <= 0){
		// 	G.log("Not enough plasma");
		// 	return false;
		// }
		return true;
	},

	// 	query() :
	query : function(){
		
		var ability = this;
		var dpriest = this.creature;

		optionalTest = function(hex,args){
			if( hex.creature == 0 ) return false;
			return ( G.creatures[hex.creature].team != args.dpriest.team );
		}

		fnOnClick = function(hex,args){
			var crea = G.creatures[hex.creature];

			G.grid.cleanOverlay("creature player0 player1 player2 player3");
			G.grid.updateDisplay(); //Retrace players creatures
			crea.hexagons.each(function(){
				this.$overlay.addClass("creature selected player"+crea.team);
			});
		};

		fnOnMouseover = function(hex,args){
			var crea = G.creatures[hex.creature];
			
			G.grid.cleanOverlay("hover h_player0 h_player1 h_player2 h_player3");
			crea.hexagons.each(function(){
				this.$overlay.addClass("hover h_player"+crea.team);
			});
			
		};

		G.grid.queryHexs(
			fnOnClick, //OnClick
			fnOnMouseover, //OnMouseover
			function(){G.activeCreature.queryMove()}, //OnCancel
			ability.activate, //OnConfirm
			optionalTest, //OptionalTest
			{dpriest:dpriest, ability:ability}, //OptionalArgs
			false, //Flying
			2,	//Include creature
			dpriest.x,dpriest.y, //Position
			1, //Distance
			0, //Creature ID
			1, //Size
			dpriest.hexagons //Excluding hexs
		);
	},

	//	activate() : 
	activate : function(hex,args) {
		var ability = args.ability;
		G.log("Player"+ability.creature.team+"'s "+ability.creature.name+" uses "+ability.title);

		var crea = G.creatures[hex.creature];

		crea.die();

		ability.creature.player.plasma -= 5;

		G.activeCreature.queryMove(); 
		ability.used = true; //Should always be here
	},
},



// 	Third Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Materialize",

	//	Description
	desc : "Summons a creature right in front.",

	// 	require() :
	require : function(){
		if(this.creature.player.plasma <= 0){
			G.log("Not enough plasma");
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var excludedHexs = [];
		var dpriest = this.creature;

		G.grid.cleanOverlay("creature player"+G.activeCreature.team);
		G.grid.cleanDisplay("adj");
		G.grid.updateDisplay(); //Retrace players creatures

		//Callback function to queryCreature
		queryHex = function(creature,ability){
			var crea = G.retreiveCreatureStats(creature);

			optionalTest = function(hex,args){
				var creature = args.creature;
				var crea = G.retreiveCreatureStats(creature);

				var walkable = true;

				if (dpriest.player.fliped) {
					if( dpriest.y % 2 == 0 ){
						if( hex.x > dpriest.x ) walkable = false;
					}else{
						if( hex.x+1 > dpriest.x ) walkable = false;
					}
				}else{
					if( dpriest.y % 2 == 0 ){
						if( hex.x <= dpriest.x ) walkable = false;;
					}else{
						if( hex.x+1 <= dpriest.x ) walkable = false;
					}
				}

				for (var i = 0; i < crea.size; i++) {
					var a = (dpriest.player.fliped)?-1:1;
					if( (hex.x+a*i) >= 0 && (hex.x+a*i) < G.grid.hexs[hex.y].length ){ //if hex exists
						walkable = walkable && ( !G.grid.hexs[hex.y][hex.x+a*i].blocked && (G.grid.hexs[hex.y][hex.x+a*i].creature==0) );
					}
				};
				return walkable;
			}

			tracePosition = function(hex,args){
				var creature = args.creature;
				var crea = G.retreiveCreatureStats(creature);

				G.grid.cleanOverlay("creature selected player"+G.activeCreature.team);
				G.grid.updateDisplay(); //Retrace players creatures
				for (var i = 0; i < crea.size; i++) {
					var a = (dpriest.player.fliped)?-1:1;
					G.grid.hexs[hex.y][hex.x+a*i].$overlay.addClass("creature selected player"+G.activeCreature.team);
				}
			};

			previewPosition = function(hex,args){
				var creature = args.creature;
				var crea = G.retreiveCreatureStats(creature);
				
				G.grid.cleanOverlay("hover h_player"+G.activeCreature.team);
				for (var i = 0; i < crea.size; i++) {
					var a = (dpriest.player.fliped)?-1:1;
					G.grid.hexs[hex.y][hex.x+a*i].$overlay.addClass("hover h_player"+G.activeCreature.team);
				}
			};

			G.grid.queryHexs(
				tracePosition,
				previewPosition,
				function(){G.activeCreature.queryMove()},
				ability.activate,
				optionalTest,
				{dpriest:dpriest, creature:creature, ability:ability},
				false, //true for flying creatures
				false,
				dpriest.x,dpriest.y,
				1,
				0,
				1,
				excludedHexs
			);
		};

		//Ask the creature to summon
		G.UI.queryCreature(queryHex,this);
	},

	//	activate() : 
	activate : function(hex,args) {
		var creature = args.creature;
		var ability = args.ability;
		G.log("Player"+ability.creature.team+"'s "+ability.creature.name+" uses "+ability.title);

		var creaStats = G.retreiveCreatureStats(creature);

		var pos = (ability.creature.player.fliped) ? 
		{ x:hex.x, y:hex.y } : 
		{ x:hex.x+creaStats.size-1,	y:hex.y	};

		ability.creature.player.summon(creature,pos);

		ability.creature.player.plasma -= 10;

		G.activeCreature.queryMove(); 

		ability.used = true; //Should always be here
	},
},



// 	Fourth Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Energize",

	//	Description
	desc : "Satellite beams down a creature to any specified non-occupied location.",

	// 	require() :
	require : function(){
		if(this.creature.player.plasma <= 0){
			G.log("Not enough plasma");
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		var excludedHexs = [];
		var dpriest = this.creature;

		G.grid.cleanOverlay("creature player"+G.activeCreature.team);
		G.grid.cleanDisplay("adj");
		G.grid.updateDisplay(); //Retrace players creatures

		//Callback function to queryCreature
		queryHex = function(creature,ability){
			var crea = G.retreiveCreatureStats(creature);

			optionalTest = function(hex,args){ return true; }

			fnOnClick = function(hex,args){
				var creature = args.creature;
				var crea = G.retreiveCreatureStats(creature);

				var x = hex.x;
				var y = hex.y;

				//Offset Pos
				var offset = (dpriest.player.fliped) ? crea.size-1 : 0 ;
				var mult = (dpriest.player.fliped) ? 1 : -1 ; //For FLIPED player

				for (var i = 0; i < crea.size; i++) {	//try next hexagons to see if they fits
					if( (x+offset-i*mult >= G.grid.hexs[y].length) || (x+offset-i*mult < 0) ) continue;
					if(G.grid.hexs[y][x+offset-i*mult].isWalkable(crea.size,crea.id)){ 
						x += offset-i*mult;
						break; 
					}
				};

				G.grid.cleanOverlay("creature selected player"+G.activeCreature.team);
				G.grid.updateDisplay(); //Retrace players creatures
				for (var i = 0; i < crea.size; i++) {
					G.grid.hexs[y][x-i].$overlay.addClass("creature selected player"+G.activeCreature.team);
				}
			};

			fnOnMouseover = function(hex,args){
				var creature = args.creature;
				var crea = G.retreiveCreatureStats(creature);

				var x = hex.x;
				var y = hex.y;

				//Offset Pos
				var offset = (dpriest.player.fliped) ? crea.size-1 : 0 ;
				var mult = (dpriest.player.fliped) ? 1 : -1 ; //For FLIPED player

				for (var i = 0; i < crea.size; i++) {	//try next hexagons to see if they fits
					if( (x+offset-i*mult >= G.grid.hexs[y].length) || (x+offset-i*mult < 0) ) continue;
					if(G.grid.hexs[y][x+offset-i*mult].isWalkable(crea.size,crea.id)){ 
						x += offset-i*mult;
						break; 
					}
				};

				G.grid.cleanOverlay("hover h_player"+G.activeCreature.team);
				for (var i = 0; i < crea.size; i++) {
					G.grid.hexs[y][x-i].$overlay.addClass("hover h_player"+G.activeCreature.team);
				}
			};

			G.grid.queryHexs(
				fnOnClick, //OnClick
				fnOnMouseover, //OnMouseover
				function(){G.activeCreature.queryMove()}, //OnCancel
				ability.activate, //OnConfirm
				optionalTest, //OptionalTest
				{dpriest:dpriest, creature:creature, ability:ability}, //OptionalArgs
				true, //Flying
				0,	//Include creature
				dpriest.x,dpriest.y, //Position
				50, //Distance
				0, //Creature ID
				crea.size, //Size
				dpriest.hexagons //Excluding hexs
			);
		};

		//Ask the creature to summon
		G.UI.queryCreature(queryHex,this);
	},

	//	activate() : 
	activate : function(hex,args) {
		var creature = args.creature;
		var ability = args.ability;
		G.log("Player"+ability.creature.team+"'s "+ability.creature.name+" uses "+ability.title);

		var creaStats = G.retreiveCreatureStats(creature);
		var dpriest = args.dpriest;

		var x = hex.x;
		var y = hex.y;

		//Offset Pos
		var offset = (dpriest.player.fliped) ? creaStats.size-1 : 0 ;
		var mult = (dpriest.player.fliped) ? 1 : -1 ; //For FLIPED player

		for (var i = 0; i < creaStats.size; i++) {	//try next hexagons to see if they fits
			if( (x+offset-i*mult >= G.grid.hexs[y].length) || (x+offset-i*mult < 0) ) continue;
			if(G.grid.hexs[y][x+offset-i*mult].isWalkable(creaStats.size,creaStats.id)){ 
				x += offset-i*mult;
				break; 
			}
		};

		var pos = { x:x, y:y };

		ability.creature.player.summon(creature,pos);

		ability.creature.player.plasma -= 10;

		G.activeCreature.queryMove(); 

		ability.used = true; //Should always be here
	},
}

];