import { beforeEach, describe, expect, jest, test } from '@jest/globals';

type EffectTarget = {
	effects?: unknown[];
};

type MockEffect = {
		name: string;
		trigger: string;
		effectFn: (effect: MockEffect, arg: unknown) => void;
	alterations?: { endurance?: number };
	target?: unknown;
};

type HornHeadMock = {
		id: number;
		team: number;
		health: number;
		endurance: number;
		stats: {
		health: number;
		endurance: number;
	};
		effects: MockEffect[];
		addEffect: (effect: MockEffect) => void;
		removeEffect: (effectName: string) => void;
		restoreEndurance: (amount: number) => void;
		hint: ReturnType<typeof jest.fn>;
		updateHealth: ReturnType<typeof jest.fn>;
};

type DamageWithTarget = Damage & {
	target?: HornHeadMock;
};

type AbilityLike = {
		activate: (damage: DamageWithTarget) => void;
		interceptDeath: () => boolean;
		isUpgraded: () => boolean;
		require: () => boolean;
		creature: HornHeadMock;
		title: string;
};

type GameMock = {
		abilities: Record<number, AbilityLike[]>;
		effectId: number;
		effects: unknown[];
		turn: number;
		log: ReturnType<typeof jest.fn>;
	 gameEngine: {
		cameras: { main: { shake: () => void } };
		add: {
			graphics: () => Record<string, unknown>;
			bitmapData: () => Record<string, unknown>;
			group: () => Record<string, unknown>;
			tileSprite: () => Record<string, unknown>;
		};
		tween: () => Record<string, unknown>;
	};
	};

jest.mock('phaser-ce', () => ({
		Point: class PointMock {},
		Polygon: class PolygonMock {},
}));

jest.mock('../../utility/hex', () => ({
		Direction: {
		None: -1,
		UpRight: 0,
		Right: 1,
		DownRight: 2,
		DownLeft: 3,
		Left: 4,
		UpLeft: 5,
	},
		Hex: class HexMock {
		x: number;
		y: number;
		pos: { x: number; y: number };
		constructor(x: number, y: number) {
			this.x = x;
			this.y = y;
			this.pos = { x, y };
		}
	},
}));

jest.mock('../../creature', () => ({
		Creature: class CreatureMock {},
}));

jest.mock('../../effect', () => ({
		Effect: class EffectMock {
		name: string;
		owner: unknown;
		target: unknown;
		trigger: string;
		effectFn: (effect: unknown, arg: unknown) => void;
		alterations: Record<string, number>;
		stackable: boolean;
		turnLifetime: number;
		game: unknown;
		constructor(
		name: string,
		owner: unknown,
		target: unknown,
		trigger: string,
		optArgs: {
				effectFn?: (effect: unknown, arg: unknown) => void;
				alterations?: Record<string, number>;
				stackable?: boolean;
				turnLifetime?: number;
			},
		game: unknown,
		) {
			this.name = name;
			this.owner = owner;
			this.target = target;
			this.trigger = trigger;
			this.effectFn = optArgs.effectFn ?? (() => undefined);
			this.alterations = optArgs.alterations ?? {};
			this.stackable = optArgs.stackable ?? true;
			this.turnLifetime = optArgs.turnLifetime ?? 0;
			this.game = game;
		}
		deleteEffect() {
			const effectTarget = this.target as EffectTarget;
			if (Array.isArray(effectTarget.effects)) {
				effectTarget.effects = effectTarget.effects.filter((effect) => effect !== this);
			}
		}
	},
}));

jest.mock('../../damage', () => ({
		Damage: class DamageMock {
		attacker: unknown;
		damages: Record<string, number>;
		target: unknown;
		constructor(
		attacker: unknown,
		damages: Record<string, number>,
		_area: number,
		_effects: unknown[],
		_game: unknown,
		) {
			this.attacker = attacker;
			this.damages = damages;
		}
		applyDamage() {
			const total = Object.values(this.damages).reduce((acc, value) => acc + Number(value || 0), 0);
			return { total };
		}
	},
}));

import loadHornHeadAbilities from '../../abilities/Horn-Head';
import { Damage } from '../../damage';
import { Direction } from '../../utility/hex';

