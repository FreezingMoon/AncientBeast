import { beforeEach, describe, expect, jest, test } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-explicit-any */

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
		display: { width: number; height: number; 'offset-x': number; 'offset-y': number };
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
		queryMove = jest.fn();
		tracePosition = jest.fn();
		faceHex = jest.fn();
		creatureSprite = {
			grp: {
				angle: 0,
				add: jest.fn((child) => child),
			},
			sprite: {
				originX: 0.5,
				originY: 1,
				scaleX: 1,
				scaleY: 1,
				angle: 0,
				x: 0,
				y: 0,
				frame: {
					realWidth: 90,
					realHeight: 120,
				},
				width: 90,
				height: 120,
			},
			setDir: jest.fn(),
			setAlpha: jest.fn(),
			setHex: jest.fn(() => Promise.resolve()),
			getPos: jest.fn(() => ({ x: 0, y: 0 })),
			_resolveSpriteDrawSource: jest.fn(() => null),
		};
		sprite = {
			alpha: 1,
			x: 0,
			y: 0,
			anchor: { x: 0.5, y: 1 },
			scale: { x: 1, y: 1 },
			angle: 0,
			key: 'unit',
			frame: {
				realWidth: 90,
				realHeight: 120,
			},
			height: 120,
			width: 90,
			setCrop: jest.fn(),
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
			this.display = init.display ?? { width: 90, height: 120, 'offset-x': 0, 'offset-y': -145 };
		}
	}

	return { Creature: CreatureMock };
});

import loadCycloperAbilities from '../../abilities/Cycloper';
import { Creature } from '../../creature';

(globalThis as { Phaser?: unknown }).Phaser = {
	Easing: {
		Linear: { None: 0 },
		Cubic: { Out: 0 },
	},
};

