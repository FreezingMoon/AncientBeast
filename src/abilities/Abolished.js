/*
 *
 *	Abolished abilities
 *
 */
G.abilities[7] = [

	// 	First Ability: Burning Spirit
	{
		trigger: "onOtherDamage",

		// 	require() :
		require: function(damage) {
			if (!this.testRequirements()) return false;
			if (damage === undefined) {
				damage = {
					type: "target"
				}; // For the test function to work
			}
			return true;
		},

		//  activate() :
		activate: function(damage, target) {
			if (this.creature.id !== damage.attacker.id) {
				return;
			}

			target.addEffect(new Effect(
				"Burning Spirit", // Name
				this.creature, // Caster
				target, // Target
				"", // Trigger
				{
					alterations: {
						burn: -1
					}
				}, // Optional arguments
				G
			));
			target.stats.burn -= 1;
			if (this.isUpgraded()) {
				this.creature.addEffect(new Effect(
					"Burning Heart", // Name
					this.creature, // Caster
					this.creature, // Target
					"", // Trigger
					{
						alterations: {
							burn: 1
						}
					}, // Optional arguments
					G
				));
			}
		},
	},


	// 	Second Ability: Fiery Touch
	{
		//	Type : Can be "onQuery", "onStartPhase", "onDamage"
		trigger: "onQuery",

		distance: 3,
		_targetTeam: Team.enemy,

		// 	require() :
		require: function() {
			if (!this.testRequirements()) return false;
			if (!this.testDirection({
					team: this._targetTeam,
					distance: this.distance,
					sourceCreature: this.creature
				})) {
				return false;
			}
			return true;
		},

		// 	query() :
		query: function() {
			var ability = this;
			var crea = this.creature;

			if (this.isUpgraded()) this.distance = 5;

			G.grid.queryDirection({
				fnOnConfirm: function() {
					ability.animation.apply(ability, arguments);
				},
				flipped: crea.player.flipped,
				team: this._targetTeam,
				id: this.creature.id,
				requireCreature: true,
				x: crea.x,
				y: crea.y,
				distance: this.distance,
				sourceCreature: crea,
			});
		},


		//	activate() :
		activate: function(path, args) {
			var ability = this;
			ability.end();

			var target = arrayUtils.last(path).creature;
			projectileInstance = G.animations.projectile(this, target, 'effects_fiery-touch', path, args, 200, -20);
			tween = projectileInstance[0];
			sprite = projectileInstance[1];

			tween.onComplete.add(function() {

				var damage = new Damage(
					ability.creature, // Attacker
					ability.damages, // Damage Type
					1, // Area
					[], // Effects
					G
				);
				target.takeDamage(damage);

				this.destroy();
			}, sprite); // End tween.onComplete
		},
	},



	// 	Third Ability: Wild Fire
	{
		//	Type : Can be "onQuery", "onStartPhase", "onDamage"
		trigger: "onQuery",

		// 	require() :
		require: function() {
			return this.testRequirements();
		},

		range: 6,

		// 	query() :
		query: function() {
			var ability = this;
			var crea = this.creature;

			// Teleport to any hex within range except for the current hex
			crea.queryMove({
				targeting: true,
				noPath: true,
				isAbility: true,
				range: G.grid.getFlyingRange(crea.x, crea.y, this.range, crea.size, crea.id),
				callback: function(hex, args) {
					if (hex.x == args.creature.x && hex.y == args.creature.y) {
						// Prevent null movement
						ability.query();
						return;
					}
					delete arguments[1];
					ability.animation.apply(ability, arguments);
				}
			});
		},


		//	activate() :
		activate: function(hex, args) {
			var ability = this;
			ability.end();

			if (this.isUpgraded()) {
				this.range += 1;
			}


			var targets = ability.getTargets(ability.creature.adjacentHexes(1));

			targets.forEach(function(item) {
				if (!(item.target instanceof Creature)) {
					return;
				}
			});

			// Leave a Firewall in current location
			var effectFn = function(effect, creatureOrHex) {
				var creature = creatureOrHex;
				if (!(creatureOrHex instanceof Creature)) {
					creature = creatureOrHex.creature;
				}
				creature.takeDamage(
					new Damage(effect.attacker, ability.damages, 1, [], G), {
						isFromTrap: true
					});
				this.trap.destroy();
			};

			var requireFn = function() {
				var hex = this.trap.hex,
					creature = hex.creature,
					type = creature && creature.type || null;

				if (creature === 0) return false;
				return type !== ability.creature.type;
			};

			var crea = this.creature;
			crea.hexagons.forEach(function(hex) {
				hex.createTrap("firewall", [
					new Effect(
						"Firewall", crea, hex, "onStepIn", {
							requireFn: requireFn,
							effectFn: effectFn,
							attacker: crea
						},
						G
					),
				], crea.player, {
					turnLifetime: 1,
					ownerCreature: crea,
					fullTurnLifetime: true
				});
			});

			ability.creature.moveTo(hex, {
				ignoreMovementPoint: true,
				ignorePath: true,
				animation: "teleport",
				callback: function() {
					G.activeCreature.queryMove();
				}
			});
		},
	},



	// 	Fourth Ability: Greater Pyre
	{
		//	Type : Can be "onQuery", "onStartPhase", "onDamage"
		trigger: "onQuery",

        directions: [1, 1, 1, 1, 1, 1],

		// 	require() :
		require: function() {
			return this.testRequirements();
		},

		// 	query() :
		query: function() {
			var ability = this;
			var crea = this.creature;

			// var inRangeCreatures = crea.hexagons[1].adjacentHex(1);

			var range = [];
			range[0] = crea.adjacentHexes(1);

            G.grid.queryChoice({
                fnOnConfirm: function() {
                    ability.animation.apply(ability, arguments);
                },
                flipped: crea.player.flipped,
                team: this._targetTeam,
                id: this.creature.id,
                requireCreature: false,
                choices:range
            });
		},


		//	activate() :
		activate: function(hex, args) {
			var ability = this;
			ability.end();

			var crea = this.creature;
			var aoe = crea.adjacentHexes(1);
			var targets = ability.getTargets(aoe);

			if (this.isUpgraded()) this.damages.burn = 30;

			targets.forEach(function(item) {
				item.target.takeDamage(new Damage(
					ability.creature, // Attacker
					ability.damages, // Damage Type
					1, // Area
					[], // Effects
					G
				));
			});

		},
	}

];
