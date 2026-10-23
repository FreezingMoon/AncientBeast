import { jest, expect, describe, test, beforeEach, afterEach } from '@jest/globals';

jest.mock('phaser', () =>
	(
		jest.requireActual('../../../test/phaser-mock') as typeof import('../../../test/phaser-mock')
	).createPhaserMock(),
);

import { Ability } from '../../ability';
import { Hex } from '../../utility/hex';

/**
 * `Ability#animation2` used to reset the creature's facing for every ability
 * animation, including passive triggers. A passive firing while another unit is
 * mid-animation — Horn Head's Life Support counter-firing at the Plasma Field's
 * counter damage — then turned the acting unit back to its default facing:
 * Horn Head wheeling around while its Meat Sickle hook was still flying at the
 * shielded priest behind it.
 */
describe('Ability.animation2 re-facing', () => {
	let game: any;
	let creature: any;
	let facePlayerDefault: jest.Mock;
	let faceHex: jest.Mock;

	/** Builds an `Ability` instance without the stateful constructor needs. */
	const makeAbility = (trigger: string) => {
		const ability: any = Object.create(Ability.prototype);
		Object.assign(ability, {
			creature,
			game,
			title: 'Passive',
			trigger,
			id: 0,
			used: false,
			timesUsed: 0,
			timesUsedThisTurn: 0,
			upgraded: false,
			_disableCooldowns: false,
			activate: jest.fn(),
		});
		return ability;
	};

	beforeEach(() => {
		jest.useFakeTimers();
		facePlayerDefault = jest.fn();
		faceHex = jest.fn();
		game = {
			freezedInput: false,
			animationQueue: [],
			multiplayer: false,
			tornDown: false,
			UI: { updateAbilityUpgrades: jest.fn() },
			grid: { refreshHoverState: jest.fn() },
			soundsys: { playSFX: jest.fn() },
			animations: { tiltForward: jest.fn() },
			triggers: { onUnderAttack: { test: () => false } },
			log: jest.fn(),
		};
		creature = {
			id: 8,
			sprite: { scale: { x: 1 } },
			game,
			facePlayerDefault,
			faceHex,
		};
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	test('an acting ability turns its creature towards its target', () => {
		const ability = makeAbility('onQuery');

		ability.animation2({ arg: [[{ creature: { id: 9 } }]] });

		expect(facePlayerDefault).toHaveBeenCalledTimes(1);
		expect(faceHex).toHaveBeenCalledTimes(1);
	});

	test('an acting ability turns its creature towards a confirmed hex target', () => {
		const ability = makeAbility('onQuery');
		const targetHex = Object.create(Hex.prototype) as Hex;

		ability.animation2({ arg: [targetHex] });

		expect(facePlayerDefault).toHaveBeenCalledTimes(1);
		expect(faceHex).toHaveBeenCalledWith(targetHex);
	});

	test('a passive trigger does not re-face the creature it fires on', () => {
		const ability = makeAbility('onUnderAttack');

		ability.animation2({ arg: [{ target: creature }] });

		expect(facePlayerDefault).not.toHaveBeenCalled();
		expect(faceHex).not.toHaveBeenCalled();
		// The passive still runs (and still freezes input) as before.
		expect(ability.activate).toHaveBeenCalledTimes(1);
		expect(game.freezedInput).toBe(false);
	});
});
