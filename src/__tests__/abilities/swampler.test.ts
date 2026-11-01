import { describe, expect, jest, test } from '@jest/globals';
import loadSwamplerAbilities from '../../abilities/Swampler';

jest.mock('../../vfx/goo-sneeze', () => ({
	spawnGooSneeze: jest.fn(
		(_game: unknown, _creature: unknown, _hex: unknown, onImpact: () => void) => onImpact(),
	),
}));

jest.mock('../../damage', () => ({
	Damage: class DamageMock {
		attacker: unknown;
		damages: unknown;
		area: number;
		effects: unknown[];
		game: unknown;

		constructor(
			attacker: unknown,
			damages: unknown,
			area: number,
			effects: unknown[],
			game: unknown,
		) {
			this.attacker = attacker;
			this.damages = damages;
			this.area = area;
			this.effects = effects;
			this.game = game;
		}
	},
}));

jest.mock('../../effect', () => ({
	Effect: class EffectMock {
		title: string;
		name: string;
		target: any;
		owner: any;
		trigger: string;
		turnLifetime: number;
		deleteTrigger: string;
		alterations: Record<string, number>;
		deleteOnOwnerDeath: boolean;
		stackable: boolean;
		effectFn: (...args: any[]) => void = () => undefined;

		constructor(
			title: string,
			owner: any,
			target: any,
			trigger: string,
			options: any,
			_game: unknown,
		) {
			this.title = title;
			this.name = title;
			this.owner = owner;
			this.target = target;
			this.trigger = trigger;
			this.turnLifetime = options.turnLifetime;
			this.deleteTrigger = options.deleteTrigger;
			this.alterations = options.alterations;
			this.deleteOnOwnerDeath = options.deleteOnOwnerDeath;
			this.stackable = options.stackable;
		}

		deleteEffect = jest.fn();
	},
}));

jest.mock('../../game-display/camera', () => ({ shakeBoard: jest.fn() }));

