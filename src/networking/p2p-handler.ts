/**
 * P2P Handler - WebRTC peer-to-peer connection management
 * 
 * Handles P2P connections between players after matchmaking.
 */

export interface PeerConnection {
    peerId: string;
    connection: RTCPeerConnection;
    dataChannel?: RTCDataChannel;
    status: 'connecting' | 'connected' | 'disconnected';
}

export interface P2PMessage {
    type: 'game-state' | 'player-action' | 'chat' | 'custom';
    from: string;
    to: string;
    data: any;
    timestamp: number;
}

export class P2PHandler {
    private peerConnections: Map<string, PeerConnection>;
    private localPlayerId: string;
    private signalingCallback?: (targetId: string, message: any) => void;
    private onPeerConnected?: (peerId: string) => void;
    private onPeerDisconnected?: (peerId: string) => void;
    private onMessageReceived?: (message: P2PMessage) => void;

    constructor(localPlayerId: string) {
        this.localPlayerId = localPlayerId;
        this.peerConnections = new Map();
    }

    /**
     * Set signaling callback (for exchanging WebRTC offers/answers via lobby server)
     */
    public setSignalingCallback(callback: (targetId: string, message: any) => void): void {
        this.signalingCallback = callback;
    }

    /**
     * Set event handlers
     */
    public onPeerConnected(callback: (peerId: string) => void): void {
        this.onPeerConnected = callback;
    }

    public onPeerDisconnected(callback: (peerId: string) => void): void {
        this.onPeerDisconnected = callback;
    }

    public onMessageReceived(callback: (message: P2PMessage) => void): void {
        this.onMessageReceived = callback;
    }

    /**
     * Create WebRTC peer connection
     */
    private createPeerConnection(peerId: string): RTCPeerConnection {
        const config: RTCConfiguration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        const pc = new RTCPeerConnection(config);

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate && this.signalingCallback) {
                this.signalingCallback(peerId, {
                    type: 'ice-candidate',
                    candidate: event.candidate
                });
            }
        };

        // Handle connection state changes
        pc.onconnectionstatechange = () => {
            console.log(`Peer ${peerId} connection state: ${pc.connectionState}`);
            
            const connection = this.peerConnections.get(peerId);
            if (connection) {
                connection.status = pc.connectionState as any;
                
                if (pc.connectionState === 'connected') {
                    this.onPeerConnected?.(peerId);
                } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                    this.onPeerDisconnected?.(peerId);
                    this.closeConnection(peerId);
                }
            }
        };

        // Handle incoming data channel
        pc.ondatachannel = (event) => {
            this.setupDataChannel(event.channel, peerId);
        };

        return pc;
    }

    /**
     * Setup data channel for peer communication
     */
    private setupDataChannel(channel: RTCDataChannel, peerId: string): void {
        channel.onopen = () => {
            console.log(`Data channel opened with peer ${peerId}`);
            const connection = this.peerConnections.get(peerId);
            if (connection) {
                connection.dataChannel = channel;
            }
        };

        channel.onmessage = (event) => {
            try {
                const message: P2PMessage = JSON.parse(event.data);
                this.onMessageReceived?.(message);
            } catch (error) {
                console.error('Failed to parse P2P message:', error);
            }
        };

        channel.onerror = (error) => {
            console.error(`Data channel error with peer ${peerId}:`, error);
        };
    }

    /**
     * Create offer to initiate P2P connection with peer
     */
    public async createOffer(peerId: string): Promise<void> {
        console.log(`Creating offer for peer ${peerId}`);
        
        const pc = this.createPeerConnection(peerId);
        this.peerConnections.set(peerId, {
            peerId,
            connection: pc,
            status: 'connecting'
        });

        // Create data channel
        const dataChannel = pc.createDataChannel(`channel-${this.localPlayerId}`);
        this.setupDataChannel(dataChannel, peerId);

        // Create and send offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        if (this.signalingCallback) {
            this.signalingCallback(peerId, {
                type: 'offer',
                offer: pc.localDescription
            });
        }
    }

    /**
     * Handle incoming offer from peer
     */
    public async handleOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<void> {
        console.log(`Handling offer from peer ${peerId}`);
        
        const pc = this.createPeerConnection(peerId);
        this.peerConnections.set(peerId, {
            peerId,
            connection: pc,
            status: 'connecting'
        });

        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        // Create answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        if (this.signalingCallback) {
            this.signalingCallback(peerId, {
                type: 'answer',
                answer: pc.localDescription
            });
        }
    }

    /**
     * Handle incoming answer from peer
     */
    public async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
        console.log(`Handling answer from peer ${peerId}`);
        
        const connection = this.peerConnections.get(peerId);
        if (!connection) {
            console.error(`No connection found for peer ${peerId}`);
            return;
        }

        await connection.connection.setRemoteDescription(new RTCSessionDescription(answer));
    }

    /**
     * Handle incoming ICE candidate
     */
    public async handleIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
        const connection = this.peerConnections.get(peerId);
        if (!connection) {
            console.error(`No connection found for peer ${peerId}`);
            return;
        }

        try {
            await connection.connection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error(`Failed to add ICE candidate from peer ${peerId}:`, error);
        }
    }

    /**
     * Send message to peer via data channel
     */
    public sendMessage(peerId: string, message: P2PMessage): void {
        const connection = this.peerConnections.get(peerId);
        if (!connection || !connection.dataChannel) {
            console.error(`No data channel available for peer ${peerId}`);
            return;
        }

        if (connection.dataChannel.readyState === 'open') {
            connection.dataChannel.send(JSON.stringify(message));
        } else {
            console.warn(`Data channel not ready for peer ${peerId}, state: ${connection.dataChannel.readyState}`);
        }
    }

    /**
     * Broadcast message to all connected peers
     */
    public broadcastMessage(message: Omit<P2PMessage, 'to'>): void {
        for (const peerId of this.peerConnections.keys()) {
            this.sendMessage(peerId, {
                ...message,
                to: peerId
            });
        }
    }

    /**
     * Close connection to peer
     */
    public closeConnection(peerId: string): void {
        const connection = this.peerConnections.get(peerId);
        if (connection) {
            if (connection.dataChannel) {
                connection.dataChannel.close();
            }
            connection.connection.close();
            this.peerConnections.delete(peerId);
            console.log(`Connection closed with peer ${peerId}`);
        }
    }

    /**
     * Close all peer connections
     */
    public closeAll(): void {
        for (const peerId of this.peerConnections.keys()) {
            this.closeConnection(peerId);
        }
    }

    /**
     * Get connection status for peer
     */
    public getConnectionStatus(peerId: string): string {
        const connection = this.peerConnections.get(peerId);
        return connection ? connection.status : 'not-connected';
    }

    /**
     * Get all connected peers
     */
    public getConnectedPeers(): string[] {
        return Array.from(this.peerConnections.entries())
            .filter(([_, conn]) => conn.status === 'connected')
            .map(([id, _]) => id);
    }

    /**
     * Get local player ID
     */
    public getLocalPlayerId(): string {
        return this.localPlayerId;
    }
}
