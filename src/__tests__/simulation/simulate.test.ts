/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * simulate.test.ts
 *
 * Single entry point for `npm run simulate`.
 *
 * Phase 1: SIM_BASELINE matches (default 20) → saves simulation-baseline.json
 * Phase 2: SIM_VARIANT matches per variant (default 10) → compares against baseline
 * Phase 3: prints improvement suggestions
 *
 * Each game takes roughly 20–40 s of wall time.
 * Default run (20 + 7×10 = 90 games) takes about 30–60 minutes.
 * For a quick smoke-test:  SIM_BASELINE=3 SIM_VARIANT=2 npm run simulate
 * For higher confidence:   SIM_BASELINE=100 SIM_VARIANT=50 npm run simulate
 *
 * Mock order matters: jest.mock() calls are hoisted before any imports.
 */
import { jest, describe, test } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
// ─── Mock heavy external deps BEFORE importing game modules ──────────────────
jest.mock('pixi', () => ({}), { virtual: true });
jest.mock('p2', () => ({}), { virtual: true });
jest.mock('phaser-ce', () => ({
	Point: class PointMock {},
	Polygon: class PolygonMock {},
	default: class PhaserMock {},
	AUTO: 0,
	ScaleManager: { SHOW_ALL: 0 },
	Easing: {
		Linear: { None: 'Linear.None' },
		Quadratic: { In: 'Quad.In', Out: 'Quad.Out', InOut: 'Quad.InOut' },
	},
	Text: class PhaserText {},
	Sprite: class PhaserSprite {},
	Group: class PhaserGroup {},
	Tween: class PhaserTween {},
	Signal: class PhaserSignal {
		add() {}
		remove() {}
		dispatch() {}
	},
	Game: class PhaserGame {
		scale = {
			parentIsWindow: false,
			pageAlignHorizontally: false,
			pageAlignVertically: false,
			scaleMode: 0,
			fullScreenScaleMode: 0,
			refresh() {},
		};
		stage = { disableVisibilityChange: false, forcePortrait: false };
		device = { desktop: true };
		add = {
			group: () => ({
				add: () => ({}),
				position: { set: () => {} },
				scale: { setTo: () => {}, set: () => {} },
				children: [] as unknown[],
				create: () => ({}),
				forEach: () => {},
				sendToBack: () => {},
				bringToTop: () => {},
				sort: () => {},
				destroy: () => {},
			}),
			sprite: () => ({
				anchor: { setTo: () => {} },
				events: {},
			}),
		};
	},
}));
import { variants, printReport } from './suggester';
import { aggregateMetrics, formatMetrics } from './stats';
import { createGame, runMatch } from './botgeria';
import { performance as realPerf } from 'perf_hooks';
import type { MatchResult } from './botgeria';
import type { QualityMetrics } from './stats';
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
		process.stderr.write(text);
	}
}

function progressBar(done: number, total: number, label: string, width = 30): string {
	const filled = Math.round((done / total) * width);
	const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
	return `\r  [${bar}] ${done}/${total}  ${label}`;
}

async function runBatch(
	count: number,
	label: string,
	patchFn?: (game: unknown) => () => void,
): Promise<MatchResult[]> {
	jest.useFakeTimers();
	const abilities = await loadAbilities();
	const results: MatchResult[] = [];

	for (let i = 0; i < count; i++) {
		jest.clearAllTimers();
		jest.setSystemTime(0);
		const _t0 = realPerf.now();
		const game = await createGame(abilities);
		const _createMs = realPerf.now() - _t0;
		let restore: (() => void) | undefined;
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
		process.stderr.write(
			`  [game${i} createGame=${_createMs.toFixed(0)}ms runMatch=${_matchMs.toFixed(0)}ms turns=${
				result.turns
			} ${creatureNames}]
	       `,
		);
		restore?.();
		restore?.();
		results.push(result);
		ttyWrite(progressBar(i + 1, count, label));
	}
	ttyWrite('\n');

	jest.useRealTimers();
	return results;
}

// ─── The test ─────────────────────────────────────────────────────────────────

const BASELINE_PATH = path.resolve(process.cwd(), 'simulation-baseline.json');
// Default counts are intentionally small (~20–37 s per game).
// For tighter statistical confidence, increase via env vars:
//   SIM_BASELINE=100 SIM_VARIANT=50 npm run simulate
const BASELINE_COUNT = parseInt(process.env.SIM_BASELINE || '20', 10);
const VARIANT_COUNT = parseInt(process.env.SIM_VARIANT || '10', 10);

describe('Bot simulation', () => {
	test('run simulation and suggest improvements', async () => {
		// ── Phase 1: baseline ──────────────────────────────────────────────────
		ttyWrite(`\n📊  Phase 1: ${BASELINE_COUNT} baseline matches\n`);
		const baselineResults = await runBatch(BASELINE_COUNT, 'baseline');
		const baselineMetrics = aggregateMetrics(baselineResults);
		console.log('Baseline: ' + formatMetrics('baseline', baselineMetrics));

		fs.writeFileSync(
			BASELINE_PATH,
			JSON.stringify({ metrics: baselineMetrics, timestamp: new Date().toISOString() }, null, 2),
		);
		console.log(`✅  Saved baseline to ${BASELINE_PATH}`);

		// ── Phase 2: variants ─────────────────────────────────────────────────
		ttyWrite(`\n🔬  Phase 2: ${variants.length} variants × ${VARIANT_COUNT} matches\n`);

		const variantResults = [];
		for (const variant of variants) {
			const matches = await runBatch(VARIANT_COUNT, variant.label, variant.patch);
			const metrics = aggregateMetrics(matches);
			const isBetter =
				metrics.decisiveness > baselineMetrics.decisiveness * 1.05 ||
				metrics.timeoutRate < baselineMetrics.timeoutRate * 0.95;
			variantResults.push({ variant, metrics, isBetter });
		}

		// ── Phase 3: report ───────────────────────────────────────────────────
		printReport(baselineMetrics, variantResults);

		// Jest requires at least one assertion
		expect(baselineMetrics.matchCount).toBe(BASELINE_COUNT);
	});
});
