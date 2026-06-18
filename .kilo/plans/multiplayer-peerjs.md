# Multiplayer PeerJS Implementation Plan

## Goal
Complete the PeerJS P2P online multiplayer feature. Remove all Nakama remnants. 1v1 only, default game settings, Dark Priest for all players.

## Scope
No user registration. Random UUID for players (already in `src/multiplayer/identity.ts`).
Lobby via shareable link/code in `AB-XXXX` format (already in `src/multiplayer/types.ts`).

## Existing Code to Keep (already implemented, just needs integration)
- `src/multiplayer/types.ts` — Types, lobby code generation, peer ID derivation
- `src/multiplayer/identity.ts` — Persistent UUID via localStorage
- `src/multiplayer/PeerLobbyProvider.ts` — Host-authoritative lobby management
- `src/multiplayer/LobbyClient.ts` — Facade used by Game/script
- `src/multiplayer/transport/PeerTransport.ts` — WebRTC transport via PeerJS
- `src/multiplayer/index.ts` — Public API exports

## Changes Required

### 1. Dependencies
**`package.json`**:
- Remove: `@heroiclabs/nakama-js`
- Add: `peerjs` to `dependencies`

### 2. `src/game.ts` — Game class integration

**Add properties** (after line ~133):
```ts
lobby: LobbyClient | null;
lobbyCode: string;
lobbyState: LobbyState | null;
onLobbyUpdate: ((lobby: LobbyState) => void) | null;
handleGameMessage: ((message: GameMessage) => void) | null;
```

**Add methods**:
- `createLobby(config: GameConfig): Promise<LobbySession>` — creates `LobbyClient` if needed, calls `lobby.createMatch(config)`, returns session
- `joinLobbyByCode(code: string): Promise<LobbySession>` — creates `LobbyClient` if needed, calls `lobby.joinMatch(code)`, returns session
- `startMultiplayerMatch(): void` — host broadcasts `match-start` with config, marks match started, calls `loadGame()` with multiplayer config for both host and peers
- `handleLobbyMessage(message: GameMessage): void` — dispatches incoming messages:
  - `match-start`: calls `loadGame()` with multiplayer config
  - `match-loaded`: no-op (acknowledgement)
  - `turn-update`: sets `activeCreature` / advances turn to the indicated creature
  - `action-end` (skip/delay): executes local skip/delay for the remote creature
  - `action-move`: executes local move for the remote creature
  - `action-ability`: executes local ability for the remote creature
  - `player-left`: handles opponent disconnection
- `sendMultiplayerMove(target: {x, y}): void` — sends `action-move` via `lobby.sendAction()`
- `sendMultiplayerAbility(params: {target, id, args}): void` — sends `action-ability` via `lobby.sendAction()`

**Remove legacy code**:
- Remove `session = null`, `client = null`, `connect = null` properties and constructor assignments
- Replace `match: MatchI | object` with `match: object = {}`
- Replace `gameplay: Gameplay` with `gameplay: undefined`
- Remove `matchInit()` method (replace with no-op or remove call from `setup()`)
- Remove `matchJoin()` method
- Remove `updateLobby()` method (Nakama lobby listing - not needed for P2P)
- Replace `this.matchInit()` call in `setup()` (line 674) with a comment/no-op
- In `activePlayer` getter (line 414): simplify — remove `MatchI` check, use lobby for multiplayer player resolution
- In `nextCreature()` (line 859): replace `gameplay.updateTurn()` with lobby turn sync message
- In `delayCreature()` (line 996): replace `gameplay.delay()` with `sendMultiplayerAction({type:'action-end', action:'delay'})`
- In `skipTurn()`: add lobby action send for skip
- In `resetGame()` (line 1641): clean up lobby state

### 3. `src/creature.ts` — Multiplayer move sync
**Line 818**: Replace `game.gameplay.moveTo({...})` with `game.sendMultiplayerMove({target: {x: hex.x, y: hex.y}})`

### 4. `src/ability.ts` — Multiplayer ability sync
**Lines 456-518**: Replace `game.gameplay.useAbility({...})` calls with `game.sendMultiplayerAbility({...})` (all three variants: hex, creature, array)

### 5. `src/templates/pre-match.html` — Add lobby UI elements

Inside the `.lobby` div (line 142), add:
```html
<div id="createdLobby" class="hide">
  <div class="lobby-info">
    <input id="lobbyLinkDisplay" type="text" readonly class="lobby-link" />
    <p id="lobbyCreatedText"></p>
  </div>
  <div class="buttons-wrapper">
    <div class="button-wrapper">
      <input class="crimson-button" id="startCreatedMatchButton" type="button" value="Create Lobby">
    </div>
    <div class="button-wrapper">
      <input class="crimson-button" id="joinMatchButton" type="button" value="Join Match">
    </div>
  </div>
  <input id="lobbyCodeInput" type="text" placeholder="Enter lobby code" class="lobby-code-input" />
  <div id="lobbyError" class="hide lobby-error"></div>
</div>
```

Remove the old lobby list UI (`h2 Open Matches`, `lobby-match-list`, `lobby-no-matches`, `lobby-loader`, `refreshMatchButton`, `backFromMatchButton`) since P2P has no lobby directory.

### 6. `src/style/pre-match.less` — Lobby styles
Add styles for `#createdLobby`, `.lobby-link`, `.lobby-code-input`, `.lobby-error`.

### 7. `src/script.ts` — Script integration
Already mostly complete. Changes needed:
- Line 10: `normalizeLobbyCode` import is fine
- Remove `G.updateLobby()` call (line 655) and its click handler — no lobby listing in P2P
- Ensure `#startCreatedMatchButton` handler is properly bound (it already is at line 541)
- The `updateLobbyUi()` function and all lobby UI code is already there and correct

### 8. Tests update
- `src/__tests__/simulation/botgeria.ts` line 548: change `game.matchInit = () => Promise.resolve()` → remove or comment (no longer exists)
- `src/__tests__/game.ts` lines 152-153: update mock `gameplay: undefined` and `matchInitialized: true` — remove `gameplay` and `matchInitialized` from mock

## Implementation Order
1. Dependencies (`package.json`)
2. Add lobby properties/methods to `game.ts`
3. Remove legacy Nakama code from `game.ts`
4. Update integration points: `creature.ts`, `ability.ts` (replace `gameplay.*` with `sendMultiplayer*`)
5. Add lobby HTML elements to `pre-match.html`
6. Add lobby CSS to `pre-match.less`
7. Clean up `script.ts` (remove `updateLobby` references)
8. Update tests
9. Build + lint + test

## Verification
- `npm run lint` passes
- `npx tsc --noEmit` passes
- `npm run build` passes
- `npm run test:jest` passes
- Manual test (user): open in 2 browsers, create lobby, share link, join, start match
