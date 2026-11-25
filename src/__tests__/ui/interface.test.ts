import { describe, expect, jest, test } from '@jest/globals';
import type Game from '../../game';
import { areMetaPowersEnabledForBuild, areTurnActionButtonsDisabled } from '../../ui/interface';

const gameWithTurn = ({
	controller = 'human',
	multiplayer = false,
	isMyTurn = true,
}: {
	controller?: 'human' | 'bot';
	multiplayer?: boolean;
	isMyTurn?: boolean;
} = {}) =>
	({
		activeCreature: { player: { controller } },
		multiplayer,
		lobby: { isMyTurn: jest.fn(() => isMyTurn) },
	} as unknown as Game);

describe('turn action button availability', () => {
	test('disables skip and delay for bot-controlled turns', () => {
		expect(areTurnActionButtonsDisabled(gameWithTurn({ controller: 'bot' }))).toBe(true);
	});

	test("disables skip and delay during another player's online turn", () => {
		expect(areTurnActionButtonsDisabled(gameWithTurn({ multiplayer: true, isMyTurn: false }))).toBe(
			true,
		);
	});

	test('keeps skip and delay enabled for local human turns', () => {
		expect(areTurnActionButtonsDisabled(gameWithTurn())).toBe(false);
		expect(areTurnActionButtonsDisabled(gameWithTurn({ multiplayer: true, isMyTurn: true }))).toBe(
			false,
		);
	});
});

describe('meta powers build availability', () => {
	test('enables meta powers for local development builds', () => {
		expect(areMetaPowersEnabledForBuild('development', '')).toBe(true);
	});

	test('enables meta powers for Vercel preview builds', () => {
		expect(areMetaPowersEnabledForBuild('production', 'preview')).toBe(true);
	});

	test('keeps meta powers disabled for Vercel production builds', () => {
		expect(areMetaPowersEnabledForBuild('production', 'production')).toBe(false);
	});
});
