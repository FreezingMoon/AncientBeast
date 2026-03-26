/**
 * Lobby Screen UI
 *
 * Main lobby interface for creating/joining lobbies and matchmaking.
 */

import { LobbyClient, LobbyInfo, MatchInfo } from '../../networking/lobby-client';

export class LobbyScreen {
	private client: LobbyClient;
	private container: HTMLElement;
	private currentLobby?: LobbyInfo;
	private playerInitialized = false;

	constructor(client: LobbyClient, container?: HTMLElement) {
		this.client = client;
		this.container = container ?? document.createElement('div');
		if (this.container.id === '') {
			this.container.id = 'lobby-screen';
		}
		this.setupUI();
		this.setupClientHandlers();
	}

	/**
	 * Setup UI components
	 */
	private setupUI(): void {
		this.container.innerHTML = `
			<div class="lobby-screen-container">
				<h2>Multiplayer Lobby</h2>
				<p class="lobby-screen-subtitle">
					Players receive a random ID automatically. No account or login is required.
				</p>
				<div class="player-id-section">
					<span>Player ID</span>
					<code id="player-id">Generating...</code>
				</div>
				<div class="lobby-actions">
					<button id="create-lobby-btn" class="btn" disabled>Create Game</button>
					<button id="browse-lobbies-btn" class="btn" disabled>Refresh Matches</button>
					<button id="matchmaking-btn" class="btn" disabled>Find Match</button>
				</div>
				<div id="lobby-browser" class="panel">
					<h3>Open Matches</h3>
					<div id="lobby-list" class="lobby-list">
						<div class="empty-state">Generating player ID...</div>
					</div>
				</div>
				<div id="current-lobby" class="panel" style="display: none;">
					<h3>Current Lobby: <span id="lobby-name"></span></h3>
					<div id="player-list" class="player-list"></div>
					<div class="lobby-actions">
						<button id="ready-btn" class="btn">Ready</button>
						<button id="start-btn" class="btn" disabled>Start Game</button>
						<button id="leave-lobby-btn" class="btn">Leave</button>
					</div>
				</div>
				<div id="matchmaking-panel" class="panel" style="display: none;">
					<h3>Matchmaking</h3>
					<p>Searching for players...</p>
					<p>Estimated wait time: <span id="wait-time">calculating...</span></p>
					<button id="cancel-matchmaking-btn" class="btn">Cancel</button>
				</div>
				<div class="server-stats">
					<span>Players: <strong id="stat-players">0</strong></span>
					<span>Lobbies: <strong id="stat-lobbies">0</strong></span>
				</div>
			</div>
		`;

		if (!this.container.parentElement) {
			document.body.appendChild(this.container);
		}
		this.attachEventListeners();
	}

	private getElement<T extends HTMLElement>(id: string): T {
		const element = this.container.querySelector<T>(`#${id}`);
		if (!element) {
			throw new Error(`Missing lobby screen element: ${id}`);
		}

		return element;
	}

