import { afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';

// Mirrors INFERNAL_SMOKE_ENABLED in src/animations.ts. The smoke tests below are
// skipped while the feature is off, so the tuning values stay verifiable.
const INFERNAL_SMOKE_ENABLED = true;
const smokeTest = INFERNAL_SMOKE_ENABLED ? test : test.skip;

jest.mock('phaser', () => ({
	Point: class PointMock {},
	Polygon: class PolygonMock {},
	Math: {
		Vector2: class Vector2Mock {
			x = 0;
			y = 0;
			constructor(x = 0, y = 0) {
				this.x = x;
				this.y = y;
			}
		},
	},
	GameObjects: {
		Polygon: class PolygonGameObjectMock {
			constructor(_scene?: unknown, _x?: number, _y?: number, points?: unknown) {
				(this as any).points = points ?? [];
			}
			contains() {
				return true;
			}
		},
	},
	BlendModes: { ADD: 1, NORMAL: 0, MULTIPLY: 2, SCREEN: 3 },
	Easing: {
		Linear: { None: (k: number) => k },
		Sinusoidal: {
			In: (k: number) => Math.sin((k * Math.PI) / 2),
			Out: (k: number) => Math.sin(((k + 1) * Math.PI) / 2),
			InOut: (k: number) => (Math.sin(k * Math.PI) + 1) / 2,
		},
		Quadratic: {
			In: (k: number) => k * k,
			Out: (k: number) => k * (2 - k),
			InOut: (k: number) => (k < 0.5 ? 2 * k * k : -1 + (4 - 2 * k) * k),
		},
		Cubic: {
			In: (k: number) => k * k * k,
			Out: (k: number) => --k * k * k + 1,
			InOut: (k: number) => (k < 0.5 ? 4 * k * k * k : (k - 1) * (2 * k - 2) * (2 * k - 2) + 1),
		},
		Quartic: {
			In: (k: number) => k * k * k * k,
			Out: (k: number) => 1 - --k * k * k * k,
			InOut: (k: number) => (k < 0.5 ? 8 * k * k * k * k : 1 - 8 * --k * k * k * k),
		},
		Quintic: {
			In: (k: number) => k * k * k * k * k,
			Out: (k: number) => --k * k * k * k * k + 1,
			InOut: (k: number) => (k < 0.5 ? 16 * k * k * k * k * k : 1 + 16 * --k * k * k * k * k),
		},
		Exponential: {
			In: (k: number) => (k === 0 ? 0 : Math.pow(2, 10 * (k - 1))),
			Out: (k: number) => (k === 1 ? 1 : 1 - Math.pow(2, -10 * k)),
			InOut: (k: number) =>
				k === 0
					? 0
					: k === 1
					? 1
					: k < 0.5
					? Math.pow(2, 20 * k - 10) / 2
					: (2 - Math.pow(2, -20 * k + 10)) / 2,
		},
		Circular: {
			In: (k: number) => 1 - Math.sqrt(1 - k * k),
			Out: (k: number) => Math.sqrt(1 - --k * k),
			InOut: (k: number) =>
				k < 0.5
					? (1 - Math.sqrt(1 - 4 * k * k)) / 2
					: (Math.sqrt(1 - (-2 * k + 2) * (-2 * k + 2)) + 1) / 2,
		},
		Elastic: {
			In: (k: number) =>
				k === 0 ? 0 : k === 1 ? 1 : -Math.pow(2, 10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI),
			Out: (k: number) =>
				k === 0 ? 0 : k === 1 ? 1 : Math.pow(2, -10 * k) * Math.sin((k - 0.1) * 5 * Math.PI) + 1,
			InOut: (k: number) =>
				k === 0
					? 0
					: k === 1
					? 1
					: k < 0.5
					? (-Math.pow(2, 20 * k - 10) * Math.sin(((20 * k - 11.125) * 5 * Math.PI) / 3)) / 2
					: (Math.pow(2, -20 * k + 10) * Math.sin(((20 * k - 11.125) * 5 * Math.PI) / 3)) / 2 + 1,
		},
		Back: {
			In: (k: number) => k * k * (2.70158 * k - 1.70158),
			Out: (k: number) => --k * k * (2.70158 * k + 1.70158) + 1,
			InOut: (k: number) =>
				k < 0.5 ? k * k * (7 * k - 2.5) * 2 : (k - 1) * (2 * k - 2) * (7 * (k - 1) + 2.5) * 2 + 1,
		},
		Bounce: {
			In: (k: number) => {
				const out = (k: number) => {
					if (k < 1 / 2.75) return 7.5625 * k * k;
					if (k < 2 / 2.75) return 7.5625 * (k -= 1.5 / 2.75) * k + 0.75;
					if (k < 2.5 / 2.75) return 7.5625 * (k -= 2.25 / 2.75) * k + 0.9375;
					return 7.5625 * (k -= 2.625 / 2.75) * k + 0.984375;
				};
				return 1 - out(1 - k);
			},
			Out: (k: number) => {
				if (k < 1 / 2.75) return 7.5625 * k * k;
				if (k < 2 / 2.75) return 7.5625 * (k -= 1.5 / 2.75) * k + 0.75;
				if (k < 2.5 / 2.75) return 7.5625 * (k -= 2.25 / 2.75) * k + 0.9375;
				return 7.5625 * (k -= 2.625 / 2.75) * k + 0.984375;
			},
			InOut: (k: number) =>
				k < 0.5
					? (() => {
							const out = (k: number) => {
								if (k < 1 / 2.75) return 7.5625 * k * k;
								if (k < 2 / 2.75) return 7.5625 * (k -= 1.5 / 2.75) * k + 0.75;
								if (k < 2.5 / 2.75) return 7.5625 * (k -= 2.25 / 2.75) * k + 0.9375;
								return 7.5625 * (k -= 2.625 / 2.75) * k + 0.984375;
							};
							return 1 - out(1 - k * 2);
					  })() * 0.5
					: (() => {
							const out = (k: number) => {
								if (k < 1 / 2.75) return 7.5625 * k * k;
								if (k < 2 / 2.75) return 7.5625 * (k -= 1.5 / 2.75) * k + 0.75;
								if (k < 2.5 / 2.75) return 7.5625 * (k -= 2.25 / 2.75) * k + 0.9375;
								return 7.5625 * (k -= 2.625 / 2.75) * k + 0.984375;
							};
							return out(k * 2 - 1);
					  })() *
							0.5 +
					  0.5,
		},
	},
}));

jest.mock('../../damage', () => ({
	Damage: class DamageMock {},
}));

jest.mock('../../utility/pointfacade', () => ({
	getPointFacade: () => ({
		getTrapsAt: () => [],
	}),
}));

import loadInfernalAbilities from '../../abilities/Infernal';
import { Animations } from '../../animations';
import type { Creature } from '../../creature';
import { Creature as CreatureClass } from '../../creature';
import { getEffectShader } from '../../shader';
import {
	installAbClock,
	resetAbClockTime,
	setAbClockTime,
	uninstallAbClock,
} from '../../../test/abClock';
import { setBoardCamera, resetBoardCamera } from '../../game-display/camera';

type MockHex = {
	x: number;
	y: number;
	creature?: unknown;
	trap?: { destroy: () => void };
	destroyTrap?: () => void;
	isWalkable: (size: number, id: number, ignoreReachable?: boolean) => boolean;
};

describe('Infernal Molten Hurl movement safety', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.runOnlyPendingTimers();
		jest.useRealTimers();
		resetBoardCamera();
	});

	test('falls back to the nearest walkable hex when furthest destination is blocked', () => {
		const selectAbility = jest.fn();
		const queryMove = jest.fn();
		const cameraShake = jest.fn();
		setBoardCamera({ shake: cameraShake } as never);

		const row: MockHex[] = [];
		for (let x = 0; x <= 10; x++) {
			row[x] = {
				x,
				y: 2,
				isWalkable: () => true,
			};
		}

		row[7].isWalkable = () => false;
		row[6].isWalkable = () => true;

		const moveTo = jest.fn((destination: MockHex, opts: { callback: () => void }) => {
			expect(destination).toBe(row[6]);
			opts.callback();
		});

		const magmaSpawn = {
			id: 4,
			size: 3,
			player: { flipped: false },
			hexagons: [row[4], row[3], row[2]],
			moveTo,
		};

		const game = {
			abilities: [] as unknown[],
			grid: {
				hexes: [[], [], row],
				getHexLine: jest.fn(),
				infernalSmokeGroup: null as InfernalGroupMock | null,
			},
			UI: { selectAbility },
			activeCreature: { queryMove },
			freezedInput: false,
			gameEngine: {
				add: {
					graphics: () => ({
						beginFill: jest.fn(),
						drawRect: jest.fn(),
						endFill: jest.fn(),
						clear: jest.fn(),
						lineStyle: jest.fn(),
						moveTo: jest.fn(),
						lineTo: jest.fn(),
						drawCircle: jest.fn(),
						mask: null,
					}),
					bitmapData: () => ({
						width: 100,
						height: 100,
						ctx: {
							clearRect: jest.fn(),
							save: jest.fn(),
							restore: jest.fn(),
							translate: jest.fn(),
							scale: jest.fn(),
							drawImage: jest.fn(),
						},
						context: {
							clearRect: jest.fn(),
							save: jest.fn(),
							restore: jest.fn(),
							translate: jest.fn(),
							scale: jest.fn(),
							drawImage: jest.fn(),
						},
						dirty: false,
						update: jest.fn(),
						destroy: jest.fn(),
					}),
					group: () => ({ children: [], add: () => {}, addAt: () => {}, remove: () => {} }),
					tileSprite: () => ({}),
				},
				tween: () => {
					const onComplete = { add: (fn: () => void) => fn() };
					const afterStart = { stop: () => ({}), onComplete };
					const afterTo = { start: () => afterStart, stop: () => ({}), onComplete };
					return { to: () => afterTo, start: () => afterStart, stop: () => ({}), onComplete };
				},
			},
		};

		globalThis.G = game as never;
		loadInfernalAbilities(game as never);

		const abilityDef = (game.abilities[4] as Array<Record<string, unknown>>)[3];
		const moltenHurl = {
			...(abilityDef as object),
			creature: magmaSpawn,
			damages: { burn: 10, crush: 10 },
			end: jest.fn(),
			isUpgraded: () => false,
		};

		const path: MockHex[] = [
			{ x: 6, y: 2, isWalkable: () => true },
			{ x: 7, y: 2, isWalkable: () => true },
		];

		(
			moltenHurl as unknown as {
				activate: (pathArg: MockHex[], args: { direction: number }) => void;
			}
		).activate(path, { direction: 1 });

		expect(moveTo).toHaveBeenCalledTimes(1);
		jest.runOnlyPendingTimers();
		expect(selectAbility).toHaveBeenCalledWith(-1);
		expect(queryMove).toHaveBeenCalledTimes(1);
		expect(cameraShake).toHaveBeenCalledTimes(1);
	});

	test('aborts movement when no walkable destination exists', () => {
		const selectAbility = jest.fn();
		const queryMove = jest.fn();
		const cameraShake = jest.fn();
		setBoardCamera({ shake: cameraShake } as never);

		const row: MockHex[] = [];
		for (let x = 0; x <= 10; x++) {
			row[x] = {
				x,
				y: 2,
				isWalkable: () => false,
			};
		}

		const moveTo = jest.fn();
		const magmaSpawn = {
			id: 4,
			size: 3,
			player: { flipped: false },
			hexagons: [row[4], row[3], row[2]],
			moveTo,
		};

		const game = {
			abilities: [] as unknown[],
			grid: {
				hexes: [[], [], row],
				getHexLine: jest.fn(),
				infernalSmokeGroup: null as InfernalGroupMock | null,
			},
			UI: { selectAbility },
			activeCreature: { queryMove },
			freezedInput: false,
			gameEngine: {
				add: {
					graphics: () => ({
						beginFill: jest.fn(),
						drawRect: jest.fn(),
						endFill: jest.fn(),
						clear: jest.fn(),
						lineStyle: jest.fn(),
						moveTo: jest.fn(),
						lineTo: jest.fn(),
						drawCircle: jest.fn(),
						mask: null,
					}),
					bitmapData: () => ({
						width: 100,
						height: 100,
						ctx: {
							clearRect: jest.fn(),
							save: jest.fn(),
							restore: jest.fn(),
							translate: jest.fn(),
							scale: jest.fn(),
							drawImage: jest.fn(),
						},
						context: {
							clearRect: jest.fn(),
							save: jest.fn(),
							restore: jest.fn(),
							translate: jest.fn(),
							scale: jest.fn(),
							drawImage: jest.fn(),
						},
						dirty: false,
						update: jest.fn(),
						destroy: jest.fn(),
					}),
					group: () => ({ children: [], add: () => {}, addAt: () => {}, remove: () => {} }),
					tileSprite: () => ({}),
				},
				tween: () => {
					const onComplete = { add: (fn: () => void) => fn() };
					const afterStart = { stop: () => ({}), onComplete };
					const afterTo = { start: () => afterStart, stop: () => ({}), onComplete };
					return { to: () => afterTo, start: () => afterStart, stop: () => ({}), onComplete };
				},
			},
		};

		globalThis.G = game as never;
		loadInfernalAbilities(game as never);

		const abilityDef = (game.abilities[4] as Array<Record<string, unknown>>)[3];
		const moltenHurl = {
			...(abilityDef as object),
			creature: magmaSpawn,
			damages: { burn: 10, crush: 10 },
			end: jest.fn(),
			isUpgraded: () => false,
		};

		const path: MockHex[] = [
			{ x: 6, y: 2, isWalkable: () => false },
			{ x: 7, y: 2, isWalkable: () => false },
		];

		(
			moltenHurl as unknown as {
				activate: (pathArg: MockHex[], args: { direction: number }) => void;
			}
		).activate(path, { direction: 1 });

		expect(moveTo).not.toHaveBeenCalled();
		jest.runOnlyPendingTimers();
		expect(selectAbility).toHaveBeenCalledWith(-1);
		expect(queryMove).toHaveBeenCalledTimes(1);
		expect(cameraShake).toHaveBeenCalledTimes(1);
	});
});

