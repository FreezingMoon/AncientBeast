import { describe, expect, jest, test } from '@jest/globals';
import { getQueryFootprintHexes } from '../../utility/query_footprint';

type TestHex = {
	x: number;
	y: number;
	isWalkable: jest.Mock;
};

function buildGrid(width: number, height = 1) {
	const hexes: TestHex[][] = [];

	for (let y = 0; y < height; y++) {
		const row: TestHex[] = [];
		for (let x = 0; x < width; x++) {
			row.push({
				x,
				y,
				isWalkable: jest.fn((size: number) => x - size + 1 >= 0),
			});
		}
		hexes.push(row);
	}

	return { hexes };
}

describe('getQueryFootprintHexes', () => {
	test('returns every occupied hex for a non-flipped multi-hex preview', () => {
		const grid = buildGrid(10);
		const footprint = getQueryFootprintHexes(
			grid as never,
			grid.hexes[0][6] as never,
			3,
			false,
			12,
		);

		expect(footprint.map(({ x, y }) => [x, y])).toEqual([
			[6, 0],
			[5, 0],
			[4, 0],
		]);
		expect(grid.hexes[0][6].isWalkable).toHaveBeenCalledWith(3, 12);
	});

	test('offsets the footprint when the active player is flipped', () => {
		const grid = buildGrid(10);
		const footprint = getQueryFootprintHexes(grid as never, grid.hexes[0][6] as never, 3, true, 12);

		expect(footprint.map(({ x, y }) => [x, y])).toEqual([
			[8, 0],
			[7, 0],
			[6, 0],
		]);
		expect(grid.hexes[0][8].isWalkable).toHaveBeenCalledWith(3, 12);
	});
});
