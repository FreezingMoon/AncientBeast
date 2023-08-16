import * as $j from 'jquery';
import { Direction, Hex } from './hex';
import { Creature } from '../creature';
import { search } from './pathfinding';
import * as matrices from './matrices';
import { Team, isTeam } from './team';
import * as arrayUtils from './arrayUtils';
import Game from '../game';
import { DEBUG } from '../debug';
import { HEX_WIDTH_PX } from './const';
import { Point } from './pointfacade';
import { AugmentedMatrix } from './matrices';

interface GridDefinition {
	numRows: number;
	numCols: number;
	isFirstRowFull: boolean;
}

interface QueryOptions {
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
	hexesDeadZone: Hex[];
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
export class HexGrid {
	game: Game;

	/**
	 * Contain all hexes in row arrays (hexes[y][x]).
	 */
	hexes: Hex[][];

	/**
	 * Last hex clicked!
	 */
	lastClickedHex: Hex;

	/**
	 * Prevents multiple shouts at the same time when a unit is clicked.
	 */
	onShoutCooldown: boolean;

	display: Phaser.Group;
	gridGroup: Phaser.Group;
	trapGroup: Phaser.Group;
	hexesGroup: Phaser.Group;
	displayHexesGroup: Phaser.Group;
	overlayHexesGroup: Phaser.Group;
	inputHexesGroup: Phaser.Group;
	dropGroup: Phaser.Group;
	creatureGroup: Phaser.Group;
	trapOverGroup: Phaser.Group;
	selectedHex: Hex;
	_executionMode: boolean;
	materialize_overlay: any;
	lastQueryOpt: any;

	get allhexes(): Hex[] {
		return this.hexes.flat(1);
	}

	/**
	 * Create attributes and populate JS grid with Hex objects
	 * @param {Partial<GridDefinition>} gridDefinition - specifies a number of columns in the grid.
	 * The resulting grid has jagged, symmetrical edges.
	 * Only "full" rows have the specified number of columns.
	 * @param {Game} game
	 * @example
	 * // {numRows:5, numCols:4, isFirstRowFull: true}
	 * //
	 * // x x x x - full row
	 * //  x x x  - partial row
	 * // x x x x - full row
	 * //  x x x  - partial row
	 * // x x x x - full row
	 * @constructor
	 */
	constructor(gridDefinition: Partial<GridDefinition>, game: Game) {
		const defaultGridDefinition = {
			numRows: 9,
			numCols: 16,
			isFirstRowFull: false,
		};

		gridDefinition = { ...defaultGridDefinition, ...gridDefinition };
		const numRows = gridDefinition.numRows;
		const numCols = gridDefinition.numCols;
		const isFirstRowFull = gridDefinition.isFirstRowFull;

		this.game = game;
		this.hexes = []; // Hex Array
		this.lastClickedHex = undefined;

		this.display = game.Phaser.add.group(undefined, 'displayGroup');
		this.display.x = 230;
		this.display.y = 380;

		this.gridGroup = game.Phaser.add.group(this.display, 'gridGroup');
		this.gridGroup.scale.set(1, 0.75);

		this.trapGroup = game.Phaser.add.group(this.gridGroup, 'trapGrp');
		this.hexesGroup = game.Phaser.add.group(this.gridGroup, 'hexesGroup');
		this.displayHexesGroup = game.Phaser.add.group(this.gridGroup, 'displayHexesGroup');
		this.overlayHexesGroup = game.Phaser.add.group(this.gridGroup, 'overlayHexesGroup');
		this.dropGroup = game.Phaser.add.group(this.display, 'dropGrp');
		this.creatureGroup = game.Phaser.add.group(this.display, 'creaturesGrp');
		// Parts of traps displayed over creatures
		this.trapOverGroup = game.Phaser.add.group(this.display, 'trapOverGrp');
		this.trapOverGroup.scale.set(1, 0.75);

		// Populate grid
		for (let row = 0; row < numRows; row++) {
			this.hexes.push([]);
			for (let hex = 0, len = numCols; hex < len; hex++) {
				if (hex == numCols - 1) {
					if ((row % 2 == 0 && !isFirstRowFull) || (row % 2 == 1 && isFirstRowFull)) {
						continue;
					}
				}

				this.hexes[row][hex] = new Hex(hex, row, this);
			}
		}

		this.selectedHex = this.hexes[0][0];

		// If true, clicking on a unit won't shout its name.
		this.onShoutCooldown = false;

		// If true, clicking a monster will instantly kill it.
		this._executionMode = false;

		// Events
		this.game.signals.metaPowers.add(this.handleMetaPowerEvent, this);
		this.game.signals.ui.add(this.handleUIEvent, this);
	}

