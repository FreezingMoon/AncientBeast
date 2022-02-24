import Game from "../../game";
import { AnimationsI } from "../animationsI";
import Phaser from 'phaser-ce';

export class PhaserAnimations implements AnimationsI {
	game: Game;
	phaser: Phaser;

	constructor(game) {
		this.game = game;
		this.movementPoints = 0;
	}

    walk(creature: any, path: any, opts: any): void {
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

    fly(creature: any, path: any, opts: any): void {
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
    teleport(creature: any, path: any, opts: any): void {
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
    push(creature: any, path: any, opts: any): void {
        throw new Error("Method not implemented.");
    }
    enterHex(creature: any, hex: any, opts: any): void {
        throw new Error("Method not implemented.");
    }
    movementComplete(creature: any, hex: any, animId: any, opts: any): void {
        throw new Error("Method not implemented.");
    }
    projectile(this2: any, target: any, spriteId: any, path: any, args: any, startX: any, startY: any): [tween, sprite, dist] {
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