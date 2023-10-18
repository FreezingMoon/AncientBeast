import { Damage } from '../damage';
import { Team } from '../utility/team';
import * as matrices from '../utility/matrices';
import * as arrayUtils from '../utility/arrayUtils';
import { Effect } from '../effect';
import Game from '../game';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import { Trap } from '../utility/trap';

/*
 *TODO
 *
 * Fix ts-error 2554: Need to properly type the `on<Trigger>` functions in `game.ts`.
 * This can be done once all the `abilities` files are converted to TS.
 *
 * Fix eslint errors: prefer rest params
 */

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default (G: Game) => {
	/*
	 *
	 *	Bounty Hunter abilities
	 * NOTICE: Abilities 3 and 4 are placeholders from Swine-Thug, they are there so the game doesn't break during testing
	 */
	G.abilities[1] = [
		/** First Ability:
		 * Passive:
		 * Personal Space:
		 * Gains bonus stat points if there is an adjacent enemy unit when turn starts.
		 * 50% offense and movement increase.
		 * Upgrade: Bonus is increased to 100%.
		 */
		//TODO: Bug: Currently the movement buff is applied on the next turn instead
		{
			trigger: 'onStartPhase',

			require: function () {
				// Ability will only be triggered if enemy is in range rather
				if (!this.atLeastOneTarget(this.creature.adjacentHexes(1), { team: Team.Enemy })) {
					return false;
				}

				return true;
			},
			mbuff: 0,
			obuff: 0,
			abilityName: '',

			getMovementBuff: function () {
				// Decides how much the base value is modified by the buff, 50% if not upgraded and 100% if upgraded
				if (!this.atLeastOneTarget(this.creature.adjacentHexes(1), { team: Team.Enemy })) {
					this.mbuff = 0;
					return this.mbuff;
				}
				if (this.isUpgraded()) {
					this.mbuff = 2;
					return this.mbuff;
				}
				this.mbuff = 1;
				return this.mbuff;
			},

			getOffenseBuff: function () {
				// Decides how much the base value is modified by the buff, 50% if not upgraded and 100% if upgraded
				if (!this.atLeastOneTarget(this.creature.adjacentHexes(1), { team: Team.Enemy })) {
					this.obuff = 0;
					return this.obuff;
				}
				if (this.isUpgraded()) {
					this.obuff = 12;
					return this.obuff;
				}
				this.obuff = 6;
				return this.obuff;
			},

			activate: function () {
				if (true) {
					this.creature.replaceEffect(
						new Effect(
							'Enemy In Personal Space!', // Ability name
							this.creature, // Caster
							this.creature, // Target
							'', // Trigger
							{
								alterations: {
									movement: this.getMovementBuff(this.mbuff),
									offense: this.getOffenseBuff(this.obuff),
								},
								stackable: false,
								deleteTrigger: 'onEndPhase',
								turnLifetime: 1,
							},
							G,
						),
					);
				}
			},
		},

		/** Second Ability:
		 * Sword Slitter
		 * Attacks adjacent enemy unit
		 * Does 15 slash + 10 pierce damage
		 */
		{
			trigger: 'onQuery',

			_targetTeam: Team.Enemy,

			require: function () {
				// Checks if there is an enemy creature nearby
				if (!this.testRequirements()) {
					return false;
				}
				if (!this.atLeastOneTarget(this.creature.adjacentHexes(1), { team: this._targetTeam })) {
					return false;
				}
				return true;
			},

			//query():
			query: function () {
				const ability = this;
				const crea = this.creature;

				G.grid.queryCreature({
					fnOnConfirm: function () {
						// eslint-disable-next-line
						ability.animation(...arguments);
					},
					team: this._targetTeam,
					id: crea.id,
					flipped: crea.player.flipped,
					hexes: crea.adjacentHexes(1),
				});
			},

			//activate():
			activate: function (target: Creature) {
				const targetOriginalHealth = target.health;

				const ability = this;
				ability.end();
				G.Phaser.camera.shake(0.01, 150, true, G.Phaser.camera.SHAKE_HORIZONTAL, true);

				const damage = new Damage(
					ability.creature, // Attacker
					ability.damages, // Damage Type
					1, // Area
					[], // Effects
					G,
				);
				target.takeDamage(damage);
				/** damage dealt is original health - current health
				 * if current health is lower than damage dealt,
				 * and the ability is upgraded,
				 * make a second attack
				 */
				if (targetOriginalHealth - target.health >= target.health && this.isUpgraded()) {
					target.takeDamage(damage);
				}
			},
		},

		// 	Third Ability: Ground Ball
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			_targetTeam: Team.Enemy,

			// 	require() :
			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				const bellowrow = matrices.bellowrow;
				const straitrow = matrices.straitrow;

				const swine = this.creature;
				const hexes = arrayUtils
					.filterCreature(
						G.grid.getHexMap(swine.x, swine.y - 2, 0, false, bellowrow),
						true,
						true,
						swine.id,
					)
					.concat(
						arrayUtils.filterCreature(
							G.grid.getHexMap(swine.x, swine.y, 0, false, straitrow),
							true,
							true,
							swine.id,
						),
						arrayUtils.filterCreature(
							G.grid.getHexMap(swine.x, swine.y, 0, false, bellowrow),
							true,
							true,
							swine.id,
						),
						arrayUtils.filterCreature(
							G.grid.getHexMap(swine.x, swine.y - 2, 0, true, bellowrow),
							true,
							true,
							swine.id,
						),
						arrayUtils.filterCreature(
							G.grid.getHexMap(swine.x, swine.y, 0, true, straitrow),
							true,
							true,
							swine.id,
						),
						arrayUtils.filterCreature(
							G.grid.getHexMap(swine.x, swine.y, 0, true, bellowrow),
							true,
							true,
							swine.id,
						),
					);
				if (
					!this.atLeastOneTarget(hexes, {
						team: this._targetTeam,
					})
				) {
					return false;
				}

				return true;
			},

			// 	query() :
			query: function () {
				const bellowrow = matrices.bellowrow;
				const straitrow = matrices.straitrow;

				const ability = this;
				const swine = this.creature;

				const choices = [
					// Front
					G.grid.getHexMap(swine.x, swine.y - 2, 0, false, bellowrow),
					G.grid.getHexMap(swine.x, swine.y, 0, false, straitrow),
					G.grid.getHexMap(swine.x, swine.y, 0, false, bellowrow),
					// Behind
					G.grid.getHexMap(swine.x, swine.y - 2, 0, true, bellowrow),
					G.grid.getHexMap(swine.x, swine.y, 0, true, straitrow),
					G.grid.getHexMap(swine.x, swine.y, 0, true, bellowrow),
				];

				choices.forEach(function (choice) {
					arrayUtils.filterCreature(choice, true, true, swine.id);
				});

				G.grid.queryChoice({
					fnOnConfirm: function () {
						// eslint-disable-next-line
						ability.animation(...arguments);
					}, // fnOnConfirm
					team: this._targetTeam,
					requireCreature: 1,
					id: swine.id,
					flipped: swine.player.flipped,
					choices: choices,
				});
			},

			//	activate() :
			activate: function (path) {
				const ability = this;
				ability.end();
				G.Phaser.camera.shake(0.01, 60, true, G.Phaser.camera.SHAKE_HORIZONTAL, true);

				const target = arrayUtils.last(path).creature;

				// If upgraded, hits will debuff target with -1 meditation
				if (this.isUpgraded()) {
					const effect = new Effect(
						'Ground Ball',
						ability.creature,
						target,
						'onDamage',
						{
							alterations: {
								meditation: -1,
							},
						},
						G,
					);
					target.addEffect(effect);
					G.log('%CreatureName' + target.id + "%'s meditation is lowered by 1");
				}

				const damage = new Damage(
					ability.creature, // Attacker
					ability.damages, // Damage Type
					1, // Area
					[], // Effects
					G,
				);
				target.takeDamage(damage);
			},
		},

		// 	Fourth Ability: Mud Bath
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			_energyNormal: 30,
			_energySelfUpgraded: 10,

			require: function () {
				// If ability is upgraded, self cast energy cost is less
				if (this.isUpgraded()) {
					this.requirements = {
						energy: this._energySelfUpgraded,
					};
					this.costs = {
						energy: this._energySelfUpgraded,
					};
				} else {
					this.requirements = {
						energy: this._energyNormal,
					};
					this.costs = {
						energy: this._energyNormal,
					};
				}
				return this.testRequirements();
			},

			// 	query() :
			query: function () {
				const ability = this;
				const swine = this.creature;

				// Check if the ability is upgraded because then the self cast energy cost is less
				const selfOnly = this.isUpgraded() && this.creature.energy < this._energyNormal;

				let hexes = [];
				if (!selfOnly) {
					// Gather all the reachable hexes, including the current one
					hexes = G.grid.getFlyingRange(swine.x, swine.y, 50, 1, 0);
				}
				hexes.push(G.grid.hexes[swine.y][swine.x]);

				G.grid.queryHexes({
					fnOnCancel: function () {
						G.activeCreature.queryMove();
					},
					fnOnConfirm: function () {
						// eslint-disable-next-line
						ability.animation(...arguments);
					},
					hexes: hexes,
					hideNonTarget: true,
				});
			},

			//	activate() :
			activate: function (hex: Hex) {
				const ability = this;
				const swine = this.creature;

				// If upgraded and cast on self, cost is less
				const isSelf = hex.x === swine.x && hex.y === swine.y;
				if (this.isUpgraded() && isSelf) {
					this.requirements = {
						energy: this._energySelfUpgraded,
					};
					this.costs = {
						energy: this._energySelfUpgraded,
					};
				} else {
					this.requirements = {
						energy: this._energyNormal,
					};
					this.costs = {
						energy: this._energyNormal,
					};
				}

				ability.end();

				const effects = [
					new Effect(
						'Slow Down',
						ability.creature,
						hex,
						'onStepIn',
						{
							requireFn: function () {
								if (!this.trap.hex.creature) {
									return false;
								}
								return this.trap.hex.creature.type != 'A1';
							},
							effectFn: function (effect, creatureHexOrDamage) {
								if (creatureHexOrDamage instanceof Creature) {
									creatureHexOrDamage.remainingMove--;
								}
							},
						},
						G,
					),
				];

				new Trap(hex.x, hex.y, 'mud-bath', effects, ability.creature.player, {}, G);
				G.soundsys.playSFX('sounds/mudbath');
				// Trigger trap immediately if on self
				if (isSelf) {
					// onCreatureMove is Spa Goggles' trigger event
					// @ts-expect-error 2554
					G.onCreatureMove(swine, hex);
				}
			},
		},
	];
};
