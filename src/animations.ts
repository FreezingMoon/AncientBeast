import * as arrayUtils from './utility/arrayUtils';
import Game from './game';
import { Creature } from './creature';
import { Hex } from './utility/hex';
import { Ability } from './ability';
import { QuadraticCurve } from './utility/curve';
import { DEBUG_ENABLE_FAST_WALKING, DEBUG_WALK_SPEED_MS } from './debug';

// to fix @ts-expect-error 2554: properly type the arguments for the trigger functions in `game.ts`

type AnimationOptions = {
	customMovementPoint?: number;
	overrideSpeed?: number;
	ignoreMovementPoint?: boolean;
	ignoreTraps?: boolean;
	ignoreFacing?: boolean;
	callback?: () => void;
	callbackStepIn?: (hex?: Hex) => void;
	pushed?: boolean;
	turnAroundOnComplete?: boolean;
	flipped?: boolean;
};

export class Animations {
	game: Game;
	movementPoints: number;
	animationCounter: number;

	constructor(game: Game) {
		this.game = game;
		this.movementPoints = 0;
		this.animationCounter = 0;
	}

	walk(creature: Creature, path: Hex[], opts: AnimationOptions) {
		const game = this.game;

		if (opts.customMovementPoint > 0) {
			path = path.slice(0, opts.customMovementPoint);
			// For compatibility
			this.movementPoints = creature.remainingMove;
			creature.remainingMove = opts.customMovementPoint;
		}

		game.freezedInput = true;

		const animId = ++this.animationCounter;
		game.animationQueue.push(animId);

		let hexId = 0;

		creature.healthHide();

		let speed = !opts.overrideSpeed ? creature.animation.walk_speed : opts.overrideSpeed;
		speed = Number(speed);

		if (DEBUG_ENABLE_FAST_WALKING) {
			speed = DEBUG_WALK_SPEED_MS;
		}

		const anim = () => {
			const hex = path[hexId];

			if (hexId < path.length && (creature.remainingMove > 0 || opts.ignoreMovementPoint)) {
				this.leaveHex(creature, hex, opts);
			} else {
				this.movementComplete(creature, path[path.length - 1], animId, opts);
				return;
			}

			const nextPos = game.grid.hexes[hex.y][hex.x - creature.size + 1];

			// Ignore traps for hover creatures, unless this is the last hex
			const enterHexOpts = {
				ignoreTraps: creature.movementType() !== 'normal' && hexId < path.length - 1,
				...opts,
			};

			creature.creatureSprite.setHex(nextPos, speed).then(() => {
				if (creature.dead) {
					// Stop moving if creature has died while moving
					this.movementComplete(creature, hex, animId, opts);
					return;
				}

				// Sound Effect
				game.soundsys.playSFX('sounds/step');

				if (!opts.ignoreMovementPoint) {
					creature.remainingMove--;

					if (opts.customMovementPoint === 0) {
						creature.travelDist++;
					}
				}

				this.enterHex(creature, hex, enterHexOpts);

				anim(); // Next tween
			});

			hexId++;
		};

		anim();
	}

	fly(creature: Creature, path: Hex[], opts: AnimationOptions) {
		const game = this.game;

		if (opts.customMovementPoint > 0) {
			path = path.slice(0, opts.customMovementPoint);
			// For compatibility
			this.movementPoints = creature.remainingMove;
			creature.remainingMove = opts.customMovementPoint;
		}

		game.freezedInput = true;

		const animId = Math.random();
		game.animationQueue.push(animId);

		creature.healthHide();

		const hex = path[0];

		const start = game.grid.hexes[creature.y][creature.x - creature.size + 1];
		const currentHex = game.grid.hexes[hex.y][hex.x - creature.size + 1];

		this.leaveHex(creature, currentHex, opts);

		const durationMS = !opts.overrideSpeed ? creature.animation.walk_speed : opts.overrideSpeed;

		creature.creatureSprite.setHex(currentHex, durationMS).then(() => {
			// Sound Effect
			game.soundsys.playSFX('sounds/step');

			if (!opts.ignoreMovementPoint) {
				// Determine distance
				let distance = 0;
				let k = 0;
				while (!distance) {
					k++;

					if (arrayUtils.findPos(start.adjacentHex(k), currentHex)) {
						distance = k;
					}
				}

				creature.remainingMove -= distance;
				if (opts.customMovementPoint === 0) {
					creature.travelDist += distance;
				}
			}

			this.enterHex(creature, hex, opts);
			this.movementComplete(creature, hex, animId, opts);
			return;
		});
	}

