/**
 * Regression cover for list positions on a group (Phaser 4 `Container`) handle.
 *
 * Phaser 2 spelled a child's position in its group `getChildIndex`, and the
 * facade answered that with the child's `depth`. Those are different axes in
 * this engine: `HexGrid.orderCreatureZ` assigns every creature
 * `getDepthAtBand(y, 'UNITS', slot)`, so `depth` encodes the creature's *grid
 * row*, not its stack order. Live probes of a two-unit board returned
 * `getChildIndex` 440 and 441 against a true list order of 0 and 1.
 *
 * Both real callers wanted a list index, so both were wrong:
 *
 *  - `utility/hex.ts` gates xraying on `candZ > refZ` ("only reveal creatures
 *    drawn in front of the reference"). Against band depths this compared grid
 *    rows, so overlapping creatures on the wrong side of the reference were
 *    never revealed.
 *  - `animations.ts` feeds the result straight into `addAt` for Infernal's
 *    haze and heat layers. A depth of 440 against a three-child group clamped
 *    the haze layer to the end and asked `addAt` to insert at 440.
 *
 * `getIndex` is the honest spelling and returns -1 for a non-member, which the
 * call sites test for. The old name also threw for non-members, but only
 * reachable when the child's parent was falsy; a facade child was always
 * parented, so those fallbacks were dead.
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
		addAt(child: unknown, index: number) {
			const clamped = Math.max(0, Math.min(index, this.list.length));
			this.list.splice(clamped, 0, child);
			(child as { parentContainer: unknown }).parentContainer = this;
			return this;
		},
		remove(child: unknown, _destroyChild?: boolean) {
			const index = this.list.indexOf(child);
			if (index !== -1) this.list.splice(index, 1);
			return this;
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

/** A creature whose depth encodes its grid row, as `orderCreatureZ` sets it. */
function makeCreature(bandDepth: number) {
	return { depth: bandDepth, parentContainer: null as unknown };
}

describe('Phaser 4 group handle index', () => {
	test('returns the list position, not the depth band', () => {
		const container = makeContainerStub();
		const group = wrapGroup(container as never) as unknown as Group;

		const first = makeCreature(440);
		const second = makeCreature(441);
		group.add(first);
		group.add(second);

		// The depths are three orders of magnitude past the list length; the
		// handle must still answer with positions usable as `addAt` arguments.
		expect(group.getIndex(first)).toBe(0);
		expect(group.getIndex(second)).toBe(1);
	});

	test('orders creatures by stack position when rows differ', () => {
		const container = makeContainerStub();
		const group = wrapGroup(container as never) as unknown as Group;

		// A later row has a *lower* band depth than an earlier one, so a depth
		// comparison would invert the stack order the xray gate depends on.
		const back = makeCreature(410);
		const front = makeCreature(440);
		group.add(back);
		group.add(front);

		const isInFront = (candidate: unknown, reference: unknown) =>
			group.getIndex(candidate) > group.getIndex(reference);

		expect(isInFront(front, back)).toBe(true);
		expect(isInFront(back, front)).toBe(false);
	});

	test('reports -1 for a non-member rather than throwing', () => {
		const container = makeContainerStub();
		const group = wrapGroup(container as never) as unknown as Group;

		const member = makeCreature(440);
		const outsider = makeCreature(440);
		group.add(member);

		expect(group.getIndex(member)).toBe(0);
		expect(group.getIndex(outsider)).toBe(-1);
	});

	test('yields addAt arguments inside the child list', () => {
		const container = makeContainerStub();
		const group = wrapGroup(container as never) as unknown as Group;

		const sprite = makeCreature(440);
		const sibling = makeCreature(441);
		group.add(sprite);
		group.add(sibling);

		// The exact expression `animations.ts` uses to sit Infernal's haze and
		// heat layers against the silhouette.
		const spriteIndex = group.getIndex(sprite);
		const hazeIndex = Math.min(group.total - 1, spriteIndex + 1);
		expect(hazeIndex).toBe(1);
		expect(hazeIndex).toBeGreaterThanOrEqual(0);
		expect(hazeIndex).toBeLessThan(group.total);
	});

	test('no longer exposes the depth-returning getChildIndex', () => {
		const container = makeContainerStub();
		const group = wrapGroup(container as never) as unknown as Group;

		group.add(makeCreature(440));
		expect(group.getChildIndex).toBeUndefined();
		expect(group.setChildIndex).toBeUndefined();
	});
});