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
import { getFrameSize } from '../game-display/texture';
import { spawnChainLightning } from '../vfx/lightning/effect';
import { earthShakerCrackLook, type LightningPoint } from '../vfx/lightning/look';

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

/**
 * Spawns forked cracks (like forked lightning) that split from the
 * Stomper's two front feet and crawl across the target area, leaving
 * jagged glowing lines behind them. Each foot smashes into the ground
 * and throws out its own fork of 2-3 diverging lines — the "forked
 * lightning over the ground" read the ability's name promises.
 *
 * Uses the same `spawnChainLightning` renderer as the Impaler's chain
 * lightning, but with a look tuned for a ground effect: warm amber
 * tones, slow travel, and no embers or strike flashes.
 *
 * The cracks are parented to the board's creature group at the
 * shallowest row they span, so the whole trail sits under every unit
 * cardboard it crawls beneath — a ground effect, not an overhead
 * bolt. `facing` is passed in by the caller, which computes it from grid
 * coordinates and sets the sprite with setDir before this runs, so the
 * emission points always track the front feet of the now-facing unit.
 *
 * Targets are sorted outward along the casting direction before being
 * forked, so every hop progresses away from the Stomper — a crack never
 * arcs back toward the caster, and there is no upward bow.
 */
function createEarthShakerCracks(
	creature: Creature,
	targetHexes: Hex[],
	G: Game,
	facing: 1 | -1,
	onDone?: () => void,
): void {
	const finish = () => {
		pending--;
		if (pending <= 0) onDone?.();
	};

	if (!G.gameEngine || targetHexes.length === 0) {
		onDone?.();
		return;
	}

	const sprite = creature.sprite;
	const grp = creature.grp;
	if (!sprite || !grp) {
		onDone?.();
		return;
	}

	const { width, height } = getFrameSize(sprite);

	// Two emission points: the Stomper's two front feet, on the ground
	// under the leading edge of the cardboard. The sprite is anchored
	// bottom-centre, so the ground line is exactly `grp.y + sprite.y`.
	// `facing` is the direction the unit is actually turned to, so a
	// backward cast emits from the genuinely-front feet.
	const footBaseX = (grp.x ?? 0) + (sprite.x ?? 0) + (facing * width) / 2;
	// The feet sit a little above the ground line — high enough to read
	// as two distinct stomps on the cardboard's leading edge, not a single
	// point buried at the bottom of the sprite.
	const footY = (grp.y ?? 0) + (sprite.y ?? 0) - height * 0.12;
	const emissionA: LightningPoint = { x: footBaseX, y: footY };
	const emissionB: LightningPoint = { x: footBaseX - facing * 45, y: footY };

	const hexCenterX = HEX_WIDTH_PX / 2;

	// Sort by distance from the emission point, nearest first, so every
	// hop progresses outward from the Stomper. A signed projection would
	// put back-row targets ahead of front-row ones for a backward cast,
	// making the chain arc from the front foot back toward the Stomper
	// before continuing — the "bounces back" read. Absolute distance
	// keeps the chain monotonic regardless of which way the unit faces.
	const sorted = [...targetHexes].sort((a, b) => {
		const da = (a.displayPos.x + hexCenterX - footBaseX) ** 2;
		const db = (b.displayPos.x + hexCenterX - footBaseX) ** 2;
		return da - db;
	});

	// Each front foot throws out its own fork of 2-3 diverging lines. The
	// targets are round-robined across the feet so each foot covers a
	// roughly equal share of the area, and each foot's targets are then
	// forked so the lines spread outward like forked lightning rather
	// than one line doubling back on itself.
	const chains: Array<Array<Creature | LightningPoint>> = [];
	const forkCount = Math.min(3, Math.max(1, Math.ceil(sorted.length / 2)));
	for (let foot = 0; foot < 2; foot++) {
		const emission = foot === 0 ? emissionA : emissionB;
		const footTargets = sorted.filter((_, i) => i % 2 === foot);
		for (let f = 0; f < forkCount && footTargets.length > 0; f++) {
			const points = footTargets.filter((_, i) => i % forkCount === f).map(hexToGroundPoint);
			if (points.length > 0) {
				chains.push([emission, ...points]);
			}
		}
	}

	// Shallowest row the cracks span. In the oblique projection a lower
	// row draws behind everything on the rows below it, so pinning the
	// trail to the Stomper's own row band keeps the entire crack under
	// every unit cardboard it passes — including the Stomper's own.
	let shallowestRow = creature.y;
	for (const hex of targetHexes) {
		shallowestRow = Math.min(shallowestRow, hex.y);
	}

	const engine = G.gameEngine;
	if (!engine) {
		onDone?.();
		return;
	}
	const look = earthShakerCrackLook();

	// Re-sort the creature group so the crack sprites — banded at
	// EFFECT_UNDER_UNITS — render *below* the cardboards (banded at UNITS).
	// This has to happen *after* each hop's sprites actually exist:
	// `spawnChainLightning` defers every hop through `after(delay, ...)`, so
	// the sprites are not on the group when this function returns. Sorting
	// before they land just puts them at the end of the list again, on top
	// of the units they are meant to crawl under. `onHop` fires synchronously
	// right after `bolt.start()` materialises its sprites, so it is the
	// reliable moment to re-order; the final sort in `finish` covers the
	// last hop.
	const reSort = () => {
		if (typeof G.grid.orderCreatureZ === 'function') {
			G.grid.orderCreatureZ();
		}
	};

	// Only count chains that actually have a hop (an emission point plus
	// at least one target point), so a one-sided cast doesn't leave
	// `onDone` waiting on a chain that never spawned.
	let pending = 0;
	for (const chain of chains) {
		pending++;
		spawnChainLightning(engine, chain, {
			parent: G.grid.creatureGroup,
			surfaceSource: { textures: G.Phaser?.textures },
			depth: getDepthAtBand(shallowestRow, 'EFFECT_UNDER_UNITS'),
			look,
			onHop: reSort,
			onEnd: () => {
				reSort();
				finish();
			},
		});
	}
	if (pending === 0) onDone?.();
}