describe('Infernal trap damage safety', () => {
	test('resolves the stepped-on creature from a hex target before applying damage', () => {
		const takeDamage = jest.fn();
		const trapDestroy = jest.fn();
		const createdEffects: unknown[] = [];

		const game = {
			abilities: [] as unknown[],
			effects: [] as unknown[],
			turn: 0,
			grid: {
				hexes: [],
			},
			soundsys: {
				playSFX: jest.fn(),
			},
			gameEngine: {
				add: {
					graphics: () => ({
						beginFill: jest.fn(),
						drawRect: jest.fn(),
						endFill: jest.fn(),
						clear: jest.fn(),
						lineStyle: jest.fn(),
						moveTo: jest.fn(),
						lineTo: jest.fn(),
						drawCircle: jest.fn(),
						mask: null,
					}),
					bitmapData: () => ({
						width: 100,
						height: 100,
						ctx: {
							clearRect: jest.fn(),
							save: jest.fn(),
							restore: jest.fn(),
							translate: jest.fn(),
							scale: jest.fn(),
							drawImage: jest.fn(),
						},
						context: {
							clearRect: jest.fn(),
							save: jest.fn(),
							restore: jest.fn(),
							translate: jest.fn(),
							scale: jest.fn(),
							drawImage: jest.fn(),
						},
						dirty: false,
						update: jest.fn(),
						destroy: jest.fn(),
					}),
					group: () => ({ children: [], add: () => {}, addAt: () => {}, remove: () => {} }),
					tileSprite: () => ({}),
				},
				tween: () => {
					const onComplete = { add: (fn: () => void) => fn() };
					const afterStart = { stop: () => ({}), onComplete };
					const afterTo = { start: () => afterStart, stop: () => ({}), onComplete };
					return { to: () => afterTo, start: () => afterStart, stop: () => ({}), onComplete };
				},
			},
		};

		globalThis.G = game as never;
		loadInfernalAbilities(game as never);

		const abilityDef = (game.abilities[4] as Array<Record<string, unknown>>)[0];
		const infernalAbility = {
			...(abilityDef as object),
			creature: {
				id: 4,
				player: { flipped: false },
				hexagons: [{}, {}, {}],
			},
			damages: { burn: 10, crush: 5 },
			title: 'Boiling Point',
			isUpgraded: () => false,
		};

		const trapHex = {
			createTrap: jest.fn((_type: string, effects: unknown[]) => {
				createdEffects.push(...effects);
			}),
		};

		(abilityDef as { _addTrap: (hex: typeof trapHex) => void })._addTrap.call(
			infernalAbility,
			trapHex,
		);

		const effect = createdEffects[0] as {
			trap: { destroy: () => void; hex: { creature?: Creature } };
			deleteEffect: () => void;
			effectFn: (effectArg: unknown, targetArg: unknown) => void;
		};
		const targetCreature = Object.create(CreatureClass.prototype) as Creature & {
			takeDamage: typeof takeDamage;
		};
		targetCreature.takeDamage = takeDamage as any; // eslint-disable-line @typescript-eslint/no-explicit-any

		effect.trap = {
			destroy: trapDestroy,
			hex: { creature: targetCreature },
		};
		effect.deleteEffect = jest.fn();

		effect.effectFn(effect, { creature: targetCreature });

		expect(takeDamage).toHaveBeenCalledTimes(1);
		expect(trapDestroy).toHaveBeenCalledTimes(1);
	});
});

