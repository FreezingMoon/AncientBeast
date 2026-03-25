# Undo Move Mechanic

Issue: `#2704`

## Summary

This branch adds an `Undo Move` action that rewinds the match to the state before the most recently logged player action.

Implemented behavior:

- Adds a dedicated undo turn button with the requested clock-rewind icon.
- Replaces the delay button while undo is available.
- Binds undo to `Ctrl+Z` / `Cmd+Z`.
- Limits undo to once per round.
- Rebuilds state by replaying the gamelog up to the action before the latest one.

## Notes

- Undo is intentionally disabled in multiplayer to avoid client desync.
- The replay path reuses the existing gamelog playback system instead of duplicating game-state serialization logic.

## Verification

- `npm run build`
- `npm run lint`
