import { Damage } from '../damage';
import { Team } from '../utility/team';
import { Hex } from '../utility/hex';
import * as matrices from '../utility/matrices';
import { Effect } from '../effect';
import Game from '../game';
import { Creature } from '../creature';
import { shakeBoard } from '../game-display/camera';
import { runTimedAnimation } from '../timing/clock';
import { getDepthAtBand } from '../game-display/layer';
import { HEX_WIDTH_PX } from '../utility/const';

/**
 * Spawns expanding ground rings (seismic waves) that travel flat along the
 * ground from the caster's front tile toward each target hex. Each ring
 * expands outward as it moves, fading as it reaches the target.
 */
function createSeismicWave(creature: Creature, targetHexes: Hex[], G: Game): void {
	if (!G.gameEngine?.add?.graphics || !G.grid?.creatureGroup) {
		return;
	}

	const frontHex = creature.player.flipped
		? creature.hexagons[creature.size - 1]
		: creature.hexagons[0];

	const waveHexes = targetHexes.filter(
		(hex) => hex && hex.displayPos && frontHex && frontHex.displayPos,
	);

	if (waveHexes.length === 0) {
		return;
	}

	const graphics = G.gameEngine.add.graphics(0, 0);
	G.grid.creatureGroup.add(graphics);
	// Place below creature cardboards — this is a ground-based effect
	graphics.setDepth(getDepthAtBand(frontHex.y, 'EFFECT_UNDER_UNITS'));
	G.grid.orderCreatureZ();

	// displayPos is the top-left of the hex artwork; the visible centre sits
	// half a hex-width east of it (see CreatureSprite._place).
	const hexCenterX = HEX_WIDTH_PX / 2;

	const waveColor = 0xffd54a; // bright gold
	const waveColorGlow = 0xffe080; // soft gold halo
	const waveDurationMs = 420;
	const maxRadius = 40;
	const archCount = 3;
	const archSpacing = 16;
	const archSegments = 12;

	runTimedAnimation({
		durationMs: waveDurationMs,
		onFrame(elapsedMs) {
			graphics.clear();

			for (let i = 0; i < waveHexes.length; i++) {
				const hex = waveHexes[i];
				const ringProgress = Math.max(0, Math.min(1, elapsedMs / waveDurationMs));

				if (ringProgress <= 0) continue;

				// Interpolate position from front tile toward target
				const startX = frontHex.displayPos.x + hexCenterX;
				const startY = frontHex.displayPos.y + 25;
				const targetX = hex.displayPos.x + hexCenterX;
				const targetY = hex.displayPos.y + 25;

				const currentX = startX + (targetX - startX) * ringProgress;
				const currentY = startY + (targetY - startY) * ringProgress;

				// Unit direction of travel
				const dx = targetX - startX;
				const dy = targetY - startY;
				const dist = Math.hypot(dx, dy) || 1;
				const dirX = dx / dist;
				const dirY = dy / dist;
				// Perpendicular (for the arch span)
				const perpX = -dirY;
				const perpY = dirX;

				const alpha = (1 - ringProgress) * 0.9;

				for (let a = 0; a < archCount; a++) {
					// Each arch sits further along the travel direction
					const archOffset = a * archSpacing;
					const archX = currentX + dirX * archOffset;
					const archY = currentY + dirY * archOffset;

					// Cap width so the arches never span more than ~1 hex even at
					// full progress; the leading arch is widest, trailing ones taper.
					const archWidth = Math.min(ringProgress * maxRadius + a * 4, 40 - a * 4);
					const bowDepth = archWidth * 0.45;

					// Start and end of the arch (perpendicular to travel)
					const startXp = archX + perpX * archWidth;
					const startYp = archY + perpY * archWidth;
					const endXp = archX + perpX * -archWidth;
					const endYp = archY + perpY * -archWidth;
					// Control point bows toward the target
					const ctrlX = archX + dirX * bowDepth;
					const ctrlY = archY + dirY * bowDepth;

					const aAlpha = alpha * (a === 0 ? 1 : 0.5);

					// Halo stroke (wide, low alpha) behind the bright core
					graphics.lineStyle(6, waveColorGlow, aAlpha * 0.3);
					graphics.moveTo(startXp, startYp);
					for (let s = 1; s <= archSegments; s++) {
						const t = s / archSegments;
						const mt = 1 - t;
						const px = mt * mt * startXp + 2 * mt * t * ctrlX + t * t * endXp;
						const py = mt * mt * startYp + 2 * mt * t * ctrlY + t * t * endYp;
						graphics.lineTo(px, py);
					}

					// Bright core stroke
					graphics.lineStyle(2, waveColor, aAlpha);
					graphics.moveTo(startXp, startYp);
					for (let s = 1; s <= archSegments; s++) {
						const t = s / archSegments;
						const mt = 1 - t;
						const px = mt * mt * startXp + 2 * mt * t * ctrlX + t * t * endXp;
						const py = mt * mt * startYp + 2 * mt * t * ctrlY + t * t * endYp;
						graphics.lineTo(px, py);
					}
				}

				// Flush the buffered path so the arches render
				graphics.strokePath();
			}
		},
		onDone() {
			graphics.destroy();
		},
	});
}

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default (G: Game) => {
	G.abilities[28] = [
		//  First Ability: Tankish Build
		{
			// Type : Can be "onQuery", "onStartPhase", "onDamage"
			triggerFunc: function () {
				if (this.isUpgraded()) {
					// Once upgraded add the trigger to disable the bonus if hit
					return 'onStartPhase onDamage';
				}
				return 'onStartPhase';
			},

			_defenseBuff: 0, // Total bonus defense

			_maxDefenseBuff: 40, // Cap of the bonus

			_damageTaken: false, // Condition once upgraded

			_getDefenseBuff: function () {
				if (this._defenseBuff >= 39) {
					this._defenseBuff = 40;
				} else {
					if (this.isUpgraded() && !this._damageTaken) {
						this._defenseBuff += 2;
					} else {
						this._defenseBuff += 1;
					}
				}
				return this._defenseBuff;
			},

			// require() :
			require: function (damage) {
				if (!damage) {
					// If the ability is called without taking damage (a.k.a at the start of the round)
					return true; // Activate the ability
				} else {
					// If it's called by damage once upgraded
					this._damageTaken = true; // Change the _damageTaken to true
					return false; // But don't activate the ability
				}
			},

			// activate() :
			activate: function () {
				this.creature.replaceEffect(
					// Add and replace the effect each time
					new Effect(
						'Tankish Build', // Name
						this.creature, // Caster
						this.creature, // Target
						'', // Trigger
						{
							alterations: {
								defense: this._getDefenseBuff(), // Add a defense buff
							},
							stackable: false,
						},
						G,
					),
				);
				this._damageTaken = false; // Reset the _damageTaken
			},
		},

		//	Second Ability: Seismic Stomp
		{
			// Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			_targetTeam: Team.Enemy,

			// require() :
			require: function () {
				const req = {
					team: this._targetTeam,
					sourceCreature: this.creature,
					distance: 3,
				};

				if (!this.testRequirements() || !this.testDirection(req)) {
					return false;
				}

				return true;
			},

			// query() :
			query: function () {
				const stomper = this.creature;
				const ability = this;

				// Take the closest enemy in each direction within 3hex
				if (!this.isUpgraded()) {
					G.grid.queryDirection({
						fnOnConfirm: function () {
							// eslint-disable-next-line
							ability.animation(...arguments);
						},
						flipped: stomper.player.flipped,
						team: this._targetTeam,
						id: stomper.id,
						requireCreature: true,
						x: stomper.x,
						y: stomper.y,
						distance: 3,
						sourceCreature: stomper,
						dashedHexesUnderCreature: true,
					});
				} // Once upgraded, can hit any enemy within 3hex in any direction
				else {
					G.grid.queryDirection({
						fnOnConfirm: function () {
							// eslint-disable-next-line
							if (arguments[1].hex.creature) {
								// eslint-disable-next-line
								ability.animation([arguments[1].hex], arguments[1], arguments[2]);
							} else {
								const targetHexList = [];
								// eslint-disable-next-line
								for (let i = 0; i < arguments[0].length; i++) {
									// eslint-disable-next-line
									if (arguments[0][i].creature) {
										// eslint-disable-next-line
										targetHexList.push(arguments[0][i]);
										break;
									}
								}
								// eslint-disable-next-line
								ability.animation(targetHexList, arguments[1], arguments[2]);
							}
						},
						flipped: stomper.player.flipped,
						team: this._targetTeam,
						id: stomper.id,
						requireCreature: true,
						x: stomper.x,
						y: stomper.y,
						distance: 3,
						sourceCreature: stomper,
						stopOnCreature: false,
						dashedHexesUnderCreature: true,
						fillOnlyHoveredCreature: true,
					});
				}
			},

			// activate() :
			activate: function (target: Hex[]) {
				const ability = this;
				ability.end();

				const damage = new Damage(
					ability.creature, // Attacker
					ability.damages, // Damage type
					1, // Area
					[], // Effects
					G,
				);

				// If not upgraded take the first creature found (aka last in path)
				if (!this.isUpgraded()) {
					const targetCreature = target.find((hex) => hex.creature).creature;
					const targetHex = target.find((hex) => hex.creature);

					createSeismicWave(ability.creature, targetHex ? [targetHex] : [], G);

					shakeBoard({
						amplitude: 0.03,
						durationMs: 400,
						force: true,
						axis: 'vertical',
					});
					targetCreature.takeDamage(damage);
				} else {
					const set: Set<Creature> = new Set();
					const waveHexes: Hex[] = [];
					target.forEach(({ creature }) => {
						if (creature) {
							set.add(creature);
						}
					});
					target.forEach((hex) => {
						if (hex.creature) {
							waveHexes.push(hex);
						}
					});
					createSeismicWave(ability.creature, waveHexes, G);
					set.forEach((creature) => {
						shakeBoard({
							amplitude: 0.03,
							durationMs: 400,
							force: true,
							axis: 'vertical',
						});
						creature.takeDamage(damage);
					});
				}
			},
		},

		// Third Ability: Stone Grinder
		{
			// Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			// Hit both team in a straight line but require at least one melee target
			_req: {
				team: Team.Both,
				directions: [0, 1, 0, 0, 1, 0],
				distance: 50,
			},

			_directions: [0, 0, 0, 0, 0, 0],

			// Return an array of dashed hex
			_getDashed: function (direction) {
				const stomper = this.creature;

				let hexes: Hex[];

				if (!direction[4]) {
					hexes = G.grid.getHexMap(
						stomper.x,
						stomper.y,
						0,
						stomper.player.flipped,
						matrices.straitrow,
					);
				} else if (!direction[1]) {
					hexes = G.grid.getHexMap(
						stomper.x,
						stomper.y,
						0,
						!stomper.player.flipped,
						matrices.straitrow,
					);
				} else {
					const forward = G.grid.getHexMap(
						stomper.x,
						stomper.y,
						0,
						stomper.player.flipped,
						matrices.straitrow,
					);
					const backward = G.grid.getHexMap(
						stomper.x,
						stomper.y,
						0,
						!stomper.player.flipped,
						matrices.straitrow,
					);
					hexes = forward.concat(backward);
				}

				return hexes;
			},

			// Return an array of all reachable targets'
			_getTarget: function (direction) {
				const ability = this;
				const stomper = this.creature;

				const fw = stomper.player.flipped ? stomper.x - 2 : stomper.x + 1;
				const bw = stomper.player.flipped ? stomper.x + 1 : stomper.x - 2;
				const targets = [];

				if (!direction[4]) {
					targets.push(
						...ability._getCreature(G.grid.getHexLine(fw, stomper.y, 1, stomper.player.flipped)),
					);
				} else if (!direction[1]) {
					targets.push(
						...ability._getCreature(G.grid.getHexLine(bw, stomper.y, 4, stomper.player.flipped)),
					);
				} else {
					targets.push(
						...ability._getCreature(G.grid.getHexLine(fw, stomper.y, 1, stomper.player.flipped)),
					);
					targets.push(
						...ability._getCreature(G.grid.getHexLine(bw, stomper.y, 4, stomper.player.flipped)),
					);
				}

				return targets;
			},

			// Add target's hex to the array as long as there isn't 2 empty hex
			_getCreature: function (hexes): Hex[] {
				const targets: Hex[] = [];
				let i = 0,
					stop = 0;
				while (i < hexes.length && stop < 2) {
					const crea = hexes[i].creature;

					if (crea !== undefined) {
						for (let j = 0; j < crea.size; j++) {
							targets.push(G.grid.hexes[crea.y][crea.x - j]);
						}
						i += crea.size;
						stop = 0;
					} else {
						i++;
						stop++;
					}
				}
				return targets;
			},

			// Check if there is a possible place to end the ability
			_checkEnd: function () {
				const ability = this;
				const stomper = this.creature;
				const direction = ability.testDirections(ability._req);
				let hexes;

				ability._directions = [0, 0, 0, 0, 0, 0];

				const fw = stomper.player.flipped ? stomper.x - 2 : stomper.x + 1;
				const bw = stomper.player.flipped ? stomper.x + 1 : stomper.x - 2;

				if (!direction[4]) {
					hexes = G.grid.getHexLine(fw, stomper.y, 1, stomper.player.flipped);
					if (this._getHole(hexes)) ability._directions = direction;
				} else if (!direction[1]) {
					hexes = G.grid.getHexLine(bw, stomper.y, 4, stomper.player.flipped);
					if (this._getHole(hexes)) ability._directions = direction;
				} else {
					const forward = G.grid.getHexLine(fw, stomper.y, 1, stomper.player.flipped);
					const backward = G.grid.getHexLine(bw, stomper.y, 4, stomper.player.flipped);
					if (this._getHole(forward)) ability._directions[1] = 1;
					if (this._getHole(backward)) ability._directions[4] = 1;
				}
			},

			// Return true if there is at least one 2hex hole in the array of hexes
			_getHole: function (hexes) {
				let i = 0,
					stop = 0;
				while (i < hexes.length && stop < 2) {
					if (hexes[i].creature === undefined) {
						stop++;
					} else {
						stop = 0;
					}
					i++;
				}
				return stop >= 2;
			},

			// require() :
			require: function () {
				const ability = this;
				ability._req.sourceCreature = ability.creature;

				ability._checkEnd();

				if (!ability.testRequirements() || (!ability._directions[1] && !ability._directions[4])) {
					return false;
				}
				return true;
			},

			// query() :
			query: function () {
				const ability = this;
				const stomper = this.creature;
				// Get the direction of the melee target, the dashed hex and the targets
				const direction = ability._directions;
				const dashed = ability._getDashed(direction);
				const targets = ability._getTarget(direction);

				// Separate the front and back row of targets
				let targets2 = [];
				if (direction[1] && direction[4]) {
					targets2 = targets.filter((crea) => crea.x < stomper.x);
					targets2.forEach((hex) => {
						targets.splice(
							targets.findIndex((i) => i.coord === hex.coord),
							1,
						);
					});
				}

				G.grid.queryChoice({
					fnOnConfirm: function () {
						// eslint-disable-next-line
						ability.animation(...arguments);
					},
					team: Team.Both,
					requireCreature: 1,
					id: stomper.id,
					flipped: stomper.player.flipped,
					choices: [targets, targets2], // Target the front or back row
					hexesDashed: dashed,
				});
			},

			// activate() :
			activate: function (hexes) {
				const ability = this;
				const stomper = this.creature;
				let i = 0;
				ability.end();
				shakeBoard({
					amplitude: 0.03,
					durationMs: 400,
					force: true,
					axis: 'vertical',
				});

				const targets = ability.getTargets(hexes);

				let lastTarget = targets[targets.length - 1].target;
				let offset = null;
				for (i = 0; i < targets.length; i++) {
					const target = targets[i].target;

					const damage = new Damage(
						ability.creature, // Attacker
						ability.damages, // Damage type
						1, // Area
						[], // Effects
						G,
					);
					// Apply damage on all hexes
					for (let j = 0; j < target.size; j++) {
						target.takeDamage(damage);
						if (target.dead === true) {
							break;
						}
					}

					// Stop the ability if it's not upgraded and a 2hex "hole" is created
					if (
						!ability.isUpgraded() &&
						target.dead === true &&
						(target.size > 1 ||
							G.grid.hexes[target.y][target.x - 1].creature === undefined ||
							G.grid.hexes[target.y][target.x + 1].creature === undefined)
					) {
						// Set the new last target for the movement
						if (i > 0) {
							lastTarget = targets[i - 1].target;
						} else {
							lastTarget = target;
							offset = 0;
						}
						break;
					}
				}
				// Offset for the landing position
				if (offset === null) {
					offset = lastTarget.x >= stomper.x ? 2 : -lastTarget.size;
				}

				// Jump directly to hex
				ability.creature.moveTo(G.grid.hexes[stomper.y][lastTarget.x + offset], {
					ignoreMovementPoint: true,
					ignorePath: true,
					afterimages: true,
					callback: function () {
						// Shake the screen upon landing to simulate the jump
						shakeBoard({
							amplitude: 0.02,
							durationMs: 100,
							force: true,
							axis: 'vertical',
						});

						G.onStepIn(ability.creature, ability.creature.hexagons[0], false);

						// `poll` stops itself when the board is torn down, so this no
						// longer has to check for a dead UI/grid or clear its own interval.
						G.poll(function () {
							if (!G.freezedInput) {
								G.UI.selectAbility(-1);
								if (G.activeCreature?.player?.controller !== 'bot') {
									G.activeCreature?.queryMove();
								}
								return true;
							}
						}, 100);
					},
				});
			},
		},

		// Fourth Ability: Earth Shaker
		{
			// Type : Can be "onQuery", "onStartPhase", "onDamage"
			trigger: 'onQuery',

			require: function () {
				return this.testRequirements();
			},

			// query() :
			query: function () {
				const ability = this;
				const stomper = this.creature;

				G.grid.queryChoice({
					fnOnConfirm: function () {
						// eslint-disable-next-line
						ability.animation(...arguments);
					},
					team: Team.Both,
					requireCreature: 0,
					id: stomper.id,
					flipped: stomper.player.flipped,
					choices: [
						stomper.getHexMap(matrices.frontAndBack8Hex, false),
						stomper.getHexMap(matrices.frontAndBack8Hex, true),
					],
				});
			},

			// activate() :
			activate: function (hexes) {
				const ability = this;
				ability.end(); // Deferred ending
				shakeBoard({
					amplitude: 0.03,
					durationMs: 400,
					force: true,
					axis: 'vertical',
				});

				// Delay all creatures in area
				const targets = ability.getTargets(hexes);
				for (let i = 0; i < targets.length; i++) {
					const target = targets[i].target;

					// If the ability is upgraded and the creature is already delayed, skip the turn
					if (
						ability.isUpgraded() &&
						(target.delayed || target.findEffect('Earth Shaker').length > 0)
					) {
						target.status.dizzy = true;
						target.removeEffect('Earth Shaker');
					} else {
						target.hinder();
						target.addEffect(
							new Effect(
								'Earth Shaker', // Name
								this.creature, // Caster
								target, // Target
								'onStartPhase', // Trigger
								{
									// disable the ability to delay this unit as it has already been delayed
									effectFn: () => {
										target.hinder();
									},
									deleteTrigger: 'onEndPhase',
									turnLifetime: 1,
									stackable: false,
								},
								G,
							),
						);
					}
				}

				// TODO: Creatures are responsible for telling the UI if they potentially
				// make a change that might update another creature's fatigue. But this is
				// fragile. Ideally, this would be refactored so that the UI doesn't need
				// to be told about an update.
				this.game.UI.updateFatigue();
			},
		},
	];
};
