import { Damage } from '../damage';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import { Team, isTeam } from '../utility/team';
import * as arrayUtils from '../utility/arrayUtils';
import Game from '../game';
import type { Ability } from '../ability';
import type { UnitData } from '../data/types';

const CYCLOPER_UNIT_ID = 15;
const ACRYLIC_WALL_UNIT_ID = 999;
const ACRYLIC_WALL_TYPE = 'O0';
const ALL_DIRECTIONS: [1, 1, 1, 1, 1, 1] = [1, 1, 1, 1, 1, 1];
const APERTURE_NO_ENERGY_MESSAGE = 'Not enough energy for targets in range.';

type DirectionArgs = { direction?: number };
type CreatureDataEntry = UnitData[number];
type CycloperAbilityState = {
	_noAffordableApertureTargetInRange?: boolean;
};
type AcrylicWallRuntimeFlags = {
	hideFromQueue?: boolean;
	hideUnitStatsOnHover?: boolean;
	deathAnimationType?: string;
	hideFromCreatureCount?: boolean;
	_nextGameTurnActive?: number;
};
type ShatterTexture = {
	crop?: { x: number; y: number; width: number; height: number };
	frame?: { x: number; y: number; width: number; height: number };
	width?: number;
	height?: number;
	baseTexture?: { source?: CanvasImageSource };
};
type PowerApertureTile = {
	sprite: Phaser.Sprite;
	bitmapData: Phaser.BitmapData;
	angle: number;
	dissolveSeed: number;
	spinDirection: 1 | -1;
	sourceX: number;
	sourceY: number;
	destinationX: number;
	destinationY: number;
	renderScaleX: number;
	renderScaleY: number;
	phase1StartProgress: number;
	phase1Scatter: number;
};

function enforcePowerApertureFacing(target: Creature, facing: 1 | -1, ticks = 5) {
	const keepFacing = (remainingTicks: number) => {
		if (!target || target.dead || !target.sprite) {
			return;
		}

		target.creatureSprite.setDir(facing);

		if (remainingTicks <= 1) {
			return;
		}

		setTimeout(() => {
			keepFacing(remainingTicks - 1);
		}, 16);
	};

	keepFacing(ticks);
}

function getCycloperOrigin(cycloper: Creature) {
	return cycloper.player.flipped ? cycloper.hexagons[cycloper.size - 1] : cycloper.hexagons[0];
}

function getCycloperEyeOffsets(cycloper: Creature) {
	return {
		x: cycloper.sprite?.scale?.x > 0 ? 50 : 40,
		y: -113,
	};
}

function getCycloperEyeEmissionPoint(cycloper: Creature) {
	const eyeOffsets = getCycloperEyeOffsets(cycloper);
	const fallbackOrigin = getCycloperOrigin(cycloper);
	const fallbackPoint = {
		x: fallbackOrigin?.displayPos?.x ?? cycloper.x * 90,
		y: fallbackOrigin?.displayPos?.y ?? cycloper.y * 78,
	};
	const basePoint = cycloper.legacyProjectileEmissionPoint ?? fallbackPoint;

	return {
		x: basePoint.x + eyeOffsets.x,
		y: basePoint.y + eyeOffsets.y,
		offsetX: eyeOffsets.x,
		offsetY: eyeOffsets.y,
	};
}

function getPowerApertureCapPoint(centerX: number, spriteTop: number, displayHeight: number) {
	return {
		x: centerX,
		y: spriteTop + displayHeight * 0.38,
	};
}

function getStaggeredProgress(baseProgress: number, seed: number, maxDelay = 0.55) {
	const delay = seed * maxDelay;
	if (baseProgress <= delay) {
		return 0;
	}

	return Math.min(1, (baseProgress - delay) / Math.max(0.001, 1 - delay));
}

function blendTint(fromColor: number, toColor: number, progress: number) {
	const t = Math.max(0, Math.min(1, progress));
	const fromR = (fromColor >> 16) & 0xff;
	const fromG = (fromColor >> 8) & 0xff;
	const fromB = fromColor & 0xff;
	const toR = (toColor >> 16) & 0xff;
	const toG = (toColor >> 8) & 0xff;
	const toB = toColor & 0xff;
	const red = Math.round(fromR + (toR - fromR) * t);
	const green = Math.round(fromG + (toG - fromG) * t);
	const blue = Math.round(fromB + (toB - fromB) * t);

	return (red << 16) | (green << 8) | blue;
}

function drawCycloperBeamLayered(
	beamGraphics: Phaser.Graphics,
	startX: number,
	startY: number,
	baseAngle: number,
	length: number,
	sweepRadians = 0,
) {
	const beamAngle = baseAngle + sweepRadians;
	const endX = startX + Math.cos(beamAngle) * length;
	const endY = startY + Math.sin(beamAngle) * length;
	const normalX = -Math.sin(beamAngle);
	const normalY = Math.cos(beamAngle);
	const beamLayers = [
		{ offset: -4, width: 2, color: 0x007f2a, alpha: 0.3 },
		{ offset: -2, width: 3, color: 0x22c95b, alpha: 0.65 },
		{ offset: 0, width: 4, color: 0x88ffb0, alpha: 0.98 },
		{ offset: 2, width: 3, color: 0x22c95b, alpha: 0.65 },
		{ offset: 4, width: 2, color: 0x007f2a, alpha: 0.3 },
	];

	beamLayers.forEach((layer) => {
		const layerStartX = startX + normalX * layer.offset;
		const layerStartY = startY + normalY * layer.offset;
		const layerEndX = endX + normalX * layer.offset;
		const layerEndY = endY + normalY * layer.offset;
		beamGraphics.lineStyle(layer.width, layer.color, layer.alpha);
		beamGraphics.moveTo(layerStartX, layerStartY);
		beamGraphics.lineTo(layerEndX, layerEndY);

		// Rounded cap at the beam tip to avoid hard pixel edge.
		const tipRadius = layer.width * 1.1;
		beamGraphics.lineStyle(0, 0, 0);
		beamGraphics.beginFill(layer.color, layer.alpha);
		beamGraphics.drawCircle(layerEndX, layerEndY, tipRadius * 2);
		beamGraphics.endFill();
	});

	return {
		x: endX,
		y: endY,
		angle: beamAngle,
	};
}

function createOpticBurstLaserEffect(
	ability: Ability,
	target: Creature,
	path: Hex[],
	G: Game,
	onComplete?: () => void,
) {
	if (typeof G.Phaser === 'undefined' || !G.Phaser.add) {
		if (onComplete) {
			onComplete();
		}
		return;
	}

	if (!G.Phaser.make?.graphics || typeof G.grid?.creatureGroup?.create !== 'function') {
		if (onComplete) {
			onComplete();
		}
		return;
	}

	const eyeEmissionPoint = getCycloperEyeEmissionPoint(ability.creature);
	const emissionPointX = eyeEmissionPoint.x;
	const emissionPointY = eyeEmissionPoint.y;

	let distanceFromEye = Number.MAX_SAFE_INTEGER;
	let targetX = path[0]?.displayPos?.x ?? target.x;
	for (const hex of path) {
		if (hex.creature?.id !== target.id) {
			continue;
		}

		const candidateDistance = Math.abs(emissionPointX - (hex.displayPos?.x ?? targetX));
		if (candidateDistance < distanceFromEye) {
			distanceFromEye = candidateDistance;
			targetX = hex.displayPos?.x ?? targetX;
		}
	}

	const baseDist = arrayUtils.filterCreature(path.slice(0), false, false).length;
	const targetHex = path[Math.min(baseDist, Math.max(0, path.length - 1))];
	const targetPointX = targetX + 45;
	const targetPointY = (targetHex?.displayPos?.y ?? target.y) - 65;

	const impactSprite = G.grid.creatureGroup.create(
		targetPointX,
		targetPointY,
		'effects_optic-burst',
	);
	impactSprite.anchor.setTo(0.5);
	impactSprite.tint = 0x55ff77;
	impactSprite.alpha = 0;
	impactSprite.scale.setTo(1.4, 1.4);

	const beamGraphics = G.Phaser.make.graphics(0, 0);
	G.grid.creatureGroup.addChild(beamGraphics);

	const travelSteps = baseDist <= 0 ? 1 : baseDist;
	const straightTravelDurationMs = Math.max(60, Math.min(110, travelSteps * 20));
	const sweepDurationMs = Math.max(320, travelSteps * 95);
	const beamDurationMs = straightTravelDurationMs + sweepDurationMs;
	const totalDx = targetPointX - emissionPointX;
	const totalDy = targetPointY - emissionPointY;
	const baseAngle = Math.atan2(totalDy, totalDx);
	const totalLength = Math.sqrt(totalDx * totalDx + totalDy * totalDy);
	const totalSweepRadians = (2.5 * Math.PI) / 180;

	let startTime: number;
	const animate = () => {
		if (startTime === undefined) {
			startTime = Date.now();
		}

		const elapsed = Date.now() - startTime;
		const progress = Math.min(1, elapsed / beamDurationMs);
		const isStraightTravelPhase = elapsed < straightTravelDurationMs;
		const straightProgress = Math.min(1, elapsed / straightTravelDurationMs);
		const sweepProgress = Math.min(
			1,
			Math.max(0, elapsed - straightTravelDurationMs) / sweepDurationMs,
		);
		const currentLength = isStraightTravelPhase ? totalLength * straightProgress : totalLength;
		const sweepRadians = isStraightTravelPhase ? 0 : totalSweepRadians * sweepProgress;

		ability.creature.faceHex(target);
		const currentEyeEmissionPoint = getCycloperEyeEmissionPoint(ability.creature);
		beamGraphics.clear();
		const beamTip = drawCycloperBeamLayered(
			beamGraphics,
			currentEyeEmissionPoint.x,
			currentEyeEmissionPoint.y,
			baseAngle,
			currentLength,
			sweepRadians,
		);

		if (isStraightTravelPhase) {
			impactSprite.alpha = 0;
		} else {
			impactSprite.x = beamTip.x;
			impactSprite.y = beamTip.y;
			const glowPulse = 0.5 + 0.5 * Math.sin(sweepProgress * Math.PI * 6);
			impactSprite.alpha = Math.min(0.9, 0.65 + glowPulse * 0.2);
			impactSprite.scale.setTo(1.4 + glowPulse * 0.35, 1.4 + glowPulse * 0.35);
		}

		if (progress < 1) {
			setTimeout(animate, 16);
			return;
		}

		beamGraphics.destroy();

		G.Phaser.add
			.tween(impactSprite.scale)
			.to(
				{
					x: 2.5,
					y: 2.5,
				},
				220,
				Phaser.Easing.Cubic.Out,
			)
			.start();

		G.Phaser.add
			.tween(impactSprite)
			.to(
				{
					alpha: 0,
				},
				220,
				Phaser.Easing.Cubic.Out,
				true,
			)
			.onComplete.add(function () {
				// @ts-expect-error 'this' defaults to type 'any'
				this.destroy();
				if (onComplete) {
					onComplete();
				}
			}, impactSprite);
	};

	animate();
}

