jest.mock('phaser', () =>
	(
		jest.requireActual('../../../test/phaser-mock') as typeof import('../../../test/phaser-mock')
	).createPhaserMock(),
);

import { describe, test, expect, jest } from '@jest/globals';
import { Hex, stopAllCursorSpinning } from '../../utility/hex';
import { HexGrid } from '../../utility/hexgrid';
import { createSpriteMock } from '../../../test/sprite-mock';
import { Creature } from '../../creature';
import { LAYER_SPEC } from '../../game-display/layer';

function makeGrid() {
	return {
		displayHexesGroup: { bringToTop: () => {}, sendToBack: () => {} },
		overlayHexesGroup: { bringToTop: () => {}, sendToBack: () => {} },
		queryDashedHexesGroup: { __unwrapped: { list: [] as any[] } },
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
		engine: {
			add: {
				sprite: (x: number, y: number, key: string, _frame: unknown, parent: any) => {
					const sprite = createSpriteMock({ x, y, key, width: 100, height: 100 });
					parent?.__unwrapped?.list.push(sprite);
					return sprite;
				},
			},
		},
	} as any;
	(game as any).gameEngine = game.engine;
	return game;
}

describe('occupied query outlines', () => {
	test('draws occupied outlines above other hex highlighting', () => {
		const grid = makeGrid() as any;
		const game = makeGame();
		const hex = new Hex(5, 4, grid, game);
		Object.defineProperty(hex, 'creature', {
			value: Object.assign(Object.create(Creature.prototype), { id: 2, team: 1 }),
		});
		grid.lastQueryOpt = { hexesDashed: [hex] };
		hex.displayVisualState('creature player1 dashed');
		hex.overlayVisualState('hover h_player1');
		const outline = grid.queryDashedHexesGroup.__unwrapped.list[0];
		expect(outline).toBeDefined();
		expect(outline.key).toBe('hex_dashed_p1');
		expect(outline.visible).toBe(true);
		expect(outline.alpha).toBe(1);
		expect(outline.x).toBe(hex.hitBox.x + hex.hitBox.width / 2);
		expect(outline.y).toBe(hex.hitBox.y + hex.hitBox.height / 2);
		const layers = LAYER_SPEC.filter((layer) => layer.parent === 'gridGroup').map(
			(layer) => layer.name,
		);
		expect(layers.indexOf('queryDashedHexesGroup')).toBeGreaterThan(
			layers.indexOf('overlayHexesGroup'),
		);
		stopAllCursorSpinning();
	});

	test.each([false, true])('preserves outlines after hover cleanup (active=%s)', (active) => {
		const grid = makeGrid() as any;
		const game = makeGame();
		const hex = new Hex(5, 4, grid, game);
		const creature = Object.assign(Object.create(Creature.prototype), {
			id: 2,
			team: 1,
			player: { id: 1 },
			hexagons: [hex],
		});
		Object.defineProperty(hex, 'creature', { value: creature });
		game.activeCreature = active ? creature : { id: 3, team: 0 };
		Object.assign(grid, {
			game,
			lastQueryOpt: { hexesDashed: [hex] },
			cleanHex: HexGrid.prototype.cleanHex,
			restoreReachableHexVisual: HexGrid.prototype.restoreReachableHexVisual,
		});
		hex.displayVisualState('creature player1 dashed');
		hex.overlayVisualState('hover h_player1');
		HexGrid.prototype.clearTransientHexHoverVisual.call(grid, hex);
		if (active) Creature.prototype.clearDashedOverlayOnHexes.call(creature);
		const outline = grid.queryDashedHexesGroup.__unwrapped.list[0];
		expect(outline).toBeDefined();
		expect(outline.visible).toBe(true);
		expect(outline.alpha).toBe(1);
		expect(outline.key).toBe('hex_dashed_p1');
		// Ending the targeting query clears its persistent outline.
		grid.lastQueryOpt = { hexesDashed: [] };
		hex.updateStyle();
		expect(outline.visible).toBe(false);
		expect(grid.queryDashedHexesGroup.__unwrapped.list).toHaveLength(1);
		stopAllCursorSpinning();
	});
});

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
