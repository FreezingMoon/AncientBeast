/**
 * @jest-environment <rootDir>/test/jsdom-environment.js
 * @jest-environment-options {"resources": "usable"}
 */

/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * simulate.test.ts
 *
 * Single entry point for `bun run simulate`.
 *
 * Phase 1: SIM_BASELINE matches (default 20) → saves simulation-baseline.json
 * Phase 2: SIM_VARIANT matches per variant (default 10) → compares against baseline
 * Phase 3: prints the report
 *
 * Each game takes roughly 10–30 s of wall time.
 * Default run (20 + 10×10 = 120 games) takes about 45–70 minutes.
 * For a quick smoke-test:  SIM_BASELINE=8 SIM_VARIANT=8 bun run simulate
 * For higher confidence:   SIM_BASELINE=100 SIM_VARIANT=50 bun run simulate
 *
 * This suite measures balance; it does not enforce it. Beyond the batch-size
 * assertion it now also fails on structural match violations (see
 * `checkMatchInvariants`), because a game that boots, hits the turn cap and
 * reports nonsense scores previously counted as a clean pass.
 *
 * Mock order matters: jest.mock() calls are hoisted before any imports.
 */
import { jest, describe, test } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
// ─── Mock heavy external deps BEFORE importing game modules ─────────────────
jest.mock('pixi', () => ({}), { virtual: true });
jest.mock('p2', () => ({}), { virtual: true });
import { variants, printReport } from './suggester';
import { aggregateMetrics, compareMetrics, formatMetrics } from './stats';
import { checkMatchInvariants, createGame, disposeGame, runMatch } from './botgeria';
import { performance as realPerf } from 'perf_hooks';
import type { MatchResult } from './botgeria';
import type { QualityMetrics } from './stats';
import type { VariantRunResult } from './suggester';
import { expect } from '@jest/globals';
// ─── Ability loaders ──────────────────────────────────────────────────────────

// Load all ability files so creatures have working skills
const ABILITY_FILES = [
	'../../abilities/Abolished',
	'../../abilities/Bounty-Hunter',
	'../../abilities/Chimera',
	'../../abilities/Cyber-Wolf',
	'../../abilities/Cycloper',
	'../../abilities/Dark-Priest',
	'../../abilities/Golden-Wyrm',
	'../../abilities/Gumble',
	'../../abilities/Headless',
	'../../abilities/Horn-Head',
	'../../abilities/Impaler',
	'../../abilities/Infernal',
	'../../abilities/Knightmare',
	'../../abilities/Nutcase',
	'../../abilities/Scavenger',
	'../../abilities/Snow-Bunny',
	'../../abilities/Stomper',
	'../../abilities/Swine-Thug',
	'../../abilities/Uncle-Fungus',
	'../../abilities/Vehemoth',
];

async function loadAbilities(): Promise<Array<(G: unknown) => void>> {
	const loaders: Array<(G: unknown) => void> = [];
	for (const f of ABILITY_FILES) {
		try {
			const mod = await import(f);
			loaders.push(mod.default ?? mod);
		} catch {
			// Ability file failed to load — game still runs without it
		}
	}
	return loaders;
}

// ─── Match batch runner ───────────────────────────────────────────────────────

// Write directly to /dev/tty so progress bypasses Jest's output buffering.
// Falls back to process.stderr when running in CI or non-TTY environments.
async function ttyWrite(text: string) {
	try {
		const fs2 = await import('fs');
		const fd = fs2.openSync('/dev/tty', 'w');
		fs2.writeSync(fd, text);
		fs2.closeSync(fd);
	} catch {
		(process.stderr as any).write(text);
	}
}

function progressBar(done: number, total: number, label: string, width = 30): string {
	const filled = Math.round((done / total) * width);
	const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
	return `\r  [${bar}] ${done}/${total}  ${label}`;
}

/** Structural violations seen across the whole run, reported by the test. */
const invariantProblems: string[] = [];

/**
 * Append one arm's result as soon as it finishes.
 *
 * Jest buffers `console.log` and only flushes it when a suite ends, so a hard
 * abort — an OOM SIGABRT, a segfault in Phaser — throws away every table the run
 * had produced. Appending per arm means a crashed 220-match run still yields the
 * arms that did finish, and the file is readable while the run is in flight.
 */
function recordResult(label: string, metrics: QualityMetrics, verdict?: string): void {
	fs.appendFileSync(
		RESULTS_PATH,
		JSON.stringify({
			label,
			metrics,
			verdict: verdict ?? null,
			timestamp: new Date().toISOString(),
		}) + '\n',
	);
}

