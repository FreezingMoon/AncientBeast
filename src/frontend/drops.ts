/**
 * Drops are a type of creature "buff" collected from a game board hex rather than
 * being applied by an ability.
 *
 * For "pool" resources such as health and energy, the buff restores those resources
 * as well as increasing their maximum values.
 *
 * Each creature has a unique Drop that is added to their location hex when they
 * die.
 *
 * Another creature entering the same hex as the Drop can pick it up, altering its
 * stats (alterations) and/or restoring health/energy.
 *
 * Other rules:
 * - Multiple Drops can stack on a single creature, either the same Drop multiple
 *   times or different Drops from multiple creatures.
 * - Drops currently do NOT expire.
 * - Drops currently cannot be removed by other abilities.
 * - Drops are essentially permanent although this may change in the future.
 */

import { Game} from '../game';
import { Creature } from './creature';
import { Hex } from './hex';

export abstract class Drop {
	name: string;
	game: Game;
	id: number;
	x: number;
	y: number;
	pos: { x: number; y: number };
	alterations: any;
	hex: Hex;

	constructor(name: string, alterations: any, x: number, y: number, game: Game) {
		this.name = name;
		this.game = game;
		this.id = game.dropId++;
		this.x = x;
		this.y = y;
		this.pos = {
			x: x,
			y: y,
		};
		this.alterations = alterations;
		this.hex = game.grid.hexes[this.y][this.x];
		this.hex.drop = this;
	}

	abstract pickup(creature: Creature): void;
}
