import { Damage } from '../damage';
import { Team, isTeam } from '../utility/team';
import * as matrices from '../utility/matrices';
import { Creature } from '../creature';
import { Effect } from '../effect';

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default (G) => {
	G.abilities[33] = [
		// 	First Ability: Battle Cry
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onDamage onStartPhase',

			_damaged: false,
			_targets: [],

			// 	require() :
			require: function () {
				// Creature is damaged
				if (G.activeCreature != this.creature) {
					this._damaged = true;
					return false;
				}
				if (!this._damaged) {
					return false;
				} else {
					this._damaged = false;
				}
				this._targets = this.creature.adjacentHexes(1);
				if (this.isUpgraded()) {
					// Upgraded version only activates if enemy is in adjacent hexes
					if (
						!this.atLeastOneTarget(this._targets, {
							team: Team.Enemy,
						})
					) {
						return false;
					}
				}
				return this.testRequirements();
			},

			//	activate() :
			activate: function () {
				const creature = this.creature;
				const damage = new Damage(creature, { sonic: 30 }, this._targets.length, [], G);
				const hits = new Set();
				G.Phaser.camera.shake(0.02, 300, true, G.Phaser.camera.SHAKE_HORIZONTAL, true);

				this._targets.forEach((target) => {
					if (target.creature === undefined || hits.has(target.creature)) {
						return;
					}
					hits.add(target.creature);
				});
				this.end(false, true);
				hits.forEach((hit, _, set) => {
					hit.takeDamage(damage);
				});
				this.end(true, false);
			},
		},

		/**
		 * Second Ability: Executioner Axe
		 *
		 * Damage an adjacent enemy unit with slash damage, instantly killing it if
		 * its remaining health is <= 45.
		 *
		 * Targeting rules:
		 * - The target unit be an enemy.
		 * - The target unit must be in the 3 front hexes, or 3 back hexes adjacent
		 *   to the Golden Wyrm.
		 *
		 * Other rules:
		 * - If the unit has 45 remaining health or lower, it will be instantly killed
		 *   unless protected by the Dodge or Shielded damage mitigation effects.
		 * - The execution damage is "pure" and cannot be reduced via resistances.
		 *
		 * When upgraded, a successful execution attack will allow the ability to be
		 * used again. Each use requires the full energy cost.
		 */
		{
			trigger: 'onQuery',

			_executeHealthThreshold: 45,

			_targetTeam: Team.Enemy,

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				if (
					!this.atLeastOneTarget(this._getHexes(), {
						team: this._targetTeam,
					})
				) {
					return false;
				}

				return true;
			},

			query: function () {
				const wyrm = this.creature;
				const ability = this;

				this.game.grid.queryCreature({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					team: this._targetTeam,
					id: wyrm.id,
					flipped: wyrm.flipped,
					hexes: this._getHexes(),
				});
			},

			activate: function (target) {
				this.end();
				G.Phaser.camera.shake(0.02, 200, true, G.Phaser.camera.SHAKE_BOTH, true);

				if (target.health <= this._executeHealthThreshold) {
					const executeDamage = new Damage(
						this.creature,
						{
							// Pure damage bypasses resistances, but can still be shielded or dodged
							pure: target.health,
						},
						1,
						[],
						this.game,
					);
					/* Suppress the death message, to be replaced by a custom log. Setting
					`noLog` on Damage wouldn't work as it would suppress Shielded/Dodged messages. */
					this.game.UI.chat.suppressMessage(/is dead/i, 1);
					const damageResult = target.takeDamage(executeDamage);

					// Damage could be shielded or blocked, so double check target has died.
					if (damageResult.kill) {
						this.game.log(`%CreatureName${target.id}% has been executed!`);
						target.hint('Executed', 'damage');

						if (this.isUpgraded()) {
							this.setUsed(false);
							// Refresh UI to show ability still able to be used.
							this.game.UI.selectAbility(-1);
						}
					}
				} else {
					const normalDamage = new Damage(
						this.creature,
						{
							slash: 30,
						},
						1,
						[],
						this.game,
					);
					target.takeDamage(normalDamage);
				}
			},

			/**
			 * The area of effect is the front and back 3 hexes for a total of 6 hexes.
			 *
			 * @returns {Hex[]} Refer to Creature.getHexMap()
			 */
			_getHexes() {
				return this.creature.getHexMap(matrices.frontnback3hex);
			},
		},

		/**
		 * Third Ability: Dragon Flight
		 *
		 * Move to a location within 10 hexes distance using flying movement (avoids
		 * obstacles including units).
		 *
		 * The ability cannot be used if the Golden Wyrm has been made immoveable.
		 *
		 * Targeting rule:
		 * - Target hexes must be within 10 adjacent hexes distance from any part of
		 *   its 3-sized body.
		 * - Target hexes must not be occupied by another unit.
		 *
		 * When upgraded the Golden Wyrm receives a +25 offense buff for its next Executioner
		 * Axe ability. This buff lasts until the end of the turn, or if Executioner
		 * Axe is used.
		 */
		{
			trigger: 'onQuery',

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				if (!this.creature.stats.moveable) {
					this.message = G.msg.abilities.notMoveable;
					return false;
				}

				return true;
			},

			query: function () {
				const ability = this;
				const wyrm = this.creature;

				const range = this.game.grid.getFlyingRange(wyrm.x, wyrm.y, 10, wyrm.size, wyrm.id);

				this.game.grid.queryHexes({
					fnOnSelect: function () {
						ability._highlightDestination(...arguments);
					},
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					size: wyrm.size,
					flipped: wyrm.player.flipped,
					id: wyrm.id,
					hexes: range,
				});
			},

			activate: function (hex) {
				const ability = this;
				ability.end();

				ability.creature.moveTo(hex, {
					ignoreMovementPoint: true,
					ignorePath: true,
					callback: function () {
						G.activeCreature.queryMove();
						G.Phaser.camera.shake(0.04, 100, true, G.Phaser.camera.SHAKE_VERTICAL, true);

						if (ability.isUpgraded()) {
							// Add offense buff after landing
							ability._addOffenseBuff();
						}
					},
				});
			},

			_highlightDestination: function (hex) {
				this.creature.tracePosition({
					x: hex.x,
					y: hex.y,
					overlayClass: 'creature moveto selected player' + this.creature.team,
				});
			},

			_addOffenseBuff() {
				const wyrm = this.creature;
				const ability = this;
				const offenseBuffEffect = new Effect(
					'Momentum',
					ability.creature,
					ability.creature,
					'',
					{
						effectFn: function (effect) {
							effect.deleteEffect();
						},
						alterations: {
							/* This can technically only apply to Executioner's Axe because
							the Golden Wyrm only has a single direct attack ability. */
							offense: 25,
						},
						/* The buff should only apply for one use of Executioner's Axe, but
						that ability can only be used once per turn so it's much easier to leave
						this Effect to be cleaned up next turn. */
						deleteTrigger: 'onStartPhase',
						turnLifetime: 1,
					},
					this.game,
				);
				ability.creature.addEffect(offenseBuffEffect);
			},
		},

		/**
		 * Fourth Ability: Visible Stigmata
		 *
		 * Heals an adjacent allied unit at the cost of the Golden Wyrm's own health,
		 * essentially transferring health.
		 *
		 * Targeting rules:
		 * - The target unit be an ally.
		 * - The target unit must be in hexes directly adjacent to the Golden Wyrm.
		 * - Cannot target full health units.
		 *
		 * Other rules:
		 * - Requires at least 51 remaining health to use so the Golden Wyrm doesn't
		 *   kill itself.
		 * - If the target unit is missing less than the max heal amount (50), only
		 *   the missing amount will be transferred.
		 *
		 * When upgraded each use buffs Golden Wyrm with 10 permanent regrowth points.
		 */
		{
			trigger: 'onQuery',

			_targetTeam: Team.Ally,

			_maxTransferAmount: 50,

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				/* Golden Wyrm needs to be left with at least 1 hp after the ability. We
				can't use ability.costs because that is a fixed value, whereas this ability
				has a dynamic health cost. */
				if (this.creature.health < this._maxTransferAmount + 1) {
					this.message = 'Not enough health';
					return false;
				}

				if (
					!this.atLeastOneTarget(this._getHexes(), {
						team: this._targetTeam,
						optTest: this._confirmTarget,
					})
				) {
					return false;
				}

				return true;
			},

			query: function () {
				const ability = this;
				const wyrm = this.creature;

				G.grid.queryCreature({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					optTest: this._confirmTarget,
					team: this._targetTeam,
					id: wyrm.id,
					flipped: wyrm.flipped,
					hexes: this._getHexes(),
				});
			},

			activate: function (target) {
				this.end();

				// The health transferred is the creature's missing life, capped to 50.
				const transferAmount = Math.min(
					target.stats.health - target.health,
					this._maxTransferAmount,
				);

				target.heal(transferAmount, false, false);

				/* Damage Golden Wyrm using `.heal()` instead of `.takeDamage()` to apply
				raw damage that bypasses dodge, shielded, etc and does not trigger further
				effects. */
				this.creature.heal(-transferAmount, false, false);

				// Rather than individual loss/gain health logs, show a single custom log.
				this.game.log(
					`%CreatureName${this.creature.id}% gives ${transferAmount} health to %CreatureName${target.id}%`,
				);

				if (this.isUpgraded()) {
					const regrowthBuffEffect = new Effect(
						this.title,
						this.creature,
						this.creature,
						'',
						{
							alterations: {
								regrowth: 10,
							},
						},
						G,
					);

					this.creature.addEffect(
						regrowthBuffEffect,
						`%CreatureName${this.creature.id}% gains 10 regrowth points`,
						'',
						false,
						true,
					);
				}
			},

			/**
			 * Determine the area of effect to query and activate the ability. The area
			 * of effect are the hexes directly adjacent around the 3-sized creature.
			 * This is a total of 10 hexes assuming the Golden Wyrm is not adjacent to
			 * the edge of the board.
			 *
			 * @returns {Hex[]} Refer to Creature.adjacentHexes()
			 */
			_getHexes() {
				return this.creature.adjacentHexes(1);
			},

			/**
			 * Confirm a target ally creature can be targeted.
			 *
			 * @param {Creature} creature Ally creature that could be targeted.
			 * @returns {boolean} Should the creature be targeted?
			 */
			_confirmTarget(creature) {
				return creature.health < creature.stats.health;
			},
		},
	];
};
