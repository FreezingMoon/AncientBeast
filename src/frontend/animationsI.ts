import * as $j from 'jquery';
import game from '../game';
import * as arrayUtils from '../utility/arrayUtils';
import { Creature } from '../creature';

export interface AnimationsI {

	creature: Creature;

    walk(creature, path, opts): void;
    fly(creature, path, opts): void;
    teleport(creature, path, opts): void;
    push(creature, path, opts): void;
    enterHex(creature, hex, opts): void;
    movementComplete(creature, hex, animId, opts): void;
    projectile(this2, target, spriteId, path, args, startX, startY): [tween, sprite, dist];

	constructor(game) {
		this.game = game;
		this.movementPoints = 0;
	}

	walk(creature, path, opts) {
		
	}

	fly(creature, path, opts) {
		
	}

	teleport(creature, path, opts) {
		
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
		
	}
}
