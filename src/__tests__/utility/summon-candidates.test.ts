import { expect, describe, test } from '@jest/globals';
import { getRandomSummonCandidates } from '../../utility/summon-candidates';
import type Game from '../../game';
import type { CreatureType } from '../../data/types';

const A1 = 'A1' as unknown as CreatureType;
const G2 = 'G2' as unknown as CreatureType;

/**
 * Minimal Game stand-in. The helper needs creature stats to work out plasma
 * costs and player creature history to avoid cross-player copy-catting.
 * 'A1' costs 2 and 'G2' costs 4.
 */
function makeGame(usedTypes: readonly CreatureType[] = []): Game {
	const game = {
		retrieveCreatureStats: (type: CreatureType) => ({
			size: Number.parseInt(type.substring(1, 2), 10),
			playable: true,
		}),
		players: usedTypes.map((type) => ({ creatures: [{ type }] })),
	};

	return game as unknown as Game;
}

describe('getRandomSummonCandidates', () => {
	test('returns every candidate when nothing was materialized before', () => {
		const candidates = [A1, G2];

		expect(getRandomSummonCandidates(makeGame(), candidates, 10, null)).toEqual([A1, G2]);
		expect(getRandomSummonCandidates(makeGame(), candidates, 10)).toEqual([A1, G2]);
	});

	test('does not offer P1 materialization to P4 when another unit is affordable', () => {
		const candidates = [A1, G2];
		const game = makeGame([A1]);

		expect(getRandomSummonCandidates(game, candidates, 10, null)).toEqual([G2]);
	});

	test('cross-player filtering is a preference when the unused unit is unaffordable', () => {
		const candidates = [A1, G2];
		const game = makeGame([A1]);

		// G2 is globally unused but costs 4, so a player with 2 plasma must keep
		// the original pool available rather than fall back to the priest.
		expect(getRandomSummonCandidates(game, candidates, 2, null)).toEqual([A1, G2]);
	});

	test('drops the type materialized right before when something else is affordable', () => {
		const candidates = [A1, G2];
		const result = getRandomSummonCandidates(makeGame(), candidates, 10, A1);

		expect(result).toEqual([G2]);
	});

	test('keeps the type materialized right before when nothing else is affordable', () => {
		// 'A1' costs 2 and 'G2' costs 4, so 2 plasma only affords 'A1'.
		const candidates = [A1, G2];
		const result = getRandomSummonCandidates(makeGame(), candidates, 2, A1);

		expect(result).toEqual([A1, G2]);
	});

	test('keeps the type materialized right before when it is the only candidate', () => {
		const candidates = [A1];
		const result = getRandomSummonCandidates(makeGame(), candidates, 10, A1);

		expect(result).toEqual([A1]);
	});

	test('does not mutate the candidates it was given', () => {
		// The caller shuffles the result in place, so the source array must survive.
		const candidates = [A1, G2];
		const result = getRandomSummonCandidates(makeGame(), candidates, 10, null);

		result.reverse();

		expect(candidates).toEqual([A1, G2]);
	});
});
