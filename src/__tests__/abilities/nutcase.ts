import { describe, expect, jest, test } from '@jest/globals';

jest.mock('phaser', () =>
	(
		jest.requireActual('../../../test/phaser-mock') as typeof import('../../../test/phaser-mock')
	).createPhaserMock(),
);
jest.mock('../../game-display/camera', () => ({ shakeBoard: jest.fn() }));

import loadNutcaseAbilities from '../../abilities/Nutcase';
import { Creature } from '../../creature';

describe('Nutcase Fishing Hook', () => {
	test.each([
		[true, true],
		[true, false],
		[false, true],
		[false, false],
	])(
		'refreshes the whole footprint after both moves (target in front: %s, Nutcase finishes first: %s)',
		(targetInFront, nutcaseFirst) => {
			type TestHex = { x: number; y: number; creature?: unknown };
			const hexes: TestHex[][] = [Array.from({ length: 12 }, (_, x) => ({ x, y: 0 }))];
			const game = {
				abilities: {} as Record<number, { activate(target: unknown): void }[]>,
				registerSnapshotEffectBehavior: jest.fn(),
				grid: { hexes },
				activeCreature: { queryMove: jest.fn() },
			};

			function makeCreature(x: number, size: number) {
				let completeMove: () => void = () => {
					throw new Error('Movement has not started');
				};
				const creature = {
					x,
					y: 0,
					size,
					game,
					hexagons: [] as TestHex[],
					queryMove: game.activeCreature.queryMove,
					updateHex: jest.fn(() => Creature.prototype.updateHex.call(creature as never)),
					moveTo: jest.fn((hex: TestHex, opts: { callback(): void }) => {
						Creature.prototype.cleanHex.call(creature as never);
						completeMove = () => {
							creature.x = hex.x;
							creature.y = hex.y;
							creature.updateHex();
							opts.callback();
						};
					}),
					takeDamage: jest.fn(() => ({ kill: false, damageObj: { status: 'Shielded' } })),
					finishMove: () => completeMove(),
				};
				creature.updateHex();
				return creature;
			}

			const nutcase = makeCreature(targetInFront ? 3 : 8, 2);
			const priest = makeCreature(targetInFront ? 8 : 3, 1);
			loadNutcaseAbilities(game as never);
			const end = jest.fn();
			const ability = {
				...game.abilities[40][3],
				creature: nutcase,
				damages: { pierce: 10 },
				end,
			};
			game.activeCreature.queryMove.mockImplementation(() => {
				expect(priest.takeDamage).toHaveBeenCalledTimes(1);
				expect(nutcase.hexagons).toHaveLength(2);
				for (const hex of nutcase.hexagons) {
					expect(hex.creature).toBe(nutcase);
				}
				expect(priest.hexagons[0].creature).toBe(priest);
			});

			ability.activate(priest);
			expect(end).toHaveBeenCalledWith(false, true);
			expect(game.activeCreature.queryMove).not.toHaveBeenCalled();
			const first = nutcaseFirst ? nutcase : priest;
			const second = nutcaseFirst ? priest : nutcase;
			first.finishMove();
			expect(game.activeCreature.queryMove).not.toHaveBeenCalled();
			second.finishMove();

			expect(game.activeCreature.queryMove).toHaveBeenCalledTimes(1);
			expect(nutcase.x).toBe(targetInFront ? 8 : 4);
			expect(priest.x).toBe(targetInFront ? 2 : 8);
			expect(nutcase.moveTo).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ ignorePath: true, ignoreMovementPoint: true }),
			);
			expect(priest.moveTo).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({
					ignorePath: true,
					ignoreMovementPoint: true,
					afterimages: true,
				}),
			);
		},
	);
});
