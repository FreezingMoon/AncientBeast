/**
 * Lobby Screen UI
 *
 * Main lobby interface for creating/joining lobbies and matchmaking.
 */

import { LobbyClient, LobbyInfo } from '../../networking/lobby-client';

export class LobbyScreen {
	private client: LobbyClient;
	private container: HTMLElement;
	private currentLobby?: LobbyInfo;
	private playerInitialized = false;

	constructor(client: LobbyClient) {
		this.client = client;
		this.container = document.createElement('div');
		this.container.id = 'lobby-screen';
		this.setupUI();
		this.setupClientHandlers();
	}

	/**
	 * Setup UI components
	 */
	private setupUI(): void {
		this.container.innerHTML = `
            <div class="lobby-screen-container">
                <h1>Multiplayer Lobby</h1>
                
                <!-- Player ID Display -->
                <div class="player-id-section">
                    <span>Player ID:</span>
                    <code id="player-id">Generating...</code>
                </div>

                <!-- Main Lobby Actions -->
                <div class="lobby-actions">
                    <button id="create-lobby-btn" class="btn btn-success" disabled>Create Lobby</button>
                    <button id="browse-lobbies-btn" class="btn btn-info" disabled>Browse Lobbies</button>
                    <button id="matchmaking-btn" class="btn btn-warning" disabled>Find Match</button>
                </div>

                <!-- Lobby Browser -->
                <div id="lobby-browser" class="panel" style="display: none;">
                    <h2>Available Lobbies</h2>
                    <div id="lobby-list" class="lobby-list"></div>
                    <button id="close-browser-btn" class="btn btn-secondary">Close</button>
                </div>

                <!-- Current Lobby -->
                <div id="current-lobby" class="panel" style="display: none;">
                    <h2>Current Lobby: <span id="lobby-name"></span></h2>
                    <div id="player-list" class="player-list"></div>
                    <div class="lobby-actions">
                        <button id="ready-btn" class="btn btn-warning">Ready</button>
                        <button id="start-btn" class="btn btn-success" disabled>Start Game</button>
                        <button id="leave-lobby-btn" class="btn btn-danger">Leave</button>
                    </div>
                </div>

                <!-- Matchmaking Queue -->
                <div id="matchmaking-panel" class="panel" style="display: none;">
                    <h2>Matchmaking</h2>
                    <p>Searching for players...</p>
                    <p>Estimated wait time: <span id="wait-time">calculating...</span></p>
                    <button id="cancel-matchmaking-btn" class="btn btn-danger">Cancel</button>
                </div>

                <!-- Server Stats -->
                <div class="server-stats">
                    <span>Players: <strong id="stat-players">0</strong></span>
                    <span>Lobbies: <strong id="stat-lobbies">0</strong></span>
                </div>
            </div>
        `;

		document.body.appendChild(this.container);
		this.attachEventListeners();
	}

	/**
	 * Attach event listeners to buttons
	 */
	private attachEventListeners(): void {
		// Lobby action buttons
		document
			.getElementById('create-lobby-btn')
			?.addEventListener('click', () => this.createLobby());
		document
			.getElementById('browse-lobbies-btn')
			?.addEventListener('click', () => this.browseLobbies());
		document
			.getElementById('matchmaking-btn')
			?.addEventListener('click', () => this.startMatchmaking());

		// Browser buttons
		document
			.getElementById('close-browser-btn')
			?.addEventListener('click', () => this.closeBrowser());

		// Lobby buttons
		document.getElementById('ready-btn')?.addEventListener('click', () => this.toggleReady());
		document.getElementById('start-btn')?.addEventListener('click', () => this.startGame());
		document.getElementById('leave-lobby-btn')?.addEventListener('click', () => this.leaveLobby());

		// Matchmaking buttons
		document
			.getElementById('cancel-matchmaking-btn')
			?.addEventListener('click', () => this.cancelMatchmaking());
	}

	/**
	 * Setup client event handlers
	 */
	private setupClientHandlers(): void {
		this.client.onPlayerJoined = (playerId: string) => {
			this.updatePlayerList();
			console.log(`Player ${playerId} joined`);
		};

		this.client.onPlayerLeft = (playerId: string) => {
			this.updatePlayerList();
			console.log(`Player ${playerId} left`);
		};

		this.client.onMatchFound = (match) => {
			this.onMatchFound(match);
		};
	}

	/**
	 * Initialize player session
	 */
	private async initializePlayer(): Promise<void> {
		if (this.playerInitialized) {
			return;
		}

		try {
			const playerId = await this.client.registerPlayer();
			document.getElementById('player-id')!.textContent = playerId;
			this.playerInitialized = true;

			// Enable lobby actions once the temporary player session exists.
			document.getElementById('create-lobby-btn')!.removeAttribute('disabled');
			document.getElementById('browse-lobbies-btn')!.removeAttribute('disabled');
			document.getElementById('matchmaking-btn')!.removeAttribute('disabled');

			await this.updateStats();
		} catch (error) {
			console.error('Failed to initialize player:', error);
			document.getElementById('player-id')!.textContent = 'Unavailable';
			alert('Failed to initialize player');
		}
	}

	/**
	 * Create a new lobby
	 */
	private async createLobby(): Promise<void> {
		try {
			const lobby = await this.client.createLobby();
			this.currentLobby = lobby;
			this.showCurrentLobby();
		} catch (error) {
			console.error('Failed to create lobby:', error);
			alert('Failed to create lobby');
		}
	}

