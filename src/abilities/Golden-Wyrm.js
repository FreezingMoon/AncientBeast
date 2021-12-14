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
							team: Team.enemy,
						})
					) {
						return false;
					}
				}
				return this.testRequirements();
			},

			//	activate() :
			activate: function () {
				let creature = this.creature;
				let damage = new Damage(creature, { sonic: 30 }, this._targets.length, [], G);
				let hits = new Set();

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

		// 	Second Ability: Executioner Axe
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			damages: {
				slash: 40,
			},
			_targetTeam: Team.enemy,

			// 	require() :
			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				//At least one target
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
				let wyrm = this.creature;
				let ability = this;

				let map = [
					[0, 0, 0, 0],
					[0, 1, 0, 1],
					[1, 0, 0, 1], //origin line
					[0, 1, 0, 1],
				];

				G.grid.queryCreature({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					team: this._targetTeam,
					id: wyrm.id,
					flipped: wyrm.flipped,
					hexes: G.grid.getHexMap(wyrm.x - 2, wyrm.y - 2, 0, false, map),
				});
			},

			//	activate() :
			activate: function (target) {
				let ability = this;
				ability.end();

				let damage = new Damage(
					ability.creature, // Attacker
					ability.damages, // Damage Type
					1, // Area
					[], // Effects
					G,
				);

				let dmg = target.takeDamage(damage);

				if (dmg.status == '') {
					// Regrowth bonus
					ability.creature.addEffect(
						new Effect(
							'Regrowth++', // Name
							ability.creature, // Caster
							ability.creature, // Target
							'onStartPhase', // Trigger
							{
								effectFn: function (effect) {
									effect.deleteEffect();
								},
								alterations: {
									regrowth: Math.round(dmg.damages.total / 4),
								},
							}, //Optional arguments
							G,
						),
					);
				}

				//remove frogger bonus if its found
				ability.creature.effects.forEach(function (effect) {
					if (effect.name == 'Frogger Bonus') {
						this.deleteEffect();
					}
				});
			},
		},

		// 	Third Ability: Dragon Flight
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			require: function () {
				return this.testRequirements();
			},

			fnOnSelect: function (hex) {
				this.creature.tracePosition({
					x: hex.x,
					y: hex.y,
					overlayClass: 'creature moveto selected player' + this.creature.team,
				});
			},

			// 	query() :
			query: function () {
				let ability = this;
				let wyrm = this.creature;

				let range = G.grid
					.getFlyingRange(wyrm.x, wyrm.y, 50, wyrm.size, wyrm.id)
					.filter((item) => wyrm.item == item.y);

				G.grid.queryHexes({
					fnOnSelect: function () {
						ability.fnOnSelect(...arguments);
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

			//	activate() :
			activate: function (hex) {
				let ability = this;
				ability.end();

				ability.creature.moveTo(hex, {
					ignoreMovementPoint: true,
					ignorePath: true,
					callback: function () {
						G.activeCreature.queryMove();
					},
				});

				// Frogger Leap bonus
				ability.creature.addEffect(
					new Effect(
						'Offense++', // Name
						ability.creature, // Caster
						ability.creature, // Target
						'onStepIn onEndPhase', // Trigger
						{
							effectFn: function (effect) {
								effect.deleteEffect();
							},
							alterations: {
								offense: 25,
							},
						}, // Optional arguments
						G,
					),
				);
			},
		},

		/**
		 * Fourth Ability: Visible Stigmata
		 *
		 * Heals an ally at the cost of own health. If the target unit is missing less
		 * than the max heal amount (50), only the missing amount will be transferred.
		 * Cannot target full health units.
		 *
		 * When upgraded, each use buffs Golden Wyrm with 10 regrowth points.
		 */
		{
			trigger: 'onQuery',

			_targetTeam: Team.ally,

			// TODO: Can this value be sourced from data.json?
			_maxTransferAmount: 50,

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				// Golden Wyrm needs to be left with at least 1 hp after the ability.
				if (this.creature.health < this._maxTransferAmount + 1) {
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

				/* The amount of health transferred is the creature's missing life, capped 
				to 50. */
				const transferAmount = Math.min(
					target.stats.health - target.health,
					this._maxTransferAmount,
				);

				target.heal(transferAmount);

				/* Damage Golden Wyrm using `.heal()` instead of `.takeDamage()` to apply 
				raw damage that bypasses dodge, shielded, etc and does not trigger further 
				effects. */
				this.creature.heal(-transferAmount);

				// TODO: Should we show messages/hints for this transfer beyond health lost/gained?

				if (this.isUpgraded()) {
					const regrowthBuffEffect = new Effect(
						// No name to avoid logging.
						// TODO: Should we show a hint above the Wyrm?
						'',
						this.creature, // Caster
						this.creature, // Target
						'', // Trigger
						{
							alterations: {
								regrowth: 10,
							},
						},
						G,
					);

					this.creature.addEffect(
						regrowthBuffEffect,
						// TODO: What should this say?
						`%CreatureName${this.creature.id}% is brimming with health`,
					);
				}
			},

			/**
			 * Determine the area of effect to query and activate the ability. The area
			 * of effect is the 3 hexes to the front of the creature:
			 * ⬡⬢
			 *  👹⬢
			 * ⬡⬢
			 *
			 * @returns Refer to HexGrid.getHexMap()
			 */
			_getHexes() {
				return this.creature.getHexMap(matrices.front1hex);
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
