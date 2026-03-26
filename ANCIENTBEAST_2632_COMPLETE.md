# Multiplayer Lobby System for AncientBeast (#2632)

## Summary

This branch adds a new lobby-oriented multiplayer foundation intended to replace the old Nakama-backed flow:

- Lobby server foundation in `src/lobby/*`
- Client lobby API in `src/networking/lobby-client.ts`
- WebRTC P2P helpers in `src/networking/p2p-handler.ts` and `src/networking/p2p-game.ts`
- New lobby UI in `src/ui/lobby/lobby-screen.ts`
- Replacement multiplayer wrappers in `src/multiplayer/*`
- Setup and deployment notes in `LOBBY_README.md`
- Standalone server dependency manifest in `package.lobby.json`

## Review Focus

This branch is not a drop-in complete replacement for the current multiplayer path yet.

Key gaps found during review:

- `src/script.ts` still expects the old Nakama `connect`, `authenticate`, and `session` APIs.
- `src/multiplayer/match.js` still depends on Nakama socket semantics and was not migrated.
- New Socket.IO / lobby dependencies live in `package.lobby.json`, not the main workspace `package.json`.
- Several new files still have compile and integration issues that need follow-up before merge.

## Validation Performed

- Confirmed the PR branch only contains the `#2632` lobby changes and excludes unrelated `Gumble` changes.
- Updated the MintMe payout address to:
  - `0x5F6B24079E557cE354Be7242468678B36dC8CC9C`
- Ran `npm test` in the main repo:
  - Fails during linting; the new lobby files add many new lint errors and the branch is not merge-ready.
- Ran `npx tsc -p tsconfig.json --noEmit`:
  - Fails with concrete compatibility/type errors in the new lobby and multiplayer code.

## Bounty

- Issue: `#2632`
- Amount: `6,666 XTR`
- MintMe: `0x5F6B24079E557cE354Be7242468678B36dC8CC9C`

## Current Recommendation

Use this PR for architectural review and follow-up implementation planning, not as a final merge candidate.
