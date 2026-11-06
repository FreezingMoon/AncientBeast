import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import {
	cancelDisruptorColorRecovery,
	findAlphaBoundsByRow,
	spawnDisruptorBeam,
} from '../../vfx/disruptor';

jest.mock('../../utility/easing', () => ({
	Easing: {
		Linear: { None: (value: number) => value },
		Cubic: { In: (value: number) => value },
	},
}));

describe('Dark Priest Disruptor Beam visual', () => {
	let complete: jest.Mock;
	let onUpdate: (() => void) | undefined;
	let onTweenComplete: (() => void) | undefined;
	let overlay: {
		alpha: number;
		x: number;
		y: number;
		angle: number;
		setOrigin: jest.Mock;
		setScale: jest.Mock;
		setTint: jest.Mock;
		setCrop: jest.Mock;
		destroy: jest.Mock;
	};
	let beam: Record<string, jest.Mock>;
	let tween: {
		to: jest.Mock;
		start: jest.Mock;
		stop: jest.Mock;
		onUpdateCallback: jest.Mock;
		onComplete: { add: jest.Mock };
	};

	beforeEach(() => {
		complete = jest.fn();
		onUpdate = undefined;
		onTweenComplete = undefined;
		overlay = {
			alpha: 0.88,
			x: 0,
			y: 0,
			angle: 0,
			setOrigin: jest.fn(),
			setScale: jest.fn(),
			setTint: jest.fn(),
			setCrop: jest.fn(),
			destroy: jest.fn(),
		};
		beam = {
			clear: jest.fn(),
			lineStyle: jest.fn(),
			moveTo: jest.fn(),
			lineTo: jest.fn(),
			beginFill: jest.fn(),
			drawCircle: jest.fn(),
			endFill: jest.fn(),
			strokePath: jest.fn(),
			destroy: jest.fn(),
		};
		tween = {
			to: jest.fn().mockReturnThis(),
			start: jest.fn(),
			stop: jest.fn().mockReturnThis(),
			onUpdateCallback: jest.fn((callback: () => void) => {
				onUpdate = callback;
				return tween;
			}),
			onComplete: {
				add: jest.fn((callback: () => void) => {
					onTweenComplete = callback;
				}),
			},
		};
	});

	test('fits the scan line to visible cardboard pixels on each row', () => {
		const pixels = new Uint8ClampedArray(4 * 3 * 4);
		pixels[(0 * 4 + 1) * 4 + 3] = 255;
		pixels[(0 * 4 + 2) * 4 + 3] = 255;
		pixels[(1 * 4 + 0) * 4 + 3] = 255;
		pixels[(1 * 4 + 3) * 4 + 3] = 255;

		expect(findAlphaBoundsByRow(pixels, 4, 3)).toEqual([
			{ left: 1, right: 2 },
			{ left: 0, right: 3 },
			null,
		]);
	});

	test('reveals a muted target from top to bottom before completing', () => {
		let tweenState: { value: number } | undefined;
		const sourceSprite = {
			key: 'Dark-Priest',
			x: 0,
			y: 0,
			scaleX: 1,
			frame: { realWidth: 112, realHeight: 200 },
		};
		const targetSprite = {
			key: 'Target',
			x: 0,
			y: 0,
			scaleX: 1,
			scaleY: 1,
			angle: 0,
			alpha: 1,
			frame: { realWidth: 100, realHeight: 180 },
			setCrop: jest.fn(),
		};
		const game = {
			gameEngine: {
				time: { now: 0 },
				add: {
					sprite: jest.fn(() => overlay),
					graphics: jest.fn(() => beam),
				},
				tween: jest.fn((state: { value: number }) => {
					tweenState = state;
					return tween;
				}),
			},
			grid: { creatureGroup: {} },
		};
		const caster = {
			player: { color: 'red' },
			sprite: sourceSprite,
			grp: { x: 50, y: 60 },
			x: 1,
			y: 2,
		};
		const target = {
			sprite: targetSprite,
			grp: { x: 250, y: 300 },
			x: 3,
			y: 2,
		};

		spawnDisruptorBeam(game as never, caster as never, target as never, false, complete);

		expect(overlay.setTint).toHaveBeenCalledWith(0x929b9b);
		expect(overlay.setCrop).toHaveBeenLastCalledWith(0, 0, 100, 1);
		expect(tween.to).toHaveBeenCalledWith(
			expect.objectContaining({ value: 1 }),
			1400,
			expect.any(Function),
		);
		expect(onUpdate).toBeDefined();
		onUpdate?.();
		expect(targetSprite.setCrop).not.toHaveBeenCalled();
		expect(beam.lineTo).toHaveBeenCalled();
		const triangleAlpha = beam.beginFill.mock.calls[0][1] as number;
		expect(triangleAlpha).toBeGreaterThan(0.05);
		expect(triangleAlpha).toBeLessThan(0.15);
		const scanLineStyles = beam.lineStyle.mock.calls as [number, number, number][];
		expect(
			scanLineStyles.some(
				([width, color, alpha]) => width === 12 && color === 0xff5555 && alpha < 0.06,
			),
		).toBe(true);
		expect(
			scanLineStyles.some(
				([width, color, alpha]) => width === 4 && color === 0xff5555 && alpha < 0.28,
			),
		).toBe(true);
		expect(
			scanLineStyles.some(
				([width, color, alpha]) => width === 1 && color === 0xff5555 && alpha < 0.42,
			),
		).toBe(true);
		expect(
			scanLineStyles.some(
				([width, color, alpha]) => width === 4 && color === 0xff5555 && alpha < 0.07,
			),
		).toBe(true);
		expect(
			scanLineStyles.some(
				([width, color, alpha]) => width === 1 && color === 0xff5555 && alpha < 0.2,
			),
		).toBe(true);
		expect(beam.strokePath).toHaveBeenCalled();
		expect(complete).not.toHaveBeenCalled();

		onTweenComplete?.();

		expect(beam.destroy).toHaveBeenCalledTimes(2);
		expect(complete).toHaveBeenCalledTimes(1);
		expect(tween.to).toHaveBeenLastCalledWith(
			expect.objectContaining({ value: 1 }),
			3500,
			expect.any(Function),
		);
		tweenState.value = 0;
		onUpdate?.();
		expect(overlay.alpha).toBeCloseTo(0.88);
		targetSprite.x = 18;
		targetSprite.y = 24;
		targetSprite.angle = 13;
		tweenState.value = 0.5;
		onUpdate?.();
		expect(overlay.x).toBe(18);
		expect(overlay.y).toBe(24);
		expect(overlay.angle).toBe(13);
		expect(overlay.alpha).toBeCloseTo(0.6417, 3);
		cancelDisruptorColorRecovery(target as never);
		expect(tween.stop).toHaveBeenCalled();
		expect(overlay.destroy).toHaveBeenCalledTimes(1);
		expect(beam.destroy).toHaveBeenCalledTimes(2);
		expect(complete).toHaveBeenCalledTimes(1);
	});

	test('aims from the Godlet point and sizes the scan edge to that cardboard row', () => {
		const pixels = new Uint8ClampedArray(100 * 180 * 4);
		pixels[(30 * 100 + 10) * 4 + 3] = 255;
		pixels[(30 * 100 + 10) * 4] = 100;
		pixels[(30 * 100 + 10) * 4 + 1] = 150;
		pixels[(30 * 100 + 10) * 4 + 2] = 200;
		pixels[(90 * 100 + 30) * 4 + 3] = 255;
		pixels[(90 * 100 + 69) * 4 + 3] = 255;
		const context = {
			drawImage: jest.fn(),
			getImageData: jest.fn((x: number, y: number, width: number, height: number) => {
				if (width === 100 && height === 180) return { data: pixels };
				const data = new Uint8ClampedArray(width * height * 4);
				for (let tileY = 0; tileY < height; tileY++) {
					for (let tileX = 0; tileX < width; tileX++) {
						const source = ((y + tileY) * 100 + x + tileX) * 4;
						const dest = (tileY * width + tileX) * 4;
						data.set(pixels.subarray(source, source + 4), dest);
					}
				}
				return { data };
			}),
			putImageData: jest.fn(),
			createImageData: jest.fn((width: number, height: number) => ({
				data: new Uint8ClampedArray(width * height * 4),
			})),
			clearRect: jest.fn(),
			beginPath: jest.fn(),
			arc: jest.fn(),
			fill: jest.fn(),
			fillStyle: '',
		};
		const surfaceTexture = {
			key: 'desaturated-target',
			canvas: {},
			getContext: () => context,
		};
		const textures = {
			createCanvas: jest.fn(() => surfaceTexture),
			remove: jest.fn(),
		};
		let animationState: { value: number } | undefined;
		const sourceSprite = {
			key: 'Dark-Priest',
			x: 0,
			y: 0,
			scaleX: 1,
			frame: { realWidth: 112, realHeight: 200 },
		};
		const targetSprite = {
			key: 'Target',
			x: 0,
			y: 0,
			scaleX: 1,
			scaleY: 1,
			alpha: 1,
			frame: { realWidth: 100, realHeight: 180 },
			texture: {
				getSourceImage: jest.fn(() => ({})),
				frame: { x: 0, y: 0, width: 100, height: 180 },
			},
			setCrop: jest.fn(),
		};
		const game = {
			Phaser: { textures },
			animations: { disposeInfernalCardboardEffect: jest.fn() },
			gameEngine: {
				time: { now: 0 },
				add: {
					sprite: jest.fn(() => overlay),
					graphics: jest.fn(() => beam),
				},
				tween: jest.fn((state: { value: number }) => {
					animationState = state;
					return tween;
				}),
			},
			grid: { creatureGroup: {} },
		};
		const caster = {
			player: { color: 'blue' },
			sprite: sourceSprite,
			grp: { x: 50, y: 60 },
			x: 1,
			y: 2,
		};
		const target = {
			name: 'Infernal',
			sprite: targetSprite,
			grp: { x: 250, y: 300 },
			size: 1,
			x: 3,
			y: 2,
		};

		spawnDisruptorBeam(game as never, caster as never, target as never, true, complete);
		expect(game.animations.disposeInfernalCardboardEffect).toHaveBeenCalledWith(target);
		if (!animationState) throw new Error('The scan tween did not start');
		animationState.value = 0.5;
		onUpdate?.();

		expect(targetSprite.alpha).toBe(0);
		expect(overlay.setTint).not.toHaveBeenCalled();
		const triangleAlpha = beam.beginFill.mock.calls[0][1] as number;
		expect(triangleAlpha).toBeGreaterThan(0.05);
		expect(triangleAlpha).toBeLessThan(0.15);
		expect(beam.moveTo).toHaveBeenCalledWith(100, -34);
		expect(beam.lineTo).toHaveBeenCalledWith(230, 210);
		const edgePoints = beam.lineTo.mock.calls as [number, number][];
		expect(edgePoints.some(([x, y]) => x === 270 && Math.abs(y - 210) <= 4)).toBe(true);
		expect(beam.lineTo.mock.calls.length).toBeGreaterThan(50);
		expect(context.clearRect).toHaveBeenCalled();
		expect(
			context.clearRect.mock.calls.every(([, , , clearedHeight]) => Number(clearedHeight) < 180),
		).toBe(true);
		expect(context.beginPath).toHaveBeenCalled();
		expect(context.arc).toHaveBeenCalledWith(4, 4, 4, 0, Math.PI * 2);
		expect(context.fill).toHaveBeenCalled();
		expect(context.fillStyle).toBe('rgba(255, 255, 255, 0.9)');
		expect(context.getImageData).toHaveBeenCalledTimes(1);
		expect(context.getImageData).toHaveBeenCalledWith(0, 0, 100, 180);
		expect(context.drawImage.mock.calls.some((call) => call[4] === 2 && call[8] === 2)).toBe(true);
		expect(
			context.drawImage.mock.calls.some((call) => typeof call[5] === 'number' && call[5] !== 0),
		).toBe(true);
		expect(
			context.drawImage.mock.calls.some(
				(call) =>
					call[1] === 0 &&
					call[2] === 83 &&
					call[3] === 100 &&
					call[4] === 14 &&
					call[5] === 0 &&
					call[6] === 83,
			),
		).toBe(true);
		const particleLanding = tween.to.mock.calls[1][0] as Record<string, number>;
		expect(particleLanding.y).toBeGreaterThanOrEqual(237);
		expect(particleLanding.y).toBeLessThanOrEqual(300);
		expect(particleLanding.x).toBeGreaterThanOrEqual(206);
		expect(particleLanding.x).toBeLessThanOrEqual(294);
		expect(
			((particleLanding.x - 250) / 43.2) ** 2 + ((particleLanding.y - 268.8) / 31.17) ** 2,
		).toBeLessThanOrEqual(1);
		expect(tween.to.mock.calls[1][3]).toBe(true);
		expect(tween.to.mock.calls[1][0]).not.toHaveProperty('alpha');
		expect(game.gameEngine.add.sprite).toHaveBeenCalledTimes(5);
		expect(textures.createCanvas).toHaveBeenCalledTimes(6);
		expect(game.gameEngine.add.sprite).toHaveBeenNthCalledWith(
			1,
			targetSprite.x,
			targetSprite.y,
			'desaturated-target',
			undefined,
			target.grp,
		);
		expect(context.putImageData).toHaveBeenCalled();
		const invertedImage = context.putImageData.mock.calls[1][0] as {
			data: Uint8ClampedArray;
		};
		const invertedSample = (30 * 100 + 10) * 4;
		expect(invertedImage.data[invertedSample]).toBe(112);
		expect(invertedImage.data[invertedSample + 1]).toBe(112);
		expect(invertedImage.data[invertedSample + 2]).toBe(112);
		if (!animationState) throw new Error('The scan tween did not start');
		animationState.value = 1;
		onUpdate?.();
		expect(
			context.drawImage.mock.calls.some(
				(call) => call[4] === 6 && call[2] === 174 && call[6] === 174 && call[8] === 6,
			),
		).toBe(false);
	});

	test('uses a textured shader triangle when WebGL shaders are supported', () => {
		const shaderBeam = {
			setOrigin: jest.fn(),
			setUniform: jest.fn(),
			destroy: jest.fn(),
		};
		let shaderConfig:
			| {
					fragmentSource: string;
					initialUniforms: Record<string, number | number[]>;
			  }
			| undefined;
		const sourceSprite = {
			key: 'Dark-Priest',
			x: 0,
			y: 0,
			scaleX: 1,
			frame: { realWidth: 112, realHeight: 200 },
		};
		const targetSprite = {
			key: 'Target',
			x: 0,
			y: 0,
			scaleX: 1,
			scaleY: 1,
			alpha: 1,
			frame: { realWidth: 100, realHeight: 180 },
			setCrop: jest.fn(),
		};
		const game = {
			gameEngine: {
				supportsShaders: true,
				time: { now: 2000 },
				add: {
					sprite: jest.fn(() => overlay),
					graphics: jest.fn(() => beam),
					shader: jest.fn(
						(config: {
							fragmentSource: string;
							initialUniforms: Record<string, number | number[]>;
						}) => {
							shaderConfig = config;
							return shaderBeam;
						},
					),
				},
				tween: jest.fn(() => tween),
			},
			grid: { creatureGroup: {} },
		};
		const caster = {
			player: { color: 'green' },
			sprite: sourceSprite,
			grp: { x: 50, y: 60 },
			x: 1,
			y: 2,
		};
		const target = {
			sprite: targetSprite,
			grp: { x: 250, y: 300 },
			x: 3,
			y: 2,
		};

		spawnDisruptorBeam(game as never, caster as never, target as never, false, complete);
		onUpdate?.();

		expect(game.gameEngine.add.shader).toHaveBeenCalledTimes(1);
		expect(game.gameEngine.add.graphics).toHaveBeenCalledWith(0, 0, target.grp);
		expect(shaderBeam.setOrigin).toHaveBeenCalledWith(0.5, 0.5);
		expect(shaderConfig?.fragmentSource).toContain('distanceFromSource * 128.0');
		expect(shaderConfig?.fragmentSource).toContain('float filaments');
		expect(shaderConfig?.fragmentSource).toContain('uTime * 11.0');
		expect(shaderConfig?.fragmentSource).toContain('uTime * 7.0');
		expect(shaderConfig?.fragmentSource).toContain('float scanBand = 1.0 - smoothstep');
		expect(shaderConfig?.fragmentSource).toContain('scanBand * 0.2');
		expect(shaderConfig?.fragmentSource).toContain('scanHalo * 0.05');
		expect(shaderConfig?.fragmentSource).not.toContain('vec3(0.82, 0.98, 1.0)');
		expect(shaderConfig?.fragmentSource).toContain('float alpha = mask * uAlpha * waveAlpha;');
		expect(shaderConfig?.fragmentSource).toContain('gl_FragColor = vec4(uColor * alpha, alpha);');
		expect(shaderConfig?.fragmentSource).not.toContain('min(uColor');
		expect(shaderConfig?.fragmentSource).not.toContain('colorPulse');
		expect(shaderConfig?.initialUniforms.uColor).toEqual([0x2b / 255, 1, 0x2b / 255]);
		expect(shaderConfig?.initialUniforms.uSize).toEqual([200, 334]);
		expect(shaderBeam.setUniform).toHaveBeenCalledWith('uTime', 2);
		expect(shaderBeam.setUniform).toHaveBeenCalledWith('uAlpha', expect.any(Number));
		const flickerAlpha = shaderBeam.setUniform.mock.calls.find(
			([name]) => name === 'uAlpha',
		)?.[1] as number;
		expect(flickerAlpha).toBeGreaterThan(0.35);
		expect(flickerAlpha).toBeLessThan(0.45);
	});

	test('applies damage immediately when the renderer is unavailable', () => {
		spawnDisruptorBeam(
			{ gameEngine: null, grid: {} } as never,
			{} as never,
			{} as never,
			false,
			complete,
		);

		expect(complete).toHaveBeenCalledTimes(1);
	});
});
