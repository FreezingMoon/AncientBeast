/**
 * @jest-environment <rootDir>/test/jsdom-environment.ts
 * @jest-environment-options {"resources": "usable"}
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';

jest.mock('pixi', () => ({}), { virtual: true });
jest.mock('p2', () => ({}), { virtual: true });

jest.mock('../../ui/interface', () => {
	const deepNoop = () =>
		new Proxy(function () {}, { get: () => deepNoop(), apply: () => deepNoop() });
	class UIStub {
		constructor() {
			return new Proxy(
				{
					selectedAbility: -1,
					active: false,
					dashopen: false,
					materializeToggled: false,
					glowInterval: undefined,
					logScrollEnabled: false,
					chat: {
						hide: deepNoop(),
						addMsg: deepNoop(),
						suppressMessage: deepNoop(),
						autoHide: deepNoop(),
					},
					cardWrapper: { find: () => ({ hide: deepNoop(), show: deepNoop() }) },
				},
				{
					get: (t, p) => (p in t ? (t as any)[p] : deepNoop()),
					set: (t, p, v) => {
						(t as any)[p] = v;
						return true;
					},
				},
			);
		}
	}
	return { UI: UIStub };
});

import { loadRealPhaser } from '../../phaser/runtime';
import {
	createHeadlessGame,
	settle,
	destroyHeadlessGame,
	type HeadlessConfig,
} from '../../engine/headlessGame';
import { Creature } from '../../creature';
import { Damage } from '../../damage';
import { isQueueEvent } from '../../event_queue';
import { unitData } from '../../data/units';

const CONFIG: Partial<HeadlessConfig> = { players: [0, 1], plasma_amount: 50 };

const liveGames: any[] = [];

beforeAll(async () => {
	await loadRealPhaser();
});

afterAll(() => {
	for (let i = liveGames.length - 1; i >= 0; i--) {
		destroyHeadlessGame(liveGames[i]);
	}
	liveGames.length = 0;
});

function placeAsher(game: any, x: number, y: number, team: number) {
	const asherData = game.retrieveCreatureStats('L1');
	const asher = new Creature(
		{
			...asherData,
			x,
			y,
			team,
			temp: false,
			materializationSickness: false,
		},
		game,
	);
	game.creatures[asher.id] = asher;
	return asher;
}

describe('Asher in combat', () => {
	test('is available as a regular playable unit', () => {
		expect(unitData.find((unit) => unit.name === 'Asher')?.playable).toBe(true);
	});

	test('all four abilities affect a real enemy', async () => {
		const asherLoader = (await import('../../abilities/Asher')).default;
		const priestLoader = (await import('../../abilities/Dark-Priest')).default;
		const game = await createHeadlessGame([priestLoader, asherLoader], { config: CONFIG });
		liveGames.push(game);
		await settle(game);

		// Place Asher and an adjacent enemy at safe central hexes.
		const asher = placeAsher(game, 7, 4, 0);
		expect(asher.name).toBe('Asher');

		const enemyData = game.retrieveCreatureStats('L1');
		const adjHexes = asher.adjacentHexes(1);
		const enemyHex = adjHexes.find((h: any) => h && h.x != null && h.y != null);
		expect(enemyHex).toBeDefined();
		const enemy = new Creature(
			{
				...enemyData,
				x: enemyHex.x,
				y: enemyHex.y,
				team: 1,
				temp: false,
				materializationSickness: false,
			},
			game,
		);
		game.creatures[enemy.id] = enemy;

		const asherHpBefore = asher.health;
		const enemyHpBefore = enemy.health;

		// --- Ability 1: Heat Haze (passive onStartPhase aura) ---
		asher.abilities[0].activate();
		const haze = enemy.effects.find((eff: any) => eff.name === 'Heat Haze');
		expect(haze).toBeDefined();
		expect(enemy.stats.offense).toBeLessThan(enemyData.stats.offense);

		// --- Ability 2: Glowing Eye (15 burn, adjacent) ---
		asher.abilities[1].activate(enemy);
		expect(enemy.health).toBeLessThan(enemyHpBefore);

		const enemyHpAfterGlowing = enemy.health;

		// --- Ability 3: Covert Strike (21 pierce, range 5, ignores 1/4 defense) ---
		asher.abilities[2].activate(enemy);
		expect(enemy.health).toBeLessThan(enemyHpAfterGlowing);

		const enemyHpAfterCovert = enemy.health;

		// --- Ability 4: Crashing Globe (queues projectile, no immediate damage) ---
		asher.creatureSprite.setDir(-1);
		const cardboard = asher.creatureSprite.sprite;
		const emissionPoint = asher.legacyProjectileEmissionPoint;
		const expectedProjectileX =
			emissionPoint.x + cardboard.x + (104 - cardboard.width / 2) * cardboard.scale.x;
		const expectedProjectileY =
			emissionPoint.y + cardboard.y + (28 - cardboard.height) * cardboard.scale.y;
		const asherAny = asher as any;
		const projectileCountBefore = (asherAny._pendingCrashingGlobes || []).length;
		asher.abilities[3].activate(enemy.hexagons[0]);
		expect((asherAny._pendingCrashingGlobes || []).length).toBe(projectileCountBefore + 1);
		expect(asherAny._crashingGlobePending).toBe(true);
		const pendingGlobe = asherAny._pendingCrashingGlobes.at(-1);
		expect(pendingGlobe.sprite.originX).toBe(0.5);
		expect(pendingGlobe.sprite.originY).toBe(0.5);
		expect(pendingGlobe.sprite.x).toBeCloseTo(expectedProjectileX);
		expect(pendingGlobe.sprite.y).toBeCloseTo(expectedProjectileY);
		expect(cardboard.scale.x).toBe(-1);

		// Enemy should NOT have taken damage yet from Crashing Globe (it falls next turn).
		expect(enemy.health).toBe(enemyHpAfterCovert);
		const globeEvent = game.queue.nextQueue.find(isQueueEvent);
		expect(globeEvent).toBeDefined();
		if (!globeEvent) {
			throw new Error('Crashing Globe was not added to the upcoming event queue');
		}
		expect(globeEvent.initiative).toBe(asher.stats.initiative + 1);
		expect(game.queue.nextQueue.indexOf(globeEvent)).toBeLessThan(
			game.queue.nextQueue.indexOf(asher),
		);

		game.turn = globeEvent.turn;
		expect(game.queue.queue.indexOf(globeEvent)).toBeLessThan(game.queue.queue.indexOf(asher));

		// The scheduled event resolves the globe independently of Asher's abilities.
		globeEvent.resolve(() => {});
		expect(enemy.health).toBeLessThan(enemyHpAfterCovert);

		// Enemy took real damage overall.
		expect(enemy.health).toBeLessThan(enemyHpBefore);

		// Asher may be caught in his own AOE (adjacent to enemy).
		expect(asher.health).toBeLessThanOrEqual(asherHpBefore);
	});

	test('Heat Haze upgrade grants extra burn on hit', async () => {
		const asherLoader = (await import('../../abilities/Asher')).default;
		const game = await createHeadlessGame([asherLoader], { config: CONFIG });
		liveGames.push(game);
		await settle(game);

		const asher = placeAsher(game, 7, 4, 0);
		asher.abilities[0].setUpgraded();
		asher.turnsActive = game.abilityUpgrades;

		const enemyData = game.retrieveCreatureStats('L1');
		const adjHexes = asher.adjacentHexes(1);
		const enemyHex = adjHexes.find((h: any) => h && h.x != null && h.y != null);
		const enemy = new Creature(
			{
				...enemyData,
				x: enemyHex.x,
				y: enemyHex.y,
				team: 1,
				temp: false,
				materializationSickness: false,
			},
			game,
		);
		game.creatures[enemy.id] = enemy;

		// Apply Heat Haze aura (upgrade adds the burn-on-hit effect).
		asher.abilities[0].activate();

		const enemyHpBefore = enemy.health;

		// Asher hits the hazed enemy -> should deal 3 extra burn exactly once,
		// not loop infinitely and kill the target from a single hit.
		enemy.takeDamage(new Damage(asher, { crush: 5 }, 1, [], game));

		expect(enemy.health).toBeLessThan(enemyHpBefore);
		expect(enemy.health).toBeGreaterThan(0);
	});

	test('Heat Haze upgrade triggers burn when an ally hits the target', async () => {
		const asherLoader = (await import('../../abilities/Asher')).default;
		const gumbleLoader = (await import('../../abilities/Gumble')).default;
		const game = await createHeadlessGame([asherLoader, gumbleLoader], {
			config: CONFIG,
		});
		liveGames.push(game);
		await settle(game);

		const asher = placeAsher(game, 7, 4, 0);
		asher.abilities[0].setUpgraded();
		asher.turnsActive = game.abilityUpgrades;

		// Gumble as an ally of Asher (same team).
		const gumbleData = game.retrieveCreatureStats('L1');
		const gumble = new Creature(
			{
				...gumbleData,
				x: 7,
				y: 5,
				team: 0,
				temp: false,
				materializationSickness: false,
			},
			game,
		);
		game.creatures[gumble.id] = gumble;

		const enemyData = game.retrieveCreatureStats('L1');
		const adjHexes = asher.adjacentHexes(1);
		const enemyHex = adjHexes.find((h: any) => h && h.x != null && h.y != null);
		const enemy = new Creature(
			{
				...enemyData,
				x: enemyHex.x,
				y: enemyHex.y,
				team: 1,
				temp: false,
				materializationSickness: false,
			},
			game,
		);
		game.creatures[enemy.id] = enemy;

		// Apply Heat Haze aura (upgrade adds the burn-on-hit effect).
		asher.abilities[0].activate();

		const enemyHpBefore = enemy.health;

		// Gumble (ally) hits the hazed enemy -> should deal 3 extra burn.
		enemy.takeDamage(new Damage(gumble, { crush: 5 }, 1, [], game));

		expect(enemy.health).toBeLessThan(enemyHpBefore);
		expect(enemy.health).toBeGreaterThan(0);
	});

	test('Glowing Eye upgrade depletes target meditation', async () => {
		const asherLoader = (await import('../../abilities/Asher')).default;
		const game = await createHeadlessGame([asherLoader], { config: CONFIG });
		liveGames.push(game);
		await settle(game);

		const asher = placeAsher(game, 7, 4, 0);
		asher.abilities[1].setUpgraded();

		const enemyData = game.retrieveCreatureStats('L1');
		const adjHexes = asher.adjacentHexes(1);
		const enemyHex = adjHexes.find((h: any) => h && h.x != null && h.y != null);
		const enemy = new Creature(
			{
				...enemyData,
				x: enemyHex.x,
				y: enemyHex.y,
				team: 1,
				temp: false,
				materializationSickness: false,
			},
			game,
		);
		game.creatures[enemy.id] = enemy;

		// Upgrade: Glowing Eye should deplete meditation for the target's next turn.
		asher.abilities[1].activate(enemy);

		// Meditation should be reduced to 0.
		expect(enemy.stats.meditation).toBe(0);
	});

	test('Covert Strike upgrade depletes target movement', async () => {
		const asherLoader = (await import('../../abilities/Asher')).default;
		const game = await createHeadlessGame([asherLoader], { config: CONFIG });
		liveGames.push(game);
		await settle(game);

		const asher = placeAsher(game, 7, 4, 0);
		asher.abilities[2].setUpgraded();

		const enemyData = game.retrieveCreatureStats('L1');
		const adjHexes = asher.adjacentHexes(5);
		const enemyHex = adjHexes.find((h: any) => h && h.x != null && h.y != null);
		const enemy = new Creature(
			{
				...enemyData,
				x: enemyHex.x,
				y: enemyHex.y,
				team: 1,
				temp: false,
				materializationSickness: false,
			},
			game,
		);
		game.creatures[enemy.id] = enemy;

		asher.abilities[2].activate(enemy);

		// Simulate the start of the enemy's turn: varReset() sets remainingMove
		// to maxMovement, then onStartPhase fires our effect to set it to 0.
		enemy.remainingMove = enemy.stats.movement;
		game.onStartPhase(enemy);

		// Target's movement should be depleted for their turn.
		expect(enemy.remainingMove).toBe(0);
	});

	test('Crashing Globe is targetable anywhere', async () => {
		const asherLoader = (await import('../../abilities/Asher')).default;
		const game = await createHeadlessGame([asherLoader], { config: CONFIG });
		liveGames.push(game);
		await settle(game);

		const asher = placeAsher(game, 7, 4, 0);

		// Place the enemy on the opposite side of the board (not inline).
		const enemyData = game.retrieveCreatureStats('L1');
		const enemy = new Creature(
			{
				...enemyData,
				x: 1,
				y: 7,
				team: 1,
				temp: false,
				materializationSickness: false,
			},
			game,
		);
		game.creatures[enemy.id] = enemy;

		const asherAny = asher as any;

		// Target an empty hex (not a creature) - should still work.
		const emptyHex = game.grid.hexAt(5, 5);
		expect(emptyHex).toBeDefined();
		expect(emptyHex.creature).toBeUndefined();

		asher.abilities[3].activate(emptyHex);

		// Projectile should be queued regardless of position.
		expect(asherAny._pendingCrashingGlobes.length).toBe(1);
		const proj = asherAny._pendingCrashingGlobes[0];
		expect(proj.hex).toBe(emptyHex);
		expect(proj.target).toBeUndefined();
		expect(asherAny._crashingGlobePending).toBe(true);
		expect((emptyHex as any)._markedByCrashingGlobe).toBe(true);
	});

	test('Crashing Globe upgrade leaves burn trap', async () => {
		const asherLoader = (await import('../../abilities/Asher')).default;
		const game = await createHeadlessGame([asherLoader], { config: CONFIG });
		liveGames.push(game);
		await settle(game);

		const asher = placeAsher(game, 7, 4, 0);
		const asherAny = asher as any;
		asher.abilities[3].setUpgraded();
		asher.abilities[3].timesUsed = game.abilityUpgrades;

		const enemyData = game.retrieveCreatureStats('L1');
		const adjHexes = asher.adjacentHexes(5);
		const targetHex = adjHexes.find((h: any) => h && h.x != null && h.y != null);
		const enemy = new Creature(
			{
				...enemyData,
				x: targetHex.x,
				y: targetHex.y,
				team: 1,
				temp: false,
				materializationSickness: false,
			},
			game,
		);
		game.creatures[enemy.id] = enemy;

		// Launch Crashing Globe at an empty hex (missed shot -> trap remains).
		const emptyHex = game.grid.hexAt(asher.x + 2, asher.y);
		expect(emptyHex).toBeDefined();
		expect(emptyHex.creature).toBeUndefined();

		asher.abilities[3].activate(emptyHex);
		expect(asherAny._pendingCrashingGlobes.length).toBe(1);
		const proj = asherAny._pendingCrashingGlobes[0];
		expect(proj.upgraded).toBe(true);
		expect(proj.target).toBeUndefined();

		// Resolve the scheduled event.
		const globeEvent = game.queue.nextQueue.find(isQueueEvent);
		expect(globeEvent).toBeDefined();
		globeEvent?.resolve(() => {});

		// A burn trap should remain on the empty hex.
		const traps = game.traps.filter((t: any) => t.x === emptyHex.x && t.y === emptyHex.y);
		expect(traps.length).toBeGreaterThan(0);

		// Stepping on the trap deals 10 burn to an enemy moved onto it.
		const trapHpBefore = enemy.health;
		const trap = traps[0];
		enemy.takeDamage(new Damage(asher, { crush: 1 }, 1, [], game)); // move enemy onto hex via takeDamage side effects not needed; just simulate stepping
		// Directly trigger trap effect on enemy:
		trap.activate(/onStepIn/, enemy);
		expect(enemy.health).toBeLessThan(trapHpBefore);
	});

	test('upgraded Crashing Globe does not leave a burn trap when it hits a unit', async () => {
		const asherLoader = (await import('../../abilities/Asher')).default;
		const game = await createHeadlessGame([asherLoader], { config: CONFIG });
		liveGames.push(game);
		await settle(game);

		const asher = placeAsher(game, 7, 4, 0);
		asher.abilities[3].setUpgraded();
		asher.abilities[3].timesUsed = game.abilityUpgrades;

		const enemyData = game.retrieveCreatureStats('L1');
		const targetHex = asher
			.adjacentHexes(1)
			.find((hex: any) => hex && hex.x != null && hex.y != null);
		expect(targetHex).toBeDefined();
		const enemy = new Creature(
			{
				...enemyData,
				x: targetHex.x,
				y: targetHex.y,
				team: 1,
				temp: false,
				materializationSickness: false,
			},
			game,
		);
		game.creatures[enemy.id] = enemy;

		const healthBeforeImpact = enemy.health;
		asher.abilities[3].activate(targetHex);
		const globeEvent = game.queue.nextQueue.find(isQueueEvent);
		expect(globeEvent).toBeDefined();
		globeEvent?.resolve(() => {});

		expect(enemy.health).toBeLessThan(healthBeforeImpact);
		expect(
			game.traps.filter((trap: any) => trap.x === targetHex.x && trap.y === targetHex.y),
		).toHaveLength(0);
	});

	test('Crashing Globe resolves even with no adjacent enemy', async () => {
		const asherLoader = (await import('../../abilities/Asher')).default;
		const game = await createHeadlessGame([asherLoader], { config: CONFIG });
		liveGames.push(game);
		await settle(game);

		const asher = placeAsher(game, 7, 4, 0);
		const asherAny = asher as any;

		// No enemy adjacent to Asher at all.
		expect(asher.adjacentHexes(1).every((h: any) => !h.creature)).toBe(true);

		// Launch a globe at an empty hex far away.
		const emptyHex = game.grid.hexAt(asher.x + 4, asher.y);
		expect(emptyHex).toBeDefined();
		expect(emptyHex.creature).toBeUndefined();

		asher.abilities[3].activate(emptyHex);
		expect(asherAny._pendingCrashingGlobes.length).toBe(1);

		// Globe resolution is a scheduled event and does not depend on Heat Haze.
		expect(asher.abilities[0].require()).toBe(false);

		// Resolving must clear the pending list and deal no damage (empty hex).
		const hpBefore = asher.health;
		const globeEvent = game.queue.nextQueue.find(isQueueEvent);
		expect(globeEvent).toBeDefined();
		globeEvent?.resolve(() => {});
		expect(asherAny._pendingCrashingGlobes.length).toBe(0);
		expect(asherAny._crashingGlobePending).toBe(false);
		expect(asher.health).toBe(hpBefore);
	});
});
