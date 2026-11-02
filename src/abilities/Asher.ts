import { Damage } from '../damage';
import { Team, isTeam } from '../utility/team';
import { Creature } from '../creature';
import { Effect } from '../effect';
import { Hex } from '../utility/hex';
import { BOARD_DEPTH_SCALE_Y } from '../game-display/layer';
import { Easing } from '../utility/easing';
import { shakeBoard } from '../game-display/camera';
import type { QueueEvent } from '../event_queue';
import { spawnProjectileVertigoTrail } from '../vertigo';
import { SnapshotCompatibilityError, type QueueEventSnapshot } from '../engine/GameSnapshot';
import {
	ASHER_CRASHING_GLOBE_BURN_EFFECT,
	ASHER_CRASHING_GLOBE_EVENT,
	ASHER_COVERT_STRIKE_MOVE_EFFECT,
	ASHER_GLOWING_EYE_EFFECT,
	ASHER_HEAT_HAZE_BURN_EFFECT,
} from '../engine/asherSnapshotBehaviors';

type CrashingGlobeSnapshotData = {
	attackerId: number;
	hexX: number;
	hexY: number;
	targetId: number | null;
	damages: Record<string, number>;
	upgraded: boolean;
};

type CrashingGlobeOwner = Creature & {
	_pendingCrashingGlobes?: object[];
	_crashingGlobePending?: boolean;
};

type AsherTargetEffectData = { asherId: number; targetId: number };

const getSnapshotCreature = (G, id: unknown, behavior: string): Creature => {
	if (!Number.isInteger(id) || !(G.creatures?.[id as number] instanceof Creature)) {
		throw new SnapshotCompatibilityError(
			`Cannot restore ${behavior}: creature reference is invalid.`,
		);
	}
	return G.creatures[id as number];
};

const bindHeatHazeBurnEffect = (G, effect: Effect, data?: Record<string, unknown>) => {
	const candidate = data as Partial<AsherTargetEffectData> | undefined;
	const asher = getSnapshotCreature(G, candidate?.asherId, 'Heat Haze Burn');
	const target = getSnapshotCreature(G, candidate?.targetId, 'Heat Haze Burn');
	if (asher.name !== 'Asher' || effect.owner !== asher || effect.target !== target) {
		throw new SnapshotCompatibilityError(
			'Cannot restore Heat Haze Burn: effect references are invalid.',
		);
	}
	effect.snapshotBehaviorId = ASHER_HEAT_HAZE_BURN_EFFECT;
	effect.snapshotBehaviorData = { asherId: asher.id, targetId: target.id };
	effect.requireFn = (damage) =>
		damage instanceof Damage &&
		!damage.isFromHazeBurn &&
		damage.attacker instanceof Creature &&
		isTeam(damage.attacker, asher, Team.Ally) &&
		damage.target instanceof Creature;
	effect.effectFn = (_activeEffect, damage: Damage) => {
		if (!(damage instanceof Damage) || !(damage.target instanceof Creature)) return;
		const burn = new Damage(asher, { burn: 3 }, 1, [], G);
		burn.isFromHazeBurn = true;
		damage.target.takeDamage(burn);
	};
};

const bindGlowingEyeEffect = (G, effect: Effect, data?: Record<string, unknown>) => {
	const candidate = data as Partial<AsherTargetEffectData> | undefined;
	const asher = getSnapshotCreature(G, candidate?.asherId, 'Glowing Eye');
	const target = getSnapshotCreature(G, candidate?.targetId, 'Glowing Eye');
	if (asher.name !== 'Asher' || effect.owner !== asher || effect.target !== target) {
		throw new SnapshotCompatibilityError(
			'Cannot restore Glowing Eye: effect references are invalid.',
		);
	}
	effect.snapshotBehaviorId = ASHER_GLOWING_EYE_EFFECT;
	effect.snapshotBehaviorData = { asherId: asher.id, targetId: target.id };
	effect.effectFn = (_activeEffect, creature) => {
		if (creature === target) target.recharge(0);
	};
};

