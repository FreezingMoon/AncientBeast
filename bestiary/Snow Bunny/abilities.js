/*
*
*	Snow Bunny abilities
*
*/
abilities["S1"] =[

// 	First Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onDamage",

	//	Title
	title : "Bunny Hopping",

	//	Description
	desc : "Avoids basic attack by moving to an available adjacent location.",

	// 	require() :
	require : function(damage){
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
				damage.dodged = true;
				break; //Break for loop
			}
		};
		this.end();
		return damage;
	},
},



// 	Second Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Big Nip",

	//	Description
	desc : "Dents nearby foe using it's big teeth.",

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
			fnOptTest : function(){return true},//fnOptTest
			team : 0, //Team, 0 = ennemies
			distance : 1, //Distance
			x : snowBunny.x, y : snowBunny.y, //coordinates
			id : snowBunny.id,
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



// 	Third Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Blowing Wind",

	//	Description
	desc : "Pushes an inline creature several hexagons backwards, based on size.",

	// 	require() :
	require : function(){return true;},

	// 	query() :
	query : function(){
		
		var ability = this;
		var snowBunny = this.creature;

		var directions = (snowBunny.player.flipped)?
		[false,false,false,true,true,true]:
		[true,true,true,false,false,false]; 

		G.grid.queryDirection({
			fnOnConfirm : ability.activate,
			team : 0,
			distance : 99,
			directions : directions, //Only Front
			includeCreature : 1,
			stopOnFirstCreature : true,
			needCreature : true,
			x : snowBunny.x,
			y : snowBunny.y,
			id : snowBunny.id,
			args : {snowBunny:snowBunny, ability: ability}
		});
	},


	//	activate() : 
	activate : function(path,args) {
		var ability = args.ability;
		ability.end();		

		crea = G.creatures[path.last().creature];
		var dist = 6 - crea.size;

		var direction = path[0].direction;
		var a = b = 0;
		switch(direction){ //Numbered Clockwise
			case 1 : //Right
				b = 1;
				break;
			case 0 : //Up-Right
				a = -1;
				b = 1;
				break;
			case 2 : //Down-Right
				a = 1;
				b = 1;
				break;
			case 4 : //Left
				b = -1;
				break;
			case 5 : //Up-Left
				a = -1;
				b = -1;
				break;
			case 3 : //Down-Left
				a = 1;
				b = -1;
				break;
		}

		//Gathering all hex in that direction
		var hex = G.grid.hexs[crea.y][crea.x];
		for (var j = 0; j < dist; j++) {
			if(a==0){
				if( !G.grid.hexExists(hex.y+a,hex.x+b)) break;
				nextPos = G.grid.hexs[hex.y+a][hex.x+b];
			}else{
				if(b>0){
					if( hex.y%2 == 0 ){
						if( !G.grid.hexExists(hex.y+a,hex.x+b)) break;
						nextPos = G.grid.hexs[hex.y+a][hex.x+b];
					}else{
						if( !G.grid.hexExists(hex.y+a,hex.x)) break;
						nextPos = G.grid.hexs[hex.y+a][hex.x];
					}
				}else{
					if( hex.y%2 == 0 ){
						if( !G.grid.hexExists(hex.y+a,hex.x)) break;
						nextPos = G.grid.hexs[hex.y+a][hex.x];
					}else{
						if( !G.grid.hexExists(hex.y+a,hex.x+b)) break;
						nextPos = G.grid.hexs[hex.y+a][hex.x+b];
					}
				}
			}

			if(nextPos.isWalkable(crea.size,crea.id,true)){
				hex = nextPos;
			}else{
				break;
			}
		};

		crea.moveTo(hex,{
			ignoreMovementPoint : true,
			ignorePath : true,
			callback : function(){
				G.activeCreature.queryMove();
			},
		});
	},
},



// 	Fourth Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Chilling Spit",

	//	Description
	desc : "Spits inline foe with cold saliva. Bonus damage based on distance.",

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

		var directions = [true,true,true,true,true,true];

		G.grid.queryDirection({
			fnOnConfirm : ability.activate,
			team : snowBunny.team,
			distance : 99,
			directions : directions,
			includeCreature : 1, //Only ennemies
			stopOnFirstCreature : true,
			needCreature : true,
			x : snowBunny.x,
			y : snowBunny.y,
			id : snowBunny.id,
			args : {snowBunny:snowBunny, ability: ability}
		});
	},


	//	activate() : 
	activate : function(path,args) {
		var ability = args.ability;
		ability.end();		

		crea = G.creatures[path.last().creature];
		var dist = path.length;

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
