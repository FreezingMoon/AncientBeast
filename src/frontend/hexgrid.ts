import { Direction, Hex } from './hex';
import { Creature } from './creature';
import { search } from '../utility/pathfinding';
import * as matrices from '../utility/matrices';
import { Team, isTeam } from '../utility/team';
import { Game } from '../game';
import { Trap } from './trap';
import * as arrayUtils from '../utility/arrayUtils';

export interface QueryOptions {
	/**
	 * Target team.
	 */
	team: Team;

	/**
	 * Disable a choice if it does not contain a creature matching the team argument.
	 */
	requireCreature: boolean;
	id: number;
	flipped: boolean;
	x: number;
	y: number;
	hexesDashed: Hex[];
	shrunkenHexes: Hex[];
	directions: number[];
	includeCreature: boolean;
	stopOnCreature: boolean;

	/**
	 * If defined, maximum distance of query in hexes.
	 */
	distance: number;

	/**
	 * If defined, minimum distance of query, 1 = 1 hex gap required.
	 */
	minDistance: number;

	isDirectionsQuery: boolean;

	/**
	 * After this distance, the direction choice will be be visualised by shrunken hexes.
	 * This visual state represents the ability having its effectiveness being reduced
	 * in some way (falling off).
	 */
	distanceFalloff: number;

	/**
	 * If a choice line stops on a creature via @param stopOnCreature, display
	 * 	dashed hexes after the creature up until the next obstacle
	 */
	dashedHexesAfterCreatureStop: boolean;

	/**
	 * Limit the length of dashed hexes added by @param dashedHexesAfterCreatureStop
	 */
	dashedHexesDistance: number;

	sourceCreature: Creature;
	choices: Hex[][];

	/**
	 * Object given to the events function (to easily pass variable for these function).
	 */
	arg: any;

	optTest: () => boolean;

	/**
	 * Function applied when clicking on one of the available hexes.
	 */
	fnOnSelect: () => void;

	/**
	 * Function applied when clicking again on the same hex.
	 */
	fnOnConfirm: () => void;

	/**
	 * Function applied when clicking a non reachable hex
	 */
	fnOnCancel: () => void;
}

/**
 * Object containing grid and methods concerning the whole grid.
 * Should only have one instance during the game.
 */
export abstract class HexGrid {
	game: Game;
	opts: any; // Creation options.

	/**
	 * Contain all hexes in row arrays (hexes[y][x]).
	 */
	hexes: Hex[][];

	traps: Trap[];
	allhexes: Hex[];

	/**
	 * Last hex clicked!
	 */
	lastClickedHex: Hex;

	selectedHex: Hex;
	_executionMode: boolean;
	lastQueryOpt: any;

	/* Constructor
	 *
	 * Create attributes and populate JS grid with Hex objects
	 */
	constructor(opts: any, game: Game) {
		const defaultOpt = {
			nbrRow: 9,
			nbrhexesPerRow: 16,
			firstRowFull: false,
		};

		this.opts = { ...defaultOpt, ...opts };

		this.game = game;
		this.hexes = []; // Hex Array
		this.traps = []; // Traps Array
		this.allhexes = []; // All hexes
		this.lastClickedHex = undefined;

		// If true, clicking a monster will instantly kill it.
		this._executionMode = false;
	}

	/**
	 * Populates hexes, allhexes and selectedHex.
	 */
	populate() {
		// Populate grid
		for (let row = 0; row < this.opts.nbrRow; row++) {
			this.hexes.push([]);
			for (let hex = 0, len = this.opts.nbrhexesPerRow; hex < len; hex++) {
				if (hex == this.opts.nbrhexesPerRow - 1) {
					if (
						(row % 2 == 0 && !this.opts.firstRowFull) ||
						(row % 2 == 1 && this.opts.firstRowFull)
					) {
						continue;
					}
				}

				this.hexes[row][hex] = this.createHex(hex, row, this, this.game);
				this.allhexes.push(this.hexes[row][hex]);
			}
		}

		this.selectedHex = this.hexes[0][0];
	}

	/**
	 * Create a implementation Hex object.
	 *
	 * @param x
	 * @param y
	 * @param grid
	 * @param game
	 */
	abstract createHex(x: number, y: number, grid: HexGrid, game?: Game): Hex;

	abstract querySelf(o: any);

	/**
	 * Shortcut to queryChoice with specific directions.
	 *
	 * @param o
	 */
	queryDirection(o: QueryOptions) {
		o.isDirectionsQuery = true;
		o = this.getDirectionChoices(o);
		this.queryChoice(o);
	}

