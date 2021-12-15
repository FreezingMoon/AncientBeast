import * as $j from 'jquery';
import * as arrayUtils from './utility/arrayUtils';

export class Animations {
	constructor(game) {
		this.game = game;
		this.movementPoints = 0;
	}

	walk(creature, path, opts) {
		let game = this.game;

		if (opts.customMovementPoint > 0) {
			path = path.slice(0, opts.customMovementPoint);
			// For compatibility
			this.movementPoints = creature.remainingMove;
			creature.remainingMove = opts.customMovementPoint;
		}

		game.freezedInput = true;

		let animId = Math.random();
		game.animationQueue.push(animId);

		let hexId = 0;

		creature.healthHide();

		let anim = function () {
			let hex = path[hexId];

			if (hexId < path.length && (creature.remainingMove > 0 || opts.ignoreMovementPoint)) {
				this.leaveHex(creature, hex, opts);
			} else {
				this.movementComplete(creature, path[path.length - 1], animId, opts);
				return;
			}

			let nextPos = game.grid.hexes[hex.y][hex.x - creature.size + 1];
			let speed = !opts.overrideSpeed ? creature.animation.walk_speed : opts.overrideSpeed;

			let tween = game.Phaser.add
				.tween(creature.grp)
				.to(nextPos.displayPos, parseInt(speed, 10), Phaser.Easing.Linear.None)
				.start();

			// Ignore traps for hover creatures, unless this is the last hex
			let enterHexOpts = $j.extend(
				{
					ignoreTraps: creature.movementType() !== 'normal' && hexId < path.length - 1,
				},
				opts,
			);

			tween.onComplete.add(() => {
				if (creature.dead) {
					// Stop moving if creature has died while moving
					this.movementComplete(creature, hex, animId, opts);
					return;
				}

				// Sound Effect
				game.soundsys.playSound(game.soundLoaded[0], game.soundsys.effectsGainNode);

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
		}.bind(this);

		anim();
	}

	fly(creature, path, opts) {
		let game = this.game;

		if (opts.customMovementPoint > 0) {
			path = path.slice(0, opts.customMovementPoint);
			// For compatibility
			this.movementPoints = creature.remainingMove;
			creature.remainingMove = opts.customMovementPoint;
		}

		game.freezedInput = true;

		let animId = Math.random();
		game.animationQueue.push(animId);

		creature.healthHide();

		let hex = path[0];

		let start = game.grid.hexes[creature.y][creature.x - creature.size + 1];
		let currentHex = game.grid.hexes[hex.y][hex.x - creature.size + 1];

		this.leaveHex(creature, currentHex, opts);

		let speed = !opts.overrideSpeed ? creature.animation.walk_speed : opts.overrideSpeed;

		let tween = game.Phaser.add
			.tween(creature.grp)
			.to(currentHex.displayPos, parseInt(speed, 10), Phaser.Easing.Linear.None)
			.start();

		tween.onComplete.add(() => {
			// Sound Effect
			game.soundsys.playSound(game.soundLoaded[0], game.soundsys.effectsGainNode);

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

	teleport(creature, path, opts) {
		let game = this.game,
			hex = path[0],
			currentHex = game.grid.hexes[hex.y][hex.x - creature.size + 1];

		this.leaveHex(creature, currentHex, opts);

		let animId = Math.random();
		game.animationQueue.push(animId);

		// FadeOut
		let tween = game.Phaser.add
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
			game.soundsys.playSound(game.soundLoaded[0], game.soundsys.effectsGainNode);

			// position
			creature.grp.x = currentHex.displayPos.x;
			creature.grp.y = currentHex.displayPos.y;

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

	push(creature, path, opts) {
		opts.pushed = true;
		this.walk(creature, path, opts);
	}

	//--------Special Functions---------//

	enterHex(creature, hex, opts) {
		let game = this.game;

		creature.cleanHex();
		creature.x = hex.x - 0;
		creature.y = hex.y - 0;
		creature.pos = hex.pos;
		creature.updateHex();

		game.onStepIn(creature, hex, opts);

		creature.pickupDrop();

		opts.callbackStepIn(hex);

		game.grid.orderCreatureZ();
	}

	leaveHex(creature, hex, opts) {
		let game = this.game;

		if (!opts.pushed) {
			creature.faceHex(hex, creature.hexagons[0]); // Determine facing
		}

		game.onStepOut(creature, creature.hexagons[0]); // Trigger
		game.grid.orderCreatureZ();
	}

	movementComplete(creature, hex, animId, opts) {
		let game = this.game;

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

		let queue = game.animationQueue.filter((item) => item != animId);

		if (queue.length === 0) {
			game.freezedInput = false;
			if (game.multiplayer) {
				game.freezedInput = game.UI.active ? false : true;
			}
		}

		game.animationQueue = queue;
	}

	projectile(this2, target, spriteId, path, args, startX, startY) {
		// Get the target's position on the projectile's path that is closest
		let emissionPointX = this2.creature.grp.x + startX;
		var distance = Number.MAX_SAFE_INTEGER;
		var targetX = path[0].displayPos.x;
		for (let hex of path) {
			if (typeof hex.creature != 'undefined' && hex.creature.id == target.id) {
				if (distance > Math.abs(emissionPointX - hex.displayPos.x)) {
					distance = Math.abs(emissionPointX - hex.displayPos.x);
					targetX = hex.displayPos.x;
				}
			}
		}
		let game = this.game,
			baseDist = arrayUtils.filterCreature(path.slice(0), false, false).length,
			dist = baseDist == 0 ? 1 : baseDist,
			emissionPoint = {
				x: this2.creature.grp.x + startX,
				y: this2.creature.grp.y + startY,
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
		let tween = game.Phaser.add
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