const bindCovertStrikeMoveEffect = (G, effect: Effect, data?: Record<string, unknown>) => {
	const candidate = data as Partial<AsherTargetEffectData> | undefined;
	const asher = getSnapshotCreature(G, candidate?.asherId, 'Covert Strike Move');
	const target = getSnapshotCreature(G, candidate?.targetId, 'Covert Strike Move');
	if (asher.name !== 'Asher' || effect.owner !== asher || effect.target !== target) {
		throw new SnapshotCompatibilityError(
			'Cannot restore Covert Strike Move: effect references are invalid.',
		);
	}
	effect.snapshotBehaviorId = ASHER_COVERT_STRIKE_MOVE_EFFECT;
	effect.snapshotBehaviorData = { asherId: asher.id, targetId: target.id };
	effect.effectFn = (_activeEffect, creature) => {
		if (creature === target) target.remainingMove = 0;
	};
};

const bindCrashingGlobeBurnEffect = (G, effect: Effect, data?: Record<string, unknown>) => {
	const attackerIdValue = data?.attackerId;
	if (typeof attackerIdValue !== 'number' || !Number.isInteger(attackerIdValue)) {
		throw new SnapshotCompatibilityError(
			'Cannot restore Crashing Globe Burn: attacker reference is invalid.',
		);
	}
	const attackerId = attackerIdValue;
	const attacker = G.creatures[attackerId];
	if (!(attacker instanceof Creature)) {
		throw new SnapshotCompatibilityError(
			'Cannot restore Crashing Globe Burn: attacker is missing.',
		);
	}
	effect.attacker = attacker;
	effect.snapshotBehaviorId = ASHER_CRASHING_GLOBE_BURN_EFFECT;
	effect.snapshotBehaviorData = { attackerId };
	effect.requireFn = function () {
		const creature = this.trap.hex.creature;
		return creature instanceof Creature && creature.id !== attacker.id;
	};
	effect.effectFn = (_effect, target) => {
		const creature =
			target instanceof Creature
				? target
				: target instanceof Hex && target.creature instanceof Creature
				? target.creature
				: undefined;
		if (creature) {
			creature.takeDamage(new Damage(attacker, { burn: 10 }, 1, [], G));
		}
		_effect.trap.destroy();
		_effect.deleteEffect();
	};
};

const createCrashingGlobeBurnEffect = (G, attacker: Creature, hex: Hex) => {
	const data = { attackerId: attacker.id };
	const effect = new Effect(
		'Crashing Globe Burn',
		attacker,
		hex,
		'onStepIn',
		{
			attacker,
			snapshotBehaviorId: ASHER_CRASHING_GLOBE_BURN_EFFECT,
			snapshotBehaviorData: data,
		},
		G,
	);
	bindCrashingGlobeBurnEffect(G, effect, data);
	return effect;
};

