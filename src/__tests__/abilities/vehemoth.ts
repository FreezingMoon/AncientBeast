import { beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.mock('phaser-ce', () => ({
	Point: class PointMock {},
	Polygon: class PolygonMock {},
}));

jest.mock('../../damage', () => ({
	Damage: class DamageMock {
		attacker: unknown;
		damages: Record<string, number>;
		target: unknown;
		constructor(
			attacker: unknown,
			damages: Record<string, number>,
			_area: number,
			_effects: unknown[],
			_game: unknown,
		) {
			this.attacker = attacker;
			this.damages = damages;
		}
	},
}));

jest.mock('../../utility/hex', () => ({
	Hex: class HexMock {},
}));

jest.mock('../../effect', () => ({
	Effect: class EffectMock {},
}));

jest.mock('../../game', () => ({
	__esModule: true,
	default: class GameMock {},
}));

import loadVehemothAbilities from '../../abilities/Vehemoth';

describe('Vehemoth Falling Arrow damage fallback', () => {
	let game: {
		abilities: Record<number, unknown[]>;
		Phaser: {
			camera: {
				shake: ReturnType<typeof jest.fn>;
				SHAKE_VERTICAL: string;
			};
			add: {
				graphics: ReturnType<typeof jest.fn>;
				tween: ReturnType<typeof jest.fn>;
			};
			Easing: {
				Linear: {
					None: string;
				};
			};
		};
		grid: {
			creatureGroup: {
				create: ReturnType<typeof jest.fn>;
			};
		};
	};
	let ability: {
		activate: (target: { level: string; hexagons: { displayPos: { x: number; y: number } }[]; takeDamage: ReturnType<typeof jest.fn> }) => void;
		creature: {
			id: number;
			level: number;
			size: number;
			legacyProjectileEmissionPoint: { x: number; y: number };
			player: { flipped: boolean };
			creatureSprite: {
				grp: { x: number; y: number };
				sprite: {
					x: number;
					y: number;
					anchor: { x: number; y: number };
					scale: { x: number; y: number };
					texture: { width: number; height: number };
				};
				setDir: ReturnType<typeof jest.fn>;
			};
			facePlayerDefault: ReturnType<typeof jest.fn>;
		};
		end: ReturnType<typeof jest.fn>;
		isUpgraded: () => boolean;
		damages: { pierce: number; frost: number };
	};

	beforeEach(() => {
		(globalThis as { Phaser?: { Easing: { Linear: { None: string } } } }).Phaser = {
			Easing: {
				Linear: {
					None: 'linear-none',
				},
			},
		};

		game = {
			abilities: {},
			Phaser: {
				camera: {
					shake: jest.fn(),
					SHAKE_VERTICAL: 'vertical',
				},
				add: {
					graphics: jest.fn(() => ({
						beginFill: jest.fn(),
						drawRect: jest.fn(),
						endFill: jest.fn(),
						destroy: jest.fn(),
					})),
					tween: jest.fn(() => {
						const tween = {
							onComplete: {
								add: (fn: () => void) => {
									fn();
								},
							},
							to: () => tween,
							start: () => tween,
						};
						return tween;
					}),
				},
			},
			grid: {
				creatureGroup: {
					create: jest.fn(() => ({
						anchor: { setTo: jest.fn() },
						destroy: jest.fn(),
						mask: null,
					})),
				},
			},
		};

		loadVehemothAbilities(game as never);

		const baseAbility = game.abilities[6][3] as typeof ability;
		ability = {
			...baseAbility,
			creature: {
				id: 6,
				level: 7,
				size: 2,
				legacyProjectileEmissionPoint: { x: 0, y: 0 },
				player: { flipped: false },
				creatureSprite: {
					grp: { x: 0, y: 0 },
					sprite: {
						x: 0,
						y: 0,
						anchor: { x: 0.5, y: 1 },
						scale: { x: 1, y: 1 },
						texture: { width: 100, height: 100 },
					},
					setDir: jest.fn(),
				},
				facePlayerDefault: jest.fn(),
			},
			end: jest.fn(),
			isUpgraded: () => false,
			damages: { pierce: 20, frost: 0 },
		};
	});

	test('defaults to the base frost bonus when the target has no numeric level', () => {
		const target = {
			level: '-',
				hexagons: [{ displayPos: { x: 1000, y: 10 } }],
			takeDamage: jest.fn(),
		};

		ability.activate(target);

		expect(ability.end).toHaveBeenCalledTimes(1);
		expect(target.takeDamage).toHaveBeenCalledTimes(1);
		const damage = target.takeDamage.mock.calls[0][0] as { damages: { pierce: number; frost: number } };
		expect(damage.damages).toEqual({ pierce: 20, frost: 3 });
	});
});