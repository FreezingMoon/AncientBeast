/**
 * Guards the on-demand cardboard race that left a freshly materialized unit
 * rendering as a floating placeholder.
 *
 * Cardboards are fetched the first time a unit is shown rather than at match
 * start, so a `Creature` is regularly constructed while its texture is still
 * in flight — always on the client replaying a materialization, which has no
 * placement preview to warm the fetch. Phaser binds such a sprite to its 32×32
 * `__MISSING` placeholder and never re-resolves it once the real texture
 * arrives, and `CreatureSprite` sizes its offset from the texture, so the unit
 * was both invisible and drawn away from its hexes until an unrelated
 * `setTexture` call rescued it (the xray teardown at the start of Abolished's
 * Bonfire Spring teleport, in the bug this pins).
 */
import { jest, expect, describe, test, beforeEach, afterEach } from '@jest/globals';

// The real Phaser bundle needs a canvas context at import time, which jsdom
// does not provide.
jest.mock('phaser', () =>
	(
		jest.requireActual('../../test/phaser-mock') as typeof import('../../test/phaser-mock')
	).createPhaserMock(),
);
// The four `Ability`s built by the `Creature` constructor are irrelevant here,
// and automocking them keeps the game mock down to what placement needs.
jest.mock('../ability');

import { Creature } from '../creature';
import { notifyTextureLoaded, resetOnDemandTextures, setOnDemandLoader } from '../assets';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Abolished's cardboard, from `data/units.ts`. */
const CARDBOARD = { width: 270, height: 277 };
/** Abolished's `display` offsets, from `data/units.ts`. */
const OFFSET_X = 0;
const OFFSET_Y = -235;
/** What Phaser substitutes for a texture key that is not resident. */
const PLACEHOLDER = { key: '__MISSING', width: 32, height: 32 };

type Texture = { key: string; width: number; height: number };

/**
 * Engine stub with just enough of a texture manager to reproduce the race: a
 * sprite only samples a real texture once it is resident, and `loadTexture`
 * re-resolves it (Phaser does not do that on its own when a key is added
 * later).
 */