	/**
	 * Get an object that contains the choices and hexesDashed for a direction query.
	 *
	 * @param o Options.
	 * @returns Altered options.
	 */
	getDirectionChoices(o: QueryOptions) {
		const defaultOpt = {
			team: Team.Enemy,
			requireCreature: true,
			id: 0,
			flipped: false,
			x: 0,
			y: 0,
			hexesDashed: [],
			shrunkenHexes: [],
			directions: [1, 1, 1, 1, 1, 1],
			includeCreature: true,
			stopOnCreature: true,
			distance: 0,
			minDistance: 0,
			distanceFalloff: 0,
			dashedHexesAfterCreatureStop: true,
			dashedHexesDistance: 0,
			sourceCreature: undefined,
			choices: [],
			optTest: () => true,
		};

		const options = { ...defaultOpt, ...o };

		// Clean Direction
		this.forEachHex((hex) => {
			hex.direction = -1;
		});

		options.choices = [];

		for (let i = 0, len = options.directions.length; i < len; i++) {
			if (!options.directions[i]) {
				continue;
			}

			const direction = i as Direction;
			let dir: Hex[] = [];
			let fx = 0;

			if (options.sourceCreature instanceof Creature) {
				const flipped = options.sourceCreature.player.flipped;
				if (
					(!flipped && direction > Direction.DownRight) ||
					(flipped && direction < Direction.DownLeft)
				) {
					fx = -1 * (options.sourceCreature.size - 1);
				}
			}

			dir = this.getHexLine(options.x + fx, options.y, direction, options.flipped);

			// Limit hexes based on distance
			if (options.distance > 0) {
				dir = dir.slice(0, options.distance + 1);
			}

			// The untargetable area between the unit and the minimum distance.
			let deadzone = [];
			if (options.minDistance > 0) {
				deadzone = dir.slice(0, options.minDistance);
				deadzone = arrayUtils.filterCreature(
					deadzone,
					options.includeCreature,
					options.stopOnCreature,
					options.id,
				);

				dir = dir.slice(
					// 1 greater than expected to exclude current (source creature) hex.
					options.minDistance,
				);
			}

			/* If the ability has a minimum distance and units should block LOS, this
				direction cannot be used if there is a unit in the deadzone. */
			if (options.stopOnCreature && deadzone.length && this.atLeastOneTarget(deadzone, options)) {
				continue;
			}

			let hexesDashed = [];
			dir.forEach((item) => {
				item.direction = options.flipped ? 5 - direction : direction;

				if (options.stopOnCreature && options.dashedHexesAfterCreatureStop) {
					hexesDashed.push(item);
				}
			});

			arrayUtils.filterCreature(dir, options.includeCreature, options.stopOnCreature, options.id);

			if (dir.length === 0) {
				continue;
			}

			if (options.requireCreature && !this.atLeastOneTarget(dir, options)) {
				continue;
			}

			if (
				options.stopOnCreature &&
				options.includeCreature &&
				// Only straight direction.
				(direction === Direction.Right || direction === Direction.Left)
			) {
				if (arrayUtils.last(dir).creature instanceof Creature) {
					// Add all creature hexes.
					const creature = arrayUtils.last(dir).creature;
					dir.pop();
					dir = arrayUtils.sortByDirection(dir.concat(creature.hexagons), direction);
				}
			}

			dir.forEach((item) => {
				arrayUtils.removePos(hexesDashed, item);
			});

			/* For some reason hexesDashed can contain source creature hexagons. Rather
				than risk changing that logic, create a new list without the source creature. */
			const hexesDashedWithoutSourceCreature = arrayUtils.filterCreature(
				hexesDashed,
				true,
				false,
				options.id,
			);

			if (hexesDashed.length && options.dashedHexesDistance) {
				hexesDashed = hexesDashedWithoutSourceCreature.slice(0, options.dashedHexesDistance);
			}

			let shrunkenHexes: Hex[] = [];
			if (options.distanceFalloff) {
				/* Shrunken hexes do not replace existing hexes, instead they modify them.
					With that in mind, regular AND dashed hexes after the falloff distance
					can be shrunk. */
				shrunkenHexes = [...dir, ...hexesDashedWithoutSourceCreature].slice(
					options.distanceFalloff,
				);
			}

			options.hexesDashed = [...options.hexesDashed, ...hexesDashed];
			options.shrunkenHexes = [...options.shrunkenHexes, ...shrunkenHexes];
			options.choices.push(dir);
		}

		return options;
	}

