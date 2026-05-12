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

jest.mock('../../utility/hex', () => ({
	Hex: class HexMock {
		x: number;
		y: number;
		creature?: unknown;
		constructor(x: number, y: number, creature?: unknown) {
			this.x = x;
			this.y = y;
			this.creature = creature;
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
		stats: { health: number; energy?: number };
		hexagons: Array<{ x: number; y: number; creature?: unknown }>;
		x: number;
		y: number;
		pos: { x: number; y: number };
		size: number;
		player: { id: number; flipped: boolean; creatures: unknown[]; plasma?: number };
		energy: number;
		takeDamage = jest.fn();
		heal = jest.fn((amount: number) => {
			this.health = Math.min(this.stats.health, this.health + amount);
		});
		updateHealth = jest.fn();
		healthShow = jest.fn();
		healthHide = jest.fn();
		summon = jest.fn();
		destroy = jest.fn();
		pickupDrop = jest.fn();
		cleanHex = jest.fn();
		updateHex = jest.fn();
		tracePosition = jest.fn();
		faceHex = jest.fn();
		creatureSprite = {
			setDir: jest.fn(),
			setAlpha: jest.fn(),
			setHex: jest.fn(() => Promise.resolve()),
			getPos: jest.fn(() => ({ x: 0, y: 0 })),
		};
		sprite = {
			alpha: 1,
			x: 0,
			y: 0,
			anchor: { x: 0.5, y: 1 },
			scale: { x: 1, y: 1 },
			angle: 0,
			key: 'unit',
			frame: 0,
		};
		grp = { x: 0, y: 0 };

		constructor(init: Partial<CreatureMock> = {}) {
			this.id = init.id ?? 0;
			this.team = init.team ?? 0;
			this.type = init.type ?? '--';
			this.name = init.name ?? 'unit';
			this.health = init.health ?? 100;
			this.stats = init.stats ?? { health: 100, energy: 100 };
			this.hexagons = init.hexagons ?? [];
			this.x = init.x ?? 0;
			this.y = init.y ?? 0;
			this.pos = init.pos ?? { x: this.x, y: this.y };
			this.size = init.size ?? 1;
			this.player =
				init.player ?? ({ id: this.team, flipped: false, creatures: [] } as CreatureMock['player']);
			this.energy = init.energy ?? this.stats.energy ?? 100;
		}
	}

	return { Creature: CreatureMock };
});

import loadCycloperAbilities from '../../abilities/Cycloper';
import { Creature } from '../../creature';

describe('Cycloper abilities', () => {
	let game: any;

	beforeEach(() => {
		game = {
			abilities: [],
			creatureData: [],
			activeCreature: null,
			animations: {
				projectile: jest.fn(() => {
					const sprite = { destroy: jest.fn() };
					const tween = {
						onComplete: {
							add: (fn: () => void, context?: unknown) => {
								fn.call(context);
							},
						},
					};
					return [tween, sprite];
				}),
			},
			grid: {
				getHexLine: jest.fn(),
				getDirectionChoices: jest.fn(),
				forEachHex: jest.fn(),
				updateDisplay: jest.fn(),
				hexes: [],
				queryDirection: jest.fn(),
				queryChoice: jest.fn(),
				queryHexes: jest.fn(),
				previewCreature: jest.fn(),
				orderCreatureZ: jest.fn(),
				materialize_overlay: { alpha: 0, destroy: jest.fn() },
				secondary_overlay: { alpha: 0, destroy: jest.fn() },
				_flickerTween: null,
				_flickerTweenSecondary: null,
				creatureGroup: { add: jest.fn(), addAt: jest.fn(), remove: jest.fn() },
			},
			UI: {
				energyBar: {
					animSize: jest.fn(),
					setSize: jest.fn(),
					previewSize: jest.fn(),
					setAvailableStyle: jest.fn(),
					setUnavailableStyle: jest.fn(),
				},
			},
			Phaser: {
				add: {
					group: jest.fn(() => ({ x: 0, y: 0, alpha: 1, destroy: jest.fn() })),
					sprite: jest.fn(() => ({
						anchor: { setTo: jest.fn() },
						scale: { setTo: jest.fn() },
						angle: 0,
					})),
					tween: jest.fn(() => ({
						to: jest.fn(() => ({
							onComplete: { addOnce: jest.fn() },
							start: jest.fn(),
						})),
					})),
				},
				tweens: {
					removeFrom: jest.fn(),
				},
			},
			onStepOut: jest.fn(),
			onStepIn: jest.fn(),
			onCreatureMove: jest.fn(),
			updateQueueDisplay: jest.fn(),
			turn: 4,
			retrieveCreatureStats: jest.fn(),
			msg: {
				abilities: {
					notEnough: 'Not enough %stat%.',
					noTarget: 'No target.',
				},
			},
		};

		loadCycloperAbilities(game as never);
	});

	test('Optic Burst upgraded prioritizes enemy damage over inline damaged wall', () => {
		const cycloper = new (Creature as any)({
			id: 15,
			team: 0,
			type: 'W0',
			x: 3,
			y: 3,
			hexagons: [{ x: 3, y: 3 }],
			player: { id: 0, flipped: false, creatures: [] },
			health: 60,
			stats: { health: 60, energy: 100 },
		});

		const wall = new (Creature as any)({
			id: 100,
			team: 0,
			type: 'O0',
			health: 10,
			stats: { health: 30 },
			hexagons: [{ x: 4, y: 3 }],
		});

		const enemy = new (Creature as any)({
			id: 200,
			team: 1,
			type: 'A1',
			health: 80,
			stats: { health: 80 },
			hexagons: [{ x: 5, y: 3 }],
		});

		game.grid.getHexLine.mockReturnValue([
			{ x: 3, y: 3, creature: cycloper },
			{ x: 4, y: 3, creature: wall },
			{ x: 5, y: 3, creature: enemy },
		]);

		cycloper.queryMove = jest.fn();

		const abilityDef = game.abilities[15][1];
		const opticBurst = {
			...abilityDef,
			creature: cycloper,
			damages: { burn: 30 },
			isUpgraded: () => true,
			end: jest.fn(),
		};

		opticBurst.activate(
			[
				{ x: 4, y: 3, creature: wall },
				{ x: 5, y: 3, creature: enemy },
			],
			{ direction: 1 },
		);

		expect(enemy.takeDamage).toHaveBeenCalledTimes(1);
		expect(wall.heal).not.toHaveBeenCalled();
	});

	test('Optic Burst upgraded repairs selected damaged wall even with enemy inline', () => {
		const cycloper = new (Creature as any)({
			id: 15,
			team: 0,
			type: 'W0',
			x: 3,
			y: 3,
			hexagons: [{ x: 3, y: 3 }],
			player: { id: 0, flipped: false, creatures: [] },
			health: 60,
			stats: { health: 60, energy: 100 },
		});

		const wall = new (Creature as any)({
			id: 100,
			team: 0,
			type: 'O0',
			health: 10,
			stats: { health: 30 },
			hexagons: [{ x: 4, y: 3 }],
		});

		const enemy = new (Creature as any)({
			id: 200,
			team: 1,
			type: 'A1',
			health: 80,
			stats: { health: 80 },
			hexagons: [{ x: 5, y: 3 }],
		});

		game.grid.getHexLine.mockReturnValue([
			{ x: 3, y: 3, creature: cycloper },
			{ x: 4, y: 3, creature: wall },
			{ x: 5, y: 3, creature: enemy },
		]);

		const abilityDef = game.abilities[15][1];
		const opticBurst = {
			...abilityDef,
			creature: cycloper,
			damages: { burn: 30 },
			isUpgraded: () => true,
			end: jest.fn(),
		};

		opticBurst.activate(
			[
				{ x: 4, y: 3, creature: wall },
				{ x: 5, y: 3, creature: enemy },
			],
			{ direction: 1, hex: { x: 4, y: 3, creature: wall } },
		);

		expect(wall.heal).toHaveBeenCalledTimes(1);
		expect(enemy.takeDamage).not.toHaveBeenCalled();
	});

	test('Optic Burst wall heal uses full burn value instead of distance-reduced amount', () => {
		const cycloper = new (Creature as any)({
			id: 15,
			team: 0,
			type: 'W0',
			x: 3,
			y: 3,
			hexagons: [{ x: 3, y: 3 }],
			player: { id: 0, flipped: false, creatures: [] },
			health: 60,
			stats: { health: 60, energy: 100 },
		});

		const wall = new (Creature as any)({
			id: 100,
			team: 0,
			type: 'O0',
			health: 1,
			stats: { health: 100 },
			hexagons: [{ x: 4, y: 3 }],
		});

		game.grid.getHexLine.mockReturnValue([
			{ x: 3, y: 3, creature: cycloper },
			{ x: 4, y: 3, creature: wall },
		]);

		const abilityDef = game.abilities[15][1];
		const opticBurst = {
			...abilityDef,
			creature: cycloper,
			damages: { burn: 30 },
			isUpgraded: () => true,
			end: jest.fn(),
		};

		opticBurst.activate([{ x: 4, y: 3, creature: wall }], {
			direction: 1,
			hex: { x: 4, y: 3, creature: wall },
		});

		expect(wall.heal).toHaveBeenCalledWith(30);
	});

	test('Optic Burst upgraded heals selected wounded allied creature', () => {
		const cycloper = new (Creature as any)({
			id: 15,
			team: 0,
			type: 'W0',
			x: 3,
			y: 3,
			hexagons: [{ x: 3, y: 3 }],
			player: { id: 0, flipped: false, creatures: [] },
			health: 60,
			stats: { health: 60, energy: 100 },
		});

		const ally = new (Creature as any)({
			id: 101,
			team: 0,
			type: 'B0',
			health: 20,
			stats: { health: 50 },
			hexagons: [{ x: 4, y: 3 }],
		});

		game.grid.getHexLine.mockReturnValue([
			{ x: 3, y: 3, creature: cycloper },
			{ x: 4, y: 3, creature: ally },
		]);

		const abilityDef = game.abilities[15][1];
		const opticBurst = {
			...abilityDef,
			creature: cycloper,
			damages: { burn: 30 },
			isUpgraded: () => true,
			end: jest.fn(),
		};

		opticBurst.activate([{ x: 4, y: 3, creature: ally }], {
			direction: 1,
			hex: { x: 4, y: 3, creature: ally },
		});

		expect(ally.heal).toHaveBeenCalledWith(30);
	});

	test('Optic Burst upgraded heals nearest wounded ally when ally and enemy are inline', () => {
		const cycloper = new (Creature as any)({
			id: 15,
			team: 0,
			type: 'W0',
			x: 3,
			y: 3,
			hexagons: [{ x: 3, y: 3 }],
			player: { id: 0, flipped: false, creatures: [] },
			health: 60,
			stats: { health: 60, energy: 100 },
		});

		const ally = new (Creature as any)({
			id: 104,
			team: 0,
			type: 'B0',
			health: 25,
			stats: { health: 50 },
			hexagons: [{ x: 4, y: 3 }],
		});

		const enemy = new (Creature as any)({
			id: 204,
			team: 1,
			type: 'A1',
			health: 80,
			stats: { health: 80 },
			hexagons: [{ x: 5, y: 3 }],
		});

		game.grid.getHexLine.mockReturnValue([
			{ x: 3, y: 3, creature: cycloper },
			{ x: 4, y: 3, creature: ally },
			{ x: 5, y: 3, creature: enemy },
		]);

		const abilityDef = game.abilities[15][1];
		const opticBurst = {
			...abilityDef,
			creature: cycloper,
			damages: { burn: 30 },
			isUpgraded: () => true,
			end: jest.fn(),
		};

		opticBurst.activate(
			[
				{ x: 4, y: 3, creature: ally },
				{ x: 5, y: 3, creature: enemy },
			],
			{ direction: 1 },
		);

		expect(ally.heal).toHaveBeenCalledWith(30);
		expect(enemy.takeDamage).not.toHaveBeenCalled();
	});

	test('Optic Burst upgraded query dashes path beyond wounded ally blocker', () => {
		const cycloper = new (Creature as any)({
			id: 15,
			team: 0,
			type: 'W0',
			x: 3,
			y: 3,
			hexagons: [{ x: 3, y: 3 }],
			player: { id: 0, flipped: false, creatures: [] },
			health: 60,
			stats: { health: 60, energy: 100 },
		});

		const ally = new (Creature as any)({
			id: 105,
			team: 0,
			type: 'B0',
			health: 20,
			stats: { health: 50 },
			hexagons: [{ x: 4, y: 3 }],
		});

		const enemy = new (Creature as any)({
			id: 205,
			team: 1,
			type: 'A1',
			health: 80,
			stats: { health: 80 },
			hexagons: [{ x: 5, y: 3 }],
		});

		const allyHex = { x: 4, y: 3, creature: ally } as any;
		const enemyHex = { x: 5, y: 3, creature: enemy } as any;

		game.grid.getDirectionChoices.mockReturnValue({
			choices: [[allyHex, enemyHex]],
			hexesDashed: [],
		});

		const abilityDef = game.abilities[15][1];
		const opticBurst = {
			...abilityDef,
			creature: cycloper,
			isUpgraded: () => true,
			animation: jest.fn(),
		};

		opticBurst.query();

		expect(game.grid.queryChoice).toHaveBeenCalledTimes(1);
		const queryArg = game.grid.queryChoice.mock.calls[0][0];
		expect(queryArg.choices[0]).toEqual([allyHex]);
		expect(queryArg.hexesDashed).toContain(enemyHex);
	});

	test('Power Aperture require sets no-energy-in-range message/flag when targets are in range but unaffordable', () => {
		const cycloper = new (Creature as any)({
			id: 15,
			team: 0,
			type: 'W0',
			x: 3,
			y: 3,
			hexagons: [{ x: 3, y: 3 }],
			player: { id: 0, flipped: false, creatures: [] },
			health: 60,
			energy: 5,
			stats: { health: 60, energy: 100 },
		});

		const priceyEnemy = new (Creature as any)({
			id: 201,
			team: 1,
			type: 'A1',
			health: 12,
			stats: { health: 12 },
			hexagons: [{ x: 5, y: 3 }],
		});

		game.grid.getDirectionChoices.mockReturnValue({
			choices: [[{ x: 5, y: 3, creature: priceyEnemy, direction: 1 }]],
			hexesDashed: [],
		});
		game.grid.getHexLine.mockReturnValue([
			{ x: 3, y: 3, creature: cycloper },
			{ x: 4, y: 3, creature: null },
			{ x: 5, y: 3, creature: priceyEnemy },
		]);

		const abilityDef = game.abilities[15][3];
		const powerAperture = {
			...abilityDef,
			creature: cycloper,
			isUpgraded: () => false,
			testRequirements: () => true,
			message: '',
		};

		expect(powerAperture.require()).toBe(false);
		expect(powerAperture.message).toBe('Not enough energy for targets in range.');
		expect((powerAperture as any)._noAffordableApertureTargetInRange).toBe(true);
	});

	test('Power Aperture uses max health by default and current health when upgraded', () => {
		const cycloper = new (Creature as any)({
			id: 15,
			team: 0,
			type: 'W0',
			x: 3,
			y: 3,
			hexagons: [{ x: 3, y: 3 }],
			player: { id: 0, flipped: false, creatures: [] },
			health: 60,
			energy: 10,
			stats: { health: 60, energy: 100 },
		});

		const damagedEnemy = new (Creature as any)({
			id: 202,
			team: 1,
			type: 'A1',
			health: 8,
			stats: { health: 20 },
			hexagons: [{ x: 5, y: 3 }],
		});

		game.grid.getDirectionChoices.mockReturnValue({
			choices: [[{ x: 5, y: 3, creature: damagedEnemy, direction: 1 }]],
			hexesDashed: [],
		});
		game.grid.getHexLine.mockReturnValue([
			{ x: 3, y: 3, creature: cycloper },
			{ x: 4, y: 3, creature: null },
			{ x: 5, y: 3, creature: damagedEnemy },
		]);

		const abilityDef = game.abilities[15][3];

		const defaultPowerAperture = {
			...abilityDef,
			creature: cycloper,
			isUpgraded: () => false,
			testRequirements: () => true,
			message: '',
		};

		expect(defaultPowerAperture.require()).toBe(false);
		expect(defaultPowerAperture.message).toBe('Not enough energy for targets in range.');

		const upgradedPowerAperture = {
			...abilityDef,
			creature: cycloper,
			isUpgraded: () => true,
			testRequirements: () => true,
			message: '',
		};

		expect(upgradedPowerAperture.require()).toBe(true);
		expect((upgradedPowerAperture as any)._noAffordableApertureTargetInRange).toBe(false);
	});

	test('Power Aperture applies materialization sickness to target after teleport', async () => {
		const cycloper = new (Creature as any)({
			id: 15,
			team: 0,
			type: 'W0',
			x: 3,
			y: 3,
			hexagons: [{ x: 3, y: 3 }],
			player: { id: 0, flipped: false, creatures: [] },
			health: 60,
			energy: 100,
			stats: { health: 60, energy: 100 },
		});
		game.activeCreature = cycloper;

		const target = new (Creature as any)({
			id: 202,
			team: 1,
			type: 'A1',
			x: 5,
			y: 3,
			hexagons: [{ x: 5, y: 3 }],
			player: { id: 1, flipped: true, creatures: [] },
			health: 20,
			stats: { health: 20, energy: 50 },
		});

		target.materializationSickness = false;
		target._nextGameTurnActive = 4;
		target.pos = { x: 5, y: 3 };
		target.hexagons = [{ x: 5, y: 3 }];

		game.Phaser = undefined;
		game.grid.hexes = [
			[],
			[],
			[],
			[
				{ x: 0, y: 3 },
				{ x: 1, y: 3 },
				{ x: 2, y: 3 },
				{ x: 3, y: 3 },
				{ x: 4, y: 3 },
				{ x: 5, y: 3 },
			],
		];

		const abilityDef = game.abilities[15][3];
		const powerAperture = {
			...abilityDef,
			creature: cycloper,
			_energySelfUpgraded: 5,
			costs: { energy: 0 },
			end: jest.fn(),
		};

		powerAperture.activate(target, { x: 5, y: 3, pos: { x: 5, y: 3 } });
		await Promise.resolve();
		await Promise.resolve();

		expect(target.materializationSickness).toBe(true);
		expect(target._nextGameTurnActive).toBe(5);
		expect(game.updateQueueDisplay).toHaveBeenCalled();
		expect(powerAperture.end).toHaveBeenCalled();
	});
});
