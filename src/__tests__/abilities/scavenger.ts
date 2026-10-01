import { describe, expect, jest, test } from '@jest/globals';

// The real Phaser bundle needs a canvas context at import time, which jsdom
// does not provide; `plasma-field` reaches it for `BlendModes`.
jest.mock('phaser', () =>
	(
		jest.requireActual('../../../test/phaser-mock') as typeof import('../../../test/phaser-mock')
	).createPhaserMock(),
);

import Scavenger from '../../abilities/Scavenger';
import { unitData } from '../../data/units';

/* eslint-disable @typescript-eslint/no-explicit-any */

const SCAVENGER_ABILITY_GROUP = 44;

/** Register the Scavenger abilities on a bare game-like object and return them. */
const getScavengerAbilities = () => {
	const abilities: Record<number, any[]> = {};
	Scavenger({ abilities } as any);
	return abilities[SCAVENGER_ABILITY_GROUP];
};

const getWingFeathers = () => getScavengerAbilities()[0];

const getScavengerUnit = () => {
	const unit = unitData.find((u) => u.name === 'Scavenger');
	if (!unit) {
		throw new Error('Scavenger unit data not found');
	}
	return unit;
};

describe('Scavenger', () => {
	test('the Scavenger flies without upgrading Wing Feathers', () => {
		expect(getScavengerUnit().movementType).toBe('flying');
		// Flight is the unit's own movement type now, not an ability upgrade.
		expect(getWingFeathers().movementType).toBeUndefined();
	});

	test('Wing Feathers stores nothing before being upgraded', () => {
		const creature = { baseStats: { movement: 7 }, stats: { movement: 7 } };

		expect(getWingFeathers().stashedMovementCap.call({ isUpgraded: () => false, creature })).toBe(
			0,
		);
	});

	test('upgraded Wing Feathers caps stored movement at the base movement', () => {
		const creature = { baseStats: { movement: 7 }, stats: { movement: 7 } };

		expect(getWingFeathers().stashedMovementCap.call({ isUpgraded: () => true, creature })).toBe(7);
	});

	test('a movement buff does not raise the cap on stored movement', () => {
		// e.g. the Scavenger picked up a feather (+1 movement): the stash cap stays
		// tied to the base movement, so the pool can never be farmed by buffs.
		const creature = { baseStats: { movement: 7 }, stats: { movement: 8 } };

		expect(getWingFeathers().stashedMovementCap.call({ isUpgraded: () => true, creature })).toBe(7);
	});
});
