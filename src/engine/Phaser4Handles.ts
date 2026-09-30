import type Phaser from 'phaser';
import { getPhaser } from './phaser-runtime';
import { Signal } from '../utility/signal';
import { toTextureKey } from './textureKey';
import type { BitmapDataHandle, GroupHandle, SpriteHandle, TextureKeyLike } from './types';

/**
 * Phaser 4 game object / group / dynamic texture facades.
 *
 * Phaser 4 dropped most of the Phaser 2 CE convenience API that Ancient Beast's
 * gameplay code is written against:
 *
 *  - `sprite.anchor`       -> `setOrigin` / `originX` / `originY`
 *  - `sprite.scale.setTo`  -> `setScale` / `scaleX` / `scaleY`
 *  - `sprite.loadTexture`  -> `setTexture`
 *  - `sprite.inputEnabled` -> `setInteractive` / `disableInteractive`
 *  - `sprite.events.onInputUp.add` -> `on('pointerup')`
 *  - `Group` is only a membership `Set` in Phaser 4: no transform, no ordering,
 *    no `create`. `Container` is the native Phaser 4 object that covers all three,
 *    so groups are containers behind this facade.
 *  - `BitmapData` became `RenderTexture` / `DynamicTexture`, which buffer draw
 *    commands and only upload them on an explicit `render()`.
 *
 * Everything that is not translated is forwarded straight to the real game
 * object, so native Phaser 4 API (`depth`, `setTint`, `setLighting`, filters,
 * …) stays reachable.
 *
 * Render order is the one thing deliberately *not* emulated: Phaser 2 ordered
 * siblings with `Group.sort()`/`bringToTop()`, while Phaser 4 owns render order
 * through the native `depth` property. The ordering helpers below therefore
 * manipulate `depth` and the container's child list.
 */

type AnyObject = Record<string, any>;

/**
 * Wraps a Phaser 4 texture so it answers the Phaser 2 dimension questions.
 *
 * Phaser 2 `Texture` exposed `width`/`height`; Phaser 4 dropped them because a
 * texture is now just a bag of frames. Reads forward to the real texture, and
 * `width`/`height`/`crop`/`baseTexture` are answered from the owning game
 * object's current frame, which is what gameplay code means by them.
 */
function makeTextureView(go: AnyObject): AnyObject {
	return new Proxy({} as AnyObject, {
		get(_t, prop) {
			if (prop === 'width') return go.frame?.width ?? go.width ?? 0;
			if (prop === 'height') return go.frame?.height ?? go.height ?? 0;
			// Phaser 4 `Frame` has no `setTo` (that was a Phaser 2 `Rectangle`
			// API), so the old `go.frame?.setTo ? ...` check always yielded
			// `undefined` and every xray `drawImage` fell back to (0,0,W,H).
			// Expose the live frame for both spellings gameplay code uses.
			if (prop === 'crop') return go.frame ?? undefined;
			if (prop === 'frame') return go.frame ?? undefined;
			if (prop === 'baseTexture') return (go.texture as AnyObject)?.source?.[0];
			if (prop === 'source') return (go.texture as AnyObject)?.source?.[0];
			const real = (go.texture as AnyObject)?.[prop as string];
			return typeof real === 'function' ? real.bind(go.texture) : real;
		},
		has() {
			return true;
		},
	});
}

const wrappers = new WeakMap<object, SpriteHandle | GroupHandle>();

/** Recover the Phaser object behind a facade. */
export function unwrap<T = any>(handle: AnyObject): T {
	return (handle?.__unwrapped ?? handle) as T;
}

// ─── Game object facade ───────────────────────────────────────────────────────

const INPUT_EVENT_BY_HANDLE: Record<string, string> = {
	onInputUp: 'pointerup',
	onInputDown: 'pointerdown',
	onInputOver: 'pointerover',
	onInputOut: 'pointerout',
};

