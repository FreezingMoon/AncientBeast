/**
 * Regression cover for the CPU-drawn surfaces (plasma field, x-ray, Infernal
 * haze/heat) losing their texture after the Phaser 4 migration.
 *
 * Phaser 2 CE registered every `BitmapData` in the `TextureManager`, so AB could
 * hand a bitmap straight to a texture-key parameter. Phaser 4 does not: the
 * lookup misses and silently returns the `__MISSING` texture, so the effect
 * renders nothing instead of erroring. These tests pin the resolution.
 */
import { jest, describe, expect, test } from '@jest/globals';

jest.mock('phaser', () =>
	(
		jest.requireActual('../../../test/phaser-mock') as typeof import('../../../test/phaser-mock')
	).createPhaserMock(),
);

import { toTextureKey } from '../../engine/textureKey';
import { NullEngine } from '../../engine/NullEngine';
import type { BitmapDataHandle } from '../../engine/types';
import { BlendModes } from 'phaser';
import { PlasmaField } from '../../plasma-field';

/**
 * Mirrors Phaser 4's `TextureManager.get()` lookup, including its
 * string-coercion of the argument and the `__MISSING` fallback. Used to prove
 * which texture a sprite actually ends up bound to.
 */
function makeTextureManagerStub() {
	const list: Record<string, unknown> = {
		__MISSING: { key: '__MISSING' },
		__DEFAULT: { key: '__DEFAULT' },
	};
	return {
		list,
		createCanvas(key: string) {
			const canvasTexture = { key, canvas: {}, update: jest.fn() };
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
}

describe('toTextureKey', () => {
	test('passes a plain texture key through untouched', () => {
		expect(toTextureKey('glove')).toBe('glove');
	});

	test('resolves a bitmap handle to the key it is registered under', () => {
		const bmd = { textureKey: '__ab_bmp_7' };
		expect(toTextureKey(bmd as any)).toBe('__ab_bmp_7');
	});

	test('resolves a Phaser texture to its own key', () => {
		expect(toTextureKey({ key: 'dark_priest' } as any)).toBe('dark_priest');
	});

	test('leaves unrecognised values for Phaser to handle', () => {
		const frame = { name: 'idle_0' };
		expect(toTextureKey(frame as any)).toBe(frame);
	});
});

describe('bitmap handles as texture keys', () => {
	const engine = new NullEngine();
	const bmd = engine.add.bitmapData(8, 8);

	test('a bitmap handle exposes a real, unique texture key', () => {
		expect(typeof bmd.textureKey).toBe('string');
		expect(bmd.textureKey.length).toBeGreaterThan(0);
	});

	test('the raw handle misses the texture lookup — this was the migration bug', () => {
		const textures = makeTextureManagerStub();
		// What the old code effectively did: pass the handle where a key was
		// expected. Phaser coerces it to "[object Object]" and finds nothing.
		expect(textures.get(bmd as any)).toBe(textures.list['__MISSING']);
	});

	test('the resolved key finds the drawn texture instead', () => {
		const textures = makeTextureManagerStub();
		// Mirrors `DynamicTextureAdapter`: register the surface, draw into it,
		// then look it up the way a sprite would.
		const surface = textures.createCanvas(toTextureKey(bmd) as string);
		expect(textures.get(toTextureKey(bmd))).toBe(surface);
		expect(textures.get(toTextureKey(bmd))).not.toBe(textures.list['__MISSING']);
	});

	test('add.sprite accepts a bitmap handle and binds it to the resolved key', () => {
		const sprite = engine.add.sprite(0, 0, bmd);
		expect(sprite.key).toBe(bmd.textureKey);
	});

	test('add.image accepts a bitmap handle', () => {
		expect(engine.add.image(0, 0, bmd).key).toBe(bmd.textureKey);
	});

	test('loadTexture accepts a bitmap handle', () => {
		const sprite = engine.add.sprite(0, 0, 'glove');
		sprite.loadTexture(bmd);
		expect(sprite.key).toBe(bmd.textureKey);
	});

	test('group.create accepts a bitmap handle', () => {
		const group = engine.add.group();
		expect(group.create(0, 0, bmd).key).toBe(bmd.textureKey);
	});
});

describe('PlasmaField', () => {
	/**
	 * NullEngine exposes `add` as a plain instance property, so the surfaces a
	 * field allocates are captured by shadowing it.
	 */
	function engineCapturingSurfaces() {
		const engine = new NullEngine();
		const surfaces: BitmapDataHandle[] = [];
		const realAdd = engine.add;
		Object.defineProperty(engine, 'add', {
			value: {
				...realAdd,
				bitmapData: (w: number, h: number) => {
					const surface = realAdd.bitmapData(w, h);
					surfaces.push(surface);
					return surface;
				},
			},
		});
		return { engine, surfaces };
	}

	test('attaches its surface to the sprite, not to the missing texture', () => {
		const { engine, surfaces } = engineCapturingSurfaces();
		const field = new PlasmaField(engine, 100, 200, { staticMode: true });

		expect(surfaces).toHaveLength(1);
		const sprite = field.sprite as unknown as { key: string };
		// The regression: the sprite used to be handed the handle object, which
		// Phaser 4 could not resolve, so the shield rendered as the missing
		// texture instead of the pixels drawn into its surface.
		expect(sprite.key).toBe(surfaces[0].textureKey);
		expect(typeof sprite.key).toBe('string');
		expect(sprite.key).not.toBe('__MISSING');
	});

	test('blends additively — MULTIPLY (2) muddies the glow instead of blooming it', () => {
		const { engine } = engineCapturingSurfaces();
		const field = new PlasmaField(engine, 100, 200, { staticMode: true });

		const { blendMode } = field.sprite as unknown as { blendMode: number };
		expect(blendMode).toBe(BlendModes.ADD);
		// ADD is 1 in both Phaser 2 CE and Phaser 4; 2 is MULTIPLY in both.
		expect(blendMode).not.toBe(2);
	});
});