function createPowerApertureTiles(
	G: Game,
	targetSprite: Phaser.Sprite,
	spriteLeft: number,
	spriteTop: number,
	displayWidth: number,
	displayHeight: number,
	forcedFlipped?: boolean,
) {
	const targetTexture = targetSprite.texture as ShatterTexture;
	const targetFrame = targetTexture.crop ||
		targetTexture.frame || { x: 0, y: 0, width: 0, height: 0 };
	const targetSource = targetTexture.baseTexture?.source;
	const targetTexW = Math.round(targetTexture.width || targetFrame.width || 1);
	const targetTexH = Math.round(targetTexture.height || targetFrame.height || 1);
	const targetIsFlipped =
		typeof forcedFlipped === 'boolean' ? forcedFlipped : targetSprite.scale.x < 0;
	const scaleX = displayWidth / targetTexW;
	const scaleY = displayHeight / targetTexH;
	const overlapScale = 1;
	const renderScaleX = Math.abs(scaleX) * overlapScale;
	const renderScaleY = Math.abs(scaleY) * overlapScale;
	const tileSize = Math.max(2, Math.floor(Math.min(targetTexW, targetTexH) / 16));
	const tiles: PowerApertureTile[] = [];

	if (!targetSource) {
		return tiles;
	}

	const orientedBitmapData = G.Phaser.add.bitmapData(targetTexW, targetTexH);
	orientedBitmapData.ctx.clearRect(0, 0, targetTexW, targetTexH);

	if (targetIsFlipped) {
		orientedBitmapData.ctx.save();
		orientedBitmapData.ctx.translate(targetTexW, 0);
		orientedBitmapData.ctx.scale(-1, 1);
		orientedBitmapData.ctx.drawImage(
			targetSource,
			targetFrame.x,
			targetFrame.y,
			targetTexW,
			targetTexH,
			0,
			0,
			targetTexW,
			targetTexH,
		);
		orientedBitmapData.ctx.restore();
	} else {
		orientedBitmapData.ctx.drawImage(
			targetSource,
			targetFrame.x,
			targetFrame.y,
			targetTexW,
			targetTexH,
			0,
			0,
			targetTexW,
			targetTexH,
		);
	}
	orientedBitmapData.dirty = true;

	for (let sy = 0; sy < targetTexH; sy += tileSize) {
		for (let sx = 0; sx < targetTexW; sx += tileSize) {
			const sw = Math.min(tileSize, targetTexW - sx);
			const sh = Math.min(tileSize, targetTexH - sy);
			const bitmapData = G.Phaser.add.bitmapData(sw, sh);
			bitmapData.ctx.clearRect(0, 0, sw, sh);
			bitmapData.ctx.drawImage(orientedBitmapData.canvas, sx, sy, sw, sh, 0, 0, sw, sh);
			bitmapData.dirty = true;
			const tileCenterX = sx + sw / 2;
			const tileCenterY = sy + sh / 2;
			const screenTileX = tileCenterX;
			const destinationX = spriteLeft + screenTileX * scaleX;
			const destinationY = spriteTop + tileCenterY * scaleY;

			tiles.push({
				sprite: null as unknown as Phaser.Sprite,
				bitmapData,
				angle: -18 + Math.random() * 36,
				dissolveSeed: Math.random(),
				spinDirection: Math.random() > 0.5 ? 1 : -1,
				sourceX: destinationX,
				sourceY: destinationY,
				destinationX,
				destinationY,
				renderScaleX,
				renderScaleY,
				phase1StartProgress: 0.22 + Math.random() * 0.24,
				phase1Scatter: (Math.random() - 0.5) * 44,
			});
		}
	}

	orientedBitmapData.destroy();

	return tiles;
}

function createPowerAperturePhase1Effect(
	cycloper: Creature,
	target: Creature,
	originalScaleX: number,
	G: Game,
	onComplete?: () => void,
) {
	if (typeof G.Phaser === 'undefined' || !G.Phaser.add) {
		if (onComplete) {
			onComplete();
		}
		return;
	}

	const laserColor = 0x00ff00;
	const laserDurationMs = 1200;
	const targetSprite = target.sprite;
	if (!targetSprite) {
		if (onComplete) {
			onComplete();
		}
		return;
	}

	const targetDisplayPos = target.creatureSprite.getPos();
	const targetBaseX = targetDisplayPos.x + targetSprite.x;
	const targetBaseY = targetDisplayPos.y + targetSprite.y;
	const targetCenterX = targetBaseX;
	const targetDisplayWidth = Math.abs(targetSprite.width);
	const targetDisplayHeight = Math.abs(targetSprite.height);
	const targetLeft = targetCenterX - targetDisplayWidth / 2;
	const targetTop = targetBaseY - targetDisplayHeight * targetSprite.anchor.y;
	const targetCapPoint = getPowerApertureCapPoint(targetCenterX, targetTop, targetDisplayHeight);
	const preservedSign = originalScaleX < 0 ? -1 : 1;
	target.creatureSprite.setDir(preservedSign);
	cycloper.faceHex(target);
	const lockedEyeEmissionPoint = getCycloperEyeEmissionPoint(cycloper);
	const tiles = createPowerApertureTiles(
		G,
		targetSprite,
		targetLeft,
		targetTop,
		targetDisplayWidth,
		targetDisplayHeight,
		preservedSign < 0,
	);

	// Keep the creature sprite hidden throughout phase 1 – tiles represent it visually.
	target.grp.alpha = 0;
	target.grp.visible = false;
	target.grp.renderable = false;
	if (typeof target.creatureSprite?.setAlpha === 'function') {
		target.creatureSprite.setAlpha(0, 0);
	}

	const impactSprite = G.grid.creatureGroup.create(
		targetCapPoint.x,
		targetCapPoint.y,
		'effects_optic-burst',
	);
	impactSprite.anchor.setTo(0.5, 0.5);
	impactSprite.tint = laserColor;
	impactSprite.alpha = 0.8;
	impactSprite.scale.setTo(2, 1.5);

	if (!tiles.length) {
		impactSprite.destroy();
		if (onComplete) {
			onComplete();
		}
		return;
	}

	tiles.forEach((tile) => {
		const lineDeltaX = targetCapPoint.x - tile.sourceX;
		const lineDeltaY = targetCapPoint.y - tile.sourceY;
		const lineLength = Math.max(1, Math.hypot(lineDeltaX, lineDeltaY));
		const normalX = -lineDeltaY / lineLength;
		const normalY = lineDeltaX / lineLength;
		const spawnProgress = tile.phase1StartProgress;
		const spawnScatterX = normalX * tile.phase1Scatter;
		const spawnScatterY = normalY * tile.phase1Scatter;
		tile.sprite = G.grid.creatureGroup.create(
			tile.sourceX + lineDeltaX * spawnProgress + spawnScatterX,
			tile.sourceY + lineDeltaY * spawnProgress + spawnScatterY,
			tile.bitmapData,
		);
		tile.sprite.anchor.setTo(0.5, 0.5);
		tile.sprite.alpha = 0.45 + tile.dissolveSeed * 0.35;
		tile.sprite.tint = laserColor;
		tile.sprite.scale.setTo(tile.renderScaleX, tile.renderScaleY);
		tile.sprite.angle = 0;
	});

	const beamGraphics = G.Phaser.make.graphics(0, 0);
	G.grid.creatureGroup.addChild(beamGraphics);

	let startTime: number;
	const animateLaser = () => {
		if (startTime === undefined) {
			startTime = Date.now();
		}

		const elapsed = Date.now() - startTime;
		const progress = Math.min(1, elapsed / laserDurationMs);
		const suctionProgress = progress;

		beamGraphics.clear();
		const beamTip = drawCycloperBeamLayered(
			beamGraphics,
			lockedEyeEmissionPoint.x,
			lockedEyeEmissionPoint.y,
			Math.atan2(
				targetCapPoint.y - lockedEyeEmissionPoint.y,
				targetCapPoint.x - lockedEyeEmissionPoint.x,
			),
			Math.hypot(
				targetCapPoint.x - lockedEyeEmissionPoint.x,
				targetCapPoint.y - lockedEyeEmissionPoint.y,
			),
			0,
		);

		impactSprite.x = beamTip.x;
		impactSprite.y = beamTip.y;
		impactSprite.alpha = 0.55 + 0.35 * Math.sin(progress * Math.PI * 4) * 0.5;
		impactSprite.scale.setTo(2 + suctionProgress * 0.4, 1.5 + suctionProgress * 0.25);

		tiles.forEach((tile) => {
			const lineDeltaX = targetCapPoint.x - tile.sourceX;
			const lineDeltaY = targetCapPoint.y - tile.sourceY;
			const lineLength = Math.max(1, Math.hypot(lineDeltaX, lineDeltaY));
			const normalX = -lineDeltaY / lineLength;
			const normalY = lineDeltaX / lineLength;
			const speedFactor = 0.7 + tile.dissolveSeed * 0.9;
			const adjustedProgress = Math.min(1, suctionProgress * speedFactor);
			const motionProgress =
				tile.phase1StartProgress + (1 - tile.phase1StartProgress) * adjustedProgress;
			const scatterFalloff = 1 - adjustedProgress;
			tile.sprite.x =
				tile.sourceX + lineDeltaX * motionProgress + normalX * tile.phase1Scatter * scatterFalloff;
			tile.sprite.y =
				tile.sourceY + lineDeltaY * motionProgress + normalY * tile.phase1Scatter * scatterFalloff;
			tile.sprite.alpha = Math.max(0, 1 - motionProgress * (0.85 + tile.dissolveSeed * 0.1));
			tile.sprite.scale.setTo(tile.renderScaleX, tile.renderScaleY);
		});
		if (progress < 1) {
			setTimeout(animateLaser, 16);
			return;
		}

		tiles.forEach((tile) => {
			tile.sprite.destroy();
			tile.bitmapData.destroy();
		});
		beamGraphics.destroy();
		impactSprite.destroy();
		if (onComplete) {
			onComplete();
		}
	};

	animateLaser();
}

