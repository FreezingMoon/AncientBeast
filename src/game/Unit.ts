import { Hexagon } from './Hexagon';

export class Unit extends Phaser.GameObjects.Sprite {
    public occupiedHexes: Hexagon[] = [];
    public ownerId: string;
    public playerColor: number;

    /**
     * Returns all hexes occupied by this unit to assist in targeting highlights
     */
    public getFootprint(): Hexagon[] {
        return this.occupiedHexes;
    }

    /**
     * Highlights the entire unit base when one part of it is targeted
     */
    public highlightBase(excludeHex?: Hexagon) {
        this.occupiedHexes.forEach(hex => {
            if (hex !== excludeHex) {
                hex.showHighlight(this.playerColor, 'filled_outline');
            }
        });
    }

    public clearBaseHighlight() {
        this.occupiedHexes.forEach(hex => hex.clearHighlight());
    }
}
