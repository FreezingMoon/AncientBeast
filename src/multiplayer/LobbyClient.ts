import type Game from '../game';
import { PeerLobbyProvider } from './PeerLobbyProvider';
import {
	GameConfig,
	GameMessage,
	ILobbyProvider,
	LobbyCode,
	LobbySession,
	LobbyState,
	generateLobbyCode,
	normalizeLobbyCode,
} from './types';

export class LobbyClient {
	private readonly game: Game;
	private readonly provider: ILobbyProvider;

	constructor(game: Game, provider: ILobbyProvider = new PeerLobbyProvider()) {
		this.game = game;
		this.provider = provider;

		this.provider.onLobbyUpdate((lobby) => {
			this.game.lobbyState = lobby;
			this.game.onLobbyUpdate?.(lobby);
		});

		this.provider.onGameMessage((message) => this.game.handleLobbyMessage(message));
	}

	async createMatch(config: GameConfig, code?: LobbyCode): Promise<LobbySession> {
		const session = await this.provider.createLobby(config, code);
		this.game.lobbyCode = session.code;
		this.game.matchid = session.code;
		this.game.lobbyState = this.getLobbyState();
		return session;
	}

	async joinMatch(code: LobbyCode): Promise<LobbySession> {
		const session = await this.provider.joinLobby(code);
		this.game.lobbyCode = code;
		this.game.matchid = code;
		this.game.lobbyState = this.getLobbyState();
		return session;
	}

	leaveMatch(): void {
		this.provider.leaveLobby();
	}

	sendAction(message: GameMessage): void {
		this.provider.sendGameMessage(message);
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
		const code = params.get('join');

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
