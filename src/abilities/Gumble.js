import * as $j from 'jquery';
import { Damage } from '../damage';
import { Team, isTeam } from '../utility/team';
import * as matrices from '../utility/matrices';
import * as arrayUtils from '../utility/arrayUtils';
import { Effect } from '../effect';

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default (G) => {
	G.abilities[14] = [
		// 	First Ability: Gooey Body
		{
			// Update stat buffs whenever health changes
			trigger: 'onCreatureSummon onDamage onHeal',

			require: function () {
				// Always active
				return true;
			},

			activate: function () {
				if (this.creature.dead) {
					return;
				}
				// Attach a permanent effect that gives Gumble stat buffs
				// Bonus points to pierce, slash and crush based on remaining health
				let healthBonusDivisor = this.isUpgraded() ? 5 : 7;
				let bonus = Math.floor((this.creature.health / healthBonusDivisor) * 3);
				// Log whenever the bonus applied changes
				let noLog = bonus == this._lastBonus;
				this._lastBonus = bonus;
				let statsToApplyBonus = ['pierce', 'slash', 'crush'];
				let alterations = {};
				for (let i = 0; i < statsToApplyBonus.length; i++) {
					let key = statsToApplyBonus[i];
					alterations[key] = bonus;
				}
				this.creature.replaceEffect(
					new Effect(
						'Gooey Body', // name
						this.creature, // Caster
						this.creature, // Target
						'', // Trigger
						{
							alterations: alterations,
							deleteTrigger: '',
							stackable: false,
							noLog: noLog,
						},
						G,
					),
				);
				if (!noLog) {
					G.log(
						'%CreatureName' + this.creature.id + '% receives ' + bonus + ' pierce, slash and crush',
					);
				}
			},

			_lastBonus: 0,
		},

		// 	Second Ability: Gummy Mallet
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			require: function () {
				// Always usable, even if no targets
				return this.testRequirements();
			},

			// 	query() :
			query: function () {
				let ability = this;
				// Gummy Mallet can hit a 7-hexagon circular area in 6 directions, where the
				// center of each area is two hexes away. Each area can be chosen regardless
				// of whether targets are within.
				let area = [
					[1, 1],
					[1, 1, 1],
					[1, 1],
				];
				let dx = this.creature.y % 2 !== 0 ? -1 : 0;
				let dy = -1;
				let choices = [
					G.grid.getHexMap(this.creature.x + 1 + dx, this.creature.y - 2 + dy, 0, false, area), // up-right
					G.grid.getHexMap(this.creature.x + 2 + dx, this.creature.y + dy, 0, false, area), // front
					G.grid.getHexMap(this.creature.x + 1 + dx, this.creature.y + 2 + dy, 0, false, area), // down-right
					G.grid.getHexMap(this.creature.x - 1 + dx, this.creature.y + 2 + dy, 0, false, area), // down-left
					G.grid.getHexMap(this.creature.x - 2 + dx, this.creature.y + dy, 0, false, area), // back
					G.grid.getHexMap(this.creature.x - 1 + dx, this.creature.y - 2 + dy, 0, false, area), // up-left
				];
				// Reorder choices based on number of hexes
				// This ensures that if a choice contains overlapping hexes only, that
				// choice won't be available for selection.
				choices.sort(function (choice1, choice2) {
					return choice1.length < choice2.length;
				});
				G.grid.queryChoice({
					fnOnCancel: function () {
						G.activeCreature.queryMove();
					},
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					team: Team.Both,
					id: this.creature.id,
					requireCreature: false,
					choices: choices,
				});
			},

			activate: function (hexes) {
				let ability = this;
				ability.end();

				let targets = ability.getTargets(hexes);
				// Deal double damage to enemies if upgraded
				let enemyDamages = $j.extend({}, ability.damages);
				if (this.isUpgraded()) {
					for (let k in enemyDamages) {
						if ({}.hasOwnProperty.call(enemyDamages, k)) {
							enemyDamages[k] *= 2;
						}
					}
				}
				// See areaDamage()
				let kills = 0;
				for (let i = 0; i < targets.length; i++) {
					if (targets[i] === undefined) {
						continue;
					}
					let damages = this.damages;
					if (isTeam(this.creature, targets[i].target, Team.Enemy)) {
						damages = enemyDamages;
					}
					let dmg = new Damage(this.creature, damages, targets[i].hexesHit, [], G);
					kills += targets[i].target.takeDamage(dmg).kill + 0;
				}
				if (kills > 1) {
					this.creature.player.score.push({
						type: 'combo',
						kills: kills,
					});
				}
			},
		},

		// 	Thirt Ability: Royal Seal
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			// 	require() :
			require: function () {
				return this.testRequirements();
			},

			// 	query() :
			query: function () {
				let ability = this;
				let creature = this.creature;

				// Upgraded Royal Seal can target up to 3 hexagons range
				let range = this.isUpgraded() ? 3 : 1;
				let hexes = creature.hexagons.concat(
					G.grid.getFlyingRange(creature.x, creature.y, range, creature.size, creature.id),
				);

				G.grid.queryHexes({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					size: creature.size,
					flipped: creature.player.flipped,
					id: creature.id,
					hexes: hexes,
					ownCreatureHexShade: true,
					hideNonTarget: true,
				});
			},

			//	activate() :
			activate: function (hex) {
				this.end();
				let ability = this;

				let makeSeal = function () {
					let effect = new Effect(
						'Royal Seal',
						ability.creature,
						hex,
						'onStepIn',
						{
							// Gumbles immune
							requireFn: function () {
								let crea = this.trap.hex.creature;
								return crea && crea.type !== this.owner.type;
							},
							effectFn: function (_, crea) {
								if (this.trap.turnLifetime === 0) {
									crea.remainingMove = 0;
									// Destroy the trap on the trapped creature's turn
									this.trap.turnLifetime = 1;
									this.trap.ownerCreature = crea;
								}
							},
							// Immobilize target so that they can't move and no
							// abilities/effects can move them
							alterations: {
								moveable: false,
							},
							deleteTrigger: 'onStartPhase',
							turnLifetime: 1,
						},
						G,
					);

					let trap = hex.createTrap('royal-seal', [effect], ability.creature.player, {
						ownerCreature: ability.creature,
						fullTurnLifetime: true,
					});
					trap.hide();
				};

				// Move Gumble to the target hex if necessary
				if (hex.x !== this.creature.x || hex.y !== this.creature.y) {
					this.creature.moveTo(hex, {
						callback: function () {
							G.activeCreature.queryMove();
							makeSeal();
						},
						ignoreMovementPoint: true,
						ignorePath: true,
						overrideSpeed: 200, // Custom speed for jumping
						animation: 'push',
					});
				} else {
					makeSeal();
				}
			},
		},

		// 	Fourth Ability: Boom Box
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			directions: [1, 1, 1, 1, 1, 1],
			_targetTeam: Team.Enemy,

			// 	require() :
			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				if (
					!this.testDirection({
						team: this._targetTeam,
						directions: this.directions,
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

				G.grid.queryDirection({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					flipped: crea.player.flipped,
					team: this._targetTeam,
					id: this.creature.id,
					requireCreature: true,
					x: crea.x,
					y: crea.y,
					directions: this.directions,
				});
			},

			//	activate() :
			activate: function (path, args) {
				let ability = this;
				ability.end();

				let target = arrayUtils.last(path).creature;
				let melee = path[0].creature === target;

				let d = melee
					? {
							sonic: 20,
							crush: 10,
					  }
					: {
							sonic: 20,
					  };

				let dir = [];
				switch (args.direction) {
					case 0: // Upright
						dir = G.grid
							.getHexMap(target.x, target.y - 8, 0, target.flipped, matrices.diagonalup)
							.reverse();
						break;
					case 1: // StraitForward
						dir = G.grid.getHexMap(target.x, target.y, 0, target.flipped, matrices.straitrow);
						break;
					case 2: // Downright
						dir = G.grid.getHexMap(target.x, target.y, 0, target.flipped, matrices.diagonaldown);
						break;
					case 3: // Downleft
						dir = G.grid.getHexMap(target.x, target.y, -4, target.flipped, matrices.diagonalup);
						break;
					case 4: // StraitBackward
						dir = G.grid.getHexMap(target.x, target.y, 0, !target.flipped, matrices.straitrow);
						break;
					case 5: // Upleft
						dir = G.grid
							.getHexMap(target.x, target.y - 8, -4, target.flipped, matrices.diagonaldown)
							.reverse();
						break;
					default:
						break;
				}

				let canKnockBack =
					dir.length > 1 &&
					dir[1].isWalkable(target.size, target.id, true) &&
					target.stats.moveable;

				// Perform extra damage if upgraded and cannot push back
				if (this.isUpgraded() && !canKnockBack) {
					d.sonic += 10;
				}

				let damage = new Damage(
					ability.creature, // Attacker
					d, // Damage Type
					1, // Area
					[], // Effects
					G,
				);

				let result = target.takeDamage(damage, {
					ignoreRetaliation: true,
				});

				if (result.kill) {
					return;
				} // if creature die stop here

				// Knockback the target 1 hex
				if (canKnockBack) {
					target.moveTo(dir[1], {
						ignoreMovementPoint: true,
						ignorePath: true,
						callback: function () {
							G.activeCreature.queryMove();
						},
						animation: 'push',
					});
				}
			},
		},
	];
};
