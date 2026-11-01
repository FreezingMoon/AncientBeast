import { Damage } from '../damage';
import { Team, isTeam } from '../utility/team';
import * as arrayUtils from '../utility/arrayUtils';
import { Effect } from '../effect';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import Game from '../game';
import { shakeBoard } from '../game-display/camera';
import {
	spawnBadBreathCloud,
	spawnBadBreath,
	spawnBadBreathVfx,
	spawnBadBreathClouds,
	spawnToxicCloud,
	spawnToxicClouds,
	spawnSwamplerBadBreath,
} from '../vfx/bad-breath';
import { spawnGooSneeze } from '../vfx/goo-sneeze';
import { applyGooContagion } from './contagion';

export default (G: Game) => {
	G.abilities[13] = [
		// First Ability: Natural Habitat
		{
			trigger: 'onEndPhase',

			require: function () {
				// Claim the hex where Swampler ends his first active turn.
				if (this.creature.turnsActive !== 1 || this.creature.materializationSickness) {
					return false;
				}
				// Check if home already set
				const homeHex = G.grid.hexes[this.creature.y]?.[this.creature.x];
				if (homeHex && homeHex._swamplerHomeOwner === this.creature.id) {
					return false;
				}
				return true;
			},

			activate: function () {
				const ability = this;
				const crea = ability.creature;
				const hex = G.grid.hexes[crea.y]?.[crea.x];
				if (!hex) return;

				// Mark this hex as Swampler's swamp home
				hex._swamplerHomeOwner = crea.id;

				hex.updateStyle();

				G.log('%CreatureName' + crea.id + '% has claimed spot as its swamp!');

				const hasRegrowthBonus = ability.isUpgraded();
				const homeAlterations = {
					poison: 22,
					...(hasRegrowthBonus ? { regrowth: 20 } : {}),
				};
				const homeEffect = new Effect(
					'Natural Habitat',
					crea,
					crea,
					'onStepIn',
					{
						turnLifetime: -1,
						alterations: { ...homeAlterations },
					},
					G,
				);
				homeEffect.effectFn = (_effect, event) => {
					const steppedHex = event as Hex | undefined;
					if (steppedHex?._swamplerHomeOwner !== crea.id) return;
					homeEffect.alterations = { ...homeAlterations };
					crea.updateAlteration();
					crea.hint('Home', 'msg_effects');
				};
				crea.addEffect(homeEffect);

				const leaveHomeEffect = new Effect(
					'',
					crea,
					crea,
					'onStepOut',
					{
						turnLifetime: -1,
						deleteOnOwnerDeath: true,
						stackable: false,
					},
					G,
				);
				leaveHomeEffect.effectFn = (_effect, event) => {
					const steppedHex = event as Hex | undefined;
					if (steppedHex?._swamplerHomeOwner !== crea.id) return;
					homeEffect.alterations = {};
					crea.updateAlteration();
				};
				crea.addEffect(leaveHomeEffect);
			},
		},

		// Second Ability: Rabid Nip
		{
			trigger: 'onQuery',

			_targetTeam: Team.Enemy,

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				if (
					!this.atLeastOneTarget(this.creature.adjacentHexes(1), {
						team: this._targetTeam,
					})
				) {
					return false;
				}
				return true;
			},

			query: function () {
				const ability = this;
				const crea = this.creature;

				G.grid.queryCreature({
					fnOnConfirm: function (...args: any[]) {
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
				shakeBoard({
					amplitude: 0.01,
					durationMs: 70,
					force: true,
					axis: 'horizontal',
				});

				const damage = new Damage(ability.creature, ability.damages, 1, [], G);
				const result = target.takeDamage(damage);

				if (result.kill) {
					return;
				}

				// Effect lingers for three turns
				const effect = new Effect(
					'Rabid Nip',
					ability.creature,
					target,
					'onStartPhase',
					{
						turnLifetime: 3,
					},
					G,
				);
				target.addEffect(effect);

				if (this.isUpgraded()) {
					target.addEffect(
						new Effect(
							'Rabid Nip - Regrowth',
							ability.creature,
							target,
							'',
							{
								turnLifetime: 1,
								alterations: {
									regrowth: -target.stats.regrowth >= -5 ? -target.stats.regrowth : -5,
								},
							},
							G,
						),
					);
				}
			},
		},

		// Third Ability: Bad Breath
		{
			trigger: 'onQuery',

			_targetTeam: Team.Enemy,

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}
				return this.creature.adjacentHexes(1).length > 0;
			},

			query: function () {
				const ability = this;
				const crea = this.creature;

				G.grid.queryHexes({
					fnOnConfirm: function (hex: Hex) {
						ability.animation(hex);
					},
					id: crea.id,
					flipped: crea.player.flipped,
					hexes: crea.adjacentHexes(1),
					targeting: true,
					hideNonTarget: true,
				});
			},

			activate: function (hex: Hex) {
				const ability = this;
				const crea = this.creature;
				const resumeQueryMove = () => {
					const activeCreature = G.activeCreature;
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

					(activeCreature ?? crea).queryMove();
				};
				ability.end(false, true);
				shakeBoard({
					amplitude: 0.01,
					durationMs: 80,
					force: true,
					axis: 'vertical',
				});

				const adjacent = crea.adjacentHexes(1);
				const targetHex = hex instanceof Hex ? hex : adjacent[0];

				// Cluster: clicked hex + the two adjacent hexes around it (in the ring).
				const cluster: Hex[] = [targetHex];
				for (const h of adjacent) {
					if (h === targetHex) continue;
					if (targetHex.adjacentHex(1).some((n: Hex) => n.x === h.x && n.y === h.y)) {
						cluster.push(h);
					}
				}
				const targetHexes = cluster.slice(0, 3);

				const upgraded = this.isUpgraded();

				// Damage enemies in the affected hexes.
				for (const h of targetHexes) {
					const c = h.creature;
					if (c instanceof Creature && isTeam(crea, c, this._targetTeam)) {
						const dmg = ability.damages ? { ...ability.damages } : { poison: 10 };
						if (c.player.flipped !== crea.player.flipped) {
							dmg.poison = (dmg.poison || 10) * 2;
						} else {
							dmg.poison = (dmg.poison || 10) * 2;
						}
						c.takeDamage(new Damage(crea, dmg, 1, [], G));
					}
				}

				// VFX + persistent clouds.
				const spawnCloud =
					spawnBadBreathCloud ||
					spawnBadBreath ||
					spawnBadBreathVfx ||
					spawnBadBreathClouds ||
					spawnToxicCloud ||
					spawnToxicClouds ||
					spawnSwamplerBadBreath;
				// Pass hexes as pseudo-targets for VFX and keep the facing until their
				// emission tweens finish. Deferred ending also delays the normal facing
				// reset performed by queryMove().
				const pseudoTargets = targetHexes.map((h) => ({ hex: h, hexagons: [h], x: h.x, y: h.y }));
				if (spawnCloud) {
					spawnCloud(G, crea, pseudoTargets, upgraded, resumeQueryMove);
				} else {
					resumeQueryMove();
				}
			},
		},

		// Fourth Ability: Goo Sneeze
		{
			trigger: 'onQuery',

			_targetTeam: Team.Enemy,

			range: { regular: 5, upgraded: 7 },

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}
				const range = this.isUpgraded() ? this.range.upgraded : this.range.regular;
				const cre = this.creature;
				const allDirHexes = [];
				for (let i = 0; i < 6; i++) {
					allDirHexes.push(...G.grid.getHexLine(cre.x, cre.y, i, false).slice(1, 1 + range));
				}
				return this.atLeastOneTarget(allDirHexes, {
					team: this._targetTeam,
				});
			},

			query: function () {
				const ability = this;
				const crea = this.creature;
				const range = this.isUpgraded() ? this.range.upgraded : this.range.regular;

				G.grid.queryDirection({
					fnOnConfirm: function (...args: any[]) {
						ability.animation(...args);
					},
					team: this._targetTeam,
					id: crea.id,
					flipped: crea.player.flipped,
					x: crea.x,
					y: crea.y,
					sourceCreature: crea,
					directions: [1, 1, 1, 1, 1, 1],
					distance: range,
					minDistance: 1,
					requireCreature: true,
				});
			},

			activate: function (hexes: Hex[], _args: any) {
				const ability = this;
				ability.end();
				shakeBoard({
					amplitude: 0.01,
					durationMs: 100,
					force: true,
					axis: 'horizontal',
				});

				const targetHex = hexes && hexes.find((h: Hex) => h.creature);
				const target = targetHex ? targetHex.creature : undefined;
				if (!target) return;

				const dmg = { crush: 4 };
				spawnGooSneeze(G, this.creature, targetHex, () => {
					if (target.dead) return;

					const result = target.takeDamage(new Damage(this.creature, dmg, 1, [], G));
					if (result.kill || result.damageObj?.status !== '') return;

					applyGooContagion(G, target, this.creature, 6, this.isUpgraded());
				});
			},
		},
	];
};