	teleport(creature: Creature, path: Hex[], opts: AnimationOptions) {
		const game = this.game,
			hex = path[0],
			currentHex = game.grid.hexes[hex.y][hex.x - creature.size + 1];

		this.leaveHex(creature, currentHex, opts);

		const animId = Math.random();
		game.animationQueue.push(animId);

		creature.creatureSprite
			.setAlpha(0, 500)
			.then((creatureSprite) => {
				// Sound Effect
				game.soundsys.playSFX('sounds/step');

				// Position
				creatureSprite.setHex(currentHex);

				this.enterHex(creature, hex, opts);
				this.movementComplete(creature, hex, animId, opts);
				return creatureSprite;
			})
			.then((creatureSprite) => creatureSprite.setAlpha(1, 500));
	}

	push(creature: Creature, path: Hex[], opts: AnimationOptions) {
		opts.pushed = true;
		this.walk(creature, path, opts);
	}

	//--------Special Functions---------//

	enterHex(creature: Creature, hex: Hex, opts: AnimationOptions) {
		const game = this.game;

		creature.cleanHex();
		creature.x = hex.x - 0;
		creature.y = hex.y - 0;
		creature.pos = hex.pos;
		creature.updateHex();

		game.onStepIn(creature, hex, opts);

		creature.pickupDrop();

		if (opts.callbackStepIn) {
			opts.callbackStepIn(hex);
		}

		game.grid.orderCreatureZ();

		// Refresh xray so obstructors are correctly ghosted as the unit moves rows
		if (game.activeCreature === creature) {
			game.grid.refreshActiveCreatureXray();
		}
	}

	leaveHex(creature: Creature, hex: Hex, opts: AnimationOptions) {
		const game = this.game;

		if (!opts.ignoreFacing && !opts.pushed) {
			creature.faceHex(hex, creature.hexagons[0], false, false); // Determine facing
		}
		// @ts-expect-error 2554
		game.onStepOut(creature, creature.hexagons[0]); // Trigger
		game.grid.orderCreatureZ();
	}

	movementComplete(creature: Creature, hex: Hex, animId: number, opts: AnimationOptions) {
		const game = this.game;

		if (opts.customMovementPoint > 0) {
			creature.remainingMove = this.movementPoints;
		}

		// TODO: Turn around animation
		if (opts.turnAroundOnComplete) {
			creature.facePlayerDefault();
		}

		// TODO: Reveal health indicator
		creature.healthShow();

		creature.hexagons.forEach(() => {
			creature.pickupDrop();
		});

		game.grid.orderCreatureZ();

		const queue = game.animationQueue.filter((item) => item != animId);

		if (queue.length === 0) {
			game.freezedInput = false;
			if (game.multiplayer) {
				game.freezedInput = game.UI.active ? false : true;
			}
		}

		game.animationQueue = queue;
	}

	projectile(
		this2: Ability,
		target: { id: number },
		spriteId: string,
		path: Hex[],
		args: { direction: number },
		startX: number,
		startY: number,
	) {
		// Get the target's position on the projectile's path that is closest
		const emissionPointX = this2.creature.legacyProjectileEmissionPoint.x + startX;
		let distance = Number.MAX_SAFE_INTEGER;
		let targetX = path[0].displayPos.x;
		for (const hex of path) {
			if (typeof hex.creature != 'undefined' && hex.creature.id == target.id) {
				if (distance > Math.abs(emissionPointX - hex.displayPos.x)) {
					distance = Math.abs(emissionPointX - hex.displayPos.x);
					targetX = hex.displayPos.x;
				}
			}
		}
		const game = this.game,
			baseDist = arrayUtils.filterCreature(path.slice(0), false, false).length,
			dist = baseDist == 0 ? 1 : baseDist,
			emissionPoint = {
				x: this2.creature.legacyProjectileEmissionPoint.x + startX,
				y: this2.creature.legacyProjectileEmissionPoint.y + startY,
			},
			targetPoint = {
				x: targetX + 45,
				y: path[baseDist].displayPos.y - 20,
			},
			// Sprite id here
			sprite = game.grid.creatureGroup.create(emissionPoint.x, emissionPoint.y, spriteId),
			duration = dist * 75;

		sprite.anchor.setTo(0.5);
		sprite.rotation = -Math.PI / 3 + (args.direction * Math.PI) / 3;
		const tween = game.Phaser.add
			.tween(sprite)
			.to(
				{
					x: targetPoint.x,
					y: targetPoint.y,
				},
				duration,
				Phaser.Easing.Linear.None,
			)
			.start();

		return [tween, sprite, dist];
	}

