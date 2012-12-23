/*
*
*	Dark Priest abilities
*
*/
abilities["--"] =[

// 	First Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onDamage",

	//	Title
	title : "Plasma Shield",

	//	Description
	desc : "The shield protects from any harm.",

	// 	require() :
	require : function(damage){
		this.used = false; //Can be triggered as many time
		if(this.creature.player.plasma <= 2){
			G.log("Not enough plasma");
			return false;
		}
		return true;
	},

	//	activate() : 
	activate : function(damage) {
		this.creature.player.plasma  -= 2;
		this.end();
		damage.damages = {};
		damage.status = "Shielded";
		damage.effect = [];
		return damage; //Return Damage
	},
},



// 	Second Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Electroshock",

	//	Description
	desc : "Does shock damage to a nearby foe.",

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
		
		var ability = this;
		var dpriest = this.creature;

		optionalTest = function(hex,args){
			if( hex.creature == 0 ) return false;
			if( G.creatures[hex.creature].type == "--" ) return false; //Avoid selecting other dark priest
			return ( G.creatures[hex.creature].team != args.dpriest.team );
		}

		G.grid.queryCreature({
			fnOnConfirm : ability.activate, //fnOnConfirm
			fnOptTest : optionalTest,//fnOptTest
			team : 0, //Team, 0 = ennemies
			distance : 1, //Distance
			x: dpriest.x,y : dpriest.y, //coordinates
			id : dpriest.id,
			args : {dpriest:dpriest, ability: ability}
		});
	},

	//	activate() : 
	activate : function(target,args) {
		var ability = args.ability;
		ability.end();

		var damage = {shock: 12*target.size};

		var damage = new Damage(
			args.dpriest, //Attacker
			"target", //Attack Type
			damage, //Damage Type
			1, //Area
			[]	//Effects
		);

		target.takeDamage(damage);
	},
},



// 	Third Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Disintegration",

	//	Description
	desc : "Turns any nearby foe into a pile of dust by using plasma in exchange.",

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
		
		var ability = this;
		var dpriest = this.creature;

		optionalTest = function(hex,args){
			if( hex.creature == 0 ) return false;
			if( G.creatures[hex.creature].type == "--" ) return false; //Avoid selecting other dark priest
			return ( G.creatures[hex.creature].team != args.dpriest.team );
		}

		G.grid.queryCreature({
			fnOnConfirm : ability.activate, //fnOnConfirm
			fnOptTest : optionalTest,//fnOptTest
			team : 0, //Team, 0 = ennemies
			distance : 1, //Distance
			x: dpriest.x,y : dpriest.y, //coordinates
			id : dpriest.id,
			args : {dpriest:dpriest, ability: ability}
		});
	},

	//	activate() : 
	activate : function(target,args) {
		var ability = args.ability;
		ability.end();

		var plasmaCost = target.size*2;
		var damage = {pure: 30+target.baseStats.health-target.health};

		ability.creature.player.plasma -= plasmaCost;

		var damage = new Damage(
			args.dpriest, //Attacker
			"target", //Attack Type
			damage, //Damage Type
			1, //Area
			[]	//Effects
		);

		target.takeDamage(damage);
	},
},



