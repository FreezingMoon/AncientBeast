import { Damage } from '../damage';
import { Team } from '../utility/team';
import { Creature } from '../creature';
import { Effect } from '../effect';
import * as arrayUtils from '../utility/arrayUtils';

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default (G) => {
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
				let crea = this.creature;

				if (this.isUpgraded()) {
					this.distance = 5;
				}

				G.grid.queryDirection({
					fnOnConfirm: (...args) => {
						this.animation(...args);
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
				let target = arrayUtils.last(path).creature;
				let startX = this.creature.sprite.scale.x > 0 ? 232 : 52;
				let projectileInstance = G.animations.projectile(
					this,
					target,
					'effects_fiery-touch',
					path,
					args,
					startX,
					-20,
				);
				let tween = projectileInstance[0];
				let sprite = projectileInstance[1];

				tween.onComplete.add(() => {
					let damage = new Damage(
						this.creature, // Attacker
						this.damages, // Damage Type
						1, // Area
						[], // Effects
						G,
					);
					target.takeDamage(damage);

					this.end();
					this.destroy();
				}, sprite); // End tween.onComplete
			},
			getAnimationData: () => {
				return {
					duration: 425,
				};
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
				let crea = this.creature;

				// Teleport to any hex within range except for the current hex
				crea.queryMove({
					noPath: true,
					isAbility: true,
					range: G.grid.getFlyingRange(crea.x, crea.y, this.range, crea.size, crea.id),
					callback: (hex, args) => {
						console.log(arguments);
						console.log(hex, args);
						if (hex.x == args.creature.x && hex.y == args.creature.y) {
							// Prevent null movement
							this.query();
							return;
						}
						delete arguments[1];
						this.animation(...arguments);
					},
				});
			},
			activate(hex) {
				this.end();

				if (this.isUpgraded()) {
					this.range += 1;
				}

				let targets = this.getTargets(this.creature.adjacentHexes(1));

				targets.forEach((item) => {
					if (!(item.target instanceof Creature)) {
						return;
					}
				});

				// Leave a Firewall in current location
				let effectFn = (effect, creatureOrHex) => {
					let creature = creatureOrHex;
					if (!(creatureOrHex instanceof Creature)) {
						creature = creatureOrHex.creature;
					}
					creature.takeDamage(new Damage(effect.attacker, this.damages, 1, [], G), {
						isFromTrap: true,
					});
					this.trap.destroy();
					effect.deleteEffect();
				};

				let requireFn = () => {
					let creature = this.trap.hex.creature,
						type = (creature && creature.type) || null;

					if (creature === 0) {
						return false;
					}
					return type !== this.creature.type;
				};

				let crea = this.creature;
				crea.hexagons.forEach(function (h) {
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

				this.creature.moveTo(hex, {
					ignoreMovementPoint: true,
					ignorePath: true,
					animation: 'teleport',
					callback: () => {
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
				let crea = this.creature;

				// var inRangeCreatures = crea.hexagons[1].adjacentHex(1);

				let range = crea.adjacentHexes(1);

				G.grid.queryHexes({
					fnOnConfirm: (...args) => {
						this.animation(...args);
					},
					fnOnSelect: function (hex) {
						range.forEach((item) => {
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
				this.end();

				let crea = this.creature;
				let aoe = crea.adjacentHexes(1);
				let targets = this.getTargets(aoe);

				if (this.isUpgraded()) {
					this.damages.burn = 30;
				}

				targets.forEach((item) => {
					item.target.takeDamage(
						new Damage(
							this.creature, // Attacker
							this.damages, // Damage Type
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
