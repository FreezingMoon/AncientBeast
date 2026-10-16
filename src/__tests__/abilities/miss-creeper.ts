import { beforeEach, describe, expect, jest, test } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-explicit-any */

// The real Phaser bundle needs a canvas context at import time, which jsdom
// does not provide.
jest.mock('phaser', () =>
	(
		jest.requireActual('../../../test/phaser-mock') as typeof import('../../../test/phaser-mock')
	).createPhaserMock(),
);

jest.mock('../../damage', () => ({
	Damage: class DamageMock {
		attacker: unknown;
		damages: Record<string, number>;
		area: number;
		constructor(attacker: unknown, damages: Record<string, number>, area: number) {
			this.attacker = attacker;
			this.damages = damages;
			this.area = area;
		}
	},
}));

jest.mock('../../effect', () => ({
	Effect: class EffectMock {
		name: string;
		owner: unknown;
		target: unknown;
		trigger: string;
		creationTurn: number;
		effectFn: (...args: unknown[]) => void = () => {};
		alterations: Record<string, unknown> = {};
		deleteTrigger = 'onStartOfRound';
		turnLifetime = 0;
		stackable = true;
		deleteOnOwnerDeath = false;
		isDeleted = false;
		deleteEffect = jest.fn(() => {
			this.isDeleted = true;
		});

		constructor(
			name: string,
			owner: unknown,
			target: unknown,
			trigger: string,
			optArgs: Record<string, unknown> = {},
		) {
			this.name = name;
			this.owner = owner;
			this.target = target;
			this.trigger = trigger;
			Object.assign(this, optArgs);
		}
	},
}));

jest.mock('../../creature', () => {
	class CreatureMock {
		id: number;
		team: number;
		type: string;
		name: string;
		health: number;
		stats: { health: number; energy?: number; moveable?: boolean };
		x: number;
		y: number;
		size: number;
		player: { id: number; flipped: boolean; creatures: unknown[] };
		dead = false;
		temp = false;
		hexagons: Array<{ x: number; y: number; creature?: unknown }>;
		abilities: Array<{
			upgraded: boolean;
			setUsed: jest.Mock;
			usesLeftBeforeUpgrade: () => number;
			setUpgraded: jest.Mock;
		}>;
		takeDamage = jest.fn(() => ({ kill: false }));
		heal = jest.fn((amount: number) => {
			this.health = Math.min(this.stats.health, this.health + amount);
		});
		addEffect = jest.fn();
		moveTo = jest.fn((_hex: unknown, opts: { callback?: () => void }) => {
			opts.callback?.();
		});
		adjacentHexes = jest.fn(
			(): Array<{ x: number; y: number; creature?: unknown; isWalkable: () => boolean }> => [],
		);
		calculatePath = jest.fn(() => []);
		isDarkPriest = jest.fn(() => false);

		constructor(init: Partial<CreatureMock> = {}) {
			this.id = init.id ?? 0;
			this.team = init.team ?? 0;
			this.type = init.type ?? 'G4';
			this.name = init.name ?? 'unit';
			this.health = init.health ?? 100;
			this.stats = init.stats ?? { health: 100 };
			this.x = init.x ?? 0;
			this.y = init.y ?? 0;
			this.size = init.size ?? 1;
			this.player = init.player ?? { id: this.team, flipped: false, creatures: [] };
			this.hexagons = init.hexagons ?? [{ x: this.x, y: this.y }];
			this.abilities = init.abilities ?? [];
		}
	}

	return { Creature: CreatureMock };
});

jest.mock('../../game', () => ({
	__esModule: true,
	default: class GameMock {},
}));

import loadMissCreeperAbilities from '../../abilities/Miss-Creeper';
import { Creature } from '../../creature';

type AbilityRecord = Record<string, any>;

const makeGame = () => ({
	abilities: {} as Record<number, AbilityRecord[]>,
	turn: 3,
	log: jest.fn(),
	grid: {
		queryCreature: jest.fn(),
		queryHexes: jest.fn(),
		hexes: [] as unknown[][],
	},
	UI: {
		selectAbility: jest.fn(),
		abilitiesButtons: [],
	},
});

