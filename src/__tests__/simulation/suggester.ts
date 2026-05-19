/**
 * suggester.ts — variant definitions and improvement reporter.
 *
 * Each Variant monkey-patches one or more bot parameters before running a
 * batch of matches, then restores the originals.  If a variant scores
 * significantly better than the baseline, a code-edit suggestion is printed.
 */

import type { MatchResult } from './botgeria';
import { aggregateMetrics, isSignificantlyBetter, formatMetrics, QualityMetrics } from './stats';

export interface Variant {
	/** Human-readable label, also used in suggestions output. */
	label: string;
	/** Apply the patch — returns a cleanup function that restores originals. */
	patch(game: any): () => void;
	/** Code snippet to emit when this variant is better than baseline. */
	suggestion: string;
}

// ─── Variant definitions ─────────────────────────────────────────────────────

export const variants: Variant[] = [
	// stalePendingActionMs — lower (faster recovery from stale actions)
	{
		label: 'stalePendingActionMs = 1500',
		patch: (game) => {
			const orig = game.botController.stalePendingActionMs;
			game.botController.stalePendingActionMs = 1500;
			return () => { game.botController.stalePendingActionMs = orig; };
		},
		suggestion:
			'In src/bot.ts → BotController, change:\n' +
			'  stalePendingActionMs = 2200;\n' +
			'to:\n' +
			'  stalePendingActionMs = 1500;',
	},
	// stalePendingActionMs — higher (more patient)
	{
		label: 'stalePendingActionMs = 3000',
		patch: (game) => {
			const orig = game.botController.stalePendingActionMs;
			game.botController.stalePendingActionMs = 3000;
			return () => { game.botController.stalePendingActionMs = orig; };
		},
		suggestion:
			'In src/bot.ts → BotController, change:\n' +
			'  stalePendingActionMs = 2200;\n' +
			'to:\n' +
			'  stalePendingActionMs = 3000;',
	},
	// Age pressure coefficient — more aggressive older creatures
	{
		label: 'agePressure coeff = 0.8 (more aggressive with age)',
		patch: (game) => {
			const origFn = game.botController.getAggressionFactor.bind(game.botController);
			game.botController.getAggressionFactor = (creature: any) => {
				const ageFactor = Math.max(0, creature.turnsActive - 4) * 0.8;
				const stagnantRounds = game.turn - game.botController.lastDamageRound;
				const stagnationFactor = Math.max(0, stagnantRounds - 3) * 1.5;
				return Math.min(10, ageFactor + stagnationFactor);
			};
			return () => { game.botController.getAggressionFactor = origFn; };
		},
		suggestion:
			'In src/bot.ts → BotController.getAggressionFactor(), change:\n' +
			'  const ageFactor = Math.max(0, creature.turnsActive - 4) * 0.5;\n' +
			'to:\n' +
			'  const ageFactor = Math.max(0, creature.turnsActive - 4) * 0.8;',
	},
	// Age pressure coefficient — less aggressive
	{
		label: 'agePressure coeff = 0.3 (more patient with age)',
		patch: (game) => {
			const origFn = game.botController.getAggressionFactor.bind(game.botController);
			game.botController.getAggressionFactor = (creature: any) => {
				const ageFactor = Math.max(0, creature.turnsActive - 4) * 0.3;
				const stagnantRounds = game.turn - game.botController.lastDamageRound;
				const stagnationFactor = Math.max(0, stagnantRounds - 3) * 1.5;
				return Math.min(10, ageFactor + stagnationFactor);
			};
			return () => { game.botController.getAggressionFactor = origFn; };
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
		patch: (game) => {
			const origFn = game.botController.getAggressionFactor.bind(game.botController);
			game.botController.getAggressionFactor = (creature: any) => {
				const ageFactor = Math.max(0, creature.turnsActive - 4) * 0.5;
				const stagnantRounds = game.turn - game.botController.lastDamageRound;
				const stagnationFactor = Math.max(0, stagnantRounds - 3) * 2.5;
				return Math.min(10, ageFactor + stagnationFactor);
			};
			return () => { game.botController.getAggressionFactor = origFn; };
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
		patch: (game) => {
			const origFn = game.botController.getAggressionFactor.bind(game.botController);
			game.botController.getAggressionFactor = (creature: any) => {
				const ageFactor = Math.max(0, creature.turnsActive - 4) * 0.5;
				const stagnantRounds = game.turn - game.botController.lastDamageRound;
				const stagnationFactor = Math.max(0, stagnantRounds - 3) * 0.8;
				return Math.min(10, ageFactor + stagnationFactor);
			};
			return () => { game.botController.getAggressionFactor = origFn; };
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
		patch: (game) => {
			// Monkey-patch the takeTurn function to raise the cap
			const origTakeTurn = game.botController.takeTurn?.bind(game.botController);
			if (!origTakeTurn) return () => undefined;
			// We patch by overriding decisionCount check — use prototype
			const proto = Object.getPrototypeOf(game.botController);
			const origMethod = proto.takeTurn;
			proto.takeTurn = function (this: any) {
				const origCap = 8;
				const cap = 12;
				// Temporarily raise the cap via a flag
				this._simDecisionCap = cap;
				const result = origMethod.call(this);
				this._simDecisionCap = origCap;
				return result;
			};
			return () => { proto.takeTurn = origMethod; };
		},
		suggestion:
			'In src/bot.ts → BotController.takeTurn(), change:\n' +
			'  if (this.decisionCount >= 8) {\n' +
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

/**
 * Run all variants against the baseline and return results.
 *
 * @param runBatch  Async function that runs N matches and returns results.
 *                  Receives the patched game factory and match count.
 */
export async function runVariants(
	baseline: QualityMetrics,
	runBatch: (patch: (game: any) => () => void, count: number) => Promise<MatchResult[]>,
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
