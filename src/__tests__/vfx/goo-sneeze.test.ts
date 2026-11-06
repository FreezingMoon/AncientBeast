import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import type { Creature } from '../../creature';
import type Game from '../../game';
import { createGameCanvasSurface } from '../../game-display/canvas-surface';
import { spawnGooSneeze } from '../../vfx/goo-sneeze';

jest.mock('../../game-display/canvas-surface', () => ({
	createGameCanvasSurface: jest.fn(),
}));

describe('spawnGooSneeze', () => {
	const gradient = { addColorStop: jest.fn() };
	const context = {
		createRadialGradient: jest.fn(() => gradient),
		beginPath: jest.fn(),
		arc: jest.fn(),
		ellipse: jest.fn(),
		fill: jest.fn(),
		stroke: jest.fn(),
	};
	const surface = {
		key: 'goo-sneeze',
		ctx: context,
		commit: jest.fn(),
		destroy: jest.fn(),
	};

	beforeEach(() => {
		jest.clearAllMocks();
		(createGameCanvasSurface as jest.Mock).mockReturnValue(surface);
	});

	test('draws a shaded bubble cluster and applies impact only when the leading bubble lands', () => {
		let onComplete: (() => void) | undefined;
		const sprite = {
			x: 0,
			y: 0,
			rotation: 0,
			anchor: { set: jest.fn() },
			destroy: jest.fn(),
		};
		const tween = {
			to: jest.fn().mockReturnThis(),
			start: jest.fn().mockReturnThis(),
			onComplete: { add: jest.fn((callback: () => void) => (onComplete = callback)) },
		};
		const game = {
			gameEngine: {
				add: { sprite: jest.fn(() => sprite) },
				tween: jest.fn(() => tween),
			},
			grid: { creatureGroup: {} },
		};
		const creature = {
			sprite: {
				x: 0,
				y: 0,
				anchor: { x: 0.5, y: 0.5 },
				scale: { x: 1, y: 1 },
				frame: { realWidth: 100, realHeight: 100 },
			},
			grp: { x: 10, y: 20 },
		};
		const targetHex = { x: 4, y: 3, displayPos: { x: 300, y: 200 } };
		const onImpact = jest.fn();

		spawnGooSneeze(game as unknown as Game, creature as unknown as Creature, targetHex, onImpact);

		expect(context.arc).toHaveBeenCalledTimes(6);
		expect(context.arc).toHaveBeenLastCalledWith(83, 32, 23, 0, Math.PI * 2);
		expect(context.ellipse).toHaveBeenCalledTimes(6);
		expect(surface.commit).toHaveBeenCalledTimes(1);
		expect(sprite.anchor.set).toHaveBeenCalledWith(0, 0.5);
		const deltaX = 338;
		const deltaY = 180;
		const distance = Math.hypot(deltaX, deltaY);
		expect(sprite.rotation).toBeCloseTo(Math.atan2(deltaY, deltaX));
		expect(tween.to).toHaveBeenCalledWith(
			expect.objectContaining({
				x: expect.closeTo(345 - (83 * deltaX) / distance),
				y: expect.closeTo(193 - (83 * deltaY) / distance),
				alpha: 0.92,
			}),
			expect.any(Number),
			expect.any(Function),
		);
		expect(onImpact).not.toHaveBeenCalled();

		onComplete?.();

		expect(sprite.destroy).toHaveBeenCalledTimes(1);
		expect(surface.destroy).toHaveBeenCalledTimes(1);
		expect(onImpact).toHaveBeenCalledTimes(1);
	});

	test('keeps the projectile at a constant height above ground on diagonal-up shots', () => {
		const sprite = {
			x: 0,
			y: 0,
			rotation: 0,
			anchor: { set: jest.fn() },
			destroy: jest.fn(),
		};
		const tween = {
			to: jest.fn().mockReturnThis(),
			start: jest.fn().mockReturnThis(),
			onComplete: { add: jest.fn() },
		};
		const game = {
			gameEngine: {
				add: { sprite: jest.fn(() => sprite) },
				tween: jest.fn(() => tween),
			},
			grid: { creatureGroup: {} },
		};
		const creature = {
			sprite: {
				x: 0,
				y: 0,
				anchor: { x: 0.5, y: 0.5 },
				scale: { x: 1, y: 1 },
				frame: { realWidth: 100, realHeight: 100 },
			},
			grp: { x: 10, y: 300 },
		};

		spawnGooSneeze(
			game as unknown as Game,
			creature as unknown as Creature,
			{ x: 4, y: 1, displayPos: { x: 300, y: 80 } },
			jest.fn(),
		);

		const deltaX = 338;
		const deltaY = -220;
		const distance = Math.hypot(deltaX, deltaY);
		expect(sprite.rotation).toBeCloseTo(Math.atan2(deltaY, deltaX));
		expect(tween.to).toHaveBeenCalledWith(
			expect.objectContaining({
				x: expect.closeTo(345 - (83 * deltaX) / distance),
				y: expect.closeTo(73 - (83 * deltaY) / distance),
			}),
			expect.any(Number),
			expect.any(Function),
		);
	});

	test('applies impact immediately when rendering is unavailable', () => {
		const onImpact = jest.fn();

		spawnGooSneeze({} as Game, {} as Creature, { x: 1, y: 1 }, onImpact);

		expect(onImpact).toHaveBeenCalledTimes(1);
	});
});
