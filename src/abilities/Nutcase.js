import * as $j from 'jquery';
import { Damage } from '../damage';
import { Team, isTeam } from '../utility/team';
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
	G.abilities[40] = [
		/**
		 * First Ability: Tentacle Bush
		 *
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

		/**
		 * Third Ability: War Horn
		 *
		 * Charge forward or backwards towards an inline enemy unit. Upon impact the
		 * Nutcase pushes the target an additional hex in the opposite direction, assuming
		 * there is a free hex behind the target.
		 *
		 * The ability deals additional pierce damage based on the total distance travelled,
		 * i.e. charge + push distance.
		 *
		 * Targeting rules:
		 * - The target must be an enemy unit.
		 * - The target unit must be inline front/back of the Nutcase.
		 * - The path to the target unit cannot be interrupted by any obstacles or units.
		 *
		 * Other rules:
		 * - The target cannot be pushed back if there is no legal hex behind it. For
		 *   example, other units or the edge of the map.
		 * - The target unit may move as a result of the initial charge, and therefor
		 *   not be eligible for the push. For example, Snow Bunny's "Bunny Hop" ability.
		 * - If the Nutcase is directly adjacent to the target, it will still push back
		 *   and damage the unit.
		 *
		 * Note: The ability was originally designed to push back the enemy any distance,
		 * but it has since been limited to one hex via `_maxPushDistance`. The code
		 * paths still exist for this value to be > 1, however there may be edge case
		 * bugs regarding traps and other reasons the target or Nutcase should stop
		 * pushing.
		 */
		{
			trigger: 'onQuery',

			// Inline forwards/backwards.
			_directions: [0, 1, 0, 0, 1, 0],
			_targetTeam: Team.enemy,
			_maxPushDistance: 1,
			_damagePerHexTravelled: 1,

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
				const ability = this;

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
					/* Rather than using `o.dashedHexesAfterCreatureStop`, create custom choices
					containing normal directions plus "push" path past the first creature,
					extending up to the next obstacle. We do this because we need to limit
					the length of the push path. */
					o = G.grid.getDirectionChoices(o);
					o.requireCreature = false;

					for (let i = 0; i < o.choices.length; i++) {
						const pushLine = this._getPushLine(o, o.choices[i], this._maxPushDistance);
						o.hexesDashed = o.hexesDashed.concat(pushLine);
					}

					G.grid.queryChoice(o);
				}
			},

			/**
			 * Query has been made, activate the ability.
			 *
			 * @param {Hex[]} path Hexes covering charge path and target hexagons.
			 * @param {object} args
			 * @param {object} extra
			 * @param {object} extra.queryOptions Original options object used to query the ability.
			 */
			activate: function (path, args, extra) {
				const ability = this;
				const nutcase = this.creature;

				ability.end();

				let runPath;
				let target;
				const pushPath = extra?.queryOptions?.hexesDashed || [];

				// Trim the run path to just include the charge, not the target hexes.
				for (let i = 0; i < path.length; i++) {
					if (path[i].creature) {
						/* activate() receives the charge path rather than a target, so we need
						to reselect the actual target here. */
						target = path[i].creature;
						runPath = path.slice(0, i);
						break;
					}
				}

				if (runPath.length > 0) {
					let destination = arrayUtils.last(runPath);

					if (args.direction === Direction.Left) {
						destination = G.grid.hexes[destination.y][destination.x + nutcase.size - 1];
					}

					G.grid.cleanReachable();

					const isChargingBackwards =
						(nutcase.player.flipped && args.direction === Direction.Right) ||
						args.direction === Direction.Left;

					nutcase.moveTo(destination, {
						overrideSpeed: 100,
						ignoreMovementPoint: true,
						turnAroundOnComplete: !isChargingBackwards,
						callback: function () {
							ability._pushAndDamage(target, runPath, pushPath, args);

							const interval = setInterval(function () {
								if (!G.freezedInput) {
									clearInterval(interval);
									G.activeCreature.queryMove();
								}
							}, 100);
						},
					});
					// Immediate push, no charge needed.
				} else {
					ability._pushAndDamage(target, runPath, pushPath, args);
				}
			},

			/**
			 * Create a line of hexes from the back of the target, up to the next obstacle
			 * for this direction choice.
			 *
			 * May be limited in length by this._maxPushDistance.
			 *
			 * @param {*} o
			 * @param {*} choice
			 * @param {number} limit Limit the distance of the push line.
			 * @returns {Hex[]} Line of hexes.
			 */
			_getPushLine(o, choice, limit) {
				const direction = choice[0].direction;

				let xOffset = 0;

				if (o.sourceCreature instanceof Creature) {
					if (
						(!o.sourceCreature.player.flipped && direction === Direction.Right) ||
						(o.sourceCreature.player.flipped && direction === Direction.Left)
					) {
						xOffset = -(o.sourceCreature.size - 1);
					}
				}

				let line = G.grid.getHexLine(o.x + xOffset, o.y, direction, o.flipped);

				choice.forEach(function (choice) {
					arrayUtils.removePos(line, choice);
				});

				arrayUtils.filterCreature(line, false, true, o.id);

				if (limit) {
					line = line.length ? line.slice(0, limit) : [];
				}

				return line;
			},

			/**
			 * Push the target and the Nutcase along a path, then damage the target based
			 * on the total distance (run + push) travelled.
			 *
			 * @param {Creature} target
			 * @param {Hex[]} runPath The hexes covered by the Nutcase charge.
			 * @param {Hex[]} pushPath The hexes the target and Nutcase will be pushed along.
			 * @param {*} args
			 */
			_pushAndDamage(target, runPath, pushPath, args) {
				const numPushedHexes = this._pushTarget(target, pushPath, args);

				// Calculate damage, extra damage per hex distance.
				const damages = {
					pierce:
						this.damages.pierce + (runPath.length + numPushedHexes) * this._damagePerHexTravelled,
				};
				const damage = new Damage(this.creature, damages, 1, [], G);
				target.takeDamage(damage);
			},

			/**
			 * Push the target creature and the Nutcase the length of the previously calculated
			 * push path.
			 *
			 * The Nutcase will end its movement adjacent to the target.
			 *
			 * The status of the target is checked after each hex in the push path, so
			 * the final pushed hexes may be less than the requested push path.
			 *
			 * @param {Creature} target
			 * @param {Hex[]} pushPath The hexes the target and Nutcase will be pushed along.
			 * @param {*} args
			 * @returns {number} Number of hexes the target was pushed.
			 */
			_pushTarget: function (target, pushPath, args) {
				const ability = this;
				const creature = this.creature;

				if (!pushPath.length) {
					return 0;
				}

				/* Hexes the Nutcase will be "pushed" or move along. Starts at the first
				hex of the target and may extend past that.
				Examples:
				👹⬡⬡⬡🦘🦘⬡⬡⬡⬡ -> 👹⬡⬡⬡⬢⬢⬢⬢⬡⬡
				👹⬡⬡⬡🦘🦘⬡ -> 👹⬡⬡⬡⬢⬡⬡
				👹⬡⬡⬡🦘⬡⬡ -> 👹⬡⬡⬡⬢⬢⬡ */
				let selfPushPath = [
					// Hexes within the target's hexagons that will be moved into.
					...this.game.grid
						.sortHexesByDirection(target.hexagons, args.direction)
						.slice(0, pushPath.length),
					// Hexes beyond target that will be moved into.
					...pushPath.slice(0, pushPath.length - target.hexagons.length),
				];
				selfPushPath = this.game.grid.sortHexesByDirection(selfPushPath, args.direction);
				const targetPushPath = pushPath.slice();

				// TODO: These lines are vital do not remove. Refactor so what they do is more readable
				arrayUtils.filterCreature(targetPushPath, false, false, creature.id);
				arrayUtils.filterCreature(targetPushPath, false, false, target.id);

				// Last sense check before proceeding.
				if (targetPushPath.length === 0) {
					return 0;
				}

				// Push the creature one hex at a time.
				// As we need to move creatures simultaneously, we can't use the normal path
				// calculation as the target blocks the path
				let i = 0;
				const interval = setInterval(function () {
					if (!G.freezedInput) {
						if (
							i === targetPushPath.length ||
							creature.dead ||
							target.dead ||
							!creature.stats.moveable ||
							!target.stats.moveable ||
							target.stats.evading
						) {
							clearInterval(interval);
							creature.facePlayerDefault();
							G.activeCreature.queryMove();
						} else {
							let hex = selfPushPath[i];
							let targetHex = targetPushPath[i];
							if (args.direction === Direction.Left) {
								hex = G.grid.hexes[hex.y][hex.x + creature.size - 1];
								targetHex = G.grid.hexes[targetHex.y][targetHex.x + target.size - 1];
							}
							ability._pushOneHex(target, hex, targetHex);
							i++;
						}
					}
				});

				return i;
			},

			/**
			 * Push the target and the Nutcase one hex at a time.
			 * @param {Creature} target
			 * @param {Hex} hex Hex the Nutcase will move to.
			 * @param {Hex} targetHex Hex the target will move to.
			 */
			_pushOneHex: function (target, hex, targetHex) {
				const opts = {
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
