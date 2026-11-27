/**
 * Regression cover for the targeting cursor's rotation leaking onto hexes that
 * stop being the cursor.
 *
 * The spin angle lives on `overlay.angle`, and the overlay is a single reused
 * sprite per hex. `stopSpinning()` deliberately stopped unwinding that angle,
 * because `updateStyle()` runs several times per hover step and resetting on
 * every call rewound the visible cursor mid-sweep. But nothing else ever reset
 * it, so the accumulated angle stayed on the sprite permanently: the hex that
 * had been the cursor later rendered `hex_path` as a possible target, already
 * turned by whatever angle the cursor stopped at.
 *
 * `updateStyle()` now unwinds the angle on the transition into the non-cursor
 * branch, which is reached only when the hex stops being the on-screen cursor —
 * so the sweep still reads as a turning cursor.
 */
import { describe, expect, test, beforeEach, afterEach } from '@jest/globals';
import { jest } from '@jest/globals';

jest.mock('phaser', () =>
	(
		jest.requireActual('../../../test/phaser-mock') as typeof import('../../../test/phaser-mock')
	).createPhaserMock(),
);

import { Hex, stopAllCursorSpinning } from '../../utility/hex';
import { HexGrid } from '../../utility/hexgrid';
import { createSpriteMock } from '../../../test/sprite-mock';

/**
 * A stand-in `Hex` exposing only what `updateStyle()` reads.
 *
 * `updateStyle()` reads the display/overlay classes, the alpha override fields
 * and the two sprite handles, so constructing the real class would drag in the
 * whole Phaser board setup for no extra coverage. The overlay sprite is
 * deliberately shared across calls, exactly as it is in a real match: the whole
 * point is that one sprite is re-textured and re-angled in place.
 */
function createHexStandIn() {
	const display = createSpriteMock({ key: 'hex' });
	const overlay = createSpriteMock({ key: 'input' });
	const addedSprites: ReturnType<typeof createSpriteMock>[] = [];
	// The mirror needs the above-creatures layer; the stand-in creature is
	// always undefined, so it stays hidden — only its parent must exist.
	const grid = {
		displayHexesGroup: { bringToTop: jest.fn(), sendToBack: jest.fn() },
		overlayHexesGroup: { bringToTop: jest.fn(), sendToBack: jest.fn() },
		trapOverGroup: { bringToTop: jest.fn() },
		selectedHex: undefined as unknown,
	};
	// `drawPoint` and `pinTopLeft` are private; they are reached here because
	// `updateStyle()` calls them and this stand-in is its receiver.
	const proto = Hex.prototype as unknown as {
		get drawPoint(): { x: number; y: number };
		pinTopLeft(sprite: unknown, x: number, y: number): void;
		syncDashedOverSprite(this: Hex): void;
	};
	const readDrawPoint = Object.getOwnPropertyDescriptor(proto, 'drawPoint')?.get;
	if (!readDrawPoint) {
		throw new Error('Hex.prototype.drawPoint is no longer a getter');
	}
	const hex = {
		reachable: false,
		displayClasses: '',
		overlayClasses: '',
		forcedDisplayAlpha: undefined,
		forcedCreatureOverlayAlpha: undefined,
		forcedHidden: false,
		isSpinning: false,
		creature: undefined,
		trap: undefined,
		drop: undefined,
		coordText: undefined,
		game: {
			gameEngine: {
				add: {
					text: jest.fn(),
					sprite: jest.fn(() => {
						const sprite = createSpriteMock({ key: 'input' });
						addedSprites.push(sprite);
						return sprite;
					}),
				},
			},
		},
		grid,
		originalDisplayPos: { x: 0, y: 0 },
		hitBox: createSpriteMock({ x: 0, y: 0 }),
		display,
		overlay,
		get drawPoint(): { x: number; y: number } {
			return readDrawPoint.call(hex);
		},
		startSpinning: Hex.prototype.startSpinning,
		stopSpinning: Hex.prototype.stopSpinning,
		syncDashedOverSprite: proto.syncDashedOverSprite,
		pinTopLeft: (sprite: unknown, x: number, y: number) => proto.pinTopLeft.call(hex, sprite, x, y),
	};
	const style = (overlayClasses: string) => {
		hex.overlayClasses = overlayClasses;
		Hex.prototype.updateStyle.call(hex as unknown as Hex);
	};
	return { hex, style, display, overlay, grid, addedSprites };
}

