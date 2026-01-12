import * as $j from 'jquery';
import { Damage } from '../damage';
import { Team } from '../utility/team';
import * as matrices from '../utility/matrices';
import * as arrayUtils from '../utility/arrayUtils';
import { Effect } from '../effect';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import Game from '../game';

function getEscortUsableHexes(G: Game, crea: Creature, trg: Creature) {
	const trgIsInfront =
		G.grid.getHexMap(
			crea.x - matrices.inlinefront2hex.origin[0],
			crea.y - matrices.inlinefront2hex.origin[1],
			0,
			false,
			matrices.inlinefront2hex,
		)[0].creature == trg;

	const distance = crea.remainingMove;
	const size = crea.size + trg.size;
	const x = trgIsInfront ? crea.x + trg.size : crea.x;
	const usableHexes = G.grid
		.getFlyingRange(x, crea.y, distance, size, [crea.id, trg.id])
		.filter(function (item) {
			return (
				crea.y == item.y && (trgIsInfront ? item.x < x : item.x > x - crea.size - trg.size + 1)
			);
		});
	return { size, trgIsInfront, usableHexes };
}

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default (G: Game) => {
	/*
	 *
	 *	Scavenger abilities
	 *
	 */
	G.abilities[44] = [
		// 	First Ability: Wing Feathers
		{
			/**
			 * Provides custom movement type given whether the ability is upgraded or not.
			 * Movement type is "hover" unless this ability is upgraded, then it's "flying"
			 * @return {string} movement type, "hover" or "flying"
			 */
			movementType: function () {
				return this.isUpgraded() ? 'flying' : 'hover';
			},

			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'noTrigger',

			// 	require() :
			require: function () {
				return true;
			},

			//	activate() :
			activate: function () {},
		},

		// 	Second Ability: Slicing Pounce
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
					!this.atLeastOneTarget(
						this.creature.getHexMap(matrices.frontnback2hex, this.creature.player.flipped),
						{
							team: this._targetTeam,
						},
					)
				) {
					return false;
				}
				return true;
			},

			// 	query() :
			query: function () {
				const ability = this;

				G.grid.queryCreature({
					fnOnConfirm: function (...args) {
						ability.animation(...args);
					},
					team: this._targetTeam,
					id: this.creature.id,
					flipped: this.creature.player.flipped,
					hexes: this.creature.getHexMap(matrices.frontnback2hex, this.creature.player.flipped),
				});
			},

			//	activate() :
			activate: function (target: Creature) {
				const ability = this;
				ability.end();
				G.Phaser.camera.shake(0.01, 70, true, G.Phaser.camera.SHAKE_HORIZONTAL, true);

				// If upgraded, hits will debuff target with -1 offense
				if (this.isUpgraded()) {
					const effect = new Effect(
						'Slicing Pounce',
						ability.creature,
						target,
						'onDamage',
						{
							alterations: {
								offense: -1,
							},
						},
						G,
					);
					target.addEffect(effect);
					G.log('%CreatureName' + target.id + "%'s offense is lowered by 1");
				}

				const damage = new Damage(
					ability.creature, // Attacker
					ability.damages, // Damage Type
					1, // Area
					[], // Effects
					G,
				);

				target.takeDamage(damage);
			},
		},

		// 	Third Ability: Escort Service
		{
			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			_targetTeam: Team.Both,

			// 	require() :
			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				const ability = this;
				const crea = this.creature;

				let hexes = crea.getHexMap(matrices.inlinefrontnback2hex, this.creature.player.flipped);

				if (hexes.length < 2) {
					// At the border of the map
					return false;
				}

				if (hexes[0].creature && hexes[1].creature) {
					// Sandwiched
					return false;
				}

				// Cannot escort large (size > 2) creatures unless ability is upgraded
				hexes = hexes.filter(function (hex) {
					if (!hex.creature) {
						return false;
					}

					return hex.creature.size < 3 || ability.isUpgraded();
				});

				if (
					!this.atLeastOneTarget(hexes, {
						team: this._targetTeam,
					})
				) {
					return false;
				}

				const trg = hexes[0].creature || hexes[1].creature;

				// Safety check: ensure target exists and is valid
				if (!trg) {
					return false;
				}

				if (!trg.stats.moveable) {
					this.message = 'Target is not moveable.';
					return false;
				}

				const { usableHexes } = getEscortUsableHexes(G, crea, trg);

				if (!usableHexes.length) {
					this.message = 'Not enough movement points.';
					return false;
				}

				return true;
			},

			query: function () {
				const ability = this;
				const crea = this.creature;

				const hexes = crea.getHexMap(matrices.inlinefrontnback2hex, this.creature.player.flipped);

				// Validate target exists before proceeding
				if (hexes.length < 2 || (!hexes[0].creature && !hexes[1].creature)) {
					// No valid target, cancel query
					crea.queryMove();
					return;
				}
				const trg = hexes[0].creature || hexes[1].creature;

				if (!trg) {
					// Target validation failed
					crea.queryMove();
					return;
				}

				const { size, trgIsInfront, usableHexes } = getEscortUsableHexes(G, crea, trg);

				// Re-validate usable hexes in case remainingMove changed
				if (!usableHexes.length) {
					this.message = 'Not enough movement points.';
					crea.queryMove();
					return;
				}

				const select = (hex) => {
					for (let i = 0; i < trg.hexagons.length; i++) {
						G.grid.cleanHex(trg.hexagons[i]);
						trg.hexagons[i].displayVisualState('dashed player' + trg.team);
					}
					for (let i = 0; i < crea.hexagons.length; i++) {
						G.grid.cleanHex(crea.hexagons[i]);
						crea.hexagons[i].overlayVisualState('hover h_player' + crea.team);
					}
					for (let i = 0; i < size; i++) {
						if (!G.grid.hexExists({ y: hex.y, x: hex.x - i })) {
							continue;
						}
						let h: Hex = null;
						let color;
						if (trgIsInfront) {
							h = G.grid.hexes[hex.y][hex.x + i];
							color = i < trg.size ? trg.team : crea.team;
						} else {
							h = G.grid.hexes[hex.y][hex.x - i];
							color = i > 1 ? trg.team : crea.team;
						}
						G.grid.cleanHex(h);
						h.overlayVisualState('active creature player' + color);
						h.displayVisualState('creature player' + color);

						const creatureData = G.retrieveCreatureStats(crea.type);
						const targetData = G.retrieveCreatureStats(trg.type);
						const creaPos = trgIsInfront ? { x: hex.pos.x + 1, y: hex.pos.y } : hex.pos;
						const trgPos = trgIsInfront
							? { x: hex.pos.x + 1 + trg.size, y: hex.pos.y }
							: { x: hex.pos.x - crea.size, y: hex.pos.y };
						G.grid.previewCreature(creaPos, creatureData, crea.player);
						G.grid.previewCreature(trgPos, targetData, trg.player, true);
					}
				};

				G.grid.queryHexes({
					fnOnConfirm: function (...args) {
						G.grid.fadeOutTempCreature();
						G.grid.fadeOutTempCreature(G.grid.secondary_overlay);
						ability.animation(...args);
					}, // fnOnConfirm
					fnOnCancel: function () {
						// Cancel query without marking ability as used
						G.grid.fadeOutTempCreature();
						G.grid.fadeOutTempCreature(G.grid.secondary_overlay);
						// Clean up visual states
						for (let i = 0; i < trg.hexagons.length; i++) {
							G.grid.cleanHex(trg.hexagons[i]);
						}
						for (let i = 0; i < crea.hexagons.length; i++) {
							G.grid.cleanHex(crea.hexagons[i]);
						}
						crea.queryMove();
					}, // fnOnCancel
					fnOnSelect: select, // fnOnSelect,
					team: this._targetTeam,
					id: [crea.id, trg.id],
					size: 1,
					flipped: crea.player.flipped,
					hexes: usableHexes,
					args: {
						trg: trg.id,
						trgIsInfront: trgIsInfront,
					},
					callbackAfterQueryHexes: () => {
						console.log('cleaning');
						for (let i = 0; i < trg.hexagons.length; i++) {
							G.grid.cleanHex(trg.hexagons[i]);
							trg.hexagons[i].displayVisualState('dashed player' + trg.team);
						}
					},
					fillHexOnHover: false,
				});
			},

			//	activate() :
			activate: function (hex, args) {
				const ability = this;
				ability.end();
				G.Phaser.camera.shake(0.01, 66, true, G.Phaser.camera.SHAKE_HORIZONTAL, true);

				const crea = this.creature;

				const trg = G.creatures[args.trg];

				const trgIF = args.trgIsInfront;
				const creaDest = G.grid.hexes[hex.y][trgIF ? hex.x + 1 : hex.x];
				const trgDest = G.grid.hexes[hex.y][trgIF ? hex.x + 1 + trg.size : hex.x - crea.size];

				// Determine distance
				let distance = 0;
				let k = 0;
				const start = G.grid.hexes[crea.y][crea.x];
				while (!distance) {
					k++;

					if (arrayUtils.findPos(start.adjacentHex(k), creaDest)) {
						distance = k;
					}
				}

				// Substract from movement points
				crea.remainingMove -= distance * trg.size;
				// Ability animation speed should be slower than regular movement (flight) speed
				const escortSpeed = crea.animation.walk_speed * 5;
				crea.moveTo(creaDest, {
					animation: 'fly',
					callback: function () {
						trg.updateHex();
					},
					ignoreMovementPoint: true,
					overrideSpeed: escortSpeed,
				});

				trg.moveTo(trgDest, {
					animation: 'fly',
					callback: function () {
						ability.creature.updateHex();
						ability.creature.queryMove();
					},
					ignoreFacing: true,
					ignoreMovementPoint: true,
					overrideSpeed: escortSpeed,
				});
			},
		},

		// 	Fourth Ability: Deadly Toxin
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
					!this.atLeastOneTarget(
						this.creature.getHexMap(matrices.frontnback2hex, this.creature.player.flipped),
						{
							team: this._targetTeam,
						},
					)
				) {
					return false;
				}
				return true;
			},

			// 	query() :
			query: function () {
				const ability = this;

				G.grid.queryCreature({
					fnOnConfirm: function (...args) {
						ability.animation(...args);
					},
					team: this._targetTeam,
					id: this.creature.id,
					flipped: this.creature.player.flipped,
					hexes: this.creature.getHexMap(matrices.frontnback2hex, this.creature.player.flipped),
				});
			},

			//	activate() :
			activate: function (target: Creature) {
				const ability = this;
				ability.end();
				G.Phaser.camera.shake(0.01, 100, true, G.Phaser.camera.SHAKE_HORIZONTAL, true);

				// Don't perform poison damage unless upgraded
				const damages = $j.extend({}, ability.damages);
				if (!this.isUpgraded()) {
					delete damages.poison;
				}

				const damage = new Damage(
					ability.creature, // Attacker
					damages, // Damage Type
					1, // Area
					[], // Effects
					G,
				);

				const result = target.takeDamage(damage);

				if (result.damageObj.status !== 'Shielded') {
					// Add poison damage debuff
					const effect = new Effect(
						this.title,
						this.creature,
						target,
						'onStartPhase',
						{
							stackable: false,

							effectFn: function (eff, trgCreature: Creature) {
								G.log('%CreatureName' + trgCreature.id + '% is affected by ' + ability.title);
								trgCreature.takeDamage(
									new Damage(
										eff.owner as Creature,
										{
											poison: ability.damages.poison,
										},
										1,
										[],
										G,
									),
									{ isFromTrap: true },
								);
							},
						},
						G,
					);

					target.replaceEffect(effect);

					G.log('%CreatureName' + target.id + '% is poisoned by ' + this.title);
				}
			},
		},
	];
};
