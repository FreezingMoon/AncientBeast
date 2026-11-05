import { Damage } from '../damage';
import { Creature } from '../creature';
import { Team, isTeam } from '../utility/team';
import * as matrices from '../utility/matrices';
import * as arrayUtils from '../utility/arrayUtils';
import { Effect } from '../effect';
import { getPointFacade } from '../utility/pointfacade';
import { Hex } from '../utility/hex';
import { shakeBoard } from '../game-display/camera';
import { SnapshotCompatibilityError } from '../engine/GameSnapshot';
import { INFERNAL_SCORCHED_GROUND_EFFECT } from '../engine/infernalSnapshotBehaviors';

type InfernalScorchedGroundData = {
	attackerId: number;
	damages: Record<string, number>;
};

const bindScorchedGroundEffect = (
	G,
	effect: Effect,
	data: Record<string, unknown> | undefined,
	attackerOverride?: Creature,
) => {
	const candidate = data as Partial<InfernalScorchedGroundData> | undefined;
	const attackerId = attackerOverride?.id ?? candidate?.attackerId;
	const attacker =
		attackerOverride ?? (Number.isInteger(attackerId) && G.creatures?.[attackerId as number]);
	const damages = candidate?.damages;
	if (
		!attacker ||
		!Number.isInteger(attackerId) ||
		!damages ||
		typeof damages !== 'object' ||
		Array.isArray(damages) ||
		Object.values(damages).some((amount) => typeof amount !== 'number' || !Number.isFinite(amount))
	) {
		throw new SnapshotCompatibilityError(
			'Cannot restore Infernal scorched ground: effect data is invalid.',
		);
	}
	const behaviorData: InfernalScorchedGroundData = {
		attackerId: attackerId as number,
		damages: { ...damages },
	};
	effect.attacker = attacker;
	effect.snapshotBehaviorId = INFERNAL_SCORCHED_GROUND_EFFECT;
	effect.snapshotBehaviorData = behaviorData;
	effect.requireFn = function () {
		const creature = this.trap?.hex?.creature;
		return creature instanceof Creature && creature.id !== attacker.id;
	};
	effect.effectFn = (activeEffect, targetArg) => {
		const target =
			targetArg instanceof Creature
				? targetArg
				: targetArg instanceof Hex && targetArg.creature instanceof Creature
				? targetArg.creature
				: activeEffect.trap?.hex?.creature;
		if (!(target instanceof Creature)) return;
		target.takeDamage(new Damage(attacker, behaviorData.damages, 1, [], G), {
			isFromTrap: true,
		});
		activeEffect.trap.destroy();
		activeEffect.deleteEffect();
	};
};

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default (G) => {
	G.registerSnapshotEffectBehavior(INFERNAL_SCORCHED_GROUND_EFFECT, (effect, data) =>
		bindScorchedGroundEffect(G, effect, data),
	);
	G.abilities[4] = [
		// 	First Ability: Boiling Point
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onStartPhase',

			// 	require() :
			require: function () {
				return this.testRequirements();
			},

			//	activate() :
			activate: function () {
				// Leave two traps behind
				this._addTrap(this.creature.hexagons[1]);
				this._addTrap(this.creature.hexagons[this.creature.player.flipped ? 0 : 2]);

				G.soundsys.playSFX('units/sfx/Infernal 0');
			},

			_addTrap: function (hex) {
				const effect = new Effect(
					this.title,
					this.creature,
					hex,
					'onStepIn',
					{
						attacker: this.creature,
						snapshotBehaviorId: INFERNAL_SCORCHED_GROUND_EFFECT,
						snapshotBehaviorData: {
							attackerId: this.creature.id,
							damages: { ...this.damages },
						},
					},
					G,
				);
				bindScorchedGroundEffect(
					G,
					effect,
					{
						attackerId: this.creature.id,
						damages: { ...this.damages },
					},
					this.creature,
				);

				// Traps last forever if upgraded, otherwise 1 turn
				const lifetime = this.isUpgraded() ? -1 : 1;

				hex.createTrap('scorched-ground', [effect], this.creature.player, {
					turnLifetime: lifetime,
					ownerCreature: this.creature,
					fullTurnLifetime: true,
				});
			},
		},

		// 	Second Ability: Pulverizing Hit
		{
			trigger: 'onQuery',

			// Track the last target
			_lastTargetId: -1,

			_targetTeam: Team.Enemy,

			// 	require() :
			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				if (
					!this.atLeastOneTarget(this.creature.getHexMap(matrices.frontnback3hex), {
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
					fnOnConfirm: (...args) => {
						ability.animation(...args);
					},
					team: this._targetTeam,
					id: crea.id,
					flipped: crea.player.flipped,
					hexes: this.creature.getHexMap(matrices.frontnback3hex),
				});
			},

			activate: function (target) {
				let i;
				const ability = this;
				ability.end();

				const d = {
					burn: this.damages.burn,
					crush: this.damages.crush,
				};
				// Deal extra burn damage based on number of stacks
				let stacksExisting = 0;
				for (i = 0; i < target.effects.length; i++) {
					if (target.effects[i].name === this.title && target.effects[i].owner === this.creature) {
						stacksExisting++;
					}
				}
				d.burn += stacksExisting * this.damages.burn;

				const damage = new Damage(
					ability.creature, // Attacker
					d, // Damage Type
					1, // Area
					[], // Effects
					G,
				);
				target.takeDamage(damage);
				shakeBoard({
					amplitude: 0.02,
					durationMs: 300,
					force: true,
					axis: 'horizontal',
				});

				// Add attack stacks
				let stacksToAdd = 1;
				// If upgraded, extra stacks if hitting the same target
				if (this.isUpgraded() && target.id === this._lastTargetId) {
					stacksToAdd = 2;
				}
				this._lastTargetId = target.id;

				for (i = 0; i < stacksToAdd; i++) {
					target.addEffect(
						new Effect(
							this.title,
							this.creature,
							target,
							'',
							{
								deleteTrigger: '',
								stackable: true,
							},
							G,
						),
					);
				}
			},
		},

		// 	Thirt Ability: Intense Prayer
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			map: [
				[0, 0, 1, 0],
				[0, 0, 1, 1],
				[1, 1, 1, 0], // Origin line
				[0, 0, 1, 1],
				[0, 0, 1, 0],
			],

			require: function () {
				return this.testRequirements();
			},

			// 	query() :
			query: function () {
				const ability = this;
				const crea = this.creature;

				this.map.origin = [0, 2];

				G.grid.queryChoice({
					fnOnConfirm: (...args) => {
						ability.animation(...args);
					},
					team: Team.Both,
					requireCreature: 0,
					id: crea.id,
					flipped: crea.player.flipped,
					choices: [crea.getHexMap(this.map), crea.getHexMap(this.map, true)],
				});
			},

			//	activate() :
			activate: function (hexes) {
				const ability = this;
				ability.end();

				// Attack all creatures in area except for self
				const targets = ability.getTargets(hexes);
				for (let i = 0; i < targets.length; i++) {
					if (targets[i].target === this.creature) {
						targets.splice(i, 1);
						break;
					}
				}
				ability.areaDamage(
					ability.creature, // Attacker
					ability.damages1, // Damage Type
					[], // Effects
					targets,
				);

				// If upgraded, leave Boiling Point traps on all hexes that don't contain
				// another creature
				if (this.isUpgraded()) {
					hexes.forEach(function (hex) {
						if (!hex.creature || hex.creature === ability.creature) {
							ability.creature.abilities[0]._addTrap(hex);
						}
					});
				}
			},
		},

		// 	Fourth Ability: Molten Hurl
		{
			//	Type : Can be "onQuery","onStartPhase","onDamage"
			trigger: 'onQuery',

			isMovementAbility: 'safe',

			directions: [0, 1, 0, 0, 1, 0],
			_targetTeam: Team.Enemy,

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				// Creature must be moveable
				if (!this.creature.stats.moveable) {
					this.message = G.msg.abilities.notMoveable;
					return false;
				}

				const crea = this.creature;
				const x = crea.player.flipped ? crea.x - crea.size + 1 : crea.x;

				if (
					!this.testDirection({
						team: this._targetTeam,
						x: x,
						directions: this.directions,
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

				const x = crea.player.flipped ? crea.x - crea.size + 1 : crea.x;

				G.grid.queryDirection({
					fnOnConfirm: (...args) => {
						ability.animation(...args);
					},
					team: this._targetTeam,
					id: crea.id,
					requireCreature: true,
					x: x,
					y: crea.y,
					directions: this.directions,
				});
			},

			//	activate() :
			activate: function (path, args) {
				const ability = this;
				const crea = this.creature;

				const finalizeHurl = () => {
					const activeCreature = G.activeCreature;
					G.UI.selectAbility(-1);
					if (activeCreature?.dead || (!activeCreature && crea.dead)) {
						if (G._deferredQueryMovePending > 0) {
							G._deferredQueryMovePending--;
						}
						if (G._deferredQueryMovePending === 0 && G.animationQueue.length === 0) {
							G.freezedInput = false;
							G.grid?.refreshHoverState?.();
						}
						return;
					}
					if (activeCreature?.queryMove) {
						activeCreature.queryMove();
						return;
					}
					crea.queryMove();
				};

				ability.end(false, true);

				// Damage
				const damage = new Damage(
					ability.creature, // Attacker
					ability.damages, // Damage Type
					1, // Area
					[], // Effects
					G,
				);

				// NOTE: Destroy traps currently under self
				getPointFacade()
					.getTrapsAt(crea)
					.forEach((trap) => trap.destroy());

				// Movement
				const hurl = (_path) => {
					const target = arrayUtils.last(_path).creature;

					const magmaHex = crea.hexagons[args.direction === 4 ? crea.size - 1 : 0];
					arrayUtils.filterCreature(_path, false, false);
					if (magmaHex) {
						_path.unshift(magmaHex); // Prevent error on empty path
					}

					const offset = args.direction === 4 ? crea.size - 1 : 0;
					let destination;
					for (let i = _path.length - 1; i >= 0; i--) {
						const candidate = _path[i];
						const x = candidate.x + offset;
						const candidateHex = G.grid.hexes[candidate.y]?.[x];

						if (candidateHex && candidateHex.isWalkable(crea.size, crea.id, true)) {
							destination = candidateHex;
							break;
						}
					}

					if (!destination) {
						finalizeHurl();
						return;
					}

					crea.moveTo(destination, {
						ignoreMovementPoint: true,
						ignorePath: true,
						afterimages: true,
						callback: function () {
							// Destroy traps along path
							_path.forEach(function (hex) {
								if (!hex || !hex.trap) {
									return;
								}

								hex.destroyTrap();
							});

							let targetKilled = false;
							if (target !== undefined) {
								const ret = target.takeDamage(damage, true);
								targetKilled = ret.kill;
							}

							// If upgraded and target killed, keep going in the same direction and
							// find the next target to move into
							let continueHurl = false;
							if (ability.isUpgraded() && targetKilled) {
								const nextPath = G.grid.getHexLine(target.x, target.y, args.direction, false);
								arrayUtils.filterCreature(nextPath, true, true, crea.id);
								const nextTarget = arrayUtils.last(nextPath).creature;
								// Continue only if there's a next enemy creature
								if (nextTarget && isTeam(crea, nextTarget, ability._targetTeam)) {
									continueHurl = true;
									hurl(nextPath);
								}
							}
							if (!continueHurl) {
								finalizeHurl();
							}
						},
					});
				};
				shakeBoard({
					amplitude: 0.01,
					durationMs: 300,
					force: true,
					axis: 'both',
				});
				hurl(path);
			},
		},
	];
};
