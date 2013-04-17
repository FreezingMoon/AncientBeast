/*
*
*	Dark Priest abilities
*
*/
abilities[0] =[

// 	First Ability: Artificial Satellite
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onDamage",

	// 	require() :
	require : function(damage){
		this.setUsed(false); //Can be triggered as many times
		if(this.creature.player.plasma <= this.satelliteBeamCost){
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



// 	Second Ability: Electroshock
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		return true;
	},

	// 	query() :
	query : function(){
		
		var ability = this;
		var dpriest = this.creature;

		G.grid.queryCreature({
			fnOnConfirm : ability.activate, //fnOnConfirm
			team : 0, //Team, 0 = ennemies
			id : dpriest.id,
			flipped : dpriest.player.flipped,
			hexs : dpriest.hexagons[0].adjacentHex(1),
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



// 	Third Ability: Disintegration
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

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

		G.grid.queryCreature({
			fnOnConfirm : ability.activate, //fnOnConfirm
			team : 0, //Team, 0 = ennemies
			id : dpriest.id,
			flipped : dpriest.player.flipped,
			hexs : dpriest.hexagons[0].adjacentHex(1),
			args : {dpriest:dpriest, ability: ability}
		});
	},

	//	activate() : 
	activate : function(target,args) {
		var ability = args.ability;
		ability.end();

		var plasmaCost = target.size;
		var damage = {pure: 25+target.baseStats.health-target.health};

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



// 	Fourth Ability: Materialize
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if(this.creature.player.plasma <= 0){
			G.log("Not enough plasma");
			return false;
		}
		if(this.creature.player.getNbrOfCreatures() >= G.creaLimitNbr){
			G.log("Psyhelm overload : too much creature summoned");
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		G.grid.updateDisplay(); //Retrace players creatures

		//Ask the creature to summon
		G.UI.toggleDash();
		G.UI.materializeToggled = true;
	},

	fnOnSelect : function(hex,args){
		var crea = G.retreiveCreatureStats(args.creature);
		G.grid.previewCreature(hex.pos,crea,args.dpriest.player);
	},

	//Callback function to queryCreature
	materialize : function(creature){
		var crea = G.retreiveCreatureStats(creature);
		var dpriest = this.creature;

		var spawnRange = dpriest.hexagons[0].adjacentHex(6);
		var range = dpriest.hexagons[0].adjacentHex(6);
		spawnRange.filter(function(){ return this.isWalkable(crea.size,0,true);	});
		spawnRange = spawnRange.extendToLeft(crea.size);
		spawnRange.filter(function(){ return !!range.findPos(this); });

		G.grid.queryHexs({
			fnOnSelect : this.fnOnSelect,
			fnOnCancel : function(){ G.activeCreature.queryMove(); },
			fnOnConfirm : this.activate,
			args : {dpriest:dpriest, creature:creature, ability:this, cost: (crea.size-0)+(crea.lvl-0)}, //OptionalArgs
			size : crea.size,
			flipped : dpriest.player.flipped,
			hexs : spawnRange
		});
	},

	//	activate() : 
	activate : function(hex,args) {
		var creature = args.creature;
		var ability = args.ability;

		var creaStats = G.retreiveCreatureStats(creature);
		var dpriest = args.dpriest;

		var pos = { x:hex.x, y:hex.y };

		ability.creature.player.summon(creature,pos);
		console.log(args.cost)
		ability.creature.player.plasma -= args.cost;

		ability.end();
	},
}

];
