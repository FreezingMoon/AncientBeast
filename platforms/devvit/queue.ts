export interface QueuePlayer {
	playerId: string;
	queuedAt: number;
}

export interface RedisLike {
	zAdd(key: string, ...members: Array<{ member: string; score: number }>): Promise<number>;
	zRange(
		key: string,
		start: number,
		stop: number,
		options?: { by: 'score' | 'rank' },
	): Promise<Array<{ member: string; score: number }>>;
	zRem(key: string, members: string[]): Promise<number>;
	set(key: string, value: string, options?: Record<string, unknown>): Promise<string>;
	get(key: string): Promise<string | undefined>;
	expire(key: string, seconds: number): Promise<void>;
	exists(...keys: string[]): Promise<number>;
	del(...keys: string[]): Promise<void>;
}

export interface LobbyMeta {
	code: string;
	config: Record<string, unknown>;
	status: string;
	hostPeerId: string;
	createdAt: number;
	bot?: boolean;
}

export const QUEUE_KEY = 'ab:queue';
export const ACTIVE_MATCHES_KEY = 'ab:activeMatches';
const RECENT_TTL_SECONDS = 86400;
const RECENT_RETRY_MS = 3000;
const MATCHED_TTL_SECONDS = 300;

function matchedKey(playerId: string): string {
	return `ab:matched:${playerId}`;
}

function recentKey(playerIdA: string, playerIdB: string): string {
	const [a, b] = [playerIdA, playerIdB].sort();
	return `ab:recent:${a}:${b}`;
}

function generateMatchCode(): string {
	// Must match the AB-XXXX format validated by parseLobbyCodeInput on the client.
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let suffix = '';
	for (let i = 0; i < 4; i++) {
		suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
	}
	return `AB-${suffix}`;
}

export async function createLobby(
	redis: RedisLike,
	initialMeta?: Partial<LobbyMeta>,
): Promise<string> {
	const code = generateMatchCode();
	const meta: LobbyMeta = {
		code,
		config: {},
		status: 'waiting',
		hostPeerId: '',
		createdAt: Date.now(),
		...initialMeta,
	};
	await redis.set(`ab:lobby:${code}:meta`, JSON.stringify(meta));
	await redis.expire(`ab:lobby:${code}:meta`, 3600);
	return code;
}

export async function getQueuePlayers(redis: RedisLike): Promise<QueuePlayer[]> {
	const entries = await redis.zRange(QUEUE_KEY, 0, -1, { by: 'rank' });
	if (!entries || entries.length === 0) {
		return [];
	}
	return entries.map((entry) => ({
		playerId: entry.member,
		queuedAt: Math.floor(entry.score),
	}));
}

async function isRecentMatch(redis: RedisLike, playerA: string, playerB: string): Promise<boolean> {
	const key = recentKey(playerA, playerB);
	return (await redis.exists(key)) > 0;
}

export async function tryMatchQueue(
	redis: RedisLike,
): Promise<{ matched: boolean; lobbyCode?: string }> {
	const players = await getQueuePlayers(redis);

	if (players.length < 2) {
		return { matched: false };
	}

	const now = Date.now();

	const sorted = [...players].sort((a, b) => a.queuedAt - b.queuedAt);

	for (const caller of sorted) {
		const candidates = players.filter((p) => p.playerId !== caller.playerId);
		let bestNonRecent: string | undefined;
		let bestRecent: string | undefined;

		for (const candidate of candidates) {
			if (await isRecentMatch(redis, caller.playerId, candidate.playerId)) {
				if (!bestRecent) {
					bestRecent = candidate.playerId;
				}
			} else {
				bestNonRecent = candidate.playerId;
				break;
			}
		}

		let chosen: string | undefined;
		if (bestNonRecent) {
			chosen = bestNonRecent;
		} else if (bestRecent && now - caller.queuedAt >= RECENT_RETRY_MS) {
			chosen = bestRecent;
		}

		if (chosen) {
			await redis.zRem(QUEUE_KEY, [caller.playerId, chosen]);

			const lobbyCode = await createLobby(redis);

			const rKey = recentKey(caller.playerId, chosen);
			await redis.set(rKey, '1');
			await redis.expire(rKey, RECENT_TTL_SECONDS);

			await redis.set(matchedKey(caller.playerId), lobbyCode);
			await redis.expire(matchedKey(caller.playerId), MATCHED_TTL_SECONDS);
			await redis.set(matchedKey(chosen), lobbyCode);
			await redis.expire(matchedKey(chosen), MATCHED_TTL_SECONDS);

			return { matched: true, lobbyCode };
		}
	}

	return { matched: false };
}

