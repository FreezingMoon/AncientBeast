jest.mock('phaser', () =>
	(
		jest.requireActual('../../../test/phaser-mock') as typeof import('../../../test/phaser-mock')
	).createPhaserMock(),
);

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { Hex, stopAllCursorSpinning } from '../../utility/hex';
import { HexGrid } from '../../utility/hexgrid';
import { Creature } from '../../creature';
import { configure } from '../../utility/pointfacade';
import { createSpriteMock } from '../../../test/sprite-mock';

/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */

// `hex.creature` resolves through the shared PointFacade, which is empty by
// default. Each test declares its own occupant set so suites never leak
// creatures into each other no matter the run order.
beforeEach(() => {
	configure({
		getCreatures: () => [],
		getCreaturePassablePoints: () => [],
		getCreatureBlockedPoints: () => [],
		getTraps: () => [],
		getTrapPassablePoints: () => [],
		getTrapBlockedPoints: () => [],
		getDrops: () => [],
		getDropPassablePoints: () => [],
		getDropBlockedPoints: () => [],
	});
});

function withOccupant(creature: any) {
	configure({
		getCreatures: () => (creature ? [creature] : []),
		getCreaturePassablePoints: () => [],
		// Same points the live game registers: one per size step going left.
		getCreatureBlockedPoints: (c: any) =>
			Array.from({ length: c.size ?? 1 }, (_, i) => ({ x: c.x - i, y: c.y })),
		getTraps: () => [],
		getTrapPassablePoints: () => [],
		getTrapBlockedPoints: () => [],
		getDrops: () => [],
		getDropPassablePoints: () => [],
		getDropBlockedPoints: () => [],
	});
}

function makeGrid() {
	const trapOverList: { x?: number; y?: number; key?: string }[] = [];
	return {
		displayHexesGroup: { bringToTop: () => {}, sendToBack: () => {} },
		overlayHexesGroup: { bringToTop: () => {}, sendToBack: () => {} },
		trapOverGroup: {
			bringToTop: () => {},
			__unwrapped: { list: trapOverList },
		},
		creatureGroup: { __unwrapped: { list: [] as { depth: number }[] } },
		getDepthAtBand: jest.fn(
			(y: number, band: string) => y * 100 + (band === 'EFFECT_UNDER_UNITS' ? 20 : 80),
		),
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
		createdSprites: [] as { key: string; parent: any; sprite: any }[],
		engine: {
			add: {
				sprite: (x: number, y: number, key: string, _frame: unknown, parent: any) => {
					const sprite = createSpriteMock({ x, y, key, width: 100, height: 100 });
					parent?.__unwrapped?.list.push(sprite);
					game.createdSprites.push({ key, parent, sprite });
					return sprite;
				},
			},
		},
	} as any;
	(game as any).gameEngine = game.engine;
	return game;
}

