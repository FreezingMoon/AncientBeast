import type { Creature } from '../creature';
import type { TweenHandle } from '../engine/types';
import type Game from '../game';
import { createGameCanvasSurface, type CanvasSurface } from '../game-display/canvas-surface';
import { Easing } from '../utility/easing';
import { getFrameSize } from '../game-display/texture';
import { HEX_HEIGHT_PX, HEX_WIDTH_PX } from '../utility/const';
import { electroShockerLook } from './lightning/look';

const DISRUPTOR_SCAN_MS = 1400;
const DAMAGE_HINT_DISPLAY_MS = 1100;
const COLOR_RESTORE_MS = 2400;
const COLOR_RESTORE_TOTAL_MS = DAMAGE_HINT_DISPLAY_MS + COLOR_RESTORE_MS;
const DISINTEGRATION_TILE_WIDTH = 5;
const DISINTEGRATION_TILE_HEIGHT = 6;
const DISINTEGRATION_PARTICLE_SIZE = 8;
const SCAN_RIPPLE_AHEAD_PX = 14;
const SCAN_RIPPLE_WIDTH_PX = 24;
const SCAN_RIPPLE_DISPLACEMENT_PX = 9;
const DISRUPTOR_SCAN_LINE_HEIGHT = 14;

const activeColorRecoveries = new WeakMap<Creature, () => void>();

export function cancelDisruptorColorRecovery(creature: Creature): void {
	activeColorRecoveries.get(creature)?.();
}

const DISRUPTOR_FRAGMENT_SOURCE = `
precision highp float;

uniform vec2 uSource;
uniform vec2 uLeft;
uniform vec2 uRight;
uniform vec2 uSize;
uniform vec3 uColor;
uniform float uTime;
uniform float uAlpha;

varying vec2 outTexCoord;

void main(void) {
    vec2 p = vec2(outTexCoord.x, 1.0 - outTexCoord.y);
    vec2 a = uSource;
    vec2 b = uLeft;
    vec2 c = uRight;
    float area = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (abs(area) < 0.00001) {
        gl_FragColor = vec4(0.0);
        return;
    }

    float wa = ((b.y - c.y) * (p.x - c.x) + (c.x - b.x) * (p.y - c.y)) / area;
    float wb = ((c.y - a.y) * (p.x - c.x) + (a.x - c.x) * (p.y - c.y)) / area;
    float wc = 1.0 - wa - wb;
    float edge = min(wa, min(wb, wc));
    float mask = smoothstep(-0.006, 0.018, edge);
    if (mask <= 0.0) {
        gl_FragColor = vec4(0.0);
        return;
    }

    float distanceFromSource = wb + wc;
    float across = wb / max(0.0001, distanceFromSource);
    float broadWave = sin(distanceFromSource * 48.0 - uTime * 11.0 + sin(across * 18.0 + uTime * 2.4) * 1.8);
    float fineWave = sin(distanceFromSource * 128.0 + across * 28.0 - uTime * 7.0);
    float filaments = smoothstep(0.12, 0.8, 0.5 + 0.34 * broadWave + 0.23 * fineWave);
    float core = pow(max(0.0, 1.0 - distanceFromSource), 1.6);
    float edgeGlow = smoothstep(0.015, 0.12, edge);
    vec2 basePixels = (c - b) * uSize;
    float baseLength = max(length(basePixels), 0.001);
    float triangleHeight = abs(area) * uSize.x * uSize.y / baseLength;
    float edgeDistance = wa * triangleHeight;
    float scanOffset = 7.0 + sin(across * 24.0 - uTime * 5.5) * 3.0 + sin(across * 51.0 + uTime * 3.4) * 1.5;
    float scanBand = 1.0 - smoothstep(5.0, 13.0, abs(edgeDistance - scanOffset));
    float scanHalo = 1.0 - smoothstep(8.0, 22.0, abs(edgeDistance - scanOffset));
    float waveAlpha =
        0.02 + filaments * 0.18 + edgeGlow * 0.02 + core * 0.05 + scanHalo * 0.05 + scanBand * 0.2;
    float alpha = mask * uAlpha * waveAlpha;
    gl_FragColor = vec4(uColor * alpha, alpha);
}
`;

type AlphaBounds = { left: number; right: number } | null;

