import { Hono } from 'hono';
import { redis } from '@devvit/web/server';
import {
	ACTIVE_MATCHES_KEY,
	QUEUE_KEY,
	handleQueueJoin,
	handleQueueLeave,
	handleQueueStatus,
	pruneActiveMatches,
} from './queue';

// Mounted at /api/queue
// NOTE: Devvit web views can only fetch() `/api/` endpoints — `/internal/` is reserved for
// platform-initiated dispatch (subreddit menu items, triggers, forms), not client-side calls.
// These used to live under /internal/queue/* and 404'd for exactly that reason.
export const apiQueue = new Hono();

apiQueue.post('/join', async (c) => {
	const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
	const playerId = String(body.playerId || '');

	if (!playerId) {
		return c.json({ error: 'playerId is required' }, 400);
	}

	const result = await handleQueueJoin(redis, playerId);
	return c.json(result);
});

apiQueue.post('/leave', async (c) => {
	const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
	const playerId = String(body.playerId || '');

	if (!playerId) {
		return c.json({ error: 'playerId is required' }, 400);
	}

	const result = await handleQueueLeave(redis, playerId);
	return c.json(result);
});

apiQueue.get('/status', async (c) => {
	const playerId = c.req.query('playerId') || '';

	if (!playerId) {
		return c.json({ error: 'playerId is required' }, 400);
	}

	const result = await handleQueueStatus(redis, playerId);
	return c.json(result);
});

apiQueue.get('/stats', async (c) => {
	await pruneActiveMatches(redis);

	const [queued, ongoingMatches] = await Promise.all([
		redis.zCard(QUEUE_KEY),
		redis.zCard(ACTIVE_MATCHES_KEY),
	]);

	return c.json({ queued, ongoingMatches });
});
