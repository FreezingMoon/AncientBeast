import $j from 'jquery';
import { Trap } from './trap';
import { Drop } from '../drop';
import { Creature } from '../creature';
import { HexGrid } from './hexgrid';
import Game from '../game';
import { tryGetPhaser } from '../phaser/runtime';
import type { TweenHandle, SpriteHandle } from '../engine/types';
import { ALIGN_CENTER } from '../engine/Phaser4Handles';
import { DEBUG } from '../debug';
import { getPointFacade } from './pointfacade';
import * as Const from './const';
import { Effect } from '../effect';
import { Player } from '../player';
import {
	clearHoveredHex,
	isPointerWithinBoard,
	onPointerOut,
	onPointerOver,
	onPointerUp,
	rejectIfTurnFrozen,
	setHoveredHex,
} from '../input/input';
import { setHandCursor } from '../game-display/cursor';

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
 * Word-boundary matcher for a single CSS class token, memoised.
 *
 * `cleanOverlayVisualState` / `cleanDisplayVisualState` strip a list of class
 * tokens off a hex on every hover sweep, and each token used to build a fresh
 * `new RegExp('\\b' + token + '\\b', 'g')` inline. With ~13 tokens on the
 * overlay plus ~9 on the display, and `updateDisplay()` running that over every
 * hex on the board for every `queryHexes()` call, that was thousands of RegExp
 * compilations per hover.
 *
 * The set of tokens is drawn from a handful of fixed class-name lists, so the
 * compiled matchers are cached and reused.
 */
const classTokenMatchers = new Map<string, RegExp>();

/** Remove every occurrence of `token` from `classString` as a whole word. */
function stripClassToken(classString: string, token: string): string {
	if (!token) {
		return classString;
	}
	let matcher = classTokenMatchers.get(token);
	if (!matcher) {
		matcher = new RegExp('\\b' + token + '\\b', 'g');
		classTokenMatchers.set(token, matcher);
	}
	// A shared global regex carries `lastIndex` between uses; `replace` resets it
	// for us, but a bail-out before the replace would not, so clear it up front.
	matcher.lastIndex = 0;
	return classString.replace(matcher, '');
}

