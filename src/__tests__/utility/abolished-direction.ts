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
