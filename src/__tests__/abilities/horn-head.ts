import { beforeEach, describe, expect, jest, test } from '@jest/globals';

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
		target: any;
		trigger: string;
		effectFn: (effect: any, arg: unknown) => void;
		alterations: Record<string, number>;
		stackable: boolean;
		turnLifetime: number;
		game: any;
		constructor(
			name: string,
			owner: unknown,
			target: unknown,
			trigger: string,
			optArgs: {
				effectFn?: (effect: any, arg: unknown) => void;
				alterations?: Record<string, number>;
				stackable?: boolean;
				turnLifetime?: number;
			},
			game: any,
		) {
			this.name = name;
			this.owner = owner;
			this.target = target;
			this.trigger = trigger;
			this.effectFn = optArgs.effectFn ?? (() => {});
			this.alterations = optArgs.alterations ?? {};
			this.stackable = optArgs.stackable ?? true;
			this.turnLifetime = optArgs.turnLifetime ?? 0;
			this.game = game;
		}
		deleteEffect() {
			if (Array.isArray(this.target?.effects)) {
				this.target.effects = this.target.effects.filter((effect: any) => effect !== this);
			}
		}
	},
}));

jest.mock('../../damage', () => ({
	Damage: class DamageMock {
		attacker: any;
		damages: Record<string, number>;
		target: any;
		constructor(
			attacker: any,
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

type MockEffect = {
	name: string;
	trigger: string;
	effectFn: (effect: MockEffect, arg: unknown) => void;
	alterations?: { endurance?: number };
	target?: unknown;
};

function createHornHead() {
	const hornHead: any = {
		id: 8,
		team: 0,
		health: 20,
		endurance: 1,
		stats: {
			health: 200,
			endurance: 1,
		},
		effects: [] as MockEffect[],
		addEffect(effect: MockEffect) {
			effect.target = this;
			this.effects.push(effect);
			if (typeof effect.alterations?.endurance === 'number') {
				this.stats.endurance += effect.alterations.endurance;
			}
		},
		removeEffect(effectName: string) {
			this.effects = this.effects.filter((effect: MockEffect) => effect.name !== effectName);
		},
		restoreEndurance(amount: number) {
			this.endurance = Math.min(this.stats.endurance, this.endurance + amount);
		},
		hint: jest.fn(),
		updateHealth: jest.fn(),
	};

	return hornHead;
}

describe('Horn Head Life Support passive revamp', () => {
	let game: any;
	let ability: any;
	let hornHead: any;

	beforeEach(() => {
		game = {
			abilities: [],
			effectId: 0,
			effects: [],
			turn: 1,
			log: jest.fn(),
		};
		loadHornHeadAbilities(game);

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
		const damage = new Damage(friendlyAttacker as never, { pure: 5 }, 1, [], game);
		(damage as any).target = hornHead;

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
		const lethalDamage = new Damage(enemyAttacker as never, { pure: 15 }, 1, [], game);
		(lethalDamage as any).target = hornHead;

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

		const firstHit = new Damage(attacker as never, { pure: 4 }, 1, [], game);
		(firstHit as any).target = hornHead;
		ability.activate(firstHit);
		hornHead.health -= 4;
		const firstTracker = hornHead.effects.find(
			(effect: MockEffect) => effect.trigger === 'onDamage',
		) as MockEffect;
		firstTracker.effectFn(firstTracker, firstHit);

		const secondHit = new Damage(attacker as never, { pure: 4 }, 1, [], game);
		(secondHit as any).target = hornHead;
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
