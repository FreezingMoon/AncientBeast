import { Damage } from '../damage';
import { Effect } from '../effect';
import Game from '../game';
import { Creature } from '../creature';
import { Direction, Hex } from '../utility/hex';
import * as matrices from '../utility/matrices';
import { getDirectionFromDelta } from '../utility/position';
import { isTeam, Team } from '../utility/team';

const getFrontLanes = (creature: Creature) => [
	...creature.getHexMap(matrices.fronttop1hex, false),
	...creature.getHexMap(matrices.inlinefront1hex, false),
	...creature.getHexMap(matrices.frontbottom1hex, false),
];

const getBackLanes = (creature: Creature) => [
	...creature.getHexMap(matrices.backtop1hex, false),
	...creature.getHexMap(matrices.inlineback1hex, false),
	...creature.getHexMap(matrices.backbottom1hex, false),
];

const meatSickleRestrictionEffectName = 'Meat Sickle Restriction';
const hornHeadLifeSupportTrackerEffectName = 'Life Support Damage Tracker';
const meatSickleInlineDirections = [Direction.Right, Direction.Left];
const meatSickleAllDirections = [
	Direction.UpRight,
	Direction.Right,
	Direction.DownRight,
	Direction.DownLeft,
	Direction.Left,
	Direction.UpLeft,
];

const getMeatSickleStartX = (creature: Creature, direction: Direction) => {
	if (
		(!creature.player.flipped && direction > Direction.DownRight) ||
		(creature.player.flipped && direction < Direction.DownLeft)
	) {
		return creature.x - (creature.size - 1);
	}

	return creature.x;
};

const getMeatSicklePath = (G: Game, creature: Creature, direction: Direction, distance: number) =>
	G.grid
		.getHexLine(
			getMeatSickleStartX(creature, direction),
			creature.y,
			direction,
			creature.player.flipped,
		)
		.slice(1, distance + 1);

const getUpgradedMeatSickleChoices = (G: Game, creature: Creature) =>
	meatSickleAllDirections.map((direction) =>
		getMeatSicklePath(
			G,
			creature,
			direction,
			meatSickleInlineDirections.includes(direction) ? 5 : 1,
		),
	);

const getKnuckleNibPushDistance = (target: Creature) => Math.max(0, 4 - target.size);

const getKnuckleNibImpactX = (source: Creature, target: Creature) =>
	Math.max(target.x - target.size + 1, Math.min(target.x, source.x));

const getKnuckleNibPushDirection = (source: Creature, target: Creature) => {
	// Creature.x is the rightmost occupied hex in this codebase. Clamp Horn Head's x to the
	// target footprint so the direction is based on the actually contacted hex.
	const nearestTargetX = getKnuckleNibImpactX(source, target);
	const dx = nearestTargetX - source.x;
	const dy = target.y - source.y;

	return getDirectionFromDelta(target.y, dx, dy);
};

const getKnuckleNibPushPath = (G: Game, source: Creature, target: Creature) => {
	if (!target.stats.moveable) {
		return [];
	}

	const maxPushDistance = getKnuckleNibPushDistance(target);
	if (maxPushDistance < 1) {
		return [];
	}

	const direction = getKnuckleNibPushDirection(source, target);
	const line = G.grid.getHexLine(target.x, target.y, direction, false).slice(1);
	const pushPath: Hex[] = [];

	for (const hex of line) {
		if (!hex.isWalkable(target.size, target.id, true)) {
			break;
		}

		pushPath.push(hex);
		if (pushPath.length >= maxPushDistance) {
			break;
		}
	}

	return pushPath;
};

const getKnuckleNibPushPreviewHexes = (G: Game, source: Creature, target: Creature) => {
	const pushPath = getKnuckleNibPushPath(G, source, target);
	if (!pushPath.length) {
		return [];
	}

	const direction = getKnuckleNibPushDirection(source, target);
	const impactX = getKnuckleNibImpactX(source, target);
	const line = G.grid.getHexLine(impactX, target.y, direction, false).slice(1);
	const previewHexes: Hex[] = [];
	let remainingPushHexes = pushPath.length;

	for (const hex of line) {
		previewHexes.push(hex);

		if (hex.creature !== target) {
			remainingPushHexes--;
		}

		if (remainingPushHexes <= 0) {
			break;
		}
	}

	return previewHexes;
};

