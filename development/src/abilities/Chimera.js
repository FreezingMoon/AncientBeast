/*
*
*	Chimera abilities
*
*/
G.abilities[45] =[

// 	First Ability: Cyclic Duality
{
	trigger: "onReset",

	//	require() :
	require : function(){
		return this.testRequirements();
	},

	activate: function() {
		// Only activate when fatigued
		if (!this.creature.isFatigued()) {
			return;
		}

		if (this.isUpgraded()) {
			this.creature.heal(Math.floor(this.creature.stats.regrowth / 2), true);
		}
		if (this.creature.stats.meditation > 0) {
			this.creature.recharge(Math.floor(this.creature.stats.meditation / 2));
		}
	}
},



//	Second Ability: Tooth Fairy
{
	//	Type : Can be "onQuery","onStartPhase","onDamage"
	trigger : "onQuery",

	//	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if( !this.atLeastOneTarget( G.grid.getHexMap(this.creature.x-3,this.creature.y-2,0,false,frontnback3hex),"enemy" ) ){
			this.message = G.msg.abilities.notarget;
			return false;
		}

		return true;
	},

	//	query() :
	query : function() {
		var ability = this;
		var chimera = this.creature;

		G.grid.queryCreature( {
			fnOnConfirm : function() { ability.animation.apply(ability, arguments); },
			team : 0, // Team, 0 = enemies
			id : chimera.id,
			flipped : chimera.flipped,
			hexs : G.grid.getHexMap(chimera.x - 3, chimera.y - 2, 0, false, frontnback3hex),
		});
	},


	//	activate() :
	activate : function(target, args) {
		var ability = this;

		ability.end();

		var damage = new Damage(
			ability.creature, // Attacker
			ability.damages, // Damage Type
			1, // Area
			[]	// Effects
		);
		target.takeDamage(damage);
		if (this.isUpgraded()) {
			// Second attack
			target.takeDamage(damage);
		}
	},
},

//	Third Ability: Disturbing Sound
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	//	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if (!this.testDirection({ team: "both", sourceCreature: this.creature })) {
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	//	query() :
	query : function(){
		var ability = this;
		var chimera = this.creature;

		G.grid.queryDirection({
			fnOnConfirm : function(){ ability.animation.apply(ability, arguments); },
			flipped : chimera.player.flipped,
			team : "both",
			id : chimera.id,
			requireCreature : true,
			x : chimera.x,
			y : chimera.y,
			sourceCreature: chimera
		});
	},


	//	activate() :
	activate : function(path, args) {
		var ability = this;

		ability.end();

		var target = path.last().creature;
		var hexes = G.grid.getHexLine(
			target.x, target.y, args.direction, target.flipped);

		var damage = new Damage(
			ability.creature, // Attacker
			ability.damages, // Damage Type
			1, // Area
			[]	// Effects
		);
		result = target.takeDamage(damage);

		var i = 0;
		while(result.kill) {
			i++;
			if (i >= hexes.length) {
				break;
			}
			var hex = hexes[i];
			if (!hex.creature) {
				continue;
			}
			target = hex.creature;

			// extra sonic damage if upgraded
			var sonic = result.damages.sonic + this.isUpgraded() ? 9 : 0;
			if (sonic <= 0) {
				break;
			}
			damage = new Damage(
				ability.creature, // Attacker
				{sonic: sonic}, // Damage Type
				1, // Area
				[]	// Effects
			);
			result = target.takeDamage(damage);
		}
	}
},

// Fourth Ability: Battering Ram
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	_getHexes: function() {
		return G.grid.getHexMap(
			this.creature.x - 3, this.creature.y - 2, 0, false, frontnback3hex);
	},

	require : function() {
		if( !this.testRequirements() ) return false;

		if (!this.atLeastOneTarget(this._getHexes(), "both")) {
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	//	query() :
	query : function(){
		var ability = this;
		var chimera = this.creature;

		G.grid.queryCreature({
			fnOnConfirm: function() { ability.animation.apply(ability, arguments); },
			team: 3, // Team, 3 = both
			id: chimera.id,
			flipped: chimera.flipped,
			hexs: this._getHexes()
		});
	},

	activate: function(target, args) {
		var ability = this;
		this.end();

		// Calculate relative direction from creature to target
		var dx = target.x - ability.creature.x;
		var dy = target.y - ability.creature.y;
		var dir = getDirectionFromDelta(target.y, dx, dy);

		var knockback = function(_target, _crush, _range) {
			var damage = new Damage(
				ability.creature, // Attacker
				{crush: _crush}, // Damage Type
				1, // Area
				[]	// Effects
			);
			var result = _target.takeDamage(damage);
			// Knock the target back if they are still alive and there is enough range
			if (result.kill || _range <= 0) {
				return;
			}
			// See how far we can knock the target back
			var hexes = G.grid.getHexLine(_target.x, _target.y, dir, _target.flipped);
			// Skip the first hex as it is the same hex as the target
			hexes = hexes.splice(1, _range + 1);
			var hex = null;
			var nextHex = null;
			// See how far the target can be knocked back
			for (var i = 0; i < hexes.length; i++) {
				nextHex = hexes[i];
				// Check that the next knockback hex is valid
				if (i === hexes.length - 1) break;
				if (!hexes[i].isWalkable(_target.size, _target.id, true)) break;
				hex = hexes[i];
			}
			if (hex !== null) {
				_target.moveTo(hex, {
					callback: function() {
						// If there's a next creature to knockback into, continue
						// recursively, otherwise end and return to Chimera's turn
						if (nextHex !== null && nextHex !== hex && nextHex.creature) {
							// Diminishing crush damage if unupgraded
							var crush = ability.isUpgraded() ? _crush : _crush - 5;
							// Diminishing range if unupgraded
							var range = ability.isUpgraded() ? _range : _range - 1;
							knockback(nextHex.creature, crush, range);
						} else {
							G.activeCreature.queryMove();
						}
					},
					ignoreMovementPoint: true,
					ignorePath: true,
					overrideSpeed: 400, // Custom speed for knockback
					animation: "push"
				});
			}
		};

		var crush = this.damages.crush;
		var range = 3;
		knockback(target, crush, range);
	}
}

];