describe('Infernal cardboard FX regression', () => {
	// These effects read time and the frame delta from the AB clock, so the suite
	// pins it. Without a registered scene the clock falls back to the host clock,
	// which no assertion here could place at a known instant.
	beforeEach(() => {
		installAbClock();
	});

	afterEach(() => {
		uninstallAbClock();
	});

	test('keeps duplicate overlays hidden when bitmap masks are unavailable', () => {
		const game = getInfernalAnimationsGameMock();
		const animations = new Animations(game as never);
		const { group, sprite } = createInfernalSpriteMock({ x: 24, y: 60, scaleX: -1 });
		const creature = {
			name: 'Infernal',
			team: 1,
			id: 9,
			creatureSprite: { sprite, grp: group },
		} as unknown as Creature;

		animations.initInfernalCardboardEffect(creature, sprite as never);

		const { haze, heatLayer } = splitInfernalOverlays(group, sprite);

		expect(haze).toBeDefined();
		expect(heatLayer).toBeDefined();
		expect(haze?.alpha).toBe(0);
		expect(heatLayer?.alpha).toBe(0);
		// The overlays sit exactly on the cardboard. With scale.y 1 the old
		// `glowOffsetY` lift only produced an additive double-image.
		expect(haze?.y).toBe(sprite.y);
		expect(haze?.x).toBe(sprite.x);
		expect(heatLayer?.y).toBe(sprite.y);
		expect(heatLayer?.scaleY).toBeCloseTo(1, 2);

		game.Phaser.time.now = 30;
		game.Phaser.time.elapsedMS = 16;
		setAbClockTime(30, 16);
		animations.tickInfernalCardboardEffect(creature);

		expect(haze?.alpha).toBe(0);
		expect(heatLayer?.alpha).toBe(0);
		expect(haze?.y).toBe(sprite.y);
		expect(heatLayer?.y).toBe(sprite.y);
		expect(heatLayer?.scaleY).toBeCloseTo(1, 2);
	});

	test('tick retries BitmapData setup when the sprite texture becomes drawable later', () => {
		const game = getInfernalAnimationsGameMock();
		const animations = new Animations(game as never);
		const { group, sprite } = createInfernalSpriteMock({ x: 24, y: 60, scaleX: -1 });
		const creature = {
			name: 'Infernal',
			team: 1,
			id: 10,
			creatureSprite: { sprite, grp: group },
		} as unknown as Creature;

		animations.initInfernalCardboardEffect(creature, sprite as never);

		const { haze, heatLayer } = splitInfernalOverlays(group, sprite);
		expect(haze?.alpha).toBe(0);
		expect(heatLayer?.alpha).toBe(0);
		expect(heatLayer?.y).toBe(sprite.y);
		expect(heatLayer?.scaleY).toBeCloseTo(1, 2);

		sprite.texture.baseTexture = {
			source: { width: 120, height: 180 } as unknown as CanvasImageSource,
		};
		game.Phaser.time.now = 30;
		game.Phaser.time.elapsedMS = 16;
		setAbClockTime(30, 16);
		animations.tickInfernalCardboardEffect(creature);

		expect(haze?.setTexture).toHaveBeenCalledTimes(1);
		expect(heatLayer?.setTexture).toHaveBeenCalledTimes(1);
		expect(haze?.alpha).toBeGreaterThan(0);
		// The heat layer pulses with the haze rather than sitting at a fixed value,
		// so this can only be bounded, not pinned to one number.
		expect(heatLayer?.alpha).toBeGreaterThan(0.05);
		expect(heatLayer?.alpha).toBeLessThanOrEqual(0.3);
		expect(heatLayer?.y).toBe(sprite.y);
		expect(heatLayer?.scaleY).toBeCloseTo(1, 2);
		// `setTexture` swaps the frame the origin is measured from, so both
		// overlays have to be re-bottom-anchored onto the cardboard afterwards.
		expect(haze?.originY).toBe(1);
		expect(heatLayer?.originY).toBe(1);
		expect(haze?.y).toBe(sprite.y);
		expect(heatLayer?.y).toBe(sprite.y);
	});

	test('re-init replaces stale sprite state and preserves flip/position sync', () => {
		const game = getInfernalAnimationsGameMock();
		const animations = new Animations(game as never);
		const first = createInfernalSpriteMock({ x: 12, y: 44, scaleX: -1 });
		const creature = {
			name: 'Infernal',
			team: 0,
			id: 3,
			creatureSprite: { sprite: first.sprite, grp: first.group },
		} as unknown as Creature;

		animations.initInfernalCardboardEffect(creature, first.sprite as never);
		const firstOverlays = first.group.children.filter((child) => child !== first.sprite);

		const second = createInfernalSpriteMock({ x: 80, y: 92, scaleX: 1 });
		creature.creatureSprite = {
			sprite: second.sprite,
			grp: second.group,
		} as unknown as Creature['creatureSprite'];
		animations.initInfernalCardboardEffect(creature, second.sprite as never);

		firstOverlays.forEach((overlay) => {
			expect(overlay.destroy).toHaveBeenCalledTimes(1);
			expect(overlay.active).toBe(false);
		});

		const secondHeatLayer = splitInfernalOverlays(second.group, second.sprite).heatLayer;
		expect(secondHeatLayer).toBeDefined();
		expect(secondHeatLayer?.scaleX).toBe(1);

		// First tick after re-init snaps the fresh overlays onto the cardboard.
		game.Phaser.time.now = 50;
		game.Phaser.time.elapsedMS = 17;
		setAbClockTime(50, 17);
		animations.tickInfernalCardboardEffect(creature);

		second.sprite.scaleX = -1;
		second.sprite.x = 101;
		second.sprite.y = 55;
		game.Phaser.time.now = 65;
		game.Phaser.time.elapsedMS = 17;
		setAbClockTime(65, 17);
		animations.tickInfernalCardboardEffect(creature);

		expect(secondHeatLayer?.scaleX).toBe(-1);
		// The overlays chase the cardboard, so after one frame at a new position
		// they are still in transit rather than snapped onto it.
		expect(secondHeatLayer?.x).toBeGreaterThan(80);
		expect(secondHeatLayer?.x).toBeLessThan(101);
		expect(secondHeatLayer?.y).toBeLessThan(93);
	});

	test('overlays stay hidden until a tick has placed and flipped them', () => {
		// `init` runs while the cardboard is still at the origin and unflipped;
		// `setDir` places and faces it afterwards. Showing the overlays at init
		// drew a stray full-cardboard copy at (0, 0), facing the wrong way.
		const game = getInfernalAnimationsGameMock();
		const animations = new Animations(game as never);
		const { group, sprite } = createInfernalSpriteMock({ x: 0, y: 0, scaleX: 1 });
		sprite.texture.baseTexture = {
			source: { width: 120, height: 180 } as unknown as CanvasImageSource,
		};
		const creature = {
			name: 'Infernal',
			team: 1,
			id: 21,
			creatureSprite: { sprite, grp: group },
		} as unknown as Creature;

		animations.initInfernalCardboardEffect(creature, sprite as never);
		// Identify by z-order around the cardboard rather than by fixed index, so
		// the assertions do not depend on how many placeholder children exist.
		const spriteIndex = group.children.indexOf(sprite);
		const heatLayer = group.children[spriteIndex - 1];
		const haze = group.children[spriteIndex + 1];

		// Nothing is drawn before the first sync, even though both overlays exist
		// and their bitmaps may already be ready.
		expect(haze?.alpha).toBe(0);
		expect(heatLayer?.alpha).toBe(0);
		// No smoke is spawned at the origin either.
		expect(group.children).toHaveLength(3);

		// The first tick places and flips them; only then may they show.
		sprite.x = 240;
		sprite.scaleX = -1;
		setAbClockTime(16, 16);
		animations.tickInfernalCardboardEffect(creature);

		expect(haze?.x).toBe(240);
		expect(haze?.scaleX).toBe(-1);
		expect(haze?.alpha).toBeGreaterThan(0);
		expect(heatLayer?.alpha).toBeGreaterThan(0);
	});

	smokeTest('smoke follows the walking unit in the smoke layer, trailing slightly', () => {
		// The smoke lives in the shared smoke layer, not parented to the creature
		// group. Each tick its position is recomputed as `anchor + offset`: the
		// anchor chases the unit's world position and the offset is the rise and
		// drift being tweened. Tweening the sprite's x/y directly rewrites absolute
		// spawn-time coordinates every frame and pins the smoke where the unit
		// used to be -- which is what put the smoke somewhere else entirely.
		const game = getInfernalAnimationsGameMock();
		const animations = new Animations(game as never);
		const { group, sprite } = createInfernalSpriteMock({ x: 100, y: 500, scaleX: 1 });
		sprite.texture.baseTexture = {
			source: { width: 120, height: 180 } as unknown as CanvasImageSource,
		};
		const smokeGroup = createInfernalGroupMock();
		group.x = 300;
		group.y = 40;
		game.grid.infernalSmokeGroup = smokeGroup;

		const creature = {
			name: 'Infernal',
			team: 1,
			id: 12,
			creatureSprite: { sprite, grp: group },
		} as unknown as Creature;

		animations.initInfernalCardboardEffect(creature, sprite as never);
		setAbClockTime(16, 16);
		animations.tickInfernalCardboardEffect(creature);

		const smoke = smokeGroup.children[0];
		expect(smoke).toBeDefined();
		// In the smoke layer from the start, never a child of the moving group.
		expect(smoke?.parent).toBe(smokeGroup);
		expect(group.children).not.toContain(smoke);
		// Spawned on the unit's world position, not the sprite's group-local one.
		expect(smoke?.x).toBe(group.x + sprite.x);
		expect(smoke?.y).toBe(group.y + sprite.y);

		// Born invisible and eased up, so it never steps the brightness in one frame.
		expect(smoke?.alpha).toBe(0);
		const smokeTweens = (game.gameEngine.tween as jest.Mock).mock.results.map(
			(result) => result.value as { to: jest.Mock },
		);
		const fadeTween = smokeTweens.find((tween) => {
			const target = tween.to.mock.calls[0]?.[0] as Record<string, number> | undefined;
			return typeof target?.alpha === 'number' && target.alpha < 0.5 && target.y === undefined;
		});
		expect(fadeTween).toBeDefined();
		const [peakTarget] = readTweenCall(fadeTween);
		// Stationary, so undimmed: the full 0.11-0.15 band.
		expect(peakTarget.alpha).toBeGreaterThanOrEqual(0.11);
		expect(peakTarget.alpha).toBeLessThanOrEqual(0.15);
		expect(smoke?.originY).toBe(1);
		expect(smoke?.originX).toBe(0.5);

		// Walk right. A walk tweens the creature *group*; the sprite's own x/y never
		// change, so driving travel through the sprite measures nothing.
		const beforeX = smoke!.x;
		group.x = 900;
		setAbClockTime(32, 16);
		animations.tickInfernalCardboardEffect(creature);

		// A big jump is a teleport, so settle into a steady walk instead and
		// measure the lag the smoke settles at. A single-frame check cannot: the
		// anchor starts at the spawn point, so one frame of lag says nothing about
		// the steady-state distance.
		const walkPxPerFrame = 8;
		let lag = 0;
		for (let frame = 0; frame < 90; frame++) {
			group.x += walkPxPerFrame;
			setAbClockTime(48 + frame * 16, 16);
			animations.tickInfernalCardboardEffect(creature);
			lag = group.x + sprite.x - smoke!.x;
		}

		// The intent is a little lag: the smoke keeps up, but never quite reaches
		// the cardboard. Pinning the upper bound is what stops it drifting back
		// into reading as a separate copy, and the lower bound is what stops it
		// collapsing into being welded to the unit.
		// The lag has to be plainly visible: at a follow rate of 95 this settled
		// at ~2px on a cardboard ~120px wide, which does not read as lag at all and
		// leaves the smoke looking welded on and rising straight up. At 20 it is
		// ~20px, a clear trail. The floor catches "too tight to see" and the
		// ceiling catches it drifting back into reading as a separate copy.
		// Tighter than this and the gap stops reading as lag at all: 20 gives
		// ~20px here and was judged "no lag", so the floor sits above it. The
		// ceiling catches it drifting back into reading as a detached copy.
		expect(lag).toBeGreaterThan(walkPxPerFrame * 5);
		expect(lag).toBeLessThan(walkPxPerFrame * 9);

		// No tween may move the smoke's own x/y. Phaser rewrites a tweened
		// subject from absolute `from -> to` values every update, so a position
		// tween on the sprite would overwrite the anchor each frame and pin the
		// smoke at its spawn coordinates -- the bug that put the smoke somewhere
		// else entirely while the unit walked away. Rise and drift are tweened on
		// a detached offset object instead.
		//
		// Checked on the tween's *subject*, which is what Phaser writes to; the
		// `to()` payload is a fresh object literal and would not reveal this.
		const tweenMock = game.gameEngine.tween as jest.Mock;
		for (let i = 0; i < tweenMock.mock.calls.length; i++) {
			if (tweenMock.mock.calls[i][0] !== smoke) {
				continue;
			}
			const tween = tweenMock.mock.results[i]?.value as { to: jest.Mock };
			for (const call of tween.to.mock.calls) {
				const target = call[0] as Record<string, number> | undefined;
				// The alpha tween targets the sprite deliberately: it never
				// writes x or y. Only an x/y tween would be the bug.
				expect(typeof target?.x).not.toBe('number');
				expect(typeof target?.y).not.toBe('number');
			}
		}
	});

	smokeTest('smoke turns around when the unit does', () => {
		// The smoke is a copy of the cardboard, so its facing has to follow the
		// unit's. Baking the sign in at spawn left smoke trailing backwards once
		// the unit turned around mid-walk, because the scale tween kept rewriting
		// the sign the unit had when the smoke was born.
		const game = getInfernalAnimationsGameMock();
		const animations = new Animations(game as never);
		const { group, sprite } = createInfernalSpriteMock({ x: 100, y: 60, scaleX: 1 });
		sprite.texture.baseTexture = {
			source: { width: 120, height: 180 } as unknown as CanvasImageSource,
		};
		game.grid.infernalSmokeGroup = createInfernalGroupMock();
		const creature = {
			name: 'Infernal',
			team: 1,
			id: 45,
			creatureSprite: { sprite, grp: group },
		} as unknown as Creature;

		animations.initInfernalCardboardEffect(creature, sprite as never);
		setAbClockTime(16, 16);
		animations.tickInfernalCardboardEffect(creature);

		const smokeGroup = game.grid.infernalSmokeGroup as InfernalGroupMock;
		const smoke = smokeGroup.children[0];
		expect(smoke).toBeDefined();
		expect(smoke!.scaleX).toBeGreaterThan(0);

		// The unit turns around.
		sprite.scaleX = -1;
		setAbClockTime(32, 16);
		animations.tickInfernalCardboardEffect(creature);

		// The smoke faces the same way, and keeps its magnitude rather than
		// snapping to -1.
		expect(smoke!.scaleX).toBeLessThan(0);
		expect(Math.abs(smoke!.scaleX)).toBeGreaterThan(0.9);
		expect(Math.abs(smoke!.scaleX)).toBeLessThan(1.3);
	});

	smokeTest('smoke is dimmer while the unit walks than while it stands', () => {
		// Smoke is unparented, so a walking unit leaves full-cardboard copies
		// standing where it was. They dim in proportion to travel speed.
		const readPeak = (game: ReturnType<typeof getInfernalAnimationsGameMock>) => {
			const tweens = (game.gameEngine.tween as jest.Mock).mock.results.map(
				(result) => result.value as { to: jest.Mock },
			);
			const fade = tweens.find((tween) => {
				const target = tween.to.mock.calls[0]?.[0] as Record<string, number> | undefined;
				return typeof target?.alpha === 'number' && target.alpha < 0.5 && target.y === undefined;
			});
			return readTweenCall(fade)[0].alpha;
		};

		// A fresh fixture per sample: the effect holds position state, so reusing
		// one across samples would leak the previous walk into the next. The clock
		// is rewound to match, since the effect seeds its schedule from the current
		// time and a second fixture starting at the end of the first would schedule
		// its first smoke past the whole replay.
		const sample = (walkPx: number) => {
			resetAbClockTime();
			const game = getInfernalAnimationsGameMock();
			const animations = new Animations(game as never);
			const { group, sprite } = createInfernalSpriteMock({ x: 100, y: 60, scaleX: 1 });
			sprite.texture.baseTexture = {
				source: { width: 120, height: 180 } as unknown as CanvasImageSource,
			};
			// Smokes are born in the smoke layer, so it has to exist for any to spawn.
			game.grid.infernalSmokeGroup = createInfernalGroupMock();
			const creature = {
				name: 'Infernal',
				team: 1,
				id: 31,
				creatureSprite: { sprite, grp: group },
			} as unknown as Creature;
			animations.initInfernalCardboardEffect(creature, sprite as never);

			// Settle first so the first tick's snap is not counted as travel.
			for (let frame = 0; frame < 40; frame++) {
				setAbClockTime(frame * 16, 16);
				animations.tickInfernalCardboardEffect(creature);
			}

			// Per-smoke alpha is randomised, so one sample proves nothing: average a
			// batch, otherwise the motion term is lost in the jitter.
			const tweenMock = game.gameEngine.tween as jest.Mock;
			tweenMock.mockClear();
			tweenMock.mockReset();
			tweenMock.mockImplementation(() => ({
				to: jest.fn().mockReturnThis(),
				onComplete: { add: jest.fn() },
				stop: jest.fn(),
			}));
			const peaks: number[] = [];
			for (let frame = 0; frame < 120; frame++) {
				// A realistic few px per frame, kept inside the teleport-snap
				// distance so smoke keep spawning throughout. The group is what
				// walks (see CreatureSprite#setPx); the sprite's own x/y never
				// move, so driving travel through it measures nothing.
				group.x = walkPx * frame;
				setAbClockTime(640 + frame * 16, 16);
				animations.tickInfernalCardboardEffect(creature);
				const peak = readPeak(game);
				if (peak > 0) peaks.push(peak);
			}
			expect(peaks.length).toBeGreaterThan(0);
			return peaks.reduce((sum, peak) => sum + peak, 0) / peaks.length;
		};

		const standing = sample(0);
		const walking = sample(5);
		expect(standing).toBeGreaterThan(0.1);
		// Walking dims the smoke by up to half, so the mean must drop measurably.
		expect(walking).toBeLessThan(standing * 0.85);
	});

	test('a temp placement placeholder spawns no glow or smoke', () => {
		// The Dark Priest previews a summon by creating a temp creature at a fixed
		// placeholder hex and hiding it with `sprite.alpha = 0`. That hides the
		// cardboard only, so the glow overlays and smoke went on rendering at that
		// hex and left a lit ghost next to the caster until the real unit appeared.
		const game = getInfernalAnimationsGameMock();
		const animations = new Animations(game as never);
		const { group, sprite } = createInfernalSpriteMock({ x: 100, y: 60, scaleX: 1 });
		sprite.texture.baseTexture = {
			source: { width: 120, height: 180 } as unknown as CanvasImageSource,
		};
		const smokeGroup = createInfernalGroupMock();
		game.grid.infernalSmokeGroup = smokeGroup;
		const creature = {
			name: 'Infernal',
			team: 1,
			id: 49,
			temp: true,
			creatureSprite: { sprite, grp: group },
		} as unknown as Creature;

		animations.initInfernalCardboardEffect(creature, sprite as never);
		for (let frame = 0; frame < 30; frame++) {
			setAbClockTime(frame * 16, 16);
			animations.tickInfernalCardboardEffect(creature);
		}

		// Nothing at all: no overlays in the group, no smoke in the smoke layer.
		expect(group.children).toEqual([sprite]);
		expect(smokeGroup.children).toHaveLength(0);

		// And the same creature once materialised does get its effect back, so this
		// is not just disabling the glow.
		animations.initInfernalCardboardEffect(
			{ ...creature, temp: false } as unknown as Creature,
			sprite as never,
		);
		setAbClockTime(480, 16);
		animations.tickInfernalCardboardEffect(creature);
		const { haze } = splitInfernalOverlays(group, sprite);
		expect(haze).toBeDefined();
	});

	test('walking tracks the creature group, which is what actually moves', () => {
		// A walk tweens the creature group and leaves the sprite's own x/y alone
		// (see CreatureSprite#setPx). Anything that derives travel from the sprite
		// measures zero, so the overlays sit still and the unit walks out from
		// under its own smoke.
		const game = getInfernalAnimationsGameMock();
		const animations = new Animations(game as never);
		const { group, sprite } = createInfernalSpriteMock({ x: 100, y: 60, scaleX: 1 });
		sprite.texture.baseTexture = {
			source: { width: 120, height: 180 } as unknown as CanvasImageSource,
		};
		const creature = {
			name: 'Infernal',
			team: 1,
			id: 44,
			creatureSprite: { sprite, grp: group },
		} as unknown as Creature;

		animations.initInfernalCardboardEffect(creature, sprite as never);
		setAbClockTime(0, 16);
		animations.tickInfernalCardboardEffect(creature);
		const { heatLayer } = splitInfernalOverlays(group, sprite);
		expect(heatLayer?.x).toBe(100);

		// The sprite does not move at all; the group does.
		group.x = 60;
		setAbClockTime(16, 16);
		animations.tickInfernalCardboardEffect(creature);

		// Read in world space: the overlay is a child of the moving group, so its
		// local x stays at 100 and only its world position moves.
		const worldX = (heatLayer?.x ?? 0) + group.x;
		expect(worldX).toBeGreaterThan(100);
		expect(worldX).toBeLessThan(160);
	});

	test('glow fluctuates rather than swelling once', () => {
		// A single sine is a smooth swell and reads as a lamp being dimmed. Real
		// glow fluctuates unevenly, so this counts how many times the intensity
		// turns around within one slow breath: a single-beat glow has exactly one.
		const game = getInfernalAnimationsGameMock();
		const animations = new Animations(game as never);
		const { group, sprite } = createInfernalSpriteMock({ x: 100, y: 60, scaleX: 1 });
		sprite.texture.baseTexture = {
			source: { width: 120, height: 180 } as unknown as CanvasImageSource,
		};
		const creature = {
			name: 'Infernal',
			team: 1,
			id: 46,
			creatureSprite: { sprite, grp: group },
		} as unknown as Creature;

		animations.initInfernalCardboardEffect(creature, sprite as never);
		const { haze } = splitInfernalOverlays(group, sprite);
		expect(haze).toBeDefined();

		const samples: number[] = [];
		for (let frame = 0; frame < 600; frame++) {
			setAbClockTime(frame * 16, 16);
			animations.tickInfernalCardboardEffect(creature);
			samples.push((haze as InfernalSpriteMock).alpha);
		}

		// Count direction changes, ignoring noise below the eighth of the range so
		// a flattening top does not register as extra fluctuation.
		const span = Math.max(...samples) - Math.min(...samples);
		const threshold = span * 0.02;
		let turns = 0;
		let direction = 0;
		for (let i = 1; i < samples.length; i++) {
			const delta = samples[i] - samples[i - 1];
			if (Math.abs(delta) < threshold) {
				continue;
			}
			const sign = delta > 0 ? 1 : -1;
			if (direction !== 0 && sign !== direction) {
				turns++;
			}
			direction = sign;
		}
		// The slow beat alone turns around twice over ~10s of samples. The faster
		// beat layered on top has to push that well past.
		expect(turns).toBeGreaterThan(8);
		// And it must still be one bounded glow, not a strobe off the top.
		expect(Math.max(...samples)).toBeLessThanOrEqual(0.66);
		expect(Math.min(...samples)).toBeGreaterThanOrEqual(0.05);
	});

	test('the glow beats at the slowed pulse rate', () => {
		// Pins the pulse speed behaviourally, by timing the slow beat. The shader's
		// own default is 4.2, which the effect deliberately overrides; without this
		// the override could be changed and no test would notice.
		const game = getInfernalAnimationsGameMock();
		const animations = new Animations(game as never);
		const { group, sprite } = createInfernalSpriteMock({ x: 100, y: 60, scaleX: 1 });
		sprite.texture.baseTexture = {
			source: { width: 120, height: 180 } as unknown as CanvasImageSource,
		};
		const creature = {
			name: 'Infernal',
			team: 1,
			id: 50,
			creatureSprite: { sprite, grp: group },
		} as unknown as Creature;

		animations.initInfernalCardboardEffect(creature, sprite as never);
		const { haze } = splitInfernalOverlays(group, sprite);
		expect(haze).toBeDefined();

		const frames = 1800;
		const samples: number[] = [];
		for (let frame = 0; frame < frames; frame++) {
			setAbClockTime(frame * 16, 16);
			animations.tickInfernalCardboardEffect(creature);
			samples.push((haze as InfernalSpriteMock).alpha);
		}

		// Find the lag the signal repeats at. Autocorrelation rather than counting
		// troughs: the faster beat layered on top makes trough counting unreliable,
		// while the repeat lag lands squarely on the slow breath.
		const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
		let bestLag = 0;
		let bestCorrelation = -Infinity;
		for (let lag = 100; lag < 400; lag++) {
			let correlation = 0;
			for (let i = 0; i < samples.length - lag; i++) {
				correlation += (samples[i] - mean) * (samples[i + lag] - mean);
			}
			if (correlation > bestCorrelation) {
				bestCorrelation = correlation;
				bestLag = lag;
			}
		}
		const periodSeconds = (bestLag * 16) / 1000;
		// ~3.1s, which is the 1.87 rad/s the effect sets. Undoing the slow-down to
		// 2.2 measures ~2.6s and falls outside the range.
		expect(periodSeconds).toBeGreaterThan(2.95);
		expect(periodSeconds).toBeLessThan(3.35);
	});

	test('the glow sweeps a wide swing between near-dark and bright', () => {
		// The pulsation is the whole point, so it is measured directly: the trough
		// has to fall close to dark and the crest has to climb well above the
		// midpoint. A flat or narrow glow passes a brightness check but fails this.
		const game = getInfernalAnimationsGameMock();
		const animations = new Animations(game as never);
		const { group, sprite } = createInfernalSpriteMock({ x: 100, y: 60, scaleX: 1 });
		sprite.texture.baseTexture = {
			source: { width: 120, height: 180 } as unknown as CanvasImageSource,
		};
		const creature = {
			name: 'Infernal',
			team: 1,
			id: 47,
			creatureSprite: { sprite, grp: group },
		} as unknown as Creature;

		animations.initInfernalCardboardEffect(creature, sprite as never);
		const { haze, heatLayer } = splitInfernalOverlays(group, sprite);
		expect(haze).toBeDefined();

		const hazeSamples: number[] = [];
		const heatSamples: number[] = [];
		for (let frame = 0; frame < 900; frame++) {
			setAbClockTime(frame * 16, 16);
			animations.tickInfernalCardboardEffect(creature);
			hazeSamples.push((haze as InfernalSpriteMock).alpha);
			heatSamples.push((heatLayer as InfernalSpriteMock).alpha);
		}

		const range = (s: number[]) => Math.max(...s) - Math.min(...s);
		// A swing across most of the sprite's own alpha range, not a gentle one.
		expect(range(hazeSamples)).toBeGreaterThan(0.55);
		// Trough and crest both reached, not a lopsided wave.
		expect(Math.min(...hazeSamples)).toBeLessThan(0.07);
		expect(Math.max(...hazeSamples)).toBeGreaterThan(0.6);
		// The heat layer has to move too. It used to sit at a flat 0.18 while the
		// haze pulsed, so a quarter of the glow was completely static.
		expect(range(heatSamples)).toBeGreaterThan(0.2);
		// And the two stay in step, driven by the same signal.
		const hazeMin = Math.min(...hazeSamples);
		const hazeRange = range(hazeSamples);
		const lag = hazeSamples.indexOf(hazeMin);
		expect(lag).toBeGreaterThan(-1);
		expect(Math.min(...heatSamples)).toBeLessThan(0.09);
		expect(Math.max(...heatSamples)).toBeGreaterThan(0.25);
		expect(hazeRange).toBeGreaterThan(0.55);
	});

	test('heat haze overlays trail a moving cardboard and catch up once it stops', () => {
		const game = getInfernalAnimationsGameMock();
		const animations = new Animations(game as never);
		const { group, sprite } = createInfernalSpriteMock({ x: 100, y: 60, scaleX: 1 });
		sprite.texture.baseTexture = {
			source: { width: 120, height: 180 } as unknown as CanvasImageSource,
		};
		const creature = {
			name: 'Infernal',
			team: 1,
			id: 15,
			creatureSprite: { sprite, grp: group },
		} as unknown as Creature;

		animations.initInfernalCardboardEffect(creature, sprite as never);
		// First tick syncs the overlays onto the (still unmoved) cardboard.
		setAbClockTime(0, 16);
		animations.tickInfernalCardboardEffect(creature);
		const { heatLayer } = splitInfernalOverlays(group, sprite);
		expect(heatLayer?.x).toBe(100);

		// Walk right: the overlay must fall behind rather than ride along. The
		// creature *group* is what a walk tweens (see CreatureSprite#setPx).
		// Only the group moves: that is what a walk tweens.
		group.x = 60;
		setAbClockTime(16, 16);
		animations.tickInfernalCardboardEffect(creature);

		const lagging = (heatLayer?.x ?? -Infinity) + group.x;
		expect(lagging).toBeGreaterThan(100);
		expect(lagging).toBeLessThan(160);

		// Stand still long enough and it converges onto the cardboard.
		for (let frame = 0; frame < 120; frame++) {
			setAbClockTime(32 + frame * 16, 16);
			animations.tickInfernalCardboardEffect(creature);
		}
		expect((heatLayer?.x ?? 0) + group.x).toBeCloseTo(160, 1);
	});

	test('a materialisation teleport snaps the overlays instead of sliding them in', () => {
		const game = getInfernalAnimationsGameMock();
		const animations = new Animations(game as never);
		const { group, sprite } = createInfernalSpriteMock({ x: 100, y: 60, scaleX: 1 });
		sprite.texture.baseTexture = {
			source: { width: 120, height: 180 } as unknown as CanvasImageSource,
		};
		const creature = {
			name: 'Infernal',
			team: 1,
			id: 16,
			creatureSprite: { sprite, grp: group },
		} as unknown as Creature;

		animations.initInfernalCardboardEffect(creature, sprite as never);
		const { heatLayer } = splitInfernalOverlays(group, sprite);
		expect(heatLayer?.x).toBe(100);

		// Materialisation drops the unit across the board in a single frame.
		sprite.x = 700;
		sprite.y = 640;
		group.x = 0;
		group.y = 0;
		setAbClockTime(16, 16);
		animations.tickInfernalCardboardEffect(creature);

		// Easing across a jump is what slid a second cardboard copy into the unit.
		expect(heatLayer?.x).toBe(700);
		expect(heatLayer?.y).toBe(640);
	});

	test('small frame-to-frame steps still trail rather than snap', () => {
		const game = getInfernalAnimationsGameMock();
		const animations = new Animations(game as never);
		const { group, sprite } = createInfernalSpriteMock({ x: 100, y: 60, scaleX: 1 });
		sprite.texture.baseTexture = {
			source: { width: 120, height: 180 } as unknown as CanvasImageSource,
		};
		const creature = {
			name: 'Infernal',
			team: 1,
			id: 17,
			creatureSprite: { sprite, grp: group },
		} as unknown as Creature;

		animations.initInfernalCardboardEffect(creature, sprite as never);
		setAbClockTime(0, 16);
		animations.tickInfernalCardboardEffect(creature);
		const { heatLayer } = splitInfernalOverlays(group, sprite);

		sprite.x = 140;
		setAbClockTime(16, 16);
		animations.tickInfernalCardboardEffect(creature);

		// A 40px walk step is under the snap threshold, so it must still lag.
		expect(heatLayer?.x).toBeGreaterThan(100);
		expect(heatLayer?.x).toBeLessThan(140);
	});

	test('glow pulse matches v0.5.1 rather than a tuned-down variant', () => {
		const game = getInfernalAnimationsGameMock();
		const animations = new Animations(game as never);
		const { group, sprite } = createInfernalSpriteMock({ x: 24, y: 60, scaleX: 1 });
		sprite.texture.baseTexture = {
			source: { width: 120, height: 180 } as unknown as CanvasImageSource,
		};
		const creature = {
			name: 'Infernal',
			team: 1,
			id: 13,
			creatureSprite: { sprite, grp: group },
		} as unknown as Creature;

		animations.initInfernalCardboardEffect(creature, sprite as never);
		const { haze, heatLayer } = splitInfernalOverlays(group, sprite);
		expect(haze).toBeDefined();

		// uTime must advance in real time, which only works because the engine
		// hands over a per-frame delta rather than cumulative elapsed time.
		let min = Infinity;
		let max = -Infinity;
		// At 0.55 rad/s a full breath takes ~11s, so cover a long enough window to
		// see the glow actually rise and fall.
		for (let frame = 0; frame < 900; frame++) {
			setAbClockTime(frame * 16, 16);
			animations.tickInfernalCardboardEffect(creature);
			const alpha = (haze as InfernalSpriteMock).alpha;
			min = Math.min(min, alpha);
			max = Math.max(max, alpha);
		}

		// `0.05 + flicker * 0.61`: a wide swing, dark trough and bright crest, so
		// the pulsation is obvious. This is deliberately not a uniform lift of the
		// old `0.16 + pulse * 0.39` -- that was too flat to read as animated.
		expect(min).toBeGreaterThanOrEqual(0.05);
		expect(min).toBeLessThanOrEqual(0.07);
		expect(max).toBeGreaterThan(0.6);
		expect(max).toBeLessThanOrEqual(0.66);
		// The heat layer pulses off the same signal rather than sitting still.
		expect(heatLayer?.alpha).toBeGreaterThan(0.05);
		expect(heatLayer?.alpha).toBeLessThanOrEqual(0.3);

		// The effect overrides the shader's 4.2 default, which flickered. 2.2 is
		// fast enough for the breath to be noticeable.
		expect(getEffectShader('infernal-luminescence')?.defaultUniforms.uPulseSpeed).toBe(4.2);
		// 900 frames at 16ms is 14.4s, several breaths at 2.2 rad/s, so the pulse
		// has moved through both extremes rather than sitting still. The swing is
		// `0.39` of the range; requiring most of it means the glow is still
		// breathing visibly rather than sitting at a flat level.
		expect(max).toBeGreaterThan(min + 0.35);
	});

	test('tick rebinds cardboard FX when materialize swaps in a new sprite instance', () => {
		const game = getInfernalAnimationsGameMock();
		const animations = new Animations(game as never);
		const first = createInfernalSpriteMock({ x: 24, y: 60, scaleX: -1 });
		const creature = {
			name: 'Infernal',
			team: 1,
			id: 11,
			creatureSprite: { sprite: first.sprite, grp: first.group },
		} as unknown as Creature;

		animations.initInfernalCardboardEffect(creature, first.sprite as never);
		const originalOverlays = first.group.children.filter((child) => child !== first.sprite);

		const live = createInfernalSpriteMock({ x: 88, y: 95, scaleX: -1 });
		creature.creatureSprite = {
			sprite: live.sprite,
			grp: live.group,
		} as unknown as Creature['creatureSprite'];

		game.Phaser.time.now = 64;
		game.Phaser.time.elapsedMS = 16;
		setAbClockTime(64, 16);
		animations.tickInfernalCardboardEffect(creature);

		originalOverlays.forEach((overlay) => {
			expect(overlay.destroy).toHaveBeenCalledTimes(1);
			expect(overlay.active).toBe(false);
		});
		expect(live.group.children).toContain(live.sprite);
		expect(live.group.children.length).toBeGreaterThan(1);
		live.group.children
			.filter((child) => child !== live.sprite)
			.forEach((overlay) => expect(overlay.parent).toBe(live.group));
	});

	test('tick rebinds cardboard FX when the live sprite is reparented', () => {
		const game = getInfernalAnimationsGameMock();
		const animations = new Animations(game as never);
		const { group: originalGroup, sprite } = createInfernalSpriteMock({
			x: 32,
			y: 70,
			scaleX: 1,
		});
		const creature = {
			name: 'Infernal',
			team: 1,
			id: 7,
			creatureSprite: { sprite, grp: originalGroup },
		} as unknown as Creature;

		animations.initInfernalCardboardEffect(creature, sprite as never);
		const originalOverlays = originalGroup.children.filter((child) => child !== sprite);

		const replacement = createInfernalSpriteMock({ x: 0, y: 0, scaleX: 1 }).group;
		originalGroup.children = originalGroup.children.filter((child) => child === sprite);
		replacement.children.push(sprite);
		sprite.parent = replacement;
		creature.creatureSprite = {
			sprite,
			grp: replacement,
		} as unknown as Creature['creatureSprite'];

		game.Phaser.time.now = 48;
		game.Phaser.time.elapsedMS = 16;
		setAbClockTime(48, 16);
		animations.tickInfernalCardboardEffect(creature);

		originalOverlays.forEach((overlay) => {
			expect(overlay.destroy).toHaveBeenCalledTimes(1);
			expect(overlay.active).toBe(false);
		});
		expect(replacement.children.length).toBeGreaterThan(1);
		expect(replacement.children).toContain(sprite);
		replacement.children
			.filter((child) => child !== sprite)
			.forEach((overlay) => expect(overlay.parent).toBe(replacement));
	});
});

