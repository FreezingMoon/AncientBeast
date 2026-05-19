import { describe, expect, jest, test } from '@jest/globals';

jest.mock('pixi', () => ({}), { virtual: true });
jest.mock('p2', () => ({}), { virtual: true });
jest.mock('phaser-ce', () => ({
	Point: class PointMock {},
	Polygon: class PolygonMock {},
	default: class PhaserMock {},
}));

jest.mock('../game', () => ({
	__esModule: true,
	default: class GameMock {},
}));

jest.mock('../creature', () => ({
	__esModule: true,
	Creature: class CreatureMock {},
}));

jest.mock('../shader', () => ({
	getEffectShader: jest.fn(),
	advanceShaderTime: jest.fn(),
}));

jest.mock('../utility/bitmapUtils', () => ({
	extractTextureFrameInfo: jest.fn(),
	createBitmapDataFromTexture: jest.fn(),
}));

import { Animations } from '../animations';
import { Creature } from '../creature';

type Bounds = {
	left: number;
	top: number;
	right: number;
	bottom: number;
};

const makeCreature = (id: number, name: string, bounds: Bounds) => {
	const creature = Object.assign(Object.create(Creature.prototype), {
		id,
		name,
		x: 4,
		y: 7,
		size: 1,
		dead: false,
		isXrayed: false,
		hexagons: [{ x: 4, y: 7 }],
		sprite: {
			getBounds: jest.fn(() => bounds),
		},
	});

	return creature as Creature & { sprite: { getBounds: jest.Mock } };
};

const makeGroup = () => {
	const group = {
		children: [] as unknown[],
		add: jest.fn((sprite: { parent?: unknown }) => {
			group.children.push(sprite);
			sprite.parent = group;
		}),
		removeChild: jest.fn((sprite: unknown) => {
			group.children = group.children.filter((child) => child !== sprite);
		}),
		bringToTop: jest.fn(),
		toLocal: jest.fn(() => ({ x: 12, y: 34 })),
	};

	return group;
};