	/**
	 * Return whether there is at least one creature in the hexes that satisfies
	 * various conditions, e.g. team.
	 *
	 * @param {} dir ?
	 * @param {Object} o
	 * @return {boolean} At least one valid target.
	 */
	atLeastOneTarget(dir, o) {
		const defaultOpt = {
			team: Team.Both,
			optTest: function () {
				return true;
			},
		};

		const options = { ...defaultOpt, ...o };

		let validChoice = false;

		// Search each hex for a creature that matches the team argument.
		for (let j = 0; j < dir.length; j++) {
			const targetCreature = dir[j].creature;

			if (targetCreature instanceof Creature && targetCreature.id !== options.id) {
				const sourceCreature = this.game.creatures[options.id];

				if (
					isTeam(sourceCreature, targetCreature, options.team) &&
					options.optTest(targetCreature)
				) {
					validChoice = true;
					break;
				}
			}
		}

		if (validChoice) {
			return true;
		}

		return false;
	}

	/*
	 * queryChoice(o)
	 *
	 * fnOnSelect : 		Function : 	Function applied when clicking on one of the available hexes.
	 * fnOnConfirm : 		Function : 	Function applied when clicking again on the same hex.
	 * fnOnCancel : 		Function : 	Function applied when clicking a non reachable hex
	 * requireCreature : 	Boolean : 	Disable a choice if it does not contain a creature matching the team argument
	 * args : 				Object : 	Object given to the events function (to easily pass variable for these function)
	 */
	queryChoice(o) {
		const game = this.game;
		const defaultOpt = {
			fnOnConfirm: () => {
				game.activeCreature.queryMove();
			},
			fnOnSelect: (choice) => {
				choice.forEach((item) => {
					if (item.creature instanceof Creature) {
						item.displayVisualState('creature selected player' + item.creature.team);
					} else {
						item.displayVisualState('adj');
					}
				});
			},
			fnOnCancel: () => {
				game.activeCreature.queryMove();
			},
			team: Team.Enemy,
			requireCreature: 1,
			id: 0,
			args: {},
			flipped: false,
			choices: [],
			hexesDashed: [],
			shrunkenHexes: [],
			isDirectionsQuery: false,
			hideNonTarget: true,
		};

		o = { ...defaultOpt, ...o };

		let hexes = [];
		for (let i = 0, len = o.choices.length; i < len; i++) {
			let validChoice = true;

			if (o.requireCreature) {
				validChoice = false;
				// Search each hex for a creature that matches the team argument
				for (let j = 0; j < o.choices[i].length; j++) {
					if (o.choices[i][j].creature instanceof Creature && o.choices[i][j].creature != o.id) {
						const creaSource = game.creatures[o.id];
						const creaTarget = o.choices[i][j].creature;

						if (isTeam(creaSource, creaTarget, o.team)) {
							validChoice = true;
						}
					}
				}
			}

			if (validChoice) {
				hexes = hexes.concat(o.choices[i]);
				o.choices[i].forEach((hex) => {
					arrayUtils.removePos(o.hexesDashed, hex);
				});
			} else if (o.isDirectionsQuery) {
				this.forEachHex((hex) => {
					if (o.choices[i][0].direction == hex.direction) {
						arrayUtils.removePos(o.hexesDashed, hex);
					}
				});
			}
		}

		o.hexesDashed = o.hexesDashed.filter((hexDash) => !hexDash.creature);

		this.queryHexes({
			fnOnConfirm: (hex, args) => {
				// Determine which set of hexes (choice) the hex is part of
				for (let i = 0, len = args.opt.choices.length; i < len; i++) {
					for (let j = 0, lenj = args.opt.choices[i].length; j < lenj; j++) {
						if (hex.pos == args.opt.choices[i][j].pos) {
							args.opt.args.direction = hex.direction;
							args.opt.fnOnConfirm(args.opt.choices[i], args.opt.args, { queryOptions: o });
							return;
						}
					}
				}
			},
			fnOnSelect: (hex, args) => {
				// Determine which set of hexes (choice) the hex is part of
				for (let i = 0, len = args.opt.choices.length; i < len; i++) {
					for (let j = 0, lenj = args.opt.choices[i].length; j < lenj; j++) {
						if (hex.pos == args.opt.choices[i][j].pos) {
							args.opt.args.direction = hex.direction;
							args.opt.args.hex = hex;
							args.opt.args.choiceIndex = i;
							args.opt.fnOnSelect(args.opt.choices[i], args.opt.args, { queryOptions: o });
							return;
						}
					}
				}
			},
			fnOnCancel: o.fnOnCancel,
			args: {
				opt: o,
			},
			hexes: hexes,
			hexesDashed: o.hexesDashed,
			shrunkenHexes: o.shrunkenHexes,
			flipped: o.flipped,
			hideNonTarget: o.hideNonTarget,
			id: o.id,
			fillHexOnHover: false,
		});
	}

