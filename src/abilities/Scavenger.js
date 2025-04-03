import * as $j from 'jquery';
import { Damage } from '../damage';
import { Team } from '../utility/team';
import * as matrices from '../utility/matrices';
import * as arrayUtils from '../utility/arrayUtils';
import { Effect } from '../effect';
	function getEscortUsableHexes(G, crea, trg) {
		const trgIsInfront =
			G.grid.getHexMap(
				crea.x - matrices.inlinefront2hex.origin[0],
				crea.y - matrices.inlinefront2hex.origin[1],
				0,
				false,
				matrices.inlinefront2hex,
			)[0].creature === trg;

		const dir = trgIsInfront ? -1 : 1;
		const creaSize = crea.size;
		const trgSize = trg.size;

		const blockStartX = trgIsInfront ? trg.x : crea.x;
		const totalBlockSize = creaSize + trgSize;

		const distance = crea.remainingMove;
		const usableHexes = [];

		// Loop through each potential tile in range clearly
		for (let shift = 1; shift <= distance; shift++) {
			const hoveredBlockStartX = blockStartX + shift * dir;

			let blockFits = true;
			for (let i = 0; i < totalBlockSize; i++) {
				const xToCheck = hoveredBlockStartX + i * dir;

				// Clearly ensure the hex exists
				if (!G.grid.hexExists({ x: xToCheck, y: crea.y })) {
					blockFits = false;
					break;
				}

				const hexToCheck = G.grid.hexes[crea.y][xToCheck];

				// Clearly ensure hex is unoccupied or occupied by current block creatures only
				if (hexToCheck.creature && ![crea.id, trg.id].includes(hexToCheck.creature.id)) {
					blockFits = false;
					break;
				}
			}

			// If clearly fits, add as usable
			if (blockFits) {
				usableHexes.push(G.grid.hexes[crea.y][hoveredBlockStartX]);
			}
		}

		return { usableHexes, trgIsInfront, creaSize, trgSize, dir, blockStartX };
	}



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
				const ability = this;

				G.grid.queryCreature({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					team: this._targetTeam,
					id: this.creature.id,
					flipped: this.creature.player.flipped,
					hexes: this.creature.getHexMap(matrices.frontnback2hex),
				});
			},

			//	activate() :
			activate: function (target) {
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

				const trg = hexes[0].creature || hexes[1].creature;

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
			
				// Retrieve creatures adjacent to Scavenger in a line (front and back)
				const hexes = crea.getHexMap(matrices.inlinefrontnback2hex);
				const trg = hexes[0].creature || hexes[1].creature;
			
				// Get data to determine usable hexes, block size, and whether target is in front
				const { size, trgIsInfront, usableHexes } = getEscortUsableHexes(G, crea, trg);
			
				console.log("[QUERY] usableHexes initially calculated:", usableHexes);
				console.log("[QUERY] Block size (Scavenger + Target):", size);
				console.log("[QUERY] Target is in front of Scavenger:", trgIsInfront);
			
				const select = (hex) => {
					const { trgIsInfront, creaSize, trgSize, dir, blockStartX } = getEscortUsableHexes(G, crea, trg);
				
					[...trg.hexagons, ...crea.hexagons].forEach(h => {
						G.grid.cleanHex(h);
						h.displayVisualState('dashed');
					});
				
					const hoveredBlockStartX = hex.x;
					const shift = hoveredBlockStartX - blockStartX;
				
					for (let i = 0; i < trgSize; i++) {
						const targetX = trg.x + shift;
						if (G.grid.hexExists({ x: targetX + i, y: trg.y })) {
							const targetHex = G.grid.hexes[trg.y][targetX + i];
							targetHex.overlayVisualState('active creature player' + trg.team);
							targetHex.displayVisualState('creature player' + trg.team);
						}
					}
				
					for (let i = 0; i < creaSize; i++) {
						const creaX = crea.x + shift;
						if (G.grid.hexExists({ x: creaX + i, y: crea.y })) {
							const creaHex = G.grid.hexes[crea.y][creaX + i];
							creaHex.overlayVisualState('active creature player' + crea.team);
							creaHex.displayVisualState('creature player' + crea.team);
						}
					}
				
					const trgPreviewGridPos = { x: trg.x + shift, y: trg.y };
					const creaPreviewGridPos = { x: crea.x + shift, y: crea.y };
				
					console.log("[FIXED SELECT] Preview Target (grid):", trgPreviewGridPos);
					console.log("[FIXED SELECT] Preview Scavenger (grid):", creaPreviewGridPos);
				
					G.grid.previewCreature(trgPreviewGridPos, G.retrieveCreatureStats(trg.type), trg.player, true);
					G.grid.previewCreature(creaPreviewGridPos, G.retrieveCreatureStats(crea.type), crea.player);
				};
				
				
				
				  
			
				// Execute hex query with hover and confirm functionality
				G.grid.queryHexes({
					fnOnConfirm: function () {
						G.grid.fadeOutTempCreature();
						G.grid.fadeOutTempCreature(G.grid.secondary_overlay);
						ability.animation(...arguments);
					},
					fnOnSelect: select,
					team: this._targetTeam,
					id: [crea.id, trg.id],
					size: size,
					flipped: crea.player.flipped,
					hexes: usableHexes,
					args: {
						trg: trg.id,
						trgIsInfront: trgIsInfront,
					},
					callbackAfterQueryHexes: () => {
						console.log('cleaning after query');
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
				const ability = this;
				ability.end();
				G.Phaser.camera.shake(0.01, 66, true, G.Phaser.camera.SHAKE_HORIZONTAL, true);
			
				const crea = this.creature;
				const trg = G.creatures[args.trg];
				const { blockStartX } = getEscortUsableHexes(G, crea, trg);
			
				const hoveredBlockStartX = hex.x;
				const finalShift = hoveredBlockStartX - blockStartX;
			
				const creaDestX = crea.x + finalShift;
				const trgDestX = trg.x + finalShift;
			
				const creaDest = G.grid.hexes[crea.y][creaDestX];
				const trgDest = G.grid.hexes[trg.y][trgDestX];
			
				console.log('[FIXED ACTIVATE] Shift:', finalShift);
			
				crea.remainingMove -= Math.abs(finalShift);
			
				trg.moveTo(trgDest, {
					animation: 'fly',
					callback: () => crea.updateHex(),
					ignoreMovementPoint: true,
				});
			
				crea.moveTo(creaDest, {
					animation: 'fly',
					callback: () => {
						trg.updateHex();
						crea.queryMove();
					},
					ignoreMovementPoint: true,
					overrideSpeed: crea.animation.walk_speed,
				});
			}
			
			
			
			
			
			
			
			
					
			
			
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
				const ability = this;

				G.grid.queryCreature({
					fnOnConfirm: function () {
						ability.animation(...arguments);
					},
					team: this._targetTeam,
					id: this.creature.id,
					flipped: this.creature.player.flipped,
					hexes: this.creature.getHexMap(matrices.frontnback2hex),
				});
			},

			//	activate() :
			activate: function (target) {
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