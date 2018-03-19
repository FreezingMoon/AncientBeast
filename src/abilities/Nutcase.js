import * as $j from 'jquery';
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
	G.abilities[40] = [

		//	First Ability: Tentacle Bush
		{
			trigger: "onUnderAttack",

			require: function () {
				// Always true to highlight ability
				return true;
			},

			activate: function (damage) {
				// Must take melee damage from a non-trap source
				if (damage === undefined) return false;
				if (!damage.melee) return false;
				if (damage.isFromTrap) return false;

				var ability = this;
				ability.end();

				// Target becomes unmoveable until end of their phase
				var o = {
					alterations: {
						moveable: false
					},
					deleteTrigger: "onEndPhase",
					// Delete this effect as soon as attacker's turn finishes
					turnLifetime: 1,
					creationTurn: G.turn - 1,
					deleteOnOwnerDeath: true
				};
				// If upgraded, target abilities cost more energy
				if (this.isUpgraded()) {
					o.alterations.reqEnergy = 5;
				}
				// Create a zero damage with debuff
				var counterDamage = new Damage(
					this.creature, {}, 1, [new Effect(
						this.title,
						this.creature, // Caster
						damage.attacker, // Target
						"", // Trigger
						o,
						G
					)],
					G
				);
				counterDamage.counter = true;
				damage.attacker.takeDamage(counterDamage);
				// Making attacker unmoveable will change its move query, so update it
				if (damage.attacker === G.activeCreature) {
					damage.attacker.queryMove();
				}

				// If inactive, Nutcase becomes unmoveable until start of its phase
				if (G.activeCreature !== this.creature) {
					this.creature.addEffect(new Effect(
						this.title,
						this.creature,
						this.creature,
						"", {
							alterations: {
								moveable: false
							},
							deleteTrigger: "onStartPhase",
							turnLifetime: 1
						},
						G
					));
				}
			}
		},

		//	Second Ability: Hammer Time
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: "onQuery",

			_targetTeam: Team.enemy,

			//	require() :
			require: function () {
				if (!this.testRequirements()) return false;

				if (!this.atLeastOneTarget(
					this.creature.getHexMap(matrices.frontnback2hex), {
						team: this._targetTeam
					})) {
					return false;
				}

				return true;
			},

			//	query() :
			query: function () {
				var ability = this;

				if (!this.isUpgraded()) {
					G.grid.queryCreature({
						fnOnConfirm: function () {
							ability.animation.apply(ability, arguments);
						},
						team: this._targetTeam,
						id: this.creature.id,
						flipped: this.creature.flipped,
						hexes: this.creature.getHexMap(matrices.frontnback2hex)
					});
				} else {
					// If upgraded, show choice of front and back hex groups
					var choices = [
						this.creature.getHexMap(matrices.front2hex),
						this.creature.getHexMap(matrices.back2hex)
					];
					G.grid.queryChoice({
						fnOnSelect: function (choice, args) {
							G.activeCreature.faceHex(args.hex, undefined, true);
							args.hex.overlayVisualState(
								"creature selected player" + G.activeCreature.team);
						},
						fnOnConfirm: function () {
							ability.animation.apply(ability, arguments);
						},
						team: this._targetTeam,
						id: this.creature.id,
						choices: choices
					});
				}
			},

			activate: function (targetOrChoice, args) {
				var ability = this;
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
					var isFrontChoice = args.choiceIndex === 0;
					var yCoords = targetOrChoice.map(function (hex) {
						return hex.y;
					});
					var yMin = Math.min.apply(null, yCoords);
					var yMax = Math.max.apply(null, yCoords);
					var yAscending;
					if (isFrontChoice) {
						yAscending = args.hex.y !== yMax;
					} else {
						yAscending = args.hex.y === yMin;
					}
					targetOrChoice.sort(function (a, b) {
						return yAscending ? a.y - b.y : b.y - a.y;
					});
					for (var i = 0; i < targetOrChoice.length; i++) {
						var target = targetOrChoice[i].creature;
						// only attack enemies
						if (!target || !isTeam(this.creature, target, this._targetTeam)) {
							continue;
						}
						this._activateOnTarget(target);
					}
				}
			},

			_activateOnTarget: function (target) {
				var ability = this;

				// Target takes pierce damage if it ever moves
				var effect = new Effect(
					"Hammered", // Name
					this.creature, // Caster
					target, // Target
					"onStepOut", // Trigger
					{
						effectFn: function (effect) {
							effect.target.takeDamage(new Damage(
								effect.owner, {
									pierce: ability.damages.pierce
								}, 1, [], G));
							effect.deleteEffect();
						}
					},
					G
				);

				var damage = new Damage(
					this.creature, // Attacker
					this.damages, // Damage Type
					1, // Area
					[effect], // Effects
					G
				);

				target.takeDamage(damage);
			}
		},

		// 	Third Ability: War Horn
		{
			trigger: "onQuery",

			_directions: [0, 1, 0, 0, 1, 0], // forward/backward
			_targetTeam: Team.enemy,

			//	require() :
			require: function () {
				if (!this.testRequirements()) return false;
				if (!this.testDirection({
					team: this._targetTeam,
					directions: this._directions
				})) {
					return false;
				}
				return true;
			},

			query: function () {
				var ability = this;

				var o = {
					fnOnConfirm: function () {
						ability.animation.apply(ability, arguments);
					},
					team: this._targetTeam,
					requireCreature: true,
					id: this.creature.id,
					sourceCreature: this.creature,
					x: this.creature.x,
					y: this.creature.y,
					directions: this._directions,
					dashedHexesAfterCreatureStop: false
				};
				if (!this.isUpgraded()) {
					G.grid.queryDirection(o);
				} else {
					// Create custom choices containing normal directions plus hex choices
					// past the first creature, extending up to the next obstacle
					o = G.grid.getDirectionChoices(o);
					var newChoices = [];
					for (var i = 0; i < o.choices.length; i++) {
						var j;
						var direction = o.choices[i][0].direction;

						// Add dashed hexes up to the next obstacle for this direction choice
						var fx = 0;
						if (o.sourceCreature instanceof Creature) {
							if ((!o.sourceCreature.player.flipped && direction > 2) ||
								(o.sourceCreature.player.flipped && direction < 3)) {
								fx = -(o.sourceCreature.size - 1);
							}
						}
						var line = G.grid.getHexLine(o.x + fx, o.y, direction, o.flipped);
						o.choices[i].forEach(function (choice) {
							arrayUtils.removePos(line, choice);
						});

						arrayUtils.filterCreature(line, false, true, o.id);
						o.hexesDashed = o.hexesDashed.concat(line);

						// For each dashed hex, create a new choice composed of the original
						// choice, extended up to and including the dashed hex. This will be the
						// choice that pushes the target up to that hex.
						// Get a new hex line so that the hexes are in the right order
						var newChoice = G.grid.getHexLine(o.x + fx, o.y, direction, o.flipped);
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
				var i;
				var ability = this;
				this.end();

				// Find:
				// - the target which is the first creature in the path
				// - the run path which is up to the creature
				// - the push paths which start from the last creature hex and continues to
				//   the rest of the path
				var target;
				var runPath;
				var pushPath = [];
				for (i = 0; i < path.length; i++) {
					if (path[i].creature) {
						target = path[i].creature;
						runPath = path.slice(0, i);
						pushPath = path.slice(i);
						break;
					}
				}

				// Calculate damage, extra damage per hex distance
				var damages = $j.extend({}, this.damages);
				damages.pierce += runPath.length;
				var damage = new Damage(this.creature, damages, 1, [], G);

				// Move towards target if necessary
				if (runPath.length > 0) {
					var destination = arrayUtils.last(runPath);
					if (args.direction === 4) {
						destination =
							G.grid.hexes[destination.y][destination.x + this.creature.size - 1];
					}

					G.grid.cleanReachable();
					this.creature.moveTo(destination, {
						overrideSpeed: 100,
						ignoreMovementPoint: true,
						callback: function () {
							var interval = setInterval(function () {
								if (!G.freezedInput) {
									clearInterval(interval);

									// Deal damage only if we have reached the end of the path
									if (destination.creature === ability.creature) {
										target.takeDamage(damage);
									}

									if (!ability._pushTarget(target, pushPath, args)) {
										G.activeCreature.queryMove();
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
				var ability = this;
				var creature = this.creature;

				var targetPushPath = pushPath.slice();
				// TODO: These two lines probably do not do anything since filterCreature() returns a new array...
				arrayUtils.filterCreature(targetPushPath, false, false, creature.id);
				arrayUtils.filterCreature(targetPushPath, false, false, target.id);
				if (targetPushPath.length === 0) {
					return false;
				}

				// Push the creature one hex at a time
				// As we need to move creatures simultaneously, we can't use the normal path
				// calculation as the target blocks the path
				var i = 0;
				var interval = setInterval(function () {
					if (!G.freezedInput) {
						if (i === targetPushPath.length ||
							creature.dead || target.dead ||
							!creature.stats.moveable || !target.stats.moveable) {
							clearInterval(interval);
							creature.facePlayerDefault();
							G.activeCreature.queryMove();
						} else {
							var hex = pushPath[i];
							var targetHex = targetPushPath[i];
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
				var opts = {
					overrideSpeed: 100,
					ignorePath: true,
					ignoreMovementPoint: true,
					turnAroundOnComplete: false
				};
				// Note: order matters here; moving ourselves first results on overlapping
				// hexes momentarily and messes up creature hex displays
				target.moveTo(targetHex, $j.extend({
					animation: 'push'
				}, opts));
				this.creature.moveTo(hex, opts);
			}
		},

		//	Third Ability: Fishing Hook
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: "onQuery",

			_targetTeam: Team.enemy,

			require: function () {
				var ability = this;
				if (!this.testRequirements()) return false;

				if (!this.atLeastOneTarget(
					this.creature.getHexMap(matrices.inlinefrontnback2hex), {
						team: this._targetTeam,
						optTest: function (creature) {
							// Size restriction of 2 if unupgraded
							return ability.isUpgraded() ? true : creature.size <= 2;
						}
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
					hexes: this.creature.getHexMap(matrices.inlinefrontnback2hex),
					optTest: function (creature) {
						// Size restriction of 2 if unupgraded
						return ability.isUpgraded() ? true : creature.size <= 2;
					}
				});
			},


			//	activate() :
			activate: function (target, args) {
				var ability = this;
				var crea = ability.creature;
				ability.end();

				var damage = new Damage(
					crea, // Attacker
					ability.damages, // Damage Type
					1, // Area
					[], // Effects
					G
				);

				var inlinefront2hex = matrices.inlinefront2hex;

				var trgIsInfront = (G.grid.getHexMap(crea.x - inlinefront2hex.origin[0], crea.y - inlinefront2hex.origin[1], 0, false, inlinefront2hex)[0].creature == target);


				var creaX = target.x + (trgIsInfront ? 0 : crea.size - target.size);
				crea.moveTo(
					G.grid.hexes[target.y][creaX], {
						ignorePath: true,
						ignoreMovementPoint: true,
						callback: function () {
							crea.updateHex();
							crea.queryMove();
						}
					}
				);
				var targetX = crea.x + (trgIsInfront ? target.size - crea.size : 0);
				target.moveTo(
					G.grid.hexes[crea.y][targetX], {
						ignorePath: true,
						ignoreMovementPoint: true,
						callback: function () {
							target.updateHex();
							target.takeDamage(damage);
						}
					}
				);
			},
		}
	];
};
