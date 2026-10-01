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
			x: 0,
			y: 0,
			alpha: 1,
			depth: 0,
			exists: true,
			width: 0,
			height: 0,
			key: PLACEHOLDER.key,
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
			loadTexture: (nextKey: string) => {
				const texture = resolve(nextKey);
				sprite.key = texture.key;
				sprite.texture = { width: texture.width, height: texture.height };
				sprite.width = texture.width;
				sprite.height = texture.height;
			},
			destroy: () => {
				sprite.exists = false;
			},
		};
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
			forEach: (callback: (child: any) => void, context?: any) => {
				[...group.children].forEach((child) => callback.call(context, child));
			},
			getIndex: (child: any) => group.children.indexOf(child),
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
			sprite: (x: number, y: number, key: string) => createSprite(key),
			image: (x: number, y: number, key: string) => createSprite(key),
			text: (x: number, y: number) => {
				const sprite = createSprite('');
				sprite.x = x;
				sprite.y = y;
				return sprite;
			},
		},
		tween: () => ({
			to: () => undefined,
			start: () => undefined,
			onComplete: { add: () => undefined },
		}),
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

const getGameMock = (engine: any) => ({
	turn: 0,
	creatures: [] as unknown[],
	effects: [],
	players: [{}, {}],
	queue: { update: jest.fn() },
	updateQueueDisplay: jest.fn(),
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
});

describe('CreatureSprite cardboard', () => {
	let resident: Map<string, { width: number; height: number }>;
	let engine: ReturnType<typeof createEngineMock>;
	let game: ReturnType<typeof getGameMock>;
	/** Keys the stub loader was asked for and has not resolved yet. */
	let loading: string[];

	beforeEach(() => {
		resident = new Map();
		engine = createEngineMock(resident);
		game = getGameMock(engine);
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
