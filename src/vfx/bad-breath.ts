import type { Creature } from '../creature';
import type Game from '../game';
import { Damage } from '../damage';
import { Easing } from '../utility/easing';
import { offsetCoordsToPx } from '../utility/const';
import { createGameCanvasSurface } from '../game-display/canvas-surface';
import { getFrameSize } from '../game-display/texture';
import { Hex } from '../utility/hex';

import type { SpriteHandle } from '../engine/types';
import type { CanvasSurface } from '../game-display/canvas-surface';

// Use engine types; local SpriteHandle was wrong for current API

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

function getEngine(game: Game): {
	add?: { sprite?: unknown; tween?: unknown; group?: unknown; graphics?: unknown };
	cameras?: { main?: { shake?: unknown } };
} {
	return (game as unknown as { gameEngine?: unknown }).gameEngine as {
		add?: { sprite?: unknown; tween?: unknown; group?: unknown; graphics?: unknown };
		cameras?: { main?: { shake?: unknown } };
	};
}

function getMouthPoint(creature: Creature): { x: number; y: number } {
	const sprite = (creature as unknown as { sprite?: any }).sprite;
	const group = (creature as unknown as { grp?: { x: number; y: number } }).grp;
	const frame = getFrameSize(sprite);
	const texX = 47;
	const texY = 43;
	const originX = sprite?.originX ?? sprite?.anchor?.x ?? 0.5;
	const originY = sprite?.originY ?? sprite?.anchor?.y ?? 0.5;
	const scaleX = sprite?.scaleX ?? sprite?.scale?.x ?? 1;
	const scaleY = sprite?.scaleY ?? sprite?.scale?.y ?? 1;
	const localX = (texX - originX * (frame?.width ?? 0)) * scaleX;
	const localY = (texY - originY * (frame?.height ?? 0)) * scaleY;
	return {
		x: (group?.x ?? 0) + (sprite?.x ?? 0) + localX,
		y: (group?.y ?? 0) + (sprite?.y ?? 0) + localY,
	};
}

