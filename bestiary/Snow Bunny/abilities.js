/*
*
*	Snow Bunny abilities
*
*/
abilities[12] =[

// 	First Ability Bunny Hopping
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onDamage",

	// 	require() :
	require : function(damage){
		if(this.used) return false; //Prevent Multiple dodge
		if(damage.type != "target") return false; //Not targeted 
		if(this.creature.remainingMove <= 0) return false; //Not enough move points
		var canDodge = false;
		var creature = this.creature;
		creature.adjacentHexs(1).each(function(){
			canDodge = canDodge || this.isWalkable(creature.id,creature.size,true);
		});
		return canDodge;
	},

	//	activate() : 
	activate : function(damage) {
		var creature = this.creature;
		var hexs = creature.adjacentHexs(1);
		for (var i = hexs.length - 1; i >= 0; i--) {
			//If hex available dodge the attack
			if(hexs[i].isWalkable(creature.id,creature.size,true)){
				creature.moveTo(hexs[i],{
					callback : function(){	G.activeCreature.queryMove(); },
					ignorePath : true,
				});
				damage.status = "Dodged";
				break; //Break for loop
			}
		};
		this.end();
		return damage;
	},
},



// 	Second Ability Big Nip
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		slash : 2,
		pierce : 2,
		crush : 2
	},

	// 	require() :
	require : function(){return true;},

	// 	query() :
	query : function(){
		
		var ability = this;
		var snowBunny = this.creature;

		G.grid.queryCreature({
			fnOnConfirm : ability.activate, //fnOnConfirm
			team : 0, //Team, 0 = ennemies
			id : snowBunny.id,
			flipped : snowBunny.player.flipped,
			hexs : snowBunny.hexagons[0].adjacentHex(1),
			args : {snowBunny:snowBunny, ability: ability}
		});
	},


	//	activate() : 
	activate : function(target,args) {
		var ability = args.ability;
		ability.end();

		var damage = new Damage(
			args.snowBunny, //Attacker
			"target", //Attack Type
			ability.damages, //Damage Type
			1, //Area
			[]	//Effects
		);
		target.takeDamage(damage);
	},
},



// 	Third Ability Blowing Wind
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function(){return true;},

	// 	query() :
	query : function(){
		var ability = this;
		var snowBunny = this.creature;

		G.grid.queryDirection({
			fnOnConfirm : ability.activate, //fnOnConfirm
			flipped : snowBunny.player.flipped,
			team : 0, //enemies
			id : snowBunny.id,
			requireCreature : false,
			x : snowBunny.x,
			y : snowBunny.y,
			directions : [1,1,1,1,1,1],
			args : {snowBunny:snowBunny, ability: ability}
		});
	},


	//	activate() : 
	activate : function(path,args) {
		var ability = args.ability;
		ability.end();

		var target = G.creatures[path.last().creature];
		var dist = 6 - target.size;
		var dir = [];
		switch( path[0].direction ){
			case 0: //Upright
				dir = G.grid.getHexMap(target.x,target.y-8,0,target.flipped,diagonalup).reverse();
				break;
			case 1: //StraitForward
				dir = G.grid.getHexMap(target.x,target.y,0,target.flipped,straitrow);
				break;
			case 2: //Downright
				dir = G.grid.getHexMap(target.x,target.y,0,target.flipped,diagonaldown);
				break;
			case 3: //Downleft
				dir = G.grid.getHexMap(target.x,target.y,-4,target.flipped,diagonalup);
				break;
			case 4: //StraitBackward
				dir = G.grid.getHexMap(target.x,target.y,0,!target.flipped,straitrow);
				break;
			case 5: //Upleft
				dir = G.grid.getHexMap(target.x,target.y-8,-4,target.flipped,diagonaldown).reverse();
				break;
			default:
				break;
		}

		dir = dir.slice(0,dist-1);

		var hex = target.hexagons[0];
		for (var j = 0; j < dir.length; j++) {
			if(dir[j].isWalkable(target.size,target.id,true)){
				hex = dir[j];
			}else{
				break;
			}
		};

		target.moveTo(hex,{
			ignoreMovementPoint : true,
			ignorePath : true,
			callback : function(){
				G.activeCreature.queryMove();
			},
		});
	},
},



// 	Fourth Ability Chilling Spit
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	damages : {
		slash : 2,
		pierce : 2,
		crush : 2
	},

	// 	require() :
	require : function(){return true;},

	// 	query() :
	query : function(){
		
		var ability = this;
		var snowBunny = this.creature;

		G.grid.queryDirection({
			fnOnConfirm : ability.activate, //fnOnConfirm
			flipped : snowBunny.player.flipped,
			team : 0, //enemies
			id : snowBunny.id,
			requireCreature : true,
			x : snowBunny.x,
			y : snowBunny.y,
			directions : [1,1,1,1,1,1],
			args : {snowBunny:snowBunny, ability: ability}
		});
	},


	//	activate() : 
	activate : function(path,args) {
		var ability = args.ability;
		ability.end();		

		crea = G.creatures[path.last().creature];
		var dist = path.filterCreature(false,false).length;

		//Copy to not alter ability strength
 		var dmg = $j.extend({},ability.damages); 
 		dmg.crush += dist; //Add distance to crush damage

		var damage = new Damage(
			args.snowBunny, //Attacker
			"target", //Attack Type
			dmg, //Damage Type
			1, //Area
			[]	//Effects
		)

		crea.takeDamage(damage);
	},
}

];
