import { Damage } from '../damage';
import { Team, isTeam } from '../utility/team';
import * as matrices from '../utility/matrices';
import { Creature } from '../creature';
import { Effect } from '../effect';

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default G => {
	G.abilities[33] = [
		// 	First Ability: Percussion Spear
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onStepIn onStartPhase',

			_targetTeam: Team.enemy,

			// 	require() :
			require: function() {
				return this.testRequirements();
			},

			//	activate() :
			activate: function() {
				let creature = this.creature;
				let targets = this.getTargets(this.creature.adjacentHexes(1));

				if (
					this.atLeastOneTarget(this.creature.adjacentHexes(1), {
						team: this._targetTeam,
					})
				) {
					this.end();
					this.setUsed(false); //Infinite triggering
				} else {
					return false;
				}

				targets.forEach(function(item) {
					if (!(item.target instanceof Creature)) {
						return;
					}

					let trg = item.target;

					if (isTeam(creature, trg, item._targetTeam)) {
						let optArg = {
							effectFn: function(effect, crea) {
								let nearFungus = false;
								crea.adjacentHexes(1).forEach(function() {
									if (trg.creature instanceof Creature) {
										if (G.creatures[trg.creature] === effect.owner) {
											nearFungus = true;
										}
									}
								});

								if (!nearFungus) {
									crea.effects.forEach(function(eff) {
										if (eff.name == 'Contaminated') {
											eff.deleteEffect();
										}
									});
								}
							},
							alterations: {
								regrowth: -5,
							},
							turn: G.turn,
						};

						//Spore Contamination
						let effect = new Effect(
							'Contaminated', // Name
							creature, // Caster
							trg, // Target
							'onStartPhase', // Trigger
							optArg, // Optional arguments
							G,
						);

						let validTarget = true;
						trg.effects.forEach(function(eff) {
							if (eff.name == 'Contaminated') {
								if (eff.turn == G.turn) {
									validTarget = false;
								}
							}
						});

						if (validTarget) {
							trg.addEffect(effect);
						}
					}
				});
			},
		},

		// 	Second Ability: Executioner Axe
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			damages: {
				slash: 40,
			},
			_targetTeam: Team.enemy,

			// 	require() :
			require: function() {
				if (!this.testRequirements()) {
					return false;
				}

				//At least one target
				if (
					!this.atLeastOneTarget(this.creature.adjacentHexes(1), {
						team: this._targetTeam,
					})
				) {
					return false;
				}
				return true;
			},

			// 	query() :
			query: function() {
				let wyrm = this.creature;
				let ability = this;

				let map = [
					[0, 0, 0, 0],
					[0, 1, 0, 1],
					[1, 0, 0, 1], //origin line
					[0, 1, 0, 1],
				];

				G.grid.queryCreature({
					fnOnConfirm: function() {
						ability.animation(...arguments);
					},
					team: this._targetTeam,
					id: wyrm.id,
					flipped: wyrm.flipped,
					hexes: G.grid.getHexMap(wyrm.x - 2, wyrm.y - 2, 0, false, map),
				});
			},

			//	activate() :
			activate: function(target) {
				let ability = this;
				ability.end();

				let damage = new Damage(
					ability.creature, // Attacker
					ability.damages, // Damage Type
					1, // Area
					[], // Effects
					G,
				);

				let dmg = target.takeDamage(damage);

				if (dmg.status == '') {
					// Regrowth bonus
					ability.creature.addEffect(
						new Effect(
							'Regrowth++', // Name
							ability.creature, // Caster
							ability.creature, // Target
							'onStartPhase', // Trigger
							{
								effectFn: function(effect) {
									effect.deleteEffect();
								},
								alterations: {
									regrowth: Math.round(dmg.damages.total / 4),
								},
							}, //Optional arguments
							G,
						),
					);
				}

				//remove frogger bonus if its found
				ability.creature.effects.forEach(function(effect) {
					if (effect.name == 'Frogger Bonus') {
						this.deleteEffect();
					}
				});
			},
		},

		// 	Third Ability: Dragon Flight
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			require: function() {
				return this.testRequirements();
			},

			fnOnSelect: function(hex) {
				this.creature.tracePosition({
					x: hex.x,
					y: hex.y,
					overlayClass: 'creature moveto selected player' + this.creature.team,
				});
			},

			// 	query() :
			query: function() {
				let ability = this;
				let wyrm = this.creature;

				let range = G.grid
					.getFlyingRange(wyrm.x, wyrm.y, 50, wyrm.size, wyrm.id)
					.filter(item => wyrm.item == item.y);

				G.grid.queryHexes({
					fnOnSelect: function() {
						ability.fnOnSelect(...arguments);
					},
					fnOnConfirm: function() {
						ability.animation(...arguments);
					},
					size: wyrm.size,
					flipped: wyrm.player.flipped,
					id: wyrm.id,
					hexes: range,
				});
			},

			//	activate() :
			activate: function(hex) {
				let ability = this;
				ability.end();

				ability.creature.moveTo(hex, {
					ignoreMovementPoint: true,
					ignorePath: true,
					callback: function() {
						G.activeCreature.queryMove();
					},
				});

				// Frogger Leap bonus
				ability.creature.addEffect(
					new Effect(
						'Offense++', // Name
						ability.creature, // Caster
						ability.creature, // Target
						'onStepIn onEndPhase', // Trigger
						{
							effectFn: function(effect) {
								effect.deleteEffect();
							},
							alterations: {
								offense: 25,
							},
						}, // Optional arguments
						G,
					),
				);
			},
		},

		// 	Fourth Ability: Battle Cry
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			damages: {
				pierce: 15,
				slash: 10,
				crush: 5,
			},
			_targetTeam: Team.enemy,

			// 	require() :
			require: function() {
				if (!this.testRequirements()) {
					return false;
				}

				let map = G.grid.getHexMap(
					this.creature.x - 2,
					this.creature.y - 2,
					0,
					false,
					matrices.frontnback2hex,
				);
				// At least one target
				if (
					!this.atLeastOneTarget(map, {
						team: this._targetTeam,
					})
				) {
					return false;
				}
				return true;
			},

			// 	query() :
			query: function() {
				let ability = this;
				let wyrm = this.creature;

				G.grid.queryCreature({
					fnOnConfirm: function() {
						ability.animation(...arguments);
					},
					team: this._targetTeam,
					id: wyrm.id,
					flipped: wyrm.flipped,
					hexes: G.grid.getHexMap(wyrm.x - 2, wyrm.y - 2, 0, false, matrices.frontnback2hex),
				});
			},

			//	activate() :
			activate: function(target) {
				let ability = this;
				ability.end();

				let damage = new Damage(
					ability.creature, // Attacker
					ability.damages, // Damage Type
					1, // Area
					[], // Effects
					G,
				);
				target.takeDamage(damage);

				//remove frogger bonus if its found
				ability.creature.effects.forEach(function(item) {
					if (item.name == 'Offense++') {
						item.deleteEffect();
					}
				});
			},
		},
	];
};
