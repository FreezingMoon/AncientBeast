import type Phaser from 'phaser';

type Scene = Phaser.Scene;
type Container = Phaser.GameObjects.Container;

/**
 * The board's display layer tree and its depth bands.
 *
 * Phaser 2 CE's `Group` was a transformable, ordered display container, so AB
 * built the board out of nested groups and ordered siblings within each one.
 * Phaser 4's `Group` is only a membership `Set`; the native object with the same
 * role is `Container`, which this module builds each layer as.
 *
 * Two orderings exist and they are not the same thing:
 *
 *  - **Layer order** is the order the layer containers are added to their parent,
 *    given by {@link LAYER_SPEC}. It decides what draws in front of what across
 *    categories: ground traps behind units, Infernal smoke behind the units it
 *    rises from, trap-over art in front of everything on the board.
 *  - **Depth bands** ({@link getDepthAtBand}) decide order *within* a layer.
 *    Phaser 4 renders by `depth`, not list position, so a creature in front of
 *    another creature is a depth comparison even though both are children of the
 *    same container.
 *
 * Because depth is per-row and layered containers are separate subtrees, a
 * creature at a higher row still draws in front of a trap at a lower row, which
 * is the oblique-perspective effect the bands exist to produce.
 */

/**
 * Row depth stride.
 *
 * Each board row gets 100 depth units of its own so that everything on a lower
 * row (nearer the viewer in the oblique projection) draws in front of everything
 * on the rows above it.
 */
export const ROW_DEPTH_STRIDE = 100;

/**
 * Bands within a single row, ordered back to front.
 *
 * The numbers are gaps rather than 0/1/2/3 because trap-volumetric art and the
 * materialise overlays need to land *between* adjacent slots: a volumetric trap
 * that shares a row with a creature is placed at
 * `creature.depth + 0.5 + n * 0.01`, so the band floor has to leave room below
 * the next integer.
 */
export const DEPTH_BAND = {
	TRAP_GROUND: 0,
	EFFECT_UNDER_UNITS: 20,
	UNITS: 40,
	EFFECT_OVER_UNITS: 80,
	DROPS: 85,
	TRAP_VOLUMETRIC: 90,
} as const;

export type DepthBand = keyof typeof DEPTH_BAND;

/**
 * Where the board root sits on screen, and how the grid is squashed.
 *
 * The grid layer is scaled to 0.75 vertically to fake the oblique viewing angle
 * of the board; everything positioned in *board* space must therefore be placed
 * in the unscaled coordinate system, which is why `Hex` keeps an
 * `originalDisplayPos` alongside its squashed `displayPos`.
 */
export const BOARD_ORIGIN_X = 230;
export const BOARD_ORIGIN_Y = 380;
export const BOARD_DEPTH_SCALE_Y = 0.75;

export type LayerName =
	| 'display'
	| 'gridGroup'
	| 'trapGroup'
	| 'hexesGroup'
	| 'displayHexesGroup'
	| 'overlayHexesGroup'
	| 'dropGroup'
	| 'infernalSmokeGroup'
	| 'creatureGroup'
	| 'healthIndicatorUiGroup'
	| 'trapOverGroup';

/**
 * How each layer is created: which group name it carries, which layer is its
 * parent, and its vertical scale.
 *
 * This table is the single source of truth for the board's shape and sibling
 * order, shared by both the native container builder
 * ({@link createBoardLayers}) and the handle-based builder
 * ({@link createBoardLayersWithFactory}) that `HexGrid` uses while the
 * `GameEngine` adapter still exists. One table means the two cannot disagree
 * about order — which is exactly how the smoke layer used to go wrong.
 *
 * It replaces an inline `add.group(...)` sequence that appended the smoke layer
 * *after* the creature layer and then tried to splice it earlier through
 * `display.children`. That getter returned a fresh array built by `map()`, so the
 * splice mutated a throwaway and the smoke layer stayed in front of the creatures
 * it was documented to sit behind. Order comes from the table now, so the
 * documented layout is the real one.
 *
 * `parent: null` marks the board root, whose parent is the scene's world.
 */
export const LAYER_SPEC: ReadonlyArray<{
	name: LayerName;
	groupName: string;
	parent: LayerName | null;
	scaleY?: number;
}> = [
	{ name: 'display', groupName: 'displayGroup', parent: null },
	{ name: 'gridGroup', groupName: 'gridGroup', parent: 'display', scaleY: BOARD_DEPTH_SCALE_Y },
	{ name: 'trapGroup', groupName: 'trapGrp', parent: 'gridGroup' },
	{ name: 'hexesGroup', groupName: 'hexesGroup', parent: 'gridGroup' },
	{ name: 'displayHexesGroup', groupName: 'displayHexesGroup', parent: 'gridGroup' },
	{ name: 'overlayHexesGroup', groupName: 'overlayHexesGroup', parent: 'gridGroup' },
	// Sibling order within `display`, back to front.
	{ name: 'dropGroup', groupName: 'dropGrp', parent: 'display' },
	{ name: 'infernalSmokeGroup', groupName: 'infernalSmokeGrp', parent: 'display' },
	{ name: 'creatureGroup', groupName: 'creaturesGrp', parent: 'display' },
	{ name: 'healthIndicatorUiGroup', groupName: 'healthIndicatorUiGrp', parent: 'display' },
	{
		name: 'trapOverGroup',
		groupName: 'trapOverGrp',
		parent: 'display',
		scaleY: BOARD_DEPTH_SCALE_Y,
	},
];

