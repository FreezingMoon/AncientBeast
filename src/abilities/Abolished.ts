import { Damage } from '../damage';
import { Team } from '../utility/team';
import { Creature } from '../creature';
import { Effect } from '../effect';
import * as arrayUtils from '../utility/arrayUtils';
import { getPointFacade } from '../utility/pointfacade';
import Game from '../game';

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default (G: Game) => {
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

				target.addEffect(
					new Effect(
						'Burning Spirit', // Name
						this.creature, // Caster
						target, // Target
						'', // Trigger
						{
							turnLifetime: -1,
							alterations: {
								burn: -1,
							},
						}, // Optional arguments
						G,
					),
				);
				if (this.isUpgraded()) {
					this.creature.addEffect(
						new Effect(
							'Burning Spirit', // Name
							this.creature, // Caster
							this.creature, // Target
							'', // Trigger
							{
								turnLifetime: -1,
								alterations: {
									burn: 1,
								},
							}, // Optional arguments
							G,
						),
					);
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
				G.gameEngine.cameras.main.shake(
					0.01,
					100,
					true,
					G.gameEngine.cameras.main.SHAKE_HORIZONTAL,
					true,
				);

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
				);
				const tween = projectileInstance[0];
				const sprite = projectileInstance[1];
				const damage = this._getDamage(path);

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
						const trap = h.createTrap(
							'bonfire-spring',
							[
								new Effect(
									'Bonfire Spring',
									ownerCreature,
									h,
									'onStepIn',
									{
										requireFn: requireFn,
										effectFn: effectFn,
										attacker: ownerCreature,
									},
									G,
								),
							],
							ownerCreature.player,
							{
								turnLifetime: 1,
								ownerCreature,
								fullTurnLifetime: true,
								destroyAnimation: 'shrinkDown',
							},
						);
						createdTraps.push(trap);
					});

					return createdTraps;
				};

				// Leave a Firewall in current location
				const effectFn = function (effect, creatureOrHex) {
					let creature = creatureOrHex;
					if (!(creatureOrHex instanceof Creature)) {
						creature = creatureOrHex.creature;
					}
					creature.takeDamage(new Damage(effect.attacker, ability.damages, 1, [], G), {
						isFromTrap: true,
					});
					// @ts-expect-error 'this' defauls to type 'any'
					this.trap.destroy();
					effect.deleteEffect();
				};

				const requireFn = function () {
					// @ts-expect-error 'this' defauls to type 'any'
					const creature = this.trap.hex.creature,
						type = (creature && creature.type) || null;

					if (creature === 0) {
						return false;
					}
					return type !== ability.creature.type;
				};

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
						G.activeCreature.queryMove();
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

				targets.forEach(function (item) {
					item.target.takeDamage(
						new Damage(
							ability.creature, // Attacker
							ability.damages, // Damage Type
							1, // Area
							[], // Effects
							G,
						),
					);
				});
			},
		},
	];
};