/**
 * Builds a creature with the mocked Creature class so `instanceof` checks in the
 * ability code resolve the same way they do in the engine.
 * @param {number} id Creature id.
 * @param {number} [team] Team, enemy of Miss Creeper by default.
 * @return {any} Mocked creature instance.
 */
const makeEnemy = (id: number, team = 1): any =>
	new (Creature as any)({ id, team, stats: { health: 100 }, x: 1, y: 0 });

/**
 * Square grid of hex-shaped doubles: `hexes[y][x]` mirrors the engine's shape,
 * with a four-way adjacency and Chebyshev ring growth, enough to exercise the
 * step-by-step pull.
 * @return {object} Grid model with `hexes` and an `at(x, y)` accessor.
 */
const makeTestGrid = (isHexWalkable: (hex: any) => boolean = () => true, width = 6, height = 6) => {
	const cells: any[] = [];

	for (let y = 0; y < height; y++) {
		cells[y] = [];
		for (let x = 0; x < width; x++) {
			cells[y][x] = {
				x,
				y,
				// Cells reachable in exactly `distance` steps, so ring growth
				// matches how the engine measures hexagon rings.
				adjacentHex: (distance = 1) => {
					if (distance === 0) {
						return [cells[y][x]];
					}
					const inner = new Set(
						cells[y][x].adjacentHex(distance - 1).map((hex: any) => hex.x + ',' + hex.y),
					);
					const ring: any[] = [];
					for (let dy = -distance; dy <= distance; dy++) {
						for (let dx = -distance; dx <= distance; dx++) {
							const nx = x + dx;
							const ny = y + dy;
							if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
							if (inner.has(nx + ',' + ny)) continue;
							ring.push(cells[ny][nx]);
						}
					}
					return ring;
				},
				isWalkable: () => isHexWalkable(cells[y][x]),
				creature: undefined,
			};
		}
	}

	return { hexes: cells, at: (x: number, y: number) => cells[y][x] };
};

const makeAbility = (
	game: ReturnType<typeof makeGame>,
	slot: number,
	creature: any,
	overrides: AbilityRecord = {},
) => {
	const ability: AbilityRecord = {
		...(game.abilities[19][slot] as AbilityRecord),
		creature,
		testRequirements: jest.fn(() => true),
		atLeastOneTarget: jest.fn(() => true),
		end: jest.fn(),
		isUpgraded: jest.fn(() => false),
		...overrides,
	};

	return ability;
};

