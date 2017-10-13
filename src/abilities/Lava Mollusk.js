/*
 *
 *	Lava Mollusk abilities
 *
 */
G.abilities[22] = [

	// 	First Ability: Greater Pyre
	{
		//	Type : Can be "onQuery", "onStartPhase", "onDamage"
		trigger: "onDamage",

		// 	require() :
		require: function(damage) {
			if (this.used) return false;
			if (!this.testRequirements()) return false;
			if (damage == undefined) damage = {
				type: "target"
			}; // For the test function to work
			//if( this.triggeredThisChain ) return false;
			return true;
		},

		//	activate() :
		activate: function(damage) {
			if (this.triggeredThisChain) return damage;

			var targets = this.getTargets(this.creature.adjacentHexes(1));
			this.end();
			this.triggeredThisChain = true;

			this.areaDamage(
				this.creature, // Attacker
				this.damages, // Damage Type
				[], // Effects
				targets
			);

			return damage;
		},
	},


	// 	Second Ability: Fiery Claw
	{
		//	Type : Can be "onQuery", "onStartPhase", "onDamage"
		trigger: "onQuery",

		distance: 2,
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

			var damage = new Damage(
				ability.creature, // Attacker
				ability.damages, // Damage Type
				1, // Area
				[], // Effects
				G
			);
			target.takeDamage(damage);
		},
	},



	// 	Thirt Ability: Burning Eye
	{
		//	Type : Can be "onQuery","onStartPhase","onDamage"
		trigger: "onQuery",

		_targetTeam: Team.enemy,

		// 	require() :
		require: function() {
			return this.testRequirements();
		},

		// 	query() :
		query: function() {
			var ability = this;
			var crea = this.creature;

			crea.queryMove({
				noPath: true,
				isAbility: true,
				range: G.grid.getFlyingRange(crea.x, crea.y, 50, crea.size, crea.id),
				callback: function() {
					delete arguments[1];
					ability.animation.apply(ability, arguments);
				},
			});
		},


		//	activate() :
		activate: function(hex, args) {
			var ability = this;
			ability.end();


			var targets = ability.getTargets(ability.creature.adjacentHexes(1));

			targets.forEach(function(item) {
				if (!(item.target instanceof Creature)) {
					return;
				}

				var trg = item.target;

				if (isTeam(ability.creature, trg, item._targetTeam)) {

					var optArg = {
						alterations: {
							burn: -1
						}
					};

					//Roasted effect
					var effect = new Effect(
						"Roasted", //Name
						ability.creature, //Caster
						trg, //Target
						"", //Trigger
						optArg, //Optional arguments
						G
					);
					trg.addEffect(effect);
				}
			});

			ability.creature.moveTo(hex, {
				ignoreMovementPoint: true,
				ignorePath: true,
				animation: "teleport",
				callback: function() {
					G.activeCreature.queryMove()
				},
				callbackStepIn: function() {
					var targets = ability.getTargets(ability.creature.adjacentHexes(1));

					targets.forEach(function(item) {
						if (!(item.target instanceof Creature)) {
							return;
						}

						var trg = item.target;

						if (isTeam(ability.creature, trg, item._targetTeam)) {

							var optArg = {
								alterations: {
									burn: -1
								}
							};

							//Roasted effect
							var effect = new Effect(
								"Roasted", //Name
								ability.creature, //Caster
								trg, //Target
								"", //Trigger
								optArg, //Optional arguments
								G
							);
							trg.addEffect(effect, "%CreatureName" + trg.id + "% got roasted : -1 burn stat debuff");
						}
					})
				},
			});
		},
	},



	// 	Fourth Ability: Fire Ball
	{
		//	Type : Can be "onQuery","onStartPhase","onDamage"
		trigger: "onQuery",

		// 	require() :
		require: function() {
			return this.testRequirements();
		},

		// 	query() :
		query: function() {
			var ability = this;
			var crea = this.creature;

			inRangeCreatures = crea.hexagons[1].adjacentHex(4);;

			var range = crea.hexagons[1].adjacentHex(3);

			var head = range.indexOf(crea.hexagons[0]);
			var tail = range.indexOf(crea.hexagons[2]);
			range.splice(head, 1);
			range.splice(tail, 1);

			G.grid.queryHexes({
				fnOnConfirm: function() {
					ability.animation.apply(ability, arguments);
				},
				fnOnSelect: function(hex, args) {
					hex.adjacentHex(1).forEach(function(item) {
						if (item.creature instanceof Creature) {
							if (item.creature == crea) { //If it is abolished
								crea.adjacentHexes(1).forEach(function(item2) {
									if (item2.creature instanceof Creature) {
										if (item2.creature == crea) { //If it is abolished
											crea.adjacentHexes(1).overlayVisualState("creature selected weakDmg player" + item2.creature.team);
											item2.overlayVisualState("creature selected weakDmg player" + item2.creature.team);
										} else {
											item2.overlayVisualState("creature selected weakDmg player" + item2.creature.team);
										}
									} else {
										item2.overlayVisualState("creature selected weakDmg player" + G.activeCreature.team);
									}
								});
							} else {
								item.overlayVisualState("creature selected weakDmg player" + item.creature.team);
							}
						} else {
							item.overlayVisualState("creature selected weakDmg player" + G.activeCreature.team);
						}
					});

					hex.cleanOverlayVisualState();
					if (hex.creature instanceof Creature) {
						hex.overlayVisualState("creature selected player" + hex.creature.team);
					} else {
						hex.overlayVisualState("creature selected player" + G.activeCreature.team);
					}
				},
				id: this.creature.id,
				hexes: range,
				hideNonTarget: true,
			});
		},


		//	activate() :
		activate: function(hex, args) {
			var ability = this;
			ability.end();

			var aoe = hex.adjacentHex(1);

			var targets = ability.getTargets(aoe);

			if (hex.creature instanceof Creature) {
				hex.creature.takeDamage(new Damage(
					ability.creature, // Attacker
					ability.damages1, // Damage Type
					1, // Area
					[], // Effects
					G
				));
			}


			ability.areaDamage(
				ability.creature,
				ability.damages2, [], //Effects
				targets
			);

		},
	}

];
