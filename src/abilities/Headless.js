import { Damage } from '../damage';
import { Team } from '../utility/team';
import * as matrices from '../utility/matrices';
import * as arrayUtils from '../utility/arrayUtils';
import { Creature } from '../creature';
import { Effect } from '../effect';

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
		 * of remaining endurance, as well as draining -5 endurance.
		 *
		 * If the Headless begins its turn in a position to trigger the ability, and
		 * ends its turn in the position, the enemy creature will have the ability effect
		 * applied twice.
		 */
		{
			trigger: 'onStartPhase onEndPhase',

			_targetTeam: Team.enemy,

			require: function () {
				if (
					// Headless only triggers ability on its own turn.
					this.creature !== this.game.activeCreature ||
					!this.atLeastOneTarget(this._getHexes(), {
						team: this._targetTeam,
					})
				) {
					return false;
				}

				return this.testRequirements();
			},

			//	activate() :
			activate: function () {
				let ability = this;
				let creature = this.creature;

				this.end();
				// this.setUsed(false); // Infinite triggering

				// TODO: Can multiple targets be selected?
				const targets = this.getTargets(this._getHexes());

				targets.forEach((item) => {
					const { target } = item;

					if (ability.isUpgraded()) {
						// Upgraded ability causes fatigue - endurance set to 0
						// TODO: this will remove endurance, not just fatigue.
						target.addFatigue(target.endurance);
					}

					const effect = target.addEffect(
						new Effect(
							// '', // No name to prevent logging
							this.title, // No name to prevent logging
							creature,
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
						),
					);

					// target.addEffect(effect, '%CreatureName' + target.id + '% has been infested');
				});
			},

			_getHexes: function () {
				return this.creature.getHexMap(matrices.inlineback2hex);
			},
		},

		// 	Second Ability: Cartilage Dagger
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			_targetTeam: Team.enemy,

			// 	require() :
			require: function () {
				let crea = this.creature;

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
				let ability = this;
				let crea = this.creature;

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
				let ability = this;
				ability.end();

				let d = {
					pierce: 11,
				};
				// Bonus for fatigued foe
				d.pierce = target.endurance <= 0 ? d.pierce * 2 : d.pierce;
				// Extra pierce damage if upgraded
				if (this.isUpgraded()) {
					let bonus = this.creature.stats.endurance - target.stats.endurance;
					if (bonus > 0) {
						d.pierce += bonus;
					}
				}

				let damage = new Damage(
					ability.creature, //Attacker
					d, // Damage Type
					1, // Area
					[], // Effects
					G,
				);

				target.takeDamage(damage);
			},
		},

		// 	Third Ability: Whip Move
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			directions: [0, 1, 0, 0, 1, 0],

			_minDistance: 2,
			_getMaxDistance: function () {
				if (this.isUpgraded()) {
					return 8;
				}
				return 6;
			},
			_targetTeam: Team.both,
			_getValidDirections: function () {
				// Get all directions where there are no targets within min distance,
				// and a target within max distance
				let crea = this.creature;
				let x = crea.player.flipped ? crea.x - crea.size + 1 : crea.x;
				let validDirections = [0, 0, 0, 0, 0, 0];
				for (let i = 0; i < this.directions.length; i++) {
					if (this.directions[i] === 0) {
						continue;
					}
					let directions = [0, 0, 0, 0, 0, 0];
					directions[i] = 1;
					let testMin = this.testDirection({
						team: this._targetTeam,
						x: x,
						directions: directions,
						distance: this._minDistance,
						sourceCreature: crea,
					});
					let testMax = this.testDirection({
						team: this._targetTeam,
						x: x,
						directions: directions,
						distance: this._getMaxDistance(),
						sourceCreature: crea,
					});
					if (!testMin && testMax) {
						// Target needs to be moveable
						let fx = 0;
						if (
							(!this.creature.player.flipped && i > 2) ||
							(this.creature.player.flipped && i < 3)
						) {
							fx = -1 * (this.creature.size - 1);
						}
						let dir = G.grid.getHexLine(
							this.creature.x + fx,
							this.creature.y,
							i,
							this.creature.player.flipped,
						);
						if (this._getMaxDistance() > 0) {
							dir = dir.slice(0, this._getMaxDistance() + 1);
						}
						dir = arrayUtils.filterCreature(dir, true, true, this.creature.id);
						let target = arrayUtils.last(dir).creature;
						if (target.stats.moveable) {
							validDirections[i] = 1;
						}
					}
				}
				return validDirections;
			},

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				// Creature must be moveable
				if (!this.creature.stats.moveable) {
					this.message = G.msg.abilities.notMoveable;
					return false;
				}

				// There must be at least one direction where there is a target within
				// min/max range
				let validDirections = this._getValidDirections();
				if (
					!validDirections.some(function (e) {
						return e === 1;
					})
				) {
					this.message = G.msg.abilities.noTarget;
					return false;
				}
				this.message = '';
				return true;
			},

			// 	query() :
			query: function () {
				let ability = this;
				let crea = this.creature;

				G.grid.queryDirection({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					team: this._targetTeam,
					id: crea.id,
					requireCreature: true,
					sourceCreature: crea,
					x: crea.x,
					y: crea.y,
					directions: this._getValidDirections(),
					distance: this._getMaxDistance(),
				});
			},

			//	activate() :
			activate: function (path, args) {
				let ability = this;
				let crea = this.creature;
				let target = arrayUtils.last(path).creature;
				path = path.filter(function (hex) {
					return !hex.creature;
				}); //remove creatures
				ability.end();

				// Movement
				arrayUtils.filterCreature(path, false, false);
				let destination = null;
				let destinationTarget = null;
				if (target.size === 1) {
					/* Small creature, pull target towards self landing it in the hex directly
					in front of the Headless. */
					const hexInFrontOfHeadless = path[0];
					destinationTarget = hexInFrontOfHeadless;
				} else if (target.size === 2) {
					// Medium creature, pull self and target towards each other half way,
					// rounding upwards for self (self move one extra hex if required)
					let midpoint = Math.floor((path.length - 1) / 2);
					destination = path[midpoint];
					if (midpoint < path.length - 1) {
						destinationTarget = path[midpoint + 1];
					}
				} else {
					// Large creature, pull self towards target
					destination = arrayUtils.last(path);
				}

				let x;
				let hex;

				// Check if Headless will be moved.
				if (destination !== null) {
					x = args.direction === 4 ? destination.x + crea.size - 1 : destination.x;
					hex = G.grid.hexes[destination.y][x];
					crea.moveTo(hex, {
						ignoreMovementPoint: true,
						ignorePath: true,
						callback: function () {
							let interval = setInterval(function () {
								if (!G.freezedInput) {
									clearInterval(interval);
									G.activeCreature.queryMove();
								}
							}, 100);
						},
					});
				}

				// Check if target creature will be moved.
				if (destinationTarget !== null) {
					x = args.direction === 1 ? destinationTarget.x + target.size - 1 : destinationTarget.x;
					hex = G.grid.hexes[destinationTarget.y][x];
					target.moveTo(hex, {
						ignoreMovementPoint: true,
						ignorePath: true,
						callback: function () {
							let interval = setInterval(function () {
								if (!G.freezedInput) {
									clearInterval(interval);
									G.activeCreature.queryMove();
								}
							}, 100);
						},
					});
				}
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
				let ability = this;
				let crea = this.creature;

				let hexes = this._getHexes();

				G.grid.queryChoice({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					team: Team.both,
					requireCreature: 0,
					id: crea.id,
					flipped: crea.player.flipped,
					choices: [crea.getHexMap(hexes), crea.getHexMap(hexes, true)],
				});
			},

			activate: function (hexes) {
				let damages = {
					slash: 10,
				};

				let ability = this;
				ability.end();

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