/** Wraps (or returns the existing wrapper for) a Phaser 4 game object. */
export function wrapGameObject(gameObject: Phaser.GameObjects.GameObject): SpriteHandle {
	const existing = wrappers.get(gameObject);
	if (existing) return existing as SpriteHandle;

	// The transform/interaction members live on mixins rather than on the
	// `GameObject` base type, so the facade works off a loose alias internally.
	const go = gameObject as unknown as AnyObject;
	const target = go;
	const signals = new Map<string, Signal>();
	// Values gameplay code stashes on the handle itself (`tween`, custom flags).
	const local = new Map<string, unknown>();

	const signalFor = (event: string): Signal => {
		let signal = signals.get(event);
		if (!signal) {
			signal = new Signal();
			signals.set(event, signal);
			// Phaser 4 emits `(pointer, localX, localY, container)`; Phaser 2 CE
			// dispatched `(sprite, pointer, …)`. Re-order so the handlers written
			// against Phaser 2 keep working.
			// Right-clicks that began on a DOM overlay (scoreboard, music
			// player, …) can still reach canvas listeners via Phaser's
			// window-level mouse handlers (mousedown on the overlay is consumed
			// by the DOM close handler, so the pointer never records a canvas
			// downElement and mouseup retargets to the canvas): Phaser
			// hit-tests canvas coordinates even though the user clicked the
			// overlay. Swallow those here — a genuine canvas gesture always has
			// a canvas downElement; an overlay-originated one doesn't.
			gameObject.on(event, (pointer: unknown, ...rest: unknown[]) => {
				const pointerEvent = pointer as unknown as {
					button?: number;
					downElement?: HTMLElement;
				};
				if (
					pointerEvent &&
					typeof pointerEvent === 'object' &&
					(pointerEvent.button === 2 || pointerEvent.button === 1) &&
					(!pointerEvent.downElement || pointerEvent.downElement.tagName !== 'CANVAS')
				) {
					return;
				}
				signal.dispatch(gameObject, pointer, ...rest);
			});
		}
		return signal;
	};

	const anchor = {
		get x() {
			return go.originX;
		},
		set x(value: number) {
			go.setOrigin(value, go.originY);
		},
		get y() {
			return go.originY;
		},
		set y(value: number) {
			go.setOrigin(go.originX, value);
		},
		setTo: (x: number, y?: number) => go.setOrigin(x, y ?? x),
		set: (x: number, y?: number) => go.setOrigin(x, y ?? x),
	};

	const scale = {
		get x() {
			return go.scaleX;
		},
		set x(value: number) {
			go.setScale(value, go.scaleY);
		},
		get y() {
			return go.scaleY;
		},
		set y(value: number) {
			go.setScale(go.scaleX, value);
		},
		setTo: (x: number, y?: number) => go.setScale(x, y ?? x),
		set: (x: number, y?: number) => go.setScale(x, y ?? x),
	};

	const position = {
		get x() {
			return go.x;
		},
		get y() {
			return go.y;
		},
		set: (x: number, y: number) => go.setPosition(x, y),
		setTo: (x: number, y: number) => go.setPosition(x, y),
		/** Phaser 2 `position` was a `Point`, so gameplay code clones it. */
		clone: () => new (getPhaser().Math.Vector2)(go.x, go.y),
	};

	const input = {
		get useHandCursor() {
			return target.input?.cursor === 'pointer';
		},
		get useHandcursor() {
			return target.input?.cursor === 'pointer';
		},
		set useHandCursor(value: boolean) {
			if (target.input) target.input.cursor = value ? 'pointer' : 'default';
		},
		set useHandcursor(value: boolean) {
			input.useHandCursor = value;
		},
		priorityID: 0,
	};

	const events = {
		onInputUp: signalFor('pointerup'),
		onInputDown: signalFor('pointerdown'),
		onInputOver: signalFor('pointerover'),
		onInputOut: signalFor('pointerout'),
	};

	const facade: AnyObject = {
		__unwrapped: gameObject,

		// ── Phaser 2 identity ─────────────────────────────────────────────
		get exists() {
			return go.active;
		},
		set exists(value: boolean) {
			go.setActive(value);
		},
		get key() {
			return toTextureKey(target.texture?.key);
		},
		get text() {
			return target.text;
		},
		set text(value: string) {
			target.text = value;
		},
		get trace() {
			return { width: go.width, height: go.height };
		},
		/**
		 * Phaser 2's `Texture` carried `width`/`height` for the whole sheet, and
		 * AB positions sprites from it (`sprite.texture.width / 2` to centre,
		 * `-sprite.texture.height` to sit on a hex). Phaser 4's `Texture` is a
		 * key/frame index with no dimensions, so the view adds them back from the
		 * game object's current frame — which is what every one of those call
		 * sites actually means.
		 */
		get texture(): AnyObject {
			if (!local.has('textureView')) local.set('textureView', makeTextureView(go));
			return local.get('textureView') as AnyObject;
		},
		get parent() {
			const parent = target.parentContainer ?? target.parentList;
			return parent ? wrappers.get(parent) ?? parent : null;
		},

		// ── Transform helpers ─────────────────────────────────────────────
		get anchor() {
			return anchor;
		},
		set anchor(value: { x: number; y?: number }) {
			anchor.setTo(value.x, value.y ?? value.x);
		},
		get scale() {
			return scale;
		},
		set scale(value: { x: number; y?: number }) {
			scale.setTo(value.x, value.y ?? value.x);
		},
		get position() {
			return position;
		},
		set position(value: { x: number; y: number }) {
			position.set(value.x, value.y);
		},

		// Phaser 4's Alpha component clears bit 2 (renderFlags &= ~2) when alpha is 0,
		// making willRender() return false and blocking inputCandidate(). Restore the
		// full render mask so invisible-but-interactive objects (e.g. hex hitBoxes)
		// still receive pointer events.
		get alpha() {
			return go.alpha;
		},
		set alpha(value: number) {
			go.alpha = value;
			go.renderFlags = 15;
		},

		// ── Texture / input ──────────────────────────────────────────────
		// Accepts a live `BitmapDataHandle` as well as a key: the CPU-drawn
		// surfaces (plasma field, x-ray, haze) are attached this way.
		loadTexture: (key: TextureKeyLike, frame?: string) => go.setTexture(toTextureKey(key), frame),
		get inputEnabled() {
			return Boolean(target.input);
		},
		set inputEnabled(value: boolean) {
			if (value) {
				go.setInteractive();
			} else {
				go.disableInteractive();
			}
		},
		input,
		get hitArea() {
			return target.input?.hitArea;
		},
		/**
		 * Phaser 4 no longer maps a shape to its `contains` test automatically,
		 * so the geometry's own `contains` is wired up as the hit area callback.
		 */
		set hitArea(value: AnyObject) {
			if (!value) return;
			const io = target.input;
			if (io) {
				io.hitArea = value;
				io.customHitArea = true;
				if (typeof value.contains === 'function') {
					io.hitAreaCallback = (_hitArea: unknown, x: number, y: number) => value.contains(x, y);
				}
			} else {
				const contains =
					typeof value.contains === 'function'
						? (_x: number, _y: number) => value.contains(_x, _y)
						: undefined;
				gameObject.scene?.input?.setHitArea(gameObject, value, contains);
			}
		},
		// Phaser 2 groups did not forward pointer events to their children;
		// Phaser 4 has no equivalent toggle, so the flag is accepted as a no-op.
		get ignoreChildInput() {
			return true;
		},
		set ignoreChildInput(_value: boolean) {},
		events,

		/**
		 * Phaser 2 gave every game object a `DataManager` at `.data`, always
		 * present and freely writable — AB stashes per-object bookkeeping there
		 * (hint kinds, tween handles, sprite state). Phaser 4 dropped it and
		 * leaves `GameObject.data` as `null`, so a lazily-created plain object
		 * stands in. `destroy()` intentionally leaves it alone: AB reads stale
		 * hints off destroyed objects to clean them up.
		 */
		get data(): AnyObject {
			let bag = local.get('data') as AnyObject | undefined;
			if (!bag) {
				bag = {};
				local.set('data', bag);
			}
			return bag;
		},
		set data(value: AnyObject) {
			local.set('data', value ?? {});
		},

		// ── Lifecycle ────────────────────────────────────────────────────
		kill: () => {
			go.setActive(false);
			go.setVisible(false);
		},
		revive: () => {
			go.setActive(true);
			go.setVisible(true);
		},
		alignIn: (center?: AnyObject, align?: number) => alignIn(go, center, align),
	};

	const proxy = createProxy(facade, local, target);
	wrappers.set(gameObject, proxy as SpriteHandle);
	return proxy as SpriteHandle;
}

