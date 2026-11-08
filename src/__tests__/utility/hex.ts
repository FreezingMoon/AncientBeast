jest.mock('phaser', () =>
	(
		jest.requireActual('../../../test/phaser-mock') as typeof import('../../../test/phaser-mock')
	).createPhaserMock(),
);

import { describe, test, expect, jest } from '@jest/globals';
import { Hex, stopAllCursorSpinning } from '../../utility/hex';
import { HexGrid } from '../../utility/hexgrid';
import { Creature } from '../../creature';
import { configure } from '../../utility/pointfacade';
import { createSpriteMock } from '../../../test/sprite-mock';

/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */

/** Populate the shared PointFacade, which is how `hex.creature` is resolved. */
function withOccupant(creature: any) {
	configure({
		getCreatures: () => (creature ? [creature] : []),
		getCreaturePassablePoints: () => [],
		getCreatureBlockedPoints: (c: any) => c.hexagons ?? [],
		getTraps: () => [],
		getTrapPassablePoints: () => [],
		getTrapBlockedPoints: () => [],
		getDrops: () => [],
		getDropPassablePoints: () => [],
		getDropBlockedPoints: () => [],
	});
}

function makeGrid() {
	return {
		displayHexesGroup: { bringToTop: () => {}, sendToBack: () => {} },
		overlayHexesGroup: { bringToTop: () => {}, sendToBack: () => {} },
	};
}

function renderedSpan(sprite: { x: number; displayOriginX: number; scaleX: number }) {
	const left = sprite.x - sprite.displayOriginX * sprite.scaleX;
	return {
		left,
		right: left + 100 * sprite.scaleX,
		center: left + 50 * sprite.scaleX,
		scaleX: sprite.scaleX,
	};
}

function makeGame() {
	const game = {
		engine: {
			add: {
				sprite: (x: number, y: number, key: string) =>
					createSpriteMock({ x, y, key, width: 100, height: 100 }),
			},
		},
	} as any;
	(game as any).gameEngine = game.engine;
	return game;
}

describe('shrunken hex centering', () => {
	test('a shrunken hex stays centered on hover-off', () => {
		const grid = makeGrid() as any;
		const game = makeGame();

		const hex = new Hex(5, 4, grid as any, game as any);
		const hitCenter = hex.hitBox.x + 50;

		// Simulate a shrunken query state.
		hex.displayClasses = 'shrunken';
		(hex as any).updateStyle();

		const shrunken = renderedSpan(
			hex.display as unknown as { x: number; displayOriginX: number; scaleX: number },
		);
		expect(shrunken.center).toBeCloseTo(hitCenter, 5);
		expect(shrunken.scaleX).toBe(0.5);

		// Hover-off strips every display class, including `shrunken`.
		hex.cleanDisplayVisualState();
		(hex as any).updateStyle();

		const full = renderedSpan(
			hex.display as unknown as { x: number; displayOriginX: number; scaleX: number },
		);
		expect(full.center).toBeCloseTo(hitCenter, 5);
		expect(full.scaleX).toBe(1);

		// Re-adding the shrunken class must put the hex back at reduced, centered scale.
		hex.displayVisualState('shrunken');
		(hex as any).updateStyle();

		const restored = renderedSpan(
			hex.display as unknown as { x: number; displayOriginX: number; scaleX: number },
		);
		expect(restored.center).toBeCloseTo(hitCenter, 5);
		expect(restored.scaleX).toBe(0.5);
	});
});

describe('dashed outline vs player tint', () => {
	/** A dashed hex with an occupied unit must render as a dashed outline, not a solid player tile. */
	test('an empty hex in the dashed set keeps the plain dashed texture', () => {
		const grid = makeGrid() as any;
		const game = makeGame();
		withOccupant(undefined);
		const hex = new Hex(5, 4, grid as any, game as any);

		hex.displayClasses = 'dashed';
		(hex as any).updateStyle();
		expect(hex.display.key).toBe('hex_dashed');

		stopAllCursorSpinning();
	});

	test('a dashed hex carrying a player tint still renders the dashed texture', () => {
		const grid = makeGrid() as any;
		const game = makeGame();
		const occupant = Object.create(Creature.prototype) as any;
		occupant.team = 1;
		occupant.size = 1;
		occupant.dead = false;
		occupant.temp = false;
		occupant.hexagons = [{ x: 5, y: 4 }];
		withOccupant(occupant);

		const hex = new Hex(5, 4, grid as any, game as any);
		expect(hex.creature).toBe(occupant);

		// This is the class pair `onCreatureHover()` produces for an occupied
		// target: the query adds `dashed playerN`, then the hover fill adds
		// `creature playerN`. The player tint must not win over the dashed
		// outline, or the target reads as a solid tile instead of an outline.
		hex.displayClasses = 'dashed player1 creature';
		(hex as any).updateStyle();

		expect(hex.display.key).toBe('hex_dashed_p1');

		stopAllCursorSpinning();
	});

	test('the active creature tile still keeps its solid player tint', () => {
		const grid = makeGrid() as any;
		const game = makeGame();
		const occupant = Object.create(Creature.prototype) as any;
		occupant.team = 1;
		occupant.size = 1;
		occupant.dead = false;
		occupant.temp = false;
		occupant.hexagons = [{ x: 5, y: 4 }];
		withOccupant(occupant);

		const hex = new Hex(5, 4, grid as any, game as any);

		// Without `dashed` the player tint must win as before — this is the
		// resting appearance of every unit on the board.
		hex.displayClasses = 'creature player1';
		(hex as any).updateStyle();

		expect(hex.display.key).toBe('hex_p1');

		stopAllCursorSpinning();
	});
});