/**
 * The board's layer tree, as an object keyed by layer name.
 *
 * Generic over the layer type so the same shape describes native
 * `Container`s and the adapter's `GroupHandle`s — the two builders below differ
 * only in how a layer is created, never in what the tree looks like.
 */
export type BoardLayers<TLayer> = { readonly [K in LayerName]: TLayer };

/**
 * Build the board's layer tree from `LAYER_SPEC`, creating each layer through
 * `create`.
 *
 * The single implementation behind both the native container tree and the
 * handle-based tree. Because sibling order comes from the table rather than from
 * the order the call sites happen to run in, the smoke layer genuinely lands
 * below the creature layer instead of needing a post-hoc splice that used to
 * mutate a throwaway array.
 */
function buildLayers<TLayer>(
	create: (spec: (typeof LAYER_SPEC)[number], parent: TLayer | null) => TLayer,
): BoardLayers<TLayer> {
	const built = {} as Record<LayerName, TLayer>;
	for (const spec of LAYER_SPEC) {
		const parent = spec.parent === null ? null : built[spec.parent];
		// `LAYER_SPEC` is ordered so a layer's parent is always built first. Check
		// rather than assume, because "parent not built yet" is otherwise
		// indistinguishable from "layer silently never added to its parent" —
		// which would leave it at the scene origin, rendering in the wrong place.
		if (spec.parent !== null && parent === undefined) {
			throw new Error(`LAYER_SPEC lists "${spec.name}" before its parent "${spec.parent}"`);
		}
		built[spec.name] = create(spec, parent);
	}
	return built as BoardLayers<TLayer>;
}

/**
 * Build the board's layer tree as native Phaser containers under the scene's
 * world root.
 *
 * Every container is created once. Reordering is then a matter of
 * `bringToTop`/`sendToBack`/`sort` on the individual layer, never of rebuilding
 * the tree.
 */
export function createBoardLayers(scene: Scene, world: Container): BoardLayers<Container> {
	const layers = buildLayers<Container>((spec, parent) => {
		const container = scene.add.container(0, 0);
		container.setName(spec.groupName);
		if (spec.name === 'display') {
			container.setPosition(BOARD_ORIGIN_X, BOARD_ORIGIN_Y);
			world.add(container);
		} else if (parent) {
			if (spec.scaleY !== undefined) {
				container.setScale(1, spec.scaleY);
			}
			parent.add(container);
		}
		return container;
	});
	return layers;
}

/**
 * The minimum a handle-based layer must expose for {@link createBoardLayersWithFactory}.
 *
 * `HexGrid` still receives adapter `GroupHandle`s while `GameEngine` exists, so
 * the tree is built through a factory. This is the whole point of the type: the
 * only adapter-specific thing left is container creation.
 */
export interface LayerHandleFactory {
	create(parent: unknown, name: string): LayerHandleLike;
}

/** The transform members a layer handle must expose. */
export interface LayerHandleLike {
	x: number;
	y: number;
	setScale(x: number, y: number): unknown;
}

/**
 * Build the board's layer tree from adapter handles, using the same
 * {@link LAYER_SPEC} as the native path.
 */
export function createBoardLayersWithFactory<TLayer extends LayerHandleLike>(factory: {
	add: { group(parent?: unknown, name?: string): TLayer };
}): BoardLayers<TLayer> {
	return buildLayers<TLayer>((spec, parent) => {
		const layer = factory.add.group(parent ?? undefined, spec.groupName);
		if (spec.name === 'display') {
			layer.x = BOARD_ORIGIN_X;
			layer.y = BOARD_ORIGIN_Y;
		}
		if (spec.scaleY !== undefined) {
			layer.setScale(1, spec.scaleY);
		}
		return layer;
	});
}

/** Depth base index for a board row; rows lower on the board draw in front. */
export function rowDepthBase(y: number): number {
	return y * ROW_DEPTH_STRIDE;
}

/** Depth for a given row, band and within-band slot. */
export function getDepthAtBand(y: number, band: DepthBand, slot = 0): number {
	return rowDepthBase(y) + DEPTH_BAND[band] + slot;
}

/**
 * Sort a layer's children by their `depth`, lowest first (back to front).
 *
 * Phaser 4 renders children in list order, so sorting the list is what makes a
 * depth assignment visible. The existing call sites pass `sort('depth', -1)`
 * because that was Phaser 2's "descending" flag; under Phaser 2's PIXI renderer
 * list order did not affect rendering, so the sign was inert. Carrying it over
 * would invert the board, so the direction is fixed here rather than carried.
 */
export function sortByDepth(container: Container): void {
	// `depth` lives on Phaser's `Depth` component, not on the `GameObject` base
	// class, so the sort reads it structurally.
	const depthOf = (child: Phaser.GameObjects.GameObject): number =>
		Number((child as { depth?: number }).depth ?? 0);
	container.list.sort((a, b) => depthOf(a) - depthOf(b));
}

/**
 * {@link sortByDepth} for a layer that may be a native `Container` or one of the
 * adapter's `GroupHandle`s.
 *
 * The handles are unwrapped here rather than at the call sites so the depth
 * convention — ascending, lowest back — is stated once. It is deliberately the
 * *opposite* of the `sort('depth', -1)` calls this replaces: Phaser 2's `-1`
 * meant "descending", but Phaser 2's renderer ignored list order, so the flag was
 * inert and only its presence mattered. Carrying `-1` over as a real direction
 * would invert the board.
 */
export function sortLayerByDepth(layer: unknown): void {
	const target = (layer as { __unwrapped?: unknown }).__unwrapped ?? layer;
	sortByDepth(target as Container);
}
