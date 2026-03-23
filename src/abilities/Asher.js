import { Damage } from '../damage';
import { Team, isTeam } from '../utility/team';
import * as arrayUtils from '../utility/arrayUtils';
import { Creature } from '../creature';
import { Effect } from '../effect';

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default (G) => {
	G.abilities[22] = [
		// 	First Ability: Greater Pyre
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onDamage',

			// 	require() :
			require: function (damage) {
				if (this.used) {
					return false;
				}
				if (!this.testRequirements()) {
					return false;
				}
				if (damage == undefined) {
					damage = {
						type: 'target',
					};
				} // For the test function to work
				//if( this.triggeredThisChain ) return false;
				return true;
			},

			//	activate() :
			activate: function (damage) {
				if (this.triggeredThisChain) {
					return damage;
				}

				const targets = this.getTargets(this.creature.adjacentHexes(1));
				this.end();
				this.triggeredThisChain = true;

				this.areaDamage(
					this.creature, // Attacker
					this.damages, // Damage Type
					[], // Effects
					targets,
				);

				return damage;
			},
		},

		// 	Second Ability: Fiery Claw
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			distance: 2,
			_targetTeam: Team.Enemy,

			// 	require() :
			require: function () {
				if (!this.testRequirements()) {
					return false;
				}
				if (
					!this.testDirection({
						team: this._targetTeam,
						distance: this.distance,
						sourceCreature: this.creature,
					})
				) {
					return false;
				}
				return true;
			},

			// 	query() :
			query: function () {
				const ability = this;
				const crea = this.creature;

				G.grid.queryDirection({
					fnOnConfirm: function () {
						ability.animation(...arguments);
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
			activate: function (path) {
				const ability = this;
				ability.end();

				const target = arrayUtils.last(path).creature;

				const damage = new Damage(
					ability.creature, // Attacker
					ability.damages, // Damage Type
					1, // Area
					[], // Effects
					G,
				);
				target.takeDamage(damage);
			},
		},

		// 	Thirt Ability: Burning Eye
		{
			//	Type : Can be "onQuery","onStartPhase","onDamage"
			trigger: 'onQuery',

			_targetTeam: Team.Enemy,

			// 	require() :
			require: function () {
				return this.testRequirements();
			},

			// 	query() :
			query: function () {
				const ability = this;
				const crea = this.creature;

				crea.queryMove({
					noPath: true,
					isAbility: true,
					range: G.grid.getFlyingRange(crea.x, crea.y, 50, crea.size, crea.id),
					callback: function () {
						delete arguments[1];
						ability.animation(...arguments);
					},
				});
			},

			//	activate() :
			activate: function (hex) {
				const ability = this;
				ability.end();

				const targets = ability.getTargets(ability.creature.adjacentHexes(1));

				targets.forEach(function (item) {
					if (!(item.target instanceof Creature)) {
						return;
					}

					const trg = item.target;

					if (isTeam(ability.creature, trg, item._targetTeam)) {
						const optArg = {
							alterations: {
								burn: -1,
							},
						};

						//Roasted effect
						const effect = new Effect(
							'Roasted', //Name
							ability.creature, //Caster
							trg, //Target
							'', //Trigger
							optArg, //Optional arguments
							G,
						);
						trg.addEffect(effect);
					}
				});

				ability.creature.moveTo(hex, {
					ignoreMovementPoint: true,
					ignorePath: true,
					animation: 'teleport',
					callback: function () {
						G.activeCreature.queryMove();
					},
					callbackStepIn: function () {
						const callbackTargets = ability.getTargets(ability.creature.adjacentHexes(1));

						callbackTargets.forEach(function (item) {
							if (!(item.target instanceof Creature)) {
								return;
							}

							const trg = item.target;

							if (isTeam(ability.creature, trg, item._targetTeam)) {
								const optArg = {
									alterations: {
										burn: -1,
									},
								};

								//Roasted effect
								const effect = new Effect(
									'Roasted', //Name
									ability.creature, //Caster
									trg, //Target
									'', //Trigger
									optArg, //Optional arguments
									G,
								);
								trg.addEffect(
									effect,
									'%CreatureName' + trg.id + '% got roasted : -1 burn stat debuff',
								);
							}
						});
					},
				});
			},
		},

		// 	Fourth Ability: Fire Ball
		{
			//	Type : Can be "onQuery","onStartPhase","onDamage"
			trigger: 'onQuery',

			// 	require() :
			require: function () {
				return this.testRequirements();
			},

			// 	query() :
			query: function () {
				const ability = this;
				const crea = this.creature;

				const range = crea.hexagons[1].adjacentHex(3);

				const head = range.indexOf(crea.hexagons[0]);
				const tail = range.indexOf(crea.hexagons[2]);
				range.splice(head, 1);
				range.splice(tail, 1);

				G.grid.queryHexes({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					fnOnSelect: function (hex) {
						hex.adjacentHex(1).forEach(function (item) {
							if (item.creature instanceof Creature) {
								if (item.creature == crea) {
									//If it is abolished
									crea.adjacentHexes(1).forEach(function (item2) {
										if (item2.creature instanceof Creature) {
											if (item2.creature == crea) {
												//If it is abolished
												crea
													.adjacentHexes(1)
													.overlayVisualState(
														'creature selected weakDmg player' + item2.creature.team,
													);
												item2.overlayVisualState(
													'creature selected weakDmg player' + item2.creature.team,
												);
											} else {
												item2.overlayVisualState(
													'creature selected weakDmg player' + item2.creature.team,
												);
											}
										} else {
											item2.overlayVisualState(
												'creature selected weakDmg player' + G.activeCreature.team,
											);
										}
									});
								} else {
									item.overlayVisualState('creature selected weakDmg player' + item.creature.team);
								}
							} else {
								item.overlayVisualState('creature selected weakDmg player' + G.activeCreature.team);
							}
						});

						hex.cleanOverlayVisualState();
						if (hex.creature instanceof Creature) {
							hex.overlayVisualState('creature selected player' + hex.creature.team);
						} else {
							hex.overlayVisualState('creature selected player' + G.activeCreature.team);
						}
					},
					id: this.creature.id,
					hexes: range,
					hideNonTarget: true,
				});
			},

			//	activate() :
			activate: function (hex) {
				const ability = this;
				ability.end();

				const aoe = hex.adjacentHex(1);

				const targets = ability.getTargets(aoe);

				if (hex.creature instanceof Creature) {
					hex.creature.takeDamage(
						new Damage(
							ability.creature, // Attacker
							ability.damages1, // Damage Type
							1, // Area
							[], // Effects
							G,
						),
					);
				}

				ability.areaDamage(
					ability.creature,
					ability.damages2,
					[], //Effects
					targets,
				);
			},
		},
	];
};
