/*
*
*	Nutcase abilities
*
*/
G.abilities[40] =[

//	First Ability: Tentacle Bush
{
	trigger: "onUnderAttack",

	require: function() {
		// Always true to highlight ability
		return true;
	},

	activate: function(damage) {
		if (damage === undefined) {
			return false;
		}
		var ability = this;
		ability.end();

		// Target becomes unmoveable until end of their phase
		var o = {
			alterations: { moveable: false },
			deleteTrigger: "onEndPhase",
			// Delete this effect as soon as attacker's turn finishes
			turnLifetime: 1,
			creationTurn: G.turn - 1,
		};
		// If upgraded, target abilities cost more energy
		if (this.isUpgraded()) {
			o.alterations.reqEnergy = 5;
		}
		damage.attacker.addEffect(new Effect(
			this.title,
			this.creature, // Caster
			damage.attacker, // Target
			"", // Trigger
			o
		));
		// Nutcase becomes unmoveable until start of its phase
		this.creature.addEffect(new Effect(
			this.title,
			this.creature,
			this.creature,
			"",
			{
				alterations: { moveable: false },
				deleteTrigger: "onStartPhase",
				turnLifetime: 1
			}
		));
		// Making attacker unmoveable will change its move query, so update it
		if (damage.attacker === G.activeCreature) {
			damage.attacker.queryMove();
		}
	}
},

//	Second Ability: Hammer Time
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	_targetTeam: Team.enemy,

	//	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if (!this.atLeastOneTarget(
				this.creature.getHexMap(frontnback2hex), this._targetTeam)) {
			this.message = G.msg.abilities.notarget;
			return false;
		}

		return true;
	},

	//	query() :
	query : function(){
		var ability = this;

		G.grid.queryCreature( {
			fnOnConfirm : function(){ ability.animation.apply(ability, arguments); },
			team: this._targetTeam,
			id : this.creature.id,
			flipped : this.creature.flipped,
			hexs : this.creature.getHexMap(frontnback2hex)
		});
	},


	//	activate() :
	activate : function(target,args) {
		var ability = this;
		ability.end();

		// Target takes pierce damage if it ever moves
		var effect = new Effect(
			"Hammered", // Name
			ability.creature, // Caster
			target, // Target
			"onStepOut", // Trigger
			{
				effectFn: function(effect) {
					effect.target.takeDamage(new Damage(
						effect.owner, { pierce: ability.damages.pierce }, 1, []));
					effect.deleteEffect();
				}
			}
		);

		var damage = new Damage(
			ability.creature, // Attacker
			ability.damages, // Damage Type
			1, // Area
			[effect]	// Effects
		);

		target.takeDamage(damage);
	},
},

