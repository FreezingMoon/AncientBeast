import type {
	GameMessage,
	ITransport,
	PeerId,
	TransportConnectOptions,
} from '../../src/multiplayer/types';
import { safeStringify } from '../../src/multiplayer/transport/safeStringify';

export { type ITransport } from '../../src/multiplayer/types';

export interface DevvitTransportDeps {
	fetchImpl?: typeof fetch;
	pollIntervalMs?: number;
}

interface JoinResponse {
	myId: string;
	playerIndex: number;
	isHost: boolean;
}

interface MessageEntry {
	cursor: string;
	from: PeerId;
	message: GameMessage;
}

interface LobbyStateResponse {
	players: Array<{ peerId: PeerId; playerId: string; name: string; playerIndex: number }>;
	host: PeerId;
	hostPlayerId: string;
	status: string;
}

export class DevvitTransport implements ITransport {
	private readonly deps: DevvitTransportDeps;
	private readonly messageHandlers: Array<(data: GameMessage, peerId: PeerId) => void> = [];
	private readonly peerJoinHandlers: Array<(peerId: PeerId) => void> = [];
	private readonly peerLeaveHandlers: Array<(peerId: PeerId) => void> = [];
	private readonly connectedHandlers: Array<(peerId: PeerId) => void> = [];

	private myId = '';
	private isHost = false;
	private disconnected = false;
	private pollTimer: number | null = null;
	private pollInFlight = false;
	private cursor = '';
	private knownPeerIds = new Set<PeerId>();
	private lobbyCode = '';
	private connectResolve?: (() => void) | null = null;
	private triggerPoll?: () => void;
	private visibilityHandler?: () => void;

	private readonly pollIntervalMs: number;

	constructor(deps: DevvitTransportDeps) {
		this.deps = deps;
		// Keep Devvit polling tight for near-real-time multiplayer feel.
		this.pollIntervalMs = deps.pollIntervalMs ?? 120;
	}

