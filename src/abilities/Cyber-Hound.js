import { Damage } from "../damage";
import { Team } from "../utility/team";
import * as matrices from "../utility/matrices";
import * as arrayUtils from "../utility/arrayUtils";
import { Creature } from "../creature";
import { isTeam } from "../utility/team";

/**
 * Creates the abilities
 * @param {Object} G the game object 
 */
export default (G) => {
	G.abilities[31] = [

		// 	First Ability: Bad Doggie
		{
			triggerFunc: function () {
				// When upgraded, trigger both at start and end of turn
				// Otherwise just trigger at start
				if (this.isUpgraded()) {
					return "onStartPhase onEndPhase";
				}
				return "onStartPhase";
			},

			require: function () {
				// Check requirements in activate() so the ability is always highlighted
				return this.testRequirements();
			},

			activate: function () {
				// Check if there's an enemy creature in front
				var hexesInFront = this.creature.getHexMap(matrices.inlinefront2hex);
				if (hexesInFront.length < 1) return;
				var target = hexesInFront[0].creature;
				if (!target) return;
				if (!isTeam(this.creature, target, Team.enemy)) {
					return;
				}

				this.end();

				var damage = new Damage(
					this.creature, // Attacker
					this.damages, // Damage Type
					1, // Area
					[], // Effects
					G
				);
				target.takeDamage(damage);

				// Keep highlighted in UI
				this.setUsed(false);
			},
		},



		// 	Second Ability: Metal Hand
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: "onQuery",

			_targetTeam: Team.enemy,

			// 	require() :
			require: function () {
				if (!this.testRequirements()) return false;

				if (!this.atLeastOneTarget(
					this.creature.getHexMap(matrices.frontnback2hex), {
						team: this._targetTeam
					})) {
					return false;
				}
				return true;
			},

			// 	query() :
			query: function () {

				var ability = this;
				var crea = this.creature;

				G.grid.queryCreature({
					fnOnConfirm: function () {
						ability.animation.apply(ability, arguments);
					}, // fnOnConfirm
					team: this._targetTeam,
					id: crea.id,
					flipped: crea.player.flipped,
					hexes: crea.getHexMap(matrices.frontnback2hex)
				});
			},


			//	activate() :
			activate: function (target, args) {
				var ability = this;
				ability.end();

				var damage = new Damage(
					ability.creature, // Attacker
					ability.damages, // Damage Type
					1, // Area
					[], // Effects
					G
				);
				target.takeDamage(damage);

				// If upgrade, also steal up to 8 energy
				if (this.isUpgraded()) {
					var energySteal = Math.min(8, target.energy);
					target.energy -= energySteal;
					this.creature.recharge(energySteal);
					G.log("%CreatureName" + this.creature.id + "% steals " + energySteal +
						" energy from %CreatureName" + target.id + "%");
				}
			},
		},



		// 	Third Ability: Rocket Launcher
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: "onQuery",

			require: function () {
				// Recalculate energy requirements/costs based on whether this is ugpraded
				if (this.isUpgraded()) {
					this.requirements = {
						energy: 30
					};
					this.costs = {
						energy: 30
					};
				} else {
					this.requirements = {
						energy: 40
					};
					this.costs = {
						energy: 40
					};
				}
				return this.testRequirements();
			},

			// 	query() :
			query: function () {

				var ability = this;
				var crea = this.creature;

				var straitrow = matrices.straitrow;
				var bellowrow = matrices.bellowrow;

				var choices = [
					//Front
					arrayUtils.filterCreature(G.grid.getHexMap(crea.x, crea.y - 2, 0, false, bellowrow), true, true, crea.id).concat(
						arrayUtils.filterCreature(G.grid.getHexMap(crea.x, crea.y, 0, false, straitrow), true, true, crea.id),
						arrayUtils.filterCreature(G.grid.getHexMap(crea.x, crea.y, 0, false, bellowrow), true, true, crea.id)),
					//Behind
					arrayUtils.filterCreature(G.grid.getHexMap(crea.x - 1, crea.y - 2, 0, true, bellowrow), true, true, crea.id).concat(
						arrayUtils.filterCreature(G.grid.getHexMap(crea.x - 1, crea.y, 0, true, straitrow), true, true, crea.id),
						arrayUtils.filterCreature(G.grid.getHexMap(crea.x - 1, crea.y, 0, true, bellowrow), true, true, crea.id))
				];

				choices[0].choiceId = 0;
				choices[1].choiceId = 1;

				G.grid.queryChoice({
					fnOnCancel: function () {
						G.activeCreature.queryMove();
						G.grid.clearHexViewAlterations();
					},
					fnOnConfirm: function () {
						ability.animation.apply(ability, arguments);
					},
					team: Team.both,
					id: crea.id,
					requireCreature: false,
					choices: choices
				});
			},


			//	activate() :
			activate: function (choice, args) {
				var ability = this;
				ability.end();

				var crea = this.creature;

				var straitrow = matrices.straitrow;
				var bellowrow = matrices.bellowrow;

				var rows;
				if (choice.choiceId === 0) {
					// Front
					rows = [
						arrayUtils.filterCreature(G.grid.getHexMap(crea.x, crea.y - 2, 0, false, bellowrow), true, true, crea.id),
						arrayUtils.filterCreature(G.grid.getHexMap(crea.x, crea.y, 0, false, straitrow), true, true, crea.id),
						arrayUtils.filterCreature(G.grid.getHexMap(crea.x, crea.y, 0, false, bellowrow), true, true, crea.id)
					];
				} else {
					// Back
					rows = [
						arrayUtils.filterCreature(G.grid.getHexMap(crea.x - 1, crea.y - 2, 0, true, bellowrow), true, true, crea.id),
						arrayUtils.filterCreature(G.grid.getHexMap(crea.x - 1, crea.y, 0, true, straitrow), true, true, crea.id),
						arrayUtils.filterCreature(G.grid.getHexMap(crea.x - 1, crea.y, 0, true, bellowrow), true, true, crea.id)
					];
				}


				for (var i = 0; i < rows.length; i++) {
					if (rows[i].length === 0 ||
						!(rows[i][rows[i].length - 1].creature instanceof Creature)) {
						//Miss
						this.token += 1;
						continue;
					}

					var target = rows[i][rows[i].length - 1].creature;

					var damage = new Damage(
						ability.creature, //Attacker
						ability.damages, //Damage Type
						1, //Area
						[], //Effects
						G
					);
					target.takeDamage(damage);
				}

				if (this.token > 0) {
					G.log("%CreatureName" + this.creature.id + "% missed " + this.token + " rocket(s)");
				}

				G.UI.checkAbilities();
			},
		},



		// 	Fourth Ability: Target Locking
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: "onQuery",

			// 	require() :
			require: function () {
				if (!this.testRequirements()) return false;

				if (this.creature.abilities[2].token === 0) {
					this.message = "No rocket launched.";
					return false;
				}

				return true;
			},

			// 	query() :
			query: function () {

				var ability = this;
				var crea = this.creature;

				var hexes = G.grid.allhexes.slice(0); // Copy array

				G.grid.queryCreature({
					fnOnConfirm: function () {
						ability.animation.apply(ability, arguments);
					}, // fnOnConfirm
					team: Team.enemy,
					id: crea.id,
					flipped: crea.player.flipped,
					hexes: hexes
				});
			},


			//	activate() :
			activate: function (crea, args) {
				var ability = this;
				ability.end();

				var target = crea;

				// Use all rockets if upgraded, or up to 2 if not
				var rocketLauncherAbility = this.creature.abilities[2];
				var rocketsToUse = rocketLauncherAbility.token;
				if (!this.isUpgraded()) {
					rocketsToUse = Math.min(rocketsToUse, 2);
				}
				rocketLauncherAbility.token -= rocketsToUse;

				// Multiply damage by number of rockets
				var damages = $j.extend({}, rocketLauncherAbility.damages);
				for (var key in damages) {
					damages[key] *= rocketsToUse;
				}

				G.log("%CreatureName" + this.creature.id + "% redirects " + rocketsToUse + " rocket(s)");
				var damage = new Damage(
					ability.creature, // Attacker
					damages, // Damage Type
					1, // Area
					[], // Effects
					G
				);
				target.takeDamage(damage);
			}
		}
	];
};