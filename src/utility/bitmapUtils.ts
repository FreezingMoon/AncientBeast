import Game from '../game';
import * as Phaser from 'phaser-ce';

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
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	texture: Phaser.RenderTexture | any,
	defaultFrame?: { x: number; y: number; width: number; height: number },
): TextureFrameInfo | null {
	const frame = texture.crop ?? texture.frame ?? defaultFrame;
	const source = texture.baseTexture?.source;

	if (!source || !frame) {
		return null;
	}

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
): Phaser.BitmapData {
	const { frame, source, width, height } = textureFrameInfo;
	const bmd = game.Phaser.add.bitmapData(width, height);
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
