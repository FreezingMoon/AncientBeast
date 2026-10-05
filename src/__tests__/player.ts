import { jest, expect, describe, test } from '@jest/globals';

// The real Phaser bundle needs a canvas context at import time, which jsdom
// does not provide; `plasma-field` reaches it for `BlendModes`.
jest.mock('phaser', () =>
	(
		jest.requireActual('../../test/phaser-mock') as typeof import('../../test/phaser-mock')
	).createPhaserMock(),
);

import { BLOOD_BONUS, Player, ScoreEvent } from '../player';
import type Game from '../game';

/* eslint-disable @typescript-eslint/ban-ts-comment */

// @ts-ignore — Player only reads these handful of game fields.
function getGameMock(): Game {
	return {
		plasma_amount: 30,
		availableCreatures: [],
		timePool: 25,
		metaPowersState: { disableMaterializationSickness: false },
		channels: { metaPowers: { on: () => {} } },
		bloodCount: 0,
	} as unknown as Game;
}

function getPlayerMock(): Player {
	return new Player(0, getGameMock());
}

describe('Player#getScore', () => {
	describe('blood bonus', () => {
		test('is worth 30, then 20, then 10', () => {
			expect(BLOOD_BONUS).toStrictEqual([30, 20, 10]);
		});

		test('sums every tier a single player stacked', () => {
			const player = getPlayerMock();
			player.score.push(
				{ type: 'firstKill', points: BLOOD_BONUS[0] },
				{ type: 'firstKill', points: BLOOD_BONUS[1] },
				{ type: 'firstKill', points: BLOOD_BONUS[2] },
			);

			const score = player.getScore();
			expect(score.firstKill).toBe(60);
			expect(score.total).toBe(60);
		});

		test('can be split across players', () => {
			const first = getPlayerMock();
			const second = getPlayerMock();
			const third = getPlayerMock();
			first.score.push({ type: 'firstKill', points: BLOOD_BONUS[0] });
			second.score.push({ type: 'firstKill', points: BLOOD_BONUS[1] });
			third.score.push({ type: 'firstKill', points: BLOOD_BONUS[2] });

			expect(first.getScore().firstKill).toBe(30);
			expect(second.getScore().firstKill).toBe(20);
			expect(third.getScore().firstKill).toBe(10);
		});

		test('is worth nothing once the tiers are gone', () => {
			const player = getPlayerMock();
			player.score.push({ type: 'firstKill' } as ScoreEvent);

			expect(player.getScore().firstKill).toBe(0);
			expect(player.getScore().total).toBe(0);
		});
	});

	test('annihilation is worth 99', () => {
		const player = getPlayerMock();
		player.score.push({ type: 'annihilation', player: 1 });

		const score = player.getScore();
		expect(score.annihilation).toBe(99);
		expect(score.total).toBe(99);
	});
});
