import type Phaser from 'phaser';

type Container = Phaser.GameObjects.Container;

/**
 * Alignment constants.
 *
 * Phaser 2 CE defined a 3x3 grid of `Phaser.TOP_LEFT` … `Phaser.BOTTOM_RIGHT`
 * constants and `DisplayObject#alignIn(container, position)`. Phaser 4 dropped
 * both. AB still wants the same nine anchors, so the numbering is kept here as
 * plain exported constants and the alignment maths lives in
 * {@link alignIn}, which sets origin and position in one call.
 *
 * The values are the Phaser 2 ones, and they are *not* contiguous: there are
 * gaps (3, 5, 7, 9) where Phaser 2 stored centre-only anchors. A couple of them
 * do not appear anywhere in AB, but the full set is exported so a future call
 * site can use the same numbering it used before.
 */
export const ALIGN_TOP_LEFT = 0;
export const ALIGN_TOP_CENTER = 1;
export const ALIGN_TOP_RIGHT = 2;
export const ALIGN_LEFT_CENTER = 4;
/** Phaser 2's `Phaser.CENTER`. */
export const ALIGN_CENTER = 6;
export const ALIGN_RIGHT_CENTER = 8;
export const ALIGN_BOTTOM_LEFT = 10;
export const ALIGN_BOTTOM_CENTER = 11;
export const ALIGN_BOTTOM_RIGHT = 12;

export type Align = number;

/**
 * The transform surface the alignment maths needs.
 *
 * Structural rather than `GameObject`: a `Geom.Rectangle` has `x`/`y` but no
 * origin at all, and a `Text` has `width`/`height` that come from its metrics
 * rather than a texture. Both are legitimate alignment targets, so the helpers
 * take what they read and nothing more.
 */
type Positionable = {
	x: number;
	y: number;
	width: number;
	height: number;
	displayOriginX?: number;
	displayOriginY?: number;
	setPosition?: (x?: number, y?: number, z?: number, w?: number) => unknown;
	setOrigin?: (x?: number, y?: number) => unknown;
};

/**
 * Move an object, preferring `setPosition`.
 *
 * Phaser 4's `Transform#x`/`y` are plain writable properties, so direct
 * assignment is a valid fallback for the non-Game-Object targets above; the
 * method is used when present so a real Game Object keeps its own bookkeeping.
 */
function setPosition(target: Positionable, x: number, y: number): void {
	if (typeof target.setPosition === 'function') {
		target.setPosition(x, y);
		return;
	}
	target.x = x;
	target.y = y;
}

/**
 * The visual bounds of a display object, matching Phaser 2's `getBounds()`.
 *
 * Phaser 2 defined bounds as `x - anchor * size`; Phaser 4 exposes exactly that
 * quantity as `displayOriginX`/`displayOriginY`, so the two definitions agree and
 * no conversion is needed. Objects without the origin mixin (a bare
 * `Geom.Rectangle`, for instance) fall back to raw `x`/`y`.
 */
function visualBounds(source: Partial<Positionable>): {
	left: number;
	top: number;
	width: number;
	height: number;
} {
	const width = Number(source.width ?? 0);
	const height = Number(source.height ?? 0);

	if (source.displayOriginX === undefined && source.displayOriginY === undefined) {
		return { left: Number(source.x ?? 0), top: Number(source.y ?? 0), width, height };
	}

	return {
		left: Number(source.x ?? 0) - Number(source.displayOriginX ?? 0),
		top: Number(source.y ?? 0) - Number(source.displayOriginY ?? 0),
		width,
		height,
	};
}

/**
 * Align `gameObject` inside `container` at one of the {@link ALIGN_*} anchors.
 *
 * Port of Phaser 2's `DisplayObject#alignIn`, which aligned on the *visual*
 * bounds of both objects: a container's centre is
 * `(left + width / 2, top + height / 2)`, and setting the child's left edge to a
 * given value means `x = value + displayOriginX`.
 *
 * Note this only moves the object; it never changes its origin. Call sites that
 * need a particular origin set it with `setOrigin` first, which is what makes
 * the fake-anchor `x`/`y` rewriting (and its silent corruption of every plain
 * `.x` read) unnecessary.
 */
