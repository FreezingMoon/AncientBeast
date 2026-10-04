/**
 * Regression cover for the parent lookup on a group (Phaser 4 `Container`)
 * handle.
 *
 * Phaser 2 game objects reported their parent as `parent`, and gameplay code
 * tears groups down through it — `CreatureSprite.destroy()` runs
 * `this._group.parent?.remove(this._group, true)`, which is how the
 * unmaterialized placeholder creature created for the Dark Priest's summon
 * gets detached when the real unit takes its id. Phaser 2 spelled the detach
 * `removeChild`; Phaser 4's `Container` has no such member, so the call site
 * now uses `remove`, the same method the destroy comment already described.
 *
 * Phaser 4 renamed the property to `parentContainer`, and the group facade had
 * no accessor for it, so the lookup fell through to the raw object, where a
 * `Container` has no `parent` at all: it read `undefined`, the optional chain
 * swallowed the call, and every teardown silently left its group in the
 * creature layer.
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
		// Phaser 4 spelling; `parent` deliberately absent, as on a real Container.
		parentContainer: null as unknown,
		add(child: unknown) {
			this.list.push(child);
			(child as { parentContainer: unknown }).parentContainer = this;
			return this;
		},
		remove(child: unknown, _destroyChild?: boolean) {
			const index = this.list.indexOf(child);
			if (index !== -1) this.list.splice(index, 1);
			(child as { parentContainer: unknown }).parentContainer = null;
			return this;
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

describe('Phaser 4 group handle parent', () => {
	test('reports the containing group as a handle', () => {
		const parentContainer = makeContainerStub();
		const childContainer = makeContainerStub();
		const parentGroup = wrapGroup(parentContainer as never) as unknown as Record<string, unknown>;
		const childGroup = wrapGroup(childContainer as never) as unknown as Record<string, unknown>;

		childContainer.parentContainer = parentContainer;

		// Same facade instance, so identity comparisons against a group's own
		// members (`sprite.parent === grid.creatureGroup`) keep working.
		expect(childGroup.parent).toBe(parentGroup);
	});

	test('tears the group out of its parent', () => {
		const parentContainer = makeContainerStub();
		const childContainer = makeContainerStub();
		const parentGroup = wrapGroup(parentContainer as never) as unknown as Record<string, unknown>;
		const childGroup = wrapGroup(childContainer as never) as unknown as Record<string, unknown>;
		parentContainer.list.push(childContainer);
		childContainer.parentContainer = parentContainer;

		(parentGroup.remove as (child: unknown) => void)(childGroup);

		expect(parentContainer.list).toEqual([]);
		expect(childGroup.parent).toBeNull();
	});

	test('is null for a group with no parent', () => {
		const group = wrapGroup(makeContainerStub() as never) as unknown as Record<string, unknown>;
		expect(group.parent).toBeNull();
	});
});
