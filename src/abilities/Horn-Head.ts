import { Damage } from '../damage';
import { Effect } from '../effect';
import Game from '../game';
import { Creature } from '../creature';
import { Direction, Hex } from '../utility/hex';
import * as matrices from '../utility/matrices';
import { getDirectionFromDelta } from '../utility/position';
import { isTeam, Team } from '../utility/team';
import { HEX_WIDTH_PX } from '../utility/const';

const getDualSwipeChoiceFromAnchor = (G: Game, anchor: Hex, directions: Direction[]) =>
	directions
		.map((direction) => G.grid.getHexLine(anchor.x, anchor.y, direction, false)[1])
		.filter((hex): hex is Hex => Boolean(hex));

const getDualSwipeChoices = (G: Game, creature: Creature): [Hex[], Hex[]] => {
	const occupiedHexes = [...creature.hexagons].sort((a, b) => a.x - b.x || a.y - b.y);
	if (occupiedHexes.length === 0) {
		return [[], []];
	}

	const leftAnchor = occupiedHexes[0];
	const rightAnchor = occupiedHexes[occupiedHexes.length - 1];

	const leftChoice = getDualSwipeChoiceFromAnchor(G, leftAnchor, [
		Direction.UpLeft,
		Direction.Left,
		Direction.DownLeft,
	]);
	const rightChoice = getDualSwipeChoiceFromAnchor(G, rightAnchor, [
		Direction.UpRight,
		Direction.Right,
		Direction.DownRight,
	]);

	return [leftChoice, rightChoice];
};

const getDualSwipeViableChoices = (creature: Creature, targetTeam: Team, choices: [Hex[], Hex[]]) =>
	choices.filter((choice) =>
		choice.some((hex) => {
			const target = hex.creature;
			return Boolean(target && target.id !== creature.id && isTeam(creature, target, targetTeam));
		}),
	);

const getDualSwipeHoverRangeHexes = (allChoices: [Hex[], Hex[]], viableChoices: Hex[][]) =>
	viableChoices.length > 0 ? viableChoices.flat() : allChoices.flat();

const meatSickleRestrictionEffectName = 'Meat Sickle Restriction';
const hornHeadLifeSupportTrackerEffectName = 'Life Support Damage Tracker';
const meatSickleInlineDirections = [Direction.Right, Direction.Left];
type MeatSickleChoice = Hex[] & { meatSickleDirection?: Direction };

const asMeatSickleChoice = (hexes: Hex[], direction: Direction): MeatSickleChoice => {
	const choice = [...hexes] as MeatSickleChoice;
	choice.meatSickleDirection = direction;
	return choice;
};

const getMeatSickleStartX = (creature: Creature, direction: Direction) => {
	if (
		(!creature.player.flipped && direction > Direction.DownRight) ||
		(creature.player.flipped && direction < Direction.DownLeft)
	) {
		return creature.x - (creature.size - 1);
	}

	return creature.x;
};

const getMeatSicklePath = (G: Game, creature: Creature, direction: Direction, distance: number) => {
	// HexGrid.getHexLine already inverts its own `flipped` handling for
	// Direction.Left internally, so Direction.Left/Direction.Right resolve to
	// the correct "backward"/"forward" side for a flipped creature without any
	// extra remapping here. Remapping Left -> Right for flipped creatures (as
	// this used to do) canceled out that built-in correction and made the
	// "backward" query resolve to the exact same line as "forward" — a flipped
	// (blue) Horn Head could never hit anything actually behind it.
	const rawLine = G.grid.getHexLine(
		getMeatSickleStartX(creature, direction),
		creature.y,
		direction,
		creature.player.flipped,
	);
	// Skip any of the caster's own hexagons at the very start of the line so the
	// first path hex is always a hex adjacent to the caster, never the caster
	// itself. A size-2 flipped creature can have two of its own hexes at the
	// line's start (e.g. the DownLeft/Left/UpLeft directions), and a naive
	// slice(1) would leave the caster's other hex as the "first hexagon" of the
	// path — clicking it (the caster) would never trigger the ability.
	let startIndex = 0;
	while (
		startIndex < rawLine.length &&
		rawLine[startIndex].creature &&
		rawLine[startIndex].creature.id === creature.id
	) {
		startIndex++;
	}
	return rawLine.slice(startIndex, startIndex + distance);
};

