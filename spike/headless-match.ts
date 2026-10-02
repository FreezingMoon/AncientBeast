// Throwaway spike: does bootHeadlessMatch boot, step deterministically, and settle?
import { bootHeadlessMatch } from '../src/phaser/headless';

async function run() {
	const updates: [number, number][] = [];
	const match = await bootHeadlessMatch({
		host: {
			onSceneUpdate: (time, delta) => {
				if (updates.length < 6) updates.push([time, delta]);
			},
		},
	});

	const sprite = match.scene.add.sprite(0, 0);
	let completed = false;
	match.scene.tweens.add({
		targets: sprite,
		x: 100,
		duration: 100,
		onComplete: () => {
			completed = true;
		},
	});

	const before = match.isIdle();
	match.stepFrames(10);
	const afterStep = { x: sprite.x, completed, idle: match.isIdle(), frames: match.frames };

	const settled = await match.settle();
	const afterSettle = { settled, x: sprite.x, frames: match.frames, now: match.now };

	// Determinism: same number of explicit frames, twice.
	const a = match.scene.add.sprite(0, 0);
	const b = match.scene.add.sprite(0, 0);
	match.scene.tweens.add({ targets: a, x: 250, duration: 500, ease: 'Quad.easeInOut' });
	match.scene.tweens.add({ targets: b, x: 250, duration: 500, ease: 'Quad.easeInOut' });
	match.stepFrames(10);
	const sampleA = { x: a.x, y: a.y };
	match.stepFrames(10);
	const sampleB = { x: b.x, y: b.y, sameAfterSameSteps: sampleA.x !== b.x };

	// A timer, to prove scene.time is on the virtual clock.
	let timerFired = false;
	match.scene.time.delayedCall(200, () => {
		timerFired = true;
	});
	match.stepFrames(10);
	const timerAfter10 = timerFired;
	match.stepFrames(5);
	const timerAfter15 = timerFired;

	const result = {
		boot: { isBooted: match.game.isBooted, isRunning: match.game.isRunning },
		renderer: match.game.renderer,
		world: [match.scene.world?.type, match.scene.world?.name],
		updates,
		before,
		afterStep,
		afterSettle,
		sampleA,
		sampleB,
		timer: { after10: timerAfter10, after15: timerAfter15 },
		sceneTime: match.scene.time?.now,
	};

	match.destroy();
	result.destroyed = match.isDestroyed;
	return result;
}

const first = await run();
const second = await run();
console.log(JSON.stringify(first, null, 2));
console.log(
	'deterministic across runs:',
	JSON.stringify({ ...first, destroyed: undefined }) ===
		JSON.stringify({ ...second, destroyed: undefined }),
);
process.exit(0);