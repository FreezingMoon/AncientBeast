import { Damage } from "../damage";
import { Team } from "../utility/team";
import * as matrices from "../utility/matrices";
import * as arrayUtils from "../utility/arrayUtils";
import { Creature } from "../creature";
import { Effect } from "../effect";
import { isTeam } from "../utility/team";

/**
 * Creates the abilities
 * @param {Object} G the game object 
 */
export default (G) => {
	G.abilities[5] = [

		// 	First Ability: Electrified Hair
		{
			trigger: "onUnderAttack",

			require: function () {
				// Always true to highlight ability
				return true;
			},

			activate: function (damage) {
				if (damage === undefined) return false;
				if (!damage.damages.shock) return false;
				this.end();
				var converted = Math.floor(damage.damages.shock / 4);
				// Lower damage
				damage.damages.shock -= converted;
				// Replenish energy
				// Calculate overflow first; we may need it later
				var energyMissing = this.creature.stats.energy - this.creature.energy;
				var energyOverflow = converted - energyMissing;
				this.creature.recharge(converted);
				// If upgraded and energy overflow, convert into health
				if (this.isUpgraded() && energyOverflow > 0) {
					this.creature.heal(energyOverflow);
				}
				G.log("%CreatureName" + this.creature.id + "% absorbs " + converted + " shock damage into energy");
				return damage;
			}
		},



		// 	Second Ability: Hasted Javelin
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: "onQuery",

			_targetTeam: Team.enemy,

			// 	require() :
			require: function () {
				if (!this.testRequirements()) return false;

				if (!this.atLeastOneTarget(this._getHexes(), {
					team: this._targetTeam
				})) {
					return false;
				}
				return true;
			},

			// 	query() :
			query: function () {

				var ability = this;
				var creature = this.creature;

				G.grid.queryCreature({
					fnOnConfirm: function () {
						ability.animation.apply(ability, arguments);
					},
					team: this._targetTeam,
					id: creature.id,
					flipped: creature.flipped,
					hexes: this._getHexes()
				});
			},


			//	activate() :
			activate: function (target, args) {
				var ability = this;
				ability.end();

				var finalDmg = $j.extend({
					poison: 0
				}, ability.damages1);

				// Poison Bonus if upgraded
				if (this.isUpgraded()) {
					finalDmg.poison = this.damages1.poison;
				}

				G.UI.checkAbilities();

				var damage = new Damage(
					ability.creature, // Attacker
					finalDmg, // Damage Type
					1, // Area
					[], // Effects
					G
				);
				var result = target.takeDamage(damage);
				// Recharge movement if any damage dealt
				if (result.damages && result.damages.total > 0) {
					this.creature.remainingMove = this.creature.stats.movement;
					G.log("%CreatureName" + this.creature.id + "%'s movement recharged");
					G.activeCreature.queryMove();
				}
			},

			_getHexes: function () {
				return G.grid.getHexMap(this.creature.x - 3, this.creature.y - 2, 0, false, matrices.frontnback3hex);
			}
		},



		// 	Thirt Ability: Poisonous Vine
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: "onQuery",

			_targetTeam: Team.enemy,

			// 	require() :
			require: function () {
				if (!this.atLeastOneTarget(this._getHexes(), {
					team: this._targetTeam
				})) {
					return false;
				}
				return this.testRequirements();
			},

			// 	query() :
			query: function () {
				var ability = this;
				var creature = this.creature;

				G.grid.queryCreature({
					fnOnConfirm: function () {
						ability.animation.apply(ability, arguments);
					},
					team: this._targetTeam,
					id: creature.id,
					flipped: creature.flipped,
					hexes: this._getHexes()
				});
			},

			activate: function (target) {
				this.end();
				var damages = this.damages;
				// Last 1 turn, or indefinitely if upgraded
				var lifetime = this.isUpgraded() ? 0 : 1;
				var ability = this;
				// Add a trap to every hex of the target
				var effect = new Effect(
					ability.title, ability.creature, this, "onStepOut", {
						effectFn: function (effect) {
							G.log("%CreatureName" + effect.target.id + "% is hit by " + effect.name);
							effect.target.takeDamage(
								new Damage(effect.owner, damages, 1, [], G), {
									isFromTrap: true
								});
							// Hack: manually destroy traps so we don't activate multiple traps
							// and see multiple logs etc.
							target.hexagons.forEach(function (hex) {
								hex.destroyTrap();
							});
							effect.deleteEffect();
						}
					},
					G
				);
				target.hexagons.forEach(function (hex) {
					hex.createTrap(
						"poisonous-vine", [effect],
						ability.creature.player, {
							turnLifetime: lifetime,
							fullTurnLifetime: true,
							ownerCreature: ability.creature,
							destroyOnActivate: true,
							destroyAnimation: 'shrinkDown'
						}
					);
				});
			},

			_getHexes: function () {
				// Target a creature within 2 hex radius
				var hexes = G.grid.hexes[this.creature.y][this.creature.x].adjacentHex(2);
				return arrayUtils.extendToLeft(hexes, this.creature.size, G.grid);
			}
		},



		//	Fourth Ability: Chain Lightning
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: "onQuery",

			_targetTeam: Team.both,

			require: function () {
				if (!this.testRequirements()) return false;
				if (!this.atLeastOneTarget(this._getHexes(), {
					team: this._targetTeam
				})) {
					return false;
				}
				return true;
			},

			//	query() :
			query: function () {
				var ability = this;

				G.grid.queryCreature({
					fnOnConfirm: function () {
						ability.animation.apply(ability, arguments);
					},
					team: this._targetTeam,
					id: this.creature.id,
					flipped: this.creature.flipped,
					hexes: this._getHexes()
				});
			},


			//	activate() :
			activate: function (target) {
				var ability = this;
				ability.end();

				var targets = [];
				targets.push(target); // Add First creature hit
				var nextdmg = $j.extend({}, ability.damages); // Copy the object

				// For each Target
				for (var i = 0; i < targets.length; i++) {
					var trg = targets[i];

					// If upgraded and the target is an ally, protect it with an effect that
					// reduces the damage to guarantee at least 1 health remaining
					if (this.isUpgraded() && isTeam(this.creature, trg, Team.ally)) {
						trg.addEffect(new Effect(
							this.title,
							this.creature,
							trg,
							"onUnderAttack", {
								effectFn: function (effect, damage) {
									// Simulate the damage to determine how much damage would have
									// been dealt; then reduce the damage so that it will not kill
									while (true) {
										var dmg = damage.applyDamage();
										// If we can't reduce any further, give up and have the damage
										// be zero
										if (dmg.total <= 0 || damage.damages.shock <= 0 ||
											trg.health <= 1) {
											damage.damages = {
												shock: 0
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
								deleteTrigger: "onEndPhase",
								noLog: true
							},
							G
						));
					}

					var damage = new Damage(
						ability.creature, // Attacker
						nextdmg, // Damage Type
						1, // Area
						[], // Effects
						G
					);
					nextdmg = trg.takeDamage(damage);

					if (nextdmg.damages === undefined) break; // If attack is dodge
					if (nextdmg.kill) break; // If target is killed
					if (nextdmg.damages.total <= 0) break; // If damage is too weak
					if (nextdmg.damageObj.status !== "") break;
					delete nextdmg.damages.total;
					nextdmg = nextdmg.damages;

					// Get next available targets
					var nextTargets = ability.getTargets(trg.adjacentHexes(1, true));

					nextTargets = nextTargets.filter(function (item) {
						if (item.hexesHit === undefined) {
							return false; // Remove empty ids
						}

						return (targets.indexOf(item.target) == -1); // If this creature has already been hit
					});

					// If no target
					if (nextTargets.length === 0) break;

					// Best Target
					var bestTarget = {
						size: 0,
						stats: {
							defense: -99999,
							shock: -99999
						}
					};
					for (var j = 0; j < nextTargets.length; j++) { // For each creature
						if (typeof nextTargets[j] == "undefined") continue; // Skip empty ids.

						var t = nextTargets[j].target;
						// Compare to best target
						if (t.stats.shock > bestTarget.stats.shock) {
							if ((t == ability.creature && nextTargets.length == 1) || // If target is chimera and the only target
								t != ability.creature) { // Or this is not chimera
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
				return G.grid.getHexMap(this.creature.x - 3, this.creature.y - 2, 0, false, matrices.frontnback3hex);
			}
		}

	];
};