import { describe, expect, test } from '@jest/globals';

import {
	BOARD_DEPTH_SCALE_Y,
	LAYER_SPEC,
	createBoardLayersWithFactory,
	getDepthAtBand,
	rowDepthBase,
	sortLayerByDepth,
} from '../../game-display/layer';

type MockLayer = {
	name: string;
	parent: MockLayer | null;
	list: { depth?: number }[];
	setScale(x: number, y: number): void;
	scale: { x: number; y: number };
	x: number;
	y: number;
};

const createFactory = () => ({
	add: {
		group(parent?: MockLayer, name = ''): MockLayer {
			const layer: MockLayer = {
				name,
				parent: parent ?? null,
				list: [],
				setScale(x: number, y: number) {
					layer.scale.x = x;
					layer.scale.y = y;
				},
				scale: { x: 1, y: 1 },
				x: 0,
				y: 0,
			};
			if (parent) {
				parent.list.push(layer as unknown as { depth?: number });
			}
			return layer;
		},
	},
});

describe('board layer tree', () => {
	test('sibling order puts the smoke layer below the creatures it rises from', () => {
		const layers = createBoardLayersWithFactory<MockLayer>(createFactory());

		// `display` is the parent, so the render order of its children is the order
		// they appear in the list.
		const displayOrder = (layers.display.list as unknown as MockLayer[]).map((child) => child.name);

		expect(displayOrder).toEqual([
			'gridGroup',
			'dropGrp',
			'infernalSmokeGrp',
			'creaturesGrp',
			'healthIndicatorUiGrp',
			'trapOverGrp',
		]);
		expect(displayOrder.indexOf('infernalSmokeGrp')).toBeLessThan(
			displayOrder.indexOf('creaturesGrp'),
		);
	});

	test('the smoke layer is a child of the board, not of any creature layer', () => {
		const layers = createBoardLayersWithFactory<MockLayer>(createFactory());

		expect(layers.infernalSmokeGroup.parent).toBe(layers.display);
		expect(layers.infernalSmokeGroup.parent).not.toBe(layers.creatureGroup);
	});

	test('the grid and trap-over layers are squashed to fake the oblique view', () => {
		const layers = createBoardLayersWithFactory<MockLayer>(createFactory());

		expect(layers.gridGroup.scale.y).toBe(BOARD_DEPTH_SCALE_Y);
		expect(layers.trapOverGroup.scale.y).toBe(BOARD_DEPTH_SCALE_Y);
		// Everything else is unsquashed, so board-space positions need no fixup.
		expect(layers.creatureGroup.scale.y).toBe(1);
	});

	test('every layer is reachable and the spec has no dangling parent', () => {
		const layers = createBoardLayersWithFactory<MockLayer>(createFactory());

		for (const spec of LAYER_SPEC) {
			expect(layers[spec.name]).toBeDefined();
			if (spec.parent !== null) {
				expect(layers[spec.name].parent).toBe(layers[spec.parent]);
			}
		}
	});
});

describe('depth bands', () => {
	test('each row owns a 100-unit stride so lower rows draw in front', () => {
		expect(rowDepthBase(0)).toBe(0);
		expect(rowDepthBase(1)).toBe(100);
		expect(getDepthAtBand(2, 'UNITS')).toBe(240);
	});

	test('slots stay inside a band and never collide with the next one', () => {
		expect(getDepthAtBand(0, 'TRAP_VOLUMETRIC', 1)).toBe(91);
		expect(getDepthAtBand(0, 'TRAP_VOLUMETRIC')).toBeLessThan(getDepthAtBand(1, 'TRAP_GROUND'));
	});

	test('bands are ordered back to front', () => {
		const bands = ['TRAP_GROUND', 'EFFECT_UNDER_UNITS', 'UNITS', 'DROPS', 'TRAP_VOLUMETRIC'];
		const depths = bands.map((band, i) => getDepthAtBand(0, band as never, i));
		expect([...depths].sort((a, b) => a - b)).toEqual(depths);
	});
});

describe('sortLayerByDepth', () => {
	test('orders a layer ascending, so the lowest depth draws furthest back', () => {
		const layers = createBoardLayersWithFactory<MockLayer>(createFactory());
		const a = { depth: 140 };
		const b = { depth: 40 };
		const c = { depth: 85 };
		layers.creatureGroup.list.push(a, b, c);

		sortLayerByDepth(layers.creatureGroup);

		expect(layers.creatureGroup.list).toEqual([b, c, a]);
	});
});