// 	Third Ability: War Horn
{
	trigger: "onQuery",

	_directions : [0, 1, 0, 0, 1, 0],	// forward/backward
	_targetTeam: Team.enemy,

	//	require() :
	require : function() {
		if( !this.testRequirements() ) return false;
		if (!this.testDirection({
				team: this._targetTeam, directions: this._directions
			})) {
			return false;
		}
		return true;
	},

	query: function() {
		var ability = this;

		var o = {
			fnOnConfirm: function() {
				ability.animation.apply(ability, arguments);
			},
			team: this._targetTeam,
			requireCreature: true,
			id: this.creature.id,
			sourceCreature: this.creature,
			x: this.creature.x,
			y: this.creature.y,
			directions: this._directions,
			dashedHexesAfterCreatureStop: false
		};
		if (!this.isUpgraded()) {
			G.grid.queryDirection(o);
		} else {
			// Create custom choices containing normal directions plus hex choices
			// past the first creature, extending up to the next obstacle
			o = G.grid.getDirectionChoices(o);
			var newChoices = [];
			for (var i = 0; i < o.choices.length; i++) {
				var j;
				var direction = o.choices[i][0].direction;

				// Add dashed hexes up to the next obstacle for this direction choice
				var fx = 0;
				if (o.sourceCreature instanceof Creature) {
					if ((!o.sourceCreature.player.flipped && direction > 2) ||
							(o.sourceCreature.player.flipped && direction < 3)) {
						fx = -(o.sourceCreature.size - 1);
					}
				}
				var line = G.grid.getHexLine(o.x + fx, o.y, direction, o.flipped);
				o.choices[i].each(function() { line.removePos(this); });
				line.filterCreature(false, true, o.id);
				o.hexesDashed = o.hexesDashed.concat(line);

				// For each dashed hex, create a new choice composed of the original
				// choice, extended up to and including the dashed hex. This will be the
				// choice that pushes the target up to that hex.
				// Get a new hex line so that the hexes are in the right order
				var newChoice = G.grid.getHexLine(o.x + fx, o.y, direction, o.flipped);
				// Exclude creature
				ability.creature.hexagons.each(function() {
					if (newChoice.findPos(this)) {
						newChoice.removePos(this);
					}
				});
				// Exclude hexes that don't exist in the original choice
				for (j = 0; j < newChoice.length; j++) {
					if (!o.choices[i].findPos(newChoice[j])) {
						newChoice.removePos(newChoice[j]);
						j--;
					}
				}
				// Extend choice to include each dashed hex in succession
				for (j = 0; j < line.length; j++) {
					newChoice.push(line[j]);
					newChoices.push(newChoice.slice());
				}
			}
			o.choices = o.choices.concat(newChoices);
			o.requireCreature = false;
			G.grid.queryChoice(o);
		}
	},

	activate: function(path, args) {
		var i;
		var ability = this;
		this.end();

		// Find:
		// - the target which is the first creature in the path
		// - the run path which is up to the creature
		// - the push paths which start from the last creature hex and continues to
		//   the rest of the path
		var target;
		var runPath;
		var pushPath = [];
		for (i = 0; i < path.length; i++) {
			if (path[i].creature) {
				target = path[i].creature;
				runPath = path.slice(0, i);
				if (i > 0) {
					pushPath = path.slice(i);
				}
				break;
			}
		}
		var destination = runPath.last();
		if (args.direction === 4) {
			destination =
				G.grid.hexs[destination.y][destination.x + this.creature.size - 1];
		}

		// Calculate damage, extra damage per hex distance
		var damages = $j.extend({}, this.damages);
		damages.pierce += runPath.length;
		var damage = new Damage(this.creature, damages, 1, []);

		G.grid.cleanReachable();
		this.creature.moveTo(destination, {
			overrideSpeed: 100,
			ignoreMovementPoint: true,
			callback: function() {
				var interval = setInterval(function() {
					if (!G.freezedInput) {
						clearInterval(interval);

						// Deal damage only if we have reached the end of the path
						if (destination.creature === ability.creature) {
							target.takeDamage(damage);
						}

						if (!ability._pushTarget(target, pushPath, args)) {
							G.activeCreature.queryMove();
						}
					}
				}, 100);
			},
		});
	},

	_pushTarget: function(target, pushPath, args) {
		var ability = this;
		var creature = this.creature;

		var targetPushPath = pushPath.slice();
		targetPushPath.filterCreature(false, false, creature.id);
		targetPushPath.filterCreature(false, false, target.id);
		if (targetPushPath.length === 0) {
			return false;
		}

		// Push the creature one hex at a time
		// As we need to move creatures simultaneously, we can't use the normal path
		// calculation as the target blocks the path
		var i = 0;
		var interval = setInterval(function() {
			if (!G.freezedInput) {
				if (i === targetPushPath.length ||
						creature.dead || target.dead ||
						!creature.stats.moveable || !target.stats.moveable) {
					clearInterval(interval);
					creature.facePlayerDefault();
					G.activeCreature.queryMove();
				} else {
					var hex = pushPath[i];
					var targetHex = targetPushPath[i];
					if (args.direction === 4) {
						hex = G.grid.hexs[hex.y][hex.x + creature.size - 1];
						targetHex = G.grid.hexs[targetHex.y][targetHex.x + target.size - 1];
					}
					ability._pushOneHex(target, hex, targetHex);
					i++;
				}
			}
		});

		return true;
	},

	_pushOneHex: function(target, hex, targetHex) {
		var opts = {
			overrideSpeed: 100,
			ignorePath: true,
			ignoreMovementPoint: true,
			turnAroundOnComplete: false
		};
		// Note: order matters here; moving ourselves first results on overlapping
		// hexes momentarily and messes up creature hex displays
		target.moveTo(targetHex, $j.extend({ animation: 'push' }, opts));
		this.creature.moveTo(hex, opts);
	}
},

//	Third Ability: Fishing Hook
{
	//	Type : Can be "onQuery", "onStartPhase", "onDamage"
	trigger : "onQuery",

	_targetTeam: Team.enemy,

	//	require() :
	require : function() {
		if( !this.testRequirements() ) return false;

		if (!this.atLeastOneTarget(
				this.creature.getHexMap(inlinefrontnback2hex), this._targetTeam)) {
			this.message = G.msg.abilities.notarget;
			return false;
		}
		return true;
	},

	//	query() :
	query : function() {
		var ability = this;

		G.grid.queryCreature( {
			fnOnConfirm : function(){ ability.animation.apply(ability, arguments); },
			team: this._targetTeam,
			id : this.creature.id,
			flipped : this.creature.flipped,
			hexs : this.creature.getHexMap(inlinefrontnback2hex),
		});
	},


	//	activate() :
	activate : function(target,args) {
		var ability = this;
		var crea = ability.creature;
		ability.end();

		var damage = new Damage(
			crea, // Attacker
			ability.damages, // Damage Type
			1, // Area
			[]	// Effects
		);

		// Swap places
		if( target.size > 2 ) {
			target.takeDamage(damage);
			return;
		}

		var trgIsInfront = (G.grid.getHexMap(crea.x-inlinefront2hex.origin[0], crea.y-inlinefront2hex.origin[1], 0, false, inlinefront2hex)[0].creature == target);

		crea.moveTo(
			G.grid.hexs[target.y][ target.size == 1 && !trgIsInfront ? target.x+1 : target.x ],
			{
				ignorePath: true,
				ignoreMovementPoint: true,
				callback:function() {
					target.updateHex();
					G.grid.updateDisplay();
					target.takeDamage(damage);
				}
			}
		);
		target.moveTo(
			G.grid.hexs[crea.y][ target.size == 1 && trgIsInfront ? crea.x-1 : crea.x ],
			{
				ignorePath: true,
				ignoreMovementPoint: true,
				callback:function(){
					crea.updateHex();
					G.grid.updateDisplay();
					crea.queryMove();
				}
			}
		);
	},
}

];
