/*
*
*	Snow Bunny abilities
*
*/
G.abilities[12] = [

// 	First Ability: Bunny Hop
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onOtherCreatureMove",

	// 	require() :
	require : function(destHex) {
		if( !this.testRequirements() ) return false;

		if( this.used ) return false; // Once per turn

		if( !destHex || !destHex.creature ) return false; // If destHex is undefined

		if( destHex.creature.isAlly(this.creature.team) ) return false;

		var frontHexs = this.creature.getHexMap(front1hex);

		var id = -1;
		destHex.creature.hexagons.each(function() {
			id = ( frontHexs.indexOf(this) > id ) ? frontHexs.indexOf(this) : id;
		});

		switch( id ) {
			case 0 :
				var hex = this.creature.getHexMap(backbottom1hex)[0];
				if( hex == undefined || !hex.isWalkable(this.creature.size, this.creature.id, true) ) {
					var hex = this.creature.getHexMap(frontbottom1hex)[0];
				}
				break;
			case 1 :
				var hex = this.creature.getHexMap(inlineback1hex)[0];
				break;
			case 2 :
				var hex = this.creature.getHexMap(backtop1hex)[0];
				if( hex == undefined || !hex.isWalkable(this.creature.size, this.creature.id, true) ) {
					var hex = this.creature.getHexMap(fronttop1hex)[0];
				}
				break;
			default : return false;
		}

		if( hex == undefined ) return false;

		return hex.isWalkable(this.creature.size, this.creature.id, true);
	},

	//	activate() :
	activate : function(destHex) {
		var ability = this;
		ability.end();

		var frontHexs = this.creature.getHexMap(front1hex);

		var id = -1;
		destHex.creature.hexagons.each(function() {
			id = ( frontHexs.indexOf(this) > id ) ? frontHexs.indexOf(this) : id;
		});

		switch( id ) {
			case 0 :
				var hex = this.creature.getHexMap(backbottom1hex)[0];
				if( hex == undefined || !hex.isWalkable(this.creature.size, this.creature.id, true) ) {
					var hex = this.creature.getHexMap(frontbottom1hex)[0];
				}
				break;
			case 1 :
				var hex = this.creature.getHexMap(inlineback1hex)[0];
				break;
			case 2 :
				var hex = this.creature.getHexMap(backtop1hex)[0];
				if( hex == undefined || !hex.isWalkable(this.creature.size, this.creature.id, true) ) {
					var hex = this.creature.getHexMap(fronttop1hex)[0];
				}
				break;
			default : return false;
		}

		this.creature.moveTo(hex, {
			callback : function() {	G.activeCreature.queryMove(); },
			ignorePath : true,
		});

	},
},



// 	Second Ability: Big Nip
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( this.creature.adjacentHexs(1), "enemy" ) ) {
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	// 	query() :
	query : function() {

		var ability = this;
		var snowBunny = this.creature;

		G.grid.queryCreature( {
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			team : 0, // Team, 0 = enemies
			id : snowBunny.id,
			flipped : snowBunny.player.flipped,
			hexs : snowBunny.adjacentHexs(1),
		});
	},


	//	activate() :
	activate : function(target,args) {
		var ability = this;
		ability.end();

		var damage = new Damage(
			ability.creature, // Attacker
			ability.damages, // Damage Type
			1, // Area
			[]	// Effects
		);
		target.takeDamage(damage);
	},
},



// 	Third Ability: Blowing Wind
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	directions : [1,1,1,1,1,1],

	// 	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if (!this.testDirection({ team: "both", directions: this.directions })) {
			return false;
		}
		return true;
	},

	// 	query() :
	query : function() {
		var ability = this;
		var snowBunny = this.creature;

		G.grid.queryDirection( {
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			flipped : snowBunny.player.flipped,
			team : "both",
			id : snowBunny.id,
			requireCreature : true,
			x : snowBunny.x,
			y : snowBunny.y,
			directions : this.directions,
		});
	},


	//	activate() :
	activate : function(path,args) {
		var ability = this;
		ability.end();

		var target = path.last().creature;
		var dist = 5 - target.size;
		var dir = [];
		switch( args.direction ) {
			case 0: // Upright
				dir = G.grid.getHexMap(target.x, target.y-8, 0, target.flipped, diagonalup).reverse();
				break;
			case 1: // StraitForward
				dir = G.grid.getHexMap(target.x, target.y, 0, target.flipped, straitrow);
				break;
			case 2: // Downright
				dir = G.grid.getHexMap(target.x, target.y, 0, target.flipped, diagonaldown);
				break;
			case 3: // Downleft
				dir = G.grid.getHexMap(target.x, target.y, -4, target.flipped, diagonalup);
				break;
			case 4: // StraitBackward
				dir = G.grid.getHexMap(target.x, target.y, 0, !target.flipped, straitrow);
				break;
			case 5: // Upleft
				dir = G.grid.getHexMap(target.x, target.y-8, -4, target.flipped, diagonaldown).reverse();
				break;
			default:
				break;
		}

		dir = dir.slice(0, dist + 1);

		var hex = target.hexagons[0];
		for (var j = 0; j < dir.length; j++) {
			if(dir[j].isWalkable(target.size, target.id, true)) {
				hex = dir[j];
			}else{
				break;
			}
		};

		target.moveTo(hex, {
			ignoreMovementPoint : true,
			ignorePath : true,
			callback : function() {
				G.activeCreature.queryMove();
			},
			animation : "push",
		});
	},
},



// 	Fourth Ability: Freezing Spit
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	// 	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if (!this.testDirection({ team: "enemy", directions: this.directions })) {
			return false;
		}
		return true;
	},

	// 	query() :
	query : function() {

		var ability = this;
		var snowBunny = this.creature;

		G.grid.queryDirection( {
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			flipped : snowBunny.player.flipped,
			team : "enemy",
			id : snowBunny.id,
			requireCreature : true,
			x : snowBunny.x,
			y : snowBunny.y,
			directions : [1,1,1,1,1,1],
		});
	},


	//	activate() :
	activate : function(path, args) {
		var ability = this;
		ability.end();

		var crea = path.last().creature;
		var dist = path.slice(0).filterCreature(false, false).length;

		// Copy to not alter ability strength
 		var dmg = $j.extend( {}, ability.damages);
 		dmg.crush += 4*dist; // Add distance to crush damage

		var damage = new Damage(
			ability.creature, // Attacker
			dmg, // Damage Type
			1, // Area
			[]	// Effects
		);

		crea.takeDamage(damage);
	}
}

];
