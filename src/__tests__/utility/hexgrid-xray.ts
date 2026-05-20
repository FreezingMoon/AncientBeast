import { describe, expect, jest, test } from '@jest/globals';

jest.mock('phaser-ce', () => ({}));
jest.mock('../../creature', () => ({
	Creature: class Creature {},
}));

import { Creature } from '../../creature';
import { HexGrid } from '../../utility/hexgrid';

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeCreature(hexagons: Array<{ ghostOverlap: jest.Mock }>) {
	const CreatureCtor = Creature as unknown as { new (): Creature };
	const creature = new CreatureCtor() as any;
	creature.hexagons = hexagons;
	creature.xray = jest.fn();
	return creature;
}

describe('HexGrid.xray', () => {
	test('checks every preview footprint hex for obstructing creatures', () => {
		const activeHex = { ghostOverlap: jest.fn() };
		const activeCreature = makeCreature([activeHex]);
		const otherCreature = makeCreature([]);
		const frontPreviewHex = { creature: undefined, ghostOverlap: jest.fn() };
		const backPreviewHex = { creature: undefined, ghostOverlap: jest.fn() };

		const grid = Object.create(HexGrid.prototype) as any;
		grid.game = {
			creatures: [activeCreature, otherCreature],
			activeCreature,
		};

		grid.xray(frontPreviewHex as never, [frontPreviewHex as never, backPreviewHex as never]);

		expect(frontPreviewHex.ghostOverlap).toHaveBeenCalledTimes(1);
		expect(backPreviewHex.ghostOverlap).toHaveBeenCalledTimes(1);
		expect(activeHex.ghostOverlap).toHaveBeenCalledWith(activeCreature);
		expect(activeCreature.xray).toHaveBeenLastCalledWith(false);
	});
});