const getUpgradedMeatSickleTargetChoices = (G: Game, creature: Creature, targetTeam: Team) =>
	meatSickleAllDirections
		.map((direction) => {
			const path = getMeatSicklePath(
				G,
				creature,
				direction,
				meatSickleInlineDirections.includes(direction) ? 5 : 1,
			);

			for (let i = 0; i < path.length; i++) {
				const blockingCreature = path[i].creature;
				if (!blockingCreature) {
					continue;
				}

				if (isTeam(creature, blockingCreature, targetTeam) && blockingCreature.stats.moveable) {
					return path.slice(0, i + 1);
				}

				return undefined;
			}

			return undefined;
		})
		.filter((choice): choice is Hex[] => Array.isArray(choice));

const hornHeadHealthBeforeHit = new Map<number, number>();
const hornHeadPredictedHitDamage = new Map<number, number>();

const getMeatSickleDirectionFromPath = (
	G: Game,
	creature: Creature,
	path: Hex[],
): Direction | undefined => {
	const firstHex = path[0];

	if (!firstHex) {
		return undefined;
	}

	return meatSickleAllDirections.find(
		(direction) => getMeatSicklePath(G, creature, direction, 1)[0]?.pos === firstHex.pos,
	);
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
	ability: { _inDirectionTest?: boolean; _abilityRangeHexes?: Hex[] },
	hexes: Hex[],
	callback: () => boolean,
) => {
	ability._inDirectionTest = true;
	const result = callback();
	ability._inDirectionTest = false;
	ability._abilityRangeHexes = uniqueHexes(hexes);
	return result;
};