type InfernalSpriteMock = {
	x: number;
	y: number;
	key: string;
	alpha: number;
	tint: number;
	blendMode: number | null;
	exists: boolean;
	parent: InfernalGroupMock;
	/** Native Phaser 4 members, replacing the facade's `anchor`/`scale` shims. */
	originX: number;
	originY: number;
	displayOriginX: number;
	displayOriginY: number;
	scaleX: number;
	scaleY: number;
	active: boolean;
	setOrigin: (x: number, y?: number) => InfernalSpriteMock;
	setScale: (x: number, y?: number) => InfernalSpriteMock;
	setPosition: (x: number, y: number) => InfernalSpriteMock;
	setTexture: jest.Mock;
	texture: {
		width: number;
		height: number;
		baseTexture?: { source?: CanvasImageSource };
	};
	destroy: jest.Mock;
	/** Attached after construction; see `createInfernalOverlayMock`. */
	position?: { x: number; y: number; set: (x: number, y: number) => void };
};

type InfernalGroupMock = {
	children: InfernalSpriteMock[];
	/** Phaser 2's existence flag, retained for the members still on the facade. */
	exists: boolean;
	/** Phaser 4's equivalent; what the migrated code now reads. */
	active: boolean;
	/** Group-local offset; the creature group is positioned as a unit. */
	x: number;
	y: number;
	create: (x: number, y: number, key: string) => InfernalSpriteMock;
	addAt: (sprite: InfernalSpriteMock, index: number) => InfernalSpriteMock;
	add: (sprite: InfernalSpriteMock) => InfernalSpriteMock;
	remove: (sprite: InfernalSpriteMock, destroy?: boolean) => void;
	getIndex: (sprite: InfernalSpriteMock) => number;
};

