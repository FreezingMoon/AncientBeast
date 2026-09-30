/**
 * Guards the Phaser preload manifest against the failure mode where the board
 * renders with missing textures.
 *
 * Texture keys are file *basenames*, and a key is only in the game's hands if
 * either the preload manifest declares the file or an on-demand loader can reach
 * it. Dropping a file from `assetFiles` — or listing a path that no longer
 * exists — silently produces a `__MISSING` sprite rather than a build error, and
 * `CreatureSprite` sizes itself from `sprite.texture.width`, so a missing
 * cardboard also misplaces the unit. These tests pin the mapping.
 *
 * The generated `assets/index.js` is git-ignored, so the preload list is read
 * straight out of `assets-manifest.mts` and the directories are walked here.
 * See issue #678.
 */
import { describe, expect, test } from '@jest/globals';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..');
const MANIFEST = join(ROOT, 'assets-manifest.mts');
const IMAGE = /\.(png|jpg|jpeg|svg)$/i;

const manifestSource = readFileSync(MANIFEST, 'utf8');

/** Pull a string-array option out of the plugin's parameter list. */
function readOption(name: string): string[] {
	const match = manifestSource.match(new RegExp(`${name}\\s*=\\s*\\[([^\\]]*)\\]`));
	if (!match) {
		throw new Error(`could not find ${name} in assets-manifest.mts`);
	}
	return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
}

const assetFiles = readOption('assetFiles');
const assetDirs = readOption('assetDirs');

/** Recursively list the files under `dir` as repo-relative, slash-separated paths. */
function walk(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
		const rel = `${dir}/${entry.name}`;
		if (entry.isDirectory()) {
			out.push(...walk(rel));
		} else {
			out.push(rel);
		}
	}
	return out;
}

/** Basename without extension, i.e. the Phaser texture key for a file. */
function textureKeyOf(path: string): string {
	const file = path.split('/').pop() as string;
	return file.replace(/\.[^.]+$/, '');
}

const preloadedFiles = [...assetFiles, ...assetDirs.flatMap(walk)];
const preloadedKeys = new Set(preloadedFiles.filter((p) => IMAGE.test(p)).map(textureKeyOf));

/** Keys fetched on demand rather than preloaded — see `assets.ts`. */
const onDemandDirs = readOption('urlDirs');

describe('Phaser preload manifest', () => {
	test('declares at least the board chrome and the shared unit sprites', () => {
		// Without these the board cannot be drawn at all.
		for (const key of ['hex', 'hex_p0', 'hex_p1', 'hex_p2', 'hex_p3', 'frame', 'ability_range']) {
			expect(preloadedKeys.has(key)).toBe(true);
		}
		expect(assetDirs).toContain('assets/units/sprites');
	});

	test('every preloaded path exists on disk', () => {
		const missing = preloadedFiles.filter((path) => !existsSync(join(ROOT, path)));
		expect(missing).toEqual([]);
	});

	test('preloaded texture keys are unique', () => {
		// A collision means one of the two files silently never loads, because
		// the first basename in manifest order wins.
		const seen = new Map<string, string>();
		const collisions: string[] = [];
		for (const path of preloadedFiles.filter((p) => IMAGE.test(p))) {
			const key = textureKeyOf(path);
			const first = seen.get(key);
			if (first && first !== path) {
				collisions.push(`${key}: ${first} vs ${path}`);
			}
			seen.set(key, path);
		}
		expect(collisions).toEqual([]);
	});

	test('the per-player texture families the game builds at runtime are preloaded', () => {
		// These keys are assembled in code rather than written out, so they are
		// invisible to a literal scan and easy to forget:
		//   hex_p${player.id}, hex_hover_p${id}, hex_dashed_p${id}   (creature.ts)
		//   'p' + team + '_health' | '_plasma' | '_frozen'           (creature.ts)
		const expected: string[] = [];
		for (let i = 0; i < 4; i++) {
			expected.push(
				`hex_p${i}`,
				`hex_hover_p${i}`,
				`hex_dashed_p${i}`,
				`p${i}_health`,
				`p${i}_plasma`,
				`p${i}_frozen`,
			);
		}
		const missing = expected.filter((key) => !preloadedKeys.has(key));
		expect(missing).toEqual([]);
	});

	test('the hourglass icon used by the skip hint is preloaded', () => {
		// creature.ts draws this as a sprite key, not through getUrl().
		expect(preloadedKeys.has('skip')).toBe(true);
	});
});

describe('literal Phaser texture keys in source', () => {
	const sourceFiles: string[] = [];
	(function collect(dir: string) {
		for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
			const rel = `${dir}/${entry.name}`;
			if (entry.isDirectory()) {
				collect(rel);
			} else if (/\.ts$/.test(entry.name) && !rel.includes('__tests__')) {
				sourceFiles.push(rel);
			}
		}
	})('src');

	test('every literal texture key resolves to a preloaded file', () => {
		// Matches the 3rd argument of add.sprite / .create / loadTexture calls
		// when it is a plain string literal. The closing bracket right after the
		// quote is what distinguishes `'frame'` from `'p' + team + '_health'`.
		const keyPattern =
			/\b(?:add\.(?:sprite|image|tileSprite)|\.create|loadTexture)\(\s*[^,()]+,\s*[^,()]+,\s*'([^']+)'\s*[,)]/g;
		const unresolved: string[] = [];
		for (const file of sourceFiles) {
			const text = readFileSync(join(ROOT, file), 'utf8');
			for (const match of text.matchAll(keyPattern)) {
				const key = match[1];
				// 'background' and the logo are queued explicitly by
				// Game#startAssetLoad, not by the preload manifest.
				if (key === 'background' || key === 'AncientBeastLogo') continue;
				if (!preloadedKeys.has(key)) {
					unresolved.push(`${file}: '${key}'`);
				}
			}
		}
		expect(unresolved).toEqual([]);
	});
});

describe('on-demand texture sources', () => {
	test('cardboards are published so a lazy load can resolve them', () => {
		expect(onDemandDirs).toContain('assets/units/cardboards');
	});

	test('drops are published so a lazy load can resolve them', () => {
		expect(onDemandDirs).toContain('assets/drops');
	});

	test('every Dark Priest cardboard variant exists', () => {
		// `getDarkPriestCardboardKey` builds one of these, and the Dark Priest is
		// summoned during setup with no placement preview to request its art.
		const missing: string[] = [];
		for (const variant of ['player', 'clone']) {
			for (const color of ['red', 'blue', 'orange', 'green']) {
				const path = `assets/units/cardboards/Dark Priest ${variant} ${color}.png`;
				if (!existsSync(join(ROOT, path))) {
					missing.push(path);
				}
			}
		}
		expect(missing).toEqual([]);
	});

	test('on-demand directories exist on disk', () => {
		const missing = onDemandDirs.filter((dir) => !statSync(join(ROOT, dir)).isDirectory());
		expect(missing).toEqual([]);
	});
});