/** A point on the ground under a target hex, in creature-group space. */
function hexToGroundPoint(hex: Hex): LightningPoint {
	const hexCenterX = HEX_WIDTH_PX / 2;
	return {
		x: hex.displayPos.x + hexCenterX,
		y: hex.displayPos.y + 25,
	};
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
				const stomper = this.creature;

				// Face the Stomper toward the area it's cracking. The
				// animation2 pipeline already does this for creature/array
				// args, but the Earth Shaker's query passes a plain hex
				// array, so make the facing explicit here: a backward cast
				// must emit from the feet that are genuinely forward once
				// the unit has turned, not from the feet it was facing
				// before the player selected the back row.
				if (hexes && hexes.length > 0) {
					// Face the Stomper toward the area it's cracking so the cracks
					// emit from the front hexagon of the now-facing unit. Compute
					// the facing directly from grid coordinates and set it with
					// setDir — faceHex's early-returns bail out to
					// facePlayerDefault (no flip) when the target lands on the
					// Stomper's own tiles, which is exactly what a backward cast
					// over the unit's own back row does.
					let farthest = hexes[0];
					let farthestDist = -Infinity;
					for (const hex of hexes) {
						if (hex && hex.displayPos) {
							const dx = hex.displayPos.x - stomper.grp.x;
							const dy = hex.displayPos.y - stomper.grp.y;
							const dist = dx * dx + dy * dy;
							if (dist > farthestDist) {
								farthestDist = dist;
								farthest = hex;
							}
						}
					}
					// facefrom is the hex the unit faces *from*, which for a
					// flipped player is the leftmost tile — the same rule
					// faceHex uses internally.
					const facefrom =
						stomper.player.flipped && stomper.hexagons?.[stomper.size - 1]
							? stomper.hexagons[stomper.size - 1]
							: stomper.hexagons?.[0];
					let facing: 1 | -1 = 1;
					if (farthest && facefrom && farthest.x != null && farthest.y != null) {
						// faceHex's flip rule, applied directly so no early-return
						// can silently un-flip the unit for a backward cast.
						facing =
							facefrom.y % 2 === 0
								? farthest.x <= facefrom.x
									? -1
									: 1
								: farthest.x < facefrom.x
								? -1
								: 1;
					}

					// `ability.end()` → `queryMove()` calls
					// `facePlayerDefault()` (creature.ts:1088), which flips the
					// unit back to its player's default facing. That reset runs
					// *after* activate() returns, so calling setDir before end()
					// here leaves the unit facing its old default by the time the
					// cardboard is drawn — the backward cast looked like it never
					// turned. Set the direction *after* end(), the same way
					// Vehemoth's backward shot does (Vehemoth.ts:660-662), so the
					// flip is the last word on the unit's facing.
					ability.end(); // Deferred ending
					stomper.creatureSprite.setDir(facing);

					shakeBoard({
						amplitude: 0.03,
						durationMs: 400,
						force: true,
						axis: 'vertical',
					});

					// Two forked cracks split from the Stomper's front hexagon across
					// the target area, leaving jagged glowing lines behind them — the
					// "forked lightning over the ground" read the ability's name
					// promises. The cracks crawl toward the hexes the ability covers,
					// so they track the area even when it holds no creature.
					const crackHexes = hexes.filter((hex) => hex && hex.displayPos);
					if (crackHexes.length > 0) {
						// Turn the Stomper back to its player's default facing once
						// the crack trail has fully faded — driven by the chain's
						// own `onEnd`, not a hardcoded timer, so a longer chain
						// (more targets, staggered hops) keeps the unit turned
						// until the last crack has actually vanished.
						const defaultDir = stomper.player.flipped ? -1 : 1;
						const turnBack = () => {
							if (!stomper.dead && stomper.sprite?.scale?.x !== defaultDir) {
								stomper.facePlayerDefault();
							}
						};
						createEarthShakerCracks(stomper, crackHexes, G, facing, turnBack);
					}
				}

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
