import * as arrayUtils from './utility/arrayUtils';
import Game from './game';
import { Creature } from './creature';
import { Hex } from './utility/hex';
import { Ability } from './ability';

// to fix @ts-expect-error 2554: properly type the arguments for the trigger functions in `game.ts`

type AnimationOptions = {
	customMovementPoint?: number;
	overrideSpeed?: number;
	ignoreMovementPoint?: boolean;
	ignoreTraps?: boolean;
	ignoreFacing?: boolean;
	callbackStepIn?: (hex?: Hex) => void;
	pushed?: boolean;
	turnAroundOnComplete?: boolean;
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

		const that = this;

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
	}

	leaveHex(creature: Creature, hex: Hex, opts: AnimationOptions) {
		const game = this.game;
		let ignoringFaceUpdate;

		if (opts.ignoreFacing) {
			ignoringFaceUpdate = true;
		} else {
			if (!opts.pushed) {
				creature.faceHex(hex, creature.hexagons[0], false, false); // Determine facing
			}
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

		creature.hexagons.forEach((h) => {
			h.pickupDrop(creature);
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
}
