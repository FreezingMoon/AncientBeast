import { describe, expect, jest, test } from '@jest/globals';
import type Game from '../../game';
import { areTurnActionButtonsDisabled, getAbilityCostLine } from '../../ui/interface';

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

describe('ability card cost line (#1996)', () => {
	test('shows the energy cost for a normal ability', () => {
		expect(getAbilityCostLine({ costs: { energy: 15 } }, 1)).toBe(' - costs 15 energy pts.');
	});

	test('zero energy still counts as a cost', () => {
		expect(getAbilityCostLine({ costs: { energy: 0 } }, 2)).toBe(' - costs 0 energy pts.');
	});

	test('slot 0 is always the passive line even with a cost', () => {
		expect(getAbilityCostLine({ costs: { energy: 15 } }, 0)).toBe(' - this ability is passive.');
		expect(getAbilityCostLine({ costs: { energy: 15 } }, '0')).toBe(' - this ability is passive.');
	});

	test('Kraken-style entries without costs fall back to passive', () => {
		// Kraken's High Voltage ships no `costs` object at all.
		expect(getAbilityCostLine({ title: 'High Voltage' } as never, 1)).toBe(
			' - this ability is passive.',
		);
	});

	test('plasma-only costs fall back to passive instead of printing undefined', () => {
		// Dark Priest's Plasma Field pays plasma, not energy.
		expect(getAbilityCostLine({ costs: { plasma: 1 } } as never, 1)).toBe(
			' - this ability is passive.',
		);
	});
});