// Legacy leftward shift retained from the old version; see the constructor.
const HEX_DISPLAY_X_HACK = 10;

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
	forcedDisplayAlpha: number | undefined;
	forcedCreatureOverlayAlpha: number | undefined;
	forcedHidden: boolean;
	width: number;
	height: number;

	/**
	 * Pos object to position creature with absolute coordinates {left,top}.
	 */
	displayPos: { x: number; y: number };

	/**
	 * Set to true if cursor is outside movement range.
	 */
	isSpinning: boolean;

	/**
	 * Store ID of animation frame request.
	 */
	spinRequest: number;

	originalDisplayPos: { x: number; y: number };
	tween: TweenHandle | null;
	hitBox: SpriteHandle;
	display: SpriteHandle;
	overlay: SpriteHandle;
	coordText: any;

	/**
	 *
	 * @param x Hex coordinates
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
		this.forcedDisplayAlpha = undefined;
		this.forcedCreatureOverlayAlpha = undefined;
		this.forcedHidden = false;

		this.width = Const.HEX_WIDTH_PX;
		this.height = Const.HEX_HEIGHT_PX;
		this.displayPos = Const.offsetCoordsToPx({ x, y });

		this.originalDisplayPos = $j.extend({}, this.displayPos);

		this.isSpinning = false;
		this.spinRequest = null;

		this.tween = null;

		if (grid) {
			const shouldUseDirectTouchInput = () => !game.gameEngine.device.desktop;

			// NOTE: Set up hex hitBox and display/overlay elements.

			// NOTE: (Hack) 10px is the offset from the old version.
			// Top-left of the hex artwork in grid space. The grid group carries a
			// 0.75 vertical scale, so this uses the pre-rescale y
			// (`originalDisplayPos`), not the squashed `displayPos`.
			const x = this.originalDisplayPos.x - HEX_DISPLAY_X_HACK;
			const y = this.originalDisplayPos.y;

			this.hitBox = grid.hexesGroup.create(x, y, 'hex');
			this.hitBox.alpha = 0;
			// A hex is the board's only interactive surface, so it is made
			// interactive once here and left enabled; the turn gate decides what a
			// gesture means rather than whether the object is listening.
			this.hitBox.setInteractive();
			// The hex artwork carries no children, so the Phaser 2 CE
			// `ignoreChildInput` toggle has nothing to do in Phaser 4.
			setHandCursor(this.hitBox, false);
			this.pinTopLeft(this.hitBox, x, y);

			{
				// NOTE: Set up hexagonal hitArea for hitBox
				const angleStep = Math.PI / 3;
				const angleStart = angleStep * 0.5;
				const angles = [0, 1, 2, 3, 4, 5, 6].map((i) => angleStart - i * angleStep);
				// NOTE: The coefficients below are "magic"; tested in-game.
				const [radius_w, radius_h] = [0.58 * this.width, 0.69 * this.height];
				const [offset_x, offset_y] = [radius_w + 2, radius_h + 9];
				// The hexagonal hit area only drives pointer hit-testing in a real
				// renderer; the headless `NullEngine` ignores it. Skip building it
				// when Phaser was never loaded (unit tests, authoritative server),
				// so this stays off the Phaser critical path there.
				const phaser = tryGetPhaser();
				if (phaser) {
					const { Math: PhaserMath, Geom } = phaser;
					const { Vector2 } = PhaserMath;
					const points = angles.map(
						(angle) =>
							new Vector2(
								Math.cos(angle) * radius_w + offset_x,
								Math.sin(angle) * radius_h + offset_y,
							),
					);
					// Phaser 4 no longer maps a shape to its own `contains` test, so
					// the polygon and the test that uses it are both supplied.
					const polygon = new Geom.Polygon(points);
					const hitArea = this.hitBox.input;
					if (hitArea) {
						hitArea.hitArea = polygon;
						hitArea.customHitArea = true;
						hitArea.hitAreaCallback = (_shape, hitX, hitY) => polygon.contains(hitX, hitY);
					}
				}
			}

			this.display = grid.displayHexesGroup.create(x, y, 'hex');
			this.display.alpha = 0;
			// Pin the artwork now rather than waiting for the first updateStyle(),
			// otherwise the hex renders one frame high while centred on its origin.
			this.pinTopLeft(this.display, x, y);

			this.overlay = grid.overlayHexesGroup.create(x, y, 'hex');
			this.overlay.alpha = 0;

			// Binding Events
			onPointerOver(this.hitBox, () => {
				grid.cancelDeferredActiveHexDashedClear();
				const previousMouseHex = grid.lastMouseHex;
				if (previousMouseHex && previousMouseHex !== this) {
					const previousCreature =
						previousMouseHex.creature instanceof Creature ? previousMouseHex.creature : undefined;
					const isSameCreatureHover =
						previousCreature &&
						this.creature instanceof Creature &&
						previousCreature.id === this.creature.id;

					if (previousCreature && !isSameCreatureHover) {
						grid.clearTransientCreatureHoverVisual(previousCreature);
					} else {
						grid.clearTransientHexHoverVisual(previousMouseHex);
					}
				}
				// Always track pointer position so refreshHoverState() knows which hex
				// to re-evaluate once freezedInput is cleared after an ability animation.
				// `lastMouseHex` is backed by the input module, so this is the one
				// place hover position is recorded.
				grid.lastMouseHex = this;

				if (rejectIfTurnFrozen(game)) return;

				if (!game.UI || game.UI.dashopen || shouldUseDirectTouchInput()) return;

				//  Show dashed overlay on current hexes of active creature
				if (this.reachable && game.activeCreature) {
					game.activeCreature.highlightCurrentHexesAsDashed();
				}

				game.channels.hex.emit('over', { hex: this });
				grid.selectedHex = this;
				this.onSelectFn(this);
			});

			onPointerOut(this.hitBox, () => {
				if (rejectIfTurnFrozen(game)) return;

				if (!game.UI || game.UI.dashopen || shouldUseDirectTouchInput()) return;

				// When the pointer leaves the game canvas entirely, still reset hover
				// state (e.g. stop the health indicator bounce animation) but skip
				// overlay/signal work.
				if (!isPointerWithinBoard()) {
					// Clear pointer tracking so refreshHoverState() won't fire on a stale hex.
					grid.lastMouseHex = undefined;
					if (this.creature instanceof Creature) {
						grid.clearTransientCreatureHoverVisual(this.creature);
					} else {
						grid.clearTransientHexHoverVisual(this);
					}
					this.onHoverOffFn(this);
					return;
				}

				// Clear dashed overlay when leaving a reachable hex
				if (this.reachable && game.activeCreature) {
					grid.scheduleDeferredActiveHexDashedClear();
				}

				game.channels.hex.emit('out', { hex: this });
				if (this.creature instanceof Creature) {
					grid.clearTransientCreatureHoverVisual(this.creature);
				} else {
					grid.clearTransientHexHoverVisual(this);
				}
				this.onHoverOffFn(this);
			});

			onPointerUp(this.hitBox, (pointer) => {
				if (rejectIfTurnFrozen(game)) return;

				if (!game.UI || game.UI.dashopen) return;

				const confirmSelectedHex = () => {
					this.onConfirmFn(this);
				};

				if (shouldUseDirectTouchInput()) {
					confirmSelectedHex();
					return;
				}

				switch (pointer.button) {
					case 1:
						// Middle mouse button pressed
						break;
					case 2:
						// Right mouse button pressed
						this.onRightClickFn(this);
						break;
					default:
						// Default to primary click so non-mouse pointers still confirm cleanly
						confirmSelectedHex();
						break;
				}
			});
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
		// NOTE: solely for compatibility.
	}

	onSelectFn(_: this) {
		// No-op function.
	}

	onHoverOffFn(_: this) {
		// No-op function.
	}

	onConfirmFn(_: this) {
		// No-op function.
	}

	onRightClickFn(_: this) {
		// No-op function.
	}

	updateHealth() {
		// No-op function. see game.ts -> triggerDeleteEffect()
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
	 * @param {Creature} [referenceCreature] - The creature being seen through to (active or hovered).
	 */
	ghostOverlap(referenceCreature?: Creature) {
		const grid = this.grid || this.game.grid;
		const seen = new Set<number>();

		if (!referenceCreature) {
			// Legacy: no reference, so scan standard pattern
			for (let dy = 1; dy <= 3; dy++) {
				const xBand = 6;
				for (let dx = -xBand; dx <= xBand; dx++) {
					const nx = this.x + dx;
					const ny = this.y + dy;
					if (!grid.hexExists({ y: ny, x: nx })) continue;
					const c = grid.hexes[ny][nx].creature;
					if (c instanceof Creature) {
						c.xray(true, referenceCreature);
					}
				}
			}

			for (let dx = -4; dx <= 4; dx++) {
				if (dx === 0) continue;
				if (!grid.hexExists({ y: this.y, x: this.x + dx })) continue;
				const c = grid.hexes[this.y][this.x + dx].creature;
				if (c instanceof Creature) {
					c.xray(true, referenceCreature);
				}
			}
			return;
		}

		// Reference creature provided: scan ALL creatures for visual sprite overlap
		const refSprite = referenceCreature.sprite;
		const refBounds = refSprite.getBounds();
		const refLeft = refBounds.x;
		const refTop = refBounds.y;
		const refRight = refBounds.x + refBounds.width;
		const refBottom = refBounds.y + refBounds.height;
		const creatureGroup = grid.creatureGroup;
		// `getIndex` is a child's position in the group's draw list, and -1 when it
		// is not a member. This must not be confused with the child's `depth`:
		// `orderCreatureZ` assigns depth from the grid band, so it encodes the
		// creature's *row* rather than its stack order. Reading depth here made
		// this "in front of" gate compare grid rows, so overlapping creatures on
		// the wrong side of the reference were never xrayed.
		let refZ = creatureGroup.getIndex(referenceCreature.grp);
		if (refZ === -1) {
			// Reference creature not in group yet, treat as always in front
			refZ = Infinity;
		}

		grid.game.creatures.forEach((candidate) => {
			if (!(candidate instanceof Creature)) return;
			if (candidate === referenceCreature) return;
			if (seen.has(candidate.id)) return;

			const candZ = creatureGroup.getIndex(candidate.grp);
			if (candZ === -1) {
				// Candidate not in group, skip it
				return;
			}
			if (candZ <= refZ) return;

			const candBounds = candidate.sprite.getBounds();
			const candLeft = candBounds.x;
			const candTop = candBounds.y;
			const candRight = candBounds.x + candBounds.width;
			const candBottom = candBounds.y + candBounds.height;

			// Check AABB overlap
			const overlaps = !(
				candRight <= refLeft ||
				candLeft >= refRight ||
				candBottom <= refTop ||
				candTop >= refBottom
			);

			if (overlaps) {
				seen.add(candidate.id);
				candidate.xray(true, referenceCreature);
			}
		});
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

		return !blocked; // It's walkable if it's NOT blocked
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
			'creature reachable weakDmg active moveto selected hover h_player0 h_player1 h_player2 h_player3 player0 player1 player2 player3';
		const a = classes.split(' ');

		for (let i = 0, len = a.length; i < len; i++) {
			this.overlayClasses = stripClassToken(this.overlayClasses, a[i]);
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
			this.displayClasses = stripClassToken(this.displayClasses, a[i]);
		}

		this.displayClasses = this.displayClasses.trim();

		this.updateStyle();
	}

	/**
	 * Set Hex.reachable to True for this hex and change $display class
	 */
	setReachable() {
		this.reachable = true;
		// Only show hand cursor if it's the local player's turn
		const isMyTurn = !this.game?.multiplayer || this.game?.lobby?.isMyTurn?.() !== false;
		setHandCursor(this.hitBox, isMyTurn);
		this.updateStyle();
	}

	/**
	 * Set Hex.reachable to False for this hex and change $display class
	 */
	unsetReachable() {
		this.reachable = false;
		setHandCursor(this.hitBox, false);
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

	/**
	 * Start spin effect for the targeting cursor
	 */
	startSpinning() {
		this.isSpinning = true;
		const spinSpeed = 2;

		const rotate = () => {
			if (!this.isSpinning) return;
			this.overlay.angle += spinSpeed;
			this.spinRequest = requestAnimationFrame(rotate);
		};

		this.spinRequest = requestAnimationFrame(rotate);
	}

	/**
	 * Stop spin effect for the targeting cursor
	 */
	stopSpinning() {
		this.isSpinning = false;
		if (this.spinRequest) {
			cancelAnimationFrame(this.spinRequest);
			this.spinRequest = null;
			this.overlay.angle = 0;
		}
	}

	/**
	 * Pin a hex sprite's top-left to the hex's draw point.
	 *
	 * These coordinates were authored against Phaser 2, where the hit area and
	 * the hex artwork share the same top-left and `anchor.setTo(0, 0)` left
	 * `x`/`y` alone, simply reinterpreting them as that top-left. Phaser 4
	 * differs on both counts:
	 *
	 * 1. `anchor.setTo(0, 0)` keeps the sprite's *rendered* top-left fixed and
	 *    shifts `x`/`y` by half the texture (55x62px for the base `hex`
	 *    texture), sliding the artwork up and to the left.
	 * 2. Sprites default to a centred origin here, where Phaser 2 placed these
	 *    top-left.
	 *
	 * Getting the hit area wrong also misplaced the overlay, which is positioned
	 * with `alignIn(this.hitBox, ...)` — that is the targeting cursor that spins
	 * while choosing a target. Both therefore have to be pinned, and to the same
	 * point, or the cursor and the hex it sits on drift apart.
	 *
	 * The `hitArea` polygon is unaffected: it is expressed in the sprite's own
	 * frame space, so it stays centred on the frame whichever origin is set.
	 */
	private pinTopLeft(sprite: SpriteHandle, x: number, y: number) {
		sprite.setOrigin(0, 0);
		sprite.x = x;
		sprite.y = y;
	}

	/**
	 * The hex's draw point, shared by the hit area and the artwork.
	 */
	private get drawPoint() {
		return {
			x: this.originalDisplayPos.x - HEX_DISPLAY_X_HACK,
			y: this.originalDisplayPos.y,
		};
	}

	updateStyle() {
		const loadTextureIfChanged = (sprite: SpriteHandle, key: string) => {
			if (sprite.key !== key) {
				sprite.setTexture(key);
			}
		};

		// Reset spinning state
		if (this.isSpinning) {
			this.stopSpinning();
		}

		// Display Hex
		let targetAlpha = this.reachable || Boolean(this.displayClasses.match(/creature/g));

		targetAlpha = !this.displayClasses.match(/hidden|teleportHidden/g) && targetAlpha;
		targetAlpha = Boolean(this.displayClasses.match(/showGrid/g)) || targetAlpha;
		targetAlpha = Boolean(this.displayClasses.match(/\badj\b/g)) || targetAlpha;
		targetAlpha = Boolean(this.displayClasses.match(/dashed/g)) || targetAlpha;
		targetAlpha = Boolean(this.displayClasses.match(/deadzone/g)) || targetAlpha;
		targetAlpha = Boolean(this.displayClasses.match(/\babilityRange\b/g)) || targetAlpha;

		if (this.displayClasses.match(/0|1|2|3/)) {
			const player = this.displayClasses.match(/0|1|2|3/);
			loadTextureIfChanged(this.display, `hex_p${player}`);
			this.grid.displayHexesGroup.bringToTop(this.display);
		} else if (this.displayClasses.match(/\babilityRange\b/)) {
			loadTextureIfChanged(this.display, 'ability_range');
			this.display.setOrigin(0.5, 0.5);
			this.grid.displayHexesGroup.bringToTop(this.display);
		} else if (this.displayClasses.match(/\badj\b/)) {
			loadTextureIfChanged(this.display, 'hex_path');
			this.pinTopLeft(this.display, this.drawPoint.x, this.drawPoint.y);
		} else if (this.displayClasses.match(/dashed/)) {
			// Check if this is a dashed hex with a creature (blocked target)
			if (this.creature instanceof Creature) {
				// Use colored dashed texture for the creature's team
				loadTextureIfChanged(this.display, `hex_dashed_p${this.creature.team}`);
				// Ensure dashed hexagons are visible
				this.display.alpha = 1;
				// Bring dashed hexes with creatures to the top of the display group for better visibility
				this.grid.displayHexesGroup.bringToTop(this.display);
			} else {
				loadTextureIfChanged(this.display, 'hex_dashed');
			}
		} else if (this.displayClasses.match(/deadzone/)) {
			loadTextureIfChanged(this.display, 'hex_deadzone');
			this.pinTopLeft(this.display, this.drawPoint.x, this.drawPoint.y);
		} else {
			loadTextureIfChanged(this.display, 'hex');
			this.pinTopLeft(this.display, this.drawPoint.x, this.drawPoint.y);
		}

		const computedDisplayAlpha = targetAlpha ? 1 : 0;
		this.display.alpha =
			typeof this.forcedDisplayAlpha === 'number' ? this.forcedDisplayAlpha : computedDisplayAlpha;
		if (this.forcedHidden) {
			this.display.alpha = 0;
		}

		if (this.displayClasses.match(/\babilityRange\b/)) {
			// Scale is managed externally by tweens; only ensure positioning.
			this.display.alignIn(this.hitBox, ALIGN_CENTER);
			this.overlay.alignIn(this.hitBox, ALIGN_CENTER);
		} else if (this.displayClasses.match(/shrunken/)) {
			this.display.setScale(shrinkScale, shrinkScale);
			this.overlay.setScale(shrinkScale, shrinkScale);
			this.display.alignIn(this.hitBox, ALIGN_CENTER);
			this.overlay.alignIn(this.hitBox, ALIGN_CENTER);
		} else {
			this.display.setScale(1, 1);
			this.overlay.setScale(1, 1);
			this.pinTopLeft(this.display, this.drawPoint.x, this.drawPoint.y);
			this.overlay.alignIn(this.hitBox, ALIGN_CENTER);
		}

		// Display Coord
		if (this.displayClasses.match(/showGrid/g)) {
			if (!(this.coordText && this.coordText.active)) {
				this.coordText = this.game.gameEngine.add.text(
					0,
					0,
					this.coord,
					{
						font: '30pt Play',
						color: '#000000',
						align: 'center',
					},
					this.grid.overlayHexesGroup,
				);
				if (this.creature || this.trap || this.drop) {
					this.coordText.stroke = '#ffffff';
					this.coordText.strokeThickness = 5;
				}
				this.coordText.setOrigin(0.5, 0.5);
				this.coordText.x = this.originalDisplayPos.x - HEX_DISPLAY_X_HACK + 45;
				this.coordText.y = this.originalDisplayPos.y + 63;
			}
		} else if (this.coordText && this.coordText.active) {
			this.coordText.destroy();
		}

		// Overlay Hex
		targetAlpha = Boolean(this.overlayClasses.match(/hover|creature/g));

		if (this.overlayClasses.match(/0|1|2|3/)) {
			const player = this.overlayClasses.match(/0|1|2|3/);

			if (this.overlayClasses.match(/reachable/)) {
				targetAlpha = true;
				loadTextureIfChanged(this.overlay, 'hex_path');
				// No partially overlapped hexagons #2734
				if (this.grid.overlayHexesGroup.sendToBack) {
					this.grid.overlayHexesGroup.sendToBack(this.overlay);
				}
			} else if (
				this.overlayClasses.match(/hover/) &&
				this.displayClasses.indexOf(`creature player${player}`) === -1
			) {
				loadTextureIfChanged(this.display, 'hex_path');
				this.display.alpha = 1;
				loadTextureIfChanged(this.overlay, `hex_hover_p${player}`);
				this.grid.overlayHexesGroup.bringToTop(this.overlay);
			} else if (this.overlayClasses.match(/hover/)) {
				loadTextureIfChanged(this.display, 'hex_path');
				this.grid.overlayHexesGroup.bringToTop(this.overlay);
			} else if (this.overlayClasses.match(/dashed/)) {
				loadTextureIfChanged(this.overlay, `hex_dashed_p${player}`);
				this.grid.overlayHexesGroup.bringToTop(this.overlay);
			} else {
				loadTextureIfChanged(this.overlay, `hex_p${player}`);
				// Colored overlays for creatures/selected should be on top
				this.grid.overlayHexesGroup.bringToTop(this.overlay);
			}
		} else {
			loadTextureIfChanged(this.overlay, 'input');
			this.overlay.setOrigin(0.5, 0.5);
			if (!this.isSpinning) {
				this.startSpinning();
			}
		}

		// Do not override overlay.alpha for active/selected hexes: the glowInterval
		// in interface.ts drives their alpha via a sine wave. If we hard-set to 1
		// here it restarts the visible phase every time overlayClasses is touched.
		const isGlowControlled = Boolean(this.overlayClasses.match(/\bactive\b|\bselected\b/));
		if (!isGlowControlled) {
			const computedOverlayAlpha = targetAlpha ? 1 : 0;
			const overlayKey = this.overlay.key;
			const isPlayerOverlayKey = typeof overlayKey === 'string' && /^hex_p[0-3]$/.test(overlayKey);
			const isCreatureOverlay =
				Boolean(this.overlayClasses.match(/\bcreature\b/)) || isPlayerOverlayKey;
			this.overlay.alpha =
				typeof this.forcedCreatureOverlayAlpha === 'number' && isCreatureOverlay
					? this.forcedCreatureOverlayAlpha
					: computedOverlayAlpha;
			if (this.forcedHidden) {
				this.overlay.alpha = 0;
			}
		}
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
