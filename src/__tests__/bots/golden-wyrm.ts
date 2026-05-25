/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, expect, describe, test } from '@jest/globals';

jest.mock('../../utility/hex', () => ({
	Hex: class Hex {},
}));
jest.mock('../../creature', () => ({
	Creature: class Creature {},
}));
jest.mock('../../utility/team', () => ({
	Team: { Enemy: 'Enemy', Ally: 'Ally', Both: 'Both' },
	isTeam: jest.fn((reference: { team: number }, other: { team: number }, relation: string) => {
		if (relation === 'Enemy') return other.team !== reference.team;
		if (relation === 'Ally') return other.team === reference.team;
		return true;
	}),
}));

import GoldenWyrmStrategy from '../../bots/Golden-Wyrm';
import { Creature } from '../../creature';
import { Hex } from '../../utility/hex';

const { isRetreating, getAbilityPriority, scoreAbilityHex, getTargetingPenalty } =
	GoldenWyrmStrategy as Required<typeof GoldenWyrmStrategy>;

const makeCreature = ({
	id = 1,
	team = 0,
	type = 'A7',
	health = 225,
	maxHealth = 225,
	energy = 100,
	maxEnergy = 100,
	level = 7,
	player = { id: team, flipped: false, plasma: 0, controller: 'bot' as const },
	abilities = [{}, {}, {}, {}] as any[],
	adjacentHexes = (_: number) => [] as Hex[],
	isDarkPriest = () => false,
	isFatigued = () => false,
	protectedFromFatigue = false,
	stats = {},
}: Partial<{
	id: number;
	team: number;
	type: string;
	health: number;
	maxHealth: number;
	energy: number;
	maxEnergy: number;
	level: number;
	player: {
		id: number;
		flipped: boolean;
		plasma: number;
		controller: 'bot' | 'human';
	};
	abilities: any[];
	adjacentHexes: (_: number) => Hex[];
	isDarkPriest: () => boolean;
	isFatigued: () => boolean;
	protectedFromFatigue: boolean;
	stats: Record<string, number>;
}> = {}) => {
	const creature = Object.create(Creature.prototype);
	Object.assign(creature, {
		id,
		team,
		type,
		health,
		stats: { health: maxHealth, energy: maxEnergy, ...stats },
		energy,
		level,
		dead: false,
		temp: false,
		player,
		abilities,
		adjacentHexes,
		isDarkPriest,
		isFatigued,
		protectedFromFatigue,
	});
	return creature as Creature & { team: number };
};

const makeHex = ({
	x = 0,
	y = 0,
	creature = undefined as (Creature & { team: number }) | undefined,
	adjacentHex = (_radius: number) => [] as Hex[],
}: {
	x?: number;
	y?: number;
	creature?: Creature & { team: number };
	adjacentHex?: (_radius: number) => Hex[];
} = {}) =>
	({
		x,
		y,
		creature,
		adjacentHex,
	} as unknown as Hex);

const makeController = ({
	activeCreature,
	creatures = [] as (Creature & { team: number })[],
}: {
	activeCreature: Creature & { team: number };
	creatures?: (Creature & { team: number })[];
}) => ({
	game: {
		activeCreature,
		creatures: [activeCreature, ...creatures],
		grid: {
			hexes: [Array(16).fill(null)],
		},
	},
	isRetreating: (creature: Creature) => isRetreating(creature, {} as any) ?? false,
	closestDistanceToEnemy: (_pos: { x: number; y: number }) => 4,
	closestDistanceToDrop: (_pos: { x: number; y: number }) => 10,
});

describe('GoldenWyrmStrategy.isRetreating', () => {
	test('retreats under 30 percent health', () => {
		const wyrm = makeCreature({ health: 60, maxHealth: 225 });
		const controller = makeController({ activeCreature: wyrm });
		expect(isRetreating(wyrm, controller as any)).toBe(true);
	});
});