/**
 * Phaser 2 Graphics methods that were renamed in Phaser 4.
 *
 * Phaser 2 used the PixiJS-style drawing API: `beginFill`/`endFill` bracket
 * a shape, then `drawCircle`/`drawRect` emit it. Phaser 4 split these into
 * one-shot `fillStyle` + `fillCircle`/`fillRect`. `endFill` has no direct
 * equivalent, but its semantics — close and reset the current path — map to
 * Phaser 4's `beginPath`, which clears the buffered path so that subsequent
 * `strokePath` calls don't re-render stale shape points.
 */
const graphicsMethodMap: Record<string, string> = {
	beginFill: 'fillStyle',
	drawCircle: 'fillCircle',
	drawRect: 'fillRect',
	endFill: 'beginPath',
};

/**
 * Methods that alter drawing state. In Phaser 2 each call rendered the
 * current path immediately (PixiJS was immediate mode); in Phaser 4 paths are
 * buffered until `strokePath` is invoked. To keep the visual output identical,
 * any pending path is flushed before a state change so buffered line segments
 * are rendered with their original stroke style.
 */
const graphicsPathFlushBefore = new Set(['lineStyle', 'beginFill']);

/**
 * Builds the forwarding proxy.
 *
 * Reads/writes resolve in this order: the facade's own properties, values
 * stashed on the handle, then the real Phaser game object.
 */
