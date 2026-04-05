import * as $j from 'jquery';
import { Damage } from '../damage';
import { Team, isTeam } from '../utility/team';
import * as matrices from '../utility/matrices';
import * as arrayUtils from '../utility/arrayUtils';
import { Effect } from '../effect';
import { Creature } from '../creature';
import Game from '../game';
import { Hex } from '../utility/hex';
import { Trap } from '../utility/trap';

const PRETTY_RIBBON_HEAL = 20;
const PRETTY_RIBBON_BUFF = 2;
const PRETTY_RIBBON_DEBUFF = -2;

const getPrettyRibbonHexes = (ability) => {
	return ability.creature.hexagons.concat(ability.creature.adjacentHexes(2));
};

const isPrettyRibbonTarget = (ability, target: Creature) => {
	if (target.player === ability.creature.player) {
		return true;
	}

	return ability.isUpgraded() && isTeam(ability.creature, target, Team.Enemy);
};

const getPrettyRibbonTargetHexes = (ability) => {
	return getPrettyRibbonHexes(ability).filter((hex: Hex) => {
		return hex.creature instanceof Creature && isPrettyRibbonTarget(ability, hex.creature);
	});
};

const applyFriendlyPrettyRibbon = (ability, target: Creature, game: Game) => {
	const healedAmount = Math.min(PRETTY_RIBBON_HEAL, target.stats.health - target.health);

	if (healedAmount > 0) {
		target.heal(healedAmount, false, false);
	}

	target.addEffect(
		new Effect(
			ability.title,
			ability.creature,
			target,
			'',
			{
				turnLifetime: -1,
				alterations: {
					regrowth: PRETTY_RIBBON_BUFF,
					endurance: PRETTY_RIBBON_BUFF,
				},
			},
			game,
		),
		healedAmount > 0
			? `%CreatureName${target.id}% recovers +${healedAmount} health and gains +${PRETTY_RIBBON_BUFF} regrowth and +${PRETTY_RIBBON_BUFF} endurance`
			: `%CreatureName${target.id}% gains +${PRETTY_RIBBON_BUFF} regrowth and +${PRETTY_RIBBON_BUFF} endurance`,
	);
};