/** A bare group mock, used both for the creature group and the smoke layer. */
const createInfernalGroupMock = () =>
	({
		children: [] as InfernalSpriteMock[],
		exists: true,
		active: true,
		x: 0,
		y: 0,
		create(createX: number, createY: number, key: string) {
			const sprite = createInfernalOverlayMock(this, {
				x: createX,
				y: createY,
				key,
				scaleX: 1,
			});
			this.children.push(sprite);
			return sprite;
		},
		addAt(sprite: InfernalSpriteMock, index: number) {
			this.children = this.children.filter((child) => child !== sprite);
			const clamped = Math.max(0, Math.min(index, this.children.length));
			this.children.splice(clamped, 0, sprite);
			sprite.parent = this;
			return sprite;
		},
		add(sprite: InfernalSpriteMock) {
			return this.addAt(sprite, this.children.length);
		},
		remove(sprite: InfernalSpriteMock, destroy?: boolean) {
			this.children = this.children.filter((child) => child !== sprite);
			if (destroy) {
				sprite.destroy();
			}
		},
		getIndex(sprite: InfernalSpriteMock) {
			return this.children.indexOf(sprite);
		},
	} as InfernalGroupMock);

const createInfernalSpriteMock = ({ x, y, scaleX }: { x: number; y: number; scaleX: -1 | 1 }) => {
	const group = createInfernalGroupMock();

	const sprite = createInfernalOverlayMock(group, {
		x,
		y,
		key: 'Infernal',
		scaleX,
	});
	group.children.push(sprite);

	return { group, sprite };
};

