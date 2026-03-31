// Fix for less draconian card update function (#1996)
// Handle missing energy values gracefully

function updateCardSafe(creature) {
    if (!creature) return;
    
    // Safe property access with defaults
    const energy = creature.energy || 0;
    const maxEnergy = creature.maxEnergy || creature.energy || 0;
    const health = creature.health || 0;
    const maxHealth = creature.maxHealth || creature.health || 0;
    
    // Update card display with safe values
    const card = document.querySelector(`[data-creature-id="${creature.id}"]`);
    if (card) {
        const energyEl = card.querySelector('.energy');
        const healthEl = card.querySelector('.health');
        
        if (energyEl) {
            energyEl.textContent = `${energy}/${maxEnergy}`;
            energyEl.style.display = maxEnergy > 0 ? 'block' : 'none';
        }
        
        if (healthEl) {
            healthEl.textContent = `${health}/${maxHealth}`;
        }
    }
}

export { updateCardSafe };
