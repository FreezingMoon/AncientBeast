import { beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.mock('phaser-ce', () => ({
	Point: class PointMock {},
	Polygon: class PolygonMock {},
}));

jest.mock('../../utility/hex', () => ({
	Direction: {
		Right: 0,
		DownRight: 1,
		DownLeft: 2,
		Left: 3,
		UpLeft: 4,
		UpRight: 5,
	},
	Hex: class HexMock {
		x: number;
		y: number;
		constructor(x: number, y: number) {
			this.x = x;
			this.y = y;
		}
	},
}));

jest.mock('../../damage', () => ({
	Damage: class DamageMock {
		damages: unknown;
		effects: unknown;
		constructor(
			_attacker: unknown,
			damages: unknown,
			_area: number,
			effects: unknown,
			_game: unknown,
		) {
			this.damages = damages;
			this.effects = effects;
		}
	},
}));

jest.mock('../../effect', () => ({
	Effect: class EffectMock {
		name: string;
		owner: unknown;
		target: unknown;
		trigger: string;
		alterations: Record<string, number>;
		stackable: boolean;
		turnLifetime: number;
		constructor(
			name: string,
			owner: unknown,
			target: unknown,
			trigger: string,
			optArgs: {
				alterations?: Record<string, number>;
				stackable?: boolean;
				turnLifetime?: number;
			},
		) {
			this.name = name;
			this.owner = owner;
			this.target = target;
			this.trigger = trigger;
			this.alterations = optArgs.alterations ?? {};
			this.stackable = optArgs.stackable ?? true;
			this.turnLifetime = optArgs.turnLifetime ?? 0;
		}
	},
}));

jest.mock('../../creature', () => ({
	Creature: class CreatureMock {},
}));

import loadKnightmareAbilities from '../../abilities/Knightmare';
import { Creature } from '../../creature';

type MockEffect = {
	name: string;
	alterations: Record<string, number>;
	turnLifetime?: number;
};

type MockCreature = {
	baseStats: Record<string, number>;
	stats: Record<string, number>;
	effects: MockEffect[];
	travelDist: number;
	addEffect: (effect: MockEffect) => void;
	updateAlteration: () => void;
};

function createCreature(): MockCreature {
	const creature: MockCreature = {
		baseStats: {
			offense: 10,
			defense: 20,
			frost: 30,
		},
		stats: {
			offense: 10,
			defense: 20,
			frost: 30,
		},
		effects: [],
		travelDist: 0,
		addEffect(effect) {
			this.effects.push(effect);
			this.updateAlteration();
		},
		updateAlteration() {
			this.stats = { ...this.baseStats };
			for (const effect of this.effects) {
				for (const [key, value] of Object.entries(effect.alterations || {})) {
					if (typeof value === 'number') {
						this.stats[key] = (this.stats[key] ?? 0) + value;
					}
				}
			}
		},
	};

	return creature;
}

describe('Knightmare Frigid Tower', () => {
	let game: { abilities: unknown[]; effectId: number; effects: unknown[] };
	let creature: MockCreature;
	let upgraded: boolean;
	let frigidTower: {
		_effectName: string;
		require: () => boolean;
		activate: () => void;
		isUpgraded: () => boolean;
		testRequirements: () => boolean;
		creature: MockCreature;
	};

	beforeEach(() => {
		game = {
			abilities: [],
			effectId: 0,
			effects: [],
		};
		loadKnightmareAbilities(game as never);

		creature = createCreature();
		upgraded = false;

		const abilityDef = (game.abilities[9] as Array<Record<string, unknown>>)[0];
		frigidTower = {
			...(abilityDef as object),
			creature,
			isUpgraded: () => upgraded,
			testRequirements: () => true,
		} as typeof frigidTower;
	});

	test('adds cumulative frost/defense stacks when Knightmare does not move', () => {
		expect(frigidTower.require()).toBe(true);
		frigidTower.activate();

		expect(creature.stats.defense).toBe(25);
		expect(creature.stats.frost).toBe(35);
		expect(creature.stats.offense).toBe(10);
		expect(creature.effects[0].turnLifetime).toBe(-1);

		expect(frigidTower.require()).toBe(true);
		frigidTower.activate();

		expect(creature.stats.defense).toBe(30);
		expect(creature.stats.frost).toBe(40);
		expect(creature.stats.offense).toBe(10);
	});

	test('does not add a new stack when Knightmare moved on its own turn', () => {
		expect(frigidTower.require()).toBe(true);
		frigidTower.activate();
		expect(creature.effects).toHaveLength(1);

		creature.travelDist = 1;
		expect(frigidTower.require()).toBe(false);
		expect(creature.effects).toHaveLength(1);
		expect(creature.stats.defense).toBe(25);
		expect(creature.stats.frost).toBe(35);
	});

	test('upgrade grants offense to existing and new Frigid Tower stacks', () => {
		expect(frigidTower.require()).toBe(true);
		frigidTower.activate();
		expect(creature.stats.offense).toBe(10);

		upgraded = true;
		expect(frigidTower.require()).toBe(true);
		frigidTower.activate();

		expect(creature.stats.offense).toBe(20);
		expect(creature.stats.defense).toBe(30);
		expect(creature.stats.frost).toBe(40);
	});
});

describe('Knightmare Icy Talons', () => {
	test('applies a stackable persistent frost debuff', () => {
		const game = {
			abilities: [],
			effectId: 0,
			effects: [],
			Phaser: {
				camera: {
					SHAKE_HORIZONTAL: 0,
					shake: jest.fn(),
				},
			},
		};
		loadKnightmareAbilities(game as never);

		const attacker = {
			id: 9,
			size: 2,
		};
		const target = {
			size: 1,
			takeDamage: jest.fn(),
		};

		const icyTalons = {
			...((game.abilities[9] as Array<Record<string, unknown>>)[1] as object),
			creature: attacker,
			damages: {
				frost: 10,
				pierce: 4,
			},
			isUpgraded: () => false,
			end: jest.fn(),
		};

		(
			icyTalons as unknown as {
				activate: (targetArg: typeof target) => void;
			}
		).activate(target);

		expect(target.takeDamage).toHaveBeenCalledTimes(1);
		const damageArg = target.takeDamage.mock.calls[0][0] as {
			effects: Array<{
				alterations: Record<string, number>;
				stackable: boolean;
				turnLifetime: number;
			}>;
		};
		expect(damageArg.effects).toHaveLength(1);
		expect(damageArg.effects[0].alterations.frost).toBe(-1);
		expect(damageArg.effects[0].stackable).toBe(true);
		expect(damageArg.effects[0].turnLifetime).toBe(-1);
	});
});

describe('Knightmare Icicle Spear', () => {
	test('does not crash when takeDamage returns without damageObj', () => {
		/* eslint-disable-next-line no-undef */
		(globalThis as { Phaser?: unknown }).Phaser = {
			Easing: {
				Linear: {
					None: 0,
				},
			},
		};

		const sprite = {
			anchor: {
				setTo: jest.fn(),
			},
			destroy: jest.fn(),
			rotation: 0,
		};

		const tweenResult = {
			onComplete: {
				add: jest.fn(),
			},
		};

		const game = {
			abilities: [],
			effectId: 0,
			effects: [],
			log: jest.fn(),
			activeCreature: {
				queryMove: jest.fn(),
			},
			grid: {
				creatureGroup: {
					create: jest.fn(() => sprite),
				},
			},
			Phaser: {
				Easing: {
					Linear: {
						None: 0,
					},
				},
				add: {
					tween: jest.fn(() => ({
						to: jest.fn().mockReturnThis(),
						start: jest.fn(() => tweenResult),
					})),
				},
				camera: {
					SHAKE_HORIZONTAL: 0,
					shake: jest.fn(),
				},
			},
		};

		loadKnightmareAbilities(game as never);

		const target = Object.assign(Object.create(Creature.prototype), {
			id: 99,
			player: {
				plasma: 0,
			},
			takeDamage: jest.fn(() => ({
				kill: false,
			})),
			isDarkPriest: jest.fn(() => false),
			hasCreaturePlayerGotPlasma: jest.fn(() => false),
		});

		const icicleSpear = {
			...((game.abilities[9] as Array<Record<string, unknown>>)[3] as object),
			creature: {
				id: 9,
				legacyProjectileEmissionPoint: {
					x: 0,
					y: 0,
				},
				player: {
					flipped: false,
				},
				facePlayerDefault: jest.fn(),
				creatureSprite: {
					setDir: jest.fn(),
				},
			},
			damages: {
				pierce: 4,
			},
			isTargetingBackwards: jest.fn(() => false),
			end: jest.fn(),
		};

		const path = [
			{
				creature: target,
				displayPos: {
					x: 120,
					y: 60,
				},
			},
		];

		expect(() => {
			(
				icicleSpear as unknown as {
					activate: (pathArg: typeof path, argsArg: { direction: number }) => void;
				}
			).activate(path, { direction: 0 });
		}).not.toThrow();

		expect(target.takeDamage).toHaveBeenCalledTimes(1);
	});
});
