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
	G.abilities[40] = [
		/**
		 * First Ability: Tentacle Bush
		 * When ending the Nutcase's turn, it gains the "Tentacle Bush" effect which:
		 * - makes the Nutcase immovable until its next turn
		 * - applies an effect against melee attackers
		 * - lasts until its next turn
		 * - is never active during the Nutcase's own turn making this a defensive ability.
		 *
		 * The effect applied to attackers:
		 * - makes the attacker immovable (roots them in place)
		 * - if upgraded, makes the attacker's abilities cost +5 energy
		 * - lasts until the end of the attacker's current turn
		 * - does not stack (i.e. not +10 energy for two attacks)
		 */
		{
			trigger: 'onEndPhase',

			require: function () {
				// Always true to highlight ability
				return true;
			},

			activate: function () {
				const immoveableEffect = new Effect(
					// This effect shows the Nutcase being affected by Tentacle Bush in the UI.
					this.title,
					this.creature,
					this.creature,
					'',
					{
						alterations: {
							moveable: false,
						},
						deleteTrigger: 'onStartPhase',
						turnLifetime: 1,
					},
					G,
				);

				const damageShieldEffect = new Effect(
					// Don't show two effects in the log.
					'',
					this.creature,
					this.creature,
					'onUnderAttack',
					{
						effectFn: (...args) => this._activateOnAttacker(...args),
						deleteTrigger: 'onStartPhase',
						turnLifetime: 1,
					},
					G,
				);

				this.creature.addEffect(immoveableEffect);
				this.creature.addEffect(damageShieldEffect);

				this.end(
					/* Suppress "uses ability" log message, just show the "affected by" Effect
					log message. */
					true,
				);
			},

			_activateOnAttacker: function (effect, damage) {
				// Must take melee damage from a non-trap source
				if (damage === undefined || !damage.melee || damage.isFromTrap) {
					return false;
				}

				// Target becomes unmovable until end of their phase
				let o = {
					alterations: {
						moveable: false,
					},
					deleteTrigger: 'onEndPhase',
					// Delete this effect as soon as attacker's turn finishes
					turnLifetime: 1,
					creationTurn: G.turn - 1,
					deleteOnOwnerDeath: true,
					stackable: false,
				};

				// If upgraded, target abilities cost more energy
				if (this.isUpgraded()) {
					o.alterations.reqEnergy = 5;
				}

				const attackerEffect = new Effect(
					this.title,
					this.creature, // Caster
					damage.attacker, // Target
					'', // Trigger
					o,
					G,
				);

				damage.attacker.addEffect(
					attackerEffect,
					`%CreatureName${attackerEffect.target.id}% has been grasped by tentacles`,
				);

				// Making attacker unmovable will change its move query, so update it
				if (damage.attacker === G.activeCreature) {
					damage.attacker.queryMove();
				}
			},
		},

		//	Second Ability: Hammer Time
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			_targetTeam: Team.enemy,

			//	require() :
			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				if (
					!this.atLeastOneTarget(this.creature.getHexMap(matrices.frontnback2hex), {
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

				if (!this.isUpgraded()) {
					G.grid.queryCreature({
						fnOnConfirm: function () {
							ability.animation(...arguments);
						},
						team: this._targetTeam,
						id: this.creature.id,
						flipped: this.creature.flipped,
						hexes: this.creature.getHexMap(matrices.frontnback2hex),
					});
				} else {
					// If upgraded, show choice of front and back hex groups
					let choices = [
						this.creature.getHexMap(matrices.front2hex),
						this.creature.getHexMap(matrices.back2hex),
					];
					G.grid.queryChoice({
						fnOnSelect: function (choice, args) {
							G.activeCreature.faceHex(args.hex, undefined, true);
							args.hex.overlayVisualState('creature selected player' + G.activeCreature.team);
						},
						fnOnConfirm: function () {
							ability.animation(...arguments);
						},
						team: this._targetTeam,
						id: this.creature.id,
						choices: choices,
					});
				}
			},

			activate: function (targetOrChoice, args) {
				let ability = this;
				ability.end();

				if (!this.isUpgraded()) {
					this._activateOnTarget(targetOrChoice);
				} else {
					// We want to order the hexes in a clockwise fashion, unless the player
					// chose the last clockwise hex, in which case order counterclockwise.
					// Order by y coordinate, which means:
					// - y ascending if
					//   - front choice (choice 0) and not bottom hex chosen, or
					//   - back choice (choice 1) and top hex chosen
					// - otherwise, y descending
					let isFrontChoice = args.choiceIndex === 0;
					let yCoords = targetOrChoice.map(function (hex) {
						return hex.y;
					});
					let yMin = Math.min.apply(null, yCoords);
					let yMax = Math.max.apply(null, yCoords);
					let yAscending;
					if (isFrontChoice) {
						yAscending = args.hex.y !== yMax;
					} else {
						yAscending = args.hex.y === yMin;
					}
					targetOrChoice.sort(function (a, b) {
						return yAscending ? a.y - b.y : b.y - a.y;
					});
					for (let i = 0; i < targetOrChoice.length; i++) {
						let target = targetOrChoice[i].creature;
						// only attack enemies
						if (!target || !isTeam(this.creature, target, this._targetTeam)) {
							continue;
						}
						this._activateOnTarget(target);
					}
				}
			},

			_activateOnTarget: function (target) {
				let ability = this;

				// Target takes pierce damage if it ever moves
				let effect = new Effect(
					'Hammered', // Name
					this.creature, // Caster
					target, // Target
					'onStepOut', // Trigger
					{
						effectFn: function (eff) {
							const waitForMovementComplete = (message, payload) => {
								if (message === 'movementComplete' && payload.creature.id === eff.target.id) {
									this.game.signals.creature.remove(waitForMovementComplete);

									eff.target.takeDamage(
										new Damage(
											eff.owner,
											{
												pierce: ability.damages.pierce,
											},
											1,
											[],
											G,
										),
									);
									eff.deleteEffect();
								}
							};

							// Wait until movement is completely finished before processing effects.
							this.game.signals.creature.add(waitForMovementComplete);
						},
					},
					G,
				);

				let damage = new Damage(
					this.creature, // Attacker
					this.damages, // Damage Type
					1, // Area
					[effect], // Effects
					G,
				);

				target.takeDamage(damage);
			},
		},

		// 	Third Ability: War Horn
		{
			trigger: 'onQuery',

			_directions: [0, 1, 0, 0, 1, 0], // forward/backward
			_targetTeam: Team.enemy,

			//	require() :
			require: function () {
				if (!this.testRequirements()) {
					return false;
				}
				if (
					!this.testDirection({
						team: this._targetTeam,
						directions: this._directions,
					})
				) {
					return false;
				}
				return true;
			},

			query: function () {
				let ability = this;

				let o = {
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					team: this._targetTeam,
					requireCreature: true,
					id: this.creature.id,
					sourceCreature: this.creature,
					x: this.creature.x,
					y: this.creature.y,
					directions: this._directions,
					dashedHexesAfterCreatureStop: false,
				};
				if (!this.isUpgraded()) {
					G.grid.queryDirection(o);
				} else {
					// Create custom choices containing normal directions plus hex choices
					// past the first creature, extending up to the next obstacle
					o = G.grid.getDirectionChoices(o);
					let newChoices = [];
					for (let i = 0; i < o.choices.length; i++) {
						let j;
						let direction = o.choices[i][0].direction;

						// Add dashed hexes up to the next obstacle for this direction choice
						let fx = 0;
						if (o.sourceCreature instanceof Creature) {
							if (
								(!o.sourceCreature.player.flipped && direction > 2) ||
								(o.sourceCreature.player.flipped && direction < 3)
							) {
								fx = -(o.sourceCreature.size - 1);
							}
						}
						let line = G.grid.getHexLine(o.x + fx, o.y, direction, o.flipped);
						o.choices[i].forEach(function (choice) {
							arrayUtils.removePos(line, choice);
						});

						arrayUtils.filterCreature(line, false, true, o.id);
						o.hexesDashed = o.hexesDashed.concat(line);

						// For each dashed hex, create a new choice composed of the original
						// choice, extended up to and including the dashed hex. This will be the
						// choice that pushes the target up to that hex.
						// Get a new hex line so that the hexes are in the right order
						let newChoice = G.grid.getHexLine(o.x + fx, o.y, direction, o.flipped);
						// Exclude creature
						ability.creature.hexagons.forEach(function (hex) {
							if (arrayUtils.findPos(newChoice, hex)) {
								arrayUtils.removePos(newChoice, hex);
							}
						});

						// Exclude hexes that don't exist in the original choice
						for (j = 0; j < newChoice.length; j++) {
							if (!arrayUtils.findPos(o.choices[i], newChoice[j])) {
								arrayUtils.removePos(newChoice, newChoice[j]);
								j--;
							}
						}
						// Extend choice to include each dashed hex in succession
						for (j = 0; j < line.length; j++) {
							newChoice.push(line[j]);
							newChoices.push(newChoice.slice());
						}
					}
					o.choices = o.choices.concat(newChoices);
					o.requireCreature = false;
					G.grid.queryChoice(o);
				}
			},

			activate: function (path, args) {
				let i;
				let ability = this;
				this.end();

				// Find:
				// - the target which is the first creature in the path
				// - the run path which is up to the creature
				// - the push paths which start from the last creature hex and continues to
				//   the rest of the path
				let target;
				let runPath;
				let pushPath = [];
				for (i = 0; i < path.length; i++) {
					if (path[i].creature) {
						target = path[i].creature;
						runPath = path.slice(0, i);
						pushPath = path.slice(i);
						break;
					}
				}

				// Calculate damage, extra damage per hex distance
				let damages = $j.extend({}, this.damages);
				damages.pierce += runPath.length;
				let damage = new Damage(this.creature, damages, 1, [], G);

				// Move towards target if necessary
				if (runPath.length > 0) {
					let destination = arrayUtils.last(runPath);
					if (args.direction === 4) {
						destination = G.grid.hexes[destination.y][destination.x + this.creature.size - 1];
					}

					G.grid.cleanReachable();
					this.creature.moveTo(destination, {
						overrideSpeed: 100,
						ignoreMovementPoint: true,
						callback: function () {
							let interval = setInterval(function () {
								if (!G.freezedInput) {
									clearInterval(interval);
									// Check that target is in same place still (for evades)
									if (
										target.x == destination.x - ability.creature.size &&
										target.y === destination.y
									) {
										// Deal damage only if we have reached the end of the path
										if (destination.creature === ability.creature) {
											target.takeDamage(damage);
										}

										if (!ability._pushTarget(target, pushPath, args)) {
											G.activeCreature.queryMove();
										}
									}
								}
							}, 100);
						},
					});
				} else {
					target.takeDamage(damage);
					if (!ability._pushTarget(target, pushPath, args)) {
						G.activeCreature.queryMove();
					}
				}
			},

			_pushTarget: function (target, pushPath, args) {
				let ability = this;
				let creature = this.creature;

				let targetPushPath = pushPath.slice();
				// TODO: These lines are vital do not remove. Refactor so what they do is more readable
				arrayUtils.filterCreature(targetPushPath, false, false, creature.id);
				arrayUtils.filterCreature(targetPushPath, false, false, target.id);

				if (targetPushPath.length === 0) {
					return false;
				}

				// Push the creature one hex at a time
				// As we need to move creatures simultaneously, we can't use the normal path
				// calculation as the target blocks the path
				let i = 0;
				let interval = setInterval(function () {
					if (!G.freezedInput) {
						if (
							i === targetPushPath.length ||
							creature.dead ||
							target.dead ||
							!creature.stats.moveable ||
							!target.stats.moveable
						) {
							clearInterval(interval);
							creature.facePlayerDefault();
							G.activeCreature.queryMove();
						} else {
							let hex = pushPath[i];
							let targetHex = targetPushPath[i];
							if (args.direction === 4) {
								hex = G.grid.hexes[hex.y][hex.x + creature.size - 1];
								targetHex = G.grid.hexes[targetHex.y][targetHex.x + target.size - 1];
							}
							ability._pushOneHex(target, hex, targetHex);
							i++;
						}
					}
				});

				return true;
			},

			_pushOneHex: function (target, hex, targetHex) {
				let opts = {
					overrideSpeed: 100,
					ignorePath: true,
					ignoreMovementPoint: true,
					turnAroundOnComplete: false,
				};
				// Note: order matters here; moving ourselves first results on overlapping
				// hexes momentarily and messes up creature hex displays
				target.moveTo(
					targetHex,
					$j.extend(
						{
							animation: 'push',
						},
						opts,
					),
				);
				this.creature.moveTo(hex, opts);
			},
		},

		//	Fourth Ability: Fishing Hook
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			_targetTeam: Team.enemy,

			require: function () {
				let ability = this;
				if (!this.testRequirements()) {
					return false;
				}

				if (
					!this.atLeastOneTarget(this.creature.getHexMap(matrices.inlinefrontnback2hex), {
						team: this._targetTeam,
						optTest: function (creature) {
							// Size restriction of 2 if unupgraded
							return ability.isUpgraded() ? true : creature.size <= 2;
						},
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
					hexes: this.creature.getHexMap(matrices.inlinefrontnback2hex),
					optTest: function (creature) {
						// Size restriction of 2 if unupgraded
						return ability.isUpgraded() ? true : creature.size <= 2;
					},
				});
			},

			//	activate() :
			activate: function (target) {
				let ability = this;
				let crea = ability.creature;
				ability.end();

				let damage = new Damage(
					crea, // Attacker
					ability.damages, // Damage Type
					1, // Area
					[], // Effects
					G,
				);

				let inlinefront2hex = matrices.inlinefront2hex;

				let trgIsInfront =
					G.grid.getHexMap(
						crea.x - inlinefront2hex.origin[0],
						crea.y - inlinefront2hex.origin[1],
						0,
						false,
						inlinefront2hex,
					)[0].creature == target;

				let creaX = target.x + (trgIsInfront ? 0 : crea.size - target.size);
				crea.moveTo(G.grid.hexes[target.y][creaX], {
					ignorePath: true,
					ignoreMovementPoint: true,
					callback: function () {
						crea.updateHex();
						crea.queryMove();
					},
				});
				let targetX = crea.x + (trgIsInfront ? target.size - crea.size : 0);
				target.moveTo(G.grid.hexes[crea.y][targetX], {
					ignorePath: true,
					ignoreMovementPoint: true,
					callback: function () {
						target.updateHex();
						target.takeDamage(damage);
					},
				});
			},
		},
	];
};
