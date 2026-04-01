// Disturbing Sound sprite (#1445)
// Add audio feedback for Disturbing Sound ability

/**
 * Sound effect configuration for abilities
 */
export const SOUND_EFFECTS = {
    DISTURBING_SOUND: {
        trigger: 'ability_use',
        file: 'disturbing_sound.mp3',
        volume: 0.7,
        loop: false
    },
    HIT: {
        trigger: 'damage_dealt',
        file: 'hit_impact.mp3',
        volume: 0.6,
        loop: false
    }
};

/**
 * Play sound effect for Disturbing Sound ability
 * @param game - Game instance
 */
export function playDisturbingSound(game: any): void {
    const soundConfig = SOUND_EFFECTS.DISTURBING_SOUND;
    
    if (game && game.sound) {
        game.sound.play(soundConfig.file, {
            volume: soundConfig.volume,
            loop: soundConfig.loop
        });
    }
}

/**
 * Add hit sound when Disturbing Sound damages enemies
 * @param game - Game instance
 */
export function playDisturbingHitSound(game: any): void {
    const soundConfig = SOUND_EFFECTS.HIT;
    
    if (game && game.sound) {
        game.sound.play(soundConfig.file, {
            volume: soundConfig.volume,
            loop: soundConfig.loop
        });
    }
}

/**
 * Sprite animation for Disturbing Sound visual effect
 */
export class DisturbingSoundSprite {
    private sprite: Phaser.Sprite | null = null;
    
    /**
     * Create and play the Disturbing Sound visual effect
     * @param x - X position
     * @param y - Y position
     * @param game - Game instance
     */
    create(x: number, y: number, game: any): void {
        if (game && game.add) {
            // Create sprite with annoying/disturbing visual effect
            this.sprite = game.add.sprite(x, y, 'disturbing_sound_effect');
            
            // Play animation
            if (this.sprite) {
                this.sprite.play('disturbing_anim', 30, false);
                
                // Destroy after animation
                this.sprite.killOnComplete = true;
            }
        }
    }
    
    /**
     * Clean up sprite resources
     */
    destroy(): void {
        if (this.sprite && !this.sprite.destroyed) {
            this.sprite.destroy();
        }
        this.sprite = null;
    }
}
