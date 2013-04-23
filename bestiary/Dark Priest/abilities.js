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

	requirements : {
		plasma : 1,
	},

	// 	require() :
	require : function(damage){
		this.setUsed(false); //Can be triggered as many times
		return this.testRequirements();
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

	requirements : {
		plasma : 1,
	},

	// 	require() :
	require : function(){
		if( !this.atLeastOneTarget( this.creature.adjacentHexs(1),"ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return this.testRequirements();
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
			hexs : dpriest.adjacentHexs(1),
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
		var range = this.creature.adjacentHexs(1);

		//At least one target
		if( !this.atLeastOneTarget(range,"ennemy") ){
			this.message = G.msg.abilities.notarget;
			return false;
		}

		//Search Lowest target cost
		var lowestCost = 0;
		var targets = this.getTargets(range);

		targets.each(function(){
			if( lowestCost < this.size ) lowestCost = this.size;			
		});

		if(this.creature.player.plasma < lowestCost){
			this.message = G.msg.abilities.noplasma;
			return false;
		}

		return this.testRequirements();
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
			hexs : dpriest.adjacentHexs(1),
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
			this.message = G.msg.abilities.noplasma;
			return false;
		}
		if(this.creature.player.getNbrOfCreatures() >= G.creaLimitNbr){
			this.message = G.msg.abilities.nopsy;
			return false;
		}
		return this.testRequirements();
	},

	summonRange : 6,

	// 	query() :
	query : function(){
		G.grid.updateDisplay(); //Retrace players creatures

		//Ask the creature to summon
		G.UI.materializeToggled = true;
		G.UI.toggleDash();
	},

	fnOnSelect : function(hex,args){
		var crea = G.retreiveCreatureStats(args.creature);
		G.grid.previewCreature(hex.pos,crea,args.dpriest.player);
	},

	//Callback function to queryCreature
	materialize : function(creature){
		var crea = G.retreiveCreatureStats(creature);
		var dpriest = this.creature;

		G.grid.forEachHexs(function(){ this.unsetReachable(); });

		var spawnRange = dpriest.hexagons[0].adjacentHex(this.summonRange);

		spawnRange.each(function(){ this.setReachable(); });
		spawnRange.filter(function(){ return this.isWalkable(crea.size,0,false);	});
		spawnRange = spawnRange.extendToLeft(crea.size);

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
		ability.creature.player.plasma -= args.cost;

		ability.end();
	},
}

];