function createPowerAperturePhase2Effect(
	cycloper: Creature,
	target: Creature,
	destinationHex: Hex,
	originalScaleX: number,
	G: Game,
	onComplete?: () => void,
) {
	if (typeof G.Phaser === 'undefined' || !G.Phaser.add) {
		if (onComplete) {
			onComplete();
		}
		return;
	}

	const laserColor = 0x00ff00;
	const laserDurationMs = 1200;
	const reformDurationMs = 520;
	const targetSprite = target.sprite;

	if (!targetSprite) {
		if (onComplete) {
			onComplete();
		}
		return;
	}
	const preservedSign = originalScaleX < 0 ? -1 : 1;
	target.creatureSprite.setDir(preservedSign);
	const lockedEyeEmissionPoint = getCycloperEyeEmissionPoint(cycloper);

	const applyTargetReformState = (alpha: number, tintProgress: number) => {
		// Use only group alpha to avoid double-alpha (group × sprite = alpha²).
		// Ensure sprite's own alpha is 1 so group alpha is the sole control.
		const clampedAlpha = Math.max(0, Math.min(1, alpha));
		const clampedTint = Math.max(0, Math.min(1, tintProgress));
		targetSprite.alpha = 1;
		targetSprite.visible = true;
		targetSprite.renderable = true;
		targetSprite.tint = blendTint(laserColor, 0xffffff, clampedTint);
		target.grp.alpha = clampedAlpha;
		target.grp.visible = clampedAlpha > 0.01;
		target.grp.renderable = clampedAlpha > 0.01;
		target.creatureSprite.setDir(preservedSign);
		if (typeof target.creatureSprite?.setAlpha === 'function') {
			target.creatureSprite.setAlpha(clampedAlpha, 0);
		}
	};

	const targetOriginalState = {
		angle: targetSprite.angle,
		scaleX: preservedSign,
		scaleY: targetSprite.scale.y,
	};
	const destinationDisplayPos = target.creatureSprite.getPos();
	const destinationCenterX = destinationDisplayPos.x + targetSprite.x;
	const destinationCenterY = destinationDisplayPos.y + targetSprite.y;
	const destinationDisplayWidth = Math.abs(targetSprite.width);
	const destinationDisplayHeight = Math.abs(targetSprite.height);
	const destinationLeft = destinationCenterX - destinationDisplayWidth / 2;
	const destinationTop = destinationCenterY - destinationDisplayHeight * targetSprite.anchor.y;
	const destinationCapPoint = getPowerApertureCapPoint(
		destinationCenterX,
		destinationTop,
		destinationDisplayHeight,
	);
	const tiles = createPowerApertureTiles(
		G,
		targetSprite,
		destinationLeft,
		destinationTop,
		destinationDisplayWidth,
		destinationDisplayHeight,
		preservedSign < 0,
	);

	cycloper.facePlayerDefault?.();
	// Ensure sprite's own alpha is neutral so group alpha is the sole control.
	targetSprite.alpha = 1;
	targetSprite.visible = true;
	targetSprite.renderable = true;
	targetSprite.tint = laserColor;
	target.grp.alpha = 0;
	target.grp.visible = false;
	target.grp.renderable = false;
	if (typeof target.creatureSprite?.setAlpha === 'function') {
		target.creatureSprite.setAlpha(0, 0);
	}

	const impactSprite = G.grid.creatureGroup.create(
		destinationCapPoint.x,
		destinationCapPoint.y,
		'effects_optic-burst',
	);
	impactSprite.anchor.setTo(0.5, 0.5);
	impactSprite.tint = laserColor;
	impactSprite.alpha = 0.8;
	impactSprite.scale.setTo(2.5, 1.8);

	if (!tiles.length) {
		impactSprite.destroy();
		if (onComplete) {
			onComplete();
		}
		return;
	}

	tiles.forEach((tile) => {
		tile.sprite = G.grid.creatureGroup.create(
			destinationCapPoint.x,
			destinationCapPoint.y,
			tile.bitmapData,
		);
		tile.sprite.anchor.setTo(0.5, 0.5);
		tile.sprite.alpha = 0;
		tile.sprite.tint = laserColor;
		tile.sprite.scale.setTo(tile.renderScaleX, tile.renderScaleY);
		tile.sprite.angle = 0;
	});

	const beamGraphics = G.Phaser.make.graphics(0, 0);
	G.grid.creatureGroup.addChild(beamGraphics);

	let startTime: number;
	const animateLaser = () => {
		if (startTime === undefined) {
			startTime = Date.now();
		}

		const elapsed = Date.now() - startTime;
		const progress = Math.min(1, elapsed / laserDurationMs);

		beamGraphics.clear();
		const beamTip = drawCycloperBeamLayered(
			beamGraphics,
			lockedEyeEmissionPoint.x,
			lockedEyeEmissionPoint.y,
			Math.atan2(
				destinationCapPoint.y - lockedEyeEmissionPoint.y,
				destinationCapPoint.x - lockedEyeEmissionPoint.x,
			),
			Math.hypot(
				destinationCapPoint.x - lockedEyeEmissionPoint.x,
				destinationCapPoint.y - lockedEyeEmissionPoint.y,
			),
			0,
		);
		const reassembleProgress = Math.min(1, elapsed / reformDurationMs);
		const pulseIntensity = 0.5 + 0.5 * Math.sin(progress * Math.PI * 4);
		// Fade creature in only in the last 400ms so tiles finish assembling first.
		const revealStartMs = laserDurationMs - 400;
		const revealProgress = Math.min(1, Math.max(0, elapsed - revealStartMs) / 400);
		applyTargetReformState(revealProgress, revealProgress);
		impactSprite.x = beamTip.x;
		impactSprite.y = beamTip.y;
		impactSprite.alpha = 0.6 + pulseIntensity * 0.3;
		impactSprite.scale.setTo(2.5 + pulseIntensity * 0.6, 1.8 + pulseIntensity * 0.4);

		tiles.forEach((tile) => {
			const phaseSeed = Math.abs(Math.sin(tile.dissolveSeed * 97.13));
			const staggeredProgress = getStaggeredProgress(reassembleProgress, phaseSeed, 0.92);
			if (staggeredProgress <= 0) {
				tile.sprite.x = destinationCapPoint.x;
				tile.sprite.y = destinationCapPoint.y;
				tile.sprite.alpha = 0;
				tile.sprite.scale.setTo(tile.renderScaleX, tile.renderScaleY);
				return;
			}

			const adjustedProgress = staggeredProgress;
			tile.sprite.x =
				destinationCapPoint.x + (tile.destinationX - destinationCapPoint.x) * adjustedProgress;
			tile.sprite.y =
				destinationCapPoint.y + (tile.destinationY - destinationCapPoint.y) * adjustedProgress;
			tile.sprite.alpha = Math.min(1, 0.82 + adjustedProgress * 0.18);
			tile.sprite.scale.setTo(tile.renderScaleX, tile.renderScaleY);
		});

		if (progress < 1) {
			setTimeout(animateLaser, 16);
			return;
		}

		beamGraphics.destroy();
		impactSprite.destroy();

		tiles.forEach((tile) => {
			tile.sprite.destroy();
			tile.bitmapData.destroy();
		});

		target.grp.alpha = 1;
		target.grp.visible = true;
		target.grp.renderable = true;
		targetSprite.alpha = 1;
		targetSprite.visible = true;
		targetSprite.renderable = true;
		targetSprite.tint = 0xffffff;
		targetSprite.angle = targetOriginalState.angle;
		target.creatureSprite.setDir(preservedSign);
		targetSprite.scale.y = targetOriginalState.scaleY;
		enforcePowerApertureFacing(target, preservedSign);
		if (typeof target.creatureSprite?.setAlpha === 'function') {
			target.creatureSprite.setAlpha(1, 0);
		}
		cycloper.facePlayerDefault?.();
		if (onComplete) {
			onComplete();
		}
	};

	animateLaser();
}

