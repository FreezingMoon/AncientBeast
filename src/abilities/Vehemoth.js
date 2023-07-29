import { Damage } from '../damage';
import { Team } from '../utility/team';
import * as matrices from '../utility/matrices';
import * as arrayUtils from '../utility/arrayUtils';
import { Effect } from '../effect';
import { Direction } from '../utility/hex';

/** Creates the abilities
 * @param {Game} G the game object
 * @return {void}
 */
export default (G) => {
	G.abilities[6] = [
		// 	First Ability: Lamellar Body
		{
			//  Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onCreatureSummon onOtherCreatureSummon onOtherCreatureDeath',

			_buff: 0,

			//  require() :
			require: function () {
				// Stop temporary and dead creatures from activating
				if (this.creature.dead || this.creature.temp) {
					return false;
				}
				// Stop activation if the other creature is not a sloth type
				var buff = 0;
				G.creatures.forEach((crea) => {
					if (crea.realm == 'S' && !crea.dead && !crea.temp) {
						buff += 2;
					}
				});
				if (buff == this._buff) {
					return false;
				}
				this._buff = buff;
				return true;
			},

			//  activate() :
			activate: function () {
				const ability = this;
				// Force Vehemoth to stay facing the right way
				this.creature.facePlayerDefault();

				var regrowBuff = 0;
				if (this.isUpgraded()) {
					regrowBuff = this._buff;
				}

				this.creature.replaceEffect(
					// Add and replace the effect each time
					new Effect(
						'Lamellar Body', // name
						this.creature, // caster
						this.creature, // target
						'', // trigger
						{
							alterations: {
								defense: this._buff,
								frost: this._buff,
								regrowth: regrowBuff,
							},
							stackable: false,
						},
						G,
					),
				);
			},
		},

		// 	Second Ability: Flat Frons
		{
			//	Type : Can be "onQuery","onStartPhase","onDamage"
			trigger: 'onQuery',

			_directions: [0, 1, 0, 0, 1, 0], // forward/backward
			_targetTeam: Team.Enemy,

			/**
			 * If the target creature's health <= this value, it can be instantly killed.
			 */
			_executeHealthThreshold: 49,

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
					if (this.isUpgraded()) {
						if (
							!this.testDirection({
								team: this._targetTeam,
								directions: this._directions,
								distance: this.creature.remainingMove + 1,
								sourceCreature: this.creature,
							})
						) {
							return false;
						}
					} else {
						return false;
					}
				}

				return true;
			},

			// 	query() :
			query: function () {
				const ability = this;
				const vehemoth = this.creature;

				const object = {
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					flipped: vehemoth.player.flipped,
					id: vehemoth.id,
					team: Team.Enemy,
					requireCreature: true,
				};

				object.choices = this._getHexes().map((hex) => [hex]);

				if (this.isUpgraded()) {
					const directionObject = G.grid.getDirectionChoices({
						flipped: vehemoth.player.flipped,
						team: this._targetTeam,
						requireCreature: true,
						stopOnCreature: true,
						sourceCreature: vehemoth,
						id: vehemoth.id,
						x: vehemoth.x,
						y: vehemoth.y,
						directions: this._directions,
						distance: vehemoth.remainingMove + 1,
					});

					// Removes duplicates between nearby and inline targets
					object.choices = object.choices.filter(
						(objectHexes) =>
							!directionObject.choices.some((directionHexes) =>
								objectHexes.every((v) => directionHexes.includes(v)),
							),
					);
					object.choices = [...object.choices, ...directionObject.choices];
				}

				G.grid.queryChoice(object);
			},

			//	activate() :
			activate: function (path, args) {
				const ability = this;
				const vehemoth = ability.creature;
				G.Phaser.camera.shake(0.02, 333, true, G.Phaser.camera.SHAKE_HORIZONTAL, true);

				ability.end();

				path = arrayUtils.sortByDirection(path, args.direction);
				const target = arrayUtils.last(path).creature;
				const targetIsNearby = this._getHexes().some((hex) => hex.creature?.id === target.id);

				if (targetIsNearby) {
					ability._damageTarget(target);
				} else {
					// Charge to target.
					arrayUtils.filterCreature(path, false, true, vehemoth.id);
					let destination = arrayUtils.last(path);
					const x = destination.x + (args.direction === 4 ? vehemoth.size - 1 : 0);
					destination = G.grid.hexes[destination.y][x];

					/* Calculate hexes the target could be pushed along. Limited by the number
					of hexes the Vehemoth charged, and will stop when reaching obstacles. */
					let knockbackHexes = G.grid.getHexLine(target.x, target.y, args.direction);
					arrayUtils.filterCreature(knockbackHexes, false, true, target.id);
					knockbackHexes = knockbackHexes.slice(0, path.length);

					vehemoth.moveTo(destination, {
						overrideSpeed: 100,
						callback: function () {
							let knockbackHex = arrayUtils.last(knockbackHexes);

							/* Damage before knockback any other creature movement to handle dead
							targets, Snow Bunny hop incorrectly avoiding damage, etc. */
							const damageResult = ability._damageTarget(target);

							if (damageResult.kill) {
								return;
							}

							if (knockbackHex) {
								// If pushing left, account for the difference in x origin of flipped creatures.
								if (args.direction === Direction.Left) {
									knockbackHex =
										knockbackHex && G.grid.hexes[knockbackHex.y][knockbackHex.x + target.size - 1];
								}

								target.moveTo(knockbackHex, {
									callback: function () {
										G.activeCreature.queryMove();
									},
									ignoreMovementPoint: true,
									ignorePath: true,
									animation: 'push',
								});
							} else {
								G.activeCreature.queryMove();
							}
						},
					});
				}
			},

			/**
			 * Calculate the damage done with the ability and potentially execute the
			 * target if under a certain health threshold.
			 *
			 * @param {Creature} target Target for the ability.
			 * @returns {object} @see creature.takeDamage()
			 */
			_damageTarget(target) {
				const ability = this;
				const shouldExecute = target.health <= ability._executeHealthThreshold && target.isFrozen();
				const damageType = shouldExecute
					? { pure: target.health }
					: { crush: this.damages.crush, frost: this.damages.frost };
				const damage = new Damage(ability.creature, damageType, 1, [], G);
				let damageResult;

				if (shouldExecute) {
					/* Suppress the death message, to be replaced by a custom log. Setting
						`noLog` on Damage wouldn't work as it would suppress Shielded/Dodged messages. */
					this.game.UI.chat.suppressMessage(/is dead/i, 1);
					damageResult = target.takeDamage(damage);

					// Damage could be shielded or blocked, so double check target has died.
					if (damageResult.kill) {
						this.game.log(`%CreatureName${target.id}% has been shattered!`);
						target.hint('Shattered', 'damage');
					}
				} else {
					damageResult = target.takeDamage(damage);
				}

				return damageResult;
			},

			/**
			 * The area of effect is the front and back 3 hexes for a total of 6 hexes.
			 *
			 * @returns {Hex[]} Refer to Creature.getHexMap()
			 */
			_getHexes() {
				return this.creature.getHexMap(matrices.frontnback3hex);
			},
		},

		/**
		 * Primary Ability: Flake Convertor
		 *
		 * Inline ranged attack on a fatigued enemy unit within 5 range. Deals damage
		 * equal to the positive Frost mastery difference between Vehemoth and the target,
		 * who also receives the "Frozen" status.
		 *
		 * When upgraded, the "Frozen" status becomes "Cryostasis" which is a special
		 * "Freeze" that is not broken when receiving damage.
		 *
		 * Targeting rules:
		 * - The target must be an enemy unit.
		 * - The target must have the "Fatigued" status (no remaining endurance).
		 * - The target must be inline (forwards or backwards) within 5 range.
		 * - The path to the target unit cannot be interrupted by any obstacles or units.
		 *
		 * Other rules:
		 * - Attacked unit receives the "Frozen" status, making them skip their next turn.
		 * - There is no cap to the damage dealt from the positive Frost mastery difference.
		 * - Attack damage will be 0 if the target has a higher Frost mastery than Vehemoth,
		 *   but the "Frozen"/"Cryostasis" effect will still be applied.
		 * - The upgraded "Cryostasis" effect does not break when receiving damage from
		 *   the Vehemoth or ANY other source.
		 */
		{
			trigger: 'onQuery',

			_targetTeam: Team.Enemy,
			_directions: [1, 1, 1, 1, 1, 1],
			_distance: 5,

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				if (
					!this.testDirection({
						sourceCreature: this.creature,
						team: this._targetTeam,
						directions: this._directions,
						distance: this._distance,
						optTest: this._confirmTarget,
					})
				) {
					return false;
				}

				return true;
			},

			query: function () {
				const ability = this;
				const vehemoth = this.creature;

				G.grid.queryDirection({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					flipped: vehemoth.player.flipped,
					team: this._targetTeam,
					id: vehemoth.id,
					requireCreature: true,
					x: vehemoth.x,
					y: vehemoth.y,
					directions: this._directions,
					distance: this._distance,
					optTest: this._confirmTarget,
				});
			},

			activate: function (path, args) {
				const ability = this;
				const vehemoth = this.creature;
				const target = arrayUtils.last(path).creature;

				ability.end();
				G.Phaser.camera.shake(0.01, 50, true, G.Phaser.camera.SHAKE_HORIZONTAL, true);

				const [tween, sprite] = G.animations.projectile(
					this,
					target,
					'effects_freezing-spit',
					path,
					args,
					52,
					-20,
				);

				const frostMasteryDifference = Math.max(vehemoth.stats.frost - target.stats.frost, 0);
				const damage = new Damage(
					ability.creature,
					{
						frost: frostMasteryDifference,
					},
					1,
					[],
					G,
				);

				tween.onComplete.add(function () {
					// `this` refers to the animation object, _not_ the ability.
					this.destroy();

					let damageResult;
					if (damage.damages.frost > 0) {
						damageResult = target.takeDamage(damage);
					}

					target.freeze(ability.isUpgraded());

					if (damageResult && !damageResult.kill) {
						G.log(
							`%CreatureName${target.id}% ${
								ability.isUpgraded() ? 'enters Cryostasis' : 'has been Frozen'
							} and cannot act`,
						);
						target.hint(ability.isUpgraded() ? 'Cryostasis' : 'Frozen', 'damage');
					}
				}, sprite); // End tween.onComplete
			},

			/**
			 * Test a potential target enemy unit's state to determine if it can be targeted.
			 *
			 * @param {Creature} creature Enemy unit creature that could be targeted.
			 * @returns {boolean} Does the unit meet the targeting requirements?
			 */
			_confirmTarget(creature) {
				return creature.isFatigued();
			},
		},

		/**
		 * Ultimate Ability: Falling Arrow
		 *
		 * Attack a single enemy unit within a 4 range cone (forwards or backwards),
		 * regardless of line of sight. Deals bonus damage based on the positive level
		 * difference between Vehemoth and the target.
		 *
		 * When upgraded, even more bonus damage is added to a positive level difference.
		 *
		 * Targeting rules:
		 * - The target must be a single enemy unit.
		 * - The target can be selected from any valid target within a 4 range front
		 *   or backwards cone:
		 *   ⬡⬢⬡⬡⬡⬡⬡⬡⬡⬡⬢⬡
		 *   ⬡⬢⬢⬡⬡⬡⬡⬡⬡⬢⬢⬡
		 *   ⬡⬢⬢⬢⬡⬡⬡⬡⬢⬢⬢⬡
		 *   ⬡⬢⬢⬢⬢⬡⬡⬢⬢⬢⬢⬡
		 *   ⬢⬢⬢⬢🥶🥶🥶⬢⬢⬢⬢
		 *   ⬡⬢⬢⬢⬢⬡⬡⬢⬢⬢⬢⬡
		 *   ⬡⬢⬢⬢⬡⬡⬡⬡⬢⬢⬢⬡
		 *   ⬡⬢⬢⬡⬡⬡⬡⬡⬡⬢⬢⬡
		 *   ⬡⬢⬡⬡⬡⬡⬡⬡⬡⬡⬢⬡
		 * - The path to the target unit will not be interrupted by obstacles.
		 *
		 * Other rules:
		 * - Bonus damage is +3 frost per level difference.
		 * - Upgraded ability bonus damage is an additional +2 pierce per level difference.
		 * - Bonus damage will be 0 if the target has a higher level than Vehemoth,
		 *   it does not become a negative bonus.
		 */
		{
			trigger: 'onQuery',

			_directions: [0, 1, 0, 0, 1, 0],
			_targetTeam: Team.Enemy,

			require: function () {
				const vehemoth = this.creature;

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

			query: function () {
				const ability = this;
				const vehemoth = this.creature;

				this.game.grid.queryCreature({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					team: this._targetTeam,
					id: vehemoth.id,
					flipped: vehemoth.flipped,
					hexes: this._getHexes(),
				});
			},

			activate: function (target) {
				const ability = this;
				const vehemoth = this.creature;

				ability.end();
				G.Phaser.camera.shake(0.02, 123, true, G.Phaser.camera.SHAKE_VERTICAL, true);

				const levelDifference = Math.max(vehemoth.level - target.level, 0);
				const damages = {
					...ability.damages,
					frost: ability.damages.frost + levelDifference * ability.bonus_damages.frost,
					pierce:
						ability.damages.pierce +
						(ability.isUpgraded() ? levelDifference * ability.bonus_damages.pierce : 0),
				};
				const damage = new Damage(vehemoth, damages, 1, [], G);
				target.takeDamage(damage);
			},

			/**
			 * The area of effect is a front and back 4 distance cone originating from
			 * the head of the Vehemoth. @see ability description for more details.
			 *
			 * @returns {Hex[]} Refer to HexGrid.getHexMap()
			 */
			_getHexes() {
				const vehemoth = this.creature;

				return [
					...G.grid.getHexMap(
						vehemoth.x,
						// Unsure why the y offset is incorrect when flipping the matrix.
						vehemoth.y - 4,
						2,
						true,
						matrices.fourDistanceCone,
					),
					...this.creature.getHexMap(matrices.fourDistanceCone),
				];
			},
		},
	];
};