function createEngineMock(resident: Map<string, { width: number; height: number }>) {
	const resolve = (key: string): Texture => {
		const texture = resident.get(key);
		return texture ? { key, ...texture } : { ...PLACEHOLDER };
	};

	const createSprite = (key: string) => {
		const sprite: any = {
			type: 'Sprite',
			x: 0,
			y: 0,
			alpha: 1,
			depth: 0,
			// `exists`, `data`, `parent` and `position` are Phaser 2 CE members
			// still read by the rest of `creature.ts`; they go when the group
			// migration does. The rest is native Phaser 4 shape.
			exists: true,
			active: true,
			visible: true,
			originX: 0.5,
			originY: 0.5,
			displayOriginX: 0,
			displayOriginY: 0,
			scaleX: 1,
			scaleY: 1,
			width: 0,
			height: 0,
			key: PLACEHOLDER.key,
			text: '',
			texture: { width: 0, height: 0 },
			anchor: { setTo: () => undefined },
			scale: { setTo: () => undefined },
			data: {},
			parent: null as any,
			position: {
				set: (x: number, y: number) => {
					sprite.x = x;
					sprite.y = y;
				},
				clone: () => ({ x: sprite.x, y: sprite.y }),
			},
			setOrigin: (ox: number, oy?: number) => {
				sprite.originX = ox;
				sprite.originY = oy === undefined ? ox : oy;
				sprite.displayOriginX = sprite.originX * sprite.width;
				sprite.displayOriginY = sprite.originY * sprite.height;
				return sprite;
			},
			setScale: (sx: number, sy?: number) => {
				sprite.scaleX = sx;
				sprite.scaleY = sy === undefined ? sx : sy;
				return sprite;
			},
			setPosition: (x: number, y: number) => {
				sprite.x = x;
				sprite.y = y;
				return sprite;
			},
			setActive: (value: boolean) => {
				sprite.active = value;
				sprite.exists = value;
				return sprite;
			},
			setVisible: (value: boolean) => {
				sprite.visible = value;
				return sprite;
			},
			// `_enableSkipTurnInput` makes the hint clickable; the double only has
			// to accept the call, since input routing is `src/input/input.ts`.
			setInteractive: () => sprite,
			disableInteractive: () => sprite,
			loadTexture: (nextKey: string) => {
				const texture = resolve(nextKey);
				sprite.key = texture.key;
				sprite.texture = { width: texture.width, height: texture.height };
				sprite.width = texture.width;
				sprite.height = texture.height;
			},
			destroy: () => {
				sprite.exists = false;
				sprite.active = false;
			},
		};
		// Native name for the same operation; `hint()` is migrated, the cardboard
		// rebind is not.
		sprite.setTexture = sprite.loadTexture;
		sprite.loadTexture(key);
		return sprite;
	};

	const createGroup = (parent: any = null) => {
		const group: any = {
			x: 0,
			y: 0,
			alpha: 1,
			depth: 0,
			exists: true,
			active: true,
			originX: 0.5,
			originY: 0.5,
			scaleX: 1,
			scaleY: 1,
			children: [] as any[],
			length: 0,
			total: 0,
			parent,
			position: {
				set: (x: number, y: number) => {
					group.x = x;
					group.y = y;
				},
			},
			add: (child: any) => {
				child.parent = group;
				group.children.push(child);
				group.length = group.children.length;
				group.total = group.children.length;
				return child;
			},
			addChild: (child: any) => group.add(child),
			removeChild: (child: any) => {
				child.parent = null;
				const index = group.children.indexOf(child);
				if (index !== -1) group.children.splice(index, 1);
				group.length = group.children.length;
				group.total = group.children.length;
			},
			remove: (child: any) => group.removeChild(child),
			create: (x: number, y: number, key: string) => {
				const sprite = createSprite(key);
				sprite.x = x;
				sprite.y = y;
				return group.add(sprite);
			},
			// Native `Container.each`. Phaser 2's `forEach` took a third
			// `skipList` argument; `creature.ts` dropped it, so the double has
			// no reason to carry the extra shape.
			each: (callback: (child: any) => void, context?: any) => {
				[...group.children].forEach((child) => callback.call(context, child));
			},
			getIndex: (child: any) => group.children.indexOf(child),
			// Native names for the members the engine facade used to translate.
			// `setPosition` replaces the `position.set` shim.
			setPosition: (x: number, y: number) => {
				group.x = x;
				group.y = y;
				return group;
			},
			setOrigin: (ox: number, oy?: number) => {
				group.originX = ox;
				group.originY = oy === undefined ? ox : oy;
				return group;
			},
			setScale: (sx: number, sy?: number) => {
				group.scaleX = sx;
				group.scaleY = sy === undefined ? sx : sy;
				return group;
			},
			setActive: (value: boolean) => {
				group.active = value;
				group.exists = value;
				return group;
			},
			setDepth: (value: number) => {
				group.depth = value;
			},
			update: () => undefined,
			destroy: () => {
				group.exists = false;
			},
		};
		return group;
	};

	return {
		groups: { creatureGroup: createGroup() },
		add: {
			group: (parent?: any) => createGroup(parent),
			sprite: jest.fn((x: number, y: number, key: unknown, frame?: string, parent?: any) => {
				// A texture argument that is not a key string cannot resolve, and
				// Phaser does not complain: it binds the `__MISSING` placeholder.
				// The stub models that by feeding whatever it was given to
				// `resolve`, so a surface object lands on the placeholder exactly
				// as it does on a real renderer.
				const sprite = createSprite(key as string);
				sprite.x = x;
				sprite.y = y;
				// A real `add.sprite` parents into the group it is given, and the
				// hint stacks and clears itself by walking that group.
				return parent ? parent.add(sprite) : sprite;
			}),
			image: (x: number, y: number, key: string) => createSprite(key),
			text: (x: number, y: number) => {
				const sprite = createSprite('');
				sprite.x = x;
				sprite.y = y;
				sprite.type = 'Text';
				sprite.text = '';
				return sprite;
			},
		},
		/**
		 * Chainable tween stub.
		 *
		 * `hint()` chains `.to().to().start()`, yoyos, and hooks both
		 * `onUpdateCallback` and `onComplete.add`, so every link has to return the
		 * tween rather than undefined. The callbacks are never fired: these tests
		 * assert on what `hint()` *builds*, not on the animation it would play.
		 */
		tween: (_target?: unknown) => {
			const tween: any = {
				isRunning: false,
				isDestroyed: false,
				stop: () => tween,
				pause: () => tween,
				play: () => tween,
				yoyo: () => tween,
				repeat: () => tween,
				delay: () => tween,
				onUpdateCallback: () => tween,
				onComplete: { add: () => undefined },
				onStart: { add: () => undefined },
				onStop: { add: () => undefined },
			};
			tween.to = () => tween;
			tween.start = () => {
				tween.isRunning = true;
				return tween;
			};
			return tween;
		},
		cache: { getImage: () => null },
	};
}

