import { Damage } from '../damage';
import { Team } from '../utility/team';
import { Creature } from '../creature';
import { Effect } from '../effect';
import * as arrayUtils from '../utility/arrayUtils';

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default G => {
	G.abilities[7] = [
		//burningSpirit
		{
			trigger: 'onOtherDamage',
			require(damage) {
				if (!this.testRequirements()) {
					return false;
				}
				if (damage === undefined) {
					damage = {
						// NOTE : This code produce array with doubles.
						type: 'target',
					}; // For the test function to work
				}
				return true;
			},
			activate(damage, target) {
				if (this.creature.id !== damage.attacker.id) {
					return;
				}

				target.addEffect(
					new Effect(
						'Burning Spirit', // Name
						this.creature, // Caster
						target, // Target
						'', // Trigger
						{
							alterations: {
								burn: -1,
							},
						}, // Optional arguments
						G,
					),
				);
				target.stats.burn -= 1;
				if (this.isUpgraded()) {
					this.creature.addEffect(
						new Effect(
							'Burning Heart', // Name
							this.creature, // Caster
							this.creature, // Target
							'', // Trigger
							{
								alterations: {
									burn: 1,
								},
							}, // Optional arguments
							G,
						),
					);
				}
			},
		},
		// Fiery touch
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',
			distance: 3,
			_targetTeam: Team.enemy,
			require() {
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
			query() {
				let ability = this;
				let crea = this.creature;

				if (this.isUpgraded()) {
					this.distance = 5;
				}

				G.grid.queryDirection({
					fnOnConfirm: function() {
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
			activate(path, args) {
				let ability = this;
				ability.end();

				let target = arrayUtils.last(path).creature;
				let projectileInstance = G.animations.projectile(
					this,
					target,
					'effects_fiery-touch',
					path,
					args,
					200,
					-20,
				);
				let tween = projectileInstance[0];
				let sprite = projectileInstance[1];

				tween.onComplete.add(function() {
					let damage = new Damage(
						ability.creature, // Attacker
						ability.damages, // Damage Type
						1, // Area
						[], // Effects
						G,
					);
					target.takeDamage(damage);

					this.destroy();
				}, sprite); // End tween.onComplete
			},
		},
		// Wild Fire
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',
			range: 6,
			require() {
				return this.testRequirements();
			},
			query() {
				let ability = this;
				let crea = this.creature;

				// Teleport to any hex within range except for the current hex
				crea.queryMove({
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
						ability.animation(...arguments);
					},
				});
			},
			activate(hex) {
				let ability = this;
				ability.end();

				if (this.isUpgraded()) {
					this.range += 1;
				}

				let targets = ability.getTargets(ability.creature.adjacentHexes(1));

				targets.forEach(function(item) {
					if (!(item.target instanceof Creature)) {
						return;
					}
				});

				// Leave a Firewall in current location
				let effectFn = function(effect, creatureOrHex) {
					let creature = creatureOrHex;
					if (!(creatureOrHex instanceof Creature)) {
						creature = creatureOrHex.creature;
					}
					creature.takeDamage(new Damage(effect.attacker, ability.damages, 1, [], G), {
						isFromTrap: true,
					});
					this.trap.destroy();
					effect.deleteEffect();
				};

				let requireFn = function() {
					let creature = this.trap.hex.creature,
						type = (creature && creature.type) || null;

					if (creature === 0) {
						return false;
					}
					return type !== ability.creature.type;
				};

				let crea = this.creature;
				crea.hexagons.forEach(function(h) {
					h.createTrap(
						'firewall',
						[
							new Effect(
								'Firewall',
								crea,
								h,
								'onStepIn',
								{
									requireFn: requireFn,
									effectFn: effectFn,
									attacker: crea,
								},
								G,
							),
						],
						crea.player,
						{
							turnLifetime: 1,
							ownerCreature: crea,
							fullTurnLifetime: true,
						},
					);
				});

				ability.creature.moveTo(hex, {
					ignoreMovementPoint: true,
					ignorePath: true,
					animation: 'teleport',
					callback: function() {
						G.activeCreature.queryMove();
					},
				});
			},
		},
		// Greater Pyre
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',
			require() {
				return this.testRequirements();
			},
			query() {
				let ability = this;
				let crea = this.creature;

				// var inRangeCreatures = crea.hexagons[1].adjacentHex(1);

				let range = crea.adjacentHexes(1);

				G.grid.queryHexes({
					fnOnConfirm: function() {
						ability.animation(...arguments);
					},
					fnOnSelect: function(hex) {
						range.forEach(function(item) {
							item.cleanOverlayVisualState();
							item.overlayVisualState('creature selected player' + G.activeCreature.team);
						});
						hex.cleanOverlayVisualState();
						hex.overlayVisualState('creature selected player' + G.activeCreature.team);
					},
					id: this.creature.id,
					hexes: range,
					hideNonTarget: true,
				});
			},
			activate() {
				let ability = this;
				ability.end();

				let crea = this.creature;
				let aoe = crea.adjacentHexes(1);
				let targets = ability.getTargets(aoe);

				if (this.isUpgraded()) {
					this.damages.burn = 30;
				}

				targets.forEach(function(item) {
					item.target.takeDamage(
						new Damage(
							ability.creature, // Attacker
							ability.damages, // Damage Type
							1, // Area
							[], // Effects
							G,
						),
					);
				});
			},
		},
	];
};
