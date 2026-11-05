/**
 * Regression cover for the child count on a group (Phaser 4 `Container`)
 * handle.
 *
 * `CreatureSprite.hint` stacks its hints above the unit's cardboard with
 * `group.total - group.getIndex(hint) - 1`. Phaser 2's `Group` had `total`;
 * Phaser 4's `Container` does not, and an unhandled read falls through the
 * forwarding proxy to `undefined` rather than throwing. Arithmetic on that
 * yields `NaN`, so every hint — the text plus its frame and icon — was handed
 * a `NaN` y, which Phaser cannot place and silently draws nothing. The whole
 * hint group vanished, with no error anywhere.
 *
 * The gap survived the migration because every fake group AB tests against
 * (`test/phaser-mock`, `src/__tests__/creaturesprite.ts`) defines
 * `total` itself, so the suites exercise a shape the real facade never had.
 * This pins the real facade instead.
 */
import { jest, describe, expect, test } from '@jest/globals';

jest.mock('phaser', () =>
	(
		jest.requireActual('../../../test/phaser-mock') as typeof import('../../../test/phaser-mock')
	).createPhaserMock(),
);

import { wrapGroup } from '../../engine/Phaser4Handles';

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
		// Phaser 4 spells it exactly as Phaser 2 did; the facade forwards it.
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

describe('Phaser 4 group handle total', () => {
	test('counts its children', () => {
		const container = makeContainerStub();
		const group = wrapGroup(container as never) as unknown as Group;

		expect(group.total).toBe(0);

		const children = [{ name: 'text' }, { name: 'frame' }, { name: 'icon' }];
		children.forEach((child) => container.add(child));

		expect(group.total).toBe(3);
		// Phaser 2 kept `length` and `total` in step for a plain group.
		expect(group.total).toBe(group.length);
		expect(group.total).toBe(group.children.length);
	});

	test('tracks removals so the count never overstates the group', () => {
		const container = makeContainerStub();
		const group = wrapGroup(container as never) as unknown as Group;

		const text = { name: 'text' };
		const frame = { name: 'frame' };
		group.add(text);
		group.add(frame);
		expect(group.total).toBe(2);

		group.remove(text);
		expect(group.total).toBe(1);
		expect(group.total).toBe(group.getIndex(frame) + 1);
	});

	test('yields finite hint stack offsets', () => {
		const container = makeContainerStub();
		const group = wrapGroup(container as never) as unknown as Group;

		const hints = [{ name: 'text' }, { name: 'frame' }, { name: 'icon' }];
		hints.forEach((child) => group.add(child));

		// The expression `CreatureSprite.hint` uses to stack its hints, oldest
		// highest. Every offset must be a real number: a NaN here is what made
		// the whole hint group unrenderable. Compared as a string because the
		// topmost offset is `-0`, which `toBe(0)` rejects.
		const offsets = group.children.map((hint: unknown) => {
			const index = group.total - group.getIndex(hint) - 1;
			const offset = -50 * index;
			expect(Number.isFinite(offset)).toBe(true);
			return String(offset);
		});

		expect(offsets).toEqual(['-100', '-50', '0']);
	});
});
