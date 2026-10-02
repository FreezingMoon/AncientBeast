// Throwaway feasibility spike: can a real Phaser.HEADLESS game boot and step in Node?
const mode = process.argv[2] || 'plain';

if (mode === 'jsdom') {
	const { JSDOM } = await import('jsdom');
	const dom = new JSDOM('<!doctype html><html><body></body></html>', {
		pretendToBeVisual: true,
		resources: 'usable',
	});
	globalThis.window = dom.window;
	globalThis.document = dom.window.document;
	Object.defineProperty(globalThis, 'navigator', {
		value: dom.window.navigator,
		configurable: true,
		writable: true,
	});
	for (const key of Object.getOwnPropertyNames(dom.window)) {
		if (key in globalThis) continue;
		try {
			const value = dom.window[key];
			if (typeof value === 'function') {
				Object.defineProperty(globalThis, key, {
					value: value.bind(dom.window),
					configurable: true,
					writable: true,
				});
			} else {
				Object.defineProperty(globalThis, key, {
					value,
					configurable: true,
					writable: true,
				});
			}
		} catch {
			/* some jsdom props are getter-only */
		}
	}
	console.log('jsdom globals installed');
}

const { default: Phaser } = await import('phaser');

let createError = null;
let probe = null;
let probeRefreshMode = null;

class ProbeScene extends Phaser.Scene {
	constructor() {
		super({ key: 'probe' });
	}

	create() {
		const canvasTexture = this.textures.createCanvas('spike-tex', 16, 16);
		const ctx = canvasTexture.getContext();
		ctx.fillStyle = '#ff0000';
		ctx.fillRect(0, 0, 16, 16);
		ctx.fillStyle = '#00ff00';
		ctx.fillRect(0, 0, 8, 8);
		// HEADLESS has no renderer, so CanvasTexture#refresh() (GPU upload) throws.
		// CanvasTexture#update() re-reads the CPU-side ImageData instead.
		if (this.game.renderer && this.game.renderer.gl) {
			canvasTexture.refresh();
			probeRefreshMode = 'refresh';
		} else {
			canvasTexture.update();
			probeRefreshMode = 'update (HEADLESS: refresh() would throw)';
		}

		const root = this.add.container(0, 0);
		const spriteA = this.add.sprite(0, 0, 'spike-tex');
		const spriteB = this.add.sprite(4, 4, 'spike-tex');
		spriteA.setOrigin(0.5, 0.5);
		spriteB.setOrigin(0, 0);
		root.add([spriteA, spriteB]);

		const graphics = this.add.graphics();
		graphics.fillStyle(0x0000ff, 1);
		graphics.fillRect(0, 0, 4, 4);
		graphics.lineStyle(1, 0xffffff, 1);
		graphics.strokeRect(0, 0, 8, 8);
		root.add(graphics);

		const graphicsNoFill = this.add.graphics();
		graphicsNoFill.lineStyle(2, 0xff00ff, 1);
		graphicsNoFill.beginPath();
		graphicsNoFill.moveTo(0, 0);
		graphicsNoFill.lineTo(10, 10);
		graphicsNoFill.strokePath();
		root.add(graphicsNoFill);

		this.tweens.add({
			targets: spriteA,
			x: 100,
			y: 50,
			duration: 100,
			ease: 'Sine.easeInOut',
			repeat: 1,
			yoyo: true,
			onUpdate: () => {
				probe = probe || {};
				probe.maxX = Math.max(probe.maxX || 0, spriteA.x);
			},
		});

		this.tweens.add({
			targets: spriteB,
			alpha: 0,
			duration: 100,
			onComplete: () => {
				probe.tweenCompleteFired = true;
			},
		});

		probe = {
			canvasTexture,
			root,
			spriteA,
			spriteB,
			graphics,
			containerOrderBefore: [root.getIndex(spriteA), root.getIndex(spriteB)],
			tweenCompleteFired: false,
		};
	}
}

const config = {
	type: Phaser.HEADLESS,
	width: 800,
	height: 600,
	scene: [ProbeScene],
	// eslint-disable-next-line
	canvas: undefined,
};

