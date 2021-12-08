import { Damage } from '../damage';
import { Team } from '../utility/team';
import * as matrices from '../utility/matrices';
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
			require: () => {
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
			activate: () => {
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
				hits.forEach((hit) => {
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
			require: () => {
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
			query: () => {
				let wyrm = this.creature;

				let map = [
					[0, 0, 0, 0],
					[0, 1, 0, 1],
					[1, 0, 0, 1], //origin line
					[0, 1, 0, 1],
				];

				G.grid.queryCreature({
					fnOnConfirm: (...args) => {
						this.animation(...args);
					},
					team: this._targetTeam,
					id: wyrm.id,
					flipped: wyrm.flipped,
					hexes: G.grid.getHexMap(wyrm.x - 2, wyrm.y - 2, 0, false, map),
				});
			},

			//	activate() :
			activate: function (target) {
				this.end();

				let damage = new Damage(
					this.creature, // Attacker
					this.damages, // Damage Type
					1, // Area
					[], // Effects
					G,
				);

				let dmg = target.takeDamage(damage);

				if (dmg.status == '') {
					// Regrowth bonus
					this.creature.addEffect(
						new Effect(
							'Regrowth++', // Name
							this.creature, // Caster
							this.creature, // Target
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
				this.creature.effects.forEach((effect) => {
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

			require: () => {
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
			query: () => {
				let wyrm = this.creature;

				let range = G.grid
					.getFlyingRange(wyrm.x, wyrm.y, 50, wyrm.size, wyrm.id)
					.filter((item) => wyrm.item == item.y);

				G.grid.queryHexes({
					fnOnSelect: (...args) => {
						this.fnOnSelect(...args);
					},
					fnOnConfirm: (...args) => {
						this.animation(...args);
					},
					size: wyrm.size,
					flipped: wyrm.player.flipped,
					id: wyrm.id,
					hexes: range,
				});
			},

			//	activate() :
			activate: function (hex) {
				this.end();

				this.creature.moveTo(hex, {
					ignoreMovementPoint: true,
					ignorePath: true,
					callback: () => {
						G.activeCreature.queryMove();
					},
				});

				// Frogger Leap bonus
				this.creature.addEffect(
					new Effect(
						'Offense++', // Name
						this.creature, // Caster
						this.creature, // Target
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

		// 	Fourth Ability: Battle Cry
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			damages: {
				pierce: 15,
				slash: 10,
				crush: 5,
			},
			_targetTeam: Team.enemy,

			// 	require() :
			require: () => {
				if (!this.testRequirements()) {
					return false;
				}

				let map = G.grid.getHexMap(
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

			// 	query() :
			query: () => {
				let wyrm = this.creature;

				G.grid.queryCreature({
					fnOnConfirm: (...args) => {
						this.animation(...args);
					},
					team: this._targetTeam,
					id: wyrm.id,
					flipped: wyrm.flipped,
					hexes: G.grid.getHexMap(wyrm.x - 2, wyrm.y - 2, 0, false, matrices.frontnback2hex),
				});
			},

			//	activate() :
			activate: function (target) {
				this.end();

				let damage = new Damage(
					this.creature, // Attacker
					this.damages, // Damage Type
					1, // Area
					[], // Effects
					G,
				);
				target.takeDamage(damage);

				//remove frogger bonus if its found
				this.creature.effects.forEach((item) => {
					if (item.name == 'Offense++') {
						item.deleteEffect();
					}
				});
			},
		},
	];
};