const restoreCrashingGlobeEvent = (G, snapshot: QueueEventSnapshot): QueueEvent => {
	const data = snapshot.data as unknown as CrashingGlobeSnapshotData;
	if (
		!Number.isInteger(data.attackerId) ||
		!Number.isInteger(data.hexX) ||
		!Number.isInteger(data.hexY) ||
		(data.targetId !== null && !Number.isInteger(data.targetId)) ||
		typeof data.upgraded !== 'boolean' ||
		!data.damages ||
		typeof data.damages !== 'object' ||
		Object.values(data.damages).some(
			(amount) => typeof amount !== 'number' || !Number.isFinite(amount),
		)
	) {
		throw new SnapshotCompatibilityError('Cannot restore Crashing Globe: event data is invalid.');
	}
	const attacker = G.creatures[data.attackerId];
	const hex = G.grid.hexAt(data.hexX, data.hexY);
	const target = data.targetId === null ? undefined : G.creatures[data.targetId];
	if (
		!(attacker instanceof Creature) ||
		!(hex instanceof Hex) ||
		(data.targetId !== null && !target)
	) {
		throw new SnapshotCompatibilityError('Cannot restore Crashing Globe: event data is invalid.');
	}
	const projectile = {
		hex,
		target,
		attacker,
		damages: data.damages,
		upgraded: data.upgraded,
		_resolved: false,
	};
	const globeOwner = attacker as CrashingGlobeOwner;
	if (!globeOwner._pendingCrashingGlobes) globeOwner._pendingCrashingGlobes = [];
	globeOwner._pendingCrashingGlobes.push(projectile);
	globeOwner._crashingGlobePending = true;
	hex._markedByCrashingGlobe = true;
	hex.overlayVisualState('crashing-globe-target p' + attacker.team);
	hex.updateStyle();

	return {
		isEvent: true,
		id: snapshot.id,
		type: 'crashing-globe',
		turn: snapshot.turn,
		initiative: snapshot.initiative,
		delayed: snapshot.delayed,
		title: snapshot.title,
		data: { attacker, hex, upgraded: data.upgraded },
		snapshotBehaviorId: snapshot.snapshotBehaviorId,
		snapshotBehaviorData: data,
		resolve: (onComplete) => {
			if (projectile._resolved) {
				onComplete();
				return;
			}
			projectile._resolved = true;
			globeOwner._pendingCrashingGlobes = globeOwner._pendingCrashingGlobes.filter(
				(pending) => pending !== projectile,
			);
			globeOwner._crashingGlobePending = globeOwner._pendingCrashingGlobes.length > 0;
			G.log(
				'%CreatureName' +
					attacker.id +
					'%s Crashing Globe strikes' +
					(projectile.target ? ' %CreatureName' + projectile.target.id + '%' : ' an empty hex') +
					'!',
			);
			const targetCreature = hex.creature;
			if (targetCreature instanceof Creature) {
				targetCreature.takeDamage(new Damage(attacker, data.damages, 1, [], G));
			}
			if (data.upgraded && !(targetCreature instanceof Creature)) {
				hex.createTrap(
					'scorched-ground',
					[createCrashingGlobeBurnEffect(G, attacker, hex)],
					projectile.target?.player || attacker.player,
					{
						turnLifetime: -1,
						ownerCreature: attacker,
						fullTurnLifetime: true,
					},
				);
			}
			hex.cleanOverlayVisualState('crashing-globe-target p' + attacker.team);
			hex._markedByCrashingGlobe = false;
			hex.updateStyle();
			onComplete();
		},
	};
};