function fadeDestroy(
	sprite: SpriteHandle,
	engine: { add?: { tween?: unknown } } | unknown,
	delay = 0,
): void {
	const eng = engine as unknown as {
		add?: {
			tween?: (obj: unknown) => {
				to: (
					props: unknown,
					duration: number,
					ease?: unknown,
					autoStart?: boolean,
				) => { onComplete: { add: (fn: () => void) => void } };
			};
		};
		tween?: (obj: unknown) => {
			to: (
				props: unknown,
				duration: number,
				ease?: unknown,
				autoStart?: boolean,
				delay?: number,
			) => {
				onComplete: { add: (fn: () => void) => void };
				start?: () => unknown;
			};
		};
	};
	if (!eng?.add?.tween && !(eng as any)?.tween) {
		try {
			sprite.kill?.();
		} catch {
			// ignore
		}
		try {
			sprite.destroy?.();
		} catch {
			// ignore
		}
		return;
	}
	try {
		const tweenFactory = (eng as any)?.tween ?? (eng as any)?.add?.tween;
		const tween = tweenFactory(sprite)?.to?.({ alpha: 0 }, 500, Easing.Linear.None, true, delay);
		tween?.onComplete?.add?.(() => {
			try {
				sprite.destroy();
			} catch {
				// ignore
			}
		});
		if (tween?.start) {
			try {
				tween.start();
			} catch {
				// ignore
			}
		}
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
			const eng = engine as any;
			const tweenFactory = eng?.tween ?? eng?.add?.tween;
			if (tweenFactory) {
				const tween = tweenFactory(sprite)?.to?.(
					{ ...destination, alpha: 0 },
					300,
					Easing.Linear.None,
				);
				if (tween?.onComplete?.add) {
					tween.onComplete.add(() => sprite.destroy());
					if (tween?.start) {
						tween.start();
						continue;
					}
				}
			}
			(sprite as any).x = destination.x;
			(sprite as any).y = destination.y;
			fadeDestroy(sprite, engine);
		} catch {
			try {
				(sprite as any).x = destination.x;
				(sprite as any).y = destination.y;
			} catch {
				// ignore
			}
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
	const grid = (
		game as unknown as {
			grid?: { hexAt?: (x: number, y: number) => Hex | undefined };
			hexAt?: (x: number, y: number) => Hex | undefined;
		}
	)?.grid;
	const hexObj =
		typeof grid?.hexAt === 'function'
			? grid.hexAt(candOff.x, candOff.y)
			: (game as unknown as { hexAt?: (x: number, y: number) => Hex | undefined })?.hexAt?.(
					candOff.x,
					candOff.y,
			  );
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
			const engAny = engine as any;
			const tweenFactory = engAny?.tween ?? engAny?.add?.tween;
			if (tweenFactory) {
				const tween = tweenFactory(sp)?.to?.({ x: dx, y: dy }, 300, Easing.Linear.None);
				if (tween?.start) {
					tween.start();
					continue;
				}
			}
			(sp as any).x = dx;
			(sp as any).y = dy;
		} catch {
			try {
				(sp as any).x = dx;
				(sp as any).y = dy;
			} catch {
				// ignore
			}
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

	let surface: CanvasSurface | null = null;
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

	const group = (game as unknown as { grid?: { creatureGroup?: { add?: (obj: unknown) => void } } })
		?.grid?.creatureGroup;
	const count = upgraded ? 32 : 20;
	const gameAny = game as unknown as { badBreathClouds?: CloudRecord[]; turn?: number };
	if (!gameAny.badBreathClouds) {
		gameAny.badBreathClouds = [];
	}
	const clouds: CloudRecord[] = gameAny.badBreathClouds ?? [];
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
				const engAny = engine as any;
				const factory = engAny?.add?.sprite ?? engAny?.sprite ?? engAny?.add?.image;
				if (typeof factory === 'function') {
					sprite = factory.call(
						engAny?.add ?? engAny,
						originX,
						originY,
						(surface as any)?.key,
						undefined,
						group,
					) as SpriteHandle;
				}
			} catch {
				sprite = null;
			}
			if (!sprite) continue;

			try {
				(sprite as any).anchor?.set?.(0.5, 0.5);
				(sprite as any).setOrigin?.(0.5, 0.5);
			} catch {
				// ignore
			}
			const scale = 0.5 + Math.random() * 0.9;
			try {
				(sprite as any).scale?.set?.(scale, scale);
				(sprite as any).setScale?.(scale, scale);
			} catch {
				// ignore
			}
			(sprite as any).alpha = 0;

			const destX = baseX + 45 + (Math.random() - 0.5) * 60;
			const destY = baseY + (Math.random() - 0.5) * 40;

			let finishTween = () => undefined;
			try {
				const engAny = engine as any;
				const tweenFactory = engAny?.tween ?? engAny?.add?.tween;
				if (tweenFactory) {
					try {
						const tween = tweenFactory(sprite)?.to?.(
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
							try {
								tween.start();
							} catch {
								// ignore
							}
						} else if (tween?.onComplete?.add) {
							pendingAnimations++;
							let completed = false;
							finishTween = () => {
								if (completed) return;
								completed = true;
								completeAnimation();
							};
							tween.onComplete.add(finishTween);
						} else {
							(sprite as any).x = destX;
							(sprite as any).y = destY;
							(sprite as any).alpha = upgraded ? 0.65 : 0.55;
						}
					} catch {
						finishTween();
						try {
							(sprite as any).x = destX;
							(sprite as any).y = destY;
							(sprite as any).alpha = upgraded ? 0.65 : 0.55;
						} catch {
							// ignore
						}
					}
				} else {
					finishTween();
					(sprite as any).x = destX;
					(sprite as any).y = destY;
					(sprite as any).alpha = upgraded ? 0.65 : 0.55;
				}
			} catch {
				finishTween();
				try {
					(sprite as any).x = destX;
					(sprite as any).y = destY;
					(sprite as any).alpha = upgraded ? 0.65 : 0.55;
				} catch {
					// ignore
				}
			}

			cloudSprites.push(sprite);
		}

		if (cloudSprites.length) {
			clouds.push({
				hex: { x: hex.x, y: hex.y },
				sprites: cloudSprites,
				owner: creature,
				upgraded,
				createdTurn: (game as unknown as { turn?: number }).turn ?? 0,
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
	const gameAny = game as unknown as { badBreathClouds?: CloudRecord[]; turn?: number };
	if (!creature || creature.name === 'Swampler' || creature.dead) return;
	const clouds: CloudRecord[] = gameAny.badBreathClouds ?? [];
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
	gameAny.badBreathClouds = remaining;
}

export function disperseBadBreathCloudsAlongPath(
	game: Game,
	path: Hex[] | undefined,
): CloudRecord[] {
	const gameAny = game as unknown as { badBreathClouds?: CloudRecord[]; turn?: number };
	const clouds: CloudRecord[] = gameAny.badBreathClouds ?? [];
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
	gameAny.badBreathClouds = remaining;
	return dispersed;
}

export function getBadBreathCloudAlongPath(
	game: Game,
	path: Hex[] | undefined,
): CloudRecord | undefined {
	const gameAny = game as unknown as { badBreathClouds?: CloudRecord[]; turn?: number };
	if (!path?.length) return undefined;
	const clouds: CloudRecord[] = gameAny.badBreathClouds ?? [];
	const set = new Set(path.map((h) => `${h?.x},${h?.y}`));
	return clouds.find((c) => set.has(`${c.hex.x},${c.hex.y}`));
}

export function ageBadBreathClouds(game: Game): void {
	const gameAny = game as unknown as { badBreathClouds?: CloudRecord[]; turn?: number };
	const clouds: CloudRecord[] = gameAny.badBreathClouds ?? [];
	if (!clouds.length) return;
	const engine = getEngine(game);
	const currentTurn = (game as unknown as { turn?: number }).turn ?? 0;
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
	gameAny.badBreathClouds = remaining;
}

export function expireBadBreathClouds(game: Game): void {
	const gameAny = game as unknown as { badBreathClouds?: CloudRecord[]; turn?: number };
	const clouds: CloudRecord[] = gameAny.badBreathClouds ?? [];
	if (!clouds.length) return;
	const engine = getEngine(game);
	const currentTurn = (game as unknown as { turn?: number }).turn ?? 0;
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
	gameAny.badBreathClouds = remaining;
}

// Aliases for compatibility with possible naming.
export const spawnBadBreath = spawnBadBreathCloud;
export const spawnBadBreathVfx = spawnBadBreathCloud;
export const spawnBadBreathClouds = spawnBadBreathCloud;
export const spawnToxicCloud = spawnBadBreathCloud;
export const spawnToxicClouds = spawnBadBreathCloud;
export const spawnSwamplerBadBreath = spawnBadBreathCloud;