const getHexesMock = () => {
	const hexes = [];
	for (let y = 0; y < 20; y++) {
		const row = [];
		for (let x = 0; x < 20; x++) {
			row.push({ displayPos: { x, y }, creature: 0 });
		}
		hexes.push(row);
	}
	return hexes;
};

const getCreatureObjMock = () => ({
	name: 'Abolished',
	type: 'P7',
	stats: { health: 234 },
	display: { 'offset-x': OFFSET_X, 'offset-y': OFFSET_Y },
	size: 3,
	x: 4,
	y: 4,
	team: 0,
	temp: false,
	materializationSickness: true,
});

const getGameMock = (engine: any, resident: Map<string, { width: number; height: number }>) => {
	// A texture manager, because the hint backdrops are canvas surfaces and a
	// surface only resolves if it was actually registered. Without this the
	// surface reports a headless key that resolves to nothing, and the stub
	// cannot tell "handed a real key" from "handed the surface object" - both
	// land on the placeholder, which is exactly the bug.
	const context2d = {
		fillStyle: '',
		clearRect: () => undefined,
		fillRect: () => undefined,
		drawImage: () => undefined,
	} as unknown as CanvasRenderingContext2D;
	const surfaces = new Map<string, { key: string; getContext: () => CanvasRenderingContext2D }>();
	return {
		turn: 0,
		creatures: [] as unknown[],
		effects: [],
		players: [{}, {}],
		queue: { update: jest.fn() },
		updateQueueDisplay: jest.fn(),
		Phaser: {
			textures: {
				// No `game.renderer.gl` here, so `CanvasSurface.commit()` is a
				// no-op and there is nothing to upload — same as a headless run.
				createCanvas: (key: string, width: number, height: number) => {
					resident.set(key, { width, height });
					const texture = { key, getContext: () => context2d, canvas: { width, height } };
					surfaces.set(key, texture);
					return texture;
				},
				get: (key: string) => {
					const surface = surfaces.get(key);
					if (surface) {
						return { key, getSourceImage: () => ({ width: 0, height: 0 }) };
					}
					const texture = resident.get(key);
					return texture ? { key, getSourceImage: () => ({ ...texture }) } : undefined;
				},
				remove: (key: string) => {
					surfaces.delete(key);
					resident.delete(key);
				},
			},
		},
		grid: {
			hexes: getHexesMock(),
			allhexes: [] as unknown[],
			creatureGroup: engine.groups.creatureGroup,
			healthIndicatorUiGroup: { add: jest.fn(), remove: jest.fn() },
			orderCreatureZ: jest.fn(),
			fadeOutTempCreature: jest.fn(),
			refreshActiveCreatureXray: jest.fn(),
		},
		gameEngine: engine,
		animations: {
			initInfernalCardboardEffect: jest.fn(),
			tickInfernalCardboardEffect: jest.fn(),
			disposeInfernalCardboardEffect: jest.fn(),
			rekeyInfernalCardboardEffect: jest.fn(),
		},
		signals: { metaPowers: { add: jest.fn() } },
		UI: { selectedAbility: -1 },
	};
};