describe('Miss Creeper abilities', () => {
	let game: ReturnType<typeof makeGame>;

	beforeEach(() => {
		game = makeGame();
		loadMissCreeperAbilities(game as never);
	});

	describe('Muscous Pillar', () => {
		const buildPassive = (creeper: any, overrides: AbilityRecord = {}) =>
			makeAbility(game, 0, creeper, overrides);

		test('recovers a share of the slain unit health pool when it dies nearby', () => {
			const creeper = {
				id: 19,
				health: 50,
				heal: jest.fn(),
				adjacentHexes: jest.fn(() => [{ x: 1, y: 0 }]),
			};
			const ability = buildPassive(creeper);
			const dead = { id: 42, stats: { health: 200 }, hexagons: [{ x: 1, y: 0 }] };

			expect(ability.require(dead)).toBe(true);

			ability.activate(dead);

			expect(creeper.heal).toHaveBeenCalledWith(40);
		});

		test('doubles the recovery once upgraded', () => {
			const creeper = {
				id: 19,
				health: 50,
				heal: jest.fn(),
				adjacentHexes: jest.fn(() => [{ x: 1, y: 0 }]),
			};
			const ability = buildPassive(creeper, { isUpgraded: jest.fn(() => true) });
			const dead = { id: 42, stats: { health: 200 }, hexagons: [{ x: 1, y: 0 }] };

			ability.activate(dead);

			expect(creeper.heal).toHaveBeenCalledWith(80);
		});

		test('ignores units dying out of reach, herself and temporary summons', () => {
			const creeper = {
				id: 19,
				health: 50,
				heal: jest.fn(),
				adjacentHexes: jest.fn(() => [{ x: 1, y: 0 }]),
			};
			const ability = buildPassive(creeper);

			// Far away, herself, and a temporary summon next to her.
			expect(ability.require({ id: 77, stats: { health: 100 }, hexagons: [{ x: 6, y: 6 }] })).toBe(
				false,
			);
			expect(ability.require({ id: 19, stats: { health: 100 }, hexagons: [{ x: 1, y: 0 }] })).toBe(
				false,
			);
			expect(
				ability.require({ id: 42, temp: true, stats: { health: 100 }, hexagons: [{ x: 1, y: 0 }] }),
			).toBe(false);

			// The temporary summon is rejected, so it feeds her for nothing.
			creeper.heal.mockClear();
			ability.activate({ id: 42, temp: true, stats: { health: 200 }, hexagons: [{ x: 1, y: 0 }] });

			expect(creeper.heal).toHaveBeenCalledWith(40);
		});

		test('reads the corpse position when its hex back-references are gone', () => {
			const creeper = {
				id: 19,
				health: 50,
				heal: jest.fn(),
				adjacentHexes: jest.fn(() => [{ x: 1, y: 0 }]),
			};
			const ability = buildPassive(creeper);
			// No hexagons listed: only the anchor coordinates are left.
			const dead = { id: 42, x: 1, y: 0, stats: { health: 200 }, hexagons: [] };

			expect(ability.require(dead)).toBe(true);

			ability.activate(dead);

			expect(creeper.heal).toHaveBeenCalledWith(40);
		});
	});

	describe('Carving Nails', () => {
		const build = (overrides: AbilityRecord = {}) => {
			const creeper = {
				id: 19,
				player: { flipped: false },
				adjacentHexes: jest.fn(() => []),
				heal: jest.fn(),
			};

			return makeAbility(game, 1, creeper, {
				damages: { pierce: 8, slash: 8 },
				...overrides,
			});
		};

		const damagesOf = (ability: AbilityRecord, target: any) => {
			const strike = target.takeDamage.mock.calls[target.takeDamage.mock.calls.length - 1][0];

			return (strike as any).damages;
		};

		test('cuts deeper with every strike on the same foe', () => {
			const ability = build();
			const target = { id: 42, takeDamage: jest.fn() };

			ability.activate(target);
			ability.activate(target);
			ability.activate(target);

			expect(target.takeDamage).toHaveBeenCalledTimes(3);
			expect(ability._strikes).toEqual({ 42: 3 });
			expect(damagesOf(ability, target)).toEqual({ pierce: 24, slash: 24 });
		});

		test('keeps a separate count per foe, even while alternating', () => {
			const ability = build();
			const wolf = { id: 42, takeDamage: jest.fn() };
			const thug = { id: 43, takeDamage: jest.fn() };

			// Third strike on the wolf, first on the thug, then fourth on the wolf.
			ability.activate(wolf);
			ability.activate(wolf);
			ability.activate(wolf);
			ability.activate(thug);
			ability.activate(wolf);

			expect(ability._strikes).toEqual({ 42: 4, 43: 1 });
			expect(damagesOf(ability, wolf)).toEqual({ pierce: 32, slash: 32 });
			expect(damagesOf(ability, thug)).toEqual({ pierce: 8, slash: 8 });

			// The thug's own next strike is its second, not the wolf's fourth.
			ability.activate(thug);

			expect(damagesOf(ability, thug)).toEqual({ pierce: 16, slash: 16 });
			expect(ability._strikes).toEqual({ 42: 4, 43: 2 });
		});

		test('upgraded claws heal a flat 8 per strike whatever the multiplier', () => {
			const ability = build({ isUpgraded: jest.fn(() => true) });
			const target = { id: 42, takeDamage: jest.fn() };

			ability.activate(target);
			ability.activate(target);
			ability.activate(target);

			// Three strikes, three flat heals: the multiplier does not feed them.
			expect(ability.creature.heal.mock.calls).toEqual([[8], [8], [8]]);
			expect(damagesOf(ability, target)).toEqual({ pierce: 24, slash: 24 });
		});

		test('does not heal while un-upgraded', () => {
			const ability = build();
			const target = { id: 42, takeDamage: jest.fn() };

			ability.activate(target);

			expect(ability.creature.heal).not.toHaveBeenCalled();
			expect(damagesOf(ability, target)).toEqual({ pierce: 8, slash: 8 });
		});

		test('reads its base damage from the unit data', () => {
			const ability = build({ damages: { pierce: 5, slash: 7 } });
			const target = { id: 42, takeDamage: jest.fn() };

			ability.activate(target);
			ability.activate(target);

			// Second strike: 2 x the unit data's own numbers.
			expect(damagesOf(ability, target)).toEqual({ pierce: 10, slash: 14 });
		});
	});

	describe('Fatal Attraction', () => {
		const buildAttraction = (creeper: any, overrides: AbilityRecord = {}) =>
			makeAbility(game, 2, creeper, overrides);

		test('cannot lure summoners', () => {
			const creeper = { id: 19, player: { flipped: false }, adjacentHexes: jest.fn(() => []) };
			const ability = buildAttraction(creeper);

			expect(
				ability._confirmTarget({ id: 5, isDarkPriest: () => true, stats: { moveable: true } }),
			).toBe(false);
			expect(
				ability._confirmTarget({ id: 42, isDarkPriest: () => false, stats: { moveable: true } }),
			).toBe(true);
		});

		test('walks the lured unit towards her as far as its movement allows', () => {
			const grid = makeTestGrid((hex: any) => hex.y === 1);
			game.grid.hexes = grid.hexes;
			// Miss Creeper at (1,1); nothing next to her yet.
			const creeper = {
				id: 19,
				x: 1,
				y: 1,
				dead: false,
				adjacentHexes: jest.fn(() => [grid.at(0, 1), grid.at(1, 0), grid.at(1, 2), grid.at(2, 1)]),
			};
			const ability = buildAttraction(creeper);

			const target: any = {
				id: 42,
				x: 4,
				y: 1,
				size: 1,
				dead: false,
				stats: { moveable: true },
				remainingMove: 2,
				moveTo: jest.fn((hex: any, opts: any) => {
					target.x = hex.x;
					target.y = hex.y;
					target.remainingMove -= 1;
					opts.callback();
				}),
			};
			const effect = { owner: creeper, deleteEffect: jest.fn() };

			ability._attract(effect, target);

			// Two hexagons of its own movement, walked one hexagon at a time.
			expect(target.moveTo).toHaveBeenCalledTimes(2);
			expect(target.x).toBe(2);
			expect(target.remainingMove).toBe(0);
			expect(target.moveTo.mock.calls[0][1].ignoreMovementPoint).toBe(false);
			expect(effect.deleteEffect).toHaveBeenCalledTimes(1);
		});

		test('stops walking as soon as the lured unit reaches her', () => {
			const grid = makeTestGrid((hex: any) => hex.y === 1);
			game.grid.hexes = grid.hexes;
			const nearHer = grid.at(2, 1);
			const creeper = {
				id: 19,
				x: 1,
				y: 1,
				dead: false,
				adjacentHexes: jest.fn(() => [grid.at(0, 1), grid.at(1, 0), grid.at(1, 2), nearHer]),
			};
			const ability = buildAttraction(creeper);

			const target: any = {
				id: 42,
				x: 4,
				y: 1,
				size: 1,
				dead: false,
				stats: { moveable: true },
				remainingMove: 5,
				moveTo: jest.fn((hex: any, opts: any) => {
					nearHer.creature = undefined;
					target.x = hex.x;
					target.y = hex.y;
					target.remainingMove -= 1;
					grid.at(hex.x, hex.y).creature = target;
					opts.callback();
				}),
			};
			const effect = { owner: creeper, deleteEffect: jest.fn() };

			ability._attract(effect, target);

			// (4,1) -> (3,1) -> (2,1): two hexagons, then it is in her claws.
			expect(target.moveTo).toHaveBeenCalledTimes(2);
			expect([target.x, target.y]).toEqual([2, 1]);
			expect(effect.deleteEffect).toHaveBeenCalledTimes(1);
		});

		test('leaves a unit that already stands next to her alone', () => {
			const grid = makeTestGrid();
			game.grid.hexes = grid.hexes;
			const beside = grid.at(2, 1);
			const creeper = {
				id: 19,
				x: 1,
				y: 1,
				dead: false,
				adjacentHexes: jest.fn(() => [beside]),
			};
			const ability = buildAttraction(creeper);

			const target: any = {
				id: 42,
				x: 2,
				y: 1,
				size: 1,
				dead: false,
				stats: { moveable: true },
				remainingMove: 4,
				moveTo: jest.fn(),
			};
			beside.creature = target;
			const effect = { owner: creeper, deleteEffect: jest.fn() };

			ability._attract(effect, target);

			expect(target.moveTo).not.toHaveBeenCalled();
			expect(effect.deleteEffect).toHaveBeenCalledTimes(1);
		});

		test('still finds a way to walk towards her from the far end of the range', () => {
			// Regression: ring measuring stopped at six rings, so a unit at the
			// edge of the upgraded range had no reachable step at all and the
			// lure gave up immediately.
			const grid = makeTestGrid(() => true, 14, 10);
			game.grid.hexes = grid.hexes;
			const creeper = {
				id: 19,
				x: 1,
				y: 1,
				dead: false,
				adjacentHexes: jest.fn(() => [grid.at(0, 1)]),
			};
			const ability = buildAttraction(creeper);

			const target: any = {
				id: 42,
				x: 11,
				y: 1,
				size: 1,
				dead: false,
				stats: { moveable: true },
				remainingMove: 1,
				moveTo: jest.fn((hex: any, opts: any) => opts.callback()),
			};

			const before = ability._ringDistance(grid.at(11, 1), creeper);
			const step = ability._getStepTowards(target, creeper);

			expect(step).toBeDefined();
			// The step is one ring closer, and still beyond the old six-ring cap.
			expect(ability._ringDistance(step as any, creeper)).toBe(before - 1);
			expect(ability._ringDistance(step as any, creeper)).toBeGreaterThan(6);
		});

		test('drops the attraction when she cannot be walked towards', () => {
			const grid = makeTestGrid();
			game.grid.hexes = grid.hexes;
			const creeper = {
				id: 19,
				x: 1,
				y: 1,
				dead: false,
				adjacentHexes: jest.fn(() => [grid.at(0, 1), grid.at(1, 0), grid.at(1, 2), grid.at(2, 1)]),
			};
			const ability = buildAttraction(creeper);

			// Walled in: no neighbour is walkable.
			const target: any = {
				id: 42,
				x: 3,
				y: 1,
				size: 1,
				dead: false,
				stats: { moveable: true },
				remainingMove: 3,
				moveTo: jest.fn(),
			};
			grid.hexes.forEach((row: any[]) =>
				row.forEach((hex: any) => {
					const original = hex.isWalkable;
					hex.isWalkable = jest.fn((size: number, id: number, ignoreReachable?: boolean) => {
						if (!ignoreReachable) {
							return original(size, id, ignoreReachable);
						}
						// Every hexagon the unit could step onto is sealed.
						return false;
					});
				}),
			);
			const effect = { owner: creeper, deleteEffect: jest.fn() };

			ability._attract(effect, target);

			expect(target.moveTo).not.toHaveBeenCalled();
			expect(effect.deleteEffect).toHaveBeenCalledTimes(1);
		});
	});

	describe('Tendril Feet', () => {
		const buildTendrils = (creeper: any, overrides: AbilityRecord = {}) =>
			makeAbility(game, 3, creeper, overrides);

		test('roots every nearby foe and tramples them with crush damage', () => {
			// One stable area: `adjacentHexes` is called more than once.
			const area = [
				{ x: 1, y: 0, creature: makeEnemy(42) },
				{ x: 2, y: 0, creature: makeEnemy(43) },
				{ x: 0, y: 1, creature: makeEnemy(44, 0) },
			];
			const creeper = {
				id: 19,
				team: 0,
				player: { flipped: false },
				adjacentHexes: jest.fn(() => area),
			};
			const ability = buildTendrils(creeper, { damages: { crush: 20 } });
			// Mirrors the engine helper: one entry per creature occupying the area.
			ability.getTargets = jest.fn((hexes: Array<{ creature?: unknown }>) =>
				hexes.filter((hex) => hex.creature).map((hex) => ({ target: hex.creature, hexesHit: 1 })),
			);
			const enemyA = area[0].creature;
			const enemyB = area[1].creature;
			const ally = area[2].creature;

			ability.activate();

			expect(ability.end).toHaveBeenCalledTimes(1);
			expect(enemyA.takeDamage).toHaveBeenCalledTimes(1);
			expect(enemyB.takeDamage).toHaveBeenCalledTimes(1);
			expect((enemyA.takeDamage.mock.calls[0][0] as any).damages).toEqual({ crush: 20 });
			expect(enemyA.addEffect).toHaveBeenCalledTimes(1);
			expect(enemyA.addEffect.mock.calls[0][0].alterations).toEqual({ moveable: false });
			// Allies standing in the tendrils are left alone.
			expect(ally.takeDamage).not.toHaveBeenCalled();
			expect(ally.addEffect).not.toHaveBeenCalled();
		});

		test('silences the rooted units ability upgrades until the tendrils let go', () => {
			const upgradedAbility = {
				isUpgraded: jest.fn(() => true),
				setUpgraded: jest.fn(),
				usesLeftBeforeUpgrade: jest.fn(() => -1),
			};
			const freshAbility = { isUpgraded: jest.fn(() => false) };
			// A real (mocked) Creature instance so the ability's `instanceof` filter
			// lets it through, with the ability array and spies we assert on.
			const target: any = new (Creature as any)({
				id: 42,
				team: 1,
				stats: { health: 100 },
				x: 1,
				y: 0,
			});
			target.abilities = [upgradedAbility, freshAbility];
			target.addEffect = jest.fn();
			target.takeDamage = jest.fn();
			const creeper = {
				id: 19,
				team: 0,
				player: { flipped: false },
				adjacentHexes: jest.fn(() => [{ x: 1, y: 0, creature: target }]),
			};
			const ability = buildTendrils(creeper, {
				damages: { crush: 20 },
				isUpgraded: jest.fn(() => true),
			});
			ability.getTargets = jest.fn((hexes: Array<{ creature?: unknown }>) =>
				hexes.filter((hex) => hex.creature).map((hex) => ({ target: hex.creature, hexesHit: 1 })),
			);

			ability.activate();

			const tendrils = target.addEffect.mock.calls[0][0];
			const silence = target.addEffect.mock.calls[1][0];
			expect(tendrils.alterations).toEqual({ moveable: false });

			// Upgraded while grasped: the engine's answer is overridden.
			expect(upgradedAbility.isUpgraded()).toBe(false);
			expect(freshAbility.isUpgraded()).toBe(false);

			// A turn that starts while the tendrils still hold re-silences it.
			tendrils.isDeleted = false;
			silence.effectFn(silence);
			expect(upgradedAbility.isUpgraded()).toBe(false);
			expect(silence.deleteEffect).not.toHaveBeenCalled();

			// Once the tendrils are gone the upgrade is handed back.
			tendrils.isDeleted = true;
			silence.effectFn(silence);
			expect(upgradedAbility.isUpgraded()).toBe(true);
			expect(silence.deleteEffect).toHaveBeenCalledTimes(1);
		});
	});
});
