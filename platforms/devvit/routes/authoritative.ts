/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';
import { authoritativeProcessor } from './authoritativeRuntime';
import type { Intent } from './authoritativeTypes';

/**
 * Authoritative log route (transport-agnostic, engine-agnostic).
 *
 * Mount with:  app.route('/api/authoritative', authoritative);
 *
 * Flow:
 *   POST /:code/step  { intent }  -> server appends the intent to the
 *                                    ordered log; returns its sequence.
 *   GET  /:code/state              -> current ordered log (clients run the
 *                                    engine locally to derive AuthoritativeState).
 *
 * The server never runs the engine — the engine (`LobbyEngine`/`game.ts`)
 * lives in any context that can bundle pixi/phaser (the client browser, the
 * playtest runner, …). The server's job is to authoritatively ORDER intents.
 */
export const authoritative = new Hono();

authoritative.post('/:code/step', async (c) => {
	const code = c.req.param('code');
	const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
	const intent = body.intent as Intent;
	if (!intent || typeof intent.kind !== 'string') {
		return c.json({ error: 'Missing or invalid intent' }, 400);
	}

	const { sequence } = await authoritativeProcessor.step(code, intent);
	return c.json({ sequence });
});

authoritative.get('/:code/state', async (c) => {
	const code = c.req.param('code');
	const log = await authoritativeProcessor.getLog(code);
	return c.json({ sequence: log.length, intents: log });
});