describe('CreatureSprite cardboard', () => {
	let resident: Map<string, { width: number; height: number }>;
	let engine: ReturnType<typeof createEngineMock>;
	let game: ReturnType<typeof getGameMock>;
	/** Keys the stub loader was asked for and has not resolved yet. */
	let loading: string[];

	beforeEach(() => {
		resident = new Map();
		engine = createEngineMock(resident);
		game = getGameMock(engine, resident);
		loading = [];
		// Stand in for the Phaser loader: requests are parked until the test
		// resolves them, exactly as a real download would be.
		setOnDemandLoader(
			(key) => {
				loading.push(key);
			},
			(key) => resident.has(key),
		);
	});

	afterEach(() => {
		resetOnDemandTextures();
		setOnDemandLoader(undefined, undefined);
	});

	test('a cardboard that is still downloading is requested', () => {
		// @ts-expect-error partial Creature options
		new Creature(getCreatureObjMock(), game);
		expect(loading).toContain('Abolished');
	});

	test('the sprite rebinds and re-places itself once the cardboard lands', () => {
		// @ts-expect-error partial Creature options
		const creature = new Creature(getCreatureObjMock(), game);
		const sprite = creature.sprite;

		// Built against the placeholder: unsampled art, and an offset taken
		// from the placeholder's size rather than the unit's.
		expect(sprite.key).toBe(PLACEHOLDER.key);
		expect(sprite.x).toBe(OFFSET_X + PLACEHOLDER.width / 2);
		expect(sprite.y).toBe(OFFSET_Y + PLACEHOLDER.height);

		resident.set('Abolished', CARDBOARD);
		notifyTextureLoaded('Abolished');

		expect(sprite.key).toBe('Abolished');
		expect(sprite.x).toBe(OFFSET_X + CARDBOARD.width / 2);
		expect(sprite.y).toBe(OFFSET_Y + CARDBOARD.height);
	});

	test('a cardboard that is already resident is used as-is', () => {
		resident.set('Abolished', CARDBOARD);
		// @ts-expect-error partial Creature options
		const creature = new Creature(getCreatureObjMock(), game);

		expect(creature.sprite.key).toBe('Abolished');
		expect(creature.sprite.x).toBe(OFFSET_X + CARDBOARD.width / 2);
		expect(creature.sprite.y).toBe(OFFSET_Y + CARDBOARD.height);
	});

	test('the group update hook does not double-tick the Infernal effect', () => {
		// Phaser still calls `_group.update()` every step, and `phaserUpdate()`
		// drives `tickXray()` too. Delegating from the hook ticked the effect
		// twice per frame, which doubled the speed of its `uTime`-driven pulse
		// and smoke spawns.
		// @ts-expect-error partial Creature options
		const creature = new Creature(getCreatureObjMock(), game);
		const tickSpy = jest.spyOn(creature.creatureSprite, 'tickXray');

		const groupUpdate = (creature.creatureSprite as any)._group.update as (() => void) | undefined;
		expect(typeof groupUpdate).toBe('function');
		groupUpdate?.call((creature.creatureSprite as any)._group);

		expect(tickSpy).not.toHaveBeenCalled();
	});

	test('a torn-down sprite is left alone when its cardboard lands', () => {
		// @ts-expect-error partial Creature options
		const creature = new Creature(getCreatureObjMock(), game);
		const sprite = creature.sprite;

		// A unit that died, or an unmaterialized placeholder replaced by its
		// real twin, is detached before its cardboard finishes downloading.
		creature.creatureSprite.destroy();
		resident.set('Abolished', CARDBOARD);
		expect(() => notifyTextureLoaded('Abolished')).not.toThrow();
		expect(sprite.key).toBe(PLACEHOLDER.key);
	});
});