	/**
	 *
	 * @param {object} o Object given to the events function (to easily pass variable for these function)
	 * @param {function} o.fnOnSelect Function applied when clicking on one of the available hexes.
	 * @param {function} o.fnOnConfirm Function applied when clicking again on the same hex.
	 * @param {function} o.fnOnCancel Function applied when clicking a non reachable hex.
	 * @param {Team} o.team The targetable team.
	 * @param {number} o.id Creature ID
	 * @param {boolean} o.replaceEmptyHexesWithDashed Replace all non targetable, empty hexes with dashed hexes.
	 * 	o.hexesDashed will override this option.
	 */
	abstract queryCreature(o);

	redoLastQuery() {
		this.queryHexes(this.lastQueryOpt);
	}

	/* queryHexes(x, y, distance, size)
	 *
	 * fnOnSelect : 	Function : 	Function applied when clicking on one of the available hexes.
	 * fnOnConfirm : 	Function : 	Function applied when clicking again on the same hex.
	 * fnOnCancel : 	Function : 	Function applied when clicking a non reachable hex
	 * args : 			Object : 	Object given to the events function (to easily pass variable for these function)
	 * hexes : 		Array : 	Reachable hexes
	 * callbackAfterQueryHexes : 		Function : 	empty function to be overridden with custom logic to execute after queryHexes
	 */
	abstract queryHexes(o);

	/* xray(hex)
	 *
	 * hex : 	Hex : 	Hexagon to emphasize.
	 *
	 * If hex contain creature call ghostOverlap for each creature hexes
	 *
	 */
	xray(hex: Hex) {
		// Clear previous ghost
		this.game.creatures.forEach((creature) => {
			if (creature instanceof Creature) {
				creature.xray(false);
			}
		});

		if (hex.creature instanceof Creature) {
			hex.creature.hexagons.forEach((item) => {
				item.ghostOverlap();
			});
		} else {
			// hex.ghostOverlap();
		}
	}

	/**
	 * Gets a line of hexes given a start point and a direction The result is an array
	 * of hexes, starting from the start point's hex, and extending out in a straight line.
	 * If the coordinate is erroneous, returns an empty array.
	 *
	 * @param x Coordinate of start hex.
	 * @param y Coordinate of start hex.
	 * @param dir Direction of the line.
	 * @param flipped Flip the direction.
	 * @returns Hexes in the line.
	 */
	getHexLine(x: number, y: number, dir: Direction, flipped: boolean): Hex[] {
		switch (dir) {
			case Direction.UpRight:
				return this.getHexMap(x, y - 8, 0, flipped, matrices.diagonalup).reverse();
			case Direction.Right:
				return this.getHexMap(x, y, 0, flipped, matrices.straitrow);
			case Direction.DownRight:
				return this.getHexMap(x, y, 0, flipped, matrices.diagonaldown);
			case Direction.DownLeft:
				return this.getHexMap(x, y, -4, flipped, matrices.diagonalup);
			case Direction.Left:
				return this.getHexMap(x, y, 0, !flipped, matrices.straitrow);
			case Direction.UpLeft:
				return this.getHexMap(x, y - 8, -4, flipped, matrices.diagonaldown).reverse();
			default:
				return [];
		}
	}

	abstract cleanHex(hex: Hex);

	/**
	 * updateDisplay()
	 *
	 * Update overlay hexes with creature positions
	 */
	abstract updateDisplay();

	/**
	 * hexExists(y, x)
	 *
	 * x : 	Integer : 	Coordinates to test
	 * y : 	Integer : 	Coordinates to test
	 *
	 * Test if hex exists
	 * TODO: Why is this backwards... standard corodinates systems follow x,y nomenclature...
	 */
	hexExists(y, x) {
		if (y >= 0 && y < this.hexes.length) {
			if (x >= 0 && x < this.hexes[y].length) {
				return true;
			}
		}

		return false;
	}

