/**
 * Tests for Snow Bunny's Bunny Hop ability (ability[0]).
 *
 * These tests exercise the require() and _detectFrontHexesWithEnemy() logic
 * to ensure Bunny Hop correctly triggers when an enemy enters a front hex.
 */

// Mock heavy DOM/Phaser dependencies before any imports
jest.mock('../../../node_modules/phaser-ce/build/phaser.js', () => ({}));
jest.mock('../../utility/hex', () => ({
	Hex: class Hex {
		x: number;
		y: number;
		pos: { x: number; y: number };
		constructor(x: number, y: number) {
			this.x = x;
			this.y = y;
			this.pos = { x, y };
		}
	},
}));

import { jest, expect, describe, test, beforeEach } from '@jest/globals';

// ---- Import PointFacade separately (no Phaser dependency) ----
import { configure, getPointFacade } from '../../utility/pointfacade';

// ---- Import matrices independently (no Phaser dependency) ----
import * as matrices from '../../utility/matrices';

/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */

// ---- Minimal hex grid simulation ----

/**
 * Build a 2D array of simple hex objects for a grid of given dimensions.
 */
function buildHexGrid(width: number, height: number, blockedSet = new Set<string>()) {
	const hexes: any[][] = [];
	for (let y = 0; y < height; y++) {
		const row: any[] = [];
		for (let x = 0; x < width; x++) {
			row.push({
				x,
				y,
				pos: { x, y },
				blocked: blockedSet.has(`${x},${y}`),
				reachable: true,
				// hex.creature is a getter in production; we track it via PointFacade
				get creature() {
					// Resolved dynamically by PointFacade in production.
					// In tests the Ability code uses getPointFacade() directly,
					// not hex.creature, so this can be a static value.
					return undefined;
				},
				isWalkable(size: number, id: number, ignoreReachable = false) {
					for (let i = 0; i < size; i++) {
						const xi = this.x - i;
						if (xi < 0 || xi >= width) return false;
						const h = hexes[this.y][xi];
						if (h.blocked) return false;
						if (!ignoreReachable && !h.reachable) return false;
						const occupant = getPointFacade().getCreaturesAt({ x: xi, y: this.y })[0];
						if (occupant !== undefined && occupant.id !== id) return false;
					}
					return true;
				},
			});
		}
		hexes.push(row);
	}
	return hexes;
}

/**
 * Build getHexMap for a creature on a given grid.
 * Replicates the logic in creature.getHexMap + hexgrid.getHexMap.
 */
function getHexMap(
	hexes: any[][],
	creatureX: number,
	creatureY: number,
	flipped: boolean,
	invertFlipped: boolean,
	mapDef: { origin: number[]; [key: string]: any },
) {
	const array = (mapDef as any).slice(0).map((row: number[]) => [...row]);
	const size = 1; // Snow Bunny is size 1

	const x = (flipped ? !invertFlipped : invertFlipped) ? creatureX + 1 - size : creatureX;

	let originx = x;
	const originy = creatureY - mapDef.origin[1];
	const offsetx = 0 - mapDef.origin[0];

	originx += flipped ? 1 - array[0].length - offsetx : -1 + offsetx;

	const result: any[] = [];
	for (let y = 0; y < array.length; y++) {
		if (flipped && y % 2 !== 0) array[y].push(0);
		array[y].unshift(0);
		if (originy % 2 !== 0 && y % 2 !== 0) {
			if (flipped) array[y].pop();
			else array[y].splice(0, 1);
		}
		for (let xi = 0; xi < array[y].length; xi++) {
			if (array[y][xi]) {
				const xfinal = flipped ? array[y].length - 1 - xi : xi;
				const fy = originy + y;
				const fx = originx + xfinal;
				if (fy >= 0 && fy < hexes.length && fx >= 0 && fx < hexes[fy].length) {
					result.push(hexes[fy][fx]);
				}
			}
		}
	}
	return result;
}

