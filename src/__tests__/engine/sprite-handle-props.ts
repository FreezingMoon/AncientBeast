/**
 * Regression cover for custom properties stashed on a sprite handle.
 *
 * Phaser 2 CE game objects were plain JS objects, so gameplay code could
 * attach whatever bookkeeping it liked (`sprite._previewPos = …`,
 * `materialize_overlay.posy = …`) and read it straight back. The Phaser 4
 * facades are proxies, and the `set` trap routes unknown keys into a side
 * `Map` so they never collide with real Phaser 4 properties. The `get` trap
 * then has to read them back from that same map.
 *
 * It did not: it only checked `local.has(key)` and then fell through to
 * `Reflect.get(facadeTarget, …)`, which can never see the map. Every stashed
 * value silently read back as `undefined`, so `preview._previewPos` was
 * always undefined, the previous-position cleanup in `HexGrid.previewCreature`
 * never ran, and the materialize preview left a trail of glowing
 * `creature selected` hexes behind the cursor for multi-hex units.
 */
import { jest, describe, expect, test } from '@jest/globals';

jest.mock('phaser', () =>
	(
		jest.requireActual('../../../test/phaser-mock') as typeof import('../../../test/phaser-mock')
	).createPhaserMock(),
);

import { wrapGameObject } from '../../engine/Phaser4Handles';

/** Minimal stand-in for a Phaser 4 `Sprite`. */
function makeGameObjectStub() {
	return {
		active: true,
		visible: true,
		alpha: 1,
		renderFlags: 15,
		x: 0,
		y: 0,
		originX: 0.5,
		originY: 0.5,
		scaleX: 1,
		scaleY: 1,
		width: 40,
		height: 60,
		texture: { key: 'cardboard', source: ['src'] },
		frame: { width: 40, height: 60 },
		input: null,
		parentContainer: null,
		parentList: null,
		scene: { sys: { textures: { getFrame: () => ({}) } } },
		on: () => undefined,
		setOrigin(x: number, y: number) {
			this.originX = x;
			this.originY = y;
		},
		setScale(x: number, y: number) {
			this.scaleX = x;
			this.scaleY = y;
		},
		setPosition(x: number, y: number) {
			this.x = x;
			this.y = y;
		},
		setTexture(key: string) {
			this.texture = { key, source: ['src'] };
		},
		setActive(value: boolean) {
			this.active = value;
		},
		setVisible(value: boolean) {
			this.visible = value;
		},
		setInteractive() {
			this.input = {};
		},
		disableInteractive() {
			this.input = null;
		},
	};
}

describe('Phaser 4 sprite handle custom properties', () => {
	test('reads back values stashed on the handle', () => {
		const handle = wrapGameObject(makeGameObjectStub() as never) as unknown as Record<
			string,
			unknown
		>;

		handle._previewPos = { x: 4, y: 7 };
		handle._previewSize = 3;
		handle.posy = 7;

		expect(handle._previewPos).toEqual({ x: 4, y: 7 });
		expect(handle._previewSize).toBe(3);
		expect(handle.posy).toBe(7);
	});

	test('re-stashing overwrites the previous value', () => {
		const handle = wrapGameObject(makeGameObjectStub() as never) as unknown as Record<
			string,
			unknown
		>;

		handle._previewPos = { x: 1, y: 1 };
		handle._previewPos = { x: 2, y: 1 };

		expect(handle._previewPos).toEqual({ x: 2, y: 1 });
	});

	test('clearing to undefined reads back as undefined', () => {
		const handle = wrapGameObject(makeGameObjectStub() as never) as unknown as Record<
			string,
			unknown
		>;

		handle._previewPos = { x: 4, y: 7 };
		handle._previewPos = undefined;

		expect(handle._previewPos).toBeUndefined();
	});

	test('in operator still reports stashed keys', () => {
		const handle = wrapGameObject(makeGameObjectStub() as never) as unknown as Record<
			string,
			unknown
		>;

		handle.posy = 2;

		expect('_previewPos' in handle).toBe(false);
		expect('posy' in handle).toBe(true);
	});

	test('native Phaser 4 properties still land on the real game object', () => {
		const go = makeGameObjectStub();
		const handle = wrapGameObject(go as never) as unknown as Record<string, unknown>;

		// `depth` exists on a real Phaser 4 GameObject, so it must not be
		// swallowed by the handle-local map.
		(go as unknown as Record<string, unknown>).depth = 1;
		handle.depth = 7;

		expect((go as unknown as Record<string, unknown>).depth).toBe(7);
		expect(handle.depth).toBe(7);
	});

	test('facade accessors still win over stashed values', () => {
		const go = makeGameObjectStub();
		const handle = wrapGameObject(go as never) as unknown as Record<string, unknown>;

		handle.alpha = 0.25;
		expect(handle.alpha).toBe(0.25);
		expect(go.alpha).toBe(0.25);
	});
});
