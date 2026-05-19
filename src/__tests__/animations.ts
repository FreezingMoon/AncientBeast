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

describe('Animations bonfire spring layering', () => {
	test('keeps trap elevated when another creature is on the same row but not on the trap hex', () => {
		const trapGroup = makeGroup();
		const trapOverGroup = makeGroup();
		const owner = makeCreature(1, 'Abolished', { left: 0, top: 0, right: 10, bottom: 10 });
		const mover = makeCreature(2, 'Dark Priest', { left: 20, top: 20, right: 40, bottom: 40 });
		mover.y = 7;
		mover.hexagons = [{ x: 6, y: 7 }] as never; // same row, different hex
		const trapSprite = {
			exists: true,
			parent: trapOverGroup,
			worldPosition: { x: 20, y: 20 },
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
			grid: { trapGroup, trapOverGroup },
			Phaser: { world: {} },
		};

		const animations = new Animations(game as never);
		animations.syncAbolishedBonfireTrapLayers(owner as never);

		expect(trapGroup.add).toHaveBeenCalledTimes(0);
		expect(trapOverGroup.removeChild).toHaveBeenCalledTimes(0);
		expect(trapOverGroup.bringToTop).toHaveBeenCalledWith(trapSprite);
	});

	test('demotes trap when owner stands on it and a lower-row creature is within 1 hex', () => {
		const trapGroup = makeGroup();
		const trapOverGroup = makeGroup();
		const owner = makeCreature(1, 'Abolished', { left: 0, top: 0, right: 10, bottom: 10 });
		const mover = makeCreature(2, 'Dark Priest', { left: 20, top: 20, right: 40, bottom: 40 });
		mover.y = 8;
		mover.hexagons = [{ x: 4, y: 8 }] as never; // row y+1, same x
		const trapSprite = {
			exists: true,
			parent: trapOverGroup,
			worldPosition: { x: 20, y: 20 },
			position: { set: jest.fn() },
		};

		const trap = {
			id: 10,
			type: 'bonfire-spring',
			ownerCreature: owner,
			x: 4,
			y: 7,
			getVisualSprites: () => [trapSprite],
		};

		const game = {
			creatures: [owner, mover],
			traps: [trap],
			grid: { trapGroup, trapOverGroup },
			Phaser: { world: {} },
		};

		const animations = new Animations(game as never);
		animations.syncAbolishedBonfireTrapLayers(owner as never);

		expect(trapGroup.add).toHaveBeenCalledWith(trapSprite);
		expect(trapOverGroup.removeChild).toHaveBeenCalledTimes(1);
		expect(trapGroup.children).toContain(trapSprite);
		expect(trapGroup.bringToTop).toHaveBeenCalledWith(trapSprite);
	});

	test('keeps trap elevated when lower-row creature is more than 1 hex away', () => {
		const trapGroup = makeGroup();
		const trapOverGroup = makeGroup();
		const owner = makeCreature(1, 'Abolished', { left: 0, top: 0, right: 10, bottom: 10 });
		const mover = makeCreature(2, 'Dark Priest', { left: 0, top: 0, right: 10, bottom: 10 });
		mover.y = 8;
		mover.hexagons = [{ x: 9, y: 8 }] as never; // row y+1 but far away (dx=5)
		const trapSprite = {
			exists: true,
			parent: trapOverGroup,
			worldPosition: { x: 20, y: 20 },
			position: { set: jest.fn() },
		};

		const trap = {
			id: 11,
			type: 'bonfire-spring',
			ownerCreature: owner,
			x: 4,
			y: 7,
			getVisualSprites: () => [trapSprite],
		};

		const game = {
			creatures: [owner, mover],
			traps: [trap],
			grid: { trapGroup, trapOverGroup },
			Phaser: { world: {} },
		};

		const animations = new Animations(game as never);
		animations.syncAbolishedBonfireTrapLayers(owner as never);

		expect(trapGroup.add).toHaveBeenCalledTimes(0);
		expect(trapOverGroup.removeChild).toHaveBeenCalledTimes(0);
		expect(trapOverGroup.bringToTop).toHaveBeenCalledWith(trapSprite);
	});

	test('demotes trap when owner stands on it and another creature is two rows lower within 1 hex', () => {
		const trapGroup = makeGroup();
		const trapOverGroup = makeGroup();
		const owner = makeCreature(1, 'Abolished', { left: 0, top: 0, right: 10, bottom: 10 });
		const mover = makeCreature(2, 'Dark Priest', { left: 20, top: 20, right: 40, bottom: 40 });
		mover.y = 9;
		mover.hexagons = [{ x: 5, y: 9 }] as never; // lower row and horizontally close
		const trapSprite = {
			exists: true,
			parent: trapOverGroup,
			worldPosition: { x: 20, y: 20 },
			position: { set: jest.fn() },
		};

		const trap = {
			id: 12,
			type: 'bonfire-spring',
			ownerCreature: owner,
			x: 4,
			y: 7,
			getVisualSprites: () => [trapSprite],
		};

		const game = {
			creatures: [owner, mover],
			traps: [trap],
			grid: { trapGroup, trapOverGroup },
			Phaser: { world: {} },
		};

		const animations = new Animations(game as never);
		animations.syncAbolishedBonfireTrapLayers(owner as never);

		expect(trapGroup.add).toHaveBeenCalledWith(trapSprite);
		expect(trapOverGroup.removeChild).toHaveBeenCalledTimes(1);
		expect(trapGroup.bringToTop).toHaveBeenCalledWith(trapSprite);
	});

	test('keeps an elevated bonfire trap above when another creature occupies the trap hex', () => {
		const trapGroup = makeGroup();
		const trapOverGroup = makeGroup();
		const owner = makeCreature(1, 'Abolished', { left: 0, top: 0, right: 10, bottom: 10 });
		const mover = makeCreature(2, 'Dark Priest', { left: 200, top: 200, right: 240, bottom: 240 });
		mover.hexagons = [{ x: 4, y: 7 }] as never;

		const trapSprite = {
			exists: true,
			parent: trapOverGroup,
			worldPosition: { x: 20, y: 20 },
			getBounds: jest.fn(() => ({ left: 20, top: 20, right: 40, bottom: 40 })),
			position: { set: jest.fn() },
		};

		const trap = {
			id: 9,
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

		expect(trapGroup.add).toHaveBeenCalledTimes(0);
		expect(trapOverGroup.removeChild).toHaveBeenCalledTimes(0);
		expect(trapOverGroup.bringToTop).toHaveBeenCalledWith(trapSprite);
	});
});
