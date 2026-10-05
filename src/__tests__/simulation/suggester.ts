/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * suggester.ts — variant definitions and improvement reporter.
 *
 * Variants override a *named field* on BotController. They deliberately do not
 * re-implement `getAggressionFactor()`: the previous versions pasted a modified
 * copy of the method, which silently dropped the `engagementPressure` term. Every
 * result was therefore a two- or three-variable change reported as a
 * single-variable one, and three of the six variants were no-ops because their
 * target literal already matched the shipped value.
 *
 * Two invariants keep that from recurring:
 *   1. `patch` throws if the field is missing, so renaming a field in bot.ts
 *      fails the run instead of quietly measuring nothing.
 *   2. The emitted suggestion quotes the value observed at patch time, so the
 *      "from" side cannot drift away from the code.
 */
import {
	compareMetrics,
	formatBaselineDelta,
	formatMetrics,
	MIN_SAMPLE_FOR_VERDICT,
	Verdict,
} from './stats';
import type { QualityMetrics } from './stats';

export interface Variant {
	/** Human-readable label, also used in suggestions output. */
	readonly label: string;
	/** Apply the patch — returns a cleanup function that restores the original. */
	patch(game: any): () => void;
	/** Code snippet to emit when this variant is better than baseline. */
	readonly suggestion: string;
}

interface Sweep {
	/** BotController field to override. Must exist on the class. */
	field: string;
	/** Candidate value. */
	value: number;
	/** Why this value might help; shown beside the label. */
	note: string;
}

const SWEEPS: Sweep[] = [
	{ field: 'agePressureCoeff', value: 0.5, note: 'gentler with age' },
	{ field: 'agePressureCoeff', value: 1.2, note: 'harsher with age' },
	{ field: 'stagnationPressureCoeff', value: 1.5, note: 'slower to break stalemates' },
	{ field: 'stagnationPressureCoeff', value: 3.5, note: 'breaks stalemates faster' },
	{ field: 'engagementPressureCoeff', value: 0.5, note: 'ignore team engagement' },
	{ field: 'engagementPressureCoeff', value: 2.0, note: 'weight team engagement more' },
	{ field: 'maxDecisionCount', value: 8, note: 'fewer actions per turn' },
	{ field: 'maxDecisionCount', value: 16, note: 'more actions per turn' },
	{ field: 'stalePendingActionMs', value: 1200, note: 'impatient on stale input' },
	{ field: 'stalePendingActionMs', value: 3000, note: 'patient on stale input' },
];

function makeVariant(sweep: Sweep): Variant {
	// Captured during patch(), so the emitted diff quotes the value that was
	// actually in force rather than a literal baked into this file.
	let observed: number | null = null;

	return {
		label: `${sweep.field} = ${sweep.value} (${sweep.note})`,
		patch(game: any) {
			const controller = game?.botController;
			if (!controller) {
				throw new Error(`no botController on game; cannot sweep ${sweep.field}`);
			}
			if (!(sweep.field in controller)) {
				throw new Error(
					`BotController has no field "${sweep.field}" — the sweep list is stale. ` +
						`Rename it in src/bot.ts or drop it from SWEEPS.`,
				);
			}
			const original = controller[sweep.field];
			observed = original;
			controller[sweep.field] = sweep.value;
			return () => {
				controller[sweep.field] = original;
			};
		},
		get suggestion() {
			// Deliberately no "change X to Y" diff. `observed` is the value in force
			// during the run, and the harness lowers some timing defaults for speed
			// (`createGame` sets stalePendingActionMs to 20 against a shipped 2200).
			// A diff built from that would tell someone to edit a number that is not
			// in the source. Name the field, give the target, and label the baseline
			// as what the run actually saw.
			const baseline = observed === null ? 'unknown' : String(observed);
			return (
				`In src/bot.ts → BotController, set:\n` +
				`  ${sweep.field} = ${sweep.value};\n` +
				`Baseline observed in this run: ${baseline}. ` +
				`Check the shipped default in src/bot.ts first — the harness lowers ` +
				`some timing values to keep matches fast.`
			);
		},
	};
}

export const variants: Variant[] = SWEEPS.map(makeVariant);

// ─── Runner ──────────────────────────────────────────────────────────────────
export interface VariantRunResult {
	variant: Variant;
	metrics: QualityMetrics;
	verdict: Verdict;
}

/** Print a formatted comparison table and suggestions to stdout. */
export function printReport(
	baselineMetrics: QualityMetrics,
	variantResults: VariantRunResult[],
	reference?: { metrics: QualityMetrics; timestamp?: string },
): void {
	const line = '─'.repeat(80);
	const byVerdict = (v: Verdict) => variantResults.filter((r) => r.verdict === v);

	console.log('\n' + line);
	console.log('SIMULATION REPORT');
	console.log(line);
	console.log(formatMetrics('baseline', baselineMetrics));
	console.log('\nBaseline vs recorded reference:');
	console.log(
		formatBaselineDelta(reference?.metrics ?? null, baselineMetrics, reference?.timestamp),
	);

	if (baselineMetrics.matchCount < MIN_SAMPLE_FOR_VERDICT) {
		console.log(
			`\n⚠️  Baseline sample is n=${baselineMetrics.matchCount}, below the ` +
				`n=${MIN_SAMPLE_FOR_VERDICT} needed to call any variant better or worse.\n` +
				`   Every result below is noise. Raise SIM_BASELINE / SIM_VARIANT.`,
		);
	}

	const better = byVerdict('better');
	const worse = byVerdict('worse');
	const rest = byVerdict('inconclusive');

	if (rest.length > 0) {
		console.log('\nInconclusive (no metric moved far enough, or too small a sample):');
		for (const r of rest) {
			console.log('  ' + formatMetrics(r.variant.label, r.metrics));
		}
	}

	if (worse.length > 0) {
		console.log('\n📉 REGRESSIONS — do not ship these:');
		for (const r of worse) {
			console.log('  ' + formatMetrics(r.variant.label, r.metrics));
		}
	}

	if (better.length === 0) {
		console.log('\n✅  No variant beat the baseline beyond the noise floor.\n');
	} else {
		console.log('\n🚀  SUGGESTED IMPROVEMENTS (≥5 % better, with no metric regressing):');
		for (const r of better) {
			console.log('\n' + '─'.repeat(60));
			console.log(formatMetrics(r.variant.label, r.metrics));
			console.log('\n' + r.variant.suggestion);
		}
	}

	console.log('\n' + line + '\n');
}
