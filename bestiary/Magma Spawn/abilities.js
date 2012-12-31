/*
*
*	Magma Spawn abilities
*
*/
abilities["L2"] =[

// 	First Ability  Infernal Temper
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onStartPhase",

	damages : {
		burn : 5,
	},

	// 	require() :
	require : function(){return true;},

	//	activate() : 
	activate : function() {
		var ability = this;
		ability.end();

		//Basic Attack all nearby creatures
		var targets = ability.getTargets(ability.creature.adjacentHexs(1));
		for(var t in targets) {
			if(targets[t].target === undefined) break;
			var damage = new Damage(
				ability.creature, //Attacker
				"zone", //Attack Type
				ability.damages, //Damage Type
				targets[t].hexsHit, //Area
				[]	//Effects
			);
			targets[t].target.takeDamage(damage);
		};
	},
},



// 	Second Ability Pulverize
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		burn : 1,
		crush : 9
	},

	// 	require() :
	require : function(){return true;},

	// 	query() :
	query : function(){
		
		var ability = this;
		var magmaSpawn = this.creature;

		var map = [	 [0,0,0,0,0],
					[0,1,0,0,1],
					 [1,0,0,0,1], //origin line
					[0,1,0,0,1]];

		G.grid.queryCreature({
			fnOnConfirm : ability.activate, //fnOnConfirm
			team : 0, //Team, 0 = ennemies
			id : magmaSpawn.id,
			flipped : magmaSpawn.flipped,
			hexs : G.grid.getHexMap(magmaSpawn.x-3,magmaSpawn.y-2,0,false,map),
			args : {creature:magmaSpawn, ability: ability}
		});
	},


	//	activate() : 
	activate : function(target,args) {
		var ability = args.ability;
		ability.end();

		var damage = new Damage(
			args.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);
		target.takeDamage(damage);
	},
},



// 	Third Ability Fissure
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		burn : 15,
	},

	// 	require() :
	require : function(){return true;},

	// 	query() :
	query : function(){
		
		var ability = this;
		var magmaSpawn = this.creature;

		var map = [	 [0,0,1,0],
					[0,0,1,1],
					 [0,1,1,0],//origin line
					[0,0,1,1],
					 [0,0,1,0]];

		G.grid.queryChoice({
			fnOnConfirm : ability.activate,
			team : 3, 
			requireCreature : 0,
			id : magmaSpawn.id,
			args : {creature:magmaSpawn, ability:ability},
			flipped : magmaSpawn.flipped,
			choices : [
				G.grid.getHexMap(magmaSpawn.x,magmaSpawn.y-2,0,false,map),
				G.grid.getHexMap(magmaSpawn.x-magmaSpawn.size+1,magmaSpawn.y-2,0,true,map)
			],
		})

	},


	//	activate() : 
	activate : function(hexs,args) {
		var ability = args.ability;
		ability.end();

		//Basic Attack all nearby creatures
		ability.areaDamage(
			ability.creature, //Attacker
			"zone", //Attack Type
			ability.damages, //Damage Type
			[],	//Effects
			ability.getTargets(hexs) //Targets
		);
	},
},



// 	Fourth Ability Molten Hurl
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		crush : 20,
		burn : 5,
	},

	require : function(){return true;},

	// 	query() :
	query : function(){
		
		var ability = this;
		var magmaSpawn = this.creature;

		var x = (magmaSpawn.player.flipped) ? magmaSpawn.x-magmaSpawn.size+1 : magmaSpawn.x ;

		G.grid.queryDirection({
			fnOnConfirm : ability.activate, //fnOnConfirm
			team : 0, //enemies
			id : magmaSpawn.id,
			requireCreature : true,
			x : x,
			y : magmaSpawn.y,
			directions : [0,1,0,0,1,0],
			args : {magmaSpawn:magmaSpawn, ability: ability}
		});
	},


	//	activate() : 
	activate : function(path,args) {
		var magmaSpawn = args.magmaSpawn;
		var ability = args.ability;
		ability.end();

		//TODO destroy traps

		//Damage
		var target = G.creatures[path.last().creature];
		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);
		target.takeDamage(damage);

		//Movement
		var destination = path.filterCreature(false,false).last();
		var x = (destination.direction==4) ? destination.x+magmaSpawn.size-1 : destination.x ;
		destination = G.grid.hexs[destination.y][x];

		args.magmaSpawn.moveTo(destination,{
			ignoreMovementPoint : true,
			ignorePath : true,
			callback : function(){
				G.activeCreature.queryMove();
			},
		});
	},
}

];