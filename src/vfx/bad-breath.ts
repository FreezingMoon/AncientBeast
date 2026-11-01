import type { Creature } from '../creature';
import type Game from '../game';
import { Damage } from '../damage';
import { Easing } from '../utility/easing';
import { offsetCoordsToPx } from '../utility/const';
import { createGameCanvasSurface } from '../game-display/canvas-surface';
import { getFrameSize } from '../game-display/texture';

type SpriteHandle = {
	active?: boolean;
	alpha: number;
	x: number;
	y: number;
	destroy: () => void;
	setOrigin?: (x: number, y: number) => void;
	setScale?: (x: number, y: number) => void;
	tint?: number;
	setTint?: (color: number) => void;
};

type CloudRecord = {
	hex: { x: number; y: number };
	sprites: SpriteHandle[];
	owner: Creature;
	upgraded: boolean;
	createdTurn: number;
	turnLifetime: number;
	initialCount: number;
	damage: number;
};

function getEngine(game: Game): any {
	return (game as any).gameEngine;
}

function getMouthPoint(creature: Creature): { x: number; y: number } {
	const sprite = (creature as any).sprite;
	const group = (creature as any).grp;
	const frame = getFrameSize(sprite);
	const texX = 47;
	const texY = 43;
	const localX = (texX - (sprite?.originX ?? 0.5) * (frame?.width ?? 0)) * (sprite?.scaleX ?? 1);
	const localY = (texY - (sprite?.originY ?? 0.5) * (frame?.height ?? 0)) * (sprite?.scaleY ?? 1);
	return {
		x: (group?.x ?? 0) + (sprite?.x ?? 0) + localX,
		y: (group?.y ?? 0) + (sprite?.y ?? 0) + localY,
	};
}

function fadeDestroy(sprite: SpriteHandle, engine: any, delay = 0): void {
	try {
		const tween = engine?.tween?.(sprite)?.to?.({ alpha: 0 }, 500, Easing.Linear.None, true, delay);
		tween?.onComplete?.add?.(() => {
			try {
				sprite.destroy();
			} catch {
				// ignore
			}
		});
	} catch {
		try {
			sprite.destroy();
		} catch {
			// ignore
		}
	}
}

function moveCloudThenFade(
	cloud: CloudRecord,
	engine: ReturnType<typeof getEngine>,
	getDestination: (sprite: SpriteHandle) => { x: number; y: number },
): void {
	for (const sprite of cloud.sprites) {
		const destination = getDestination(sprite);
		try {
			const tween = engine
				?.tween?.(sprite)
				?.to?.({ ...destination, alpha: 0 }, 300, Easing.Linear.None);
			if (tween?.onComplete?.add && tween?.start) {
				tween.onComplete.add(() => sprite.destroy());
				tween.start();
			} else {
				sprite.x = destination.x;
				sprite.y = destination.y;
				fadeDestroy(sprite, engine);
			}
		} catch {
			sprite.x = destination.x;
			sprite.y = destination.y;
			fadeDestroy(sprite, engine);
		}
	}
}