	/**
	 * Browse available lobbies
	 */
	private async browseLobbies(): Promise<void> {
		try {
			const lobbies = await this.client.listLobbies();
			this.showLobbyBrowser(lobbies);
		} catch (error) {
			console.error('Failed to list lobbies:', error);
			alert('Failed to list lobbies');
		}
	}

	/**
	 * Show lobby browser with list of lobbies
	 */
	private showLobbyBrowser(lobbies: LobbyInfo[]): void {
		const browser = document.getElementById('lobby-browser')!;
		const lobbyList = document.getElementById('lobby-list')!;

		lobbyList.innerHTML = lobbies
			.map(
				(lobby) => `
            <div class="lobby-item" data-lobby-id="${lobby.id}">
                <span class="lobby-name">${lobby.name}</span>
                <span class="lobby-players">${lobby.currentPlayerCount}/${lobby.maxPlayers}</span>
                <button class="btn btn-sm btn-primary join-lobby-btn">Join</button>
            </div>
        `,
			)
			.join('');

		// Attach join handlers
		lobbyList.querySelectorAll('.join-lobby-btn').forEach((btn) => {
			btn.addEventListener('click', (e) => {
				const lobbyId = (e.target as HTMLElement)
					.closest('.lobby-item')
					?.getAttribute('data-lobby-id');
				if (lobbyId) this.joinLobby(lobbyId);
			});
		});

		browser.style.display = 'block';
	}

	/**
	 * Close lobby browser
	 */
	private closeBrowser(): void {
		document.getElementById('lobby-browser')!.style.display = 'none';
	}

	/**
	 * Join a lobby
	 */
	private async joinLobby(lobbyId: string): Promise<void> {
		try {
			const lobby = await this.client.joinLobby(lobbyId);
			this.currentLobby = lobby;
			this.closeBrowser();
			this.showCurrentLobby();
		} catch (error) {
			console.error('Failed to join lobby:', error);
			alert('Failed to join lobby');
		}
	}

	/**
	 * Show current lobby UI
	 */
	private showCurrentLobby(): void {
		if (!this.currentLobby) return;

		const lobbyPanel = document.getElementById('current-lobby')!;
		document.getElementById('lobby-name')!.textContent = this.currentLobby.name;

		this.updatePlayerList();
		lobbyPanel.style.display = 'block';
	}

	/**
	 * Update player list in lobby
	 */
	private updatePlayerList(): void {
		if (!this.currentLobby) return;

		const playerList = document.getElementById('player-list')!;
		playerList.innerHTML = this.currentLobby.players
			.map(
				(player) => `
            <div class="player-item ${player.isReady ? 'ready' : ''}">
                <span class="player-id">${player.id.substring(0, 8)}...</span>
                <span class="player-status">${player.isReady ? '✓ Ready' : 'Not Ready'}</span>
            </div>
        `,
			)
			.join('');
	}

	/**
	 * Toggle ready status
	 */
	private toggleReady(): void {
		// TODO: Implement ready toggle
		console.log('Toggle ready');
	}

	/**
	 * Start game
	 */
	private startGame(): void {
		// TODO: Implement game start
		console.log('Start game');
	}

	/**
	 * Leave current lobby
	 */
	private leaveLobby(): void {
		if (this.currentLobby) {
			this.client.leaveLobby(this.currentLobby.id);
			this.currentLobby = undefined;
			document.getElementById('current-lobby')!.style.display = 'none';
		}
	}

	/**
	 * Start matchmaking
	 */
	private async startMatchmaking(): Promise<void> {
		try {
			const waitTime = await this.client.addToQueue();
			document.getElementById('wait-time')!.textContent =
				waitTime > 0 ? `${Math.round(waitTime / 1000)}s` : 'Unknown';

			document.getElementById('matchmaking-panel')!.style.display = 'block';
		} catch (error) {
			console.error('Failed to start matchmaking:', error);
			alert('Failed to start matchmaking');
		}
	}

	/**
	 * Cancel matchmaking
	 */
	private async cancelMatchmaking(): Promise<void> {
		try {
			await this.client.leaveQueue();
			document.getElementById('matchmaking-panel')!.style.display = 'none';
		} catch (error) {
			console.error('Failed to cancel matchmaking:', error);
		}
	}

	/**
	 * Handle match found
	 */
	private onMatchFound(match: any): void {
		document.getElementById('matchmaking-panel')!.style.display = 'none';
		alert(`Match found! Joining lobby ${match.lobbyId}`);
		this.joinLobby(match.lobbyId);
	}

	/**
	 * Update server stats
	 */
	private async updateStats(): Promise<void> {
		try {
			const stats = await this.client.getStats();
			document.getElementById('stat-players')!.textContent = stats.players.toString();
			document.getElementById('stat-lobbies')!.textContent = stats.lobbies.toString();
		} catch (error) {
			console.error('Failed to update stats:', error);
		}
	}

	/**
	 * Show the lobby screen
	 */
	public show(): void {
		this.container.style.display = 'block';
		void this.initializePlayer();
		void this.updateStats();
	}

	/**
	 * Hide the lobby screen
	 */
	public hide(): void {
		this.container.style.display = 'none';
	}
}
