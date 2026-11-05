import { randomUUID } from 'node:crypto';
import { redis } from '@devvit/web/server';
import { createLobby, type LobbyMeta } from './queue';

const LOBBY_PREFIX = 'ab:lobby';
const LOG_MAX_LENGTH = 256;
// A player is considered disconnected only after this long without any polling activity
// (join/message/messages/state calls all refresh their lastSeen). This must comfortably
// exceed how slowly a *backgrounded* browser tab keeps polling: browsers throttle
// setInterval on hidden tabs, dropping to roughly once per minute after the tab has been
// hidden for a few minutes ("intensive throttling"). With a 10s timeout, an unfocused tab
// (e.g. the opponent's window when testing two clients on one machine) would be wrongly
// flagged stale and end the match. 90s leaves margin above the ~60s worst-case throttle.
const HEARTBEAT_TIMEOUT_MS = 90000;
const PLAYER_TTL_SECONDS = 3600;

export interface PlayerRecord {
	peerId: string;
	playerId: string;
	name: string;
	playerIndex: number;
	lastSeen: number;
}

export interface MessageEntry {
	cursor: string;
	from: string;
	message: Record<string, unknown>;
}

function lobbyMetaKey(code: string): string {
	return `${LOBBY_PREFIX}:${code}:meta`;
}

function lobbyPlayersKey(code: string): string {
	return `${LOBBY_PREFIX}:${code}:players`;
}

function lobbyLogKey(code: string): string {
	return `${LOBBY_PREFIX}:${code}:log`;
}

function lobbyCursorKey(code: string): string {
	return `${LOBBY_PREFIX}:${code}:cursor`;
}

function lobbyLastSeenKey(code: string, peerId: string): string {
	return `${LOBBY_PREFIX}:${code}:lastSeen:${peerId}`;
}

function lobbyHostClaimKey(code: string): string {
	return `${LOBBY_PREFIX}:${code}:hostClaim`;
}

/**
 * Atomically decides who becomes host for a lobby, using a `SET NX` claim key instead of
 * checking/writing `LobbyMeta.hostPeerId` directly. Two players can join a matchmaking-created
 * lobby within milliseconds of each other (both navigated there right after being matched), and
 * a plain "is hostPeerId already set?" read-then-write check has a race window where both could
 * read it as empty and both end up assigned as host (and both as playerIndex 0), breaking the
 * match setup. Only the peer whose SET NX actually succeeds becomes host.
 */
export async function claimHost(code: string, peerId: string): Promise<boolean> {
	try {
		const claimed = await redis.set(lobbyHostClaimKey(code), peerId, { nx: true });
		await redis.expire(lobbyHostClaimKey(code), PLAYER_TTL_SECONDS);
		return Boolean(claimed);
	} catch (_error) {
		// Some redis clients throw instead of returning a falsy value when NX fails.
		return false;
	}
}

export async function getLobbyMeta(code: string): Promise<LobbyMeta | null> {
	const raw = await redis.get(lobbyMetaKey(code));
	if (!raw) {
		return null;
	}
	return JSON.parse(raw) as LobbyMeta;
}

export async function setLobbyMeta(code: string, meta: LobbyMeta): Promise<void> {
	await redis.set(lobbyMetaKey(code), JSON.stringify(meta));
	await redis.expire(lobbyMetaKey(code), PLAYER_TTL_SECONDS);
}

export async function getPlayers(code: string): Promise<PlayerRecord[]> {
	const raw = await redis.hGetAll(lobbyPlayersKey(code));
	if (!raw || Object.keys(raw).length === 0) {
		return [];
	}

	const players: PlayerRecord[] = [];
	for (const peerId of Object.keys(raw)) {
		players.push(JSON.parse(raw[peerId]) as PlayerRecord);
	}
	return players;
}

export async function setPlayer(code: string, player: PlayerRecord): Promise<void> {
	await redis.hSet(lobbyPlayersKey(code), { [player.peerId]: JSON.stringify(player) });
	await redis.expire(lobbyPlayersKey(code), PLAYER_TTL_SECONDS);
}

export async function removePlayer(code: string, peerId: string): Promise<void> {
	await redis.hDel(lobbyPlayersKey(code), [peerId]);
	await redis.del(lobbyLastSeenKey(code, peerId));
	await redis.expire(lobbyPlayersKey(code), PLAYER_TTL_SECONDS);
}

export async function appendMessage(
	code: string,
	from: string,
	message: Record<string, unknown>,
): Promise<string> {
	const cursorKey = lobbyCursorKey(code);
	let cursor = await redis.get(cursorKey);
	if (!cursor) {
		cursor = '0';
	}
	const nextCursor = Number(cursor) + 1;

	const entry: MessageEntry = {
		cursor: String(nextCursor),
		from,
		message,
	};

	await redis.zAdd(lobbyLogKey(code), { score: nextCursor, member: JSON.stringify(entry) });
	await redis.zRemRangeByRank(lobbyLogKey(code), 0, -LOG_MAX_LENGTH - 1);
	await redis.set(cursorKey, String(nextCursor));

	await redis.expire(lobbyLogKey(code), PLAYER_TTL_SECONDS);
	await redis.expire(cursorKey, PLAYER_TTL_SECONDS);

	return String(nextCursor);
}

export async function getMessages(code: string, after: string): Promise<MessageEntry[]> {
	const afterNum = Number(after) || 0;
	const raw = await redis.zRange(lobbyLogKey(code), afterNum + 1, '+inf', { by: 'score' });

	if (!raw || raw.length === 0) {
		return [];
	}

	const entries: MessageEntry[] = [];
	for (const item of raw) {
		const entry = JSON.parse(item.member) as MessageEntry;
		entries.push(entry);
	}
	return entries;
}

export async function refreshTtl(code: string): Promise<void> {
	await redis.expire(lobbyMetaKey(code), PLAYER_TTL_SECONDS);
	await redis.expire(lobbyPlayersKey(code), PLAYER_TTL_SECONDS);
	await redis.expire(lobbyLogKey(code), PLAYER_TTL_SECONDS);
	await redis.expire(lobbyCursorKey(code), PLAYER_TTL_SECONDS);
}

export async function isPlayerStale(code: string, peerId: string): Promise<boolean> {
	const lastSeenRaw = await redis.get(lobbyLastSeenKey(code, peerId));
	if (!lastSeenRaw) {
		return true;
	}
	const lastSeen = Number(lastSeenRaw);
	return Date.now() - lastSeen > HEARTBEAT_TIMEOUT_MS;
}

export async function markPlayerSeen(code: string, peerId: string): Promise<void> {
	await redis.set(lobbyLastSeenKey(code, peerId), String(Date.now()));
	await redis.expire(lobbyLastSeenKey(code, peerId), PLAYER_TTL_SECONDS);
}

export function newLobbyCode(): string {
	return randomUUID().slice(0, 8).toUpperCase();
}

export function newPeerId(): string {
	return randomUUID();
}

export { createLobby, type LobbyMeta };