describe('crashing-globe-target overlay persistence', () => {
	test('target.png marking persists through generic overlay cleanup until globe lands', () => {
		const grid = makeGrid() as any;
		const game = makeGame();

		const hex = new Hex(5, 4, grid as any, game as any);

		// Simulate the Crashing Globe hover marking the hex as a target.
		hex.overlayVisualState('crashing-globe-target p0');
		(hex as any).updateStyle();
		expect(hex.display.key).toBe('target');
		expect(hex.overlay.key).toBe('hex');

		// Generic query teardown must NOT strip the marking — it must stay on the
		// confirmed hex until the globe actually lands there.
		hex.cleanOverlayVisualState();
		(hex as any).updateStyle();
		expect(hex.display.key).toBe('target');
		expect(hex.overlay.key).toBe('hex');

		// Only the explicit targeted cleanup (called when the globe lands) removes it.
		hex.cleanOverlayVisualState('crashing-globe-target p0');
		hex._markedByCrashingGlobe = false;
		(hex as any).updateStyle();
		expect(hex.overlay.key).toBe('input');
		expect(hex.display.key).toBe('hex');
		stopAllCursorSpinning();
	});

	test('shows the input cursor on hovered targets before and after confirmation', () => {
		const requestFrames: Array<(timestamp: number) => void> = [];
		const requestFrame = jest
			.spyOn(globalThis, 'requestAnimationFrame')
			.mockImplementation((callback) => {
				requestFrames.push(callback);
				return requestFrames.length;
			});
		const cancelFrame = jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
		const overlayBringToTop = jest.fn();
		const grid = {
			...makeGrid(),
			overlayHexesGroup: { bringToTop: overlayBringToTop, sendToBack: () => {} },
		} as any;
		const game = makeGame();
		const hex = new Hex(5, 4, grid as any, game as any);
		hex.overlayVisualState('creature player0');
		hex.overlayVisualState('crashing-globe-target p0');

		expect(hex.display.key).toBe('target');
		expect(hex.display.alpha).toBe(1);
		expect(hex.display.originX).toBe(0.5);
		expect(hex.display.originY).toBe(0.5);
		expect(hex.display.x).toBe(hex.hitBox.x + hex.hitBox.width / 2);
		expect(hex.display.y).toBe(hex.hitBox.y + hex.hitBox.height / 2);
		expect(hex.overlay.key).toBe('hex');
		expect(hex.overlay.alpha).toBe(0);
		expect(hex.overlay.visible).toBe(false);
		requestFrames.shift()?.(0);
		expect(hex.display.angle).toBe(2);

		hex.overlayVisualState('hover');
		expect(hex.display.key).toBe('target');
		expect(hex.display.alpha).toBe(1);
		expect(hex.overlay.key).toBe('input');
		expect(hex.overlay.alpha).toBe(1);
		expect(hex.overlay.visible).toBe(true);
		expect(overlayBringToTop).toHaveBeenCalledWith(hex.overlay);
		expect(hex.isSpinning).toBe(true);
		requestFrames.shift()?.(16);
		expect(hex.display.angle).toBe(4);
		expect(hex.overlay.angle).toBe(2);

		hex._markedByCrashingGlobe = true;
		HexGrid.prototype.cleanHex.call({ game: { activeCreature: undefined } } as any, hex);
		expect(hex.display.key).toBe('target');
		expect(hex.display.angle).toBe(4);
		expect(hex.overlay.key).toBe('hex');
		expect(hex.overlay.alpha).toBe(0);
		expect(hex.overlay.visible).toBe(false);
		expect(hex.isSpinning).toBe(true);
		expect(hex.overlayClasses).not.toMatch(/\bhover\b|\bh_player[0-3]\b/);

		// Hovering the confirmed target shows the cursor above target.png.
		hex.overlayVisualState('hover');
		expect(hex.display.key).toBe('target');
		expect(hex.overlay.key).toBe('input');
		expect(hex.overlay.alpha).toBe(1);
		expect(hex.overlay.visible).toBe(true);

		hex.cleanOverlayVisualState('hover');
		expect(hex.display.key).toBe('target');
		expect(hex.overlay.key).toBe('hex');
		expect(hex.overlay.alpha).toBe(0);
		expect(hex.overlay.visible).toBe(false);
		expect(hex.isSpinning).toBe(true);

		stopAllCursorSpinning();
		requestFrame.mockRestore();
		cancelFrame.mockRestore();
	});
});