	/**
	 * Attach event listeners to buttons
	 */
	private attachEventListeners(): void {
		// Lobby action buttons
		this.getElement<HTMLButtonElement>('create-lobby-btn').addEventListener('click', () =>
			this.createLobby(),
		);
		this.getElement<HTMLButtonElement>('browse-lobbies-btn').addEventListener('click', () =>
			this.browseLobbies(),
		);
		this.getElement<HTMLButtonElement>('matchmaking-btn').addEventListener('click', () =>
			this.startMatchmaking(),
		);

		// Lobby buttons
		this.getElement<HTMLButtonElement>('ready-btn').addEventListener('click', () =>
			this.toggleReady(),
		);
		this.getElement<HTMLButtonElement>('start-btn').addEventListener('click', () =>
			this.startGame(),
		);
		this.getElement<HTMLButtonElement>('leave-lobby-btn').addEventListener('click', () =>
			this.leaveLobby(),
		);

		// Matchmaking buttons
		this.getElement<HTMLButtonElement>('cancel-matchmaking-btn').addEventListener('click', () =>
			this.cancelMatchmaking(),
		);
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
			this.getElement<HTMLElement>('player-id').textContent = playerId;
			this.playerInitialized = true;

			// Enable lobby actions once the temporary player session exists.
			this.getElement<HTMLButtonElement>('create-lobby-btn').removeAttribute('disabled');
			this.getElement<HTMLButtonElement>('browse-lobbies-btn').removeAttribute('disabled');
			this.getElement<HTMLButtonElement>('matchmaking-btn').removeAttribute('disabled');

			await this.browseLobbies();
			await this.updateStats();
		} catch (error) {
			console.error('Failed to initialize player:', error);
			this.getElement<HTMLElement>('player-id').textContent = 'Unavailable';
			this.renderLobbyMessage('Unable to connect to the lobby server.');
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
			this.renderLobbyMessage('Unable to load open matches.');
		}
	}

	/**
	 * Show lobby browser with list of lobbies
	 */
	private showLobbyBrowser(lobbies: LobbyInfo[]): void {
		const lobbyList = this.getElement<HTMLElement>('lobby-list');

		if (lobbies.length === 0) {
			this.renderLobbyMessage('No open matches yet. Create one to get started.');
			return;
		}

		lobbyList.innerHTML = lobbies
			.map(
				(lobby) => `
					<div class="lobby-item" data-lobby-id="${lobby.id}">
						<div class="lobby-item__details">
							<span class="lobby-name">${lobby.name}</span>
							<span class="lobby-meta">${lobby.currentPlayerCount}/${lobby.maxPlayers} players</span>
						</div>
						<button class="btn join-lobby-btn">Join</button>
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
	}

	/**
	 * Join a lobby
	 */
	private async joinLobby(lobbyId: string): Promise<void> {
		try {
			const lobby = await this.client.joinLobby(lobbyId);
			this.currentLobby = lobby;
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

		const lobbyPanel = this.getElement<HTMLElement>('current-lobby');
		this.getElement<HTMLElement>('lobby-name').textContent = this.currentLobby.name;

		this.updatePlayerList();
		lobbyPanel.style.display = 'block';
	}

	/**
	 * Update player list in lobby
	 */
	private updatePlayerList(): void {
		if (!this.currentLobby) return;

		const playerList = this.getElement<HTMLElement>('player-list');
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
			this.getElement<HTMLElement>('current-lobby').style.display = 'none';
			void this.browseLobbies();
			void this.updateStats();
		}
	}

	/**
	 * Start matchmaking
	 */
	private async startMatchmaking(): Promise<void> {
		try {
			const waitTime = await this.client.addToQueue();
			this.getElement<HTMLElement>('wait-time').textContent =
				waitTime > 0 ? `${Math.round(waitTime / 1000)}s` : 'Unknown';

			this.getElement<HTMLElement>('matchmaking-panel').style.display = 'block';
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
			this.getElement<HTMLElement>('matchmaking-panel').style.display = 'none';
		} catch (error) {
			console.error('Failed to cancel matchmaking:', error);
		}
	}

	/**
	 * Handle match found
	 */
	private onMatchFound(match: MatchInfo): void {
		this.getElement<HTMLElement>('matchmaking-panel').style.display = 'none';
		alert(`Match found! Joining lobby ${match.lobbyId}`);
		void this.joinLobby(match.lobbyId);
	}

	/**
	 * Update server stats
	 */
	private async updateStats(): Promise<void> {
		try {
			const stats = await this.client.getStats();
			this.getElement<HTMLElement>('stat-players').textContent = stats.players.toString();
			this.getElement<HTMLElement>('stat-lobbies').textContent = stats.lobbies.toString();
		} catch (error) {
			console.error('Failed to update stats:', error);
		}
	}

	private renderLobbyMessage(message: string): void {
		this.getElement<HTMLElement>(
			'lobby-list',
		).innerHTML = `<div class="empty-state">${message}</div>`;
	}

	/**
	 * Show the lobby screen
	 */
	public show(): void {
		this.container.style.display = 'block';
		if (this.playerInitialized) {
			void this.browseLobbies();
		}
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
