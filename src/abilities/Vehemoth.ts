import { Damage } from '../damage';
import { Team } from '../utility/team';
import * as matrices from '../utility/matrices';
import * as arrayUtils from '../utility/arrayUtils';
import { Direction, Hex } from '../utility/hex';
import { QueryOptions } from '../utility/hexgrid';
import { Effect } from '../effect';
import { getPointFacade } from '../utility/pointfacade';
import { HEX_WIDTH_PX } from '../utility/const';
import Game from '../game';

/** Creates the abilities
 * @param {Game} G the game object
 * @return {void}
 */
export default (G: Game) => {
	G.abilities[6] = [
		// 	First Ability: Lamellar Body
		{
			//  Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onCreatureSummon onOtherCreatureSummon onOtherCreatureDeath',

			_defenseBuff: 0,

			//  require() :
			require: function () {
				// Stop temporary and dead creatures from activating
				if (this.creature.dead || this.creature.temp) {
					return false;
				}
				// Stop activation if the other creature is not a sloth type
				let buff = 0;
				G.creatures.forEach((crea) => {
					if (crea && crea.realm == 'S' && !crea.dead && !crea.temp) {
						buff += 2;
					}
				});
				if (buff == this._defenseBuff) {
					return false;
				}
				this._defenseBuff = buff;
				return true;
			},

			//  activate() :
			activate: function () {
				// Force Vehemoth to stay facing the right way
				this.creature.facePlayerDefault();

				let regrowBuff = 0;
				if (this.isUpgraded()) {
					regrowBuff = this._defenseBuff;
				}

				this.creature.replaceEffect(
					// Add and replace the effect each time
					new Effect(
						'Lamellar Body', // name
						this.creature, // caster
						this.creature, // target
						'', // trigger
						{
							alterations: {
								defense: this._defenseBuff,
								frost: this._defenseBuff,
								regrowth: regrowBuff,
							},
							stackable: false,
						},
						G,
					),
				);
			},
		},

		// 	Second Ability: Flat Frons
		{
			//	Type : Can be "onQuery","onStartPhase","onDamage"
			trigger: 'onQuery',

			_directions: [0, 1, 0, 0, 1, 0], // forward/backward
			_targetTeam: Team.Enemy,

			/**
			 * If the target creature's health <= this value, it can be instantly killed.
			 */
			_executeHealthThreshold: 49,

			// 	require() :
			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				if (
					!this.atLeastOneTarget(this._getHexes(), {
						team: this._targetTeam,
					})
				) {
					if (this.isUpgraded()) {
						if (
							!this.testDirection({
								team: this._targetTeam,
								directions: this._directions,
								distance: this.creature.remainingMove + 1,
								sourceCreature: this.creature,
							})
						) {
							return false;
						}
					} else {
						return false;
					}
				}

				return true;
			},

			// 	query() :
			query: function () {
				const ability = this;
				const vehemoth = this.creature;

				const object: Partial<QueryOptions> = {
					fnOnConfirm: function (...args) {
						ability.animation(...args);
					},
					flipped: vehemoth.player.flipped,
					id: vehemoth.id,
					team: Team.Enemy,
					requireCreature: true,
				};

				object.choices = this._getHexes().map((hex) => [hex]);

				if (this.isUpgraded()) {
					const directionObject = G.grid.getDirectionChoices({
						flipped: vehemoth.player.flipped,
						team: this._targetTeam,
						requireCreature: true,
						stopOnCreature: true,
						sourceCreature: vehemoth,
						id: vehemoth.id,
						x: vehemoth.x,
						y: vehemoth.y,
						directions: this._directions,
						distance: vehemoth.remainingMove + 1,
					});

					// Removes duplicates between nearby and inline targets
					object.choices = object.choices.filter(
						(objectHexes) =>
							!directionObject.choices.some((directionHexes) =>
								objectHexes.every((v) => directionHexes.includes(v)),
							),
					);
					object.choices = [...object.choices, ...directionObject.choices];
				}

				G.grid.queryChoice(object);
			},

			//	activate() :
			activate: function (path, args) {
				const ability = this;
				const vehemoth = ability.creature;
				const releaseDeferredFreeze = () => {
					if (G._deferredQueryMovePending > 0) {
						G._deferredQueryMovePending--;
					}
					if (G._deferredQueryMovePending === 0 && G.animationQueue.length === 0) {
						G.freezedInput = false;
						G.grid?.refreshHoverState?.();
					}
				};
				const resumeQueryMove = () => {
					const activeCreature = G.activeCreature;

					if (activeCreature?.dead || (!activeCreature && vehemoth.dead)) {
						releaseDeferredFreeze();
						return;
					}

					if (activeCreature?.queryMove) {
						activeCreature.queryMove();
						return;
					}

					vehemoth.queryMove();
				};
				G.Phaser.camera.shake(0.02, 333, true, G.Phaser.camera.SHAKE_HORIZONTAL, true);

				path = arrayUtils.sortByDirection(path, args.direction);
				const target = arrayUtils.last(path).creature;
				const targetIsNearby = this._getHexes().some((hex) => hex.creature?.id === target.id);

				if (targetIsNearby) {
					ability.end();
					ability._damageTarget(target);
				} else {
					// Resolve query state after the charge + knockback sequence finishes.
					ability.end(false, true);

					// Charge to target.
					arrayUtils.filterCreature(path, false, true, vehemoth.id);
					let destination = arrayUtils.last(path);
					if (!destination) {
						resumeQueryMove();
						return;
					}
					const x = destination.x + (args.direction === 4 ? vehemoth.size - 1 : 0);
					destination = G.grid.hexes[destination.y][x];
					if (!destination) {
						resumeQueryMove();
						return;
					}

					if (
						vehemoth.stats.moveable &&
						vehemoth.calculatePath({ x: destination.x, y: destination.y }).length === 0
					) {
						resumeQueryMove();
						return;
					}

					/* Calculate hexes the target could be pushed along. Limited by the number
					of hexes the Vehemoth charged, and will stop when reaching obstacles. */
					let knockbackHexes = G.grid.getHexLine(
						target.x,
						target.y,
						args.direction,
						ability.creature.player.flipped,
					);
					arrayUtils.filterCreature(knockbackHexes, false, true, target.id);
					knockbackHexes = knockbackHexes.slice(0, path.length);

					vehemoth.moveTo(destination, {
						overrideSpeed: 100,
						callback: function () {
							let knockbackHex = arrayUtils.last(knockbackHexes);

							/* Damage before knockback any other creature movement to handle dead
							targets, Snow Bunny hop incorrectly avoiding damage, etc. */
							const damageResult = ability._damageTarget(target);

							if (damageResult.kill) {
								resumeQueryMove();
								return;
							}

							if (knockbackHex) {
								if (!target.stats.moveable) {
									resumeQueryMove();
									return;
								}

								// If pushing left, account for the difference in x origin of flipped creatures.
								if (args.direction === Direction.Left) {
									knockbackHex =
										knockbackHex && G.grid.hexes[knockbackHex.y][knockbackHex.x + target.size - 1];
								}

								target.moveTo(knockbackHex, {
									callback: function () {
										resumeQueryMove();
									},
									ignoreMovementPoint: true,
									ignorePath: true,
									animation: 'push',
								});
							} else {
								resumeQueryMove();
							}
						},
					});
				}
			},

			/**
			 * Calculate the damage done with the ability and potentially execute the
			 * target if under a certain health threshold.
			 *
			 * @param {Creature} target Target for the ability.
			 * @returns {object} @see creature.takeDamage()
			 */
			_damageTarget: function (target) {
				const ability = this;
				const shouldExecute = target.health <= ability._executeHealthThreshold && target.isFrozen();
				const damageType = shouldExecute
					? { pure: target.health }
					: { crush: this.damages.crush, frost: this.damages.frost };
				const damage = new Damage(ability.creature, damageType, 1, [], G);
				let damageResult;

				if (shouldExecute) {
					/* Suppress the death message, to be replaced by a custom log. Setting
						`noLog` on Damage wouldn't work as it would suppress Shielded/Dodged messages. */
					this.game.UI.chat.suppressMessage(/is dead/i, 1);
					damageResult = target.takeDamage(damage);

					// Damage could be shielded or blocked, so double check target has died.
					if (damageResult.kill) {
						this.game.log(`%CreatureName${target.id}% has been shattered!`);
						target.hint('Shattered', 'damage');
					}
				} else {
					damageResult = target.takeDamage(damage);
				}

				return damageResult;
			},

			/**
			 * The area of effect is the front and back 3 hexes for a total of 6 hexes.
			 *
			 * @returns {Hex[]} Refer to Creature.getHexMap()
			 */
			_getHexes(): Hex[] {
				return this.creature.getHexMap(matrices.frontnback3hex, this.creature.player.flipped);
			},
		},

		/**
		 * Primary Ability: Flake Convertor
		 *
		 * Inline ranged attack on a fatigued enemy unit within 5 range. Deals damage
		 * equal to the positive Frost mastery difference between Vehemoth and the target,
		 * who also receives the "Frozen" status.
		 *
		 * When upgraded, the "Frozen" status becomes "Cryostasis" which is a special
		 * "Freeze" that is not broken when receiving damage.
		 *
		 * Targeting rules:
		 * - The target must be an enemy unit.
		 * - The target must have the "Fatigued" status (no remaining endurance).
		 * - The target must be inline (forwards or backwards) within 5 range.
		 * - The path to the target unit cannot be interrupted by any obstacles or units.
		 *
		 * Other rules:
		 * - Attacked unit receives the "Frozen" status, making them skip their next turn.
		 * - There is no cap to the damage dealt from the positive Frost mastery difference.
		 * - Attack damage will be 0 if the target has a higher Frost mastery than Vehemoth,
		 *   but the "Frozen"/"Cryostasis" effect will still be applied.
		 * - The upgraded "Cryostasis" effect does not break when receiving damage from
		 *   the Vehemoth or ANY other source.
		 */
		{
			trigger: 'onQuery',

			_targetTeam: Team.Enemy,
			_directions: [1, 1, 1, 1, 1, 1],

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				if (
					!this.testDirection({
						sourceCreature: this.creature,
						team: this._targetTeam,
						directions: this._directions,
						distance: 5, // range
						optTest: this._confirmTarget,
					})
				) {
					return false;
				}

				return true;
			},

			query: function () {
				const ability = this;
				const vehemoth = this.creature;

				G.grid.queryDirection({
					fnOnConfirm: function (...args) {
						ability.animation(...args);
					},
					flipped: vehemoth.player.flipped,
					team: this._targetTeam,
					id: vehemoth.id,
					requireCreature: true,
					x: vehemoth.x,
					y: vehemoth.y,
					directions: this._directions,
					distance: 5, // range
					optTest: this._confirmTarget,
				});
			},

			activate: function (path, args) {
				const ability = this;
				const vehemoth = this.creature;
				const hexWithTarget = path.find((hex: Hex) => {
					const creature = getPointFacade().getCreaturesAt({ x: hex.x, y: hex.y })[0];
					return creature && creature !== vehemoth;
				});
				const target = getPointFacade().getCreaturesAt(hexWithTarget.x, hexWithTarget.y)[0];

				ability.end();
				G.Phaser.camera.shake(0.01, 50, true, G.Phaser.camera.SHAKE_HORIZONTAL, true);

				const [tween, sprite] = G.animations.projectile(
					// @ts-expect-error `this.creature` exists once this file is extended into `ability.ts`
					this,
					target,
					'effects_ice-bolt',
					path,
					args,
					52,
					-20,
				);

				const frostMasteryDifference = Math.max(vehemoth.stats.frost - target.stats.frost, 0);
				const damage = new Damage(
					ability.creature,
					{
						frost: frostMasteryDifference,
					},
					1,
					[],
					G,
				);

				tween.onComplete.add(function () {
					// `this` refers to the animation object, _not_ the ability.
					// @ts-expect-error 'this' defauls to type 'any'
					this.destroy();

					let damageResult;
					if (damage.damages.frost > 0) {
						damageResult = target.takeDamage(damage);
					}

					target.freeze(ability.isUpgraded());

					if (damageResult && !damageResult.kill) {
						G.log(
							`%CreatureName${target.id}% ${
								ability.isUpgraded() ? 'enters Cryostasis' : 'has been Frozen'
							} and cannot act`,
						);
						target.hint(ability.isUpgraded() ? 'Cryostasis' : 'Frozen', 'damage');
					}
				}, sprite); // End tween.onComplete
			},

			/**
			 * Test a potential target enemy unit's state to determine if it can be targeted.
			 *
			 * @param {Creature} creature Enemy unit creature that could be targeted.
			 * @returns {boolean} Does the unit meet the targeting requirements?
			 */
			_confirmTarget(creature) {
				return creature.isFatigued();
			},
		},

		/**
		 * Ultimate Ability: Falling Arrow
		 *
		 * Attack a single enemy unit within a 4 range cone (forwards or backwards),
		 * regardless of line of sight. Deals bonus damage based on the positive level
		 * difference between Vehemoth and the target.
		 *
		 * When upgraded, even more bonus damage is added to a positive level difference.
		 *
		 * Targeting rules:
		 * - The target must be a single enemy unit.
		 * - The target can be selected from any valid target within a 4 range front
		 *   or backwards cone:
		 *   ⬡⬢⬡⬡⬡⬡⬡⬡⬡⬡⬢⬡
		 *   ⬡⬢⬢⬡⬡⬡⬡⬡⬡⬢⬢⬡
		 *   ⬡⬢⬢⬢⬡⬡⬡⬡⬢⬢⬢⬡
		 *   ⬡⬢⬢⬢⬢⬡⬡⬢⬢⬢⬢⬡
		 *   ⬢⬢⬢⬢🥶🥶🥶⬢⬢⬢⬢
		 *   ⬡⬢⬢⬢⬢⬡⬡⬢⬢⬢⬢⬡
		 *   ⬡⬢⬢⬢⬡⬡⬡⬡⬢⬢⬢⬡
		 *   ⬡⬢⬢⬡⬡⬡⬡⬡⬡⬢⬢⬡
		 *   ⬡⬢⬡⬡⬡⬡⬡⬡⬡⬡⬢⬡
		 * - The path to the target unit will not be interrupted by obstacles.
		 *
		 * Other rules:
		 * - Bonus damage is +3 frost per level difference.
		 * - Upgraded ability bonus damage is an additional +2 pierce per level difference.
		 * - Bonus damage will be 0 if the target has a higher level than Vehemoth,
		 *   it does not become a negative bonus.
		 */
		{
			trigger: 'onQuery',

			_directions: [0, 1, 0, 0, 1, 0],
			_targetTeam: Team.Enemy,

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				if (
					!this.atLeastOneTarget(this._getHexes(), {
						team: this._targetTeam,
					})
				) {
					return false;
				}

				return true;
			},

			query: function () {
				const ability = this;
				const vehemoth = this.creature;

				this.game.grid.queryCreature({
					fnOnConfirm: function (...args) {
						ability.animation(...args);
					},
					team: this._targetTeam,
					id: vehemoth.id,
					flipped: vehemoth.player.flipped,
					hexes: this._getHexes(),
				});
			},

			activate: function (target) {
				const ability = this;
				const vehemoth = this.creature;

				ability.end();
				G.Phaser.camera.shake(0.02, 123, true, G.Phaser.camera.SHAKE_VERTICAL, true);

				const vehemothLevel = Number(vehemoth.level);
				const targetLevel = Number(target.level);
				const levelDifference =
					Number.isFinite(vehemothLevel) && Number.isFinite(targetLevel)
						? Math.max(vehemothLevel - targetLevel, 0)
						: 1;
				const damages = {
					...ability.damages,
					frost: ability.damages.frost + levelDifference * 3,
					pierce: ability.damages.pierce + (ability.isUpgraded() ? levelDifference * 2 : 0),
				};
				const damage = new Damage(vehemoth, damages, 1, [], G);

				const emissionPoint = vehemoth.legacyProjectileEmissionPoint;
				if (!target.hexagons?.length) {
					ability.end(true);
					return;
				}
				const targetHex = target.hexagons.reduce((closestHex, hex) => {
					return Math.abs(emissionPoint.x - hex.displayPos.x) <
						Math.abs(emissionPoint.x - closestHex.displayPos.x)
						? hex
						: closestHex;
				});

				const impactPoint = {
					x: targetHex.displayPos.x + 45,
					y: targetHex.displayPos.y + 32,
				};

				const shotGoesRight = impactPoint.x >= emissionPoint.x + (vehemoth.size * HEX_WIDTH_PX) / 2;
				const defaultFacingRight = !vehemoth.player.flipped;
				const isBackwardsShot = shotGoesRight !== defaultFacingRight;

				const fireProjectile = () => {
					// Convert cardboard-local nose coordinates into world coordinates using
					// the current sprite transform (position + anchor + scale).
					// This keeps forward/backward shots aligned after setDir mirroring.
					const cardboardNoseLocalX = 221;
					const cardboardNoseLocalY = 127;
					const creatureGroup = vehemoth.creatureSprite.grp;
					const creatureSprite = vehemoth.creatureSprite.sprite;
					const localOffsetX =
						(cardboardNoseLocalX - creatureSprite.anchor.x * creatureSprite.texture.width) *
						creatureSprite.scale.x;
					const localOffsetY =
						(cardboardNoseLocalY - creatureSprite.anchor.y * creatureSprite.texture.height) *
						creatureSprite.scale.y;
					const noseWorldX = creatureGroup.x + creatureSprite.x + localOffsetX;
					const noseWorldY = creatureGroup.y + creatureSprite.y + localOffsetY;

					const shotAngle = Math.atan2(impactPoint.y - noseWorldY, impactPoint.x - noseWorldX);
					const emergenceInsetPx = 18;
					const startX = noseWorldX - Math.cos(shotAngle) * emergenceInsetPx;
					const startY = noseWorldY - Math.sin(shotAngle) * emergenceInsetPx;
					const sprite = G.grid.creatureGroup.create(startX, startY, 'effects_ice-bolt');
					sprite.anchor.setTo(0, 0.5); // Center-left
					sprite.rotation = shotAngle;

					// Vertical clipping line slightly inside the nose cavity.
					const revealMask = G.Phaser.add.graphics(0, 0, G.grid.creatureGroup);
					const outwardClipPx = 2;
					const maskLineNudgeX = -3;
					const shotDirX = Math.cos(shotAngle);
					const shotGoesRightAtFire = shotDirX >= 0;
					const clipX =
						noseWorldX + (shotGoesRightAtFire ? outwardClipPx : -outwardClipPx) + maskLineNudgeX;
					revealMask.beginFill(0xffffff);
					if (shotGoesRightAtFire) {
						revealMask.drawRect(clipX, -2000, 5000, 4000);
					} else {
						revealMask.drawRect(-2000, -2000, clipX + 2000, 4000);
					}
					revealMask.endFill();
					sprite.mask = revealMask;

					const travelDistance = Math.hypot(impactPoint.x - startX, impactPoint.y - startY);
					const duration = Math.max(180, Math.min(420, travelDistance * 0.6));
					const tween = G.Phaser.add
						.tween(sprite)
						.to({ x: impactPoint.x, y: impactPoint.y }, duration, Phaser.Easing.Linear.None)
						.start();

					tween.onComplete.add(() => {
						sprite.mask = null;
						sprite.destroy();
						revealMask.destroy();
						target.takeDamage(damage);
						if (isBackwardsShot) {
							vehemoth.facePlayerDefault();
						}
					});
				};

				if (isBackwardsShot) {
					const backDir: 1 | -1 = shotGoesRight ? 1 : -1;
					vehemoth.creatureSprite.setDir(backDir);
					setTimeout(fireProjectile, 250);
				} else {
					fireProjectile();
				}
			},

			/**
			 * The area of effect is a front and back 4 distance cone originating from
			 * the head of the Vehemoth. @see ability description for more details.
			 *
			 * @returns {Hex[]} Refer to HexGrid.getHexMap()
			 */
			_getHexes() {
				const vehemoth = this.creature;

				return [
					...G.grid.getHexMap(
						vehemoth.x,
						// Unsure why the y offset is incorrect when flipping the matrix.
						vehemoth.y - 4,
						2,
						true,
						matrices.fourDistanceCone,
					),
					...this.creature.getHexMap(matrices.fourDistanceCone, this.creature.player.flipped),
				];
			},
		},
	];
};