describe('Swampler Goo Sneeze', () => {
	test('Natural Habitat triggers only at the end of Swampler’s first active turn', () => {
		const claimedHex = {
			_swamplerHomeOwner: undefined as number | undefined,
			updateStyle: jest.fn(),
		};
		const game = {
			abilities: [] as any[],
			grid: { hexes: [[undefined, claimedHex]] },
			log: jest.fn(),
		};
		loadSwamplerAbilities(game as never);
		const habitat = game.abilities[13][0];
		const creature = {
			id: 13,
			team: 0,
			turnsActive: 1,
			materializationSickness: false,
			x: 1,
			y: 0,
			addEffect: jest.fn(),
			updateAlteration: jest.fn(),
			hint: jest.fn(),
		};

		const ability = {
			...habitat,
			creature,
			isUpgraded: () => false,
		};

		expect(ability.require()).toBe(true);
		ability.activate();
		expect(claimedHex._swamplerHomeOwner).toBe(creature.id);
		expect(claimedHex.updateStyle).toHaveBeenCalled();
		expect(creature.addEffect).toHaveBeenCalledWith(
			expect.objectContaining({
				title: 'Natural Habitat',
				alterations: { poison: 22 },
				trigger: 'onStepIn',
			}),
		);
		const homeEffect = creature.addEffect.mock.calls[0][0] as {
			effectFn: (effect?: unknown, event?: unknown) => void;
			alterations: Record<string, number>;
		};
		const leaveHomeEffect = creature.addEffect.mock.calls[1][0] as {
			effectFn: (effect?: unknown, event?: unknown) => void;
		};
		const elsewhere = { _swamplerHomeOwner: undefined };

		leaveHomeEffect.effectFn(leaveHomeEffect, claimedHex);
		expect(homeEffect.alterations).toEqual({});
		expect(creature.updateAlteration).toHaveBeenCalledTimes(1);

		homeEffect.effectFn(homeEffect, elsewhere);
		expect(homeEffect.alterations).toEqual({});

		homeEffect.effectFn(homeEffect, claimedHex);
		expect(homeEffect.alterations).toEqual({ poison: 22 });
		expect(creature.updateAlteration).toHaveBeenCalledTimes(2);
		expect(creature.hint).toHaveBeenCalledWith('Home', 'msg_effects');

		expect(ability.require.call({ ...ability, creature: { ...creature, turnsActive: 2 } })).toBe(
			false,
		);
		expect(
			ability.require.call({
				...ability,
				creature: { ...creature, materializationSickness: true },
			}),
		).toBe(false);
	});

	function makeCreature(status = '', regrowth = 0) {
		const hex = {
			creature: undefined as any,
		};
		const creature = {
			id: 1,
			dead: false,
			effects: [] as any[],
			hexagons: [hex],
			game: { activeCreature: undefined as any, log: jest.fn() },
			player: { plasma: 0 },
			stats: { regrowth },
			isDarkPriest: jest.fn(() => false),
			hasCreaturePlayerGotPlasma: jest.fn(() => creature.player.plasma > 0),
			hasActivePlasmaShield: jest.fn(
				() =>
					creature.isDarkPriest() &&
					creature.hasCreaturePlayerGotPlasma() &&
					(creature !== creature.game.activeCreature || creature.plasmaActive),
			),
			plasmaActive: true,
			adjacentHexes: jest.fn(() => [] as any[]),
			hint: jest.fn(),
			updateAlteration: jest.fn(),
			takeDamage: jest.fn((_damage: any) => ({ kill: false, damageObj: { status } })),
			addEffect: jest.fn((effect: any, _specialString?: string, _specialHint?: string) =>
				creature.effects.push(effect),
			),
		};
		hex.creature = creature;
		return creature;
	}

	function castWithStatus(status: string, upgraded = false, plasmaBarrier = false, regrowth = 0) {
		const game = {
			abilities: [] as any[],
			effects: [],
			effectId: 0,
			activeCreature: undefined,
			log: jest.fn(),
		};
		loadSwamplerAbilities(game as never);

		const target = makeCreature(status, regrowth);
		target.game = game;
		target.isDarkPriest.mockReturnValue(plasmaBarrier);
		target.player.plasma = plasmaBarrier ? 3 : 0;
		const creature = { dead: false };
		const ability = {
			...game.abilities[13][3],
			creature,
			damages: { crush: 4, poison: 6 },
			isUpgraded: () => upgraded,
			end: jest.fn(),
		};

		ability.activate([{ creature: target }], {});
		return target;
	}

	test('Goo Sneeze uses the normal damage pipeline against Plasma Field', () => {
		const target = castWithStatus('Shielded', false, true);

		expect(target.takeDamage).toHaveBeenCalledTimes(1);
		expect(target.takeDamage.mock.calls[0][0].damages).toEqual({ crush: 4 });
		expect(target.addEffect).not.toHaveBeenCalled();
		expect(target.player.plasma).toBe(3);
	});

	test('infects a target after the crush hit and applies poison at the end of its turn', () => {
		const target = castWithStatus('');

		expect(target.takeDamage).toHaveBeenCalledTimes(1);
		expect(target.addEffect).toHaveBeenCalledTimes(2);
		expect(target.addEffect.mock.calls[0][0]).toMatchObject({
			title: 'Contagion',
			trigger: 'onReset onStepIn onOtherStepIn',
		});
		expect(target.addEffect.mock.calls[0][0].turnLifetime).toBe(-1);
		expect(target.addEffect.mock.calls[0][1]).toBe('%CreatureName1% has been infected');
		expect(target.addEffect.mock.calls[0][2]).toBe('Infected');

		const effect = target.effects[0];
		const endTurnEffect = target.effects[1];
		endTurnEffect.effectFn(endTurnEffect, target);
		expect(effect.contagious).toBe(false);
		expect(effect.alterations).toEqual({});
		expect(target.takeDamage).toHaveBeenCalledTimes(1);

		effect.effectFn(effect, target);
		expect(effect.contagious).toBe(true);
		expect(target.hint).toHaveBeenCalledWith('Contagious', 'msg_effects');
		expect(target.game.log).toHaveBeenCalledWith('%CreatureName1% has become extremely contagious');
		expect(effect.alterations).toEqual({});
		expect(target.takeDamage).toHaveBeenCalledTimes(1);

		endTurnEffect.effectFn(endTurnEffect, target);
		expect(target.takeDamage).toHaveBeenCalledTimes(2);
		expect(target.takeDamage.mock.calls[1][0].damages).toEqual({ poison: 6 });
	});

	test('the upgrade adds 6 poison at turn start as well as turn end', () => {
		const target = castWithStatus('', true);
		const effect = target.effects[0];
		const endTurnEffect = target.effects[1];

		expect(effect.alterations).toEqual({});
		expect(target.takeDamage).toHaveBeenCalledTimes(1);
		expect(target.takeDamage.mock.calls[0][0].damages).toEqual({ crush: 4 });

		effect.effectFn(effect, target);
		expect(effect.contagious).toBe(true);
		expect(target.takeDamage).toHaveBeenCalledTimes(2);
		expect(target.takeDamage.mock.calls[1][0].damages).toEqual({ poison: 6 });

		endTurnEffect.effectFn(endTurnEffect, target);
		expect(target.takeDamage).toHaveBeenCalledTimes(3);
		expect(target.takeDamage.mock.calls[2][0].damages).toEqual({ poison: 6 });
	});

	test('a contagious unit infects adjacent units without immediately damaging them', () => {
		const carrier = castWithStatus('');
		const effect = carrier.effects[0];
		const nearby = makeCreature('');
		carrier.adjacentHexes.mockReturnValue([{ creature: nearby }]);

		effect.effectFn(effect, carrier);

		expect(nearby.takeDamage).not.toHaveBeenCalled();
		expect(nearby.addEffect).toHaveBeenCalledTimes(2);
		expect(nearby.addEffect.mock.calls[0][0]).toMatchObject({
			title: 'Contagion',
			turnLifetime: -1,
			trigger: 'onReset onStepIn onOtherStepIn',
		});
	});

	test('a contagious unit infects a unit stepping adjacent to it', () => {
		const carrier = castWithStatus('');
		const effect = carrier.effects[0];
		const nearby = makeCreature('');
		carrier.adjacentHexes.mockReturnValue([{ creature: nearby }]);

		effect.effectFn(effect, carrier);
		effect.effectFn(effect, nearby.hexagons[0]);

		expect(nearby.takeDamage).not.toHaveBeenCalled();
		expect(nearby.addEffect).toHaveBeenCalledTimes(2);
	});

	test('newly infected contagious units also spread contagion', () => {
		const contagious = castWithStatus('');
		const outlineEffect = contagious.effects[0];
		const outlined = makeCreature('');
		contagious.adjacentHexes.mockReturnValue([{ creature: outlined }]);

		outlineEffect.effectFn(outlineEffect, contagious);
		const secondaryCarrierEffect = outlined.effects[0];
		const other = makeCreature('');
		outlined.adjacentHexes.mockReturnValue([{ creature: other }]);

		secondaryCarrierEffect.effectFn(secondaryCarrierEffect, outlined);

		expect(other.takeDamage).not.toHaveBeenCalled();
		expect(other.addEffect).toHaveBeenCalledTimes(2);
	});

	test('an inactive Plasma Field blocks spread without spending plasma', () => {
		const carrier = castWithStatus('');
		const effect = carrier.effects[0];
		const protectedUnit = makeCreature('');
		protectedUnit.isDarkPriest.mockReturnValue(true);
		protectedUnit.player.plasma = 3;
		carrier.adjacentHexes.mockReturnValue([{ creature: protectedUnit }]);

		effect.effectFn(effect, carrier);

		expect(protectedUnit.takeDamage).not.toHaveBeenCalled();
		expect(protectedUnit.addEffect).not.toHaveBeenCalled();
		expect(protectedUnit.player.plasma).toBe(3);
	});

	test('an active Dark Priest whose field is down gets contagion', () => {
		const carrier = castWithStatus('');
		const effect = carrier.effects[0];
		const activePriest = makeCreature('');
		activePriest.isDarkPriest.mockReturnValue(true);
		activePriest.player.plasma = 3;
		activePriest.game.activeCreature = activePriest;
		activePriest.plasmaActive = false;
		carrier.adjacentHexes.mockReturnValue([{ creature: activePriest }]);

		effect.effectFn(effect, carrier);

		expect(activePriest.takeDamage).not.toHaveBeenCalled();
		expect(activePriest.addEffect).toHaveBeenCalledTimes(2);
	});

	test('upgraded contagion passes its start-of-turn poison to newly infected units', () => {
		const carrier = castWithStatus('', true);
		const effect = carrier.effects[0];
		const nearby = makeCreature('', 5);
		carrier.adjacentHexes.mockReturnValue([{ creature: nearby }]);

		effect.effectFn(effect, carrier);

		expect(effect.turnLifetime).toBe(-1);
		expect(nearby.addEffect.mock.calls[0][0]).toMatchObject({
			turnLifetime: -1,
			trigger: 'onReset onStepIn onOtherStepIn',
			alterations: {},
		});
		const nearbyEffect = nearby.effects[0];
		nearbyEffect.effectFn(nearbyEffect, nearby);
		expect(nearby.takeDamage).toHaveBeenCalledTimes(1);
		expect(nearby.takeDamage.mock.calls[0][0].damages).toEqual({ poison: 6 });
	});
});
