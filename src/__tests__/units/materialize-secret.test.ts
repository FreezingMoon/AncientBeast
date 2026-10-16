/**
 * @jest-environment <rootDir>/test/jsdom-environment.js
 * @jest-environment-options {"resources": "usable"}
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';

// Phaser is NOT mocked: the authoritative server runs the real engine, and a
// stubbed engine would satisfy every assertion below while proving nothing
// about the materialization that ships to players.
jest.mock('pixi', () => ({}), { virtual: true });
jest.mock('p2', () => ({}), { virtual: true });

// The authoritative server does not render, so stub the DOM-coupled UI module
// (same role the other engine suites play, applied at module load so setup()'s
// `new UI()` never touches the real DOM).
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
					// `destroyPhaser()` clears the real UI's glow interval on
					// teardown; the stub must report "none" rather than fabricate
					// a handle.
					glowInterval: undefined,
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
} from '../../devvit/headlessGame';

/**
 * Ability modules the engine loads. Mirrors `src/script.ts` for the playable
 * roster, including the secret unit under test.
 */
async function loadAbilities(): Promise<Array<(G: any) => void>> {
	const files = [
		'../../abilities/Abolished',
		'../../abilities/Bounty-Hunter',
		'../../abilities/Chimera',
		'../../abilities/Cyber-Wolf',
		'../../abilities/Cycloper',
		'../../abilities/Dark-Priest',
		'../../abilities/Golden-Wyrm',
		'../../abilities/Gumble',
		'../../abilities/Headless',
		'../../abilities/Horn-Head',
		'../../abilities/Impaler',
		'../../abilities/Infernal',
		'../../abilities/Knightmare',
		'../../abilities/Miss-Creeper',
		'../../abilities/Nutcase',
		'../../abilities/Scavenger',
		'../../abilities/Snow-Bunny',
		'../../abilities/Stomper',
		'../../abilities/Swine-Thug',
		'../../abilities/Uncle-Fungus',
		'../../abilities/Vehemoth',
	];

	const loaders: Array<(G: any) => void> = [];
	for (const file of files) {
		try {
			const mod = await import(file);
			loaders.push((mod.default ?? mod) as (G: any) => void);
		} catch {
			// Ability failed to load — game still runs without it.
		}
	}
	return loaders;
}

const CONFIG: Partial<HeadlessConfig> = { players: [0, 1], plasma_amount: 50 };

/** Every game this suite boots, torn down in `afterAll`. */
const liveGames: any[] = [];

/** The host timers, captured before `beforeAll` stubs them out. */
const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;

describe('Materializing the secret unit', () => {
	beforeAll(async () => {
		await loadRealPhaser();
		// Fire deferred callbacks on a microtask instead of the wall clock so the
		// materialization animation settles deterministically.
		const timerMap = new Map<number, () => void>();
		let timerId = 0;
		globalThis.setTimeout = ((callback: (...args: unknown[]) => void) => {
			const id = ++timerId;
			timerMap.set(id, callback as () => void);
			void Promise.resolve().then(() => {
				const pending = timerMap.get(id);
				if (pending) {
					timerMap.delete(id);
					pending();
				}
			});
			return id as unknown as ReturnType<typeof setTimeout>;
		}) as typeof setTimeout;
		globalThis.clearTimeout = ((id: ReturnType<typeof setTimeout>) => {
			timerMap.delete(id as unknown as number);
		}) as typeof clearInterval;
	});

	afterAll(() => {
		// Put the host timers back before tearing the games down, so anything
		// teardown schedules runs on the real event loop.
		globalThis.setTimeout = realSetTimeout;
		globalThis.clearTimeout = realClearTimeout;
		for (let i = liveGames.length - 1; i >= 0; i--) {
			destroyHeadlessGame(liveGames[i]);
		}
		liveGames.length = 0;
	});

	test('Miss Creeper can be placed on the board like any other unit', async () => {
		const game = await createHeadlessGame(await loadAbilities(), { config: CONFIG });
		liveGames.push(game);
		await settle(game);

		const darkPriest = game.activeCreature;
		expect(darkPriest.type).toBe('--');

		// The Dash hands the priest's 4th ability the type the player picked.
		// This used to throw on a secret unit whose data had no `display` block:
		// the placement placeholder is a full Creature, so it needs the
		// cardboard offsets every summoned unit carries.
		darkPriest.abilities[3].materialize('G4');

		// Pick the first hex offered next to the priest, as a click would.
		const query = game.grid.lastQueryOpt;
		expect(query?.hexes?.length).toBeGreaterThan(0);
		const spawnHex = query.hexes.find((hex: any) => hex.reachable);
		query.fnOnConfirm(spawnHex, query.args);
		await settle(game);

		const creeper = game.players[0].creatures.find((creature: any) => creature.type === 'G4');
		expect(creeper).toBeDefined();
		expect(creeper?.name).toBe('Miss Creeper');
		expect(creeper?.x).toBe(spawnHex.x);
		expect(creeper?.y).toBe(spawnHex.y);

		// She is a fully loaded unit: stats and both active abilities are wired.
		expect(creeper?.health).toBe(165);
		expect(creeper?.abilities.map((ability: any) => ability.title)).toEqual([
			'Muscous Pillar',
			'Carving Nails',
			'Fatal Attraction',
			'Tendril Feet',
		]);
	});

	test('released units enter the pool the bots draw from', async () => {
		const game = await createHeadlessGame(await loadAbilities(), { config: CONFIG });
		liveGames.push(game);
		await settle(game);

		// Once a secret unit is released its `playable` flips to `true`, so the
		// AI's default summon pool includes it just like any other unit.
		const { getSummonCandidates } = await import('../../utility/summon-candidates');
		const pool = getSummonCandidates(game, game.players[0].availableCreatures, {
			excludeTypes: new Set(['--']),
		} as any);

		expect(pool).toContain('G4');
		expect(pool.length).toBeGreaterThan(0);
	});
});
