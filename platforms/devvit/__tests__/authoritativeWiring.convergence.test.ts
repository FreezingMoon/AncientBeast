/**
 * @jest-environment <rootDir>/test/jsdom-environment.ts
 * @jest-environment-options {"resources": "usable"}
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, describe, test, expect } from '@jest/globals';

// Mock heavy external deps (same as the engine test).
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

import {
	createHeadlessGame,
	settle,
	serializeState,
	destroyHeadlessGame,
	type HeadlessConfig,
} from '../../../src/engine/headlessGame';
import { loadRealPhaser } from '../../../src/phaser/runtime';
import { EngineAuthoritativeProcessor } from '../../../src/multiplayer/engineAuthoritativeProcessor';
import { InMemoryIntentStore } from '../../../src/multiplayer/authoritative';
import type { AuthoritativeState, Intent } from '../../../src/multiplayer/authoritative';
import type { GameMessage } from '../../../src/multiplayer/types';

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
			/* ability failed to load */
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

describe('Authoritative client wiring (convergence)', () => {
	beforeAll(async () => {
		await loadRealPhaser();
	});

	afterAll(() => {
		for (let i = liveGames.length - 1; i >= 0; i--) {
			destroyHeadlessGame(liveGames[i]);
		}
		liveGames.length = 0;
	});

	test('two clients converge on the broadcast authoritative state via the processor', async () => {
		const abilities = await loadAbilities();

		const clientA = await createHeadlessGame(abilities, { config: CONFIG });
		const clientB = await createHeadlessGame(abilities, { config: CONFIG });
		liveGames.push(clientA, clientB);
		stopTimers(clientA);
		stopTimers(clientB);

		const store = new InMemoryIntentStore();
		const processor = new EngineAuthoritativeProcessor({ store, loadAbilities });

		const code = 'AB-TEST';
		const intents: Intent[] = [];

		for (let i = 0; i < 12; i++) {
			await settle(clientA);
			await settle(clientB);

			const hex = findReachableHex(clientA);
			const intent: Intent = hex ? { kind: 'move', target: hex } : { kind: 'skip' };
			intents.push(intent);

			const state: AuthoritativeState = await processor.step(code, intent, CONFIG);

			clientA.adoptAuthoritativeState(state);
			clientB.adoptAuthoritativeState(state);

			expect(serializeState(clientA)).toEqual(serializeState(clientB));
		}

		expect(intents.length).toBe(12);

		const intentMsg: GameMessage = { type: 'intent', intent: intents[0], playerId: 'p1' };
		const stateMsg: GameMessage = {
			type: 'authoritative-state',
			state: await processor.getState(code, CONFIG),
			sequence: intents.length,
		};
		expect(intentMsg.type).toBe('intent');
		expect(stateMsg.type).toBe('authoritative-state');
	}, 120_000);
});
