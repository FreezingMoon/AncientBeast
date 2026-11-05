import { describe, expect, jest, test } from '@jest/globals';

jest.mock('pixi', () => ({}), { virtual: true });
jest.mock('p2', () => ({}), { virtual: true });

// The real Phaser 4 bundle boots a renderer at import time, which jsdom cannot
// satisfy; only the value exports animations.ts imports are provided here.
jest.mock('phaser', () => ({
	BlendModes: { ADD: 1, NORMAL: 0, MULTIPLY: 2, SCREEN: 3 },
	Math: {
		Vector2: class Vector2Mock {
			x = 0;
			y = 0;
			constructor(x = 0, y = 0) {
				this.x = x;
				this.y = y;
			}
		},
	},
	GameObjects: {
		Polygon: class PolygonGameObjectMock {
			constructor(_scene?: unknown, _x?: number, _y?: number, points?: unknown) {
				(this as any).points = points ?? [];
			}
			contains() {
				return true;
			}
		},
	},

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
