import { beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.mock('phaser', () =>
	(
		jest.requireActual('../../../test/phaser-mock') as typeof import('../../../test/phaser-mock')
	).createPhaserMock(),
);

jest.mock('../../damage', () => ({
	Damage: class {
		attacker: unknown;
		damages: Record<string, number>;
		constructor(attacker: unknown, damages: Record<string, number>) {
			this.attacker = attacker;
			this.damages = damages;
		}
	},
}));

jest.mock('../../utility/hex', () => ({ Hex: class HexMock {}, Direction: { Right: 1, Left: 4 } }));
jest.mock('../../effect', () => ({ Effect: class EffectMock {} }));
jest.mock('../../game', () => ({ __esModule: true, default: class GameMock {} }));

import loadStomperAbilities from '../../abilities/Stomper';

describe('Stomper Earth Shaker facing', () => {
	let game: any;
	let ability: any;
	let setDir: ReturnType<typeof jest.fn>;

	beforeEach(() => {
		setDir = jest.fn();
		const sprite = {
			x: 0,
			y: 0,
			originX: 0.5,
			originY: 1,
			scaleX: 1,
			scaleY: 1,
			width: 100,
			height: 100,
			texture: { width: 100, height: 100 },
		};

		game = {
			abilities: {},
			Phaser: {
				Easing: { Linear: { None: 'linear' } },
				camera: { shake: jest.fn(), SHAKE_VERTICAL: 'vertical' },
				add: {
					graphics: jest.fn(() => ({ destroy: jest.fn() })),
					tween: jest.fn(() => ({
						onComplete: { add: (fn: () => void) => fn() },
						to: () => ({}),
						start: () => ({}),
					})),
				},
			},
			grid: { creatureGroup: { create: jest.fn() } },
		};
		(game as any).UI = { updateFatigue: jest.fn() };
		(game as any).gameEngine = {
			cameras: { main: { shake: jest.fn() } },
			add: {
				socket: jest.fn(() => ({ ...sprite })),
				image: jest.fn(() => ({ destroy: jest.fn() })),
				text: jest.fn(() => ({ destroy: jest.fn() })),
				group: jest.fn(() => ({
					children: [],
					add: jest.fn(),
					addAt: jest.fn(),
					remove: jest.fn(),
				})),
				tileSprite: jest.fn(() => ({})),
			},
		};
		loadStomperAbilities(game);

		const base = game.abilities[28][3];
		const creature = {
			id: 28,
			level: 3,
			size: 2,
			player: { flipped: false },
			grp: { x: 1000, y: 500 },
			hexagons: [
				{ x: 5, y: 3, displayPos: { x: 1000, y: 500 } },
				{ x: 4, y: 3, displayPos: { x: 910, y: 500 } },
			],
			dead: false,
			snake: sprite,
			creatureSprite: { setDir },
			// Mirror creature.ts:1332 — facePlayerDefault calls setDir with the
			// player's default facing. This is the reset ability.end() →
			// queryMove() fires, and it must not be the last setDir call.
			facePlayerDefault: jest.fn(() => setDir(1)),
			isUpgraded: jest.fn(() => false),
			getTargets: jest.fn(() => []),
		};
		// `ability.end()` → `queryMove()` → `facePlayerDefault()` (creature.ts:1088)
		// resets the unit to its player's default facing. Mirror that here so
		// the test actually exercises the reset that was un-flipping the unit.
		const end = jest.fn(() => creature.facePlayerDefault());
		ability = { ...base, creature, game, end, getTargets: jest.fn(() => []) };
	});

	// setDir must win the race against ability.end()'s facePlayerDefault()
	// reset: the flip must be issued *after* end()'s default-facing reset,
	// so the cardboard is drawn turned around. The crack chain's own
	// turnBack (which restores the default facing once the trail fades) is
	// deferred to the chain's onEnd, not part of activate().
	test('backward cast flips the unit after end() resets facing', () => {
		ability.activate([
			{ x: 5, y: 3, displayPos: { x: 1000, y: 500 } },
			{ x: 4, y: 3, displayPos: { x: 910, y: 500 } },
			{ x: 3, y: 3, displayPos: { x: 820, y: 500 } },
			{ x: 2, y: 3, displayPos: { x: 730, y: 500 } },
		]);
		const calls = setDir.mock.calls.map((c) => c[0]);
		// end()'s reset (the default-facing 1) must be followed by the flip.
		const resetIndex = calls.indexOf(1);
		expect(resetIndex).toBeGreaterThan(-1);
		const afterReset = calls.slice(resetIndex + 1);
		expect(afterReset).toContain(-1);
	});

	test('forward cast leaves the unit facing forward after end() resets facing', () => {
		ability.activate([
			{ x: 5, y: 3, displayPos: { x: 1000, y: 500 } },
			{ x: 6, y: 3, displayPos: { x: 1090, y: 500 } },
			{ x: 7, y: 3, displayPos: { x: 1180, y: 500 } },
			{ x: 8, y: 3, displayPos: { x: 1270, y: 500 } },
		]);
		const calls = setDir.mock.calls.map((c) => c[0]);
		const resetIndex = calls.indexOf(1);
		expect(resetIndex).toBeGreaterThan(-1);
		const afterReset = calls.slice(resetIndex + 1);
		expect(afterReset).toContain(1);
	});
});
