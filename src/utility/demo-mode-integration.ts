/**
 * Demo Mode Integration Example
 * 
 * This file shows how to integrate demo mode into AncientBeast.
 * Add these changes to the appropriate files.
 */

// ==================
// STEP 1: Add to src/game.ts
// ==================

/*
import { createDemoMode } from './utility/demo-mode';

export default class Game {
  // ... existing attributes ...
  
  demoMode: DemoMode | null = null;
  
  // In the setup() or constructor:
  setup() {
    // ... existing setup code ...
    
    // Initialize demo mode for kiosk/attract mode
    this.demoMode = createDemoMode(this);
  }
  
  // In cleanup/destroy:
  destroy() {
    if (this.demoMode) {
      this.demoMode.destroy();
    }
    // ... existing cleanup ...
  }
}
*/

// ==================
// STEP 2: Add to index.html or main entry point
// ==================

/*
<script>
  // Ensure demo mode initializes after game loads
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (window.G && window.G.demoMode) {
        console.log('🎮 Demo mode ready');
      }
    }, 1000);
  });
</script>
*/

// ==================
// STEP 3: Testing (optional)
// ==================

/*
// In browser console:
const demoMode = window.G.demoMode;
demoMode.triggerDemo(); // Start demo immediately
demoMode.stopDemo(); // Stop demo
demoMode.getState(); // Check current state
*/

export {};
