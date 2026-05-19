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
		};
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
			{ x: 1, y: 0, creature: null, isWalkable: jest.fn(() => true) },
			{ x: 2, y: 0, creature: { id: 99 }, isWalkable: jest.fn(() => false) },
			{ x: 3, y: 0, creature: null, isWalkable: jest.fn(() => false) },
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
		};

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
			{ x: 1, y: 0, creature: null, isWalkable: jest.fn(() => true) },
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
		};

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
});
