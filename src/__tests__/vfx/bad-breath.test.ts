import { describe, expect, jest, test } from '@jest/globals';
import type { Creature } from '../../creature';
import type Game from '../../game';
import { pushCloudAway, spawnBadBreathCloud } from '../../vfx/bad-breath';

type Cloud = Parameters<typeof pushCloudAway>[1];
type TestTween = {
	destination?: { x?: number; y?: number; alpha?: number };
	onComplete: { add: (callback: () => void) => void };
	to: (destination: TestTween['destination']) => TestTween;
	start: () => TestTween;
	complete: () => void;
};

function makeGame(creatureAt: (x: number, y: number) => unknown = () => undefined) {
	const tweens: TestTween[] = [];
	const sprites: Array<{ alpha: number; x: number; y: number; destroy: jest.Mock }> = [];
	return {
		tweens,
		sprites,
		gameEngine: {
			add: {
				sprite: () => {
					const sprite = {
						alpha: 1,
						x: 0,
						y: 0,
						destroy: jest.fn(),
						setOrigin: jest.fn(),
						setScale: jest.fn(),
					};
					sprites.push(sprite);
					return sprite;
				},
			},
			tween: () => {
				let onComplete: (() => void) | undefined;
				const tween: TestTween = {
					onComplete: {
						add: (callback) => {
							onComplete = callback;
						},
					},
					to: (destination) => {
						tween.destination = destination;
						return tween;
					},
					start: () => tween,
					complete: () => onComplete?.(),
				};
				tweens.push(tween);
				return tween;
			},
		},
		grid: {
			hexAt: (x: number, y: number) =>
				x >= 0 && x < 10 && y >= 0 && y < 10
					? { displayPos: { x: x * 90, y: y * 78 }, creature: creatureAt(x, y) }
					: undefined,
		},
	};
}

function makeCloud(x: number, y: number, ownerX: number, ownerY: number): Cloud {
	return {
		hex: { x, y },
		sprites: [],
		owner: { x: ownerX, y: ownerY } as Creature,
		upgraded: false,
		createdTurn: 0,
		turnLifetime: 3,
		initialCount: 0,
		damage: 10,
	};
}

describe('pushCloudAway', () => {
	test.each([
		{ cloud: [5, 4], expected: [6, 4] },
		{ cloud: [5, 5], expected: [5, 6] },
		{ cloud: [4, 5], expected: [3, 6] },
	])('moves a cloud outward from its inline or diagonal position', ({ cloud, expected }) => {
		const game = makeGame() as unknown as Game;
		const existing = makeCloud(cloud[0], cloud[1], 4, 4);

		expect(pushCloudAway(game, existing, [existing])).toBe(true);
		expect(existing.hex).toEqual({ x: expected[0], y: expected[1] });
	});

	test('pushes an occupied destination outward before moving the cloud into it', () => {
		const game = makeGame() as unknown as Game;
		const first = makeCloud(5, 4, 4, 4);
		const second = makeCloud(6, 4, 4, 4);
		const clouds = [first, second];

		expect(pushCloudAway(game, first, clouds)).toBe(true);
		expect(first.hex).toEqual({ x: 6, y: 4 });
		expect(second.hex).toEqual({ x: 7, y: 4 });
	});

	test('fades a cloud while it moves beyond the board', () => {
		const testGame = makeGame();
		const game = testGame as unknown as Game;
		const pushed = makeCloud(9, 4, 8, 4);
		pushed.upgraded = true;
		pushed.turnLifetime = 6;
		const destroy = jest.fn();
		pushed.sprites.push({ alpha: 1, x: 0, y: 0, destroy });
		const clouds = [pushed];

		expect(pushCloudAway(game, pushed, clouds)).toBe(true);
		expect(clouds).toEqual([]);
		expect(destroy).not.toHaveBeenCalled();
		expect(testGame.tweens).toHaveLength(1);
		expect(testGame.tweens[0].destination).toMatchObject({ x: 90, y: 0, alpha: 0 });

		testGame.tweens[0].complete();
		expect(destroy).toHaveBeenCalledTimes(1);
	});

	test('damages a creature when a pushed cloud bumps into its hex', () => {
		const takeDamage = jest.fn();
		const priest = { name: 'Dark Priest', dead: false, takeDamage };
		const testGame = makeGame((x, y) => (x === 6 && y === 4 ? priest : undefined));
		const game = testGame as unknown as Game;
		const cloud = makeCloud(5, 4, 4, 4);
		const clouds = [cloud];

		expect(pushCloudAway(game, cloud, clouds)).toBe(true);
		expect(clouds).toEqual([]);
		expect(takeDamage).toHaveBeenCalledTimes(1);
		expect(takeDamage.mock.calls[0][0]).toMatchObject({
			attacker: cloud.owner,
			damages: { poison: cloud.damage },
		});
	});

	test('waits for every emitted cloud particle before completing', () => {
		const testGame = makeGame();
		const onAnimationComplete = jest.fn();

		spawnBadBreathCloud(
			testGame as unknown as Game,
			{} as Creature,
			[{ hex: { x: 1, y: 1, displayPos: { x: 90, y: 78 } } }],
			false,
			onAnimationComplete,
		);

		expect(testGame.tweens).toHaveLength(testGame.sprites.length);
		expect(testGame.sprites.length).toBeGreaterThan(0);
		expect(onAnimationComplete).not.toHaveBeenCalled();

		for (const tween of testGame.tweens.slice(0, -1)) {
			tween.complete();
		}
		expect(onAnimationComplete).not.toHaveBeenCalled();

		testGame.tweens[testGame.tweens.length - 1].complete();
		expect(onAnimationComplete).toHaveBeenCalledTimes(1);
	});
});