describe('Cycloper abilities', () => {
	let game: any;

	beforeEach(() => {
		jest.useFakeTimers();
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
				creatureGroup: {
					add: jest.fn(),
					addAt: jest.fn(),
					remove: jest.fn(),
					create: jest.fn(() => ({
						setOrigin: jest.fn(),
						setScale: jest.fn(),
						angle: 0,
						tint: 0,
						alpha: 0,
						x: 0,
						y: 0,
						destroy: jest.fn(),
					})),
				},
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
				// The tile-dissolve path copies the unit's cardboard into per-tile
				// surfaces, so it needs a real canvas texture to copy from — the
				// source in these tests is a plain object, which a genuine jsdom
				// context would (correctly) refuse to `drawImage`.
				textures: {
					createCanvas: jest.fn((key: string, width: number, height: number) => ({
						key,
						width,
						height,
						canvas: { width, height } as HTMLCanvasElement,
						getContext: () => ({
							clearRect: jest.fn(),
							save: jest.fn(),
							restore: jest.fn(),
							translate: jest.fn(),
							scale: jest.fn(),
							drawImage: jest.fn(),
						}),
						refresh: jest.fn(),
					})),
					remove: jest.fn(),
				},
				add: {
					group: jest.fn(() => ({ x: 0, y: 0, alpha: 1, destroy: jest.fn() })),
					sprite: jest.fn(() => ({
						setOrigin: jest.fn(),
						setScale: jest.fn(),
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
			gameEngine: {
				add: {
					graphics: jest.fn(() => ({
						beginFill: jest.fn(),
						drawRect: jest.fn(),
						endFill: jest.fn(),
						clear: jest.fn(),
						lineStyle: jest.fn(),
						moveTo: jest.fn(),
						lineTo: jest.fn(),
						drawCircle: jest.fn(),
						strokePath: jest.fn(),
						mask: null,
						destroy: jest.fn(),
					})),
					sprite: () => ({
						setOrigin: jest.fn(),
						setScale: jest.fn(),
						angle: 0,
						tint: 0,
						alpha: 0,
						x: 0,
						y: 0,
						destroy: jest.fn(),
					}),
					group: () => ({ children: [], add: () => {}, addAt: () => {}, remove: () => {} }),
					tileSprite: () => ({}),
					socket: () => ({
						setOrigin: jest.fn(),
						setScale: jest.fn(),
						angle: 0,
						destroy: jest.fn(),
					}),
					image: () => ({}),
					text: () => ({}),
				},
				removeTweensFrom: jest.fn(),
				tween: () => {
					const onComplete = {
						add: (fn: (this: unknown) => void, context?: unknown) => fn.call(context ?? {}),
						addOnce: (fn: (this: unknown) => void, context?: unknown) => fn.call(context ?? {}),
					};
					const afterStart = { stop: () => ({}), onComplete };
					const afterTo = { start: () => afterStart, stop: () => ({}), onComplete };
					return { to: () => afterTo, start: () => afterStart, stop: () => ({}), onComplete };
				},
				time: {
					now: 0,
					add: jest.fn(),
					loop: jest.fn(),
					remove: jest.fn(),
				},
			},
		};

		globalThis.G = game as never;
		loadCycloperAbilities(game as never);
	});

	test('Riot Shield leaves every previously printed wall standing', () => {
		// Riot Shield beams relay through the Cycloper's own walls, so printing a
		// second wall through the first used to destroy the first. It stayed on the
		// board as a corpse with no cardboard — attackable and shatterable at its
		// original hex, invisible, and re-appearing displaced once something else
		// touched the orphaned sprite.
		const cycloper = new (Creature as any)({
			id: 15,
			team: 0,
			type: 'W0',
			x: 3,
			y: 3,
			hexagons: [{ x: 3, y: 3, displayPos: { x: 270, y: 234 } }],
			player: { id: 0, flipped: false, creatures: [] },
			health: 60,
			stats: { health: 60, energy: 100 },
		});
		cycloper.queryMove = jest.fn();
		game.creatures = [];

		const riotShield = {
			...game.abilities[15][2],
			creature: cycloper,
			isUpgraded: () => true,
			end: jest.fn(),
		};

		riotShield.activate({ x: 4, y: 3, creature: undefined });
		jest.runAllTimers();

		const firstWall = cycloper.player.creatures[0];
		expect(firstWall).toBeDefined();
		expect(firstWall.x).toBe(4);

		// Second print, one hex further out along the same beam.
		riotShield.activate({ x: 5, y: 3, creature: undefined });
		jest.runAllTimers();

		expect(cycloper.player.creatures).toHaveLength(2);
		expect(cycloper.player.creatures[1].x).toBe(5);
		expect(firstWall.destroy).not.toHaveBeenCalled();
		// The print reveal must be fully released on both walls, or the cardboard
		// is left cropped and reads as drawn somewhere else entirely.
		expect(firstWall.sprite.setCrop).toHaveBeenLastCalledWith();
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
		jest.runAllTimers();

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
			id: 200,
			team: 1,
			type: 'A1',
			health: 80,
			stats: { health: 80 },
			hexagons: [{ x: 5, y: 3 }],
			takeDamage: jest.fn(),
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
			id: 200,
			team: 1,
			type: 'A1',
			health: 80,
			stats: { health: 80 },
			hexagons: [{ x: 5, y: 3 }],
			takeDamage: jest.fn(),
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

	test('Power Aperture keeps the selected target visible when no destination hex is available', () => {
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
			id: 203,
			team: 1,
			type: 'A1',
			x: 5,
			y: 3,
			hexagons: [{ x: 5, y: 3 }],
			player: { id: 1, flipped: true, creatures: [] },
			health: 20,
			stats: { health: 20, energy: 50 },
		});

		game.grid.getDirectionChoices
			.mockReturnValueOnce({
				choices: [[{ x: 5, y: 3, creature: target, direction: 1 }]],
				hexesDashed: [],
			})
			.mockReturnValueOnce({ choices: [[]], hexesDashed: [] });
		game.grid.getHexLine.mockReturnValue([
			{ x: 3, y: 3, creature: cycloper },
			{ x: 4, y: 3, creature: null },
			{ x: 5, y: 3, creature: target },
		]);

		const abilityDef = game.abilities[15][3];
		const powerAperture = {
			...abilityDef,
			creature: cycloper,
			isUpgraded: () => false,
			testRequirements: () => true,
			message: '',
		};

		powerAperture.query();
		const queryArgs = game.grid.queryDirection.mock.calls[0][0];
		queryArgs.fnOnConfirm(
			[
				{ x: 4, y: 3, creature: null },
				{ x: 5, y: 3, creature: target },
			],
			{ direction: 1 },
		);

		expect(target.sprite.alpha).toBe(1);
		expect(target.sprite.visible).not.toBe(false);
		expect(target.grp.visible).not.toBe(false);
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

	test('Power Aperture restores target visibility when activation aborts on energy check', () => {
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

		const target = new (Creature as any)({
			id: 204,
			team: 1,
			type: 'A1',
			x: 5,
			y: 3,
			hexagons: [{ x: 5, y: 3 }],
			player: { id: 1, flipped: true, creatures: [] },
			health: 20,
			stats: { health: 20, energy: 50 },
		});

		target.grp.alpha = 0;
		target.grp.visible = false;
		target.grp.renderable = false;
		target.sprite.alpha = 0;
		target.sprite.visible = false;
		target.sprite.renderable = false;

		const abilityDef = game.abilities[15][3];
		const powerAperture = {
			...abilityDef,
			creature: cycloper,
			_energySelfUpgraded: 20,
			message: '',
		};

		powerAperture.activate(target, { x: 6, y: 3, pos: { x: 6, y: 3 } });

		expect(powerAperture.message).toBe('Not enough energy.');
		expect(target.grp.alpha).toBe(1);
		expect(target.grp.visible).toBe(true);
		expect(target.grp.renderable).toBe(true);
		expect(target.sprite.alpha).toBe(1);
		expect(target.sprite.visible).toBe(true);
		expect(target.sprite.renderable).toBe(true);
		expect(target.creatureSprite.setAlpha).toHaveBeenCalledWith(1, 1);
	});

	test('Power Aperture guards against hidden target from previous failed attempt', () => {
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

		const target = new (Creature as any)({
			id: 205,
			team: 1,
			type: 'A1',
			x: 5,
			y: 3,
			hexagons: [{ x: 5, y: 3 }],
			player: { id: 1, flipped: true, creatures: [] },
			health: 20,
			stats: { health: 20, energy: 50 },
		});

		target.grp.alpha = 0;
		target.grp.visible = false;
		target.grp.renderable = false;
		target.sprite.alpha = 0;
		target.sprite.visible = false;
		target.sprite.renderable = false;

		const abilityDef = game.abilities[15][3];
		const powerAperture = {
			...abilityDef,
			creature: cycloper,
			_energySelfUpgraded: 100,
			message: '',
		};

		powerAperture.activate(target, { x: 6, y: 3, pos: { x: 6, y: 3 } });

		expect(target.grp.alpha).toBe(1);
		expect(target.grp.visible).toBe(true);
		expect(target.grp.renderable).toBe(true);
		expect(target.sprite.alpha).toBe(1);
		expect(target.sprite.visible).toBe(true);
		expect(target.sprite.renderable).toBe(true);
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
		target.takeDamage = jest.fn();
		target.sprite = {
			texture: {
				crop: { x: 0, y: 0, width: 100, height: 100 },
				frame: { x: 0, y: 0, width: 100, height: 100 },
				baseTexture: { source: {} },
				width: 100,
				height: 100,
			},
			scale: { x: 1 },
			anchor: { y: 0 },
			width: 100,
			height: 100,
			x: 0,
			y: 0,
		};
		target.creatureSprite = {
			getPos: () => ({ x: 0, y: 0 }),
			setDir: jest.fn(),
			setAlpha: jest.fn(),
			setHex: jest.fn(() => Promise.resolve()),
		};

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
		jest.runAllTimers();
		await Promise.resolve();
		jest.runAllTimers();
		await Promise.resolve();

		expect(target.materializationSickness).toBe(true);
		expect(target._nextGameTurnActive).toBe(5);
		expect(game.updateQueueDisplay).toHaveBeenCalled();
		expect(powerAperture.end).toHaveBeenCalled();
	});

	/**
	 * The destination query used to be deferred by one tick for everyone. A bot
	 * confirms the direction query from inside its own resolver and drops the
	 * pending action as soon as that resolver returns, so a destination query
	 * opened on the next tick had nothing left to resolve it: the bot sat on a
	 * frozen query until its decision budget ran out and the ultimate was never
	 * used. Bots must get the destination query inline.
	 */
	const setUpApertureTargetQuery = (botDriven: boolean) => {
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
			id: 204,
			team: 1,
			type: 'A1',
			x: 5,
			y: 3,
			hexagons: [{ x: 5, y: 3 }],
			player: { id: 1, flipped: true, creatures: [] },
			health: 20,
			stats: { health: 20, energy: 50 },
		});

		const destinationHex = {
			x: 2,
			y: 3,
			pos: { x: 2, y: 3 },
			creature: null,
			isWalkable: () => true,
		};

		// queryDirection() is stubbed, so the only getDirectionChoices call left is
		// the destination scan inside beginDestinationQuery().
		game.grid.getDirectionChoices.mockReturnValue({
			choices: [[destinationHex]],
			hexesDashed: [],
		});
		game.grid.hexes = [
			[],
			[],
			[],
			[
				{ x: 0, y: 3 },
				{ x: 1, y: 3 },
				{ x: 2, y: 3, isWalkable: () => true },
			],
		];
		game.grid.getHexLine.mockReturnValue([
			{ x: 3, y: 3, creature: cycloper },
			{ x: 4, y: 3, creature: null },
			{ x: 5, y: 3, creature: target },
		]);
		game.grid.hexExists = jest.fn(() => true);
		game.grid.lastQueryOpt = { previous: true };
		game.grid.selectedHex = { x: 1, y: 1 };

		if (botDriven) {
			game.botController = { shouldAutoResolveQuery: jest.fn(() => true) };
		}

		const powerAperture = {
			...game.abilities[15][3],
			creature: cycloper,
			isUpgraded: () => false,
			testRequirements: () => true,
			message: '',
		};

		powerAperture.query();
		game.grid.queryDirection.mock.calls[0][0].fnOnConfirm(
			[
				{ x: 4, y: 3, creature: null },
				{ x: 5, y: 3, creature: target },
			],
			{ direction: 1 },
		);

		return powerAperture;
	};

	test('Power Aperture opens the destination query inline when a bot is driving', () => {
		const powerAperture = setUpApertureTargetQuery(true);

		expect(game.grid.queryHexes).toHaveBeenCalledTimes(1);
		expect(game.grid.queryHexes.mock.calls[0][0].hexes).toEqual([
			expect.objectContaining({ x: 2, y: 3 }),
		]);
		expect(powerAperture._awaitingApertureDestination).toBe(true);
	});

	test('Power Aperture keeps deferring the destination query for players', () => {
		const powerAperture = setUpApertureTargetQuery(false);

		expect(game.grid.queryHexes).not.toHaveBeenCalled();
		jest.runOnlyPendingTimers();
		expect(game.grid.queryHexes).toHaveBeenCalledTimes(1);
		expect(powerAperture._awaitingApertureDestination).toBe(true);
	});

	/**
	 * Power Aperture runs a ~2.4 s two-phase teleport, and `end()` used to run only
	 * once that finished. Nothing froze input in the meantime, so the Cycloper
	 * stayed both actionable and unspent for the whole animation — a bot, which
	 * re-decides on a timer and gates only on `game.freezedInput`, walked straight
	 * back into the query and cast the ultimate several times per turn, dragging
	 * the same victim over and over. The cast has to commit up front, the way
	 * Riot Shield does, and hand control back when the target lands.
	 */
	test('Power Aperture freezes input for the teleport and releases it once the target lands', async () => {
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
			stats: { health: 60, energy: 100, reqEnergy: 0 },
		});
		cycloper.queryMove = jest.fn(() => {
			game._deferredQueryMovePending -= 1;
			game.freezedInput = false;
		});
		game.activeCreature = cycloper;
		game.freezedInput = false;
		game._deferredQueryMovePending = 0;

		const target = new (Creature as any)({
			id: 205,
			team: 1,
			type: 'A1',
			x: 5,
			y: 3,
			hexagons: [{ x: 5, y: 3 }],
			player: { id: 1, flipped: true, creatures: [] },
			health: 20,
			stats: { health: 20, energy: 50 },
		});
		target.pos = { x: 5, y: 3 };
		target.sprite = {
			texture: {
				crop: { x: 0, y: 0, width: 100, height: 100 },
				frame: { x: 0, y: 0, width: 100, height: 100 },
				baseTexture: { source: {} },
				width: 100,
				height: 100,
			},
			scale: { x: 1 },
			anchor: { y: 0 },
			width: 100,
			height: 100,
			x: 0,
			y: 0,
		};
		target.creatureSprite = {
			getPos: () => ({ x: 0, y: 0 }),
			setDir: jest.fn(),
			setAlpha: jest.fn(),
			setHex: jest.fn(() => Promise.resolve()),
		};

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

		const powerAperture = {
			...game.abilities[15][3],
			creature: cycloper,
			_energySelfUpgraded: 20,
			costs: { energy: 1 },
			end: jest.fn((_disableLogMsg?: boolean, deferredEnding?: boolean) => {
				if (deferredEnding) {
					game.freezedInput = true;
					game._deferredQueryMovePending += 1;
				}
			}),
		};

		powerAperture.activate(target, { x: 5, y: 3, pos: { x: 5, y: 3 } });

		// Committed: energy spent, ability spent, input frozen for the animation.
		// The flat part of the cost (`costs.energy`) is charged by the real
		// `end()` through `applyCost()`, which the stub below stands in for.
		expect(powerAperture.end).toHaveBeenCalledWith(false, true);
		expect(game.freezedInput).toBe(true);
		expect(cycloper.energy).toBe(81);
		expect(cycloper.queryMove).not.toHaveBeenCalled();

		jest.runAllTimers();
		await Promise.resolve();
		jest.runAllTimers();
		await Promise.resolve();

		// Landed: the freeze is released through the Cycloper's own queryMove,
		// and `end()` is not called a second time.
		expect(cycloper.queryMove).toHaveBeenCalledTimes(1);
		expect(game.freezedInput).toBe(false);
		expect(powerAperture.end).toHaveBeenCalledTimes(1);
		expect(cycloper.energy).toBe(81);
	});

	test('Power Aperture clears the destination flag when the target query is reopened', () => {
		const powerAperture = setUpApertureTargetQuery(true);
		expect(powerAperture._awaitingApertureDestination).toBe(true);

		game.grid.getDirectionChoices.mockReturnValue({
			choices: [[{ x: 5, y: 3, direction: 1 }]],
			hexesDashed: [],
		});
		powerAperture.query();
		expect(powerAperture._awaitingApertureDestination).toBe(false);
	});
});