// ---- Helper to build a minimal creature mock ----
function makeBunny(hexGrid: any[][], x: number, y: number, team = 0) {
	const creature: any = {
		id: 42,
		x,
		y,
		pos: { x, y },
		size: 1,
		team,
		dead: false,
		temp: false,
		_brbState: null,
		materializationSickness: false,
		isFrozen: () => false,
		get hexagons() {
			return [hexGrid[this.y][this.x]];
		},
		player: { flipped: team % 2 === 1 },
		getHexMap(mapDef: any, invertFlipped: boolean) {
			// Mirror creature.getHexMap: the "flipped" arg to hexgrid.getHexMap is
			// player.flipped ? !invertFlipped : invertFlipped  (not player.flipped directly).
			const flippedForGrid = this.player.flipped ? !invertFlipped : invertFlipped;
			return getHexMap(hexGrid, this.x, this.y, flippedForGrid, invertFlipped, mapDef);
		},
	};
	return creature;
}

function makeEnemy(x: number, y: number, team = 1) {
	return {
		id: 99,
		x,
		y,
		pos: { x, y },
		size: 1,
		team,
		dead: false,
		temp: false,
		_brbState: null,
	};
}

// ---- Configure PointFacade before each test ----
let creatures: any[] = [];
beforeEach(() => {
	creatures = [];
	configure({
		// @ts-ignore
		getCreatures: () => creatures,
		getCreaturePassablePoints: (_creature: any) => [],
		getCreatureBlockedPoints: (creature: any) => {
			if (creature.dead || creature.temp || creature._brbState !== null) return [];
			const ps = [];
			for (let i = 0; i < creature.size; i++) {
				ps.push({ x: creature.x - i, y: creature.y });
			}
			return ps;
		},
		// @ts-ignore
		getTraps: () => [],
		getTrapPassablePoints: (_t: any) => [],
		getTrapBlockedPoints: (_t: any) => [],
		// @ts-ignore
		getDrops: () => [],
		getDropPassablePoints: (_d: any) => [],
		getDropBlockedPoints: (_d: any) => [],
	});
});

// ---- Import the Bunny Hop ability functions by extracting logic from Snow-Bunny ----
// We don't import Snow-Bunny.ts directly because it transitively imports Phaser (via creature.ts).
// Instead, the Bunny Hop logic is reproduced inline below.

const HopTriggerDirections = { Above: 0, Front: 1, Below: 2 };

