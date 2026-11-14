import { Cursor } from '../Cursor';
import { Unit } from '../Unit';
import { Hexagon } from '../Hexagon';

export class TargetingSystem {
    private cursor: Cursor;
    private currentTargetUnit: Unit | null = null;

    constructor(cursor: Cursor) {
        this.cursor = cursor;
    }

    /**
     * Called every frame or on pointer move during ability targeting phase
     */
    public updateTargeting(hoveredHex: Hexagon, activePlayerColor: number) {
        // Clear previous unit highlights
        if (this.currentTargetUnit) {
            this.currentTargetUnit.clearBaseHighlight();
            this.currentTargetUnit = null;
        }

        if (!hoveredHex) return;

        // Update the main cursor (The non-spinning overlay on filled outline)
        this.cursor.showTargeting(hoveredHex, activePlayerColor);

        // Check if the hex belongs to a unit (Multi-hex logic)
        const unitAtHex = hoveredHex.getUnit();
        if (unitAtHex && unitAtHex.occupiedHexes.length > 1) {
            this.currentTargetUnit = unitAtHex;
            // Highlight other hexes of the unit with player color coded filled outlines
            unitAtHex.highlightBase(hoveredHex);
        }
    }

    /**
     * Logic to handle clicking anywhere on the unit base
     */
    public handleInput(clickedHex: Hexagon) {
        const unit = clickedHex.getUnit();
        if (unit) {
            // Even if the ability affects only one hex, 
            // clicking any part of the unit base selects the target
            return unit.getMainHex(); 
        }
        return clickedHex;
    }
}
