/**
 * Regression cover for the CPU-drawn surfaces (plasma field, x-ray, Infernal
 * haze/heat) losing their texture after the Phaser 4 migration.
 *
 * Phaser 2 CE registered every `BitmapData` in the `TextureManager`, so AB could
 * hand a bitmap straight to a texture-key parameter. Phaser 4 does not: the
 * lookup stringifies the argument to `"[object Object]"`, misses, and silently
 * returns `__MISSING` — the effect renders nothing instead of erroring. The
 * surface API now returns a `key` string for that reason, and these tests pin it.
 */
import { jest, describe, expect, test } from '@jest/globals';

jest.mock('phaser', () =>
	(
		jest.requireActual('../../../test/phaser-mock') as typeof import('../../../test/phaser-mock')
	).createPhaserMock(),
);

import { BlendModes } from 'phaser';
import type { GameEngine } from '../../engine/types';
import { PlasmaField } from '../../plasma-field';
import { createCanvasSurface } from '../../game-display/canvas-surface';

/**
 * Mirrors Phaser 4's `TextureManager.get()` lookup, including its
 * string-coercion of the argument and the `__MISSING` fallback. Used to prove
 * which texture a sprite actually ends up bound to.
 */
function makeTextureManagerStub(renderer: unknown = { gl: {} }) {
	const list: Record<string, unknown> = {
		__MISSING: { key: '__MISSING' },
		__DEFAULT: { key: '__DEFAULT' },
	};
	const textures = {
		game: { renderer },
		list,
		refreshCalls: 0,
		createCanvas(key: string, width = 8, height = 8) {
			const canvasTexture = {
				key,
				width,
				height,
				canvas: { width, height },
				getContext: () => createCanvasSurface(null, width, height).ctx,
				refresh: () => {
					// Mirrors Phaser's real `TextureSource.update()`, which
					// dereferences `renderer.gl` and so throws when there is none.
					if (!renderer) {
						throw new Error('Cannot read properties of null (reading "gl")');
					}
					textures.refreshCalls++;
				},
			};
			list[key] = canvasTexture;
			return canvasTexture;
		},
		remove(key: string) {
			delete list[key];
		},
		get(key: unknown) {
			if (key === undefined) key = '__DEFAULT';
			return (list as Record<string, unknown>)[key as string] ?? list['__MISSING'];
		},
	};
	return textures;
}

/**
 * The subset of a texture manager the engine double resolves keys through.
 *
 * `unknown` rather than `{ key: string }`, because `makeTextureManagerStub`
 * indexes into a `Record<string, unknown>`; the double narrows it to the
 * one member it actually reads.
 */
type TextureKeyLookup = { get(key: unknown): unknown };

/**
 * A `GameEngine` double, sized to the calls these tests make: the sprite
 * factories, and a `world` group for `PlasmaField` to parent into.
 *
 * This replaces `NullEngine`, a 640-line engine stub that no runtime reached any
 * more — the bot simulation, the Devvit server and the headless suites all boot
 * real Phaser 4 through `Game.createPhaser()` (see `src/game.ts`). Only the
 * texture lookup is modelled faithfully: like Phaser 4's `TextureManager.get`, it
 * string-coerces the argument and falls back to `__MISSING`, so handing a
 * surface where a key belongs still fails the assertions below instead of being
 * rubber-stamped by a pass-through.
 */