describe('Hex targeting cursor rotation', () => {
	beforeEach(() => {
		stopAllCursorSpinning();
	});
	afterEach(stopAllCursorSpinning);

	test('stops spinning and unwinds the angle once the hex becomes a possible target', () => {
		const { style, overlay } = createHexStandIn();

		// The hex is the cursor: plain `hover`, so it resolves to the `input`
		// texture and turns.
		style(' hover ');
		expect(overlay.key).toBe('input');
		expect(overlay.alpha).toBe(1);

		// Accumulate rotation, then re-style as a possible target. Same sprite.
		overlay.angle = 146;
		style(' reachable h_player0 ');

		expect(overlay.key).toBe('hex_path');
		expect(overlay.angle).toBe(0);
	});

	test('keeps the angle while the hex is still the cursor', () => {
		const { style, overlay } = createHexStandIn();
		style(' hover ');
		overlay.angle = 92;

		// `updateStyle()` runs several times per hover step. Re-styling the same
		// cursor hex must not rewind it, or the sweep reads as a snap-back.
		style(' hover ');

		expect(overlay.key).toBe('input');
		expect(overlay.angle).toBe(92);
	});

	test('unwinds when the cursor hex goes transparent', () => {
		const { style, overlay } = createHexStandIn();
		style(' hover ');
		overlay.angle = 30;

		// `hover` cleared: the cursor is off screen but the sprite keeps the
		// `input` texture, so the angle has to be reset here too.
		style('');

		expect(overlay.angle).toBe(0);
	});
});

