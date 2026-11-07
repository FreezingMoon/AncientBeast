import { Damage, DamageStats } from '../damage';
import { Team } from '../utility/team';
import { Creature } from '../creature';
import { Effect } from '../effect';
import { Hex } from '../utility/hex';
import * as arrayUtils from '../utility/arrayUtils';
import { getPointFacade } from '../utility/pointfacade';
import Game from '../game';
import { shakeBoard } from '../game-display/camera';
import { SnapshotCompatibilityError } from '../engine/GameSnapshot';
import { ABOLISHED_BONFIRE_SPRING_EFFECT } from '../engine/snapshotBehaviors';

type BonfireSpringSnapshotData = {
	attackerId: number;
	damages: DamageStats;
};

const bindBonfireSpringEffect = (
	G: Game,
	effect: Effect,
	data: Record<string, unknown> | undefined,
) => {
	const candidate = data as Partial<BonfireSpringSnapshotData> | undefined;
	const attackerId = candidate?.attackerId;
	const attacker = Number.isInteger(attackerId) && G.creatures?.[attackerId as number];
	const damages = candidate?.damages;
	if (
		!(attacker instanceof Creature) ||
		attacker.name !== 'Abolished' ||
		effect.owner !== attacker ||
		!(effect.target instanceof Hex) ||
		!damages ||
		typeof damages !== 'object' ||
		Array.isArray(damages) ||
		Object.values(damages).some((amount) => typeof amount !== 'number' || !Number.isFinite(amount))
	) {
		throw new SnapshotCompatibilityError(
			'Cannot restore Abolished Bonfire Spring: effect data is invalid.',
		);
	}

	const behaviorData: BonfireSpringSnapshotData = {
		attackerId: attacker.id,
		damages: { ...damages },
	};
	effect.attacker = attacker;
	effect.snapshotBehaviorId = ABOLISHED_BONFIRE_SPRING_EFFECT;
	effect.snapshotBehaviorData = behaviorData;
	effect.requireFn = function () {
		if (!this.trap) {
			throw new SnapshotCompatibilityError(
				'Cannot activate Abolished Bonfire Spring without its trap.',
			);
		}
		const creature = this.trap.hex.creature;
		const type = (creature && creature.type) || null;
		return type !== attacker.type;
	};
	effect.effectFn = (activeEffect, creatureOrHex: Creature | Hex) => {
		const creature = creatureOrHex instanceof Creature ? creatureOrHex : creatureOrHex?.creature;
		if (!(creature instanceof Creature)) {
			throw new SnapshotCompatibilityError(
				'Cannot activate Abolished Bonfire Spring without a creature target.',
			);
		}

		creature.takeDamage(new Damage(attacker, behaviorData.damages, 1, [], G), {
			isFromTrap: true,
		});
		creature.creatureSprite.showBonfireSpringHint();
		if (!activeEffect.trap) {
			throw new SnapshotCompatibilityError(
				'Cannot activate Abolished Bonfire Spring without its trap.',
			);
		}
		activeEffect.trap.destroy();
		activeEffect.deleteEffect();
	};
};

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default (G: Game) => {
	G.registerSnapshotEffectBehavior(ABOLISHED_BONFIRE_SPRING_EFFECT, (effect, data) =>
		bindBonfireSpringEffect(G, effect, data),
	);
	G.abilities[7] = [
		//	First Ability: Burning Spirit
		{
			trigger: 'onOtherDamage',

			require(_damage) {
				if (!this.testRequirements()) {
					return false;
				}
				return true;
			},

			activate(damage, target) {
				if (this.creature.id !== damage.attacker.id) {
					return;
				}

				// Skip passive for Greater Pyre - it handles effects manually
				if (damage.isFromGreaterPyre) {
					return;
				}

				const caster = this.creature;
				const game = G;

				// Add effect WITHOUT default hint (we'll show emoji instead)
				target.addEffect(
					new Effect(
						'Burning Spirit',
						caster,
						target,
						'',
						{
							turnLifetime: -1,
							alterations: {
								burn: -1,
							},
						},
						game,
					),
					undefined,
					undefined,
					false,
					true, // disableHint
				);

				// Only show separate debuff hint if damage doesn't already include emoji
				// (Greater Pyre, Fiery Touch, and traps already show it on damage line)
				if (!damage.isFromBurningSpirit && !damage.isFromTrap) {
					target.hint('❤️‍🔥', 'msg_effects');
				}

				if (this.isUpgraded()) {
					// Add self-buff WITHOUT default hint
					caster.addEffect(
						new Effect(
							'Burning Spirit',
							caster,
							caster,
							'',
							{
								turnLifetime: -1,
								alterations: {
									burn: 1,
								},
							},
							game,
						),
						undefined,
						undefined,
						false,
						true, // disableHint
					);

					// Show fireheart on caster for each buff gained from upgraded passive
					// For AoE attacks like Greater Pyre, damage.area = number of targets hit
					const buffCount = damage.area || 1;
					caster.hint('❤️‍🔥'.repeat(buffCount), 'msg_effects');
				}
			},
		},

		/**
		 * Second Ability: Fiery Touch
		 *
		 * Attack a single enemy unit within 3 range (forwards, backwards, or diagonal)
		 * dealing both slash and burn damage.
		 *
		 * When upgraded, the range is extended to 6 but only the burn damage is applied.
		 *
		 * Targeting rules:
		 * - The target must be an enemy unit.
		 * - The target must be inline forwards, backwards, or diagonally within 3 range.
		 * - The path to the target unit cannot be interrupted by any obstacles or units.
		 *
		 * Other rules:
		 * - Whether dealing both damage types or just one (upgraded extra range), only
		 *   one attack and damage should occur.
		 * - When upgraded, the extended range of the burn damage should be indicated
		 *   with "reduced effect" (scaled down) hexagons.
		 */
		{
			trigger: 'onQuery',

			_targetTeam: Team.Enemy,

			range: { regular: 3, upgraded: 6 },

			require() {
				if (!this.testRequirements()) {
					return false;
				}
				const range_ = this.isUpgraded() ? this.range.upgraded : this.range.regular;
				return this.testDirection({
					team: this._targetTeam,
					distance: range_,
					sourceCreature: this.creature,
					pierceThroughBehavior: 'stop',
				});
			},

			query() {
				const ability = this;
				const abolished = this.creature;

				G.grid.queryDirection({
					fnOnConfirm: function (...args) {
						ability.animation(...args);
					},
					flipped: abolished.player.flipped,
					team: this._targetTeam,
					id: this.creature.id,
					requireCreature: true,
					x: abolished.x,
					y: abolished.y,
					distance: this.isUpgraded() ? this.range.upgraded : this.range.regular,
					distanceFalloff: this.range.regular,
					sourceCreature: abolished,
				});
			},

			activate(path, args) {
				const ability = this;
				const hexWithTarget = path.find((hex) => {
					const creature = getPointFacade().getCreaturesAt({ x: hex.x, y: hex.y })[0];
					return creature && creature != this.creature;
				});

				if (!hexWithTarget) {
					return;
				}

				const target = getPointFacade().getCreaturesAt(hexWithTarget.x, hexWithTarget.y)[0];

				ability.end();
				shakeBoard({
					amplitude: 0.01,
					durationMs: 100,
					force: true,
					axis: 'horizontal',
				});

				const startX = ability.creature.sprite.scale.x > 0 ? 232 : 52;
				const projectileInstance = G.animations.projectile(
					// @ts-expect-error `this.creature` exists once this file is extended into `ability.ts`
					this,
					target,
					'effects_fiery-touch',
					path,
					args,
					startX,
					-20,
					true,
				);
				const tween = projectileInstance[0];
				const sprite = projectileInstance[1];
				const damage = this._getDamage(path);
				damage.isFromBurningSpirit = true;

				tween.onComplete.add(function () {
					// `this` refers to the animation object, _not_ the ability
					// @ts-expect-error 'this' defauls to type 'any'
					this.destroy();

					target.takeDamage(damage);
				}, sprite);
			},

			getAnimationData: function () {
				return {
					duration: 425,
				};
			},

			/**
			 * Calculate the damage of the ability as it changes depending on the distance
			 * that it is used.
			 *
			 * @param {Hex[]} path Path from the Abolished to the target unit. May contain
			 * 	creature hexes.
			 * @returns {Damage} Final damage
			 */
			_getDamage(path) {
				/* The path may contain multiple hexes from the source/target unit, so reduce
				to the path BETWEEN the source/target for simpler logic. */
				const distance = arrayUtils.filterCreature([...path], false, false).length;
				const damages = {
					...this.damages,
					slash:
						/* If the ability was targeted beyond the regular range, only the burn
						damage is applied.

						`distance` is 1 less than the ability range as it's the distance BETWEEN
						the units, rather than the distance used in query calculations which
						may included hexagons of either creature. */
						distance >= this.range.regular ? 0 : this.damages.slash,
				};

				return new Damage(this.creature, damages, 1, [], G);
			},
		},

		// Third Ability: Bonfire Spring
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',
			//range: 3,
			isMovementAbility: 'safe',
			require() {
				return this.testRequirements();
			},

			getAnimationData: function () {
				return {
					noTilt: true,
				};
			},
			query() {
				const ability = this;
				const crea = this.creature;
				// Base relocation range; upgraded version increases this by 1 per successful use
				let totalRange = 6;
				if (this.isUpgraded()) {
					// Increase range based on successful prior uses
					totalRange += this.creature.accumulatedTeleportRange;
				}

				// Relocates to any hex within range except for the current hex
				crea.queryMove({
					noPath: true,
					isAbility: true,
					range: G.grid.getFlyingRange(crea.x, crea.y, totalRange, crea.size, crea.id),
					callback: function (hex, args) {
						if (hex.x == args.creature.x && hex.y == args.creature.y) {
							// Prevent null movement
							ability.query();
							return;
						}
						ability.animation(hex);
					},
				});
			},
			activate(hex) {
				const ability = this;
				ability.end();
				// When upgraded, each successful use increases future range by 1
				if (this.isUpgraded()) {
					this.creature.accumulatedTeleportRange += 1;
				}
				const targets = ability.getTargets(ability.creature.adjacentHexes(1));

				targets.forEach(function (item) {
					if (!(item.target instanceof Creature)) {
						return;
					}
				});

				const createBonfireSpringTraps = (ownerCreature: Creature) => {
					const createdTraps = [];
					ownerCreature.hexagons.forEach(function (h) {
						const effect = new Effect(
							'Bonfire Spring',
							ownerCreature,
							h,
							'onStepIn',
							{
								attacker: ownerCreature,
								snapshotBehaviorId: ABOLISHED_BONFIRE_SPRING_EFFECT,
								snapshotBehaviorData: {
									attackerId: ownerCreature.id,
									damages: { ...ability.damages },
								},
							},
							G,
						);
						bindBonfireSpringEffect(G, effect, effect.snapshotBehaviorData);
						const trap = h.createTrap('bonfire-spring', [effect], ownerCreature.player, {
							turnLifetime: 1,
							ownerCreature,
							fullTurnLifetime: true,
							destroyAnimation: 'shrinkDown',
						});
						createdTraps.push(trap);
					});

					return createdTraps;
				};

				// Leave a Firewall in current location
				const crea = this.creature;
				createBonfireSpringTraps(crea);

				ability.creature.moveTo(hex, {
					ignoreMovementPoint: true,
					ignorePath: true,
					ignoreFacing: true,
					animation: 'teleport',
					teleportEffect: 'abolishedBonfire',
					createTeleportDestinationTraps: () => createBonfireSpringTraps(crea),
					callback: function () {
						G.activeCreature?.queryMove();
					},
				});
			},
		},
		// Fourth Ability: Greater Pyre
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',
			require() {
				return this.testRequirements();
			},
			query() {
				const ability = this;
				const crea = this.creature;

				const range = crea.adjacentHexes(1);

				// Default/idle state (before hovering, or hovering outside the blast):
				// target units keep their colored hex_hover_pX outline, empty hexes
				// stay plain hex.png (no path underlay).
				const showDefaultArea = function () {
					range.forEach(function (hex) {
						hex.cleanOverlayVisualState(
							'hover selected reachable weakDmg moveto ownCreatureHexShade h_player0 h_player1 h_player2 h_player3',
						);
						hex.cleanDisplayVisualState(
							'adj dashed shrunken creature player0 player1 player2 player3',
						);
						if (hex.creature instanceof Creature && hex.creature.id !== crea.id) {
							hex.overlayVisualState('hover h_player' + hex.creature.team);
						}
					});
				};

				// Hovered state: colored hex_hover_pX outline for units caught in the
				// blast, with hex_path rendered underneath (handled automatically by
				// Hex.updateStyle() once the overlay carries the hover+team classes).
				// Empty hexes in the blast also get the hex_path underlay.
				const showOutlinedArea = function () {
					range.forEach(function (hex) {
						hex.cleanOverlayVisualState(
							'hover selected reachable weakDmg moveto ownCreatureHexShade h_player0 h_player1 h_player2 h_player3',
						);
						hex.cleanDisplayVisualState(
							'adj dashed shrunken creature player0 player1 player2 player3',
						);
						if (hex.creature instanceof Creature && hex.creature.id !== crea.id) {
							hex.overlayVisualState('hover h_player' + hex.creature.team);
						} else {
							hex.displayVisualState('adj');
						}
					});
				};

				G.grid.queryHexes({
					fnOnConfirm: function (...args) {
						ability.animation(...args);
					},
					fnOnSelect: showOutlinedArea,
					fnOnHoverOutside: showDefaultArea,
					callbackAfterQueryHexes: showDefaultArea,
					id: this.creature.id,
					hexes: range,
					targeting: false,
					fillHexOnHover: false,
					hideNonTarget: true,
				});
			},
			activate() {
				const ability = this;
				ability.end();

				const crea = this.creature;
				const aoe = crea.adjacentHexes(1);
				const targets = ability.getTargets(aoe);

				if (this.isUpgraded()) {
					this.damages.burn = 30;
				}

				// Total hexes affected = sum of hexesHit across all targets
				const totalHexesHit = targets.reduce((sum, item) => sum + item.hexesHit, 0);

				targets.forEach(function (item) {
					const hexesHit = item.hexesHit;

					// Apply debuff once per hexagon affected
					for (let i = 0; i < hexesHit; i++) {
						item.target.addEffect(
							new Effect(
								'Burning Spirit',
								ability.creature,
								item.target,
								'',
								{
									turnLifetime: -1,
									alterations: {
										burn: -1,
									},
								},
								G,
							),
							undefined,
							undefined,
							false,
							true, // disableHint
						);
					}

					// Damage with area = hexesHit for this target
					const dmg = new Damage(
						ability.creature, // Attacker
						ability.damages, // Damage Type
						hexesHit, // Area = hexes of this target affected
						[], // Effects
						G,
					);
					dmg.isFromBurningSpirit = true;
					dmg.isFromGreaterPyre = true;
					item.target.takeDamage(dmg);
				});

				// Apply buff to caster = total hexes hit
				if (totalHexesHit > 0) {
					for (let i = 0; i < totalHexesHit; i++) {
						crea.addEffect(
							new Effect(
								'Burning Spirit',
								crea,
								crea,
								'',
								{
									turnLifetime: -1,
									alterations: {
										burn: 1,
									},
								},
								G,
							),
							undefined,
							undefined,
							false,
							true, // disableHint
						);
					}
					// Show buff count on caster
					crea.hint(`❤️‍🔥 x${totalHexesHit}`, 'msg_effects');
				}
			},
		},
	];
};