function getApertureEnergyCost(target: Creature, useCurrentHealth: boolean) {
	const sourceHealth = useCurrentHealth ? target.health : target.stats.health;
	return Math.max(1, Math.ceil(sourceHealth));
}

function isAcrylicWall(creature?: Creature | null) {
	return creature instanceof Creature && creature.type === ACRYLIC_WALL_TYPE;
}

function isShieldedDarkPriest(target: Creature | null | undefined, attacker: Creature) {
	return (
		target instanceof Creature &&
		target.type === '--' &&
		isTeam(attacker, target, Team.Enemy) &&
		target.player.plasma > 0
	);
}

function isRiotShieldUpgraded(cycloper: Creature) {
	const riotShield = cycloper.abilities?.[2];
	return Boolean(
		riotShield && typeof riotShield.isUpgraded === 'function' && riotShield.isUpgraded(),
	);
}

function isCycloperRelayWall(creature: Creature | null | undefined, cycloper: Creature) {
	return (
		creature instanceof Creature && isAcrylicWall(creature) && isTeam(cycloper, creature, Team.Ally)
	);
}

function isDamagedAlliedAcrylicWall(creature: Creature | null | undefined, cycloper: Creature) {
	return (
		creature instanceof Creature &&
		isAcrylicWall(creature) &&
		creature.team === cycloper.team &&
		creature.health < creature.stats.health
	);
}

function isDamagedAlliedOpticBurstTarget(
	creature: Creature | null | undefined,
	cycloper: Creature,
) {
	return (
		creature instanceof Creature &&
		isTeam(cycloper, creature, Team.Ally) &&
		creature.health < creature.stats.health
	);
}

function isValidOpticBurstTarget(cycloper: Creature, target: Creature, upgraded: boolean) {
	if (!upgraded) {
		return !isAcrylicWall(target) && isTeam(cycloper, target, Team.Enemy);
	}

	if (isTeam(cycloper, target, Team.Enemy)) {
		return !isAcrylicWall(target);
	}

	// Upgraded: wounded allies are valid heal targets.
	return isDamagedAlliedOpticBurstTarget(target, cycloper);
}

function shouldIgnoreOpticBurstTarget(cycloper: Creature, upgraded: boolean, target: Creature) {
	if (!isAcrylicWall(target) && isTeam(cycloper, target, Team.Ally)) {
		if (!upgraded) {
			return true;
		}

		// Upgraded: stop on wounded allies so they can be selected/healed.
		return !isDamagedAlliedOpticBurstTarget(target, cycloper);
	}

	if (!isAcrylicWall(target)) {
		return false; // enemies: never pierce
	}

	// Walls when not upgraded: always pierce
	if (!upgraded) {
		return true;
	}

	// Upgraded: pierce healthy walls, stop at damaged walls so they're clickable
	return !isDamagedAlliedAcrylicWall(target, cycloper);
}

function getOpticBurstEffectiveDistance(
	cycloper: Creature,
	target: Creature,
	path: Hex[],
	args: { direction?: number } | undefined,
	G: Game,
) {
	const directionalDistance = getTargetDistanceInDirection(cycloper, target, args?.direction, G);

	if (Number.isFinite(directionalDistance)) {
		const relayBonus = isRiotShieldUpgraded(cycloper)
			? countAlliedRelayWallsBeforeTarget(cycloper, target, args?.direction, G)
			: 0;
		const effectiveDistance = Math.max(0, directionalDistance - 1 - relayBonus);
		return effectiveDistance;
	}

	// Fallback when direction context is unavailable.
	const emptyHexDistance = arrayUtils.filterCreature(path.slice(0), false, false).length;
	const relayBonus = isRiotShieldUpgraded(cycloper)
		? countAlliedRelayWallsBeforeTarget(cycloper, target, args?.direction, G)
		: 0;

	const effectiveDistance = Math.max(0, emptyHexDistance - relayBonus);
	return effectiveDistance;
}

function countAlliedRelayWallsBeforeTarget(
	cycloper: Creature,
	target: Creature,
	direction: number | undefined,
	G: Game,
) {
	if (direction === undefined) {
		return 0;
	}

	const origin = getCycloperOrigin(cycloper);
	const line = G.grid.getHexLine(origin.x, origin.y, direction, cycloper.player.flipped);

	// Find target position in line
	let targetIndex = -1;
	for (let i = 0; i < line.length; i++) {
		if (line[i].creature === target || target.hexagons.includes(line[i])) {
			targetIndex = i;
			break;
		}
	}

	if (targetIndex <= 0) {
		return 0;
	}

	// Count all relay walls BETWEEN cycloper and target (not necessarily continuous)
	let relays = 0;

	for (let i = 1; i < targetIndex; i++) {
		const hex = line[i];
		if (isCycloperRelayWall(hex.creature, cycloper)) {
			relays++;
		}
	}

	return relays;
}

function getTargetDistanceInDirection(
	cycloper: Creature,
	target: Creature,
	direction: number | undefined,
	G: Game,
) {
	if (direction === undefined) {
		return Number.POSITIVE_INFINITY;
	}

	const origin = getCycloperOrigin(cycloper);
	const line = G.grid.getHexLine(origin.x, origin.y, direction, cycloper.player.flipped);

	let distance = 0;
	for (const hex of line) {
		distance++;
		if (hex.creature === target || target.hexagons.includes(hex)) {
			return distance;
		}
	}

	return Number.POSITIVE_INFINITY;
}

function hasRelayExtensionOnPath(
	cycloper: Creature,
	target: Creature,
	direction: number | undefined,
	baseRange: number,
	G: Game,
) {
	if (!isRiotShieldUpgraded(cycloper)) {
		return false;
	}

	const relayCount = countAlliedRelayWallsBeforeTarget(cycloper, target, direction, G);
	if (relayCount <= 0) {
		return false;
	}

	const targetDistance = getTargetDistanceInDirection(cycloper, target, direction, G);
	return targetDistance <= baseRange + 1;
}

function isApertureTargetInRange(
	cycloper: Creature,
	target: Creature,
	direction: number | undefined,
	baseRange: number,
	G: Game,
) {
	const targetDistance = getTargetDistanceInDirection(cycloper, target, direction, G);
	if (targetDistance <= baseRange) {
		return true;
	}

	return hasRelayExtensionOnPath(cycloper, target, direction, baseRange, G);
}

function getRiotShieldPlacementRange(cycloper: Creature, G: Game) {
	const baseRange = 3;
	const canRelayThroughWalls = isRiotShieldUpgraded(cycloper);
	const relayCount = canRelayThroughWalls
		? cycloper.player.creatures.filter(
				(candidate) =>
					candidate instanceof Creature &&
					!candidate.dead &&
					isCycloperRelayWall(candidate, cycloper),
		  ).length
		: 0;
	const scanDistance = baseRange + relayCount;
	const origin = getCycloperOrigin(cycloper);
	const result: Hex[] = [];
	const seen = new Set<string>();

	for (const direction of [0, 1, 2, 3, 4, 5]) {
		const line = G.grid.getHexLine(origin.x, origin.y, direction, cycloper.player.flipped);
		let effectiveDistance = 0;
		let scannedSteps = 0;

		for (const hex of line) {
			if (hex.creature === cycloper) {
				continue;
			}

			scannedSteps++;
			if (scannedSteps > scanDistance) {
				break;
			}

			const creature = hex.creature;
			const isAlliedWallHex =
				creature instanceof Creature && isAcrylicWall(creature) && creature.team === cycloper.team;
			const isDamagedWallHex = isDamagedAlliedAcrylicWall(creature, cycloper);
			const isRelayWallHex = canRelayThroughWalls && isAlliedWallHex;

			if (!isRelayWallHex) {
				effectiveDistance++;
			}

			if (effectiveDistance > baseRange) {
				break;
			}

			if (!creature || isDamagedWallHex) {
				const key = `${hex.x},${hex.y}`;
				if (!seen.has(key)) {
					seen.add(key);
					result.push(hex);
				}
			}

			if (creature instanceof Creature && !isAlliedWallHex) {
				break;
			}
		}
	}

	return result;
}

