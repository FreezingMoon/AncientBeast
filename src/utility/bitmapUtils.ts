import Game from '../game';

/**
 * Structural view of a Phaser 4 render/dynamic texture: Phaser 4 dropped the
 * Phaser 2 `BitmapData` class, so the drawing surface is read through these
 * members instead.
 */
export type TextureFrameRect = {
	x: number;
	y: number;
	width: number;
	height: number;
	cutX?: number;
	cutY?: number;
	cutWidth?: number;
	cutHeight?: number;
	canvasData?: { x: number; y: number; width: number; height: number };
};

export interface DrawableTexture {
	crop?: TextureFrameRect;
	frame?: TextureFrameRect;
	baseTexture?: { source?: CanvasImageSource };
	width?: number;
	height?: number;
}

export interface TextureFrameInfo {
	frame: { x: number; y: number; width: number; height: number };
	source: CanvasImageSource;
	width: number;
	height: number;
}

/**
 * Extract texture frame info from a sprite's texture.
 * Handles missing/fallback values for crop, frame, and dimensions.
 */
export function extractTextureFrameInfo(
	texture: DrawableTexture,
	defaultFrame?: { x: number; y: number; width: number; height: number },
): TextureFrameInfo | null {
	const raw = (texture.frame ?? texture.crop ?? defaultFrame) as TextureFrameRect | undefined;
	const source = texture.baseTexture?.source;

	if (!source || !raw) {
		return null;
	}

	// Phaser 4 samples `frame.source.image` at `(cutX, cutY)` with size
	// `(cutWidth, cutHeight)`; the display `x/y/width/height` is the trimmed
	// box, so prefer the cut rect to avoid copying the wrong region.
	const frame = {
		x: raw.cutX ?? raw.canvasData?.x ?? raw.x,
		y: raw.cutY ?? raw.canvasData?.y ?? raw.y,
		width: raw.cutWidth ?? raw.canvasData?.width ?? raw.width,
		height: raw.cutHeight ?? raw.canvasData?.height ?? raw.height,
	};

	return {
		frame,
		source,
		width: Math.round(texture.width || frame.width || 1),
		height: Math.round(texture.height || frame.height || 1),
	};
}

/**
 * Create a BitmapData from texture frame with optional horizontal flip.
 * Centralizes canvas setup: clearRect, drawImage, dirty flag.
 */
export function createBitmapDataFromTexture(
	game: Game,
	textureFrameInfo: TextureFrameInfo,
	flipHorizontally?: boolean,
): any {
	const { frame, source, width, height } = textureFrameInfo;
	const bmd = game.gameEngine.add.bitmapData(width, height);
	const { ctx } = bmd;

	ctx.clearRect(0, 0, width, height);

	if (flipHorizontally) {
		ctx.save();
		ctx.translate(width, 0);
		ctx.scale(-1, 1);
	}

	ctx.drawImage(source, frame.x, frame.y, width, height, 0, 0, width, height);

	if (flipHorizontally) {
		ctx.restore();
	}

	bmd.dirty = true;
	return bmd;
}
