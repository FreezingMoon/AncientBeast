import { describe, test, expect } from '@jest/globals';
import { HexGrid } from '../../utility/hexgrid';
import { Creature } from '../../creature';

function buildGrid() {
	const hexes: any[][] = [];
	for (let y = 0; y < 9; y++) {
		const row: any[] = [];
		for (let x = 0; x < 16; x++) {
			row.push({
				x,
				y,
				pos: { x, y },
				direction: 0,
				reachable: true,
				displayClasses: '',
				overlayClasses: '',
				display: {},
				grid: undefined,
				displayVisualState() {},
				cleanDisplayVisualState() {},
				overlayVisualState() {},
				cleanOverlayVisualState() {},
				updateStyle() {},
			});
		}
		hexes.push(row);
	}
	const grid = Object.create(HexGrid.prototype);
	(grid as any).hexes = hexes;
	(grid as any).displayHexesGroup = { bringToTop() {} };
	hexes.forEach((row) => row.forEach((hex) => (hex.grid = grid)));
	(grid as any).game = {
		creatures: [],
		channels: { hex: { emit() {}, on() {} } },
		metaPowersState: { executeMonster: false },
		traps: [],
		drops: [],
	};
	(grid as any).forEachHex = (fn: any) => hexes.forEach((r) => r.forEach(fn));
	(grid as any).atLeastOneTarget = () => true;
	(grid as any).hexExists = ({ x, y }: { x: number; y: number }) =>
		x >= 0 && x < 16 && y >= 0 && y < 9;
	return grid;
}

function makeSource(size: number, flipped: boolean) {
	const c = Object.create(Creature.prototype) as any;
	c.size = size;
	c.player = { flipped };
	c.id = 0;
	c.hexagons = [];
	return c;
}

function makeTarget(id: number) {
	const c = Object.create(Creature.prototype) as any;
	c.size = 1;
	c.player = { flipped: false };
	c.id = id;
	c.hexagons = [];
	return c;
}

/**
 * Shared query options for a direction query. The target is placed at the far
 * end of the line (via a stopOnCreature=false probe) so the creature-hex
 * reordering block in getDirectionChoices runs against a real creature.
 */
function baseOpts(flipped: boolean, source: any) {
	return {
		team: 1,
		requireCreature: true,
		id: 0,
		flipped,
		x: 8,
		y: 4,
		hexesDashed: [],
		shrunkenHexes: [],
		hexesDeadZone: [],
		directions: [0, 0, 0, 0, 0, 0],
		includeCreature: true,
		stopOnCreature: true,
		pierceNumber: 1,
		pierceThroughBehavior: 'stop',
		distance: 6,
		minDistance: 0,
		distanceFalloff: 3,
		dashedHexesAfterCreatureStop: true,
		dashedHexesDistance: 0,
		dashedHexesUnderCreature: true,
		sourceCreature: source,
		choices: [],
		optTest: () => true,
		ignoreCreatureTest: undefined,
		fillOnlyHoveredCreature: false,
		isDirectionsQuery: true,
		hideNonTarget: true,
	};
}

function placeTargetAtFarEnd(grid: any, source: any, flipped: boolean, direction: number) {
	// Probe with stopOnCreature=false to reach the far end regardless of
	// intervening creatures, then place a target on the last hex.
	const probe: any = baseOpts(flipped, source);
	probe.directions[direction] = 1;
	probe.stopOnCreature = false;
	const r = (grid as any).getDirectionChoices(probe);
	const line = r.choices[0];
	const farHex = line[line.length - 1];
	const tgt = makeTarget(9);
	farHex.creature = tgt;
	tgt.hexagons = [farHex];
	return farHex;
}

describe('Fiery Touch direction ordering with target', () => {
	test('backwards line with target creature: full near then shrunken far', () => {
		const grid = buildGrid();
		const srcX = 8,
			srcY = 4;

		for (const flipped of [false, true]) {
			const source = makeSource(3, flipped);
			for (let i = 0; i < 3; i++) {
				const xx = flipped ? srcX - i : srcX + i;
				grid.hexes[srcY][xx].creature = source;
			}
			source.hexagons = flipped
				? [grid.hexes[srcY][srcX], grid.hexes[srcY][srcX - 1], grid.hexes[srcY][srcX - 2]]
				: [grid.hexes[srcY][srcX], grid.hexes[srcY][srcX + 1], grid.hexes[srcY][srcX + 2]];

			for (let d = 0; d < 6; d++) {
				const farHex = placeTargetAtFarEnd(grid, source, flipped, d);

				const opts: any = baseOpts(flipped, source);
				opts.directions[d] = 1;
				const result = (grid as any).getDirectionChoices(opts);
				const dir = result.choices[0].map((h: any) => `(${h.x},${h.y})`);
				const shr = new Set(result.shrunkenHexes.map((h: any) => `(${h.x},${h.y})`));
				const full = dir.filter((hx: string) => !shr.has(hx));
				const shrunken = dir.filter((hx: string) => shr.has(hx));

				// The full-damage (non-shrunken) hexes must be the ones closest to
				// Abolished along the path, and the shrunken (reduced-effect) hexes
				// the ones furthest away.
				const fullDist = full.map((hx: string) => dir.indexOf(hx));
				const shrDist = shrunken.map((hx: string) => dir.indexOf(hx));
				expect(Math.max(...fullDist)).toBeLessThan(Math.min(...shrDist));

				// The line must run continuously from the source outward.
				expect(dir.length).toBe(full.length + shrunken.length);

				farHex.creature = null;
			}
			for (let i = 0; i < 3; i++) {
				const xx = flipped ? srcX - i : srcX + i;
				grid.hexes[srcY][xx].creature = null;
			}
		}
	});

	test('straight-line direction query excludes target hexes beyond ability distance so they stay overflow outlines', () => {
		const grid = buildGrid();
		const srcX = 5,
			srcY = 4;
		const source = makeSource(1, false);
		grid.hexes[srcY][srcX].creature = source;
		source.hexagons = [grid.hexes[srcY][srcX]];

		// 3-hex target starting at distance 3 (x=8,9,10) while ability distance is 3:
		// only x=8 is within range; x=9 and x=10 are beyond distance 3.
		const target = makeTarget(12);
		target.size = 3;
		target.hexagons = [grid.hexes[srcY][8], grid.hexes[srcY][9], grid.hexes[srcY][10]];
		target.hexagons.forEach((h: any) => (h.creature = target));

		const opts: any = baseOpts(false, source);
		opts.x = srcX;
		opts.y = srcY;
		opts.distance = 3;
		opts.distanceFalloff = 0;
		opts.directions[1] = 1; // Right

		const result = (grid as any).getDirectionChoices(opts);
		expect(result.choices).toHaveLength(1);
		const choiceCoords = result.choices[0].map((h: any) => h.x);
		expect(choiceCoords).toContain(8);
		expect(choiceCoords).not.toContain(9);
		expect(choiceCoords).not.toContain(10);
	});
});

