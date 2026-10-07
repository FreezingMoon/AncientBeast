import $j from 'jquery';
import { Damage, DamageStats } from '../damage';
import { Team } from '../utility/team';
import * as matrices from '../utility/matrices';
import * as arrayUtils from '../utility/arrayUtils';
import { Creature } from '../creature';
import { Effect } from '../effect';
import { once } from 'underscore';
import { getPointFacade, Point } from '../utility/pointfacade';
import { offsetCoordsToPx } from '../utility/const';
import Game from '../game';
import { shakeBoard } from '../game-display/camera';
import { getDepthAtBand } from '../game-display/layer';
import { getFrameSize } from '../game-display/texture';
import { spawnChainLightning } from '../vfx/lightning/effect';

function clockHourFromTo(from: Point, to: Point): number {
	const fromPx = offsetCoordsToPx(from);
	const toPx = offsetCoordsToPx(to);
	const degrees = (Math.atan2(toPx.x - fromPx.x, fromPx.y - toPx.y) * 180) / Math.PI;
	return (((degrees / 30) % 12) + 12) % 12;
}

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default (G: Game) => {
	G.abilities[5] = [
		// 	First Ability: Electrified Hair
		{
			trigger: 'onUnderAttack',

			require: function () {
				// Always true to highlight ability
				return true;
			},

			activate: function (damage) {
				// Commented out due to typescript conflicts, but I don't know if that would cause errors, hence why it's not deleted
				/*if (damage === undefined) {
					return false;
				}*/
				if (!damage.damages.shock) {
					return false;
				}
				this.end();
				const converted = Math.floor(damage.damages.shock / 4);
				// Lower damage
				damage.damages.shock -= converted;
				// Replenish energy
				// Calculate overflow first; we may need it later
				const energyMissing = this.creature.stats.energy - this.creature.energy;
				const energyOverflow = converted - energyMissing;
				this.creature.recharge(converted);
				// If upgraded and energy overflow, convert into health
				if (this.isUpgraded() && energyOverflow > 0) {
					this.creature.heal(energyOverflow);
				}
				G.log(
					'%CreatureName' +
						this.creature.id +
						'% absorbs ' +
						converted +
						' shock damage into energy',
				);
				return damage;
			},
		},

		// 	Second Ability: Hasted Javelin
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
					!this.atLeastOneTarget(this._getHexes(), {
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
				const creature = this.creature;
				G.grid.queryCreature({
					fnOnConfirm: function (...args: unknown[]) {
						ability.animation(...args);
					},
					team: this._targetTeam,
					id: creature.id,
					flipped: creature.player.flipped,
					hexes: this._getHexes(),
				});
			},

			//	activate() :
			activate: function (target) {
				const ability = this;
				shakeBoard({
					amplitude: 0.01,
					durationMs: 120,
					force: true,
					axis: 'horizontal',
				});

				const finalDmg: DamageStats = {
					pierce: 30,
					poison: 0,
				};

				// Poison Bonus if upgraded
				if (this.isUpgraded()) {
					finalDmg.poison = 10;
				}

				const damage = new Damage(
					ability.creature, // Attacker
					finalDmg, // Damage Type
					1, // Area
					[], // Effects
					G,
				);
				const result = target.takeDamage(damage);
				// Recharge movement if any damage dealt
				if (result.damages && result.damages.total > 0) {
					this.creature.remainingMove = this.creature.maxMovement;
					G.log('%CreatureName' + this.creature.id + "%'s movement recharged");
					G.activeCreature?.queryMove();
				}
				ability.end();
			},

			_getHexes: function () {
				return G.grid.getHexMap(
					this.creature.x - 3,
					this.creature.y - 2,
					0,
					false,
					matrices.frontnback3hex,
				);
			},
		},

		// 	Third Ability: Poisonous Vine
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			_targetTeam: Team.Enemy,

			// 	require() :
			require: function () {
				if (
					!this.atLeastOneTarget(this._getHexes(), {
						team: this._targetTeam,
					})
				) {
					return false;
				}
				return this.testRequirements();
			},

			// 	query() :
			query: function () {
				const ability = this;
				const creature = this.creature;

				G.grid.queryCreature({
					fnOnConfirm: function (...args: unknown[]) {
						ability.animation(...args);
					},
					team: this._targetTeam,
					id: creature.id,
					flipped: creature.player.flipped,
					hexes: this._getHexes(),
				});
			},

			activate: function (target) {
				this.end();
				const damages = this.damages;
				// Last 1 turn, or indefinitely if upgraded
				const lifetime = this.isUpgraded() ? -1 : 1;
				const ability = this;

				// Destroy trap if it wasn't triggered and target is dead
				target.addEffect(
					new Effect(
						ability.title,
						target,
						target,
						'onUnderAttack',
						{
							effectFn: (effect, damage: Damage) => {
								if (damage.damages) {
									const dmg = damage.applyDamage();
									if (dmg.total >= target.health) {
										target.hexagons.forEach(function (hex) {
											hex.destroyTrap();
										});
									}
								}
							},
						},
						G,
					),
				);

				const effect = new Effect(
					ability.title,
					ability.creature,
					target.hexagons[0],
					'onStepOut',
					{
						effectFn: once((effect) => {
							G.log('%CreatureName' + target.id + '% is injured by ' + effect.name);
							target.takeDamage(new Damage(ability.creature, damages, 1, [], G), {
								isFromTrap: true,
							});
							effect.deleteEffect();
							// NOTE: Destroy all traps under creature. They are assumed to
							// be poisonous vine. This is not strictly necessary but it
							// keeps multiple instances of "Poisonous Vine" text
							// from appearing on screen.
							getPointFacade()
								.getTrapsAt(target)
								.forEach((trap) => trap.destroy());
						}),
					},
					G,
				);

				// NOTE: Add a trap to every hex of the target
				// Made it so only one hex has the effect & others are placeholders
				let trapSet = false;
				target.hexagons.forEach(function (hex) {
					if (!trapSet) {
						hex.createTrap('poisonous-vine', [effect], ability.creature.player, {
							turnLifetime: lifetime,
							fullTurnLifetime: true,
							ownerCreature: ability.creature,
							destroyOnActivate: true,
							destroyAnimation: 'shrinkDown',
						});
						trapSet = true;
					} else {
						hex.createTrap('poisonous-vine', [], ability.creature.player, {
							turnLifetime: lifetime,
							fullTurnLifetime: true,
							ownerCreature: ability.creature,
							destroyOnActivate: true,
							destroyAnimation: 'shrinkDown',
						});
					}
				});
			},

			_getHexes: function () {
				// Target a creature within 2 hex radius
				const hexes = G.grid.hexes[this.creature.y][this.creature.x].adjacentHex(2);
				return arrayUtils.extendToLeft(hexes, this.creature.size, G.grid);
			},
		},

		//	Fourth Ability: Chain Lightning
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			_targetTeam: Team.Both,

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

			//	query() :
			query: function () {
				const ability = this;

				G.grid.queryCreature({
					fnOnConfirm: function (...args: unknown[]) {
						ability.animation(...args);
					},
					team: this._targetTeam,
					id: this.creature.id,
					flipped: this.creature.player.flipped,
					hexes: this._getHexes(),
				});
			},

			//	animation() :
			animation: function (target) {
				const ability = this;

				const result = ability.animation2({
					callback: function () {
						// Default no-op
					},
					arg: [target],
				});

				return result;
			},

			//	activate() :
			activate: function (target) {
				const ability = this;
				const caster = ability.creature;

				// Compute the attack direction independently of the sprite's
				// current scale, so the VFX nose tip is always correct even
				// if the creature was reset by end() or is being spammed via
				// metapower before the animation flip lands.
				const facefrom = { x: caster.x, y: caster.y };
				const faceto = { x: target.x, y: target.y };
				if (facefrom.y % 2 === 0 && faceto.y % 2 === 1) {
					faceto.x += 0.5;
				} else if (facefrom.y % 2 === 1 && faceto.y % 2 === 0) {
					faceto.x -= 0.5;
				}
				let attackDir: number;
				if (facefrom.y % 2 === 0) {
					attackDir = faceto.x <= facefrom.x ? -1 : 1;
				} else {
					attackDir = faceto.x < facefrom.x ? -1 : 1;
				}
				const savedScaleX = attackDir;

				const sprite = caster.sprite;
				const grp = caster.grp;
				const { width, height } = getFrameSize(sprite);
				const facing = attackDir < 0 ? -1 : 1;
				const savedNoseTip = {
					x: (grp?.x ?? 0) + (sprite?.x ?? 0) + (facing * width) / 2,
					y: (grp?.y ?? 0) + (sprite?.y ?? 0) - height,
				};

				ability.end();

				// animation2() already faced the creature at the target; end()
				// reset it back to default. Re-flip in the next frame so it
				// beats any hover-state reset and the lunge tween reads the
				// correct direction.
				requestAnimationFrame(() => {
					caster.faceHex(target);
				});

				const targets = [];
				targets.push(target); // Add First creature hit
				let nextdmg = $j.extend({}, ability.damages); // Copy the object

				// For each Target
				for (let i = 0; i < targets.length; i++) {
					const trg = targets[i];

					// The arc's reach is scouted before the strike
					// lands: a target killed by the hit is cleaned
					// off the board, and the chain still has to be
					// able to leap on from around where it stood.
					const nearHexes = trg.adjacentHexes(1);

					// Upgraded, the arc can jump one empty hexagon, so a
					// creature two hexes away is in reach too, as long as
					// a hexagon between it and the current target is empty.
					// `adjacentHexes(2)` also holds the near hexes, so those
					// are filtered back out to leave exactly the far ring.
					// The bolt arcs through a hex adjacent to both ends of
					// the jump; at least one of those must be empty for the
					// arc to have a clear path.
					const farHexes = trg.adjacentHexes(2).filter((hex) => !nearHexes.includes(hex));
					const jumpHexes = farHexes.filter((hex) =>
						nearHexes.some((between) => !between.creature && between.adjacentHex(1).includes(hex)),
					);

					const damage = new Damage(
						ability.creature, // Attacker
						nextdmg, // Damage Type
						1, // Area
						[], // Effects
						G,
					);
					const curDamage = trg.takeDamage(damage);

					if (curDamage.damages === undefined) {
						break;
					} // If attack is dodge
					if (curDamage.damages.total <= 0) {
						break;
					} // If damage is too weak
					if (!curDamage.damageObj || curDamage.damageObj.status !== '') {
						break;
					}
					delete curDamage.damages.total;
					nextdmg = curDamage.damages;

					// Get next available targets
					const prevUnit = i === 0 ? ability.creature : targets[i - 1];
					const arrivalHour = clockHourFromTo(prevUnit, trg);
					const scanOrder = (target: Creature) =>
						(clockHourFromTo(trg, target) - arrivalHour + 12) % 12;

					let nextTargets = ability.getTargets(nearHexes).map((item) => ({
						...item,
						distance: 1,
						scan: scanOrder(item.target),
					}));

					if (ability.isUpgraded()) {
						nextTargets = nextTargets.concat(
							ability.getTargets(jumpHexes).map((item) => ({
								...item,
								distance: 2,
								scan: scanOrder(item.target),
							})),
						);
					}

					nextTargets = nextTargets.filter(
						(item) =>
							item.hexesHit !== undefined && // Remove empty ids
							item.target instanceof Creature &&
							!targets.includes(item.target), // No loops: can't re-hit anything already in the chain
					);

					// Prefer non-caster targets; only allow the Impaler itself as
					// a last resort when nothing else is in reach.
					const nonCasterTargets = nextTargets.filter((item) => item.target !== ability.creature);
					if (nonCasterTargets.length > 0) {
						nextTargets = nonCasterTargets;
					}

					// If no target
					if (nextTargets.length === 0) {
						break;
					}

					// Best Target
					let bestTarget: Creature | null = null;
					let bestDistance = Infinity;
					let bestShock = Infinity;
					let bestScan = Infinity;
					for (let j = 0; j < nextTargets.length; j++) {
						// For each creature
						if (typeof nextTargets[j] == 'undefined') {
							continue;
						} // Skip empty ids.

						const t = nextTargets[j].target;
						const distance = nextTargets[j].distance;
						const scan = nextTargets[j].scan;
						// Compare to best target
						if (
							distance < bestDistance ||
							(distance === bestDistance && t.stats.shock < bestShock) ||
							(distance === bestDistance && t.stats.shock === bestShock && scan < bestScan)
						) {
							bestTarget = t;
							bestDistance = distance;
							bestShock = t.stats.shock;
							bestScan = scan;
						}
					}

					if (bestTarget instanceof Creature) {
						targets.push(bestTarget);
						shakeBoard({
							amplitude: 0.03,
							durationMs: 220,
							force: true,
							axis: 'horizontal',
						});
					} else {
						break;
					}
				}

				// Chain Lightning eye candy: arc the strike between every
				// creature it hit, in the order it hit them. `targets` holds
				// the whole chain in sequence, so one bolt per consecutive
				// pair is the lightning jumping from unit to unit. The arc
				// sparks off the Impaler's nose tip — where the javelin
				// points — and connects to each victim's mid-body.
				if (G.gameEngine && targets.length > 0) {
					let deepestRow = ability.creature.y;
					for (const trg of targets) {
						deepestRow = Math.max(deepestRow, trg.y);
					}
					spawnChainLightning(G.gameEngine, [savedNoseTip, ...targets], {
						parent: G.grid.creatureGroup,
						surfaceSource: { textures: G.Phaser?.textures },
						depth: getDepthAtBand(deepestRow, 'EFFECT_OVER_UNITS'),
					});

					// Flip back after the lightning vanishes (lifetimeMs 420).
					const defaultDir = caster.player.flipped ? -1 : 1;
					if (savedScaleX !== defaultDir) {
						setTimeout(() => {
							if (!caster.dead && caster.sprite.scale.x !== defaultDir) {
								caster.facePlayerDefault();
							}
						}, 420);
					}
				}
			},

			_getHexes: function () {
				const range = this.isUpgraded() ? 2 : 1;
				const hexes = G.grid.hexes[this.creature.y][this.creature.x].adjacentHex(range);
				const extended = arrayUtils.extendToLeft(hexes, this.creature.size, G.grid);
				const occupied = new Set(
					this.creature.hexagons
						.filter((h) => h.creature === this.creature)
						.map((h) => `${h.x},${h.y}`),
				);
				return extended.filter((h) => !occupied.has(`${h.x},${h.y}`));
			},
		},
	];
};
