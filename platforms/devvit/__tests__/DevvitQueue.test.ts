import { expect, describe, test, beforeEach } from '@jest/globals';
import { handleQueueJoin, handleQueueStatus, tryMatchQueue, type RedisLike } from '../queue';

class FakeRedis implements RedisLike {
	private readonly strings = new Map<string, string>();
	private readonly sortedSets = new Map<string, Array<{ member: string; score: number }>>();

	async zAdd(key: string, ...members: Array<{ member: string; score: number }>): Promise<number> {
		let set = this.sortedSets.get(key);
		if (!set) {
			set = [];
			this.sortedSets.set(key, set);
		}
		let added = 0;
		for (const item of members) {
			const existing = set.findIndex((entry) => entry.member === item.member);
			if (existing >= 0) {
				set[existing] = item;
			} else {
				set.push(item);
				added++;
			}
		}
		return added;
	}

	async zRange(
		key: string,
		start: number,
		stop: number,
		_options?: { by: 'score' | 'rank' },
	): Promise<Array<{ member: string; score: number }>> {
		const set = this.sortedSets.get(key) || [];
		const sorted = [...set].sort((a, b) => a.score - b.score);
		const from = start === 0 ? 0 : start;
		const stopStr = String(stop);
		const to = stopStr === '+inf' || stopStr === '-1' ? sorted.length - 1 : (stop as number);
		return sorted.slice(from, to + 1);
	}

	async zRem(key: string, members: string[]): Promise<number> {
		const set = this.sortedSets.get(key);
		if (!set) return 0;
		let removed = 0;
		for (const member of members) {
			const idx = set.findIndex((item) => item.member === member);
			if (idx >= 0) {
				set.splice(idx, 1);
				removed++;
			}
		}
		return removed;
	}

	async set(key: string, value: string, _options?: Record<string, unknown>): Promise<string> {
		this.strings.set(key, value);
		return 'OK';
	}

	async get(key: string): Promise<string | undefined> {
		return this.strings.get(key);
	}

	async expire(_key: string, _seconds: number): Promise<void> {}

	async exists(...keys: string[]): Promise<number> {
		return keys.filter((key) => this.strings.has(key)).length;
	}

	async del(...keys: string[]): Promise<void> {
		for (const key of keys) {
			this.strings.delete(key);
			this.sortedSets.delete(key);
		}
	}
}

describe('queue', () => {
	let redis: FakeRedis;

	beforeEach(() => {
		redis = new FakeRedis();
	});

	test('two players get matched', async () => {
		const resA = await handleQueueJoin(redis, 'player-a');
		expect(resA.status).toBe('waiting');

		const resB = await handleQueueJoin(redis, 'player-b');
		expect(resB.status).toBe('waiting');

		const statusA = await handleQueueStatus(redis, 'player-a');
		expect(statusA.status).toBe('matched');
		expect(statusA.lobbyCode).toBeDefined();

		const statusB = await handleQueueStatus(redis, 'player-b');
		expect(statusB.status).toBe('matched');
		expect(statusB.lobbyCode).toBe(statusA.lobbyCode);
	});

	test('recent opponent is skipped within retry window', async () => {
		const recentKey = 'ab:recent:player-a:player-b';
		await redis.set(recentKey, '1');

		const joinA = await handleQueueJoin(redis, 'player-a');
		expect(joinA.status).toBe('waiting');
		const joinB = await handleQueueJoin(redis, 'player-b');
		expect(joinB.status).toBe('waiting');

		const status = await handleQueueStatus(redis, 'player-a');
		expect(status.status).toBe('waiting');
	});

	test('recent opponent is allowed after retry window', async () => {
		const recentKey = 'ab:recent:player-a:player-b';
		await redis.set(recentKey, '1');

		const oldTime = Date.now() - 20000;
		await redis.zAdd('ab:queue', { member: 'player-a', score: oldTime });
		await redis.zAdd('ab:queue', { member: 'player-b', score: oldTime });

		const result = await tryMatchQueue(redis);
		expect(result.matched).toBe(true);
		expect(result.lobbyCode).toBeDefined();
	});

	test('single player is not matched to a bot and stays queued', async () => {
		// The bot fallback was removed: a lone player just keeps waiting for a
		// human opponent (Bot Practice is a separate, explicit local game).
		const oldTime = Date.now() - 35000;
		await redis.zAdd('ab:queue', { member: 'player-a', score: oldTime });

		const joinResult = await handleQueueJoin(redis, 'player-a');
		expect(joinResult.status).toBe('waiting');

		const status = await handleQueueStatus(redis, 'player-a');
		expect(status.status).toBe('waiting');
		expect(status.lobbyCode).toBeUndefined();

		const queued = await redis.zRange('ab:queue', 0, -1, { by: 'rank' });
		expect(queued.find((entry) => entry.member === 'player-a')).toBeDefined();
	});
});
