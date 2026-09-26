/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, describe, test, expect } from '@jest/globals';

// Mock heavy external deps before importing the engine (same as simulate tests).
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
		Back: { Out: 'Back.Out' },
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

// The authoritative server does not render, so stub the DOM-coupled UI module
// (same role botgeria's makeUiStub plays, applied at module load so setup()'s
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
	applyIntent,
	settle,
	serializeState,
	replayIntents,
	type HeadlessConfig,
} from '../../devvit/headlessGame';
import type { Intent } from '../../devvit/authoritativeTypes';

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

describe('Authoritative server engine', () => {
	beforeAll(() => {
		// Mock setTimeout globally to make tests deterministic
		const timerMap = new Map<number, () => void>();
		let timerId = 0;
		globalThis.setTimeout = ((callback: (...args: unknown[]) => void, _delay?: number) => {
			const id = ++timerId;
			timerMap.set(id, callback as () => void);
			// Execute immediately for determinism
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

	test('same ordered intents converge on independent engine instances', async () => {
		const abilities = await loadAbilities();
		const g1 = await createHeadlessGame(abilities, { config: CONFIG });
		const g2 = await createHeadlessGame(abilities, { config: CONFIG });
		stopTimers(g1);
		stopTimers(g2);

		const intents: Intent[] = [];
		for (let i = 0; i < 12; i++) {
			await settle(g1);
			await settle(g2);

			const hex = findReachableHex(g1);
			const intent: Intent = hex ? { kind: 'move', target: hex } : { kind: 'skip' };
			intents.push(intent);

			applyIntent(g1, intent);
			applyIntent(g2, intent);
			await settle(g1);
			await settle(g2);

			// The authoritative invariant: applying the *same* input through the
			// *same* engine on two independent instances yields identical state.
			// If this ever fails, the engine has hidden nondeterminism and the
			// server-authoritative model cannot hold.
			expect(serializeState(g1)).toEqual(serializeState(g2));
		}

		expect(intents.length).toBe(12);
	}, 120_000);

	test('replaying the persisted intent log reconstructs authoritative state', async () => {
		const abilities = await loadAbilities();
		const g = await createHeadlessGame(abilities, { config: CONFIG });
		stopTimers(g);

		const intents: Intent[] = [];
		for (let i = 0; i < 12; i++) {
			await settle(g);
			const hex = findReachableHex(g);
			const intent: Intent = hex ? { kind: 'move', target: hex } : { kind: 'skip' };
			intents.push(intent);
			applyIntent(g, intent);
			await settle(g);
		}
		const directState = serializeState(g);
		stopTimers(g);

		// Serverless-safe reconstruction: no live instance, just config + log.
		const rebuilt = await replayIntents(abilities, CONFIG, intents);
		stopTimers(rebuilt);

		expect(serializeState(rebuilt)).toEqual(directState);
	}, 120_000);
});