export function pushCloudAway(
	game: Game,
	cloud: CloudRecord,
	clouds: CloudRecord[],
	visited: Set<CloudRecord> = new Set(),
	from?: { x: number; y: number },
): boolean {
	const engine = getEngine(game);
	const source = from ?? cloud.owner;
	if (visited.has(cloud)) return false;
	visited.add(cloud);

	const cx = cloud.hex.x;
	const cy = cloud.hex.y;
	const toAxial = (x: number, y: number) => ({
		q: x + Math.floor(y / 2),
		r: y,
	});
	const hexDistance = (x: number, y: number) => {
		const point = toAxial(x, y);
		const origin = toAxial(source.x, source.y);
		const dq = point.q - origin.q;
		const dr = point.r - origin.r;
		return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq - dr));
	};
	const distance = hexDistance(cx, cy);
	if (distance === 0) return false;

	const offsets =
		cy % 2 === 0
			? [
					{ dx: 1, dy: 0 },
					{ dx: 1, dy: 1 },
					{ dx: 0, dy: 1 },
					{ dx: -1, dy: 0 },
					{ dx: 0, dy: -1 },
					{ dx: 1, dy: -1 },
			  ]
			: [
					{ dx: 1, dy: 0 },
					{ dx: 0, dy: 1 },
					{ dx: -1, dy: 1 },
					{ dx: -1, dy: 0 },
					{ dx: -1, dy: -1 },
					{ dx: 0, dy: -1 },
			  ];

	const position = (x: number, y: number) => ({
		x: x + Math.floor(y / 2) - y / 2,
		y: (y * Math.sqrt(3)) / 2,
	});
	const sourcePosition = position(source.x, source.y);
	const cloudPosition = position(cx, cy);
	const away = {
		x: cloudPosition.x - sourcePosition.x,
		y: cloudPosition.y - sourcePosition.y,
	};
	let bestOffset: (typeof offsets)[number] | undefined;
	let bestScore = -Infinity;
	for (const off of offsets) {
		const x = cx + off.dx;
		const y = cy + off.dy;
		if (hexDistance(x, y) <= distance) continue;

		const current = position(cx, cy);
		const next = position(x, y);
		const score = away.x * (next.x - current.x) + away.y * (next.y - current.y);
		if (score > bestScore) {
			bestScore = score;
			bestOffset = off;
		}
	}
	if (!bestOffset || bestScore <= 0) return false;

	const candOff = { x: cx + bestOffset.dx, y: cy + bestOffset.dy };
	const grid = (game as any)?.grid;
	const hexObj =
		typeof grid?.hexAt === 'function'
			? grid.hexAt(candOff.x, candOff.y)
			: (game as any)?.hexAt?.(candOff.x, candOff.y);
	if (!hexObj) {
		const cloudIndex = clouds.indexOf(cloud);
		if (cloudIndex >= 0) clouds.splice(cloudIndex, 1);
		const currentPosition = offsetCoordsToPx({ x: cx, y: cy });
		const outsidePosition = offsetCoordsToPx(candOff);
		const delta = {
			x: outsidePosition.x - currentPosition.x,
			y: outsidePosition.y - currentPosition.y,
		};
		moveCloudThenFade(cloud, engine, (sprite) => ({
			x: sprite.x + delta.x,
			y: sprite.y + delta.y,
		}));
		return true;
	}

	const occupant = clouds.find(
		(c) => c !== cloud && c.hex.x === candOff.x && c.hex.y === candOff.y,
	);
	if (occupant) {
		if (!pushCloudAway(game, occupant, clouds, visited, source)) return false;
	}

	const bumpedCreature = hexObj?.creature;
	if (
		bumpedCreature &&
		bumpedCreature.name !== 'Swampler' &&
		!bumpedCreature.dead &&
		typeof bumpedCreature.takeDamage === 'function'
	) {
		bumpedCreature.takeDamage(new Damage(cloud.owner, { poison: cloud.damage }, 1, [], game));
		const cloudIndex = clouds.indexOf(cloud);
		if (cloudIndex >= 0) clouds.splice(cloudIndex, 1);
		const baseX = hexObj?.displayPos?.x ?? 0;
		const baseY = (hexObj?.displayPos?.y ?? 0) - 30;
		moveCloudThenFade(cloud, engine, () => ({
			x: baseX + 45 + (Math.random() - 0.5) * 60,
			y: baseY + (Math.random() - 0.5) * 40,
		}));
		return true;
	}

	cloud.hex = { x: candOff.x, y: candOff.y };
	const baseX = hexObj?.displayPos?.x ?? 0;
	const baseY = (hexObj?.displayPos?.y ?? 0) - 30;
	for (const sp of cloud.sprites) {
		const dx = baseX + 45 + (Math.random() - 0.5) * 60;
		const dy = baseY + (Math.random() - 0.5) * 40;
		try {
			engine?.tween?.(sp)?.to?.({ x: dx, y: dy }, 300, Easing.Linear.None)?.start?.();
		} catch {
			sp.x = dx;
			sp.y = dy;
		}
	}
	return true;
}

