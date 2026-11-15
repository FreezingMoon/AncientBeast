import { Cursor } from '../services/Cursor';

// ... inside the Unit class or where pointer events are handled ...

/**
 * Handles the pointer over event for the unit sprite.
 */
onPointerOver(): void {
    const battle = this.game.battle;
    const isActiveUnit = battle.activeUnit === this;
    const hasNoAbilitySelected = !battle.abilityManager.selectedAbility;
    
    // Check if we should show the progress cursor
    if (isActiveUnit) {
        if (hasNoAbilitySelected || !this.isViableTarget(battle.abilityManager.selectedAbility)) {
            this.game.cursor.set('progress');
            return;
        }
    }

    // Default hover logic for other units
    if (this.isEnemy) {
        this.game.cursor.set('attack');
    } else {
        this.game.cursor.set('pointer');
    }
}

/**
 * Handles the pointer out event to reset the cursor.
 */
onPointerOut(): void {
    this.game.cursor.reset();
}
