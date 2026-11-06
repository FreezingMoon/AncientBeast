import { describe, expect, jest, test } from '@jest/globals';
import { animateBoomerang } from '../../phaser/boomerang';
import { HEX_HEIGHT_PX, HEX_WIDTH_PX } from '../../utility/const';
import { createSpriteMock } from '../../../test/sprite-mock';
import {
	AFTERIMAGE_ALPHA,
	AFTERIMAGE_LIFETIME_MS,
	AFTERIMAGE_RISE_PX,
	spawnProjectileVertigoTrail,
} from '../../vertigo';

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeFlight(left = false, replay = false, upgraded = true) {
	const start: any = { x: 7, y: 4, displayPos: { x: 675, y: 264 } };
	const direction = left ? -1 : 1;
	const hexes: any[] = [
		{ x: 7 + direction, y: 3, displayPos: { x: 675 + direction * 90, y: 205.5 } },
		{ x: 7 + direction * 5, y: 4, displayPos: { x: 675 + direction * 450, y: 264 } },
		{ x: 7 + direction, y: 5, displayPos: { x: 675 + direction * 90, y: 322.5 } },
	];
	const sprite = createSpriteMock({
		extra: { texture: { key: 'Headless - Boomerang' }, exists: true },
	});
	const timers: Array<{ delay: number; callback: () => void }> = [];
	const echoes: ReturnType<typeof createSpriteMock>[] = [];
	const fades: Array<{ props: Record<string, number>; duration: number; complete?: () => void }> =
		[];
	let flight: { progress: number };
	let update: () => void;
	let complete: () => void;
	const tween = {
		to: jest.fn().mockReturnThis(),
		onUpdateCallback: (callback: () => void) => {
			update = callback;
		},
		onComplete: {
			addOnce: (callback: () => void) => {
				complete = callback;
			},
		},
		start: jest.fn(),
	};
	const game: any = {
		replayMode: replay ? 'load' : undefined,
		grid: { creatureGroup: {} },
		gameEngine: {
			time: { add: (delay: number, callback: () => void) => timers.push({ delay, callback }) },
			add: {
				sprite: jest.fn((x: number, y: number, key: string) => {
					if (!echoes.length) {
						echoes.push(sprite);
						return sprite;
					}
					const echo = createSpriteMock({ x, y, key });
					echoes.push(echo);
					return echo;
				}),
			},
			tween: (target: { progress: number }) => {
				if ('alpha' in target) {
					const fade: (typeof fades)[number] = { props: {}, duration: 0 };
					fades.push(fade);
					return {
						to: (props: Record<string, number>, duration: number) => {
							fade.props = props;
							fade.duration = duration;
							return {
								onComplete: {
									add: (callback: () => void) => {
										fade.complete = callback;
									},
								},
							};
						},
					};
				}
				flight = target;
				return tween;
			},
		},
	};
	const onHit = jest.fn();
	const onComplete = jest.fn();
	animateBoomerang(game, start, hexes, onHit, onComplete, upgraded);
	return {
		sprite,
		start,
		hexes,
		game,
		onHit,
		onComplete,
		timers,
		echoes,
		fades,
		advance: (progress: number) => {
			flight.progress = progress;
			update();
		},
		finish: () => complete(),
	};
}

