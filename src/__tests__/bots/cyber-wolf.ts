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

import CyberWolfStrategy from '../../bots/Cyber-Wolf';
import { Creature } from '../../creature';
import { Hex } from '../../utility/hex';

const { isRetreating } = CyberWolfStrategy as Required<typeof CyberWolfStrategy>;
const { getAbilityPriority, scoreAbilityHex } = CyberWolfStrategy as Required<
	typeof CyberWolfStrategy
>;

const makeCreature = ({
	team = 0,
	health = 170,
	maxHealth = 170,
	energy = 10,
	maxEnergy = 100,
	abilities = [] as any[],
	adjacentHexes = (_: number) => [] as Hex[],
	isFrozen = () => false,
	dead = false,
	temp = false,
	player = undefined as any,
}: Partial<{
	team: number;
	health: number;
	maxHealth: number;
	energy: number;
	maxEnergy: number;
	abilities: any[];
	adjacentHexes: (_: number) => Hex[];
	isFrozen: () => boolean;
	dead: boolean;
	temp: boolean;
	player: any;
}> = {}) => {
	const creature = Object.create(Creature.prototype);
	const creaturePlayer = player ?? {
		game: { creatures: [] as any[] },
	};
	Object.assign(creature, {
		team,
		health,
		stats: { health: maxHealth, energy: maxEnergy },
		energy,
		abilities,
		adjacentHexes,
		isFrozen,
		dead,
		temp,
		player: creaturePlayer,
	});
	return creature as Creature & { team: number };
};

const makeHex = ({ creature = undefined as (Creature & { team: number }) | undefined } = {}) =>
	({
		creature,
	} as unknown as Hex);

describe('CyberWolfStrategy.isRetreating', () => {
	test('does not retreat at low energy when adjacent pressure exists', () => {
		const enemy = makeCreature({ team: 1, energy: 80 });
		const cyberWolf = makeCreature({
			energy: 10,
			adjacentHexes: () => [makeHex({ creature: enemy })],
		});

		expect(isRetreating(cyberWolf, {} as any)).toBe(false);
	});

	test('retreats at low energy when no combat option is available', () => {
		const cyberWolf = makeCreature({
			energy: 10,
			adjacentHexes: () => [],
		});

		expect(isRetreating(cyberWolf, {} as any)).toBe(true);
	});

	test('retreats at critical health even with adjacent enemies', () => {
		const enemy = makeCreature({ team: 1 });
		const cyberWolf = makeCreature({
			health: 30,
			maxHealth: 170,
			energy: 10,
			adjacentHexes: () => [makeHex({ creature: enemy })],
		});

		expect(isRetreating(cyberWolf, {} as any)).toBe(true);
	});

	test('does not retreat just because it is frozen', () => {
		const cyberWolf = makeCreature({
			energy: 40,
			isFrozen: () => true,
		});

		expect(isRetreating(cyberWolf, {} as any)).toBe(false);
	});

	test('retreats when missed rockets exist but energy is below flat target locking cost', () => {
		const cyberWolf = makeCreature({
			energy: 9,
			abilities: [{}, {}, { token: 1 }, { costs: { energy: 30 }, isUpgraded: () => false }],
			adjacentHexes: () => [],
		});

		expect(isRetreating(cyberWolf, {} as any)).toBe(true);
	});

	test('does not retreat when missed rockets exist and energy meets flat target locking cost', () => {
		const liveEnemy = makeCreature({ team: 1 });
		const cyberWolf = makeCreature({
			energy: 30,
			maxEnergy: 300,
			abilities: [{}, {}, { token: 2 }, { costs: { energy: 30 }, isUpgraded: () => false }],
			adjacentHexes: () => [],
		});
		const creatureGame = { creatures: [cyberWolf, liveEnemy] };
		Object.assign(cyberWolf, { player: { game: creatureGame } });
		Object.assign(liveEnemy, { player: { game: creatureGame } });

		expect(isRetreating(cyberWolf, {} as any)).toBe(false);
	});

	test('retreats when missed rockets only point at dead enemies', () => {
		const deadEnemy = makeCreature({ team: 1, dead: true });
		const cyberWolf = makeCreature({
			energy: 10,
			abilities: [{}, {}, { token: 2 }, { costs: { energy: 30 }, isUpgraded: () => false }],
			adjacentHexes: () => [],
		});
		Object.assign(cyberWolf, { player: { game: { creatures: [cyberWolf, deadEnemy] } } });
		Object.assign(deadEnemy, { player: { game: { creatures: [cyberWolf, deadEnemy] } } });

		expect(isRetreating(cyberWolf, {} as any)).toBe(true);
	});

	test('ignores dead and temp enemies when scoring target locking', () => {
		const liveEnemy = makeCreature({ team: 1, health: 90, maxHealth: 100 });
		const deadEnemy = makeCreature({ team: 1, dead: true, health: 10, maxHealth: 100 });
		const tempEnemy = makeCreature({ team: 1, temp: true, health: 10, maxHealth: 100 });
		const cyberWolf = makeCreature({
			team: 0,
			abilities: [{}, {}, { token: 2 }, { costs: { energy: 30 }, isUpgraded: () => false }],
		});
		const botGame = { activeCreature: cyberWolf };
		const creatureGame = { creatures: [cyberWolf, deadEnemy, tempEnemy, liveEnemy] };
		Object.assign(cyberWolf, { player: { game: creatureGame } });
		Object.assign(deadEnemy, { player: { game: creatureGame } });
		Object.assign(tempEnemy, { player: { game: creatureGame } });
		Object.assign(liveEnemy, { player: { game: creatureGame } });

		expect(scoreAbilityHex(makeHex({ creature: deadEnemy }), 3, { game: botGame } as any)).toBe(
			Number.NEGATIVE_INFINITY,
		);
		expect(scoreAbilityHex(makeHex({ creature: tempEnemy }), 3, { game: botGame } as any)).toBe(
			Number.NEGATIVE_INFINITY,
		);
		expect(
			scoreAbilityHex(makeHex({ creature: liveEnemy }), 3, { game: botGame } as any),
		).toBeGreaterThan(Number.NEGATIVE_INFINITY);
	});

	test('prioritizes target locking when non-upgraded flat total cost is affordable', () => {
		const liveEnemy = makeCreature({ team: 1 });
		const cyberWolf = makeCreature({
			team: 0,
			energy: 30,
			abilities: [{}, {}, { token: 2 }, { costs: { energy: 30 }, isUpgraded: () => false }],
		});
		const creatureGame = { creatures: [cyberWolf, liveEnemy] };
		Object.assign(cyberWolf, { player: { game: creatureGame } });
		Object.assign(liveEnemy, { player: { game: creatureGame } });

		expect(getAbilityPriority(cyberWolf, {} as any)[0]).toBe(3);
	});

	test('prioritizes target locking when upgraded flat total cost is affordable', () => {
		const liveEnemy = makeCreature({ team: 1 });
		const cyberWolf = makeCreature({
			team: 0,
			energy: 30,
			abilities: [{}, {}, { token: 3 }, { costs: { energy: 30 }, isUpgraded: () => true }],
		});
		const creatureGame = { creatures: [cyberWolf, liveEnemy] };
		Object.assign(cyberWolf, { player: { game: creatureGame } });
		Object.assign(liveEnemy, { player: { game: creatureGame } });

		expect(getAbilityPriority(cyberWolf, {} as any)[0]).toBe(3);
	});
});
