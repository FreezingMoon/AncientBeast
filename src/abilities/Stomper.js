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
	G.abilities[28] = [
		//  First Ability: Tankish Build
		{
			// Type : Can be "onQuery", "onStartPhase", "onDamage"
			triggerFunc: function () {
				if (this.isUpgraded()) {
					// Once upgraded add the trigger to disable the bonus if hit
					return 'onStartPhase onDamage';
				}
				return 'onStartPhase';
			},

			_defenseBuff: 0, // Total bonus defense

			_maxDefenseBuff: 40, // Cap of the bonus

			_damageTaken: false, // Condition once upgraded

			_getDefenseBuff: function (defenseBuff) {
				if (this._defenseBuff >= 39) {
					this._defenseBuff = 40;
				} else {
					this.isUpgraded() && !this._damageTaken
						? (this._defenseBuff += 2)
						: (this._defenseBuff += 1);
				}
				return this._defenseBuff;
			},

			// require() :
			require: function (damage) {
				if (!damage) {
					// If the ability is called without taking damage (a.k.a at the start of the round)
					return true; // Activate the ability
				} else {
					// If it's called by damage once upgraded
					this._damageTaken = true; // Change the _damageTaken to true
					return false; // But don't activate the ability
				}
			},

			// activate() :
			activate: function () {
				this.creature.replaceEffect(
					// Add and replace the effect each time
					new Effect(
						'Tankish Build', // Name
						this.creature, // Caster
						this.creature, // Target
						'', // Trigger
						{
							alterations: {
								defense: this._getDefenseBuff(this._defenseBuff), // Add a defense buff
							},
							stackable: false,
						},
						G,
					),
				);
				this._damageTaken = false; // Reset the _damageTaken
			},
		},

		//	Second Ability: Seismic Stomp
		{
			// Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			// require() :
			require: function () {},

			// query() :
			query: function () {},

			// activate() :
			activate: function (target) {},
		},

		// Third Ability: Earth Shaker
		{
			// Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			// The area of the skill
			map: [
				[0, 0, 1, 0],
				[0, 0, 1, 1],
				[0, 1, 1, 0], // Origin line
				[0, 0, 1, 1],
				[0, 0, 1, 0],
			],

			require: function () {
				return this.testRequirements();
			},

			// query() :
			query: function () {
				let ability = this;
				let stomper = this.creature;

				this.map.origin = [0, 2];

				G.grid.queryChoice({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					team: Team.both,
					requireCreature: 0,
					id: stomper.id,
					flipped: stomper.flipped,
					choices: [stomper.getHexMap(this.map), stomper.getHexMap(this.map, true)],
				});
			},

			// activate() :
			activate: function (hexes) {
				let ability = this;
				ability.end(); // Deferred ending

				// Delay all creatures in area
				let targets = ability.getTargets(hexes);
				for (let i = 0; i < targets.length; i++) {
					let target = targets[i].target;

					// If the ability is upgraded and the creature is already delayed, skip the turn
					if (
						ability.isUpgraded() &&
						(target.delayed || target.findEffect('Earth Shaker').length > 0)
					) {
						target.stats.dizzy = true;
						target.removeEffect('Earth Shaker');
					} else {
						target.delay(false);
						target.addEffect(
							new Effect(
								'Earth Shaker', // Name
								this.creature, // Caster
								target, // Target
								'onStartPhase', // Trigger
								{
									// disable the ability to delay this unit as it has already been delayed
									effectFn: () => {
										target.delayed = true;
										target.delayable = false;
									},
									deleteTrigger: 'onEndPhase',
									turnLifetime: 1,
									stackable: false,
								},
								G,
							),
						);
					}
				}
			},
		},

		// Fourth Ability: Stone Grinder
		{
			// Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			// require() :

			require: function () {},

			// query() :
			query: function () {},

			// activate() :
			activate: function (hexes) {},
		},
	];
};
