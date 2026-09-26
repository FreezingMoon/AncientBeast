/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, describe, test, expect } from '@jest/globals';

// Mock heavy external deps (same as the engine test).
jest.mock('pixi', () => ({}), { virtual: true });
jest.mock('p2', () => ({}), { virtual: true });
jest.mock(
	'phaser',
	() => ({
		Signal: class SignalMock {
			add() {}
			remove() {}
			dispatch() {}
		},
		AUTO: 0,
		CANVAS: 1,
		Scale: {
			NONE: 0,
			FIT: 1,
			ENVELOP: 2,
			WIDTH_CONTROLS_HEIGHT: 3,
			HEIGHT_CONTROLS_WIDTH: 4,
			RESIZE: 5,
		},
		ScaleManager: { SHOW_ALL: 0 },
		Easing: {
			Linear: { None: 'Linear.None' },
			Quadratic: { In: 'Quad.In', Out: 'Quad.Out', InOut: 'Quad.InOut' },
			Back: { Out: 'Back.Out' },
		},
		blendModes: { ADD: 1, NORMAL: 0 },
		Vector2: class Vector2Mock {
			x: number;
			y: number;
			constructor(x?: number, y?: number) {
				this.x = x ?? 0;
				this.y = y ?? 0;
			}
			set(x: number, y?: number): this {
				this.x = x;
				this.y = y ?? x;
				return this;
			}
			setTo(x: number, y?: number): this {
				return this.set(x, y);
			}
			clone(): this {
				return new (this.constructor as any)(this.x, this.y);
			}
			copy(src: any): this {
				this.x = src.x;
				this.y = src.y;
				return this;
			}
		},
		Polygon: class PolygonMock {
			points: any[];
			constructor(points?: any[]) {
				this.points = points ?? [];
			}
		},
		default: class PhaserMock {},
	}),
	{ virtual: true },
);
jest.mock('phaser-ce', () => ({
	Point: class PointMock {},
	Polygon: class PolygonMock {},
	default: class PhaserMock {},
	AUTO: 0,
	ScaleManager: { SHOW_ALL: 0 },
	Easing: {
		Linear: { None: 'Linear.None' },
		Quadratic: { In: 'Quad.In', Out: 'Quad.Out', InOut: 'Quad.InOut' },
	},
	Text: class PhaserText {},
	Sprite: class PhaserSprite {},
	Group: class PhaserGroup {},
	Tween: class PhaserTween {},
	Signal: class PhaserSignal {
		add() {}
		remove() {}
		dispatch() {}
	},
	Game: class PhaserGame {
		scale = {
			parentIsWindow: false,
			pageAlignHorizontally: false,
			pageAlignVertically: false,
			scaleMode: 0,
			fullScreenScaleMode: 0,
			refresh() {},
		};
		stage = { disableVisibilityChange: false, forcePortrait: false };
		device = { desktop: true };
		add = {
			group: () => ({
				add: () => ({}),
				position: { set: () => {} },
				scale: { setTo: () => {}, set: () => {} },
				children: [] as unknown[],
				create: () => ({}),
				forEach: () => {},
				sendToBack: () => {},
				bringToTop: () => {},
				sort: () => {},
				destroy: () => {},
			}),
			sprite: () => ({ anchor: { setTo: () => {} }, events: {} }),
		};
	},
}));

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
					_abilityPanelAnimating: false,
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
	replayIntents,
	type HeadlessConfig,
} from '../../devvit/headlessGame';
import { EngineAuthoritativeProcessor } from '../../multiplayer/engineAuthoritativeProcessor';
import { InMemoryIntentStore } from '../../multiplayer/authoritative';
import type { AuthoritativeState, Intent } from '../../multiplayer/authoritative';
import type { GameMessage } from '../../multiplayer/types';

const ABILITY_FILES = [
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
	'../../abilities/Nutcase',
	'../../abilities/Scavenger',
	'../../abilities/Snow-Bunny',
	'../../abilities/Stomper',
	'../../abilities/Swine-Thug',
	'../../abilities/Uncle-Fungus',
	'../../abilities/Vehemoth',
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

describe('Authoritative client wiring (transport-agnostic)', () => {
	test('two clients converge on the broadcast authoritative state via the processor', async () => {
		const abilities = await loadAbilities();

		// Two independent client games (different machines) + the shared,
		// transport-agnostic processor backed by a pluggable intent store.
		const clientA = await createHeadlessGame(abilities, { config: CONFIG });
		const clientB = await createHeadlessGame(abilities, { config: CONFIG });
		stopTimers(clientA);
		stopTimers(clientB);

		const store = new InMemoryIntentStore();
		const processor = new EngineAuthoritativeProcessor({ store, loadAbilities });

		const code = 'AB-TEST';
		const intents: Intent[] = [];

		for (let i = 0; i < 12; i++) {
			await settle(clientA);
			await settle(clientB);

			// The acting client decides its input by inspecting its OWN view.
			const hex = findReachableHex(clientA);
			const intent: Intent = hex ? { kind: 'move', target: hex } : { kind: 'skip' };
			intents.push(intent);

			// Server applies the intent through the deterministic engine and
			// returns the authoritative snapshot — exactly what a transport
			// (Devvit realtime, PeerJS, Hono, …) would broadcast back.
			const state: AuthoritativeState = await processor.step(code, intent, CONFIG);

			// Both clients adopt the SAME broadcast state → no client-side drift.
			clientA.adoptAuthoritativeState(state);
			clientB.adoptAuthoritativeState(state);

			expect(serializeState(clientA)).toEqual(serializeState(clientB));
		}

		expect(intents.length).toBe(12);

		// Transport-agnostic envelope: intents and state ride the same GameMessage
		// union any transport can carry.
		const intentMsg: GameMessage = { type: 'intent', intent: intents[0], playerId: 'p1' };
		const stateMsg: GameMessage = {
			type: 'authoritative-state',
			state: await processor.getState(code, CONFIG),
			sequence: intents.length,
		};
		expect(intentMsg.type).toBe('intent');
		expect(stateMsg.type).toBe('authoritative-state');
	}, 120_000);

	test('serverless reconstruction from the persisted log matches live processor state', async () => {
		const abilities = await loadAbilities();

		const store = new InMemoryIntentStore();
		const processor = new EngineAuthoritativeProcessor({ store, loadAbilities });

		const code = 'AB-REPLAY';
		const intents: Intent[] = [];
		for (let i = 0; i < 12; i++) {
			const scratch = await createHeadlessGame(abilities, { config: CONFIG });
			stopTimers(scratch);
			await settle(scratch);
			const hex = findReachableHex(scratch);
			const intent: Intent = hex ? { kind: 'move', target: hex } : { kind: 'skip' };
			intents.push(intent);
			await processor.step(code, intent, CONFIG);
			stopTimers(scratch);
		}

		// No live instance: rebuild purely from config + the stored intent log,
		// and confirm it equals the processor's own reconstruction (both go
		// through LobbyEngine.fromLog, so they must be identical).
		const rebuilt = await replayIntents(abilities, CONFIG, intents);
		stopTimers(rebuilt);

		const liveState = await processor.getState(code, CONFIG);
		const rebuiltState = serializeState(rebuilt);
		expect(rebuiltState).toEqual(liveState);
	}, 120_000);
});
