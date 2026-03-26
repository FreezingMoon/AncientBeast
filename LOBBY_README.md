# 🎮 AncientBeast Lobby Server

**Complete replacement for Nakama-based multiplayer system**

---

## 📋 Overview

This lobby server provides:
- ✅ Player registration with auto-generated IDs
- ✅ Lobby creation and management
- ✅ Matchmaking queue system
- ✅ WebRTC P2P connections for gameplay
- ✅ Real-time Socket.IO communication
- ✅ REST API for lobby operations

**Bounty:** Issue #2632 - 6,666 XTR

---

## 🚀 Quick Start

### **Installation**

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start server
npm start
```

### **Development Mode**

```bash
# Run with hot reload
npm run dev
```

Server will start on `http://localhost:3001`

---

## 📡 API Endpoints

### **Player Management**

#### Register Player
```bash
POST /api/v1/player/register
Response: { "success": true, "playerId": "uuid..." }
```

#### Get Player Info
```bash
GET /api/v1/player/:playerId
Response: { "id": "...", "isReady": false, ... }
```

### **Lobby Management**

#### Create Lobby
```bash
POST /api/v1/lobby/create
Body: { "playerId": "...", "lobbyName": "...", "isPrivate": false, "maxPlayers": 8 }
Response: { "success": true, "lobby": {...} }
```

#### List Lobbies
```bash
GET /api/v1/lobby/list
Response: { "success": true, "lobbies": [...] }
```

#### Join Lobby
```bash
POST /api/v1/lobby/:lobbyId/join
Body: { "playerId": "..." }
Response: { "success": true, "lobby": {...} }
```

### **Matchmaking**

#### Add to Queue
```bash
POST /api/v1/matchmaking/queue
Body: { "playerId": "...", "gameMode": "standard" }
Response: { "success": true, "estimatedWaitTime": 30000 }
```

#### Leave Queue
```bash
POST /api/v1/matchmaking/leave
Body: { "playerId": "..." }
Response: { "success": true }
```

### **Server Stats**

```bash
GET /api/v1/stats
Response: { "players": 10, "lobbies": 3, "queuedPlayers": 5, "uptime": 12345 }
```

### **Health Check**

```bash
GET /health
Response: { "status": "healthy", "timestamp": "...", "players": 10, "lobbies": 3 }
```

---

## 🔌 Socket.IO Events

### **Client → Server**

| Event | Payload | Description |
|-------|---------|-------------|
| `lobby:join` | `{ playerId, lobbyId }` | Join lobby room |
| `lobby:leave` | `{ playerId, lobbyId }` | Leave lobby room |
| `matchmaking:accept` | `{ playerId }` | Accept match |

### **Server → Client**

| Event | Payload | Description |
|-------|---------|-------------|
| `lobby:playerJoined` | `{ playerId }` | Player joined lobby |
| `lobby:playerLeft` | `{ playerId }` | Player left lobby |
| `matchmaking:matchFound` | `{ lobbyId, players }` | Match found |

---

## 🌐 P2P Integration

After matchmaking, players connect via WebRTC:

1. Lobby server facilitates initial connection
2. WebRTC data channels established
3. P2P gameplay begins
4. Server no longer involved in gameplay

### **WebRTC Configuration**

```typescript
const config = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};
```

---

## 📦 Deployment

### **Local Testing**

```bash
# Install dependencies
npm install

# Start server
npm run dev

# Test endpoints
curl http://localhost:3001/health
```

### **Qoddi Deployment**

```bash
# Install Qoddi CLI
npm install -g qoddi-cli

# Login to Qoddi
qoddi login

# Deploy
qoddi deploy

# Your server will be available at:
# https://ancientbeast-lobby.qoddiapp.com
```

### **Environment Variables**

```bash
# Server Configuration
LOBBY_PORT=3001
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080,https://ancientbeast.com

# Qoddi Deployment
NODE_ENV=production
QODDI_DOMAIN=ancientbeast-lobby.qoddiapp.com
```

---

## 🧪 Testing

### **Unit Tests**

```bash
npm test
```

### **Load Testing**

```bash
# Install artillery
npm install -g artillery

# Run load test
artillery quick --count 10 --num 100 http://localhost:3001/health
```

### **Manual Testing**

1. Start server: `npm run dev`
2. Open browser to `http://localhost:3001`
3. Use lobby client to register player
4. Create/join lobbies
5. Test matchmaking

---

## 📁 Project Structure

```
src/
├── lobby/
│   ├── server.ts          # Main Express + Socket.IO server
│   ├── config.ts          # Server configuration
│   ├── player.ts          # Player session management
│   ├── lobby.ts           # Lobby creation/management
│   └── matchmaker.ts      # Matchmaking queue
├── networking/
│   ├── lobby-client.ts    # Client-side API
│   ├── p2p-handler.ts     # WebRTC P2P connections
│   └── p2p-game.ts        # P2P game integration
├── multiplayer/
│   ├── server.ts          # Lobby server (replaces Nakama)
│   ├── authenticate.ts    # Authentication (replaces Nakama)
│   └── session.js         # Session management
└── ui/lobby/
    └── lobby-screen.ts    # Lobby UI component
```

---

## 🔧 Migration from Nakama

### **Old Code (Nakama)**

```typescript
import { Client } from '@heroiclabs/nakama-js';
const client = new Client('key', 'host', 7350, false);
```

### **New Code (Lobby)**

```typescript
import { LobbyClient } from '../networking/lobby-client';
const client = new LobbyClient('http://localhost:3001');
```

### **Breaking Changes**

- ❌ No more email/password authentication
- ✅ Auto-generated player IDs
- ❌ No more Nakama storage
- ✅ P2P gameplay after matchmaking
- ❌ No more Nakama real-time socket
- ✅ Socket.IO + WebRTC

---

## 💰 Bounty Information

**Issue:** #2632 - Online Multiplayer Lobby  
**Bounty:** 6,666 XTR (~$870 USD)  
**Status:** ✅ Complete  
**MintMe:** `0x5F6B24079E557cE354Be7242468678B36dC8CC9C`

---

## 📝 License

AGPL-3.0 (same as AncientBeast)

---

## 🙏 Credits

Developed for AncientBeast multiplayer lobby system.

Replaces Nakama-based implementation with custom lobby + P2P solution.
