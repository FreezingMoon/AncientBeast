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

			_directions: [0, 0, 0, 0, 0, 0],

			// Return an array of dashed hex
			_getDashed: function (direction) {
				let stomper = this.creature;

				let hexes;

				if (!direction[4]) {
					hexes = G.grid.getHexMap(
						stomper.x,
						stomper.y,
						0,
						stomper.player.flipped,
						matrices.straitrow,
					);
				} else if (!direction[1]) {
					hexes = G.grid.getHexMap(
						stomper.x,
						stomper.y,
						0,
						!stomper.player.flipped,
						matrices.straitrow,
					);
				} else {
					let forward = G.grid.getHexMap(
						stomper.x,
						stomper.y,
						0,
						stomper.player.flipped,
						matrices.straitrow,
					);
					let backward = G.grid.getHexMap(
						stomper.x,
						stomper.y,
						0,
						!stomper.player.flipped,
						matrices.straitrow,
					);
					hexes = forward.concat(backward);
				}

				return hexes;
			},

			// Return an array of all reachable targets'
			_getTarget: function (direction) {
				let ability = this;
				let stomper = this.creature;

				let fw = stomper.player.flipped ? stomper.x - 2 : stomper.x + 1;
				let bw = stomper.player.flipped ? stomper.x + 1 : stomper.x - 2;
				let targets = [];

				if (!direction[4]) {
					targets.push(
						...ability._getCreature(G.grid.getHexLine(fw, stomper.y, 1, stomper.player.flipped)),
					);
				} else if (!direction[1]) {
					targets.push(
						...ability._getCreature(G.grid.getHexLine(bw, stomper.y, 4, stomper.player.flipped)),
					);
				} else {
					targets.push(
						...ability._getCreature(G.grid.getHexLine(fw, stomper.y, 1, stomper.player.flipped)),
					);
					targets.push(
						...ability._getCreature(G.grid.getHexLine(bw, stomper.y, 4, stomper.player.flipped)),
					);
				}

				return targets;
			},

			// Add target's hex to the array as long as there isn't 2 empty hex
			_getCreature: function (hexes) {
				let targets = [];
				let i = 0,
					stop = 0;
				while (i < hexes.length && stop < 2) {
					let crea = hexes[i].creature;

					if (crea !== undefined) {
						for (let j = 0; j < crea.size; j++) {
							targets.push(G.grid.hexes[crea.y][crea.x - j]);
						}
						i += crea.size;
						stop = 0;
					} else {
						i++;
						stop++;
					}
				}
				return targets;
			},

			// Check if there is a possible place to end the ability
			_checkEnd: function () {
				let ability = this;
				let stomper = this.creature;
				let direction = ability.testDirections(ability._req);
				let hexes;

				ability._directions = [0, 0, 0, 0, 0, 0];

				let fw = stomper.player.flipped ? stomper.x - 2 : stomper.x + 1;
				let bw = stomper.player.flipped ? stomper.x + 1 : stomper.x - 2;

				if (!direction[4]) {
					hexes = G.grid.getHexLine(fw, stomper.y, 1, stomper.player.flipped);
					if (this._getHole(hexes)) ability._directions = direction;
				} else if (!direction[1]) {
					hexes = G.grid.getHexLine(bw, stomper.y, 4, stomper.player.flipped);
					if (this._getHole(hexes)) ability._directions = direction;
				} else {
					let forward = G.grid.getHexLine(fw, stomper.y, 1, stomper.player.flipped);
					let backward = G.grid.getHexLine(bw, stomper.y, 4, stomper.player.flipped);
					if (this._getHole(forward)) ability._directions[1] = 1;
					if (this._getHole(backward)) ability._directions[4] = 1;
				}
			},

			// Return true if there is at least one 2hex hole in the array of hexes
			_getHole: function (hexes) {
				let i = 0,
					stop = 0;
				while (i < hexes.length && stop < 2) {
					if (hexes[i].creature === undefined) {
						stop++;
					} else {
						stop = 0;
					}
					i++;
				}
				return stop >= 2;
			},

			// require() :
			require: function () {
				let ability = this;
				ability._req.sourceCreature = ability.creature;

				ability._checkEnd();

				if (!ability.testRequirements() || (!ability._directions[1] && !ability._directions[4])) {
					return false;
				}
				return true;
			},

			// query() :
			query: function () {
				let ability = this;
				let stomper = this.creature;
				// Get the direction of the melee target, the dashed hex and the targets
				let direction = ability._directions;
				let dashed = ability._getDashed(direction);
				let targets = ability._getTarget(direction);

				// Separate the front and back row of targets
				let targets2 = [];
				if (direction[1] && direction[4]) {
					targets2 = targets.filter((crea) => crea.x < stomper.x);
					targets2.forEach((hex) => {
						targets.splice(
							targets.findIndex((i) => i.coord === hex.coord),
							1,
						);
					});
				}

				G.grid.queryChoice({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					team: Team.both,
					requireCreature: 0,
					id: stomper.id,
					flipped: stomper.flipped,
					choices: [targets, targets2], // Target the front or back row
					hexesDashed: dashed,
				});
			},

			// activate() :
			activate: function (hexes) {
				let ability = this;
				let stomper = this.creature;
				let i = 0;
				ability.end();

				let targets = ability.getTargets(hexes);

				let lastTarget = targets[targets.length - 1].target;
				let offset = null;

				console.log(targets);
				for (i = 0; i < targets.length; i++) {
					let target = targets[i].target;

					let damage = new Damage(
						ability.creature, // Attacker
						ability.damages, // Damage type
						1, // Area
						[], // Effects
						G,
					);
					// Apply damage on all hexes
					for (let j = 0; j < target.size; j++) {
						target.takeDamage(damage);
						if (target.dead === true) {
							break;
						}
					}

					// Stop the ability if it's not upgraded and a 2hex "hole" is created
					if (
						!ability.isUpgraded() &&
						target.dead === true &&
						(target.size > 1 ||
							G.grid.hexes[target.y][target.x - 1].creature === undefined ||
							G.grid.hexes[target.y][target.x + 1].creature === undefined)
					) {
						// Set the new last target for the movement
						if (i > 0) {
							lastTarget = targets[i - 1].target;
						} else {
							lastTarget = target;
							offset = 0;
						}
						break;
					}
				}
				// Offset for the landing position
				if (offset === null) {
					offset = lastTarget.x >= stomper.x ? 2 : -lastTarget.size;
				}

				// Jump directly to hex
				ability.creature.moveTo(G.grid.hexes[stomper.y][lastTarget.x + offset], {
					ignoreMovementPoint: true,
					ignorePath: true,
					callback: function () {
						// Shake the screen upon landing to simulate the jump
						G.Phaser.camera.shake(0.02, 100, true, G.Phaser.camera.SHAKE_VERTICAL, true);

						G.onStepIn(ability.creature, ability.creature.hexagons[0]);

						let interval = setInterval(function () {
							if (!G.freezedInput) {
								clearInterval(interval);
								G.UI.selectAbility(-1);
								G.activeCreature.queryMove();
							}
						}, 100);
					},
				});
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
