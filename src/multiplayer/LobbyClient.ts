import type Game from '../game';
import { PeerLobbyProvider } from './PeerLobbyProvider';
import { crazyGames } from '../../platforms/crazygames/crazygames';
import type { AuthoritativeState, Intent } from './authoritative';
import {
	GameConfig,
	GameMessage,
	INetworkBackend,
	LobbyCode,
	LobbySession,
	LobbyState,
	generateLobbyCode,
	normalizeLobbyCode,
} from './types';

export class LobbyClient {
	private readonly game: Game;
	private readonly provider: INetworkBackend;

	constructor(game: Game, provider: INetworkBackend = new PeerLobbyProvider()) {
		this.game = game;
		this.provider = provider;

		this.game.lobby = this;

		this.provider.onLobbyUpdate((lobby) => {
			this.game.lobbyState = lobby;
			this.game.onLobbyUpdate?.(lobby);
		});

		this.provider.onGameMessage((message) => this.game.handleLobbyMessage(message));
		this.provider.onAuthoritativeState((state) => this.game.adoptAuthoritativeState(state));
	}

	async createMatch(config: GameConfig, code?: LobbyCode): Promise<LobbySession> {
		const session = await this.provider.createLobby(config, code);
		this.game.lobbyCode = session.code;
		this.game.matchid = session.code;
		this.game.lobbyState = this.getLobbyState();
		this.syncCrazyGamesRoom(true);
		return session;
	}

	async joinMatch(code: LobbyCode): Promise<LobbySession> {
		const session = await this.provider.joinLobby(code);
		this.game.lobbyCode = code;
		this.game.matchid = code;
		this.game.lobbyState = this.getLobbyState();
		this.syncCrazyGamesRoom(false);
		return session;
	}

	leaveMatch(): void {
		this.provider.leaveLobby();
		crazyGames.leftRoom();
	}

	/**
	 * Mark the current room as no longer joinable (the match is starting). The
	 * host calls this so CrazyGames stops advertising the room to new players.
	 */
	markRoomStarted(): void {
		this.syncCrazyGamesRoom(false);
	}

	/**
	 * Share the current room with CrazyGames so friends can join/invite. The room
	 * stays joinable until the match starts; the invite params carry the lobby
	 * code so an invite link can auto-join.
	 */
	private syncCrazyGamesRoom(isJoinable: boolean): void {
		const code = this.game.lobbyCode;
		if (!code) {
			return;
		}
		crazyGames.shareRoom(code, isJoinable);
	}

	async sendAction(message: GameMessage): Promise<void> {
		await this.provider.sendGameMessage(message);
	}

	/** Send a player input to the authoritative server (transport-agnostic). */
	async sendIntent(intent: Intent): Promise<void> {
		await this.provider.sendIntent(intent);
	}

	isMyTurn(): boolean {
		const localPlayer = this.provider.getLocalPlayer();

		if (!localPlayer || !this.game.activeCreature) {
			return false;
		}

		return this.game.activeCreature.player.id === localPlayer.playerIndex;
	}

	isHost(): boolean {
		return this.provider.isHost();
	}

	getLobbyState(): LobbyState {
		return this.provider.getLobbyState();
	}

	/** Receive authoritative state snapshots broadcast by the server. */
	onAuthoritativeState(cb: (state: AuthoritativeState) => void): void {
		this.provider.onAuthoritativeState(cb);
	}

	getLocalPlayer() {
		return this.provider.getLocalPlayer();
	}

	markMatchStarted(): void {
		this.provider.markMatchStarted();
	}

	parseUrlJoinCode(): LobbyCode | null {
		if (typeof window === 'undefined' || !window.location.search) {
			return null;
		}

		const params = new URLSearchParams(window.location.search);
		const join = params.get('join');
		const lobby = params.get('lobby');
		const code = join || lobby;

		if (!code) {
			return null;
		}

		return normalizeLobbyCode(code);
	}

	parseJoinInput(value: string): LobbyCode {
		const trimmed = value.trim();

		if (!trimmed) {
			return '';
		}

		const joinParam = trimmed.match(/[?&]join=([^&]+)/i)?.[1];
		if (joinParam) {
			return normalizeLobbyCode(joinParam);
		}

		try {
			const url = new URL(trimmed);
			const code = url.searchParams.get('join');
			return normalizeLobbyCode(code || trimmed);
		} catch (_error) {
			return normalizeLobbyCode(trimmed);
		}
	}

	getShareUrl(): string {
		if (!this.game.lobbyCode) {
			return window.location.href.split('?')[0];
		}

		// On CrazyGames, build a platform invite link so the URL carries the
		// invite context through the CrazyGames player. Falls back to the plain
		// `?join=` URL elsewhere (and when the SDK is unavailable).
		const inviteLink = crazyGames.makeInviteLink({ join: this.game.lobbyCode });
		if (inviteLink) {
			return inviteLink;
		}

		const url = new URL(window.location.href);
		url.searchParams.set('join', this.game.lobbyCode);
		return url.toString();
	}

	async copyLobbyCode(): Promise<void> {
		if (!this.game.lobbyCode) {
			return;
		}

		const text = this.getShareUrl();

		if (typeof navigator.clipboard?.writeText === 'function') {
			await navigator.clipboard.writeText(text);
			return;
		}

		const textarea = document.createElement('textarea');
		textarea.value = text;
		textarea.style.position = 'fixed';
		textarea.style.left = '-9999px';
		document.body.appendChild(textarea);
		textarea.select();
		document.execCommand('copy');
		textarea.remove();
	}

	static createCode(): LobbyCode {
		return generateLobbyCode();
	}
}
