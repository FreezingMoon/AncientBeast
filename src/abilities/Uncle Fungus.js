/*
 *
 *	Uncle Fungus abilities
 *
 */
G.abilities[3] = [

	// First Ability: Toxic Spores
	{
		// Type : Can be "onQuery", "onStartPhase", "onDamage"
		triggerFunc: function() {
			if (this.isUpgraded()) {
				return "onUnderAttack onAttack";
			}
			return "onUnderAttack";
		},

		priority: 10,

		// require() :
		require: function(damage) {
			if (!this.testRequirements()) return false;

			// Check that attack is melee from actual creature, not from trap
			if (damage && damage.melee !== undefined) {
				return damage.melee && !damage.isFromTrap;
			}
			// Always return true so that ability is highlighted in UI
			return true;
		},

		// activate() :
		activate: function(damage) {
			var ability = this;
			var creature = this.creature;

			if (!damage || !damage.melee) return;

			// ability may trigger both onAttack and onUnderAttack;
			// the target should be the other creature
			var target = damage.attacker === creature ? damage.target : damage.attacker;

			var optArg = {
				alterations: ability.effects[0],
				creationTurn: G.turn - 1,
				stackable: true
			};

			ability.end();

			// Spore Contamination
			var effect = new Effect(
				ability.title, // Name
				creature, // Caster
				target, // Target
				"", // Trigger
				optArg, // Optional arguments
				G
			);

			target.addEffect(effect, undefined, "Contaminated");

			G.log("%CreatureName" + target.id + "%'s regrowth is lowered by " + ability.effects[0].regrowth);

			ability.setUsed(false); // Infinite triggering
		},
	},



	//	Second Ability: Supper Chomp
	{
		// Type : Can be "onQuery", "onStartPhase", "onDamage"
		trigger: "onQuery",

		_targetTeam: Team.enemy,

		// require() :
		require: function() {
			if (!this.testRequirements()) return false;

			// At least one target
			if (!this.atLeastOneTarget(
					this.creature.getHexMap(matrices.frontnback2hex), {
						team: this._targetTeam
					})) {
				return false;
			}
			return true;
		},

		// query() :
		query: function() {
			var uncle = this.creature;
			var ability = this;

			G.grid.queryCreature({
				fnOnConfirm: function() {
					ability.animation.apply(ability, arguments);
				},
				team: this._targetTeam,
				id: uncle.id,
				flipped: uncle.flipped,
				hexes: uncle.getHexMap(matrices.frontnback2hex),
			});
		},


		// activate() :
		activate: function(target, args) {
			var ability = this;
			ability.end();

			var damage = new Damage(
				ability.creature, // Attacker
				ability.damages, // Damage type
				1, // Area
				[], // Effects
				G
			);

			var dmg = target.takeDamage(damage);

			if (dmg.damageObj.status === "") {

				var amount = Math.max(Math.round(dmg.damages.total / 2), 1);

				// If upgraded, heal immediately up to the amount of health lost so far;
				// use the remainder as regrowth
				if (this.isUpgraded()) {
					var healthLost = this.creature.stats.health - this.creature.health;
					if (healthLost > 0) {
						var healAmount = Math.min(amount, healthLost);
						amount -= healAmount;
						this.creature.heal(healAmount, false);
					}
				}

				// Regrowth bonus
				if (amount > 0) {
					ability.creature.addEffect(new Effect(
							ability.title, // Name
							ability.creature, // Caster
							ability.creature, // Target
							"", // Trigger
							{
								turnLifetime: 1,
								deleteTrigger: "onStartPhase",
								alterations: {
									regrowth: amount
								}
							}, // Optional arguments
							G
						), "%CreatureName" + ability.creature.id + "% gained " + amount + " regrowth for now", // Custom Log
						"Regrowth++"); // Custom Hint
				}
			}

			// Remove frogger bonus if its found
			ability.creature.effects.forEach(function(effect) {
				if (effect.name == "Frogger Bonus") {
					effect.deleteEffect();
				}
			});
		},
	},



	// Third Ability: Frogger Jump
	{
		// Type : Can be "onQuery", "onStartPhase", "onDamage"
		trigger: "onQuery",

		require: function() {
			// Must be able to move
			if (!this.creature.stats.moveable) {
				this.message = G.msg.abilities.notmoveable;
				return false;
			}
			return this.testRequirements() && this.creature.stats.moveable;
		},

		fnOnSelect: function(hex, args) {
			this.creature.tracePosition({
				x: hex.x,
				y: hex.y,
				overlayClass: "creature moveto selected player" + this.creature.team
			});
		},

		// query() :
		query: function() {
			var ability = this;
			var uncle = this.creature;

			// Don't jump over creatures if we're not upgraded, or we are in a second
			// "low" jump
			var stopOnCreature = !this.isUpgraded() || this._isSecondLowJump();
			var hexes = this._getHexRange(stopOnCreature);

			G.grid.queryHexes({
				fnOnSelect: function() {
					ability.fnOnSelect.apply(ability, arguments);
				},
				fnOnConfirm: function() {
					if (arguments[0].x == ability.creature.x && arguments[0].y == ability.creature.y) {
						// Prevent null movement
						ability.query();
						return;
					}
					ability.animation.apply(ability, arguments);
				},
				size: uncle.size,
				flipped: uncle.player.flipped,
				id: uncle.id,
				hexes: hexes,
				hexesDashed: [],
				hideNonTarget: true
			});
		},


		// activate() :
		activate: function(hex, args) {

			var ability = this;
			ability.end(false, true); // Defered ending

			// If upgraded and we haven't leapt over creatures/obstacles, allow a second
			// jump of the same kind
			if (this.isUpgraded() && !this._isSecondLowJump()) {
				// Check if we've leapt over creatures by finding all "low" jumps (jumps
				// not over creatures), and finding whether this jump was a "low" one
				var lowJumpHexes = this._getHexRange(true);
				var isLowJump = false;
				for (var i = 0; i < lowJumpHexes.length; i++) {
					if (lowJumpHexes[i].x === hex.x && lowJumpHexes[i].y === hex.y) {
						isLowJump = true;
					}
				}
				if (isLowJump) {
					this.setUsed(false);
				}
			}

			// Jump directly to hex
			ability.creature.moveTo(hex, {
				ignoreMovementPoint: true,
				ignorePath: true,
				callback: function() {
					// Shake the screen upon landing to simulate the jump
					G.Phaser.camera.shake(0.02, 100, true, G.Phaser.camera.SHAKE_VERTICAL, true);

					G.onStepIn(ability.creature, ability.creature.hexagons[0]);

					var interval = setInterval(function() {
						if (!G.freezedInput) {
							clearInterval(interval);
							G.UI.selectAbility(-1);
							G.activeCreature.queryMove();
						}
					}, 100);
				}
			});

			// Frogger Leap bonus
			ability.creature.addEffect(new Effect(
				"Offense Bonus", // Name
				ability.creature, // Caster
				ability.creature, // Target
				"onStepIn onEndPhase", // Trigger
				{
					effectFn: function(effect, crea) {
						effect.deleteEffect();
					},
					alterations: ability.effects[0]
				}, // Optional arguments
				G
			));
		},

		_getHexRange: function(stopOnCreature) {
			// Get the hex range of this ability
			var uncle = this.creature;
			var forward = G.grid.getHexMap(uncle.x, uncle.y, 0, false, matrices.straitrow);
			forward = arrayUtils.filterCreature(forward, false, stopOnCreature, uncle.id);
			var backward = G.grid.getHexMap(uncle.x, uncle.y, 0, true, matrices.straitrow);
			backward = arrayUtils.filterCreature(backward, false, stopOnCreature, uncle.id);
			// Combine and sort by X, left to right
			var hexes = forward.concat(backward).sort(function(a, b) {
				return a.x - b.x;
			});
			// Filter out any hexes that cannot accomodate the creature's size
			var run = 0;
			for (var i = 0; i < hexes.length; i++) {
				if (i === 0 || hexes[i - 1].x + 1 === hexes[i].x) {
					run++;
				} else {
					if (run < this.creature.size) {
						hexes.splice(i - run, run);
						i -= run;
					}
					run = 1;
				}
			}
			if (run < this.creature.size) {
				hexes.splice(hexes.length - run, run);
			}
			return hexes;
		},

		_isSecondLowJump: function() {
			return this.timesUsedThisTurn === 1;
		}
	},



	// Fourth Ability: Sabre Kick
	{
		// Type : Can be "onQuery", "onStartPhase", "onDamage"
		trigger: "onQuery",

		_targetTeam: Team.enemy,

		// require() :
		require: function() {
			if (!this.testRequirements()) return false;

			var map = G.grid.getHexMap(this.creature.x - 2, this.creature.y - 2, 0, false, matrices.frontnback2hex);
			// At least one target
			if (!this.atLeastOneTarget(map, {
					team: this._targetTeam
				})) {
				return false;
			}
			return true;
		},

		// query() :
		query: function() {
			var ability = this;
			var uncle = this.creature;

			G.grid.queryCreature({
				fnOnConfirm: function() {
					ability.animation.apply(ability, arguments);
				},
				team: this._targetTeam,
				id: uncle.id,
				flipped: uncle.flipped,
				hexes: G.grid.getHexMap(uncle.x - 2, uncle.y - 2, 0, false, matrices.frontnback2hex),
			});
		},


		// activate() :
		activate: function(target, args) {
			var ability = this;
			ability.end();

			var damage = new Damage(
				ability.creature, // Attacker
				ability.damages, // Damage Type
				1, // Area
				[], // Effects
				G
			);
			var result = target.takeDamage(damage);

			// If upgraded, knock back target by 1 hex
			if (this.isUpgraded() && !result.kill) {
				var dx = target.x - this.creature.x;
				var dy = target.y - this.creature.y;
				var dir = pos.getDirectionFromDelta(target.y, dx, dy);
				var hexes = G.grid.getHexLine(target.x, target.y, dir, target.flipped);
				// The hex to knock back into is the second hex since the first is where
				// they are currently
				if (hexes.length >= 2 &&
					hexes[1].isWalkable(target.size, target.id, true)) {
					target.moveTo(hexes[1], {
						callback: function() {
							G.activeCreature.queryMove();
						},
						ignoreMovementPoint: true,
						ignorePath: true,
						overrideSpeed: 500, // Custom speed for knockback
						animation: "push"
					});
				}
			}

			// Remove Frogger Jump bonus if its found
			ability.creature.effects.forEach(function(effect) {
				if (effect.name == "Offense Bonus") {
					effect.deleteEffect();
				}
			});
		},
	}
];