function createProxy(facade: AnyObject, local: Map<string, unknown>, target: AnyObject): AnyObject {
	return new Proxy(facade, {
		get(facadeTarget, prop, receiver) {
			const key = prop as string;
			// The facade wins: it may hold accessors (e.g. `data`) that also
			// shadow a stashed value of the same name.
			if (key in facadeTarget) {
				return Reflect.get(facadeTarget, prop, receiver);
			}
			// Values gameplay code stashed on the handle itself. `set` routes
			// unknown keys here, so they must be read back from here too —
			// `Reflect.get` on the facade would always miss them and silently
			// return undefined.
			if (local.has(key)) {
				return local.get(key);
			}
			const targetKey = graphicsMethodMap[key] ?? key;
			const value = target[targetKey];
			if (typeof value !== 'function') {
				return value;
			}
			if (graphicsPathFlushBefore.has(key)) {
				const bound = value.bind(target);
				return (...args: unknown[]) => {
					if (typeof target.strokePath === 'function') {
						target.strokePath();
					}
					return bound(...args);
				};
			}
			return value.bind(target);
		},
		set(facadeTarget, prop, value) {
			const key = prop as string;
			if (key in facadeTarget) {
				return Reflect.set(facadeTarget, prop, value);
			}
			// Native Phaser 4 concepts (depth, tint, lighting, filters, …) must
			// land on the real game object so the render pipeline sees them.
			const targetKey = graphicsMethodMap[key] ?? key;
			if (targetKey in target) {
				target[targetKey] = value;
			} else {
				local.set(key, value);
			}
			return true;
		},
		has(facadeTarget, prop) {
			const key = prop as string;
			const targetKey = graphicsMethodMap[key] ?? key;
			return key in facadeTarget || local.has(key) || targetKey in target;
		},
	});
}

/**
 * Phaser 2 alignment constants (`Phaser.TOP_LEFT` … `Phaser.BOTTOM_RIGHT`).
 * Phaser 4 dropped them, but AB's call sites still pass the Phaser 2 values
 * (e.g. `Phaser.CENTER`, which is 6 — *not* 4), so they are pinned here.
 */
export const ALIGN_TOP_LEFT = 0;
const ALIGN_TOP_CENTER = 1;
const ALIGN_TOP_RIGHT = 2;
const ALIGN_LEFT_CENTER = 4;
/** Phaser 2's `Phaser.CENTER`. */
export const ALIGN_CENTER = 6;
const ALIGN_RIGHT_CENTER = 8;
const ALIGN_BOTTOM_LEFT = 10;
const ALIGN_BOTTOM_CENTER = 11;
const ALIGN_BOTTOM_RIGHT = 12;

/**
 * Phaser 2 bounds of a display object.
 *
 * Phaser 2 defined these as `x - anchor * size` (i.e. offset from the object's
 * position by its anchor), which is exactly Phaser 4's `displayOrigin`, so the
 * two agree. A `Phaser.Geom.Rectangle` has no origin, so it is used as-is.
 */
function phaser2Bounds(source: AnyObject) {
	const width = Number(source.width ?? 0);
	const height = Number(source.height ?? 0);
	if (source.displayOriginX === undefined && source.displayOriginY === undefined) {
		return { left: Number(source.x ?? 0), top: Number(source.y ?? 0), width, height };
	}
	const left = Number(source.x ?? 0) - Number(source.displayOriginX ?? 0);
	const top = Number(source.y ?? 0) - Number(source.displayOriginY ?? 0);
	return { left, top, width, height };
}

