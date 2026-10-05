import $j from 'jquery';
import { describe, expect, test } from '@jest/globals';
import { UI } from '../../ui/interface';

const ABILITY_MSG = {
	noTarget: 'No targets available.',
	notEnough: 'Not enough %stat%.',
	passiveCycle: 'Switches between any usable abilities.',
	passiveUnavailable: 'No usable abilities to switch to.',
};

type FakeAbility = {
	used: boolean;
	message: string;
	require: () => boolean;
};

const createAbility = (overrides: Partial<FakeAbility> = {}): FakeAbility => ({
	used: false,
	message: '',
	require: () => true,
	...overrides,
});

/**
 * The flash helpers only read `game.activeCreature`, `game.msg` and the ability
 * buttons, so a stub context is enough to drive them.
 */
const createUi = (abilities: FakeAbility[]) => ({
	game: {
		activeCreature: { abilities },
		msg: { abilities: ABILITY_MSG },
	},
	abilitiesButtons: [0, 1, 2, 3].map(() => ({ $button: $j('<div class="ability"></div>') })),
	isAbilityBlocked: UI.prototype.isAbilityBlocked,
});

const isAbilityBlocked = (ui: ReturnType<typeof createUi>, i: number) =>
	UI.prototype.isAbilityBlocked.call(ui as unknown as UI, i);

const flashAbilityBtn = (ui: ReturnType<typeof createUi>, i: number) =>
	UI.prototype.flashAbilityBtn.call(ui as unknown as UI, i);

const flashClass = (ui: ReturnType<typeof createUi>, i: number) =>
	ui.abilitiesButtons[i].$button.hasClass('iconInvertFlash');

describe('ability icon refusal flash', () => {
	test('flashes an ability whose requirements are not met', () => {
		// Not enough energy: checkAbilities() paints the button `disabled`, and a
		// disabled button drops the click before the ability ever sees it, so the
		// flash is the only feedback the player gets.
		const ui = createUi([
			createAbility(),
			createAbility({
				message: ABILITY_MSG.notEnough.replace('%stat%', 'energy'),
				require: () => false,
			}),
		]);

		flashAbilityBtn(ui, 1);

		expect(flashClass(ui, 1)).toBe(true);
	});

	test('does not flash a usable ability', () => {
		const ui = createUi([createAbility(), createAbility()]);

		flashAbilityBtn(ui, 1);

		expect(flashClass(ui, 1)).toBe(false);
	});

	test('flashes an ability that has already been used', () => {
		const ui = createUi([createAbility(), createAbility({ used: true })]);

		flashAbilityBtn(ui, 1);

		expect(flashClass(ui, 1)).toBe(true);
	});

	test('flashes an ability with no target in range', () => {
		const ui = createUi([
			createAbility(),
			createAbility({ message: ABILITY_MSG.noTarget, require: () => false }),
		]);

		flashAbilityBtn(ui, 1);

		expect(flashClass(ui, 1)).toBe(true);
	});

	test('reports an unmet requirement through isAbilityBlocked()', () => {
		const ui = createUi([
			createAbility(),
			createAbility({ message: ABILITY_MSG.notEnough, require: () => false }),
			createAbility(),
			createAbility(),
		]);

		expect(isAbilityBlocked(ui, 1)).toBe(true);
		expect(isAbilityBlocked(ui, 2)).toBe(false);
	});

	test('reports an ability that has already been used', () => {
		const ui = createUi([createAbility(), createAbility({ used: true })]);

		expect(isAbilityBlocked(ui, 1)).toBe(true);
	});

	test('reads the passive slot from its message, not from require()', () => {
		const cycling = createUi([
			createAbility({ message: ABILITY_MSG.passiveCycle, require: () => false }),
			createAbility(),
		]);
		const unavailable = createUi([
			createAbility({ message: ABILITY_MSG.passiveUnavailable, require: () => false }),
			createAbility(),
		]);

		expect(isAbilityBlocked(cycling, 0)).toBe(false);
		expect(isAbilityBlocked(unavailable, 0)).toBe(true);
	});

	test('tolerates a missing ability slot', () => {
		const ui = createUi([createAbility()]);

		expect(isAbilityBlocked(ui, 3)).toBe(false);

		flashAbilityBtn(ui, 3);

		expect(flashClass(ui, 3)).toBe(false);
	});
});
