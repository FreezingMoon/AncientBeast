import * as $j from 'jquery';
import { Damage } from '../damage';
import { Team, isTeam } from '../utility/team';
import * as matrices from '../utility/matrices';
import * as arrayUtils from '../utility/arrayUtils';

const HopTriggerDirections = {
	Above: 0,
	Front: 1,
	Below: 2,
};

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default (G) => {
	G.abilities[12] = [
		/**
		 * First Ability: Bunny Hop
		 * After any movement, if an enemy is newly detected in the 3 hexes in front
		 * of the bunny (facing right for player 1, left for player 2), the creature
		 * will move backwards one space in an opposite direction.
		 */
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onCreatureMove onOtherCreatureMove',

			/**
			 * Bunny Hop triggers on any movement during other creature's turns (not the
			 * Bunny's self-movement) that causes an enemy to appear in front of the Bunny.
			 * This could be the enemy moving, or an enemy or ally displacing the Bunny
			 * or another creature.
			 *
			 * Bunny Hop is only usable if the creature is not affected by ability-restricting
			 * effects such as Materialization Sickness or Frozen.
			 *
			 * @param {Hex} hex Destination hex where a creature (bunny or other) has moved.
			 * @returns {boolean} If the ability should trigger.
			 */
			require: function (hex) {
				if (!this.testRequirements()) {
					return false;
				}

				// This ability only triggers on other creature's turns, it's purely defensive.
				if (this.creature === this.game.activeCreature) {
					return false;
				}

				// Double check the destination hex actually contains a creature.
				if (!hex.creature) {
					return false;
				}

				/* Determine which (if any) frontal hexes contain an enemy that would trigger
				the ability. */
				let triggerHexes = [];

				if (hex.creature === this.creature) {
					// Bunny has been moved by another active creature, not itself.
					triggerHexes = this._detectFrontHexesWithEnemy();
				} else if (isTeam(hex.creature, this.creature, Team.Enemy)) {
					// Enemy movement.
					const frontHexWithEnemy = this._findEnemyHexInFront(hex);

					if (frontHexWithEnemy) {
						triggerHexes.push(frontHexWithEnemy);
					}
				}

				const abilityCanTrigger =
					triggerHexes.length &&
					this.timesUsedThisTurn < this._getUsesPerTurn() &&
					// Bunny cannot use this ability if affected by these statuses.
					!this.creature.materializationSickness &&
					!this.creature.isFrozen() &&
					// Bunny needs a valid hex to retreat into.
					this._getHopHex();

				return abilityCanTrigger;
			},

			//	activate() :
			activate: function (hex) {
				let ability = this;

				ability.end();

				this.creature.moveTo(this._getHopHex(), {
					callback: function () {
						G.activeCreature.queryMove();
					},
					ignorePath: true,
					ignoreMovementPoint: true,
				});
			},

			_getUsesPerTurn: function () {
				// If upgraded, useable twice per turn
				return this.isUpgraded() ? 2 : 1;
			},

			/**
			 * Analyse frontal enemy positions and determine which (if any) hexes are
			 * available for the Bunny to hop backwards into.
			 *
			 * Hop movement rules:
			 * - Bunny will first attempt to move in an opposite direction from the approaching
			 *   enemy. For example, if approached from the bottom-left it will try hop
			 *   towards the top-right.
			 *   ⬡⬡↗️
			 *   ⬡🐇⬡
			 *   👹⬡⬡
			 * - If movement described above is impossible, the Bunny will instead move backwards.
			 *   ⬡⬡❌
			 *   ⬡🐇➡️
			 *   👹⬡⬡
			 * - If an enemy is approaching from both top and bottom front hexes, Bunny
			 *   will move backwards.
			 *   👹⬡⬡
			 *   ⬡🐇➡️
			 *   👹⬡⬡
			 * - If trying to move backwards and is unable to do so, movement is cancelled.
			 *   ⬡⬡⬡
			 *   👹🐇❌
			 *   ⬡⬡⬡
			 *
			 * At this point we have determined the ability should be triggered, so we
			 * are only concerned which enemies to hop away from, not which enemies originally
			 * triggered the ability.
			 *
			 * @returns {Hex} Hex the bunny will hop (move) into.
			 */
			_getHopHex: function () {
				const triggerHexes = this._detectFrontHexesWithEnemy();

				// Try to hop away
				let hex;

				if (
					triggerHexes.find((hex) => hex.direction === HopTriggerDirections.Front) ||
					// If the bunny is flanked on top and bottom then hop backwards.
					(triggerHexes.find((hex) => hex.direction === HopTriggerDirections.Above) &&
						triggerHexes.find((hex) => hex.direction === HopTriggerDirections.Below))
				) {
					hex = this.creature.getHexMap(matrices.inlineback1hex)[0];
				} else if (triggerHexes.find((hex) => hex.direction === HopTriggerDirections.Above)) {
					hex = this.creature.getHexMap(matrices.backbottom1hex)[0];
				} else if (triggerHexes.find((hex) => hex.direction === HopTriggerDirections.Below)) {
					hex = this.creature.getHexMap(matrices.backtop1hex)[0];
				}

				// If we can't hop away, try hopping backwards.
				if (hex === undefined || !hex.isWalkable(this.creature.size, this.creature.id, true)) {
					hex = this.creature.getHexMap(matrices.inlineback1hex)[0];
				}

				// Finally, give up if we still can't move.
				if (hex !== undefined && !hex.isWalkable(this.creature.size, this.creature.id, true)) {
					return undefined;
				}

				return hex;
			},

			/**
			 * Determine if a hex containing an enemy is in front of the bunny. Useful
			 * for checking if a newly moved enemy has entered the Bunny's Hop zone.
			 *
			 * @param {Hex} hexWithEnemy Hex known to contain an enemy.
			 * @returns {Hex | undefined} hexWithEnemy if it did move in front of the bunny, otherwise undefined.
			 */
			_findEnemyHexInFront: function (hexWithEnemy) {
				const frontHexesWithEnemy = this._detectFrontHexesWithEnemy();
				const foundEnemyHex = frontHexesWithEnemy.some(
					({ hex }) => hexWithEnemy.creature === hex.creature,
				);

				return foundEnemyHex ? hexWithEnemy : undefined;
			},

			/**
			 * Check the 3 hexes in front of the Snow bunny for any enemy creatures.
			 *
			 * @returns creature in front of the Snow Bunny, or undefined if there is none.
			 */
			_detectFrontHexesWithEnemy: function () {
				const hexesInFront = this.creature.getHexMap(matrices.front1hex);
				const hexesWithEnemy = hexesInFront.reduce((acc, curr, idx) => {
					const hexHasEnemy = curr.creature && isTeam(curr.creature, this.creature, Team.Enemy);

					if (hexHasEnemy) {
						acc.push({
							// Maps to HopTriggerDirections.
							direction: idx,
							hex: curr,
						});
					}

					return acc;
				}, []);

				return hexesWithEnemy;
			},
		},

		// 	Second Ability: Big Pliers
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			_targetTeam: Team.Enemy,

			// 	require() :
			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				if (
					!this.atLeastOneTarget(this.creature.adjacentHexes(1), {
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
				let snowBunny = this.creature;

				G.grid.queryCreature({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					team: this._targetTeam,
					id: snowBunny.id,
					flipped: snowBunny.player.flipped,
					hexes: snowBunny.adjacentHexes(1),
				});
			},

			//	activate() :
			activate: function (target) {
				let ability = this;
				ability.end();

				let damages = ability.damages;
				// If upgraded, do pure damage against frozen targets
				if (this.isUpgraded() && target.isFrozen()) {
					damages = {
						pure: 0,
					};
					for (let type in ability.damages) {
						if ({}.hasOwnProperty.call(ability.damages, type)) {
							damages.pure += ability.damages[type];
						}
					}
				}

				let damage = new Damage(
					ability.creature, // Attacker
					damages, // Damage Type
					1, // Area
					[], // Effects
					G,
				);
				target.takeDamage(damage);
			},
		},

		// 	Third Ability: Blowing Wind
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			directions: [1, 1, 1, 1, 1, 1],
			_targetTeam: Team.Both,

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
				let snowBunny = this.creature;

				G.grid.queryDirection({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					flipped: snowBunny.player.flipped,
					team: this._targetTeam,
					id: snowBunny.id,
					requireCreature: true,
					x: snowBunny.x,
					y: snowBunny.y,
					directions: this.directions,
				});
			},

			//	activate() :
			activate: function (path, args) {
				let ability = this;
				ability.end();

				let target = arrayUtils.last(path).creature;
				// No blow size penalty if upgraded and target is frozen
				let dist = 5 - (this.isUpgraded() && target.isFrozen() ? 0 : target.size);
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

				let hex = target.hexagons[0];

				target.moveTo(hex, {
					ignoreMovementPoint: true,
					ignorePath: true,
					callback: function () {
						G.activeCreature.queryMove();
					},
					animation: 'push',
				});

				G.Phaser.camera.shake(0.01, 500, true, G.Phaser.camera.SHAKE_VERTICAL, true);

				dir = dir.slice(0, dist + 1);

				for (let j = 0; j < dir.length; j++) {
					if (dir[j].isWalkable(target.size, target.id, true)) {
						hex = dir[j];
					} else {
						break;
					}
				}

				target.moveTo(hex, {
					ignoreMovementPoint: true,
					ignorePath: true,
					callback: function () {
						G.activeCreature.queryMove();
					},
					animation: 'push',
				});

				G.Phaser.camera.shake(0.01, 500, true, G.Phaser.camera.SHAKE_VERTICAL, true);
			},
		},

		// 	Fourth Ability: Freezing Spit
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

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
				let snowBunny = this.creature;

				G.grid.queryDirection({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					flipped: snowBunny.player.flipped,
					team: this._targetTeam,
					id: snowBunny.id,
					requireCreature: true,
					x: snowBunny.x,
					y: snowBunny.y,
					directions: [1, 1, 1, 1, 1, 1],
				});
			},

			//	activate() :
			activate: function (path, args) {
				let ability = this;
				ability.end();
				let target = arrayUtils.last(path).creature;

				let projectileInstance = G.animations.projectile(
					this,
					target,
					'effects_freezing-spit',
					path,
					args,
					52,
					-20,
				);
				let tween = projectileInstance[0];
				let sprite = projectileInstance[1];
				let dist = projectileInstance[2];

				tween.onComplete.add(function () {
					// this refers to the animation object, _not_ the ability
					this.destroy();

					// Copy to not alter ability strength
					let dmg = $j.extend({}, ability.damages);
					dmg.crush += 3 * dist; // Add distance to crush damage

					let damage = new Damage(
						ability.creature, // Attacker
						dmg, // Damage Type
						1, // Area
						[],
						G,
					);
					let damageResult = target.takeDamage(damage);

					// If upgraded and melee range, freeze the target
					if (ability.isUpgraded() && damageResult.damageObj.melee) {
						target.freeze();
					}
				}, sprite); // End tween.onComplete
			},
			getAnimationData: function () {
				return {
					duration: 500,
					delay: 0,
					activateAnimation: false,
				};
			},
		},
	];
};
