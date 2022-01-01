import * as $j from 'jquery';
import { Damage } from '../damage';
import { Team, isTeam } from '../utility/team';
import * as matrices from '../utility/matrices';
import * as arrayUtils from '../utility/arrayUtils';
import { Creature } from '../creature';
import { Effect } from '../effect';

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default (G) => {
	G.abilities[5] = [
		// 	First Ability: Electrified Hair
		{
			trigger: 'onUnderAttack',

			require: function () {
				// Always true to highlight ability
				return true;
			},

			activate: function (damage) {
				if (damage === undefined) {
					return false;
				}
				if (!damage.damages.shock) {
					return false;
				}
				this.end();
				let converted = Math.floor(damage.damages.shock / 4);
				// Lower damage
				damage.damages.shock -= converted;
				// Replenish energy
				// Calculate overflow first; we may need it later
				let energyMissing = this.creature.stats.energy - this.creature.energy;
				let energyOverflow = converted - energyMissing;
				this.creature.recharge(converted);
				// If upgraded and energy overflow, convert into health
				if (this.isUpgraded() && energyOverflow > 0) {
					this.creature.heal(energyOverflow);
				}
				G.log(
					'%CreatureName' +
						this.creature.id +
						'% absorbs ' +
						converted +
						' shock damage into energy',
				);
				return damage;
			},
		},

		// 	Second Ability: Hasted Javelin
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			_targetTeam: Team.Enemy,

			// 	require() :
			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				if (
					!this.atLeastOneTarget(this._getHexes(), {
						team: this._targetTeam,
					})
				) {
					return false;
				}
				return true;
			},

			// 	query() :
			query: function () {
				let ability = this;
				let creature = this.creature;

				G.grid.queryCreature({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					team: this._targetTeam,
					id: creature.id,
					flipped: creature.flipped,
					hexes: this._getHexes(),
				});
			},

			//	activate() :
			activate: function (target) {
				let ability = this;
				ability.end();

				let finalDmg = $j.extend(
					{
						poison: 0,
					},
					ability.damages1,
				);

				// Poison Bonus if upgraded
				if (this.isUpgraded()) {
					finalDmg.poison = this.damages1.poison;
				}

				let damage = new Damage(
					ability.creature, // Attacker
					finalDmg, // Damage Type
					1, // Area
					[], // Effects
					G,
				);
				let result = target.takeDamage(damage);
				// Recharge movement if any damage dealt
				if (result.damages && result.damages.total > 0) {
					this.creature.remainingMove = this.creature.stats.movement;
					G.log('%CreatureName' + this.creature.id + "%'s movement recharged");
					G.activeCreature.queryMove();
				}
			},

			_getHexes: function () {
				return G.grid.getHexMap(
					this.creature.x - 3,
					this.creature.y - 2,
					0,
					false,
					matrices.frontnback3hex,
				);
			},
		},

		// 	Third Ability: Poisonous Vine
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			_targetTeam: Team.Enemy,

			// 	require() :
			require: function () {
				if (
					!this.atLeastOneTarget(this._getHexes(), {
						team: this._targetTeam,
					})
				) {
					return false;
				}
				return this.testRequirements();
			},

			// 	query() :
			query: function () {
				let ability = this;
				let creature = this.creature;

				G.grid.queryCreature({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					team: this._targetTeam,
					id: creature.id,
					flipped: creature.flipped,
					hexes: this._getHexes(),
				});
			},

			activate: function (target) {
				this.end();
				let damages = this.damages;
				// Last 1 turn, or indefinitely if upgraded
				let lifetime = this.isUpgraded() ? 0 : 1;
				let ability = this;

				// Destroy trap if it wasn't triggered and target is dead
				target.addEffect(
					new Effect(
						ability.title,
						target,
						target,
						'onUnderAttack',
						{
							effectFn: (effect, damage) => {
								let dmg = damage.applyDamage();
								if (dmg.total >= target.health) {
									target.hexagons.forEach(function (hex) {
										hex.destroyTrap();
									});
								}
							},
						},
						G,
					),
				);

				// Add a trap to every hex of the target
				let effect = new Effect(
					ability.title,
					ability.creature,
					this,
					'onStepOut',
					{
						effectFn: (eff) => {
							const waitForMovementComplete = (message, payload) => {
								if (message === 'movementComplete' && payload.creature.id === eff.target.id) {
									this.game.signals.creature.remove(waitForMovementComplete);

									G.log('%CreatureName' + eff.target.id + '% is hit by ' + eff.name);
									eff.target.takeDamage(new Damage(eff.owner, damages, 1, [], G), {
										isFromTrap: true,
									});
									// Hack: manually destroy traps so we don't activate multiple traps
									// and see multiple logs etc.
									target.hexagons.forEach(function (hex) {
										hex.destroyTrap();
									});
									eff.deleteEffect();
								}
							};

							// Wait until movement is completely finished before processing effects.
							this.game.signals.creature.add(waitForMovementComplete);
						},
					},
					G,
				);
				target.hexagons.forEach(function (hex) {
					hex.createTrap('poisonous-vine', [effect], ability.creature.player, {
						turnLifetime: lifetime,
						fullTurnLifetime: true,
						ownerCreature: ability.creature,
						destroyOnActivate: true,
						destroyAnimation: 'shrinkDown',
					});
				});
			},

			_getHexes: function () {
				// Target a creature within 2 hex radius
				let hexes = G.grid.hexes[this.creature.y][this.creature.x].adjacentHex(2);
				return arrayUtils.extendToLeft(hexes, this.creature.size, G.grid);
			},
		},

		//	Fourth Ability: Chain Lightning
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			_targetTeam: Team.Both,

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}
				if (
					!this.atLeastOneTarget(this._getHexes(), {
						team: this._targetTeam,
					})
				) {
					return false;
				}
				return true;
			},

			//	query() :
			query: function () {
				let ability = this;

				G.grid.queryCreature({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					team: this._targetTeam,
					id: this.creature.id,
					flipped: this.creature.flipped,
					hexes: this._getHexes(),
				});
			},

			//	activate() :
			activate: function (target) {
				let ability = this;
				ability.end();

				let targets = [];
				targets.push(target); // Add First creature hit
				let nextdmg = $j.extend({}, ability.damages); // Copy the object

				// For each Target
				for (let i = 0; i < targets.length; i++) {
					let trg = targets[i];

					// If upgraded and the target is an ally, protect it with an effect that
					// reduces the damage to guarantee at least 1 health remaining
					if (this.isUpgraded() && isTeam(this.creature, trg, Team.Ally)) {
						trg.addEffect(
							new Effect(
								this.title,
								this.creature,
								trg,
								'onUnderAttack',
								{
									effectFn: function (effect, damage) {
										// Simulate the damage to determine how much damage would have
										// been dealt; then reduce the damage so that it will not kill
										while (true) {
											let dmg = damage.applyDamage();
											// If we can't reduce any further, give up and have the damage
											// be zero
											if (dmg.total <= 0 || damage.damages.shock <= 0 || trg.health <= 1) {
												damage.damages = {
													shock: 0,
												};
												break;
											} else if (dmg.total >= trg.health) {
												// Too much damage, would have killed; reduce and try again
												damage.damages.shock--;
											} else {
												break;
											}
										}
									},
									deleteTrigger: 'onEndPhase',
									noLog: true,
								},
								G,
							),
						);
					}

					let damage = new Damage(
						ability.creature, // Attacker
						nextdmg, // Damage Type
						1, // Area
						[], // Effects
						G,
					);
					nextdmg = trg.takeDamage(damage);

					if (nextdmg.damages === undefined) {
						break;
					} // If attack is dodge
					if (nextdmg.kill) {
						break;
					} // If target is killed
					if (nextdmg.damages.total <= 0) {
						break;
					} // If damage is too weak
					if (nextdmg.damageObj.status !== '') {
						break;
					}
					delete nextdmg.damages.total;
					nextdmg = nextdmg.damages;

					// Get next available targets
					let nextTargets = ability.getTargets(trg.adjacentHexes(1, true));

					nextTargets = nextTargets.filter(function (item) {
						if (item.hexesHit === undefined) {
							return false; // Remove empty ids
						}

						return targets.indexOf(item.target) == -1; // If this creature has already been hit
					});

					// If no target
					if (nextTargets.length === 0) {
						break;
					}

					// Best Target
					let bestTarget = {
						size: 0,
						stats: {
							defense: -99999,
							shock: -99999,
						},
					};
					for (let j = 0; j < nextTargets.length; j++) {
						// For each creature
						if (typeof nextTargets[j] == 'undefined') {
							continue;
						} // Skip empty ids.

						let t = nextTargets[j].target;
						// Compare to best target
						if (t.stats.shock > bestTarget.stats.shock) {
							if (
								(t == ability.creature && nextTargets.length == 1) || // If target is chimera and the only target
								t != ability.creature
							) {
								// Or this is not chimera
								bestTarget = t;
							}
						} else {
							continue;
						}
					}

					if (bestTarget instanceof Creature) {
						targets.push(bestTarget);
					} else {
						break;
					}
				}
			},

			_getHexes: function () {
				return G.grid.getHexMap(
					this.creature.x - 3,
					this.creature.y - 2,
					0,
					false,
					matrices.frontnback3hex,
				);
			},
		},
	];
};