// Phaser 4's TweenManager reads Date.now() for its own clock, not the step
// delta. For deterministic pumping we install a virtual clock advanced by the
// step delta.
const virtualStart = 1000000;
let virtualNow = virtualStart;
const realDateNow = Date.now;
Date.now = () => virtualNow;

function step(gameRef, delta = 16) {
	virtualNow += delta;
	gameRef.headlessStep(virtualNow - virtualStart, delta);
}

const game = new Phaser.Game(config);

game.events.on(Phaser.Core.Events.READY, () => console.log('event READY'));

// Textures boot asynchronously (base64 image decode), so let the event loop turn
// until Phaser emits READY and the first scene's create() has run.
const t0 = Date.now();
while (!probe && Date.now() - t0 < 5000) {
	await new Promise((resolve) => setTimeout(resolve, 10));
}

// Manual pumping via headlessStep. Boot is deferred: the first step boots the
// game and starts the scene.
for (let i = 0; i < 40; i++) {
	step(game, 16);
}

console.log('isRunning:', game.isRunning, 'booted:', game.isBooted, 'probe?', !!probe);
console.log(
	'scenes:',
	game.scene.scenes.map((s) => ({ key: s.scene.key, active: s.scene.isActive(), visible: s.scene.isVisible() })),
);

if (!probe) {
		console.error('FAIL: scene create() never ran');
		process.exit(1);
	}

const probeScene = game.scene.getScene('probe');
probeScene.events.on(Phaser.Scenes.Events.UPDATE, () => {
		probe.updateTicks = (probe.updateTicks || 0) + 1;
	});
probeScene.events.on(Phaser.Scenes.Events.PRE_STEP ?? 'prestep', () => {});
for (let i = 0; i < 5; i++) {
	step(game, 16);
}
console.log(
	'debug:',
	JSON.stringify({
		status: probeScene.sys.settings.status,
		tweenPaused: probeScene.tweens.paused,
		tweenCount: probeScene.tweens.getTweens().length,
		tweenProgress: probeScene.tweens.getTweens().map((t) => ({ progress: t.progress, state: t.state })),
		updateTicks: probe.updateTicks,
		isPaused: game.isPaused,
	}, null, 2),
);

const px = probe.canvasTexture.context.getImageData(0, 0, 1, 1).data;
const pxG = probe.canvasTexture.context.getImageData(12, 12, 1, 1).data;

const results = {
	mode,
	boot: true,
	tweenMovedSprite: probe.maxX > 50,
	tweenReturnedToStart: probe.spriteA.x === 0 && probe.spriteA.y === 0,
	maxX: probe.maxX,
	spriteA: { x: probe.spriteA.x, y: probe.spriteA.y },
	spriteB: { x: probe.spriteB.x, y: probe.spriteB.y, alpha: probe.spriteB.alpha },
	tweenCompleteFired: probe.tweenCompleteFired,
	containerOrderBefore: probe.containerOrderBefore,
	pixel00: Array.from(px),
	pixelCC: Array.from(pxG),
	hasHeadlessStep: typeof game.headlessStep === 'function',
	hasLoopStep: typeof game.loop?.step === 'function',
	hasEasing: {
		EaseMapSineInOut: typeof Phaser.Math.Easing.Sine.InOut === 'function',
		easeStringKeys: Object.keys(Phaser.Math.Easing),
	},
	hasEventEmitter: typeof Phaser.Events?.EventEmitter === 'function',
	sceneTweenCount: game.scene.getScene('probe').tweens.getTweens().length,
	refreshMode: probeRefreshMode,
	renderer: game.renderer === null ? null : typeof game.renderer,
	createError,
};

probe.root.bringToTop(probe.spriteB);
results.containerOrderAfterBringToTop = [probe.root.getIndex(probe.spriteA), probe.root.getIndex(probe.spriteB)];
results.containerList = probe.root.list.map((o) => o.type);

console.log(JSON.stringify(results, null, 2));
process.exit(0);