	death(creature: Creature, opts: AnimationOptions) {
		// Animation Properties
		const length = 100; // Distance travelled in x
		const numSegments = 10; // "Resolution" of the curve
		const speed = !opts.overrideSpeed ? 500 : opts.overrideSpeed;

		// Curve should pass (0, 0)
		const curve = opts.flipped ? new QuadraticCurve(0.1, 5, 0) : new QuadraticCurve(0.1, -5, 0);

		// Tween properties
		const segmentLength = (opts.flipped ? -1 : 1) * Math.round(length / numSegments);
		const segmentTime = Math.round(speed / numSegments);

		const startPos = creature.creatureSprite.getPos();

		creature.healthHide();

		let currSegment = 1;

		const anim = () => {
			if (currSegment > numSegments) {
				opts.callback();
				return;
			}

			// Calculate the point in the curve
			const next = {
				x: startPos.x + segmentLength * currSegment,
				y: startPos.y + curve.calc_y(segmentLength * currSegment),
			};

			// Tween to point
			creature.creatureSprite.setPx(next, segmentTime).then(() => {
				// Next tween
				anim();
			});

			currSegment++;
		};

		// Rotate and Fade the sprite
		creature.creatureSprite.setAngle(opts.flipped ? -90 : 90, 500);
		creature.creatureSprite.setAlpha(0, 500);

		// Launch the sprite
		anim();
	}

