import { beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.mock('jquery', () => ({
	extend: (...args: unknown[]) => Object.assign({}, ...args),
}));

jest.mock('../../game', () => ({
	__esModule: true,
	default: class GameMock {},
}));

jest.mock('../../utility/hex', () => ({
	__esModule: true,
	Hex: class HexMock {},
}));

jest.mock('../../creature', () => ({
	Creature: class CreatureMock {
		sprite = { alpha: 1 };
		cleanHex = jest.fn();
	},
}));

import loadDarkPriestAbilities from '../../abilities/Dark-Priest';
import { HexGrid } from '../../utility/hexgrid';

(globalThis as { Phaser?: unknown }).Phaser = {};

type MockHex = {
	x: number;
	y: number;
	pos: { x: number; y: number };
	reachable: boolean;
	setReachable: ReturnType<typeof jest.fn>;
	unsetReachable: ReturnType<typeof jest.fn>;
	isWalkable: ReturnType<typeof jest.fn>;
	creature?: object;
};

const makeHex = (x: number, y: number, reachable = true): MockHex => ({
	x,
	y,
	pos: { x, y },
	reachable,
	setReachable: jest.fn(function (this: MockHex) {
		this.reachable = true;
	}),
	unsetReachable: jest.fn(function (this: MockHex) {
		this.reachable = false;
	}),
	isWalkable: jest.fn(() => true),
});

describe('Dark Priest materialize query preview guards', () => {
	let spawnHex: MockHex;
	let otherHex: MockHex;
	let queryHexes: ReturnType<typeof jest.fn>;
	let previewCreature: ReturnType<typeof jest.fn>;
	let ability: {
		materialize: (creatureType: string) => void;
		creature: {
			id: number;
			player: { id: number; flipped: boolean; summonCreaturesWithMaterializationSickness: boolean };
			hexagons: [{ adjacentHex: (distance: number) => MockHex[] }];
		};
		isUpgraded: () => boolean;
	};

	beforeEach(() => {
		spawnHex = makeHex(5, 4);
		otherHex = makeHex(9, 4, false);
		queryHexes = jest.fn();
		previewCreature = jest.fn();

		const game = {
			abilities: {} as Record<number, unknown[]>,
			updateQueueDisplay: jest.fn(),
			retrieveCreatureStats: jest.fn(() => ({
				name: 'Test Unit',
				type: 'A1',
				size: 1,
				level: 1,
				display: {
					'offset-x': 0,
					'offset-y': 0,
				},
			})),
			grid: {
				forEachHex: jest.fn((callback: (hex: MockHex) => void) => {
					[spawnHex, otherHex].forEach(callback);
				}),
				queryHexes,
				previewCreature,
			},
			activeCreature: {
				queryMove: jest.fn(),
			},
			gameEngine: {
				add: {
					graphics: () => ({}),
					bitmapData: () => ({}),
					group: () => ({ children: [], add: () => {}, addAt: () => {}, remove: () => {} }),
					tileSprite: () => ({}),
				},
				tween: () => ({
					to: () => ({
						start: () => ({ stop: () => ({}), onComplete: { add: () => {}, addOnce: () => {} } }),
						stop: () => ({}),
						onComplete: { add: () => {}, addOnce: () => {} },
					}),
					start: () => ({ stop: () => ({}), onComplete: { add: () => {}, addOnce: () => {} } }),
					stop: () => ({}),
					onComplete: { add: () => {}, addOnce: () => {} },
				}),
			},
		};

		globalThis.G = game as never;
		loadDarkPriestAbilities(game as never);

		const baseAbility = game.abilities[0][3] as unknown;
		ability = {
			...(baseAbility as object),
			materialize:
				(baseAbility as { materialize?: (creatureType: string) => void })?.materialize || jest.fn(),
			creature: {
				id: 0,
				player: {
					id: 0,
					flipped: false,
					summonCreaturesWithMaterializationSickness: true,
				},
				hexagons: [
					{
						adjacentHex: jest.fn(() => [spawnHex]),
					},
				],
			},
			isUpgraded: () => false,
		};
	});

	test('materialize hover previews only in-range spawn hexes', () => {
		ability.materialize('A1');

		expect(queryHexes).toHaveBeenCalledTimes(1);
		const queryArgs = queryHexes.mock.calls[0][0] as {
			args: { creature: string; spawnRange: MockHex[] };
			fnOnSelect: (hex: MockHex, args: { creature: string; spawnRange: MockHex[] }) => void;
		};

		queryArgs.fnOnSelect(spawnHex, queryArgs.args);
		expect(previewCreature).toHaveBeenCalledWith(
			spawnHex.pos,
			expect.any(Object),
			ability.creature.player,
		);

		previewCreature.mockClear();
		queryArgs.fnOnSelect(otherHex, queryArgs.args);
		expect(previewCreature).not.toHaveBeenCalled();
	});

	test.each(
		[1, 2, 3].flatMap((size) =>
			[false, true].flatMap((flipped) =>
				[false, true].map((upgraded) => ({ size, flipped, upgraded })),
			),
		),
	)('shows occupied range for size $size, flipped $flipped, upgraded $upgraded', (options) => {
		const game = globalThis.G as any;
		const row = Array.from({ length: 9 }, (_, x) => makeHex(x, 0));
		// Both cells belong to the same creature; only its in-range cells matter.
		row[1].creature = {};
		row[2].creature = row[1].creature;
		row[6].creature = {};
		row[7].creature = row[6].creature;
		row.forEach((hex) => {
			hex.isWalkable.mockImplementation((size: number) =>
				Array.from({ length: size }, (_, i) => row[hex.x - i]).every(
					(cell) => cell && cell.reachable && !cell.creature,
				),
			);
		});
		game.grid.forEachHex.mockImplementation((fn: (hex: MockHex) => void) => row.forEach(fn));
		game.grid.hexes = [row];
		game.grid.hexExists = ({ x, y }: { x: number; y: number }) => y === 0 && x >= 0 && x < 9;
		game.retrieveCreatureStats.mockReturnValue({ size: options.size, level: 1 });
		const adjacentHex = jest.fn((radius: number) => row.slice(0, radius + 1));
		ability.creature.hexagons[0].adjacentHex = adjacentHex;
		ability.creature.player.flipped = options.flipped;
		ability.isUpgraded = () => options.upgraded;

		ability.materialize('A1');
		const query = queryHexes.mock.calls[0][0] as any;
		expect(adjacentHex).toHaveBeenCalledWith(options.upgraded ? 6 : 4);
		expect(query.hexesDashed).toEqual(
			options.upgraded ? [row[1], row[2], row[6]] : [row[1], row[2]],
		);
		// At the left edge only a size-one creature fits at x=0. Empty cells
		// beside blockers are not incorrectly dashed just because a unit cannot fit.
		const expectedTargets = options.size === 1 ? [row[0]] : [];
		if (options.upgraded || options.size < 3) {
			expectedTargets.push(...row.slice(3, options.upgraded ? 6 : 5));
		}
		expect(new Set(query.hexes)).toEqual(new Set(expectedTargets));
		expect(query.args.spawnRange).toBe(query.hexes);
		expect(query.size).toBe(options.size);
		expect(query.flipped).toBe(options.flipped);
		query.fnOnSelect(row[1], query.args);
		expect(previewCreature).not.toHaveBeenCalled();

		// Exercise the real query renderer and its normal transition to another
		// query: dashed cells remain unselectable and do not leak into movement.
		const dashed = new Set<MockHex>();
		row.forEach((hex) => {
			Object.assign(hex, {
				displayVisualState: (state: string) => {
					if (state === 'dashed') dashed.add(hex);
				},
				cleanDisplayVisualState: (state: string) => {
					if (state === 'dashed') dashed.delete(hex);
				},
				overlayVisualState: jest.fn(),
				unsetNotTarget: jest.fn(),
			});
		});
		Object.assign(game.grid, {
			game,
			updateDisplay: jest.fn(),
			refreshHoverState: jest.fn(),
			queryGeneration: 0,
		});
		HexGrid.prototype.queryHexes.call(game.grid, query);
		expect([...dashed]).toEqual(query.hexesDashed);
		expect(row.filter((hex) => hex.reachable)).toEqual(expectedTargets);
		game.activeCreature.queryMove.mockImplementation(() =>
			HexGrid.prototype.queryHexes.call(game.grid, { hexes: [] }),
		);
		query.fnOnCancel();
		expect(dashed.size).toBe(0);
	});
});

describe('Godlet Printer activation leading to the dash view', () => {
	test('starts a fresh random unit on every usable activation', () => {
		const toggleDash = jest.fn();
		const ui = {
			materializeToggled: false,
			lastViewedCreature: 'A1',
			toggleDash,
		};

		const game = {
			abilities: {} as Record<number, unknown[]>,
			UI: ui,
		};

		globalThis.G = game as never;
		loadDarkPriestAbilities(game as never);

		const godletPrinter = game.abilities[0][3] as unknown as { query: () => void };

		// First activation of the round.
		godletPrinter.query();
		expect(toggleDash).toHaveBeenCalledWith(true);
		expect(ui.materializeToggled).toBe(true);
		expect(ui.lastViewedCreature).toBe('');

		// The first unit has been materialized, but the round still allows
		// another one (e.g. cooldowns disabled), so the remembered unit must not
		// be restored on the next activation.
		ui.lastViewedCreature = 'A1';

		godletPrinter.query();
		expect(toggleDash).toHaveBeenCalledTimes(2);
		expect(ui.lastViewedCreature).toBe('');
	});
});

describe('Dark Priest Plasma Field reactions', () => {
	test('consumes one plasma point and counters each adjacent hit while shielded', () => {
		const runHits = (initialPlasma: number, hitCount: number) => {
			const counterTarget = {
				id: 39,
				takeDamage: jest.fn(),
			};
			const priest = {
				id: 0,
				player: { plasma: initialPlasma },
				protectedFromFatigue: false,
				burstPlasmaField: jest.fn(),
				updateHealth: jest.fn(),
			};
			const game = {
				abilities: {} as Record<number, unknown[]>,
				activeCreature: counterTarget,
				Phaser: { camera: { shake: jest.fn(), SHAKE_HORIZONTAL: 0 } },
				log: jest.fn(),
				gameEngine: {
					add: {
						graphics: () => ({}),
						bitmapData: () => ({}),
						group: () => ({ children: [], add: () => {}, addAt: () => {}, remove: () => {} }),
						tileSprite: () => ({}),
					},
					tween: () => ({
						to: () => ({
							start: () => ({ stop: () => ({}), onComplete: { add: () => {}, addOnce: () => {} } }),
							stop: () => ({}),
							onComplete: { add: () => {}, addOnce: () => {} },
						}),
						start: () => ({ stop: () => ({}), onComplete: { add: () => {}, addOnce: () => {} } }),
						stop: () => ({}),
						onComplete: { add: () => {}, addOnce: () => {} },
					}),
				},
			};

			globalThis.G = game as never;
			loadDarkPriestAbilities(game as never);

			type AbilityHook = (this: unknown, ...args: unknown[]) => unknown;
			const baseAbility = game.abilities[0][0] as {
				require: AbilityHook;
				activate: AbilityHook;
			};
			const plasmaField = {
				...baseAbility,
				creature: priest,
				game,
				isUpgraded: () => true,
				testRequirements: () => priest.player.plasma > 0,
				end: jest.fn(),
			};

			for (let hit = 0; hit < hitCount; hit++) {
				const damage = {
					melee: true,
					counter: false,
					damages: { slash: 10 },
					effects: [],
				};
				if (baseAbility.require.call(plasmaField)) {
					baseAbility.activate.call(plasmaField, damage);
				}
			}

			return { plasma: priest.player.plasma, counters: counterTarget.takeDamage.mock.calls.length };
		};

		expect(runHits(2, 2)).toEqual({ plasma: 0, counters: 2 });
		expect(runHits(1, 2)).toEqual({ plasma: 0, counters: 1 });
	});
});
