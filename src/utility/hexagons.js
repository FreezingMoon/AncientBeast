/* HexGrid Class
 *
 * Object containing grid and hexagons DOM element and methods concerning the whole grid
 * Should only have one instance during the game.
 *
 */
var HexGrid = class HexGrid {
	/* Attributes
	 *
	 * NOTE : attributes and variables starting with $ are jquery element
	 * and jquery function can be called dirrectly from them.
	 *
	 * // Jquery attributes
	 * $display : 		Grid container
	 * $creatureW : 	Creature Wrapper container
	 * $inpthexesW : 	Input Hexagons container
	 * $disphexesW : 	Display Hexagons container
	 * $overhexesW : 	Overlay Hexagons container
	 * $allInptHex : 	Shortcut to all input hexagons DOM elements (for input events)
	 * $allDispHex : 	Shortcut to all display hexagons DOM elements (to change style of hexagons)
	 *
	 * // Normal attributes
	 * hexes : 				Array : 	Contain all hexes in row arrays (hexes[y][x])
	 * lastClickedHex : 	Hex : 		Last hex clicked!
	 */

	/* Constructor
	 *
	 * Create attributes and populate JS grid with Hex objects
	 */
	constructor(opts, game) {
		let defaultOpt = {
			nbrRow: 9,
			nbrhexesPerRow: 16,
			firstRowFull: false,
		}

		opts = $j.extend(defaultOpt, opts);

		this.game = game;
		this.hexes = new Array(); // Hex Array
		this.traps = new Array(); // Traps Array
		this.allhexes = new Array(); // All hexes
		this.lastClickedHex = []; // Array of hexagons containing last calculated pathfinding

		this.display = game.Phaser.add.group(undefined, "displayGrp");
		this.display.x = 230;
		this.display.y = 380;

		this.gridGroup = game.Phaser.add.group(this.display, "gridGrp");
		this.gridGroup.scale.set(1, 0.75);

		this.trapGroup = game.Phaser.add.group(this.gridGroup, "trapGrp");
		this.disphexesGroup = game.Phaser.add.group(this.gridGroup, "disphexesGrp");
		this.overhexesGroup = game.Phaser.add.group(this.gridGroup, "overhexesGrp");
		this.dropGroup = game.Phaser.add.group(this.display, "dropGrp");
		this.creatureGroup = game.Phaser.add.group(this.display, "creaturesGrp");
		// Parts of traps displayed over creatures
		this.trapOverGroup = game.Phaser.add.group(this.display, "trapOverGrp");
		this.trapOverGroup.scale.set(1, 0.75);
		this.inpthexesGroup = game.Phaser.add.group(this.gridGroup, "inpthexesGrp");

		// Populate grid
		for (let row = 0; row < opts.nbrRow; row++) {
			this.hexes.push(new Array());
			for (let hex = 0, len = opts.nbrhexesPerRow; hex < len; hex++) {
				if (hex == opts.nbrhexesPerRow - 1) {
					if (row % 2 == 0 && !opts.firstRowFull || row % 2 == 1 && opts.firstRowFull) {
						continue;
					}
				}

				this.hexes[row][hex] = new Hex(hex, row, this);
				this.allhexes.push(this.hexes[row][hex]);
			};
		};

		this.selectedHex = this.hexes[0][0];
	}

	querySelf(o) {
		let game = this.game,
			defaultOpt = {
				fnOnConfirm: (creature, args) => {},
				fnOnSelect: (creature, args) => {
					creature.hexagons.forEach((hex) => {
						hex.overlayVisualState("creature selected player" + hex.creature.team);
					});
				},
				fnOnCancel: () => {
					this.game.activeCreature.queryMove();
				},
				args: {},
				confirmText: "Confirm",
				id: game.activeCreature.id
			};

		o = $j.extend(defaultOpt, o);

		//o.fnOnConfirm(G.activeCreature,o.args); // Auto-confirm

		game.activeCreature.hint(o.confirmText, "confirm");

		this.queryHexes({
			fnOnConfirm: (hex, args) => {
				args.opt.fnOnConfirm(game.activeCreature, args.opt.args);
			},
			fnOnSelect: (hex, args) => {
				args.opt.fnOnSelect(game.activeCreature, args.opt.args);
			},
			fnOnCancel: (hex, args) => {
				args.opt.fnOnCancel(game.activeCreature, args.opt.args);
			},
			args: {
				opt: o
			},
			hexes: game.activeCreature.hexagons,
			hideNonTarget: true,
			id: o.id
		});
	}

	/* queryDirection(o)
	 *
	 * Shortcut to queryChoice with specific directions
	 *
	 * fnOnSelect : 		Function : 	Function applied when clicking on one of the available hexes.
	 * fnOnConfirm : 		Function : 	Function applied when clicking again on the same hex.
	 * fnOnCancel : 		Function : 	Function applied when clicking a non reachable hex
	 * team : 				Team
	 * requireCreature : 	Boolean : 	Disable a choice if it does not contain a creature matching the team argument
	 * distance :			Integer :	if defined, maximum distance of query in hexes
	 * minDistance :		Integer :	if defined, minimum distance of query, 1 = 1 hex gap required
	 * args : 				Object : 	Object given to the events function (to easily pass variable for these function)
	 */
	queryDirection(o) {
		let game = this.game,
			defaultOpt = {
				team: Team.enemy,
				requireCreature: true,
				id: 0,
				flipped: false,
				x: 0,
				y: 0,
				hexesDashed: [],
				directions: [1, 1, 1, 1, 1, 1],
				includeCreature: true,
				stopOnCreature: true,
				dashedHexesAfterCreatureStop: true,
				distance: 0,
				minDistance: 0,
				sourceCreature: undefined,
			};

		// This is alway true
		o.isDirectionsQuery = true;
		o = this.getDirectionChoices(o);
		this.queryChoice(o);
	}

	/**
	 * Get an object that contains the choices and hexesDashed for a direction
	 * query.
	 * @param {Object} o
	 * @returns {Object}
	 */
	getDirectionChoices(o) {
		let game = this.game,
			defaultOpt = {
				team: Team.enemy,
				requireCreature: true,
				id: 0,
				flipped: false,
				x: 0,
				y: 0,
				hexesDashed: [],
				directions: [1, 1, 1, 1, 1, 1],
				includeCreature: true,
				stopOnCreature: true,
				dashedHexesAfterCreatureStop: true,
				distance: 0,
				minDistance: 0,
				sourceCreature: undefined,
			};

		o = $j.extend(defaultOpt, o);

		// Clean Direction
		this.forEachHex((hex) => {
			hex.direction = -1;
		});

		o.choices = [];
		for (let i = 0, len = o.directions.length; i < len; i++) {
			if (!!o.directions[i]) {
				let dir = [],
					fx = 0;

				if (o.sourceCreature instanceof Creature) {
					let flipped = o.sourceCreature.player.flipped;
					if ((!flipped && i > 2) || (flipped && i < 3)) {
						fx = -1 * (o.sourceCreature.size - 1);
					}
				}

				dir = this.getHexLine(o.x + fx, o.y, i, o.flipped);

				// Limit hexes based on distance
				if (o.distance > 0) {
					dir = dir.slice(0, o.distance + 1);
				}

				if (o.minDistance > 0) {
					// Exclude current hex
					dir = dir.slice(o.minDistance + 1);
				}

				let hexesDashed = [];
				dir.forEach((item) => {
					item.direction = (o.flipped) ? 5 - i : i;
					if (o.stopOnCreature && o.dashedHexesAfterCreatureStop) {
						hexesDashed.push(item);
					}
				});

				arrayUtils.filterCreature(dir, o.includeCreature, o.stopOnCreature, o.id);

				if (dir.length === 0) {
					continue;
				}

				if (o.requireCreature) {
					let validChoice = false;
					// Search each hex for a creature that matches the team argument
					for (let j = 0, len = dir.length; j < len; j++) {
						let creaTarget = dir[j].creature;

						if (creaTarget instanceof Creature && creaTarget.id !== o.id) {
							let creaSource = G.creatures[o.id];
							if (isTeam(creaSource, creaTarget, o.team)) {
								validChoice = true;
								break;
							}
						}
					}

					if (!validChoice) {
						continue;
					}
				}

				if (o.stopOnCreature && o.includeCreature && (i === 1 || i === 4)) {
					// Only straight direction
					if (arrayUtils.last(dir).creature instanceof Creature) {
						// Add full creature
						let creature = arrayUtils.last(dir).creature;
						dir.pop();
						dir = dir.concat(creature.hexagons);
					}
				}

				dir.forEach((item) => {
					arrayUtils.removePos(hexesDashed, item);
				});

				o.hexesDashed = o.hexesDashed.concat(hexesDashed);
				o.choices.push(dir);
			}
		}

		return o;
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
		let game = this.game,
			defaultOpt = {
				fnOnConfirm: (choice, args) => {
					game.activeCreature.queryMove();
				},
				fnOnSelect: (choice, args) => {
					choice.forEach((item) => {
						if (item.creature instanceof Creature) {
							item.overlayVisualState("creature selected player" + item.creature.team);
						} else {
							item.displayVisualState("adj");
						}
					});
				},
				fnOnCancel: (hex, args) => {
					game.activeCreature.queryMove();
				},
				team: Team.enemy,
				requireCreature: 1,
				id: 0,
				args: {},
				flipped: false,
				choices: [],
				hexesDashed: [],
				isDirectionsQuery: false,
				hideNonTarget: true
			};

		o = $j.extend(defaultOpt, o);

		let hexes = [];
		for (let i = 0, len = o.choices.length; i < len; i++) {
			let validChoice = true;

			if (o.requireCreature) {
				validChoice = false;
				// Search each hex for a creature that matches the team argument
				for (let j = 0, len = o.choices[i].length; j < len; j++) {
					if (o.choices[i][j].creature instanceof Creature && o.choices[i][j].creature != o.id) {
						let creaSource = G.creatures[o.id],
							creaTarget = o.choices[i][j].creature;

						if (isTeam(creaSource, creaTarget, o.team)) {
							validChoice = true;
						}
					}
				}
			}

			if (validChoice) {
				hexes = hexes.concat(o.choices[i]);
			} else if (o.isDirectionsQuery) {
				this.forEachHex((hex) => {
					if (o.choices[i][0].direction == hex.direction) {
						arrayUtils.removePos(o.hexesDashed, hex);
					}
				});
			}
		}

		this.queryHexes({
			fnOnConfirm: (hex, args) => {
				// Determine which set of hexes (choice) the hex is part of
				for (let i = 0, len = args.opt.choices.length; i < len; i++) {
					for (let j = 0, lenj = args.opt.choices[i].length; j < lenj; j++) {
						if (hex.pos == args.opt.choices[i][j].pos) {
							args.opt.args.direction = hex.direction;
							args.opt.fnOnConfirm(args.opt.choices[i], args.opt.args);
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
							args.opt.fnOnSelect(args.opt.choices[i], args.opt.args);
							return;
						}
					}
				}
			},
			fnOnCancel: o.fnOnCancel,
			args: {
				opt: o
			},
			hexes: hexes,
			hexesDashed: o.hexesDashed,
			flipped: o.flipped,
			hideNonTarget: o.hideNonTarget,
			id: o.id
		});
	}

	/* queryCreature(o)
	 *
	 * fnOnSelect : 	Function : 	Function applied when clicking on one of the available hexes.
	 * fnOnConfirm : 	Function : 	Function applied when clicking again on the same hex.
	 * fnOnCancel : 	Function : 	Function applied when clicking a non reachable hex
	 * team : 			Team
	 * id : 			Integer : 	Creature ID
	 * args : 			Object : 	Object given to the events function (to easily pass variable for these function)
	 */
	queryCreature(o) {
		let game = this.game,
			defaultOpt = {
				fnOnConfirm: (creature, args) => {
					game.activeCreature.queryMove();
				},
				fnOnSelect: (creature, args) => {
					creature.tracePosition({
						overlayClass: "creature selected player" + creature.team
					});
				},
				fnOnCancel: (hex, args) => {
					game.activeCreature.queryMove();
				},
				optTest: (creature) => {
					return true;
				},
				args: {},
				hexes: [],
				hexesDashed: [],
				flipped: false,
				id: 0,
				team: Team.enemy,
			};

		o = $j.extend(defaultOpt, o);

		// Exclude everything but the creatures
		o.hexes = o.hexes.filter((hex) => {
			if (hex.creature instanceof Creature && hex.creature.id != o.id) {
				if (!o.optTest(hex.creature)) {
					return false;
				}

				let creaSource = game.creatures[o.id],
					creaTarget = hex.creature;

				if (isTeam(creaSource, creaTarget, o.team)) {
					return true;
				}
			}

			return false;
		});

		let extended = [];
		o.hexes.forEach((hex) => {
			extended = extended.concat(hex.creature.hexagons);
		});

		o.hexes = extended;

		this.queryHexes({
			fnOnConfirm: (hex, args) => {
				let creature = hex.creature;
				args.opt.fnOnConfirm(creature, args.opt.args);
			},
			fnOnSelect: (hex, args) => {
				let creature = hex.creature;
				args.opt.fnOnSelect(creature, args.opt.args);
			},
			fnOnCancel: o.fnOnCancel,
			args: {
				opt: o
			},
			hexes: o.hexes,
			hexesDashed: o.hexesDashed,
			flipped: o.flipped,
			hideNonTarget: true,
			id: o.id
		});
	}

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
	 */
	queryHexes(o) {
		let game = this.game,
			defaultOpt = {
				fnOnConfirm: (hex, args) => {
					game.activeCreature.queryMove();
				},
				fnOnSelect: (hex, args) => {
					game.activeCreature.faceHex(hex, undefined, true);
					hex.overlayVisualState("creature selected player" + game.activeCreature.team);
				},
				fnOnCancel: (hex, args) => {
					game.activeCreature.queryMove();
				},
				args: {},
				hexes: [],
				hexesDashed: [],
				size: 1,
				id: 0,
				flipped: false,
				hideNonTarget: false,
				ownCreatureHexShade: false,
			};

		o = $j.extend(defaultOpt, o);

		this.lastClickedHex = [];

		// Save the last Query
		this.lastQueryOpt = $j.extend({}, o); // Copy Obj

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
				hex.displayVisualState("dashed");
			} else {
				hex.cleanDisplayVisualState("dashed");
			}
		});

		// Cleanup
		if (this.materialize_overlay) {
			this.materialize_overlay.alpha = 0;
		}

		// Creature hex shade
		//this.$allOverHex.removeClass("ownCreatureHexShade");

		if (!o.ownCreatureHexShade) {
			if (o.id instanceof Array) {
				o.id.forEach((id) => {
					game.creatures[id].hexagons.forEach((hex) => {
						hex.overlayVisualState('ownCreatureHexShade')
					});
				});
			} else {
				if (o.id != 0) {
					game.creatures[o.id].hexagons.forEach((hex) => {
						hex.overlayVisualState('ownCreatureHexShade')
					})
				}
			}
		}

		// Set reachable the given hexes
		o.hexes.forEach((hex) => {
			hex.setReachable();
			if (o.hideNonTarget) {
				hex.unsetNotTarget();
			}
		});

		// ONCLICK
		let onConfirmFn = (hex) => {
			let y = hex.y,
				x = hex.x;

			// Clear display and overlay
			this.updateDisplay();
            $j("canvas").css("cursor", "pointer");

			// Not reachable hex
			if (!hex.reachable) {
				this.lastClickedHex = [];
				if (hex.creature instanceof Creature) { // If creature
					onCreatureHover(hex.creature, (game.activeCreature !== hex.creature) ? game.UI.bouncexrayQueue.bind(game.UI) : game.UI.xrayQueue.bind(game.UI), hex );
				} else { // If nothing
					o.fnOnCancel(hex, o.args); // ON CANCEL
				}
			} else {
				// Reachable hex
				// Offset Pos
				let offset = (o.flipped) ? o.size - 1 : 0,
					mult = (o.flipped) ? 1 : -1, // For flipped player
					availablePos = false;

				for (let i = 0, size = o.size; i < size; i++) { // Try next hexagons to see if they fits
					if ((x + offset - i * mult >= this.hexes[y].length) || (x + offset - i * mult < 0)) {
						continue;
					}

					if (this.hexes[y][x + offset - i * mult].isWalkable(o.size, o.id)) {
						x += offset - i * mult;
						availablePos = true;
						break;
					}
				};

				hex = this.hexes[y][x]; // New coords
				let clickedtHex = hex;

				game.activeCreature.faceHex(clickedtHex, undefined, true, true);

				if (clickedtHex != this.lastClickedHex) {
					this.lastClickedHex = clickedtHex;
					// ONCLICK
					o.fnOnConfirm(clickedtHex, o.args);
				} else {
					// ONCONFIRM
					o.fnOnConfirm(clickedtHex, o.args);
				}
			}
		};


		let onHoverOffFn = (hex) => {
			if (hex.creature instanceof Creature) { // toggle hover off event
				let creature = hex.creature;
				if (creature.type == "--") { // the plasma would have been displayed so now display the health again
					creature.updateHealth();
				}
			}
		};

		// ONMOUSEOVER
		let onSelectFn = (hex) => {
			let y = hex.y,
				x = hex.x;

			// Xray
			this.xray(hex);

			// Clear display and overlay
			this.updateDisplay();
			game.UI.xrayQueue(-1);
			$j("canvas").css("cursor", "pointer");

            if (hex.creature instanceof Creature) { // If creature
                onCreatureHover(hex.creature, game.UI.xrayQueue.bind(game.UI), hex );
            } else { // If nothing
                hex.overlayVisualState("hover");
            }

			// Not reachable hex
			if (!hex.reachable) {
				if (hex.materialize_overlay) {
					hex.materialize_overlay.alpha = 0;
				}
			} else { // Reachable hex
				//Offset Pos
				let offset = (o.flipped) ? o.size - 1 : 0,
					mult = (o.flipped) ? 1 : -1, // For flipped player
					availablePos = false;

				for (let i = 0, size = o.size; i < size; i++) { // Try next hexagons to see if they fit
					if ((x + offset - i * mult >= this.hexes[y].length) || (x + offset - i * mult < 0)) {
						continue;
					}

					if (this.hexes[y][x + offset - i * mult].isWalkable(o.size, o.id)) {
						x += offset - i * mult;
						availablePos = true;
						break;
					}
				};

				hex = this.hexes[y][x]; // New coords
				o.fnOnSelect(hex, o.args);
			}
		};

		// ONRIGHTCLICK
		let onRightClickFn = () => {
			let y = this.y,
				x = this.x;

			if (this.creature instanceof Creature) { // If creature
				game.UI.showCreature(this.creature.type, this.creature.player.id);
			} else {
				game.UI.showCreature(game.activeCreature.type, game.activeCreature.player.id);
			}
		};
		
		let onCreatureHover = (creature, queueEffect, hex) => {
			if (creature.type == "--") {
				if (creature === game.activeCreature) {
					if (creature.hasCreaturePlayerGotPlasma()) {
						creature.displayPlasmaShield();
					}
				} else {
					creature.displayHealthStats();
				}
			}
			creature.hexagons.forEach((hex) => {
                hex.overlayVisualState("hover h_player" + creature.team);
            });
			if ( creature !== game.activeCreature ) {
			    if( !hex.reachable ) {
			        $j("canvas").css("cursor", "n-resize");
			    } else {
			        hex.displayVisualState( "creature player" + hex.creature.team );
			    }
			}
			queueEffect(creature.id);
		}


		this.forEachHex((hex) => {
			hex.onSelectFn = onSelectFn;
			hex.onHoverOffFn = onHoverOffFn;
			hex.onConfirmFn = onConfirmFn;
			hex.onRightClickFn = onRightClickFn;
		});

	}

	/* xray(hex)
	 *
	 * hex : 	Hex : 	Hexagon to emphase
	 *
	 * If hex contain creature call ghostOverlap for each creature hexes
	 *
	 */
	xray(hex) {
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

	/* hideCreatureHexes()
	 *
	 * Ghosts hexes with creatures
	 * TODO: This does nothing...
	 */
	hideCreatureHexes(except) {
		this.game.creatures.forEach((creature) => {
			if (creature instanceof Creature) {
				let hide = true;
				if (except instanceof Creature) {
					if (except.id == creature.id) {
						hide = false;
					}
				}

				if (hide) {
					// this.$display.addClass("ghosted_hidden");
					// this.$health.addClass("ghosted_hidden");
					for (let i = 0; i < creature.size; i++) {
						if (creature.hexagons[i]) {
							// this.hexagons[i].$display.hide();
							// this.hexagons[i].$overlay.hide();
						}
					}
				}
			}
		});
	}

	/* getHexLine(x, y, dir, flipped)
	 *
	 * Gets a line of hexes given a start point and a direction
	 * The result is an array of hexes, starting from the start point's hex, and
	 * extending out in a straight line.
	 * If the coordinate is erroneous, returns an empty array.
	 *
	 * x, y: coordinate of start hex
	 * dir: direction number (0 = upright, continues clockwise to 5 = upleft)
	 * flipped
	 */
	getHexLine(x, y, dir, flipped) {
		switch (dir) {
			case 0: // Upright
				return this.getHexMap(x, y - 8, 0, flipped, matrices.diagonalup).reverse();
			case 1: // StraitForward
				return this.getHexMap(x, y, 0, flipped, matrices.straitrow);
			case 2: // Downright
				return this.getHexMap(x, y, 0, flipped, matrices.diagonaldown);
			case 3: // Downleft
				return this.getHexMap(x, y, -4, flipped, matrices.diagonalup);
			case 4: // StraitBackward
				return this.getHexMap(x, y, 0, !flipped, matrices.straitrow);
			case 5: // Upleft
				return this.getHexMap(x, y - 8, -4, flipped, matrices.diagonaldown).reverse();
			default:
				return [];
		}
	}

	/* showCreaturehexes()
	 *
	 * Unghosts hexes with creatures
	 * TODO: This also does nothing...
	 */
	showCreaturehexes() {
		this.game.creatures.forEach((creature) => {
			if (creature instanceof Creature) {
				// this.display.overlayVisualState("ghosted_hidden");
				// this.health.overlayVisualState("ghosted_hidden");
				for (let i = 0; i < creature.size; i++) {
					//if(this.hexagons[i]) {
					//	this.hexagons[i].display.alpha = 1;
					//	this.hexagons[i].overlay.alpha = 1;
					//}
				}
			}
		});
	}

	/* clearHexViewAlterations()
	 *
	 * Removes all hex view alterations like hideCreatureHexes used
	 * Squashes bugs by making sure all view alterations are removed
	 * on a change of ability/change of turn/etc
	 * If you make a new hex view alteration call the function to remove
	 * the alteration in here to ensure it gets cleared at the right time
	 */
	clearHexViewAlterations() {
		this.showCreaturehexes();
	}

	/* updateDisplay()
	 *
	 * Update overlay hexes with creature positions
	 */
	updateDisplay() {
		this.cleanDisplay();
		this.cleanOverlay();
		this.hexes.forEach((hex) => {
			hex.forEach((item) => {
				if (item.creature instanceof Creature) {
					if (item.creature.id == this.game.activeCreature.id) {
						item.overlayVisualState("active creature player" + item.creature.team);
						item.displayVisualState("creature player" + item.creature.team);
					}
				}
			});
		});

		// targeting for abilities
		if (this.lastQueryOpt && this.lastQueryOpt.hexes) {
		    this.lastQueryOpt.hexes.forEach( (hex) => {
                if (hex.creature instanceof Creature) {
                    if (hex.creature.id != this.game.activeCreature.id ) {
                        hex.overlayVisualState( "hover h_player" + hex.creature.team );
                    }
                }
            });
		}
	}

	/* hexExists(y, x)
	 *
	 * x : 	Integer : 	Coordinates to test
	 * y : 	Integer : 	Coordinates to test
	 *
	 * Test if hex exists
	 * TODO: Why is this backwards... standard corodinates systems follow x,y nomenclature...
	 */
	hexExists(y, x) {
		if ((y >= 0) && (y < this.hexes.length)) {
			if ((x >= 0) && (x < this.hexes[y].length)) {
				return true;
			}
		}

		return false;
	}

	/* isHexIn(hex, hexArray)
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
		astar.search(this.hexes[y][x], new Hex(-2, -2, null, this.game), size, id);

		// Gather all the reachable hexes
		let hexes = [];
		this.forEachHex((hex) => {
			// If not Too far or Impossible to reach
			if (hex.g <= distance && hex.g != 0)
				hexes.push(this.hexes[hex.y][hex.x]);
		});

		return arrayUtils.extendToLeft(hexes, size);
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

		hexes = hexes.filter((hex) => hex.isWalkable(size, id, true));

		return arrayUtils.extendToLeft(hexes, size);
	}

	/* getHexMap(originx, originy, array)
	 *
	 * array : 	Array : 	2-dimentions Array containing 0 or 1 (boolean)
	 * originx : 	Integer : 	Position of the array on the grid
	 * originy : 	Integer : 	Position of the array on the grid
	 * offsetx : 	Integer : 	offset flipped for flipped players
	 * flipped : 	Boolean : 	If player is flipped or not
	 *
	 * return : 	Array : 	Set of corresponding hexes
	 */
	getHexMap(originx, originy, offsetx, flipped, array) { // Heavy logic in here
		let hexes = [];

		array = array.slice(0); // Copy to not modify original
		originx += (flipped) ? 1 - array[0].length - offsetx : -1 + offsetx;

		for (let y = 0, len = array.length; y < len; y++) {
			array[y] = array[y].slice(0); // Copy row

			// Translating to flipped patern
			if (flipped && y % 2 != 0) { // Odd rows
				array[y].push(0);
			}

			// Translating even to odd row patern
			array[y].unshift(0);
			if (originy % 2 != 0 && y % 2 != 0) { // Even rows
				if (flipped) {
					array[y].pop(); // Remove last element as the array will be parse backward
				} else {
					array[y].splice(0, 1); // Remove first element
				}
			}

			// Gathering hexes
			for (let x = 0, len = array[y].length; x < len; x++) {
				if (!!array[y][x]) {
					let xfinal = (flipped) ? array[y].length - 1 - x : x; // Parse the array backward for flipped player
					if (this.hexExists(originy + y, originx + xfinal)) {
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
				hex.displayVisualState("showGrid");
			} else {
				hex.cleanDisplayVisualState("showGrid");
			}
		});
	}

	// TODO: Rewrite methods used here to only require the creature as an argument.
	showMovementRange(id) {
		let creature = this.game.creatures[id],
			hexes;

		if (creature.movementType() === "flying") {
			hexes = this.getFlyingRange(creature.x, creature.y, creature.stats.movement, creature.size, creature.id);
		} else {
			hexes = this.getMovementRange(creature.x, creature.y, creature.stats.movement, creature.size, creature.id);
		}

		// Block all hexes
		this.forEachHex((hex) => {
			hex.unsetReachable();
		});

		// Set reachable the given hexes
		hexes.forEach((hex) => {
			hex.setReachable();
		});

	}

	selectHexUp() {
		if (this.hexExists(this.selectedHex.y - 1, this.selectedHex.x)) {
			let hex = this.hexes[this.selectedHex.y - 1][this.selectedHex.x];
			this.selectedHex = hex;
			hex.onSelectFn();
		}
	}

	selectHexDown() {
		if (this.hexExists(this.selectedHex.y + 1, this.selectedHex.x)) {
			let hex = this.hexes[this.selectedHex.y + 1][this.selectedHex.x];
			this.selectedHex = hex;
			hex.onSelectFn();
		}
	}

	selectHexLeft() {
		if (this.hexExists(this.selectedHex.y, this.selectedHex.x - 1)) {
			let hex = this.hexes[this.selectedHex.y][this.selectedHex.x - 1];
			this.selectedHex = hex;
			hex.onSelectFn();
		}
	}

	selectHexRight() {
		if (this.hexExists(this.selectedHex.y, this.selectedHex.x + 1)) {
			let hex = this.hexes[this.selectedHex.y][this.selectedHex.x + 1];
			this.selectedHex = hex;
			hex.onSelectFn();
		}
	}

	confirmHex(hex) {
		if (this.game.freezedInput) {
			return;
		}

		this.selectedHex.onConfirmFn(hex);
	}

	orderCreatureZ() {
		let index = 0,
			creatures = this.game.creatures;

		for (let y = 0, leny = this.hexes.length; y < leny; y++) {
			for (let i = 1, len = creatures.length; i < len; i++) {
				if (creatures[i].y == y) {
					this.creatureGroup.remove(creatures[i].grp);
					this.creatureGroup.addAt(creatures[i].grp, index++);
				}
			};

			if (this.materialize_overlay && this.materialize_overlay.posy == y) {
				this.creatureGroup.remove(this.materialize_overlay);
				this.creatureGroup.addAt(this.materialize_overlay, index++);
			}
		};
		// G.grid.creatureGroup.sort();
	}

	//******************//
	//Shortcut functions//
	//******************//

	/* forEachHex(f)
	 *
	 * f : Function : 	Function to execute
	 *
	 * Execute f for each hexes
	 */
	forEachHex(func) {
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

	/* cleanDisplay(cssClass)
	 *
	 * cssClass : 	String : 	Class(es) name(s) to remove with jQuery removeClass function
	 *
	 * Shorcut for $allDispHex.removeClass()
	 */
	cleanDisplay(cssClass) {
		this.forEachHex((hex) => {
			hex.cleanDisplayVisualState(cssClass)
		});
	}

	cleanOverlay(cssClass) {
		this.forEachHex((hex) => {
			hex.cleanOverlayVisualState(cssClass)
		});
	}

	/* previewCreature(creatureData)
	 *
	 * pos : 			Object : 	Coordinates {x,y}
	 * creatureData : 	Object : 	Object containing info from the database (G.retreiveCreatureStats)
	 *
	 * Draw a preview of the creature at the given coordinates
	 */
	previewCreature(pos, creatureData, player) {
		let game = this.game,
			hex = this.hexes[pos.y][pos.x - (creatureData.size - 1)];

		this.updateDisplay(); // Retrace players creatures
		if (!this.materialize_overlay) { // If sprite does not exists
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
		this.materialize_overlay.x = hex.displayPos.x + ((!player.flipped) ? creatureData.display["offset-x"] : 90 * creatureData.size - this.materialize_overlay.texture.width - creatureData.display["offset-x"]) + this.materialize_overlay.texture.width / 2;
		this.materialize_overlay.y = hex.displayPos.y + creatureData.display["offset-y"] + this.materialize_overlay.texture.height;
		this.materialize_overlay.alpha = 0.5;

		if (player.flipped) {
			this.materialize_overlay.scale.setTo(-1, 1);
		} else {
			this.materialize_overlay.scale.setTo(1, 1);
		}

		for (let i = 0, size = creatureData.size; i < size; i++) {
			this.hexes[pos.y][pos.x - i].overlayVisualState("creature selected player" + game.activeCreature.team);
		}
	}

	debugHex(hexes) {
		let i = 0;

		$j(".debug").remove();
		hexes.forEach((hex) => {
			let a = this.$creatureW.append('<div class=".debug" id="debug' + i + '"></div>').children("#debug" + i);

			a.css({
				position: 'absolute',
				width: 20,
				height: 20,
				"background-color": 'yellow'
			});
			a.css(hex.displayPos);

			i++;
		});
	}
}; // End of HexGrid Class

/* Hex Class
 *
 * Object containing hex informations, positions and DOM elements
 */
var Hex = class Hex {
	/* Attributes
	 *
	 * NOTE : attributes and variables starting with $ are jquery element
	 * and jquery function can be called dirrectly from them.
	 *
	 * //Jquery attributes
	 * $display : 		Hex display element
	 * $overlay : 		Hex overlay element
	 * $input : 		Hex input element (bind controls on it)
	 *
	 * //Normal attributes
	 * x : 			Integer : 	Hex coordinates
	 * y : 			Integer : 	Hex coordinates
	 * pos : 			Object : 	Pos object for hex comparison {x,y}
	 *
	 * f : 			Integer : 	Pathfinding score f = g + h
	 * g : 			Integer : 	Pathfinding distance from start
	 * h : 			Integer : 	Pathfinding distance to finish
	 * pathparent : 	Hex : 		Pathfinding parent hex (the one you came from)
	 *
	 * blocked : 		Boolean : 	Set to true if an obstacle it on it. Restrict movement.
	 * creature : 		Creature : 	Creature object , undefined if empty
	 * reachable : 	Boolean : 	Set to true if accessible by current action
	 *
	 * displayPos : 	Object : 	Pos object to position creature with absolute coordinates {left,top}
	 */

	/* Constructor(x,y)
	 *
	 * x : 			Integer : 	Hex coordinates
	 * y : 			Integer : 	Hex coordinates
	 */
	constructor(x, y, grid, game) {
		this.game = grid && grid.game || game;
		this.grid = grid;
		this.x = x;
		this.y = y;
		this.pos = {
			x: x,
			y: y
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
		this.displayClasses = "";
		this.overlayClasses = "";

		// Horizontal hex grid, width is distance between opposite sides
		this.width = 90;
		this.height = this.width / Math.sqrt(3) * 2 * 0.75;
		this.displayPos = {
			x: ((y % 2 === 0) ? x + 0.5 : x) * this.width,
			y: y * this.height
		};

		this.originalDisplayPos = $j.extend({}, this.displayPos);

		this.tween = null;

		if (grid) {

			// 10px is the offset from the old version

			this.display = grid.disphexesGroup.create(this.displayPos.x - 10, this.displayPos.y, 'hex');
			this.display.alpha = 0;

			this.overlay = grid.overhexesGroup.create(this.displayPos.x - 10, this.displayPos.y, 'hex');
			this.overlay.alpha = 0;

			this.input = grid.inpthexesGroup.create(this.displayPos.x - 10, this.displayPos.y, 'input');
			this.input.inputEnabled = true;
			this.input.input.pixelPerfect = true;
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

			this.input.events.onInputOut.add(() => {
				if (game.freezedInput || game.UI.dashopen) {
					return;
				}

				grid.redoLastQuery();
				grid.xray(new Hex(-1, -1, null, game)); // Clear Xray
				game.UI.xrayQueue(-1); // Clear Xray Queue
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

		this.displayPos.y = this.displayPos.y * .75 + 30;

		this.onSelectFn = function() {};
		this.onHoverOffFn = function() {};
		this.onConfirmFn = function() {};
		this.onRightClickFn = function() {};

		this.trap = undefined;
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
		let adjHex = [];

		for (let i = -distance; i <= distance; i++) {
			let deltaY = i,
				startX,
				endX;

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
				let x = this.x + deltaX,
					y = this.y + deltaY;

				// Exclude current hex
				if (deltaY == 0 && deltaX == 0) {
					continue;
				}

				if (y < this.grid.hexes.length && y >= 0 && x < this.grid.hexes[y].length && x >= 0) { // Exclude inexisting hexes
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
		let grid = this.grid || this.game.grid,
			ghostedCreature;

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
		};
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
		this.g = (includeG) ? 0 : this.g;
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
	isWalkable(size, id, ignoreReachable) {
		let blocked = false;

		for (let i = 0; i < size; i++) {
			// For each Hex of the creature
			if ((this.x - i) >= 0 && (this.x - i) < this.grid.hexes[this.y].length) { //if hex exists
				let hex = this.grid.hexes[this.y][this.x - i];
				// Verify if blocked. If it's blocked by one attribute, OR statement will keep it status
				blocked = blocked || hex.blocked;

				if (!ignoreReachable) {
					blocked = blocked || !hex.reachable;
				}

				let isNotMovingCreature;
				if (hex.creature instanceof Creature) {
					if (id instanceof Array) {
						isNotMovingCreature = (id.indexOf(hex.creature.id) == -1);
					} else {
						isNotMovingCreature = (hex.creature.id != id);
					}

					blocked = blocked || isNotMovingCreature; // Not blocked if this block contains the moving creature
				}
			} else {
				// Blocked by grid boundaries
				blocked = true;
			}
		};

		return !blocked; // Its walkable if it's NOT blocked
	}

	/* overlayVisualState
	 *
	 * Change the appearance of the overlay hex
	 */
	overlayVisualState(classes) {
		classes = (classes) ? classes : "";
		this.overlayClasses += " " + classes + " ";
		this.updateStyle();
	}

	/* displayVisualState
	 *
	 * Change the appearance of the display hex
	 */
	displayVisualState(classes) {
		classes = (classes) ? classes : "";
		this.displayClasses += " " + classes + " ";
		this.updateStyle();
	}

	/* cleanOverlayVisualState
	 *
	 * Clear the appearance of the overlay hex
	 */
	cleanOverlayVisualState(classes) {
		classes = classes || "creature weakDmg active moveto selected hover h_player0 h_player1 h_player2 h_player3 player0 player1 player2 player3";
		let a = classes.split(' ');

		for (let i = 0, len = a.length; i < len; i++) {
			let regex = new RegExp("\\b" + a[i] + "\\b", 'g');
			this.overlayClasses = this.overlayClasses.replace(regex, '');
		};

		this.updateStyle();
	}

	/* cleanDisplayVisualState
	 *
	 * Clear the appearance of the display hex
	 */
	cleanDisplayVisualState(classes) {
		classes = classes || "adj hover creature player0 player1 player2 player3";
		let a = classes.split(' ');

		for (let i = 0, len = a.length; i < len; i++) {
			let regex = new RegExp("\\b" + a[i] + "\\b", 'g');
			this.displayClasses = this.displayClasses.replace(regex, '');
		};

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
		this.displayClasses += " hidden ";
		this.updateStyle();
	}

	updateStyle() {
		// Display Hex
		let targetAlpha = this.reachable || !!this.displayClasses.match(/creature/g);

		targetAlpha = !this.displayClasses.match(/hidden/g) && targetAlpha;
		targetAlpha = !!this.displayClasses.match(/showGrid/g) || targetAlpha;
		targetAlpha = !!this.displayClasses.match(/dashed/g) || targetAlpha;

		if (this.displayClasses.match(/0|1|2|3/)) {
			let p = this.displayClasses.match(/0|1|2|3/);
			this.display.loadTexture("hex_p" + p);
			this.grid.disphexesGroup.bringToTop(this.display);
		} else if (this.displayClasses.match(/adj/)) {
			this.display.loadTexture("hex_path");
		} else if (this.displayClasses.match(/dashed/)) {
			this.display.loadTexture("hex_dashed");
		} else {
			this.display.loadTexture("hex");
		}

		this.display.alpha = targetAlpha;
		// Too slow
		// if(this.display.alpha != targetAlpha) {
		// 	if(this.tween) this.tween.stop();
		// 	this.tween = G.Phaser.add.tween(this.display)
		// 		.to({alpha:targetAlpha-0}, 250, Phaser.Easing.Linear.None)
		// 		.start();
		// }

		// Display Coord
		if (!!this.displayClasses.match(/showGrid/g)) {
			if (!(this.coordText && this.coordText.exists)) {
				this.coordText = this.game.Phaser.add.text(this.originalDisplayPos.x + 45, this.originalDisplayPos.y + 63, this.coord, {
					font: "30pt Play",
					fill: "#000000",
					align: "center"
				});
				this.coordText.anchor.setTo(0.5, 0.5);
				this.grid.overhexesGroup.add(this.coordText);
			}
		} else if (this.coordText && this.coordText.exists) {
			this.coordText.destroy();
		}

		// Overlay Hex
		targetAlpha = !!this.overlayClasses.match(/hover|creature/g);

		if (this.overlayClasses.match(/0|1|2|3/)) {
			let p = this.overlayClasses.match(/0|1|2|3/);

			if (this.overlayClasses.match(/hover/)) {
				this.overlay.loadTexture("hex_hover_p" + p);
			} else {
				this.overlay.loadTexture("hex_p" + p);
			}

			this.grid.overhexesGroup.bringToTop(this.overlay);
		} else {
			this.overlay.loadTexture("cancel");
		}

		this.overlay.alpha = targetAlpha;
	}

	/**
	 * Add a trap to a hex.
	 * type - name of sprite to use; see Phaser.load.image usage
	 * effects - effects to activate when trap triggered
	 * owner - owner of trap
	 * opt - optional arguments merged into the Trap object
	 *
	 * Examples:
	 * - turnLifetime
	 * - fullTurnLifetime
	 * - ownerCreature
	 * - destroyOnActivate
	 * - typeOver
	 * returns Trap
	 */
	createTrap(type, effects, owner, opt) {
		if (!!this.trap) {
			this.destroyTrap();
		}

		this.trap = new Trap(this.x, this.y, type, effects, owner, opt, this.game);
		return this.trap;
	}

	activateTrap(trigger, target) {
		if (!this.trap) {
			return;
		}

		let activated = false;
		this.trap.effects.forEach((effect) => {
			if (trigger.test(effect.trigger) && effect.requireFn()) {
				this.game.log("Trap triggered");
				effect.activate(target);
				activated = true;
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
	 */
	toJSON() {
		return {
			x: this.x,
			y: this.y
		};
	}
}; // End of Hex Class