function makeEngineDouble(textures: TextureKeyLookup): GameEngine {
	// Narrows the stub's `unknown` to the single member the sprite reads.
	const resolveKey = (key: unknown): string => (textures.get(key) as { key: string }).key;

	const makeSprite = (x: number, y: number, key: unknown) => ({
		x,
		y,
		alpha: 1,
		blendMode: 0,
		originX: 0.5,
		originY: 0.5,
		scaleX: 1,
		scaleY: 1,
		key: resolveKey(key),
		parent: null as unknown,
		setOrigin(this: { originX: number; originY: number }, ox: number, oy = ox) {
			this.originX = ox;
			this.originY = oy;
			return this;
		},
		setScale(this: { scaleX: number; scaleY: number }, sx: number, sy = sx) {
			this.scaleX = sx;
			this.scaleY = sy;
			return this;
		},
		setPosition(this: { x: number; y: number }, px: number, py: number) {
			this.x = px;
			this.y = py;
			return this;
		},
		loadTexture(this: { key: string }, next: unknown) {
			this.key = resolveKey(next);
			return this;
		},
		setTexture(this: { key: string }, next: unknown) {
			this.key = resolveKey(next);
			return this;
		},
		destroy() {},
	});

	const makeGroup = () => {
		const children: unknown[] = [];
		return {
			children,
			x: 0,
			y: 0,
			alpha: 1,
			visible: true,
			depth: 0,
			add(child: unknown) {
				children.push(child);
				(child as { parent: unknown }).parent = this;
				return child;
			},
			addAt(child: unknown, index: number) {
				children.splice(index, 0, child);
				return child;
			},
			remove() {},
			removeAll() {
				children.length = 0;
			},
			each(callback: (child: unknown) => void) {
				children.forEach(callback);
			},
			getIndex(child: unknown) {
				return children.indexOf(child);
			},
			get total() {
				return children.length;
			},
			get exists() {
				return true;
			},
			set exists(_value: boolean) {},
		};
	};

	const world = makeGroup();

	return {
		world,
		supportsShaders: false,
		add: {
			sprite(
				x: number,
				y: number,
				key: unknown,
				_frame?: string,
				parent?: ReturnType<typeof makeGroup>,
			) {
				const sprite = makeSprite(x, y, key);
				(parent ?? world).add(sprite);
				return sprite;
			},
			image(x: number, y: number, key: unknown) {
				return makeSprite(x, y, key);
			},
			group: () => makeGroup(),
		},
	} as unknown as GameEngine;
}

describe('canvas surfaces as texture keys', () => {
	test('a surface registers under a real, unique key', () => {
		const textures = makeTextureManagerStub();
		const first = createCanvasSurface({ textures: textures as never }, 8, 8);
		const second = createCanvasSurface({ textures: textures as never }, 8, 8);
		expect(typeof first.key).toBe('string');
		expect(first.key).not.toBe(second.key);
	});

	test('the surface object itself misses the lookup — this was the migration bug', () => {
		const textures = makeTextureManagerStub();
		const surface = createCanvasSurface({ textures: textures as never }, 8, 8);
		// What the old code did: hand the surface where a key was expected.
		expect(textures.get(surface as any)).toBe(textures.list['__MISSING']);
	});

	test('the resolved key finds the surface that was drawn into', () => {
		const textures = makeTextureManagerStub();
		const surface = createCanvasSurface({ textures: textures as never }, 8, 8);
		expect(textures.get(surface.key)).not.toBe(textures.list['__MISSING']);
	});

	test('releasing a surface unregisters its texture', () => {
		const textures = makeTextureManagerStub();
		const surface = createCanvasSurface({ textures: textures as never }, 8, 8);
		surface.destroy();
		expect(textures.get(surface.key)).toBe(textures.list['__MISSING']);
	});

	test('no source still yields a drawable surface with a usable key', () => {
		// The headless runner has no Phaser. Drawing has to keep working, because
		// the pixel paths run there; there is just nothing registered behind it.
		const surface = createCanvasSurface(null, 8, 8);
		expect(typeof surface.key).toBe('string');
		expect(surface.ctx).toBeTruthy();
		expect(() => surface.commit()).not.toThrow();
		expect(() => surface.destroy()).not.toThrow();
	});

	test('commit pushes to the GPU when there is one', () => {
		const textures = makeTextureManagerStub({ gl: {} });
		const surface = createCanvasSurface({ textures: textures as never }, 8, 8);

		surface.commit();
		surface.commit();

		expect(textures.refreshCalls).toBe(2);
	});

	test('commit is skipped when the game has no renderer', () => {
		// `Phaser.HEADLESS` gives `game.renderer === null`, and `refresh()`
		// dereferences `renderer.gl`. The headless simulation and the
		// authoritative server draw surfaces but never rasterise them, so the
		// commit has to be a no-op rather than a throw mid-animation.
		const textures = makeTextureManagerStub(null);
		const surface = createCanvasSurface({ textures: textures as never }, 8, 8);

		expect(() => surface.commit()).not.toThrow();
		expect(textures.refreshCalls).toBe(0);
	});

	test('drawTexture on an unknown key warns instead of throwing', () => {
		const textures = makeTextureManagerStub({ gl: {} });
		const target = createCanvasSurface({ textures: textures as never }, 8, 8);
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

		target.drawTexture('no-such-texture', 0, 0);

		expect(warn).toHaveBeenCalled();
		expect(textures.refreshCalls).toBe(0);
		warn.mockRestore();
	});

	test('every texture-key call site binds the surface key, not the surface', () => {
		const textures = makeTextureManagerStub();
		const engine = makeEngineDouble(textures);
		const surface = createCanvasSurface({ textures: textures as never }, 8, 8);

		expect(engine.add.sprite(0, 0, surface.key).key).toBe(surface.key);
		expect(engine.add.image(0, 0, surface.key).key).toBe(surface.key);
		const group = engine.add.group();
		expect(engine.add.sprite(0, 0, surface.key, undefined, group).key).toBe(surface.key);
		const sprite = engine.add.sprite(0, 0, 'glove');
		sprite.loadTexture(surface.key);
		expect(sprite.key).toBe(surface.key);
		// The double resolves keys through the same lookup Phaser 4 uses, so
		// passing the surface where a key belongs is what fails these assertions.
		expect(engine.add.sprite(0, 0, surface as never).key).toBe('__MISSING');
	});
});