function makeDisabledAbility() {
	return {
		trigger: 'noTrigger' as const,
		require: () => false,
	};
}

function createAcrylicWall3DPrintEffect(
	cycloper: Creature,
	wall: Creature,
	G: Game,
	onComplete?: () => void,
) {
	// Green laser from cycloper's eye to horizontal flash that reveals wall bottom-to-top
	const laserColor = 0x00ff00;
	const laserDuration = 1200;

	// Get Cycloper's eye emission point
	// Get wall sprite world position and size
	const wallDisplayPos = wall.creatureSprite.getPos();
	const wallSprite = wall.sprite;
	const wallCenterX = wallDisplayPos.x + wallSprite.x;
	const wallBottomY = wallDisplayPos.y + wallSprite.y;
	const wallHeight = Math.abs(wallSprite.height);
	const wallWidth = Math.abs(wallSprite.width);

	if (typeof G.Phaser === 'undefined' || !G.Phaser.add) {
		return;
	}

	// Use an invisible graphics mask to reveal the wall bottom-to-top without stretching.
	const maskGraphics = G.Phaser.make.graphics(0, 0);
	maskGraphics.alpha = 0;
	G.grid.creatureGroup.addChild(maskGraphics);
	wallSprite.mask = maskGraphics;
	wall.creatureSprite.setAlpha(1, 0);

	// Create beam graphics for laser line
	const beamGraphics = G.Phaser.make.graphics(0, 0);
	G.grid.creatureGroup.addChild(beamGraphics);

	// Create horizontal green flash
	const flashSprite = G.grid.creatureGroup.create(wallCenterX, wallBottomY, 'effects_optic-burst');
	flashSprite.anchor.setTo(0.5, 0.5);
	flashSprite.tint = laserColor;
	flashSprite.alpha = 0.96;
	flashSprite.scale.setTo(4.5, 0.7);

	let startTime: number;
	const animate = () => {
		if (startTime === undefined) {
			startTime = Date.now();
		}

		const elapsed = Date.now() - startTime;
		const progress = Math.min(1, elapsed / laserDuration);

		// Reveal wall from bottom to top with an invisible mask.
		const revealHeight = wallHeight * progress;
		const currentFlashY = wallBottomY - revealHeight;
		maskGraphics.clear();
		maskGraphics.beginFill(0xffffff, 1);
		maskGraphics.drawRect(
			wallCenterX - wallWidth / 2,
			wallBottomY - revealHeight,
			wallWidth,
			revealHeight,
		);
		maskGraphics.endFill();

		// Move flash upward along the wall
		flashSprite.y = currentFlashY;

		// Keep Cycloper facing the print direction for the full effect duration.
		cycloper.faceHex(wall);
		const currentEyeEmissionPoint = getCycloperEyeEmissionPoint(cycloper);

		// Draw laser beam from eye to flash
		beamGraphics.clear();
		beamGraphics.lineStyle(5, laserColor, 0.95);
		beamGraphics.moveTo(currentEyeEmissionPoint.x, currentEyeEmissionPoint.y);
		beamGraphics.lineTo(wallCenterX, currentFlashY);

		if (progress < 1) {
			setTimeout(animate, 16);
		} else {
			// Animation complete - remove mask and clean up effects
			wallSprite.mask = null;
			maskGraphics.destroy();
			beamGraphics.destroy();
			flashSprite.destroy();
			if (onComplete) {
				onComplete();
			}
		}
	};

	animate();
}

function ensureAcrylicWallData(G: Game) {
	const creatureData = G.creatureData as CreatureDataEntry[];
	const existing = creatureData.find((unit) => unit.type === ACRYLIC_WALL_TYPE);
	if (existing) {
		return existing;
	}

	const wallData = {
		id: ACRYLIC_WALL_UNIT_ID,
		name: 'object_acrylic-wall',
		playable: false as const,
		level: 0,
		realm: 'O',
		type: ACRYLIC_WALL_TYPE,
		size: 1 as const,
		set: '' as const,
		stats: {
			health: 30,
			regrowth: 0,
			endurance: 0,
			energy: 0,
			meditation: 0,
			initiative: 0,
			offense: 0,
			defense: 0,
			movement: 0,
			pierce: 0,
			slash: 0,
			crush: 0,
			shock: 0,
			burn: 0,
			frost: 0,
			poison: 0,
			sonic: 0,
			mental: 0,
		},
		animation: {
			walk_speed: 500,
		},
		display: {
			width: 90,
			height: 120,
			'offset-x': 0,
			'offset-y': -150,
		},
		ability_info: [
			{
				title: 'Acrylic Hull',
				desc: 'Converts all incoming damage to pure.',
				info: 'Passive.',
			},
			{
				title: 'Structural Form',
				desc: 'Passive placeholder.',
				info: 'No active effects.',
			},
			{
				title: 'Structural Form',
				desc: 'Passive placeholder.',
				info: 'No active effects.',
			},
			{
				title: 'Structural Form',
				desc: 'Passive placeholder.',
				info: 'No active effects.',
			},
		],
	};

	creatureData.push(wallData);
	return wallData;
}

/** Creates the abilities
 * @param {Object} G the game object
 * @return {void}
 */
