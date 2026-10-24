import type { AuthoritativeState, Intent } from './authoritative';

export type { AuthoritativeState, Intent } from './authoritative';

export type PeerId = string;
export type LobbyCode = string;
export type PlayerId = string;

export type GameConfig = {
	gameMode: number;
	creaLimitNbr: number;
	unitDrops: number;
	abilityUpgrades: number;
	plasma_amount: number;
	turnTimePool: number;
	timePool: number;
	background_image: string;
};

export type AbilityTarget =
	| { type: 'hex'; x: number; y: number }
	| { type: 'creature'; crea: number }
	| { type: 'array'; array: Array<{ x: number; y: number }> };

export type GameMessage = {
	serverOrder?: number;
} & (
	| { type: 'player-joined'; player: LobbyPlayer }
	| { type: 'lobby-joined'; player: LobbyPlayer }
	| { type: 'player-left'; playerId: PlayerId; player: LobbyPlayer }
	| {
			type: 'match-start';
			config: GameConfig;
			players: LobbyPlayer[];
			host: PlayerId;
			hostPeerId: PeerId;
	  }
	| { type: 'match-loaded'; playerId?: PlayerId }
	| { type: 'sync-request'; playerId: PlayerId; expectedServerOrder: number; reason?: string }
	| {
			type: 'sync-snapshot';
			playerId: PlayerId;
			config: GameConfig;
			reason?: string;
	  }
	| { type: 'turn-update'; playerId: PlayerId; creatureId: number; turn: number }
	| {
			type: 'action-end';
			action: 'skip' | 'delay';
			playerId: PlayerId;
			creatureId: number;
	  }
	| {
			type: 'action-move';
			target: { x: number; y: number };
			// The exact hex-by-hex path the acting client's pathfinding produced.
			// The receiver replays this path directly instead of recalculating its
			// own from `target`, so a transient grid-state difference between the
			// two clients (e.g. from an in-flight animation) can't send the
			// creature down a different route or to a different final hex.
			path?: Array<{ x: number; y: number }>;
			playerId: PlayerId;
			creatureId: number;
	  }
	| {
			type: 'action-ability';
			id: number;
			target: AbilityTarget;
			args: unknown[];
			playerId: PlayerId;
			creatureId: number;
	  }
	| {
			type: 'creature-died';
			// Authoritative confirmation of a death, broadcast by the client whose
			// action caused it (see Creature.die()). The receiver force-applies the
			// death if its own local state still has the creature alive, instead of
			// trusting its own damage computation to have agreed — this is what
			// prevents "creature died for one player, still alive for the other".
			creatureId: number;
			killerId?: number;
			playerId: PlayerId;
	  }
	| { type: 'heartbeat'; timestamp: number; playerId: PlayerId }
	// ── Server-authoritative dialect (transport-agnostic; flows through any
	//    ITransport alongside the relay dialect above). A client sends `intent`
	//    (its input); the server applies it through the deterministic engine and
	//    broadcasts the resulting `authoritative-state` snapshot to every client,
	//    which adopts it. Both dialects share the same envelope so transports
	//    (Devvit realtime, PeerJS, Rivalis, Hono) just carry the bytes.
	| { type: 'intent'; intent: Intent; playerId: PlayerId }
	| { type: 'authoritative-state'; state: AuthoritativeState; sequence: number }
);

export interface TransportConnectOptions {
	isHost?: boolean;
	hostPeerId?: PeerId;
}

export interface ITransport {
	connect(lobbyId: string, options?: TransportConnectOptions): Promise<void>;
	disconnect(): void;
	send(data: GameMessage): Promise<void>;
	sendTo(peerId: PeerId, data: GameMessage): Promise<void>;
	sendExcept(peerId: PeerId, data: GameMessage): Promise<void>;
	onMessage(cb: (data: GameMessage, peerId: PeerId) => void): void;
	onPeerJoin(cb: (peerId: PeerId) => void): void;
	onPeerLeave(cb: (peerId: PeerId) => void): void;
	onConnected(cb: (peerId: PeerId) => void): void;
	getMyId(): string;
}

