import { runTimedAnimation } from '../timing/clock';
import { createGameCanvasSurface, type CanvasSurface } from '../game-display/canvas-surface';
import type { TimedAnimation } from '../timing/clock';
import { Easing } from '../utility/easing';
import { Damage } from '../damage';
import { Creature } from '../creature';
import { Hex } from '../utility/hex';
import { Team, isTeam } from '../utility/team';
import * as arrayUtils from '../utility/arrayUtils';
import { extractTextureFrameInfo, createBitmapDataFromTexture } from '../utility/bitmapUtils';
import { getFrameSize } from '../game-display/texture';
import { HEX_WIDTH_PX } from '../utility/const';
import Game from '../game';
import type { Ability } from '../ability';
import type { UnitData } from '../data/types';
import type { SpriteHandle } from '../engine/types';

const CYCLOPER_UNIT_ID = 15;
const ACRYLIC_WALL_UNIT_ID = 999;
const ACRYLIC_WALL_TYPE = 'O0';
const ALL_DIRECTIONS: [1, 1, 1, 1, 1, 1] = [1, 1, 1, 1, 1, 1];
const APERTURE_NO_ENERGY_MESSAGE = 'Not enough energy for targets in range.';

type DirectionArgs = { direction?: number };
type CreatureDataEntry = UnitData[number];
type CycloperAbilityState = {
	_noAffordableApertureTargetInRange?: boolean;
	/** True while Power Aperture's destination query is open (bot scoring hint). */
	_awaitingApertureDestination?: boolean;
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
	/**
	 * Filled in once the tile is drawn into place; the tile is created with a
	 * placeholder because its position depends on the draw pass it is born in.
	 */
	sprite: SpriteHandle;
	bitmapData: CanvasSurface;
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

function getCycloperEyeEmissionPoint(cycloper: Creature) {
	const fallbackOrigin = getCycloperOrigin(cycloper);
	const fallbackPoint = {
		x: fallbackOrigin?.displayPos?.x ?? cycloper.x * 90,
		y: fallbackOrigin?.displayPos?.y ?? cycloper.y * 78,
	};
	const basePoint = cycloper.legacyProjectileEmissionPoint ?? fallbackPoint;

	// Compute the sprite's local position within its group the same way
	// CreatureSprite._place() does, using the actual frame size.
	const creatureSprite = cycloper.creatureSprite.sprite;
	const creatureSize = getFrameSize(creatureSprite);
	const originX = cycloper.display['offset-x'] ?? 0;
	const originY = cycloper.display['offset-y'] ?? -145;
	const dir = cycloper.player.flipped ? -1 : 1;
	const spriteLocalX =
		(dir === 1 ? originX : HEX_WIDTH_PX * cycloper.size - creatureSize.width - originX) +
		creatureSize.width / 2;
	const spriteLocalY = originY + creatureSize.height;

	// Eye offsets are local sprite offsets from the pivot (origin 0.5, 1 = bottom center).
	// Derived from the old world offsets (50/40, -113) minus the sprite local pos above.
	const eyeLocalX = 5 * (creatureSprite.scaleX > 0 ? 1 : -1);
	const eyeLocalY = -149; // old world -113 minus spriteLocalY (36)

	// The tilt animation tweens the GROUP's angle, not the sprite's angle.
	// Read the group's angle to track the tilt.
	const group = cycloper.creatureSprite.grp;
	const angle = (group?.angle ?? 0) * (Math.PI / 180);
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	const rotX = eyeLocalX * cos - eyeLocalY * sin;
	const rotY = eyeLocalX * sin + eyeLocalY * cos;

	return {
		x: basePoint.x + spriteLocalX + rotX,
		y: basePoint.y + spriteLocalY + rotY,
		offsetX: rotX,
		offsetY: rotY,
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
	beamGraphics: SpriteHandle,
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
		beamGraphics.strokePath();

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
	if (typeof G.gameEngine === 'undefined' || !G.gameEngine.add) {
		if (onComplete) {
			onComplete();
		}
		return;
	}

	if (!G.gameEngine.add.graphics || !G.grid?.creatureGroup) {
		if (onComplete) {
			onComplete();
		}
		return;
	}

	const eyeEmissionPoint = getCycloperEyeEmissionPoint(ability.creature);
	const emissionPointX = eyeEmissionPoint.x;

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

	const impactSprite = G.gameEngine.add.sprite(
		targetPointX,
		targetPointY,
		'effects_optic-burst',
		undefined,
		G.grid.creatureGroup,
	);
	impactSprite.setOrigin(0.5);
	impactSprite.tint = 0x55ff77;
	impactSprite.alpha = 0;
	impactSprite.setScale(1.4, 1.4);

	// Emission point glow sprite (smaller, at eye)
	const emissionGlowSprite = G.gameEngine.add.sprite(
		targetPointX,
		targetPointY,
		'effects_optic-burst',
		undefined,
		G.grid.creatureGroup,
	);
	emissionGlowSprite.setOrigin(0.5);
	emissionGlowSprite.tint = 0x55ff77;
	emissionGlowSprite.alpha = 0;
	emissionGlowSprite.setScale(0.5, 0.5);

	// Add beam graphics to the creature's group (same parent as sprite)
	// We'll manually sync its rotation with the sprite's tilt each frame
	const creatureGroup = ability.creature.creatureSprite.grp;
	const beamGraphics = G.gameEngine.add.graphics(0, 0);
	creatureGroup.add(beamGraphics);

	const travelSteps = baseDist <= 0 ? 1 : baseDist;
	const straightTravelDurationMs = Math.max(60, Math.min(110, travelSteps * 20));
	const sweepDurationMs = Math.max(320, travelSteps * 95);
	const beamDurationMs = straightTravelDurationMs + sweepDurationMs;
	const totalSweepRadians = ((ability.creature.player.flipped ? -1 : 1) * (2.5 * Math.PI)) / 180;

	// Pre-calculate sprite local position and eye offset in group coordinates
	const creatureSprite = ability.creature.creatureSprite.sprite;
	const creatureSize = getFrameSize(creatureSprite);
	const originX = ability.creature.display['offset-x'] ?? 0;
	const originY = ability.creature.display['offset-y'] ?? -145;
	const dir = ability.creature.player.flipped ? -1 : 1;
	const spriteLocalX =
		(dir === 1 ? originX : HEX_WIDTH_PX * ability.creature.size - creatureSize.width - originX) +
		creatureSize.width / 2;
	const spriteLocalY = originY + creatureSize.height;

	// Eye offset from sprite's pivot (origin 0.5, 1 = bottom center)
	const eyeLocalX = 5 * (creatureSprite.scaleX > 0 ? 1 : -1);
	const eyeLocalY = -149;

	runTimedAnimation({
		durationMs: beamDurationMs,
		onFrame: (elapsed, _progress) => {
			const isStraightTravelPhase = elapsed < straightTravelDurationMs;
			const straightProgress = Math.min(1, elapsed / straightTravelDurationMs);
			const sweepProgress = Math.min(
				1,
				Math.max(0, elapsed - straightTravelDurationMs) / sweepDurationMs,
			);
			const sweepRadians = isStraightTravelPhase ? 0 : totalSweepRadians * sweepProgress;

			ability.creature.faceHex(target);

			// Sync beam graphics rotation with sprite's tilt angle
			const spriteAngleRad = (creatureSprite.angle ?? 0) * (Math.PI / 180);
			beamGraphics.angle = creatureSprite.angle ?? 0;

			// Eye position in group coordinates: sprite local pos + rotated eye offset
			const cos = Math.cos(spriteAngleRad);
			const sin = Math.sin(spriteAngleRad);
			const rotEyeX = eyeLocalX * cos - eyeLocalY * sin;
			const rotEyeY = eyeLocalX * sin + eyeLocalY * cos;
			const eyeGroupX = spriteLocalX + rotEyeX;
			const eyeGroupY = spriteLocalY + rotEyeY;

			// Target position in group coordinates
			const targetGroupX = targetPointX - ability.creature.creatureSprite.grp.x;
			const targetGroupY = targetPointY - ability.creature.creatureSprite.grp.y;

			const currentDx = targetGroupX - eyeGroupX;
			const currentDy = targetGroupY - eyeGroupY;
			const currentAngle = Math.atan2(currentDy, currentDx);
			const currentLength = isStraightTravelPhase
				? Math.hypot(currentDx, currentDy) * straightProgress
				: Math.hypot(currentDx, currentDy);

			beamGraphics.clear();
			const beamTip = drawCycloperBeamLayered(
				beamGraphics,
				eyeGroupX,
				eyeGroupY,
				currentAngle,
				currentLength,
				sweepRadians,
			);

			if (isStraightTravelPhase) {
				impactSprite.alpha = 0;
				emissionGlowSprite.alpha = 0;
			} else {
				// Convert beamTip from group coords to world coords (rotate by graphics angle)
				const grp = ability.creature.creatureSprite.grp;
				const spriteAngleRad = (creatureSprite.angle ?? 0) * (Math.PI / 180);
				const cos = Math.cos(spriteAngleRad);
				const sin = Math.sin(spriteAngleRad);
				const rotatedTipX = beamTip.x * cos - beamTip.y * sin;
				const rotatedTipY = beamTip.x * sin + beamTip.y * cos;
				impactSprite.x = rotatedTipX + grp.x;
				impactSprite.y = rotatedTipY + grp.y;
				const glowPulse = 0.5 + 0.5 * Math.sin(sweepProgress * Math.PI * 6);
				impactSprite.alpha = Math.min(0.9, 0.65 + glowPulse * 0.2);
				impactSprite.setScale(1.4 + glowPulse * 0.35, 1.4 + glowPulse * 0.35);

				// Emission glow at eye position (already world coords)
				emissionGlowSprite.x = eyeGroupX + grp.x;
				emissionGlowSprite.y = eyeGroupY + grp.y;
				emissionGlowSprite.alpha = Math.min(0.7, 0.45 + glowPulse * 0.15);
				emissionGlowSprite.setScale(0.5 + glowPulse * 0.15, 0.5 + glowPulse * 0.15);
			}
		},
		onDone: () => {
			beamGraphics.destroy();
			emissionGlowSprite.destroy();

			G.gameEngine
				.tween(impactSprite.scale)
				.to(
					{
						x: 2.5,
						y: 2.5,
					},
					220,
					Easing.Cubic.Out,
				)
				.start();

			G.gameEngine
				.tween(impactSprite)
				.to(
					{
						alpha: 0,
					},
					220,
					Easing.Cubic.Out,
					true,
				)
				.onComplete.add(function () {
					// @ts-expect-error 'this' defaults to type 'any'
					this.destroy();
					if (onComplete) {
						onComplete();
					}
				}, impactSprite);
		},
	});
}

function createPowerApertureTiles(
	G: Game,
	targetSprite: SpriteHandle,
	spriteLeft: number,
	spriteTop: number,
	displayWidth: number,
	displayHeight: number,
	forcedFlipped?: boolean,
) {
	const targetTexture = targetSprite.texture as ShatterTexture;
	const targetIsFlipped =
		typeof forcedFlipped === 'boolean' ? forcedFlipped : targetSprite.scale.x < 0;

	const textureFrameInfo = extractTextureFrameInfo(targetTexture, {
		x: 0,
		y: 0,
		width: 0,
		height: 0,
	});

	if (!textureFrameInfo) {
		return [];
	}

	const { width: targetTexW, height: targetTexH } = textureFrameInfo;
	const scaleX = displayWidth / targetTexW;
	const scaleY = displayHeight / targetTexH;
	const overlapScale = 1;
	const renderScaleX = Math.abs(scaleX) * overlapScale;
	const renderScaleY = Math.abs(scaleY) * overlapScale;
	const tileSize = Math.max(2, Math.floor(Math.min(targetTexW, targetTexH) / 16));
	const tiles: PowerApertureTile[] = [];

	const orientedBitmapData = createBitmapDataFromTexture(G, textureFrameInfo, targetIsFlipped);

	for (let sy = 0; sy < targetTexH; sy += tileSize) {
		for (let sx = 0; sx < targetTexW; sx += tileSize) {
			const sw = Math.min(tileSize, targetTexW - sx);
			const sh = Math.min(tileSize, targetTexH - sy);
			const bitmapData = createGameCanvasSurface(G, sw, sh);
			bitmapData.ctx.clearRect(0, 0, sw, sh);
			bitmapData.ctx.drawImage(orientedBitmapData.canvas, sx, sy, sw, sh, 0, 0, sw, sh);
			bitmapData.commit();
			const tileCenterX = sx + sw / 2;
			const tileCenterY = sy + sh / 2;
			const screenTileX = tileCenterX;
			const destinationX = spriteLeft + screenTileX * scaleX;
			const destinationY = spriteTop + tileCenterY * scaleY;

			tiles.push({
				sprite: null as unknown as SpriteHandle,
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
	if (!G.gameEngine.add.graphics) {
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

	const impactSprite = G.gameEngine.add.sprite(
		targetCapPoint.x,
		targetCapPoint.y,
		'effects_optic-burst',
		undefined,
		G.grid.creatureGroup,
	);
	impactSprite.setOrigin(0.5, 0.5);
	impactSprite.tint = laserColor;
	impactSprite.alpha = 0.8;
	impactSprite.setScale(2, 1.5);

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
		tile.sprite = G.gameEngine.add.sprite(
			tile.sourceX + lineDeltaX * spawnProgress + spawnScatterX,
			tile.sourceY + lineDeltaY * spawnProgress + spawnScatterY,
			tile.bitmapData.key,
			undefined,
			G.grid.creatureGroup,
		);
		tile.sprite.setOrigin(0.5, 0.5);
		tile.sprite.alpha = 0.45 + tile.dissolveSeed * 0.35;
		tile.sprite.tint = laserColor;
		tile.sprite.setScale(tile.renderScaleX, tile.renderScaleY);
		tile.sprite.angle = 0;
	});

	// Emission point glow sprite (smaller, at eye)
	const emissionGlowSprite = G.gameEngine.add.sprite(
		targetCapPoint.x,
		targetCapPoint.y,
		'effects_optic-burst',
		undefined,
		G.grid.creatureGroup,
	);
	emissionGlowSprite.setOrigin(0.5, 0.5);
	emissionGlowSprite.tint = laserColor;
	emissionGlowSprite.alpha = 0;
	emissionGlowSprite.setScale(0.5, 0.5);

	// Add beam graphics to the Cycloper's group (same parent as sprite)
	// We'll manually sync its rotation with the sprite's tilt each frame
	const creatureGroup = cycloper.creatureSprite.grp;
	const beamGraphics = G.gameEngine.add.graphics(0, 0);
	creatureGroup.add(beamGraphics);

	// Pre-calculate sprite local position and eye offset in group coordinates
	const creatureSprite = cycloper.creatureSprite.sprite;
	const creatureSize = getFrameSize(creatureSprite);
	const originX = cycloper.display['offset-x'] ?? 0;
	const originY = cycloper.display['offset-y'] ?? -145;
	const dir = cycloper.player.flipped ? -1 : 1;
	const spriteLocalX =
		(dir === 1 ? originX : HEX_WIDTH_PX * cycloper.size - creatureSize.width - originX) +
		creatureSize.width / 2;
	const spriteLocalY = originY + creatureSize.height;

	// Eye offset from sprite's pivot (origin 0.5, 1 = bottom center)
	const eyeLocalX = 5 * (creatureSprite.scaleX > 0 ? 1 : -1);
	const eyeLocalY = -149;

	runTimedAnimation({
		durationMs: laserDurationMs,
		onFrame: (elapsed, progress) => {
			const suctionProgress = progress;

			// Sync beam graphics rotation with sprite's tilt angle
			const spriteAngleRad = (creatureSprite.angle ?? 0) * (Math.PI / 180);
			beamGraphics.angle = creatureSprite.angle ?? 0;

			// Eye position in group coordinates: sprite local pos + rotated eye offset
			const cos = Math.cos(spriteAngleRad);
			const sin = Math.sin(spriteAngleRad);
			const rotEyeX = eyeLocalX * cos - eyeLocalY * sin;
			const rotEyeY = eyeLocalX * sin + eyeLocalY * cos;
			const eyeGroupX = spriteLocalX + rotEyeX;
			const eyeGroupY = spriteLocalY + rotEyeY;

			// Target position in group coordinates
			const targetGroupX = targetCapPoint.x - cycloper.creatureSprite.grp.x;
			const targetGroupY = targetCapPoint.y - cycloper.creatureSprite.grp.y;

			beamGraphics.clear();
			const beamTip = drawCycloperBeamLayered(
				beamGraphics,
				eyeGroupX,
				eyeGroupY,
				Math.atan2(targetGroupY - eyeGroupY, targetGroupX - eyeGroupX),
				Math.hypot(targetGroupX - eyeGroupX, targetGroupY - eyeGroupY),
				0,
			);

			// Convert beamTip from group coords to world coords (rotate by graphics angle)
			const grp1 = cycloper.creatureSprite.grp;
			const spriteAngleRad1 = (creatureSprite.angle ?? 0) * (Math.PI / 180);
			const cos1 = Math.cos(spriteAngleRad1);
			const sin1 = Math.sin(spriteAngleRad1);
			const rotatedTipX1 = beamTip.x * cos1 - beamTip.y * sin1;
			const rotatedTipY1 = beamTip.x * sin1 + beamTip.y * cos1;
			impactSprite.x = rotatedTipX1 + grp1.x;
			impactSprite.y = rotatedTipY1 + grp1.y;
			impactSprite.alpha = 0.55 + 0.35 * Math.sin(progress * Math.PI * 4) * 0.5;
			impactSprite.setScale(2 + suctionProgress * 0.4, 1.5 + suctionProgress * 0.25);

			// Emission glow at eye position (already world coords)
			emissionGlowSprite.x = eyeGroupX + grp1.x;
			emissionGlowSprite.y = eyeGroupY + grp1.y;
			emissionGlowSprite.alpha = 0.4 + 0.2 * Math.sin(progress * Math.PI * 4);
			emissionGlowSprite.setScale(
				0.5 + 0.1 * Math.sin(progress * Math.PI * 4),
				0.5 + 0.1 * Math.sin(progress * Math.PI * 4),
			);

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
					tile.sourceX +
					lineDeltaX * motionProgress +
					normalX * tile.phase1Scatter * scatterFalloff;
				tile.sprite.y =
					tile.sourceY +
					lineDeltaY * motionProgress +
					normalY * tile.phase1Scatter * scatterFalloff;
				tile.sprite.alpha = Math.max(0, 1 - motionProgress * (0.85 + tile.dissolveSeed * 0.1));
				tile.sprite.setScale(tile.renderScaleX, tile.renderScaleY);
			});
		},
		onDone: () => {
			tiles.forEach((tile) => {
				tile.sprite.destroy();
				tile.bitmapData.destroy();
			});
			beamGraphics.destroy();
			impactSprite.destroy();
			emissionGlowSprite.destroy();
			if (onComplete) {
				onComplete();
			}
		},
	});
}

function createPowerAperturePhase2Effect(
	cycloper: Creature,
	target: Creature,
	destinationHex: Hex,
	originalScaleX: number,
	G: Game,
	onComplete?: () => void,
) {
	if (!G.gameEngine.add.graphics) {
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

	const impactSprite = G.gameEngine.add.sprite(
		destinationCapPoint.x,
		destinationCapPoint.y,
		'effects_optic-burst',
		undefined,
		G.grid.creatureGroup,
	);
	impactSprite.setOrigin(0.5, 0.5);
	impactSprite.tint = laserColor;
	impactSprite.alpha = 0.8;
	impactSprite.setScale(2.5, 1.8);

	if (!tiles.length) {
		impactSprite.destroy();
		if (onComplete) {
			onComplete();
		}
		return;
	}

	tiles.forEach((tile) => {
		tile.sprite = G.gameEngine.add.sprite(
			destinationCapPoint.x,
			destinationCapPoint.y,
			tile.bitmapData.key,
			undefined,
			G.grid.creatureGroup,
		);
		tile.sprite.setOrigin(0.5, 0.5);
		tile.sprite.alpha = 0;
		tile.sprite.tint = laserColor;
		tile.sprite.setScale(tile.renderScaleX, tile.renderScaleY);
		tile.sprite.angle = 0;
	});

	// Emission point glow sprite (smaller, at eye)
	const emissionGlowSprite = G.gameEngine.add.sprite(
		destinationCapPoint.x,
		destinationCapPoint.y,
		'effects_optic-burst',
		undefined,
		G.grid.creatureGroup,
	);
	emissionGlowSprite.setOrigin(0.5, 0.5);
	emissionGlowSprite.tint = laserColor;
	emissionGlowSprite.alpha = 0;
	emissionGlowSprite.setScale(0.5, 0.5);

	// Add beam graphics to the Cycloper's group (same parent as sprite)
	// We'll manually sync its rotation with the sprite's tilt each frame
	const creatureGroup = cycloper.creatureSprite.grp;
	const beamGraphics = G.gameEngine.add.graphics(0, 0);
	creatureGroup.add(beamGraphics);

	// Pre-calculate sprite local position and eye offset in group coordinates
	const creatureSprite = cycloper.creatureSprite.sprite;
	const creatureSize = getFrameSize(creatureSprite);
	const originX = cycloper.display['offset-x'] ?? 0;
	const originY = cycloper.display['offset-y'] ?? -145;
	const dir = cycloper.player.flipped ? -1 : 1;
	const spriteLocalX =
		(dir === 1 ? originX : HEX_WIDTH_PX * cycloper.size - creatureSize.width - originX) +
		creatureSize.width / 2;
	const spriteLocalY = originY + creatureSize.height;

	// Eye offset from sprite's pivot (origin 0.5, 1 = bottom center)
	const eyeLocalX = 5 * (creatureSprite.scaleX > 0 ? 1 : -1);
	const eyeLocalY = -149;

	runTimedAnimation({
		durationMs: laserDurationMs,
		onFrame: (elapsed, progress) => {
			// Sync beam graphics rotation with sprite's tilt angle
			const spriteAngleRad = (creatureSprite.angle ?? 0) * (Math.PI / 180);
			beamGraphics.angle = creatureSprite.angle ?? 0;

			// Eye position in group coordinates: sprite local pos + rotated eye offset
			const cos = Math.cos(spriteAngleRad);
			const sin = Math.sin(spriteAngleRad);
			const rotEyeX = eyeLocalX * cos - eyeLocalY * sin;
			const rotEyeY = eyeLocalX * sin + eyeLocalY * cos;
			const eyeGroupX = spriteLocalX + rotEyeX;
			const eyeGroupY = spriteLocalY + rotEyeY;

			// Target position in group coordinates
			const targetGroupX = destinationCapPoint.x - cycloper.creatureSprite.grp.x;
			const targetGroupY = destinationCapPoint.y - cycloper.creatureSprite.grp.y;

			beamGraphics.clear();
			const beamTip = drawCycloperBeamLayered(
				beamGraphics,
				eyeGroupX,
				eyeGroupY,
				Math.atan2(targetGroupY - eyeGroupY, targetGroupX - eyeGroupX),
				Math.hypot(targetGroupX - eyeGroupX, targetGroupY - eyeGroupY),
				0,
			);

			// Emission glow at eye position
			emissionGlowSprite.x = eyeGroupX + cycloper.creatureSprite.grp.x;
			emissionGlowSprite.y = eyeGroupY + cycloper.creatureSprite.grp.y;
			emissionGlowSprite.alpha = 0.4 + 0.2 * Math.sin(progress * Math.PI * 4);
			emissionGlowSprite.setScale(
				0.5 + 0.1 * Math.sin(progress * Math.PI * 4),
				0.5 + 0.1 * Math.sin(progress * Math.PI * 4),
			);
			const reassembleProgress = Math.min(1, elapsed / reformDurationMs);
			const pulseIntensity = 0.5 + 0.5 * Math.sin(progress * Math.PI * 4);
			// Fade creature in only in the last 400ms so tiles finish assembling first.
			const revealStartMs = laserDurationMs - 400;
			const revealProgress = Math.min(1, Math.max(0, elapsed - revealStartMs) / 400);
			applyTargetReformState(revealProgress, revealProgress);
			// Convert beamTip from group coords to world coords (rotate by graphics angle)
			const grp2 = cycloper.creatureSprite.grp;
			const spriteAngleRad2 = (creatureSprite.angle ?? 0) * (Math.PI / 180);
			const cos2 = Math.cos(spriteAngleRad2);
			const sin2 = Math.sin(spriteAngleRad2);
			const rotatedTipX2 = beamTip.x * cos2 - beamTip.y * sin2;
			const rotatedTipY2 = beamTip.x * sin2 + beamTip.y * cos2;
			impactSprite.x = rotatedTipX2 + grp2.x;
			impactSprite.y = rotatedTipY2 + grp2.y;
			impactSprite.alpha = 0.6 + pulseIntensity * 0.3;
			impactSprite.setScale(2.5 + pulseIntensity * 0.6, 1.8 + pulseIntensity * 0.4);

			tiles.forEach((tile) => {
				const phaseSeed = Math.abs(Math.sin(tile.dissolveSeed * 97.13));
				const staggeredProgress = getStaggeredProgress(reassembleProgress, phaseSeed, 0.92);
				if (staggeredProgress <= 0) {
					tile.sprite.x = destinationCapPoint.x;
					tile.sprite.y = destinationCapPoint.y;
					tile.sprite.alpha = 0;
					tile.sprite.setScale(tile.renderScaleX, tile.renderScaleY);
					return;
				}

				const adjustedProgress = staggeredProgress;
				tile.sprite.x =
					destinationCapPoint.x + (tile.destinationX - destinationCapPoint.x) * adjustedProgress;
				tile.sprite.y =
					destinationCapPoint.y + (tile.destinationY - destinationCapPoint.y) * adjustedProgress;
				tile.sprite.alpha = Math.min(1, 0.82 + adjustedProgress * 0.18);
				tile.sprite.setScale(tile.renderScaleX, tile.renderScaleY);
			});
		},
		onDone: () => {
			beamGraphics.destroy();
			impactSprite.destroy();
			emissionGlowSprite.destroy();

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
		},
	});
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
	if (!origin) {
		return 0;
	}
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
	if (!origin) {
		return Number.POSITIVE_INFINITY;
	}
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
	if (!origin) {
		return [];
	}
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

	if (!G.gameEngine.add.graphics || typeof wallSprite.setCrop !== 'function') {
		if (onComplete) {
			onComplete();
		}
		return;
	}

	// Phaser 4 masks only work under the Canvas renderer; the WebGL renderer
	// ignores the `mask` property entirely.  Use setCrop (which works in both
	// renderers) instead.  Also stop the spawn fade-in tween that summon()
	// starts on the group alpha so the crop is the sole reveal controller.
	G.gameEngine.removeTweensFrom(wall.grp);
	wall.creatureSprite.setAlpha(1, 0);
	// Crop to zero-height at the texture bottom; the loop grows it upward.
	wallSprite.setCrop(0, wallHeight, wallWidth, 0);

	// Add beam graphics to the Cycloper's group (same parent as sprite)
	// We'll manually sync its rotation with the sprite's tilt each frame
	const creatureGroup = cycloper.creatureSprite.grp;
	const beamGraphics = G.gameEngine.add.graphics(0, 0);
	creatureGroup.add(beamGraphics);

	// Pre-calculate sprite local position and eye offset in group coordinates
	const creatureSprite = cycloper.creatureSprite.sprite;
	const creatureSize = getFrameSize(creatureSprite);
	const originX = cycloper.display['offset-x'] ?? 0;
	const originY = cycloper.display['offset-y'] ?? -145;
	const dir = cycloper.player.flipped ? -1 : 1;
	const spriteLocalX =
		(dir === 1 ? originX : HEX_WIDTH_PX * cycloper.size - creatureSize.width - originX) +
		creatureSize.width / 2;
	const spriteLocalY = originY + creatureSize.height;

	// Eye offset from sprite's pivot (origin 0.5, 1 = bottom center)
	const eyeLocalX = 5 * (creatureSprite.scaleX > 0 ? 1 : -1);
	const eyeLocalY = -149;

	// Emission point glow sprite (smaller, at eye) - in group coords
	const emissionGlowSprite = G.gameEngine.add.sprite(
		0,
		0,
		'effects_optic-burst',
		undefined,
		creatureGroup,
	);
	emissionGlowSprite.setOrigin(0.5, 0.5);
	emissionGlowSprite.tint = laserColor;
	emissionGlowSprite.alpha = 0;
	emissionGlowSprite.setScale(0.5, 0.5);

	// Create horizontal green flash (in group coords)
	const flashSprite = G.gameEngine.add.sprite(
		wallCenterX - cycloper.creatureSprite.grp.x,
		wallBottomY - cycloper.creatureSprite.grp.y,
		'effects_optic-burst',
		undefined,
		creatureGroup,
	);
	flashSprite.setOrigin(0.5, 0.5);
	flashSprite.tint = laserColor;
	flashSprite.alpha = 0.96;
	flashSprite.setScale(4.5, 0.7);

	let settled = false;
	let reveal: TimedAnimation | null = null;

	/**
	 * Ends the print. The crop is the only thing standing between the wall and
	 * being invisible, so it is cleared first and unconditionally: if anything
	 * below throws — or the wall is retired mid-print, which happens when the
	 * Cycloper prints again before the reveal finished — the reveal must not be
	 * left half-applied.
	 *
	 * Cancelling the loop here is what the old `settled` early-return in the
	 * frame callback did. Cancelling rather than merely ignoring later frames
	 * matters now: the loop is a repeating scene timer, so a frame that kept
	 * running would keep redrawing the beam over a destroyed wall.
	 */
	const finish = () => {
		if (settled) {
			return;
		}
		settled = true;
		reveal?.cancel();
		reveal = null;
		try {
			wallSprite.setCrop();
		} catch {
			// The sprite was torn down along with the wall mid-print. There is
			// nothing left to reveal, and nothing to report either.
		}
		beamGraphics.destroy();
		flashSprite.destroy();
		emissionGlowSprite.destroy();
		if (onComplete) {
			onComplete();
		}
	};

	/**
	 * One frame of the reveal.
	 *
	 * Failures are reported and the effect settled here rather than at the call
	 * site alone, because the original guard only covered the very first frame: a
	 * throw on a later frame killed the `setTimeout` chain for free, while a
	 * repeating scene timer would otherwise carry on.
	 *
	 * Rethrown after settling, so the clock's own stop-and-propagate path also
	 * runs. `finish()` cannot cancel frame 0 — there is no handle yet — which is
	 * exactly the case a swallowed error would leave running against a destroyed
	 * wall.
	 */
	const drawFrame = (elapsed: number, progress: number) => {
		try {
			// Reveal wall from bottom to top by growing the crop rectangle upward.
			const revealHeight = wallHeight * progress;
			const currentFlashY = wallBottomY - revealHeight;
			if (revealHeight > 0) {
				wallSprite.setCrop(0, wallHeight - revealHeight, wallWidth, revealHeight);
			}

			// Move flash upward along the wall (in group coords)
			const flashGroupY = currentFlashY - cycloper.creatureSprite.grp.y;
			flashSprite.y = flashGroupY;

			// Keep Cycloper facing the print direction for the full effect duration.
			cycloper.faceHex(wall);

			// Sync beam graphics rotation with sprite's tilt angle
			const spriteAngleRad = (creatureSprite.angle ?? 0) * (Math.PI / 180);
			beamGraphics.angle = creatureSprite.angle ?? 0;

			// Eye position in group coordinates: sprite local pos + rotated eye offset
			const cos = Math.cos(spriteAngleRad);
			const sin = Math.sin(spriteAngleRad);
			const rotEyeX = eyeLocalX * cos - eyeLocalY * sin;
			const rotEyeY = eyeLocalX * sin + eyeLocalY * cos;
			const eyeGroupX = spriteLocalX + rotEyeX;
			const eyeGroupY = spriteLocalY + rotEyeY;

			// Flash position in group coordinates
			const flashGroupX = wallCenterX - cycloper.creatureSprite.grp.x;

			// Emission glow at eye position (in group coords)
			emissionGlowSprite.x = eyeGroupX;
			emissionGlowSprite.y = eyeGroupY;
			emissionGlowSprite.alpha = 0.4 + 0.2 * Math.sin(progress * Math.PI * 4);
			emissionGlowSprite.setScale(
				0.5 + 0.1 * Math.sin(progress * Math.PI * 4),
				0.5 + 0.1 * Math.sin(progress * Math.PI * 4),
			);

			// Draw laser beam from eye to flash (both in group coords)
			beamGraphics.clear();
			beamGraphics.lineStyle(5, laserColor, 0.95);
			beamGraphics.moveTo(eyeGroupX, eyeGroupY);
			beamGraphics.lineTo(flashGroupX, flashGroupY);
			beamGraphics.strokePath();
		} catch (error) {
			console.error('Acrylic wall print effect failed', error);
			finish();
			throw error;
		}
	};

	reveal = runTimedAnimation({
		durationMs: laserDuration,
		onFrame: drawFrame,
		onDone: finish,
	});
}

function ensureAcrylicWallData(G: Game) {
	const creatureData = G.creatureData as CreatureDataEntry[];
	const existing = creatureData.find((unit) => unit.type === ACRYLIC_WALL_TYPE);
	if (existing) {
		return existing;
	}

	const wallData = {
		id: ACRYLIC_WALL_UNIT_ID,
		name: 'object_crystal-wall',
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
								if (completedPulseCount === pulseCount) {
									if (appliedHealAmount > 0 && typeof target.hint === 'function') {
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
					const activeCycloper = this.creature;
					this.end(false, true);
					createOpticBurstLaserEffect(this as Ability, target, path, G, () => {
						target.takeDamage(damage);
						activeCycloper.queryMove();
					});
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
						materialize_overlay?: { alpha: number } | null;
					};
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
					G.updateQueueDisplay();
					this.end();
					return;
				}

				// The previously printed wall is deliberately left standing. Riot
				// Shield beams relay through its own walls (see
				// `getRiotShieldPlacementRange`, which widens the range by the number
				// of relay walls already on the board), so a Cycloper is meant to
				// accumulate them. Destroying the last one here took that wall's
				// cardboard off the board while the wall itself stayed on it as a
				// corpse with no sprite — attackable and shatterable at its original
				// hex, but invisible, and re-appearing displaced once something else
				// touched the orphaned sprite.
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
					materialize_overlay?: { alpha: number } | null;
					secondary_overlay?: { alpha: number } | null;
				};
				const previewOverlay = gridAny.materialize_overlay;
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
				this.creature.faceHex(hex);

				// Create 3D print laser effect from Cycloper's eye.
				// end(false,true) below increments _deferredQueryMovePending and
				// keeps input frozen for all players until queryMove() fires.
				createAcrylicWall3DPrintEffect(this.creature, wall, G, () => {
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
				// Re-entering the target query means any destination query was cancelled.
				(this as CycloperAbilityState)._awaitingApertureDestination = false;
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

					const restoreState = () => {
						if (target.sprite) {
							target.sprite.alpha = 1;
							target.sprite.visible = true;
							target.sprite.renderable = true;
						}
						target.grp.alpha = 1;
						target.grp.visible = true;
						target.grp.renderable = true;
						if (typeof target.creatureSprite?.setAlpha === 'function') {
							target.creatureSprite.setAlpha(1, 1);
						}
						if (G.grid.materialize_overlay) {
							G.grid.materialize_overlay.alpha = 0;
						}
						if (G.grid.secondary_overlay) {
							G.grid.secondary_overlay.alpha = 0;
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

					// Bots flag the destination query so their strategy scores drop hexes
					// instead of targets.
					(ability as CycloperAbilityState)._awaitingApertureDestination = true;

					// Defer queryHexes to next frame to ensure queryDirection/queryChoice handlers are fully removed
					const openDestinationQuery = () => {
						G.grid.queryHexes({
							fnOnConfirm: function (hex) {
								const preview = G.grid.materialize_overlay;
								const oldPreview = G.grid.secondary_overlay;

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
								G.grid.previewCreature(hex.pos, targetStats, target.player);
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
								}
							},
							ownCreatureHexShade: true,
						});
					};

					// A bot confirms the direction query from inside its own resolver and
					// releases the pending action the moment that resolver returns, so a
					// destination query opened on the next tick has nothing left to resolve
					// it: input stays frozen and the bot burns its remaining decisions
					// without ever firing the ultimate. Open it inline so the bot chains onto
					// it, and keep the deferral for players, where it exists to let the
					// queryDirection handlers go away before the new ones are installed.
					if (G.botController?.shouldAutoResolveQuery?.()) {
						openDestinationQuery();
					} else {
						setTimeout(openDestinationQuery, 0); // End setTimeout
					}
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

				(this as CycloperAbilityState)._awaitingApertureDestination = false;

				const restoreTargetVisibility = () => {
					target.grp.alpha = 1;
					target.grp.visible = true;
					target.grp.renderable = true;
					if (target.sprite) {
						target.sprite.alpha = 1;
						target.sprite.visible = true;
						target.sprite.renderable = true;
					}
					if (typeof target.creatureSprite?.setAlpha === 'function') {
						target.creatureSprite.setAlpha(1, 1);
					}
				};

				// If target is already invisible (e.g., from a previous failed attempt), restore it first
				// before proceeding, to avoid accumulating hidden state.
				const targetWasHidden = target.grp.alpha === 0 || !target.grp.visible;
				if (targetWasHidden) {
					restoreTargetVisibility();
				}

				const energyCost = Math.max(1, this._energySelfUpgraded || Math.ceil(target.health));
				if (this.creature.energy < energyCost) {
					this.message = G.msg.abilities.notEnough.replace('%stat%', 'energy');
					restoreTargetVisibility();
					return;
				}

				/**
				 * The part of the cost that scales with the victim. The flat part
				 * (`costs.energy`) is charged by `end()` through `applyCost()`.
				 */
				const deductVariableEnergyCost = () => {
					const extraCost = Math.max(0, energyCost - (this.costs?.energy || 0));
					if (extraCost > 0) {
						this.creature.energy = Math.max(0, this.creature.energy - extraCost);
						if (this.creature.id === G.activeCreature?.id) {
							G.UI.energyBar.animSize(this.creature.energy / this.creature.stats.energy);
						}
					}
				};

				const finalizeAbility = () => {
					G.grid.forEachHex((gridHex: Hex) => {
						gridHex.cleanOverlayVisualState();
						gridHex.cleanDisplayVisualState();
						gridHex.unsetReachable();
					});
					if (typeof G.grid.updateDisplay === 'function') {
						G.grid.updateDisplay();
					}

					// The turn was already ended when the cast was committed, so
					// this only releases the freeze it took.
					this.creature.queryMove();
				};

				// Commit to the cast before anything is hidden or moved: pay the
				// energy, mark the ability spent and freeze input for the whole
				// ~2.4 s teleport, the same deferred ending Riot Shield uses.
				//
				// Nothing used to freeze here, because `end()` only ran once the
				// animation finished — so the Cycloper stayed actionable, and
				// unspent, for its own 2.4 s. A bot, which re-decides on a timer and
				// gates only on `game.freezedInput`, walked straight back into this
				// query and cast the ultimate several times per turn, dragging the
				// same victim over and over until its decisions ran out.
				deductVariableEnergyCost();
				this.end(false, true);

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