export default (G: Game) => {
	ensureAcrylicWallData(G);

	// Riot Shield spawns a dedicated wall creature. It has no active abilities.
	G.abilities[ACRYLIC_WALL_UNIT_ID] = [
		{
			trigger: 'onUnderAttack',
			require: function () {
				return true;
			},
			activate: function (damage) {
				const damageValues = Object.values((damage.damages || {}) as Record<string, number>);
				const convertedTotal: number = damageValues.reduce(
					(sum, value) => sum + (typeof value === 'number' ? value : 0),
					0,
				);
				damage.damages = { pure: Math.max(1, convertedTotal) };
				return damage;
			},
		},
		makeDisabledAbility(),
		makeDisabledAbility(),
		makeDisabledAbility(),
	];

	G.abilities[CYCLOPER_UNIT_ID] = [
		// First Ability: Explosive End
		{
			trigger: 'onCreatureDeath',

			require: function () {
				return true;
			},

			activate: function (deadCreature: Creature) {
				if (deadCreature.id !== this.creature.id) {
					return;
				}

				const baseBurn = Number(this.damages?.burn ?? 10);
				const baseCrush = Number(this.damages?.crush ?? 10);
				const baseSonic = Number(this.damages?.sonic ?? 10);
				const bonusBurn = this.isUpgraded() ? Math.max(0, deadCreature.energy) : 0;

				const targets = this.getTargets(deadCreature.adjacentHexes(1));

				targets.forEach((item) => {
					if (
						!(item.target instanceof Creature) ||
						item.target.dead ||
						(this.isUpgraded() && !isTeam(this.creature, item.target, Team.Enemy))
					) {
						return;
					}
					item.target.takeDamage(
						new Damage(
							deadCreature,
							{
								burn: baseBurn + bonusBurn,
								crush: baseCrush,
								sonic: baseSonic,
							},
							1,
							[],
							G,
						),
					);
				});
			},
		},

		// Second Ability: Optic Burst
		{
			trigger: 'onQuery',
			_targetTeam: Team.Enemy,

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				const targetTeam = this.isUpgraded() ? Team.Both : this._targetTeam;
				const upgraded = this.isUpgraded();

				return this.testDirection({
					team: targetTeam,
					id: this.creature.id,
					sourceCreature: this.creature,
					flipped: this.creature.player.flipped,
					x: this.creature.x,
					y: this.creature.y,
					directions: ALL_DIRECTIONS,
					distance: 0,
					minDistance: 1,
					stopOnCreature: true,
					includeCreature: true,
					pierceThroughBehavior: upgraded ? 'pierce' : 'stop',
					pierceNumber: upgraded ? 2 : 1,
					ignoreCreatureTest: (target: Creature) =>
						shouldIgnoreOpticBurstTarget(this.creature, upgraded, target),
					optTest: (target: Creature) => isValidOpticBurstTarget(this.creature, target, upgraded),
				});
			},

			query: function () {
				const ability = this;
				const cycloper = this.creature;
				const upgraded = this.isUpgraded();
				const targetTeam = upgraded ? Team.Both : this._targetTeam;

				const directionalOptions = G.grid.getDirectionChoices({
					fnOnConfirm: (...args) => ability.animation(...args),
					team: targetTeam,
					id: cycloper.id,
					sourceCreature: cycloper,
					flipped: cycloper.player.flipped,
					x: cycloper.x,
					y: cycloper.y,
					directions: ALL_DIRECTIONS,
					distance: 0,
					minDistance: 1,
					requireCreature: true,
					stopOnCreature: true,
					pierceThroughBehavior: upgraded ? 'pierce' : 'stop',
					pierceNumber: upgraded ? 2 : 1,
					ignoreCreatureTest: (target: Creature) =>
						shouldIgnoreOpticBurstTarget(cycloper, upgraded, target),
					optTest: (target: Creature) => isValidOpticBurstTarget(cycloper, target, upgraded),
				});

				if (upgraded) {
					directionalOptions.choices.forEach((choice) => {
						const blockerIndex = choice.findIndex(
							(hex) =>
								hex.creature instanceof Creature &&
								!isAcrylicWall(hex.creature) &&
								isDamagedAlliedOpticBurstTarget(hex.creature, cycloper),
						);

						if (blockerIndex < 0) {
							return;
						}

						const blockedPath = choice.slice(blockerIndex + 1);
						choice.splice(blockerIndex + 1);

						blockedPath.forEach((hex) => {
							if (!directionalOptions.hexesDashed.includes(hex)) {
								directionalOptions.hexesDashed.push(hex);
							}
						});
					});
				}

				G.grid.queryChoice(directionalOptions);
			},

			activate: function (path, args) {
				let target: Creature | null = null;
				let wallFallback: Creature | null = null;
				const upgraded = this.isUpgraded();
				const projectileDirection = { direction: args?.direction ?? 0 };
				const eyeEmissionPoint = getCycloperEyeEmissionPoint(this.creature);
				const eyeStartX = eyeEmissionPoint.offsetX;
				const eyeStartY = eyeEmissionPoint.offsetY;
				const selectedHex = args?.hex;
				const selectedCreature =
					selectedHex?.creature instanceof Creature ? selectedHex.creature : null;
				const selectedIsValid =
					selectedCreature instanceof Creature &&
					selectedCreature.id !== this.creature.id &&
					isValidOpticBurstTarget(this.creature, selectedCreature, upgraded);

				if (selectedIsValid && isTeam(this.creature, selectedCreature, Team.Ally)) {
					target = selectedCreature;
				}
				for (const hex of path) {
					if (target) {
						break;
					}
					if (!(hex.creature instanceof Creature) || hex.creature.id === this.creature.id) {
						continue;
					}

					if (!isValidOpticBurstTarget(this.creature, hex.creature, upgraded)) {
						continue;
					}

					if (isAcrylicWall(hex.creature)) {
						if (upgraded && isDamagedAlliedAcrylicWall(hex.creature, this.creature)) {
							wallFallback = hex.creature;
						}
						continue;
					}

					if (!(selectedIsValid && isTeam(this.creature, selectedCreature, Team.Ally))) {
						target = hex.creature;
						break;
					}
				}

				if (!target) {
					target = wallFallback;
				}

				if (!target) {
					return;
				}

				if (isTeam(this.creature, target, Team.Ally) && target.health >= target.stats.health) {
					this.end(false, true);
					return;
				}

				const effectiveDistance = getOpticBurstEffectiveDistance(
					this.creature,
					target,
					path,
					args,
					G,
				);
				const baseBurn = Number(this.damages?.burn ?? 0);
				const burnAmount = Math.max(1, baseBurn - effectiveDistance);
				const pureHealAmount = baseBurn;

				if (isTeam(this.creature, target, Team.Ally)) {
					// Upgraded: heal within melee + relay wall range (distance <= 1)
					// Unupgraded: heal only at melee (distance === 0)
					const maxHealDistance = this.isUpgraded() ? 1 : 0;
					if (effectiveDistance > maxHealDistance) {
						this.end();
						return;
					}

					// Heal is intentionally a fixed amount (pure-equivalent), unaffected by masteries.
					const startingHealth = target.health;
					const missingHealth = Math.max(0, Math.ceil(target.stats.health - target.health));
					const appliedHealAmount = Math.min(pureHealAmount, missingHealth);
					const pulseCount = Math.min(30, Math.max(1, appliedHealAmount));
					const pulseIntervalMs = 25;
					let completedPulseCount = 0;
					let displayedHealth = startingHealth;
					const activeCycloper = this.creature;
					const healthBubbleType =
						typeof target.isFrozen === 'function' && target.isFrozen() ? 'frozen' : 'health';

					target.heal(pureHealAmount);
					target.clearHints?.(['healing']);
					if (typeof target.creatureSprite?.setHealth === 'function') {
						target.creatureSprite.setHealth(displayedHealth, healthBubbleType);
					}

					for (let pulseIndex = 0; pulseIndex < pulseCount; pulseIndex++) {
						setTimeout(() => {
							const [healTween, healSprite] = G.animations.projectile(
								this as Ability,
								target,
								'effects_optic-burst',
								path,
								projectileDirection,
								eyeStartX,
								eyeStartY,
							);
							healSprite.tint = 0x66ff8a;
							healSprite.alpha = pulseIndex === 0 ? 0.95 : 0.6;
							healTween.onComplete.add(function () {
								// @ts-expect-error 'this' defaults to type 'any'
								this.destroy();

								if (displayedHealth < startingHealth + appliedHealAmount) {
									displayedHealth++;
									if (typeof target.creatureSprite?.setHealth === 'function') {
										target.creatureSprite.setHealth(displayedHealth, healthBubbleType);
									}
								}

								completedPulseCount++;
								if (completedPulseCount === pulseCount && appliedHealAmount > 0) {
									if (typeof target.hint === 'function') {
										target.hint('+' + appliedHealAmount, 'healing');
									}
									activeCycloper.queryMove();
								}
							}, healSprite);
						}, pulseIndex * pulseIntervalMs);
					}

					this.end(false, true);
				} else {
					const damage = new Damage(
						this.creature,
						{
							burn: burnAmount,
						},
						1,
						[],
						G,
					);
					this.end();
					createOpticBurstLaserEffect(this as Ability, target, path, G, () =>
						target.takeDamage(damage),
					);
				}
			},
		},

		// Third Ability: Riot Shield
		{
			trigger: 'onQuery',
			_targetTeam: Team.Both,

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}

				const range = getRiotShieldPlacementRange(this.creature, G);

				return range.length > 0;
			},

			query: function () {
				const ability = this;
				const cycloper = this.creature;
				const wallPreviewData = ensureAcrylicWallData(G);
				const range = getRiotShieldPlacementRange(cycloper, G);
				let wallPlacementConfirmed = false;
				const hideWallPreviewInstantly = () => {
					const gridAny = G.grid as unknown as {
						_flickerTween?: Phaser.Tween;
						materialize_overlay?: { alpha: number } | null;
					};
					if (gridAny._flickerTween) {
						gridAny._flickerTween.stop(true);
					}
					if (gridAny.materialize_overlay) {
						gridAny.materialize_overlay.alpha = 0;
					}
				};

				G.grid.queryHexes({
					fnOnConfirm: (hex) => {
						wallPlacementConfirmed = true;
						hideWallPreviewInstantly();
						// Bypass default ability animation to avoid facePlayerDefault() snap.
						ability.activate(hex);
						ability.postActivate();
					},
					fnOnSelect: (selectedHex) => {
						if (wallPlacementConfirmed) {
							hideWallPreviewInstantly();
							return;
						}
						cycloper.faceHex(selectedHex);
						selectedHex.overlayVisualState('creature selected player' + cycloper.team);
						G.grid.previewCreature(selectedHex.pos, wallPreviewData, cycloper.player);
					},
					id: cycloper.id,
					hexes: range,
					size: 1,
					flipped: cycloper.player.flipped,
					hideNonTarget: true,
				});
			},

			activate: function (hex) {
				const targetedWall =
					hex.creature instanceof Creature &&
					isDamagedAlliedAcrylicWall(hex.creature, this.creature)
						? hex.creature
						: null;

				if (targetedWall) {
					targetedWall.health = targetedWall.stats.health;
					targetedWall.updateHealth();
					targetedWall.healthShow();
					this._lastBonus = targetedWall.id;
					G.updateQueueDisplay();
					this.end();
					return;
				}

				const previousShield = G.creatures[this._lastBonus ?? -1];
				if (
					previousShield instanceof Creature &&
					!previousShield.dead &&
					previousShield.type === ACRYLIC_WALL_TYPE
				) {
					previousShield.destroy();
				}

				const wallBase = ensureAcrylicWallData(G);

				const wallData = {
					...wallBase,
					x: hex.x,
					y: hex.y,
					team: this.creature.player.id,
					temp: false,
					materializationSickness: true,
				};

				const wall = new Creature(wallData, G);
				const wallFlags = wall as unknown as AcrylicWallRuntimeFlags;
				this.creature.player.creatures.push(wall);
				wallFlags.hideFromQueue = true;
				wallFlags.hideUnitStatsOnHover = true;
				wallFlags.deathAnimationType = 'shatterDown';
				wallFlags.hideFromCreatureCount = true;

				const gridAny = G.grid as unknown as {
					_flickerTween?: Phaser.Tween;
					materialize_overlay?: { alpha: number } | null;
					secondary_overlay?: { alpha: number } | null;
					_flickerTweenSecondary?: Phaser.Tween;
				};
				const previewOverlay = gridAny.materialize_overlay;
				if (gridAny._flickerTween) {
					gridAny._flickerTween.stop(true);
				}
				if (previewOverlay) {
					previewOverlay.alpha = 0;
				}
				// Prevent Creature.summon() from tween-fading the preview overlay back in.
				gridAny.materialize_overlay = null;

				wall.creatureSprite.setAlpha(0, 0);
				wall.summon(true); // Disable materialization sickness fade-in
				wall.creatureSprite.setAlpha(0, 0);

				gridAny.materialize_overlay = previewOverlay;
				if (previewOverlay) {
					previewOverlay.alpha = 0;
				}

				wallFlags._nextGameTurnActive = Number.MAX_SAFE_INTEGER;
				wall.remainingMove = 0;
				wall.noActionPossible = true;
				this._lastBonus = wall.id;
				this.creature.faceHex(hex);

				// Create 3D print laser effect from Cycloper's eye
				createAcrylicWall3DPrintEffect(this.creature, wall, G, () => {
					if (this.creature.dead) {
						return;
					}
					this.creature.queryMove();
				});

				G.updateQueueDisplay();
				this.end(false, true);
			},
		},

		// Fourth Ability: Power Aperture
		{
			trigger: 'onQuery',
			_targetTeam: Team.Both,
			range: {
				regular: 7,
				upgraded: 7,
			},

			require: function () {
				if (!this.testRequirements()) {
					return false;
				}
				(this as CycloperAbilityState)._noAffordableApertureTargetInRange = false;

				const baseRange = this.range.regular;
				const useCurrentHealthCost = this.isUpgraded();
				const abilityRange = baseRange + (isRiotShieldUpgraded(this.creature) ? 1 : 0);
				const directional = G.grid.getDirectionChoices({
					team: Team.Both,
					requireCreature: true,
					id: this.creature.id,
					sourceCreature: this.creature,
					flipped: this.creature.player.flipped,
					x: this.creature.x,
					y: this.creature.y,
					directions: ALL_DIRECTIONS,
					distance: abilityRange,
					minDistance: 1,
					stopOnCreature: true,
					includeCreature: true,
					ignoreCreatureTest: isRiotShieldUpgraded(this.creature)
						? (candidate: Creature) => isCycloperRelayWall(candidate, this.creature)
						: undefined,
				});

				let hasTargetInRange = false;
				let hasAffordableTargetInRange = false;

				const hasUsableTarget = directional.choices.some((path) => {
					const direction = path[0]?.direction;
					const targetInRangeHex = path.find(
						(hex) =>
							hex.creature instanceof Creature &&
							hex.creature.id !== this.creature.id &&
							!isShieldedDarkPriest(hex.creature, this.creature),
					);

					if (!targetInRangeHex || !(targetInRangeHex.creature instanceof Creature)) {
						return false;
					}

					if (
						!isApertureTargetInRange(
							this.creature,
							targetInRangeHex.creature,
							direction,
							baseRange,
							G,
						)
					) {
						return false;
					}

					hasTargetInRange = true;
					const targetCost = getApertureEnergyCost(targetInRangeHex.creature, useCurrentHealthCost);
					if (targetCost <= this.creature.energy) {
						hasAffordableTargetInRange = true;
					}

					return targetCost <= this.creature.energy;
				});

				if (!hasUsableTarget && hasTargetInRange && !hasAffordableTargetInRange) {
					(this as CycloperAbilityState)._noAffordableApertureTargetInRange = true;
					this.message = APERTURE_NO_ENERGY_MESSAGE;
				}

				return hasUsableTarget;
			},

			query: function () {
				const ability = this;
				const cycloper = this.creature;
				const baseRange = this.range.regular;
				const useCurrentHealthCost = this.isUpgraded();
				const abilityRange = baseRange + (isRiotShieldUpgraded(cycloper) ? 1 : 0);
				const resetEnergyPreview = () => {
					const current = cycloper.energy / cycloper.stats.energy;
					G.UI.energyBar.setSize(current);
					G.UI.energyBar.previewSize(0);
					G.UI.energyBar.setAvailableStyle();
				};
				const previewApertureCost = (target: Creature) => {
					const cost = getApertureEnergyCost(target, useCurrentHealthCost);
					const maxEnergy = cycloper.stats.energy;
					const currentEnergy = cycloper.energy;
					const currentRatio = currentEnergy / maxEnergy;
					const costRatio = cost / maxEnergy;

					G.UI.energyBar.setSize(currentRatio);
					G.UI.energyBar.previewSize(costRatio);
					G.UI.energyBar.setAvailableStyle();

					if (cost > currentEnergy) {
						G.UI.energyBar.setSize(costRatio);
						G.UI.energyBar.previewSize(Math.max(0, costRatio - currentRatio));
						G.UI.energyBar.setUnavailableStyle();
					}
				};
				const clearAllTargetingVisuals = () => {
					G.grid.forEachHex((gridHex: Hex) => {
						gridHex.cleanOverlayVisualState(
							'creature reachable weakDmg active moveto selected hover h_player0 h_player1 h_player2 h_player3 player0 player1 player2 player3 ownCreatureHexShade',
						);
						gridHex.cleanDisplayVisualState(
							'adj hover creature player0 player1 player2 player3 dashed shrunken deadzone hidden showGrid abilityRange',
						);
						gridHex.unsetReachable();
						gridHex.unsetNotTarget();
					});
					if (typeof G.grid.updateDisplay === 'function') {
						G.grid.updateDisplay();
					}
				};
				const beginDestinationQuery = (target: Creature, direction?: number) => {
					if (!(target instanceof Creature)) {
						return;
					}

					const cost = getApertureEnergyCost(target, useCurrentHealthCost);
					if (ability.creature.energy < cost) {
						ability.message = G.msg.abilities.notEnough.replace('%stat%', 'energy');
						return;
					}
					ability._energySelfUpgraded = cost;

					const relayRangeBonus = hasRelayExtensionOnPath(cycloper, target, direction, baseRange, G)
						? 1
						: 0;
					const destinationRange = baseRange + relayRangeBonus;

					const directionalDestinations = G.grid.getDirectionChoices({
						team: Team.Both,
						requireCreature: false,
						id: cycloper.id,
						sourceCreature: cycloper,
						flipped: cycloper.player.flipped,
						x: cycloper.x,
						y: cycloper.y,
						directions: ALL_DIRECTIONS,
						distance: destinationRange,
						minDistance: 1,
						includeCreature: true,
						stopOnCreature: true,
						ignoreCreatureTest: isRiotShieldUpgraded(cycloper)
							? (candidate: Creature) => isCycloperRelayWall(candidate, cycloper)
							: undefined,
					});

					const destinations = directionalDestinations.choices
						.flat()
						.filter(
							(hex) =>
								!hex.creature &&
								G.grid.hexes[hex.y][hex.x].isWalkable(target.size, target.id, true),
						);
					const extendedDestinations = arrayUtils.extendToLeft(destinations, target.size, G.grid);
					const extendedDashed = arrayUtils.extendToLeft(
						directionalDestinations.hexesDashed,
						target.size,
						G.grid,
					);

					if (!destinations.length) {
						ability.message = G.msg.abilities.noTarget;
						return;
					}

					if (target.sprite) {
						target.sprite.alpha = 0;
					}
					const showTargetSprite = () => {
						if (target.sprite) {
							target.sprite.alpha = 1;
						}
					};

					const targetStats = G.retrieveCreatureStats(target.type);
					let activeTweens: Phaser.Tween[] = [];

					const cleanupTweens = () => {
						activeTweens.forEach((tween) => {
							if (tween.isRunning) {
								tween.stop(true);
							}
						});
						activeTweens = [];
					};

					const restoreState = () => {
						cleanupTweens();
						if (target.sprite) {
							target.sprite.alpha = 1;
						}
						if (G.grid.materialize_overlay) {
							G.grid.materialize_overlay.alpha = 0;
						}
						if (G.grid.secondary_overlay) {
							G.grid.secondary_overlay.alpha = 0;
						}
						if (G.grid._flickerTween && G.grid._flickerTween.isRunning) {
							G.grid._flickerTween.stop(true);
						}
						if (G.grid._flickerTweenSecondary && G.grid._flickerTweenSecondary.isRunning) {
							G.grid._flickerTweenSecondary.stop(true);
						}
					};

					const clearTargetPathPreview = () => {
						clearAllTargetingVisuals();
					};

					// Clear all hex visuals before starting destination query
					G.grid.forEachHex((gridHex: Hex) => {
						gridHex.cleanOverlayVisualState();
						gridHex.cleanDisplayVisualState(); // Use default removal of adj, dashed, etc
						gridHex.unsetReachable();
						gridHex.unsetNotTarget();
					});
					if (typeof G.grid.updateDisplay === 'function') {
						G.grid.updateDisplay();
					}

					// Defer queryHexes to next frame to ensure queryDirection/queryChoice handlers are fully removed
					setTimeout(() => {
						G.grid.queryHexes({
							fnOnConfirm: function (hex) {
								const preview = G.grid.materialize_overlay;
								const oldPreview = G.grid.secondary_overlay;

								if (G.grid._flickerTween && G.grid._flickerTween.isRunning) {
									G.grid._flickerTween.stop(true);
								}
								if (G.grid._flickerTweenSecondary && G.grid._flickerTweenSecondary.isRunning) {
									G.grid._flickerTweenSecondary.stop(true);
								}
								cleanupTweens();
								// Immediately remove all grid path visualizations
								G.grid.forEachHex((gridHex: Hex) => {
									gridHex.cleanOverlayVisualState();
									gridHex.cleanDisplayVisualState();
									gridHex.unsetReachable();
									gridHex.unsetNotTarget();
								});

								// Prevent onInputOut → clearHexViewAlterations → redoLastQuery from
								// re-creating query highlights and ghost preview after the click.
								G.grid.lastQueryOpt = null;
								G.grid.selectedHex = undefined;

								if (preview) {
									preview.alpha = 0;
									preview.destroy();
									G.grid.materialize_overlay = null;
								}
								if (oldPreview) {
									oldPreview.alpha = 0;
									oldPreview.destroy();
									G.grid.secondary_overlay = null;
								}

								target.grp.alpha = 0;
								target.grp.visible = false;
								target.grp.renderable = false;
								if (target.sprite) {
									target.sprite.alpha = 0;
									target.sprite.visible = false;
									target.sprite.renderable = false;
								}
								if (typeof target.creatureSprite?.setAlpha === 'function') {
									target.creatureSprite.setAlpha(0, 0);
								}

								ability.activate(target, hex);
								ability.postActivate();
							},
							fnOnCancel: function () {
								clearTargetPathPreview();
								restoreState();
								resetEnergyPreview();
								ability.query();
							},
							fnOnHoverOutside: showTargetSprite,
							fnOnSelect: function (hex) {
								if (!targetStats) {
									return;
								}

								if (target.sprite) {
									target.sprite.alpha = 0;
								}
								cleanupTweens();
								G.grid.previewCreature(hex.pos, targetStats, target.player);

								if (G.grid._flickerTween && G.grid._flickerTween.isRunning) {
									G.grid._flickerTween.stop(true);
								}

								if (!G.grid.materialize_overlay) {
									return;
								}

								G.grid.materialize_overlay.alpha = 0.5;
							},
							hexes: extendedDestinations,
							hexesDashed: extendedDashed,
							size: target.size,
							id: [cycloper.id, target.id],
							flipped: target.player.flipped,
							hideNonTarget: true,
							callbackAfterQueryHexes: function () {
								if (targetStats) {
									G.grid.previewCreature(
										{ x: target.x, y: target.y },
										targetStats,
										target.player,
										true,
									);
									if (G.grid._flickerTweenSecondary && G.grid._flickerTweenSecondary.isRunning) {
										G.grid._flickerTweenSecondary.stop(true);
									}
									if (G.grid.secondary_overlay) {
										G.grid.secondary_overlay.alpha = 0.5;
									}
								}
							},
							ownCreatureHexShade: true,
						});
					}, 0); // End setTimeout
				};

				G.grid.queryDirection({
					fnOnConfirm: function (...callbackArgs: unknown[]) {
						const path = (callbackArgs[0] as Hex[]) || [];
						const args = (callbackArgs[1] as DirectionArgs) || undefined;
						const direction = args?.direction;
						const targetHex = path.find(
							(hex) =>
								hex.creature instanceof Creature &&
								hex.creature.id !== cycloper.id &&
								!isShieldedDarkPriest(hex.creature, cycloper) &&
								getApertureEnergyCost(hex.creature, useCurrentHealthCost) <= cycloper.energy,
						);

						if (!targetHex || !(targetHex.creature instanceof Creature)) {
							return;
						}
						if (!isApertureTargetInRange(cycloper, targetHex.creature, direction, baseRange, G)) {
							return;
						}

						clearAllTargetingVisuals();
						beginDestinationQuery(targetHex.creature, direction);
					},
					fnOnSelect: function (...callbackArgs: unknown[]) {
						const path = (callbackArgs[0] as Hex[]) || [];
						const args = (callbackArgs[1] as DirectionArgs) || undefined;
						const direction = args?.direction;
						const targetHex = path.find(
							(hex) =>
								hex.creature instanceof Creature &&
								hex.creature.id !== cycloper.id &&
								!isShieldedDarkPriest(hex.creature, cycloper) &&
								getApertureEnergyCost(hex.creature, useCurrentHealthCost) <= cycloper.energy,
						);

						if (!targetHex || !(targetHex.creature instanceof Creature)) {
							resetEnergyPreview();
							return;
						}
						if (!isApertureTargetInRange(cycloper, targetHex.creature, direction, baseRange, G)) {
							resetEnergyPreview();
							return;
						}

						previewApertureCost(targetHex.creature);
					},
					fnOnCancel: function () {
						resetEnergyPreview();
						cycloper.queryMove();
					},
					team: Team.Both,
					id: cycloper.id,
					sourceCreature: cycloper,
					flipped: cycloper.player.flipped,
					x: cycloper.x,
					y: cycloper.y,
					directions: ALL_DIRECTIONS,
					distance: abilityRange,
					minDistance: 1,
					requireCreature: true,
					stopOnCreature: true,
					includeCreature: true,
					ignoreCreatureTest: isRiotShieldUpgraded(cycloper)
						? (candidate: Creature) => isCycloperRelayWall(candidate, cycloper)
						: undefined,
					optTest: (target: Creature) =>
						!isShieldedDarkPriest(target, cycloper) &&
						getApertureEnergyCost(target, useCurrentHealthCost) <= cycloper.energy,
				});
			},

			activate: function (target: Creature, destination) {
				if (!(target instanceof Creature) || target.dead) {
					return;
				}

				const energyCost = Math.max(1, this._energySelfUpgraded || Math.ceil(target.health));
				if (this.creature.energy < energyCost) {
					this.message = G.msg.abilities.notEnough.replace('%stat%', 'energy');
					return;
				}

				const finalizeAbility = () => {
					const extraCost = Math.max(0, energyCost - (this.costs?.energy || 0));
					if (extraCost > 0) {
						this.creature.energy = Math.max(0, this.creature.energy - extraCost);
						if (this.creature.id === G.activeCreature.id) {
							G.UI.energyBar.animSize(this.creature.energy / this.creature.stats.energy);
						}
					}

					G.grid.forEachHex((gridHex: Hex) => {
						gridHex.cleanOverlayVisualState();
						gridHex.cleanDisplayVisualState();
						gridHex.unsetReachable();
					});
					if (typeof G.grid.updateDisplay === 'function') {
						G.grid.updateDisplay();
					}

					this.end();
				};

				if (G.grid._flickerTween && G.grid._flickerTween.isRunning) {
					G.grid._flickerTween.stop(true);
				}
				if (G.grid._flickerTweenSecondary && G.grid._flickerTweenSecondary.isRunning) {
					G.grid._flickerTweenSecondary.stop(true);
				}
				if (G.grid.materialize_overlay) {
					G.grid.materialize_overlay.destroy();
					G.grid.materialize_overlay = null;
				}
				if (G.grid.secondary_overlay) {
					G.grid.secondary_overlay.destroy();
					G.grid.secondary_overlay = null;
				}

				target.healthHide();
				target.grp.alpha = 0;
				target.grp.visible = false;
				target.grp.renderable = false;
				if (target.sprite) {
					target.sprite.alpha = 0;
					target.sprite.visible = false;
					target.sprite.renderable = false;
				}
				if (typeof target.creatureSprite?.setAlpha === 'function') {
					target.creatureSprite.setAlpha(0, 0);
				}

				const originHex = target.hexagons[0];
				const destinationSpriteHex = G.grid.hexes[destination.y][destination.x - target.size + 1];
				const phase1ScaleX = target.sprite?.scale?.x ?? 1;
				const preservedFacing: 1 | -1 = phase1ScaleX < 0 ? -1 : 1;

				createPowerAperturePhase1Effect(this.creature, target, phase1ScaleX, G, () => {
					(G.onStepOut as (...args: unknown[]) => void)(target, originHex);
					target.cleanHex();
					target.x = destination.x;
					target.y = destination.y;
					target.pos = destination.pos;
					target.updateHex();

					target.creatureSprite.setHex(destinationSpriteHex, 0).then(() => {
						target.creatureSprite.setDir(preservedFacing);
						if (target.sprite) {
							target.sprite.alpha = 0;
							target.sprite.visible = false;
							target.sprite.renderable = false;
						}
						target.grp.alpha = 0;
						target.grp.visible = false;
						target.grp.renderable = false;
						if (typeof target.creatureSprite?.setAlpha === 'function') {
							target.creatureSprite.setAlpha(0, 0);
						}

						G.onStepIn(target, destination, {});
						if (target.sprite) {
							target.sprite.alpha = 0;
							target.sprite.visible = false;
							target.sprite.renderable = false;
						}
						target.grp.alpha = 0;
						target.grp.visible = false;
						target.grp.renderable = false;
						if (typeof target.creatureSprite?.setAlpha === 'function') {
							target.creatureSprite.setAlpha(0, 0);
						}
						target.pickupDrop();
						G.grid.orderCreatureZ();
						(G.onCreatureMove as (...args: unknown[]) => void)(target, destination);
						enforcePowerApertureFacing(target, preservedFacing);

						createPowerAperturePhase2Effect(
							this.creature,
							target,
							destination,
							phase1ScaleX,
							G,
							() => {
								target.materializationSickness = true;
								(
									target as unknown as {
										_nextGameTurnActive?: number;
									}
								)._nextGameTurnActive = G.turn + 1;
								target.healthShow();

								if (G.grid.materialize_overlay) {
									G.grid.materialize_overlay.alpha = 0;
								}
								if (G.grid.secondary_overlay) {
									G.grid.secondary_overlay.alpha = 0;
								}
								if (G.grid._flickerTween && G.grid._flickerTween.isRunning) {
									G.grid._flickerTween.stop(true);
								}
								if (G.grid._flickerTweenSecondary && G.grid._flickerTweenSecondary.isRunning) {
									G.grid._flickerTweenSecondary.stop(true);
								}
								G.updateQueueDisplay();

								finalizeAbility();
							},
						);
					});
				});
			},
		},
	];
};