function buildAbility(bunny: any, activeCreature: any) {
	const ability: any = {
		creature: bunny,
		game: { activeCreature },
		id: 0,
		timesUsedThisTurn: 0,
		upgraded: false,
		testRequirements: () => true,
		isUpgraded: () => false,
		_getUsesPerTurn() {
			return this.isUpgraded() ? 2 : 1;
		},
		_detectFrontHexesWithEnemy() {
			const hexesInFront = this.creature.getHexMap(matrices.front1hex, false);
			return hexesInFront.reduce((acc: any[], curr: any, idx: number) => {
				const creatureOnHex = getPointFacade().getCreaturesAt({ x: curr.x, y: curr.y })[0];
				const hexHasEnemy = creatureOnHex && creatureOnHex.team % 2 !== this.creature.team % 2; // isTeam Enemy
				if (hexHasEnemy) {
					acc.push({
						direction: idx,
						hex: curr,
						enemyPos: creatureOnHex.pos,
					});
				}
				return acc;
			}, []);
		},
		_findEnemyHexInFront(hexWithEnemy: any) {
			const enemyInFrontHex = this._detectFrontHexesWithEnemy().find(
				({ enemyPos }: any) => enemyPos.x === hexWithEnemy.x && enemyPos.y === hexWithEnemy.y,
			);
			return enemyInFrontHex ? hexWithEnemy : undefined;
		},
		_getHopHex() {
			const triggerHexes = this._detectFrontHexesWithEnemy();
			let hex: any;

			if (
				triggerHexes.find((h: any) => h.direction === HopTriggerDirections.Front) ||
				(triggerHexes.find((h: any) => h.direction === HopTriggerDirections.Above) &&
					triggerHexes.find((h: any) => h.direction === HopTriggerDirections.Below))
			) {
				hex = this.creature.getHexMap(matrices.inlineback1hex, false)[0];
			} else if (triggerHexes.find((h: any) => h.direction === HopTriggerDirections.Above)) {
				hex = this.creature.getHexMap(matrices.backbottom1hex, false)[0];
			} else if (triggerHexes.find((h: any) => h.direction === HopTriggerDirections.Below)) {
				hex = this.creature.getHexMap(matrices.backtop1hex, false)[0];
			}

			// If we can't hop away, try hopping backwards.
			if (hex === undefined || !hex.isWalkable(this.creature.size, this.creature.id, true)) {
				hex = this.creature.getHexMap(matrices.inlineback1hex, false)[0];
			}

			// If still blocked (e.g., at board edge), try hopping to the opposite front diagonal.
			if (hex === undefined || !hex.isWalkable(this.creature.size, this.creature.id, true)) {
				if (
					triggerHexes.find((h: any) => h.direction === HopTriggerDirections.Below) &&
					!triggerHexes.find((h: any) => h.direction === HopTriggerDirections.Above)
				) {
					// Attacked from below only — escape upward (front-top).
					hex = this.creature.getHexMap(matrices.backtop1hex, true)[0];
				} else if (
					triggerHexes.find((h: any) => h.direction === HopTriggerDirections.Above) &&
					!triggerHexes.find((h: any) => h.direction === HopTriggerDirections.Below)
				) {
					// Attacked from above only — escape downward (front-bottom).
					hex = this.creature.getHexMap(matrices.backbottom1hex, true)[0];
				}
			}

			// Finally, give up if we still can't move.
			if (hex !== undefined && !hex.isWalkable(this.creature.size, this.creature.id, true)) {
				return undefined;
			}

			return hex;
		},
		require(hex: any) {
			if (!this.testRequirements()) return false;
			if (this.creature === this.game.activeCreature) return false;

			const creatureOnHex = getPointFacade().getCreaturesAt({ x: hex.x, y: hex.y })[0];
			if (creatureOnHex == undefined) return false;

			let triggerHexes: any[] = [];
			if (creatureOnHex === this.creature) {
				triggerHexes = this._detectFrontHexesWithEnemy();
			} else if (creatureOnHex.team % 2 !== this.creature.team % 2) {
				// isTeam Enemy
				const frontHexWithEnemy = this._findEnemyHexInFront(hex);
				if (frontHexWithEnemy) triggerHexes.push(frontHexWithEnemy);
			}

			const abilityCanTrigger =
				triggerHexes.length &&
				this.timesUsedThisTurn < this._getUsesPerTurn() &&
				!this.creature.materializationSickness &&
				!this.creature.isFrozen() &&
				this._getHopHex();

			return !!abilityCanTrigger;
		},
	};
	return ability;
}

// ============================
// TESTS
// ============================

