import * as $j from 'jquery';
import { Trap } from './trap';
import { Creature } from '../creature';
import { HexGrid } from './hexgrid';
import Game from '../game';
import Phaser from 'phaser-ce';
import { Drop } from '../drops';

export enum Direction {
	UpRight = 0,
	Right = 1,
	DownRight = 2,
	DownLeft = 3,
	Left = 4,
	UpLeft = 5,
}

const shrinkScale = 0.5;

/**
 * Object containing hex information and positions.
 */
export class Hex {
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
	displayClasses: string;
	overlayClasses: string;
	width: number;
	height: number;

	/**
	 * Pos object to position creature with absolute coordinates {left,top}.
	 */
	displayPos: { x: number; y: number };

	originalDisplayPos: { x: number; y: number };
	tween: Phaser.Tween;
	container: Phaser.Sprite;
	display: Phaser.Sprite;
	overlay: Phaser.Sprite;
	input: Phaser.Sprite;
	trap: Trap;
	coordText: Phaser.Text;

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

		// Horizontal hex grid, width is distance between opposite sides
		this.width = 90;
		this.height = (this.width / Math.sqrt(3)) * 2 * 0.75;
		this.displayPos = {
			x: (y % 2 === 0 ? x + 0.5 : x) * this.width,
			y: y * this.height,
		};

		this.originalDisplayPos = $j.extend({}, this.displayPos);

		this.tween = null;

		if (grid) {
			/* Sprite to "group" the display, overlay, and input sprites for relative
			positioning and scaling. */
			this.container = grid.hexesGroup.create(
				// 10px is the offset from the old version
				this.displayPos.x - 10,
				this.displayPos.y,
				'hex',
			);
			this.container.alpha = 0;

			this.display = grid.displayHexesGroup.create(0, 0, 'hex');
			this.display.alignIn(this.container, Phaser.CENTER);
			this.display.alpha = 0;

			this.overlay = grid.overlayHexesGroup.create(0, 0, 'hex');
			this.overlay.alignIn(this.container, Phaser.CENTER);
			this.overlay.alpha = 0;

			this.input = grid.inputHexesGroup.create(0, 0, 'input');
			this.input.alignIn(this.container, Phaser.TOP_LEFT);
			this.input.inputEnabled = true;
			this.input.input.pixelPerfectClick = true;
			this.input.input.pixelPerfectAlpha = 1;
			this.input.input.useHandCursor = false;

			// Binding Events
			this.input.events.onInputOver.add(() => {
				if (game.freezedInput || game.UI.dashopen) {
					return;
				}

				grid.selectedHex = this;
				this.onSelectFn(this);
			}, this);

			this.input.events.onInputOut.add((_, pointer) => {
				if (game.freezedInput || game.UI.dashopen || !pointer.withinGame) {
					return;
				}

				grid.clearHexViewAlterations();
				this.onHoverOffFn(this);
			}, this);

			this.input.events.onInputUp.add((Sprite, Pointer) => {
				if (game.freezedInput || game.UI.dashopen) {
					return;
				}

				switch (Pointer.button) {
					case 0:
						// Left mouse button pressed
						this.onConfirmFn(this);
						break;
					case 1:
						// Middle mouse button pressed
						break;
					case 2:
						// Right mouse button pressed
						this.onRightClickFn(this);
						break;
				}
			}, this);
		}

		this.displayPos.y = this.displayPos.y * 0.75 + 30;

