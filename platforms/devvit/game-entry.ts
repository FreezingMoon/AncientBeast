import { context } from '@devvit/web/client';

// The full game (index.html) already supports auto-joining the matchmaking queue via
// `?net=devvit&playerId=<id>` URL params (see src/script.ts). This tiny entrypoint just
// bridges the Devvit "game" post entrypoint to that existing, already-tested game shell
// without touching any game bootstrap logic.
const playerId = context.userId ?? 'anon';
const target = new URL('index.html', window.location.href);
target.searchParams.set('net', 'devvit');
target.searchParams.set('playerId', playerId);
window.location.replace(target.toString());
