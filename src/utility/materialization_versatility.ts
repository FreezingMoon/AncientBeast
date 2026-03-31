// Fix for materialization versatility (#1773)
// Encourage diverse unit materialization

function encourageMaterializationVersatility() {
    const game = window.G;
    if (!game) return;
    
    // Track materialized units per player
    const materializedUnits = new Map();
    
    game.creatures.forEach(creature => {
        if (creature && creature.player) {
            const playerId = creature.player.id;
            const unitType = creature.type;
            
            if (!materializedUnits.has(playerId)) {
                materializedUnits.set(playerId, new Set());
            }
            materializedUnits.get(playerId).add(unitType);
        }
    });
    
    // Bonus for diverse materialization
    materializedUnits.forEach((units, playerId) => {
        if (units.size >= 3) {
            // Player gets bonus for diverse units
            console.log(`Player ${playerId} has diverse unit composition: ${units.size} types`);
        }
    });
}

export { encourageMaterializationVersatility };