export function alignIn(
	gameObject: Positionable,
	container: Partial<Positionable> | undefined | null,
	align: Align = ALIGN_CENTER,
): void {
	if (!container) {
		return;
	}

	const other = visualBounds(container);
	const self = visualBounds(gameObject);
	const centerX = other.left + other.width * 0.5;
	const centerY = other.top + other.height * 0.5;

	// Setting the rendered left/top edge to `v` means positioning at
	// `v + displayOrigin`, which is exactly Phaser 4's origin offset.
	const originX = Number(gameObject.displayOriginX ?? 0);
	const originY = Number(gameObject.displayOriginY ?? 0);
	const setLeft = (v: number) => setPosition(gameObject, v + originX, Number(gameObject.y ?? 0));
	const setTop = (v: number) => setPosition(gameObject, Number(gameObject.x ?? 0), v + originY);
	const setRight = (v: number) => setLeft(v - self.width);
	const setBottom = (v: number) => setTop(v - self.height);
	const setCenterX = (v: number) => setLeft(v - self.width * 0.5);
	const setCenterY = (v: number) => setTop(v - self.height * 0.5);

	switch (align) {
		case ALIGN_TOP_LEFT:
			setLeft(other.left);
			setTop(other.top);
			break;
		case ALIGN_TOP_CENTER:
			setCenterX(centerX);
			setTop(other.top);
			break;
		case ALIGN_TOP_RIGHT:
			setRight(other.left + other.width);
			setTop(other.top);
			break;
		case ALIGN_LEFT_CENTER:
			setLeft(other.left);
			setCenterY(centerY);
			break;
		case ALIGN_CENTER:
			setCenterX(centerX);
			setCenterY(centerY);
			break;
		case ALIGN_RIGHT_CENTER:
			setRight(other.left + other.width);
			setCenterY(centerY);
			break;
		case ALIGN_BOTTOM_LEFT:
			setLeft(other.left);
			setBottom(other.top + other.height);
			break;
		case ALIGN_BOTTOM_CENTER:
			setCenterX(centerX);
			setBottom(other.top + other.height);
			break;
		case ALIGN_BOTTOM_RIGHT:
			setRight(other.left + other.width);
			setBottom(other.top + other.height);
			break;
		default:
			setLeft(other.left);
			setTop(other.top);
			break;
	}
}

/**
 * Pin a sprite's rendered top-left to the given point.
 *
 * Phaser 2 sprites defaulted to a centred origin while AB authored the hex
 * artwork against a top-left one, so hexes were pinned with
 * `anchor.setTo(0, 0); x = …; y = …`. With a real origin that has to be one
 * `setOrigin(0, 0)` followed by a `setPosition`, done together so the object is
 * never momentarily offset by half its texture.
 */
export function pinTopLeft(sprite: Positionable, x: number, y: number): Positionable {
	if (typeof sprite.setOrigin === 'function') {
		sprite.setOrigin(0, 0);
	}
	setPosition(sprite, x, y);
	return sprite;
}

/**
 * The world-space point of a container-local point.
 *
 * Phaser 4.2.1's `Transform#getWorldPoint` throws
 * (`tempMatrix.applyITRS is not a function`) on a container that has never been
 * rendered, which is exactly the case for objects a headless run creates. This
 * walks the parent chain and applies each transform instead, so it works before
 * the first render frame.
 */
export function getWorldPoint(
	container: Container,
	x: number,
	y: number,
): { x: number; y: number } {
	let current: Container | null = container;
	let worldX = x;
	let worldY = y;

	while (current) {
		const rotation = current.rotation ?? 0;
		const scaleX = current.scaleX ?? 1;
		const scaleY = current.scaleY ?? 1;
		const cos = Math.cos(rotation);
		const sin = Math.sin(rotation);

		// Rotate then scale, then translate: ITRS order, matching Phaser's own
		// `applyITRS`.
		const rotatedX = worldX * cos * scaleX - worldY * sin * scaleY;
		const rotatedY = worldX * sin * scaleX + worldY * cos * scaleY;

		worldX = rotatedX + (current.x ?? 0);
		worldY = rotatedY + (current.y ?? 0);

		current = current.parentContainer;
	}

	return { x: worldX, y: worldY };
}

/**
 * The container-local point for a world-space point — the inverse of
 * {@link getWorldPoint}, and subject to the same Phaser 4.2.1 caveat.
 */
export function getLocalPoint(
	container: Container,
	x: number,
	y: number,
): { x: number; y: number } {
	const transforms: Array<{
		x: number;
		y: number;
		rotation: number;
		scaleX: number;
		scaleY: number;
	}> = [];

	let current: Container | null = container;
	while (current) {
		transforms.push({
			x: current.x ?? 0,
			y: current.y ?? 0,
			rotation: current.rotation ?? 0,
			scaleX: current.scaleX ?? 1,
			scaleY: current.scaleY ?? 1,
		});
		current = current.parentContainer;
	}

	let localX = x;
	let localY = y;

	// Undo the outermost transform first, so walk the chain back to front.
	for (let i = transforms.length - 1; i >= 0; i--) {
		const t = transforms[i];
		localX -= t.x;
		localY -= t.y;

		const cos = Math.cos(-t.rotation);
		const sin = Math.sin(-t.rotation);
		const invScaleX = 1 / t.scaleX;
		const invScaleY = 1 / t.scaleY;

		const rotatedX = localX * cos * invScaleX - localY * sin * invScaleY;
		const rotatedY = localX * sin * invScaleX + localY * cos * invScaleY;

		localX = rotatedX;
		localY = rotatedY;
	}

	return { x: localX, y: localY };
}