// 	Fourth Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Materialize",

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

		G.grid.cleanOverlay("creature player"+G.activeCreature.team);
		G.grid.cleanDisplay("adj");
		G.grid.updateDisplay(); //Retrace players creatures

		//Ask the creature to summon
		G.UI.toggleDash();
	},


	//Callback function to queryCreature
	energize : function(creature){
		var dpriest = this.creature;
		var crea = G.retreiveCreatureStats(creature);

		fnOnClick = function(hex,args){
			var crea = G.retreiveCreatureStats(args.creature);
			G.grid.cleanOverlay("creature selected player"+G.activeCreature.team);
			G.grid.updateDisplay(); //Retrace players creatures
			for (var i = 0; i < crea.size; i++) {
				G.grid.hexs[hex.y][hex.x-i].$overlay.addClass("creature selected player"+G.activeCreature.team);
			}
		};

		fnOnMouseover = function(hex,args){
			var crea = G.retreiveCreatureStats(args.creature);
			G.grid.cleanOverlay("hover h_player"+G.activeCreature.team);
			for (var i = 0; i < crea.size; i++) {
				G.grid.hexs[hex.y][hex.x-i].$overlay.addClass("hover h_player"+G.activeCreature.team);
			}
		};

		G.grid.queryHexs(
			fnOnClick, //OnClick
			fnOnMouseover, //OnMouseover
			function(){G.activeCreature.queryMove()}, //OnCancel
			this.activate, //OnConfirm
			function(){ return true; }, //OptionalTest
			{dpriest:dpriest, creature:creature, ability:this, cost:2}, //OptionalArgs
			true, //Flying
			0,	//Include creature
			dpriest.x,dpriest.y, //Position
			50, //Distance
			0, //Creature ID
			crea.size, //Size
			dpriest.hexagons, //Excluding hexs
			dpriest.player.flipped //Flipped
		);
	},

	//Callback function to queryCreature
	materialize : function(creature){
		var crea = G.retreiveCreatureStats(creature);
		var dpriest = this.creature;
		var excludedHexs = [];

		optionalTest = function(hex,args){
			var creature = args.creature;
			var crea = G.retreiveCreatureStats(creature);

			if (dpriest.player.flipped) {
				if( dpriest.y % 2 == 0 ){
					var walkable = !( hex.x > dpriest.x );
				}else{
					var walkable = !( hex.x+1 > dpriest.x );
				}
			}else{
				if( dpriest.y % 2 == 0 ){
					var walkable = !( hex.x <= dpriest.x+crea.size-1 );
				}else{
					var walkable = !( hex.x+1 <= dpriest.x+crea.size-1 );
				}
			}

			for (var i = 0; i < crea.size; i++) {
				var a = (dpriest.player.flipped)?-1:1;
				if( (hex.x+a*i) >= 0 && (hex.x+a*i) < G.grid.hexs[hex.y].length ){ //if hex exists
					walkable = walkable && ( !G.grid.hexs[hex.y][hex.x+a*i].blocked && (G.grid.hexs[hex.y][hex.x+a*i].creature==0) );
				}
			};

			return walkable;
		}

		fnOnClick = function(hex,args){
			var crea = G.retreiveCreatureStats(args.creature);
			G.grid.cleanOverlay("creature selected player"+G.activeCreature.team);
			G.grid.updateDisplay(); //Retrace players creatures
			for (var i = 0; i < crea.size; i++) {
				G.grid.hexs[hex.y][hex.x-i].$overlay.addClass("creature selected player"+G.activeCreature.team);
			}
		};

		fnOnMouseover = function(hex,args){
			var crea = G.retreiveCreatureStats(args.creature);
			G.grid.cleanOverlay("hover h_player"+G.activeCreature.team);
			for (var i = 0; i < crea.size; i++) {
				G.grid.hexs[hex.y][hex.x-i].$overlay.addClass("hover h_player"+G.activeCreature.team);
			}
		};

		var originx = (!dpriest.player.flipped) ? dpriest.x+crea.size-1 : dpriest.x;

		excludedHexs.push(G.grid.hexs[dpriest.y][originx]);

		G.grid.queryHexs(
			fnOnClick, //OnClick
			fnOnMouseover, //OnMouseover
			function(){G.activeCreature.queryMove()}, //OnCancel
			this.activate, //OnConfirm
			optionalTest, //OptionalTest
			{dpriest:dpriest, creature:creature, ability:this, cost:0}, //OptionalArgs
			false, //true for flying creatures
			0, //Include creature
			originx,dpriest.y,//Position
			1, //Distance
			0, //Creature ID
			crea.size, //Size
			excludedHexs, //Excluding hexs
			dpriest.player.flipped //Flipped
		);

	},

	//	activate() : 
	activate : function(hex,args) {
		var creature = args.creature;
		var ability = args.ability;

		var creaStats = G.retreiveCreatureStats(creature);
		var dpriest = args.dpriest;

		var pos = { x:hex.x, y:hex.y };

		ability.creature.player.summon(creature,pos);

		ability.creature.player.plasma -= args.cost+(creaStats.size-0)+(creaStats.lvl-0);

		ability.end();
	},
}

];