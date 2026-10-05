import { afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
jest.mock('../../game', () => ({
	__esModule: true,
	default: class GameMock {},
}));

jest.mock('../../utility/hex', () => ({
	__esModule: true,
	Direction: {},
	Hex: class HexMock {},
}));

jest.mock('../../creature', () => ({
	__esModule: true,
	Creature: class CreatureMock {},
}));

import { HexGrid } from '../../utility/hexgrid';
import { createGameChannels } from '../../game-events/factory';
import { GHOST_PREVIEW_ALPHA } from '../../utility/const';
import { Creature } from '../../creature';
import { notifyTextureLoaded, resetOnDemandTextures, setOnDemandLoader } from '../../assets';
import { createSpriteMock } from '../../../test/sprite-mock';

describe('HexGrid previewCreature query guards', () => {
	beforeAll(() => {
		(global as unknown as { Phaser?: unknown }).Phaser = {
			Easing: {
				Linear: {
					None: null,
				},
			},
		};
	});

	test('invalid target hex clears stale materialize preview and aborts rendering', () => {
		const oldHexA = { creature: null };
		const oldHexB = { creature: null };
		const invalidTargetHex = { reachable: false };

		const cleanHex = jest.fn();
		const restoreReachableHexVisual = jest.fn();
		const createOverlay = jest.fn();

		const materializeOverlay = {
			alpha: 0.5,
			_previewPos: { x: 2, y: 0 },
			_previewSize: 2,
		};

		const gridMock = {
			game: {
				activeCreature: { id: 7, team: 0 },
				Phaser: {
					add: {
						tween: jest.fn(),
					},
				},
				// Overlay creation moved from `creatureGroup.create` to the engine.
				gameEngine: { add: { sprite: createOverlay } },
			},
			hexes: [[{}, oldHexB, oldHexA, {}, invalidTargetHex]],
			lastQueryOpt: {
				hexes: [{ reachable: true }],
			},
			materialize_overlay: materializeOverlay,
			secondary_overlay: undefined,
			cleanHex,
			restoreReachableHexVisual,
			creatureGroup: {},
		};

		HexGrid.prototype.previewCreature.call(
			gridMock,
			{ x: 4, y: 0 },
			{
				size: 1,
				type: '--',
				name: 'Dark Priest',
				display: {
					'offset-x': 0,
					'offset-y': 0,
				},
			},
			{ flipped: false, color: 'blue' },
		);

		expect(cleanHex).toHaveBeenCalledTimes(2);
		expect(restoreReachableHexVisual).toHaveBeenCalledTimes(2);
		expect(materializeOverlay.alpha).toBe(0);
		expect(materializeOverlay._previewPos).toBeUndefined();
		expect(createOverlay).not.toHaveBeenCalled();
	});

	test('replay mode clears stale preview and suppresses cardboard rendering', () => {
		const oldHex = { creature: null };
		const cleanHex = jest.fn();
		const restoreReachableHexVisual = jest.fn();
		const createOverlay = jest.fn();

		const materializeOverlay = {
			alpha: 0.5,
			_previewPos: { x: 1, y: 0 },
			_previewSize: 1,
		};

		const gridMock = {
			game: {
				isReplayInProgress: true,
				botController: { isBotTurn: () => false },
				activeCreature: { id: 7, team: 0, player: { id: 1 } },
				activePlayer: { id: 1 },
				Phaser: {
					add: {
						tween: jest.fn(),
					},
				},
				// Overlay creation moved from `creatureGroup.create` to the engine.
				gameEngine: { add: { sprite: createOverlay } },
			},
			hexes: [[{}, oldHex, {}]],
			lastQueryOpt: {
				hexes: [],
			},
			materialize_overlay: materializeOverlay,
			secondary_overlay: undefined,
			cleanHex,
			restoreReachableHexVisual,
			creatureGroup: {},
		};

		HexGrid.prototype.previewCreature.call(
			gridMock,
			{ x: 2, y: 0 },
			{
				size: 1,
				type: '--',
				name: 'Dark Priest',
				display: {
					'offset-x': 0,
					'offset-y': 0,
				},
			},
			{ flipped: false, color: 'blue' },
		);

		expect(materializeOverlay.alpha).toBe(0);
		expect(materializeOverlay._previewPos).toBeUndefined();
		expect(cleanHex).toHaveBeenCalledTimes(1);
		expect(restoreReachableHexVisual).toHaveBeenCalledTimes(1);
		expect(createOverlay).not.toHaveBeenCalled();
	});
});

describe('HexGrid previewCreature depth banding', () => {
	beforeAll(() => {
		(global as unknown as { Phaser?: unknown }).Phaser = {
			Easing: {
				Linear: {
					None: null,
				},
			},
		};
	});

	const makePreviewSprite = () => {
		const sprite = createSpriteMock({
			depth: 0,
			alpha: 0,
			width: 112,
			height: 200,
			// `orderCreatureZ` reads the texture frame's height off the sprite;
			// the double carries it as `width`/`height` the way Phaser 4 does.
			extra: { posy: undefined as number | undefined, texture: { width: 112, height: 200 } },
		});
		return sprite;
	};

	/**
	 * Minimal grid whose orderCreatureZ() is the real implementation, so the
	 * tests assert the depth the renderer would actually use.
	 */
	const makeGrid = (createdSprites: unknown[]) => {
		const makeHex = (x: number, y: number) => ({
			x,
			y,
			reachable: true,
			creature: null,
			displayPos: { x: 90 * x, y: 58 * y },
			overlayVisualState: jest.fn(),
		});

		const hexes = [
			[makeHex(0, 0), makeHex(1, 0), makeHex(2, 0)],
			[makeHex(0, 1), makeHex(1, 1), makeHex(2, 1)],
			[makeHex(0, 2), makeHex(1, 2), makeHex(2, 2)],
		];

		const tweenChain = {
			to: () => tweenChain,
			yoyo: () => tweenChain,
			repeat: () => tweenChain,
			start: () => ({ stop: jest.fn() }),
		};
		const tween = jest.fn(() => tweenChain);
		const removeTweensFrom = jest.fn();

		const activePlayer = { id: 0, flipped: false, controller: 'human', color: 'red' };
		const activeCreature = { id: 0, team: 0, player: activePlayer };

		const gridMock = {
			game: {
				activeCreature,
				activePlayer,
				creatures: [],
				traps: [],
				drops: [],
				gameEngine: {
					tween,
					removeTweensFrom,
					add: {
						sprite: jest.fn(() => {
							const sprite = createSpriteMock({
								depth: 0,
								alpha: 0,
								width: 112,
								height: 200,
								extra: { posy: undefined, texture: { width: 112, height: 200 } },
							});
							createdSprites.push(sprite);
							return sprite;
						}),
					},
				},
			},
			hexes,
			lastQueryOpt: { hexes: [] },
			materialize_overlay: undefined as unknown,
			secondary_overlay: undefined as unknown,
			cleanHex: jest.fn(),
			restoreReachableHexVisual: jest.fn(),
			creatureGroup: {
				list: [],
			},
			trapGroup: { list: [] },
			trapOverGroup: { list: [] },
			dropGroup: { list: [] },
			getDepthAtBand: HexGrid.prototype.getDepthAtBand,
			assignSpriteDepthBand: HexGrid.prototype.assignSpriteDepthBand,
			orderCreatureZ: HexGrid.prototype.orderCreatureZ,
			// The cardboard gate re-enters previewCreature when a unit's texture is
			// not resident, so the stand-in needs the method too.
			previewCreature: HexGrid.prototype.previewCreature,
		};

		return { gridMock, hexes, activeCreature, activePlayer, tween, removeTweensFrom };
	};

	const priestData = {
		size: 1,
		type: '--',
		name: 'Dark Priest',
		display: {
			'offset-x': 0,
			'offset-y': 0,
		},
	};

	test('a newly created materialize overlay is banded into its row instead of depth 0', () => {
		const createdSprites: unknown[] = [];
		const { gridMock, hexes, activeCreature, activePlayer } = makeGrid(createdSprites);

		HexGrid.prototype.previewCreature.call(gridMock, { x: 1, y: 2 }, priestData, activePlayer);

		expect(createdSprites).toHaveLength(1);
		const overlay = gridMock.materialize_overlay as unknown as {
			posy: number;
			depth: number;
		};
		// Row 2, EFFECT_OVER_UNITS band: in front of every creature on the same
		// row (200 + 40) and behind anything on the rows below it.
		expect(overlay.posy).toBe(2);
		expect(overlay.depth).toBe(200 + 80);
		expect(overlay.depth).toBeGreaterThan(2 * 100 + 40);
		expect(hexes[2][1].overlayVisualState).toHaveBeenCalledWith(
			`creature selected player${activeCreature.team}`,
		);
	});

	test('a newly created secondary overlay is banded into its row', () => {
		const createdSprites: unknown[] = [];
		const { gridMock, activePlayer } = makeGrid(createdSprites);

		HexGrid.prototype.previewCreature.call(
			gridMock,
			{ x: 2, y: 1 },
			priestData,
			activePlayer,
			true,
		);

		const overlay = gridMock.secondary_overlay as unknown as { posy: number; depth: number };
		expect(overlay.posy).toBe(1);
		expect(overlay.depth).toBe(100 + 80);
	});

	test('reusing an overlay on the same row keeps its depth band', () => {
		const createdSprites: unknown[] = [];
		const { gridMock, activePlayer } = makeGrid(createdSprites);
		const overlay = makePreviewSprite();
		overlay.posy = 1;
		gridMock.materialize_overlay = overlay as unknown;

		HexGrid.prototype.previewCreature.call(gridMock, { x: 1, y: 1 }, priestData, activePlayer);

		expect(gridMock.game.gameEngine.add.sprite).not.toHaveBeenCalled();
		expect(overlay.setTexture).toHaveBeenCalled();
	});

	test('the ghost is held at the ghost opacity, with no tween to animate it', () => {
		const createdSprites: unknown[] = [];
		const { gridMock, activePlayer, tween } = makeGrid(createdSprites);

		HexGrid.prototype.previewCreature.call(gridMock, { x: 1, y: 1 }, priestData, activePlayer);

		const overlay = gridMock.materialize_overlay as unknown as { alpha: number };
		expect(overlay.alpha).toBe(GHOST_PREVIEW_ALPHA);
		expect(tween).not.toHaveBeenCalled();
	});

	test('moving the cursor to another hex does not animate the ghost', () => {
		const createdSprites: unknown[] = [];
		const { gridMock, activePlayer, tween } = makeGrid(createdSprites);

		HexGrid.prototype.previewCreature.call(gridMock, { x: 1, y: 1 }, priestData, activePlayer);
		HexGrid.prototype.previewCreature.call(gridMock, { x: 2, y: 1 }, priestData, activePlayer);

		const overlay = gridMock.materialize_overlay as unknown as { alpha: number };
		expect(overlay.alpha).toBe(GHOST_PREVIEW_ALPHA);
		expect(tween).not.toHaveBeenCalled();
	});

	test('a fade left over from the last use of the overlay is killed before the ghost is pinned', () => {
		const createdSprites: unknown[] = [];
		const { gridMock, activePlayer, removeTweensFrom } = makeGrid(createdSprites);

		HexGrid.prototype.previewCreature.call(gridMock, { x: 1, y: 1 }, priestData, activePlayer);

		// The overlay the priest materializes onto is the same one its own
		// movement preview reuses. fadeOutTempCreature() is still tweening that
		// sprite to 0, which would swallow the ghost until the fade ended.
		const overlay = gridMock.materialize_overlay;
		expect(removeTweensFrom).toHaveBeenCalledWith(overlay);
	});

	test('the materialize preview (secondary overlay) is held at the ghost opacity too', () => {
		const createdSprites: unknown[] = [];
		const { gridMock, activePlayer, tween } = makeGrid(createdSprites);

		HexGrid.prototype.previewCreature.call(
			gridMock,
			{ x: 2, y: 1 },
			priestData,
			activePlayer,
			true,
		);

		const overlay = gridMock.secondary_overlay as unknown as { alpha: number };
		expect(overlay.alpha).toBe(GHOST_PREVIEW_ALPHA);
		expect(tween).not.toHaveBeenCalled();
	});
});

describe('HexGrid previewCreature lazy cardboard loading', () => {
	beforeAll(() => {
		(global as unknown as { Phaser?: unknown }).Phaser = {
			Easing: { Linear: { None: null } },
		};
	});

	/**
	 * Cardboards are no longer preloaded, so `previewCreature` has to be able to
	 * render a unit whose texture is still in flight. These exercise that against
	 * the real on-demand loader in `assets.ts`, with the Phaser scene faked out.
	 */
	let resident: Set<string>;
	let requested: Map<string, string>;

	beforeEach(() => {
		resident = new Set();
		requested = new Map();
		setOnDemandLoader(
			(key, url) => void requested.set(key, url),
			(key) => resident.has(key),
		);
	});

	afterEach(() => {
		resetOnDemandTextures();
		setOnDemandLoader(undefined, undefined);
	});

	const makeGrid = (createdSprites: unknown[]) => {
		const makeHex = (x: number, y: number) => ({
			x,
			y,
			reachable: true,
			creature: null,
			displayPos: { x: 90 * x, y: 58 * y },
			overlayVisualState: jest.fn(),
		});
		const hexes = [
			[makeHex(0, 0), makeHex(1, 0), makeHex(2, 0)],
			[makeHex(0, 1), makeHex(1, 1), makeHex(2, 1)],
			[makeHex(0, 2), makeHex(1, 2), makeHex(2, 2)],
		];
		const tweenChain = {
			to: () => tweenChain,
			yoyo: () => tweenChain,
			repeat: () => tweenChain,
			start: () => ({ stop: jest.fn() }),
		};
		const activePlayer = { id: 0, flipped: false, controller: 'human', color: 'red' };
		const activeCreature = { id: 0, team: 0, player: activePlayer };
		const gridMock = {
			game: {
				activeCreature,
				activePlayer,
				creatures: [],
				traps: [],
				drops: [],
				gameEngine: {
					tween: () => tweenChain,
					add: {
						sprite: jest.fn(() => {
							const sprite = createSpriteMock({
								depth: 0,
								alpha: 0,
								width: 112,
								height: 200,
								extra: { posy: undefined, texture: { width: 112, height: 200 } },
							});
							createdSprites.push(sprite);
							return sprite;
						}),
					},
				},
			},
			hexes,
			lastQueryOpt: { hexes: [] },
			materialize_overlay: undefined as unknown,
			secondary_overlay: undefined as unknown,
			cleanHex: jest.fn(),
			restoreReachableHexVisual: jest.fn(),
			creatureGroup: {
				list: [],
			},
			trapGroup: { list: [] },
			trapOverGroup: { list: [] },
			dropGroup: { list: [] },
			getDepthAtBand: HexGrid.prototype.getDepthAtBand,
			assignSpriteDepthBand: HexGrid.prototype.assignSpriteDepthBand,
			orderCreatureZ: HexGrid.prototype.orderCreatureZ,
			previewCreature: HexGrid.prototype.previewCreature,
		};
		return { gridMock, activePlayer };
	};

	const summonedData = {
		size: 1,
		type: 'A1',
		name: 'Swine Thug',
		display: { 'offset-x': 0, 'offset-y': 0 },
	};

	test('holds the ghost back until the cardboard arrives, then draws it', () => {
		const createdSprites: unknown[] = [];
		const { gridMock, activePlayer } = makeGrid(createdSprites);

		HexGrid.prototype.previewCreature.call(gridMock, { x: 1, y: 1 }, summonedData, activePlayer);

		// Nothing drawn yet — a ghost sized against a missing texture would be wrong.
		expect(createdSprites).toHaveLength(0);
		expect(requested.get('Swine Thug')).toBe('assets/units/cardboards/Swine Thug.png');

		resident.add('Swine Thug');
		notifyTextureLoaded('Swine Thug');

		expect(createdSprites).toHaveLength(1);
		expect(gridMock.materialize_overlay).toBe(createdSprites[0]);
	});

	test('the parked preview follows the cursor rather than the request that started the load', () => {
		const createdSprites: unknown[] = [];
		const { gridMock, activePlayer } = makeGrid(createdSprites);

		HexGrid.prototype.previewCreature.call(gridMock, { x: 1, y: 1 }, summonedData, activePlayer);
		// The cursor moves on while the texture is still in flight.
		HexGrid.prototype.previewCreature.call(gridMock, { x: 2, y: 2 }, summonedData, activePlayer);

		resident.add('Swine Thug');
		notifyTextureLoaded('Swine Thug');

		expect(createdSprites).toHaveLength(1);
		// Landed on the second hex, not the one that triggered the download.
		expect(hexesOf(gridMock)).toEqual({ x: 2, y: 2 });
	});

	test('a resident cardboard draws immediately and requests nothing', () => {
		const createdSprites: unknown[] = [];
		const { gridMock, activePlayer } = makeGrid(createdSprites);
		resident.add('Swine Thug');

		HexGrid.prototype.previewCreature.call(gridMock, { x: 1, y: 1 }, summonedData, activePlayer);

		expect(createdSprites).toHaveLength(1);
		expect(requested.size).toBe(0);
	});
});

/** The hex the preview ghost was placed on. */
function hexesOf(gridMock: { materialize_overlay: { _previewPos?: { x: number; y: number } } }) {
	return gridMock.materialize_overlay._previewPos;
}

describe('HexGrid xray hover behavior', () => {
	type Bounds = {
		left: number;
		top: number;
		right: number;
		bottom: number;
	};

	const makeCreature = (id: number, bounds: Bounds, hexCount = 1) => {
		const hexagons = Array.from({ length: hexCount }, () => ({
			ghostOverlap: jest.fn(),
		}));

		const creature = Object.assign(Object.create(Creature.prototype), {
			id,
			xray: jest.fn(),
			sprite: {
				getBounds: jest.fn(() => bounds),
			},
			grp: { id },
			hexagons,
		});

		return creature as Creature & {
			xray: jest.Mock;
			hexagons: Array<{ ghostOverlap: jest.Mock }>;
		};
	};

	test('hovered non-active creature on trap reveals both creature and trap blockers', () => {
		const active = makeCreature(1, { left: 0, top: 0, right: 10, bottom: 10 });
		const hovered = makeCreature(2, { left: 20, top: 20, right: 40, bottom: 40 }, 2);
		const blocker = makeCreature(3, { left: 22, top: 22, right: 38, bottom: 38 });

		const trapSprite = {
			active: true,
			getBounds: jest.fn(() => ({ left: 20, top: 20, right: 40, bottom: 40 })),
		};

		const gridMock = {
			creatureGroup: { id: 'creature-group' },
			game: {
				activeCreature: active,
				creatures: [active, hovered, blocker],
				UI: { selectedAbility: -1 },
				traps: [
					{
						x: 4,
						y: 7,
						getVisualSprites: () => [trapSprite],
					},
				],
			},
		};

		const hoverHex = {
			x: 4,
			y: 7,
			reachable: false,
			creature: hovered,
			ghostOverlap: jest.fn(),
		};

		HexGrid.prototype.xray.call(gridMock, hoverHex as never);

		hovered.hexagons.forEach((hex) => {
			expect(hex.ghostOverlap).toHaveBeenCalledWith(hovered);
		});
		expect(hovered.xray).toHaveBeenLastCalledWith(false);
		expect(hovered.xray.mock.calls.some((args) => args[0] === true)).toBe(false);
		expect(blocker.xray).toHaveBeenLastCalledWith(
			true,
			expect.arrayContaining([
				expect.objectContaining({ sprite: trapSprite, grp: gridMock.creatureGroup }),
				hovered,
			]),
		);
	});

	test('hovered trap reveals trap by ghosting overlapping blockers, even when reachable', () => {
		const active = makeCreature(1, { left: 0, top: 0, right: 10, bottom: 10 });
		const blocker = makeCreature(2, { left: 18, top: 18, right: 42, bottom: 42 });
		const farCreature = makeCreature(3, { left: 100, top: 100, right: 120, bottom: 120 });

		const trapSprite = {
			active: true,
			getBounds: jest.fn(() => ({ left: 20, top: 20, right: 40, bottom: 40 })),
		};

		const gridMock = {
			creatureGroup: { id: 'creature-group' },
			game: {
				activeCreature: active,
				creatures: [active, blocker, farCreature],
				UI: { selectedAbility: -1 },
				traps: [
					{
						x: 8,
						y: 3,
						getVisualSprites: () => [trapSprite],
					},
				],
			},
		};

		const hoverHex = {
			x: 8,
			y: 3,
			reachable: true,
			creature: null,
			ghostOverlap: jest.fn(),
		};

		HexGrid.prototype.xray.call(gridMock, hoverHex as never);

		expect(blocker.xray).toHaveBeenLastCalledWith(
			true,
			expect.objectContaining({ sprite: trapSprite, grp: gridMock.creatureGroup }),
		);
		expect(farCreature.xray.mock.calls.some((args) => args[0] === true)).toBe(false);
	});

	test('hovered non-active creature on trap is revealed while trap blockers are still xrayed', () => {
		const active = makeCreature(1, { left: 0, top: 0, right: 10, bottom: 10 });
		const hovered = makeCreature(2, { left: 20, top: 20, right: 44, bottom: 44 }, 2);
		const blocker = makeCreature(3, { left: 18, top: 18, right: 42, bottom: 42 });

		const trapSprite = {
			active: true,
			getBounds: jest.fn(() => ({ left: 20, top: 20, right: 40, bottom: 40 })),
		};

		const gridMock = {
			creatureGroup: { id: 'creature-group' },
			game: {
				activeCreature: active,
				creatures: [active, hovered, blocker],
				UI: { selectedAbility: -1 },
				traps: [
					{
						x: 4,
						y: 7,
						getVisualSprites: () => [trapSprite],
					},
				],
			},
		};

		const hoverHex = {
			x: 4,
			y: 7,
			reachable: false,
			creature: hovered,
			ghostOverlap: jest.fn(),
		};

		HexGrid.prototype.xray.call(gridMock, hoverHex as never);

		hovered.hexagons.forEach((hex) => {
			expect(hex.ghostOverlap).toHaveBeenCalledWith(hovered);
		});
		expect(hovered.xray).toHaveBeenLastCalledWith(false);
		expect(hovered.xray.mock.calls.some((args) => args[0] === true)).toBe(false);
		expect(blocker.xray).toHaveBeenLastCalledWith(
			true,
			expect.arrayContaining([
				expect.objectContaining({ sprite: trapSprite, grp: gridMock.creatureGroup }),
				hovered,
			]),
		);
	});

	test('hovered active creature on trap keeps active visible and includes active in reveal refs', () => {
		const active = makeCreature(1, { left: 20, top: 20, right: 44, bottom: 44 }, 2);
		const blocker = makeCreature(3, { left: 18, top: 18, right: 42, bottom: 42 });

		const trapSprite = {
			active: true,
			getBounds: jest.fn(() => ({ left: 20, top: 20, right: 40, bottom: 40 })),
		};

		const gridMock = {
			creatureGroup: { id: 'creature-group' },
			game: {
				activeCreature: active,
				creatures: [active, blocker],
				UI: { selectedAbility: -1 },
				traps: [
					{
						x: 4,
						y: 7,
						getVisualSprites: () => [trapSprite],
					},
				],
			},
		};

		const hoverHex = {
			x: 4,
			y: 7,
			reachable: false,
			creature: active,
			ghostOverlap: jest.fn(),
		};

		HexGrid.prototype.xray.call(gridMock, hoverHex as never);

		active.hexagons.forEach((hex) => {
			expect(hex.ghostOverlap).toHaveBeenCalledWith(active);
		});
		expect(active.xray).toHaveBeenLastCalledWith(false);
		expect(active.xray.mock.calls.some((args) => args[0] === true)).toBe(false);
		expect(blocker.xray).toHaveBeenLastCalledWith(
			true,
			expect.arrayContaining([
				expect.objectContaining({ sprite: trapSprite, grp: gridMock.creatureGroup }),
				active,
			]),
		);
	});

	test('hovered drop reveals drop by ghosting overlapping blockers', () => {
		const active = makeCreature(1, { left: 0, top: 0, right: 10, bottom: 10 });
		const blocker = makeCreature(2, { left: 18, top: 18, right: 42, bottom: 42 });
		const farCreature = makeCreature(3, { left: 100, top: 100, right: 120, bottom: 120 });

		const dropSprite = {
			active: true,
			getBounds: jest.fn(() => ({ left: 20, top: 20, right: 40, bottom: 40 })),
		};

		const gridMock = {
			creatureGroup: { id: 'creature-group' },
			game: {
				activeCreature: active,
				creatures: [active, blocker, farCreature],
				UI: { selectedAbility: -1 },
				traps: [],
				drops: [
					{
						x: 8,
						y: 3,
						pickedUp: false,
						display: dropSprite,
					},
				],
			},
		};

		const hoverHex = {
			x: 8,
			y: 3,
			reachable: true,
			creature: null,
			drop: gridMock.game.drops[0],
			ghostOverlap: jest.fn(),
		};

		HexGrid.prototype.xray.call(gridMock, hoverHex as never);

		expect(blocker.xray).toHaveBeenLastCalledWith(
			true,
			expect.objectContaining({ sprite: dropSprite, grp: gridMock.creatureGroup }),
		);
		expect(farCreature.xray.mock.calls.some((args) => args[0] === true)).toBe(false);
	});

	test('unreachable hovered trap falls back to hex ghost overlap when no trap sprites exist', () => {
		const active = makeCreature(1, { left: 0, top: 0, right: 10, bottom: 10 });
		const blocker = makeCreature(2, { left: 18, top: 18, right: 42, bottom: 42 });

		const gridMock = {
			creatureGroup: { id: 'creature-group' },
			game: {
				activeCreature: active,
				creatures: [active, blocker],
				UI: { selectedAbility: -1 },
				traps: [
					{
						x: 2,
						y: 6,
						getVisualSprites: () => [],
					},
				],
			},
		};

		const hoverHex = {
			x: 2,
			y: 6,
			reachable: false,
			creature: null,
			ghostOverlap: jest.fn(),
		};

		HexGrid.prototype.xray.call(gridMock, hoverHex as never);

		expect(hoverHex.ghostOverlap).toHaveBeenCalledTimes(1);
	});

	test('default branch keeps active creature visible when no exception applies', () => {
		const active = makeCreature(1, { left: 0, top: 0, right: 10, bottom: 10 }, 2);
		const other = makeCreature(2, { left: 50, top: 50, right: 70, bottom: 70 });

		const gridMock = {
			creatureGroup: { id: 'creature-group' },
			game: {
				activeCreature: active,
				creatures: [active, other],
				UI: { selectedAbility: 1 },
				traps: [],
			},
		};

		const hoverHex = {
			x: 1,
			y: 1,
			reachable: true,
			creature: other,
			ghostOverlap: jest.fn(),
		};

		HexGrid.prototype.xray.call(gridMock, hoverHex as never);

		active.hexagons.forEach((hex) => {
			expect(hex.ghostOverlap).toHaveBeenCalledWith(active);
		});
		expect(active.xray).toHaveBeenLastCalledWith(false);
	});

	test('moving off exception hover restores active-creature default xray path', () => {
		const active = makeCreature(1, { left: 0, top: 0, right: 10, bottom: 10 }, 2);
		const hovered = makeCreature(2, { left: 20, top: 20, right: 40, bottom: 40 }, 2);

		const gridMock = {
			creatureGroup: { id: 'creature-group' },
			game: {
				activeCreature: active,
				creatures: [active, hovered],
				UI: { selectedAbility: -1 },
				traps: [],
			},
		};

		const hoveredHex = {
			x: 6,
			y: 6,
			reachable: true,
			creature: hovered,
			ghostOverlap: jest.fn(),
		};

		HexGrid.prototype.xray.call(gridMock, hoveredHex as never);

		hovered.hexagons.forEach((hex) => {
			expect(hex.ghostOverlap).toHaveBeenCalledWith(hovered);
		});
		active.hexagons.forEach((hex) => {
			expect(hex.ghostOverlap).not.toHaveBeenCalled();
		});

		active.hexagons.forEach((hex) => (hex.ghostOverlap as jest.Mock).mockClear());

		const neutralHex = {
			x: 7,
			y: 7,
			reachable: true,
			creature: null,
			ghostOverlap: jest.fn(),
		};

		HexGrid.prototype.xray.call(gridMock, neutralHex as never);

		active.hexagons.forEach((hex) => {
			expect(hex.ghostOverlap).toHaveBeenCalledWith(active);
		});
		expect(active.xray).toHaveBeenLastCalledWith(false);
	});

	test('transition from unreachable trap hover to adjacent creature hover keeps correct xray targeting', () => {
		const active = makeCreature(1, { left: 0, top: 0, right: 10, bottom: 10 });
		const scavenger = makeCreature(2, { left: 18, top: 18, right: 42, bottom: 42 }, 2);
		const blocker = makeCreature(3, { left: 19, top: 19, right: 41, bottom: 41 });

		const trapSprite = {
			active: true,
			getBounds: jest.fn(() => ({ left: 20, top: 20, right: 40, bottom: 40 })),
		};

		const gridMock = {
			creatureGroup: { id: 'creature-group' },
			game: {
				activeCreature: active,
				creatures: [active, scavenger, blocker],
				UI: { selectedAbility: -1 },
				traps: [
					{
						x: 8,
						y: 3,
						getVisualSprites: () => [trapSprite],
					},
				],
			},
		};

		const mudbathHex = {
			x: 8,
			y: 3,
			reachable: false,
			creature: null,
			ghostOverlap: jest.fn(),
		};

		HexGrid.prototype.xray.call(gridMock, mudbathHex as never);

		expect(blocker.xray).toHaveBeenLastCalledWith(
			true,
			expect.objectContaining({ sprite: trapSprite, grp: gridMock.creatureGroup }),
		);

		scavenger.hexagons.forEach((hex) => (hex.ghostOverlap as jest.Mock).mockClear());

		const scavengerHex = {
			x: 9,
			y: 3,
			reachable: false,
			creature: scavenger,
			ghostOverlap: jest.fn(),
		};

		HexGrid.prototype.xray.call(gridMock, scavengerHex as never);

		scavenger.hexagons.forEach((hex) => {
			expect(hex.ghostOverlap).toHaveBeenCalledWith(scavenger);
		});
	});

	test('hovered drop stacked on trap passes both reveal masks to overlapping blockers', () => {
		const active = makeCreature(1, { left: 0, top: 0, right: 10, bottom: 10 });
		const blocker = makeCreature(2, { left: 18, top: 18, right: 42, bottom: 42 });

		const trapSprite = {
			active: true,
			getBounds: jest.fn(() => ({ left: 20, top: 20, right: 30, bottom: 34 })),
		};
		const dropSprite = {
			active: true,
			getBounds: jest.fn(() => ({ left: 24, top: 22, right: 40, bottom: 40 })),
		};

		const gridMock = {
			creatureGroup: { id: 'creature-group' },
			game: {
				activeCreature: active,
				creatures: [active, blocker],
				UI: { selectedAbility: -1 },
				traps: [
					{
						x: 5,
						y: 4,
						getVisualSprites: () => [trapSprite],
					},
				],
				drops: [
					{
						x: 5,
						y: 4,
						pickedUp: false,
						display: dropSprite,
					},
				],
			},
		};

		const hoverHex = {
			x: 5,
			y: 4,
			reachable: false,
			creature: null,
			drop: gridMock.game.drops[0],
			ghostOverlap: jest.fn(),
		};

		HexGrid.prototype.xray.call(gridMock, hoverHex as never);

		expect(blocker.xray).toHaveBeenLastCalledWith(
			true,
			expect.arrayContaining([
				expect.objectContaining({ sprite: trapSprite, grp: gridMock.creatureGroup }),
				expect.objectContaining({ sprite: dropSprite, grp: gridMock.creatureGroup }),
			]),
		);
	});

	test('orderCreatureZ assigns shared depth bands within each row', () => {
		// Phaser 4 owns render order through the native `depth` property;
		// `z` is reserved for the height of a light in the lighting pipeline.
		// Rows are inverted so that bottom-of-screen rows (high y) render behind
		// top-of-screen rows (low y) in the oblique perspective.
		const depthSprite = (parent?: unknown) => {
			const sprite: any = { depth: -1, setDepth: (v: number) => (sprite.depth = v) };
			if (parent) sprite.parent = parent;
			return sprite;
		};
		const row0Creature = { y: 0, grp: depthSprite() };
		const row1Creature = { y: 1, grp: depthSprite() };
		const row0Drop = { y: 0, display: depthSprite() };
		const row0Materialize = depthSprite();
		(row0Materialize as any).posy = 0;
		const row0TrapUnderFx = depthSprite();
		const row0TrapOverFx = depthSprite();
		const row0Trap = {
			y: 0,
			display: depthSprite(),
			displayOver: depthSprite(),
			getVisualSprites: () => [row0Trap.display, row0TrapUnderFx, row0TrapOverFx],
		};

		const trapGroup = { id: 'trap-group', list: [] as unknown[] };
		const trapOverGroup = { id: 'trap-over-group', list: [] as unknown[] };
		const creatureGroup = { list: [] as unknown[] };
		const dropGroup = { list: [] as unknown[] };
		const gridMock = {
			hexes: [[{}], [{}]],
			game: {
				creatures: [row0Creature, row1Creature],
				drops: [row0Drop],
				traps: [row0Trap],
			},
			trapGroup,
			creatureGroup,
			dropGroup,
			trapOverGroup,
			materialize_overlay: row0Materialize,
			secondary_overlay: undefined,
			getDepthAtBand: HexGrid.prototype.getDepthAtBand,
			assignSpriteDepthBand: HexGrid.prototype.assignSpriteDepthBand,
		};

		row0Trap.display.parent = trapGroup;
		row0TrapUnderFx.parent = trapGroup;
		row0TrapOverFx.parent = trapOverGroup;
		// Every renderable is a member of the layer it is sorted within, so the
		// sort has something to reorder.
		trapGroup.list.push(row0Trap.display, row0TrapUnderFx);
		trapOverGroup.list.push(row0TrapOverFx, row0Trap.displayOver);
		creatureGroup.list.push(row0Creature.grp, row1Creature.grp);
		dropGroup.list.push(row0Drop.display);

		HexGrid.prototype.orderCreatureZ.call(gridMock);

		expect(row0Trap.display.depth).toBe(0);
		expect(row0TrapUnderFx.depth).toBe(20);
		expect(row0Creature.grp.depth).toBe(40);
		expect(row0Drop.display.depth).toBe(85);
		expect(row0Materialize.depth).toBe(80);
		expect(row0TrapOverFx.depth).toBe(90);
		expect(row0Trap.displayOver.depth).toBe(91);
		expect(row1Creature.grp.depth).toBe(140);

		// Ascending depth, i.e. lowest first in the list, which is what Phaser 4
		// renders as furthest back. The old `sort('depth', -1)` would have inverted
		// these, putting row 1's unit behind row 0's.
		const depths = (list: unknown[]) => list.map((child) => (child as { depth: number }).depth);
		expect(depths(trapGroup.list)).toEqual([0, 20]);
		expect(depths(trapOverGroup.list)).toEqual([90, 91]);
		expect(depths(creatureGroup.list)).toEqual([40, 140]);
		expect(depths(dropGroup.list)).toEqual([85]);
	});

	test('clearAllXray can clear immediately without fade state', () => {
		const clearAllXray = HexGrid.prototype.clearAllXray as (
			this: { lastXrayHex: unknown; game: { creatures: unknown[] } },
			immediate?: boolean,
		) => void;
		const immediateClear = jest.fn();
		const fadeClear = jest.fn();
		const creatureA = Object.assign(Object.create(Creature.prototype), {
			clearXrayImmediately: immediateClear,
			xray: fadeClear,
		});
		const creatureB = Object.assign(Object.create(Creature.prototype), {
			clearXrayImmediately: jest.fn(),
			xray: jest.fn(),
		});
		const gridMock = {
			lastXrayHex: { x: 2, y: 3 },
			game: {
				creatures: [creatureA, creatureB, null],
			},
		};

		clearAllXray.call(gridMock, true);

		expect(gridMock.lastXrayHex).toBeNull();
		expect(immediateClear).toHaveBeenCalledTimes(1);
		expect(fadeClear).not.toHaveBeenCalled();
		expect(creatureB.clearXrayImmediately).toHaveBeenCalledTimes(1);
		expect(creatureB.xray).not.toHaveBeenCalled();
	});
});

describe('HexGrid display group layering', () => {
	test('the Infernal smoke layer sits below the creatures and is not one of them', () => {
		type MockGroup = {
			name: string;
			parent?: MockGroup;
			children: MockGroup[];
			setScale: jest.Mock;
		};
		const createGroup = (parent?: MockGroup, name = ''): MockGroup => {
			const group: MockGroup = {
				name,
				children: [],
				setScale: jest.fn(),
			};
			if (parent) {
				parent.children.push(group);
				group.parent = parent;
			}
			return group;
		};
		const smokeGameMock = {
			gameEngine: {
				add: { group: jest.fn((parent?: MockGroup, name?: string) => createGroup(parent, name)) },
			},
			channels: createGameChannels(),
			metaPowersState: { executeMonster: false },
		};

		const grid = new HexGrid(
			{ numRows: 2, numCols: 3, isFirstRowFull: true },
			smokeGameMock as never,
		);

		// Smoke must render behind units, so it belongs below the creature layer.
		const names = grid.display.children.map((child) => (child as { name?: string }).name);
		expect(names.indexOf('infernalSmokeGrp')).toBeGreaterThanOrEqual(0);
		expect(names.indexOf('infernalSmokeGrp')).toBeLessThan(names.indexOf('creaturesGrp'));

		// And it is a child of the display group, not of any creature group, so
		// smoke already in the air is not dragged along by a moving unit.
		expect(grid.infernalSmokeGroup.parent).toBe(grid.display);
		expect(grid.infernalSmokeGroup.parent).not.toBe(grid.creatureGroup);
	});

	test('constructor creates drop group below creature group', () => {
		type MockGroup = {
			name: string;
			children: MockGroup[];
			setScale: jest.Mock;
		};

		const createGroup = (parent?: MockGroup, name = ''): MockGroup => {
			const group: MockGroup = {
				name,
				children: [],
				setScale: jest.fn(),
			};
			if (parent) {
				parent.children.push(group);
			}
			return group;
		};

		const gameMock = {
			Phaser: {
				add: {
					group: jest.fn((parent?: MockGroup, name?: string) => createGroup(parent, name)),
				},
			},
			gameEngine: {
				add: {
					group: jest.fn((parent?: MockGroup, name?: string) => createGroup(parent, name)),
				},
			},
			channels: createGameChannels(),
			metaPowersState: {
				executeMonster: false,
			},
		};

		const grid = new HexGrid({ numRows: 2, numCols: 3, isFirstRowFull: true }, gameMock as never);
		const childNames = grid.display.children.map(
			(child) => (child as { name?: string }).name ?? '',
		);

		expect(childNames.indexOf('dropGrp')).toBeGreaterThanOrEqual(0);
		expect(childNames.indexOf('creaturesGrp')).toBeGreaterThanOrEqual(0);
		expect(childNames.indexOf('dropGrp')).toBeLessThan(childNames.indexOf('creaturesGrp'));
	});
});