describe('PlasmaField', () => {
	/**
	 * A texture manager stub, standing in for Phaser's.
	 *
	 * The field registers its drawing surface as a real canvas texture and hands
	 * the sprite the resulting key, so this records what was registered.
	 */
	function textureManagerCapturingSurfaces() {
		const created: { key: string; width: number; height: number }[] = [];
		return {
			created,
			textures: {
				createCanvas: (key: string, width: number, height: number) => {
					created.push({ key, width, height });
					return {
						key,
						canvas: { width, height } as HTMLCanvasElement,
						getContext: () => createCanvasSurface(null, width, height).ctx,
						refresh: () => {},
					};
				},
				remove: () => {},
			},
		};
	}

	function engineAndSurfaces() {
		const { created, textures } = textureManagerCapturingSurfaces();
		const engine = makeEngineDouble({
			get: (key: unknown) => (typeof key === 'string' ? { key } : { key: '__MISSING' }),
		});
		return { engine, created, surfaceSource: { textures: textures as never } };
	}

	test('attaches its surface to the sprite, not to the missing texture', () => {
		const { engine, created, surfaceSource } = engineAndSurfaces();
		const field = new PlasmaField(engine, 100, 200, { staticMode: true, surfaceSource });

		expect(created).toHaveLength(1);
		const sprite = field.sprite as unknown as { key: string };
		// The regression: the sprite used to be handed the surface object, which
		// Phaser 4 could not resolve, so the shield rendered as the missing
		// texture instead of the pixels drawn into its surface.
		expect(sprite.key).toBe(created[0].key);
		expect(typeof sprite.key).toBe('string');
		expect(sprite.key).not.toBe('__MISSING');
	});

	test('falls back to a context with no texture when no source is given', () => {
		// The headless runner has no Phaser. Drawing still has to work, because the
		// pixel paths run there; there is simply nothing behind the surface.
		const engine = makeEngineDouble(makeTextureManagerStub());
		const field = new PlasmaField(engine, 100, 200, { staticMode: true });
		expect(typeof field.sprite.key).toBe('string');
	});

	test('blends additively — MULTIPLY (2) muddies the glow instead of blooming it', () => {
		const { engine, surfaceSource } = engineAndSurfaces();
		const field = new PlasmaField(engine, 100, 200, { staticMode: true, surfaceSource });

		const { blendMode } = field.sprite as unknown as { blendMode: number };
		expect(blendMode).toBe(BlendModes.ADD);
		// ADD is 1 in both Phaser 2 CE and Phaser 4; 2 is MULTIPLY in both.
		expect(blendMode).not.toBe(2);
	});
});
