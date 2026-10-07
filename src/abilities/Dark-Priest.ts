import $j from 'jquery';
import { Damage } from '../damage';
import { Team } from '../utility/team';
import * as arrayUtils from '../utility/arrayUtils';
import { Hex } from '../utility/hex';
import { Creature } from '../creature';
import { CreatureType } from '../data/types';
import Game from '../game';
import { shakeBoard } from '../game-display/camera';
import { getDepthAtBand } from '../game-display/layer';
import { getFrameSize } from '../game-display/texture';
import { spawnChainLightning } from '../vfx/lightning/effect';
import { electroShockerLook } from '../vfx/lightning/look';

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default (G: Game) => {
	G.abilities[0] = [
		// 	First Ability: Plasma Field
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onUnderAttack',

			// 	require() :
			require: function () {
				this.creature.protectedFromFatigue = this.testRequirements();
				return this.creature.protectedFromFatigue;
			},

			//	activate() :
			activate: function (damage: Damage) {
				if (G.activeCreature?.id == this.creature.id) {
					/* only used when unit isn't active */
					return damage; // Return Damage
				}

				if (this.isUpgraded() && damage.melee && !damage.counter) {
					//counter damage
					const counter = new Damage(
						this.creature, // Attacker
						{
							pure: 9,
						}, // Damage Type
						1, // Area
						[], // Effects
						G,
					);
					counter.counter = true;
					G.activeCreature?.takeDamage(counter);
					shakeBoard({
						amplitude: 0.03,
						durationMs: 220,
						force: true,
						axis: 'horizontal',
					});
				}

				this.creature.player.plasma -= 1;

				// Burst the field *before* updateHealth so the existing shield on the
				// inactive priest visibly transitions into the block flash instead of
				// being torn down and re-created (which made the flash imperceptible
				// on the last plasma point). updateHealth will try to remove the
				// shield when plasma hits 0, but the defer-if-bursting guard in
				// removePlasmaShield keeps it alive until the flash decays.
				this.creature.burstPlasmaField();
				this.creature.updateHealth();

				this.creature.protectedFromFatigue = this.testRequirements();

				damage.damages = {
					pure: 0,
				};
				damage.status = 'Shielded';
				damage.effects = [];

				damage.noLog = true;

				this.end(true); // Disable message

				G.log('%CreatureName' + this.creature.id + '% is shielded by Plasma Field');
				return damage; // Return Damage
			},
		},

		// 	Second Ability: Electro Shocker
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
					!this.atLeastOneTarget(this.creature.adjacentHexes(this.isUpgraded() ? 4 : 1), {
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
				const dpriest = this.creature;

				G.grid.queryCreature({
					fnOnConfirm: function (...args) {
						ability.animation(...args);
					},
					team: this._targetTeam,
					id: dpriest.id,
					flipped: dpriest.player.flipped,
					hexes: dpriest.adjacentHexes(this.isUpgraded() ? 4 : 1),
				});
			},

			//	activate() :
			activate: function (target) {
				const ability = this;
				const caster = ability.creature;
				ability.end();
				shakeBoard({
					amplitude: 0.02,
					durationMs: 200,
					force: true,
					axis: 'horizontal',
				});

				const sprite = caster.sprite;
				const grp = caster.grp;

				// Emission point on the Dark Priest cardboard texture (in texture pixels)
				// Human (player) DP: 112x200 texture, origin at bottom-center (56, 200), emit at (106, 106)
				// Bot (clone) DP: 108x200 texture, origin at bottom-center (54, 200), emit at (99, 99)
				const spriteKey = sprite?.key as string | undefined;
				const isBot = spriteKey?.includes('clone') ?? false;
				const emitTexX = isBot ? 99 : 106;
				const emitTexY = isBot ? 99 : 106;

				const { width, height } = getFrameSize(sprite);
				const originTexX = width / 2;
				const originTexY = height;

				// Convert texture-space emission point to local sprite coordinates
				const emitLocalX = emitTexX - originTexX;
				const emitLocalY = emitTexY - originTexY;

				// Compute facing direction for horizontal flip
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
				const facing = attackDir < 0 ? -1 : 1;

				// Apply horizontal flip to local emission X
				const emitX = facing * emitLocalX;
				const emitY = emitLocalY;

				const noseTip = {
					x: (grp?.x ?? 0) + (sprite?.x ?? 0) + emitX,
					y: (grp?.y ?? 0) + (sprite?.y ?? 0) + emitY,
				};

				// Save default facing to restore after animation (like Impaler's Chain Lightning)
				const defaultDir = caster.player.flipped ? -1 : 1;

				// Target point with spread: aim near the target's center but with random offset
				// so the bolt doesn't converge to a single pixel.
				const targetSprite = target.sprite;
				const targetGrp = target.grp;
				const targetHeight = Number(targetSprite?.height) || 0;
				const targetCenterX = (targetGrp?.x ?? 0) + (targetSprite?.x ?? 0);
				const targetCenterY = (targetGrp?.y ?? 0) + (targetSprite?.y ?? 0) - targetHeight * 0.5;

				// Spread radius based on target size - larger creatures get wider spread
				const spreadRadius = Math.max(12, target.size * 10);
				const spreadAngle = Math.random() * Math.PI * 2;
				const spreadX = Math.cos(spreadAngle) * spreadRadius * Math.random();
				const spreadY = Math.sin(spreadAngle) * spreadRadius * Math.random();

				const targetPoint = {
					x: targetCenterX + spreadX,
					y: targetCenterY + spreadY,
				};

				// Spawn electro shocker lightning bolt
				if (G.gameEngine) {
					spawnChainLightning(G.gameEngine, [noseTip, targetPoint], {
						parent: G.grid.creatureGroup,
						surfaceSource: { textures: G.Phaser?.textures },
						depth: getDepthAtBand(Math.max(caster.y, target.y), 'EFFECT_OVER_UNITS'),
						look: electroShockerLook({ playerColor: caster.player.color }),
					});

					// Flip back after the lightning vanishes (lifetimeMs 850).
					if (facing !== defaultDir) {
						setTimeout(() => {
							if (!caster.dead && caster.sprite.scale.x !== defaultDir) {
								caster.facePlayerDefault();
							}
						}, 850);
					}
				}

				const damageAmount = {
					shock: 12 * target.size,
				};

				const damage = new Damage(
					ability.creature, // Attacker
					damageAmount, // Damage Type
					1, // Area
					[], // Effects
					G,
				);

				target.takeDamage(damage);
			},
		},

		// 	Third Ability: Disruptor Beam
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			_targetTeam: Team.Enemy,

			// 	require() :
			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				const range = this.creature.adjacentHexes(2);

				// At least one target
				if (
					!this.atLeastOneTarget(range, {
						team: this._targetTeam,
					})
				) {
					return false;
				}

				// Search Lowest target cost
				let lowestCost = 99;
				const targets = this.getTargets(range);

				targets.forEach(function (item) {
					if (item.target instanceof Creature) {
						if (lowestCost > item.target.size) {
							lowestCost = item.target.size;
						}
					}
				});

				if (this.creature.player.plasma < lowestCost) {
					this.message = G.msg.abilities.noPlasma;
					return false;
				}

				return true;
			},

			// 	query() :
			query: function () {
				const ability = this;
				const dpriest = this.creature;

				G.grid.queryCreature({
					fnOnConfirm: function (...args) {
						ability.animation(...args);
					},
					optTest: function (creature) {
						return creature.size <= dpriest.player.plasma;
					},
					team: this._targetTeam,
					id: dpriest.id,
					flipped: dpriest.player.flipped,
					hexes: dpriest.adjacentHexes(2),
				});
			},

			//	activate() :
			activate: function (target: Creature) {
				const ability = this;
				ability.end();
				shakeBoard({
					amplitude: 0.04,
					durationMs: 111,
					force: true,
					axis: 'horizontal',
				});

				const plasmaCost = target.size;
				let damageAmount = target.baseStats.health - target.health;

				if (this.isUpgraded() && damageAmount < 40) {
					damageAmount = 40;
				}

				ability.creature.player.plasma -= plasmaCost;

				const damage = new Damage(
					ability.creature, // Attacker
					{
						pure: damageAmount,
					}, // Damage Type
					1, // Area
					[], // Effects
					G,
				);

				ability.end();

				target.takeDamage(damage);
			},
		},

		// 	Fourth Ability: Godlet Printer
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			// 	require() :
			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				if (this.creature.player.plasma <= 1) {
					this.message = G.msg.abilities.noPlasma;
					return false;
				}
				if (this.creature.player.getNbrOfCreatures() == G.configData.creaLimitNbr) {
					this.message = G.msg.abilities.noPsy;
					return false;
				}
				return true;
			},

			// 	query() :
			query: function () {
				// Ask the creature to summon
				G.UI.materializeToggled = true;
				G.UI.toggleDash(true);
			},

			// Callback function to queryCreature
			materialize: function (creature: CreatureType) {
				const ability = this;
				const dpriest = this.creature;

				const creatureHasMaterializationSickness =
					dpriest.player.summonCreaturesWithMaterializationSickness;

				// Create full temporary Creature with placeholder position to show in queue
				const crea = $j.extend(
					G.retrieveCreatureStats(creature),
					{ x: 3, y: 3 },
					{ team: this.creature.player.id },
					{ temp: true },
					{ materializationSickness: creatureHasMaterializationSickness },
				);
				const fullCrea = new Creature(crea, G);
				// Don't allow temporary Creature to take up space
				fullCrea.cleanHex();
				// Make temporary Creature invisible
				fullCrea.sprite.alpha = 0;

				// Show temporary Creature in queue
				G.updateQueueDisplay();

				// Close the dash so hex clicks work
				G.UI?.closeDash();

				G.grid.forEachHex(function (hex: Hex) {
					hex.unsetReachable();
				});

				let spawnRange = dpriest.hexagons[0].adjacentHex(this.isUpgraded() ? 6 : 4);

				spawnRange.forEach(function (item) {
					item.setReachable();
				});

				spawnRange = spawnRange.filter(function (item) {
					return item.isWalkable(crea.size, 0, false);
				});

				spawnRange = arrayUtils.extendToLeft(spawnRange, crea.size, G.grid);

				G.grid.queryHexes({
					fnOnSelect: function (hex, args) {
						if (!hex.reachable || args.spawnRange.indexOf(hex) === -1) {
							return;
						}
						const crea = G.retrieveCreatureStats(args.creature);
						G.grid.previewCreature(hex.pos, crea, ability.creature.player);
					},
					fnOnCancel: function () {
						G.activeCreature?.queryMove();
					},
					fnOnConfirm: function (...args) {
						ability.animation(...args);
					},
					args: {
						creature: creature,
						cost: crea.size - 0 + ((crea.level as number) - 0),
						spawnRange,
					}, // OptionalArgs
					size: crea.size,
					flipped: dpriest.player.flipped,
					hexes: spawnRange,
				});
			},

			//	activate() :
			activate: function (hex, args) {
				const creature = args.creature;
				const ability = this;

				const pos = {
					x: hex.x,
					y: hex.y,
				};

				ability.creature.player.plasma -= args.cost;

				//TODO: Make the UI show the updated number instantly

				ability.end(false, true);

				ability.creature.player.summon(creature, pos);
				ability.creature.queryMove();
			},
		},
	];
};
