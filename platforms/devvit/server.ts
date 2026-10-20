import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/web/server';
import { lobby } from './routes/lobby';
import { apiQueue } from './routes/queue';
import { menu } from './routes/menu';
import { triggers } from './routes/triggers';

const app = new Hono();
const internal = new Hono();

app.onError((err, c) => {
	console.error('Devvit server error:', err);
	return c.json({ error: 'Internal server error', message: err.message }, 500);
});

internal.route('/menu', menu);
internal.route('/triggers', triggers);

app.route('/api/lobby', lobby);
app.route('/api/queue', apiQueue);
app.route('/internal', internal);

serve({
	fetch: app.fetch,
	createServer,
	port: getServerPort(),
});