function createHornHead() {
	const hornHead: HornHeadMock = {
		id: 8,
		team: 0,
		health: 20,
		endurance: 1,
		stats: {
		health: 200,
		endurance: 1,
		},
		effects: [] as MockEffect[],
		addEffect(this: HornHeadMock, effect: MockEffect) {
			effect.target = this;
			this.effects.push(effect);
			if (typeof effect.alterations?.endurance === 'number') {
				this.stats.endurance += effect.alterations.endurance;
			}
		},
		removeEffect(this: HornHeadMock, effectName: string) {
			this.effects = this.effects.filter((effect: MockEffect) => effect.name !== effectName);
		},
		restoreEndurance(this: HornHeadMock, amount: number) {
			this.endurance = Math.min(this.stats.endurance, this.endurance + amount);
		},
		hint: jest.fn(),
		updateHealth: jest.fn(),
	};

	return hornHead;
}

describe('Horn Head Life Support passive revamp', () => {
	let game: GameMock;
	let ability: AbilityLike;
	let hornHead: HornHeadMock;

	beforeEach(() => {
		game = {
		abilities: {},
		effectId: 0,
		effects: [],
		turn: 1,
		log: jest.fn(),
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
		globalThis.G = game as never;
		loadHornHeadAbilities(game as never);

		hornHead = createHornHead();
		ability = {
			...game.abilities[8][0],
		creature: hornHead,
		title: 'Life Support',
		isUpgraded: () => false,
		require: () => true,
		};
	});

	test('gains max endurance from health damage including friendly fire (current endurance does not increase)', () => {
		const friendlyAttacker = { id: 108, team: 0, stats: { offense: 0 } };
		const damage = new Damage(
			friendlyAttacker as never,
			{ pure: 5 },
			1,
			[],
			game as never,
		) as DamageWithTarget;
		(damage as unknown as { target: HornHeadMock }).target = hornHead;

		ability.activate(damage);

		hornHead.health -= 5;
		const tracker = hornHead.effects.find((effect: MockEffect) => effect.trigger === 'onDamage');
		expect(tracker).toBeDefined();
		tracker?.effectFn(tracker, damage);

		expect(hornHead.stats.endurance).toBe(3);
		expect(hornHead.endurance).toBe(1);
	});

	test('upgrade shields lethal damage with endurance and only health-drain contributes to max pool gain', () => {
		hornHead.health = 10;
		hornHead.endurance = 8;
		hornHead.stats.endurance = 8;
		ability.isUpgraded = () => true;

		const enemyAttacker = { id: 109, team: 1, stats: { offense: 0 } };
		const lethalDamage = new Damage(
			enemyAttacker as never,
			{ pure: 15 },
			1,
			[],
			game as never,
		) as DamageWithTarget;
		(lethalDamage as unknown as { target: HornHeadMock }).target = hornHead;

		ability.activate(lethalDamage);
		expect(ability.interceptDeath()).toBe(true);
		expect(hornHead.health).toBe(1);
		expect(hornHead.endurance).toBe(2);

		const tracker = hornHead.effects.find((effect: MockEffect) => effect.trigger === 'onDamage');
		expect(tracker).toBeDefined();
		tracker?.effectFn(tracker, lethalDamage);

		expect(hornHead.stats.endurance).toBe(12);
		expect(hornHead.endurance).toBe(2);
	});

	test('tracks consecutive hits in the same turn (only max pool increases)', () => {
		const attacker = { id: 110, team: 1, stats: { offense: 0 } };

		const firstHit = new Damage(
			attacker as never,
			{ pure: 4 },
			1,
			[],
			game as never,
		) as DamageWithTarget;
		(firstHit as unknown as { target: HornHeadMock }).target = hornHead;
		ability.activate(firstHit);
		hornHead.health -= 4;
		const firstTracker = hornHead.effects.find(
			(effect: MockEffect) => effect.trigger === 'onDamage',
		) as MockEffect;
		firstTracker.effectFn(firstTracker, firstHit);

		const secondHit = new Damage(
			attacker as never,
			{ pure: 4 },
			1,
			[],
			game as never,
		) as DamageWithTarget;
		(secondHit as unknown as { target: HornHeadMock }).target = hornHead;
		ability.activate(secondHit);
		hornHead.health -= 4;
		const secondTracker = hornHead.effects.find(
			(effect: MockEffect) => effect.trigger === 'onDamage',
		) as MockEffect;
		secondTracker.effectFn(secondTracker, secondHit);

		expect(hornHead.stats.endurance).toBe(5);
		expect(hornHead.endurance).toBe(1);
	});
});

describe('Horn Head Meat Sickle landing validation', () => {
	test('pulls to the nearest legal landing hex when the default landing footprint is blocked', () => {
		const target = {
		id: 33,
		size: 2,
		stats: { movement: 3, moveable: true },
		isDarkPriest: () => false,
		hasCreaturePlayerGotPlasma: () => false,
		replaceEffect: jest.fn(),
		takeDamage: jest.fn(),
		moveTo: jest.fn((hex, opts: { callback?: () => void }) => {
				opts.callback?.();
			}),
		};

		const source = {
		id: 8,
		x: 0,
		y: 0,
		size: 2,
		player: { flipped: false },
		};

		const line = [
			{ x: 0, y: 0, creature: source, isWalkable: jest.fn(() => false) },
			{ x: 1, y: 0, creature: null, isWalkable: jest.fn(() => false) }, // Not walkable: isWalkable(2) checks x=0,x=1 but x=0 has caster
			{ x: 2, y: 0, creature: { id: 99 }, isWalkable: jest.fn(() => false) },
			{ x: 3, y: 0, creature: null, isWalkable: jest.fn(() => false) }, // Not walkable: isWalkable(2) checks x=2,x=3 but x=2 has blocker
			{ x: 4, y: 0, creature: null, isWalkable: jest.fn(() => true) },
			{ x: 5, y: 0, creature: target, isWalkable: jest.fn(() => true) },
			{ x: 6, y: 0, creature: target, isWalkable: jest.fn(() => true) },
		];

		const game = {
		abilities: {} as Record<number, unknown[]>,
		grid: {
		getHexLine: jest.fn(() => line),
			},
		activeCreature: {
		queryMove: jest.fn(),
			},
		log: jest.fn(),
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

		globalThis.G = game as never;
		loadHornHeadAbilities(game as never);

		const baseAbility = (game.abilities[8] as Record<string, unknown>[]).find(
			(ability) => typeof ability._getMaxDistance === 'function',
		) as {
		activate: (path: unknown[], args: { direction: Direction }) => void;
		};
		const ability = {
			...baseAbility,
		creature: source,
		isUpgraded: () => false,
		end: jest.fn(),
		title: 'Meat Sickle',
		damages: { pierce: 1 },
		};

		ability.activate.call(ability, [{ creature: target }], { direction: Direction.Right });

		expect(target.moveTo).toHaveBeenCalledTimes(1);
		expect(target.moveTo).toHaveBeenCalledWith(
			line[4],
			expect.objectContaining({
		ignoreMovementPoint: true,
		ignorePath: true,
			}),
		);
		expect(game.activeCreature.queryMove).toHaveBeenCalledTimes(1);
	});

	test('does not move when every intermediate landing hex is blocked', () => {
		const target = {
		id: 34,
		size: 2,
		stats: { movement: 3, moveable: true },
		isDarkPriest: () => false,
		hasCreaturePlayerGotPlasma: () => false,
		replaceEffect: jest.fn(),
		takeDamage: jest.fn(),
		moveTo: jest.fn(),
		};

		const source = {
		id: 8,
		x: 0,
		y: 0,
		size: 2,
		player: { flipped: false },
		};

		const line = [
			{ x: 0, y: 0, creature: source, isWalkable: jest.fn(() => false) },
			{ x: 1, y: 0, creature: null, isWalkable: jest.fn(() => false) }, // Not walkable: isWalkable(2) checks x=0,x=1 but x=0 has caster
			{ x: 2, y: 0, creature: { id: 99 }, isWalkable: jest.fn(() => false) },
			{ x: 3, y: 0, creature: null, isWalkable: jest.fn(() => false) },
			{ x: 4, y: 0, creature: null, isWalkable: jest.fn(() => false) },
			{ x: 5, y: 0, creature: target, isWalkable: jest.fn(() => true) },
			{ x: 6, y: 0, creature: target, isWalkable: jest.fn(() => true) },
		];

		const game = {
		abilities: {} as Record<number, unknown[]>,
		grid: {
		getHexLine: jest.fn(() => line),
			},
		activeCreature: {
		queryMove: jest.fn(),
			},
		log: jest.fn(),
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

		globalThis.G = game as never;
		loadHornHeadAbilities(game as never);

		const baseAbility = (game.abilities[8] as Record<string, unknown>[]).find(
			(ability) => typeof ability._getMaxDistance === 'function',
		) as {
		activate: (path: unknown[], args: { direction: Direction }) => void;
		};
		const ability = {
			...baseAbility,
		creature: source,
		isUpgraded: () => false,
		end: jest.fn(),
		title: 'Meat Sickle',
		damages: { pierce: 1 },
		};

		ability.activate.call(ability, [{ creature: target }], { direction: Direction.Right });

		expect(target.moveTo).not.toHaveBeenCalled();
		expect(game.activeCreature.queryMove).toHaveBeenCalledTimes(1);
	});

	test('pulls to the nearest legal landing hex for flipped player using Left direction', () => {
		const target = {
		id: 35,
		size: 2,
		stats: { movement: 3, moveable: true },
		isDarkPriest: () => false,
		hasCreaturePlayerGotPlasma: () => false,
		replaceEffect: jest.fn(),
		takeDamage: jest.fn(),
		moveTo: jest.fn((hex, opts: { callback?: () => void }) => {
				opts.callback?.();
			}),
		};

		const source = {
		id: 8,
		x: 6,
		y: 0,
		size: 2,
		player: { flipped: true },
		};

		// For flipped player, Left direction pulls toward lower x
		// After getMeatSickleHexLineDirection, Left is converted to Right
		// So line goes: x=6 (caster), x=5, x=4, x=3, x=2
		const line = [
			{ x: 6, y: 0, creature: source, isWalkable: jest.fn(() => false) },
			{ x: 5, y: 0, creature: null, isWalkable: jest.fn(() => false) }, // Not walkable: checks x=5,x=4 but x=4 blocked
			{ x: 4, y: 0, creature: { id: 99 }, isWalkable: jest.fn(() => false) },
			{ x: 3, y: 0, creature: null, isWalkable: jest.fn(() => true) },
			{ x: 2, y: 0, creature: target, isWalkable: jest.fn(() => true) },
			{ x: 1, y: 0, creature: target, isWalkable: jest.fn(() => true) },
		];

		const game = {
		abilities: {} as Record<number, unknown[]>,
		grid: {
		getHexLine: jest.fn(() => line),
			},
		activeCreature: {
		queryMove: jest.fn(),
			},
		log: jest.fn(),
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

		globalThis.G = game as never;
		loadHornHeadAbilities(game as never);

		const baseAbility = (game.abilities[8] as Record<string, unknown>[]).find(
			(ability) => typeof ability._getMaxDistance === 'function',
		) as {
		activate: (path: unknown[], args: { direction: Direction }) => void;
		};
		const ability = {
			...baseAbility,
		creature: source,
		isUpgraded: () => false,
		end: jest.fn(),
		title: 'Meat Sickle',
		damages: { pierce: 1 },
		};

		ability.activate.call(ability, [{ creature: target }], { direction: Direction.Left });

		expect(target.moveTo).toHaveBeenCalledTimes(1);
		expect(target.moveTo).toHaveBeenCalledWith(
			line[3],
			expect.objectContaining({
		ignoreMovementPoint: true,
		ignorePath: true,
			}),
		);
	});
});

const makeGame = () => {
	const hexesByKey = new Map<string, any>();
	const getHex = (x: number, y: number): any => {
		const key = `${x}:${y}`;
		if (!hexesByKey.has(key)) {
			hexesByKey.set(key, {
				x,
				y,
		pos: { x, y },
		direction: Direction.None,
		creature: null,
		isWalkable: jest.fn(() => true),
			});
		}
		return hexesByKey.get(key);
	};

	const game: any = {
		abilities: {},
		grid: {
		getHexLine: jest.fn((startX: number, y: number, dir: Direction, flipped?: boolean) => {
				if ((dir === Direction.Right || dir === Direction.Left) && y === 5) {
					const step = dir === Direction.Right ? (flipped ? -1 : 1) : flipped ? 1 : -1;
					const xs = [
						startX,
						startX + step,
						startX + step * 2,
						startX + step * 3,
						startX + step * 4,
						startX + step * 5,
						startX + step * 6,
						startX + step * 7,
						startX + step * 8,
					];
					return xs.map((x: number) => getHex(x, 5));
				}
				return [];
			}),
		queryChoice: jest.fn(),
		queryDirection: jest.fn(),
		},
		activeCreature: { queryMove: jest.fn() },
		log: jest.fn(),
		Phaser: undefined,
		msg: { abilities: { noTarget: 'No target.' } },
	};

	globalThis.G = game as never;
		loadHornHeadAbilities(game as never);
	return { game, getHex };
};

const makeCreature = (id: number, x: number, y: number, size: number) => ({
	id,
	x,
	y,
	size,
		player: { flipped: false },
		hexagons: Array.from({ length: size }, (_, i) => ({ x: x - i, y })),
		stats: { moveable: true, movement: 3 },
		isDarkPriest: () => false,
		hasCreaturePlayerGotPlasma: () => false,
		takeDamage: jest.fn(),
		moveTo: jest.fn((hex: any, opts: { callback?: () => void }) => opts?.callback?.()),
		replaceEffect: jest.fn(),
		addEffect: jest.fn(),
		removeEffect: jest.fn(),
		endurance: 5,
});

describe('Meat Sickle clicking the first hexagon of a path', () => {
	let game: any;
	let getHex: (x: number, y: number) => any;

	beforeEach(() => {
		const setup = makeGame();
		game = setup.game;
		getHex = setup.getHex;
	});

	const buildAbility = (creature: any): any => {
		const defs = game.abilities[8] as any[] as Array<Record<string, any>>;
		const meatSickleDef = defs.find(
			(d) =>
				typeof d.query === 'function' &&
				d._targetTeam !== undefined &&
				d._getMaxDistance !== undefined,
		);
		return {
			...meatSickleDef,
			creature,
		isUpgraded: () => true,
		end: jest.fn(),
		title: 'Meat Sickle',
		damages: { pierce: 1 },
		animation: function (...args: unknown[]) {
				return (this.activate as (...a: unknown[]) => unknown).apply(this, args);
			},
		};
	};

	const buildBaseAbility = (creature: any): any => {
		const defs = game.abilities[8] as any[] as Array<Record<string, any>>;
		const meatSickleDef = defs.find(
			(d) =>
				typeof d.query === 'function' &&
				d._targetTeam !== undefined &&
				d._getMaxDistance !== undefined,
		);
		return {
			...meatSickleDef,
			creature,
		isUpgraded: () => false,
		end: jest.fn(),
		title: 'Meat Sickle',
		damages: { pierce: 1 },
		animation: function (...args: unknown[]) {
				return (this.activate as (...a: unknown[]) => unknown).apply(this, args);
			},
		};
	};

	test('clicking the first hexagon of the path executes on the target', () => {
		const hornHead = makeCreature(8, 1, 5, 2);
		getHex(0, 5).creature = hornHead;
		getHex(1, 5).creature = hornHead;
		const enemy = makeCreature(33, 4, 5, 1);
		getHex(4, 5).creature = enemy;
		getHex(5, 5).creature = enemy;

		const ability = buildAbility(hornHead);
		(ability.query as () => void).call(ability);

		expect(game.grid.queryChoice).toHaveBeenCalledTimes(1);
		const queryOpt = game.grid.queryChoice.mock.calls[0][0];
		expect(queryOpt.choices.length).toBeGreaterThan(0);

		const rightChoice = queryOpt.choices.find((choice: any[]) =>
			choice.some((h) => h.creature === enemy),
		);
		expect(rightChoice).toBeDefined();
		expect(rightChoice[0]).toBe(getHex(2, 5));

		queryOpt.fnOnConfirm(rightChoice, { direction: Direction.Right, hex: rightChoice[0] });

		expect(ability.end).toHaveBeenCalled();
	});

	test('flipped Horn Head: forward and backward paths skip caster hexes and reach opposite sides', () => {
		const hornHead = makeCreature(8, 1, 5, 2);
		hornHead.player = { flipped: true };
		hornHead.hexagons = [
			{ x: 0, y: 5 },
			{ x: 1, y: 5 },
		];
		getHex(0, 5).creature = hornHead;
		getHex(1, 5).creature = hornHead;

		const frontEnemy = makeCreature(33, -3, 5, 1);
		getHex(-3, 5).creature = frontEnemy;
		getHex(-4, 5).creature = frontEnemy;

		const backEnemy = makeCreature(34, 4, 5, 1);
		getHex(4, 5).creature = backEnemy;
		getHex(5, 5).creature = backEnemy;

		const ability = buildAbility(hornHead);
		(ability.query as () => void).call(ability);

		expect(game.grid.queryChoice).toHaveBeenCalledTimes(1);
		const queryOpt = game.grid.queryChoice.mock.calls[0][0];

		const frontChoices = queryOpt.choices.filter((c: any[]) =>
			c.some((h) => h.creature === frontEnemy),
		);
		const backChoices = queryOpt.choices.filter((c: any[]) =>
			c.some((h) => h.creature === backEnemy),
		);
		expect(frontChoices.length).toBe(1);
		expect(backChoices.length).toBe(1);

		for (const choice of [...frontChoices, ...backChoices]) {
			expect(choice[0].creature?.id).not.toBe(hornHead.id);
		}

		queryOpt.fnOnConfirm(backChoices[0], {
		direction: Direction.Left,
		hex: backChoices[0][0],
		});
		expect(ability.end).toHaveBeenCalled();
	});

	test('blue Horn Head confirms backward choice even if confirm direction is stale', () => {
		const hornHead = makeCreature(8, 1, 5, 2);
		getHex(0, 5).creature = hornHead;
		getHex(1, 5).creature = hornHead;

		const enemy = makeCreature(34, -2, 5, 1);
		getHex(-2, 5).creature = enemy;
		getHex(-3, 5).creature = enemy;

		const ability = buildAbility(hornHead);
		(ability.query as () => void).call(ability);

		expect(game.grid.queryChoice).toHaveBeenCalledTimes(1);
		const queryOpt = game.grid.queryChoice.mock.calls[0][0];
		const leftChoice = queryOpt.choices.find((choice: any[]) =>
			choice.some((h) => h.creature === enemy),
		);
		expect(leftChoice).toBeDefined();

		queryOpt.fnOnConfirm(leftChoice, { direction: Direction.Right, hex: leftChoice[0] });

		expect(ability.end).toHaveBeenCalled();
	});

	test('blue Horn Head confirms backward choice when clicked hex has same coords but different object', () => {
		const hornHead = makeCreature(8, 1, 5, 2);
		getHex(0, 5).creature = hornHead;
		getHex(1, 5).creature = hornHead;

		const enemy = makeCreature(35, -2, 5, 1);
		getHex(-2, 5).creature = enemy;
		getHex(-3, 5).creature = enemy;

		const ability = buildAbility(hornHead);
		(ability.query as () => void).call(ability);

		const queryOpt = game.grid.queryChoice.mock.calls[0][0];
		const leftChoice = queryOpt.choices.find((choice: any[]) =>
			choice.some((h) => h.creature === enemy),
		);
		expect(leftChoice).toBeDefined();

		const detachedClickedHex = {
		x: leftChoice[0].x,
		y: leftChoice[0].y,
		pos: { x: leftChoice[0].x, y: leftChoice[0].y },
		direction: Direction.Right,
		};

		queryOpt.fnOnConfirm(leftChoice, { direction: Direction.Right, hex: detachedClickedHex });

		expect(ability.end).toHaveBeenCalled();
	});

	test('base Meat Sickle uses shared queryChoice targeting and confirms backward blue cast', () => {
		const hornHead = makeCreature(8, 1, 5, 2);
		getHex(0, 5).creature = hornHead;
		getHex(1, 5).creature = hornHead;

		const enemy = makeCreature(36, -2, 5, 1);
		getHex(-2, 5).creature = enemy;
		getHex(-3, 5).creature = enemy;

		const ability = buildBaseAbility(hornHead);
		(ability.query as () => void).call(ability);

		expect(game.grid.queryDirection).not.toHaveBeenCalled();
		expect(game.grid.queryChoice).toHaveBeenCalledTimes(1);

		const queryOpt = game.grid.queryChoice.mock.calls[0][0];
		const leftChoice = queryOpt.choices.find((choice: any[]) =>
			choice.some((h) => h.creature === enemy),
		);
		expect(leftChoice).toBeDefined();

		queryOpt.fnOnConfirm(leftChoice, { direction: Direction.Right, hex: leftChoice[0] });

		expect(ability.end).toHaveBeenCalled();
	});
});
