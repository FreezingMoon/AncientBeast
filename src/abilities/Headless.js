import { Damage } from '../damage';
import { Team } from '../utility/team';
import * as matrices from '../utility/matrices';
import * as arrayUtils from '../utility/arrayUtils';
import { Creature } from '../creature';
import { Effect } from '../effect';
import { Direction } from '../utility/hex';

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default (G) => {
	G.abilities[39] = [
		/**
		 * First Ability: Larva Infest
		 * At both the beginning and end of the Headless turn, if there is an enemy
		 * creature in the hex directly at the back of the Headless, the enemy creature
		 * will instantly lose -5 maximum endurance.
		 *
		 * The upgraded ability also instantly applies the "fatigue" effect regardless
		 * of remaining endurance, as well as reducing -5 maximum endurance.
		 *
		 * If the Headless begins its turn in a position to trigger the ability, and
		 * ends its turn in the position, the enemy creature will have the ability effect
		 * applied twice.
		 */
		{
			trigger: 'onStartPhase onEndPhase',

			_targetTeam: Team.Enemy,

			require: function () {
				// Headless only triggers ability on its own turn.
				if (this.creature !== this.game.activeCreature) {
					return false;
				}

				if (this.creature.materializationSickness) {
					return false;
				}

				if (
					!this.atLeastOneTarget(this._getHexes(), {
						team: this._targetTeam,
					})
				) {
					return false;
				}

				return this.testRequirements();
			},

			activate: function () {
				this.end();

				// require() has identified a valid target, so we can safely assume it is there.
				const target = this._getHexes()[0].creature;
				if (this.isUpgraded()) {
					// Upgraded ability causes fatigue - endurance set to 0.
					target.addFatigue(target.endurance);
				}

				const effect = new Effect(
					this.title,
					this.creature,
					target,
					// Effect never fades.
					'',
					{
						stackable: true,
						alterations: {
							endurance: -5,
						},
					},
					G,
				);
				if (target.isFragile()) {
					G.log(`%CreatureName${target.id}% is already fragile`);
				} else if (target.endurance < 5 && target.endurance > 0) {
					target.addEffect(
						effect,
						`%CreatureName${target.id}% loses -${target.endurance} endurance`,
					);
				} else {
					target.addEffect(effect, `%CreatureName${target.id}% loses -5 endurance`);
				}
				// Display potentially new "Fragile" status when losing maximum endurance.
				// TODO: Creatures are responsible for telling the UI if they potentially
				// make a change that might update another creature's fatigue. But this is
				// fragile. Ideally, this would be refactored so that the UI doesn't need
				// to be told about an update.
				this.game.UI.updateFatigue();
			},

			_getHexes: function () {
				return this.creature.getHexMap(
					/* Headless position is the front hex of its two hexes, so we look for
					an enemy unit two hexes back which will be the hex directly behind Headless. */
					matrices.inlineback2hex,
				);
			},
		},

		// 	Second Ability: Cartilage Dagger
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			_targetTeam: Team.Enemy,

			// 	require() :
			require: function () {
				const crea = this.creature;

				if (!this.testRequirements()) {
					return false;
				}

				//At least one target
				if (
					!this.atLeastOneTarget(crea.getHexMap(matrices.frontnback2hex), {
						team: this._targetTeam,
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

				G.grid.queryCreature({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					team: this._targetTeam,
					id: crea.id,
					flipped: crea.flipped,
					hexes: crea.getHexMap(matrices.frontnback2hex),
				});
			},

			//	activate() :
			activate: function (target) {
				const ability = this;
				ability.end();
				G.Phaser.camera.shake(0.01, 90, true, G.Phaser.camera.SHAKE_HORIZONTAL, true);

				const d = {
					pierce: 11,
				};
				// Bonus for fatigued foe
				d.pierce = target.endurance <= 0 ? d.pierce * 2 : d.pierce;
				// Extra pierce damage if upgraded
				if (this.isUpgraded()) {
					const bonus = this.creature.stats.endurance - target.stats.endurance;
					if (bonus > 0) {
						d.pierce += bonus;
					}
				}

				const damage = new Damage(
					ability.creature, //Attacker
					d, // Damage Type
					1, // Area
					[], // Effects
					G,
				);

				target.takeDamage(damage);
			},
		},

		/**
		 * Primary Ability: Whip Move
		 *
		 * Inline ranged utility for pulling the Headless and a single allied or enemy
		 * unit together. Whether the Headless, target, or both are displaced depends
		 * on the relative size between the units.
		 *
		 * When upgraded the maximum range is increased.
		 *
		 * Targeting rules:
		 * - The target can be a single enemy or allied unit.
		 * - The target must be moveable.
		 * - The target must be inline (forwards or backwards) within the minimum and
		 *   maximum range.
		 * - The path to the target unit cannot be interrupted by any obstacles or units.
		 * - Targets in the deadzone (under minimum) range interrupt the path to other
		 *   valid targets.
		 *
		 * Other rules:
		 * - The ability deals no damage, even when targeting enemy units.
		 * - If the target is 1-sized, it is pulled to the hex in front of the Headless.
		 * - If the target is 2-sized, both units will be pulled towards each other
		 *   ending up adjacent at a halfway point.
		 * - If the target is 3-sized, the Headless is pulled to the hex in front of
		 *   the target.
		 * - The pull movement ignores pathing (it is pulled through the air) until
		 *   the final hex. For example, only a trap on the "landing" hex will be triggered.
		 * - The pull movement does not consume movement points.
		 * - Headless cannot use the ability if immoveable.
		 */
		{
			trigger: 'onQuery',

			_targetTeam: Team.Both,
			_directions: [0, 1, 0, 0, 1, 0],

			require: function () {
				const headless = this.creature;

				if (!this.testRequirements()) {
					return false;
				}

				if (!headless.stats.moveable) {
					this.message = G.msg.abilities.notMoveable;
					return false;
				}

				if (
					!this.testDirection({
						team: this._targetTeam,
						sourceCreature: headless,
						flipped: headless.player.flipped,
						directions: this._directions,
						distance: this._getMaxDistance(),
						minDistance: this.range.minimum,
						optTest: (creature) => creature.stats.moveable,
					})
				) {
					return false;
				}

				return true;
			},

			query: function () {
				const ability = this;
				const headless = this.creature;

				G.grid.queryDirection({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					team: this._targetTeam,
					id: headless.id,
					sourceCreature: headless,
					flipped: headless.player.flipped,
					x: headless.x,
					y: headless.y,
					directions: this._directions,
					distance: this._getMaxDistance(),
					minDistance: this.range.minimum,
					optTest: (creature) => creature.stats.moveable,
				});
			},

			activate: function (target) {
				const ability = this;
				const headless = this.creature;
				target = target.find((hex) => hex.creature).creature;
				ability.end();

				// Movement - here be legacy dragons.
				let destinationX = null;
				let destinationTargetX = null;
				const isOnLeft = headless.x < target.x;
				if (target.size === 1) {
					/* Small creature, pull target towards self landing it in the hex directly
					in front of the Headless. */
					destinationTargetX = isOnLeft ? headless.x + 1 : headless.x - 2;
				} else if (target.size === 2) {
					/* Medium creature, pull self and target towards each other half way,
					rounding upwards for self (self move one extra hex if required). */
					let midpoint = Math.floor((headless.x + target.x) / 2);
					if (headless.x < target.x && (headless.x + target.x) % 2 == 1) {
						midpoint++;
					}
					destinationX = isOnLeft ? midpoint - 1 : midpoint + 1;
					if (Math.abs(headless.x - target.x) > 1) {
						destinationTargetX = isOnLeft ? midpoint + 1 : midpoint - 1;
					}
				} else {
					// Large creature, pull self towards target.
					destinationX = !isOnLeft ? target.x + 2 : target.x - 3;
				}

				let x;
				let hex;

				// Check if Headless will be moved.
				if (destinationX) {
					hex = G.grid.hexes[headless.y][destinationX];
					headless.moveTo(hex, {
						ignoreMovementPoint: true,
						ignorePath: true,
						callback: function () {
							const interval = setInterval(function () {
								if (!G.freezedInput) {
									clearInterval(interval);
									G.activeCreature.queryMove();
									headless.facePlayerDefault();
								}
							}, 100);
						},
					});
				}

				// Check if target creature will be moved.
				if (destinationTargetX) {
					hex = G.grid.hexes[headless.y][destinationTargetX];
					target.moveTo(hex, {
						ignoreMovementPoint: true,
						ignorePath: true,
						callback: function () {
							const interval = setInterval(function () {
								if (!G.freezedInput) {
									clearInterval(interval);
									G.activeCreature.queryMove();
									headless.facePlayerDefault();
								}
							}, 100);
						},
					});
				}
			},

			_getMaxDistance: function () {
				return this.isUpgraded() ? this.range.upgraded : this.range.regular;
			},
		},

		// 	Fourth Ability: Boomerang Tool
		{
			//	Type : Can be "onQuery","onStartPhase","onDamage"
			trigger: 'onQuery',

			damages: {
				slash: 10,
				crush: 5,
			},

			_getHexes: function () {
				// extra range if upgraded
				if (this.isUpgraded()) {
					return matrices.headlessBoomerangUpgraded;
				} else {
					return matrices.headlessBoomerang;
				}
			},

			// 	require() :
			require: function () {
				if (!this.testRequirements()) {
					return false;
				}
				return true;
			},

			// 	query() :
			query: function () {
				const ability = this;
				const crea = this.creature;

				const hexes = this._getHexes();

				G.grid.queryChoice({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					team: Team.Both,
					requireCreature: 0,
					id: crea.id,
					flipped: crea.player.flipped,
					choices: [crea.getHexMap(hexes), crea.getHexMap(hexes, true)],
				});
			},

			activate: function (hexes) {
				const damages = {
					slash: 10,
				};

				const ability = this;
				ability.end();
				G.Phaser.camera.shake(0.02, 100, true, G.Phaser.camera.SHAKE_HORIZONTAL, true);

				ability.areaDamage(
					ability.creature, //Attacker
					damages, //Damage Type
					[], //Effects
					ability.getTargets(hexes), //Targets
					true, //Notriggers avoid double retailiation
				);

				ability.areaDamage(
					ability.creature, //Attacker
					damages, //Damage Type
					[], //Effects
					ability.getTargets(hexes), //Targets
				);
			},
		},
	];
};