describe('GoldenWyrmStrategy.getAbilityPriority', () => {
	test('retreat mode prioritizes Dragon Flight only', () => {
		const wyrm = makeCreature({ health: 60, maxHealth: 225 });
		const controller = makeController({ activeCreature: wyrm });
		expect(getAbilityPriority(wyrm, controller as any)).toEqual([2]);
	});

	test('adjacent unshielded Dark Priest forces Executioner Axe first', () => {
		const darkPriest = makeCreature({
			id: 2,
			team: 1,
			type: '--',
			player: { id: 1, flipped: true, plasma: 0, controller: 'bot' },
			isDarkPriest: () => true,
		});
		const wyrm = makeCreature({
			health: 200,
			adjacentHexes: () => [makeHex({ creature: darkPriest })],
		});
		const controller = makeController({ activeCreature: wyrm, creatures: [darkPriest] });

		expect(getAbilityPriority(wyrm, controller as any)).toEqual([1, 2, 3]);
	});

	test('high-health setup prioritizes Dragon Flight before attack', () => {
		const wyrm = makeCreature({
			health: 210,
			maxHealth: 225,
			abilities: [{}, { isUpgraded: () => false }, { isUpgraded: () => false }, {}],
			adjacentHexes: () => [],
		});
		const controller = makeController({ activeCreature: wyrm });

		expect(getAbilityPriority(wyrm, controller as any)).toEqual([2, 1, 3]);
	});
});

describe('GoldenWyrmStrategy.ability scoring', () => {
	test('Visible Stigmata prioritizes veteran ally over equal-health basic ally', () => {
		const veteranAlly = makeCreature({
			id: 2,
			team: 0,
			health: 60,
			maxHealth: 160,
			level: 6,
			stats: { endurance: 24, regrowth: 22 },
			abilities: [{ isUpgraded: () => true }, { isUpgraded: () => true }, {}, {}],
		});
		const basicAlly = makeCreature({
			id: 3,
			team: 0,
			health: 60,
			maxHealth: 160,
			level: 3,
			stats: { endurance: 10, regrowth: 10 },
			abilities: [{}, {}, {}, {}],
		});
		const wyrm = makeCreature({
			health: 210,
			maxHealth: 225,
		});
		const controller = makeController({
			activeCreature: wyrm,
			creatures: [veteranAlly, basicAlly],
		});

		const veteranScore = scoreAbilityHex(makeHex({ creature: veteranAlly }), 3, controller as any);
		const basicScore = scoreAbilityHex(makeHex({ creature: basicAlly }), 3, controller as any);

		expect(veteranScore).toBeGreaterThan(basicScore as number);
	});

	test('Dragon Flight penalizes landing adjacent to allies and enemies when Battle Cry is not upgraded', () => {
		const ally = makeCreature({ id: 2, team: 0 });
		const enemy = makeCreature({ id: 3, team: 1, level: 2 });
		const wyrm = makeCreature({
			health: 210,
			maxHealth: 225,
			abilities: [{ isUpgraded: () => false }, {}, { isUpgraded: () => false }, {}],
		});
		const controller = makeController({ activeCreature: wyrm, creatures: [ally, enemy] });

		const riskyHex = makeHex({
			x: 4,
			y: 4,
			adjacentHex: () => [makeHex({ creature: ally }), makeHex({ creature: enemy })],
		});
		const safeHex = makeHex({
			x: 5,
			y: 4,
			adjacentHex: () => [makeHex({ creature: enemy })],
		});

		const riskyScore = scoreAbilityHex(riskyHex, 2, controller as any);
		const safeScore = scoreAbilityHex(safeHex, 2, controller as any);

		expect(safeScore).toBeGreaterThan(riskyScore as number);
	});
});

describe('GoldenWyrmStrategy.counterplay', () => {
	test('high-level durable slash/sonic attacker gets lower retaliation penalty', () => {
		const resilientAttacker = makeCreature({
			team: 1,
			level: 6,
			stats: {
				endurance: 24,
				regrowth: 21,
				slash: 24,
				sonic: 22,
			},
		});
		const fragileAttacker = makeCreature({ team: 1, level: 2 });
		const wyrm = makeCreature({ team: 0 });
		const controller = makeController({ activeCreature: fragileAttacker, creatures: [wyrm] });

		const resilientPenalty = getTargetingPenalty(resilientAttacker, wyrm, 1, controller as any);
		const fragilePenalty = getTargetingPenalty(fragileAttacker, wyrm, 1, controller as any);

		expect(resilientPenalty).toBeGreaterThan(fragilePenalty as number);
	});
});
