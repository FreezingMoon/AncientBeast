/**
 * Fixed ghostOverlap() implementation
 * 
 * Problems with original:
 * 1. Only checked 3 rows below (missed same-row and far-row overlaps)
 * 2. Single ghostedCreature variable (overwrote multiple creatures on same row)
 * 3. No screen-space overlap detection (just hex adjacency)
 * 
 * Fix:
 * 1. Check ALL creatures on the board
 * 2. Use screen-space bounding box overlap
 * 3. Properly handle multiple creatures per row
 * 4. Respect render order (creatures in front get ghosted)
 */

export function ghostOverlapFixed(hex: Hex): void {
	const grid = hex.grid || hex.game.grid;
	const game = hex.game;
	
	// Get the screen-space bounds of the target hex
	const hexBounds = getHexBounds(hex);
	
	// Check all creatures for overlap
	game.creatures.forEach((creature) => {
		if (!creature || creature === hex.creature) {
			return; // Skip self or invalid creatures
		}
		
		// Only consider creatures that could be in front (higher y = closer to camera)
		// OR on the same row but rendered in front
		if (creature.y < hex.y) {
			return; // Creature is behind this hex, no need to ghost
		}
		
		// Check if creature's screen bounds overlap with hex bounds
		const creatureBounds = getCreatureBounds(creature);
		if (creatureBounds && boundsOverlap(hexBounds, creatureBounds)) {
			// This creature overlaps in screen space - enable x-ray
			creature.xray(true);
		}
	});
}

/**
 * Get screen-space bounding box for a hex
 */
function getHexBounds(hex: Hex): Bounds {
	const width = hex.width || Const.HEX_WIDTH_PX;
	const height = hex.height || Const.HEX_HEIGHT_PX;
	
	return {
		left: hex.displayPos.x + 8,      // Small inset for better feel
		right: hex.displayPos.x + width - 8,
		top: hex.displayPos.y + 6,
		bottom: hex.displayPos.y + height + 12,  // Extend slightly to catch feet
	};
}

/**
 * Get screen-space bounding box for a creature sprite
 */
function getCreatureBounds(creature: Creature): Bounds | null {
	const sprite = creature.creatureSprite;
	if (!sprite || !sprite.sprite) {
		return null;
	}
	
	const phaserSprite = sprite.sprite;
	const texture = phaserSprite.texture;
	
	if (!texture || !texture.width || !texture.height) {
		return null;
	}
	
	const width = Math.abs(phaserSprite.width || texture.width);
	const height = Math.abs(phaserSprite.height || texture.height);
	
	if (!width || !height) {
		return null;
	}
	
	// Sprite position is centered horizontally, anchored at bottom
	const centerX = phaserSprite.x;
	const bottomY = phaserSprite.y;
	
	return {
		left: centerX - width / 2,
		right: centerX + width / 2,
		top: bottomY - height,
		bottom: bottomY,
	};
}

/**
 * Check if two bounding boxes overlap
 */
function boundsOverlap(a: Bounds, b: Bounds): boolean {
	return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * Bounding box interface
 */
interface Bounds {
	left: number;
	right: number;
	top: number;
	bottom: number;
}
