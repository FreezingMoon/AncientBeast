import { beforeEach, describe, expect, jest, test } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('phaser-ce', () => ({
		Point: class PointMock {},
		Polygon: class PolygonMock {},
}));

jest.mock('../../damage', () => ({
		Damage: class DamageMock {
		damages: unknown;
		constructor(_attacker: unknown, damages: unknown) {
			this.damages = damages;
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

(globalThis as { Phaser?: unknown }).Phaser = {
		camera: { SHAKE_HORIZONTAL: 0, SHAKE_VERTICAL: 0, SHAKE_BOTH: 0 },
	};

describe('Headless abilities', () => {
	let game: any;

	beforeEach(() => {
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
		cameras: { main: { shake: () => {} } },
		add: {
		graphics: () => ({}),
		bitmapData: () => ({}),
		group: () => ({ children: [], add: () => {}, addAt: () => {}, remove: () => {} }),
		tileSprite: () => ({}),
				},
		tween: () => ({
		to: () => ({ start: () => ({ stop: () => ({}), onComplete: { add: () => {}, addOnce: () => {} } }), stop: () => ({}), onComplete: { add: () => {}, addOnce: () => {} } }),
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

	test('Boomerang Tool applies area damage twice', () => {
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

		expect(enemy.takeDamage).toHaveBeenCalledTimes(2);
		expect(enemy.takeDamage.mock.calls[0][0].damages).toEqual({ slash: 10 });
		expect(enemy.takeDamage.mock.calls[0][1]).toEqual({ ignoreRetaliation: true });
		expect(enemy.takeDamage.mock.calls[1][1]).toEqual({ ignoreRetaliation: false });
	});
});
