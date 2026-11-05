import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import type { Creature } from '../../creature';
import { createGameCanvasSurface } from '../../game-display/canvas-surface';
import { attachContagionVisual } from '../../vfx/contagion';

jest.mock('../../game-display/canvas-surface', () => ({
	createGameCanvasSurface: jest.fn(),
}));

describe('Contagion cardboard visuals', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	function testVisual() {
		const padding = 24;
		const outlineAlpha = 0.9;
		const auraAlpha = 0.78;
		const context = { clearRect: jest.fn() } as unknown as CanvasRenderingContext2D;
		const surface = {
			key: 'contagion-surface',
			width: 148,
			height: 248,
			canvas: {} as HTMLCanvasElement,
			ctx: context,
			drawTexture: jest.fn(),
			commit: jest.fn(),
			destroy: jest.fn(),
		};
		jest.mocked(createGameCanvasSurface).mockReturnValue(surface);

		const visual = {
			x: 0,
			y: 0,
			alpha: 0,
			rotation: 0,
			anchor: { set: jest.fn() },
			scale: { set: jest.fn() },
			destroy: jest.fn(),
		};
		const addSprite = jest.fn(() => visual);
		const cardboard = {
			key: 'Swampler',
			frame: { realWidth: 100, realHeight: 200 },
			anchor: { x: 0.5, y: 1 },
			scale: { x: -2, y: 3 },
			x: 40,
			y: 60,
			rotation: 0.2,
			alpha: 0.5,
		};
		const updateHooks: Array<() => void> = [];
		const creature = {
			sprite: cardboard,
			grp: { id: 'group' },
			creatureSprite: {
				addPostUpdateHook: jest.fn((hook: () => void) => updateHooks.push(hook)),
				removePostUpdateHook: jest.fn(),
			},
		};
		const game = {
			Phaser: { textures: { get: jest.fn(() => ({ getSourceImage: () => ({}) })) } },
			gameEngine: { add: { sprite: addSprite } },
		};

		const contagionVisual = attachContagionVisual(game as never, creature as unknown as Creature);
		const spawnedVisual = visual;
		expect(createGameCanvasSurface).toHaveBeenCalledWith(
			game,
			100 + padding * 2,
			200 + padding * 2,
		);
		expect(surface.drawTexture).toHaveBeenCalledTimes(2);
		expect(surface.drawTexture).toHaveBeenNthCalledWith(1, 'Swampler', padding, padding);
		expect(surface.drawTexture).toHaveBeenNthCalledWith(2, 'Swampler', padding, padding);
		expect(addSprite).toHaveBeenCalledWith(0, 0, 'contagion-surface', undefined, creature.grp);
		expect(spawnedVisual.anchor.set).toHaveBeenCalledWith(
			(padding + 50) / (100 + padding * 2),
			(padding + 200) / (200 + padding * 2),
		);
		expect(spawnedVisual.scale.set).toHaveBeenCalledWith(-2, 3);
		expect(spawnedVisual.alpha).toBe(0.5 * outlineAlpha);
		expect(spawnedVisual.rotation).toBe(0.2);

		cardboard.x = 75;
		updateHooks[0]();
		expect(spawnedVisual.x).toBe(75);

		contagionVisual.setContagious();
		expect(surface.drawTexture).toHaveBeenCalledTimes(4);
		expect(spawnedVisual.alpha).toBe(0.5 * auraAlpha);

		contagionVisual.remove();
		expect(creature.creatureSprite.removePostUpdateHook).toHaveBeenCalledWith(updateHooks[0]);
		expect(spawnedVisual.destroy).toHaveBeenCalledTimes(1);
		expect(surface.destroy).toHaveBeenCalledTimes(1);
	}

	test('creates a padded aura silhouette and follows its cardboard', () => testVisual());
});