export function spawnBadBreathCloud(
	game: Game,
	creature: Creature,
	targets: any[],
	upgraded = false,
	onAnimationComplete?: () => void,
): void {
	const engine = getEngine(game);
	const mouth = getMouthPoint(creature);
	const originX = mouth.x;
	const originY = mouth.y;

	let surface: any = null;
	try {
		surface = createGameCanvasSurface(game as any, 32, 32);
		const ctx = surface.ctx;
		const center = 16;
		const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
		grad.addColorStop(0, 'rgba(90, 200, 90, 0.95)');
		grad.addColorStop(0.45, 'rgba(90, 200, 90, 0.5)');
		grad.addColorStop(1, 'rgba(90, 200, 90, 0)');
		ctx.fillStyle = grad;
		ctx.beginPath();
		ctx.arc(center, center, center, 0, Math.PI * 2);
		ctx.fill();
		surface.commit();
	} catch {
		surface = null;
	}

	const group = (game as any)?.grid?.creatureGroup;
	const count = upgraded ? 32 : 20;
	if (!(game as any).badBreathClouds) {
		(game as any).badBreathClouds = [];
	}
	const clouds: CloudRecord[] = (game as any).badBreathClouds;
	const lifetime = upgraded ? 6 : 3;
	let pendingAnimations = 0;
	let isSpawning = true;
	let animationComplete = false;
	const completeAnimation = () => {
		pendingAnimations--;
		if (!isSpawning && pendingAnimations === 0 && !animationComplete) {
			animationComplete = true;
			onAnimationComplete?.();
		}
	};
	const completeIfReady = () => {
		if (!isSpawning && pendingAnimations === 0 && !animationComplete) {
			animationComplete = true;
			onAnimationComplete?.();
		}
	};

	for (const target of targets ?? []) {
		const hex =
			target?.hex ??
			target?.hexagons?.[0] ??
			(target?.x != null && target?.y != null
				? { x: target.x, y: target.y, displayPos: { x: 0, y: 0 } }
				: null);
		if (!hex) continue;

		const existing = clouds.find((c) => c.hex.x === hex.x && c.hex.y === hex.y);
		if (existing) {
			const pushed = pushCloudAway(game, existing, clouds, new Set(), creature);
			if (!pushed) {
				if (upgraded || !existing.upgraded) {
					const idx = clouds.indexOf(existing);
					if (idx >= 0) clouds.splice(idx, 1);
					for (const sp of existing.sprites) {
						try {
							sp.destroy();
						} catch {
							// ignore
						}
					}
				} else {
					// keep upgraded existing
					continue;
				}
			}
		}

		const baseX = hex?.displayPos?.x ?? 0;
		const baseY = (hex?.displayPos?.y ?? 0) - 30;
		const cloudSprites: SpriteHandle[] = [];

		for (let i = 0; i < count; i++) {
			let sprite: SpriteHandle | null = null;
			try {
				sprite = engine?.add?.sprite?.(
					originX,
					originY,
					surface?.key,
					undefined,
					group,
				) as SpriteHandle;
			} catch {
				sprite = null;
			}
			if (!sprite) continue;

			try {
				sprite.setOrigin?.(0.5, 0.5);
			} catch {
				// ignore
			}
			const scale = 0.5 + Math.random() * 0.9;
			try {
				sprite.setScale?.(scale, scale);
			} catch {
				// ignore
			}
			sprite.alpha = 0;

			const destX = baseX + 45 + (Math.random() - 0.5) * 60;
			const destY = baseY + (Math.random() - 0.5) * 40;

			let finishTween = () => undefined;
			try {
				const tween = engine
					?.tween?.(sprite)
					?.to?.(
						{ x: destX, y: destY, alpha: upgraded ? 0.65 : 0.55 },
						300 + Math.random() * 300,
						Easing.Linear.None,
					);
				if (tween?.onComplete?.add && tween?.start) {
					pendingAnimations++;
					let completed = false;
					finishTween = () => {
						if (completed) return;
						completed = true;
						completeAnimation();
					};
					tween.onComplete.add(finishTween);
					tween.start();
				} else {
					sprite.x = destX;
					sprite.y = destY;
					sprite.alpha = upgraded ? 0.65 : 0.55;
				}
			} catch {
				finishTween();
				sprite.x = destX;
				sprite.y = destY;
				sprite.alpha = upgraded ? 0.65 : 0.55;
			}

			cloudSprites.push(sprite);
		}

		if (cloudSprites.length) {
			clouds.push({
				hex: { x: hex.x, y: hex.y },
				sprites: cloudSprites,
				owner: creature,
				upgraded,
				createdTurn: (game as any).turn ?? 0,
				turnLifetime: lifetime,
				initialCount: cloudSprites.length,
				damage: 10,
			});
		}
	}

	isSpawning = false;
	completeIfReady();
}