describe('dead-space hex rendering', () => {
	test.each([0, 1, 2, 3])('keeps dead-space artwork over player %s highlighting', (team) => {
		const hex = new Hex(5, 4, makeGrid() as any, makeGame());
		(hex.hitBox as any).input = { enabled: true };
		hex.displayVisualState(`deadzone dashed creature player${team}`);
		hex.overlayVisualState(`reachable h_player${team}`);
		expect(hex.display.key).toBe('hex_deadzone');
		expect(hex.overlay.visible).toBe(false);

		hex.overlayVisualState(`hover h_player${team}`);
		expect(hex.display.key).toBe('hex_deadzone');
		expect(hex.overlay.visible).toBe(false);
		expect((hex.hitBox as any).input.enabled).toBe(true);

		HexGrid.prototype.cleanHex.call(
			{ game: {}, lastQueryOpt: { hexesDeadZone: [hex] } } as any,
			hex,
		);
		expect(hex.display.key).toBe('hex_deadzone');

		hex.cleanDisplayVisualState('deadzone');
		hex.overlayVisualState(`reachable h_player${team}`);
		expect(hex.display.key).not.toBe('hex_deadzone');
		expect(hex.overlay.visible).toBe(true);
		stopAllCursorSpinning();
	});
});

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
		occupant._brbState = null;
		occupant.x = 5;
		occupant.y = 4;
		occupant.hexagons = [];
		withOccupant(occupant);
		const hex = new Hex(5, 4, grid as any, game as any);
		expect(hex.creature).toBe(occupant);

		// Underline the call chain instead of PointFacade plumbing: the query
		// adds `dashed playerN`, then the hover fill adds `creature playerN`.
		// The player tint must not win over the dashed outline, or the target
		// reads as a solid tile instead of an outline.
		hex.displayClasses = 'dashed player1 creature';
		(hex as any).updateStyle();

		expect(hex.display.key).toBe('hex_dashed_p1');

		stopAllCursorSpinning();
	});

	test('the active creature tile still keeps its solid player tint', () => {
		const grid = makeGrid() as any;
		const game = makeGame();
		const hex = new Hex(5, 4, grid as any, game as any);

		// Without `dashed` the player tint must win as before — this is the
		// resting appearance of every unit on the board.
		hex.displayClasses = 'creature player1';
		(hex as any).updateStyle();

		expect(hex.display.key).toBe('hex_p1');

		stopAllCursorSpinning();
	});

	test('an occupied dashed hex mirrors the outline into the above-creatures layer', () => {
		const grid = makeGrid() as any;
		const game = makeGame();
		const occupant = Object.create(Creature.prototype) as any;
		occupant.team = 1;
		occupant.size = 1;
		occupant.dead = false;
		occupant.temp = false;
		occupant._brbState = null;
		occupant.x = 5;
		occupant.y = 4;
		occupant.hexagons = [];
		withOccupant(occupant);
		const hex = new Hex(5, 4, grid as any, game as any);

		hex.displayClasses = 'dashed player1 creature';
		(hex as any).updateStyle();

		// The outline the maintainer saw cut off by the unit: a sibling reorder
		// inside the hex layers cannot lift the tile over a creature, so the
		// same dashed art is mirrored into `trapOverGroup`, which draws after
		// the creatures — at the tile's own position and footprint.
		const over = hex.dashedOverSprite as any;
		expect(over).toBeDefined();
		expect(over.key).toBe('hex_dashed_p1');
		expect(over.visible).toBe(true);
		expect(over.x).toBe(hex.display.x);
		expect(over.y).toBe(hex.display.y);
		expect(over.scaleX).toBeCloseTo((hex.display as any).scaleX, 5);
		expect(over.scaleY).toBeCloseTo((hex.display as any).scaleY, 5);
		// The whole point: it lives in the layer added after the creatures, and
		// carries a band depth so `orderCreatureZ()` keeps it in front.
		const mirrored = (game as any).createdSprites.find((entry: any) => entry.sprite === over);
		expect(mirrored.parent).toBe(grid.trapOverGroup);
		expect(over.depth).toBe(grid.getDepthAtBand(4, 'TRAP_VOLUMETRIC'));

		stopAllCursorSpinning();
	});

	test('the above-creatures mirror hides when the outline no longer applies', () => {
		const grid = makeGrid() as any;
		const game = makeGame();
		const occupant = Object.create(Creature.prototype) as any;
		occupant.team = 1;
		occupant.size = 1;
		occupant.dead = false;
		occupant.temp = false;
		occupant._brbState = null;
		occupant.x = 5;
		occupant.y = 4;
		occupant.hexagons = [];
		withOccupant(occupant);
		const hex = new Hex(5, 4, grid as any, game as any);

		hex.displayClasses = 'dashed player1 creature';
		(hex as any).updateStyle();
		expect((hex.dashedOverSprite as any)?.visible).toBe(true);

		// The query moved on: with `dashed` gone the mirror must hide rather
		// than leave a stale outline floating over the unit.
		hex.displayClasses = 'creature player1';
		(hex as any).updateStyle();
		expect((hex.dashedOverSprite as any)?.visible).toBe(false);

		stopAllCursorSpinning();
	});

	test('an empty dashed hex creates no above-creatures mirror', () => {
		const grid = makeGrid() as any;
		const game = makeGame();
		const hex = new Hex(5, 4, grid as any, game as any);

		hex.displayClasses = 'dashed';
		(hex as any).updateStyle();

		// Nothing stands on the tile, so the tile's own dashed art is already
		// fully visible — no mirror sprite should even be allocated.
		expect(hex.dashedOverSprite).toBeUndefined();

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

describe('Swampler Natural Habitat marker', () => {
	test('renders the native-size swamp sprite at the claimed hex and keeps it visible on hover', () => {
		const grid = makeGrid() as any;
		const game = makeGame();
		const unitOnHomeHex = { depth: 440 };
		grid.creatureGroup.__unwrapped.list.push(unitOnHomeHex);
		const hex = new Hex(5, 4, grid as any, game as any);

		hex.unsetReachable();
		hex._swamplerHomeOwner = 5;
		hex.updateStyle();

		expect(hex.homeSprite?.key).toBe('Swampler - swamp');
		expect(hex.homeSprite?.alpha).toBe(1);
		expect(hex.homeSprite?.originX).toBe(0.5);
		expect(hex.homeSprite?.originY).toBe(1);
		expect(hex.homeSprite?.x).toBe(hex.hitBox.x + hex.hitBox.width / 2);
		expect(hex.homeSprite?.y).toBe((hex.hitBox.y + hex.hitBox.height - 20) * 0.75);
		expect(hex.homeSprite?.scaleX).toBe(1);
		expect(hex.homeSprite?.scaleY).toBe(1);
		expect(hex.homeSprite?.depth).toBe(420);
		expect(grid.getDepthAtBand).toHaveBeenCalledWith(4, 'EFFECT_UNDER_UNITS');
		expect(grid.creatureGroup.__unwrapped.list.indexOf(hex.homeSprite)).toBeLessThan(
			grid.creatureGroup.__unwrapped.list.indexOf(unitOnHomeHex),
		);
		expect(hex.display.key).toBe('hex');
		expect(hex.display.alpha).toBe(0);
		hex.displayVisualState('dashed player0');
		expect(hex.display.key).toBe('hex_p0');
		expect(hex.display.alpha).toBe(1);

		hex.overlayVisualState('creature player0');
		hex.overlayVisualState('hover h_player0');

		expect(hex.display.key).toBe('hex_path');
		expect(hex.display.alpha).toBe(1);
		expect(hex.homeSprite?.key).toBe('Swampler - swamp');
		expect(hex.homeSprite?.alpha).toBe(1);
	});

	test.each([0, 5])('shows hex.png on a reachable swamp owned by creature %s', (owner) => {
		const hex = new Hex(5, 4, makeGrid() as any, makeGame());
		hex._swamplerHomeOwner = owner;
		hex.unsetReachable();
		const swamp = hex.homeSprite;
		const swampPosition = { x: swamp?.x, y: swamp?.y };

		expect(hex.display.alpha).toBe(0);

		// Movement destinations at the range edge have no dashed or player classes.
		hex.setReachable();
		expect(hex.displayClasses).toBe('');
		expect(hex.display.key).toBe('hex');
		expect(hex.display.alpha).toBe(1);
		expect(hex.display.originX).toBe(0);
		expect(hex.display.originY).toBe(0);
		expect(hex.display.x).toBe(hex.hitBox.x);
		expect(hex.display.y).toBe(hex.hitBox.y);

		hex.overlayVisualState('hover h_player0');
		expect(hex.display.key).toBe('hex_path');
		expect(hex.display.alpha).toBe(1);

		HexGrid.prototype.cleanHex.call({ game: { activeCreature: undefined } } as any, hex);
		expect(hex.reachable).toBe(true);
		expect(hex.display.key).toBe('hex');
		expect(hex.display.alpha).toBe(1);

		hex.setNotTarget();
		expect(hex.display.alpha).toBe(0);
		hex.unsetNotTarget();
		expect(hex.display.alpha).toBe(1);
		hex.unsetReachable();
		expect(hex.display.alpha).toBe(0);
		expect(hex.homeSprite).toBe(swamp);
		expect(hex.homeSprite).toMatchObject({
			...swampPosition,
			key: 'Swampler - swamp',
			alpha: 1,
			scaleX: 1,
			scaleY: 1,
		});
	});
});