/**
 * Phaser 2 `DisplayObject.alignIn(container, position, offsetX, offsetY)`.
 *
 * Faithful port: Phaser 2 aligned on the *visual* bounds of both objects, where
 * a centre is `(x - anchor * size) + size / 2`. The previous implementation read
 * the container's raw `x`/`y` (Phaser 4 Game Objects expose no `midPoint`) and
 * then subtracted the aligned sprite's own origin, which misplaced every
 * aligned sprite by half its size in both axes.
 */
function alignIn(gameObject: AnyObject, container?: AnyObject, position?: number): void {
	if (!container) return;

	const offsetX = 0;
	const offsetY = 0;
	const other = phaser2Bounds(container);
	const self = phaser2Bounds(gameObject);
	const centerX = other.left + other.width * 0.5;
	const centerY = other.top + other.height * 0.5;

	// Phaser 2 setters, e.g. `left`: x = value + offsetX, where
	// offsetX = anchor * width — which is exactly Phaser 4's `displayOriginX`.
	const originX = Number(gameObject.displayOriginX ?? 0);
	const originY = Number(gameObject.displayOriginY ?? 0);
	const setLeft = (v: number) => gameObject.setPosition(v + originX, Number(gameObject.y ?? 0));
	const setTop = (v: number) => gameObject.setPosition(Number(gameObject.x ?? 0), v + originY);
	const setRight = (v: number) => setLeft(v - self.width);
	const setBottom = (v: number) => setTop(v - self.height);
	/** Phaser 2 centre setters, expressed via the same bounds maths. */
	const setCenterX = (v: number) => setLeft(v - self.width * 0.5);
	const setCenterY = (v: number) => setTop(v - self.height * 0.5);

	switch (position) {
		default:
		case ALIGN_TOP_LEFT:
			setLeft(other.left - offsetX);
			setTop(other.top - offsetY);
			break;
		case ALIGN_TOP_CENTER:
			setCenterX(centerX + offsetX);
			setTop(other.top - offsetY);
			break;
		case ALIGN_TOP_RIGHT:
			setRight(other.left + other.width - offsetX);
			setTop(other.top - offsetY);
			break;
		case ALIGN_LEFT_CENTER:
			setLeft(other.left - offsetX);
			setCenterY(centerY + offsetY);
			break;
		case ALIGN_CENTER:
			setCenterX(centerX + offsetX);
			setCenterY(centerY + offsetY);
			break;
		case ALIGN_RIGHT_CENTER:
			setRight(other.left + other.width - offsetX);
			setCenterY(centerY + offsetY);
			break;
		case ALIGN_BOTTOM_LEFT:
			setLeft(other.left - offsetX);
			setBottom(other.top + other.height - offsetY);
			break;
		case ALIGN_BOTTOM_CENTER:
			setCenterX(centerX + offsetX);
			setBottom(other.top + other.height - offsetY);
			break;
		case ALIGN_BOTTOM_RIGHT:
			setRight(other.left + other.width - offsetX);
			setBottom(other.top + other.height - offsetY);
			break;
	}
}

// ─── Manual world transform (workaround for Phaser 4.2.1 getWorldPoint bug) ─────

/**
 * Manually computes the world position of a point in a container's local space
 * by walking up the parent container chain and applying transforms.
 * This works around a bug in Phaser 4.2.1 where getWorldPoint fails with
 * "tempMatrix.applyITRS is not a function".
 */
function getWorldPointManual(
	container: Phaser.GameObjects.Container,
	x: number,
	y: number,
): Phaser.Math.Vector2 {
	let current: Phaser.GameObjects.Container | null = container;
	let wx = x;
	let wy = y;

	while (current) {
		// Apply current container's transform
		const rotation = current.rotation ?? 0;
		const scaleX = current.scaleX ?? 1;
		const scaleY = current.scaleY ?? 1;
		const tx = current.x ?? 0;
		const ty = current.y ?? 0;

		// Apply rotation and scale
		const cos = Math.cos(rotation);
		const sin = Math.sin(rotation);
		const rx = wx * cos * scaleX - wy * sin * scaleY;
		const ry = wx * sin * scaleX + wy * cos * scaleY;

		// Apply translation
		wx = rx + tx;
		wy = ry + ty;

		// Move to parent container
		current = current.parentContainer;
	}

	return new (getPhaser().Math.Vector2)(wx, wy);
}

