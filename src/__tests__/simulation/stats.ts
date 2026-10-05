/**
 * stats.ts — quality metric aggregation for simulation results.
 */

import type { MatchResult } from './botgeria';

export interface QualityMetrics {
	/** Number of matches in this sample. */
	matchCount: number;
	/** Matches that reached a real conclusion rather than the turn cap. */
	decidedCount: number;
	/** Mean winning margin (winner score − loser score) over *decided* matches.
	 *  Timeouts are excluded: a stalemate is not a decisive win, and averaging it
	 *  in let a variant look better purely by blowing games out faster. */
	decisiveness: number;
	/** Mean turn count per match. */
	avgTurns: number;
	/** Fraction of matches that ended by timeout (turn cap) rather than combat. */
	timeoutRate: number;
}

/**
 * Below this many matches a 5 % swing is indistinguishable from noise, so the
 * harness reports the comparison as inconclusive instead of crowning a winner.
 *
 * The first smoke run crowned `agePressure coeff = 0.8` — a variant whose patch
 * was a literal no-op — purely because two lucky matches happened to score high.
 */
export const MIN_SAMPLE_FOR_VERDICT = 8;

export function aggregateMetrics(results: MatchResult[]): QualityMetrics {
	const n = results.length;
	if (n === 0) {
		return { matchCount: 0, decidedCount: 0, decisiveness: 0, avgTurns: 0, timeoutRate: 0 };
	}

	let totalMargin = 0;
	let decided = 0;
	let totalTurns = 0;
	let timeouts = 0;

	for (const r of results) {
		totalTurns += r.turns;
		if (r.endedByTimeout) {
			timeouts++;
			continue;
		}
		const sorted = [...r.scores].sort((a, b) => b - a);
		totalMargin += sorted[0] - (sorted[1] ?? 0);
		decided++;
	}

	return {
		matchCount: n,
		decidedCount: decided,
		decisiveness: decided > 0 ? totalMargin / decided : 0,
		avgTurns: totalTurns / n,
		timeoutRate: timeouts / n,
	};
}

export type Verdict = 'better' | 'worse' | 'inconclusive';

/** Distance from the [30, 80] turn sweet-spot; 0 means inside it. */
function sweetSpot(turns: number): number {
	if (turns < 30) return Math.abs(turns - 30);
	if (turns > 80) return Math.abs(turns - 80);
	return 0;
}

/**
 * Relative change from `base` to `next`, or `null` when the comparison carries
 * no information (either side is 0, so no ratio exists).
 */
function relativeDelta(base: number, next: number): number | null {
	if (base === next) return 0;
	if (base === 0) return null;
	return (next - base) / base;
}

/**
 * Compares a variant against the baseline on all three metrics.
 *
 * The previous version could only answer yes/no and had two defects: its timeout
 * test was `next < base * 0.95`, which is *unsatisfiable* when the baseline
 * timeout rate is 0 (it demands a negative rate), and it reported "better" if
 * *any* single metric improved even when another regressed badly.
 *
 * Now a verdict needs a usable sample, at least one real improvement, and no
 * significant regression on any metric.
 */
export function compareMetrics(
	base: QualityMetrics,
	next: QualityMetrics,
	threshold = 0.05,
	minSample: number = MIN_SAMPLE_FOR_VERDICT,
): Verdict {
	if (next.matchCount < minSample || base.matchCount < minSample) {
		return 'inconclusive';
	}
	// A variant that times out every match has no decisiveness to compare; the
	// timeout regression is the verdict on its own.
	if (next.decidedCount === 0 || base.decidedCount === 0) {
		return 'inconclusive';
	}

	const decisivenessDelta = relativeDelta(base.decisiveness, next.decisiveness);
	const timeoutDelta = relativeDelta(base.timeoutRate, next.timeoutRate);

	const better =
		(decisivenessDelta !== null && decisivenessDelta >= threshold) ||
		(timeoutDelta !== null && timeoutDelta <= -threshold) ||
		sweetSpot(next.avgTurns) < sweetSpot(base.avgTurns) * (1 - threshold);

	const worse =
		(decisivenessDelta !== null && decisivenessDelta <= -threshold) ||
		(timeoutDelta !== null && timeoutDelta >= threshold) ||
		sweetSpot(next.avgTurns) > sweetSpot(base.avgTurns) / (1 - threshold);

	if (better && !worse) return 'better';
	if (worse && !better) return 'worse';
	return 'inconclusive';
}

export function formatMetrics(label: string, m: QualityMetrics): string {
	return (
		`${label.padEnd(44)} | ` +
		`n=${m.matchCount} | ` +
		`decided=${m.decidedCount} | ` +
		`decisiveness=${m.decisiveness.toFixed(1)} | ` +
		`avgTurns=${m.avgTurns.toFixed(1)} | ` +
		`timeout=${(m.timeoutRate * 100).toFixed(1)}%`
	);
}