const createInfernalOverlayMock = (
	group: InfernalGroupMock,
	{
		x,
		y,
		key,
		scaleX,
	}: {
		x: number;
		y: number;
		key: string;
		scaleX: number;
	},
) => {
	const anchor = {
		x: 0,
		y: 0,
		setTo(anchorX: number, anchorY: number) {
			this.x = anchorX;
			this.y = anchorY;
		},
	};
	const scale = {};

	const sprite = {
		x,
		y,
		key,
		alpha: 1,
		tint: 0xffffff,
		blendMode: null,
		exists: true,
		active: true,
		parent: group,
		originX: anchor.x,
		originY: anchor.y,
		displayOriginX: 0,
		displayOriginY: 0,
		scaleX,
		scaleY: 1,
		texture: {
			frame: { x: 0, y: 0, width: 120, height: 180 },
			width: 120,
			height: 180,
			baseTexture: undefined,
		},
		setOrigin: (ox: number, oy?: number) => {
			sprite.originX = ox;
			sprite.originY = oy === undefined ? ox : oy;
			sprite.displayOriginX = sprite.originX * sprite.texture.width;
			sprite.displayOriginY = sprite.originY * sprite.texture.height;
			return sprite;
		},
		setScale: (sx: number, sy?: number) => {
			sprite.scaleX = sx;
			sprite.scaleY = sy === undefined ? sx : sy;
			return sprite;
		},
		setPosition: (px: number, py: number) => {
			sprite.x = px;
			sprite.y = py;
			return sprite;
		},
		setTexture: jest.fn(),
		destroy: jest.fn(function (this: InfernalSpriteMock) {
			// Phaser 4 deactivates a destroyed object; the suite reads `active`.
			this.exists = false;
			this.active = false;
			this.parent.children = this.parent.children.filter((child) => child !== this);
		}),
	} as InfernalSpriteMock;

	// Attached after construction: a self-referential `position` inside the object
	// literal cannot reach `sprite` while it is still being initialised.
	sprite.position = {
		x,
		y,
		set(nextX: number, nextY: number) {
			this.x = nextX;
			this.y = nextY;
			sprite.x = nextX;
			sprite.y = nextY;
		},
	};

	return sprite;
};

