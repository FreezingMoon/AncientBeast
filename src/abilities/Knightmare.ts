import { Damage } from '../damage';
import { Team } from '../utility/team';
import * as matrices from '../utility/matrices';
import { Creature } from '../creature';
import { Effect } from '../effect';
import type { Ability } from '../ability';
import { Direction, Hex } from '../utility/hex';
import { isTeam } from '../utility/team';
import Game from '../game';

const isPlasmaFieldBlocker = (source: Creature, target: Creature) => {
	return target.isDarkPriest() && target.hasCreaturePlayerGotPlasma();
};

const splitIciclePathAtBlocker = (source: Creature, path: Hex[]) => {
	const blockerIndex = path.findIndex(
		(hex) => hex.creature instanceof Creature && isPlasmaFieldBlocker(source, hex.creature),
	);

	if (blockerIndex < 0) {
		return {
			solidHexes: path,
			dashedHexes: [],
		};
	}

	return {
		solidHexes: path.slice(0, blockerIndex + 1),
		dashedHexes: path.slice(blockerIndex + 1),
	};
};

const uniqueHexes = (hexes: Hex[]) => {
	const seenPositions = new Set<string>();

	return hexes.filter((hex) => {
		const positionKey = `${hex.x}:${hex.y}`;
		if (seenPositions.has(positionKey)) {
			return false;
		}

		seenPositions.add(positionKey);
		return true;
	});
};

const preserveAbilityRangeHexes = (
	ability: { _inDirectionTest?: boolean; _abilityRangeHexes?: Hex[]; _abilityRangeHexesDashed?: Hex[] },
	hexes: Hex[],
	dashedHexes: Hex[],
	callback: () => boolean,
) => {
	ability._inDirectionTest = true;
	const result = callback();
	ability._inDirectionTest = false;
	ability._abilityRangeHexes = uniqueHexes(hexes);
	ability._abilityRangeHexesDashed = uniqueHexes(dashedHexes);
	return result;
};

const getIcicleDirectionalOptions = (ability: Ability, game: Game) => {
	const creature = ability.creature;
	const x = creature.player.flipped ? creature.x - creature.size + 1 : creature.x;
	const directionalOptions = game.grid.getDirectionChoices({
		team: ability._targetTeam,
		id: creature.id,
		flipped: creature.player.flipped,
		sourceCreature: creature,
		requireCreature: false,
		x,
		y: creature.y,
		directions: ability.directions,
		distance: ability._getMaxDistance(),
		stopOnCreature: false,
		dashedHexesAfterCreatureStop: false,
	});

	const rangeHexes: Hex[] = [];
	directionalOptions.hexesDashed = [];
	
	// Process each choice to split at blockers and collect dashed hexes
	const processedChoices = directionalOptions.choices.map((choice) => {
		const { solidHexes, dashedHexes } = splitIciclePathAtBlocker(creature, choice);
		rangeHexes.push(...solidHexes);
		rangeHexes.push(...dashedHexes);

		dashedHexes.forEach((hex) => {
			if (!directionalOptions.hexesDashed.includes(hex)) {
				directionalOptions.hexesDashed.push(hex);
			}
		});

		return { solidHexes, dashedHexes, originalChoice: choice };
	});

	// Filter to only include choices with actual targetable creatures
	// Use originalChoice (full path) so we can target beyond blockers
	const targetChoices = processedChoices
		.filter((processed) =>
			processed.originalChoice.some(
				(hex) =>
					hex.creature instanceof Creature &&
					hex.creature.id !== creature.id,
			),
		)
		.map((processed) => processed.originalChoice);

	directionalOptions.choices = targetChoices;
	
	return {
		directionalOptions,
		rangeHexes: uniqueHexes(rangeHexes),
	};
};

