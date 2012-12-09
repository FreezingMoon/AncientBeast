/*
*
*	Magma Spawn abilities
*
*/
abilities["L2"] =[

// 	First Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onStartPhase",

	//	Title
	title : "Infernal Temper",

	//	Description
	desc : "Bursts into flames when it's turn comes, damaging nearby foes.",

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



// 	Second Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Pulverize",

	//	Description
	desc : "Smacks a foe with its heavy hand.",

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

		optionalTest = function(hex,args){
			var creature = args.creature;

			if (creature.player.flipped) {
				if( creature.y % 2 == 0 ){
					var test = ( hex.x < creature.x-creature.size+2 );
				}else{
					var test = ( hex.x < creature.x-creature.size+1 );
				}
			}else{
				if( creature.y % 2 == 0 ){
					var test = ( hex.x > creature.x );
				}else{
					var test = ( hex.x > creature.x-1 );
				}
			}
			return test;
		}

		var x = (magmaSpawn.player.flipped) ? magmaSpawn.x-magmaSpawn.size+1 : magmaSpawn.x ;

		G.grid.queryCreature({
			fnOnConfirm : ability.activate, //fnOnConfirm
			fnOptTest : optionalTest,//fnOptTest
			team : 0, //Team, 0 = ennemies
			distance : 1, //Distance
			x : x, y : magmaSpawn.y, //coordinates
			id : magmaSpawn.id,
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



// 	Third Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Fissure",

	//	Description
	desc : "Smashes his fists into the ground, wreaking fierce havoc ahead.",

	damages : {
		burn : 15,
	},

	// 	require() :
	require : function(){return true;},

	// 	query() :
	query : function(){
		
		var ability = this;
		var magmaSpawn = this.creature;


		optionalTest = function(hex,args){
			var offset = (args.creature.player.flipped)
			? -1*(hex.x-(args.creature.x-args.creature.size+1))
			: hex.x-args.creature.x;

			//MAGIC LOGIC
			switch( Math.abs(args.creature.y-hex.y) ){
				case 0 :
					if(offset>0 && offset<3) return true;
					break;
				case 1 :
					if(args.creature.y%2==0){
						if(args.creature.player.flipped) offset += 1;
						if(offset>1 && offset<4) return true;	
					}else{
						if(args.creature.player.flipped) offset -= 1;
						if(offset>0 && offset<3) return true;
					}
					break;
				case 2 :
					if(offset==2) return true;
					break;
				default :
					return false;
					break
			}
		}

		fnOnClick = function(hex,args){
			var crea = args.creature;
			var x = (crea.player.flipped) ? crea.x-crea.size+1 : crea.x ;
			var area = G.grid.hexs[crea.y][x].adjacentHex(3);

			for (var j = 0; j < area.length; j++) {
				if( !args.optionalTest(area[j],args) ){
					area.splice(j,1);
					j--;
				}
			}

			G.grid.cleanOverlay("creature selected player"+G.activeCreature.team);
			G.grid.updateDisplay(); //Retrace players creatures

			area.each(function(){
				if(this.creature!=0){
					this.$overlay.addClass("creature selected player"+G.creatures[this.creature].team);
				}
				this.$display.addClass("adj");			
			});
		};

		fnOnMouseover = function(hex,args){
			var crea = args.creature;
			var x = (crea.player.flipped) ? crea.x-crea.size+1 : crea.x ;
			var area = G.grid.hexs[crea.y][x].adjacentHex(3);

			for (var j = 0; j < area.length; j++) {
				if( !args.optionalTest(area[j],args) ){
					area.splice(j,1);
					j--;
				}
			}

			G.grid.cleanOverlay("hover h_player"+G.activeCreature.team);

			area.each(function(){
				if(this.creature!=0){
					this.$overlay.addClass("hover h_player"+G.creatures[this.creature].team);
				}else{
					this.$overlay.addClass("hover h_player"+G.activeCreature.team);
				}
			});
		};

		var x = (magmaSpawn.player.flipped) ? magmaSpawn.x-magmaSpawn.size+1 : magmaSpawn.x ;

		G.grid.queryHexs(
			fnOnClick, //OnClick
			fnOnMouseover, //OnMouseover
			function(){G.activeCreature.queryMove()}, //OnCancel
			ability.activate, //OnConfirm
			optionalTest, //OptionalTest
			{creature:magmaSpawn, ability:ability , optionalTest:optionalTest}, //OptionalArgs
			false, //true for flying creatures
			1, //Include creature
			x,magmaSpawn.y,//Position
			3, //Distance
			magmaSpawn.id, //Creature ID
			magmaSpawn.size, //Size
			[], //Excluding hexs
			magmaSpawn.player.flipped //Flipped
		);

	},


	//	activate() : 
	activate : function(hex,args) {
		var ability = args.ability;
		ability.end();

		var crea = args.creature;
		var x = (crea.player.flipped) ? crea.x-crea.size+1 : crea.x ;
		var area = G.grid.hexs[crea.y][x].adjacentHex(3);

		for (var j = 0; j < area.length; j++) {
			if( !args.optionalTest(area[j],args) ){
				area.splice(j,1);
				j--;
			}
		}

		//Basic Attack all nearby creatures
		var targets = ability.getTargets(area);
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



// 	Fourth Ability
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	Title
	title : "Molten Hurl",

	//	Description
	desc : "Turns into a molten boulder, bowling itself into first foe in a straight line.",

	damages : {
		crush : 20,
		burn : 5,
	},

	require : function(){return true;},

	// 	query() :
	query : function(){
		
		var ability = this;
		var magmaSpawn = this.creature;

		var directions = (magmaSpawn.player.flipped)?
		[false,false,false,false,true,false]:
		[false,true,false,false,false,false]; 

		var x = (magmaSpawn.player.flipped) ? magmaSpawn.x-magmaSpawn.size+1 : magmaSpawn.x ;

		G.grid.queryDirection({
			fnOnConfirm : ability.activate,
			team : 0,
			distance : 99,
			directions : directions, //Only Front
			includeCreature : 1,
			stopOnFirstCreature : true,
			needCreature : true,
			x : x,
			y : magmaSpawn.y,
			id : magmaSpawn.id,
			args : {magmaSpawn:magmaSpawn, ability: ability}
		});
	},


	//	activate() : 
	activate : function(path,args) {
		var magmaSpawn = args.magmaSpawn;
		var ability = args.ability;
		ability.end();

		path.unshift(G.grid.hexs[magmaSpawn.y][magmaSpawn.x]);
		var destination = path[path.length-2];

		//Dirty hack, must find a way to handle flipped creature more nicely
		var x = (magmaSpawn.player.flipped) ? destination.x+magmaSpawn.size-1 : destination.x ;
		destination = G.grid.hexs[destination.y][x];

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