export interface LobbyPlayer {
	playerId: PlayerId;
	peerId: PeerId;
	name: string;
	playerIndex: number;
	isBot?: boolean;
}

export interface LobbySession {
	code: LobbyCode;
	host: PeerId;
	hostPlayerId: PlayerId;
	players: LobbyPlayer[];
	config: GameConfig;
	status: LobbyStatus;
	myPlayer: LobbyPlayer;
}

export type LobbyStatus = 'idle' | 'waiting' | 'playing' | 'ended';

export interface LobbyState {
	code: LobbyCode;
	host: PlayerId;
	hostPeerId: PeerId;
	players: LobbyPlayer[];
	config: GameConfig;
	status: LobbyStatus;
}

export interface INetworkBackend {
	createLobby(config: GameConfig, code?: LobbyCode): Promise<LobbySession>;
	joinLobby(code: LobbyCode): Promise<LobbySession>;
	leaveLobby(): void;
	isHost(): boolean;
	getLobbyState(): LobbyState;
	getLocalPlayer(): LobbyPlayer | undefined;
	markMatchStarted(): void;
	sendGameMessage(message: GameMessage): Promise<void>;
	/** Send a player input to the authoritative server (transport-agnostic). */
	sendIntent(intent: Intent): Promise<void>;
	onLobbyUpdate(cb: (lobby: LobbyState) => void): void;
	onGameMessage(cb: (message: GameMessage) => void): void;
	/** Receive authoritative state snapshots broadcast by the server. */
	onAuthoritativeState(cb: (state: AuthoritativeState) => void): void;
}

export function normalizeLobbyCode(code: LobbyCode): string {
	const normalized = code
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9-]/g, '');

	if (/^[A-Z0-9]{4}$/.test(normalized)) {
		return `AB-${normalized}`;
	}

	return normalized;
}

export function getPeerIdForLobby(code: LobbyCode): PeerId {
	return `ab-lobby-${normalizeLobbyCode(code).replace(/-/g, '')}`;
}

export function generateLobbyCode(): LobbyCode {
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let code = '';
	for (let index = 0; index < 4; index += 1) {
		code += alphabet[Math.floor(Math.random() * alphabet.length)];
	}
	return `AB-${code.slice(0, 2)}${code.slice(2)}`;
}

export function isActionMessage(message: GameMessage): boolean {
	return (
		message.type === 'action-end' ||
		message.type === 'action-move' ||
		message.type === 'action-ability'
	);
}

export function isSequencedGameMessage(message: GameMessage): boolean {
	return (
		message.type === 'match-start' ||
		message.type === 'match-loaded' ||
		message.type === 'turn-update' ||
		message.type === 'action-end' ||
		message.type === 'action-move' ||
		message.type === 'action-ability' ||
		message.type === 'creature-died' ||
		message.type === 'player-left'
	);
}

/**
 * Action messages that the originating client already applies locally before
 * sending (e.g. Ability.animation -> animation2 -> activate -> summon for
 * materialize). In relay-based backends (Devvit) the server echoes every message
 * back to its sender, so the receiver must skip these self-originated echoes to
 * avoid applying the same effect twice (stacked units, duplicate moves, etc.).
 * Peer mode sidesteps this with sendExcept(sender). `turn-update` is also
 * self-applied by the acting client via local turn handoff, so replaying the
 * echoed update can re-trigger activate()/UI transitions and stack hints.
 * `creature-died` is likewise self-applied by Creature.die() on the reporting
 * client itself, before the message is ever sent.
 */
export function isSelfAppliedActionMessage(message: GameMessage): boolean {
	return (
		isActionMessage(message) || message.type === 'turn-update' || message.type === 'creature-died'
	);
}
