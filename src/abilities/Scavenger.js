import * as $j from 'jquery';
import { Damage } from '../damage';
import { Team } from '../utility/team';
import * as matrices from '../utility/matrices';
import * as arrayUtils from '../utility/arrayUtils';
import { Effect } from '../effect';

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default (G) => {
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
				return 'flying';
			},

			//	Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: '',

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
					!this.atLeastOneTarget(this.creature.getHexMap(matrices.frontnback2hex), {
						team: this._targetTeam,
					})
				) {
					return false;
				}
				return true;
			},

			// 	query() :
			query: function () {
				let ability = this;

				G.grid.queryCreature({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					team: this._targetTeam,
					id: this.creature.id,
					flipped: this.creature.flipped,
					hexes: this.creature.getHexMap(matrices.frontnback2hex),
				});
			},

			//	activate() :
			activate: function (target) {
				let ability = this;
				ability.end();

				// If upgraded, hits will debuff target with -1 offense
				if (this.isUpgraded()) {
					let effect = new Effect(
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

				let damage = new Damage(
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

				let ability = this;
				let crea = this.creature;

				let hexes = crea.getHexMap(matrices.inlinefrontnback2hex);

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

				let trg = hexes[0].creature || hexes[1].creature;

				if (!trg.stats.moveable) {
					this.message = 'Target is not moveable.';
					return false;
				}

				if (crea.remainingMove < trg.size) {
					//Not enough move points
					this.message = 'Not enough movement points.';
					return false;
				}

				return true;
			},

			query: function () {
				let ability = this;
				let crea = this.creature;

				let hexes = crea.getHexMap(matrices.inlinefrontnback2hex);
				let trg = hexes[0].creature || hexes[1].creature;

				let distance = Math.floor(crea.remainingMove / trg.size);
				let size = crea.size + trg.size;

				let trgIsInfront =
					G.grid.getHexMap(
						crea.x - matrices.inlinefront2hex.origin[0],
						crea.y - matrices.inlinefront2hex.origin[1],
						0,
						false,
						matrices.inlinefront2hex,
					)[0].creature == trg;

				let select = (hex) => {
					for (let i = 0; i < trg.hexagons.length; i++) {
						G.grid.cleanHex(trg.hexagons[i]);
						trg.hexagons[i].displayVisualState('dashed');
					}
					for (let i = 0; i < crea.hexagons.length; i++) {
						G.grid.cleanHex(crea.hexagons[i]);
						crea.hexagons[i].overlayVisualState('hover h_player' + crea.team);
					}
					for (let i = 0; i < size; i++) {
						if (!G.grid.hexExists(hex.y, hex.x - i)) {
							continue;
						}
						let h = G.grid.hexes[hex.y][hex.x - i];
						let color;
						if (trgIsInfront) {
							color = i < trg.size ? trg.team : crea.team;
						} else {
							color = i > 1 ? trg.team : crea.team;
						}
						G.grid.cleanHex(h);
						h.overlayVisualState('active creature player' + color);
						h.displayVisualState('creature player' + color);
					}
				};

				let x = trgIsInfront ? crea.x + trg.size : crea.x;

				G.grid.queryHexes({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					}, // fnOnConfirm
					fnOnSelect: select, // fnOnSelect,
					team: this._targetTeam,
					id: [crea.id, trg.id],
					size: size,
					flipped: crea.player.flipped,
					hexes: G.grid
						.getFlyingRange(x, crea.y, distance, size, [crea.id, trg.id])
						.filter(function (item) {
							return (
								crea.y == item.y &&
								(trgIsInfront ? item.x < x : item.x > x - crea.size - trg.size + 1)
							);
						}),
					args: {
						trg: trg.id,
						trgIsInfront: trgIsInfront,
					},
					callbackAfterQueryHexes: () => {
						for (let i = 0; i < trg.hexagons.length; i++) {
							G.grid.cleanHex(trg.hexagons[i]);
							trg.hexagons[i].displayVisualState('dashed');
						}
					},
					fillHexOnHover: false,
				});
			},

			//	activate() :
			activate: function (hex, args) {
				let ability = this;
				ability.end();

				let crea = this.creature;

				let trg = G.creatures[args.trg];

				let trgIF = args.trgIsInfront;

				let creaDest = G.grid.hexes[hex.y][trgIF ? hex.x - trg.size : hex.x];
				let trgDest = G.grid.hexes[hex.y][trgIF ? hex.x : hex.x - crea.size];

				// Determine distance
				let distance = 0;
				let k = 0;
				let start = G.grid.hexes[crea.y][crea.x];
				while (!distance) {
					k++;

					if (arrayUtils.findPos(start.adjacentHex(k), creaDest)) {
						distance = k;
					}
				}

				// Substract from movement points
				crea.remainingMove -= distance * trg.size;

				crea.moveTo(creaDest, {
					animation: 'fly',
					callback: function () {
						trg.updateHex();
					},
					ignoreMovementPoint: true,
				});

				trg.moveTo(trgDest, {
					animation: 'fly',
					callback: function () {
						ability.creature.updateHex();
						ability.creature.queryMove();
					},
					ignoreMovementPoint: true,
					overrideSpeed: crea.animation.walk_speed,
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
					!this.atLeastOneTarget(this.creature.getHexMap(matrices.frontnback2hex), {
						team: this._targetTeam,
					})
				) {
					return false;
				}
				return true;
			},

			// 	query() :
			query: function () {
				let ability = this;

				G.grid.queryCreature({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					team: this._targetTeam,
					id: this.creature.id,
					flipped: this.creature.flipped,
					hexes: this.creature.getHexMap(matrices.frontnback2hex),
				});
			},

			//	activate() :
			activate: function (target) {
				let ability = this;
				ability.end();

				// Don't perform poison damage unless upgraded
				let damages = $j.extend({}, ability.damages);
				if (!this.isUpgraded()) {
					delete damages.poison;
				}

				let damage = new Damage(
					ability.creature, // Attacker
					damages, // Damage Type
					1, // Area
					[], // Effects
					G,
				);

				let result = target.takeDamage(damage);

				if (result.damageObj.status !== 'Shielded') {
					// Add poison damage debuff
					let effect = new Effect(
						this.title,
						this.creature,
						target,
						'onStartPhase',
						{
							stackable: false,
							effectFn: function (eff, creature) {
								G.log('%CreatureName' + creature.id + '% is affected by ' + ability.title);
								creature.takeDamage(
									new Damage(
										eff.owner,
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
