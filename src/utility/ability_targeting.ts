// Ability unit targeting tweaks (#2004)
// Improve ability targeting behavior

import { Creature } from '../creature';
import { Hex } from './hex';

/**
 * Targeting configuration for abilities
 */
export interface TargetingConfig {
    range: number;
    includeSelf: boolean;
    includeAllies: boolean;
    includeEnemies: boolean;
    requireLineOfSight: boolean;
}

/**
 * Get valid targets for an ability
 * @param source - Source creature
 * @param config - Targeting configuration
 * @param allCreatures - All creatures in game
 * @returns Creature[] - Valid targets
 */
export function getValidTargets(
    source: Creature,
    config: TargetingConfig,
    allCreatures: Creature[]
): Creature[] {
    return allCreatures.filter(target => {
        // Skip dead creatures
        if (target.dead) return false;
        
        // Check self targeting
        if (target.id === source.id && !config.includeSelf) {
            return false;
        }
        
        // Check team
        const isAlly = target.team === source.team;
        if (isAlly && !config.includeAllies) return false;
        if (!isAlly && !config.includeEnemies) return false;
        
        // Check range
        const distance = getDistance(source, target);
        if (distance > config.range) return false;
        
        return true;
    });
}

/**
 * Calculate distance between two creatures
 */
function getDistance(creature1: Creature, creature2: Creature): number {
    const hex1 = creature1.hex;
    const hex2 = creature2.hex;
    
    if (!hex1 || !hex2) return Infinity;
    
    return Math.max(
        Math.abs(hex1.x - hex2.x),
        Math.abs(hex1.y - hex2.y),
        Math.abs(hex1.x + hex1.y - hex2.x - hex2.y)
    ) / 2;
}

/**
 * Highlight valid targets on grid
 */
export function highlightTargets(targets: Creature[]): void {
    targets.forEach(creature => {
        if (creature.hex) {
            // Add visual highlight
            creature.hex.overlayVisualState('targetable');
        }
    });
}
