import * as $j from 'jquery';
import { Damage } from '../damage';
import { Team } from '../utility/team';
import * as arrayUtils from '../utility/arrayUtils';
import { Creature } from '../creature';

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default (G) => {
	G.abilities[0] = [
		// 	First Ability: Plasma Field
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onUnderAttack',

			// 	require() :
			require: function () {
				this.creature.protectedFromFatigue = this.testRequirements();
				return this.creature.protectedFromFatigue;
			},

			//	activate() :
			activate: function (damage) {
				if (G.activeCreature.id == this.creature.id) {
					/* only used when unit isn't active */
					return damage; // Return Damage
				}

				if (this.isUpgraded() && damage.melee && !damage.counter) {
					//counter damage
					let counter = new Damage(
						this.creature, // Attacker
						{
							pure: 9,
						}, // Damage Type
						1, // Area
						[], // Effects
						G,
					);
					counter.counter = true;
					G.activeCreature.takeDamage(counter);
				}

				this.creature.player.plasma -= 1;

				this.creature.protectedFromFatigue = this.testRequirements();

				damage.damages = {
					total: 0,
				};
				damage.status = 'Shielded';
				damage.effect = [];

				damage.noLog = true;

				this.end(true); // Disable message

				G.log('%CreatureName' + this.creature.id + '% is protected by Plasma Field');
				return damage; // Return Damage
			},
		},

		// 	Second Ability: Electro Shocker
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
					!this.atLeastOneTarget(this.creature.adjacentHexes(this.isUpgraded() ? 4 : 1), {
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
				let dpriest = this.creature;

				G.grid.queryCreature({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					team: this._targetTeam,
					id: dpriest.id,
					flipped: dpriest.player.flipped,
					hexes: dpriest.adjacentHexes(this.isUpgraded() ? 4 : 1),
				});
			},

			//	activate() :
			activate: function (target) {
				let ability = this;
				ability.end();

				let damageAmount = {
					shock: 12 * target.size,
				};

				let damage = new Damage(
					ability.creature, // Attacker
					damageAmount, // Damage Type
					1, // Area
					[], // Effects
					G,
				);

				target.takeDamage(damage);
			},
		},

		// 	Third Ability: Disruptor Beam
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			_targetTeam: Team.Enemy,

			// 	require() :
			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				let range = this.creature.adjacentHexes(2);

				// At least one target
				if (
					!this.atLeastOneTarget(range, {
						team: this._targetTeam,
					})
				) {
					return false;
				}

				// Search Lowest target cost
				let lowestCost = 99;
				let targets = this.getTargets(range);

				targets.forEach(function (item) {
					if (item.target instanceof Creature) {
						if (lowestCost > item.target.size) {
							lowestCost = item.target.size;
						}
					}
				});

				if (this.creature.player.plasma < lowestCost) {
					this.message = G.msg.abilities.noPlasma;
					return false;
				}

				return true;
			},

			// 	query() :
			query: function () {
				let ability = this;
				let dpriest = this.creature;

				G.grid.queryCreature({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					optTest: function (creature) {
						return creature.size <= dpriest.player.plasma;
					},
					team: this._targetTeam,
					id: dpriest.id,
					flipped: dpriest.player.flipped,
					hexes: dpriest.adjacentHexes(2),
				});
			},

			//	activate() :
			activate: function (target) {
				let ability = this;
				ability.end();

				let plasmaCost = target.size;
				let damage = target.baseStats.health - target.health;

				if (this.isUpgraded() && damage < 40) {
					damage = 40;
				}

				ability.creature.player.plasma -= plasmaCost;

				damage = new Damage(
					ability.creature, // Attacker
					{
						pure: damage,
					}, // Damage Type
					1, // Area
					[], // Effects
					G,
				);

				ability.end();

				target.takeDamage(damage);
			},
		},

		// 	Fourth Ability: Godlet Printer
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			// 	require() :
			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				if (this.creature.player.plasma <= 1) {
					this.message = G.msg.abilities.noPlasma;
					return false;
				}
				if (this.creature.player.getNbrOfCreatures() == G.creaLimitNbr) {
					this.message = G.msg.abilities.noPsy;
					return false;
				}
				return true;
			},

			summonRange: 4,

			// 	query() :
			query: function () {
				if (this.isUpgraded()) {
					this.summonRange = 6;
				}

				// Ask the creature to summon
				G.UI.materializeToggled = true;
				G.UI.toggleDash('randomize');
			},

			fnOnSelect: function (hex, args) {
				let crea = G.retrieveCreatureStats(args.creature);
				G.grid.previewCreature(hex.pos, crea, this.creature.player);
			},

			// Callback function to queryCreature
			materialize: function (creature) {
				let crea = G.retrieveCreatureStats(creature);
				let ability = this;
				let dpriest = this.creature;

				const creatureHasMaterializationSickness =
					dpriest.player.summonCreaturesWithMaterializationSickness;

				// Removes temporary Creature from queue when Player chooses a
				// different Creature to materialize
				G.queue.removeTempCreature();

				// Create full temporary Creature with placeholder position to show in queue
				crea = $j.extend(
					crea,
					{ x: 3, y: 3 },
					{ team: this.creature.player.id },
					{ temp: true },
					{ materializationSickness: creatureHasMaterializationSickness },
				);
				let fullCrea = new Creature(crea, G);
				// Don't allow temporary Creature to take up space
				fullCrea.cleanHex();
				// Make temporary Creature invisible
				fullCrea.sprite.alpha = 0;

				// Provide full Creature to Queue
				G.queue.tempCreature = fullCrea;

				// Show temporary Creature in queue
				G.queue.addByInitiative(fullCrea, !creatureHasMaterializationSickness);
				G.updateQueueDisplay();

				// Reduce temporary Creature vignette transparency
				let creatureVignette = $j("div[creatureid='" + fullCrea.id + "']");
				creatureVignette.css({ opacity: 0.5 });

				G.grid.forEachHex(function (hex) {
					hex.unsetReachable();
				});

				let spawnRange = dpriest.hexagons[0].adjacentHex(this.summonRange);

				spawnRange.forEach(function (item) {
					item.setReachable();
				});

				spawnRange = spawnRange.filter(function (item) {
					return item.isWalkable(crea.size, 0, false);
				});

				spawnRange = arrayUtils.extendToLeft(spawnRange, crea.size, G.grid);

				G.grid.queryHexes({
					fnOnSelect: function () {
						ability.fnOnSelect(...arguments);
					},
					fnOnCancel: function () {
						G.activeCreature.queryMove();
					},
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					args: {
						creature: creature,
						cost: crea.size - 0 + (crea.level - 0),
					}, // OptionalArgs
					size: crea.size,
					flipped: dpriest.player.flipped,
					hexes: spawnRange,
				});
			},

			//	activate() :
			activate: function (hex, args) {
				let creature = args.creature;
				let ability = this;

				let pos = {
					x: hex.x,
					y: hex.y,
				};

				ability.creature.player.plasma -= args.cost;

				//TODO: Make the UI show the updated number instantly

				ability.end(false, true);

				ability.creature.player.summon(creature, pos);
				let crea = G.creatures.pop();
				crea.id--;
				G.creatures[crea.id] = crea;
				G.creatureIdCounter--;
				ability.creature.queryMove();
			},
		},
	];
};