	get traps() {
		return this.game.traps;
	}

	hexAt(x: number, y: number): Hex | undefined {
		if (y < 0 || y >= this.hexes.length) return;
		const row = this.hexes[y];
		if (x < 0 || x >= row.length) return;
		return row[x];
	}

	handleMetaPowerEvent(message, payload) {
		if (message === 'toggleExecuteMonster') {
			this._executionMode = payload;
		}
	}

	handleUIEvent(message, payload) {
		if (message === 'onOpenDash') {
			// NOTE: This is a rather hacky bugfix.
			// If a "query" is going on, and the dash is opened,
			// creatures can remain in a "hovered" state.
			// This hack undoes the "hovered" state.
			this.forEachHex((hex) => {
				const creature = hex.creature;
				if (creature instanceof Creature) {
					creature.resetBounce();
				}
			});
		}
	}

	isInBounds({ x, y }: Point) {
		return y < this.hexes.length && y >= 0 && x < this.hexes[y].length && x >= 0;
	}

	querySelf(o) {
		const game = this.game;
		const defaultOpt = {
			fnOnConfirm: () => {
				// No-op function.
			},
			fnOnSelect: (creature: Creature) => {
				creature.hexagons.forEach((hex) => {
					hex.overlayVisualState('creature selected player' + hex.creature.team);
				});
			},
			fnOnCancel: () => {
				this.game.activeCreature.queryMove();
			},
			args: {},
			confirmText: 'Confirm',
			id: game.activeCreature.id,
		};

		o = { ...defaultOpt, ...o };

		game.activeCreature.hint(o.confirmText, 'confirm');

		this.queryHexes({
			fnOnConfirm: (hex, args) => {
				args.opt.fnOnConfirm(game.activeCreature, args.opt.args, { queryOptions: o });
			},
			fnOnSelect: (hex, args) => {
				args.opt.fnOnSelect(game.activeCreature, args.opt.args);
			},
			fnOnCancel: (hex, args) => {
				args.opt.fnOnCancel(game.activeCreature, args.opt.args);
			},
			args: {
				opt: o,
			},
			hexes: game.activeCreature.hexagons,
			hideNonTarget: true,
			id: o.id,
		});
	}

	/**
	 * Shortcut to queryChoice with specific directions.
	 * @param {QueryOptions} o
	 */
	queryDirection(o: Partial<QueryOptions>) {
		o.isDirectionsQuery = true;
		o = this.getDirectionChoices(o);
		this.queryChoice(o);
	}