/**
 * The skip-turn and no-action hints paint their own backdrop: a canvas surface
 * filled with a translucent wash, the `frame` artwork drawn over it, and that
 * surface handed to a sprite. The migration passed the surface *object* where
 * Phaser wants a texture *key*, laundered through `as any as string` so
 * TypeScript would not object. Phaser 4 does not throw on an unknown key — it
 * silently binds the 32x32 `__MISSING` placeholder — so the hints came up
 * with no backdrop at all, at the placeholder's size.
 *
 * The cast is what let it through, so the assertion is on the type of the
 * argument rather than on any particular key: every texture handed to a sprite
 * must be a string, because that is the only thing a texture key can be.
 */
describe('CreatureSprite hint backdrop', () => {
	let resident: Map<string, { width: number; height: number }>;
	let engine: ReturnType<typeof createEngineMock>;
	let game: ReturnType<typeof getGameMock>;

	/** The texture argument of every `add.sprite` call, in order. */
	const spriteTextureArgs = (): unknown[] =>
		(engine.add.sprite as unknown as jest.Mock).mock.calls.map((call) => call[2]);

	/** The hint group is private; tests reach it through one declared alias. */
	const hintGroup = (creature: any) => (creature.creatureSprite as any)._hintGrp;

	beforeEach(() => {
		resident = new Map();
		// The hint frames are drawn from the real `frame` texture, so it has to
		// resolve; otherwise the surface would be placeholder-sized and the test
		// would pass for the wrong reason.
		resident.set('frame', { width: 128, height: 128 });
		resident.set('skip', { width: 512, height: 512 });
		engine = createEngineMock(resident);
		game = getGameMock(engine, resident);
		setOnDemandLoader(
			() => undefined,
			(key) => resident.has(key),
		);
	});

	afterEach(() => {
		resetOnDemandTextures();
		setOnDemandLoader(undefined, undefined);
	});

	test('the skip-turn backdrop is a registered texture key, not a surface', () => {
		// @ts-expect-error partial Creature options
		const creature = new Creature(getCreatureObjMock(), game);
		creature.creatureSprite.hint('Skip turn', 'confirm');

		const keys = spriteTextureArgs();
		expect(keys.length).toBeGreaterThan(0);
		for (const key of keys) {
			expect(typeof key).toBe('string');
			expect(String(key).length).toBeGreaterThan(0);
		}

		// The backdrop is the sprite built from the canvas surface, which is
		// sized from the real `frame` texture. Before the fix it was handed the
		// surface object instead of its key, so it resolved to the 32x32
		// placeholder and came out at the wrong size with no artwork.
		const survivors = hintGroup(creature).children.filter((sprite: any) => sprite.exists !== false);
		expect(survivors.length).toBeGreaterThan(0);
		expect(survivors.every((sprite: any) => sprite.key !== PLACEHOLDER.key)).toBe(true);
		expect(survivors.some((sprite: any) => sprite.width === 128)).toBe(true);
	});

	test('the no-action backdrop is a registered texture key, not a surface', () => {
		// @ts-expect-error partial Creature options
		const creature = new Creature(getCreatureObjMock(), game);
		creature.creatureSprite.hint('Cannot move', 'no_action');

		for (const key of spriteTextureArgs()) {
			expect(typeof key).toBe('string');
		}
	});

	test('the throwaway sizing sprite is not left in the hint group', () => {
		// The `frame` sprite exists only to report its own size for the canvas,
		// and is destroyed immediately; a leftover would draw a stray frame in
		// the corner of the hint.
		// @ts-expect-error partial Creature options
		const creature = new Creature(getCreatureObjMock(), game);
		creature.creatureSprite.hint('Skip turn', 'confirm');

		const survivors = hintGroup(creature).children.filter((sprite: any) => sprite.exists !== false);
		expect(survivors.every((sprite: any) => sprite.key !== 'frame')).toBe(true);
	});
});
