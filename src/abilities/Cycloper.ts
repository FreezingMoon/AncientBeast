import { Damage } from '../damage';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import { Team, isTeam } from '../utility/team';
import * as arrayUtils from '../utility/arrayUtils';
import Game from '../game';
import type { Ability } from '../ability';
import type { UnitData } from '../data/types';

const CYCLOPER_UNIT_ID = 15;
const ACRYLIC_WALL_UNIT_ID = 999;
const ACRYLIC_WALL_TYPE = 'O0';
const ALL_DIRECTIONS: [1, 1, 1, 1, 1, 1] = [1, 1, 1, 1, 1, 1];
const APERTURE_NO_ENERGY_MESSAGE = 'Not enough energy for targets in range.';

type DirectionArgs = { direction?: number };
type CreatureDataEntry = UnitData[number];
type CycloperAbilityState = {
	_noAffordableApertureTargetInRange?: boolean;
};
type AcrylicWallRuntimeFlags = {
	hideFromQueue?: boolean;
	hideUnitStatsOnHover?: boolean;
	deathAnimationType?: string;
	hideFromCreatureCount?: boolean;
	_nextGameTurnActive?: number;
};

function getCycloperOrigin(cycloper: Creature) {
	return cycloper.player.flipped ? cycloper.hexagons[cycloper.size - 1] : cycloper.hexagons[0];
}

function getApertureEnergyCost(target: Creature, useCurrentHealth: boolean) {
	const sourceHealth = useCurrentHealth ? target.health : target.stats.health;
	return Math.max(1, Math.ceil(sourceHealth));
}

function isAcrylicWall(creature?: Creature | null) {
	return creature instanceof Creature && creature.type === ACRYLIC_WALL_TYPE;
}

function isShieldedDarkPriest(target: Creature | null | undefined, attacker: Creature) {
	return (
		target instanceof Creature &&
		target.type === '--' &&
		isTeam(attacker, target, Team.Enemy) &&
		target.player.plasma > 0
	);
}

function isRiotShieldUpgraded(cycloper: Creature) {
	const riotShield = cycloper.abilities?.[2];
	return Boolean(
		riotShield && typeof riotShield.isUpgraded === 'function' && riotShield.isUpgraded(),
	);
}

function isCycloperRelayWall(creature: Creature | null | undefined, cycloper: Creature) {
	return (
		creature instanceof Creature && isAcrylicWall(creature) && isTeam(cycloper, creature, Team.Ally)
	);
}

function isDamagedAlliedAcrylicWall(creature: Creature | null | undefined, cycloper: Creature) {
	return (
		creature instanceof Creature &&
		isAcrylicWall(creature) &&
		creature.team === cycloper.team &&
		creature.health < creature.stats.health
	);
}

function isDamagedAlliedOpticBurstTarget(
	creature: Creature | null | undefined,
	cycloper: Creature,
) {
	return (
		creature instanceof Creature &&
		isTeam(cycloper, creature, Team.Ally) &&
		creature.health < creature.stats.health
	);
}

function isValidOpticBurstTarget(cycloper: Creature, target: Creature, upgraded: boolean) {
	if (!upgraded) {
		return !isAcrylicWall(target) && isTeam(cycloper, target, Team.Enemy);
	}

	if (isTeam(cycloper, target, Team.Enemy)) {
		return !isAcrylicWall(target);
	}

	// Upgraded: wounded allies are valid heal targets.
	return isDamagedAlliedOpticBurstTarget(target, cycloper);
}

function shouldIgnoreOpticBurstTarget(cycloper: Creature, upgraded: boolean, target: Creature) {
	if (!isAcrylicWall(target) && isTeam(cycloper, target, Team.Ally)) {
		if (!upgraded) {
			return true;
		}

		// Upgraded: stop on wounded allies so they can be selected/healed.
		return !isDamagedAlliedOpticBurstTarget(target, cycloper);
	}

	if (!isAcrylicWall(target)) {
		return false; // enemies: never pierce
	}

	// Walls when not upgraded: always pierce
	if (!upgraded) {
		return true;
	}

	// Upgraded: pierce healthy walls, stop at damaged walls so they're clickable
	return !isDamagedAlliedAcrylicWall(target, cycloper);
}