/** Return the first and last visible pixel for each row of RGBA image data. */
export function findAlphaBoundsByRow(
	pixels: Uint8ClampedArray,
	width: number,
	height: number,
): AlphaBounds[] {
	const rows: AlphaBounds[] = [];
	for (let y = 0; y < height; y++) {
		let left = -1;
		let right = -1;
		for (let x = 0; x < width; x++) {
			if (pixels[(y * width + x) * 4 + 3] > 16) {
				if (left === -1) left = x;
				right = x;
			}
		}
		rows.push(left === -1 ? null : { left, right });
	}
	return rows;
}

function createDesaturatedCardboard(
	game: Game,
	sprite: Creature['sprite'],
	width: number,
	height: number,
): {
	alphaRows: AlphaBounds[];
	surface: CanvasSurface;
	colorSurface: CanvasSurface;
	invertedSurface: CanvasSurface;
	grayscalePixels: Uint8ClampedArray;
} | null {
	if (!sprite || typeof game.Phaser?.textures?.createCanvas !== 'function') return null;
	const texture = sprite.texture as {
		getSourceImage?: () => CanvasImageSource;
		frame?: {
			x?: number;
			y?: number;
			cutX?: number;
			cutY?: number;
			width?: number;
			height?: number;
			cutWidth?: number;
			cutHeight?: number;
		};
	};
	if (typeof texture?.getSourceImage !== 'function') return null;

	const source = texture.getSourceImage();
	if (!source) return null;

	const surface = createGameCanvasSurface(game, width, height);
	const { ctx } = surface;

	const frame = texture.frame;
	ctx.drawImage(
		source,
		frame?.cutX ?? frame?.x ?? 0,
		frame?.cutY ?? frame?.y ?? 0,
		frame?.cutWidth ?? frame?.width ?? width,
		frame?.cutHeight ?? frame?.height ?? height,
		0,
		0,
		width,
		height,
	);
	const image = ctx.getImageData(0, 0, width, height);
	const alphaRows = findAlphaBoundsByRow(image.data, width, height);
	const colorSurface = createGameCanvasSurface(game, width, height);
	colorSurface.ctx.putImageData(image, 0, 0);
	colorSurface.commit();
	const invertedSurface = createGameCanvasSurface(game, width, height);
	const invertedImage = invertedSurface.ctx.createImageData(width, height);
	for (let i = 0; i < image.data.length; i += 4) {
		const luminance = Math.round(
			image.data[i] * 0.2126 + image.data[i + 1] * 0.7152 + image.data[i + 2] * 0.0722,
		);
		invertedImage.data[i] = 255 - luminance;
		invertedImage.data[i + 1] = 255 - luminance;
		invertedImage.data[i + 2] = 255 - luminance;
		invertedImage.data[i + 3] = image.data[i + 3];
		image.data[i] = luminance;
		image.data[i + 1] = luminance;
		image.data[i + 2] = luminance;
	}
	invertedSurface.ctx.putImageData(invertedImage, 0, 0);
	invertedSurface.commit();
	ctx.putImageData(image, 0, 0);
	surface.commit();
	return { alphaRows, surface, colorSurface, invertedSurface, grayscalePixels: image.data };
}

function boostColorSaturation(value: number, amount = 1.25): [number, number, number] {
	const channels: [number, number, number] = [
		(value >> 16) & 0xff,
		(value >> 8) & 0xff,
		value & 0xff,
	];
	const maximum = Math.max(...channels);
	const boost = (channel: number) =>
		Math.round(Math.max(0, Math.min(255, maximum + (channel - maximum) * amount))) / 255;
	return [boost(channels[0]), boost(channels[1]), boost(channels[2])];
}

function disruptorFlicker(timeSeconds: number): number {
	const pulse = 0.5 + 0.5 * Math.sin(timeSeconds * 24);
	return 0.35 + 0.65 * pulse * pulse;
}

/**
 * Sweep the Dark Priest's beam over a target cardboard, then run the impact.
 * The tinted copy is cropped from top to bottom so the original art remains
 * visible until the scan reaches it.
 */
