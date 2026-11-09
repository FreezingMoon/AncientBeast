import { beforeEach, describe, expect, jest, test } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../../phaser/boomerang', () => ({
	animateBoomerang: jest.fn(),
}));

jest.mock('phaser', () => ({
	Math: {
		Vector2: class Vector2Mock {
			x = 0;
			y = 0;
			constructor(x = 0, y = 0) {
				this.x = x;
				this.y = y;
			}
		},
	},
	GameObjects: {
		Polygon: class PolygonGameObjectMock {
			constructor(_scene?: unknown, _x?: number, _y?: number, points?: unknown) {
				(this as any).points = points ?? [];
			}
			contains() {
				return true;
			}
		},
	},
	Point: class PointMock {},
	Polygon: class PolygonMock {},
	Vector2: class Vector2Mock {
		x = 0;
		y = 0;
		constructor(x = 0, y = 0) {
			this.x = x;
			this.y = y;
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
		stats: { health: number; energy?: number; endurance: number; moveable?: boolean };
		endurance: number;
		hexagons: Array<{ x: number; y: number; creature?: unknown }>;
		x: number;
		y: number;
		size: number;
		player: { id: number; flipped: boolean; creatures: unknown[] };
		takeDamage = jest.fn(() => ({ kill: false }));
		heal = jest.fn();
		addEffect = jest.fn();
		removeEffect = jest.fn();
		addFatigue = jest.fn();
		moveTo = jest.fn();
		getHexMap = jest.fn(() => []);
		facePlayerDefault = jest.fn();
		faceHex = jest.fn();
		cleanHex = jest.fn();
		isDarkPriest = jest.fn(() => false);
		hasCreaturePlayerGotPlasma = jest.fn(() => false);
		creatureSprite = {
			setDir: jest.fn(),
			setAlpha: jest.fn(),
			getPos: jest.fn(() => ({ x: 0, y: 0 })),
		};
		sprite = { alpha: 1, x: 0, y: 0 };
		grp = { x: 0, y: 0 };

		constructor(init: Partial<CreatureMock> = {}) {
			this.id = init.id ?? 0;
			this.team = init.team ?? 0;
			this.type = init.type ?? '--';
			this.name = init.name ?? 'unit';
			this.health = init.health ?? 100;
			this.stats = init.stats ?? { health: 100, energy: 100, endurance: 10, moveable: true };
			this.hexagons = init.hexagons ?? [];
			this.x = init.x ?? 0;
			this.y = init.y ?? 0;
			this.size = init.size ?? 1;
			this.player =
				init.player ?? ({ id: this.team, flipped: false, creatures: [] } as CreatureMock['player']);
			this.endurance = init.endurance ?? this.stats.endurance ?? 10;
		}
	}

	return { Creature: CreatureMock };
});

import loadHeadlessAbilities from '../../abilities/Headless';
import { Ability } from '../../ability';
import { Creature } from '../../creature';
import { Damage } from '../../damage';
import { unitData } from '../../data/units';
import $j from 'jquery';
import { animateBoomerang } from '../../phaser/boomerang';

(globalThis as { Phaser?: unknown }).Phaser = {};

describe('Headless abilities', () => {
	let game: any;

	beforeEach(() => {
		jest.mocked(animateBoomerang).mockImplementation((_game, _start, hexes, onHit, onComplete) => {
			hexes.forEach(onHit);
			onComplete();
		});
		game = {
			abilities: [],
			creatureData: [],
			effects: [],
			turn: 4,
			activeCreature: null,
			freezedInput: false,
			log: jest.fn(),
			grid: {
				hexAt: jest.fn(() => ({ x: 4, y: 3 })),
				forEachHex: jest.fn(),
				updateDisplay: jest.fn(),
				hexes: [],
				queryChoice: jest.fn(),
				queryDirection: jest.fn(),
				queryHexes: jest.fn(),
				queryCreature: jest.fn(),
			},
			UI: {
				updateFatigue: jest.fn(),
				energyBar: { animSize: jest.fn(), setSize: jest.fn(), previewSize: jest.fn() },
			},
			Phaser: {
				camera: { shake: jest.fn(), SHAKE_VERTICAL: 'V', SHAKE_HORIZONTAL: 'H' },
			},
			animations: { projectile: jest.fn() },
			updateQueueDisplay: jest.fn(),
			retrieveCreatureStats: jest.fn(),
			msg: {
				abilities: {
					notEnough: 'Not enough %stat%.',
					noTarget: 'No target.',
					notMoveable: 'Not moveable.',
				},
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

		// Flat row of hex objects so movement destinations can be asserted by index.
		const row = [];
		for (let x = 0; x < 15; x++) {
			row.push({ x: x, y: 3 });
		}
		game.grid.hexes = [];
		game.grid.hexes[3] = row;

		globalThis.G = game as never;
		loadHeadlessAbilities(game as never);
	});

	test('Larva Infest subtracts 5 maximum endurance when the target has headroom', () => {
		const headless = new (Creature as any)({
			id: 39,
			team: 0,
			x: 3,
			y: 3,
			player: { id: 0, flipped: false, creatures: [] },
		});
		const enemy = new (Creature as any)({ id: 200, team: 1, stats: { health: 80, endurance: 10 } });

		const infest = {
			...game.abilities[39][0],
			creature: headless,
			game: game,
			title: 'Larva Infest',
			isUpgraded: () => false,
			end: jest.fn(),
			_getHexes: () => [{ x: 4, y: 3, creature: enemy }],
		};

		infest.activate();

		expect(enemy.addEffect).toHaveBeenCalledTimes(1);
		expect(enemy.addEffect.mock.calls[0][0].alterations).toEqual({ endurance: -5 });
		expect(enemy.addEffect.mock.calls[0][1]).toBe(
			'%CreatureName' + enemy.id + '% loses -5 maximum endurance',
		);
		expect(game.log).not.toHaveBeenCalled();
	});

	test('Larva Infest caps the maximum endurance loss at 1 below the current maximum', () => {
		const headless = new (Creature as any)({
			id: 39,
			team: 0,
			x: 3,
			y: 3,
			player: { id: 0, flipped: false, creatures: [] },
		});
		const enemy = new (Creature as any)({ id: 201, team: 1, stats: { health: 80, endurance: 3 } });

		const infest = {
			...game.abilities[39][0],
			creature: headless,
			game: game,
			title: 'Larva Infest',
			isUpgraded: () => false,
			end: jest.fn(),
			_getHexes: () => [{ x: 4, y: 3, creature: enemy }],
		};

		infest.activate();

		// min(5, max(0, 3 - 1)) === 2
		expect(enemy.addEffect.mock.calls[0][1]).toBe(
			'%CreatureName' + enemy.id + '% loses -2 maximum endurance',
		);
	});

	test('Larva Infest logs an already-fragile target and applies the effect silently', () => {
		const headless = new (Creature as any)({
			id: 39,
			team: 0,
			x: 3,
			y: 3,
			player: { id: 0, flipped: false, creatures: [] },
		});
		const enemy = new (Creature as any)({ id: 202, team: 1, stats: { health: 80, endurance: 1 } });

		const infest = {
			...game.abilities[39][0],
			creature: headless,
			game: game,
			title: 'Larva Infest',
			isUpgraded: () => false,
			end: jest.fn(),
			_getHexes: () => [{ x: 4, y: 3, creature: enemy }],
		};

		infest.activate();

		expect(game.log).toHaveBeenCalledWith('%CreatureName' + enemy.id + '% is already fragile');
		// Fourth argument suppresses the effect message for an already fragile target.
		expect(enemy.addEffect.mock.calls[0][3]).toBe(true);
	});

	test('Larva Infest upgraded fatigues the target by draining its remaining endurance', () => {
		const headless = new (Creature as any)({
			id: 39,
			team: 0,
			x: 3,
			y: 3,
			player: { id: 0, flipped: false, creatures: [] },
		});
		const enemy = new (Creature as any)({
			id: 203,
			team: 1,
			stats: { health: 80, endurance: 10 },
			endurance: 3,
		});

		const infest = {
			...game.abilities[39][0],
			creature: headless,
			game: game,
			title: 'Larva Infest',
			isUpgraded: () => true,
			end: jest.fn(),
			_getHexes: () => [{ x: 4, y: 3, creature: enemy }],
		};

		infest.activate();

		expect(enemy.addFatigue).toHaveBeenCalledWith(3);
	});

	test('Cartilage Dagger deals base pierce damage to a healthy target', () => {
		const headless = new (Creature as any)({
			id: 39,
			team: 0,
			stats: { health: 60, endurance: 5 },
		});
		const enemy = new (Creature as any)({
			id: 204,
			team: 1,
			stats: { health: 80, endurance: 5 },
			endurance: 3,
		});

		const dagger = {
			...game.abilities[39][1],
			creature: headless,
			isUpgraded: () => false,
			end: jest.fn(),
		};
		dagger.activate(enemy);

		expect(enemy.takeDamage.mock.calls[0][0].damages.pierce).toBe(11);
	});

	test('Cartilage Dagger doubles damage against a fatigued target', () => {
		const headless = new (Creature as any)({
			id: 39,
			team: 0,
			stats: { health: 60, endurance: 5 },
		});
		const enemy = new (Creature as any)({
			id: 205,
			team: 1,
			stats: { health: 80, endurance: 5 },
			endurance: 0,
		});

		const dagger = {
			...game.abilities[39][1],
			creature: headless,
			isUpgraded: () => false,
			end: jest.fn(),
		};
		dagger.activate(enemy);

		expect(enemy.takeDamage.mock.calls[0][0].damages.pierce).toBe(22);
	});

	test('Cartilage Dagger upgraded adds the positive endurance difference', () => {
		const headless = new (Creature as any)({
			id: 39,
			team: 0,
			stats: { health: 60, endurance: 10 },
		});
		const enemy = new (Creature as any)({
			id: 206,
			team: 1,
			stats: { health: 80, endurance: 6 },
			endurance: 4,
		});

		const dagger = {
			...game.abilities[39][1],
			creature: headless,
			isUpgraded: () => true,
			end: jest.fn(),
		};
		dagger.activate(enemy);

		// 11 + (10 - 6) === 15
		expect(enemy.takeDamage.mock.calls[0][0].damages.pierce).toBe(15);
	});

	test('Cartilage Dagger upgraded ignores a negative endurance difference', () => {
		const headless = new (Creature as any)({
			id: 39,
			team: 0,
			stats: { health: 60, endurance: 4 },
		});
		const enemy = new (Creature as any)({
			id: 207,
			team: 1,
			stats: { health: 80, endurance: 9 },
			endurance: 4,
		});

		const dagger = {
			...game.abilities[39][1],
			creature: headless,
			isUpgraded: () => true,
			end: jest.fn(),
		};
		dagger.activate(enemy);

		expect(enemy.takeDamage.mock.calls[0][0].damages.pierce).toBe(11);
	});

	test('Whip Move pulls a size 1 target into the hex in front of the Headless', () => {
		const headless = new (Creature as any)({
			id: 39,
			team: 0,
			x: 3,
			y: 3,
			player: { id: 0, flipped: false, creatures: [] },
		});
		const enemy = new (Creature as any)({
			id: 208,
			team: 1,
			size: 1,
			x: 6,
			y: 3,
			stats: { health: 80, endurance: 5, moveable: true },
		});

		const whip = {
			...game.abilities[39][2],
			creature: headless,
			isUpgraded: () => false,
			end: jest.fn(),
		};
		whip.activate([{ x: 6, y: 3, creature: enemy }]);

		expect(enemy.moveTo).toHaveBeenCalledTimes(1);
		expect(enemy.moveTo.mock.calls[0][0]).toBe(game.grid.hexes[3][4]);
	});

	test('Whip Move drags the Headless towards a size 3 target', () => {
		const headless = new (Creature as any)({
			id: 39,
			team: 0,
			x: 3,
			y: 3,
			player: { id: 0, flipped: false, creatures: [] },
		});
		const enemy = new (Creature as any)({
			id: 209,
			team: 1,
			size: 3,
			x: 8,
			y: 3,
			stats: { health: 80, endurance: 5, moveable: true },
		});

		const whip = {
			...game.abilities[39][2],
			creature: headless,
			isUpgraded: () => false,
			end: jest.fn(),
		};
		whip.activate([{ x: 8, y: 3, creature: enemy }]);

		expect(headless.moveTo).toHaveBeenCalledTimes(1);
		// destinationX = target.x - 3 for a size 3 target to the right
		expect(headless.moveTo.mock.calls[0][0]).toBe(game.grid.hexes[3][5]);
	});

	test('Whip Move pulls a size 2 target and the Headless to a halfway meeting point', () => {
		const headless = new (Creature as any)({
			id: 39,
			team: 0,
			x: 3,
			y: 3,
			player: { id: 0, flipped: false, creatures: [] },
		});
		const enemy = new (Creature as any)({
			id: 210,
			team: 1,
			size: 2,
			x: 8,
			y: 3,
			stats: { health: 80, endurance: 5, moveable: true },
		});

		const whip = {
			...game.abilities[39][2],
			creature: headless,
			isUpgraded: () => false,
			end: jest.fn(),
		};
		whip.activate([{ x: 8, y: 3, creature: enemy }]);

		expect(headless.moveTo.mock.calls[0][0]).toBe(game.grid.hexes[3][5]);
		expect(enemy.moveTo.mock.calls[0][0]).toBe(game.grid.hexes[3][7]);
	});

	test('Whip Move damages a plasma-shielded enemy Dark Priest instead of pulling it', () => {
		const headless = new (Creature as any)({
			id: 39,
			team: 0,
			x: 3,
			y: 3,
			player: { id: 0, flipped: false, creatures: [] },
		});
		const priest = new (Creature as any)({
			id: 211,
			team: 1,
			size: 1,
			x: 6,
			y: 3,
			player: { id: 1, flipped: false, creatures: [] },
			stats: { health: 80, endurance: 5, moveable: true },
		});
		priest.isDarkPriest = jest.fn(() => true);
		priest.hasCreaturePlayerGotPlasma = jest.fn(() => true);

		const whip = {
			...game.abilities[39][2],
			creature: headless,
			isUpgraded: () => false,
			end: jest.fn(),
		};
		whip.activate([{ x: 6, y: 3, creature: priest }]);

		expect(priest.takeDamage).toHaveBeenCalledTimes(1);
		expect(priest.takeDamage.mock.calls[0][0].damages.slash).toBe(1);
		expect(headless.moveTo).not.toHaveBeenCalled();
		expect(priest.moveTo).not.toHaveBeenCalled();
	});

	test('Boomerang Tool applies area damage once', () => {
		const headless = new (Creature as any)({
			id: 39,
			team: 0,
			x: 3,
			y: 3,
			player: { id: 0, flipped: false, creatures: [] },
		});
		const enemy = new (Creature as any)({ id: 212, team: 1, stats: { health: 80, endurance: 5 } });

		const boomerang = {
			...game.abilities[39][3],
			creature: headless,
			game: game,
			isUpgraded: () => false,
			end: jest.fn(),
			getTargets: jest.fn(() => [{ target: enemy, hexesHit: 1 }]),
			areaDamage: Ability.prototype.areaDamage,
		};

		boomerang.activate([{ x: 4, y: 3, creature: enemy }]);

		expect(enemy.takeDamage).toHaveBeenCalledTimes(1);
		expect(enemy.takeDamage.mock.calls[0][0].damages).toEqual({ slash: 9 });
		expect(enemy.takeDamage.mock.calls[0][1]).toEqual({ ignoreRetaliation: false });
	});

	describe('Boomerang Tool targeting', () => {
		function createBoomerang(x: number, y: number, flipped: boolean, upgraded: boolean) {
			game.grid.hexes = Array.from({ length: 9 }, (_, row) =>
				Array.from({ length: row % 2 === 0 ? 15 : 16 }, (_, column) => ({
					x: column,
					y: row,
				})),
			);
			const headless = new (Creature as any)({
				id: 39,
				x,
				y,
				size: 2,
				player: { id: 0, flipped, creatures: [] },
			});
			return {
				...game.abilities[39][3],
				creature: headless,
				game,
				isUpgraded: () => upgraded,
				end: jest.fn(),
				getTargets: Ability.prototype.getTargets,
				areaDamage: Ability.prototype.areaDamage,
			};
		}

		test.each([false, true])('damage waits for projectile encounters, upgraded=%s', (upgraded) => {
			const boomerang = createBoomerang(7, 4, false, upgraded);
			const choice = boomerang._getHexes(false);
			const occupied = choice.filter((hex) => hex.y === 3).slice(0, 3);
			const target = new (Creature as any)({ id: 250, size: 3 });
			occupied.forEach((hex) => {
				hex.creature = target;
			});
			const queryMove = jest.fn();
			game.activeCreature = { queryMove };
			let hit: (hex: any) => void;
			let complete: () => void;
			jest
				.mocked(animateBoomerang)
				.mockImplementationOnce((_game, start, _hexes, onHit, onComplete, vertigo) => {
					expect(start).toBe(game.grid.hexes[4][7]);
					expect(vertigo).toBe(upgraded);
					hit = onHit;
					complete = onComplete;
				});

			boomerang.activate(choice);
			expect(boomerang.end).toHaveBeenCalledWith(undefined, true);
			expect(target.takeDamage).not.toHaveBeenCalled();
			expect(queryMove).not.toHaveBeenCalled();
			for (const [index, hex] of occupied.entries()) {
				hit(hex);
				expect(target.takeDamage).toHaveBeenCalledTimes(upgraded ? index + 1 : 1);
			}
			complete();
			expect(queryMove).toHaveBeenCalledTimes(1);
		});

		test.each([false, true])(
			'left throws start from the left-facing front hex, flipped=%s',
			(flipped) => {
				const boomerang = createBoomerang(7, 4, flipped, false);
				jest.mocked(animateBoomerang).mockImplementationOnce((_game, start) => {
					expect(start).toBe(game.grid.hexes[4][6]);
				});
				boomerang.activate(boomerang._getHexes(!flipped));
			},
		);

		test.each([false, true])(
			'calculates finite damage for a three-hex target with merged card metadata, upgraded=%s',
			(upgraded) => {
				const boomerang = createBoomerang(7, 4, false, upgraded);
				const metadata = unitData.find((unit) => unit.id === 39).ability_info[3];
				$j.extend(true, boomerang, metadata);
				expect(boomerang.damages.special).toBe(metadata.damages.special);
				boomerang.creature.stats = { offense: 0, slash: 0 };
				const target = new (Creature as any)({
					id: 250,
					size: 3,
					stats: { health: 100, endurance: 10, defense: 0, slash: 0 },
				});
				const totals: number[] = [];
				target.takeDamage.mockImplementation((damage: Damage) => {
					damage.target = target;
					const result = damage.applyDamage();
					expect(Number.isFinite(result.total)).toBe(true);
					totals.push(result.total);
					return { kill: false };
				});
				const choice = boomerang._getHexes(false);
				for (const hex of choice.filter((hex) => hex.y === 3).slice(0, 3)) {
					hex.creature = target;
				}

				boomerang.activate(choice);

				expect(totals).toEqual(Array(upgraded ? 3 : 1).fill(9));
			},
		);

		test.each([
			[false, 1, 1],
			[false, 2, 1],
			[false, 2, 2],
			[false, 3, 1],
			[false, 3, 2],
			[false, 3, 3],
			[true, 1, 1],
			[true, 2, 1],
			[true, 2, 2],
			[true, 3, 1],
			[true, 3, 2],
			[true, 3, 3],
		])(
			'area versus per-hex damage, upgraded=%s size=%s hexes in range=%s',
			(upgraded, size, covered) => {
				const boomerang = createBoomerang(7, 4, false, upgraded);
				const choice = boomerang._getHexes(false);
				const target = new (Creature as any)({ id: 250, team: 1, size });
				const occupied = choice.filter((hex) => hex.y === 3).slice(0, covered);
				for (const hex of occupied) {
					hex.creature = target;
				}
				// Occupying inline dead space must not add another hit.
				choice.find((hex) => hex.y === 4).creature = target;

				boomerang.activate(choice);

				expect(target.takeDamage).toHaveBeenCalledTimes(upgraded ? covered : 1);
				for (const [damage, options] of target.takeDamage.mock.calls) {
					expect(damage.damages).toEqual({ slash: 9 });
					expect(damage.area).toBe(upgraded ? 1 : covered);
					expect(options).toEqual({ ignoreRetaliation: false });
				}
			},
		);

		test.each([
			[false, false],
			[false, true],
			[true, false],
			[true, true],
		])('equal contiguous rows, flipped=%s upgraded=%s', (flipped, upgraded) => {
			for (const y of [0, 1, 2, 4, 7, 8]) {
				for (const x of [1, 2, 7, 12, 14]) {
					const boomerang = createBoomerang(x, y, flipped, upgraded);
					for (const invert of [false, true]) {
						const left = flipped !== invert;
						const startX = left ? x - 2 : x + 1;
						const availableYs = [y - 1, y, y + 1].filter((row) => game.grid.hexes[row]);
						const starts = availableYs.map((row) =>
							row === y ? startX : startX + (left ? 1 - (y % 2) : -(y % 2)),
						);
						const length = Math.min(
							5,
							...availableYs.map((row, index) =>
								left ? starts[index] + 1 : game.grid.hexes[row].length - starts[index],
							),
						);
						const choice = boomerang._getHexes(invert);
						expect(choice).toHaveLength(availableYs.length * length);
						for (const [index, row] of availableYs.entries()) {
							expect(choice.filter((hex) => hex.y === row).map((hex) => hex.x)).toEqual(
								Array.from({ length }, (_, distance) =>
									left ? starts[index] - distance : starts[index] + distance,
								),
							);
						}
					}
				}
			}
		});

		test.each([false, true])(
			'E5 left throw includes D4/F4 and clips all rows to three hexes, flipped=%s',
			(flipped) => {
				const boomerang = createBoomerang(4, 4, flipped, false);
				const choice = boomerang._getHexes(!flipped);
				expect(choice.map((hex) => `${String.fromCharCode(65 + hex.y)}${hex.x + 1}`)).toEqual([
					'D4',
					'D3',
					'D2',
					'E3',
					'E2',
					'E1',
					'F4',
					'F3',
					'F2',
				]);
			},
		);

		test.each([false, true])(
			'D13 right throw includes C13/E13 and clips all rows to three hexes, flipped=%s',
			(flipped) => {
				const boomerang = createBoomerang(12, 3, flipped, false);
				const choice = boomerang._getHexes(flipped);
				expect(choice.map((hex) => `${String.fromCharCode(65 + hex.y)}${hex.x + 1}`)).toEqual([
					'C13',
					'C14',
					'C15',
					'D14',
					'D15',
					'D16',
					'E13',
					'E14',
					'E15',
				]);
			},
		);

		test.each([false, true])(
			'marks only inline dead space on both sides, flipped=%s',
			(flipped) => {
				const boomerang = createBoomerang(7, 4, flipped, false);
				boomerang.query();

				const options = game.grid.queryChoice.mock.calls[0][0];
				expect(options.choices.map((choice) => choice.length)).toEqual([15, 15]);
				expect(options.hexesDeadZone).toHaveLength(8);
				for (const choice of options.choices) {
					const middle = choice.filter((hex) => hex.y === 4);
					expect(options.hexesDeadZone).toEqual(expect.arrayContaining(middle.slice(0, -1)));
					expect(options.hexesDeadZone).not.toContain(middle[4]);
				}
			},
		);

		test.each([
			[false, false, false, 7],
			[false, false, true, 7],
			[true, false, false, 7],
			[true, false, true, 7],
			[false, true, false, 7],
			[false, true, true, 7],
			[true, true, false, 7],
			[true, true, true, 7],
			[false, false, false, 12],
			[false, false, true, 2],
		])(
			'damages side rows and far tip only, flipped=%s upgraded=%s rear=%s x=%s',
			(flipped, upgraded, rear, x) => {
				const boomerang = createBoomerang(x, 4, flipped, upgraded);
				const choice = boomerang._getHexes(rear);
				for (const [index, hex] of choice.entries()) {
					hex.creature = new (Creature as any)({ id: 200 + index, team: 1 });
				}

				boomerang.activate(choice);

				const middle = choice.filter((hex) => hex.y === 4);
				for (const hex of choice) {
					expect(hex.creature.takeDamage).toHaveBeenCalledTimes(
						hex.y !== 4 || hex === middle[middle.length - 1] ? 1 : 0,
					);
				}
			},
		);
	});
});
