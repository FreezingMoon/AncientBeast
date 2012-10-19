/*
*
*	Dark Priest abilities
*
*/
abilities["0"] =[

// 	First Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Plasma Shield",

	//	Description
	desc : "The shield protects from any harm.",

	//	activate() : 
	activate : function() {
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

	//	activate() : 
	activate : function() {
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

		//Choose a creature here
		var creature = "L2";
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

			G.grid.cleanOverlay("creature player"+G.activeCreature.team);
			G.grid.updateDisplay(); //Retrace players creatures
			for (var i = 0; i < crea.size; i++) {
				var a = (dpriest.player.fliped)?-1:1;
				G.grid.hexs[hex.y][hex.x+a*i].$overlay.addClass("creature player"+G.activeCreature.team);
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
			this.activate,
			optionalTest,
			{dpriest:dpriest, creature:creature, ability:this},
			false, //true for flying creatures
			false,
			dpriest.x,dpriest.y,
			1,
			0,
			1,
			excludedHexs
		);
		
	},

	//	activate() : 
	activate : function(hex,args) {
		var ability = args.ability;
		var creature = args.creature;
		var creaStats = G.retreiveCreatureStats(creature);

		var pos = (ability.creature.player.fliped) ? 
		{ x:hex.x, y:hex.y } : 
		{ x:hex.x+creaStats.size-1,	y:hex.y	};

		ability.creature.player.summon(creature,pos);

		ability.creature.player.plasma -= 10;

		G.activeCreature.queryMove(); 

		G.log("Player"+ability.creature.team+"'s "+ability.creature.name+" uses "+ability.title);
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

	//	activate() : 
	activate : function() {
	},
}

];