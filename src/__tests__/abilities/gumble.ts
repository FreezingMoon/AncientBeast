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

jest.mock('../../utility/trap', () => ({
	Trap: class TrapMock {
		static created: any[] = [];
		x: number;
		y: number;
		type: string;
		constructor(x: number, y: number, type: string) {
			this.x = x;
			this.y = y;
			this.type = type;
			TrapMock.created.push(this);
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
		stats: { health: number; energy?: number; endurance?: number };
		endurance: number;
		hexagons: Array<{ x: number; y: number; creature?: unknown }>;
		x: number;
		y: number;
		pos: { x: number; y: number };
		size: number;
		player: { id: number; flipped: boolean; creatures: unknown[]; plasma?: number };
		energy: number;
		takeDamage = jest.fn(() => ({ kill: false }));
		heal = jest.fn((amount: number) => {
			this.health = Math.min(this.stats.health, this.health + amount);
		});
		addEffect = jest.fn();
		removeEffect = jest.fn();
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
		isDarkPriest = jest.fn(() => false);
		hasCreaturePlayerGotPlasma = jest.fn(() => false);
		adjacentHexes = jest.fn(() => []);
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
			this.endurance = init.stats?.endurance ?? 1;
		}
	}

	return { Creature: CreatureMock };
});

import loadGumbleAbilities from '../../abilities/Gumble';
import { Creature } from '../../creature';

describe('Gumble abilities', () => {
	let game: any;

	beforeEach(() => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(jest.requireMock('../../utility/trap') as any).Trap.created.length = 0;
		game = {
			abilities: [],
			creatureData: [],
			effects: [],
			activeCreature: null,
			log: jest.fn(),
			grid: {
				hexAt: jest.fn(() => ({ x: 4, y: 4 })),
				forEachHex: jest.fn(),
				updateDisplay: jest.fn(),
				hexes: [],
				queryChoice: jest.fn(),
				queryDirection: jest.fn(),
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
				camera: {
					shake: jest.fn(),
					SHAKE_VERTICAL: 'SHAKE_VERTICAL',
					SHAKE_HORIZONTAL: 'SHAKE_HORIZONTAL',
				},
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

		loadGumbleAbilities(game as never);
	});

	test('Gummy Mallet deals double damage to enemies when upgraded', () => {
		const gumble = new (Creature as any)({
			id: 14,
			team: 0,
			type: 'S1',
			x: 3,
			y: 3,
			hexagons: [{ x: 3, y: 3 }],
			player: { id: 0, flipped: false, creatures: [] },
		});

		const ally = new (Creature as any)({
			id: 100,
			team: 0,
			type: 'S2',
			health: 50,
			stats: { health: 60 },
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

		const abilityDef = game.abilities[14][1];
		const mallet = {
			...abilityDef,
			creature: gumble,
			damages: { crush: 20 },
			isUpgraded: () => true,
			end: jest.fn(),
			getTargets: jest.fn(() => [
				{ target: ally, hexesHit: 1 },
				{ target: enemy, hexesHit: 1 },
			]),
		};

		mallet.activate([
			{ x: 4, y: 3, creature: ally },
			{ x: 5, y: 3, creature: enemy },
		]);

		expect(enemy.takeDamage).toHaveBeenCalledTimes(1);
		expect(ally.takeDamage).toHaveBeenCalledTimes(1);
		// Enemy damage must be doubled, ally damage must not.
		const enemyDamage = enemy.takeDamage.mock.calls[0][0];
		const allyDamage = ally.takeDamage.mock.calls[0][0];
		expect(enemyDamage.damages.crush).toBe(40);
		expect(allyDamage.damages.crush).toBe(20);
	});

	test('Gummy Mallet scores a combo when multiple targets die', () => {
		const gumble = new (Creature as any)({
			id: 14,
			team: 0,
			type: 'S1',
			x: 3,
			y: 3,
			hexagons: [{ x: 3, y: 3 }],
			player: { id: 0, flipped: false, creatures: [] },
		});

		gumble.player.score = { push: jest.fn() };

		const enemyA = new (Creature as any)({
			id: 200,
			team: 1,
			type: 'A1',
			health: 1,
			stats: { health: 1 },
			hexagons: [{ x: 4, y: 3 }],
		});
		const enemyB = new (Creature as any)({
			id: 201,
			team: 1,
			type: 'A2',
			health: 1,
			stats: { health: 1 },
			hexagons: [{ x: 5, y: 3 }],
		});
		enemyA.takeDamage = jest.fn(() => ({ kill: true }));
		enemyB.takeDamage = jest.fn(() => ({ kill: true }));

		const abilityDef = game.abilities[14][1];
		const mallet = {
			...abilityDef,
			creature: gumble,
			damages: { crush: 20 },
			isUpgraded: () => false,
			end: jest.fn(),
			getTargets: jest.fn(() => [
				{ target: enemyA, hexesHit: 1 },
				{ target: enemyB, hexesHit: 1 },
			]),
		};

		mallet.activate([{ x: 4, y: 3, creature: enemyA }]);

		expect(gumble.player.score.push).toHaveBeenCalledWith({ type: 'combo', kills: 2 });
	});

	test('Pretty Ribbon heals wounded ally and applies regrowth and endurance buff', () => {
		const gumble = new (Creature as any)({
			id: 14,
			team: 0,
			type: 'S1',
			x: 3,
			y: 3,
			hexagons: [{ x: 3, y: 3 }],
			player: { id: 0, flipped: false, creatures: [] },
		});

		const ally = new (Creature as any)({
			id: 100,
			team: 0,
			type: 'S2',
			health: 30,
			stats: { health: 60 },
			hexagons: [{ x: 4, y: 3 }],
		});

		const abilityDef = game.abilities[14][2];
		const ribbon = {
			...abilityDef,
			title: 'Pretty Ribbon',
			creature: gumble,
			isUpgraded: () => false,
			end: jest.fn(),
		};

		ribbon.activate(ally);

		expect(ally.heal).toHaveBeenCalledWith(20, false, false);
		expect(ally.addEffect).toHaveBeenCalledTimes(1);
		const effectArg = ally.addEffect.mock.calls[0][0];
		expect(effectArg.alterations).toEqual({ regrowth: 2, endurance: 2 });
	});

	test('Pretty Ribbon on upgraded Gumble debuffs an enemy instead of healing', () => {
		const gumble = new (Creature as any)({
			id: 14,
			team: 0,
			type: 'S1',
			x: 3,
			y: 3,
			hexagons: [{ x: 3, y: 3 }],
			player: { id: 0, flipped: false, creatures: [] },
		});

		const enemy = new (Creature as any)({
			id: 200,
			team: 1,
			type: 'A1',
			health: 80,
			stats: { health: 80 },
			hexagons: [{ x: 5, y: 3 }],
		});

		const abilityDef = game.abilities[14][2];
		const ribbon = {
			...abilityDef,
			title: 'Pretty Ribbon',
			creature: gumble,
			isUpgraded: () => true,
			end: jest.fn(),
		};

		ribbon.activate(enemy);

		expect(enemy.heal).not.toHaveBeenCalled();
		expect(enemy.addEffect).toHaveBeenCalledTimes(1);
		const effectArg = enemy.addEffect.mock.calls[0][0];
		expect(effectArg.alterations).toEqual({ movement: -2 });
		// Debuff is not stackable and expires at start phase.
		expect(effectArg.stackable).toBe(false);
		expect(effectArg.deleteTrigger).toBe('onStartPhase');
	});

	test('Pretty Ribbon hits a plasma-shielded Dark Priest for damage instead of debuff', () => {
		const gumble = new (Creature as any)({
			id: 14,
			team: 0,
			type: 'S1',
			x: 3,
			y: 3,
			hexagons: [{ x: 3, y: 3 }],
			player: { id: 0, flipped: false, creatures: [] },
		});

		const darkPriest = new (Creature as any)({
			id: 300,
			team: 1,
			type: '--',
			health: 80,
			stats: { health: 80 },
			hexagons: [{ x: 5, y: 3 }],
		});
		darkPriest.isDarkPriest = jest.fn(() => true);
		darkPriest.hasCreaturePlayerGotPlasma = jest.fn(() => true);

		const abilityDef = game.abilities[14][2];
		const ribbon = {
			...abilityDef,
			title: 'Pretty Ribbon',
			creature: gumble,
			isUpgraded: () => true,
			end: jest.fn(),
		};

		ribbon.activate(darkPriest);

		expect(darkPriest.takeDamage).toHaveBeenCalledTimes(1);
		expect(darkPriest.addEffect).not.toHaveBeenCalled();
	});

	test('Boom Box deals melee crush bonus damage when target is adjacent', () => {
		const gumble = new (Creature as any)({
			id: 14,
			team: 0,
			type: 'S1',
			x: 3,
			y: 3,
			hexagons: [{ x: 3, y: 3 }],
			player: { id: 0, flipped: false, creatures: [] },
		});

		const enemy = new (Creature as any)({
			id: 200,
			team: 1,
			type: 'A1',
			health: 80,
			stats: { health: 80, moveable: true },
			hexagons: [{ x: 4, y: 3 }],
		});

		game.grid.getHexMap = jest.fn(() => [
			{ x: 4, y: 3, creature: enemy },
			{ x: 5, y: 3, creature: undefined, isWalkable: jest.fn(() => false) },
		]);

		const abilityDef = game.abilities[14][3];
		const boomBox = {
			...abilityDef,
			creature: gumble,
			isUpgraded: () => false,
			end: jest.fn(),
		};

		boomBox.activate([{ x: 4, y: 3, creature: enemy }], { direction: 1 });

		expect(enemy.takeDamage).toHaveBeenCalledTimes(1);
		const damage = enemy.takeDamage.mock.calls[0][0];
		expect(damage.damages.sonic).toBe(20);
		expect(damage.damages.crush).toBe(10);
	});

	test('Boom Box upgraded adds sonic damage when target cannot be knocked back', () => {
		const gumble = new (Creature as any)({
			id: 14,
			team: 0,
			type: 'S1',
			x: 3,
			y: 3,
			hexagons: [{ x: 3, y: 3 }],
			player: { id: 0, flipped: false, creatures: [] },
		});

		const enemy = new (Creature as any)({
			id: 200,
			team: 1,
			type: 'A1',
			health: 80,
			stats: { health: 80, moveable: false },
			hexagons: [{ x: 4, y: 3 }],
		});

		game.grid.getHexMap = jest.fn(() => [
			{ x: 4, y: 3, creature: enemy },
			{ x: 5, y: 3, creature: undefined, isWalkable: jest.fn(() => false) },
		]);

		const abilityDef = game.abilities[14][3];
		const boomBox = {
			...abilityDef,
			creature: gumble,
			isUpgraded: () => true,
			end: jest.fn(),
		};

		// Target at the end of the path (not in path[0]) means not melee-adjacent.
		boomBox.activate(
			[
				{ x: 3, y: 3, creature: gumble },
				{ x: 4, y: 3, creature: enemy },
			],
			{ direction: 1 },
		);

		const damage = enemy.takeDamage.mock.calls[0][0];
		expect(damage.damages.sonic).toBe(30); // 20 + 10 no-knockback bonus
		expect(damage.damages.crush).toBeUndefined(); // not melee
	});

	test('Gooey Body creates a goo trap at the death location on death', () => {
		const gumble = new (Creature as any)({
			id: 14,
			team: 0,
			type: 'S1',
			x: 4,
			y: 4,
			hexagons: [{ x: 4, y: 4 }],
			player: { id: 0, flipped: false, creatures: [] },
		});

		const dead = new (Creature as any)({
			id: 200,
			team: 1,
			type: 'A1',
			health: 0,
			stats: { health: 10 },
			hexagons: [{ x: 4, y: 4 }],
		});

		const abilityDef = game.abilities[14][0];
		const gooey = {
			...abilityDef,
			creature: gumble,
			isUpgraded: () => false,
		};

		gooey.activate(dead);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const TrapMock = (jest.requireMock('../../utility/trap') as any).Trap;
		expect(TrapMock.created).toHaveLength(1);
		expect(TrapMock.created[0].type).toBe('gooey-body');
		expect(TrapMock.created[0].x).toBe(4);
		expect(TrapMock.created[0].y).toBe(4);
		// Non-upgraded death must not set up the BRB revival state.
		expect(gumble._brbActive).toBeUndefined();
		expect(gumble._brbState).toBeUndefined();
		expect(game.log).toHaveBeenCalledWith('%CreatureName200% melts into a gooey puddle');
	});

	test('Gooey Body upgraded sets up BRB revival state on death', () => {
		const gumble = new (Creature as any)({
			id: 14,
			team: 0,
			type: 'S1',
			x: 4,
			y: 4,
			hexagons: [{ x: 4, y: 4 }],
			player: { id: 0, flipped: false, creatures: [] },
		});

		const dead = new (Creature as any)({
			id: 200,
			team: 1,
			type: 'A1',
			health: 0,
			stats: { health: 10 },
			hexagons: [{ x: 4, y: 4 }],
		});

		const abilityDef = game.abilities[14][0];
		const gooey = {
			...abilityDef,
			creature: gumble,
			isUpgraded: () => true,
		};

		gooey.activate(dead);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const TrapMock = (jest.requireMock('../../utility/trap') as any).Trap;
		expect(TrapMock.created).toHaveLength(1);
		expect(gumble._brbActive).toBe(true);
		expect(gumble._brbState).toEqual({ killer: null, gooTrap: TrapMock.created[0] });
	});
});