	/**
	 * isHexIn(hex, hexArray)
	 *
	 * hex : 		Hex : 		Hex to look for
	 * hexarray : 	Array : 	Array of hexes to look for hex in
	 *
	 * Test if hex exists inside array of hexes
	 */
	isHexIn(hex, hexArray) {
		for (let i = 0, len = hexArray.length; i < len; i++) {
			if (hexArray[i].x == hex.x && hexArray[i].y == hex.y) {
				return true;
			}
		}

		return false;
	}

	/* getMovementRange(x, y, distance, size, id)
	 *
	 * x : 		Integer : 	Start position
	 * y : 		Integer : 	Start position
	 * distance : 	Integer : 	Distance from the start position
	 * size : 		Integer : 	Creature size
	 * id : 		Integer : 	Creature ID
	 *
	 * return : 	Array : 	Set of the reachable hexes
	 */
	getMovementRange(x, y, distance, size, id) {
		//	Populate distance (hex.g) in hexes by asking an impossible
		//	destination to test all hexagons
		this.cleanReachable(); // If not pathfinding will bug
		this.cleanPathAttr(true); // Erase all pathfinding data
		search(this.hexes[y][x], this.createHex(-2, -2, null, this.game), size, id, this.game.grid);

		// Gather all the reachable hexes
		const hexes: Hex[] = [];
		this.forEachHex((hex) => {
			// If not Too far or Impossible to reach
			if (hex.g <= distance && hex.g != 0) {
				hexes.push(this.hexes[hex.y][hex.x]);
			}
		});

		return arrayUtils.extendToLeft(hexes, size, this.game.grid);
	}

	/* getFlyingRange(x,y,distance,size,id)
	 *
	 * x : 		Integer : 	Start position
	 * y : 		Integer : 	Start position
	 * distance : 	Integer : 	Distance from the start position
	 * size : 		Integer : 	Creature size
	 * id : 		Integer : 	Creature ID
	 *
	 * return : 	Array : 	Set of the reachable hexes
	 */
	getFlyingRange(x, y, distance, size, id) {
		// Gather all the reachable hexes
		let hexes = this.hexes[y][x].adjacentHex(distance);

		hexes = hexes.filter((hex) => hex.isWalkable(size, id, true, false));

		return arrayUtils.extendToLeft(hexes, size, this.game.grid);
	}

	/* getHexMap(originx, originy, array)
	 *
	 * array : 	Array : 	2-dimensions Array containing 0 or 1 (boolean)
	 * originx : 	Integer : 	Position of the array on the grid
	 * originy : 	Integer : 	Position of the array on the grid
	 * offsetx : 	Integer : 	offset flipped for flipped players
	 * flipped : 	Boolean : 	If player is flipped or not
	 *
	 * return : 	Array : 	Set of corresponding hexes
	 */
	getHexMap(originx, originy, offsetx, flipped, array) {
		// Heavy logic in here
		const hexes = [];

		array = array.slice(0); // Copy to not modify original
		originx += flipped ? 1 - array[0].length - offsetx : -1 + offsetx;

		for (let y = 0, len = array.length; y < len; y++) {
			array[y] = array[y].slice(0); // Copy row

			// Translating to flipped pattern
			if (flipped && y % 2 != 0) {
				// Odd rows
				array[y].push(0);
			}

			// Translating even to odd row pattern
			array[y].unshift(0);
			if (originy % 2 != 0 && y % 2 != 0) {
				// Even rows
				if (flipped) {
					array[y].pop(); // Remove last element as the array will be parse backward
				} else {
					array[y].splice(0, 1); // Remove first element
				}
			}

			// Gathering hexes
			for (let x = 0; x < array[y].length; x++) {
				if (array[y][x]) {
					const xfinal = flipped ? array[y].length - 1 - x : x; // Parse the array backward for flipped player
					if (this.hexExists(originy + y, originx + xfinal)) {
						hexes.push(this.hexes[originy + y][originx + xfinal]);
					}
				}
			}
		}

		return hexes;
	}

	abstract showGrid(val: any): void;

	// TODO: Rewrite methods used here to only require the creature as an argument.
	showMovementRange(id: number): void {
		const creature = this.game.creatures[id];
		const hexes = this.findCreatureMovementHexes(creature);

		// Block all hexes
		this.forEachHex((hex) => {
			hex.unsetReachable();
		});

		// Set reachable the given hexes
		hexes.forEach((hex) => {
			hex.setReachable();
		});
	}

	abstract showCurrentCreatureMovementInOverlay(creature: Creature): void;