describe('Snow Bunny Bunny Hop', () => {
	describe('_detectFrontHexesWithEnemy', () => {
		test('detects enemy in front-inline hex (P1 bunny)', () => {
			const hexGrid = buildHexGrid(16, 9);
			const bunny = makeBunny(hexGrid, 4, 3, 0);
			const enemy = makeEnemy(5, 3, 1);
			creatures = [bunny, enemy];

			const ability = buildAbility(bunny, {} /* not bunny's turn */);
			const detected = ability._detectFrontHexesWithEnemy();

			expect(detected.length).toBe(1);
			expect(detected[0].enemyPos).toEqual({ x: 5, y: 3 });
		});

		test('detects no enemy when front hexes are clear (P1 bunny)', () => {
			const hexGrid = buildHexGrid(16, 9);
			const bunny = makeBunny(hexGrid, 4, 3, 0);
			creatures = [bunny];

			const ability = buildAbility(bunny, {});
			const detected = ability._detectFrontHexesWithEnemy();

			expect(detected.length).toBe(0);
		});

		test('detects enemy in top-front hex (P1 bunny)', () => {
			const hexGrid = buildHexGrid(16, 9);
			const bunny = makeBunny(hexGrid, 4, 3, 0);
			// Front hexes for P1 bunny at (4,3): (4,2), (5,3), (4,4)
			// Top-front = (4,2), direction 0
			const enemy = makeEnemy(4, 2, 1);
			creatures = [bunny, enemy];

			const ability = buildAbility(bunny, {});
			const detected = ability._detectFrontHexesWithEnemy();

			expect(detected.length).toBe(1);
			expect(detected[0].direction).toBe(0); // Above
		});
	});

	describe('_getHopHex', () => {
		test('returns back hex when enemy is in front-inline hex', () => {
			const hexGrid = buildHexGrid(16, 9);
			const bunny = makeBunny(hexGrid, 4, 3, 0);
			const enemy = makeEnemy(5, 3, 1);
			creatures = [bunny, enemy];

			const ability = buildAbility(bunny, {});
			const hopHex = ability._getHopHex();

			// Back hex for P1 at (4,3) should be (3,3)
			expect(hopHex).toBeDefined();
			expect(hopHex.x).toBe(3);
			expect(hopHex.y).toBe(3);
		});

		test('returns undefined when back hex is blocked', () => {
			const hexGrid = buildHexGrid(16, 9);
			const bunny = makeBunny(hexGrid, 4, 3, 0);
			const enemy = makeEnemy(5, 3, 1);
			const ally = makeEnemy(3, 3, 0); // blocks the back hex
			creatures = [bunny, enemy, ally];

			const ability = buildAbility(bunny, {});
			const hopHex = ability._getHopHex();

			expect(hopHex).toBeUndefined();
		});

		// Regression: user's exact scenario — H1 bunny, Scavenger at I1, should hop to G1
		test('hops to front-top (G1) when bunny is at left edge and attacked from below (I1)', () => {
			// H1 = (x=0, y=7), I1 = (x=0, y=8), G1 = (x=0, y=6)
			const hexGrid = buildHexGrid(16, 9);
			const bunny = makeBunny(hexGrid, 0, 7, 0);
			const enemy = makeEnemy(0, 8, 1); // I1 — below-front
			creatures = [bunny, enemy];

			const ability = buildAbility(bunny, {});
			const hopHex = ability._getHopHex();

			expect(hopHex).toBeDefined();
			expect(hopHex.x).toBe(0);
			expect(hopHex.y).toBe(6); // G1
		});
	});

	describe('require(hex)', () => {
		test('returns true when enemy moves to front hex and back is clear (P1 bunny)', () => {
			const hexGrid = buildHexGrid(16, 9);
			const bunny = makeBunny(hexGrid, 4, 3, 0);
			const enemy = makeEnemy(5, 3, 1);
			creatures = [bunny, enemy];

			// Bunny is not the active creature
			const activeCreature = { id: 999 };
			const ability = buildAbility(bunny, activeCreature);

			// Destination hex where enemy moved to (front-inline hex)
			const destHex = hexGrid[3][5];
			const result = ability.require(destHex);

			expect(result).toBe(true);
		});

		test('returns false when bunny is the active creature (own movement)', () => {
			const hexGrid = buildHexGrid(16, 9);
			const bunny = makeBunny(hexGrid, 4, 3, 0);
			const enemy = makeEnemy(5, 3, 1);
			creatures = [bunny, enemy];

			// Bunny IS the active creature
			const ability = buildAbility(bunny, bunny);
			const destHex = hexGrid[3][5];
			const result = ability.require(destHex);

			expect(result).toBe(false);
		});

		test('returns false when mover is an ally (not enemy)', () => {
			const hexGrid = buildHexGrid(16, 9);
			const bunny = makeBunny(hexGrid, 4, 3, 0);
			const ally = makeEnemy(5, 3, 0); // Same team as bunny
			creatures = [bunny, ally];

			const activeCreature = { id: 999 };
			const ability = buildAbility(bunny, activeCreature);

			const destHex = hexGrid[3][5];
			const result = ability.require(destHex);

			expect(result).toBe(false);
		});

		test('returns false when no creature is at dest hex', () => {
			const hexGrid = buildHexGrid(16, 9);
			const bunny = makeBunny(hexGrid, 4, 3, 0);
			creatures = [bunny];

			const activeCreature = { id: 999 };
			const ability = buildAbility(bunny, activeCreature);

			// Dest hex with no creature
			const destHex = hexGrid[3][5];
			const result = ability.require(destHex);

			expect(result).toBe(false);
		});

		test('returns false when enemy moves to a non-front hex', () => {
			const hexGrid = buildHexGrid(16, 9);
			const bunny = makeBunny(hexGrid, 4, 3, 0);
			// Enemy moves to (6,3) which is NOT a front hex of bunny at (4,3)
			const enemy = makeEnemy(6, 3, 1);
			creatures = [bunny, enemy];

			const activeCreature = { id: 999 };
			const ability = buildAbility(bunny, activeCreature);

			const destHex = hexGrid[3][6];
			const result = ability.require(destHex);

			expect(result).toBe(false);
		});

		test('returns false when bunny has materializationSickness', () => {
			const hexGrid = buildHexGrid(16, 9);
			const bunny = makeBunny(hexGrid, 4, 3, 0);
			bunny.materializationSickness = true;
			const enemy = makeEnemy(5, 3, 1);
			creatures = [bunny, enemy];

			const activeCreature = { id: 999 };
			const ability = buildAbility(bunny, activeCreature);

			const destHex = hexGrid[3][5];
			const result = ability.require(destHex);

			expect(result).toBe(false);
		});

		test('returns false when back hex is blocked (hop impossible)', () => {
			const hexGrid = buildHexGrid(16, 9);
			const bunny = makeBunny(hexGrid, 4, 3, 0);
			const enemy = makeEnemy(5, 3, 1);
			const blocker = makeEnemy(3, 3, 0); // ally blocking back
			creatures = [bunny, enemy, blocker];

			const activeCreature = { id: 999 };
			const ability = buildAbility(bunny, activeCreature);

			const destHex = hexGrid[3][5];
			const result = ability.require(destHex);

			expect(result).toBe(false);
		});

		test('P2 bunny (flipped) triggers when enemy moves to its front hex', () => {
			const hexGrid = buildHexGrid(16, 9);
			// P2 bunny at (10,3), flipped
			const bunny = makeBunny(hexGrid, 10, 3, 1);
			// For P2 at (10,3), front is to the LEFT: (9,2), (9,3), (9,4)
			const enemy = makeEnemy(9, 3, 0); // P1 enemy
			creatures = [bunny, enemy];

			const activeCreature = { id: 999 };
			const ability = buildAbility(bunny, activeCreature);

			const destHex = hexGrid[3][9];
			const result = ability.require(destHex);

			expect(result).toBe(true);
		});

		// Regression: H1 bunny at board edge, Scavenger moves to I1 → hop to G1 should trigger
		test('triggers and hops to G1 when bunny at H1 and enemy moves to I1', () => {
			const hexGrid = buildHexGrid(16, 9);
			const bunny = makeBunny(hexGrid, 0, 7, 0); // H1
			const enemy = makeEnemy(0, 8, 1); // I1 — below-front
			creatures = [bunny, enemy];

			const activeCreature = { id: 999 };
			const ability = buildAbility(bunny, activeCreature);

			const destHex = hexGrid[8][0]; // I1 = y=8, x=0
			const result = ability.require(destHex);

			expect(result).toBe(true);
		});
	});
});
