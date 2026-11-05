// Devvit splash screen — the `default` post entrypoint, styled to match the
// in-game Devvit pre-match lobby (#devvitLobby) 1:1. The two buttons open the
// match in Devvit's larger "expanded" (pop-up) webview via requestExpandedMode.
//
// IMPORTANT: we must NOT import from '@devvit/web/client' at the top level. The
// splash is the very first entry loaded and the Devvit runtime globals (which
// that module reads at eval time) are not ready yet, so a top-level import throws
// and the whole bundle fails to run (dead buttons, no version badge). Instead we
// lazy-require `context` / `requestExpandedMode` inside the click handler, exactly
// like src/utility/clientVersion.ts does for the full game. By then the globals
// exist and the call succeeds.
import { getDevvitAppVersion, getGameVersion } from '../../src/utility/clientVersion';

const LAUNCH_KEY = 'ab:devvitLaunch';
const GAME_ENTRY = 'game';

function getPlayerId(): string {
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { context } = require('@devvit/web/client');
		return context?.userId ?? 'anon';
	} catch {
		return 'anon';
	}
}

function requestExpandedModeSafe(event: Event, entry: string): boolean {
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { requestExpandedMode } = require('@devvit/web/client');
		requestExpandedMode(event as MouseEvent, entry);
		return true;
	} catch (error) {
		console.warn('Devvit expanded mode unavailable:', error);
		return false;
	}
}

const $bot = document.getElementById('devvitBotPracticeButton') as HTMLInputElement;
const $queue = document.getElementById('devvitQueueButton') as HTMLInputElement;
const $status = document.getElementById('devvitQueueStatus') as HTMLDivElement;
const $counter = document.getElementById('devvitMatchesCounter') as HTMLDivElement;
const $badge = document.getElementById('badge') as HTMLDivElement;

function setStatus(html: string) {
	$status.innerHTML = html;
}

function setDisabled(disabled: boolean) {
	$bot.classList.toggle('disabled', disabled);
	$queue.classList.toggle('disabled', disabled);
	$bot.disabled = disabled;
	$queue.disabled = disabled;
}

const devvit = getDevvitAppVersion();
$badge.innerHTML =
	`<div class="ab-badge__game">${getGameVersion()}</div>` +
	(devvit ? `<div class="ab-badge__devvit">r${devvit}</div>` : '');

let queueActive = false;

function launchAndOpen(
	launch: { mode: 'bot' | 'queue' | 'lobby'; playerId: string; lobby?: string },
	event: Event,
) {
	try {
		localStorage.setItem(LAUNCH_KEY, JSON.stringify(launch));
	} catch (_error) {
		// Best-effort; the game falls back to the prematch screen if missing.
	}

	// Must be called synchronously within the user-gesture click handler.
	const expanded = requestExpandedModeSafe(event, GAME_ENTRY);
	if (!expanded) {
		// Expanded mode unavailable in this surface — load the game inline so the
		// button still does something.
		setStatus('Loading&hellip;');
		window.location.href = 'game.html';
	}
}

$bot.addEventListener('click', (event) => {
	if ($bot.disabled) {
		return;
	}
	if (queueActive) {
		void leaveQueue();
	}
	setDisabled(true);
	setStatus('Loading bot practice&hellip;');
	launchAndOpen({ mode: 'bot', playerId: getPlayerId() }, event);
});

$queue.addEventListener('click', (event) => {
	if (queueActive) {
		void leaveQueue('Queue cancelled.');
		return;
	}
	setDisabled(true);
	setStatus('<span class="ab-loading"></span>Opening match finder&hellip;');
	launchAndOpen({ mode: 'queue', playerId: getPlayerId() }, event);
});

async function leaveQueue(message = '') {
	queueActive = false;
	setDisabled(false);
	$queue.value = 'Online Duel';
	setStatus(message);
	try {
		await fetch('/api/queue/leave', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ playerId: getPlayerId() }),
		});
	} catch (_error) {
		// Best-effort; server-side TTL cleans up stale entries.
	}
	refreshCounter();
}

async function refreshCounter() {
	try {
		const res = await fetch('/api/queue/stats');
		if (!res.ok) {
			return;
		}
		const data = (await res.json()) as { queued: number; ongoingMatches: number };
		const parts: string[] = [];
		if (data.ongoingMatches > 0) {
			parts.push(`${data.ongoingMatches} match${data.ongoingMatches === 1 ? '' : 'es'} ongoing`);
		}
		if (data.queued > 0) {
			parts.push(`${data.queued} in queue`);
		}
		$counter.textContent = parts.join(' · ');
	} catch (_error) {
		// Non-critical.
	}
}

refreshCounter();
window.setInterval(refreshCounter, 8000);
