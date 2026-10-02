/**
 * Getting a sprite's size right: which of Phaser 4's several sizes did Phaser 2's
 * `sprite.texture` mean?
 *
 * Phaser 2's `sprite.texture` was the *frame*. `sprite.texture.width` was
 * therefore the size of the artwork the sprite draws, which is what AB's
 * positioning maths was written against.
 *
 * Phaser 4 splits that into three distinct numbers that are easy to confuse:
 *
 *  - `texture.width` / `texture.height` — the whole *source* image. For a
 *    spritesheet or atlas frame this is the entire atlas, so reading it as "the
 *    size of my sprite" is wrong by a large factor.
 *  - `frame.width` / `frame.height` — the trimmed, packed box actually sampled.
 *  - `frame.realWidth` / `frame.realHeight` — the frame as prepared in the art
 *    package, before trimming and packing.
 *
 * Ancient Beast only loads standalone images (`load.image`, no spritesheets or
 * atlases), so all three agree today. That is exactly why the distinction is
 * worth stating explicitly: an atlas would make the old reads wrong by
 * construction, and nothing at the call site would say why.
 */

/**
 * The key Phaser 4 registers its missing-texture placeholder under.
 *
 * When a sprite is created against a texture that is not resident, Phaser
 * substitutes its 32×32 "image ready" texture and records that key on the
 * sprite. AB has to recognise the situation — see `CreatureSprite`'s load
 * callback, where a sprite left on the placeholder never re-resolves once the
 * real texture arrives.
 *
 * Phaser 4's `TextureManager` creates this from `config.missingImage` under this
 * name. It is a private engine string with no public accessor, so it cannot be
 * read off the engine; if Phaser ever renames it, this is the single line to
 * change, and the placeholder check fails loudly (the unit simply never
 * appears) rather than silently.
 */
export const MISSING_TEXTURE_KEY = '__MISSING';

/** The parts of a Phaser 4 game object this module reads. */
type FrameBearing = {
	frame?: {
		realWidth?: number;
		realHeight?: number;
		width?: number;
		height?: number;
	};
	texture?: { width?: number; height?: number };
	width?: number;
	height?: number;
};

/** A width/height pair. */
export interface Size {
	width: number;
	height: number;
}

/**
 * The untrimmed size of the frame a game object is drawing — the number that
 * Phaser 2's `sprite.texture.width` / `.height` meant, and the one AB's
 * positioning maths is written against.
 *
 * Used wherever a size is needed to place something relative to a sprite: the
 * cardboard standing on a hex, the x-ray bitmap sized to match its cardboard, a
 * pixel coordinate on the artwork.
 */
export function getFrameSize(gameObject: FrameBearing | undefined | null): Size {
	const frame = gameObject?.frame;
	const width = frame?.realWidth ?? frame?.width;
	const height = frame?.realHeight ?? frame?.height;

	// Last resort for objects with no usable frame yet — a sprite whose texture is
	// still downloading, or a raw Phaser 4 object whose `Texture` has no
	// dimensions at all. The scaled display size bounds it correctly, and it is
	// only reached when the authoritative answer is unavailable.
	if (!(width > 0) || !(height > 0)) {
		return {
			width: gameObject?.texture?.width ?? gameObject?.width ?? 0,
			height: gameObject?.texture?.height ?? gameObject?.height ?? 0,
		};
	}

	return { width, height };
}

/**
 * The size of the whole source image behind a game object.
 *
 * This is what you want only when the question is about the *image* rather than
 * the sprite: sampling a region out of a canvas, or sizing a drawing surface to
 * the pixels it will copy. It is never the answer for "how big does this sprite
 * draw".
 */
export function getSourceSize(texture: { width?: number; height?: number } | undefined): Size {
	return { width: texture?.width ?? 0, height: texture?.height ?? 0 };
}

/**
 * The on-screen size of a game object, after scale and any origin offset.
 *
 * Distinct again from {@link getFrameSize}: this is how many pixels the object
 * covers on the canvas, which is what hit-testing and cursor maths needs.
 */
export function getDisplaySize(gameObject: { width: number; height: number }): Size {
	return { width: gameObject.width, height: gameObject.height };
}
