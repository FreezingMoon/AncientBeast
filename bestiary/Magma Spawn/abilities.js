/*
*
*	Magma Spawn abilities
*
*/
abilities[4] =[

// 	First Ability: After Burner
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onStepOut",

	damages : {
		burn : 5,
	},

	// 	require() :
	require : function(){return this.testRequirements();},

	//	activate() : 
	activate : function(hex) {
		var effects = [
			new Effect(
				"After Burner",this.creature,hex,"onStepIn",
				{ 	
					effectFn: function(effect,crea){ 
						crea.takeDamage(new Damage( effect.attacker, "effect", {burn:5}, 1,[] )); 
						this.trap.destroy();
					},
					attacker: this.creature
				}
			),
		]
		if( !this.creature.player.flipped )
			hex = G.grid.hexs[hex.y][hex.x-this.creature.size+1];

		hex.createTrap("mud-bath",effects,this.creature.player);
	},
},



// 	Second Ability: Pulverize
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		burn : 1,
		crush : 9
	},

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( G.grid.getHexMap(this.creature.x-3,this.creature.y-2,0,false,frontnback3hex),"ennemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function(){
		
		var ability = this;
		var magmaSpawn = this.creature;

		G.grid.queryCreature({
			fnOnConfirm : ability.activate, //fnOnConfirm
			team : 0, //Team, 0 = ennemies
			id : magmaSpawn.id,
			flipped : magmaSpawn.flipped,
			hexs : G.grid.getHexMap(magmaSpawn.x-3,magmaSpawn.y-2,0,false,frontnback3hex),
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



// 	Thirt Ability: Fissure
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		burn : 10,
	},

	map : [	 [0,0,1,0],
			[0,0,1,1],
			 [0,1,1,0],//origin line
			[0,0,1,1],
			 [0,0,1,0]],

	// 	require() :
	require : function(){
		if( !this.testRequirements() ) return false;

		// Require Ennemy
		// var magmaSpawn = this.creature;
		// var hexs = G.grid.getHexMap(magmaSpawn.x,magmaSpawn.y-2,0,false,this.map).concat(
		// 	G.grid.getHexMap(magmaSpawn.x-magmaSpawn.size+1,magmaSpawn.y-2,0,true,this.map));
		// if( !this.atLeastOneTarget( hexs,"ennemy" ) ){
		// 	this.message = G.msg.abilities.notarget;
		// 	return false;
		// }
		return true;
	},

	// 	query() :
	query : function(){
		
		var ability = this;
		var magmaSpawn = this.creature;

		G.grid.queryChoice({
			fnOnConfirm : ability.activate,
			team : 3, 
			requireCreature : 0,
			id : magmaSpawn.id,
			args : {creature:magmaSpawn, ability:ability},
			flipped : magmaSpawn.flipped,
			choices : [
				G.grid.getHexMap(magmaSpawn.x,magmaSpawn.y-2,0,false,this.map),
				G.grid.getHexMap(magmaSpawn.x-magmaSpawn.size+1,magmaSpawn.y-2,0,true,this.map)
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



// 	Fourth Ability: Molten Hurl
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		crush : 15,
		burn : 5,
	},

	directions : [0,1,0,0,1,0],

	require : function(){
		if( !this.testRequirements() ) return false;

		var magmaSpawn = this.creature;
		var x = (magmaSpawn.player.flipped) ? magmaSpawn.x-magmaSpawn.size+1 : magmaSpawn.x ;

		var test = this.testDirection({
			team : "ennemy",
			x : x,
			directions : this.directions,
		});

		if( !test ){
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

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
			directions : this.directions,
			args : {magmaSpawn:magmaSpawn, ability: ability}
		});
	},


	//	activate() : 
	activate : function(path,args) {
		var magmaSpawn = args.magmaSpawn;
		var ability = args.ability;
		ability.end();

		path.each(function(){this.destroyTrap();});

		//Damage
		var target = path.last().creature;
		var damage = new Damage(
			ability.creature, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);
		target.takeDamage(damage);

		//Movement
		var direction = path.last().direction;
		var magmaHex = (direction==4) ? magmaSpawn.hexagons[magmaSpawn.size-1] : magmaSpawn.hexagons[0] ;
		path.filterCreature(false,false);
		path.unshift(magmaHex); //prevent error on empty path
		var destination = path.last();
		var x = (direction==4) ? destination.x+magmaSpawn.size-1 : destination.x ;
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
