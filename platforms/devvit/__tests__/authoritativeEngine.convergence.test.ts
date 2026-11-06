/**
 * @jest-environment <rootDir>/test/jsdom-environment.ts
 * @jest-environment-options {"resources": "usable"}
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, describe, test, expect } from '@jest/globals';

jest.mock('pixi', () => ({}), { virtual: true });
jest.mock('p2', () => ({}), { virtual: true });

jest.mock('../../../src/ui/interface', () => {
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
					_abilityPanelAnimating: false,
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

import { loadRealPhaser } from '../../../src/phaser/runtime';
import {
	createHeadlessGame,
	applyIntent,
	settle,
	serializeState,
	destroyHeadlessGame,
	type HeadlessConfig,
} from '../../../src/engine/headlessGame';
import type { Intent } from '../authoritativeTypes';

const ABILITY_FILES = [
	'../../../src/abilities/Abolished',
	'../../../src/abilities/Bounty-Hunter',
	'../../../src/abilities/Chimera',
	'../../../src/abilities/Cyber-Wolf',
	'../../../src/abilities/Cycloper',
	'../../../src/abilities/Dark-Priest',
	'../../../src/abilities/Golden-Wyrm',
	'../../../src/abilities/Gumble',
	'../../../src/abilities/Headless',
	'../../../src/abilities/Horn-Head',
	'../../../src/abilities/Impaler',
	'../../../src/abilities/Infernal',
	'../../../src/abilities/Knightmare',
	'../../../src/abilities/Miss-Creeper',
	'../../../src/abilities/Nutcase',
	'../../../src/abilities/Scavenger',
	'../../../src/abilities/Snow-Bunny',
	'../../../src/abilities/Stomper',
	'../../../src/abilities/Swine-Thug',
	'../../../src/abilities/Uncle-Fungus',
	'../../../src/abilities/Vehemoth',
];

async function loadAbilities(): Promise<Array<(G: any) => void>> {
	const loaders: Array<(G: any) => void> = [];
	for (const f of ABILITY_FILES) {
		try {
			const mod = await import(f);
			loaders.push((mod.default ?? mod) as (G: any) => void);
		} catch {
			// Ability failed to load — game still runs without it.
		}
	}
	return loaders;
}

function findReachableHex(game: any): { x: number; y: number } | null {
	const ac = game.activeCreature;
	if (!ac) return null;
	for (const row of game.grid.hexes) {
		for (const h of row) {
			if (h.reachable && !h.creature && !(h.x === ac.x && h.y === ac.y)) {
				return { x: h.x, y: h.y };
			}
		}
	}
	return null;
}

function stopTimers(game: any) {
	if (game?.timeInterval) clearInterval(game.timeInterval);
}

const CONFIG: Partial<HeadlessConfig> = { players: [0, 1] };

const liveGames: any[] = [];

const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;

describe('Authoritative server engine (convergence)', () => {
	beforeAll(async () => {
		await loadRealPhaser();
		const timerMap = new Map<number, () => void>();
		let timerId = 0;
		globalThis.setTimeout = ((callback: (...args: unknown[]) => void, _delay?: number) => {
			const id = ++timerId;
			timerMap.set(id, callback as () => void);
			Promise.resolve().then(() => {
				const cb = timerMap.get(id);
				if (cb) {
					timerMap.delete(id);
					cb();
				}
			});
			return id as unknown as ReturnType<typeof setTimeout>;
		}) as typeof setTimeout;
		globalThis.clearTimeout = ((id: ReturnType<typeof setTimeout>) => {
			timerMap.delete(id as unknown as number);
		}) as typeof clearTimeout;
	});

	afterAll(() => {
		globalThis.setTimeout = realSetTimeout;
		globalThis.clearTimeout = realClearTimeout;
		for (let i = liveGames.length - 1; i >= 0; i--) {
			destroyHeadlessGame(liveGames[i]);
		}
		liveGames.length = 0;
	});

	test('same ordered intents converge on independent engine instances', async () => {
		const abilities = await loadAbilities();

		const g1 = await createHeadlessGame(abilities, { config: CONFIG });
		liveGames.push(g1);
		stopTimers(g1);

		const intents: Intent[] = [];
		for (let i = 0; i < 12; i++) {
			await settle(g1);

			const hex = findReachableHex(g1);
			const intent: Intent = hex ? { kind: 'move', target: hex } : { kind: 'skip' };
			intents.push(intent);

			applyIntent(g1, intent);
			await settle(g1);
		}
		const firstRun = serializeState(g1);
		stopTimers(g1);

		const g2 = await createHeadlessGame(abilities, { config: CONFIG });
		liveGames.push(g2);
		stopTimers(g2);
		for (const intent of intents) {
			applyIntent(g2, intent);
			await settle(g2);
		}

		expect(serializeState(g2)).toEqual(firstRun);
		expect(intents.length).toBe(12);
	}, 120_000);
});