const applyEnemyPrettyRibbon = (ability, target: Creature, game: Game) => {
	if (target.isDarkPriest() && target.hasCreaturePlayerGotPlasma()) {
		target.takeDamage(
			new Damage(
				ability.creature,
				{
					slash: 1,
				},
				1,
				[],
				game,
			),
		);
		return;
	}

	target.removeEffect(ability.title);
	target.addEffect(
		new Effect(
			ability.title,
			ability.creature,
			target,
			'',
			{
				stackable: false,
				turnLifetime: 1,
				deleteTrigger: 'onStartPhase',
				alterations: {
					movement: PRETTY_RIBBON_DEBUFF,
				},
			},
			game,
		),
		`%CreatureName${target.id}% loses ${Math.abs(PRETTY_RIBBON_DEBUFF)} movement for this turn`,
	);
};

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default (G: Game) => {
	G.abilities[14] = [
		// First Ability: Gooey Body
		{
			// Trigger when Gumble dies
			trigger: 'onCreatureDeath',

			require: function () {
				return true;
			},

			activate: function (deadCreature: Creature) {
				const deathHex = G.grid.hexAt(deadCreature.x, deadCreature.y);

				const ability = this;

				// Create goo trap at Gumble's death location
				const createGooTrap = () => {
					// Skip on the re-entrant real death (BRB trap was just destroyed,
					// triggering this death). The trap that displaced the original
					// gooey-body is already at this hex; we must not create a second
					// gooey-body on top of it, otherwise it looks like the original
					// was never destroyed.
					if (ability.isUpgraded() && ability.creature._brbSpent) {
						return;
					}

					console.log("Creating goo trap at Gumble's death location");

					const effect = new Effect(
						'Gooey Body',
						ability.creature,
						deathHex,
						'onStepIn',
						{
							requireFn: function () {
								return !!this.trap.hex.creature;
							},
							effectFn: function (_effect, creature: Creature) {
								// Pin the creature: it cannot move further this turn.
								// Flying units only reach this point when stopping ON the
								// trap (mid-flight hexes use ignoreTraps=true), so this
								// correctly pins both walkers and landing flyers.
								creature.remainingMove = 0;
							},
							alterations: {},
							deleteTrigger: '',
							// Effect should persist as long as the trap exists
							turnLifetime: -1,
						},
						G,
					);

					// If upgraded, set up BRB state so die() will intercept the death.
					// _brbSpent is true while a BRB is already in flight (between the
					// initial death and either revival or real death via trap destruction),
					// preventing a re-entrant second BRB on the follow-up die() call.
					if (ability.isUpgraded() && !ability.creature._brbSpent) {
						ability.creature._brbActive = true;
						ability.creature._brbState = {
							killer: null, // filled in by die() after this trigger returns
							gooTrap: null, // filled in below after trap is constructed
						};
					}

					const gooTrap = new Trap(
						deathHex.x,
						deathHex.y,
						'gooey-body',
						[effect],
						ability.creature.player,
						{
							ownerCreature: ability.creature,
							fullTurnLifetime: true,
							// Trap persists until overlapped by another trap
							turnLifetime: -1,
						},
						G,
					);

					if (ability.isUpgraded() && !ability.creature._brbSpent) {
						ability.creature._brbState.gooTrap = gooTrap;
					}

					G.log('%CreatureName' + deadCreature.id + '% melts into a gooey puddle');
				};

				createGooTrap();
			},
		},

		// Second Ability: Gummy Mallet
		{
			// Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			require: function () {
				// Always usable, even if no targets
				return this.testRequirements();
			},

			// query() :
			query: function () {
				const ability = this;
				// Gummy Mallet can hit a 7-hexagon circular area in 6 directions, where the
				// center of each area is two hexes away. Each area can be chosen regardless
				// of whether targets are within.
				const area = [
					[1, 1],
					[1, 1, 1],
					[1, 1],
				] as matrices.AugmentedMatrix;

				const dx = this.creature.y % 2 !== 0 ? -1 : 0;
				const dy = -1;
				const choices = [
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
					return choice1.length - choice2.length;
				});
				G.grid.queryChoice({
					fnOnCancel: function () {
						G.activeCreature.queryMove();
					},
					fnOnConfirm: function () {
						// eslint-disable-next-line
						ability.animation(...arguments);
					},
					team: Team.Both,
					id: this.creature.id,
					requireCreature: false,
					choices: choices,
				});
			},

			activate: function (hexes: Hex[]) {
				const ability = this;
				ability.end();

				G.Phaser.camera.shake(0.02, 333, true, G.Phaser.camera.SHAKE_VERTICAL, true);

				const targets = ability.getTargets(hexes);
				// Deal double damage to enemies if upgraded
				const enemyDamages = $j.extend({}, ability.damages);
				if (this.isUpgraded()) {
					for (const k in enemyDamages) {
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
					const dmg = new Damage(this.creature, damages, targets[i].hexesHit, [], G);
					// Increment kills if the target is killed
					kills += targets[i].target.takeDamage(dmg).kill ? 1 : 0;
				}
				if (kills > 1) {
					this.creature.player.score.push({
						type: 'combo',
						kills: kills,
					});
				}
			},
		},

		// Third Ability: Pretty Ribbon
		{
			// Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			// require() :
			require: function () {
				return this.testRequirements();
			},

			// query() :
			query: function () {
				const ability = this;
				const creature = this.creature;
				const targetHexes = getPrettyRibbonTargetHexes(this);
				const queryHexes = [];

				targetHexes.forEach((hex) => {
					hex.creature.hexagons.forEach((targetHex) => {
						if (!arrayUtils.findPos(queryHexes, targetHex)) {
							queryHexes.push(targetHex);
						}
					});
				});

				G.grid.queryHexes({
					fnOnConfirm: function (hex) {
						ability.animation(hex.creature);
					},
					fnOnSelect: function (hex) {
						creature.faceHex(hex.creature);
						hex.creature.tracePosition({
							overlayClass: 'creature selected player' + hex.creature.team,
						});
					},
					fnOnCancel: function () {
						G.activeCreature.queryMove();
					},
					flipped: creature.player.flipped,
					id: creature.id,
					hexes: queryHexes,
					ownCreatureHexShade: true,
					hideNonTarget: true,
				});
			},

			// activate() :
			activate: function (target: Creature) {
				this.end();
				G.Phaser.camera.shake(0.01, 100, true, G.Phaser.camera.SHAKE_VERTICAL, true);

				if (isTeam(this.creature, target, Team.Enemy)) {
					applyEnemyPrettyRibbon(this, target, G);
				} else {
					applyFriendlyPrettyRibbon(this, target, G);
				}
			},
		},

		// Fourth Ability: Boom Box
		{
			// Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			directions: [1, 1, 1, 1, 1, 1],
			_targetTeam: Team.Enemy,

			// require() :
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

			// query() :
			query: function () {
				const ability = this;
				const crea = this.creature;

				G.grid.queryDirection({
					fnOnConfirm: function () {
						// eslint-disable-next-line
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

			// activate() :
			activate: function (path, args) {
				const ability = this;
				ability.end();
				G.Phaser.camera.shake(0.02, 300, true, G.Phaser.camera.SHAKE_HORIZONTAL, true);

				let target = arrayUtils.last(path).creature;
				{
					// TODO:
					// target is undefined when Player 2 creature uses this ability.
					// arrayUtils.last(path).creature is undefined.
					// This block fixes the error, but it's an ugly fix.
					if (!target) {
						const attackingCreature = ability.creature;
						const creatures = path
							.map((hex) => hex.creature)
							.filter((c) => c && c != attackingCreature);
						if (creatures.length === 0) {
							return;
						} else {
							target = creatures[0];
						}
					}
				}
				const melee = path[0].creature === target;

				const d = melee
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

				const canKnockBack =
					dir.length > 1 &&
					dir[1].isWalkable(target.size, target.id, true) &&
					target.stats.moveable;

				// Perform extra damage if upgraded and cannot push back
				if (this.isUpgraded() && !canKnockBack) {
					d.sonic += 10;
				}

				const damage = new Damage(
					ability.creature, // Attacker
					d, // Damage Type
					1, // Area
					[], // Effects
					G,
				);

				const result = target.takeDamage(damage, {
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
