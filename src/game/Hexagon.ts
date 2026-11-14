export class Hexagon {
    private highlightSprite: Phaser.GameObjects.Sprite;
    
    // ... existing properties

    /**
     * Displays a specific highlight type on this hexagon
     */
    public showHighlight(color: number, type: 'filled_outline' | 'empty_outline') {
        const texture = type === 'filled_outline' ? 'hexagon_filled_outline' : 'hexagon_outline';
        this.highlightSprite.setTexture(texture);
        this.highlightSprite.setTint(color);
        this.highlightSprite.setVisible(true);
        this.highlightSprite.setAlpha(0.6);
    }

    public clearHighlight() {
        this.highlightSprite.setVisible(false);
    }

    public getUnit(): any {
        // Returns the unit occupying this hex, if any
        return this.occupant;
    }
}