export function disperseBadBreathCloudsAt(
	game: Game,
	x: number,
	y: number,
	creature?: Creature,
): void {
	if (!creature || creature.name === 'Swampler' || creature.dead) return;
	const clouds: CloudRecord[] = (game as any).badBreathClouds ?? [];
	if (!clouds.length) return;
	const engine = getEngine(game);
	const remaining: CloudRecord[] = [];
	for (const cloud of clouds) {
		if (cloud.hex.x === x && cloud.hex.y === y) {
			if (creature && !creature.dead) {
				try {
					creature.takeDamage(new Damage(cloud.owner, { poison: cloud.damage }, 1, [], game));
				} catch {
					// ignore
				}
			}
			for (const sprite of cloud.sprites) {
				if (sprite?.active !== false) {
					fadeDestroy(sprite, engine);
				}
			}
		} else {
			remaining.push(cloud);
		}
	}
	(game as any).badBreathClouds = remaining;
}

export function disperseBadBreathCloudsAlongPath(
	game: Game,
	path: any[] | undefined,
): CloudRecord[] {
	const clouds: CloudRecord[] = (game as any).badBreathClouds ?? [];
	if (!path?.length || !clouds.length) return [];
	const set = new Set(path.map((h) => `${h?.x},${h?.y}`));
	const engine = getEngine(game);
	const remaining: CloudRecord[] = [];
	const dispersed: CloudRecord[] = [];
	for (const cloud of clouds) {
		if (set.has(`${cloud.hex.x},${cloud.hex.y}`)) {
			dispersed.push(cloud);
			for (const sprite of cloud.sprites) {
				if (sprite?.active !== false) {
					fadeDestroy(sprite, engine);
				}
			}
		} else {
			remaining.push(cloud);
		}
	}
	(game as any).badBreathClouds = remaining;
	return dispersed;
}

export function getBadBreathCloudAlongPath(
	game: Game,
	path: any[] | undefined,
): CloudRecord | undefined {
	if (!path?.length) return undefined;
	const clouds: CloudRecord[] = (game as any).badBreathClouds ?? [];
	const set = new Set(path.map((h) => `${h?.x},${h?.y}`));
	return clouds.find((c) => set.has(`${c.hex.x},${c.hex.y}`));
}

export function ageBadBreathClouds(game: Game): void {
	const clouds: CloudRecord[] = (game as any).badBreathClouds ?? [];
	if (!clouds.length) return;
	const engine = getEngine(game);
	const currentTurn = (game as any).turn ?? 0;
	const remaining: CloudRecord[] = [];
	for (const cloud of clouds) {
		const age = Math.max(0, currentTurn - cloud.createdTurn);
		const denom = Math.max(1, cloud.turnLifetime - 1);
		const fraction = Math.max(0.4, 1 - (age / denom) * 0.6);
		const targetCount = Math.max(1, Math.round(cloud.initialCount * fraction));
		while (cloud.sprites.length > targetCount) {
			const idx = Math.floor(Math.random() * cloud.sprites.length);
			const sp = cloud.sprites.splice(idx, 1)[0];
			fadeDestroy(sp, engine);
		}
		remaining.push(cloud);
	}
	(game as any).badBreathClouds = remaining;
}

export function expireBadBreathClouds(game: Game): void {
	const clouds: CloudRecord[] = (game as any).badBreathClouds ?? [];
	if (!clouds.length) return;
	const engine = getEngine(game);
	const currentTurn = (game as any).turn ?? 0;
	const remaining: CloudRecord[] = [];
	for (const cloud of clouds) {
		const age = currentTurn - cloud.createdTurn;
		if (age >= cloud.turnLifetime) {
			for (const sprite of cloud.sprites) {
				if (sprite?.active !== false) {
					fadeDestroy(sprite, engine);
				}
			}
		} else {
			remaining.push(cloud);
		}
	}
	(game as any).badBreathClouds = remaining;
}

// Aliases for compatibility with possible naming.
export const spawnBadBreath = spawnBadBreathCloud;
export const spawnBadBreathVfx = spawnBadBreathCloud;
export const spawnBadBreathClouds = spawnBadBreathCloud;
export const spawnToxicCloud = spawnBadBreathCloud;
export const spawnToxicClouds = spawnBadBreathCloud;
export const spawnSwamplerBadBreath = spawnBadBreathCloud;