		this.trap = undefined;
	}

	onSelectFn(arg0: this) {
		// No-op function.
	}

	onHoverOffFn(arg0: this) {
		// No-op function.
	}

	onConfirmFn(arg0: this) {
		// No-op function.
	}

	onRightClickFn(arg0: this) {
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
	adjacentHex(distance) {
		const adjHex = [];

		for (let i = -distance; i <= distance; i++) {
			const deltaY = i;
			let startX;
			let endX;

			if (this.y % 2 == 0) {
				// Evenrow
				startX = Math.ceil(Math.abs(i) / 2) - distance;
				endX = distance - Math.floor(Math.abs(i) / 2);
			} else {
				// Oddrow
				startX = Math.floor(Math.abs(i) / 2) - distance;
				endX = distance - Math.ceil(Math.abs(i) / 2);
			}

			for (let deltaX = startX; deltaX <= endX; deltaX++) {
				const x = this.x + deltaX;
				const y = this.y + deltaY;

				// Exclude current hex
				if (deltaY == 0 && deltaX == 0) {
					continue;
				}

				if (y < this.grid.hexes.length && y >= 0 && x < this.grid.hexes[y].length && x >= 0) {
					// Exclude inexisting hexes
					adjHex.push(this.grid.hexes[y][x]);
				}
			}
		}

		return adjHex;
	}

	/* ghostOverlap()
	 *
	 * add ghosted class to creature on hexes behind this hex
	 */
	ghostOverlap() {
		const grid = this.grid || this.game.grid;
		let ghostedCreature;

		for (let i = 1; i <= 3; i++) {
			if (this.y % 2 == 0) {
				if (i == 1) {
					for (let j = 0; j <= 1; j++) {
						if (grid.hexExists(this.y + i, this.x + j)) {
							if (grid.hexes[this.y + i][this.x + j].creature instanceof Creature) {
								ghostedCreature = grid.hexes[this.y + i][this.x + j].creature;
							}
						}
					}
				} else {
					if (grid.hexExists(this.y + i, this.x)) {
						if (grid.hexes[this.y + i][this.x].creature instanceof Creature) {
							ghostedCreature = grid.hexes[this.y + i][this.x].creature;
						}
					}
				}
			} else {
				if (i == 1) {
					for (let j = 0; j <= 1; j++) {
						if (grid.hexExists(this.y + i, this.x - j)) {
							if (grid.hexes[this.y + i][this.x - j].creature instanceof Creature) {
								ghostedCreature = grid.hexes[this.y + i][this.x - j].creature;
							}
						}
					}
				} else {
					if (grid.hexExists(this.y + i, this.x)) {
						if (grid.hexes[this.y + i][this.x].creature instanceof Creature) {
							ghostedCreature = grid.hexes[this.y + i][this.x].creature;
						}
					}
				}
			}

			if (ghostedCreature instanceof Creature) {
				ghostedCreature.xray(true);
			}
		}
	}

	/* cleanPathAttr(includeG)
	 *
	 * includeG : 	Boolean : 	Set includeG to True if you change the start of the calculated path.
	 *
	 * This function reset all the pathfinding attribute to
	 * 0 to calculate new path to another hex.
	 */
	cleanPathAttr(includeG) {
		this.f = 0;
		this.g = includeG ? 0 : this.g;
		this.h = 0;
		this.pathparent = null;
	}

	/* isWalkable(size, id)
	 *
	 * size : 				Integer : 	Size of the creature
	 * id : 				Integer : 	ID of the creature
	 * ignoreReachable : 	Boolean : 	Take into account the reachable property
	 *
	 * return : 	Boolean : 	True if this hex is walkable
	 */
	isWalkable(size, id, ignoreReachable = false) {
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

				let isNotMovingCreature;
				if (hex.creature instanceof Creature) {
					if (id instanceof Array) {
						isNotMovingCreature = id.indexOf(hex.creature.id) == -1;
					} else {
						isNotMovingCreature = hex.creature.id != id;
					}

					blocked = blocked || isNotMovingCreature; // Not blocked if this block contains the moving creature
				}
			} else {
				// Blocked by grid boundaries
				blocked = true;
			}
		}

		return !blocked; // Its walkable if it's NOT blocked
	}

	/* overlayVisualState
	 *
	 * Change the appearance of the overlay hex
	 */
	overlayVisualState(classes) {
		classes = classes ? classes : '';
		this.overlayClasses += ' ' + classes + ' ';
		this.updateStyle();
	}

	/**
	 * Change the appearance of a display hex.
	 *
	 * @param {string} classes Display classes to be added to the Hex.
	 */
	displayVisualState(classes = '') {
		this.displayClasses = `${this.displayClasses} ${classes}`.trim();
		this.updateStyle();
	}

	/* cleanOverlayVisualState
	 *
	 * Clear the appearance of the overlay hex
	 */
	cleanOverlayVisualState(classes = '') {
		classes =
			classes ||
			'creature weakDmg active moveto selected hover h_player0 h_player1 h_player2 h_player3 player0 player1 player2 player3';
		const a = classes.split(' ');

		for (let i = 0, len = a.length; i < len; i++) {
			const regex = new RegExp('\\b' + a[i] + '\\b', 'g');
			this.overlayClasses = this.overlayClasses.replace(regex, '');
		}

		this.updateStyle();
	}

	/* cleanDisplayVisualState
	 *
	 * Clear the appearance of the display hex
	 */
	cleanDisplayVisualState(classes = '') {
		classes = classes || 'adj hover creature player0 player1 player2 player3 dashed shrunken';
		const a = classes.split(' ');

		for (let i = 0, len = a.length; i < len; i++) {
			const regex = new RegExp('\\b' + a[i] + '\\b', 'g');
			this.displayClasses = this.displayClasses.replace(regex, '');
		}

		this.displayClasses = this.displayClasses.trim();

		this.updateStyle();
	}

	/* setReachable()
	 *
	 * Set Hex.reachable to True for this hex and change $display class
	 */
	setReachable() {
		this.reachable = true;
		this.input.input.useHandCursor = true;
		this.updateStyle();
	}

	/* unsetReachable()
	 *
	 * Set Hex.reachable to False for this hex and change $display class
	 */
	unsetReachable() {
		this.reachable = false;
		this.input.input.useHandCursor = false;
		this.updateStyle();
	}

	unsetNotTarget() {
		this.displayClasses = this.displayClasses.replace(/\bhidden\b/g, '');
		this.updateStyle();
	}

	setNotTarget() {
		this.displayClasses += ' hidden ';
		this.updateStyle();
	}

	updateStyle() {
		// Display Hex
		let targetAlpha = this.reachable || Boolean(this.displayClasses.match(/creature/g));

		targetAlpha = !this.displayClasses.match(/hidden/g) && targetAlpha;
		targetAlpha = Boolean(this.displayClasses.match(/showGrid/g)) || targetAlpha;
		targetAlpha = Boolean(this.displayClasses.match(/dashed/g)) || targetAlpha;

		if (this.displayClasses.match(/0|1|2|3/)) {
			const player = this.displayClasses.match(/0|1|2|3/);
			this.display.loadTexture(`hex_p${player}`);
			this.grid.displayHexesGroup.bringToTop(this.display);
		} else if (this.displayClasses.match(/adj/)) {
			this.display.loadTexture('hex_path');
		} else if (this.displayClasses.match(/dashed/)) {
			this.display.loadTexture('hex_dashed');
		} else {
			this.display.loadTexture('hex');
		}

		this.display.alpha = targetAlpha ? 1 : 0;

		if (this.displayClasses.match(/shrunken/)) {
			this.display.scale.setTo(shrinkScale, shrinkScale);
			this.overlay.scale.setTo(shrinkScale, shrinkScale);
			this.display.alignIn(this.container, Phaser.CENTER);
			this.overlay.alignIn(this.container, Phaser.CENTER);
			// Input sprite isn't shrunk, the click area is the original size of the hex.
		} else {
			this.display.scale.setTo(1, 1);
			this.overlay.scale.setTo(1, 1);
			this.display.alignIn(this.container, Phaser.CENTER);
			this.overlay.alignIn(this.container, Phaser.CENTER);
		}

		// Display Coord
		if (this.displayClasses.match(/showGrid/g)) {
			if (!(this.coordText && this.coordText.exists)) {
				this.coordText = this.game.Phaser.add.text(
					this.originalDisplayPos.x + 45,
					this.originalDisplayPos.y + 63,
					this.coord,
					{
						font: '30pt Play',
						fill: '#000000',
						align: 'center',
					},
				);
				this.coordText.anchor.setTo(0.5, 0.5);
				this.grid.overlayHexesGroup.add(this.coordText);
			}
		} else if (this.coordText && this.coordText.exists) {
			this.coordText.destroy();
		}

		// Overlay Hex
		targetAlpha = Boolean(this.overlayClasses.match(/hover|creature/g));

		if (this.overlayClasses.match(/0|1|2|3/)) {
			const player = this.overlayClasses.match(/0|1|2|3/);

			if (this.overlayClasses.match(/hover/)) {
				this.overlay.loadTexture('hex_path');
			} else {
				this.overlay.loadTexture(`hex_p${player}`);
			}

			this.grid.overlayHexesGroup.bringToTop(this.overlay);
		} else {
			this.overlay.loadTexture('cancel');
		}

		this.overlay.alpha = targetAlpha ? 1 : 0;
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
	createTrap(type, effects, owner, opt) {
		if (this.trap) {
			this.destroyTrap();
		}

		this.trap = new Trap(this.x, this.y, type, effects, owner, opt, this.game);
		return this.trap;
	}

	activateTrap(trigger, target) {
		if (!this.trap) {
			return;
		}

		this.trap.effects.forEach((effect) => {
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
	toJSON() {
		return {
			x: this.x,
			y: this.y,
		};
	}
} // End of Hex Class
