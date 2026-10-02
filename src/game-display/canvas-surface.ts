import type Phaser from 'phaser';

/**
 * CPU-drawn drawing surfaces.
 *
 * Phaser 2 CE had a `BitmapData` class and AB used it for everything the GPU
 * could not express directly: the plasma shield, the Cycloper's tile dissolve,
 * per-frame cardboard glows, the x-ray mask. Phaser 4 has no such class. The
 * two things that survive are a real 2D canvas to draw into and a texture key to
 * hand a sprite, which is what `Phaser.Textures.CanvasTexture` already is.
 *
 * So the migration is not a re-implementation. It is a small, typed owner for
 * one canvas texture plus the two operations AB kept doing by hand anyway:
 * committing the drawing to the GPU, and releasing the texture.
 */

/**
 * A CPU-drawn surface.
 *
 * Deliberately not Phaser's own type: the headless runner has no Phaser at all
 * and still needs a drawable 2D context, so the shape is described here and
 * satisfied by both backends.
 */
export interface CanvasSurface {
	/** Registered texture key. Sprites take this wherever a texture is expected. */
	readonly key: string;
	readonly width: number;
	readonly height: number;
	/** The 2D context to draw into. */
	readonly ctx: CanvasRenderingContext2D;
	/**
	 * The canvas element itself.
	 *
	 * Present because a surface is a legitimate `drawImage` *source*: Cycloper
	 * slices an already-oriented cardboard into per-tile surfaces, which needs the
	 * element rather than the context.
	 */
	readonly canvas: HTMLCanvasElement;
	/** Push the drawing to the GPU so the change becomes visible. */
	commit(): void;
	/** Draw another registered texture into this surface. */
	drawTexture(textureKey: string, x: number, y: number): void;
	/** Release the surface and its texture registration. */
	destroy(): void;
}

/** Key prefix for AB-created surfaces. Recognisable in a texture dump. */
const SURFACE_KEY_PREFIX = '__ab_surface_';
let nextSurfaceId = 1;

/**
 * Commit a canvas texture to the GPU.
 *
 * This is `refresh()`, not `update()`, and the difference is not cosmetic.
 * Phaser 4 split them: `refresh()` pushes the canvas to the GPU, while `update()`
 * re-reads the whole surface with `getImageData` and rebuilds the pixel arrays,
 * which its own docs call "a very expensive operation".
 *
 * Nothing in AB reads pixels back out of these surfaces — they are drawn into
 * and then rendered — so the readback was pure cost, paid once per surface per
 * frame by the plasma shield and the per-frame cardboard glows. The Phaser 2 CE
 * `dirty` flag that used to stand in for this was a single boolean set.
 */
function commitCanvasTexture(texture: Phaser.Textures.CanvasTexture): void {
	texture.refresh();
}

/**
 * Whether a commit has anywhere to go.
 *
 * `refresh()` reaches `TextureSource.update()`, which dereferences
 * `renderer.gl` unconditionally — so on a `Phaser.HEADLESS` game, where
 * `renderer` is `null`, it throws. That is the headless simulation and the
 * authoritative server, which draw surfaces but never rasterise them: the
 * drawing still happens (the pixel paths are real and worth exercising), there
 * is simply no GPU behind it. Under the CANVAS renderer there is also nothing
 * to push — the canvas *is* the source — and Phaser's own `update()` is a no-op
 * there too.
 */
function commitsReachGpu(textures: Phaser.Textures.TextureManager): boolean {
	return Boolean(
		(textures as unknown as { game?: { renderer?: { gl?: unknown } | null } }).game?.renderer?.gl,
	);
}

function createRendererSurface(
	textures: Phaser.Textures.TextureManager,
	width: number,
	height: number,
): CanvasSurface {
	// AB creates many short-lived surfaces (trails, plasma, per-hex masks), so
	// the key only has to be unique among live surfaces.
	let n = nextSurfaceId++;
	let texture = textures.createCanvas(`${SURFACE_KEY_PREFIX}${n}`, width, height);
	// `createCanvas` returns null if the key is already taken, so keep going
	// rather than handing back a surface that silently draws nowhere.
	while (!texture && n < nextSurfaceId + 64) {
		n = nextSurfaceId++;
		texture = textures.createCanvas(`${SURFACE_KEY_PREFIX}${n}`, width, height);
	}
	if (!texture) {
		throw new Error('createCanvasSurface: could not create a canvas texture');
	}

	const key = texture.key;
	const pushToGpu = commitsReachGpu(textures);
	const commit = () => {
		if (pushToGpu) {
			commitCanvasTexture(texture!);
		}
	};
	return {
		key,
		width,
		height,
		ctx: texture.getContext(),
		canvas: texture.canvas,
		commit,
		drawTexture: (textureKey, x, y) => {
			const source = textures.get(textureKey);
			const image = source?.getSourceImage?.();
			if (!image) {
				// Phaser 2's `BitmapData.draw` warned and continued; a missing
				// source here is a missing texture key, and a missing effect layer
				// is better than a thrown exception mid-animation.
				console.warn(`CanvasSurface.drawTexture: texture "${textureKey}" has no source image`);
				return;
			}
			texture!.getContext().drawImage(image as CanvasImageSource, x, y);
			commit();
		},
		destroy: () => {
			textures.remove(key);
		},
	};
}