	findCreatureMovementHexes(creature: Creature): Hex[] {
		if (creature.movementType() === 'flying') {
			return this.getFlyingRange(
				creature.x,
				creature.y,
				creature.stats.movement,
				creature.size,
				creature.id,
			);
		} else {
			return this.getMovementRange(
				creature.x,
				creature.y,
				creature.stats.movement,
				creature.size,
				creature.id,
			);
		}
	}

	selectHexUp() {
		if (!this.hexExists(this.selectedHex.y - 1, this.selectedHex.x)) {
			return;
		}

		if (this.selectedHex) {
			this.clearHexViewAlterations();
			this.selectedHex.onHoverOffFn(this.selectedHex);
		}

		const hex = this.hexes[this.selectedHex.y - 1][this.selectedHex.x];
		this.selectedHex = hex;
		hex.onSelectFn(hex);
	}

	selectHexDown() {
		if (!this.hexExists(this.selectedHex.y + 1, this.selectedHex.x)) {
			return;
		}

		if (this.selectedHex) {
			this.clearHexViewAlterations();
			this.selectedHex.onHoverOffFn(this.selectedHex);
		}

		const hex = this.hexes[this.selectedHex.y + 1][this.selectedHex.x];
		this.selectedHex = hex;
		hex.onSelectFn(hex);
	}

	selectHexLeft() {
		if (!this.hexExists(this.selectedHex.y, this.selectedHex.x - 1)) {
			return;
		}

		if (this.selectedHex) {
			this.clearHexViewAlterations();
			this.selectedHex.onHoverOffFn(this.selectedHex);
		}

		const hex = this.hexes[this.selectedHex.y][this.selectedHex.x - 1];
		this.selectedHex = hex;
		hex.onSelectFn(hex);
	}

	selectHexRight() {
		if (!this.hexExists(this.selectedHex.y, this.selectedHex.x + 1)) {
			return;
		}

		if (this.selectedHex) {
			this.clearHexViewAlterations();
			this.selectedHex.onHoverOffFn(this.selectedHex);
		}

		const hex = this.hexes[this.selectedHex.y][this.selectedHex.x + 1];
		this.selectedHex = hex;
		hex.onSelectFn(hex);
	}

	confirmHex() {
		if (this.game.freezedInput) {
			return;
		}

		this.selectedHex.onConfirmFn(this.selectedHex);
	}

	/**
	 * Reset the visual state for hexes that might have been hovered, dashed, etc.
	 * Note: I'm not entirely sure what this code is doing.
	 */
	clearHexViewAlterations() {
		if (!this.selectedHex) {
			return;
		}

		this.redoLastQuery();
		// Clear Xray.
		this.xray(this.createHex(-1, -1, null, this.game));
		// Clear Xray Queue.
		this.game.UI.xrayQueue(-1);
	}

	abstract orderCreatureZ();

	//******************//
	//Shortcut functions//
	//******************//

	/* forEachHex(f)
	 *
	 * f : Function : 	Function to execute
	 *
	 * Execute f for each hexes
	 */
	forEachHex(func: (hex: Hex) => void) {
		this.hexes.forEach((hex) => {
			hex.forEach(func);
		});
	}

	/* cleanPathAttr(includeG)
	 *
	 * includeG : 	Boolean : 	Include hex.g attribute
	 *
	 * Execute hex.cleanPathAttr() function for all the grid. Refer to the Hex class for more info
	 */
	cleanPathAttr(includeG) {
		this.hexes.forEach((hex) => {
			hex.forEach((item) => {
				item.cleanPathAttr(includeG);
			});
		});
	}

	/* cleanReachable()
	 *
	 * Execute hex.setReachable() function for all the grid. Refer to the Hex class for more info
	 */
	cleanReachable() {
		this.hexes.forEach((hex) => {
			hex.forEach((item) => {
				item.setReachable();
			});
		});
	}

	/* previewCreature(creatureData)
	 *
	 * pos : 			Object : 	Coordinates {x,y}
	 * creatureData : 	Object : 	Object containing info from the database (game.retrieveCreatureStats)
	 *
	 * Draw a preview of the creature at the given coordinates
	 */
	abstract previewCreature(pos, creatureData, player);

	/**
	 * Internal debugging method to log
	 * of hexes.
	 *
	 * @param hexes Hexes to log.
	 */
	__debugHexes(hexes: Hex[]) {
		console.debug({ hexes }, hexes.map((hex) => hex.coord).join(', '));
	}
}
