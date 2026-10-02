/**
 * `Game#activeCreature` is cleared when a match ends and when the game resets,
 * so any callback still in flight — an animation completing, a bot's delayed
 * `activateAbility`, a replay timer — can run with no active creature at all.
 *
 * Every one of those paths used to dereference it unguarded and threw
 * `Cannot read properties of undefined`. In the simulation this surfaced as
 * matches dying partway through a bot's turn; in the browser it could kill an
 * ability's cleanup chain after the victory screen had already appeared.
 *
 * These tests pin the guards: with no active creature the ability must still
 * finish its own bookkeeping rather than throwing on the way out.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Ability } from '../../ability';
import { Creature } from '../../creature';

/** Minimal creature: `Ability` only reads stats and identity off it here. */
function makeCreature(): any {
	return {
		id: 7,
		type: 'Impaler',
		health: 10,
		energy: 4,
		stats: { health: 10, energy: 5, reqEnergy: 0 },
		dead: false,
		hint: jest.fn(),
		updateHealth: jest.fn(),
		hideActivePlasmaShield: jest.fn(),
	};
}

/**
 * A game whose `activeCreature` is unset — the state a match is in between
 * `endGame()`/`resetGame()` and the last deferred callback draining.
 */
function makeGameWithoutActiveCreature(creature: any): any {
	return {
		activeCreature: undefined,
		metaPowersState: { resetCooldowns: false, infiniteEnergy: false },
		channels: {
			creature: { emit: jest.fn() },
			metaPowers: { on: jest.fn() },
		},
		abilities: {},
		retrieveCreatureStats: () => ({ id: 'Impaler', ability_info: {} }),
		clearOncePerDamageChain: jest.fn(),
		log: jest.fn(),
		freezedInput: false,
		_deferredQueryMovePending: 0,
		UI: {
			_abilityPanelAnimating: false,
			abilitiesButtons: [{ changeState: jest.fn() }],
			btnDelay: { changeState: jest.fn() },
			energyBar: { animSize: jest.fn() },
			selectAbility: jest.fn(),
		},
		__creature: creature,
	};
}

function makeAbility(game: any, creature: any): any {
	const ability = new Ability(creature as Creature, 0, game);
	// The constructor merges these from the ability's data, which an empty
	// `game.abilities` never supplies.
	ability.title = 'Impaler ability';
	ability.trigger = 'onQuery';
	ability.requirements = { energy: 2 };
	ability.costs = { energy: 2 };
	return ability;
}

describe('Ability with no active creature', () => {
	let creature: any;
	let game: any;

	beforeEach(() => {
		creature = makeCreature();
		game = makeGameWithoutActiveCreature(creature);
	});

	test('applyCost settles the cost without touching the active creature', () => {
		const ability = makeAbility(game, creature);

		expect(() => ability.applyCost()).not.toThrow();
		// The cost still lands: the guard only skips the active-creature UI.
		expect(creature.energy).toBe(2);
	});

	test('setUsed records the cooldown without touching the active creature', () => {
		const ability = makeAbility(game, creature);

		expect(() => ability.setUsed(true)).not.toThrow();
		expect(ability.used).toBe(true);
		expect(() => ability.setUsed(false)).not.toThrow();
		expect(ability.used).toBe(false);
	});

	test('end completes its bookkeeping and emits abilityend', () => {
		const ability = makeAbility(game, creature);

		expect(() => ability.end()).not.toThrow();
		expect(game.channels.creature.emit).toHaveBeenCalledWith('abilityend', {
			creature,
		});
	});

	test('end with a deferred ending still releases the freeze correctly', () => {
		const ability = makeAbility(game, creature);

		// The `deferredEnding` branch must keep arming the pending counter, which
		// is what unfreezes input later. Only the non-deferred branch calls
		// `queryMove()`, and that one is the crash the guard covers.
		expect(() => ability.end(false, true)).not.toThrow();
		expect(game.freezedInput).toBe(true);
		expect(game._deferredQueryMovePending).toBe(1);
	});

	test('use does not throw when the match has already ended', () => {
		const ability = makeAbility(game, creature);
		ability.require = () => true;
		// `query` is per-ability; the point here is that `use()` reaches it
		// without having thrown on the active-creature hint above.
		ability.query = jest.fn();

		expect(() => ability.use()).not.toThrow();
		expect(ability.query).toHaveBeenCalled();
	});
});
