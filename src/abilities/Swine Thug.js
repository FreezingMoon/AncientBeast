/*
 *
 *	Swine Thug abilities
 *
 */
G.abilities[37] = [

	// 	First Ability: Spa Goggles
	{
		//	Type : Can be "onQuery", "onStartPhase", "onDamage"
		trigger: "onCreatureMove",

		// 	require() :
		require: function(hex) {
			if (!this.testRequirements()) return false;

			if (hex == undefined) hex = this.creature.hexagons[0];
			this.message = "";
			if (hex.trap) {
				if (hex.trap.type == "mud-bath") {
					return true;
				}
			}

			this.message = "Not in a mud bath.";

			this.creature.effects.forEach(function(effect) {
				if (effect.trigger == "mud-bath") {
					effect.deleteEffect();
				}
			});

			return false;
		},

		//	activate() :
		activate: function(hex) {
			var alterations = $j.extend({}, this.effects[0]);
			// Double effect if upgraded
			if (this.isUpgraded()) {
				for (var k in alterations) {
					alterations[k] = alterations[k] * 2;
				}
			}
			var effect = new Effect("Spa Goggles", this.creature, this.creature, "mud-bath", {
				alterations: alterations
			});
			this.creature.addEffect(effect);

			// Log message, assume that all buffs are the same amount, and there are
			// only two buffs (otherwise the grammar doesn't make sense)
			var log = "%CreatureName" + this.creature.id + "%'s ";
			var first = true;
			var amount;
			for (var k in alterations) {
				if (!first) {
					log += "and ";
				}
				log += k + " ";
				first = false;
				amount = alterations[k];
			}
			log += "+" + amount;
			G.log(log);
		},
	},



	// 	Second Ability: Baseball Baton
	{
		//	Type : Can be "onQuery", "onStartPhase", "onDamage"
		trigger: "onQuery",

		_targetTeam: Team.enemy,

		// 	require() :
		require: function() {
			if (!this.testRequirements()) return false;

			if (!this.atLeastOneTarget(
					this.creature.adjacentHexes(1), {
						team: this._targetTeam
					})) {
				return false;
			}
			return true;
		},

		// 	query() :
		query: function() {

			var ability = this;
			var swine = this.creature;

			G.grid.queryDirection({
				fnOnConfirm: function() {
					ability.animation.apply(ability, arguments);
				},
				flipped: swine.player.flipped,
				team: this._targetTeam,
				id: swine.id,
				requireCreature: true,
				x: swine.x,
				y: swine.y,
				sourceCreature: swine,
				stopOnCreature: false,
				distance: 1
			});
		},

		activate: function(path, args) {
			var ability = this;
			ability.end();

			var target = arrayUtils.last(path).creature;
			var damage = new Damage(
				ability.creature, // Attacker
				ability.damages, // Damage Type
				1, // Area
				[] // Effects
			);
			var result = target.takeDamage(damage);
			// Knock the target back if they are still alive
			if (!result.kill) {
				// See how far we can knock the target back
				// For regular ability, this is only 1 hex
				// For upgraded, as long as the target is over a mud tile, keep sliding

				// See how far the target can be knocked back
				// Skip the first hex as it is the same hex as the target
				var hexes = G.grid.getHexLine(
					target.x, target.y, args.direction, target.flipped);
				hexes.splice(0, 1);
				var hex = null;
				for (var i = 0; i < hexes.length; i++) {
					// Check that the next knockback hex is valid
					if (!hexes[i].isWalkable(target.size, target.id, true)) break;

					hex = hexes[i];

					if (!this.isUpgraded()) break;
					// Check if we are over a mud bath
					// The target must be completely over mud baths to keep sliding
					var mudSlide = true;
					for (var j = 0; j < target.size; j++) {
						var mudHex = G.grid.hexes[hex.y][hex.x - j];
						if (!mudHex.trap || mudHex.trap.type !== "mud-bath") {
							mudSlide = false;
							break;
						}
					}
					if (!mudSlide) break;
				}
				if (hex !== null) {
					target.moveTo(hex, {
						callback: function() {
							G.activeCreature.queryMove();
						},
						ignoreMovementPoint: true,
						ignorePath: true,
						overrideSpeed: 1200, // Custom speed for knockback
						animation: "push",
					});
				}
			}
		},
	},



	// 	Third Ability: Ground Ball
	{
		//	Type : Can be "onQuery", "onStartPhase", "onDamage"
		trigger: "onQuery",

		_targetTeam: Team.enemy,

		// 	require() :
		require: function() {
			if (!this.testRequirements()) return false;

			var bellowrow = matrices.bellowrow;
			var straitrow = matrices.straitrow;

			var swine = this.creature;
			var hexes = arrayUtils.filterCreature(G.grid.getHexMap(swine.x, swine.y - 2, 0, false, bellowrow), true, true, swine.id, swine.team).concat(
				arrayUtils.filterCreature(G.grid.getHexMap(swine.x, swine.y, 0, false, straitrow), true, true, swine.id, swine.team),
				arrayUtils.filterCreature(G.grid.getHexMap(swine.x, swine.y, 0, false, bellowrow), true, true, swine.id, swine.team),
				arrayUtils.filterCreature(G.grid.getHexMap(swine.x, swine.y - 2, 0, true, bellowrow), true, true, swine.id, swine.team),
				arrayUtils.filterCreature(G.grid.getHexMap(swine.x, swine.y, 0, true, straitrow), true, true, swine.id, swine.team),
				arrayUtils.filterCreature(G.grid.getHexMap(swine.x, swine.y, 0, true, bellowrow), true, true, swine.id, swine.team));
			if (!this.atLeastOneTarget(hexes, {
					team: this._targetTeam
				})) {
				return false;
			}

			return true;
		},

		// 	query() :
		query: function() {
			var bellowrow = matrices.bellowrow;
			var straitrow = matrices.straitrow;


			var ability = this;
			var swine = this.creature;

			var choices = [
				// Front
				G.grid.getHexMap(swine.x, swine.y - 2, 0, false, bellowrow),
				G.grid.getHexMap(swine.x, swine.y, 0, false, straitrow),
				G.grid.getHexMap(swine.x, swine.y, 0, false, bellowrow),
				// Behind
				G.grid.getHexMap(swine.x, swine.y - 2, 0, true, bellowrow),
				G.grid.getHexMap(swine.x, swine.y, 0, true, straitrow),
				G.grid.getHexMap(swine.x, swine.y, 0, true, bellowrow),
			];

			choices.forEach(function(choice) {
				arrayUtils.filterCreature(choice, true, true, swine.id);
			});

			G.grid.queryChoice({
				fnOnConfirm: function() {
					ability.animation.apply(ability, arguments);
				}, // fnOnConfirm
				team: this._targetTeam,
				requireCreature: 1,
				id: swine.id,
				flipped: swine.flipped,
				choices: choices,
			});
		},


		//	activate() :
		activate: function(path, args) {
			var ability = this;
			ability.end();

			var target = arrayUtils.last(path).creature;

			// If upgraded, hits will debuff target with -1 meditation
			if (this.isUpgraded()) {
				var effect = new Effect("Ground Ball", ability.creature, target, "onDamage", {
					alterations: {
						meditation: -1
					}
				});
				target.addEffect(effect);
				G.log("%CreatureName" + target.id + "%'s meditation is lowered by 1");
			}

			var damage = new Damage(
				ability.creature, // Attacker
				ability.damages, // Damage Type
				1, // Area
				[] // Effects
			);
			target.takeDamage(damage);
		},
	},



	// 	Fourth Ability: Mud Bath
	{
		//	Type : Can be "onQuery", "onStartPhase", "onDamage"
		trigger: "onQuery",

		_energyNormal: 30,
		_energySelfUpgraded: 10,

		require: function() {
			// If ability is upgraded, self cast energy cost is less
			if (this.isUpgraded()) {
				this.requirements = {
					energy: this._energySelfUpgraded
				};
				this.costs = {
					energy: this._energySelfUpgraded
				};
			} else {
				this.requirements = {
					energy: this._energyNormal
				};
				this.costs = {
					energy: this._energyNormal
				};
			}
			return this.testRequirements();
		},

		// 	query() :
		query: function() {

			var ability = this;
			var swine = this.creature;
			var size = 1;

			// Check if the ability is upgraded because then the self cast energy cost is less
			var selfOnly = this.isUpgraded() && this.creature.energy < this._energyNormal;

			var hexes = [];
			if (!selfOnly) {
				// Gather all the reachable hexes, including the current one
				hexes = G.grid.getFlyingRange(swine.x, swine.y, 50, 1, 0);
			}
			hexes.push(G.grid.hexes[swine.y][swine.x]);

			//TODO: Filtering corpse hexes
			//TODO: Add this code back in when its actually used.
			// hexes = hexes.filter(function(hex) {
			// 	return true;
			// });

			G.grid.hideCreatureHexes(this.creature);

			G.grid.queryHexes({
				fnOnCancel: function() {
					G.activeCreature.queryMove();
					G.grid.clearHexViewAlterations();
				},
				fnOnConfirm: function() {
					ability.animation.apply(ability, arguments);
				},
				hexes: hexes,
				hideNonTarget: true
			});
		},


		//	activate() :
		activate: function(hex, args) {
			G.grid.clearHexViewAlterations();
			var ability = this;
			var swine = this.creature;

			// If upgraded and cast on self, cost is less
			var isSelf = hex.x === swine.x && hex.y === swine.y;
			if (this.isUpgraded() && isSelf) {
				this.requirements = {
					energy: this._energySelfUpgraded
				};
				this.costs = {
					energy: this._energySelfUpgraded
				};
			} else {
				this.requirements = {
					energy: this._energyNormal
				};
				this.costs = {
					energy: this._energyNormal
				};
			}

			ability.end();

			var effects = [
				new Effect(
					"Slow Down", ability.creature, hex, "onStepIn", {
						requireFn: function() {
							if (!this.trap.hex.creature) return false;
							return this.trap.hex.creature.type != "A1";
						},
						effectFn: function(effect, crea) {
							crea.remainingMove--;
						},
					}
				),
			];


			hex.createTrap("mud-bath", effects, ability.creature.player);

			// Trigger trap immediately if on self
			if (isSelf) {
				// onCreatureMove is Spa Goggles' trigger event
				G.triggersFn.onCreatureMove(swine, hex);
			}

		},
	}

];
