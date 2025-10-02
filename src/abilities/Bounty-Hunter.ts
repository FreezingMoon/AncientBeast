import { Damage } from '../damage';
import { Team, isTeam } from '../utility/team';
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
								turnLifetime: 0,
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

			//	query():
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

			//	activate():
			activate: function (target: Creature) {
				const targetOriginalHealth = target.health;

				const ability = this;

				const game = this.game;

				const damage = new Damage(
					ability.creature, // Attacker
					ability.damages, // Damage Type
					1, // Area
					[], // Effects
					G,
				);
				target.takeDamage(damage);
				ability.end();
				G.Phaser.camera.shake(0.01, 150, true, G.Phaser.camera.SHAKE_HORIZONTAL, true);
				/** damage dealt is original health - current health
				 * if current health is lower than damage dealt,
				 * and the ability is upgraded,
				 * make a second attack
				 */
				if (
					targetOriginalHealth - target.health >= target.health &&
					!target.dead &&
					this.isUpgraded()
				) {
					// Added a delay for the second attack with a custom game log
					setTimeout(() => {
						G.Phaser.camera.shake(0.01, 150, true, G.Phaser.camera.SHAKE_HORIZONTAL, true);
						ability.end(true);
						game.soundsys.playSFX('sounds/swing2');
						target.takeDamage(damage);
						G.log('%CreatureName' + ability.creature.id + '% used ' + ability.title + ' twice');
					}, 1000);
				}
			},
		},

		/** Third Ability:
		 * Pistol Shot
		 * costs 15 energy pts.
		 * Delivers a medium ranged shot that can damage target up to 6 hexagons away.
		 * 20 pierce damage in any of 6 directions.
		 * Upgrade: Can be used twice per round.
		 */

		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',
			_targetTeam: Team.Enemy,

			// 	require() :
			require: function () {
				if (!this.testRequirements()) {
					return false;
				}
				// At least one target
				const cre = this.creature;
				for (let i = 0; i < 6; i++) {
					if (
						this.atLeastOneTarget(G.grid.getHexLine(cre.x, cre.y, i, false).slice(1, 1 + 6), {
							team: this._targetTeam,
							pierceThroughBehavior: 'targetOnly',
						})
					) {
						this.message = ''; // When checking all lines, one failure=wrong message. Remove message if successful
						return this.timesUsedThisTurn < this._getUsesPerTurn();
					}
				}
				return false;
			},

			// query() :
			query: function () {
				const ab = this;
				const cre = ab.creature;

				G.grid.queryDirection({
					fnOnConfirm: (...args) => ab.animation(...args),
					team: this._targetTeam,
					id: cre.id,
					flipped: cre.player.flipped,
					x: cre.x,
					y: cre.y,
					sourceCreature: cre,
					directions: [1, 1, 1, 1, 1, 1],
					distance: 6,
					minDistance: 1,
					requireCreature: true,
				});
			},

			_getUsesPerTurn: function () {
				// If upgraded, useable twice per turn
				return this.isUpgraded() ? 2 : 1;
			},

			//	activate() :
			activate: function (hexes, args) {
				// In direction queries, the confirmed callback does not include args.hex.
				// Resolve the target from the provided hex path by selecting the first hex
				// in the chosen direction that contains a creature.
				const targetHex = hexes && hexes.find((h) => h.creature);
				const tgt = targetHex && targetHex.creature;
				if (!tgt) return;

				// 1) Screen shake + deal damage
				G.Phaser.camera.shake(0.01, 150, true, G.Phaser.camera.SHAKE_HORIZONTAL, true);
				tgt.takeDamage(new Damage(this.creature, this.damages, 1, [], G));

				// 2) Decide if this is the final shot
				const nextUseCount = this.timesUsedThisTurn + 1;
				const maxUses = this._getUsesPerTurn();
				const isFinalShot = nextUseCount >= maxUses;

				if (!isFinalShot) {
					// ─── Intermediate shot ───
					// Tell end() not to disable the button permanently:
					this._disableCooldowns = true;
					this.end();
					// Turn cooldowns back on for the final shot
					this._disableCooldowns = false;
					G.grid.redoLastQuery();
				} else {
					// ─── Final shot ───
					// A normal end() will apply cost, log, disable the button, and return to movement.
					this.timesUsedThisTurn += 1;
					this.end();
				}
			},
		},

		/** Fourth Ability:
		 * Rifle Assassin
		 * costs 35 energy pts.
		 * Very powerful long range attack that can strike up to 12 hexagons distance.
		 * 40 pierce damage in any of 6 directions.
		 * Upgrade: Half Damage Pierce.
		 */
		{
			trigger: 'onQuery',
			_targetTeam: Team.Enemy,

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}
				// At least one target
				const cre = this.creature;
				for (let i = 0; i < 6; i++) {
					if (
						this.atLeastOneTarget(G.grid.getHexLine(cre.x, cre.y, i, false).slice(1, 1 + 12), {
							team: this._targetTeam,
							pierceThroughBehavior: 'targetOnly',
						})
					) {
						this.message = ''; // When checking all lines, one failure=wrong message. Remove message if successful
						return true;
					}
				}
				return false;
			},

			query: function () {
				const ability = this;
				const cre = ability.creature;

				G.grid.queryDirection({
					fnOnSelect: () => {},
					fnOnConfirm: (...args) => ability.animation(...args),
					fnOnCancel: () => G.activeCreature.queryMove(),
					team: this._targetTeam,
					id: cre.id,
					flipped: cre.player.flipped,
					x: cre.x,
					y: cre.y,
					sourceCreature: cre,

					directions: [1, 1, 1, 1, 1, 1],
					distance: 12,
					minDistance: 1,
					stopOnCreature: true,
					requireCreature: true,
					pierceNumber: ability.isUpgraded() ? 2 : 1,
					pierceThroughBehavior: ability.isUpgraded() ? 'pierce' : 'targetOnly',

					// Only turn these on once upgraded
					dashedHexesAfterCreatureStop: true,
					dashedHexesDistance: 12,
					dashedHexesUnderCreature: true,
				});
			},

			activate: function (hexes, args) {
				const ability = this;
				const cre = ability.creature;
				const dir = args.direction;
				ability.end();
				G.Phaser.camera.shake(0.01, 150, true, G.Phaser.camera.SHAKE_HORIZONTAL, true);

				const full = ability.damages.pierce; // 40
				const half = Math.floor(full / 2); // 20
				const double = full + half; // 60

				// Maybe turn this into a special function for pierce damage?
				const line = G.grid.getHexLine(cre.x, cre.y, dir, false).slice(1, 1 + 12);

				let first = null;
				let second = null;
				let sawFirstTwice = false;

				for (const h of line) {
					const t = h.creature;
					if (!t || isTeam(cre, t, Team.Same)) continue;

					if (!first) {
						// first time we see any creature
						first = t;
						continue;
					}

					// if same creature showing up again immediately after first,
					// we treat that as a double occupancy and stop
					if (t.id === first.id) {
						sawFirstTwice = true;
						break;
					}

					// otherwise it’s a second, different creature
					second = t;
					break;
				}

				if (first) {
					if (this.isUpgraded() && sawFirstTwice && first.size > 1) {
						first.takeDamage(new Damage(cre, { pierce: full + half }, 1, [], G));
					} else {
						first.takeDamage(new Damage(cre, { pierce: full }, 1, [], G));
						if (this.isUpgraded() && second) {
							second.takeDamage(new Damage(cre, { pierce: half }, 1, [], G));
						}
					}
				}
			},
		},
	];
};