	/**
	 * Get an object that contains the choices and hexesDashed for a direction query.
	 * @param {QueryOptions} o Options.
	 * @returns {QueryOptions} Altered options.
	 */
	getDirectionChoices(o: Partial<QueryOptions>) {
		const defaultOpt = {
			team: Team.Enemy,
			requireCreature: true,
			id: 0,
			flipped: false,
			x: 0,
			y: 0,
			hexesDashed: [],
			shrunkenHexes: [],
			hexesDeadZone: [],
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
			hex.direction = Direction.None;
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

			const hexesDeadZone = [];
			deadzone.forEach((element) => {
				hexesDeadZone.push(element);
			});

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

			// Deadzone hexes are also part of direction, so they should be clickable
			deadzone.forEach((element) => {
				dir.push(element);
			});

			options.hexesDashed = [...options.hexesDashed, ...hexesDashed];
			options.shrunkenHexes = [...options.shrunkenHexes, ...shrunkenHexes];
			options.hexesDeadZone = [...options.hexesDeadZone, ...hexesDeadZone];
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

	/**
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
			hexesDeadZone: [],
			shrunkenHexes: [],
			isDirectionsQuery: false,
			hideNonTarget: true,
			dashedHexesUnderCreature: false,
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

		o.hexesDashed = o.dashedHexesUnderCreature
			? o.hexesDashed
			: o.hexesDashed.filter((hexDash) => !hexDash.creature);

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
			hexesDeadZone: o.hexesDeadZone,
			flipped: o.flipped,
			hideNonTarget: o.hideNonTarget,
			id: o.id,
			fillHexOnHover: false,
		});
	}

	/**
	 * @param {object} o Object given to the events function (to easily pass variable for these function)
	 * @param {function} o.fnOnSelect Function applied when clicking on one of the available hexes.
	 * @param {function} o.fnOnConfirm Function applied when clicking again on the same hex.
	 * @param {function} o.fnOnCancel Function applied when clicking a non reachable hex.
	 * @param {Team} o.team The targetable team.
	 * @param {number} o.id Creature ID
	 * @param {boolean} o.replaceEmptyHexesWithDashed Replace all non targetable, empty hexes with dashed hexes.
	 * 	o.hexesDashed will override this option.
	 */
	queryCreature(o) {
		const game = this.game;
		const defaultOpt = {
			fnOnConfirm: () => {
				game.activeCreature.queryMove();
			},
			fnOnSelect: (creature) => {
				creature.tracePosition({
					overlayClass: 'creature selected player' + creature.team,
				});
			},
			fnOnCancel: () => {
				game.activeCreature.queryMove();
			},
			optTest: () => true,
			args: {},
			hexes: [],
			hexesDashed: [],
			hexesDeadZone: [],
			flipped: false,
			id: 0,
			team: Team.Enemy,
			replaceEmptyHexesWithDashed: false,
		};

		o = { ...defaultOpt, ...o };

		/* Divide hexes into:
		- containing valid targets
		- empty (no possible target)
		Hexes containing invalid targets (wrong team, o.optTest, etc) are discard. */
		const { targetHexes, emptyHexes } = o.hexes.reduce(
			(acc, hex) => {
				const sourceCreature = game.creatures[o.id];
				const targetCreature = hex.creature;

				const acceptTargetHex = () => {
					return {
						...acc,
						targetHexes: [...acc.targetHexes, hex],
					};
				};

				const acceptEmptyHex = () => {
					return {
						...acc,
						emptyHexes: [...acc.emptyHexes, hex],
					};
				};

				const discardHex = () => {
					return acc;
				};

				if (!targetCreature) {
					return acceptEmptyHex();
				}

				if (targetCreature instanceof Creature && targetCreature.id !== o.id) {
					if (!o.optTest(hex.creature)) {
						return discardHex();
					}

					if (isTeam(sourceCreature, targetCreature, o.team)) {
						return acceptTargetHex();
					}
				}

				return discardHex();
			},
			{ targetHexes: [], emptyHexes: [] },
		);

		o.hexes = targetHexes;

		if (o.replaceEmptyHexesWithDashed && !o.hexesDashed.length) {
			o.hexesDashed = emptyHexes;
		}

		let extended = [];
		/* Add creature hexes that extend out of the range of the source hexes, so the
		entire creature can be highlighted. */
		o.hexes.forEach((hex) => {
			extended = extended.concat(hex.creature.hexagons);
		});

		o.hexes = extended;

		this.queryHexes({
			fnOnConfirm: (hex, args) => {
				const { creature } = hex;
				args.opt.fnOnConfirm(creature, args.opt.args, { queryOptions: o });
			},
			fnOnSelect: (hex, args) => {
				const { creature } = hex;
				args.opt.fnOnSelect(creature, args.opt.args);
			},
			fnOnCancel: o.fnOnCancel,
			args: {
				opt: o,
			},
			hexes: o.hexes,
			hexesDashed: o.hexesDashed,
			hexesDeadZone: o.hexesDeadZone,
			flipped: o.flipped,
			hideNonTarget: true,
			id: o.id,
		});
	}

	redoLastQuery() {
		this.queryHexes(this.lastQueryOpt);
	}

	/**
	 * fnOnSelect : 	Function : 	Function applied when clicking on one of the available hexes.
	 * fnOnConfirm : 	Function : 	Function applied when clicking again on the same hex.
	 * fnOnCancel : 	Function : 	Function applied when clicking a non reachable hex
	 * args : 			Object : 	Object given to the events function (to easily pass variable for these function)
	 * hexes : 		Array : 	Reachable hexes
	 * callbackAfterQueryHexes : 		Function : 	empty function to be overridden with custom logic to execute after queryHexes
	 */
	queryHexes(o) {
		const game = this.game;
		const defaultOpt = {
			fnOnConfirm: () => {
				game.activeCreature.queryMove();
			},
			fnOnSelect: (hex: Hex) => {
				game.activeCreature.faceHex(hex);
				hex.overlayVisualState('creature selected player' + game.activeCreature.team);
			},
			fnOnCancel: () => {
				game.activeCreature.queryMove();
			},
			callbackAfterQueryHexes: () => {
				// empty function to be overridden with custom logic to execute after queryHexes
			},
			args: {},
			hexes: [],
			hexesDashed: [],
			shrunkenHexes: [],
			hexesDeadZone: [],
			size: 1,
			id: 0,
			flipped: false,
			hideNonTarget: false,
			ownCreatureHexShade: false,
			targeting: true,
			fillHexOnHover: true,
		};

		o = { ...defaultOpt, ...o };

		this.lastClickedHex = undefined;

		// Save the last Query
		this.lastQueryOpt = { ...o };

		this.updateDisplay();
		// Block all hexes
		this.forEachHex((hex) => {
			hex.unsetReachable();

			if (o.hideNonTarget) {
				hex.setNotTarget();
			} else {
				hex.unsetNotTarget();
			}

			if (o.hexesDashed.indexOf(hex) !== -1) {
				hex.displayVisualState('dashed');
			} else {
				hex.cleanDisplayVisualState('dashed');
			}

			if (o.hexesDeadZone.indexOf(hex) !== -1) {
				hex.displayVisualState('deadzone');
			} else {
				hex.cleanDisplayVisualState('deadzone');
			}

			if (o.shrunkenHexes.includes(hex)) {
				hex.displayVisualState('shrunken');
			} else {
				hex.cleanDisplayVisualState('shrunken');
			}
		});

		// Cleanup
		if (this.materialize_overlay) {
			this.materialize_overlay.alpha = 0;
		}

		if (!o.ownCreatureHexShade) {
			if (o.id instanceof Array) {
				o.id.forEach((id) => {
					game.creatures[id].hexagons.forEach((hex) => {
						hex.overlayVisualState('ownCreatureHexShade');
					});
				});
			} else {
				if (o.id != 0) {
					game.creatures[o.id].hexagons.forEach((hex) => {
						hex.overlayVisualState('ownCreatureHexShade');
					});
				}
			}
		}

		// Set reachable the given hexes
		o.hexes.forEach((hex) => {
			hex.setReachable();
			if (o.hideNonTarget) {
				hex.unsetNotTarget();
			}
			if (o.targeting) {
				if (hex.creature instanceof Creature) {
					if (hex.creature.id != this.game.activeCreature.id) {
						hex.overlayVisualState('hover h_player' + hex.creature.team);
					}
				} else {
					hex.overlayVisualState('hover h_player' + this.game.activeCreature.team);
				}
			}
		});

		if (o.callbackAfterQueryHexes) {
			o.callbackAfterQueryHexes();
		}

		const onCreatureHover = (creature: Creature, queueEffect, hex: Hex) => {
			if (creature.isDarkPriest()) {
				if (creature === game.activeCreature) {
					if (creature.hasCreaturePlayerGotPlasma()) {
						creature.displayPlasmaShield();
					}
				} else {
					creature.displayHealthStats();
				}
			}
			creature.hexagons.forEach((h) => {
				// Flashing outline
				h.overlayVisualState('hover h_player' + creature.team);
			});
			if (creature !== game.activeCreature) {
				if (!hex.reachable) {
					$j('canvas').css('cursor', 'n-resize');
				} else {
					// Filled hex with color
					hex.displayVisualState('creature player' + hex.creature.team);
				}
			} else if (game.activeCreature.noActionPossible) {
				$j('canvas').css('cursor', 'wait');
			}
			queueEffect(creature.id);
		};

		// ONCLICK
		const onConfirmFn = (hex: Hex) => {
			// Debugger
			const y = hex.y;
			let x = hex.x;

			// Clear display and overlay
			$j('canvas').css('cursor', 'pointer');

			if (this._executionMode && hex.creature instanceof Creature) {
				hex.creature.die({ player: game.players[0] });
				return;
			}

			// Not reachable hex
			if (!hex.reachable) {
				this.lastClickedHex = undefined;

				if (hex.creature instanceof Creature) {
					// If creature
					onCreatureHover(
						hex.creature,
						game.activeCreature !== hex.creature
							? game.UI.bouncexrayQueue.bind(game.UI)
							: game.UI.xrayQueue.bind(game.UI),
						hex,
					);

					// Shout unit's name, show tooltip with unit's name and start a cooldown.
					if (!this.onShoutCooldown) {
						this.onShoutCooldown = true;
						const unitOnClickedHexName = hex.creature.name;
						game.soundsys.playShout(unitOnClickedHexName);
						hex.creature.hint(unitOnClickedHexName, 'creature_name');

						setTimeout(() => {
							this.onShoutCooldown = false;
						}, 1200);
					}
				} else {
					// If nothing
					o.fnOnCancel(hex, o.args); // ON CANCEL
				}
			} else {
				// Reachable hex
				// Offset Pos
				const offset = o.flipped ? o.size - 1 : 0;
				const mult = o.flipped ? 1 : -1; // For flipped player
				// If hex is reachable & creature, reset health indicator bounce
				if (hex.creature instanceof Creature) {
					hex.creature.resetBounce();
				}

				for (let i = 0, size = o.size; i < size; i++) {
					// Try next hexagons to see if they fits
					if (x + offset - i * mult >= this.hexes[y].length || x + offset - i * mult < 0) {
						continue;
					}

					if (this.hexes[y][x + offset - i * mult].isWalkable(o.size, o.id)) {
						x += offset - i * mult;
						break;
					}
				}

				hex = this.hexes[y][x]; // New coords
				game.activeCreature.faceHex(hex);

				if (hex !== this.lastClickedHex) {
					this.lastClickedHex = hex;
				}

				o.fnOnConfirm(hex, o.args, { queryOptions: o });
			}
		};

		const onHoverOffFn = (hex: Hex) => {
			const { creature } = hex;

			if (creature instanceof Creature) {
				creature.resetBounce();
				// toggle hover off event
				if (creature.isDarkPriest()) {
					// the plasma would have been displayed so now display the health again
					creature.updateHealth();
				}
			}

			$j('canvas').css('cursor', 'default');
		};

		// ONMOUSEOVER
		const onSelectFn = (hex: Hex) => {
			let { x } = hex;
			const { y } = hex;

			// Xray
			this.xray(hex);

			// Clear display and overlay
			game.UI.xrayQueue(-1);
			$j('canvas').css('cursor', 'pointer');

			if (hex.creature instanceof Creature) {
				// If creature
				onCreatureHover(hex.creature, game.UI.xrayQueue.bind(game.UI), hex);

				hex.creature.startBounce();
			}

			if (hex.reachable) {
				if (o.fillHexOnHover) {
					this.cleanHex(hex);
					hex.displayVisualState('creature player' + this.game.activeCreature.team);
				}

				// Offset Pos
				const offset = o.flipped ? o.size - 1 : 0;
				const mult = o.flipped ? 1 : -1; // For flipped player

				for (let i = 0, size = o.size; i < size; i++) {
					// Try next hexagons to see if they fit
					if (x + offset - i * mult >= this.hexes[y].length || x + offset - i * mult < 0) {
						continue;
					}

					if (this.hexes[y][x + offset - i * mult].isWalkable(o.size, o.id)) {
						x += offset - i * mult;
						break;
					}
				}

				hex = this.hexes[y][x]; // New coords
				o.fnOnSelect(hex, o.args);
			} else if (!hex.reachable) {
				if (this.materialize_overlay) {
					this.materialize_overlay.alpha = 0;
				}
				hex.overlayVisualState('hover');

				$j('canvas').css('cursor', 'not-allowed');

				// If creature and inactive
				if (hex.creature instanceof Creature && hex.creature !== game.activeCreature) {
					$j('canvas').css('cursor', 's-resize');
				}
			}
		};

		// ONRIGHTCLICK
		const onRightClickFn = (hex: Hex) => {
			if (hex.creature instanceof Creature) {
				game.UI.showCreature(hex.creature.type, hex.creature.player.id, 'grid');
			} else {
				if (game.activeCreature.isDarkPriest()) {
					// If ability used, default to Dark Priest and say materialize has been used
					if (game.activeCreature.abilities[3].used) {
						game.UI.showCreature(
							game.activeCreature.type,
							game.activeCreature.player.id,
							'emptyHex',
						);
					} else if (game.UI.lastViewedCreature) {
						game.UI.showCreature(game.UI.lastViewedCreature, game.UI.selectedPlayer, 'emptyHex');
					} else if (game.UI.selectedCreatureObj) {
						game.UI.toggleDash(true);
					} else {
						game.UI.showCreature(
							game.activeCreature.type,
							game.activeCreature.player.id,
							'emptyHex',
						);
					}
				} else {
					game.UI.showCreature(game.activeCreature.type, game.activeCreature.player.id, 'emptyHex');
				}
			}
		};

		this.forEachHex((hex) => {
			hex.onSelectFn = onSelectFn;
			hex.onHoverOffFn = onHoverOffFn;
			hex.onConfirmFn = onConfirmFn;
			hex.onRightClickFn = onRightClickFn;
		});
	}

	/**
	 * @param {Hex} hex - Hexagon to emphasize.
	 *
	 * If hex contain creature call ghostOverlap for each creature hexes
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
			hex.ghostOverlap();
		}
	}

	/**
	 * Gets a line of hexes given a start point and a direction The result is an array
	 * of hexes, starting from the start point's hex, and extending out in a straight line.
	 * If the coordinate is erroneous, returns an empty array.
	 *
	 * @param {number} x - Coordinate of start hex.
	 * @param {number} y - Coordinate of start hex.
	 * @param {Direction} dir - Direction of the line.
	 * @param {boolean} flipped - Flip the direction.
	 * @returns {Hex[]} Hexes in the line.
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

	cleanHex(hex: Hex) {
		hex.cleanDisplayVisualState();
		hex.cleanOverlayVisualState();
	}

	/**
	 * Update overlay hexes with creature positions
	 */
	updateDisplay() {
		this.cleanDisplay();
		this.cleanOverlay();

		this.hexes.forEach((hex) => {
			hex.forEach((item) => {
				if (item.creature instanceof Creature) {
					if (item.creature.id == this.game.activeCreature.id) {
						item.overlayVisualState(`active creature player${item.creature.team}`);
						item.displayVisualState(`creature player${item.creature.team}`);
					}
				}
			});
		});
	}

	/**
	 * Test if hex exists
	 * @param {{x:number, y:number}} position - Coordinates to test
	 */
	hexExists({ x, y }: { x: number; y: number }): boolean {
		if (y >= 0 && y < this.hexes.length) {
			if (x >= 0 && x < this.hexes[y].length) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Test if hex exists inside array of hexes
	 * @param {Hex} hex - Hex to look for
	 * @param {Hex[]} hexArray - Array of hexes to look for hex in
	 */
	isHexIn(hex, hexArray) {
		for (let i = 0, len = hexArray.length; i < len; i++) {
			if (hexArray[i].x == hex.x && hexArray[i].y == hex.y) {
				return true;
			}
		}

		return false;
	}

	/**
	 * @param {number} x - Integer: Start position
	 * @param {number} y - Integer: Start position
	 * @param {number} distance - Integer: Distance from the start position
	 * @param {number} size - Integer: Creature size
	 * @param {number} id - Integer: Creature ID
	 * @returns {Hex[]} Set of the reachable hexes
	 */
	getMovementRange(x, y, distance, size, id) {
		//	Populate distance (hex.g) in hexes by asking an impossible
		//	destination to test all hexagons
		this.cleanReachable(); // If not pathfinding will bug
		this.cleanPathAttr(true); // Erase all pathfinding data
		search(this.hexes[y][x], new Hex(-2, -2, null, this.game), size, id, this.game.grid);

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

	/**
	 * @param {number} x - Integer : 	Start position
	 * @param {number} y - Integer : 	Start position
	 * @param {number} distance - Integer : 	Distance from the start position
	 * @param {number} size - Integer : 	Creature size
	 * @param {number} id - Integer : 	Creature ID
	 * @returns {Hex[]} Set of the reachable hexes
	 */
	getFlyingRange(x, y, distance, size, id) {
		// Gather all the reachable hexes
		let hexes = this.hexes[y][x].adjacentHex(distance);

		hexes = hexes.filter((hex) => hex.isWalkable(size, id, true));

		return arrayUtils.extendToLeft(hexes, size, this.game.grid);
	}

	/**
	 * @param {number} originx - Integer : Position of the array on the grid
	 * @param {number} originy - Integer : Position of the array on the grid
	 * @param {number} offsetx - Integer : offset flipped for flipped players
	 * @param {boolean} flipped - If player is flipped or not
	 * @param {number[]} array - 2-dimensions Array containing 0 or 1 (boolean)
	 * @returns {Hex[]} Set of corresponding hexes
	 */
	getHexMap(
		originx: number,
		originy: number,
		offsetx: number,
		flipped: boolean,
		array: AugmentedMatrix,
	): Hex[] {
		// Heavy logic in here
		const hexes: Hex[] = [];

		array = array.slice(0) as AugmentedMatrix; // Copy to not modify original
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
					if (this.hexExists({ y: originy + y, x: originx + xfinal })) {
						hexes.push(this.hexes[originy + y][originx + xfinal]);
					}
				}
			}
		}

		return hexes;
	}

	showGrid(val) {
		this.forEachHex((hex) => {
			if (hex.creature) {
				hex.creature.xray(val);
			}

			if (hex.drop) {
				return;
			}

			if (val) {
				hex.displayVisualState('showGrid');
			} else {
				hex.cleanDisplayVisualState('showGrid');
			}
		});
	}

	showMovementRange(creature) {
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

	showCurrentCreatureMovementInOverlay(creature) {
		//lastQueryOpt is same thing as used in redoQuery
		this.lastQueryOpt?.hexes?.forEach((hex) => {
			hex.overlayVisualState('hover h_player' + creature.team);
		});
	}

	findCreatureMovementHexes(creature) {
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
		if (!this.hexExists({ y: this.selectedHex.y - 1, x: this.selectedHex.x })) {
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
		if (!this.hexExists({ y: this.selectedHex.y + 1, x: this.selectedHex.x })) {
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
		if (!this.hexExists({ y: this.selectedHex.y, x: this.selectedHex.x - 1 })) {
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
		if (!this.hexExists({ y: this.selectedHex.y, x: this.selectedHex.x + 1 })) {
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
		this.xray(new Hex(-1, -1, null, this.game));
		// Clear Xray Queue.
		this.game.UI.xrayQueue(-1);
	}

	orderCreatureZ() {
		let index = 0;
		const creatures = this.game.creatures;

		for (let y = 0, leny = this.hexes.length; y < leny; y++) {
			for (let i = 0, len = creatures.length; i < len; i++) {
				if (creatures[i].y == y) {
					this.creatureGroup.remove(creatures[i].grp);
					this.creatureGroup.addAt(creatures[i].grp, index++);
				}
			}

			if (this.materialize_overlay && this.materialize_overlay.posy == y) {
				this.creatureGroup.remove(this.materialize_overlay);
				this.creatureGroup.addAt(this.materialize_overlay, index++);
			}
		}
	}

	//******************//
	//Shortcut functions//
	//******************//

	/**
	 * Execute f for each hexes
	 * @param {function} func - Function to execute
	 * @deprecated use this.allhexes.forEach(fn)
	 */
	forEachHex(func: (hex: Hex) => void) {
		this.hexes.forEach((hex) => {
			hex.forEach(func);
		});
	}

	/**
	 * Execute hex.cleanPathAttr() function for all the grid. Refer to the Hex class for more info
	 * @param {boolean} includeG - Include hex.g attribute
	 * @deprecated use this.allhexes.forEach(hex => hex.cleanPathAttr(includeG))
	 */
	cleanPathAttr(includeG) {
		this.allhexes.forEach((hex) => hex.cleanPathAttr(includeG));
	}

	/**
	 * Execute hex.setReachable() function for all the grid. Refer to the Hex class for more info
	 * @deprecated use this.allhexes.forEach(hex => hex.setReachable())
	 */
	cleanReachable() {
		this.allhexes.forEach((hex) => hex.setReachable());
	}

	/**
	 * Shorcut for $allDispHex.removeClass()
	 * @param {string} cssClass - Class(es) name(s) to remove with jQuery removeClass function
	 * @deprecated use this.allhexes.forEach(hex => hex.cleanDisplayVisualState(cssClass))
	 */
	cleanDisplay(cssClass = '') {
		this.allhexes.forEach((hex) => hex.cleanDisplayVisualState(cssClass));
	}

	/**
	 * @deprecated use this.allhexes.forEach(hex => hex.cleanOverlayVisualState(cssClass))
	 */
	cleanOverlay(cssClass = '') {
		this.allhexes.forEach((hex) => hex.cleanOverlayVisualState(cssClass));
	}

	/**
	 * Draw a preview of the creature at the given coordinates
	 * @param {{x:number, y:number}} pos - Coordinates {x,y}
	 * @param {object} creatureData - Object containing info from the database (game.retrieveCreatureStats)
	 */
	previewCreature(pos, creatureData, player) {
		const game = this.game;
		const hex = this.hexes[pos.y][pos.x - (creatureData.size - 1)];

		if (!this.materialize_overlay) {
			// If sprite does not exists
			// Adding sprite
			this.materialize_overlay = this.creatureGroup.create(0, 0, creatureData.name + '_cardboard');
			this.materialize_overlay.anchor.setTo(0.5, 1);
			this.materialize_overlay.posy = pos.y;
		} else {
			this.materialize_overlay.loadTexture(creatureData.name + '_cardboard');
			if (this.materialize_overlay.posy != pos.y) {
				this.materialize_overlay.posy = pos.y;
				this.orderCreatureZ();
			}
		}

		// Placing sprite
		this.materialize_overlay.x =
			hex.displayPos.x +
			(!player.flipped
				? creatureData.display['offset-x']
				: HEX_WIDTH_PX * creatureData.size -
				  this.materialize_overlay.texture.width -
				  creatureData.display['offset-x']) +
			this.materialize_overlay.texture.width / 2;
		this.materialize_overlay.y =
			hex.displayPos.y + creatureData.display['offset-y'] + this.materialize_overlay.texture.height;
		this.materialize_overlay.alpha = 0.5;

		if (player.flipped) {
			this.materialize_overlay.scale.setTo(-1, 1);
		} else {
			this.materialize_overlay.scale.setTo(1, 1);
		}

		for (let i = 0, size = creatureData.size; i < size; i++) {
			const hexInstance = this.hexes[pos.y][pos.x - i];
			this.cleanHex(hexInstance);
			hexInstance.overlayVisualState('creature selected player' + game.activeCreature.team);
		}
	}

	/**
	 * Internal debugging method to log and visually highlight (in blue) an array
	 * of hexes.
	 * @param {Hex[]} hexes - Hexes to log and visually highlight.
	 */
	__debugHexes(hexes: Hex[]) {
		if (DEBUG) {
			console.debug({ hexes }, hexes.map((hex) => hex.coord).join(', '));
			hexes.forEach((hex) => hex.displayVisualState('creature selected player1'));
		}
	}

	fadeOutTempCreature() {
		// TODO: factor out this function. Use either Creature.creatureSprite
		// or the existing temp creature created by /src/abilities/Dark-Priest.js
		if (this.materialize_overlay) {
			this.materialize_overlay.alpha = 0.5;
			this.game.Phaser.add
				.tween(this.materialize_overlay)
				.to(
					{
						alpha: 0,
					},
					500,
					Phaser.Easing.Linear.None,
				)
				.start();
		}
	}
}