export default function (G) {
	G.registerSnapshotEffectBehavior(ASHER_HEAT_HAZE_BURN_EFFECT, (effect, data) =>
		bindHeatHazeBurnEffect(G, effect, data),
	);
	G.registerSnapshotEffectBehavior(ASHER_GLOWING_EYE_EFFECT, (effect, data) =>
		bindGlowingEyeEffect(G, effect, data),
	);
	G.registerSnapshotEffectBehavior(ASHER_COVERT_STRIKE_MOVE_EFFECT, (effect, data) =>
		bindCovertStrikeMoveEffect(G, effect, data),
	);
	G.registerSnapshotEffectBehavior(ASHER_CRASHING_GLOBE_BURN_EFFECT, (effect, data) =>
		bindCrashingGlobeBurnEffect(G, effect, data),
	);
	G.registerSnapshotEventBehavior(ASHER_CRASHING_GLOBE_EVENT, (snapshot) =>
		restoreCrashingGlobeEvent(G, snapshot),
	);
	G.abilities[22] = [
		// First Ability: Heat Haze
		{
			trigger: 'onStartPhase',
			_targetTeam: Team.Enemy,

			require: function () {
				return (
					this.testRequirements() &&
					this.atLeastOneTarget(this.creature.adjacentHexes(1), {
						team: this._targetTeam,
					})
				);
			},

			activate: function () {
				const ability = this;
				const crea = this.creature;

				crea.adjacentHexes(1).forEach((hex) => {
					const foe = hex.creature;
					if (!(foe instanceof Creature) || !isTeam(crea, foe, ability._targetTeam)) {
						return;
					}

					const reduction = Math.max(1, Math.floor(foe.stats.offense * 0.25));
					foe.addEffect(
						new Effect(
							'Heat Haze',
							crea,
							foe,
							'',
							{
								alterations: { offense: -reduction },
								turnLifetime: 1,
								deleteTrigger: 'onStartOfRound',
								stackable: false,
							},
							G,
						),
					);

					if (ability.hasUpgrade()) {
						const burnEffect = new Effect(
							'Heat Haze Burn',
							crea,
							foe,
							'onDamage',
							{
								snapshotBehaviorId: ASHER_HEAT_HAZE_BURN_EFFECT,
								snapshotBehaviorData: { asherId: crea.id, targetId: foe.id },
								turnLifetime: 1,
								deleteTrigger: 'onStartOfRound',
								stackable: false,
							},
							G,
						);
						bindHeatHazeBurnEffect(G, burnEffect, burnEffect.snapshotBehaviorData);
						foe.addEffect(burnEffect);
					}
				});
			},
		},

		// Second Ability: Glowing Eye
		{
			trigger: 'onQuery',
			_targetTeam: Team.Enemy,

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}
				return this.atLeastOneTarget(this.creature.adjacentHexes(1), {
					team: this._targetTeam,
				});
			},

			query: function () {
				const ability = this;
				const crea = this.creature;

				G.grid.queryCreature({
					fnOnConfirm: function (...args) {
						ability.animation(...args);
					},
					team: this._targetTeam,
					id: crea.id,
					flipped: crea.player.flipped,
					hexes: crea.adjacentHexes(1),
				});
			},

			activate: function (target) {
				const ability = this;
				ability.end();

				if (ability.hasUpgrade()) {
					if (target.stats.meditation > 0) {
						const glowingEyeEffect = new Effect(
							'Glowing Eye',
							ability.creature,
							target,
							'onStartPhase',
							{
								alterations: { meditation: -target.stats.meditation },
								snapshotBehaviorId: ASHER_GLOWING_EYE_EFFECT,
								snapshotBehaviorData: {
									asherId: ability.creature.id,
									targetId: target.id,
								},
								turnLifetime: 0,
								deleteTrigger: 'onEndPhase',
								stackable: false,
							},
							G,
						);
						bindGlowingEyeEffect(G, glowingEyeEffect, glowingEyeEffect.snapshotBehaviorData);
						target.addEffect(glowingEyeEffect);
						target.updateAlteration();
					}
				}

				target.takeDamage(new Damage(ability.creature, ability.damages, 1, [], G));
				shakeBoard({
					amplitude: 0.01,
					durationMs: 100,
					force: true,
					axis: 'horizontal',
				});
			},
		},

		// Third Ability: Covert Strike
		{
			trigger: 'onQuery',
			_targetTeam: Team.Enemy,

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}
				return this.atLeastOneTarget(this.creature.adjacentHexes(5), {
					team: this._targetTeam,
				});
			},

			query: function () {
				const ability = this;
				const crea = this.creature;

				G.grid.queryCreature({
					fnOnConfirm: function (...args) {
						ability.animation(...args);
					},
					team: this._targetTeam,
					id: crea.id,
					flipped: crea.player.flipped,
					hexes: crea.adjacentHexes(5),
				});
			},

			activate: function (target) {
				const ability = this;
				ability.end();

				const alterations: { [key: string]: number } = {};

				const defReduction = Math.floor(target.stats.defense * 0.25);
				if (defReduction > 0) {
					alterations.defense = -defReduction;
				}

				if (Object.keys(alterations).length > 0) {
					target.addEffect(
						new Effect(
							'Covert Strike',
							ability.creature,
							target,
							'',
							{
								alterations,
								turnLifetime: 1,
								deleteTrigger: 'onStartOfRound',
								stackable: false,
							},
							G,
						),
					);
					target.updateAlteration();
				}

				if (ability.hasUpgrade() && target.stats.movement > 0) {
					const moveEffect = new Effect(
						'Covert Strike Move',
						ability.creature,
						target,
						'onStartPhase',
						{
							snapshotBehaviorId: ASHER_COVERT_STRIKE_MOVE_EFFECT,
							snapshotBehaviorData: {
								asherId: ability.creature.id,
								targetId: target.id,
							},
							turnLifetime: 0,
							deleteTrigger: 'onEndPhase',
							stackable: false,
						},
						G,
					);
					bindCovertStrikeMoveEffect(G, moveEffect, moveEffect.snapshotBehaviorData);
					target.addEffect(moveEffect);
				}

				target.takeDamage(new Damage(ability.creature, ability.damages, 1, [], G));
				shakeBoard({
					amplitude: 0.01,
					durationMs: 100,
					force: true,
					axis: 'horizontal',
				});
			},
		},

		// Fourth Ability: Crashing Globe
		{
			trigger: 'onQuery',
			_targetTeam: Team.Enemy,

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}
				return G.grid.allhexes.length > 0;
			},

			query: function () {
				const ability = this;
				const crea = this.creature;

				G.grid.queryHexes({
					fnOnConfirm: function (...args) {
						ability.animation(...args);
					},
					fnOnHover: function (hex: Hex) {
						G.grid.forEachHex(function (h: Hex) {
							if (h._markedByCrashingGlobe) {
								return;
							}
							h.cleanOverlayVisualState('crashing-globe-target p' + crea.player.team);
						});
						if (!hex._markedByCrashingGlobe) {
							hex.overlayVisualState('crashing-globe-target hover p' + crea.player.team);
						}
					},
					id: crea.id,
					flipped: crea.player.flipped,
					hexes: G.grid.allhexes,
					targeting: false,
					fillHexOnHover: false,
					hideNonTarget: true,
				});
			},

			activate: function (hex, _args) {
				const ability = this;
				const crea = ability.creature;

				if (!(hex instanceof Hex)) {
					ability.end();
					return;
				}

				const emis = crea.legacyProjectileEmissionPoint;
				const cardboard = crea.creatureSprite.sprite;
				const firingDirection = cardboard.scale.x < 0 ? -1 : 1;
				const cardboardAnchorX = cardboard.x + emis.x;
				const cardboardAnchorY = cardboard.y + emis.y;
				const projectileX = cardboardAnchorX + (104 - cardboard.width / 2) * cardboard.scale.x;
				const projectileY = cardboardAnchorY + (28 - cardboard.height) * cardboard.scale.y;
				const spinDirection = firingDirection;
				const launchEnd = { x: projectileX, y: -600 };
				const launchDistance = Math.abs(launchEnd.y - projectileY);
				const spinPerFlight = Math.PI * 2;
				const launchDuration = 800;
				const projSprite = G.gameEngine.add.sprite(
					projectileX,
					projectileY,
					'effects_crushing-globe',
					undefined,
					G.grid.creatureGroup,
				);
				projSprite.setOrigin(0.5, 0.5);
				const launchTween = G.gameEngine
					.tween(projSprite)
					.to(
						{
							y: launchEnd.y,
							rotation: projSprite.rotation + spinDirection * spinPerFlight,
						},
						launchDuration,
						Easing.Linear.None,
					)
					.start();
				launchTween.onComplete.add(() => {
					if (!crea.dead && !crea.creatureSprite.destroyed) {
						crea.facePlayerDefault();
					}
				});
				spawnProjectileVertigoTrail(
					G,
					projSprite,
					{ x: projectileX, y: projectileY },
					launchEnd,
					launchDuration,
					projSprite.rotation,
					projSprite.rotation + spinDirection * spinPerFlight,
				);

				if (!crea._pendingCrashingGlobes) {
					crea._pendingCrashingGlobes = [];
				}
				const proj = {
					hex,
					target: hex.creature || undefined,
					attacker: crea,
					damages: ability.damages,
					upgraded: ability.hasUpgrade(),
					sprite: projSprite,
					spinDirection,
					_resolved: false,
				};
				crea._pendingCrashingGlobes.push(proj);
				crea._crashingGlobePending = true;

				const initiative = crea.stats.initiative + 1;
				const eventId =
					'crashing-globe-' + crea.id + '-' + G.turn + '-' + crea._pendingCrashingGlobes.length;
				const snapshotData: CrashingGlobeSnapshotData = {
					attackerId: crea.id,
					hexX: hex.x,
					hexY: hex.y,
					targetId: proj.target?.id ?? null,
					damages: { ...proj.damages },
					upgraded: proj.upgraded,
				};
				const event: QueueEvent<{ attacker: Creature; hex: Hex; upgraded: boolean }> = {
					isEvent: true,
					id: eventId,
					type: 'crashing-globe',
					turn: G.turn + 1,
					initiative,
					delayed: false,
					title: proj.upgraded ? 'Crashing Globe (upgraded)' : 'Crashing Globe',
					snapshotBehaviorId: ASHER_CRASHING_GLOBE_EVENT,
					snapshotBehaviorData: snapshotData,
					data: {
						attacker: crea,
						hex: proj.hex,
						upgraded: proj.upgraded,
					},
					resolve: (onComplete: () => void) => {
						if (proj._resolved) {
							onComplete();
							return;
						}
						proj._resolved = true;

						// Clear pending list immediately so queue updates correctly
						crea._pendingCrashingGlobes = crea._pendingCrashingGlobes.filter((p) => p !== proj);
						crea._crashingGlobePending = crea._pendingCrashingGlobes.length > 0;

						G.log(
							'%CreatureName' +
								proj.attacker.id +
								'%s Crashing Globe strikes' +
								(proj.target ? ' %CreatureName' + proj.target.id + '%' : ' an empty hex') +
								'!',
						);

						const targetCreature = proj.hex.creature;
						if (targetCreature instanceof Creature) {
							targetCreature.takeDamage(new Damage(proj.attacker, proj.damages, 1, [], G));
						}

						if (proj.upgraded && !(targetCreature instanceof Creature)) {
							proj.hex.createTrap(
								'scorched-ground',
								[createCrashingGlobeBurnEffect(G, proj.attacker, proj.hex)],
								proj.target ? proj.target.player : crea.player,
								{
									turnLifetime: -1,
									ownerCreature: proj.attacker,
									fullTurnLifetime: true,
								},
							);
						}

						const finish = () => {
							shakeBoard({
								amplitude: 0.02,
								durationMs: 200,
								force: true,
								axis: 'both',
							});
							proj.hex.cleanOverlayVisualState(
								'crashing-globe-target p' + proj.attacker.player.team,
							);
							proj.hex._markedByCrashingGlobe = false;
							proj.hex.updateStyle();
							onComplete();
						};
						const projSprite = proj.sprite;
						if (projSprite && projSprite.parent) {
							const targetHitBox = proj.hex.hitBox;
							projSprite.x = targetHitBox.x + targetHitBox.width / 2;
							projSprite.y = -600;
							projSprite.alpha = 1;
							const fallStart = { x: projSprite.x, y: projSprite.y };
							const fallEnd = {
								x: projSprite.x,
								// Convert the hitbox center into the unscaled creature layer's coordinates.
								y: (targetHitBox.y + targetHitBox.height / 2) * BOARD_DEPTH_SCALE_Y,
							};
							const fallDistance = Math.abs(fallEnd.y - fallStart.y);
							const fallDuration = Math.max(
								1,
								(fallDistance * launchDuration) / (launchDistance * 1.5),
							);
							const fallStartRotation = projSprite.rotation;
							const fallEndRotation = fallStartRotation + proj.spinDirection * spinPerFlight;
							spawnProjectileVertigoTrail(
								G,
								projSprite,
								fallStart,
								fallEnd,
								fallDuration,
								fallStartRotation,
								fallEndRotation,
							);
							const fallTween = G.gameEngine
								.tween(projSprite)
								.to(
									{
										y: fallEnd.y,
										alpha: 0,
										rotation: fallEndRotation,
									},
									fallDuration,
									Easing.Linear.None,
								)
								.start();
							fallTween.onComplete.add(function () {
								projSprite.destroy();
								finish();
							});
						} else {
							finish();
						}
					},
				};
				G.queue.addEvent(event);

				hex.cleanOverlayVisualState('hover');
				hex.overlayVisualState('crashing-globe-target p' + crea.player.team);
				hex._markedByCrashingGlobe = true;
				hex.updateStyle();

				ability.end();
				crea.creatureSprite.setDir(firingDirection);

				if (typeof G.updateQueueDisplay === 'function') {
					G.updateQueueDisplay();
				}

				shakeBoard({
					amplitude: 0.02,
					durationMs: 200,
					force: true,
					axis: 'both',
				});
			},
		},
	];
}
