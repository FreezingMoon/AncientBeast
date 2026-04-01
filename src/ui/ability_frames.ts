// Colored upgraded ability frames (#971)
// Add colored frames for upgraded abilities

import * as $ from 'jquery';

/**
 * Ability frame colors based on upgrade level
 */
const FRAME_COLORS = {
    default: 'transparent',
    upgraded: 'gold',
    legendary: 'purple',
    mythic: 'red'
};

/**
 * Apply colored frame to ability button
 * @param $button - jQuery button element
 * @param upgradeLevel - Upgrade level (0-3)
 */
export function applyAbilityFrameColor(
    $button: JQuery,
    upgradeLevel: number
): void {
    // Remove existing frame classes
    $button.removeClass('ability-frame-default ability-frame-upgraded ability-frame-legendary ability-frame-mythic');
    
    // Get frame color based on level
    let frameClass = 'ability-frame-default';
    let frameColor = FRAME_COLORS.default;
    
    if (upgradeLevel >= 3) {
        frameClass = 'ability-frame-mythic';
        frameColor = FRAME_COLORS.mythic;
    } else if (upgradeLevel >= 2) {
        frameClass = 'ability-frame-legendary';
        frameColor = FRAME_COLORS.legendary;
    } else if (upgradeLevel >= 1) {
        frameClass = 'ability-frame-upgraded';
        frameColor = FRAME_COLORS.upgraded;
    }
    
    // Apply frame class
    $button.addClass(frameClass);
    
    // Apply inline style for color
    const $frame = $button.find('.ability-frame');
    if ($frame.length) {
        $frame.css('border-color', frameColor);
        $frame.css('box-shadow', `0 0 5px ${frameColor}`);
    }
}

/**
 * Get CSS for ability frames
 */
export function getAbilityFrameStyles(): string {
    return `
        .ability-frame-default {
            border: 2px solid transparent;
        }
        
        .ability-frame-upgraded {
            border: 2px solid gold;
            box-shadow: 0 0 5px gold;
            animation: pulse-gold 2s infinite;
        }
        
        .ability-frame-legendary {
            border: 2px solid purple;
            box-shadow: 0 0 8px purple;
            animation: pulse-purple 2s infinite;
        }
        
        .ability-frame-mythic {
            border: 2px solid red;
            box-shadow: 0 0 10px red;
            animation: pulse-red 1.5s infinite;
        }
        
        @keyframes pulse-gold {
            0%, 100% { box-shadow: 0 0 5px gold; }
            50% { box-shadow: 0 0 15px gold; }
        }
        
        @keyframes pulse-purple {
            0%, 100% { box-shadow: 0 0 8px purple; }
            50% { box-shadow: 0 0 20px purple; }
        }
        
        @keyframes pulse-red {
            0%, 100% { box-shadow: 0 0 10px red; }
            50% { box-shadow: 0 0 25px red; }
        }
    `;
}
