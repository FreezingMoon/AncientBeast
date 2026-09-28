import type { TextureKeyLike } from './types';

/**
 * Normalises a texture-key argument for the Phaser 4 API.
 *
 * Phaser 2 CE registered every `BitmapData` in the `TextureManager` under its
 * own key, so a `BitmapData` could be handed to any texture-key parameter —
 * `sprite.loadTexture(bmd)`, `group.create(x, y, bmd)`, `add.sprite(x, y, bmd)`.
 * AB's per-pixel effects depend on exactly that: the Dark Priest's plasma field
 * and the Infernal haze/heat layers draw into a `BitmapData` and then attach it
 * to a sprite.
 *
 * Phaser 4 has no such overload. `TextureManager.get()` looks its argument up in
 * a plain object map, so a handle object stringifies to `"[object Object]"`,
 * misses, and falls through to the `__MISSING` texture. Nothing throws — the
 * sprite just silently samples the missing-texture image, which is why these
 * effects vanished after the migration instead of erroring.
 *
 * Every texture-key parameter in the adapter is routed through this so both
 * keys and live `BitmapDataHandle` surfaces resolve to the texture that was
 * actually drawn into.
 *
 * Real Phaser `Texture`/`Frame` instances (and anything unrecognised) are
 * returned unchanged, since `get()` accepts them directly.
 */
export function toTextureKey(key: TextureKeyLike): any {
	if (key == null) return key;
	if (typeof key === 'string') return key;
	// A `BitmapDataHandle` is registered under its own `textureKey`.
	const handleKey = (key as { textureKey?: unknown }).textureKey;
	if (typeof handleKey === 'string') return handleKey;
	// A Phaser `Texture` knows its own key.
	const ownKey = (key as { key?: unknown }).key;
	if (typeof ownKey === 'string') return ownKey;
	return key;
}