function getOpticBurstEffectiveDistance(
	cycloper: Creature,
	target: Creature,
	path: Hex[],
	args: { direction?: number } | undefined,
	G: Game,
) {
	const directionalDistance = getTargetDistanceInDirection(cycloper, target, args?.direction, G);

	if (Number.isFinite(directionalDistance)) {
		const relayBonus = isRiotShieldUpgraded(cycloper)
			? countAlliedRelayWallsBeforeTarget(cycloper, target, args?.direction, G)
			: 0;
		const effectiveDistance = Math.max(0, directionalDistance - 1 - relayBonus);
		return effectiveDistance;
	}

	// Fallback when direction context is unavailable.
	const emptyHexDistance = arrayUtils.filterCreature(path.slice(0), false, false).length;
	const relayBonus = isRiotShieldUpgraded(cycloper)
		? countAlliedRelayWallsBeforeTarget(cycloper, target, args?.direction, G)
		: 0;

	const effectiveDistance = Math.max(0, emptyHexDistance - relayBonus);
	return effectiveDistance;
}

function countAlliedRelayWallsBeforeTarget(
	cycloper: Creature,
	target: Creature,
	direction: number | undefined,
	G: Game,
) {
	if (direction === undefined) {
		return 0;
	}

	const origin = getCycloperOrigin(cycloper);
	const line = G.grid.getHexLine(origin.x, origin.y, direction, cycloper.player.flipped);

	// Find target position in line
	let targetIndex = -1;
	for (let i = 0; i < line.length; i++) {
		if (line[i].creature === target || target.hexagons.includes(line[i])) {
			targetIndex = i;
			break;
		}
	}

	if (targetIndex <= 0) {
		return 0;
	}

	// Count all relay walls BETWEEN cycloper and target (not necessarily continuous)
	let relays = 0;

	for (let i = 1; i < targetIndex; i++) {
		const hex = line[i];
		if (isCycloperRelayWall(hex.creature, cycloper)) {
			relays++;
		}
	}

	return relays;
}

function getTargetDistanceInDirection(
	cycloper: Creature,
	target: Creature,
	direction: number | undefined,
	G: Game,
) {
	if (direction === undefined) {
		return Number.POSITIVE_INFINITY;
	}

	const origin = getCycloperOrigin(cycloper);
	const line = G.grid.getHexLine(origin.x, origin.y, direction, cycloper.player.flipped);

	let distance = 0;
	for (const hex of line) {
		distance++;
		if (hex.creature === target || target.hexagons.includes(hex)) {
			return distance;
		}
	}

	return Number.POSITIVE_INFINITY;
}

function hasRelayExtensionOnPath(
	cycloper: Creature,
	target: Creature,
	direction: number | undefined,
	baseRange: number,
	G: Game,
) {
	if (!isRiotShieldUpgraded(cycloper)) {
		return false;
	}

	const relayCount = countAlliedRelayWallsBeforeTarget(cycloper, target, direction, G);
	if (relayCount <= 0) {
		return false;
	}

	const targetDistance = getTargetDistanceInDirection(cycloper, target, direction, G);
	return targetDistance <= baseRange + 1;
}

function isApertureTargetInRange(
	cycloper: Creature,
	target: Creature,
	direction: number | undefined,
	baseRange: number,
	G: Game,
) {
	const targetDistance = getTargetDistanceInDirection(cycloper, target, direction, G);
	if (targetDistance <= baseRange) {
		return true;
	}

	return hasRelayExtensionOnPath(cycloper, target, direction, baseRange, G);
}

function getRiotShieldPlacementRange(cycloper: Creature, G: Game) {
	const baseRange = 3;
	const canRelayThroughWalls = isRiotShieldUpgraded(cycloper);
	const relayCount = canRelayThroughWalls
		? cycloper.player.creatures.filter(
				(candidate) =>
					candidate instanceof Creature &&
					!candidate.dead &&
					isCycloperRelayWall(candidate, cycloper),
		  ).length
		: 0;
	const scanDistance = baseRange + relayCount;
	const origin = getCycloperOrigin(cycloper);
	const result: Hex[] = [];
	const seen = new Set<string>();

	for (const direction of [0, 1, 2, 3, 4, 5]) {
		const line = G.grid.getHexLine(origin.x, origin.y, direction, cycloper.player.flipped);
		let effectiveDistance = 0;
		let scannedSteps = 0;

		for (const hex of line) {
			if (hex.creature === cycloper) {
				continue;
			}

			scannedSteps++;
			if (scannedSteps > scanDistance) {
				break;
			}

			const creature = hex.creature;
			const isAlliedWallHex =
				creature instanceof Creature && isAcrylicWall(creature) && creature.team === cycloper.team;
			const isDamagedWallHex = isDamagedAlliedAcrylicWall(creature, cycloper);
			const isRelayWallHex = canRelayThroughWalls && isAlliedWallHex;

			if (!isRelayWallHex) {
				effectiveDistance++;
			}

			if (effectiveDistance > baseRange) {
				break;
			}

			if (!creature || isDamagedWallHex) {
				const key = `${hex.x},${hex.y}`;
				if (!seen.has(key)) {
					seen.add(key);
					result.push(hex);
				}
			}

			if (creature instanceof Creature && !isAlliedWallHex) {
				break;
			}
		}
	}

	return result;
}