const getMeatSickleLanding = (line: Hex[], target: Creature, targetIndex: number) => {
	// Search from the first path hex to find closest walkable spot toward caster
	const landingStartIndex = 0;
	const landingEndIndex = target.size > 1 && targetIndex === 1 ? targetIndex : targetIndex - 1;

	for (let index = landingStartIndex; index <= landingEndIndex; index++) {
		const hex = line[index];
		if (hex?.isWalkable(target.size, target.id, true)) {
			return { landingHex: hex, landingIndex: index };
		}
	}

	return { landingHex: undefined, landingIndex: -1 };
};

const _getUpgradedMeatSickleChoices = (G: Game, creature: Creature) =>
	meatSickleInlineDirections.map((direction) => getMeatSicklePath(G, creature, direction, 5));

const getMeatSickleDirectionMask = (direction: Direction) => {
	const directions = [0, 0, 0, 0, 0, 0];
	directions[direction] = 1;
	return directions;
};

const getMeatSickleChoiceDataForDirection = (
	G: Game,
	creature: Creature,
	targetTeam: Team,
	direction: Direction,
	requireCreature: boolean,
) =>
	G.grid.getDirectionChoices({
		team: targetTeam,
		requireCreature,
		id: creature.id,
		sourceCreature: creature,
		flipped: creature.player.flipped,
		x: creature.x,
		y: creature.y,
		directions: getMeatSickleDirectionMask(direction),
		distance: 5,
		minDistance: 1,
		includeCreature: true,
		stopOnCreature: true,
		optTest: (candidate: Creature) => candidate.stats.moveable,
	});

const getMeatSickleQueryChoiceData = (
	G: Game,
	creature: Creature,
	targetTeam: Team,
	requireCreature: boolean,
) => {
	if (typeof G.grid.getDirectionChoices !== 'function') {
		const fallbackChoices = requireCreature
			? getUpgradedMeatSickleTargetChoices(G, creature, targetTeam)
			: getMeatSickleQueryChoices(G, creature, targetTeam);
		return meatSickleInlineDirections.map((direction, index) => ({
			direction,
			choice: asMeatSickleChoice(fallbackChoices[index] ?? [], direction),
			hexesDashed: [],
			hexesDeadZone: [],
			shrunkenHexes: [],
		}));
	}

	return meatSickleInlineDirections.map((direction) => {
		const choiceData = getMeatSickleChoiceDataForDirection(
			G,
			creature,
			targetTeam,
			direction,
			requireCreature,
		);
		const choice = choiceData.choices[0] ?? [];
		return {
			direction,
			choice: asMeatSickleChoice(choice, direction),
			hexesDashed: choiceData.hexesDashed ?? [],
			hexesDeadZone: choiceData.hexesDeadZone ?? [],
			shrunkenHexes: choiceData.shrunkenHexes ?? [],
		};
	});
};

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
	meatSickleInlineDirections
		.map((direction) => {
			const path = getMeatSicklePath(G, creature, direction, 5);

			for (let i = 0; i < path.length; i++) {
				const blockingCreature = path[i].creature;
				if (!blockingCreature) {
					continue;
				}

				if (isTeam(creature, blockingCreature, targetTeam) && blockingCreature.stats.moveable) {
					const targetHexes = (blockingCreature.hexagons ?? []).filter(Boolean);
					return asMeatSickleChoice(
						uniqueHexes(path.slice(0, i + 1).concat(targetHexes)),
						direction,
					);
				}

				return undefined;
			}

			return undefined;
		})
		.filter((choice): choice is Hex[] => Array.isArray(choice));

const getMeatSickleQueryChoices = (G: Game, creature: Creature, targetTeam: Team) =>
	meatSickleInlineDirections.map((direction) => {
		const path = getMeatSicklePath(G, creature, direction, 5);

		for (let i = 0; i < path.length; i++) {
			const blockingCreature = path[i].creature;
			if (!blockingCreature) {
				continue;
			}

			if (isTeam(creature, blockingCreature, targetTeam) && blockingCreature.stats.moveable) {
				const targetHexes = (blockingCreature.hexagons ?? []).filter(Boolean);
				return asMeatSickleChoice(uniqueHexes(path.slice(0, i + 1).concat(targetHexes)), direction);
			}

			return asMeatSickleChoice(path.slice(0, i + 1), direction);
		}

		return asMeatSickleChoice(path, direction);
	});