/**
 * Manually computes the local position of a world point in a container's space
 * by walking up the parent container chain and applying inverse transforms.
 * This works around a bug in Phaser 4.2.1 where getLocalPoint fails with
 * "tempMatrix.applyITRS is not a function" (via getWorldTransformMatrix).
 */
function getLocalPointManual(
	container: Phaser.GameObjects.Container,
	x: number,
	y: number,
): Phaser.Math.Vector2 {
	// First, get the world transform of the container
	let current: Phaser.GameObjects.Container | null = container;
	const transforms: Array<{
		x: number;
		y: number;
		rotation: number;
		scaleX: number;
		scaleY: number;
	}> = [];

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

	// Apply inverse transforms in reverse order (from root to container)
	let lx = x;
	let ly = y;

	for (let i = transforms.length - 1; i >= 0; i--) {
		const t = transforms[i];
		// Translate to origin
		lx -= t.x;
		ly -= t.y;

		// Apply inverse rotation and scale
		const cos = Math.cos(-t.rotation);
		const sin = Math.sin(-t.rotation);
		const invScaleX = 1 / t.scaleX;
		const invScaleY = 1 / t.scaleY;

		const rx = lx * cos * invScaleX - ly * sin * invScaleY;
		const ry = lx * sin * invScaleX + ly * cos * invScaleY;

		lx = rx;
		ly = ry;
	}

	// Note: We don't handle display origin here since the facade's position
	// already accounts for it. The Phaser 2 compatible behavior is expected.
	return new (getPhaser().Math.Vector2)(lx, ly);
}

// ─── Group facade (backed by a Phaser 4 Container) ───────────────────────────

/**
 * Phaser 2 `Group` was an ordered, transformable display container. Phaser 4
 * `Group` is only a membership `Set`. `Container` is the native Phaser 4 object
 * that matches Phaser 2's behaviour, so that is what backs this facade.
 */