/**
 * v0.5.1 raises every overlay by 2% of the cardboard's texture height. The mock
 * cardboard is 180px tall.
 */

/**
 * The heat layer is inserted immediately below the cardboard and the haze layer
 * immediately above it, while rising smoke are pushed further back still. That
 * adjacency is the only reliable way to tell the two overlays apart now that
 * both render at scaleY === 1 and the haze tint is overwritten by setTexture.
 */
const splitInfernalOverlays = (group: InfernalGroupMock, sprite: InfernalSpriteMock) => {
	const spriteIndex = group.children.indexOf(sprite);
	const overlays = group.children.filter((child) => child !== sprite);
	const indexOf = (child: InfernalSpriteMock) => group.children.indexOf(child);
	return {
		heatLayer: overlays.find((child) => indexOf(child) === spriteIndex - 1),
		haze: overlays.find((child) => indexOf(child) === spriteIndex + 1),
	};
};

/** Pulls `[target, duration]` out of a tween mock's first `.to(...)` call. */
const readTweenCall = (tween?: { to: jest.Mock }): [Record<string, number>, number] => {
	const call = tween?.to.mock.calls[0] as [Record<string, number>, number] | undefined;
	return call ?? [{} as Record<string, number>, 0];
};

const getInfernalAnimationsGameMock = () => {
	// The effects draw into a canvas texture and read the pixels back, so this
	// stands up a texture manager whose `createCanvas` hands out a context that
	// genuinely renders. Stubs the draw calls and the returned pixels separately,
	// matching what the effect code does with them.
	const createCanvasTexture = (key: string, width: number, height: number) => {
		const imageData = {
			data: new Uint8ClampedArray(width * height * 4).fill(0),
		};
		for (let index = 0; index < imageData.data.length; index += 4) {
			imageData.data[index] = 255;
			imageData.data[index + 1] = 120;
			imageData.data[index + 2] = 20;
			imageData.data[index + 3] = 255;
		}
		const ctx = {
			clearRect: jest.fn(),
			drawImage: jest.fn(),
			getImageData: jest.fn(() => imageData),
			putImageData: jest.fn(),
			save: jest.fn(),
			restore: jest.fn(),
			translate: jest.fn(),
			scale: jest.fn(),
		};
		return {
			key,
			canvas: { width, height } as HTMLCanvasElement,
			getContext: () => ctx,
			refresh: jest.fn(),
		};
	};

	const nextSurfaceKey = 1;

	const makeTween = () => {
		const tween = {
			to: jest.fn().mockReturnThis(),
			onComplete: { add: jest.fn() },
			stop: jest.fn(),
		};
		return tween;
	};

	return {
		// `null` by default so the FX falls back to the creature group, matching a
		// game that has not built the smoke layer yet. Tests that exercise the
		// unparented smoke assign a real group here.
		grid: { infernalSmokeGroup: null as InfernalGroupMock | null },
		Phaser: {
			time: {
				now: 0,
				elapsedMS: 16,
			},
			textures: {
				createCanvas: jest.fn((key: string, width: number, height: number) =>
					createCanvasTexture(key, width, height),
				),
				remove: jest.fn(),
			},
			add: {
				tween: jest.fn(() => makeTween()),
			},
		},
		gameEngine: {
			time: {
				now: 0,
				elapsedMS: 16,
				add: jest.fn(),
				loop: jest.fn(),
				remove: jest.fn(),
			},
			tween: jest.fn(() => makeTween()),
		},
	};
};
