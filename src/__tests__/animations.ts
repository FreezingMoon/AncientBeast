import { describe, expect, jest, test } from '@jest/globals';

jest.mock('pixi', () => ({}), { virtual: true });
jest.mock('p2', () => ({}), { virtual: true });
jest.mock('phaser-ce', () => ({}), { virtual: true });

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

describe('Animations bonfire spring layering', () => {
	test('demotes an elevated bonfire trap when another creature overlaps it on the same row', () => {
		const trapGroup = makeGroup();
		const trapOverGroup = makeGroup();
		const owner = makeCreature(1, 'Abolished', { left: 0, top: 0, right: 10, bottom: 10 });
		const mover = makeCreature(2, 'Dark Priest', { left: 20, top: 20, right: 40, bottom: 40 });
		const trapSprite = {
			exists: true,
			parent: trapOverGroup,
			worldPosition: { x: 20, y: 20 },
			getBounds: jest.fn(() => ({ left: 20, top: 20, right: 40, bottom: 40 })),
			position: { set: jest.fn() },
		};

		const trap = {
			id: 8,
			type: 'bonfire-spring',
			ownerCreature: owner,
			x: 4,
			y: 7,
			getVisualSprites: () => [trapSprite],
		};

		const game = {
			creatures: [owner, mover],
			traps: [trap],
			grid: {
				trapGroup,
				trapOverGroup,
			},
			Phaser: {
				world: {},
			},
		};

		const animations = new Animations(game as never);

		animations.syncAbolishedBonfireTrapLayers(owner as never);

		expect(trapGroup.add).toHaveBeenCalledTimes(1);
		expect(trapGroup.add).toHaveBeenCalledWith(trapSprite);
		expect(trapOverGroup.removeChild).toHaveBeenCalledTimes(1);
		expect(trapGroup.children).toContain(trapSprite);
		expect(trapOverGroup.children).not.toContain(trapSprite);
		expect(trapGroup.bringToTop).toHaveBeenCalledWith(trapSprite);
		expect(trapSprite.position.set).toHaveBeenCalledWith(12, 34);
	});
});