export function wrapGroup(container: Phaser.GameObjects.Container): GroupHandle {
	const existing = wrappers.get(container);
	if (existing) return existing as GroupHandle;

	const target = container as unknown as AnyObject;

	// Phaser 2 groups exposed Phaser 2 point-like objects; Phaser 4 containers
	// expose plain numbers plus setters, so the accessor shape is bridged here.
	const anchor = {
		get x() {
			return target.originX;
		},
		set x(value: number) {
			target.setOrigin(value, target.originY);
		},
		get y() {
			return target.originY;
		},
		set y(value: number) {
			target.setOrigin(target.originX, value);
		},
		setTo: (x: number, y?: number) => target.setOrigin(x, y ?? x),
		set: (x: number, y?: number) => target.setOrigin(x, y ?? x),
	};
	const scale = {
		get x() {
			return target.scaleX;
		},
		set x(value: number) {
			target.setScale(value, target.scaleY);
		},
		get y() {
			return target.scaleY;
		},
		set y(value: number) {
			target.setScale(target.scaleX, value);
		},
		setTo: (x: number, y?: number) => target.setScale(x, y ?? x),
		set: (x: number, y?: number) => target.setScale(x, y ?? x),
	};
	const position = {
		get x() {
			return target.x;
		},
		get y() {
			return target.y;
		},
		set: (x: number, y: number) => target.setPosition(x, y),
		setTo: (x: number, y: number) => target.setPosition(x, y),
	};

	const facade: AnyObject = {
		__unwrapped: container,

		get anchor() {
			return anchor;
		},
		set anchor(value: { x: number; y?: number }) {
			anchor.setTo(value.x, value.y ?? value.x);
		},
		get scale() {
			return scale;
		},
		set scale(value: { x: number; y?: number }) {
			scale.setTo(value.x, value.y ?? value.x);
		},
		get position() {
			return position;
		},
		set position(value: { x: number; y: number }) {
			position.set(value.x, value.y);
		},
		/**
		 * The group this container was added to, as a facade. Phaser 4 renamed
		 * Phaser 2's `parent` to `parentContainer`, and without this the lookup
		 * fell through to the raw object (always `undefined` on a Container), so
		 * every `group.parent?.removeChild(group)` teardown silently did nothing
		 * and left the group rendering in the scene.
		 */
		get parent() {
			const parent = container.parentContainer;
			return parent ? (wrappers.get(parent) as GroupHandle | undefined) ?? parent : null;
		},
		get children() {
			return container.list.map((child) => wrapGameObject(child));
		},
		get length() {
			return container.list.length;
		},
		get exists() {
			return container.active;
		},
		set exists(value: boolean) {
			container.setActive(value);
		},

		create: (x: number, y: number, key: TextureKeyLike, frame?: string, exists?: boolean) => {
			const child = container.scene.add.sprite(x, y, toTextureKey(key), frame);
			if (exists === false) child.setActive(false);
			container.add(child);
			return wrapGameObject(child);
		},
		add: (child: AnyObject) => {
			container.add(unwrap(child));
			return child;
		},
		addChild: (child: AnyObject) => container.add(unwrap(child)),
		addAt: (child: AnyObject, index: number) => {
			container.addAt(unwrap(child), index);
			return child;
		},
		remove: (child: AnyObject, destroy?: boolean) => {
			container.remove(unwrap(child), destroy);
		},
		removeChild: (child: AnyObject, destroy?: boolean) => {
			container.remove(unwrap(child), destroy);
		},
		removeAll: (destroy?: boolean) => {
			container.removeAll(destroy);
		},
		forEach: (callback: (child: AnyObject) => void, context?: AnyObject) => {
			container.each((child) => callback.call(context, wrapGameObject(child)));
		},
		update: () => {
			container.iterate((child) => child.preUpdate?.(0, 0));
		},

		// Render order: Phaser 4 owns it through the native `depth` property.
		sort: (property = 'depth', order = 1) => sortChildrenByDepth(container, property, order),
		getChildIndex: (child: AnyObject) => {
			const target = unwrap<AnyObject>(child);
			if (!container.list.includes(target as Phaser.GameObjects.GameObject)) {
				throw new Error('Child is not a member of this group');
			}
			return target.depth;
		},
		setChildIndex: (child: AnyObject, index: number) => {
			unwrap<AnyObject>(child).setDepth(index);
		},
		// Phaser 2 re-ordered siblings inside the group; the container's own
		// ordering methods do exactly that, and leave `depth` alone so the
		// hex grid's depth bands stay authoritative.
		bringToTop: (child: AnyObject) => container.bringToTop(unwrap(child)),
		sendToBack: (child: AnyObject) => container.sendToBack(unwrap(child)),

		toLocal: (worldPos: AnyObject, output?: AnyObject) => {
			const point = getLocalPointManual(container, worldPos.x, worldPos.y);
			return output ? Object.assign(output, { x: point.x, y: point.y }) : point;
		},
		toGlobal: (localPos: AnyObject, output?: AnyObject) => {
			const point = getWorldPointManual(container, localPos.x, localPos.y);
			return output ? Object.assign(output, { x: point.x, y: point.y }) : point;
		},
		alignIn: (center?: AnyObject, align?: number) => alignIn(target, center, align),
	};

	const proxy = createProxy(facade, new Map(), target);
	wrappers.set(container, proxy as GroupHandle);
	return proxy as GroupHandle;
}

/**
 * Phaser 2 `Group.sort(property, order)` re-ordered siblings by a property.
 * Phaser 4 containers render in list order (first = back, last = front/on top),
 * so sorting the list is what makes the new order visible; the `depth` values
 * themselves are left untouched so they stay the single source of truth.
 *
 * Phaser 2 called `sort('z', -1)` (descending). Under Phaser 2's PIXI renderer
 * the list order didn't affect rendering, so -1 was harmless. Under Phaser 4's
 * list-order rendering, -1 would put higher-depth objects at the back —
 * inverted. We flip the direction so the existing -1 call sites produce
 * ascending order: lower depth first (back), higher depth last (on top).
 */
function sortChildrenByDepth(
	container: Phaser.GameObjects.Container,
	property: string,
	order: number,
): void {
	const direction = order < 0 ? 1 : -1;
	container.list.sort((a, b) => {
		const left = Number((a as AnyObject)[property] ?? 0);
		const right = Number((b as AnyObject)[property] ?? 0);
		return (left - right) * direction;
	});
}

// ─── DynamicTexture facade ────────────────────────────────────────────────────

