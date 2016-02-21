/*
*
*	Snow Bunny abilities
*
*/
G.abilities[12] = [

// 	First Ability: Bunny Hopping
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onOtherCreatureMove",

	// 	require() :
	require : function(destHex) {
		if( !this.testRequirements() ) return false;

		if( this.used ) return false; // Once per turn

		if( !destHex ) return false; // If destHex is undefined

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

		if( !this.atLeastOneTarget( this.creature.adjacentHexs(1), "ennemy" ) ) {
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
			team : 0, // Team, 0 = ennemies
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
			"target", // Attack Type
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

		var test = this.testDirection( {
			team : "both",
			directions : this.directions,
		});
		if( !test ) {
			this.message = G.msg.abilities.notarget;
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
			team : 3, // Both
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

		dir = dir.slice(0, dist+1);

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

		var test = this.testDirection( {
			team : "ennemy",
			directions : this.directions,
		});
		if( !test ) {
			this.message = G.msg.abilities.notarget;
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
			team : 0, //enemies
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
			"target", // Attack Type
			dmg, // Damage Type
			1, // Area
			[]	// Effects
		)

		crea.takeDamage(damage);
	},

	animation_data : {
		visual : function(path, args) {

			var crea = path.last().creature;
			if( args.direction == 1 || args.direction == 4 ) {
				var targetHex = path[ path.length - 1 - crea.size ];
			}else{
				var targetHex = path.last();
			}
			var dist = path.slice(0).filterCreature(false, false).length;

			var emissionPoint = { x: this.creature.grp.x+52, y: this.creature.grp.y-20 };
			var targetPoint = { x: targetHex.displayPos.x+52, y: targetHex.displayPos.y-20 };

			var duration = this.animation_data.delay = dist*75; // 100ms for each hex
			this.animation_data.delay += 350; // 350ms for the creature animation before the projectile

			setTimeout(function() {
				var sprite = G.grid.creatureGroup.create(emissionPoint.x, emissionPoint.y, "effects_freezing-spit");
				sprite.anchor.setTo(0.5, 0.5);
				sprite.rotation = -Math.PI/3 + args.direction * Math.PI/3;
				var tween = G.Phaser.add.tween(sprite)
				.to( { x: targetPoint.x, y: targetPoint.y }, duration, Phaser.Easing.Linear.None)
				.start();
				tween._lastChild.onComplete.add(function() { sprite.destroy() }, this);
			}, 350); // 350ms for the creature animation before the projectile

		},
		duration : 500,
		delay : 350,
	},
}

];