/**
 * A real 2D context, or a buffer-backed stand-in where canvas is unavailable.
 *
 * Plain Node has no `document`. The stub answers every call AB makes so the
 * pixel-manipulation paths run rather than crashing, and reports a zeroed buffer
 * from `getImageData`, which those paths already treat as "nothing drawn".
 */
function createHeadlessContext(width: number, height: number): CanvasRenderingContext2D {
	const g = globalThis as unknown as {
		document?: { createElement?: (tag: string) => HTMLCanvasElement };
	};
	if (typeof g.document?.createElement === 'function') {
		try {
			const canvas = g.document.createElement('canvas');
			canvas.width = Math.max(1, Math.floor(width) || 1);
			canvas.height = Math.max(1, Math.floor(height) || 1);
			const ctx = canvas.getContext('2d');
			if (ctx) return ctx;
		} catch {
			// Fall through to the buffer-backed stub.
		}
	}
	return createBufferContext(width, height);
}

function createBufferContext(width: number, height: number): CanvasRenderingContext2D {
	const w = Math.max(1, Math.floor(width) || 1);
	const h = Math.max(1, Math.floor(height) || 1);
	const data = new Uint8ClampedArray(w * h * 4);
	return {
		canvas: { width: w, height: h } as HTMLCanvasElement,
		fillStyle: '#000000',
		strokeStyle: '#000000',
		lineWidth: 1,
		globalAlpha: 1,
		clearRect: () => undefined,
		fillRect: () => undefined,
		strokeRect: () => undefined,
		drawImage: () => undefined,
		beginPath: () => undefined,
		closePath: () => undefined,
		moveTo: () => undefined,
		lineTo: () => undefined,
		arc: () => undefined,
		fill: () => undefined,
		stroke: () => undefined,
		save: () => undefined,
		restore: () => undefined,
		translate: () => undefined,
		rotate: () => undefined,
		scale: () => undefined,
		createImageData: ((sw: number, sh: number) => ({
			width: sw,
			height: sh,
			data: new Uint8ClampedArray(sw * sh * 4),
			colorSpace: 'srgb' as ImageData['colorSpace'],
		})) as CanvasRenderingContext2D['createImageData'],
		getImageData: (_x: number, _y: number, sw: number, sh: number) => ({
			width: sw,
			height: sh,
			data: data.subarray(0, sw * sh * 4),
			colorSpace: 'srgb' as ImageData['colorSpace'],
		}),
		putImageData: () => undefined,
		setTransform: () => undefined,
		measureText: () => ({ width: 0 } as TextMetrics),
		fillText: () => undefined,
		strokeText: () => undefined,
	} as unknown as CanvasRenderingContext2D;
}

function createHeadlessSurface(width: number, height: number): CanvasSurface {
	const key = `${SURFACE_KEY_PREFIX}null_${nextSurfaceId++}`;
	const headlessCtx = createHeadlessContext(width, height);
	return {
		key,
		width,
		height,
		ctx: headlessCtx,
		canvas: headlessCtx.canvas,
		// Nothing to upload: there is no GPU behind this surface.
		commit: () => undefined,
		drawTexture: () => undefined,
		destroy: () => undefined,
	};
}

/** Where a surface gets its texture registration. */
export interface SurfaceSource {
	/** Phaser's texture manager, or `null`/absent off-engine. */
	textures?: Phaser.Textures.TextureManager | null;
}

/**
 * Create a CPU-drawn surface.
 *
 * Off-engine — the unit suites, the headless runner, the authoritative server —
 * this returns a real 2D context with no texture behind it. That is the same
 * split the old code had, made explicit: drawing still happens, so the pixel
 * paths are exercised, but there is nothing to upload and nothing to render.
 */
export function createCanvasSurface(
	source: SurfaceSource | null | undefined,
	width: number,
	height: number,
): CanvasSurface {
	const w = Math.max(1, Math.floor(width) || 1);
	const h = Math.max(1, Math.floor(height) || 1);
	const textures = source?.textures;
	if (!textures || typeof textures.createCanvas !== 'function') {
		return createHeadlessSurface(w, h);
	}
	return createRendererSurface(textures, w, h);
}

/**
 * The `Game`-shaped slice this module needs.
 *
 * Structural rather than an import of the `Game` class: `Game` already depends on
 * nearly everything, and a type-only import would still couple the display layer
 * to the game object it exists to serve.
 */
export interface SurfaceGame {
	Phaser?: { textures?: Phaser.Textures.TextureManager | null } | null;
}

/**
 * Create a surface for a match.
 *
 * Exists so callers cannot pass the wrong object by mistake. The tempting
 * mistake is `createCanvasSurface(game, w, h)`, which type-checks against
 * `SurfaceSource`'s optional `textures` only if someone is not looking, and
 * silently yields a headless surface that draws nowhere.
 */
export function createGameCanvasSurface(
	game: SurfaceGame,
	width: number,
	height: number,
): CanvasSurface {
	return createCanvasSurface({ textures: game?.Phaser?.textures ?? null }, width, height);
}
