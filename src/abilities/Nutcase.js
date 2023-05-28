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
					// Don't show two effects in the log
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
			},

			_activateOnAttacker: function (effect, damage) {
				// Must take melee damage from a non-trap source
				if (damage === undefined || !damage.melee || damage.isFromTrap) {
					return false;
				}

				// Target becomes unmovable until end of their phase
				const o = {
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

			_targetTeam: Team.Enemy,

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
				const ability = this;

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
					const choices = [
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
				const ability = this;
				ability.end();
				G.Phaser.camera.shake(0.02, 100, true, G.Phaser.camera.SHAKE_VERTICAL, true);

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
					const isFrontChoice = args.choiceIndex === 0;
					const yCoords = targetOrChoice.map(function (hex) {
						return hex.y;
					});
					const yMin = Math.min.apply(null, yCoords);
					const yMax = Math.max.apply(null, yCoords);
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
						const target = targetOrChoice[i].creature;
						// only attack enemies
						if (!target || !isTeam(this.creature, target, this._targetTeam)) {
							continue;
						}
						this._activateOnTarget(target);
					}
				}
			},

			_activateOnTarget: function (target) {
				const ability = this;

				// Target takes pierce damage if it ever moves
				const effect = new Effect(
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

				const damage = new Damage(
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
		 * Nutcase pushes the target an additional hex further, assuming there is a
		 * free hex behind the target.
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
		 * - The target unit may move as a result of the initial charge, for example,
		 *   Snow Bunny's "Bunny Hop" ability. In this case the Nutcase will still move
		 *   into the vacated hex.
		 * - If the Nutcase is directly adjacent to the target, it will still push back
		 *   and damage the unit.
		 */
		{
			trigger: 'onQuery',

			// Inline forwards/backwards.
			_directions: [0, 1, 0, 0, 1, 0],
			_targetTeam: Team.Enemy,
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
					stopOnCreature: true,
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
					o = G.grid.getDirectionChoices({
						...o,
						dashedHexesAfterCreatureStop: true,
						dashedHexesDistance: this._maxPushDistance,
					});

					G.grid.queryChoice({
						...o,
						requireCreature: false,
					});
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
				// May contain the single hex the target will be pushed into.
				const pushPath = extra?.queryOptions?.hexesDashed || [];

				// Trim the run path to just include the charge, not the target's hexagons.
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
							// Damage before any other creature movement is complete and before push.
							ability._damage(target, runPath);
							G.Phaser.camera.shake(0.01, 250, true, G.Phaser.camera.SHAKE_HORIZONTAL, true);

							const interval = setInterval(function () {
								if (!G.freezedInput) {
									clearInterval(interval);

									if (ability.isUpgraded()) {
										ability._pushTarget(target, pushPath, args);
									} else {
										G.activeCreature.queryMove();
									}
								}
							}, 100);
						},
					});
					// Immediate push, no charge needed.
				} else {
					ability._damage(target, runPath);

					if (ability.isUpgraded()) {
						ability._pushTarget(target, pushPath, args);
					}
				}
			},

			/**
			 * Calculate and apply damage, extra damage per hex distance. The push (if
			 * it occurs) doesn't count.
			 *
			 * @param {Creature} target
			 * @param {Hex[]} runPath
			 */
			_damage(target, runPath) {
				const damages = {
					pierce: this.damages.pierce + runPath.length * this._damagePerHexTravelled,
				};
				const damage = new Damage(this.creature, damages, 1, [], G);
				target.takeDamage(damage);
			},

			/**
			 * Push the target creature and the Nutcase one hex. The Nutcase will end its
			 * movement adjacent to the target.
			 *
			 * @param {Creature} target
			 * @param {Hex[]} pushPath The hexes the target and Nutcase will be pushed along. Only a single hex is supported.
			 * @param {*} args
			 */
			_pushTarget: function (target, pushPath, args) {
				const ability = this;
				const nutcase = this.creature;

				if (!pushPath.length) {
					return;
				}

				if (pushPath.length > this._maxPushDistance) {
					console.warn(
						`Attempting to push target more (${pushPath.length}) than the supported distance (${this._maxPushDistance})`,
					);
					return;
				}

				// However the Nutcase stops, he'll try and push to the next hex in the same direction.
				const nutcasePushHexes = nutcase.getHexMap(
					matrices.inlinefront2hex,
					this.isTargetingBackwards(args.direction),
				);
				const targetPushHexes = pushPath.slice();

				// Ensure the creature or target aren't already in the target's push location.
				arrayUtils.filterCreature(targetPushHexes, false, false, nutcase.id);
				arrayUtils.filterCreature(targetPushHexes, false, false, target.id);

				let nutcaseDestination = nutcasePushHexes[0];
				let targetDestination = targetPushHexes[0];

				// If charging left, account for the difference in x origin of flipped creatures.
				if (args.direction === Direction.Left) {
					nutcaseDestination =
						nutcaseDestination &&
						G.grid.hexes[nutcaseDestination.y][nutcaseDestination.x + nutcase.size - 1];
					targetDestination =
						targetDestination &&
						G.grid.hexes[targetDestination.y][targetDestination.x + target.size - 1];
				}

				this._pushMove(nutcaseDestination, target, targetDestination);
			},

			/**
			 * "Push" move the Nutcase and potentially the target one hex in distance.
			 *
			 * @param {Hex} nutcaseDestination The hex the Nutcase wants to push into.
			 * @param {Creature} target
			 * @param {Hex} targetDestination The hex the target wants to push into.
			 */
			_pushMove(nutcaseDestination, target, targetDestination) {
				const nutcase = this.creature;

				/* Regardless of the outcome, we want to restore the player's UI and control
				when all movement is complete. */
				const interval = setInterval(function () {
					if (!G.freezedInput) {
						clearInterval(interval);
						G.activeCreature.queryMove();
					}
				}, 100);

				// Sense check if we can still push with the Nutcase, or into the target.
				if (
					nutcase.dead ||
					(target && target.dead) ||
					!nutcase.stats.moveable ||
					(target && !target.stats.moveable)
				) {
					return;
				}

				/* Move target THEN Nutcase one Hex at a reduced (pushing) speed. The order
				of movement matters here; moving ourselves first results on overlapping
				hexes momentarily and messes up creature hex displays. */
				const opts = {
					overrideSpeed: 500,
					ignorePath: true,
					ignoreMovementPoint: true,
					turnAroundOnComplete: false,
				};

				/* It's possible the target can no longer be pushed, for example Snow Bunny
				hopped out of the way. If that's the case, only "push" with the Nutcase. */
				if (targetDestination) {
					target.moveTo(
						targetDestination,
						$j.extend(
							{
								animation: 'push',
							},
							opts,
						),
					);
				}
				nutcase.moveTo(nutcaseDestination, opts);
			},
		},

		//	Fourth Ability: Fishing Hook
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			_targetTeam: Team.Enemy,

			require: function () {
				const ability = this;
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
				const ability = this;

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
				const ability = this;
				const crea = ability.creature;
				ability.end();
				G.Phaser.camera.shake(0.02, 200, true, G.Phaser.camera.SHAKE_BOTH, true);

				const damage = new Damage(
					crea, // Attacker
					ability.damages, // Damage Type
					1, // Area
					[], // Effects
					G,
				);

				const trgIsInfront = crea.x < target.x;

				const creaX = target.x + (trgIsInfront ? 0 : crea.size - target.size);
				crea.moveTo(G.grid.hexes[target.y][creaX], {
					ignorePath: true,
					ignoreMovementPoint: true,
					callback: function () {
						crea.updateHex();
						crea.queryMove();
					},
				});
				const targetX = crea.x + (trgIsInfront ? target.size - crea.size : 0);
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
