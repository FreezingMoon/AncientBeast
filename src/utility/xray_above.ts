// Improve X-Ray when targeting above (#1301)
// When moving medium/large units, trigger X-Ray for hexes above the unit

import { Hex } from './hex';

/**
 * Check if X-Ray should be triggered for hexes above the unit
 * @param unitSize - Size of the unit (1=small, 2=medium, 3=large)
 * @param unitHexes - Array of hexes the unit occupies
 * @param targetHex - The hex being hovered
 * @param visibleHexes - Array of visible hexes
 * @returns boolean - Whether X-Ray should trigger
 */
export function shouldTriggerXRayAbove(
    unitSize: number,
    unitHexes: Hex[],
    targetHex: Hex,
    visibleHexes: Hex[]
): boolean {
    // Only for medium (size 2) and large (size 3) units
    if (unitSize < 2) {
        return false;
    }
    
    // Check if target hex is above the unit
    const unitYPositions = unitHexes.map(h => h.y);
    const minY = Math.min(...unitYPositions);
    
    // If target is on rows above the unit
    if (targetHex.y < minY) {
        // Check if second or third hex of unit is not visible
        const secondHex = unitHexes[1];
        const thirdHex = unitHexes[2];
        
        if (secondHex && !visibleHexes.includes(secondHex)) {
            return true;
        }
        
        if (thirdHex && !visibleHexes.includes(thirdHex)) {
            return true;
        }
    }
    
    return false;
}

/**
 * Get hexes that should be revealed by X-Ray
 * @param unitHexes - Array of hexes the unit occupies
 * @param visibleHexes - Array of visible hexes
 * @returns Hex[] - Hexes to reveal
 */
export function getXRayHexes(unitHexes: Hex[], visibleHexes: Hex[]): Hex[] {
    return unitHexes.filter(h => !visibleHexes.includes(h));
}