export async function handleQueueJoin(
	redis: RedisLike,
	playerId: string,
): Promise<{ status: string; lobbyCode?: string; bot?: boolean }> {
	const existingMatch = await redis.get(matchedKey(playerId));
	if (existingMatch) {
		const meta = await redis.get(`ab:lobby:${existingMatch}:meta`);
		if (meta) {
			const parsed = JSON.parse(meta) as LobbyMeta;
			return { status: 'matched', lobbyCode: existingMatch, bot: Boolean(parsed.bot) };
		}
		await redis.del(matchedKey(playerId));
	}

	const existing = await redis.zRange(QUEUE_KEY, 0, -1, { by: 'rank' });
	const alreadyQueued = existing.some((entry) => entry.member === playerId);

	if (!alreadyQueued) {
		await redis.zAdd(QUEUE_KEY, { member: playerId, score: Date.now() });
	}

	return { status: 'waiting' };
}

export async function handleQueueStatus(
	redis: RedisLike,
	playerId: string,
): Promise<{ status: string; lobbyCode?: string; bot?: boolean }> {
	let lobbyCode = await redis.get(matchedKey(playerId));

	if (!lobbyCode) {
		// Nothing else re-invokes matchmaking after the initial join, so retry it here
		// while the client polls. If no suitable opponent is waiting, the player simply
		// stays in the queue until one shows up (or they cancel) — there is no bot
		// fallback; Bot Practice is a separate, explicit local game.
		await tryMatchQueue(redis);
		lobbyCode = await redis.get(matchedKey(playerId));
	}

	if (lobbyCode) {
		const meta = await redis.get(`ab:lobby:${lobbyCode}:meta`);
		if (meta) {
			const parsed = JSON.parse(meta) as LobbyMeta;
			return { status: 'matched', lobbyCode, bot: Boolean(parsed.bot) };
		}
	}
	return { status: 'waiting' };
}

export async function handleQueueLeave(
	redis: RedisLike,
	playerId: string,
): Promise<{ status: 'left' }> {
	await redis.zRem(QUEUE_KEY, [playerId]);
	await redis.del(matchedKey(playerId));
	return { status: 'left' };
}

export async function pruneActiveMatches(redis: RedisLike): Promise<void> {
	const entries = await redis.zRange(ACTIVE_MATCHES_KEY, 0, -1, { by: 'rank' });
	if (!entries || entries.length === 0) {
		return;
	}

	const toRemove: string[] = [];

	for (const entry of entries) {
		const code = entry.member;
		const metaRaw = await redis.get(`ab:lobby:${code}:meta`);
		if (!metaRaw) {
			toRemove.push(code);
			continue;
		}

		let meta: LobbyMeta | undefined;
		try {
			meta = JSON.parse(metaRaw) as LobbyMeta;
		} catch (_error) {
			toRemove.push(code);
			continue;
		}

		if (!meta || meta.status === 'ended') {
			toRemove.push(code);
			continue;
		}

		const hasPlayers = (await redis.exists(`ab:lobby:${code}:players`)) > 0;
		if (!hasPlayers) {
			toRemove.push(code);
		}
	}

	if (toRemove.length > 0) {
		await redis.zRem(ACTIVE_MATCHES_KEY, toRemove);
	}
}