describe('Hover cursor over occupied overlays', () => {
	beforeEach(() => {
		stopAllCursorSpinning();
	});
	afterEach(stopAllCursorSpinning);

	test('draws the shared cursor over an ability-area outline on the hovered hex', () => {
		const { hex, style, overlay, grid, addedSprites } = createHexStandIn();
		grid.selectedHex = hex;

		style(' hover h_player0 ');

		expect(overlay.key).toBe('hex_hover_p0');
		expect(addedSprites).toHaveLength(1);
		expect(addedSprites[0].key).toBe('input');
		expect(addedSprites[0].visible).toBe(true);
		expect(hex.isSpinning).toBe(true);
		// The area outline itself must not accumulate the cursor's rotation.
		expect(overlay.angle).toBe(0);
	});

	test('keeps the glowing player hex under the cursor when hovering a unit', () => {
		const { hex, style, overlay, grid, addedSprites } = createHexStandIn();
		grid.selectedHex = hex;
		overlay.alpha = 0.42;

		style(' active reachable hover player0 h_player0 ');

		expect(overlay.key).toBe('hex_p0');
		expect(overlay.alpha).toBe(0.42);
		expect(addedSprites).toHaveLength(1);
		expect(addedSprites[0].key).toBe('input');
		expect(addedSprites[0].visible).toBe(true);
		expect(grid.overlayHexesGroup.bringToTop).toHaveBeenLastCalledWith(addedSprites[0]);
	});

	test('does not add a cursor over the movement confirmation hexagon', () => {
		const { hex, style, grid, addedSprites } = createHexStandIn();
		grid.selectedHex = hex;

		style(' creature moveto selected player1 ');

		expect(addedSprites).toHaveLength(0);
		expect(hex.isSpinning).toBe(false);
	});

	function createQueryGrid() {
		const first = createHexStandIn();
		const second = createHexStandIn();
		const grid = Object.setPrototypeOf(first.grid, HexGrid.prototype) as unknown as HexGrid;
		const hexes = [first, second].map(({ hex }, x) => {
			Object.setPrototypeOf(hex, Hex.prototype);
			Object.assign(hex, { x, y: 0, pos: { x, y: 0 }, grid });
			return hex as unknown as Hex;
		});
		Object.assign(first.hex.game, {
			activeCreature: {
				id: 0,
				team: 0,
				hexagons: [],
				faceHex: jest.fn(),
			},
			UI: {
				xrayQueue: jest.fn(),
				chat: { hideExpanded: jest.fn() },
			},
		});
		Object.assign(grid, {
			game: first.hex.game,
			hexes: [hexes],
			selectedHex: hexes[0],
			queryGeneration: 0,
			xray: jest.fn(),
			refreshHoverState: jest.fn(),
		});
		return { grid, hexes, first, second };
	}

	describe('Ability cursor through query hover handlers', () => {
		afterEach(() => {
			stopAllCursorSpinning();
			jest.restoreAllMocks();
		});

		test.each([true, false])(
			'marks only the input hex after area highlighting (targeting=%s)',
			(targeting) => {
				const { grid, hexes, first, second } = createQueryGrid();
				grid.queryChoice({
					choices: [hexes],
					requireCreature: false,
					targeting,
					fnOnSelect: (choice: Hex[]) => {
						choice.forEach((hex) => {
							hex.cleanOverlayVisualState();
							hex.displayVisualState('adj');
						});
					},
				});

				hexes[0].onSelectFn(hexes[0]);

				expect(first.display.key).toBe('hex_path');
				expect(first.overlay.key).toBe('input');
				expect(first.overlay.alpha).toBe(1);
				expect(first.hex.isSpinning).toBe(true);
				expect(second.overlay.alpha).toBe(0);

				grid.selectHexRight();

				expect(first.overlay.alpha).toBe(0);
				expect(second.display.key).toBe('hex_path');
				expect(second.overlay.key).toBe('input');
				expect(second.overlay.alpha).toBe(1);
				expect(second.hex.isSpinning).toBe(true);
				expect(grid.selectedHex).toBe(hexes[1]);

				grid.clearTransientHexHoverVisual(hexes[1]);
				expect(second.hex.overlayClasses).not.toMatch(/\bhover\b/);
				expect(second.hex.isSpinning).toBe(false);
			},
		);

		test('draws a cursor over a reachable path without replacing its highlight', () => {
			const { grid, hexes, first, second } = createQueryGrid();
			grid.queryChoice({ choices: [hexes], requireCreature: false });
			hexes[0].onSelectFn(hexes[0]);

			expect(first.display.key).toBe('hex_path');
			expect(first.overlay.key).toBe('hex_path');
			expect(first.addedSprites).toHaveLength(1);
			expect(first.addedSprites[0].visible).toBe(true);
			expect(first.hex.isSpinning).toBe(true);
			expect(second.hex.isSpinning).toBe(false);
		});

		test('rotates the cursor without rotating the highlighted path', () => {
			const frames: Array<(timestamp: number) => void> = [];
			jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
				frames.push(callback);
				return frames.length;
			});
			const { grid, hexes, first } = createQueryGrid();
			grid.queryChoice({ choices: [hexes], requireCreature: false });
			hexes[0].onSelectFn(hexes[0]);

			frames[0](0);
			expect(first.addedSprites[0].angle).toBe(2);
			expect(first.overlay.angle).toBe(0);
			expect(first.display.angle).toBe(0);

			hexes[0].updateStyle();
			frames[1](16);
			expect(first.addedSprites[0].angle).toBe(4);
		});

		test('keeps the cursor on the input hex when the confirmation anchor is offset', () => {
			const { grid, hexes, first, second } = createQueryGrid();
			const onSelect = jest.fn();
			hexes[1].isWalkable = jest.fn(() => true);
			grid.queryHexes({
				hexes,
				size: 2,
				flipped: true,
				fillHexOnHover: false,
				fnOnSelect: onSelect,
			});
			hexes[0].onSelectFn(hexes[0]);

			expect(onSelect).toHaveBeenCalledWith(hexes[1], {});
			expect(first.addedSprites[0].visible).toBe(true);
			expect(second.hex.overlayClasses).not.toMatch(/\bhover\b/);
		});

		test('does not repaint a cursor after the callback installs another query', () => {
			const { grid, hexes, first } = createQueryGrid();
			grid.queryHexes({
				hexes,
				fillHexOnHover: false,
				fnOnSelect: () => grid.queryHexes({ hexes: [] }),
			});
			hexes[0].onSelectFn(hexes[0]);

			expect(first.hex.overlayClasses).not.toMatch(/\bhover\b/);
			expect(first.addedSprites).toHaveLength(0);
		});

		test.each(['materialize_overlay', 'secondary_overlay'] as const)(
			'does not add a cursor when %s contains a cardboard preview',
			(slot) => {
				const { grid, hexes, first } = createQueryGrid();
				grid.queryHexes({
					hexes,
					fillHexOnHover: false,
					fnOnSelect: (hex: Hex) => {
						grid.cleanHex(hex);
						grid[slot] = { _previewPos: hex.pos, _previewSize: 1, alpha: 0.5 };
						hex.overlayVisualState('creature moveto selected player0');
					},
				});
				hexes[0].onSelectFn(hexes[0]);

				expect(first.overlay.key).toBe('hex_p0');
				expect(first.hex.overlayClasses).not.toMatch(/\bhover\b/);
				expect(first.addedSprites).toHaveLength(0);
				expect(first.hex.isSpinning).toBe(false);
			},
		);
	});

	test('hides the shared cursor once the hex stops being hovered', () => {
		const { hex, style, grid, addedSprites } = createHexStandIn();
		grid.selectedHex = hex;
		style(' hover h_player0 ');
		expect(addedSprites[0].visible).toBe(true);

		// The pointer moved on: hover cleaned off this hex.
		style('');

		expect(addedSprites[0].visible).toBe(false);
		expect(hex.isSpinning).toBe(false);
	});

	test('does not draw the shared cursor on area hexes the pointer is not over', () => {
		const { style, overlay, addedSprites } = createHexStandIn();
		// Same classes, but this hex is not the grid's selected hex.
		style(' hover h_player0 ');

		expect(overlay.key).toBe('hex_hover_p0');
		expect(addedSprites).toHaveLength(0);
	});

	test('does not double up when the hovered hex already shows the input cursor', () => {
		const { hex, style, overlay, grid, addedSprites } = createHexStandIn();
		grid.selectedHex = hex;

		// Plain `hover` resolves to the `input` texture on the hex's own overlay.
		style(' hover ');

		expect(overlay.key).toBe('input');
		expect(addedSprites).toHaveLength(0);
		expect(hex.isSpinning).toBe(true);
	});

	test('renders a non-spinning centered cursor over a filled outline for targeted unit hexes', () => {
		const { hex, style, display, overlay, grid, addedSprites } = createHexStandIn();
		grid.selectedHex = hex;
		hex.displayClasses = 'creature player1';
		overlay.originX = 0;
		overlay.originY = 0;
		overlay.angle = 72;

		style(' reachable targetCursor selected h_player1 hover ');

		expect(display.key).toBe('hex_p1');
		expect(overlay.key).toBe('input');
		expect(overlay.alpha).toBe(1);
		expect(overlay.originX).toBe(0.5);
		expect(overlay.originY).toBe(0.5);
		expect(overlay.x).toBe(hex.hitBox.x + hex.hitBox.width / 2);
		expect(overlay.y).toBe(hex.hitBox.y + hex.hitBox.height / 2);
		expect(overlay.angle).toBe(0);
		expect(hex.isSpinning).toBe(false);
		expect(addedSprites).toHaveLength(0);
	});

	test('keeps player filled outline on unaffected overflow hexes both idle and hovered', () => {
		const { hex, style, display, overlay } = createHexStandIn();
		hex.displayClasses = 'creature player2';

		// Idle: filled outline only, no cursor overlay
		style(' targetOverflow h_player2 ');
		expect(display.key).toBe('hex_p2');
		expect(display.alpha).toBe(1);
		expect(overlay.alpha).toBe(0);
		expect(hex.isSpinning).toBe(false);

		// Hovered: display stays filled outline (never replaced by hex_path), overlay gets hover outline
		style(' targetOverflow h_player2 hover ');
		expect(display.key).toBe('hex_p2');
		expect(overlay.key).toBe('hex_hover_p2');
		expect(overlay.alpha).toBe(1);
	});

	test('extends partial multi-hex unit choices, preserves outlines on hover/hover-off, and confirms via base hexes', () => {
		const { grid, hexes, first, second } = createQueryGrid();
		const third = createHexStandIn();
		Object.setPrototypeOf(third.hex, Hex.prototype);
		Object.assign(third.hex, { x: 2, y: 0, pos: { x: 2, y: 0 }, grid });
		hexes.push(third.hex as unknown as Hex);
		(grid.hexes[0] as unknown as Hex[]).push(third.hex as unknown as Hex);
		(grid.game.UI.chat as unknown as { showExpanded: jest.Mock }).showExpanded = jest.fn();
		const { Creature } = jest.requireActual('../../creature') as typeof import('../../creature');

		const multiUnit = Object.create(Creature.prototype);
		Object.assign(multiUnit, {
			id: 2,
			team: 1,
			hexagons: [hexes[0], hexes[1]],
			isDarkPriest: () => false,
			startBounce: jest.fn(),
			resetBounce: jest.fn(),
			ghostOverlap: jest.fn(),
			xray: jest.fn(),
		});
		const otherUnit = Object.create(Creature.prototype);
		Object.assign(otherUnit, {
			id: 3,
			team: 1,
			hexagons: [hexes[2]],
			isDarkPriest: () => false,
			startBounce: jest.fn(),
			resetBounce: jest.fn(),
			ghostOverlap: jest.fn(),
			xray: jest.fn(),
		});
		hexes[0].creature = multiUnit;
		hexes[1].creature = multiUnit;
		hexes[2].creature = otherUnit;
		(hexes[0] as unknown as { direction: number }).direction = 1;
		(hexes[2] as unknown as { direction: number }).direction = 2;

		const onConfirm = jest.fn();

		grid.queryChoice({
			choices: [[hexes[0]], [hexes[2]]],
			requireCreature: false,
			fnOnConfirm: onConfirm,
		});

		// Affected hex gets filled outline + non-spinning cursor overlay
		expect(first.display.key).toBe('hex_p1');
		expect(first.overlay.key).toBe('input');
		expect(first.hex.isSpinning).toBe(false);

		// Unaffected base hex gets filled outline without cursor overlay, and is reachable
		expect(second.display.key).toBe('hex_p1');
		expect(second.overlay.alpha).toBe(0);
		expect(second.hex.reachable).toBe(true);
		expect(second.hex.overlayClasses).not.toMatch(/\btargetCursor\b/);

		// Hovering the unaffected base hex highlights choice 0 while keeping otherUnit's outline intact
		grid.selectedHex = hexes[1];
		hexes[1].onSelectFn(hexes[1]);
		expect(first.display.key).toBe('hex_p1');
		expect(first.overlay.key).toBe('input');
		expect(first.hex.isSpinning).toBe(false);
		expect(second.display.key).toBe('hex_p1');
		expect(third.display.key).toBe('hex_p1');
		expect(third.overlay.key).toBe('input');

		// Hovering off restores both affected (cursor + outline) and overflow (outline only)
		grid.clearTransientCreatureHoverVisual(multiUnit);
		expect(first.display.key).toBe('hex_p1');
		expect(first.overlay.key).toBe('input');
		expect(first.hex.isSpinning).toBe(false);
		expect(second.display.key).toBe('hex_p1');
		expect(second.overlay.alpha).toBe(0);
		expect(second.hex.overlayClasses).not.toMatch(/\btargetCursor\b/);

		// Direct click on the unaffected base hex confirms choice 0 with anchor hex metadata
		hexes[1].onConfirmFn(hexes[1]);
		expect(onConfirm).toHaveBeenCalledWith(
			[hexes[0]],
			expect.objectContaining({ choiceIndex: 0, direction: 1, hex: hexes[0] }),
			expect.anything(),
		);
	});

	test('queryCreature preserves targetCursor and overflow outline through hover and hover-off', () => {
		const { grid, hexes, first, second } = createQueryGrid();
		(grid.game.UI.chat as unknown as { showExpanded: jest.Mock }).showExpanded = jest.fn();
		const { Creature } = jest.requireActual('../../creature') as typeof import('../../creature');

		const attacker = Object.create(Creature.prototype);
		Object.assign(attacker, { id: 1, team: 0, hexagons: [], faceHex: jest.fn(), xray: jest.fn() });
		const targetUnit = Object.create(Creature.prototype);
		Object.assign(targetUnit, {
			id: 2,
			team: 1,
			hexagons: [hexes[0], hexes[1]],
			isDarkPriest: () => false,
			startBounce: jest.fn(),
			resetBounce: jest.fn(),
			xray: jest.fn(),
		});
		(grid.game as unknown as { creatures: Record<number, unknown> }).creatures = {
			1: attacker,
			2: targetUnit,
		};
		grid.game.activeCreature = attacker;
		hexes[0].creature = targetUnit;
		hexes[1].creature = targetUnit;
		(hexes[0] as unknown as { ghostOverlap: jest.Mock }).ghostOverlap = jest.fn();
		(hexes[1] as unknown as { ghostOverlap: jest.Mock }).ghostOverlap = jest.fn();

		const onConfirm = jest.fn();
		grid.queryCreature({
			id: 1,
			hexes: [hexes[0]],
			fnOnConfirm: onConfirm,
		});

		// Initial state: affected hex has cursor + outline; overflow hex has outline only
		expect(first.display.key).toBe('hex_p1');
		expect(first.overlay.key).toBe('input');
		expect(first.hex.isSpinning).toBe(false);
		expect(second.display.key).toBe('hex_p1');
		expect(second.overlay.alpha).toBe(0);

		// Hover affected hex: cursor stays non-spinning and is never clobbered by fillHexOnHover/tracePosition
		grid.selectedHex = hexes[0];
		hexes[0].onSelectFn(hexes[0]);
		expect(first.display.key).toBe('hex_p1');
		expect(first.overlay.key).toBe('input');
		expect(first.hex.isSpinning).toBe(false);
		expect(second.display.key).toBe('hex_p1');

		// Hover off: restores affected cursor and overflow outline cleanly
		grid.clearTransientCreatureHoverVisual(targetUnit);
		expect(first.display.key).toBe('hex_p1');
		expect(first.overlay.key).toBe('input');
		expect(first.hex.isSpinning).toBe(false);
		expect(second.display.key).toBe('hex_p1');
		expect(second.overlay.alpha).toBe(0);

		// Clicking overflow hex still confirms the target creature
		hexes[1].onConfirmFn(hexes[1]);
		expect(onConfirm).toHaveBeenCalledWith(targetUnit, expect.anything(), expect.anything());
	});

	test('multi-choice overlap maps uncovered base hex to the nearest valid anchor and ignores invalid choices', () => {
		const { grid, hexes } = createQueryGrid();
		const third = createHexStandIn();
		Object.setPrototypeOf(third.hex, Hex.prototype);
		Object.assign(third.hex, { x: 2, y: 0, pos: { x: 2, y: 0 }, grid });
		hexes.push(third.hex as unknown as Hex);
		(grid.hexes[0] as unknown as Hex[]).push(third.hex as unknown as Hex);
		(grid.game.UI.chat as unknown as { showExpanded: jest.Mock }).showExpanded = jest.fn();
		const { Creature } = jest.requireActual('../../creature') as typeof import('../../creature');

		const attacker = Object.create(Creature.prototype);
		Object.assign(attacker, { id: 1, team: 0, hexagons: [], faceHex: jest.fn() });
		const bigTarget = Object.create(Creature.prototype);
		Object.assign(bigTarget, {
			id: 2,
			team: 1,
			hexagons: [hexes[0], hexes[1], hexes[2]],
			isDarkPriest: () => false,
			startBounce: jest.fn(),
			resetBounce: jest.fn(),
		});
		(grid.game as unknown as { creatures: Record<number, unknown> }).creatures = {
			1: attacker,
			2: bigTarget,
		};
		grid.game.activeCreature = attacker;
		hexes[0].creature = bigTarget;
		hexes[1].creature = bigTarget;
		hexes[2].creature = bigTarget;

		const onConfirm = jest.fn();
		// Choice 0 hits hex 0 (distance 2 from hex 2); Choice 1 hits hex 1 (distance 1 from hex 2).
		grid.queryChoice({
			id: 1,
			choices: [[hexes[0]], [hexes[1]]],
			requireCreature: true,
			fnOnConfirm: onConfirm,
		});

		// Clicking uncovered hex 2 selects Choice 1 (nearest anchor hex 1)
		hexes[2].onConfirmFn(hexes[2]);
		expect(onConfirm).toHaveBeenCalledWith(
			[hexes[1]],
			expect.objectContaining({ choiceIndex: 1, hex: hexes[1] }),
			expect.anything(),
		);
	});
});
