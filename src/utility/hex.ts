import * as $j from 'jquery';
import { Trap } from './trap';
import { Drop } from '../drop';
import { Creature } from '../creature';
import { HexGrid } from './hexgrid';
import Game from '../game';
import Phaser, { Point, Polygon } from 'phaser-ce';
import { DEBUG } from '../debug';
import { getPointFacade } from './pointfacade';
import * as Const from './const';
import { Effect } from '../effect';
import { Player } from '../player';

export enum Direction {
	None = -1,
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
	 * Set to true if accessible by current action.
	 */
	reachable: boolean;
	direction: Direction;
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
	hitBox: Phaser.Sprite;
	display: Phaser.Sprite;
	overlay: Phaser.Sprite;
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
		this.reachable = true;
		this.direction = Direction.None; // Used for queryDirection
		this.displayClasses = '';
		this.overlayClasses = '';

		this.width = Const.HEX_WIDTH_PX;
		this.height = Const.HEX_HEIGHT_PX;
		this.displayPos = Const.offsetCoordsToPx({ x, y });

		this.originalDisplayPos = $j.extend({}, this.displayPos);

		this.tween = null;

		if (grid) {
			// NOTE: Set up hex hitBox and display/overlay elements.

			// NOTE: (Hack) 10px is the offset from the old version.
			const x = this.displayPos.x - 10;
			const y = this.displayPos.y;

			this.hitBox = grid.hexesGroup.create(x, y, 'hex');
			this.hitBox.alpha = 0;
			this.hitBox.inputEnabled = true;
			this.hitBox.ignoreChildInput = true;
			this.hitBox.input.useHandCursor = false;

			{
				// NOTE: Set up hexagonal hitArea for hitBox
				const angleStep = Math.PI / 3;
				const angleStart = angleStep * 0.5;
				const angles = [0, 1, 2, 3, 4, 5, 6].map((i) => angleStart - i * angleStep);
				// NOTE: The coefficients below are "magic"; tested in-game.
				const [radius_w, radius_h] = [0.58 * this.width, 0.69 * this.height];
				const [offset_x, offset_y] = [radius_w + 2, radius_h + 9];
				const points = angles.map(
					(angle) =>
						new Point(Math.cos(angle) * radius_w + offset_x, Math.sin(angle) * radius_h + offset_y),
				);
				this.hitBox.hitArea = new Polygon(points);
			}

			this.display = grid.displayHexesGroup.create(x, y, 'hex');
			this.display.alpha = 0;

			this.overlay = grid.overlayHexesGroup.create(x, y, 'hex');
			this.overlay.alpha = 0;

			// Binding Events
			this.hitBox.events.onInputOver.add(() => {
				if (game.freezedInput || game.UI.dashopen) {
					return;
				}
				game.signals.hex.dispatch('over', { hex: this });
				grid.selectedHex = this;
				this.onSelectFn(this);
			}, this);

			this.hitBox.events.onInputOut.add((_, pointer) => {
				if (game.freezedInput || game.UI.dashopen || !pointer.withinGame) {
					return;
				}

				game.signals.hex.dispatch('out', { hex: this });

				grid.clearHexViewAlterations();
				this.onHoverOffFn(this);
			}, this);

			this.hitBox.events.onInputUp.add((Sprite, Pointer) => {
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
	}

	/**
	 * @deprecated Use getPointFacade().getTrapsAt({x, y});
	 */
	get trap() {
		const traps = getPointFacade().getTrapsAt(this);
		return traps.length > 0 ? traps[0] : undefined;
	}

	/**
	 * @deprecated Use new Drop();
	 */
	set drop(d) {
		new Drop(d.name, d.alterations, d.x, d.y, d.game);
	}

	/**
	 * @deprecated Use getPointFacade().getDropsAt({x, y});
	 */
	get drop(): Drop | undefined {
		const drops = getPointFacade().getDropsAt(this);
		return drops.length > 0 ? drops[0] : undefined;
	}

	/**
	 * @deprecated Use getPointFacade().getCreaturesAt({x, y});
	 */
	get creature(): Creature | undefined {
		const creatures = getPointFacade().getCreaturesAt(this.x, this.y);
		return creatures.length ? creatures[0] : undefined;
	}

	/**
	 * @deprecated There's no longer a need to set hex.creature. Simply update the creature.
	 */
	set creature(creature: Creature) {
		// NOTE: solely for compatability.
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

	/**
	 * This function return an array containing all hexes of the grid
	 * at the distance given of the current hex.
	 * @param {number} distance - Integer distance form the current hex
	 * @returns {Array} Array containing hexes
	 */
	adjacentHex(distance: number): Array<Hex> {
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

	/**
	 * Add ghosted class to creature on hexes behind this hex
	 */
	ghostOverlap() {
		const grid = this.grid || this.game.grid;
		let ghostedCreature;

		for (let i = 1; i <= 3; i++) {
			if (this.y % 2 == 0) {
				if (i == 1) {
					for (let j = 0; j <= 1; j++) {
						if (grid.hexExists({ y: this.y + i, x: this.x + j })) {
							if (grid.hexes[this.y + i][this.x + j].creature instanceof Creature) {
								ghostedCreature = grid.hexes[this.y + i][this.x + j].creature;
							}
						}
					}
				} else {
					if (grid.hexExists({ y: this.y + i, x: this.x })) {
						if (grid.hexes[this.y + i][this.x].creature instanceof Creature) {
							ghostedCreature = grid.hexes[this.y + i][this.x].creature;
						}
					}
				}
			} else {
				if (i == 1) {
					for (let j = 0; j <= 1; j++) {
						if (grid.hexExists({ y: this.y + i, x: this.x - j })) {
							if (grid.hexes[this.y + i][this.x - j].creature instanceof Creature) {
								ghostedCreature = grid.hexes[this.y + i][this.x - j].creature;
							}
						}
					}
				} else {
					if (grid.hexExists({ y: this.y + i, x: this.x })) {
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

	/**
	 * This function reset all the pathfinding attribute to
	 * 0 to calculate new path to another hex.
	 * @param{boolean} includeG - Set includeG to True if you change the start of the calculated path.
	 */
	cleanPathAttr(includeG: boolean) {
		this.f = 0;
		this.g = includeG ? 0 : this.g;
		this.h = 0;
		this.pathparent = null;
	}

	/**
	 * Can the ORIGIN (the right-most point) of the Creature with the passed ID
	 * stand on this Hex without being out of bounds or overlapping an obstacle?
	 * If `ignoreReachable` is false, also check the Hex's reachable value.
	 * @param {number} size - Size of the creature.
	 * @param {number} id - ID of the creature.
	 * @param {boolean} ignoreReachable - Take into account the reachable property.
	 * @param {boolean} debug - If true and const.DEBUG is true, print debug information to the console.
	 * @returns True if this hex is walkable.
	 */
	isWalkable(size: number, id: number, ignoreReachable = false, debug = false) {
		// NOTE: If not in DEBUG mode, don't debug.
		debug = DEBUG && debug;

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

	/**
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

	/**
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

	/**
	 * Clear the appearance of the display hex
	 */
	cleanDisplayVisualState(classes = '') {
		classes =
			classes || 'adj hover creature player0 player1 player2 player3 dashed shrunken deadzone';
		const a = classes.split(' ');

		for (let i = 0, len = a.length; i < len; i++) {
			const regex = new RegExp('\\b' + a[i] + '\\b', 'g');
			this.displayClasses = this.displayClasses.replace(regex, '');
		}

		this.displayClasses = this.displayClasses.trim();

		this.updateStyle();
	}

	/**
	 * Set Hex.reachable to True for this hex and change $display class
	 */
	setReachable() {
		this.reachable = true;
		this.hitBox.input.useHandCursor = true;
		this.updateStyle();
	}

	/**
	 * Set Hex.reachable to False for this hex and change $display class
	 */
	unsetReachable() {
		this.reachable = false;
		this.hitBox.input.useHandCursor = false;
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
		targetAlpha = Boolean(this.displayClasses.match(/deadzone/g)) || targetAlpha;

		if (this.displayClasses.match(/0|1|2|3/)) {
			const player = this.displayClasses.match(/0|1|2|3/);
			this.display.loadTexture(`hex_p${player}`);
			this.grid.displayHexesGroup.bringToTop(this.display);
		} else if (this.displayClasses.match(/adj/)) {
			this.display.loadTexture('hex_path');
		} else if (this.displayClasses.match(/dashed/)) {
			this.display.loadTexture('hex_dashed');
		} else if (this.displayClasses.match(/deadzone/)) {
			this.display.loadTexture('hex_deadzone');
		} else {
			this.display.loadTexture('hex');
		}

		this.display.alpha = targetAlpha ? 1 : 0;

		if (this.displayClasses.match(/shrunken/)) {
			this.display.scale.setTo(shrinkScale);
			this.overlay.scale.setTo(shrinkScale);
			this.display.alignIn(this.hitBox, Phaser.CENTER);
			this.overlay.alignIn(this.hitBox, Phaser.CENTER);
		} else {
			this.display.scale.setTo(1);
			this.overlay.scale.setTo(1);
			this.display.alignIn(this.hitBox, Phaser.CENTER);
			this.overlay.alignIn(this.hitBox, Phaser.CENTER);
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
				this.coordText.anchor.setTo(0.5);
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

	/**
	 * Add a trap to a hex.
	 * @param {string} type - name of sprite to use; see Phaser.load.image usage
	 * @param {array} effects - effects to activate when trap triggered
	 * @param {Object} owner - owner of trap
	 * @param {Object} opt - optional arguments merged into the Trap object
	 * @returns {Trap} trap
	 * Examples:
	 * - turnLifetime
	 * - fullTurnLifetime
	 * - ownerCreature
	 * - destroyOnActivate
	 * - typeOver
	 *
	 * @deprecated Use new Trap(x, y, type, effects, own, opt, game)
	 */
	createTrap(type: string, effects: Effect[], owner: Player, opt: Partial<Trap> = {}): Trap {
		return new Trap(this.x, this.y, type, effects, owner, opt, this.game);
	}

	/**
	 * @param trigger
	 * @param target
	 * @deprecated: use PointFacade - e.g., getPointFacade().getTrapsAt(point).forEach(trap => trap.activate(trigger, target))
	 */
	activateTrap(trigger, target) {
		this.trap?.activate(trigger, target);
	}

	/**
	 * @returns void
	 * @deprecated Traps are no longer held in a Hex. user PointFacade - e.g., getPointFacade().getTrapsAt(point).forEach(trap => trap.destroy());
	 */
	destroyTrap() {
		this.trap?.destroy();
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
	 * Used by game log only.
	 * @returns {{x:number, y:number}} x/y coordinates
	 */
	toJSON() {
		return {
			x: this.x,
			y: this.y,
		};
	}
} // End of Hex Class
