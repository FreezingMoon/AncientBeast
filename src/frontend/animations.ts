import Game from '../game';
import { Creature } from './creature';

export abstract class Animations {
	creature: Creature;
	game: Game;
	movementPoints: number;

	constructor(game: Game) {
		this.game = game;
		this.movementPoints = 0;
	}

	abstract walk(creature, path, opts): void;
	abstract fly(creature, path, opts): void;
	abstract teleport(creature, path, opts): void;
	abstract projectile(this2, target, spriteId, path, args, startX, startY): any[];

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

	abstract callMethodByStr(str: string, creature, path, opts);
}
