import { Damage } from '../damage';
import { Team } from '../utility/team';
import * as matrices from '../utility/matrices';
import * as arrayUtils from '../utility/arrayUtils';
import { Effect } from '../effect';
import { getDirectionFromDelta } from '../utility/position';

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default (G) => {
	G.abilities[3] = [
		// First Ability: Toxic Spores
		{
			// Type : Can be "onQuery", "onStartPhase", "onDamage"
			triggerFunc: function () {
				if (this.isUpgraded()) {
					return 'onUnderAttack onAttack';
				}
				return 'onUnderAttack';
			},

			priority: 10,

			// require() :
			require: function (damage) {
				if (!this.testRequirements()) {
					return false;
				}

				// Check that attack is melee from actual creature, not from trap
				if (damage && damage.melee !== undefined) {
					return damage.melee && !damage.isFromTrap;
				}
				// Always return true so that ability is highlighted in UI
				return true;
			},

			// activate() :
			activate: function (damage) {
				const ability = this;
				const creature = this.creature;

				if (!damage || !damage.melee) {
					return;
				}

				// ability may trigger both onAttack and onUnderAttack;
				// the target should be the other creature
				const target = damage.attacker === creature ? damage.target : damage.attacker;

				const optArg = {
					alterations: ability.effects[0],
					creationTurn: G.turn - 1,
					stackable: true,
				};

				ability.end();

				// Spore Contamination
				const effect = new Effect(
					ability.title, // Name
					creature, // Caster
					target, // Target
					'', // Trigger
					optArg, // Optional arguments
					G,
				);

				target.addEffect(effect, undefined, 'Contaminated');

				G.log(
					'%CreatureName' + target.id + "%'s regrowth is lowered by " + ability.effects[0].regrowth,
				);

				ability.setUsed(false); // Infinite triggering
			},
		},

		//	Second Ability: Supper Chomp
		{
			// Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			_targetTeam: Team.Enemy,

			// require() :
			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				// At least one target
				if (
					!this.atLeastOneTarget(this.creature.getHexMap(matrices.frontnback2hex), {
						team: this._targetTeam,
					})
				) {
					return false;
				}
				return true;
			},

			// query() :
			query: function () {
				const uncle = this.creature;
				const ability = this;

				G.grid.queryCreature({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					team: this._targetTeam,
					id: uncle.id,
					flipped: uncle.flipped,
					hexes: uncle.getHexMap(matrices.frontnback2hex),
				});
			},

			// activate() :
			activate: function (target) {
				const ability = this;
				ability.end();
				G.Phaser.camera.shake(0.01, 65, true, G.Phaser.camera.SHAKE_HORIZONTAL, true);

				const damage = new Damage(
					ability.creature, // Attacker
					ability.damages, // Damage type
					1, // Area
					[], // Effects
					G,
				);

				const dmg = target.takeDamage(damage);

				if (dmg.damageObj.status === '') {
					let amount = dmg.damages.total;

					// If upgraded, heal immediately up to the amount of health lost so far;
					// use the remainder as regrowth
					if (this.isUpgraded()) {
						const healthLost = this.creature.stats.health - this.creature.health;
						if (healthLost > 0) {
							const healAmount = Math.min(amount, healthLost);
							amount -= healAmount;
							this.creature.heal(healAmount, false);
						}
					}

					// Regrowth bonus
					if (amount > 0) {
						ability.creature.addEffect(
							new Effect(
								ability.title, // Name
								ability.creature, // Caster
								ability.creature, // Target
								'', // Trigger
								{
									turnLifetime: 1,
									deleteTrigger: 'onStartPhase',
									alterations: {
										regrowth: amount,
									},
								}, // Optional arguments
								G,
							),
							'%CreatureName' + ability.creature.id + '% gained ' + amount + ' regrowth for now', // Custom log
							'Regrowth++',
						); // Custom hint
					}
				}

				// Remove frogger bonus if its found
				ability.creature.effects.forEach(function (effect) {
					if (effect.name == 'Frogger Bonus') {
						effect.deleteEffect();
					}
				});
			},
		},

		// Third Ability: Frogger Jump
		{
			// Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			require: function () {
				// Must be able to move
				if (!this.creature.stats.moveable) {
					this.message = G.msg.abilities.notMoveable;
					return false;
				}
				return this.testRequirements() && this.creature.stats.moveable;
			},

			fnOnSelect: function (hex) {
				this.creature.tracePosition({
					x: hex.x,
					y: hex.y,
					overlayClass: 'creature moveto selected player' + this.creature.team,
				});
			},

			// query() :
			query: function () {
				const ability = this;
				const uncle = this.creature;

				// Don't jump over creatures if we're not upgraded, or we are in a second
				// "low" jump
				const stopOnCreature = !this.isUpgraded() || this._isSecondLowJump();
				const hexes = this._getHexRange(stopOnCreature);

				G.grid.queryHexes({
					fnOnSelect: function () {
						ability.fnOnSelect(...arguments);
					},
					fnOnConfirm: function () {
						if (arguments[0].x == ability.creature.x && arguments[0].y == ability.creature.y) {
							// Prevent null movement
							ability.query();
							return;
						}
						ability.animation(...arguments);
					},
					size: uncle.size,
					flipped: uncle.player.flipped,
					id: uncle.id,
					hexes: hexes,
					hexesDashed: [],
					hideNonTarget: true,
				});
			},

			// activate() :
			activate: function (hex) {
				const ability = this;
				ability.end(false, true); // Deferred ending

				// If upgraded and we haven't leapt over creatures/obstacles, allow a second
				// jump of the same kind
				if (this.isUpgraded() && !this._isSecondLowJump()) {
					// Check if we've leapt over creatures by finding all "low" jumps (jumps
					// not over creatures), and finding whether this jump was a "low" one
					const lowJumpHexes = this._getHexRange(true);
					let isLowJump = false;
					for (let i = 0; i < lowJumpHexes.length; i++) {
						if (lowJumpHexes[i].x === hex.x && lowJumpHexes[i].y === hex.y) {
							isLowJump = true;
						}
					}
					if (isLowJump) {
						this.setUsed(false);
					}
				}

				// Jump directly to hex
				ability.creature.moveTo(hex, {
					ignoreMovementPoint: true,
					ignorePath: true,
					callback: function () {
						// Shake the screen upon landing to simulate the jump
						G.Phaser.camera.shake(0.03, 90, true, G.Phaser.camera.SHAKE_VERTICAL, true);

						G.onStepIn(ability.creature, ability.creature.hexagons[0]);

						const interval = setInterval(function () {
							if (!G.freezedInput) {
								clearInterval(interval);
								G.UI.selectAbility(-1);
								G.activeCreature.queryMove();
							}
						}, 100);
					},
				});

				// Frogger Leap bonus
				ability.creature.addEffect(
					new Effect(
						'Offense Bonus', // Name
						ability.creature, // Caster
						ability.creature, // Target
						'onStepIn onEndPhase', // Trigger
						{
							effectFn: function (effect) {
								effect.deleteEffect();
							},
							alterations: ability.effects[0],
						}, // Optional arguments
						G,
					),
				);
			},

			_getHexRange: function (stopOnCreature) {
				// Get the hex range of this ability
				const uncle = this.creature;
				let forward = G.grid.getHexMap(uncle.x, uncle.y, 0, false, matrices.straitrow);
				forward = arrayUtils.filterCreature(forward, false, stopOnCreature, uncle.id);
				let backward = G.grid.getHexMap(uncle.x, uncle.y, 0, true, matrices.straitrow);
				backward = arrayUtils.filterCreature(backward, false, stopOnCreature, uncle.id);
				// Combine and sort by X, left to right
				const hexes = forward.concat(backward).sort(function (a, b) {
					return a.x - b.x;
				});
				// Filter out any hexes that cannot accomodate the creature's size
				let run = 0;
				for (let i = 0; i < hexes.length; i++) {
					if (i === 0 || hexes[i - 1].x + 1 === hexes[i].x) {
						run++;
					} else {
						if (run < this.creature.size) {
							hexes.splice(i - run, run);
							i -= run;
						}
						run = 1;
					}
				}
				if (run < this.creature.size) {
					hexes.splice(hexes.length - run, run);
				}
				return hexes;
			},

			_isSecondLowJump: function () {
				return this.timesUsedThisTurn === 1;
			},
		},
		// Fourth Ability: Sabre Kick
		{
			// Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			_targetTeam: Team.Enemy,

			// require() :
			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				const map = G.grid.getHexMap(
					this.creature.x - 2,
					this.creature.y - 2,
					0,
					false,
					matrices.frontnback2hex,
				);
				// At least one target
				if (
					!this.atLeastOneTarget(map, {
						team: this._targetTeam,
					})
				) {
					return false;
				}
				return true;
			},

			// query() :
			query: function () {
				const ability = this;
				const uncle = this.creature;

				G.grid.queryCreature({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					team: this._targetTeam,
					id: uncle.id,
					flipped: uncle.flipped,
					hexes: G.grid.getHexMap(uncle.x - 2, uncle.y - 2, 0, false, matrices.frontnback2hex),
				});
			},

			// activate() :
			activate: function (target) {
				const ability = this;
				ability.end();
				G.Phaser.camera.shake(0.03, 100, true, G.Phaser.camera.SHAKE_HORIZONTAL, true);

				const damage = new Damage(
					ability.creature, // Attacker
					ability.damages, // Damage Type
					1, // Area
					[], // Effects
					G,
				);
				const result = target.takeDamage(damage);

				// If upgraded, knock back target by 1 hex
				if (this.isUpgraded() && !result.kill) {
					const dx = target.x - this.creature.x;
					const dy = target.y - this.creature.y;
					const dir = getDirectionFromDelta(target.y, dx, dy);
					const hexes = G.grid.getHexLine(target.x, target.y, dir, target.flipped);
					// The hex to knock back into is the second hex since the first is where
					// they are currently
					if (hexes.length >= 2 && hexes[1].isWalkable(target.size, target.id, true)) {
						target.moveTo(hexes[1], {
							callback: function () {
								G.activeCreature.queryMove();
							},
							ignoreMovementPoint: true,
							ignorePath: true,
							overrideSpeed: 500, // Custom speed for knockback
							animation: 'push',
						});
					}
				}

				// Remove Frogger Jump bonus if its found
				ability.creature.effects.forEach(function (effect) {
					if (effect.name == 'Offense Bonus') {
						effect.deleteEffect();
					}
				});
			},
		},
	];
};
