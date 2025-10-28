# Escort Service Bug Fix - A/B Comparison

## Problem Summary
Escort Service ability becomes unavailable (shows as "not enough movement points") even when the Scavenger has sufficient movement points remaining. This happens intermittently after moving around the map.

## Root Cause
The `getEscortUsableHexes()` function was calling `getFlyingRange()` with incorrect parameters:

**BEFORE (Buggy):**
```typescript
const size = crea.size + trg.size;  // Combined size = 4
const x = trgIsInfront ? crea.x + trg.size : crea.x;
const usableHexes = G.grid
    .getFlyingRange(x, crea.y, distance, size, [crea.id, trg.id])  // ← Bug here!
    .filter(function (item) {
        return (
            crea.y == item.y && (trgIsInfront ? item.x < x : item.x > x - crea.size - trg.size + 1)
        );
    });
```

**Problem:** `getFlyingRange(x, crea.y, distance, size, ...)` was called with:
- Modified `x` position (accounting for target)
- Combined `size = 4` (Scavenger size 2 + target size 2)

This caused `getFlyingRange` to look for hexes where a **size-4 entity** could fit, which:
1. Returns hexes on different rows (y-coordinates) than where the creatures actually are
2. Filters out all hexes because `item.y !== crea.y`
3. Results in `usableHexes.length = 0` even with movement points available

## The Fix

**AFTER (Fixed):**
```typescript
const size = crea.size + trg.size;
const startX = trgIsInfront ? crea.x + trg.size : crea.x;

// Use Scavenger's actual position and size, not modified position or combined size
const flyingRange = G.grid.getFlyingRange(crea.x, crea.y, distance, crea.size, [crea.id, trg.id]);

const usableHexes = flyingRange.filter(function (item) {
    // Must be on the same row
    if (item.y !== crea.y) {
        return false;
    }

    // Check if there's enough space for BOTH creatures at this position
    let passes;
    if (trgIsInfront) {
        passes = item.x < startX && item.x >= crea.size + trg.size - 1;
    } else {
        passes = item.x > startX - crea.size - trg.size + 1;
    }
    return passes;
});
```

**Key Changes:**
1. **Use `crea.x` instead of `x`** - Start from Scavenger's actual position
2. **Use `crea.size` instead of `size`** - Check where the Scavenger can move, not where a combined entity fits
3. This returns hexes on the correct row (same `y` coordinate) where the ability can actually be used

## Testing Results

### Before Fix
```
crea.x: 9  crea.y: 4  crea.size: 2
trg.x: 11  trg.y: 4  trg.size: 2
distance (remainingMove): 2
combined size: 4
x: 11
flyingRange.length: 26
filtered out hex: 9 2  reason: wrong y (item.y=2, need=4)
filtered out hex: 8 2  reason: wrong y (item.y=2, need=4)
filtered out hex: 7 2  reason: wrong y (item.y=2, need=4)
... (all 26 hexes filtered out due to wrong y coordinate)
usableHexes.length after filter: 0
[Escort Service] FAILED: not enough movement points
```

### After Fix
```
crea.x: 6  crea.y: 4  crea.size: 2
trg.x: 4  trg.y: 4  trg.size: 2
distance (remainingMove): 5
combined size: 4
flyingRange.length: 80
usableHexes.length after filter: 5
[Escort Service] usableHexes.length: 5 remainingMove: 5
[Escort Service] PASSED: ability is available
```

## How to Test

### Version A (Before - Buggy)
```bash
git checkout HEAD~1
npm run build:dev
```
**Expected behavior:** Escort Service frequently becomes unavailable after moving, even with movement points.

### Version B (After - Fixed)
```bash
git checkout HEAD
npm run build:dev
```
**Expected behavior:** Escort Service remains available whenever you have movement points and a valid target.

## Files Changed
- `src/abilities/Scavenger.ts` - Fixed `getEscortUsableHexes()` function
- `src/ability.ts` - Added debug logging to `setUsed()` method (for debugging only)

## Additional Notes
The debug `console.log` statements should be removed before merging to production. They were added to diagnose the issue and can be cleaned up in a follow-up commit.
