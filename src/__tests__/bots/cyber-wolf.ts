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

const makeCreature = ({
	team = 0,
	health = 170,
	maxHealth = 170,
	energy = 10,
	maxEnergy = 100,
	abilities = [] as any[],
	adjacentHexes = (_: number) => [] as Hex[],
	isFrozen = () => false,
}: Partial<{
	team: number;
	health: number;
	maxHealth: number;
	energy: number;
	maxEnergy: number;
	abilities: any[];
	adjacentHexes: (_: number) => Hex[];
	isFrozen: () => boolean;
}> = {}) => {
	const creature = Object.create(Creature.prototype);
	Object.assign(creature, {
		team,
		health,
		stats: { health: maxHealth, energy: maxEnergy },
		energy,
		abilities,
		adjacentHexes,
		isFrozen,
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

	test('retreats when missed rockets exist but energy is below dynamic target locking cost', () => {
		const cyberWolf = makeCreature({
			energy: 9,
			abilities: [{}, {}, { token: 1 }, { costs: { energy: 10 }, isUpgraded: () => false }],
			adjacentHexes: () => [],
		});

		expect(isRetreating(cyberWolf, {} as any)).toBe(true);
	});

	test('does not retreat when missed rockets exist and energy meets dynamic target locking cost', () => {
		const cyberWolf = makeCreature({
			energy: 20,
			abilities: [{}, {}, { token: 2 }, { costs: { energy: 10 }, isUpgraded: () => false }],
			adjacentHexes: () => [],
		});

		expect(isRetreating(cyberWolf, {} as any)).toBe(false);
	});
});
