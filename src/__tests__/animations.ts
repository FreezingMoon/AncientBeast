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

describe('Animations', () => {
	test('class is importable', () => {
		expect(typeof Animations).toBe('function');
	});
});