	async connect(lobbyId: string, options: TransportConnectOptions = {}): Promise<void> {
		this.lobbyCode = lobbyId;
		this.isHost = Boolean(options.isHost);
		this.disconnected = false;
		this.cursor = '';
		this.knownPeerIds.clear();
		// Do NOT clear messageHandlers/peerJoinHandlers/etc. here — the provider registers
		// those callbacks once in its constructor (before connect() is ever called), so
		// clearing them would leave the transport permanently deaf to all messages.
		this.connectedHandlersFired = false;

		const fetchImpl = this.deps.fetchImpl ?? fetch;

		const joinRes = await fetchImpl(`/api/lobby/${encodeURIComponent(lobbyId)}/join`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: '', isHost: this.isHost }),
		});

		if (!joinRes.ok) {
			throw new Error(`Failed to join lobby: ${joinRes.status}`);
		}

		const joinData = (await joinRes.json()) as JoinResponse;
		this.myId = joinData.myId;
		this.isHost = joinData.isHost;

		await new Promise<void>((resolve) => {
			this.connectResolve = resolve;
			this.startPolling(fetchImpl);
		});
	}

	disconnect(): void {
		this.disconnected = true;
		this.connectResolve = null;
		this.triggerPoll = undefined;

		if (this.pollTimer !== null) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
		}

		if (this.visibilityHandler) {
			document.removeEventListener('visibilitychange', this.visibilityHandler);
			this.visibilityHandler = undefined;
		}

		const fetchImpl = this.deps.fetchImpl ?? fetch;
		fetchImpl(`/api/lobby/${encodeURIComponent(this.lobbyCode)}/leave`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ playerId: this.myId }),
		}).catch(() => {
			/* ignore leave errors */
		});
	}

	async send(data: GameMessage): Promise<void> {
		if (this.disconnected) {
			return;
		}

		const fetchImpl = this.deps.fetchImpl ?? fetch;
		const body = safeStringify({ message: data, playerId: this.myId });

		try {
			await fetchImpl(`/api/lobby/${encodeURIComponent(this.lobbyCode)}/message`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body,
			});
		} catch (error) {
			console.warn('[DevvitTransport] send failed:', error, String(data?.type ?? 'unknown'));
		}
	}

	async sendTo(_peerId: PeerId, data: GameMessage): Promise<void> {
		await this.send(data);
	}

	async sendExcept(_peerId: PeerId, data: GameMessage): Promise<void> {
		await this.send(data);
	}

	async fetchMessagesAfter(
		afterOrder: number,
	): Promise<Array<{ cursor: string; from: PeerId; message: GameMessage }>> {
		if (this.disconnected) {
			return [];
		}

		const fetchImpl = this.deps.fetchImpl ?? fetch;
		const base =
			typeof window !== 'undefined' && window.location.origin
				? window.location.origin
				: 'http://localhost';
		const url = new URL(`/api/lobby/${encodeURIComponent(this.lobbyCode)}/messages`, base);
		url.searchParams.set('playerId', this.myId);
		url.searchParams.set('after', String(afterOrder));

		try {
			const res = await fetchImpl(url.toString(), { method: 'GET' });

			if (!res.ok || this.disconnected) {
				return [];
			}

			const entriesRaw = await res.json();
			const entries = Array.isArray(entriesRaw) ? (entriesRaw as MessageEntry[]) : [];

			return entries.map((entry) => ({
				cursor: entry.cursor,
				from: entry.from,
				message: this.withServerOrder(entry.message, entry.cursor),
			}));
		} catch (error) {
			if (!this.disconnected) {
				console.warn('[DevvitTransport] fetchMessagesAfter failed:', error);
			}
			return [];
		}
	}

	onMessage(cb: (data: GameMessage, peerId: PeerId) => void): void {
		this.messageHandlers.push(cb);
	}

	onPeerJoin(cb: (peerId: PeerId) => void): void {
		this.peerJoinHandlers.push(cb);
	}

	onPeerLeave(cb: (peerId: PeerId) => void): void {
		this.peerLeaveHandlers.push(cb);
	}

	onConnected(cb: (peerId: PeerId) => void): void {
		this.connectedHandlers.push(cb);
	}

	getMyId(): string {
		return this.myId;
	}

	// Server decides host status authoritatively when joining (see routes/lobby.ts) — this
	// exposes the real result from `connect()`'s join response, rather than the requested
	// `isHost` option, which may not match (e.g. two players joining a matchmaking-created
	// lobby both request `isHost: false`, but the server designates the first one as host).
	isHostPeer(): boolean {
		return this.isHost;
	}

	private startPolling(fetchImpl: typeof fetch): void {
		if (this.pollTimer !== null) {
			clearInterval(this.pollTimer);
		}

		const poll = async () => {
			let shouldPollAgain = false;

			if (this.disconnected) {
				return;
			}

			// Guard against overlapping polls: if a previous poll is still awaiting its
			// network responses, the next interval tick would fetch the same `after`
			// cursor and reprocess (duplicate) every message in that window. Running a
			// single poll at a time keeps the cursor monotonic and guarantees each
			// message is delivered exactly once.
			if (this.pollInFlight) {
				return;
			}
			this.pollInFlight = true;

			try {
				const base =
					typeof window !== 'undefined' && window.location.origin
						? window.location.origin
						: 'http://localhost';
				const url = new URL(`/api/lobby/${encodeURIComponent(this.lobbyCode)}/messages`, base);
				url.searchParams.set('playerId', this.myId);
				if (this.cursor) {
					url.searchParams.set('after', this.cursor);
				}

				const res = await fetchImpl(url.toString(), { method: 'GET' });

				if (!res.ok || this.disconnected) {
					return;
				}

				const entriesRaw = await res.json();
				const entries = Array.isArray(entriesRaw) ? (entriesRaw as MessageEntry[]) : [];
				shouldPollAgain = entries.length > 0;
				const stateUrl = new URL(`/api/lobby/${encodeURIComponent(this.lobbyCode)}/state`, base);
				stateUrl.searchParams.set('playerId', this.myId);
				const stateRes = await fetchImpl(stateUrl.toString(), { method: 'GET' });

				if (this.disconnected) {
					return;
				}

				// A transient /state 404 (e.g. lobby not yet visible in Redis right after
				// matchmaking creates it) must not block message processing — we still need
				// to fire connectResolve and messageHandlers for entries we already fetched.
				const state: LobbyStateResponse | null = stateRes.ok
					? ((await stateRes.json()) as LobbyStateResponse)
					: null;

				for (const entry of entries) {
					this.cursor = entry.cursor;
					const message = this.withServerOrder(entry.message, entry.cursor);
					this.messageHandlers.forEach((handler) => handler(message, entry.from));

					if (entry.from === this.myId) {
						const resolve = this.connectResolve;
						if (resolve) {
							this.connectResolve = null;
							resolve();
						}
					}
				}

				if (state) {
					const statePlayers = Array.isArray(state.players) ? state.players : [];
					const currentPeerIds = new Set(statePlayers.map((p) => p.peerId));

					for (const peerId of currentPeerIds) {
						if (!this.knownPeerIds.has(peerId)) {
							this.knownPeerIds.add(peerId);
							this.peerJoinHandlers.forEach((handler) => handler(peerId));
						}
					}

					for (const peerId of this.knownPeerIds) {
						if (!currentPeerIds.has(peerId)) {
							this.knownPeerIds.delete(peerId);
							this.peerLeaveHandlers.forEach((handler) => handler(peerId));
						}
					}
				}

				if (!this.connectedHandlersFired) {
					this.connectedHandlersFired = true;
					this.connectedHandlers.forEach((handler) => handler(this.myId));
				}
			} catch (error) {
				if (!this.disconnected) {
					console.warn('[DevvitTransport] poll failed:', error);
				}
			} finally {
				this.pollInFlight = false;
				if (shouldPollAgain && !this.disconnected) {
					void poll();
				}
			}
		};

		this.triggerPoll = () => {
			void poll();
		};

		if (!this.visibilityHandler) {
			this.visibilityHandler = () => {
				if (document.visibilityState === 'visible' && this.triggerPoll) {
					this.triggerPoll();
				}
			};
			document.addEventListener('visibilitychange', this.visibilityHandler);
		}

		poll();
		this.pollTimer = window.setInterval(poll, this.pollIntervalMs);
	}

	private withServerOrder(message: GameMessage, cursor: string): GameMessage {
		const serverOrder = Number(cursor);

		if (!Number.isFinite(serverOrder)) {
			return message;
		}

		return {
			...message,
			serverOrder,
		};
	}

	private connectedHandlersFired = false;
}
