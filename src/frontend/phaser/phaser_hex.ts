import $j from 'jquery';
import { Creature } from '../../creature';
import { Effect } from '../../effect';
import Game from '../../game';
import { Hex } from '../hex';
import { HexGrid } from '../hexgrid';
import { Trap } from '../trap';
import { PhaserHexGrid } from './phaser_hexgrid';
import { PhaserTrap } from './phaser_trap';

const shrinkScale = 0.5;

export class PhaserHex extends Hex {
	tween: Phaser.Tween;
	container: Phaser.Sprite;
	display: Phaser.Sprite;
	overlay: Phaser.Sprite;
	input: Phaser.Sprite;
	coordText: Phaser.Text;

	/**
	 *
	 * @param x Hex coordinates
	 * @param y Hex coordinates
	 * @param grid
	 * @param game
	 */
	constructor(x: number, y: number, grid: HexGrid, game?: Game) {
		super(x, y, grid, game);

		// Horizontal hex grid, width is distance between opposite sides
		this.width = 90;
		this.height = (this.width / Math.sqrt(3)) * 2 * 0.75;
		this.displayPos = {
			x: (y % 2 === 0 ? x + 0.5 : x) * this.width,
			y: y * this.height,
		};

		this.originalDisplayPos = $j.extend({}, this.displayPos);

		if (grid && grid instanceof PhaserHexGrid) {
			const phaserHexGrid = grid as PhaserHexGrid;

			/* Sprite to "group" the display, overlay, and input sprites for relative
			positioning and scaling. */
			this.container = phaserHexGrid.hexesGroup.create(
				// 10px is the offset from the old version
				this.displayPos.x - 10,
				this.displayPos.y,
				'hex',
			);
			this.container.alpha = 0;

			this.display = phaserHexGrid.displayHexesGroup.create(0, 0, 'hex');
			this.display.alignIn(this.container, Phaser.CENTER);
			this.display.alpha = 0;

			this.overlay = phaserHexGrid.overlayHexesGroup.create(0, 0, 'hex');
			this.overlay.alignIn(this.container, Phaser.CENTER);
			this.overlay.alpha = 0;

			this.input = phaserHexGrid.inputHexesGroup.create(0, 0, 'input');
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

			this.displayPos.y = this.displayPos.y * 0.75 + 30;
		}
	}

	/**
	 * adjacentHex(distance)
	 *
	 * distance : 	integer : 	Distance form the current hex
	 *
	 * return : 	Array : 	Array containing hexes
	 *
	 * This function return an array containing all hexes of the grid
	 * at the distance given of the current hex.
	 */
	adjacentHex(distance: number) {
		const adjHex = [];

		for (let i = -distance; i <= distance; i++) {
			const deltaY = i;
			let startX: number;
			let endX: number;

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
	 * ghostOverlap()
	 *
	 * add ghosted class to creature on hexes behind this hex
	 */
	override ghostOverlap() {
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

	override createTrap(type: string, effects: Effect[], owner: string, opt: any): Trap {
		if (this.trap) {
			this.destroyTrap();
		}

		this.trap = new PhaserTrap(this.x, this.y, type, effects, owner, opt, this.game);
		return this.trap;
	}

	/**
	 * overlayVisualState
	 *
	 * Change the appearance of the overlay hex
	 */
	overlayVisualState(classes: string) {
		classes = classes ? classes : '';
		this.overlayClasses += ' ' + classes + ' ';
		this.updateStyle();
	}

	/**
	 * Change the appearance of a display hex.
	 *
	 * @param {string} classes Display classes to be added to the Hex.
	 */
	displayVisualState(classes: string = '') {
		this.displayClasses = `${this.displayClasses} ${classes}`.trim();
		this.updateStyle();
	}

	/**
	 * cleanOverlayVisualState
	 *
	 * Clear the appearance of the overlay hex
	 */
	cleanOverlayVisualState(classes: string = '') {
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
	 * cleanDisplayVisualState
	 *
	 * Clear the appearance of the display hex
	 */
	cleanDisplayVisualState(classes: string = '') {
		classes = classes || 'adj hover creature player0 player1 player2 player3 dashed shrunken';
		const a = classes.split(' ');

		for (let i = 0, len = a.length; i < len; i++) {
			const regex = new RegExp('\\b' + a[i] + '\\b', 'g');
			this.displayClasses = this.displayClasses.replace(regex, '');
		}

		this.displayClasses = this.displayClasses.trim();

		this.updateStyle();
	}

	/**
	 * setReachable()
	 *
	 * Set Hex.reachable to True for this hex and change $display class
	 */
	setReachable() {
		this.reachable = true;
		this.input.input.useHandCursor = true;
		this.updateStyle();
	}

	/**
	 * unsetReachable()
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
			(this.grid as PhaserHexGrid).displayHexesGroup.bringToTop(this.display);
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
				// TODO: Cast to PhaserGame implementation
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
				(this.grid as PhaserHexGrid).overlayHexesGroup.add(this.coordText);
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

			(this.grid as PhaserHexGrid).overlayHexesGroup.bringToTop(this.overlay);
		} else {
			this.overlay.loadTexture('cancel');
		}

		this.overlay.alpha = targetAlpha ? 1 : 0;
	}
}
