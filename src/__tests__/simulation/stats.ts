/**
 * stats.ts — quality metric aggregation for simulation results.
 */

import type { MatchResult } from './botgeria';

export interface QualityMetrics {
	/** Number of matches in this sample. */
	matchCount: number;
	/** Mean winning margin (winner score − loser score). Higher = more decisive. */
	decisiveness: number;
	/** Mean turn count per match. */
	avgTurns: number;
	/** Fraction of matches that ended by timeout (turn cap) rather than combat. */
	timeoutRate: number;
}

export function aggregateMetrics(results: MatchResult[]): QualityMetrics {
	const n = results.length;
	if (n === 0) {
		return { matchCount: 0, decisiveness: 0, avgTurns: 0, timeoutRate: 0 };
	}

	let totalMargin = 0;
	let totalTurns = 0;
	let timeouts = 0;

	for (const r of results) {
		const sorted = [...r.scores].sort((a, b) => b - a);
		totalMargin += sorted[0] - (sorted[1] ?? 0);
		totalTurns += r.turns;
		if (r.endedByTimeout) timeouts++;
	}

	return {
		matchCount: n,
		decisiveness: totalMargin / n,
		avgTurns: totalTurns / n,
		timeoutRate: timeouts / n,
	};
}

/**
 * Returns true when `next` is significantly better than `base`.
 * "Better" means:
 *   - decisiveness increased by at least `threshold` (default 5 %)
 *   - avgTurns changed by at least `threshold` towards [30, 80] sweet-spot
 *   - timeoutRate decreased by at least `threshold`
 */
export function isSignificantlyBetter(
	base: QualityMetrics,
	next: QualityMetrics,
	threshold = 0.05,
): boolean {
	const decisivenessImproved =
		base.decisiveness > 0
			? (next.decisiveness - base.decisiveness) / base.decisiveness >= threshold
			: next.decisiveness > 0;

	const sweetSpot = (turns: number) => {
		if (turns < 30) return Math.abs(turns - 30);
		if (turns > 80) return Math.abs(turns - 80);
		return 0; // within sweet-spot
	};
	const turnsImproved = sweetSpot(next.avgTurns) < sweetSpot(base.avgTurns) * (1 - threshold);

	const timeoutImproved =
		base.timeoutRate > 0
			? (base.timeoutRate - next.timeoutRate) / base.timeoutRate >= threshold
			: false;

	return decisivenessImproved || turnsImproved || timeoutImproved;
}

export function formatMetrics(label: string, m: QualityMetrics): string {
	return (
		`${label.padEnd(42)} | ` +
		`n=${m.matchCount} | ` +
		`decisiveness=${m.decisiveness.toFixed(1)} | ` +
		`avgTurns=${m.avgTurns.toFixed(1)} | ` +
		`timeout=${(m.timeoutRate * 100).toFixed(1)}%`
	);
}
