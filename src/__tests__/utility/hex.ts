jest.mock('phaser', () =>
	(
		jest.requireActual('../../../test/phaser-mock') as typeof import('../../../test/phaser-mock')
	).createPhaserMock(),
);

import { describe, test, expect, jest } from '@jest/globals';
import { Hex, stopAllCursorSpinning } from '../../utility/hex';
import { HexGrid } from '../../utility/hexgrid';
import { configure } from '../../utility/pointfacade';
import { Creature } from '../../creature';
import { createSpriteMock } from '../../../test/sprite-mock';

function creatureAt(x: number, y: number, team: number) {
	const creature = Object.create(Creature.prototype);
	Object.assign(creature, { x, y, team });
	return creature;
}

function configureBoard(creatures: Array<{ x: number; y: number; team: number }>) {
	configure({
		getCreatures: () => creatures as any,
		getCreaturePassablePoints: () => [],
		getCreatureBlockedPoints: (creature: { x: number; y: number }) => [
			{ x: creature.x, y: creature.y },
		],
		getTraps: () => [] as any,
		getTrapPassablePoints: () => [],
		getTrapBlockedPoints: () => [],
		getDrops: () => [] as any,
		getDropPassablePoints: () => [],
		getDropBlockedPoints: () => [],
	});
}

function configureEmptyBoard() {
	configureBoard([]);
}

function configureBoardWithCreature(creature: { x: number; y: number; team: number }) {
	configureBoard([creatureAt(creature.x, creature.y, creature.team)]);
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

describe('hexagon coordinate view (#2250)', () => {
	function makeGridWithText() {
		const createdTexts: any[] = [];
		const displayBringToTop = jest.fn();
		const grid = {
			displayHexesGroup: { bringToTop: displayBringToTop, sendToBack: () => {} },
			overlayHexesGroup: { bringToTop: () => {}, sendToBack: () => {} },
			healthIndicatorUiGroup: { bringToTop: () => {}, sendToBack: () => {} },
		};
		const game = {
			engine: {
				add: {
					sprite: (x: number, y: number, key: string) =>
						createSpriteMock({ x, y, key, width: 100, height: 100 }),
					text: (x: number, y: number, content: string, _style: unknown, _parent: unknown) => {
						const txt = createSpriteMock({ x, y, width: 100, height: 30 }) as any;
						txt.textContent = content;
						txt.stroke = '';
						txt.strokeThickness = 0;
						txt.setOrigin = jest.fn(() => txt);
						createdTexts.push(txt);
						return txt;
					},
				},
			},
		} as any;
		(game as any).gameEngine = game.engine;
		return { grid, game, createdTexts, displayBringToTop };
	}

	test('empty hexes render a faint dashed grid instead of a solid one', () => {
		const { grid, game, displayBringToTop } = makeGridWithText();
		configureEmptyBoard();
		const hex = new Hex(5, 4, grid as any, game as any);

		hex.displayVisualState('showGrid');
		hex.displayVisualState('dashed');
		(hex as any).updateStyle();

		expect(hex.display.key).toBe('hex_dashed');
		expect(hex.display.alpha).toBe(0.25);
		expect(displayBringToTop).toHaveBeenCalledWith(hex.display);
	});

	test('unit hexes keep their team dashed texture above the label layer', () => {
		const { grid, game, createdTexts } = makeGridWithText();
		configureBoardWithCreature({ x: 5, y: 4, team: 1 });
		const hex = new Hex(5, 4, grid as any, game as any);

		hex.displayVisualState('showGrid');
		hex.displayVisualState('dashed');
		(hex as any).updateStyle();

		expect(hex.display.key).toBe('hex_dashed_p1');
		expect(hex.display.alpha).toBe(1);
		expect(createdTexts).toHaveLength(1);
		expect(createdTexts[0].stroke).toBe('#ffffff');
	});
});
