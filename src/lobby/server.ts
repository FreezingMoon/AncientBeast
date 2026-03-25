/**
 * AncientBeast Lobby Server
 * 
 * Main server entry point for multiplayer lobby/matchmaking system.
 * Replaces Nakama-based lobby system.
 * 
 * @file server.ts
 * @author AncientBeast Team
 * @license AGPL-3.0
 */

import express, { Express, Request, Response } from 'express';
import { createServer, Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import { LobbyManager } from './lobby';
import { Matchmaker } from './matchmaker';
import { PlayerSession } from './player';
import { config } from './config';

class LobbyServer {
    private app: Express;
    private httpServer: HTTPServer;
    private io: SocketIOServer;
    private lobbyManager: LobbyManager;
    private matchmaker: Matchmaker;
    private playerSessions: Map<string, PlayerSession>;

    constructor() {
        this.app = express();
        this.httpServer = createServer(this.app);
        this.io = new SocketIOServer(this.httpServer, {
            cors: {
                origin: config.allowedOrigins,
                methods: ['GET', 'POST']
            }
        });

        this.lobbyManager = new LobbyManager();
        this.matchmaker = new Matchmaker(this.lobbyManager);
        this.playerSessions = new Map();

        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketHandlers();
    }

    /**
     * Setup Express middleware
     */
    private setupMiddleware(): void {
        // Security middleware
        this.app.use(helmet());
        
        // CORS middleware
        this.app.use(cors({
            origin: config.allowedOrigins,
            credentials: true
        }));

        // Body parsing middleware
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // Request logging
        this.app.use((req: Request, res: Response, next) => {
            console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
            next();
        });
    }

    /**
     * Setup REST API routes
     */
    private setupRoutes(): void {
        // Health check endpoint
        this.app.get('/health', (req: Request, res: Response) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                players: this.playerSessions.size,
                lobbies: this.lobbyManager.getActiveLobbies().length
            });
        });

        // Player registration endpoint
        this.app.post('/api/v1/player/register', (req: Request, res: Response) => {
            try {
                const player = PlayerSession.create();
                this.playerSessions.set(player.id, player);
                
                console.log(`Player registered: ${player.id}`);
                
                res.json({
                    success: true,
                    playerId: player.id,
                    createdAt: player.createdAt
                });
            } catch (error) {
                console.error('Error registering player:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to register player'
                });
            }
        });

        // Get player info
        this.app.get('/api/v1/player/:playerId', (req: Request, res: Response) => {
            const player = this.playerSessions.get(req.params.playerId);
            
            if (!player) {
                return res.status(404).json({
                    success: false,
                    error: 'Player not found'
                });
            }

            res.json(player.getInfo());
        });

        // Create lobby endpoint
        this.app.post('/api/v1/lobby/create', (req: Request, res: Response) => {
            try {
                const { playerId, lobbyName, isPrivate, maxPlayers } = req.body;
                
                const player = this.playerSessions.get(playerId);
                if (!player) {
                    return res.status(404).json({
                        success: false,
                        error: 'Player not found'
                    });
                }

                const lobby = this.lobbyManager.createLobby(
                    player,
                    lobbyName,
                    isPrivate,
                    maxPlayers
                );

                console.log(`Lobby created: ${lobby.id} by ${playerId}`);

                res.json({
                    success: true,
                    lobby: lobby.getInfo()
                });
            } catch (error) {
                console.error('Error creating lobby:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to create lobby'
                });
            }
        });

        // Get all lobbies endpoint
        this.app.get('/api/v1/lobby/list', (req: Request, res: Response) => {
            try {
                const lobbies = this.lobbyManager.getActiveLobbies()
                    .filter(lobby => !lobby.isPrivate)
                    .filter(lobby => !lobby.isFull())
                    .map(lobby => lobby.getInfo());

                res.json({
                    success: true,
                    lobbies: lobbies
                });
            } catch (error) {
                console.error('Error listing lobbies:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to list lobbies'
                });
            }
        });

        // Join lobby endpoint
        this.app.post('/api/v1/lobby/:lobbyId/join', (req: Request, res: Response) => {
            try {
                const { playerId } = req.body;
                const { lobbyId } = req.params;

                const player = this.playerSessions.get(playerId);
                if (!player) {
                    return res.status(404).json({
                        success: false,
                        error: 'Player not found'
                    });
                }

                const lobby = this.lobbyManager.getLobby(lobbyId);
                if (!lobby) {
                    return res.status(404).json({
                        success: false,
                        error: 'Lobby not found'
                    });
                }

                this.lobbyManager.joinLobby(lobby, player);

                console.log(`Player ${playerId} joined lobby ${lobbyId}`);

                res.json({
                    success: true,
                    lobby: lobby.getInfo()
                });
            } catch (error) {
                console.error('Error joining lobby:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to join lobby'
                });
            }
        });

        // Matchmaking queue endpoint
        this.app.post('/api/v1/matchmaking/queue', (req: Request, res: Response) => {
            try {
                const { playerId, gameMode } = req.body;

                const player = this.playerSessions.get(playerId);
                if (!player) {
                    return res.status(404).json({
                        success: false,
                        error: 'Player not found'
                    });
                }

                this.matchmaker.addToQueue(player, gameMode);

                console.log(`Player ${playerId} added to matchmaking queue`);

                res.json({
                    success: true,
                    message: 'Added to matchmaking queue',
                    estimatedWaitTime: this.matchmaker.getEstimatedWaitTime()
                });
            } catch (error) {
                console.error('Error adding to queue:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to add to queue'
                });
            }
        });

        // Leave matchmaking queue
        this.app.post('/api/v1/matchmaking/leave', (req: Request, res: Response) => {
            try {
                const { playerId } = req.body;

                this.matchmaker.removeFromQueue(playerId);

                console.log(`Player ${playerId} left matchmaking queue`);

                res.json({
                    success: true,
                    message: 'Left matchmaking queue'
                });
            } catch (error) {
                console.error('Error leaving queue:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to leave queue'
                });
            }
        });

        // Server stats endpoint
        this.app.get('/api/v1/stats', (req: Request, res: Response) => {
            res.json({
                players: this.playerSessions.size,
                lobbies: this.lobbyManager.getActiveLobbies().length,
                queuedPlayers: this.matchmaker.getQueueSize(),
                uptime: process.uptime()
            });
        });
    }

    /**
     * Setup Socket.IO handlers for real-time communication
     */
    private setupSocketHandlers(): void {
        this.io.on('connection', (socket) => {
            console.log(`Socket connected: ${socket.id}`);

            // Player joins lobby room
            socket.on('lobby:join', (data: { playerId: string; lobbyId: string }) => {
                socket.join(`lobby:${data.lobbyId}`);
                console.log(`Player ${data.playerId} joined lobby room ${data.lobbyId}`);

                // Notify other players in lobby
                socket.to(`lobby:${data.lobbyId}`).emit('lobby:playerJoined', {
                    playerId: data.playerId
                });
            });

            // Player leaves lobby room
            socket.on('lobby:leave', (data: { playerId: string; lobbyId: string }) => {
                socket.leave(`lobby:${data.lobbyId}`);
                console.log(`Player ${data.playerId} left lobby room ${data.lobbyId}`);

                // Notify other players in lobby
                socket.to(`lobby:${data.lobbyId}`).emit('lobby:playerLeft', {
                    playerId: data.playerId
                });
            });

            // Match found notification
            socket.on('matchmaking:accept', (data: { playerId: string }) => {
                const match = this.matchmaker.createMatch(data.playerId);
                if (match) {
                    // Send match details to all players
                    match.players.forEach(player => {
                        this.io.to(`player:${player.id}`).emit('matchmaking:matchFound', {
                            lobbyId: match.lobbyId,
                            players: match.players.map(p => p.getInfo())
                        });
                    });
                }
            });

            // Player disconnect
            socket.on('disconnect', () => {
                console.log(`Socket disconnected: ${socket.id}`);
                
                // Find and clean up player session
                for (const [playerId, player] of this.playerSessions.entries()) {
                    if (player.socketId === socket.id) {
                        this.matchmaker.removeFromQueue(playerId);
                        this.lobbyManager.removePlayer(player);
                        this.playerSessions.delete(playerId);
                        console.log(`Cleaned up disconnected player: ${playerId}`);
                        break;
                    }
                }
            });
        });
    }

    /**
     * Start the lobby server
     */
    public start(port: number = config.port): void {
        this.httpServer.listen(port, () => {
            console.log('╔══════════════════════════════════════════════════════════╗');
            console.log('║     🎮 ANCIENTBEAST LOBBY SERVER STARTED 🎮              ║');
            console.log('╚══════════════════════════════════════════════════════════╝');
            console.log('');
            console.log(`📍 Server running on port ${port}`);
            console.log(`🌐 Health check: http://localhost:${port}/health`);
            console.log(`📊 Stats: http://localhost:${port}/api/v1/stats`);
            console.log(`🔌 Socket.IO ready`);
            console.log('');
            console.log('Press Ctrl+C to stop');
        });
    }
}

// Start server if run directly
if (require.main === module) {
    const server = new LobbyServer();
    server.start();
}

export { LobbyServer };
