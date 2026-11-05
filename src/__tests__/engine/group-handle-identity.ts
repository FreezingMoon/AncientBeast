/**
 * Regression cover for handle identity across a group's `each`.
 *
 * `wrapGameObject` memoises exactly one proxy per Phaser game object, so every
 * visit to the same child yields the identical handle. Gameplay depends on
 * that: `CreatureSprite` keys its hint state in a `WeakMap` by the handle it
 * received when the hint was created, and its clear/fade callbacks look
 * themselves up again through `peekHintState`.
 *
 * The group handle is a forwarding proxy, so a member the facade does not
 * define falls straight through to the underlying Phaser 4 `Container`.
 * Phaser 4's native `each` hands back the *raw* game object, not the stable
 * handle. Every `peekHintState` then missed, each callback returned on its
 * first guard line, and `clearHints` became a silent no-op — verified live:
 * after `clearHints`, all six hint elements were still `active: true` at
 * `alpha: 1`.
 *
 * The existing fake groups did not catch this because they hand back the very
 * object they were given, which is the raw shape and therefore already
 * "identity stable". The doubles agreed with each other and disagreed with the
 * real facade, which is the gap this file closes.
 */
import { jest, describe, expect, test } from '@jest/globals';

jest.mock('phaser', () =>
	(
		jest.requireActual('../../../test/phaser-mock') as typeof import('../../../test/phaser-mock')
	).createPhaserMock(),
);

import { wrapGroup, wrapGameObject } from '../../engine/Phaser4Handles';

/** Minimal stand-in for a Phaser 4 `Container`. */
function makeContainerStub() {
	return {
		active: true,
		visible: true,
		alpha: 1,
		x: 0,
		y: 0,
		originX: 0.5,
		originY: 0.5,
		scaleX: 1,
		scaleY: 1,
		list: [] as unknown[],
		parentContainer: null as unknown,
		add(child: unknown) {
			this.list.push(child);
			(child as { parentContainer: unknown }).parentContainer = this;
			return this;
		},
		remove(child: unknown, _destroyChild?: boolean) {
			const index = this.list.indexOf(child);
			if (index !== -1) this.list.splice(index, 1);
			return this;
		},
		// Phaser 4 passes the raw child here. The facade must not let this
		// reach gameplay; that is the whole point of the test.
		each(callback: (child: unknown) => void) {
			[...this.list].forEach((child) => callback(child));
		},
		getIndex(child: unknown) {
			return this.list.indexOf(child);
		},
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
		setActive(value: boolean) {
			this.active = value;
		},
	};
}

type Group = Record<string, any>;

describe('Phaser 4 group handle identity', () => {
	test('each hands back the same handle every visit', () => {
		const container = makeContainerStub();
		const group = wrapGroup(container as never) as unknown as Group;

		const raw = { name: 'hint' };
		group.add(raw);

		const first: unknown[] = [];
		const second: unknown[] = [];
		group.each((child: unknown) => first.push(child));
		group.each((child: unknown) => second.push(child));

		expect(first).toHaveLength(1);
		expect(second).toHaveLength(1);
		// Identity, not just equality: the WeakMap lookup needs the same key.
		expect(Object.is(first[0], second[0])).toBe(true);
	});

	test('a WeakMap keyed by the created handle is reachable from each', () => {
		const container = makeContainerStub();
		const group = wrapGroup(container as never) as unknown as Group;

		// Gameplay registers state against the handle it was handed at creation,
		// then finds it again inside `each`. This mirrors `CreatureSprite`.
		const raw = { name: 'hint' };
		const created = wrapGameObject(raw as never);
		const states = new WeakMap<object, { cleared: boolean }>();
		states.set(created as object, { cleared: false });

		group.add(raw);

		group.each((child: unknown) => {
			const state = states.get(child as object);
			if (state) state.cleared = true;
		});

		// The state object is reachable and mutable through the yielded handle.
		expect(states.get(created as object)?.cleared).toBe(true);
	});
	test('forEach keeps the same identity guarantee as each', () => {
		const container = makeContainerStub();
		const group = wrapGroup(container as never) as unknown as Group;

		group.add({ name: 'a' });
		group.add({ name: 'b' });

		const viaEach: unknown[] = [];
		const viaForEach: unknown[] = [];
		group.each((child: unknown) => viaEach.push(child));
		group.forEach((child: unknown) => viaForEach.push(child));

		expect(viaForEach).toEqual(viaEach);
		viaEach.forEach((child, i) => {
			expect(Object.is(child, viaForEach[i])).toBe(true);
		});
	});
});
