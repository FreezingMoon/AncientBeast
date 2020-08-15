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

			_targetTeam: Team.enemy,

			_upgradedMap: [
				[0, 1, 0, 0, 0, 1, 0, 0],
				[0, 0, 1, 0, 0, 1, 0, 0],
				[0, 0, 1, 0, 1, 0, 0, 0],
				[1, 1, 1, 0, 0, 1, 1, 1], // Origin line
				[0, 0, 1, 0, 1, 0, 0, 0],
				[0, 0, 1, 0, 0, 1, 0, 0],
				[0, 1, 0, 0, 0, 1, 0, 0],
			],

			// require() :
			require: function () {
				let req = {
					team: this._targetTeam,
					sourceCreature: this.creature,
					distance: 3,
				};

				if (!this.testRequirements() || !this.testDirection(req)) {
					return false;
				}

				return true;
			},

			// query() :
			query: function () {
				let stomper = this.creature;
				let ability = this;

				// Take the closest ennemy in each direction within 3hex
				if (!this.isUpgraded()) {
					G.grid.queryDirection({
						fnOnConfirm: function () {
							ability.animation(...arguments);
						},
						flipped: stomper.flipped,
						team: this._targetTeam,
						id: stomper.id,
						requireCreature: true,
						x: stomper.x,
						y: stomper.y,
						distance: 3,
						sourceCreature: stomper,
					});
				} // Once upgraded, can hit any ennemy within 3hex in any direction
				else {
					this._upgradedMap.origin = [3, 3];
					G.grid.queryCreature({
						fnOnConfirm: function () {
							ability.animation(...arguments);
						},
						team: this._targetTeam,
						id: stomper.id,
						flipped: stomper.flipped,
						hexes: stomper.getHexMap(this._upgradedMap),
					});
				}
			},

			// activate() :
			activate: function (target) {
				let ability = this;
				ability.end();

				// If not upgraded take the first creature found (aka last in path)
				if (!this.isUpgraded()) {
					target = arrayUtils.last(target).creature;
				}

				let damage = new Damage(
					ability.creature, // Attacker
					ability.damages, // Damage type
					1, // Area
					[], // Effects
					G,
				);

				target.takeDamage(damage);
			},
		},

		// Third Ability: Stone Grinder
		{
			// Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			// Hit both team in a straight line but require at least one melee target
			_req: {
				team: Team.both,
				directions: [0, 1, 0, 0, 1, 0],
				distance: 1,
			},

			// require() :
			require: function () {
				this._req.sourceCreature = this.creature;
				if (!this.testRequirements() || !this.testDirection(this._req)) {
					return false;
				}
				return true;
			},

			// query() :
			query: function () {
				let ability = this;
				let stomper = this.creature;
				// Get the direction of the melee target
				let direction = ability.testDirections(ability._req);

				// Get a straight line in the direction of the target (front, back or both)
				G.grid.queryDirection({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					flipped: stomper.player.flipped,
					team: Team.both,
					id: stomper.id,
					requireCreature: true,
					x: stomper.x,
					y: stomper.y,
					directions: direction,
					stopOnCreature: false,
					sourceCreature: stomper,
				});
			},

			// activate() :
			activate: function (hexes) {
				let ability = this;
				let i = 0,
					stop = 0;
				let targets = [];
				ability.end();

				// Add target to the array as long as there isn't 2 empty hex
				while (i < hexes.length && stop < 2) {
					let crea = hexes[i].creature;

					if (crea !== undefined) {
						targets.push(crea);
						i += crea.size;
						stop = 0;
					} else {
						i++;
						stop++;
					}
				}

				let damage = new Damage(
					ability.creature, // Attacker
					ability.damages, // Damage type
					1, // Area
					[], // Effects
					G,
				);

				for (i = 0; i < targets.length; i++) {
					targets[i].takeDamage(damage);
					// Stop the ability if it's not upgraded and a 2hex "hole" is created
					if (
						!ability.isUpgraded() &&
						targets[i].dead === true &&
						(targets[i].size > 1 ||
							G.grid.hexes[targets[i].y][targets[i].x - 1].creature === undefined ||
							G.grid.hexes[targets[i].y][targets[i].x + 1].creature === undefined)
					) {
						break;
					}
				}
			},
		},

		// Fourth Ability: Earth Shaker
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
						target.dizzy = true;
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
	];
};