const getIcicleHexCenterPoint = (hex: Hex) => {
	return {
		x: hex.displayPos.x + 45,
		y: hex.displayPos.y + 32,
	};
};

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default (G: Game) => {
	G.abilities[9] = [
		// 	First Ability: Frigid Tower
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onEndPhase',

			_effectName: 'Frostified',

			_getOffenseBuff: function () {
				return this.isUpgraded() ? 5 : 0;
			},

			// 	require() :
			require: function () {
				// Check whether this ability is upgraded; if so then make sure all existing
				// buffs include an offense buff
				const ability = this;
				this.creature.effects.forEach(function (effect: Effect) {
					if (effect.name === ability._effectName) {
						effect.alterations.offense = ability._getOffenseBuff();
					}
				});

				if (this.creature.travelDist > 0) {
					this.message = 'The creature moved this round.';
					return false;
				}
				return this.testRequirements();
			},

			//	activate() :
			activate: function () {
				this.creature.addEffect(
					new Effect(
						this._effectName,
						this.creature,
						this.creature,
						'',
						{
							alterations: {
								frost: 5,
								defense: 5,
								offense: this._getOffenseBuff(),
							},
							stackable: true,
							turnLifetime: -1,
						},
						G,
					),
				);
			},
		},

		// 	Second Ability: Icy Talons
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
					!this.atLeastOneTarget(
						this.creature.getHexMap(matrices.frontnback2hex, this.creature.player.flipped),
						{
							team: this._targetTeam,
						},
					)
				) {
					return false;
				}
				return true;
			},

			// 	query() :
			query: function () {
				const ability = this;

				G.grid.queryCreature({
					fnOnConfirm: function (...args) {
						ability.animation(...args);
					},
					team: this._targetTeam,
					id: this.creature.id,
					flipped: this.creature.player.flipped,
					hexes: this.creature.getHexMap(matrices.frontnback2hex, this.creature.player.flipped),
				});
			},

			//	activate() :
			activate: function (target: Creature) {
				const ability = this;
				ability.end();
				G.Phaser.camera.shake(0.01, 80, true, G.Phaser.camera.SHAKE_HORIZONTAL, true);

				// Upgraded ability does pierce damage to smaller size targets
				const damages = ability.damages;
				if (!this.isUpgraded() || !(target.size < this.creature.size)) {
					damages.pierce = 0;
				}

				const damage = new Damage(
					ability.creature, // Attacker
					damages, // Damage Type
					1, // Area
					[
						new Effect(
							this.title,
							this.creature,
							target,
							'',
							{
								alterations: {
									frost: -1,
								},
								stackable: true,
								turnLifetime: -1,
							},
							G,
						),
					], // Effects
					G,
				);

				target.takeDamage(damage);
			},
		},

		// 	Third Ability: Sudden Uppercut
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
					!this.atLeastOneTarget(
						this.creature.getHexMap(matrices.frontnback2hex, this.creature.player.flipped),
						{
							team: this._targetTeam,
						},
					)
				) {
					return false;
				}
				return true;
			},

			// 	query() :
			query: function () {
				const ability = this;

				G.grid.queryCreature({
					fnOnConfirm: function (...args) {
						ability.animation(...args);
					},
					team: this._targetTeam,
					id: this.creature.id,
					flipped: this.creature.player.flipped,
					hexes: this.creature.getHexMap(matrices.frontnback2hex, this.creature.player.flipped),
				});
			},

			//	activate() :
			activate: function (target: Creature) {
				const ability = this;
				ability.end();
				G.Phaser.camera.shake(0.02, 222, true, G.Phaser.camera.SHAKE_VERTICAL, true);

				const effects = [];
				// Upgraded ability adds a -10 defense debuff
				if (this.isUpgraded()) {
					effects.push(
						new Effect(
							this.title,
							this.creature,
							target,
							'',
							{
								alterations: {
									defense: -10,
								},
								stackable: true,
								turnLifetime: 1,
								deleteTrigger: 'onStartPhase',
							},
							G,
						),
					);
				}
				const damage = new Damage(
					ability.creature, // Attacker
					ability.damages, // Damage Type
					1, // Area
					effects,
					G,
				);

				const result = target.takeDamage(damage);

				if (result.kill || result.damageObj.status !== '') {
					return;
				}

				target.hinder();
			},
		},

		// 	Fourth Ability: Icicle Spear
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			directions: [1, 1, 1, 1, 1, 1],
			_targetTeam: Team.Both,

			_getMaxDistance: function () {
				// Upgraded ability has infinite range
				return this.isUpgraded() ? 0 : 6;
			},

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				const { directionalOptions, rangeHexes } = getIcicleDirectionalOptions(this as Ability, G);

				return preserveAbilityRangeHexes(this, rangeHexes, directionalOptions.hexesDashed || [], () => {
					if (directionalOptions.choices.length > 0) {
						this.message = '';
						return true;
					}

					this.message = G.msg.abilities.noTarget;
					return false;
				});
			},

			// 	query() :
			query: function () {
				const ability = this;
				const { directionalOptions } = getIcicleDirectionalOptions(this as Ability, G);
				const basePathHexes = uniqueHexes(directionalOptions.choices.flat());
				const dashedContinuationHexes = uniqueHexes(directionalOptions.hexesDashed || []);
				const dashedPos = new Set(dashedContinuationHexes.map((hex) => hex.pos));

				const renderBasePath = () => {
					basePathHexes.forEach((hex) => {
						if (!hex.creature && !dashedPos.has(hex.pos)) {
							hex.cleanDisplayVisualState('adj dashed creature player0 player1 player2 player3');
						}
					});
				};

				const renderDashedContinuation = () => {
					dashedContinuationHexes.forEach((hex) => {
						if (!hex.creature) {
							hex.cleanOverlayVisualState('h_player0 h_player1 h_player2 h_player3');
							hex.cleanDisplayVisualState('adj creature player0 player1 player2 player3');
							hex.displayVisualState('dashed');
							hex.grid.displayHexesGroup.bringToTop(hex.display);
						}
					});
				};

				(directionalOptions as any).hexesDashed = dashedContinuationHexes;
				(directionalOptions as any).preserveDashedHexesInChoices = true;
				(directionalOptions as any).callbackAfterQueryHexes = () => {
					renderBasePath();
					renderDashedContinuation();
				};
				(directionalOptions as any).fnOnHoverOutside = () => {
					renderBasePath();
					renderDashedContinuation();
				};
				(directionalOptions as any).fnOnSelect = (choice: Hex[]) => {
					renderBasePath();

					choice.forEach((item) => {
						if (item.creature instanceof Creature) {
							item.displayVisualState('creature selected player' + item.creature.team);
						} else if (dashedContinuationHexes.includes(item)) {
							item.cleanOverlayVisualState('h_player0 h_player1 h_player2 h_player3');
							item.cleanDisplayVisualState('adj creature player0 player1 player2 player3');
							item.displayVisualState('dashed');
							item.grid.displayHexesGroup.bringToTop(item.display);
						} else {
							item.displayVisualState('adj');
						}
					});

					renderDashedContinuation();
				};

				directionalOptions.fnOnConfirm = function (...args) {
					ability.animation(...args);
				};

				G.grid.queryChoice(directionalOptions);
			},

			//	activate() :
			activate: function (path, args) {
				const ability = this as Ability;
				const direction: Direction = args?.direction ?? Direction.Right;
				const flipped = ability.creature.player.flipped;

				// Determine which screen direction the shot travels
				// Non-flipped: 0,1,2 → right; 3,4,5 → left
				// Flipped:     0,1,2 → left; 3,4,5 → right
				const screenGoingRight = flipped
					? direction >= Direction.DownLeft
					: direction <= Direction.DownRight;

				const isBackwardsShot = ability.isTargetingBackwards(direction);

				// Use the clicked path directly instead of recalculating
				let travelPath = path.filter(
					(hex) =>
						!(hex.creature instanceof Creature && hex.creature.id === ability.creature.id),
				);

			const applyDamage = () => {
				let wasBlocked = false;
				let blockerHex: Hex | null = null;
				
				for (let i = 0; i < travelPath.length; i++) {
					const hex = travelPath[i];
					
					if (hex.creature instanceof Creature) {
						const trg = hex.creature;

						if (isPlasmaFieldBlocker(ability.creature, trg)) {
							// Icicle gets destroyed by shield, reduce plasma by 1
							if (trg.player.plasma > 0) {
								trg.player.plasma--;
								trg.updateHealth();
								trg.hint('Shielded', 'damage');
								G.log('%CreatureName' + trg.id + '% shielded the attack');
							}
							wasBlocked = true;
							blockerHex = travelPath[i];
							break;
						}

						const d = {
							pierce: ability.damages.pierce,
							frost: 6 - i,
						};
						if (d.frost < 0) {
							d.frost = 0;
						}

						//Damage
						const damage = new Damage(
							ability.creature, // Attacker
							d, // Damage Type
							1, // Area
							[], // Effects
							G,
						);

						const result = trg.takeDamage(damage);
						G.Phaser.camera.shake(0.02, 80, true, G.Phaser.camera.SHAKE_HORIZONTAL, true);

						// Stop propagating if no damage dealt
						if (
							result.damageObj.status === 'Shielded' ||
							(result.damages && result.damages.total <= 0)
						) {
							break;
						}
					}
				}
				return { wasBlocked, blockerHex };
			};

			ability.end(false, true);

			const fireIcicle = () => {
				if (travelPath.length === 0) {
					applyDamage();
					ability.creature.facePlayerDefault();
					G.activeCreature.queryMove();
					return;
				}

				const emissionPoint = ability.creature.legacyProjectileEmissionPoint;
				const { wasBlocked, blockerHex } = applyDamage();
				const pathEndHex = travelPath[travelPath.length - 1];
				const endHex = wasBlocked && blockerHex ? blockerHex : travelPath[travelPath.length - 1];
				if (!endHex || !pathEndHex) {
					ability.creature.facePlayerDefault();
					G.activeCreature.queryMove();
					return;
				}
				const startX = emissionPoint.x + (screenGoingRight ? 150 : 30);
				const startY = emissionPoint.y - 130;
				const aimPoint = getIcicleHexCenterPoint(pathEndHex);
				const blockerIndex = blockerHex ? travelPath.indexOf(blockerHex) : -1;
				const travelledStepCount = wasBlocked && blockerIndex >= 0 ? blockerIndex + 1 : travelPath.length;
				const travelProgress = Math.max(
					0,
					Math.min(1, travelledStepCount / Math.max(1, travelPath.length)),
				);
				const impactPoint = {
					x: startX + (aimPoint.x - startX) * travelProgress,
					y: startY + (aimPoint.y - startY) * travelProgress,
				};
				// Tongue is at +150 from group origin when facing right, +30 when facing left
				// (creature size 2: 2 * HEX_WIDTH_PX - 150 = 30)
				const duration = Math.max(1, travelledStepCount) * 75;
				const sprite = G.grid.creatureGroup.create(startX, startY, 'effects_icicle-spear');
				sprite.anchor.setTo(0.5);
				const dx = aimPoint.x - startX;
				const dy = aimPoint.y - startY;
				sprite.rotation = Math.atan2(dy, dx);
				const tween = G.Phaser.add
					.tween(sprite)
					.to({ x: impactPoint.x, y: impactPoint.y }, duration, Phaser.Easing.Linear.None)
					.start();

				tween.onComplete.add(function () {
					// @ts-expect-error 'this' refers to the animation sprite, not the ability.
					this.destroy();
					ability.creature.facePlayerDefault();
					G.activeCreature.queryMove();
				}, sprite);
			};

				if (isBackwardsShot) {
					// Turn to face backwards, wait briefly, then fire; turn back in onComplete
					const backDir: 1 | -1 = flipped ? 1 : -1;
					ability.creature.creatureSprite.setDir(backDir);
					setTimeout(fireIcicle, 250);
				} else {
					fireIcicle();
				}
			},
		},
	];
};
