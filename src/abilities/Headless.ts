import { Damage } from '../damage';
import { isTeam, Team } from '../utility/team';
import * as matrices from '../utility/matrices';
import { Effect } from '../effect';
import Game from '../game';
import { shakeBoard } from '../game-display/camera';
import { Hex } from '../utility/hex';
import { animateBoomerang } from '../phaser/boomerang';

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default (G: Game) => {
	G.abilities[39] = [
		/**
		 * First Ability: Larva Infest
		 * At both the beginning and end of the Headless turn, if there is an enemy
		 * creature in the hex directly at the back of the Headless, the enemy creature
		 * will instantly lose -5 maximum endurance.
		 *
		 * The upgraded ability also instantly applies the "fatigue" effect regardless
		 * of remaining endurance, as well as reducing -5 maximum endurance.
		 *
		 * If the Headless begins its turn in a position to trigger the ability, and
		 * ends its turn in the position, the enemy creature will have the ability effect
		 * applied twice.
		 */
		{
			trigger: 'onStartPhase onEndPhase',

			_targetTeam: Team.Enemy,

			require: function () {
				// Headless only triggers ability on its own turn.
				if (this.creature !== this.game.activeCreature) {
					return false;
				}

				if (this.creature.materializationSickness) {
					return false;
				}

				if (
					!this.atLeastOneTarget(this._getHexes(), {
						team: this._targetTeam,
					})
				) {
					return false;
				}

				return this.testRequirements();
			},

			activate: function () {
				this.end();

				// require() has identified a valid target, so we can safely assume it is there.
				const target = this._getHexes()[0].creature;
				const maxEnduranceBeforeInfest = target.stats.endurance;
				if (this.isUpgraded()) {
					// Upgraded ability causes fatigue - endurance set to 0.
					target.addFatigue(target.endurance);
				}

				const effect = new Effect(
					this.title,
					this.creature,
					target,
					// Effect never fades.
					'',
					{
						turnLifetime: -1,
						stackable: true,
						alterations: {
							endurance: -5,
						},
					},
					G,
				);

				const maxEnduranceLoss = Math.min(5, Math.max(0, maxEnduranceBeforeInfest - 1));
				if (maxEnduranceLoss <= 0) {
					G.log(`%CreatureName${target.id}% is already fragile`);
					target.addEffect(effect, undefined, undefined, true);
				} else {
					target.addEffect(
						effect,
						`%CreatureName${target.id}% loses -${maxEnduranceLoss} maximum endurance`,
					);
				}
				// Display potentially new "Fragile" status when losing maximum endurance.
				// TODO: Creatures are responsible for telling the UI if they potentially
				// make a change that might update another creature's fatigue. But this is
				// fragile. Ideally, this would be refactored so that the UI doesn't need
				// to be told about an update.
				this.game.UI.updateFatigue();
			},

			_getHexes: function () {
				return this.creature.getHexMap(
					/* Headless position is the front hex of its two hexes, so we look for
					an enemy unit two hexes back which will be the hex directly behind Headless. */
					matrices.inlineback2hex,
					false,
				);
			},
		},

		// 	Second Ability: Cartilage Dagger
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			_targetTeam: Team.Enemy,

			// 	require() :
			require: function () {
				const crea = this.creature;

				if (!this.testRequirements()) {
					return false;
				}

				//At least one target
				if (
					!this.atLeastOneTarget(crea.getHexMap(matrices.frontnback2hex, false), {
						team: this._targetTeam,
					})
				) {
					return false;
				}
				return true;
			},

			// 	query() :
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
					hexes: crea.getHexMap(matrices.frontnback2hex, false),
				});
			},

			//	activate() :
			activate: function (target) {
				const ability = this;
				ability.end();
				shakeBoard({
					amplitude: 0.01,
					durationMs: 90,
					force: true,
					axis: 'horizontal',
				});

				const d = {
					pierce: 11,
				};
				// Bonus for fatigued foe
				d.pierce = target.endurance <= 0 ? d.pierce * 2 : d.pierce;
				// Extra pierce damage if upgraded
				if (this.isUpgraded()) {
					const bonus = this.creature.stats.endurance - target.stats.endurance;
					if (bonus > 0) {
						d.pierce += bonus;
					}
				}

				const damage = new Damage(
					ability.creature, //Attacker
					d, // Damage Type
					1, // Area
					[], // Effects
					G,
				);

				target.takeDamage(damage);
			},
		},

		/**
		 * Primary Ability: Whip Move
		 *
		 * Inline ranged utility for pulling the Headless and a single allied or enemy
		 * unit together. Whether the Headless, target, or both are displaced depends
		 * on the relative size between the units.
		 *
		 * When upgraded the maximum range is increased.
		 *
		 * Targeting rules:
		 * - The target can be a single enemy or allied unit.
		 * - The target must be moveable.
		 * - The target must be inline (forwards or backwards) within the minimum and
		 *   maximum range.
		 * - The path to the target unit cannot be interrupted by any obstacles or units.
		 * - Targets in the deadzone (under minimum) range interrupt the path to other
		 *   valid targets.
		 *
		 * Other rules:
		 * - The ability deals no damage, even when targeting enemy units.
		 * - If the target is 1-sized, it is pulled to the hex in front of the Headless.
		 * - If the target is 2-sized, both units will be pulled towards each other
		 *   ending up adjacent at a halfway point.
		 * - If the target is 3-sized, the Headless is pulled to the hex in front of
		 *   the target.
		 * - The pull movement ignores pathing (it is pulled through the air) until
		 *   the final hex. For example, only a trap on the "landing" hex will be triggered.
		 * - The pull movement does not consume movement points.
		 * - Headless cannot use the ability if immoveable.
		 */
		{
			trigger: 'onQuery',

			_targetTeam: Team.Both,
			_directions: [0, 1, 0, 0, 1, 0],

			require: function () {
				const headless = this.creature;

				if (!this.testRequirements()) {
					return false;
				}

				if (!headless.stats.moveable) {
					this.message = G.msg.abilities.notMoveable;
					return false;
				}

				if (
					!this.testDirection({
						team: this._targetTeam,
						sourceCreature: headless,
						flipped: headless.player.flipped,
						directions: this._directions,
						distance: this._getMaxDistance(),
						minDistance: this.range.minimum,
						optTest: (creature) => creature.stats.moveable,
					})
				) {
					return false;
				}

				return true;
			},

			query: function () {
				const ability = this;
				const headless = this.creature;

				G.grid.queryDirection({
					fnOnConfirm: function () {
						// eslint-disable-next-line
						ability.animation(...arguments);
					},
					team: this._targetTeam,
					id: headless.id,
					sourceCreature: headless,
					flipped: headless.player.flipped,
					x: headless.x,
					y: headless.y,
					directions: this._directions,
					distance: this._getMaxDistance(),
					minDistance: this.range.minimum,
					optTest: (creature) => creature.stats.moveable,
				});
			},

			activate: function (target) {
				const ability = this;
				const headless = this.creature;
				target = target.find((hex) => hex.creature).creature;
				ability.end();

				// Movement - here be legacy dragons.
				let destinationX = null;
				let destinationTargetX = null;
				const isOnLeft = headless.x < target.x;

				if (
					target.isDarkPriest() &&
					target.hasCreaturePlayerGotPlasma() &&
					!isTeam(this.creature, target, Team.Ally)
				) {
					/* Target creature is a plasma fielded enemy Dark Priest 
					blocking the ability and triggering a counter damage if upgraded field */
					destinationTargetX = 0;
					const d = {
						slash: 1,
					};
					const damage = new Damage(ability.creature, d, 1, [], G);

					target.takeDamage(damage);
				} else if (target.size === 1) {
					/* Small creature, pull target towards self landing it in the hex directly
					in front of the Headless. */
					destinationTargetX = isOnLeft ? headless.x + 1 : headless.x - 2;
				} else if (target.size === 2) {
					/* Medium creature, pull self and target towards each other half way,
					rounding upwards for self (self move one extra hex if required). */
					let midpoint = Math.floor((headless.x + target.x) / 2);
					if (headless.x < target.x && (headless.x + target.x) % 2 == 1) {
						midpoint++;
					}
					destinationX = isOnLeft ? midpoint - 1 : midpoint + 1;
					if (Math.abs(headless.x - target.x) > 1) {
						destinationTargetX = isOnLeft ? midpoint + 1 : midpoint - 1;
					}
				} else {
					// Large creature, pull self towards target.
					destinationX = !isOnLeft ? target.x + 2 : target.x - 3;
				}

				let hex;

				// Check if Headless will be moved.
				if (destinationX) {
					hex = G.grid.hexes[headless.y][destinationX];
					headless.moveTo(hex, {
						ignoreMovementPoint: true,
						ignorePath: true,
						afterimages: true,
						callback: function () {
							const interval = setInterval(function () {
								if (!G.freezedInput) {
									clearInterval(interval);
									if (G.activeCreature?.player?.controller !== 'bot') {
										G.activeCreature?.queryMove();
									}
									headless.facePlayerDefault();
								}
							}, 100);
						},
					});
				}

				// Check if target creature will be moved.
				if (destinationTargetX) {
					hex = G.grid.hexes[headless.y][destinationTargetX];
					target.moveTo(hex, {
						ignoreMovementPoint: true,
						ignorePath: true,
						afterimages: true,
						callback: function () {
							const interval = setInterval(function () {
								if (!G.freezedInput) {
									clearInterval(interval);
									if (G.activeCreature?.player?.controller !== 'bot') {
										G.activeCreature?.queryMove();
									}
									headless.facePlayerDefault();
								}
							}, 100);
						},
					});
				}
			},

			_getMaxDistance: function () {
				return this.isUpgraded() ? this.range.upgraded : this.range.regular;
			},
		},

		// Boomerang Tool: three equal rows of up to five hexes per side.
		// Only the farthest inline hex deals damage; clipping shortens all rows on that side.
		{
			//	Type : Can be "onQuery","onStartPhase","onDamage"
			trigger: 'onQuery',

			damages: {
				slash: 9,
			},

			_getHexes: function (invertFlipped = false): Hex[] {
				const creature = this.creature;
				const flipped = creature.player.flipped !== invertFlipped;
				const inlineStartX = flipped ? creature.x - creature.size : creature.x + 1;
				const rows: Hex[][] = [];
				for (const y of [creature.y - 1, creature.y, creature.y + 1]) {
					const gridRow = G.grid.hexes[y];
					if (!gridRow) {
						continue;
					}
					// Adjacent rows are shifted half a hex relative to the inline row.
					const sideOffset = flipped ? 1 - (creature.y % 2) : -(creature.y % 2);
					const startX = inlineStartX + (y === creature.y ? 0 : sideOffset);
					const row: Hex[] = [];
					for (let distance = 0; distance < 5; distance++) {
						const hex = gridRow[startX + (flipped ? -distance : distance)];
						if (!hex) {
							break;
						}
						row.push(hex);
					}
					rows.push(row);
				}
				const length = Math.min(5, ...rows.map((row) => row.length));
				return rows.flatMap((row) => row.slice(0, length));
			},

			_getDamageHexes: function (hexes: Hex[]): Hex[] {
				const creature = this.creature;
				const middle = hexes.filter((hex) => hex.y === creature.y);
				const tip = middle.reduce<Hex | undefined>(
					(farthest, hex) =>
						!farthest || Math.abs(hex.x - creature.x) > Math.abs(farthest.x - creature.x)
							? hex
							: farthest,
					undefined,
				);
				return hexes.filter((hex) => hex.y !== creature.y || hex === tip);
			},

			require: function () {
				return this.testRequirements();
			},

			query: function () {
				const ability = this;
				const crea = this.creature;
				const choices: Hex[][] = [this._getHexes(false), this._getHexes(true)];
				const allDeadZone = choices.flatMap((choice) => {
					const damaging = new Set<Hex>(this._getDamageHexes(choice));
					return choice.filter((hex) => !damaging.has(hex));
				});

				G.grid.queryChoice({
					fnOnConfirm: function (...args) {
						ability.animation(...args);
					},
					team: Team.Both,
					requireCreature: 0,
					id: crea.id,
					flipped: crea.player.flipped,
					choices,
					hexesDeadZone: allDeadZone,
				});
			},

			activate: function (hexes: Hex[]) {
				const ability = this;
				ability.end(undefined, true);
				shakeBoard({ amplitude: 0.02, durationMs: 100, force: true, axis: 'horizontal' });

				const valid = this._getDamageHexes(hexes);
				const targets = ability.getTargets(valid);
				const upgraded = this.isUpgraded();
				const hitUnits = new Set<number>();
				const creature = this.creature;
				const left = hexes.length > 0 && hexes[0].x < creature.x;
				const start = G.grid.hexes[creature.y][left ? creature.x - creature.size + 1 : creature.x];
				animateBoomerang(
					G,
					start,
					valid,
					(hex) => {
						const target = hex.creature;
						if (!target || target.dead || (!upgraded && hitUnits.has(target.id))) {
							return;
						}
						const area = targets.find((entry) => entry.target === target)?.hexesHit;
						if (!area) {
							return;
						}
						hitUnits.add(target.id);
						ability.areaDamage(
							creature,
							{ slash: 9 },
							[],
							[{ target, hexesHit: upgraded ? 1 : area }],
							false,
						);
					},
					() => {
						const kills = targets.filter(({ target }) => target.dead).length;
						if (kills > 1) {
							creature.player.score.push({ type: 'combo', kills });
						}
						G.activeCreature?.queryMove();
					},
					upgraded,
				);
			},
		},
	];
};