export function spawnDisruptorBeam(
	game: Game,
	caster: Creature,
	target: Creature,
	disintegrate: boolean,
	onComplete: () => void,
): void {
	cancelDisruptorColorRecovery(target);
	const engine = game.gameEngine;
	const sourceSprite = caster.sprite;
	const targetSprite = target.sprite;
	const targetGroup = target.grp;
	const boardGroup = game.grid?.creatureGroup;

	if (
		!engine ||
		!sourceSprite ||
		!targetSprite ||
		!targetGroup ||
		!boardGroup ||
		typeof targetSprite.setCrop !== 'function' ||
		!engine.add.graphics
	) {
		onComplete();
		return;
	}
	const useShader = typeof engine.add.shader === 'function' && engine.supportsShaders === true;

	const casterFrame = getFrameSize(sourceSprite);
	const isClone = sourceSprite.key.toLowerCase().includes('clone');
	const emitterX = (isClone ? 99 : 106) - casterFrame.width / 2;
	const emitterY = (isClone ? 99 : 106) - casterFrame.height;
	const rowOffset =
		caster.y % 2 === 0 ? (target.y % 2 === 1 ? 0.5 : 0) : target.y % 2 === 0 ? -0.5 : 0;
	const targetColumn = target.x + rowOffset;
	const facesLeft = caster.y % 2 === 0 ? targetColumn <= caster.x : targetColumn < caster.x;
	const facing = facesLeft ? -1 : 1;
	const source = {
		x: caster.grp.x + sourceSprite.x + emitterX * facing,
		y: caster.grp.y + sourceSprite.y + emitterY,
	};
	const beamColor = electroShockerLook({ playerColor: caster.player.color }).blueColor;

	const { width, height } = getFrameSize(targetSprite);
	const targetScaleX = targetSprite.scaleX ?? 1;
	const targetScaleY = targetSprite.scaleY ?? 1;
	const displayWidth = width * Math.abs(targetScaleX);
	const displayHeight = height * Math.abs(targetScaleY);
	const targetLeft = targetGroup.x + targetSprite.x - displayWidth / 2;
	const targetTop = targetGroup.y + targetSprite.y - displayHeight;
	const shaderBounds = {
		left: Math.min(source.x, targetLeft),
		top: Math.min(source.y, targetTop),
		right: Math.max(source.x, targetLeft + displayWidth),
		bottom: Math.max(source.y, targetTop + displayHeight),
	};
	const shaderWidth = Math.max(1, shaderBounds.right - shaderBounds.left);
	const shaderHeight = Math.max(1, shaderBounds.bottom - shaderBounds.top);
	const color = (beamColor: number) => boostColorSaturation(beamColor);
	if (disintegrate && target.name === 'Infernal') {
		game.animations?.disposeInfernalCardboardEffect(target);
	}
	const cardboardEffect = createDesaturatedCardboard(game, targetSprite, width, height);
	const rippleSurface = cardboardEffect ? createGameCanvasSurface(game, width, height) : null;
	const scanSurface = cardboardEffect ? createGameCanvasSurface(game, width, height) : null;
	let particleSurface: CanvasSurface | null = null;
	let activeParticleCount = 0;
	let particleSpawningFinished = false;
	let previousRippleBounds: { top: number; bottom: number } | null = null;
	let previousScanBounds: { top: number; bottom: number } | null = null;
	let disintegratedToRow = 0;
	const colorCardboard =
		disintegrate && cardboardEffect
			? engine.add.sprite(
					targetSprite.x,
					targetSprite.y,
					cardboardEffect.colorSurface.key,
					undefined,
					targetGroup,
			  )
			: null;
	colorCardboard?.setOrigin(0.5, 1);
	colorCardboard?.setScale(targetScaleX, targetScaleY);
	if (colorCardboard) targetSprite.alpha = 0;
	const overlay = engine.add.sprite(
		targetSprite.x,
		targetSprite.y,
		cardboardEffect?.surface.key ?? targetSprite.key,
		undefined,
		targetGroup,
	);
	overlay.setOrigin(0.5, 1);
	overlay.setScale(targetScaleX, targetScaleY);
	if (!cardboardEffect) {
		overlay.setTint(0x929b9b);
	}
	overlay.alpha = disintegrate ? 1 : 0.88;
	overlay.setCrop(0, 0, width, 1);
	const rippleSprite = rippleSurface
		? engine.add.sprite(targetSprite.x, targetSprite.y, rippleSurface.key, undefined, targetGroup)
		: null;
	rippleSprite?.setOrigin(0.5, 1);
	rippleSprite?.setScale(targetScaleX, targetScaleY);
	if (rippleSprite) rippleSprite.alpha = 0.9;
	const scanSurfaceSprite = scanSurface
		? engine.add.sprite(targetSprite.x, targetSprite.y, scanSurface.key, undefined, targetGroup)
		: null;
	scanSurfaceSprite?.setOrigin(0.5, 1);
	scanSurfaceSprite?.setScale(targetScaleX, targetScaleY);

	const shaderBeam = useShader
		? engine.add.shader(
				{
					name: `ABDisruptorBeam-${caster.id}-${target.id}`,
					fragmentSource: DISRUPTOR_FRAGMENT_SOURCE,
					initialUniforms: {
						uSource: [0, 0],
						uLeft: [0, 0],
						uRight: [0, 0],
						uSize: [shaderWidth, shaderHeight],
						uColor: color(beamColor),
						uTime: 0,
						uAlpha: 1,
					},
				},
				shaderBounds.left + shaderWidth / 2,
				shaderBounds.top + shaderHeight / 2,
				shaderWidth,
				shaderHeight,
				boardGroup,
		  )
		: null;
	shaderBeam?.setOrigin(0.5, 0.5);
	const beam = shaderBeam ?? engine.add.graphics(0, 0, boardGroup);
	const scanLine = engine.add.graphics(0, 0, targetGroup);
	const progress = { value: 0 };
	let finished = false;
	let beamRemoved = false;
	let scanLineRemoved = false;
	let cleaned = false;
	let recoveryTween: TweenHandle | null = null;

	const removeBeam = () => {
		if (beamRemoved) return;
		beamRemoved = true;
		beam.destroy();
	};

	const removeScanLine = () => {
		if (scanLineRemoved) return;
		scanLineRemoved = true;
		scanLine.destroy();
	};

	const cleanup = () => {
		if (cleaned) return;
		cleaned = true;
		removeBeam();
		removeScanLine();
		recoveryTween?.stop();
		overlay.destroy();
		rippleSprite?.destroy();
		scanSurfaceSprite?.destroy();
		colorCardboard?.destroy();
		rippleSurface?.destroy();
		scanSurface?.destroy();
		cardboardEffect?.surface.destroy();
		cardboardEffect?.colorSurface.destroy();
		cardboardEffect?.invertedSurface.destroy();
		if (activeColorRecoveries.get(target) === cleanup) {
			activeColorRecoveries.delete(target);
		}
	};

	const releaseParticleSurface = () => {
		if (particleSpawningFinished && activeParticleCount === 0) {
			particleSurface?.destroy();
			particleSurface = null;
		}
	};

	const getParticleSurface = () => {
		if (particleSurface) return particleSurface;
		particleSurface = createGameCanvasSurface(
			game,
			DISINTEGRATION_PARTICLE_SIZE,
			DISINTEGRATION_PARTICLE_SIZE,
		);
		const center = DISINTEGRATION_PARTICLE_SIZE / 2;
		particleSurface.ctx.beginPath();
		particleSurface.ctx.arc(center, center, center, 0, Math.PI * 2);
		particleSurface.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
		particleSurface.ctx.fill();
		particleSurface.commit();
		return particleSurface;
	};

	const spawnDisintegrationTiles = (throughRow: number) => {
		if (!cardboardEffect) return;

		while (
			disintegratedToRow < throughRow &&
			(throughRow - disintegratedToRow >= DISINTEGRATION_TILE_HEIGHT || throughRow === height)
		) {
			const tileY = disintegratedToRow;
			const tileHeight = Math.min(DISINTEGRATION_TILE_HEIGHT, throughRow - tileY);
			disintegratedToRow += tileHeight;

			for (let tileX = 0; tileX < width; tileX += DISINTEGRATION_TILE_WIDTH) {
				const tileWidth = Math.min(DISINTEGRATION_TILE_WIDTH, width - tileX);
				const pixels = cardboardEffect.grayscalePixels;
				const radius = 2 + Math.random() * 1.6;
				let luminance = 0;
				let visiblePixels = 0;
				for (let y = tileY; y < tileY + tileHeight; y++) {
					for (let x = tileX; x < tileX + tileWidth; x++) {
						const pixel = (y * width + x) * 4;
						if (pixels[pixel + 3] <= 16) continue;
						luminance += pixels[pixel];
						visiblePixels++;
					}
				}
				if (visiblePixels === 0) continue;
				const shade = Math.max(
					60,
					Math.min(
						220,
						Math.round(luminance / visiblePixels) + Math.round((Math.random() - 0.5) * 48),
					),
				);
				const sharedParticleSurface = getParticleSurface();
				cardboardEffect.surface.ctx.clearRect(tileX, tileY, tileWidth, tileHeight);
				cardboardEffect.colorSurface.ctx.clearRect(tileX, tileY, tileWidth, tileHeight);

				const displayedX = targetScaleX < 0 ? width - tileX - tileWidth / 2 : tileX + tileWidth / 2;
				const x = targetLeft + displayedX * Math.abs(targetScaleX);
				const y = targetTop + (tileY + tileHeight / 2) * Math.abs(targetScaleY);
				const particle = engine.add.sprite(x, y, sharedParticleSurface.key, undefined, boardGroup);
				particle.setOrigin(0.5, 0.5);
				const particleScale = 0.7 + Math.random() * 0.7;
				const particleRadiusScale = (radius / (DISINTEGRATION_PARTICLE_SIZE / 2)) * particleScale;
				particle.setScale(particleRadiusScale, particleRadiusScale);
				particle.alpha = 0.85 + Math.random() * 0.15;
				particle.tint = shade * 0x010101;
				particle.angle = -12 + Math.random() * 24;
				activeParticleCount++;

				const baseX = targetGroup.x + targetSprite.x;
				const baseY = targetGroup.y + targetSprite.y;
				const landingAngle = Math.random() * Math.PI * 2;
				const landingRadius = Math.sqrt(Math.random());
				const horizontalRadius = target.size * HEX_WIDTH_PX * 0.48;
				const verticalRadius = HEX_HEIGHT_PX * 0.4;
				const groundX = baseX + Math.cos(landingAngle) * landingRadius * horizontalRadius;
				const groundY = Math.max(
					y,
					baseY - verticalRadius + Math.sin(landingAngle) * landingRadius * verticalRadius,
				);
				const fallDistance = Math.max(0, groundY - y);
				const duration = 420 + fallDistance * 1.8 + Math.random() * 180;
				engine
					.tween(particle)
					.to(
						{
							x: groundX,
							y: groundY,
							angle: particle.angle + (Math.random() - 0.5) * 90,
						},
						duration,
						Easing.Cubic.In,
						true,
					)
					.onComplete.add(() => {
						engine
							.tween(particle)
							.to({ alpha: 0 }, 700, Easing.Linear.None, true, 350)
							.onComplete.add(() => {
								particle.destroy();
								activeParticleCount--;
								releaseParticleSurface();
							});
					});
			}
		}
		cardboardEffect.surface.commit();
		cardboardEffect.colorSurface.commit();
	};

	const finish = () => {
		if (finished) return;
		finished = true;
		particleSpawningFinished = true;
		releaseParticleSurface();
		cleanup();
		onComplete();
	};

	const finishScan = () => {
		if (disintegrate) {
			spawnDisintegrationTiles(height);
			finish();
			return;
		}
		removeBeam();
		removeScanLine();
		if (rippleSprite) rippleSprite.alpha = 0;
		if (finished) return;
		finished = true;
		onComplete();
		const fade = { value: 0 };
		recoveryTween = engine.tween(fade).to({ value: 1 }, COLOR_RESTORE_TOTAL_MS, Easing.Linear.None);
		activeColorRecoveries.set(target, cleanup);
		recoveryTween.onUpdateCallback(() => {
			overlay.x = targetSprite.x;
			overlay.y = targetSprite.y;
			overlay.angle = targetSprite.angle;
			overlay.setScale(targetSprite.scaleX ?? targetScaleX, targetSprite.scaleY ?? targetScaleY);
			const restoreProgress = Math.max(
				0,
				Math.min(
					1,
					(fade.value * COLOR_RESTORE_TOTAL_MS - DAMAGE_HINT_DISPLAY_MS) / COLOR_RESTORE_MS,
				),
			);
			overlay.alpha = 0.88 * (1 - restoreProgress);
		});
		recoveryTween.onComplete.add(cleanup);
		recoveryTween.start();
	};

	const draw = () => {
		const row = Math.min(height - 1, Math.floor(progress.value * height));
		const bounds = cardboardEffect?.alphaRows[row];
		const sourceLeft = bounds?.left ?? (cardboardEffect ? width / 2 : 0);
		const sourceRight = bounds?.right ?? (cardboardEffect ? width / 2 : width - 1);
		const leftPixel = targetScaleX < 0 ? width - 1 - sourceRight : sourceLeft;
		const rightPixel = targetScaleX < 0 ? width - 1 - sourceLeft : sourceRight;
		const scanY = targetTop + displayHeight * (row / Math.max(height, 1));
		const leftX = targetLeft + leftPixel * Math.abs(targetScaleX);
		const rightX = targetLeft + (rightPixel + 1) * Math.abs(targetScaleX);
		overlay.setCrop(0, 0, width, Math.max(1, height * progress.value));
		if (disintegrate) {
			spawnDisintegrationTiles(Math.min(height, Math.floor(progress.value * height)));
		}
		if (cardboardEffect && rippleSurface) {
			const scanRow = progress.value * height;
			const time = engine.time.now / 1000;
			const context = rippleSurface.ctx;
			const firstRippleRow = Math.max(0, Math.floor(scanRow - 30));
			const lastRippleRow = Math.min(height, Math.ceil(scanRow + 70));
			const clearTop = previousRippleBounds
				? Math.min(previousRippleBounds.top, firstRippleRow)
				: firstRippleRow;
			const clearBottom = previousRippleBounds
				? Math.max(previousRippleBounds.bottom, lastRippleRow)
				: lastRippleRow;
			context.clearRect(0, clearTop, width, clearBottom - clearTop);
			previousRippleBounds = { top: firstRippleRow, bottom: lastRippleRow };
			for (let sourceRow = firstRippleRow; sourceRow < lastRippleRow; sourceRow += 2) {
				const bandHeight = Math.min(2, lastRippleRow - sourceRow);
				const rowCenter = sourceRow + bandHeight / 2;
				const distanceFromFront = rowCenter - scanRow;
				const influence =
					distanceFromFront >= 0
						? Math.exp(-(((distanceFromFront - SCAN_RIPPLE_AHEAD_PX) / SCAN_RIPPLE_WIDTH_PX) ** 2))
						: 0.4 * Math.exp(distanceFromFront / 12);
				const displacement =
					influence *
					(SCAN_RIPPLE_DISPLACEMENT_PX * Math.sin(rowCenter * 0.24 - time * 7) +
						2 * Math.sin(rowCenter * 0.1 + time * 4));
				const verticalDisplacement = influence * 2.5 * Math.sin(rowCenter * 0.32 - time * 5);
				context.globalAlpha = 0.85 * influence;
				context.drawImage(
					cardboardEffect.colorSurface.canvas,
					0,
					sourceRow,
					width,
					bandHeight,
					displacement,
					sourceRow + verticalDisplacement,
					width,
					bandHeight,
				);
			}
			context.globalAlpha = 1;
			rippleSurface.commit();
		}
		const now = engine.time.now / 1000;
		const flicker = disruptorFlicker(now);
		if (cardboardEffect && scanSurface && scanSurfaceSprite) {
			const context = scanSurface.ctx;
			const scanRow = progress.value * height;
			const sourceTop = Math.max(
				0,
				Math.min(height, Math.floor(scanRow - DISRUPTOR_SCAN_LINE_HEIGHT / 2)),
			);
			const sourceBottom = Math.min(height, sourceTop + DISRUPTOR_SCAN_LINE_HEIGHT);
			const stripHeight = scanRow < height ? sourceBottom - sourceTop : 0;
			const clearTop = previousScanBounds ? Math.min(previousScanBounds.top, sourceTop) : sourceTop;
			const clearBottom = previousScanBounds
				? Math.max(previousScanBounds.bottom, sourceBottom)
				: sourceBottom;
			context.clearRect(0, clearTop, width, clearBottom - clearTop);
			previousScanBounds = stripHeight > 0 ? { top: sourceTop, bottom: sourceBottom } : null;
			if (stripHeight > 0) {
				context.globalAlpha = 0.75 + flicker * 0.25;
				context.drawImage(
					cardboardEffect.invertedSurface.canvas,
					0,
					sourceTop,
					width,
					stripHeight,
					0,
					sourceTop,
					width,
					stripHeight,
				);
				context.globalAlpha = 1;
			}
			scanSurface.commit();
			scanSurfaceSprite.alpha = 1;
		}

		if (shaderBeam) {
			const toShaderPoint = (x: number, y: number) => [
				(x - shaderBounds.left) / shaderWidth,
				(y - shaderBounds.top) / shaderHeight,
			];
			const now = engine.time.now;
			shaderBeam.setUniform('uSource', toShaderPoint(source.x, source.y));
			shaderBeam.setUniform('uLeft', toShaderPoint(leftX, scanY));
			shaderBeam.setUniform('uRight', toShaderPoint(rightX, scanY));
			shaderBeam.setUniform('uTime', now / 1000);
			shaderBeam.setUniform('uAlpha', flicker);
		} else {
			beam.clear();
			beam.beginFill(beamColor, 0.15 * flicker);
			beam.moveTo(source.x, source.y);
			beam.lineTo(leftX, scanY);
			const edgeWidth = rightX - leftX;
			const segments = 24;
			for (let segment = 0; segment <= segments; segment++) {
				const across = segment / segments;
				const wave =
					Math.sin(across * 24 - now * 5.5) * 1.8 + Math.sin(across * 51 + now * 3.4) * 0.9;
				beam.lineTo(leftX + edgeWidth * across, scanY + wave);
			}
			beam.lineTo(source.x, source.y);
			beam.endFill();
			beam.lineStyle(12, beamColor, 0.06 * flicker);
			beam.moveTo(leftX, scanY);
			for (let segment = 0; segment <= segments; segment++) {
				const across = segment / segments;
				const wave =
					Math.sin(across * 24 - now * 5.5) * 1.8 + Math.sin(across * 51 + now * 3.4) * 0.9;
				beam.lineTo(leftX + edgeWidth * across, scanY + wave);
			}
			beam.strokePath();
			beam.lineStyle(4, beamColor, 0.28 * flicker);
			beam.moveTo(leftX, scanY);
			for (let segment = 0; segment <= segments; segment++) {
				const across = segment / segments;
				const wave =
					Math.sin(across * 24 - now * 5.5) * 1.8 + Math.sin(across * 51 + now * 3.4) * 0.9;
				beam.lineTo(leftX + edgeWidth * across, scanY + wave);
			}
			beam.strokePath();
			beam.lineStyle(1, beamColor, 0.42 * flicker);
			beam.moveTo(leftX, scanY);
			for (let segment = 0; segment <= segments; segment++) {
				const across = segment / segments;
				const wave =
					Math.sin(across * 24 - now * 5.5) * 1.8 + Math.sin(across * 51 + now * 3.4) * 0.9;
				beam.lineTo(leftX + edgeWidth * across, scanY + wave);
			}
			beam.strokePath();
		}

		scanLine.clear();
		const scanLineY = scanY - targetGroup.y;
		const scanLineLeft = leftX - targetGroup.x;
		const scanLineWidth = rightX - leftX;
		const scanLineTime = now;
		const scanLineFlicker = flicker;
		const drawScanLine = () => {
			scanLine.moveTo(scanLineLeft, scanLineY);
			for (let segment = 1; segment <= 20; segment++) {
				const across = segment / 20;
				const ripple = Math.sin(across * 18 + scanLineTime * 9) * 1.4;
				scanLine.lineTo(scanLineLeft + scanLineWidth * across, scanLineY + ripple);
			}
			scanLine.strokePath();
		};
		scanLine.lineStyle(4, beamColor, 0.07 * scanLineFlicker);
		drawScanLine();
		scanLine.lineStyle(1, beamColor, 0.2 * scanLineFlicker);
		drawScanLine();
	};

	const tween = engine.tween(progress).to({ value: 1 }, DISRUPTOR_SCAN_MS, Easing.Linear.None);
	tween.onUpdateCallback(draw);
	tween.onComplete.add(finishScan);
	draw();
	tween.start();
}