async function runBatch(
	count: number,
	label: string,
	patchFn?: (game: unknown) => () => void,
): Promise<MatchResult[]> {
	const abilities = await loadAbilities();
	const results: MatchResult[] = [];

	for (let i = 0; i < count; i++) {
		const _t0 = realPerf.now();
		const game = await createGame(abilities);
		const _createMs = realPerf.now() - _t0;
		let restore: (() => void) | undefined;
		try {
			if (patchFn) {
				restore = patchFn(game);
			}
			const _t1 = realPerf.now();
			const result = await runMatch(game);
			const _matchMs = realPerf.now() - _t1;
			const creatureNames = (game.creatures as { type?: string; name?: string }[])
				.filter((c: { type?: string }) => c && c.type !== 'Dark Priest')
				.map((c: { name?: string; type?: string }) => c.name ?? c.type ?? '?')
				.join(',');
			(process.stderr as any).write(
				`  [${label}/game${i} createGame=${_createMs.toFixed(0)}ms runMatch=${_matchMs.toFixed(
					0,
				)}ms turns=${result.turns} scores=${result.scores.join('v')} ${
					result.endedByTimeout ? 'TIMEOUT' : 'ok'
				}] ${creatureNames}\n`,
			);
			for (const problem of checkMatchInvariants(result, game)) {
				invariantProblems.push(`${label}/game${i}: ${problem}`);
			}
			results.push(result);
		} finally {
			// Always restore, even if the match threw. Leaving a sweep override in
			// place would silently contaminate every later batch in the run.
			restore?.();
			// And always tear the game down. Skipping this leaks a whole Phaser
			// scene per match; the run OOMs at the 4 GB heap ceiling.
			disposeGame(game);
		}
		ttyWrite(progressBar(i + 1, count, label));
	}
	ttyWrite('\n');

	return results;
}

// ─── The test ─────────────────────────────────────────────────────────────────

const BASELINE_PATH = path.resolve(process.cwd(), 'simulation-baseline.json');
/**
 * Per-run results file. The name carries the pid on purpose: two simulations
 * running in the same checkout (a second agent session, a CI matrix row sharing a
 * volume) otherwise append to one file and interleave each other's arms, which
 * makes the results unreadable and silently wrong. Override with SIM_RESULTS.
 */
const RESULTS_PATH = path.resolve(
	process.cwd(),
	process.env.SIM_RESULTS ?? `simulation-results-${process.pid}.jsonl`,
);
// Default counts are intentionally small (~10-30 s per game).
// For tighter statistical confidence, increase via env vars:
//   SIM_BASELINE=100 SIM_VARIANT=50 bun run simulate
const BASELINE_COUNT = parseInt(process.env.SIM_BASELINE || '20', 10);
const VARIANT_COUNT = parseInt(process.env.SIM_VARIANT || '10', 10);

/**
 * Budget the whole batch, rather than inheriting a fixed ceiling.
 *
 * Since the native-Phaser move a match runs on a real stepped clock, so it costs
 * real wall-clock time. Scaling with the configured counts keeps
 * `bun run simulate` meaningful at any size, and lets a caller trade wall-clock
 * for statistical confidence via the env vars without editing this file.
 */
const TOTAL_MATCHES = BASELINE_COUNT + VARIANT_COUNT * variants.length;
/** Generous per-match allowance; a match that overruns is worth finishing. */
const PER_MATCH_BUDGET_MS = 60_000;
/** Startup, variant patching and report rendering. */
const BATCH_OVERHEAD_MS = 120_000;
jest.setTimeout(TOTAL_MATCHES * PER_MATCH_BUDGET_MS + BATCH_OVERHEAD_MS);

describe('Bot simulation', () => {
	test('run simulation and report balance deltas', async () => {
		// Fresh results file per run; append-only within it.
		fs.writeFileSync(RESULTS_PATH, '');
		console.log(`📝  Appending arm results to ${RESULTS_PATH}`);

		// ── Phase 1: baseline ──────────────────────────────────────────────────
		ttyWrite(`\n📊  Phase 1: ${BASELINE_COUNT} baseline matches\n`);
		const baselineResults = await runBatch(BASELINE_COUNT, 'baseline');
		const baselineMetrics: QualityMetrics = aggregateMetrics(baselineResults);
		console.log('Baseline: ' + formatMetrics('baseline', baselineMetrics));
		recordResult('baseline', baselineMetrics);

		fs.writeFileSync(
			BASELINE_PATH,
			JSON.stringify({ metrics: baselineMetrics, timestamp: new Date().toISOString() }, null, 2),
		);
		console.log(`✅  Saved baseline to ${BASELINE_PATH}`);

		// ── Phase 2: variants ─────────────────────────────────────────────────
		ttyWrite(`\n🔬  Phase 2: ${variants.length} variants × ${VARIANT_COUNT} matches\n`);

		const variantResults: VariantRunResult[] = [];
		for (const variant of variants) {
			const matches = await runBatch(VARIANT_COUNT, variant.label, variant.patch);
			const metrics = aggregateMetrics(matches);
			const verdict = compareMetrics(baselineMetrics, metrics);
			recordResult(variant.label, metrics, verdict);
			variantResults.push({ variant, metrics, verdict });
		}

		// ── Phase 3: report ───────────────────────────────────────────────────
		printReport(baselineMetrics, variantResults);
		recordResult(
			'__invariants__',
			{
				matchCount: 0,
				decidedCount: 0,
				decisiveness: 0,
				avgTurns: 0,
				timeoutRate: 0,
			},
			invariantProblems.length ? invariantProblems.join('; ') : 'none',
		);

		// These are the assertions that make the run able to fail. A short batch
		// means the harness never actually executed.
		expect(baselineMetrics.matchCount).toBe(BASELINE_COUNT);
		for (const r of variantResults) {
			expect(r.metrics.matchCount).toBe(VARIANT_COUNT);
		}
		expect(invariantProblems).toEqual([]);
	});
});