const hornHeadHealthBeforeHit = new Map<number, number>();
const hornHeadPredictedHitDamage = new Map<number, number>();

const getMeatSickleDirectionFromPath = (
	G: Game,
	creature: Creature,
	path: Hex[],
	clickedHex?: Hex,
): Direction | undefined => {
	const probeHex = path[0] ?? clickedHex;

	if (!probeHex) {
		return undefined;
	}

	const sameHex = (a?: Hex, b?: Hex) => Boolean(a && b && a.x === b.x && a.y === b.y);

	// Try to find direction where this hex is the first hex in the path
	let direction = meatSickleInlineDirections.find((direction) =>
		sameHex(getMeatSicklePath(G, creature, direction, 1)[0], probeHex),
	);

	// If not found (e.g., clicking empty hex in middle of range), try to find the direction
	// where this hex appears anywhere in the path
	if (!direction) {
		direction = meatSickleInlineDirections.find((dir) => {
			const pathForDir = getMeatSicklePath(G, creature, dir, 5);
			return pathForDir.some((hex) => sameHex(hex, probeHex));
		});
	}

	return direction;
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

const getMeatSickleDirectionLabel = (direction: Direction) => {
	switch (direction) {
		case Direction.Left:
			return 'backward';
		case Direction.Right:
			return 'forward';
		default:
			return 'inline';
	}
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

const MEAT_SICKLE_CHAIN_KEY = 'object_chain';
const MEAT_SICKLE_HOOK_KEY = 'object_hook';

const getMeatSickleSpritesAvailable = (G: Game) => {
	const cache = G?.gameEngine?.cache;
	if (!cache) {
		return false;
	}
	const chainImg = cache.getImage(MEAT_SICKLE_CHAIN_KEY);
	const hookImg = cache.getImage(MEAT_SICKLE_HOOK_KEY);
	return Boolean(chainImg && hookImg);
};

const playMeatSickleHookEffect = (
	G: Game,
	sourceCreature: Creature,
	sourceHex: Hex,
	targetCreature: Creature,
	targetHex: Hex,
	durationMs: number,
	onComplete?: () => void,
) => {
	if (!getMeatSickleSpritesAvailable(G) || !G.grid?.creatureGroup) {
		if (onComplete) {
			onComplete();
		}
		return;
	}

	const chainHeight = 30;

	// Visual centers (including y) so the chain/hook can point at the target in any
	// direction — right, left, up, down or diagonal — with no separate mirroring.
	const getCreatureCenter = (creature: Creature, fallbackHex: Hex): { x: number; y: number } => {
		const grp = creature.creatureSprite?.grp;
		const sprite = creature.creatureSprite?.sprite;
		if (grp && sprite) {
			return { x: grp.x + sprite.x, y: grp.y + sprite.y - sprite.texture.height / 2 };
		}
		return {
			x: (fallbackHex.displayPos.x ?? 0) + HEX_WIDTH_PX / 2 + 5,
			y: (fallbackHex.displayPos.y ?? 0) + 15,
		};
	};

	const targetCenter = getCreatureCenter(targetCreature, targetHex);

	// Origin: Horn Head's left wrist. The coordinates (150, 150) are pixels on the
	// creature's cardboard sprite image (top-left origin). The sprite is bottom-
	// anchored, so we map the image pixel into the group's coordinate space using
	// the sprite's on-screen position. Horn Head's offset-y is negative, so the
	// resulting y offset from the group origin is negative — the wrist sits above
	// the group origin, never below it.
	const sourceSprite = sourceCreature.creatureSprite?.sprite;
	const MEAT_SICKLE_LAUNCH_PIXEL_X = 169;
	const MEAT_SICKLE_LAUNCH_PIXEL_Y = 23;
	const launchPoint = (() => {
		const grp = sourceCreature.creatureSprite?.grp;
		if (grp && sourceSprite) {
			// The sprite is mirrored when the creature is flipped, so the wrist
			// pixel (measured from the image's left edge) is mirrored too — the
			// emit point must come from the side the creature is actually facing.
			const flipped = sourceSprite.scale.x < 0;
			const launchPixelX = flipped
				? sourceSprite.texture.width - MEAT_SICKLE_LAUNCH_PIXEL_X
				: MEAT_SICKLE_LAUNCH_PIXEL_X;
			const imageTopX = sourceSprite.x - sourceSprite.texture.width / 2;
			const imageTopY = sourceSprite.y - sourceSprite.texture.height;
			return {
				x: grp.x + imageTopX + launchPixelX,
				y: grp.y + imageTopY + MEAT_SICKLE_LAUNCH_PIXEL_Y,
			};
		}
		const fallbackX = sourceCreature.player.flipped
			? (sourceHex.displayPos.x ?? 0) - MEAT_SICKLE_LAUNCH_PIXEL_X
			: (sourceHex.displayPos.x ?? 0) + MEAT_SICKLE_LAUNCH_PIXEL_X;
		return {
			x: fallbackX,
			y: (sourceHex.displayPos.y ?? 0) - MEAT_SICKLE_LAUNCH_PIXEL_Y,
		};
	})();

	// Direction vector from the wrist toward the target, used to aim the launch.
	const totalDistance = Math.max(
		1,
		Math.hypot(targetCenter.x - launchPoint.x, targetCenter.y - launchPoint.y),
	);
	const dirX = Math.cos(Math.atan2(targetCenter.y - launchPoint.y, targetCenter.x - launchPoint.x));
	const dirY = Math.sin(Math.atan2(targetCenter.y - launchPoint.y, targetCenter.x - launchPoint.x));

	// Render the chain and hook in their own group appended after the creature
	// group, so they always draw on top of Horn Head and the (dragged) target
	// regardless of depth re-sorting during movement.
	const fxGroup = G.gameEngine.add.group(G.grid.display, 'meatSickleFxGrp');

	// Chain: a single tileable sprite that *emits* from the wrist. Its length grows
	// from the emission point toward the hook and its texture scrolls every frame so
	// the links keep flowing outward (loopable) instead of popping out in chunks.
	const chain = G.gameEngine.add.tileSprite(
		launchPoint.x,
		launchPoint.y,
		0,
		chainHeight,
		MEAT_SICKLE_CHAIN_KEY,
	);
	fxGroup.add(chain);
	chain.anchor.setTo(0, 0.5);
	chain.visible = false;

	const hook = fxGroup.create(launchPoint.x, launchPoint.y, MEAT_SICKLE_HOOK_KEY);
	hook.anchor.setTo(0.5, 0.5);
	hook.alpha = 0;

	let active = true;
	const stop = () => {
		active = false;
		fxGroup.destroy();
	};

	const HOOK_HALF_LENGTH = 40;

	// Draw the chain from the emission point up to the hook's back edge (flush, no
	// overlap) and rotate everything to face the current hook position. Recomputing
	// the angle every frame keeps the connection intact and stops the chain from
	// swinging loose while the hooked unit is dragged around.
	const renderAt = (hookX: number, hookY: number, hookAlpha: number) => {
		const dx = hookX - launchPoint.x;
		const dy = hookY - launchPoint.y;
		const angleNow = Math.atan2(dy, dx);
		const dist = Math.hypot(dx, dy);
		const chainLength = Math.max(0, dist - HOOK_HALF_LENGTH);

		chain.x = launchPoint.x;
		chain.y = launchPoint.y;
		chain.rotation = angleNow;
		chain.width = chainLength;
		chain.visible = chainLength > 1;
		// Anchor the tile pattern at the *far* (hook) end so the chain extrudes new
		// links out of the emission point as it grows/reels, instead of popping in
		// whole tiles at the tip.
		chain.tilePositionX = -chainLength;

		hook.x = hookX;
		hook.y = hookY;
		hook.rotation = angleNow;
		hook.alpha = hookAlpha;
	};

	const startTime = Date.now();
	const flyStep = () => {
		if (!active) {
			return;
		}
		const progress = Math.min(1, (Date.now() - startTime) / durationMs);
		const easing = 1 - Math.pow(1 - progress, 3);
		// Chain and hook extend together at the same speed during the launch. The
		// hook starts transparent at the emission point and fades in as it travels.
		const hookDistance = totalDistance * easing;
		renderAt(
			launchPoint.x + dirX * hookDistance,
			launchPoint.y + dirY * hookDistance,
			Math.min(1, progress * 2),
		);

		if (progress < 1) {
			setTimeout(flyStep, 16);
			return;
		}

		// Reeling phase: hook stays latched to the target (moving with it at the same
		// speed) while the chain reels in behind it. We render at the target's live
		// position every frame so the hook never drifts or swings loose.
		hook.alpha = 1;
		const track = () => {
			if (!active) {
				return;
			}
			const tc = getCreatureCenter(targetCreature, targetHex);
			renderAt(tc.x, tc.y, 1);
			setTimeout(track, 16);
		};
		track();
		if (onComplete) {
			onComplete();
		}
	};

	flyStep();

	return stop;
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
			showHoverPreviewRange: true,

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
				G.gameEngine.cameras.main.shake(0.01, 80, true, G.gameEngine.cameras.main.SHAKE_HORIZONTAL, true);

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
				return 1;
			},

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				if (!this.creature.stats.moveable) {
					this.message = G.msg.abilities.notMoveable;
					return false;
				}

				const targetChoiceData = getMeatSickleQueryChoiceData(
					G,
					this.creature,
					this._targetTeam,
					true,
				);
				const choices = getMeatSickleQueryChoiceData(G, this.creature, this._targetTeam, false).map(
					(entry) => entry.choice,
				);
				const targetChoices = targetChoiceData
					.map((entry) => entry.choice)
					.filter((choice) => choice.length > 0);

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

				const allChoiceData = getMeatSickleQueryChoiceData(
					G,
					this.creature,
					this._targetTeam,
					false,
				);
				const targetChoiceData = getMeatSickleQueryChoiceData(
					G,
					this.creature,
					this._targetTeam,
					true,
				);
				const allChoices = allChoiceData.map((entry) => entry.choice);
				const choices = targetChoiceData
					.map((entry) => entry.choice)
					.filter((choice) => choice.length > 0);
				const dashedHexes = uniqueHexes(allChoiceData.flatMap((entry) => entry.hexesDashed));
				const deadZoneHexes = uniqueHexes(allChoiceData.flatMap((entry) => entry.hexesDeadZone));
				const shrunkenHexes = uniqueHexes(allChoiceData.flatMap((entry) => entry.shrunkenHexes));
				const showOutlinedChoices = (choiceSets: Hex[][]) => {
					const outlinedHexes = uniqueHexes(choiceSets.flat());
					outlinedHexes.forEach((hex: Hex) => {
						hex.cleanOverlayVisualState();
						hex.cleanDisplayVisualState(
							'adj creature selected player0 player1 player2 player3 dashed',
						);
						if (hex.creature instanceof Creature) {
							hex.displayVisualState('creature player' + hex.creature.team);
						}
					});
				};
				const fillHoveredChoice = (choice: Hex[]) => {
					showOutlinedChoices(allChoices);
					choice.forEach((hex: Hex) => {
						hex.cleanOverlayVisualState();
						hex.cleanDisplayVisualState(
							'adj creature selected player0 player1 player2 player3 dashed',
						);
						if (hex.creature instanceof Creature) {
							hex.overlayVisualState('hover h_player' + hex.creature.team);
						} else {
							hex.displayVisualState('adj');
						}
					});
				};

				G.grid.queryChoice({
					fnOnConfirm: function (choice: MeatSickleChoice, confirmArgs) {
						if (choice.meatSickleDirection !== undefined) {
							confirmArgs.direction = choice.meatSickleDirection;
						}
						ability.animation(choice, confirmArgs);
					},
					fnOnSelect: function (choice: Hex[]) {
						fillHoveredChoice(choice);
					},
					fnOnHoverOutside: function () {
						showOutlinedChoices(allChoices);
					},
					team: Team.Both,
					requireCreature: 0,
					id: this.creature.id,
					flipped: this.creature.player.flipped,
					choices,
					hexesDashed: dashedHexes,
					hexesDeadZone: deadZoneHexes,
					shrunkenHexes,
					targeting: false,
					callbackAfterQueryHexes: function () {
						showOutlinedChoices(allChoices);
					},
				});
			},

			activate: function (path, args) {
				const ability = this;
				const queryDirection = args?.direction as Direction;
				const selectedHex = args?.hex as Hex | undefined;
				const selectedPathHead = path?.[0] as Hex | undefined;
				const sameHex = (a?: Hex, b?: Hex) => Boolean(a && b && a.x === b.x && a.y === b.y);
				const directionFromPath = getMeatSickleDirectionFromPath(
					G,
					this.creature,
					path,
					selectedHex,
				);
				const direction =
					directionFromPath ??
					(meatSickleInlineDirections.includes(queryDirection) ? queryDirection : undefined);

				if (direction === undefined) {
					return;
				}

				const hasSelectionOnLine = (line: Hex[]) =>
					(!selectedHex && !selectedPathHead) ||
					line.some((hex) => sameHex(hex, selectedHex) || sameHex(hex, selectedPathHead));

				const findTargetOnLine = (line: Hex[]) =>
					line.findIndex(
						(hex) =>
							Boolean(hex) &&
							hex.creature?.id !== this.creature.id &&
							hex.creature?.stats?.moveable,
					);

				let line = getMeatSicklePath(G, this.creature, direction, 5);
				let targetIndex = findTargetOnLine(line);

				if (targetIndex < 0) {
					const fallbackDirection = meatSickleInlineDirections.find((dir) => dir !== direction);
					if (fallbackDirection !== undefined) {
						const fallbackLine = getMeatSicklePath(G, this.creature, fallbackDirection, 5);
						const fallbackTargetIndex = findTargetOnLine(fallbackLine);
						if (fallbackTargetIndex > -1 && hasSelectionOnLine(fallbackLine)) {
							line = fallbackLine;
							targetIndex = fallbackTargetIndex;
						}
					}
				}

				if (targetIndex < 0) {
					G.activeCreature.queryMove();
					return;
				}

				const target = line[targetIndex].creature;

				if (!target) {
					G.activeCreature.queryMove();
					return;
				}

				ability.end(true, true);

				if (target.isDarkPriest() && target.hasCreaturePlayerGotPlasma()) {
					target.takeDamage(new Damage(ability.creature, { slash: 1 }, 1, [], G));
				}

				const directionLabel = getMeatSickleDirectionLabel(direction);

				const targetHookHex = line[targetIndex] ?? target.hexagons?.[0] ?? line[0];
				const casterHookHex =
					this.creature.hexagons?.[0] ?? line[0] ?? target.hexagons?.[0] ?? targetHookHex;
				let cleanupMeatSickleEffect: (() => void) | null = null;

				const teardownMeatSickleEffect = () => {
					if (cleanupMeatSickleEffect) {
						cleanupMeatSickleEffect();
						cleanupMeatSickleEffect = null;
					}
				};

				let { landingHex, landingIndex } =
					targetIndex >= 0
						? getMeatSickleLanding(line, target, targetIndex)
						: { landingHex: undefined, landingIndex: -1 };

				// If no valid landing hex found, try the hex immediately before target (if walkable)
				if (!landingHex && targetIndex > 0) {
					const fallbackHex = line[targetIndex - 1];
					if (fallbackHex?.isWalkable(target.size, target.id, true)) {
						landingHex = fallbackHex;
						landingIndex = targetIndex - 1;
					}
				}
				const pulledHexes =
					landingHex && landingIndex > -1
						? Math.max(0, targetIndex - landingIndex + (landingIndex === targetIndex ? 1 : 0))
						: 0;
				const movementDrain = Math.min(target.stats.movement, pulledHexes);
				const damageHexes = Math.max(0, pulledHexes - movementDrain);

				if (!landingHex) {
					const cleanup = playMeatSickleHookEffect(
						G,
						this.creature,
						casterHookHex,
						target,
						targetHookHex,
						350,
					);
					if (typeof cleanup === 'function') {
						setTimeout(cleanup, 500);
					}
					G.log(
						`%CreatureName${
							ability.creature.id
						}% uses Meat Sickle ${directionLabel} on %CreatureName${target.id}% (${
							targetIndex === 0 ? 'melee hit' : 'no pull'
						})`,
					);
					// Apply direct hit damage at melee range; otherwise use pull-distance damage.
					if (targetIndex === 0 || damageHexes > 0) {
						const pierceDamage = targetIndex === 0 ? ability.damages.pierce : damageHexes;
						target.takeDamage(new Damage(ability.creature, { pierce: pierceDamage }, 1, [], G));
					}

					if (ability.isUpgraded()) {
						applyMovementRestriction(ability.creature, target, G);
					}

					G.activeCreature.queryMove();
					return;
				}

				// Play the hook + chain effect; the moveTo happens AFTER the hook
				// latches onto the target (in onComplete), so the chain+hook and
				// the dragged unit move together toward Horn Head in perfect sync.
				cleanupMeatSickleEffect =
					playMeatSickleHookEffect(
						G,
						this.creature,
						casterHookHex,
						target,
						targetHookHex,
						350,
						() => {
							G.log(
								`%CreatureName${
									ability.creature.id
								}% uses Meat Sickle ${directionLabel} on %CreatureName${
									target.id
								}% (pulled ${pulledHexes} hex${pulledHexes === 1 ? '' : 'es'})`,
							);
							target.moveTo(landingHex, {
								ignoreMovementPoint: true,
								ignorePath: true,
								callback: function () {
									teardownMeatSickleEffect();
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

										G.log(
											`%CreatureName${target.id}% will lose ${movementDrain} movement next turn`,
										);
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

									if (ability.isUpgraded()) {
										applyMovementRestriction(ability.creature, target, G);
									}

									G.activeCreature.queryMove();
								},
							});
						},
					) ?? null;
			},
		},
		{
			trigger: 'onQuery',

			_targetTeam: Team.Enemy,

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				const dualSwipeChoices = getDualSwipeChoices(G, this.creature);
				const viableChoices = getDualSwipeViableChoices(
					this.creature,
					this._targetTeam,
					dualSwipeChoices,
				);
				const rangeHexes = getDualSwipeHoverRangeHexes(dualSwipeChoices, viableChoices);
				const ownHexPositions = new Set(
					this.creature.hexagons.map((hex: Hex) => `${hex.x}:${hex.y}`),
				);
				const hoverRangeHexes = uniqueHexes(
					rangeHexes.filter((hex) => !ownHexPositions.has(`${hex.x}:${hex.y}`)),
				);
				return preserveAbilityRangeHexes(this, hoverRangeHexes, () => {
					if (viableChoices.length > 0) {
						this.message = '';
						return true;
					}

					this.message = G.msg.abilities.noTarget;
					return false;
				});
			},

			query: function () {
				const ability = this;
				const dualSwipeChoices = getDualSwipeChoices(G, this.creature);
				const viableChoices = getDualSwipeViableChoices(
					this.creature,
					this._targetTeam,
					dualSwipeChoices,
				);
				if (!viableChoices.length) {
					G.activeCreature.queryMove();
					return;
				}
				const showOutlinedChoices = (choices: Hex[][]) => {
					const allChoiceHexes = choices.reduce(
						(acc: Hex[], choice: Hex[]) => acc.concat(choice),
						[],
					);
					allChoiceHexes.forEach((hex: Hex) => {
						hex.cleanOverlayVisualState(
							'reachable weakDmg moveto selected hover ownCreatureHexShade h_player0 h_player1 h_player2 h_player3',
						);
						hex.cleanDisplayVisualState('adj creature player0 player1 player2 player3 dashed');
						if (hex.creature instanceof Creature) {
							hex.overlayVisualState('hover h_player' + hex.creature.team);
						}
					});
				};
				const fillHoveredChoice = (choice: Hex[]) => {
					showOutlinedChoices(viableChoices);
					choice.forEach((hex: Hex) => {
						hex.cleanOverlayVisualState(
							'reachable weakDmg moveto selected hover ownCreatureHexShade h_player0 h_player1 h_player2 h_player3',
						);
						hex.cleanDisplayVisualState('adj creature player0 player1 player2 player3 dashed');
						if (hex.creature instanceof Creature) {
							hex.displayVisualState('creature selected player' + hex.creature.team);
						} else {
							hex.displayVisualState('adj');
						}
					});
				};

				const choices = viableChoices;

				G.grid.queryChoice({
					fnOnConfirm: function (...args) {
						ability.animation(...args);
					},
					fnOnSelect: function (choice: Hex[]) {
						fillHoveredChoice(choice);
					},
					fnOnHoverOutside: function () {
						showOutlinedChoices(choices);
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
				const dualSwipeChoices = getDualSwipeChoices(G, this.creature);
				const viableChoices = getDualSwipeViableChoices(
					this.creature,
					this._targetTeam,
					dualSwipeChoices,
				);
				const laneHexes = viableChoices.find((choice) =>
					choice.some((laneHex) =>
						targetHexes.some((selectedHex) => selectedHex.pos === laneHex.pos),
					),
				);

				if (!laneHexes) {
					G.activeCreature.queryMove();
					return;
				}

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

				G.gameEngine.cameras.main.shake(0.01, 100, true, G.gameEngine.cameras.main.SHAKE_HORIZONTAL, true);

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