	shatterDown(creature: Creature, opts: AnimationOptions) {
		const speed = !opts.overrideSpeed ? 300 : opts.overrideSpeed;
		const game = this.game;
		const sprite = creature.sprite;
		const texture: any = sprite.texture as any;
		const frame: any = texture.crop || texture.frame || { x: 0, y: 0, width: 0, height: 0 };
		const source = texture.baseTexture?.source as CanvasImageSource;
		const texW = Math.round(texture.width || frame.width || 1);
		const texH = Math.round(texture.height || frame.height || 1);
		const isFlipped = sprite.scale.x < 0;

		const shardFadeMs = Math.max(260, Math.round(speed * 1.2));

		const spriteLeft = creature.grp.x + sprite.x - sprite.width / 2;
		const spriteTop = creature.grp.y + sprite.y - sprite.height;

		const minShardW = 4;
		const maxShardW = 10;
		const minShardH = 6;
		const maxShardH = 15;
		const baseHeight = Math.max(12, Math.floor(texH * 0.22));
		const baseTopY = Math.max(minShardH, texH - baseHeight);
		const baseBottom = spriteTop + texH;
		const seamProfile = new Array<number>(texW);
		let seamX = 0;
		let previousSeamY = baseTopY;
		while (seamX < texW) {
			const bandWidth = Math.min(texW - seamX, 4 + Math.floor(Math.random() * 8));
			const nextSeamY = Math.max(
				minShardH,
				Math.min(
					texH - minShardH,
					previousSeamY + (-9 + Math.floor(Math.random() * 19)),
				),
			);

			for (let fillX = seamX; fillX < seamX + bandWidth; fillX++) {
				seamProfile[fillX] = nextSeamY;
			}

			previousSeamY = nextSeamY;
			seamX += bandWidth;
		}

		const lowestSeamY = seamProfile.reduce((maxY, seamY) => Math.max(maxY, seamY), minShardH);
		const baseTop = spriteTop + lowestSeamY;
		let longestShardLifetime = 0;

		for (let sx = 0; sx < texW; ) {
			const seamY = seamProfile[Math.min(sx, texW - 1)];
			for (let sy = 0; sy < seamY; ) {
				if (Math.random() < 0.08) {
					sy += minShardH;
					continue;
				}

				const sw = Math.min(minShardW + Math.floor(Math.random() * (maxShardW - minShardW + 1)), texW - sx);
				const localSeamY = seamProfile[Math.min(texW - 1, sx + Math.floor(sw / 2))];
				const sh = Math.min(
					minShardH + Math.floor(Math.random() * (maxShardH - minShardH + 1)),
					localSeamY - sy,
				);
				if (sw <= 0 || sh <= 0) {
					sy += minShardH;
					continue;
				}

				const bmd = game.Phaser.add.bitmapData(sw, sh);
				const srcX = isFlipped ? frame.x + frame.width - sx - sw : frame.x + sx;
				const srcY = frame.y + sy;
				bmd.ctx.clearRect(0, 0, sw, sh);
				bmd.ctx.drawImage(source, srcX, srcY, sw, sh, 0, 0, sw, sh);
				bmd.dirty = true;

				const shardScreenX = isFlipped ? texW - sx - sw : sx;
				const x = spriteLeft + shardScreenX + sw / 2;
				const y = spriteTop + sy + sh / 2;
				const shard = game.grid.creatureGroup.create(x, y, bmd);
				shard.anchor.setTo(0.5, 0.5);
				shard.angle = -18 + Math.random() * 36;

				const driftX = -40 + Math.random() * 80;
				const landingMinY = Math.max(y + 10, spriteTop + localSeamY + sh / 2 - 2);
				const landingMaxY = Math.max(landingMinY, baseBottom - sh / 2);
				const targetY =
					landingMinY + Math.random() * Math.max(0, landingMaxY - landingMinY);
				const shardDuration = Math.round(shardFadeMs * (0.9 + Math.random() * 0.35));
				const shardFadeDuration = Math.max(90, Math.round(shardDuration * 0.22));
				longestShardLifetime = Math.max(
					longestShardLifetime,
					shardDuration + shardFadeDuration,
				);
				const travelTween = game.Phaser.add
					.tween(shard)
					.to(
						{
							x: x + driftX,
							y: targetY,
							angle: shard.angle + (-90 + Math.random() * 180),
						},
						shardDuration,
						Phaser.Easing.Cubic.In,
						true,
					);

				travelTween.onComplete.add(() => {
					game.Phaser.add
						.tween(shard)
						.to(
							{
								alpha: 0,
							},
							shardFadeDuration,
							Phaser.Easing.Linear.None,
							true,
						)
						.onComplete.add(() => {
							shard.destroy();
							bmd.destroy();
						});
				});

				sy += Math.max(minShardH - 1, sh - Math.floor(Math.random() * 3));
			}

			sx += Math.max(minShardW - 1, 3 + Math.floor(Math.random() * 5));
		}

		creature.healthHide();

		const baseSh = Math.max(0, texH);
		if (baseSh > 0) {
			const baseBmd = game.Phaser.add.bitmapData(texW, baseSh);
			baseBmd.ctx.clearRect(0, 0, texW, baseSh);
			for (let copyX = 0; copyX < texW; copyX++) {
				const seamY = seamProfile[Math.min(copyX, texW - 1)];
				const copyHeight = Math.max(0, texH - seamY);
				if (copyHeight <= 0) {
					continue;
				}

				const sourceX = isFlipped ? frame.x + frame.width - copyX - 1 : frame.x + copyX;
				const sourceY = frame.y + seamY;
				baseBmd.ctx.drawImage(source, sourceX, sourceY, 1, copyHeight, copyX, seamY, 1, copyHeight);
			}
			baseBmd.dirty = true;

			const baseX = spriteLeft + texW / 2;
			const baseY = spriteTop + texH / 2;
			const baseSprite = game.grid.creatureGroup.create(baseX, baseY, baseBmd);
			baseSprite.anchor.setTo(0.5, 0.5);
			if (isFlipped) {
				baseSprite.scale.x = -1;
			}

			creature.creatureSprite.setAlpha(0, 0);
			const baseFadeDelay = Math.max(0, longestShardLifetime - speed);
			game.Phaser.add
				.tween(baseSprite)
				.to(
					{
						alpha: 0,
					},
					speed,
					Phaser.Easing.Linear.None,
					true,
					baseFadeDelay,
				)
				.onComplete.add(() => {
					baseSprite.destroy();
					baseBmd.destroy();
					opts.callback?.();
				});
			return;
		}

		creature.creatureSprite.setAlpha(0, speed).then(() => {
			opts.callback?.();
		});
	}
}