/**
 * Phaser 2 `BitmapData` was a plain offscreen 2D canvas that gameplay code drew
 * into with raw canvas ops (`getImageData` / `putImageData` / `drawImage`).
 *
 * Phaser 4 has no equivalent. `RenderTexture` is the closest display object,
 * but under the WebGL renderer its `DynamicTexture.canvas` is `null` — the
 * draw calls are buffered in a WebGL command buffer instead, so there is no
 * 2D context to hand out. The only Phaser 4 texture with a real 2D context is a
 * `CanvasTexture`, obtained through `textures.createCanvas(key, w, h)`.
 *
 * So the surface is a `CanvasTexture` (real 2D context, and the thing a sprite
 * samples), and the facade exposes it under Phaser 2's `BitmapData` shape.
 * `CanvasTexture.update()` re-uploads the canvas to the GPU; Phaser 2's
 * equivalent flush point was an explicit draw, so `update()`/`dirty = true`
 * both funnel here.
 */
export class DynamicTextureAdapter implements BitmapDataHandle {
	readonly textureKey: string;
	readonly canvasTexture: Phaser.Textures.CanvasTexture;
	readonly canvas: HTMLCanvasElement;
	readonly ctx: CanvasRenderingContext2D;
	readonly context: CanvasRenderingContext2D;
	readonly width: number;
	readonly height: number;

	private _dirty = false;

	constructor(
		private readonly textureManager: Phaser.Textures.TextureManager,
		width: number,
		height: number,
	) {
		// AB creates many short-lived bitmaps (trails, plasma, per-hex masks), so
		// the key only needs to be unique among live bitmaps.
		let n = DynamicTextureAdapter.nextId++;
		let canvasTexture = textureManager.createCanvas(`__ab_bmp_${n}`, width, height);
		// `createCanvas` returns null if the key is already taken or the manager
		// is out of canvas slots; retry rather than handing back a broken handle.
		while (!canvasTexture && n < DynamicTextureAdapter.nextId + 64) {
			n = DynamicTextureAdapter.nextId++;
			canvasTexture = textureManager.createCanvas(`__ab_bmp_${n}`, width, height);
		}
		if (!canvasTexture) {
			throw new Error('Phaser4Handles: could not create a CanvasTexture for BitmapData');
		}

		this.canvasTexture = canvasTexture;
		this.textureKey = canvasTexture.key;
		this.canvas = canvasTexture.canvas;
		this.ctx = canvasTexture.getContext();
		this.context = this.ctx;
		this.width = width;
		this.height = height;
	}

	private static nextId = 1;

	get texture(): Phaser.Textures.CanvasTexture {
		return this.canvasTexture;
	}

	get dirty(): boolean {
		return this._dirty;
	}

	set dirty(value: boolean) {
		this._dirty = value;
		// Phaser 4 only uploads a `CanvasTexture` when `update()` is called, so
		// marking the surface dirty is the flush trigger.
		if (value) this.update();
	}

	/** Uploads the canvas contents to the GPU. */
	update(): void {
		this.canvasTexture.update();
		this._dirty = false;
	}

	/**
	 * Draws a texture from the texture manager onto this bitmap data.
	 * Mirrors Phaser 2's BitmapData.draw(key, x, y) method.
	 */
	draw(key: string, x: number, y: number): void {
		const texture = this.textureManager.get(key);
		if (!texture) {
			console.warn(`BitmapData.draw: texture "${key}" not found`);
			return;
		}
		// Get the source image/canvas from the texture
		const source = texture.getSourceImage?.();
		if (!source) {
			console.warn(`BitmapData.draw: texture "${key}" has no source image`);
			return;
		}
		// Draw the source onto our canvas at the specified position
		// Handle different source types: HTMLImageElement, HTMLCanvasElement, or RenderTexture
		let drawSource: CanvasImageSource | null = null;
		if (source instanceof HTMLImageElement || source instanceof HTMLCanvasElement) {
			drawSource = source;
		} else if ('canvas' in source && source.canvas instanceof HTMLCanvasElement) {
			// RenderTexture has a canvas property
			drawSource = source.canvas;
		}
		if (!drawSource) {
			console.warn(`BitmapData.draw: texture "${key}" source type not supported for drawing`);
			return;
		}
		this.ctx.drawImage(drawSource, x, y);
		this.dirty = true;
	}

	destroy(): void {
		this.textureManager.remove(this.textureKey);
		this._dirty = false;
	}
}