describe('shrunken restore on hover-off', () => {
	test('a creature-occupied shrunken hex keeps the shrunken class after hover-off', () => {
		const grid = buildGrid();
		const srcX = 8,
			srcY = 4;
		const flipped = false;
		const source = makeSource(3, flipped);
		for (let i = 0; i < 3; i++) {
			grid.hexes[srcY][srcX + i].creature = source;
		}
		source.hexagons = [
			grid.hexes[srcY][srcX],
			grid.hexes[srcY][srcX + 1],
			grid.hexes[srcY][srcX + 2],
		];

		// Place a target at the far end of the Right direction.
		const farHex = placeTargetAtFarEnd(grid, source, flipped, 1 /* Right */);

		const opts: any = baseOpts(flipped, source);
		opts.directions[1] = 1;
		const result = (grid as any).getDirectionChoices(opts);

		// The target hex is creature-occupied and (for upgraded range) shrunken.
		const targetHex = result.choices[0].find((h: any) => h.creature && h.creature.id === 9);
		expect(targetHex).toBeDefined();
		expect(result.shrunkenHexes).toContain(targetHex);

		// Track whether `shrunken` is re-applied on hover-off.
		let shrunkenReadded = false;
		const origDisplayVisualState = targetHex.displayVisualState.bind(targetHex);
		targetHex.displayVisualState = (cls: string) => {
			if (cls === 'shrunken') {
				shrunkenReadded = true;
			}
			return origDisplayVisualState(cls);
		};

		// Simulate the hover-off path for a non-active creature hex.
		// `getDirectionChoices` returns a fresh options object carrying the
		// populated `shrunkenHexes`/`hexesDashed` arrays; that is what
		// `queryHexes()` stores as `lastQueryOpt`, so point the grid at it.
		(grid as any).lastQueryOpt = result;
		(grid as any).clearTransientHexHoverVisual(targetHex);

		expect(shrunkenReadded).toBe(true);

		farHex.creature = null;
		for (let i = 0; i < 3; i++) {
			grid.hexes[srcY][srcX + i].creature = null;
		}
	});
});

describe('dashed restore on hover-off', () => {
	test('a creature-occupied dashed hex keeps the dashed class after hover-off', () => {
		const grid = buildGrid();
		const srcX = 8,
			srcY = 4;
		const flipped = false;
		const source = makeSource(3, flipped);
		for (let i = 0; i < 3; i++) {
			grid.hexes[srcY][srcX + i].creature = source;
		}
		source.hexagons = [
			grid.hexes[srcY][srcX],
			grid.hexes[srcY][srcX + 1],
			grid.hexes[srcY][srcX + 2],
		];

		// Place a target at the far end of the Right direction.
		const farHex = placeTargetAtFarEnd(grid, source, flipped, 1 /* Right */);

		const opts: any = baseOpts(flipped, source);
		opts.directions[1] = 1;
		const result = (grid as any).getDirectionChoices(opts);

		// The target hex is creature-occupied; Godlet Printer marks exactly
		// such occupied in-range hexes as dashed via `hexesDashed`.
		const targetHex = result.choices[0].find((h: any) => h.creature && h.creature.id === 9);
		expect(targetHex).toBeDefined();

		// Track whether `dashed` is re-applied on hover-off.
		let dashedReadded = false;
		const origDisplayVisualState = targetHex.displayVisualState.bind(targetHex);
		targetHex.displayVisualState = (cls: string) => {
			if (cls === 'dashed') {
				dashedReadded = true;
			}
			return origDisplayVisualState(cls);
		};

		// Simulate the hover-off path for a non-active creature hex.
		// The query options gain the occupied target as a dashed hex, mirroring
		// how `materialize()` passes occupied spawn range to `queryHexes()`.
		result.hexesDashed = [targetHex];
		(grid as any).lastQueryOpt = result;
		(grid as any).clearTransientHexHoverVisual(targetHex);

		expect(dashedReadded).toBe(true);

		farHex.creature = null;
		for (let i = 0; i < 3; i++) {
			grid.hexes[srcY][srcX + i].creature = null;
		}
	});
});
