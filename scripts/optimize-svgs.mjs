// Optimizes SVG icons so they render inside Devvit's webview.
//
// Devvit's SVG sanitizer rejects metadata that many of the project's SVGs were
// exported with (RDF/DC/CC namespaces, inline `style="..."` attributes,
// `xlink:href`, `<metadata>` blocks). Those icons therefore render blank in the
// Devvit client while the simpler SVGs work fine. This script strips that
// metadata via SVGO and converts any leftover inline `style` into presentation
// attributes (which Devvit accepts). Gradients/filters are preserved.
//
// Usage: bun scripts/optimize-svgs.mjs [relative/dir ...]
//   e.g. bun scripts/optimize-svgs.mjs assets/stats assets/icons
//   (defaults to assets/stats when no args are given)
import { execFileSync } from 'child_process';
import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const svgoBin = join(root, 'node_modules', '.bin', 'svgo');
const svgoConfig = join(root, 'svgo.config.mjs');

const dirs = process.argv.slice(2).length
	? process.argv.slice(2).map((d) => join(root, d))
	: [join(root, 'assets', 'stats')];

function styleToAttrs(svg) {
	return svg.replace(/style="([^"]*)"/g, (_match, body) => {
		const attrs = [];
		for (const decl of body.split(';')) {
			const trimmed = decl.trim();
			if (!trimmed) continue;
			const idx = trimmed.indexOf(':');
			if (idx === -1) continue;
			const name = trimmed.slice(0, idx).trim();
			const value = trimmed.slice(idx + 1).trim();
			if (!name || value === '') continue;
			// Only emit real SVG presentation attributes; drop non-attribute hints
			// like `touch-action` which Devvit would reject anyway.
			if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(name)) continue;
			if (name === 'touch-action') continue;
			// Drop `width`/`height` from the root svg's inline style. The originals
			// sized themselves with `style="width:512px;height:512px"`, which browsers
			// ignore for CSS-background intrinsic sizing, so the icon scales to fit its
			// container. Re-emitting them as absolute `width="512" height="512"`
			// attributes gives a fixed 512px intrinsic size, so a small button (e.g. the
			// in-game close button) only shows a corner of the icon. Keeping no explicit
			// size preserves the original scale-to-fit behavior.
			if (name === 'width' || name === 'height') continue;
			attrs.push(`${name}="${value}"`);
		}
		return attrs.length ? attrs.join(' ') : '';
	});
}

let total = 0;
let bad = 0;

for (const dir of dirs) {
	if (!statSync(dir).isDirectory()) {
		console.warn(`⚠ skipping (not a directory): ${relative(root, dir)}`);
		continue;
	}
	const files = readdirSync(dir).filter((f) => f.endsWith('.svg'));
	for (const file of files) {
		const full = join(dir, file);
		execFileSync(svgoBin, ['--config', svgoConfig, '--input', full, '--output', full], {
			stdio: 'ignore',
		});
		const before = readFileSync(full, 'utf8');
		const after = styleToAttrs(before);
		if (after !== before) {
			writeFileSync(full, after);
		}
		total++;
		const rejected = /style=|xlink:|xmlns:dc|xmlns:cc|xmlns:rdf|<metadata/.test(after);
		if (rejected) {
			console.warn(`⚠ ${relative(root, full)} still contains Devvit-rejected attributes`);
			bad++;
		}
	}
}

console.log(
	`✓ Optimized ${total - bad}/${total} SVGs across ${dirs.length} director${
		dirs.length === 1 ? 'y' : 'ies'
	} for Devvit`,
);
