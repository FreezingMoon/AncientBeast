## ✅ FIXED: Boiling Point ability now respects audio mode setting

**Issue**: #2779 - Infernal's passive ability "Boiling Point" was playing sound effects even when the game audio was muted.

**Root Cause**: The ability was directly calling `G.Phaser.add.audio('MagmaSpawn0').play()` without checking the current audio mode.

**Solution Implemented**: 
- Import `getAudioMode` function from the sound system
- Add conditional check: `if (getAudioMode() !== 'muted')` before playing sound
- Maintains full functionality when audio is enabled

**Files Modified**: `src/abilities/Infernal.ts`

**Code Changes**:
```typescript
// Before (line 6): Add import
import { getAudioMode } from '../sound/soundsys';

// Before (lines 29-31): Replace direct sound call
// SFX - Only play if audio is not muted
if (getAudioMode() !== 'muted') {
    const music = G.Phaser.add.audio('MagmaSpawn0');
    music.play();
}
```

**Testing Steps**:
1. Set audio mode to 'muted' via right-click on upper-right audio button
2. Trigger Boiling Point ability (activates automatically at start of turn)
3. Verify no sound is played when muted
4. Set audio mode back to 'full' or 'sfx' and verify sound works normally

**Bounty Claim**: 5 XTR - This fix resolves the audio mode bypass issue completely.

**Status**: Ready for review and merge.
