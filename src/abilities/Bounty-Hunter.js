import { Damage } from '../damage';
import { Team, isTeam } from '../utility/team';
import * as matrices from '../utility/matrices';
import * as arrayUtils from '../utility/arrayUtils';
import { Creature } from '../creature';
import { Effect } from '../effect';

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */

export default (G) => {
	G.abilities[1] = [
		/** First Ability:
		 * Passive:
		 * Personal Space:
		 * Gains bonus stat points if there is an adjacent enemy unit when turn starts.
		 * 50% offense and movement increase.
		 * Upgrade: Bonus is increased to 100%.
		 */
		{
			trigger: 'onStartPhase',

			_effectName: 'PersonalSpaceActivated', //name of the status

			getBuff: function () {
				//decides how many much the base value is modified by the buff, 50% if not upgraded and 100% if upgraded
				if (this.isUpgraded()) {
					return 1;
				} else return 0.5;
			},

			require: function () {
				// Check requirements in activate() so the ability is always highlighted
				return this.testRequirements();
			},

			activate: function () {
				//check if there's any enemy next to Bounty Hunter
				let hexesAllAround = this.creature.getHexMap(matrices.allaround1hex);
				if (hexesAllAround.length < 1) {
					return;
				}
				let target = hexesAllAround[0].creature;
				if (!target) {
					return;
				}
				if (!isTeam(this.creature, target, Team.Enemy)) {
					return;
				}

				this.end();

				this.creature.addEffect(
					new Effect(
						this._effectName,
						this.creature,
						this.creature,
						'',
						{
							alterations: {
								movement: this.creature.stats.movement * this.getBuff,
								offense: this.creature.stats.offense * this.getBuff,
							},
							deleteTrigger: 'onStartPhase',
							turnLifetime: 1,
						},
						G,
					),
				);
			},
		},
	];
};
