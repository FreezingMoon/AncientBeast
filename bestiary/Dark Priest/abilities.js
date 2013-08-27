/*
*
*	Dark Priest abilities
*
*/
abilities[0] =[

// 	First Ability: Artificial Satellite
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onAttack",

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
		this.creature.player.plasma  -= 1;
		this.end();
		damage.damages = {total:0};
		damage.status = "Shielded";
		damage.effect = [];
		return damage; //Return Damage
	},
},



// 	Second Ability: Electro Shocker
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( this.creature.adjacentHexs(1),"ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		
		var ability = this;
		var dpriest = this.creature;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //Team, 0 = ennemies
			id : dpriest.id,
			flipped : dpriest.player.flipped,
			hexs : dpriest.adjacentHexs(1),
		});
	},

	//	activate() : 
	activate : function(target,args) {
		var ability = this;
		ability.end();

		var damage = {shock: 12*target.size};

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			damage, //Damage Type
			1, //Area
			[]	//Effects
		);

		target.takeDamage(damage);
	},
},



// 	Third Ability: Particle Disintegrator
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	requirements : {
		plasma : 1,
	},

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

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

		return true;
	},

	// 	query() :
	query : function(){
		
		var ability = this;
		var dpriest = this.creature;

		G.grid.queryCreature({
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			team : 0, //Team, 0 = ennemies
			id : dpriest.id,
			flipped : dpriest.player.flipped,
			hexs : dpriest.adjacentHexs(1),
		});
	},

	//	activate() : 
	activate : function(target,args) {
		var ability = this;
		ability.end();

		var plasmaCost = target.size;
		var damage = {pure: 25+target.baseStats.health-target.health};

		ability.creature.player.plasma -= plasmaCost;

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			damage, //Damage Type
			1, //Area
			[]	//Effects
		);

		target.takeDamage(damage);
	},
},



// 	Fourth Ability: Unit Materializer
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if(this.creature.player.plasma <= 0){
			this.message = G.msg.abilities.noplasma;
			return false;
		}
		if(this.creature.player.getNbrOfCreatures() >= G.creaLimitNbr){ //is this needed anymore?
			this.message = G.msg.abilities.nopsy;
			return false;
		}
		return true;
	},

	summonRange : 6,

	// 	query() :
	query : function(){
		var ability = this;
		G.grid.updateDisplay(); //Retrace players creatures

		//Ask the creature to summon
		G.UI.materializeToggled = true;
		G.UI.toggleDash();
	},

	fnOnSelect : function(hex,args){
		var crea = G.retreiveCreatureStats(args.creature);
		G.grid.previewCreature(hex.pos,crea,this.creature.player);
	},

	//Callback function to queryCreature
	materialize : function(creature){
		var crea = G.retreiveCreatureStats(creature);
		var ability = this;
		var dpriest = this.creature;

		G.grid.forEachHexs(function(){ this.unsetReachable(); });

		var spawnRange = dpriest.hexagons[0].adjacentHex(this.summonRange);

		spawnRange.each(function(){ this.setReachable(); });
		spawnRange.filter(function(){ return this.isWalkable(crea.size,0,false);	});
		spawnRange = spawnRange.extendToLeft(crea.size);

		G.grid.queryHexs({
			fnOnSelect : function(){ ability.fnOnSelect.apply(ability,arguments); },
			fnOnCancel : function(){ G.activeCreature.queryMove(); },
			fnOnConfirm : function(){ ability.animation.apply(ability,arguments); },
			args : {creature:creature, cost: (crea.size-0)+(crea.lvl-0)}, //OptionalArgs
			size : crea.size,
			flipped : dpriest.player.flipped,
			hexs : spawnRange
		});
	},

	//	activate() : 
	activate : function(hex,args) {
		var creature = args.creature;
		var ability = this;

		var creaStats = G.retreiveCreatureStats(creature);
		var dpriest = this.creature;

		var pos = { x:hex.x, y:hex.y };

		ability.creature.player.summon(creature,pos);
		ability.creature.player.plasma -= args.cost;

		ability.end();
	},
}

];
