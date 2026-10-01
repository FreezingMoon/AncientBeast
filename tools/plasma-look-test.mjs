import { chromium } from 'playwright-core';

const TARGETS = {
	// Transparency: the quad's outer corners sit outside the plasma ellipse, where
	// alpha is ~0. Anything added there is the milky interior wash returning.
	maxCornerAdded: 2,
	// The CPU fallback and the GPU shader MUST render the same image -- a player
	// should not be able to tell which renderer their machine picked. These bounds
	// hold the two in step.
	minGpuOverCpuLum: 0.9,
	maxGpuOverCpuLum: 1.1,
	// Per-pixel agreement between the two renderers, averaged over the sampled
	// rect. Judged on the mean rather than the max: a handful of silhouette-edge
	// pixels legitimately differ by a full channel value because the CPU path
	// bilinearly upscales its 192x256 bitmap to the display size while the shader
	// samples natively, and that alone puts maxDiff in the 400s on every hue.
	maxMeanParityDiff: 6,
};

const b = await chromium.launch({
	headless: true,
	args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const pg = await b.newPage({ viewport: { width: 1220, height: 900 } });
const errs = [];
pg.on('pageerror', (e) => errs.push('[pageerror] ' + e.message));
pg.on('console', (m) => {
	if (m.type() === 'error') errs.push('[error] ' + m.text());
});
await pg.goto('http://localhost:8081/plasma-visual.html', { waitUntil: 'networkidle' });
await pg.waitForFunction('window.__plasmaReady === true', { timeout: 40000 });

const diag = await pg.evaluate('window.diag()');
console.log('=== SCENE GRAPH DIAG ===');
console.log(JSON.stringify(diag));
const data = await pg.evaluate('window.measureAll()');
const parity = await pg.evaluate('window.parity()');
const sweep = await pg.evaluate('window.plasmaSweep()');
const probe = await pg.evaluate('window.probeBlend()');
console.log('=== BLEND PROBE (added luminance over dark board) ===');
console.log(JSON.stringify(probe));
const base = probe['a1'] || 255;
console.log(
	'  ratio vs alpha=1.0: ' +
		[1.0, 0.5, 0.25]
			.map(
				(a) =>
					`a=${a} -> ${(probe['a' + a] / base).toFixed(3)} (x alpha: ${(
						probe['a' + a] /
						base /
						a
					).toFixed(2)})`,
			)
			.join(' | '),
);
const pa = await pg.evaluate('window.probeAlpha()');
console.log('=== ALPHA CONVENTION PROBE (added luminance) ===');
console.log(JSON.stringify(pa));
console.log(
	'  GPU zero-alpha remaining: ' +
		((pa.gpuZeroAlpha / pa.gpuNormal) * 100).toFixed(0) +
		'% of normal',
);
console.log(
	'  CPU zero-alpha remaining: ' +
		((pa.cpuZeroAlpha / pa.cpuNormal) * 100).toFixed(0) +
		'% of normal',
);
console.log('  => near 0% means premultiplied; near 100% means alpha ignored');
const prof = await pg.evaluate('window.profile()');
console.log('=== VERTICAL PROFILE (top->bottom) ===');
console.log('gpu:', prof.gpu.join(' '));
console.log('cpu:', prof.cpu.join(' '));
console.log('  GPU thickness:', JSON.stringify(prof.gpuThickness));
console.log('  CPU thickness:', JSON.stringify(prof.cpuThickness));
await pg.screenshot({ path: '/tmp/kilo/plasma-look.png' });

const fails = [];
const pad = (s, n) => String(s).padEnd(n);

console.log('\n=== METRICS ===');
console.log(
	pad('hue', 5) +
		pad('surv', 7) +
		pad('addLum g/c/cSame', 17) +
		pad('whiteFrac', 12) +
		pad('corner', 10) +
		pad('hueCent', 11) +
		pad('edgeSoftPx', 11),
);
for (let i = 0; i < data.gpu.length; i++) {
	const g = data.gpu[i],
		c = data.cpu[i],
		s = data.same[i];
	console.log(
		pad(g.hue, 5) +
			pad(g.addedLum + '/' + c.addedLum + '/' + s.addedLum, 18) +
			pad(g.whiteFrac + '/' + c.whiteFrac, 12) +
			pad(g.cornerAdded + '/' + c.cornerAdded, 10) +
			pad(g.hueCentroid + '/' + c.hueCentroid, 11) +
			pad(g.edgeSoftPx + '/' + c.edgeSoftPx, 11),
	);
}

// Hard assertions: the properties that were actually reported as broken.
for (const row of ['gpu', 'cpu']) {
	for (const m of data[row]) {
		if (m.error) {
			fails.push(`${row} hue${m.hue}: measurement failed`);
			continue;
		}
		if (m.cornerAdded > TARGETS.maxCornerAdded)
			fails.push(
				`${row} hue${m.hue}: milky interior wash (cornerAdded ${m.cornerAdded} > ${TARGETS.maxCornerAdded})`,
			);
	}
}

// The two renderers have to agree. This is the assertion that catches the
// Canvas2D fallback drifting away from the shader -- historically it caught the
// CPU path's `globalCompositeOperation = 'lighter'` self-composite and shadow
// bloom, which made the fallback roughly twice as bright as the shader.
for (let i = 0; i < data.gpu.length; i++) {
	const g = data.gpu[i],
		c = data.cpu[i];
	if (g.error || c.error) continue;
	const ratio = g.addedLum / Math.max(1, c.addedLum);
	if (ratio < TARGETS.minGpuOverCpuLum || ratio > TARGETS.maxGpuOverCpuLum)
		fails.push(
			`hue${g.hue}: GPU/CPU brightness ratio ${ratio.toFixed(2)} outside [${
				TARGETS.minGpuOverCpuLum
			}, ${TARGETS.maxGpuOverCpuLum}] -- the two renderers disagree`,
		);
}

for (const p of parity) {
	if (p.meanDiff > TARGETS.maxMeanParityDiff)
		fails.push(
			`hue${p.hue}: CPU/GPU mean pixel diff ${p.meanDiff} > ${TARGETS.maxMeanParityDiff} -- the two renderers disagree`,
		);
}

// Alpha must scale the result on both paths. ADD blends with ONE, so brightness
// can only track alpha if each renderer stores premultiplied colour; this is the
// check that would catch either one dropping that convention.
for (const k of ['gpu', 'cpu']) {
	const half = pa[k + 'HalfAlpha'],
		full = pa[k + 'Normal'];
	if (full > 1 && (half / full > 0.7 || half / full < 0.3))
		fails.push(
			`${k}: alpha is not scaling output linearly (half/full = ${(half / Math.max(1, full)).toFixed(
				2,
			)}, want ~0.5) -- premultiplied output is broken`,
		);
}
if (pa.gpuZeroAlpha > 1)
	fails.push(`GPU ignores alpha: zero-alpha still adds ${pa.gpuZeroAlpha} luminance`);
if (pa.cpuZeroAlpha > 1)
	fails.push(`CPU ignores alpha: zero-alpha still adds ${pa.cpuZeroAlpha} luminance`);

// Informational only -- these two metrics proved unreliable and are printed for
// manual comparison rather than asserted:
//   whiteFrac   - couples to overall brightness, so it reads ~0 once premultiplied
//   hueCentroid - measures the composited backdrop rather than the plasma's hue
//   parity max  - dominated by silhouette pixels; see the note above
console.log('\n=== PLASMA SWEEP (peak band brightness by plasma level) ===');
console.log('  frac  gpuPeak  cpuPeak');
for (const r of sweep)
	console.log(
		`  ${String(r.frac).padEnd(5)} ${String(Math.round(r.gpu.peakAdded)).padEnd(8)} ${Math.round(
			r.cpu.peakAdded,
		)}`,
	);

// The whole point of tying band weight to plasma is that the field visibly
// thins as the resource is spent. If the ends are indistinguishable the feature
// is not doing anything a player could read off the board.
const thin = sweep[0],
	full = sweep[sweep.length - 1];
if (!(thin.gpu.peakAdded < full.gpu.peakAdded * 0.8))
	fails.push(
		`plasma sweep does nothing: peak at 0 plasma ${thin.gpu.peakAdded} vs ${full.gpu.peakAdded} at full (want clearly thinner)`,
	);
if (!(thin.cpu.peakAdded < full.cpu.peakAdded * 0.8))
	fails.push(`CPU plasma sweep does nothing: ${thin.cpu.peakAdded} vs ${full.cpu.peakAdded}`);

console.log('\n=== PARITY (mean / max per-pixel diff, by plasma level) ===');
const byFrac = {};
for (const p of parity) (byFrac[p.frac] ??= []).push(p.meanDiff);
for (const frac of Object.keys(byFrac).sort()) {
	const v = byFrac[frac];
	console.log(`  ${frac}: worst mean diff ${Math.max(...v).toFixed(2)} over ${v.length} hues`);
}

if (errs.length) {
	console.log('\n--- page errors ---');
	errs.slice(0, 8).forEach((e) => console.log(e));
}

console.log('\n=== RESULT ===');
if (!fails.length) console.log('ALL PASS');
else {
	fails.forEach((f) => console.log('FAIL: ' + f));
	console.log(`\n${fails.length} failure(s)`);
}
console.log('screenshot: /tmp/kilo/plasma-look.png');
await b.close();
process.exit(fails.length ? 1 : 0);
