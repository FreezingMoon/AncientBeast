import type { Creature } from '../creature';
import type Game from '../game';
import type { GameEngine, GroupHandle, SpriteHandle } from '../engine/types';
import { createGameCanvasSurface } from '../game-display/canvas-surface';
import { getFrameSize } from '../game-display/texture';
import { offsetCoordsToPx } from '../utility/const';
import { Easing } from '../utility/easing';

function drawGoo(ctx: CanvasRenderingContext2D): void {
	const circles = [
		{ x: 13, y: 34, radius: 5 },
		{ x: 29, y: 27, radius: 7 },
		{ x: 46, y: 36, radius: 9 },
		{ x: 59, y: 19, radius: 4 },
		{ x: 66, y: 47, radius: 5 },
		{ x: 83, y: 32, radius: 23 },
	];

	for (const { x, y, radius } of circles) {
		const gradient = ctx.createRadialGradient(
			x - radius * 0.38,
			y - radius * 0.42,
			radius * 0.06,
			x,
			y,
			radius,
		);
		gradient.addColorStop(0, '#d7ff9a');
		gradient.addColorStop(0.28, '#8de13b');
		gradient.addColorStop(0.72, '#48a91d');
		gradient.addColorStop(1, '#24651b');

		ctx.beginPath();
		ctx.arc(x, y, radius, 0, Math.PI * 2);
		ctx.fillStyle = gradient;
		ctx.fill();
		ctx.lineWidth = Math.max(1, radius * 0.08);
		ctx.strokeStyle = 'rgba(25, 82, 16, 0.8)';
		ctx.stroke();

		ctx.beginPath();
		ctx.ellipse(
			x - radius * 0.32,
			y - radius * 0.42,
			radius * 0.24,
			radius * 0.12,
			-Math.PI / 5,
			0,
			Math.PI * 2,
		);
		ctx.fillStyle = 'rgba(239, 255, 190, 0.78)';
		ctx.fill();
	}
}

function getMouthPoint(creature: Creature): { x: number; y: number } {
	const sprite = creature.sprite;
	const group = creature.grp;
	const frame = getFrameSize(sprite as unknown as Parameters<typeof getFrameSize>[0]);
	const localX = (47 - sprite.anchor.x * frame.width) * sprite.scale.x;
	const localY = (43 - sprite.anchor.y * frame.height) * sprite.scale.y;
	return {
		x: group.x + sprite.x + localX,
		y: group.y + sprite.y + localY,
	};
}

export function spawnGooSneeze(
	game: Game,
	creature: Creature,
	targetHex: { displayPos?: { x: number; y: number }; x: number; y: number },
	onImpact: () => void,
): void {
	const engine = (game as unknown as { gameEngine?: GameEngine }).gameEngine;
	if (!engine?.add?.sprite || !engine?.tween) {
		onImpact();
		return;
	}

	const surface = createGameCanvasSurface(game, 112, 64);
	drawGoo(surface.ctx);
	surface.commit();

	const start = getMouthPoint(creature);
	const targetCenter = offsetCoordsToPx(targetHex);
	const targetGround = targetHex.displayPos ?? targetCenter;
	const launchHeightAboveGround = start.y - creature.grp.y;
	const target = {
		x: targetGround.x + 45,
		y: targetGround.y + launchHeightAboveGround,
	};
	const aimDeltaX = target.x - start.x;
	const aimDeltaY = target.y - start.y;
	const distance = Math.hypot(aimDeltaX, aimDeltaY);
	const directionX = distance > 0 ? aimDeltaX / distance : 1;
	const directionY = distance > 0 ? aimDeltaY / distance : 0;
	const angle = Math.atan2(aimDeltaY, aimDeltaX);
	const headOffset = 83;
	const group = (game as unknown as { grid?: { creatureGroup?: GroupHandle } }).grid?.creatureGroup;
	const sprite = engine.add.sprite(start.x, start.y, surface.key, undefined, group) as SpriteHandle;
	sprite.anchor.set(0, 0.5);
	sprite.rotation = angle;

	const duration = Math.max(180, Math.min(500, distance * 0.6));
	const finishX = target.x - directionX * headOffset;
	const finishY = target.y - directionY * headOffset;
	let completed = false;
	const complete = () => {
		if (completed) return;
		completed = true;
		try {
			sprite.destroy();
		} finally {
			surface.destroy();
			onImpact();
		}
	};

	const tween = engine
		.tween(sprite)
		.to({ x: finishX, y: finishY, alpha: 0.92 }, duration, Easing.Linear.None);
	tween.onComplete.add(complete);
	tween.start();
}
