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

jest.mock('../../vfx/disruptor', () => ({
	spawnDisruptorBeam: jest.fn(),
}));

import loadDarkPriestAbilities from '../../abilities/Dark-Priest';
import { spawnDisruptorBeam } from '../../vfx/disruptor';
import type { CreatureDeathAnimationType } from '../../creature';

(globalThis as { Phaser?: unknown }).Phaser = {};

type MockHex = {
	x: number;
	y: number;
	pos: { x: number; y: number };
	reachable: boolean;
	setReachable: ReturnType<typeof jest.fn>;
	unsetReachable: ReturnType<typeof jest.fn>;
	isWalkable: ReturnType<typeof jest.fn>;
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

describe('Dark Priest Disruptor Beam activation', () => {
	test('defers impact and turn input until the scan is complete', () => {
		let finishScan: (() => void) | undefined;
		jest
			.mocked(spawnDisruptorBeam)
			.mockImplementation((_game, _caster, _target, _disintegrate, onComplete) => {
				finishScan = onComplete;
			});

		const queryMove = jest.fn();
		const caster = { player: { plasma: 3 } };
		const target = {
			size: 1,
			baseStats: { health: 100 },
			health: 70,
			dead: false,
			deathAnimationType: 'melt' as const,
			takeDamage: jest.fn(),
		};
		const game = {
			abilities: {} as Record<number, unknown[]>,
			activeCreature: { queryMove },
		};
		globalThis.G = game as never;
		loadDarkPriestAbilities(game as never);

		const baseAbility = game.abilities[0][2] as {
			activate: (target: unknown) => void;
		};
		const end = jest.fn();
		const ability = {
			...baseAbility,
			creature: caster,
			end,
			isUpgraded: () => false,
		};
		ability.activate.call(ability, target);

		expect(end).toHaveBeenCalledWith(false, true);
		expect(spawnDisruptorBeam).toHaveBeenCalledWith(
			game,
			caster,
			target,
			false,
			expect.any(Function),
		);
		expect(target.takeDamage).not.toHaveBeenCalled();
		expect(queryMove).not.toHaveBeenCalled();

		finishScan?.();

		expect(target.takeDamage).toHaveBeenCalledTimes(1);
		expect(target.deathAnimationType).toBe('melt');
		expect(queryMove).toHaveBeenCalledTimes(1);
	});

	test('marks fatal beam damage for the disintegration death animation', () => {
		let finishScan: (() => void) | undefined;
		jest
			.mocked(spawnDisruptorBeam)
			.mockImplementation((_game, _caster, _target, _disintegrate, onComplete) => {
				finishScan = onComplete;
			});

		const caster = { player: { plasma: 3 } };
		const target = {
			size: 1,
			baseStats: { health: 100 },
			health: 30,
			dead: false,
			deathAnimationType: undefined as CreatureDeathAnimationType | undefined,
			takeDamage: jest.fn(),
		};
		target.takeDamage.mockImplementation(() => {
			target.dead = true;
		});
		const game = {
			abilities: {} as Record<number, unknown[]>,
			activeCreature: { queryMove: jest.fn() },
		};
		globalThis.G = game as never;
		loadDarkPriestAbilities(game as never);

		const baseAbility = game.abilities[0][2] as {
			activate: (target: unknown) => void;
		};
		const ability = {
			...baseAbility,
			creature: caster,
			end: jest.fn(),
			isUpgraded: () => false,
		};
		ability.activate.call(ability, target);
		finishScan?.();

		expect(target.deathAnimationType).toBe('disintegrate');
	});
});
