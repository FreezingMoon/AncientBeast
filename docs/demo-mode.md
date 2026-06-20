# Demo Mode System

## Overview

The Demo Mode system automatically plays showcase content when the game is idle (kiosk mode). This is useful for exhibitions, gaming conventions, and attracting new players.

## Features

✅ **Automatic Idle Detection**
- Detects when no player activity for 30 seconds
- Monitors mouse, keyboard, touch, and click events
- Instantly cancels demo on user interaction

✅ **Demo Sequences**
1. **Tutorial Showcase** - Demonstrates game mechanics
   - Summoning creatures
   - Movement on the grid
   - Using abilities
   - Combat mechanics

2. **AI vs AI Battles** - Random battle scenarios
   - AI controls both players
   - Shows interesting combat moves
   - Demonstrates game depth

✅ **Configuration**
- Customizable idle timeout
- Adjustable demo duration
- Sequence control

## Usage

### Basic Integration

```typescript
import { createDemoMode } from './utility/demo-mode';

// In game initialization
const demoMode = createDemoMode(game);

// Demo will automatically start after 30 seconds of inactivity
```

### Manual Control

```typescript
import { getDemoMode } from './utility/demo-mode';

// Manually trigger demo
const demoMode = getDemoMode();
if (demoMode) {
  demoMode.triggerDemo();
}

// Check if demo is active
if (demoMode?.isDemoActive()) {
  console.log('Demo mode is running');
}

// Get current state
const state = demoMode?.getState();
// Returns: 'idle', 'tutorial', 'battle', or 'paused'
```

### Configuration

Edit `src/utility/demo-mode.ts` to customize:

```typescript
private idleTimeout: number = 30000;      // Time before demo starts (ms)
private demoInterval: number = 15000;     // Duration of each demo (ms)
```

## Demo Flow

```
1. Game starts → Idle timer begins
2. No activity for 30 seconds → Demo starts
3. Show tutorial: "Summoning Creatures" (15s)
4. Show tutorial: "Moving on the Grid" (15s)
5. Play AI battle demo (15s)
6. Repeat from step 3
7. User clicks/moves → Demo stops, timer resets
```

## States

| State | Description |
|-------|-------------|
| `IDLE` | Waiting for inactivity timeout |
| `TUTORIAL` | Playing tutorial demonstration |
| `BATTLE` | Playing AI vs AI battle |
| `PAUSED` | Demo temporarily paused |

## Integration Points

### 1. Game Initialization

```typescript
// src/game.ts
import { createDemoMode } from './utility/demo-mode';

class Game {
  // ... existing code ...
  
  setup() {
    // ... existing setup code ...
    
    // Initialize demo mode
    createDemoMode(this);
  }
}
```

### 2. UI Banner System

The demo mode uses the existing UI banner system to display messages:

```typescript
this.game.UI.banner('🎮 Demo Mode - Click anywhere to exit', 3000);
```

### 3. Kiosk Mode (Future)

For #933 (kiosk mode), integrate as follows:

```typescript
// Check if in kiosk mode
if (isKioskMode()) {
  // Shorter timeout for exhibitions
  demoMode.idleTimeout = 10000; // 10 seconds
}
```

## Testing

### Manual Testing

```typescript
// Trigger demo immediately
demoMode.triggerDemo();
```

### Automated Testing

```typescript
describe('DemoMode', () => {
  it('should start after idle timeout', () => {
    const demoMode = createDemoMode(mockGame);
    jest.advanceTimersByTime(30000);
    expect(demoMode.isDemoActive()).toBe(true);
  });
  
  it('should stop on user interaction', () => {
    demoMode.triggerDemo();
    document.dispatchEvent(new MouseEvent('click'));
    expect(demoMode.isDemoActive()).toBe(false);
  });
});
```

## Future Enhancements

### Phase 1 (Current)
- ✅ Basic idle detection
- ✅ Tutorial showcase
- ✅ AI battle demos
- ✅ User interaction cancellation

### Phase 2 (State Machine Integration)
- ⏳ Historic match replays
- ⏳ State machine for precise replays
- ⏳ Commentary system

### Phase 3 (Advanced)
- ⏳ Machine learning for interesting moments
- ⏳ Dynamic scenario generation
- ⏳ Player behavior adaptation

## Performance

- **CPU Impact**: Minimal (idle detection only)
- **Memory**: <1MB additional
- **Network**: None (local only)

## Troubleshooting

### Demo doesn't start
- Check idle timeout configuration
- Verify event listeners are attached
- Check console for errors

### Demo doesn't stop
- Ensure event listeners are working
- Check `stopDemo()` is called correctly

## License

Part of AncientBeast project - AGPL License

---

**Version**: 1.0.0  
**Author**: Demo Mode System  
**Issue**: #2976
