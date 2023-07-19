import * as arrayUtils from './utility/arrayUtils';
import Game from './game';
import { Creature } from './creature';
import { Hex } from './utility/hex';
import { Ability } from './ability';
import { offsetCoordsToPx } from './utility/const';

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

			const nextHex = game.grid.hexes[hex.y][hex.x];

			const tween = game.Phaser.add
				.tween(creature.grp)
				.to(offsetCoordsToPx(nextHex), speed, Phaser.Easing.Linear.None)
				.start();

			// Ignore traps for hover creatures, unless this is the last hex
			const enterHexOpts = {
				ignoreTraps: creature.movementType() !== 'normal' && hexId < path.length - 1,
				...opts,
			};

			tween.onComplete.add(() => {
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
		const start = game.grid.hexes[creature.y][creature.x];
		const currentHex = game.grid.hexes[hex.y][hex.x];

		this.leaveHex(creature, currentHex, opts);

		const speed = !opts.overrideSpeed ? creature.animation.walk_speed : opts.overrideSpeed;

		const tween = game.Phaser.add
			.tween(creature.grp)
			.to(offsetCoordsToPx(currentHex), speed, Phaser.Easing.Linear.None)
			.start();

		tween.onComplete.add(() => {
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
			currentHex = game.grid.hexes[hex.y][hex.x];

		this.leaveHex(creature, currentHex, opts);

		const animId = Math.random();
		game.animationQueue.push(animId);

		// FadeOut
		const tween = game.Phaser.add
			.tween(creature.grp)
			.to(
				{
					alpha: 0,
				},
				500,
				Phaser.Easing.Linear.None,
			)
			.start();

		tween.onComplete.add(() => {
			// Sound Effect
			game.soundsys.playSFX('sounds/step');

			// position
			const px = offsetCoordsToPx(creature);
			creature.grp.x = px.x;
			creature.grp.y = px.y;

			// FadeIn
			game.Phaser.add
				.tween(creature.grp)
				.to(
					{
						alpha: 1,
					},
					500,
					Phaser.Easing.Linear.None,
				)
				.start();

			this.enterHex(creature, hex, opts);
			this.movementComplete(creature, hex, animId, opts);
			return;
		});
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
		target: Creature,
		spriteId: string,
		projectileHeightFromGroundPx: number,
	) {
		const shooter = this2.creature;
		const game = shooter.game;
		// NOTE: Sometimes this is apparently not passed a valid target.
		const victims = game.creatures.filter((c) => c.id === target.id);

		const isTargetOnRight = shooter.centerPx < target.centerPx;
		const startXPx = isTargetOnRight ? shooter.rightPx : shooter.leftPx;
		const endXPx = isTargetOnRight ? target.leftPx : target.rightPx;
		const startYPx = shooter.footPx + projectileHeightFromGroundPx;

		const duration = Math.abs(startXPx - endXPx);

		const sprite = shooter.game.grid.creatureGroup.create(startXPx, startYPx, spriteId);
		sprite.anchor.setTo(0.5, 1);
		sprite.scale.set(isTargetOnRight ? 1 : -1, 1);

		const tween = game.Phaser.add
			.tween(sprite)
			.to(
				{
					x: endXPx,
					y: target.footPx + projectileHeightFromGroundPx,
				},
				duration,
				Phaser.Easing.Linear.None,
			)
			.start();

		const dist = 1;
		return [tween, sprite, dist];
	}
}
