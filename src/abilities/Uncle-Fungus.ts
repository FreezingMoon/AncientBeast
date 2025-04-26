import { Damage } from '../damage';
import { Team } from '../utility/team';
import * as matrices from '../utility/matrices';
import * as arrayUtils from '../utility/arrayUtils';
import { Effect } from '../effect';
import { getDirectionFromDelta } from '../utility/position';
import Game from '../game';

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default (G: Game) => {
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
				if (damage instanceof Damage && damage.melee !== undefined) {
					return damage.melee && !damage.isFromTrap;
				}
				// Always return true so that ability is highlighted in UI
				return true;
			},

			// activate() :
			activate: function (damage) {
				const creature = this.creature;

				if (!damage || !damage.melee) {
					return;
				}

				// ability may trigger both onAttack and onUnderAttack;
				// the target should be the other creature
				const target = damage.attacker === creature ? damage.target : damage.attacker;

				const optArg = {
					alterations: this.effects[0],
					creationTurn: G.turn - 1,
					stackable: true,
				};

				this.end();

				// Spore Contamination
				const effect = new Effect(
					this.title, // Name
					creature, // Caster
					target, // Target
					'', // Trigger
					optArg, // Optional arguments
					G,
				);

				target.addEffect(effect, undefined, 'Contaminated');

				G.log(
					'%CreatureName' + target.id + "%'s regrowth is lowered by " + this.effects[0].regrowth,
				);

				this.setUsed(false); // Infinite triggering
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
					!this.atLeastOneTarget(this.creature.getHexMap(matrices.frontnback2hex, false), {
						team: this._targetTeam,
					})
				) {
					return false;
				}
				return true;
			},

			// query() :
			query: function (isPreview = false) {
				if(isPreview){return;}
				const uncle = this.creature;

				G.grid.queryCreature({
					fnOnConfirm: (...args) => this.animation(...args),
					team: this._targetTeam,
					id: uncle.id,
					flipped: uncle.player.flipped,
					hexes: uncle.getHexMap(matrices.frontnback2hex, false),
				});
			},

			// activate() :
			activate: function (target) {
				this.end();
				G.Phaser.camera.shake(0.01, 65, true, G.Phaser.camera.SHAKE_HORIZONTAL, true);

				const damage = new Damage(
					this.creature, // Attacker
					this.damages, // Damage type
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
						this.creature.addEffect(
							new Effect(
								this.title, // Name
								this.creature, // Caster
								this.creature, // Target
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
							'%CreatureName' + this.creature.id + '% gained ' + amount + ' regrowth for now', // Custom log
							'Regrowth++',
						); // Custom hint
					}
				}

				// Remove frogger bonus if its found
				this.creature.effects.forEach(function (effect) {
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

			// query() :
			query: function (isPreview = false) {
				const uncle = this.creature;

				// Don't jump over creatures if we're not upgraded, or we are in a second
				// "low" jump
				const stopOnCreature = !this.isUpgraded() || this._isSecondLowJump();
				const hexes = this._getHexRange(stopOnCreature);

				if (isPreview) {
					G.grid.queryHexes({
						hexes: hexes,
						size: uncle.size,
						flipped: uncle.player.flipped,
						id: uncle.id,
						hideNonTarget: true,
					});
					return;
				}

				G.grid.queryHexes({
					fnOnSelect: function (...args) {
						const hex = args[0];

						if (hex) {
							// Uncle Fungus is 2 hexes wide, but the selected hex is only 1 hex wide.
							// `tracePosition` ensures that both hexes are highlighted when hovering over the selected hex.
							uncle.tracePosition({
								x: hex.x,
								y: hex.y,
								overlayClass: 'creature moveto selected player' + uncle.team,
							});
							hex.game.activeCreature.faceHex(hex);
							const crea = G.retrieveCreatureStats(uncle.type);
							G.grid.previewCreature(hex.pos, crea, uncle.player);
						}
					},
					fnOnConfirm: (...args) => {
						const chosenHex = args[0];

						if (chosenHex.x == this.creature.x && chosenHex.y == this.creature.y) {
							// Prevent null movement
							this.query();
							return;
						}
						this.animation(...args);
						chosenHex.game.activeCreature.faceHex(chosenHex);
						G.grid.fadeOutTempCreature();
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
				this.end(false, true); // Deferred ending
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
				this.creature.moveTo(hex, {
					ignoreMovementPoint: true,
					ignorePath: true,
					callback: () => {
						// Shake the screen upon landing to simulate the jump
						G.Phaser.camera.shake(0.03, 90, true, G.Phaser.camera.SHAKE_VERTICAL, true);

						G.onStepIn(this.creature, this.creature.hexagons[0], false);

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
				this.creature.addEffect(
					new Effect(
						'Offense Bonus', // Name
						this.creature, // Caster
						this.creature, // Target
						'onStepIn onEndPhase', // Trigger
						{
							effectFn: function (effect) {
								effect.deleteEffect();
							},
							alterations: this.effects[0],
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
			query: function (isPreview = false) {
				if(isPreview){return;}
				const uncle = this.creature;

				G.grid.queryCreature({
					fnOnConfirm: (...args) => this.animation(...args),
					team: this._targetTeam,
					id: uncle.id,
					flipped: uncle.player.flipped,
					hexes: G.grid.getHexMap(uncle.x - 2, uncle.y - 2, 0, false, matrices.frontnback2hex),
				});
			},

			// activate() :
			activate: function (target) {
				this.end();
				G.Phaser.camera.shake(0.03, 100, true, G.Phaser.camera.SHAKE_HORIZONTAL, true);

				const damage = new Damage(
					this.creature, // Attacker
					this.damages, // Damage Type
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
				this.creature.effects.forEach(function (effect) {
					if (effect.name == 'Offense Bonus') {
						effect.deleteEffect();
					}
				});
			},
		},
	];
};