function makeDisabledAbility() {
	return {
		trigger: 'noTrigger' as const,
		require: () => false,
	};
}

function ensureAcrylicWallData(G: Game) {
	const creatureData = G.creatureData as CreatureDataEntry[];
	const existing = creatureData.find((unit) => unit.type === ACRYLIC_WALL_TYPE);
	if (existing) {
		return existing;
	}

	const wallData = {
		id: ACRYLIC_WALL_UNIT_ID,
		name: 'object_acrylic-wall',
		playable: false as const,
		level: 0,
		realm: 'O',
		type: ACRYLIC_WALL_TYPE,
		size: 1 as const,
		set: '' as const,
		stats: {
			health: 30,
			regrowth: 0,
			endurance: 0,
			energy: 0,
			meditation: 0,
			initiative: 0,
			offense: 0,
			defense: 0,
			movement: 0,
			pierce: 0,
			slash: 0,
			crush: 0,
			shock: 0,
			burn: 0,
			frost: 0,
			poison: 0,
			sonic: 0,
			mental: 0,
		},
		animation: {
			walk_speed: 500,
		},
		display: {
			width: 90,
			height: 120,
			'offset-x': 0,
			'offset-y': -150,
		},
		ability_info: [
			{
				title: 'Acrylic Hull',
				desc: 'Converts all incoming damage to pure.',
				info: 'Passive.',
			},
			{
				title: 'Structural Form',
				desc: 'Passive placeholder.',
				info: 'No active effects.',
			},
			{
				title: 'Structural Form',
				desc: 'Passive placeholder.',
				info: 'No active effects.',
			},
			{
				title: 'Structural Form',
				desc: 'Passive placeholder.',
				info: 'No active effects.',
			},
		],
	};

	creatureData.push(wallData);
	return wallData;
}

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default (G: Game) => {
	ensureAcrylicWallData(G);

	// Riot Shield spawns a dedicated wall creature. It has no active abilities.
	G.abilities[ACRYLIC_WALL_UNIT_ID] = [
		{
			trigger: 'onUnderAttack',
			require: function () {
				return true;
			},
			activate: function (damage) {
				const damageValues = Object.values((damage.damages || {}) as Record<string, number>);
				const convertedTotal: number = damageValues.reduce(
					(sum, value) => sum + (typeof value === 'number' ? value : 0),
					0,
				);
				damage.damages = { pure: Math.max(1, convertedTotal) };
				return damage;
			},
		},
		makeDisabledAbility(),
		makeDisabledAbility(),
		makeDisabledAbility(),
	];

	G.abilities[CYCLOPER_UNIT_ID] = [
		// First Ability: Explosive End
		{
			trigger: 'onCreatureDeath',

			require: function () {
				return true;
			},

			activate: function (deadCreature: Creature) {
				if (deadCreature.id !== this.creature.id) {
					return;
				}

				const baseBurn = Number(this.damages?.burn ?? 10);
				const baseCrush = Number(this.damages?.crush ?? 10);
				const baseSonic = Number(this.damages?.sonic ?? 10);
				const bonusBurn = this.isUpgraded() ? Math.max(0, deadCreature.energy) : 0;

				const targets = this.getTargets(deadCreature.adjacentHexes(1));

				targets.forEach((item) => {
					if (
						!(item.target instanceof Creature) ||
						item.target.dead ||
						(this.isUpgraded() && !isTeam(this.creature, item.target, Team.Enemy))
					) {
						return;
					}
					item.target.takeDamage(
						new Damage(
							deadCreature,
							{
								burn: baseBurn + bonusBurn,
								crush: baseCrush,
								sonic: baseSonic,
							},
							1,
							[],
							G,
						),
					);
				});
			},
		},

		// Second Ability: Optic Burst
		{
			trigger: 'onQuery',
			_targetTeam: Team.Enemy,

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				const targetTeam = this.isUpgraded() ? Team.Both : this._targetTeam;
				const upgraded = this.isUpgraded();

				return this.testDirection({
					team: targetTeam,
					id: this.creature.id,
					sourceCreature: this.creature,
					flipped: this.creature.player.flipped,
					x: this.creature.x,
					y: this.creature.y,
					directions: ALL_DIRECTIONS,
					distance: 0,
					minDistance: 1,
					stopOnCreature: true,
					includeCreature: true,
					pierceThroughBehavior: upgraded ? 'pierce' : 'stop',
					pierceNumber: upgraded ? 2 : 1,
					ignoreCreatureTest: (target: Creature) =>
						shouldIgnoreOpticBurstTarget(this.creature, upgraded, target),
					optTest: (target: Creature) => isValidOpticBurstTarget(this.creature, target, upgraded),
				});
			},

			query: function () {
				const ability = this;
				const cycloper = this.creature;
				const upgraded = this.isUpgraded();
				const targetTeam = upgraded ? Team.Both : this._targetTeam;

				const directionalOptions = G.grid.getDirectionChoices({
					fnOnConfirm: (...args) => ability.animation(...args),
					team: targetTeam,
					id: cycloper.id,
					sourceCreature: cycloper,
					flipped: cycloper.player.flipped,
					x: cycloper.x,
					y: cycloper.y,
					directions: ALL_DIRECTIONS,
					distance: 0,
					minDistance: 1,
					requireCreature: true,
					stopOnCreature: true,
					pierceThroughBehavior: upgraded ? 'pierce' : 'stop',
					pierceNumber: upgraded ? 2 : 1,
					ignoreCreatureTest: (target: Creature) =>
						shouldIgnoreOpticBurstTarget(cycloper, upgraded, target),
					optTest: (target: Creature) => isValidOpticBurstTarget(cycloper, target, upgraded),
				});

				if (upgraded) {
					directionalOptions.choices.forEach((choice) => {
						const blockerIndex = choice.findIndex(
							(hex) =>
								hex.creature instanceof Creature &&
								!isAcrylicWall(hex.creature) &&
								isDamagedAlliedOpticBurstTarget(hex.creature, cycloper),
						);

						if (blockerIndex < 0) {
							return;
						}

						const blockedPath = choice.slice(blockerIndex + 1);
						choice.splice(blockerIndex + 1);

						blockedPath.forEach((hex) => {
							if (!directionalOptions.hexesDashed.includes(hex)) {
								directionalOptions.hexesDashed.push(hex);
							}
						});
					});
				}

				G.grid.queryChoice(directionalOptions);
			},

			activate: function (path, args) {
				let target: Creature | null = null;
				let wallFallback: Creature | null = null;
				const upgraded = this.isUpgraded();
				const selectedHex = args?.hex;
				const selectedCreature =
					selectedHex?.creature instanceof Creature ? selectedHex.creature : null;
				const selectedIsValid =
					selectedCreature instanceof Creature &&
					selectedCreature.id !== this.creature.id &&
					isValidOpticBurstTarget(this.creature, selectedCreature, upgraded);

				if (selectedIsValid && isTeam(this.creature, selectedCreature, Team.Ally)) {
					target = selectedCreature;
				}
				for (const hex of path) {
					if (target) {
						break;
					}
					if (!(hex.creature instanceof Creature) || hex.creature.id === this.creature.id) {
						continue;
					}

					if (!isValidOpticBurstTarget(this.creature, hex.creature, upgraded)) {
						continue;
					}

					if (isAcrylicWall(hex.creature)) {
						if (upgraded && isDamagedAlliedAcrylicWall(hex.creature, this.creature)) {
							wallFallback = hex.creature;
						}
						continue;
					}

					if (!(selectedIsValid && isTeam(this.creature, selectedCreature, Team.Ally))) {
						target = hex.creature;
						break;
					}
				}

				if (!target) {
					target = wallFallback;
				}

				if (!target) {
					return;
				}

				if (isTeam(this.creature, target, Team.Ally) && target.health >= target.stats.health) {
					this.end();
					return;
				}

				const effectiveDistance = getOpticBurstEffectiveDistance(
					this.creature,
					target,
					path,
					args,
					G,
				);
				const baseBurn = Number(this.damages?.burn ?? 0);
				const burnAmount = Math.max(1, baseBurn - effectiveDistance);
				const pureHealAmount = baseBurn;

				if (isTeam(this.creature, target, Team.Ally)) {
					// Upgraded: heal within melee + relay wall range (distance <= 1)
					// Unupgraded: heal only at melee (distance === 0)
					const maxHealDistance = this.isUpgraded() ? 1 : 0;
					if (effectiveDistance > maxHealDistance) {
						this.end();
						return;
					}

					// Heal is intentionally a fixed amount (pure-equivalent), unaffected by masteries.
					target.heal(pureHealAmount);
					this.end();
				} else {
					const damage = new Damage(
						this.creature,
						{
							burn: burnAmount,
						},
						1,
						[],
						G,
					);
					// Launch from Cycloper's green eye (mapped from cardboard art proportions).
					const startX = this.creature.sprite.scale.x > 0 ? 58 : 32;
					const [tween, sprite] = G.animations.projectile(
						this as Ability,
						target,
						'effects_optic-burst',
						path,
						{ direction: args?.direction ?? 0 },
						startX,
						-116,
					);
					this.end();
					tween.onComplete.add(function () {
						// `this` is the sprite (context arg below)
						// @ts-expect-error 'this' defaults to type 'any'
						this.destroy();
						target.takeDamage(damage);
					}, sprite);
				}
			},
		},

		// Third Ability: Riot Shield
		{
			trigger: 'onQuery',
			_targetTeam: Team.Both,

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				const range = getRiotShieldPlacementRange(this.creature, G);

				return range.length > 0;
			},

			query: function () {
				const ability = this;
				const cycloper = this.creature;
				const wallPreviewData = ensureAcrylicWallData(G);
				const range = getRiotShieldPlacementRange(cycloper, G);

				G.grid.queryHexes({
					fnOnConfirm: (...args) => ability.animation(...args),
					fnOnSelect: (selectedHex) => {
						cycloper.faceHex(selectedHex);
						selectedHex.overlayVisualState('creature selected player' + cycloper.team);
						G.grid.previewCreature(selectedHex.pos, wallPreviewData, cycloper.player);
					},
					id: cycloper.id,
					hexes: range,
					size: 1,
					flipped: cycloper.player.flipped,
					hideNonTarget: true,
				});
			},

			activate: function (hex) {
				const targetedWall =
					hex.creature instanceof Creature &&
					isDamagedAlliedAcrylicWall(hex.creature, this.creature)
						? hex.creature
						: null;

				if (targetedWall) {
					targetedWall.health = targetedWall.stats.health;
					targetedWall.updateHealth();
					targetedWall.healthShow();
					this._lastBonus = targetedWall.id;
					G.updateQueueDisplay();
					this.end();
					return;
				}

				const previousShield = G.creatures[this._lastBonus ?? -1];
				if (
					previousShield instanceof Creature &&
					!previousShield.dead &&
					previousShield.type === ACRYLIC_WALL_TYPE
				) {
					previousShield.destroy();
				}

				const wallBase = ensureAcrylicWallData(G);

				const wallData = {
					...wallBase,
					x: hex.x,
					y: hex.y,
					team: this.creature.player.id,
					temp: false,
					materializationSickness: true,
				};

				const wall = new Creature(wallData, G);
				const wallFlags = wall as unknown as AcrylicWallRuntimeFlags;
				this.creature.player.creatures.push(wall);
				wallFlags.hideFromQueue = true;
				wallFlags.hideUnitStatsOnHover = true;
				wallFlags.deathAnimationType = 'shatterDown';
				wallFlags.hideFromCreatureCount = true;
				wall.summon();
				wallFlags._nextGameTurnActive = Number.MAX_SAFE_INTEGER;
				wall.remainingMove = 0;
				wall.noActionPossible = true;
				this._lastBonus = wall.id;

				G.updateQueueDisplay();
				this.end();
			},
		},

		// Fourth Ability: Power Aperture
		{
			trigger: 'onQuery',
			_targetTeam: Team.Both,
			range: {
				regular: 7,
				upgraded: 7,
			},

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}
				(this as CycloperAbilityState)._noAffordableApertureTargetInRange = false;

				const baseRange = this.range.regular;
				const useCurrentHealthCost = this.isUpgraded();
				const abilityRange = baseRange + (isRiotShieldUpgraded(this.creature) ? 1 : 0);
				const directional = G.grid.getDirectionChoices({
					team: Team.Both,
					requireCreature: true,
					id: this.creature.id,
					sourceCreature: this.creature,
					flipped: this.creature.player.flipped,
					x: this.creature.x,
					y: this.creature.y,
					directions: ALL_DIRECTIONS,
					distance: abilityRange,
					minDistance: 1,
					stopOnCreature: true,
					includeCreature: true,
					ignoreCreatureTest: isRiotShieldUpgraded(this.creature)
						? (candidate: Creature) => isCycloperRelayWall(candidate, this.creature)
						: undefined,
				});

				let hasTargetInRange = false;
				let hasAffordableTargetInRange = false;

				const hasUsableTarget = directional.choices.some((path) => {
					const direction = path[0]?.direction;
					const targetInRangeHex = path.find(
						(hex) =>
							hex.creature instanceof Creature &&
							hex.creature.id !== this.creature.id &&
							!isShieldedDarkPriest(hex.creature, this.creature),
					);

					if (!targetInRangeHex || !(targetInRangeHex.creature instanceof Creature)) {
						return false;
					}

					if (
						!isApertureTargetInRange(
							this.creature,
							targetInRangeHex.creature,
							direction,
							baseRange,
							G,
						)
					) {
						return false;
					}

					hasTargetInRange = true;
					const targetCost = getApertureEnergyCost(targetInRangeHex.creature, useCurrentHealthCost);
					if (targetCost <= this.creature.energy) {
						hasAffordableTargetInRange = true;
					}

					return targetCost <= this.creature.energy;
				});

				if (!hasUsableTarget && hasTargetInRange && !hasAffordableTargetInRange) {
					(this as CycloperAbilityState)._noAffordableApertureTargetInRange = true;
					this.message = APERTURE_NO_ENERGY_MESSAGE;
				}

				return hasUsableTarget;
			},

			query: function () {
				const ability = this;
				const cycloper = this.creature;
				const baseRange = this.range.regular;
				const useCurrentHealthCost = this.isUpgraded();
				const abilityRange = baseRange + (isRiotShieldUpgraded(cycloper) ? 1 : 0);
				const resetEnergyPreview = () => {
					const current = cycloper.energy / cycloper.stats.energy;
					G.UI.energyBar.setSize(current);
					G.UI.energyBar.previewSize(0);
					G.UI.energyBar.setAvailableStyle();
				};
				const previewApertureCost = (target: Creature) => {
					const cost = getApertureEnergyCost(target, useCurrentHealthCost);
					const maxEnergy = cycloper.stats.energy;
					const currentEnergy = cycloper.energy;
					const currentRatio = currentEnergy / maxEnergy;
					const costRatio = cost / maxEnergy;

					G.UI.energyBar.setSize(currentRatio);
					G.UI.energyBar.previewSize(costRatio);
					G.UI.energyBar.setAvailableStyle();

					if (cost > currentEnergy) {
						G.UI.energyBar.setSize(costRatio);
						G.UI.energyBar.previewSize(Math.max(0, costRatio - currentRatio));
						G.UI.energyBar.setUnavailableStyle();
					}
				};
				const beginDestinationQuery = (target: Creature, direction?: number) => {
					if (!(target instanceof Creature)) {
						return;
					}

					const cost = getApertureEnergyCost(target, useCurrentHealthCost);
					if (ability.creature.energy < cost) {
						ability.message = G.msg.abilities.notEnough.replace('%stat%', 'energy');
						return;
					}
					ability._energySelfUpgraded = cost;

					const relayRangeBonus = hasRelayExtensionOnPath(cycloper, target, direction, baseRange, G)
						? 1
						: 0;
					const destinationRange = baseRange + relayRangeBonus;

					const directionalDestinations = G.grid.getDirectionChoices({
						team: Team.Both,
						requireCreature: false,
						id: cycloper.id,
						sourceCreature: cycloper,
						flipped: cycloper.player.flipped,
						x: cycloper.x,
						y: cycloper.y,
						directions: ALL_DIRECTIONS,
						distance: destinationRange,
						minDistance: 1,
						includeCreature: true,
						stopOnCreature: true,
						ignoreCreatureTest: isRiotShieldUpgraded(cycloper)
							? (candidate: Creature) => isCycloperRelayWall(candidate, cycloper)
							: undefined,
					});

					const destinations = directionalDestinations.choices
						.flat()
						.filter(
							(hex) =>
								!hex.creature &&
								G.grid.hexes[hex.y][hex.x].isWalkable(target.size, target.id, true),
						);
					const extendedDestinations = arrayUtils.extendToLeft(destinations, target.size, G.grid);
					const extendedDashed = arrayUtils.extendToLeft(
						directionalDestinations.hexesDashed,
						target.size,
						G.grid,
					);

					if (!destinations.length) {
						ability.message = G.msg.abilities.noTarget;
						return;
					}

					if (target.sprite) {
						target.sprite.alpha = 0;
					}
					const traceTargetSelection = () => {
						target.tracePosition({
							x: target.x,
							y: target.y,
							overlayClass: 'creature moveto selected player' + target.team,
							drawOverCreatureTiles: true,
						});
					};
					const showTargetSprite = () => {
						if (target.sprite) {
							target.sprite.alpha = 1;
						}
						traceTargetSelection();
					};

					const targetStats = G.retrieveCreatureStats(target.type);
					let activeTweens: Phaser.Tween[] = [];

					const cleanupTweens = () => {
						activeTweens.forEach((tween) => {
							if (tween.isRunning) {
								tween.stop(true);
							}
						});
						activeTweens = [];
					};

					const restoreState = () => {
						cleanupTweens();
						if (target.sprite) {
							target.sprite.alpha = 1;
						}
						if (G.grid.materialize_overlay) {
							G.grid.materialize_overlay.alpha = 0;
						}
						if (G.grid.secondary_overlay) {
							G.grid.secondary_overlay.alpha = 0;
						}
						if (G.grid._flickerTween && G.grid._flickerTween.isRunning) {
							G.grid._flickerTween.stop(true);
						}
						if (G.grid._flickerTweenSecondary && G.grid._flickerTweenSecondary.isRunning) {
							G.grid._flickerTweenSecondary.stop(true);
						}
					};

					G.grid.queryHexes({
						fnOnConfirm: function (hex) {
							const preview = G.grid.materialize_overlay;
							const oldPreview = G.grid.secondary_overlay;

							if (G.grid._flickerTween && G.grid._flickerTween.isRunning) {
								G.grid._flickerTween.stop(true);
							}
							if (G.grid._flickerTweenSecondary && G.grid._flickerTweenSecondary.isRunning) {
								G.grid._flickerTweenSecondary.stop(true);
							}
							cleanupTweens();

							if (preview) {
								preview.alpha = 1;
							}
							if (oldPreview) {
								oldPreview.alpha = 0;
							}

							ability.activate(target, hex);
							ability.postActivate();
						},
						fnOnCancel: function () {
							restoreState();
							resetEnergyPreview();
							ability.query();
						},
						fnOnHoverOutside: showTargetSprite,
						fnOnSelect: function (hex) {
							if (!targetStats) {
								return;
							}

							if (target.sprite) {
								target.sprite.alpha = 0;
							}
							cleanupTweens();
							G.grid.previewCreature(hex.pos, targetStats, target.player);

							if (G.grid._flickerTween && G.grid._flickerTween.isRunning) {
								G.grid._flickerTween.stop(true);
							}

							if (!G.grid.materialize_overlay) {
								return;
							}

							G.grid.materialize_overlay.alpha = 0.5;
							traceTargetSelection();
							target.tracePosition({
								x: hex.x,
								y: hex.y,
								overlayClass: 'creature moveto selected player' + target.team,
								drawOverCreatureTiles: true,
							});
						},
						hexes: extendedDestinations,
						hexesDashed: extendedDashed,
						size: target.size,
						id: [cycloper.id, target.id],
						flipped: target.player.flipped,
						hideNonTarget: true,
						callbackAfterQueryHexes: function () {
							if (targetStats) {
								G.grid.previewCreature(
									{ x: target.x, y: target.y },
									targetStats,
									target.player,
									true,
								);
								if (G.grid._flickerTweenSecondary && G.grid._flickerTweenSecondary.isRunning) {
									G.grid._flickerTweenSecondary.stop(true);
								}
								if (G.grid.secondary_overlay) {
									G.grid.secondary_overlay.alpha = 0.5;
								}
							}

							traceTargetSelection();
						},
						ownCreatureHexShade: true,
					});
				};

				G.grid.queryDirection({
					fnOnConfirm: function (...callbackArgs: unknown[]) {
						const path = (callbackArgs[0] as Hex[]) || [];
						const args = (callbackArgs[1] as DirectionArgs) || undefined;
						const direction = args?.direction;
						const targetHex = path.find(
							(hex) =>
								hex.creature instanceof Creature &&
								hex.creature.id !== cycloper.id &&
								!isShieldedDarkPriest(hex.creature, cycloper) &&
								getApertureEnergyCost(hex.creature, useCurrentHealthCost) <= cycloper.energy,
						);

						if (!targetHex || !(targetHex.creature instanceof Creature)) {
							return;
						}
						if (!isApertureTargetInRange(cycloper, targetHex.creature, direction, baseRange, G)) {
							return;
						}

						beginDestinationQuery(targetHex.creature, direction);
					},
					fnOnSelect: function (...callbackArgs: unknown[]) {
						const path = (callbackArgs[0] as Hex[]) || [];
						const args = (callbackArgs[1] as DirectionArgs) || undefined;
						const direction = args?.direction;
						const targetHex = path.find(
							(hex) =>
								hex.creature instanceof Creature &&
								hex.creature.id !== cycloper.id &&
								!isShieldedDarkPriest(hex.creature, cycloper) &&
								getApertureEnergyCost(hex.creature, useCurrentHealthCost) <= cycloper.energy,
						);

						if (!targetHex || !(targetHex.creature instanceof Creature)) {
							resetEnergyPreview();
							return;
						}
						if (!isApertureTargetInRange(cycloper, targetHex.creature, direction, baseRange, G)) {
							resetEnergyPreview();
							return;
						}

						previewApertureCost(targetHex.creature);
					},
					fnOnCancel: function () {
						resetEnergyPreview();
						cycloper.queryMove();
					},
					team: Team.Both,
					id: cycloper.id,
					sourceCreature: cycloper,
					flipped: cycloper.player.flipped,
					x: cycloper.x,
					y: cycloper.y,
					directions: ALL_DIRECTIONS,
					distance: abilityRange,
					minDistance: 1,
					requireCreature: true,
					stopOnCreature: true,
					includeCreature: true,
					ignoreCreatureTest: isRiotShieldUpgraded(cycloper)
						? (candidate: Creature) => isCycloperRelayWall(candidate, cycloper)
						: undefined,
					optTest: (target: Creature) =>
						!isShieldedDarkPriest(target, cycloper) &&
						getApertureEnergyCost(target, useCurrentHealthCost) <= cycloper.energy,
				});
			},

			activate: function (target: Creature, destination) {
				if (!(target instanceof Creature) || target.dead) {
					return;
				}

				const energyCost = Math.max(1, this._energySelfUpgraded || Math.ceil(target.health));
				if (this.creature.energy < energyCost) {
					this.message = G.msg.abilities.notEnough.replace('%stat%', 'energy');
					return;
				}

				const finalizeAbility = () => {
					const extraCost = Math.max(0, energyCost - (this.costs?.energy || 0));
					if (extraCost > 0) {
						this.creature.energy = Math.max(0, this.creature.energy - extraCost);
						if (this.creature.id === G.activeCreature.id) {
							G.UI.energyBar.animSize(this.creature.energy / this.creature.stats.energy);
						}
					}

					this.end();
				};

				const originHex = target.hexagons[0];
				const destinationSpriteHex = G.grid.hexes[destination.y][destination.x - target.size + 1];
				const fadeInMs = 500 * target.size;
				const oldVisual = {
					groupX: target.grp.x,
					groupY: target.grp.y,
					spriteX: target.sprite?.x,
					spriteY: target.sprite?.y,
					spriteAnchorX: target.sprite?.anchor?.x,
					spriteAnchorY: target.sprite?.anchor?.y,
					spriteScaleX: target.sprite?.scale?.x,
					spriteScaleY: target.sprite?.scale?.y,
					spriteAngle: target.sprite?.angle ?? 0,
					spriteKey: target.sprite?.key,
					spriteFrame: target.sprite?.frame,
				};

				target.healthHide();
				if (target.sprite) {
					target.sprite.alpha = 0;
				}

				(G.onStepOut as (...args: unknown[]) => void)(target, originHex);
				target.cleanHex();
				target.x = destination.x;
				target.y = destination.y;
				target.pos = destination.pos;
				target.updateHex();

				target.creatureSprite.setHex(destinationSpriteHex, 0).then(() => {
					G.onStepIn(target, destination, {});
					target.pickupDrop();
					G.grid.orderCreatureZ();
					(G.onCreatureMove as (...args: unknown[]) => void)(target, destination);

					// Keep an old-position ghost during the same interval as the new-position fade-in.
					if (
						typeof oldVisual.groupX === 'number' &&
						typeof oldVisual.groupY === 'number' &&
						typeof oldVisual.spriteX === 'number' &&
						typeof oldVisual.spriteY === 'number' &&
						oldVisual.spriteKey
					) {
						const ghostGroup = G.Phaser.add.group(G.grid.creatureGroup, 'powerApertureGhost');
						ghostGroup.x = oldVisual.groupX;
						ghostGroup.y = oldVisual.groupY;
						ghostGroup.alpha = 0.5;

						const ghostSprite = G.Phaser.add.sprite(
							oldVisual.spriteX,
							oldVisual.spriteY,
							oldVisual.spriteKey,
							oldVisual.spriteFrame,
							ghostGroup,
						);

						ghostSprite.anchor.setTo(oldVisual.spriteAnchorX ?? 0.5, oldVisual.spriteAnchorY ?? 1);
						ghostSprite.scale.setTo(oldVisual.spriteScaleX ?? 1, oldVisual.spriteScaleY ?? 1);
						ghostSprite.angle = oldVisual.spriteAngle;

						G.Phaser.add
							.tween(ghostGroup)
							.to({ alpha: 0 }, fadeInMs, Phaser.Easing.Linear.None, true)
							.onComplete.addOnce(() => {
								ghostGroup.destroy(true);
							});
					}

					if (target.sprite) {
						G.Phaser.tweens.removeFrom(target.sprite);
						target.sprite.alpha = 0.5;
						G.Phaser.add
							.tween(target.sprite)
							.to({ alpha: 1 }, fadeInMs, Phaser.Easing.Linear.None, true);
					}
					target.healthShow();

					if (G.grid.materialize_overlay) {
						G.grid.materialize_overlay.alpha = 0;
					}
					if (G.grid.secondary_overlay) {
						G.grid.secondary_overlay.alpha = 0;
					}
					if (G.grid._flickerTween && G.grid._flickerTween.isRunning) {
						G.grid._flickerTween.stop(true);
					}
					if (G.grid._flickerTweenSecondary && G.grid._flickerTweenSecondary.isRunning) {
						G.grid._flickerTweenSecondary.stop(true);
					}

					finalizeAbility();
				});
			},
		},
	];
};
