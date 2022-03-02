import { Creature } from './creature';
import { Drop } from './drops';
import { Game } from '../game';
import { Trap } from './trap';
import { HexGrid } from './hexgrid';
import { Effect } from '../effect';

export enum Direction {
	UpRight = 0,
	Right = 1,
	DownRight = 2,
	DownLeft = 3,
	Left = 4,
	UpLeft = 5,
}

export abstract class Hex {
	game: Game;
	grid: HexGrid;

	/**
	 * Hex coordinates.
	 */
	x: number;

	/**
	 * Hex coordinates.
	 */
	y: number;

	/**
	 * Pos object for hex comparison {x,y}.
	 */
	pos: { x: number; y: number };

	coord: string;

	/**
	 * Pathfinding score f = g + h.
	 */
	f: number;

	/**
	 * Pathfinding distance from start.
	 */
	g: number;

	/**
	 * Pathfinding distance to finish.
	 */
	h: number;

	/**
	 * Pathfinding parent hex (the one you came from).
	 */
	pathparent: Hex;

	/**
	 * Set to true if an obstacle it on it. Restrict movement.
	 */
	blocked: boolean;

	/**
	 * Creature object, undefined if empty.
	 */
	creature: Creature;

	/**
	 * Set to true if accessible by current action.
	 */
	reachable: boolean;
	direction: Direction;
	drop: Drop;
	width: number;
	height: number;

	/**
	 * Pos object to position creature with absolute coordinates {left,top}.
	 */
	displayPos: { x: number; y: number };

	originalDisplayPos: { x: number; y: number };

	trap: Trap;

	// TODO: Move me to implementation class after UI code have been fixed.
	displayClasses: string;
	overlayClasses: string;

	/**
	 *
	 * @param x Hex coordinates
	 * @param y Hex coordinates
	 * @param grid
	 * @param game
	 */
	constructor(x: number, y: number, grid: HexGrid, game?: Game) {
		this.game = (grid && grid.game) || game;
		this.grid = grid;
		this.x = x;
		this.y = y;
		this.pos = {
			x: x,
			y: y,
		};
		this.coord = String.fromCharCode(64 + this.y + 1) + (this.x + 1);
		game = this.game;

		// Pathfinding
		this.f = 0;
		this.g = 0;
		this.h = 0;
		this.pathparent = null;

		this.blocked = false;
		this.creature = undefined;
		this.reachable = true;
		this.direction = -1; // Used for queryDirection
		this.drop = undefined; // Drop items
		this.displayClasses = '';
		this.overlayClasses = '';

		this.width = 0;
		this.height = 0;
		this.displayPos = { x: 0, y: 0 };

		this.trap = undefined;
	}

	onSelectFn(arg0: Hex) {
		// No-op function.
	}

	onHoverOffFn(arg0: Hex) {
		// No-op function.
	}

	onConfirmFn(arg0: Hex) {
		// No-op function.
	}

	onRightClickFn(arg0: Hex) {
		// No-op function.
	}

	/* adjacentHex(distance)
	 *
	 * distance : 	integer : 	Distance form the current hex
	 *
	 * return : 	Array : 	Array containing hexes
	 *
	 * This function return an array containing all hexes of the grid
	 * at the distance given of the current hex.
	 */
	abstract adjacentHex(distance: number): Hex[];

	/* ghostOverlap()
	 *
	 * add ghosted class to creature on hexes behind this hex
	 */
	abstract ghostOverlap(): void;

	/* cleanPathAttr(includeG)
	 *
	 * includeG : 	Boolean : 	Set includeG to True if you change the start of the calculated path.
	 *
	 * This function reset all the pathfinding attribute to
	 * 0 to calculate new path to another hex.
	 */
	cleanPathAttr(includeG: boolean): void {
		this.f = 0;
		this.g = includeG ? 0 : this.g;
		this.h = 0;
		this.pathparent = null;
	}

	/**
	 *
	 * @param size Size of the creature.
	 * @param id ID of the creature.
	 * @param ignoreReachable Take into account the reachable property.
	 * @returns True if this hex is walkable.
	 */
	isWalkable(
		size: number,
		id: number,
		ignoreReachable: boolean = false,
		debug: boolean = false,
	): boolean {
		let blocked = false;

		for (let i = 0; i < size; i++) {
			// For each Hex of the creature
			if (this.x - i >= 0 && this.x - i < this.grid.hexes[this.y].length) {
				//if hex exists
				const hex = this.grid.hexes[this.y][this.x - i];
				// Verify if blocked. If it's blocked by one attribute, OR statement will keep it status
				blocked = blocked || hex.blocked;

				if (!ignoreReachable) {
					blocked = blocked || !hex.reachable;
				}

				let isNotMovingCreature: boolean;
				if (hex.creature instanceof Creature) {
					isNotMovingCreature = hex.creature.id !== id;
					blocked = blocked || isNotMovingCreature; // Not blocked if this block contains the moving creature
				}
				if (debug) {
					console.log({ isNotMovingCreature });
				}
			} else {
				if (debug) {
					console.log('BLOCKED BY GRID BOUNDARIES', this);
				}
				// Blocked by grid boundaries
				blocked = true;
			}
		}

		return !blocked; // Its walkable if it's NOT blocked
	}

	/* setReachable()
	 *
	 * Set Hex.reachable to True for this hex
	 */
	setReachable(): void {
		this.reachable = true;
	}

	/* unsetReachable()
	 *
	 * Set Hex.reachable to False for this hex
	 */
	unsetReachable(): void {
		this.reachable = false;
	}

	unsetNotTarget() {
		// No-Op function.
	}

	setNotTarget() {
		// No-Op function.
	}

	/** Add a trap to a hex.
	 * @param {string} type - name of sprite to use; see Phaser.load.image usage
	 * @param {array} effects - effects to activate when trap triggered
	 * @param {Object} owner - owner of trap
	 * @param {Object} opt - optional arguments merged into the Trap object
	 *
	 * @returns {Trap} trap
	 *
	 * Examples:
	 * - turnLifetime
	 * - fullTurnLifetime
	 * - ownerCreature
	 * - destroyOnActivate
	 * - typeOver
	 */
	abstract createTrap(type: string, effects: Effect[], owner: string, opt: any): Trap;

	activateTrap(trigger: RegExp, target: any) {
		if (!this.trap) {
			return;
		}

		this.trap.effects.forEach((effect) => {
			// @ts-ignore
			if (trigger.test(effect.trigger) && effect.requireFn()) {
				this.game.log('Trap triggered');
				effect.activate(target);
			}
		});

		if (this.trap && this.trap.destroyOnActivate) {
			this.destroyTrap();
		}
	}

	destroyTrap() {
		if (!this.trap) {
			return;
		}

		delete this.grid.traps[this.trap.id];
		this.trap.destroy();
		delete this.trap;
	}

	//---------DROP FUNCTION---------//
	pickupDrop(creature) {
		if (!this.drop) {
			return;
		}

		this.drop.pickup(creature);
	}

	/**
	 * Override toJSON to avoid circular references when outputting to game log
	 * Used by game log only
	 *
	 * @returns {Object} coordinates
	 * @returns {number} coordinates.x
	 * @returns {number} coordinates.y
	 */
	toJSON(): { x: number; y: number } {
		return {
			x: this.x,
			y: this.y,
		};
	}
} // End of Hex Class