const applyMovementRestriction = (source: Creature, target: Creature, G: Game) => {
	// Single-stage self-modifying effect:
	// - Blocks movement abilities as soon as applied (findEffect finds it immediately).
	// - When the foe's next turn starts (onStartPhase), switches its own deleteTrigger
	//   so it expires at the end of that same turn.
	target.removeEffect(meatSickleRestrictionEffectName);
	const effect = new Effect(
		meatSickleRestrictionEffectName,
		source,
		target,
		'onStartPhase',
		{
			alterations: {},
			effectFn: function (eff) {
				// Foe's turn has started; schedule expiry at end of this turn.
				eff.deleteTrigger = 'onEndPhase';
				eff.turnLifetime = 0;
				eff.creationTurn = G.turn;
				eff.trigger = ''; // prevent effectFn from firing again
			},
			deleteTrigger: '',
			turnLifetime: -1,
			creationTurn: G.turn,
			stackable: false,
			deleteOnOwnerDeath: true,
		},
		G,
	);
	// disableHint=true suppresses the floating tooltip when the effect is applied.
	target.addEffect(effect, undefined, undefined, false, true);
	G.log(`%CreatureName${target.id}% will be unable to use movement abilities on its next turn`);
};

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default (G: Game) => {
	G.abilities[8] = [
		{
			trigger: 'onUnderAttack',
			showHoverPreviewRange: true,

			require: function () {
				return true;
			},

			activate: function (damage: Damage) {
				if (!(damage instanceof Damage) || damage.target !== this.creature) {
					return damage;
				}

				hornHeadHealthBeforeHit.set(this.creature.id, this.creature.health);
				const predictedDamage = damage.applyDamage()?.total ?? 0;
				hornHeadPredictedHitDamage.set(this.creature.id, predictedDamage);

				const ability = this;
				this.creature.removeEffect(hornHeadLifeSupportTrackerEffectName);
				this.creature.addEffect(
					new Effect(
						hornHeadLifeSupportTrackerEffectName,
						ability.creature,
						ability.creature,
						'onDamage',
						{
							effectFn: function (effect, effectArg) {
								const damageEvent = effectArg as Damage;
								if (!(damageEvent instanceof Damage) || damageEvent.target !== ability.creature) {
									return;
								}

								const trackedHealth =
									hornHeadHealthBeforeHit.get(ability.creature.id) ?? ability.creature.health;
								const healthDamageTaken = Math.max(0, trackedHealth - ability.creature.health);
								hornHeadHealthBeforeHit.delete(ability.creature.id);
								hornHeadPredictedHitDamage.delete(ability.creature.id);

								const enduranceGain = Math.floor(healthDamageTaken / 2);
								if (enduranceGain > 0) {
									ability.creature.addEffect(
										new Effect(
											ability.title,
											ability.creature,
											ability.creature,
											'',
											{
												alterations: {
													endurance: enduranceGain,
												},
												stackable: true,
												turnLifetime: -1,
											},
											G,
										),
										undefined,
										undefined,
										true,
										true,
									);
								}

								effect.deleteEffect();
							},
							deleteTrigger: 'onEndPhase',
							turnLifetime: 1,
							stackable: false,
							deleteOnOwnerDeath: true,
						},
						G,
					),
					undefined,
					undefined,
					true,
					true,
				);

				return damage;
			},

			interceptDeath: function () {
				if (!this.isUpgraded()) {
					return false;
				}

				const healthBeforeHit =
					hornHeadHealthBeforeHit.get(this.creature.id) ?? this.creature.health;
				const predictedDamage = hornHeadPredictedHitDamage.get(this.creature.id) ?? healthBeforeHit;
				const healthDamageToLeaveOne = Math.max(0, healthBeforeHit - 1);
				const enduranceShieldCost = Math.max(1, predictedDamage - healthDamageToLeaveOne);

				if (this.creature.endurance < enduranceShieldCost) {
					return false;
				}

				this.creature.endurance = Math.max(0, this.creature.endurance - enduranceShieldCost);
				this.creature.health = 1;
				hornHeadPredictedHitDamage.delete(this.creature.id);

				G.log(
					`%CreatureName${this.creature.id}% converts lethal damage into endurance loss (${enduranceShieldCost})`,
				);

				this.creature.hint(this.title, 'msg_effects');
				this.creature.updateHealth();

				return true;
			},
		},
		{
			trigger: 'onQuery',

			_targetTeam: Team.Enemy,

			require: function () {
				const targetHexes = this.creature.getHexMap(matrices.frontnback2hex, false);
				this._abilityRangeHexes = targetHexes;

				if (!this.testRequirements()) {
					return false;
				}

				return this.atLeastOneTarget(targetHexes, {
					team: this._targetTeam,
				});
			},

			query: function () {
				const ability = this;
				let previewHexes: Hex[] = [];
				const clearPreview = () => {
					previewHexes.forEach((hex) => {
						hex.cleanDisplayVisualState('dashed');
					});
					previewHexes = [];
				};

				G.grid.queryCreature({
					fnOnConfirm: function (...args) {
						clearPreview();
						ability.animation(...args);
					},
					fnOnSelect: function (target: Creature) {
						clearPreview();
						target.tracePosition({
							overlayClass: 'creature selected player' + target.team,
						});

						if (!ability.isUpgraded()) {
							return;
						}

						previewHexes = getKnuckleNibPushPreviewHexes(G, ability.creature, target);
						previewHexes.forEach((hex) => {
							hex.displayVisualState('dashed');
						});
					},
					fnOnCancel: function () {
						clearPreview();
					},
					team: this._targetTeam,
					id: this.creature.id,
					flipped: this.creature.player.flipped,
					hexes: this.creature.getHexMap(matrices.frontnback2hex, false),
				});
			},

			activate: function (target: Creature) {
				const ability = this;
				const pushPath = this.isUpgraded()
					? getKnuckleNibPushPath(G, ability.creature, target)
					: [];
				const pushHex = pushPath[pushPath.length - 1];

				ability.end(false, !!pushHex);
				G.Phaser.camera.shake(0.01, 80, true, G.Phaser.camera.SHAKE_HORIZONTAL, true);

				const result = target.takeDamage(new Damage(ability.creature, ability.damages, 1, [], G));

				if (!result.kill) {
					target.replaceEffect(
						new Effect(
							ability.title,
							ability.creature,
							target,
							'',
							{
								alterations: {
									defense: -2,
								},
								deleteTrigger: 'onEndPhase',
								turnLifetime: 1,
								creationTurn: G.turn,
								stackable: true,
								deleteOnOwnerDeath: true,
							},
							G,
						),
					);

					if (pushHex) {
						target.moveTo(pushHex, {
							ignoreMovementPoint: true,
							ignorePath: true,
							animation: 'push',
							callback: function () {
								G.activeCreature.queryMove();
							},
						});
						return;
					}
				}

				G.activeCreature.queryMove();
			},
		},
		{
			trigger: 'onQuery',

			_targetTeam: Team.Enemy,

			_getMaxDistance: function () {
				return this.isUpgraded() ? 1 : 2;
			},

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				if (!this.creature.stats.moveable) {
					this.message = G.msg.abilities.notMoveable;
					return false;
				}

				if (!this.isUpgraded()) {
					return this.testDirection({
						team: this._targetTeam,
						sourceCreature: this.creature,
						flipped: this.creature.player.flipped,
						directions: [0, 1, 0, 0, 1, 0],
						distance: 5,
						minDistance: this._getMaxDistance(),
						optTest: (creature: Creature) => creature.stats.moveable,
					});
				}

				const choices = getUpgradedMeatSickleChoices(G, this.creature);
				const targetChoices = getUpgradedMeatSickleTargetChoices(
					G,
					this.creature,
					this._targetTeam,
				);

				return preserveAbilityRangeHexes(this, choices.flat(), () => {
					if (targetChoices.length > 0) {
						this.message = '';
						return true;
					}

					this.message = G.msg.abilities.noTarget;
					return false;
				});
			},

			query: function () {
				const ability = this;

				if (!this.isUpgraded()) {
					G.grid.queryDirection({
						fnOnConfirm: function (...args) {
							ability.animation(...args);
						},
						team: this._targetTeam,
						id: this.creature.id,
						sourceCreature: this.creature,
						flipped: this.creature.player.flipped,
						x: this.creature.x,
						y: this.creature.y,
						directions: [0, 1, 0, 0, 1, 0],
						distance: 5,
						minDistance: this._getMaxDistance(),
						optTest: (creature: Creature) => creature.stats.moveable,
					});
					return;
				}

				const choices = getUpgradedMeatSickleTargetChoices(G, this.creature, this._targetTeam);

				G.grid.queryChoice({
					fnOnConfirm: function () {
						// eslint-disable-next-line prefer-rest-params
						ability.animation(...arguments);
					},
					team: Team.Both,
					requireCreature: 0,
					id: this.creature.id,
					flipped: this.creature.player.flipped,
					choices,
				});
			},

			activate: function (path, args) {
				const ability = this;
				const target = path.find((hex) => hex.creature)?.creature;
				const queryDirection = args?.direction as Direction;
				const direction = meatSickleAllDirections.includes(queryDirection)
					? queryDirection
					: getMeatSickleDirectionFromPath(G, this.creature, path);

				if (!target || direction === undefined) {
					return;
				}

				ability.end(false, true);

				if (target.isDarkPriest() && target.hasCreaturePlayerGotPlasma()) {
					target.takeDamage(new Damage(ability.creature, { slash: 1 }, 1, [], G));
					G.activeCreature.queryMove();
					return;
				}

				const line = G.grid.getHexLine(
					getMeatSickleStartX(this.creature, direction),
					this.creature.y,
					direction,
					this.creature.player.flipped,
				);
				const dragsToRight =
					direction === Direction.UpRight ||
					direction === Direction.Right ||
					direction === Direction.DownRight;
				const landingIndex = dragsToRight ? target.size : 1;
				const landingHex = line[landingIndex];
				const targetIndex = line.findIndex(
					(hex, index) => index > 0 && hex.creature?.id === target.id,
				);
				const pulledHexes = Math.max(0, targetIndex - 1);
				const movementDrain = Math.min(target.stats.movement, pulledHexes);
				const damageHexes = Math.max(0, pulledHexes - movementDrain);

				if (this.isUpgraded() && targetIndex === 1) {
					target.takeDamage(
						new Damage(ability.creature, { pierce: ability.damages.pierce }, 1, [], G),
					);
					applyMovementRestriction(ability.creature, target, G);
					G.activeCreature.queryMove();
					return;
				}

				if (!landingHex || (targetIndex <= 1 && !this.isUpgraded())) {
					if (this.isUpgraded() && targetIndex === 1) {
						// Melee attack with upgraded - apply movement ability restriction
						applyMovementRestriction(ability.creature, target, G);
					}
					G.activeCreature.queryMove();
					return;
				}

				target.moveTo(landingHex, {
					ignoreMovementPoint: true,
					ignorePath: true,
					callback: function () {
						if (movementDrain > 0) {
							target.replaceEffect(
								new Effect(
									ability.title,
									ability.creature,
									target,
									'onStartPhase',
									{
										effectFn: function (effect, creatureOrHexOrDamage) {
											const affectedCreature = creatureOrHexOrDamage as Creature;
											if (!(affectedCreature instanceof Creature)) {
												return;
											}

											affectedCreature.remainingMove = Math.max(
												0,
												affectedCreature.remainingMove - movementDrain,
											);
											effect.deleteEffect();
										},
										deleteTrigger: '',
										turnLifetime: -1,
										stackable: false,
										deleteOnOwnerDeath: true,
									},
									G,
								),
							);

							G.log(`%CreatureName${target.id}% will lose ${movementDrain} movement next turn`);
						}

						if (damageHexes > 0) {
							target.takeDamage(
								new Damage(
									ability.creature,
									{ pierce: damageHexes * ability.damages.pierce },
									1,
									[],
									G,
								),
							);
						}

						G.activeCreature.queryMove();
					},
				});
			},
		},
		{
			trigger: 'onQuery',

			_targetTeam: Team.Enemy,

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				const frontChoice = getFrontLanes(this.creature);
				const backChoice = getBackLanes(this.creature);
				const rangeHexes = [...frontChoice, ...backChoice];
				const ownHexPositions = new Set(
					this.creature.hexagons.map((hex: Hex) => `${hex.x}:${hex.y}`),
				);
				const hoverRangeHexes = uniqueHexes(
					rangeHexes.filter((hex) => !ownHexPositions.has(`${hex.x}:${hex.y}`)),
				);
				return preserveAbilityRangeHexes(this, hoverRangeHexes, () => {
					if (
						this.atLeastOneTarget(frontChoice, { team: this._targetTeam }) ||
						this.atLeastOneTarget(backChoice, { team: this._targetTeam })
					) {
						this.message = '';
						return true;
					}

					this.message = G.msg.abilities.noTarget;
					return false;
				});
			},

			query: function () {
				const ability = this;
				const frontChoice = getFrontLanes(this.creature);
				const backChoice = getBackLanes(this.creature);
				const showOutlinedChoices = (choices: Hex[][]) => {
					const allChoiceHexes = choices.reduce(
						(acc: Hex[], choice: Hex[]) => acc.concat(choice),
						[],
					);
					allChoiceHexes.forEach((hex: Hex) => {
						hex.cleanOverlayVisualState();
						hex.cleanDisplayVisualState('dashed');
						hex.displayVisualState('dashed');
					});
				};
				const fillHoveredChoice = (choice: Hex[]) => {
					showOutlinedChoices([frontChoice, backChoice]);
					choice.forEach((hex: Hex) => {
						hex.cleanDisplayVisualState('dashed');
						if (hex.creature instanceof Creature) {
							hex.displayVisualState('creature selected player' + hex.creature.team);
						} else {
							hex.overlayVisualState('reachable h_player' + G.activeCreature.team);
						}
					});
				};

				const choices = [frontChoice, backChoice];

				G.grid.queryChoice({
					fnOnConfirm: function (...args) {
						ability.animation(...args);
					},
					fnOnSelect: function (choice: Hex[]) {
						fillHoveredChoice(choice);
					},
					team: Team.Both,
					requireCreature: 0,
					id: this.creature.id,
					flipped: this.creature.player.flipped,
					choices,
					targeting: false,
					callbackAfterQueryHexes: function () {
						showOutlinedChoices(choices);
					},
				});
			},

			activate: function (targetHexes: Hex[]) {
				const ability = this;
				const frontLanes = getFrontLanes(this.creature);
				const backLanes = getBackLanes(this.creature);
				const isBackSwipe = backLanes.some((laneHex) =>
					targetHexes.some((selectedHex) => selectedHex.pos === laneHex.pos),
				);
				const laneHexes = isBackSwipe ? backLanes : frontLanes;

				const getUniqueEnemyTargets = (hexes: Hex[]) => {
					const hitIds = new Set<number>();
					const targets: Creature[] = [];
					for (const hex of hexes) {
						const creature = hex.creature;
						if (!(creature instanceof Creature)) {
							continue;
						}
						if (!isTeam(ability.creature, creature, Team.Enemy) || hitIds.has(creature.id)) {
							continue;
						}
						hitIds.add(creature.id);
						targets.push(creature);
					}
					return targets;
				};

				const damageTargets = (
					targets: Creature[],
					damages: Partial<typeof ability.damages>,
					ignoreRetaliation = false,
				) => {
					for (const target of targets) {
						if (target.dead) {
							continue;
						}
						target.takeDamage(new Damage(ability.creature, damages, 1, [], G), {
							ignoreRetaliation,
						});

						if (this.isUpgraded()) {
							ability.creature.addEffect(
								new Effect(
									ability.title,
									ability.creature,
									ability.creature,
									'',
									{
										alterations: {
											offense: 1,
										},
										stackable: true,
										turnLifetime: -1,
									},
									G,
								),
								undefined,
								undefined,
								true,
								true,
							);
						}
					}
				};

				G.Phaser.camera.shake(0.01, 100, true, G.Phaser.camera.SHAKE_HORIZONTAL, true);

				for (let hit = 0; hit < 2; hit++) {
					const meleeTargets = getUniqueEnemyTargets(laneHexes);
					damageTargets(meleeTargets, ability.damages);
				}

				this.end();
				G.grid.xray(new Hex(0, 0, null, G));
			},
		},
	];
};
