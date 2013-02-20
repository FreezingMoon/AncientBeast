/*
*
*	Chimera abilities
*
*/
abilities[45] =[

// 	First Ability: Duality
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onStartPhase",

	//	require() :
	require : function(){
		return true;
	},

	//	activate() : 
	activate : function() {
		this.tokens = [false,false,false];
	},

	abilityTriggered : function(id){
		if(this.used) return;
		if(this.tokens[id]){
			this.end();
			for (var i = 0; i < this.tokens.length; i++) {
				this.creature.abilities[i+1].setUsed(this.tokens[i]);
			};
		}else{
			this.tokens[id] = true;
			this.creature.abilities[id+1].setUsed(false);
		}
	},

	tokens : [false,false,false],
},



//	Second Ability: Tooth Fairy
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		crush : 20,
	},

	//	require() :
	require : function(){
		return !(this.creature.abilities[0].tokens[0] && this.creature.abilities[0].used);
	},

	//	query() :
	query : function(){
		var chimera = this.creature;

		var map = [	[0,0,0,0],
				[0,1,0,1],
				[1,0,0,1], //origin line
				[0,1,0,1]];

		G.grid.queryCreature({
			fnOnConfirm : this.activate, //fnOnConfirm
			team : 0, //Team, 0 = ennemies
			id : chimera.id,
			flipped : chimera.flipped,
			hexs : G.grid.getHexMap(chimera.x-2,chimera.y-2,0,false,map),
			args : {ability: this}
		});
	},


	//	activate() : 
	activate : function(target,args) {
		var ability = args.ability;
		ability.end();

		ability.creature.abilities[0].abilityTriggered(0);

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



//	Thirt Ability: Power Note
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		sonic : 20,
	},

	//	require() :
	require : function(){
		return !(this.creature.abilities[0].tokens[1] && this.creature.abilities[0].used);
	},

	//	query() :
	query : function(){
		var chimera = this.creature;

		G.grid.queryDirection({
			fnOnConfirm : this.activate, //fnOnConfirm
			flipped : chimera.player.flipped,
			team : 0, //enemies
			id : chimera.id,
			requireCreature : false,
			x : chimera.x,
			y : chimera.y,
			directions : [0,1,0,0,0,0],
			args : {chimera:chimera, ability: this}
		});
	},


	//	activate() : 
	activate : function(path,args) {
		var ability = args.ability;
		ability.end();

		ability.creature.abilities[0].abilityTriggered(1);

		crea = G.creatures[path.last().creature];

		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);
		crea.takeDamage(damage);
	},
},



//	Fourth Ability: Chain Lightning
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		shock : 20,
	},

	require : function(){
		return !(this.creature.abilities[0].tokens[2] && this.creature.abilities[0].used);
	},

	//	query() :
	query : function(){
		var chimera = this.creature;

		G.grid.queryDirection({
			fnOnConfirm : this.activate, //fnOnConfirm
			flipped : chimera.player.flipped,
			team : 0, //enemies
			id : chimera.id,
			requireCreature : false,
			x : chimera.x,
			y : chimera.y,
			directions : [0,1,0,0,0,0],
			args : {chimera:chimera, ability: this}
		});
	},


	//	activate() : 
	activate : function(path,args) {
		var ability = args.ability;
		ability.end();

		ability.creature.abilities[0].abilityTriggered(2);

		var targets = [];
		targets.push(path.last().creature);
		var nextdmg = $j.extend({},ability.damages); 

		for (var i = 0; i < targets.length; i++) {
			var trg = G.creatures[targets[i]];

			var damage = new Damage(
				ability.creature, //Attacker
				"target", //Attack Type
				nextdmg, //Damage Type
				1, //Area
				[] //Effects
			);
			nextdmg = trg.takeDamage(damage);

			if(nextdmg.damages == undefined) break;
			if(nextdmg.damages.total <= 0) break;
			delete nextdmg.damages.total;
			nextdmg = nextdmg.damages;

			nextTargets = ability.getTargets(trg.adjacentHexs(1));

			if(nextTargets.length == 0) break;

			var bestTarget = { stats:{ defense:-99999, shock:-99999 } };
				for (var j = 0; j < nextTargets.length; j++) {
					if (typeof nextTargets[j] == "undefined") continue // Skip empty ids.
					if (targets.indexOf(nextTargets[j].target.id) != -1) continue
					if (nextTargets[j].target.stats.shock+nextTargets[j].target.stats.defense <= bestTarget.stats.shock+bestTarget.stats.defense) continue
					var bestTarget = nextTargets[j].target;
			};

			if( bestTarget instanceof Creature ){
				targets.push(bestTarget.id);
			}else{
				break;
			}
		};

	},
}

];
