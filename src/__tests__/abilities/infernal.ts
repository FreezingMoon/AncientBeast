import { afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.mock('phaser-ce', () => ({
	Point: class PointMock {},
	Polygon: class PolygonMock {},
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

beforeAll(() => {
	Object.defineProperty(window, 'Phaser', {
		get() {
			return {
				blendModes: { ADD: 1 },
				Easing: {
					Linear: { None: 1 },
					Sinusoidal: {
						InOut: jest.fn((t) => t),
						Out: jest.fn((t) => t),
					},
				},
			};
		},
	});
});

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
	});

	test('falls back to the nearest walkable hex when furthest destination is blocked', () => {
		const selectAbility = jest.fn();
		const queryMove = jest.fn();
		const cameraShake = jest.fn();

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
			},
			UI: { selectAbility },
			activeCreature: { queryMove },
			freezedInput: false,
			Phaser: {
				camera: {
					shake: cameraShake,
					SHAKE_BOTH: 0,
				},
			},
		};

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
			},
			UI: { selectAbility },
			activeCreature: { queryMove },
			freezedInput: false,
			Phaser: {
				camera: {
					shake: cameraShake,
					SHAKE_BOTH: 0,
				},
			},
		};

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
		};

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

		const haze = group.children.find((child) => child !== sprite && child.scale.y === 1);
		const heatLayer = group.children.find((child) => child !== sprite && child.scale.y === 1.38);

		expect(haze).toBeDefined();
		expect(heatLayer).toBeDefined();
		expect(haze?.alpha).toBe(0);
		expect(heatLayer?.alpha).toBe(0);

		game.Phaser.time.now = 30;
		game.Phaser.time.elapsedMS = 16;
		animations.tickInfernalCardboardEffect(creature);

		expect(haze?.alpha).toBe(0);
		expect(heatLayer?.alpha).toBe(0);
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

		const haze = group.children.find((child) => child !== sprite && child.scale.y === 1);
		const heatLayer = group.children.find((child) => child !== sprite && child.scale.y === 1.38);
		expect(haze?.alpha).toBe(0);
		expect(heatLayer?.alpha).toBe(0);

		sprite.texture.baseTexture = {
			source: { width: 120, height: 180 } as unknown as CanvasImageSource,
		};
		game.Phaser.time.now = 30;
		game.Phaser.time.elapsedMS = 16;
		animations.tickInfernalCardboardEffect(creature);

		expect(haze?.loadTexture).toHaveBeenCalledTimes(1);
		expect(heatLayer?.loadTexture).toHaveBeenCalledTimes(1);
		expect(haze?.alpha).toBeGreaterThan(0);
		expect(heatLayer?.alpha).toBe(0.24);
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
			expect(overlay.exists).toBe(false);
		});

		const secondHeatLayer = second.group.children.find(
			(child) => child !== second.sprite && child.scale.y === 1.38,
		);
		expect(secondHeatLayer).toBeDefined();
		expect(secondHeatLayer?.scale.x).toBe(1);

		second.sprite.scale.x = -1;
		second.sprite.x = 101;
		second.sprite.y = 55;
		game.Phaser.time.now = 65;
		game.Phaser.time.elapsedMS = 17;
		animations.tickInfernalCardboardEffect(creature);

		expect(secondHeatLayer?.scale.x).toBe(-1);
		expect(secondHeatLayer?.y).toBeLessThan(second.sprite.y);
		expect(secondHeatLayer?.x).toBe(second.sprite.x);
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
		animations.tickInfernalCardboardEffect(creature);

		originalOverlays.forEach((overlay) => {
			expect(overlay.destroy).toHaveBeenCalledTimes(1);
			expect(overlay.exists).toBe(false);
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
		animations.tickInfernalCardboardEffect(creature);

		originalOverlays.forEach((overlay) => {
			expect(overlay.destroy).toHaveBeenCalledTimes(1);
			expect(overlay.exists).toBe(false);
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
	anchor: { setTo: (x: number, y: number) => void; x: number; y: number };
	scale: { setTo: (x: number, y: number) => void; x: number; y: number };
	texture: {
		width: number;
		height: number;
		baseTexture?: { source?: CanvasImageSource };
	};
	loadTexture: jest.Mock;
	destroy: jest.Mock;
};

type InfernalGroupMock = {
	children: InfernalSpriteMock[];
	exists: boolean;
	create: (x: number, y: number, key: string) => InfernalSpriteMock;
	addAt: (sprite: InfernalSpriteMock, index: number) => InfernalSpriteMock;
	getChildIndex: (sprite: InfernalSpriteMock) => number;
};

const createInfernalSpriteMock = ({ x, y, scaleX }: { x: number; y: number; scaleX: -1 | 1 }) => {
	const group = {
		children: [] as InfernalSpriteMock[],
		exists: true,
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
		getChildIndex(sprite: InfernalSpriteMock) {
			return this.children.indexOf(sprite);
		},
	} as InfernalGroupMock;

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
	const scale = {
		x: scaleX,
		y: 1,
		setTo(nextX: number, nextY: number) {
			this.x = nextX;
			this.y = nextY;
		},
	};

	const sprite = {
		x,
		y,
		key,
		alpha: 1,
		tint: 0xffffff,
		blendMode: null,
		exists: true,
		parent: group,
		anchor,
		scale,
		texture: {
			frame: { x: 0, y: 0, width: 120, height: 180 },
			width: 120,
			height: 180,
			baseTexture: undefined,
		},
		loadTexture: jest.fn(),
		destroy: jest.fn(function (this: InfernalSpriteMock) {
			this.exists = false;
			this.parent.children = this.parent.children.filter((child) => child !== this);
		}),
	} as InfernalSpriteMock;

	return sprite;
};

const getInfernalAnimationsGameMock = () => {
	const createBitmapData = (width: number, height: number) => {
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
			width,
			height,
			ctx,
			context: ctx,
			canvas: {} as CanvasImageSource,
			dirty: false,
			update: jest.fn(),
			destroy: jest.fn(),
		};
	};

	const makeTween = () => {
		const tween = {
			to: jest.fn().mockReturnThis(),
			onComplete: { add: jest.fn() },
			stop: jest.fn(),
		};
		return tween;
	};

	return {
		Phaser: {
			time: {
				now: 0,
				elapsedMS: 16,
			},
			add: {
				bitmapData: jest.fn((width: number, height: number) => createBitmapData(width, height)),
				tween: jest.fn(() => makeTween()),
			},
		},
	};
};
