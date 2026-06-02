/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * suggester.ts — variant definitions and improvement reporter.
 */
import type { MatchResult } from './botgeria';
import { aggregateMetrics, isSignificantlyBetter, formatMetrics, QualityMetrics } from './stats';
export interface Variant {
	/** Human-readable label, also used in suggestions output. */
	label: string;
	/** Apply the patch — returns a cleanup function that restores originals. */
	patch(game: Record<string, unknown>): () => void;
	/** Code snippet to emit when this variant is better than baseline. */
	suggestion: string;
}

export const variants: Variant[] = [
	// stalePendingActionMs — higher (more patient)
	{
		label: 'stalePendingActionMs = 3000',
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		patch: (game: Record<string, unknown>) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const orig = ((game as any).botController as any)?.stalePendingActionMs;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			((game as any).botController as any).stalePendingActionMs = 3000;
			return () => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				((game as any).botController as any).stalePendingActionMs = orig;
			};
		},
		suggestion:
			'In src/bot.ts → BotController, change:\n' +
			'  stalePendingActionMs = 2200;\n' +
			'to:\n' +
			'  stalePendingActionMs = 3000;',
	},
	// Age pressure coefficient — more aggressive
	{
		label: 'agePressure coeff = 0.8 (more aggressive with age)',
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		patch: (game: Record<string, unknown>) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const origFn = ((game as any).botController as any).getAggressionFactor.bind(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(game as any).botController,
			);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			((game as any).botController as any).getAggressionFactor = (
				creature: Record<string, unknown>,
			) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const ageFactor = Math.max(0, ((creature as any).turnsActive as number) - 4) * 0.8;
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const stagnantRounds =
					((game as any).turn as number) -
					(((game as any).botController as any).lastDamageRound as number);
				const stagnationFactor = Math.max(0, stagnantRounds - 3) * 1.5;
				return Math.min(10, ageFactor + stagnationFactor);
			};
			return () => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				((game as any).botController as any).getAggressionFactor = origFn;
			};
		},
		suggestion:
			'In src/bot.ts → BotController, change:\n' +
			'  const ageFactor = Math.max(0, creature.turnsActive - 4) * 0.8;\n' +
			'to:\n' +
			'  const ageFactor = Math.max(0, creature.turnsActive - 4) * 0.8;',
	},
	// Age pressure coefficient — less aggressive
	{
		label: 'agePressure coeff = 0.3 (more patient with age)',
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		patch: (game: Record<string, unknown>) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const origFn = ((game as any).botController as any).getAggressionFactor.bind(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(game as any).botController,
			);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			((game as any).botController as any).getAggressionFactor = (
				creature: Record<string, unknown>,
			) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const ageFactor = Math.max(0, ((creature as any).turnsActive as number) - 4) * 0.3;
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const stagnantRounds =
					((game as any).turn as number) -
					(((game as any).botController as any).lastDamageRound as number);
				const stagnationFactor = Math.max(0, stagnantRounds - 3) * 1.5;
				return Math.min(10, ageFactor + stagnationFactor);
			};
			return () => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				((game as any).botController as any).getAggressionFactor = origFn;
			};
		},
		suggestion:
			'In src/bot.ts → BotController.getAggressionFactor(), change:\n' +
			'  const ageFactor = Math.max(0, creature.turnsActive - 4) * 0.5;\n' +
			'to:\n' +
			'  const ageFactor = Math.max(0, creature.turnsActive - 4) * 0.3;',
	},
	// Stagnation pressure coefficient — escalate stagnation faster
	{
		label: 'stagnationPressure coeff = 2.5 (break stalemates faster)',
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		patch: (game: Record<string, unknown>) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const origFn = ((game as any).botController as any).getAggressionFactor.bind(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(game as any).botController,
			);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			((game as any).botController as any).getAggressionFactor = (
				creature: Record<string, unknown>,
			) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const ageFactor = Math.max(0, ((creature as any).turnsActive as number) - 4) * 0.5;
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const stagnantRounds =
					((game as any).turn as number) -
					(((game as any).botController as any).lastDamageRound as number);
				const stagnationFactor = Math.max(0, stagnantRounds - 3) * 2.5;
				return Math.min(10, ageFactor + stagnationFactor);
			};
			return () => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				((game as any).botController as any).getAggressionFactor = origFn;
			};
		},
		suggestion:
			'In src/bot.ts → BotController.getAggressionFactor(), change:\n' +
			'  const stagnationFactor = Math.max(0, stagnantRounds - 3) * 1.5;\n' +
			'to:\n' +
			'  const stagnationFactor = Math.max(0, stagnantRounds - 3) * 2.5;',
	},
	// Stagnation pressure — more patient
	{
		label: 'stagnationPressure coeff = 0.8 (allow longer stand-offs)',
		patch: (game: Record<string, unknown>) => {
			const origFn = ((game as any).botController as any).getAggressionFactor.bind(
				(game as any).botController,
			);
			((game as any).botController as any).getAggressionFactor = (
				creature: Record<string, unknown>,
			) => {
				const ageFactor = Math.max(0, (creature as any).turnsActive - 4) * 0.5;
				const stagnantRounds =
					(game as any).turn - ((game as any).botController as any).lastDamageRound;
				const stagnationFactor = Math.max(0, stagnantRounds - 3) * 0.8;
				return Math.min(10, ageFactor + stagnationFactor);
			};
			return () => {
				((game as any).botController as any).getAggressionFactor = origFn;
			};
		},
		suggestion:
			'In src/bot.ts → BotController.getAggressionFactor(), change:\n' +
			'  const stagnationFactor = Math.max(0, stagnantRounds - 3) * 1.5;\n' +
			'to:\n' +
			'  const stagnationFactor = Math.max(0, stagnantRounds - 3) * 0.8;',
	},
	// Decision budget — more decisions per turn
	{
		label: 'max decisionCount = 12 (more actions per turn)',
		patch: (game: Record<string, unknown>) => {
			// Monkey-patch takeTurn on the prototype to use a higher cap
			const proto = Object.getPrototypeOf((game as Record<string, unknown>).botController);
			const origMethod = proto.takeTurn;
			proto.takeTurn = function (this: Record<string, unknown>) {
				// Temporarily override the instance's decisionCount check via a flag,
				// then call the original. The original checks this.decisionCount >= 10,
				// so we save/restore and substitute a higher cap by patching the check.
				const origDecisionCount = this.decisionCount;
				// Scale existing count so the effective cap is 12 instead of 10.
				// If decisionCount is 10 (would stop), scale to 12 (lets through).
				// Cap ratio: 10 → 12. Only adjust if at the boundary.
				const orig = Object.getOwnPropertyDescriptor(this, 'decisionCount');
				const REAL_CAP = 10;
				const NEW_CAP = 12;
				if (
					(this.decisionCount as number) >= REAL_CAP &&
					(this.decisionCount as number) < NEW_CAP
				) {
					// Temporarily bring it below the real cap so takeTurn doesn't skip
					this.decisionCount = REAL_CAP - 1;
					const result = origMethod.call(this);
					// After the call decisionCount was incremented; clamp to origDecisionCount+1
					if ((this.decisionCount as number) <= REAL_CAP) {
						this.decisionCount = (origDecisionCount as number) + 1;
					}
					return result;
				}
				return origMethod.call(this);
			};
			return () => {
				proto.takeTurn = origMethod;
			};
		},
		suggestion:
			'In src/bot.ts → BotController.takeTurn(), change:\n' +
			'  if (this.decisionCount >= 10) {\n' +
			'to:\n' +
			'  if (this.decisionCount >= 12) {',
	},
];
// ─── Runner ──────────────────────────────────────────────────────────────────
export interface VariantRunResult {
	variant: Variant;
	metrics: QualityMetrics;
	isBetter: boolean;
}
export async function runVariants(
	baseline: QualityMetrics,
	runBatch: (
		patch: (game: Record<string, unknown>) => () => void,
		count: number,
	) => Promise<MatchResult[]>,
	matchesPerVariant = 1000,
): Promise<VariantRunResult[]> {
	const results: VariantRunResult[] = [];
	for (const variant of variants) {
		console.log(`  Running variant: ${variant.label} …`);
		const matches = await runBatch(variant.patch, matchesPerVariant);
		const metrics = aggregateMetrics(matches);
		const isBetter = isSignificantlyBetter(baseline, metrics);
		results.push({ variant, metrics, isBetter });
	}
	return results;
}
/** Print a formatted comparison table and suggestions to stdout. */
export function printReport(
	baselineMetrics: QualityMetrics,
	variantResults: VariantRunResult[],
): void {
	const line = '─'.repeat(80);
	console.log('\n' + line);
	console.log('SIMULATION REPORT');
	console.log(line);
	console.log(formatMetrics('baseline', baselineMetrics));
	const better = variantResults.filter((r) => r.isBetter);
	const unchanged = variantResults.filter((r) => !r.isBetter);

	if (unchanged.length > 0) {
		console.log('\nNo significant improvement:');
		for (const r of unchanged) {
			console.log('  ' + formatMetrics(r.variant.label, r.metrics));
		}
	}

	if (better.length === 0) {
		console.log('\n✅  Baseline is already near-optimal — no suggestions.\n');
	} else {
		console.log('\n🚀  SUGGESTED IMPROVEMENTS (≥5 % better on at least one metric):');
		for (const r of better) {
			console.log('\n' + '─'.repeat(60));
			console.log(formatMetrics(r.variant.label, r.metrics));
			console.log('\n' + r.variant.suggestion);
		}
	}

	console.log('\n' + line + '\n');
}