describe('Boomerang projectile', () => {
	test('regular boomerang keeps its flight without spawning vertigo', () => {
		const flight = makeFlight(false, false, false);
		expect(flight.timers).toHaveLength(0);
		flight.advance(0.5);
		expect(flight.onHit).toHaveBeenCalledTimes(2);
		flight.finish();
		expect(flight.onComplete).toHaveBeenCalledTimes(1);
		expect(flight.echoes).toHaveLength(1);
	});

	test('existing projectile trails still interpolate a straight path by default', () => {
		const flight = makeFlight();
		spawnProjectileVertigoTrail(
			flight.game,
			flight.sprite as any,
			{ x: 10, y: 20 },
			{ x: 110, y: 220 },
			100,
			0,
			Math.PI,
		);
		flight.advance(0.75);
		flight.timers[23].callback();
		const echo = flight.echoes[1];
		expect(echo.x).toBe(60);
		expect(echo.y).toBe(120);
		expect(echo.rotation).toBe(Math.PI / 2);
	});

	test.each([false, true])('vertigo copies follow the curved spinning sprite, left=%s', (left) => {
		const flight = makeFlight(left);
		expect(flight.timers).toHaveLength(22);
		flight.advance(0.25);
		flight.sprite.rotation = left ? -Math.PI * 2 : Math.PI * 2;
		flight.timers[5].callback();
		const echo = flight.echoes[1];
		expect(echo.x).toBe(flight.sprite.x);
		expect(echo.y).toBe(flight.sprite.y);
		expect(echo.rotation).toBe(flight.sprite.rotation);
		expect(echo.alpha).toBe(AFTERIMAGE_ALPHA);
		expect(echo.depth).toBe(flight.sprite.depth - 0.01);
		expect(flight.fades[0].duration).toBe(AFTERIMAGE_LIFETIME_MS);
		expect(flight.fades[0].props).toEqual({ alpha: 0, y: echo.y - AFTERIMAGE_RISE_PX });
		flight.fades[0].complete();
		expect(echo.destroy).toHaveBeenCalledTimes(1);
		flight.finish();
		flight.sprite.exists = false;
		flight.timers[21].callback();
		expect(flight.echoes).toHaveLength(2);
	});

	test.each([false, true])('orbits and spins in throw direction, left=%s', (left) => {
		const flight = makeFlight(left);
		const startX = flight.start.displayPos.x + HEX_WIDTH_PX / 2;
		const startY = flight.start.displayPos.y - 20;
		const direction = left ? -1 : 1;
		expect(flight.game.gameEngine.add.sprite).toHaveBeenCalledWith(
			startX,
			startY,
			'Headless - Boomerang',
			undefined,
			flight.game.grid.creatureGroup,
		);
		expect(flight.onHit).not.toHaveBeenCalled();

		flight.advance(0.25);
		expect(flight.sprite.x).toBeCloseTo(startX + direction * 225);
		expect(flight.sprite.y).toBeCloseTo(startY - HEX_HEIGHT_PX * 0.75);
		expect(flight.sprite.angle).toBe(direction * 360);
		expect(flight.onHit.mock.calls.map(([hex]) => hex)).toEqual([flight.hexes[0]]);

		flight.advance(0.5);
		expect(flight.sprite.x).toBeCloseTo(startX + direction * 450);
		expect(flight.sprite.y).toBeCloseTo(startY);
		expect(flight.onHit.mock.calls.map(([hex]) => hex)).toEqual(flight.hexes.slice(0, 2));

		flight.advance(0.75);
		expect(flight.sprite.y).toBeCloseTo(startY + HEX_HEIGHT_PX * 0.75);
		expect(flight.sprite.angle).toBe(direction * 1080);
		expect(flight.onComplete).not.toHaveBeenCalled();

		flight.finish();
		expect(flight.sprite.x).toBeCloseTo(startX);
		expect(flight.sprite.y).toBeCloseTo(startY);
		expect(flight.onHit.mock.calls.map(([hex]) => hex)).toEqual(flight.hexes);
		expect(flight.sprite.destroy).toHaveBeenCalledTimes(1);
		expect(flight.onComplete).toHaveBeenCalledTimes(1);
	});

	test('a skipped animation frame still triggers every crossed hex exactly once', () => {
		const flight = makeFlight();
		flight.advance(0.99);
		flight.advance(0.99);
		flight.finish();
		expect(flight.onHit.mock.calls.map(([hex]) => hex)).toEqual(flight.hexes);
	});

	test('fast replay resolves all hits without waiting for a visual tween', () => {
		const flight = makeFlight(false, true);
		expect(flight.onHit.mock.calls.map(([hex]) => hex)).toEqual(flight.hexes);
		expect(flight.onComplete).toHaveBeenCalledTimes(1);
		expect(flight.game.gameEngine.add.sprite).not.toHaveBeenCalled();
		expect(flight.timers).toHaveLength(0);
	});
});
