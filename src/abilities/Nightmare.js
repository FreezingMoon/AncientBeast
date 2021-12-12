import { Damage } from '../damage';
import { Team } from '../utility/team';
import * as matrices from '../utility/matrices';
import { Creature } from '../creature';
import { Effect } from '../effect';

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default (G) => {
	G.abilities[9] = [
		// 	First Ability: Frigid Tower
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onEndPhase',

			_effectName: 'Frostified',

			_getOffenseBuff: () => {
				return this.isUpgraded() ? 5 : 0;
			},

			// 	require() :
			require: function () {
				// Check whether this ability is upgraded; if so then make sure all existing
				// buffs include an offense buff
				this.creature.effects.forEach((effect) => {
					if (effect.name === this._effectName) {
						effect.alterations.offense = this._getOffenseBuff();
					}
				});

				if (this.creature.remainingMove < this.creature.stats.movement) {
					this.message = 'The creature moved this round.';
					return false;
				}
				return this.testRequirements();
			},

			//	activate() :
			activate: function () {
				this.creature.addEffect(
					new Effect(
						this._effectName,
						this.creature,
						this.creature,
						'',
						{
							alterations: {
								frost: 5,
								defense: 5,
								offense: this._getOffenseBuff(),
							},
							stackable: true,
						},
						G,
					),
				);
			},
		},

		// 	Second Ability: Icy Talons
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			_targetTeam: Team.enemy,

			// 	require() :
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

			// 	query() :
			query: function () {
				G.grid.queryCreature({
					fnOnConfirm: (...args) => {
						this.animation(...args);
					},
					team: this._targetTeam,
					id: this.creature.id,
					flipped: this.creature.flipped,
					hexes: this.creature.getHexMap(matrices.frontnback2hex),
				});
			},

			//	activate() :
			activate: function (target) {
				this.end();

				// Upgraded ability does pierce damage to smaller size targets
				let damages = this.damages;
				if (!this.isUpgraded() || !(target.size < this.creature.size)) {
					damages.pierce = 0;
				}

				let damage = new Damage(
					this.creature, // Attacker
					damages, // Damage Type
					1, // Area
					[
						new Effect(
							this.title,
							this.creature,
							this.target,
							'',
							{
								alterations: {
									frost: -1,
								},
								stackable: true,
							},
							G,
						),
					], // Effects
					G,
				);

				target.takeDamage(damage);
			},
		},

		// 	Third Ability: Sudden Uppercut
		{
			//	Type : Can be "onQuery","onStartPhase","onDamage"
			trigger: 'onQuery',

			_targetTeam: Team.enemy,

			// 	require() :
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

			// 	query() :
			query: function () {
				G.grid.queryCreature({
					fnOnConfirm: (...args) => {
						this.animation(...args);
					},
					team: this._targetTeam,
					id: this.creature.id,
					flipped: this.creature.flipped,
					hexes: this.creature.getHexMap(matrices.frontnback2hex),
				});
			},

			//	activate() :
			activate: function (target) {
				this.end();

				let effects = [];
				// Upgraded ability adds a -10 defense debuff
				if (this.isUpgraded()) {
					effects.push(
						new Effect(
							this.title,
							this.creature,
							target,
							'',
							{
								alterations: {
									defense: -10,
								},
								stackable: true,
								turnLifetime: 1,
								deleteTrigger: 'onStartPhase',
							},
							G,
						),
					);
				}
				let damage = new Damage(
					this.creature, // Attacker
					this.damages, // Damage Type
					1, // Area
					effects,
					G,
				);

				let result = target.takeDamage(damage);

				if (result.kill || result.damageObj.status !== '') {
					return;
				}

				target.delay();
			},
		},

		// 	Fourth Ability: Icicle Spear
		{
			//	Type : Can be "onQuery","onStartPhase","onDamage"
			trigger: 'onQuery',

			directions: [1, 1, 1, 1, 1, 1],
			_targetTeam: Team.both,

			_getDistance: () => {
				// Upgraded ability has infinite range
				return this.isUpgraded() ? 0 : 6;
			},

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				let crea = this.creature;
				let x = crea.player.flipped ? crea.x - crea.size + 1 : crea.x;

				if (
					!this.testDirection({
						team: this._targetTeam,
						x: x,
						directions: this.directions,
						distance: this._getDistance(),
						stopOnCreature: false,
					})
				) {
					return false;
				}
				return true;
			},

			// 	query() :
			query: function () {
				let crea = this.creature;

				let x = crea.player.flipped ? crea.x - crea.size + 1 : crea.x;

				G.grid.queryDirection({
					fnOnConfirm: (...args) => {
						this.animation(...args);
					},
					team: this._targetTeam,
					id: crea.id,
					requireCreature: true,
					x: x,
					y: crea.y,
					directions: this.directions,
					distance: this._getDistance(),
					stopOnCreature: false,
				});
			},

			//	activate() :
			activate: (path) => {
				this.end();

				for (let i = 0; i < path.length; i++) {
					if (path[i].creature instanceof Creature) {
						let trg = path[i].creature;

						let d = {
							pierce: this.damages.pierce,
							frost: 6 - i,
						};
						if (d.frost < 0) {
							d.frost = 0;
						}

						//Damage
						let damage = new Damage(
							this.creature, // Attacker
							d, // Damage Type
							1, // Area
							[], // Effects
							G,
						);

						let result = trg.takeDamage(damage);

						// Stop propagating if no damage dealt
						if (
							result.damageObj.status === 'Shielded' ||
							(result.damages && result.damages.total <= 0)
						) {
							break;
						}
					}
				}
			},
		},
	];
};
