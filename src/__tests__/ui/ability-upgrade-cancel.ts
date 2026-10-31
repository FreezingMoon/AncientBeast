import $j from 'jquery';
import { describe, expect, jest, test } from '@jest/globals';
import { UI } from '../../ui/interface';

/**
 * Regression test for #2016: skipping (or delaying) the turn while the
 * ability-upgrade icon animation is still running must cancel ALL of its
 * deferred timeouts — the 300ms sound, the 1200ms icon swap and the 1500ms
 * transition end — and strip the half-applied classes, otherwise the pending
 * callbacks land on the next creature's buttons mid-transition and the icons
 * snap in and out instead of animating smoothly.
 */

const createUpgradeableAbility = () => ({
	used: true,
	upgraded: false,
	isUpgradedPerUse: () => true,
	isUpgraded: function () {
		return this.upgraded;
	},
	usesLeftBeforeUpgrade: () => 0,
	setUpgraded: function () {
		this.upgraded = true;
	},
	require: () => true,
	message: '',
	title: 'Test Ability',
	desc: '',
	info: '',
	getFormattedCosts: () => '',
	getFormattedDamages: () => '',
	getFormattedEffects: () => '',
	hasUpgrade: () => false,
});

const createUi = () => {
	const abilities = [
		createUpgradeableAbility(),
		createUpgradeableAbility(),
		createUpgradeableAbility(),
		createUpgradeableAbility(),
	];
	const ui = {
		game: {
			activeCreature: { abilities },
			configData: { abilityUpgrades: 1 },
			soundsys: { playSFX: jest.fn() },
		},
		abilitiesButtons: [0, 1, 2, 3].map((abilityId) => ({
			abilityId,
			$button: $j('<div class="ability"></div>'),
			changeState: jest.fn(),
		})),
		upgradeAnimationTimeouts: [],
		animationUpgradeTimeOutID: null,
		cancelUpgradeAnimation: UI.prototype.cancelUpgradeAnimation,
		updateAbilityUpgrades: UI.prototype.updateAbilityUpgrades,
	} as unknown as UI;
	return { ui, abilities };
};

describe('ability upgrade animation cancellation (#2016)', () => {
	test('schedules all three deferred animation steps', () => {
		jest.useFakeTimers();
		try {
			const { ui } = createUi();

			ui.updateAbilityUpgrades();

			expect(ui.upgradeAnimationTimeouts).toHaveLength(12);
			expect(ui.animationUpgradeTimeOutID).not.toBeNull();
			expect(ui.abilitiesButtons[0].$button.hasClass('upgradeTransition')).toBe(true);
			expect(ui.abilitiesButtons[0].$button.hasClass('upgradeIcon')).toBe(true);
		} finally {
			jest.useRealTimers();
		}
	});

	test('cancelUpgradeAnimation clears every timeout and resets button classes', () => {
		jest.useFakeTimers();
		try {
			const { ui } = createUi();

			ui.updateAbilityUpgrades();
			const pending = [...ui.upgradeAnimationTimeouts];
			expect(pending.length).toBeGreaterThan(0);

			const clearSpy = jest.spyOn(global, 'clearTimeout');
			ui.cancelUpgradeAnimation();

			for (const timeoutId of pending) {
				expect(clearSpy).toHaveBeenCalledWith(timeoutId);
			}
			expect(ui.upgradeAnimationTimeouts).toHaveLength(0);
			expect(ui.animationUpgradeTimeOutID).toBeNull();
			for (const btn of ui.abilitiesButtons) {
				expect(btn.$button.hasClass('upgradeTransition')).toBe(false);
				expect(btn.$button.hasClass('upgradeIcon')).toBe(false);
			}

			// Firing the real timers afterwards must not touch the buttons again.
			jest.runAllTimers();
			for (const btn of ui.abilitiesButtons) {
				expect(btn.$button.hasClass('upgradeTransition')).toBe(false);
				expect(btn.$button.hasClass('upgradeIcon')).toBe(false);
			}
			clearSpy.mockRestore();
		} finally {
			jest.useRealTimers();
		}
	});

	test('a cancelled upgrade sound never plays after the turn changed', () => {
		jest.useFakeTimers();
		try {
			const { ui } = createUi();

			ui.updateAbilityUpgrades();
			ui.cancelUpgradeAnimation();
			jest.runAllTimers();

			expect(ui.game.soundsys.playSFX).not.toHaveBeenCalled();
		} finally {
			jest.useRealTimers();
		}
	});
});
