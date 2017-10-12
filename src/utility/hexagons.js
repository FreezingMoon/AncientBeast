/*	HexGrid Class
 *
 *	Object containing grid and hexagons DOM element and methods concerning the whole grid
 *	Should only have one instance during the game.
 *
 */

var HexGrid = Class.create({

	/*	Attributes
	 *
	 *	NOTE : attributes and variables starting with $ are jquery element
	 *	and jquery function can be called dirrectly from them.
	 *
	 *	// Jquery attributes
	 *	$display : 		Grid container
	 *	$creatureW : 	Creature Wrapper container
	 *	$inpthexesW : 	Input Hexagons container
	 *	$disphexesW : 	Display Hexagons container
	 *	$overhexesW : 	Overlay Hexagons container
	 *	$allInptHex : 	Shortcut to all input hexagons DOM elements (for input events)
	 *	$allDispHex : 	Shortcut to all display hexagons DOM elements (to change style of hexagons)
	 *
	 *	// Normal attributes
	 *	hexes : 				Array : 	Contain all hexes in row arrays (hexes[y][x])
	 *	lastClickedHex : 	Hex : 		Last hex clicked!
	 *
	 */


	/*	Constructor
	 *
	 * 	Create attributes and populate JS grid with Hex objects
	 *
	 */
	initialize: function(opts) {
		defaultOpt = {
			nbrRow: 9,
			nbrhexesPerRow: 16,
			firstRowFull: false,
		}

		opts = $j.extend(defaultOpt, opts);

		this.hexes = new Array(); // Hex Array
		this.traps = new Array(); // Traps Array
		this.allhexes = new Array(); // All hexes
		this.lastClickedHex = []; // Array of hexagons containing last calculated pathfinding

		this.display = G.Phaser.add.group(undefined, "displayGrp");
		this.display.x = 230;
		this.display.y = 380;

		this.gridGroup = G.Phaser.add.group(this.display, "gridGrp");
		this.gridGroup.scale.set(1, 0.75);

		this.trapGroup = G.Phaser.add.group(this.gridGroup, "trapGrp");
		this.disphexesGroup = G.Phaser.add.group(this.gridGroup, "disphexesGrp");
		this.overhexesGroup = G.Phaser.add.group(this.gridGroup, "overhexesGrp");
		this.dropGroup = G.Phaser.add.group(this.display, "dropGrp");
		this.creatureGroup = G.Phaser.add.group(this.display, "creaturesGrp");
		// Parts of traps displayed over creatures
		this.trapOverGroup = G.Phaser.add.group(this.display, "trapOverGrp");
		this.trapOverGroup.scale.set(1, 0.75);
		this.inpthexesGroup = G.Phaser.add.group(this.gridGroup, "inpthexesGrp");

		// Populate grid
		for (var row = 0; row < opts.nbrRow; row++) {
			this.hexes.push(new Array());
			for (var hex = 0; hex < opts.nbrhexesPerRow; hex++) {
				if (hex == opts.nbrhexesPerRow - 1) {
					if (row % 2 == 0 && !opts.firstRowFull) continue;
					if (row % 2 == 1 && opts.firstRowFull) continue;
				}
				this.hexes[row][hex] = new Hex(hex, row, this);
				this.allhexes.push(this.hexes[row][hex]);
			};
		};

		this.selectedHex = this.hexes[0][0];
	},

	querySelf: function(o) {
		var defaultOpt = {
			fnOnConfirm: function(crea, args) {},
			fnOnSelect: function(crea, args) {
				crea.hexagons.forEach(function(hex) {
					hex.overlayVisualState("creature selected player" + hex.creature.team);
				});
			},
			fnOnCancel: function() {
				G.activeCreature.queryMove();
			},
			args: {},
			confirmText: "Confirm",
			id: G.activeCreature.id
		};

		o = $j.extend(defaultOpt, o);

		//o.fnOnConfirm(G.activeCreature,o.args); // Auto-confirm

		G.activeCreature.hint(o.confirmText, "confirm");

		this.queryHexes({
			fnOnConfirm: function(hex, args) {
				args.opt.fnOnConfirm(G.activeCreature, args.opt.args);
			},
			fnOnSelect: function(hex, args) {
				args.opt.fnOnSelect(G.activeCreature, args.opt.args);
			},
			fnOnCancel: function(hex, args) {
				args.opt.fnOnCancel(G.activeCreature, args.opt.args);
			},
			args: {
				opt: o
			},
			hexes: G.activeCreature.hexagons,
			hideNonTarget: true,
			id: o.id
		});
	},

	/* 	queryDirection(o)
	 *
	 *	Shortcut to queryChoice with specific directions
	 *
	 *	fnOnSelect : 		Function : 	Function applied when clicking on one of the available hexes.
	 *	fnOnConfirm : 		Function : 	Function applied when clicking again on the same hex.
	 *	fnOnCancel : 		Function : 	Function applied when clicking a non reachable hex
	 *	team : 				Team
	 *	requireCreature : 	Boolean : 	Disable a choice if it does not contain a creature matching the team argument
	 *	distance :			Integer :	if defined, maximum distance of query in hexes
	 *	minDistance :		Integer :	if defined, minimum distance of query, 1 = 1 hex gap required
	 * 	args : 				Object : 	Object given to the events function (to easily pass variable for these function)
	 */
	queryDirection: function(o) {
		var defaultOpt = {
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

		G.grid.queryChoice(o);
	},

	/**
	 * Get an object that contains the choices and hexesDashed for a direction
	 * query.
	 * @param {Object} o
	 * @returns {Object}
	 */
	getDirectionChoices: function(o) {
		var defaultOpt = {
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
		G.grid.forEachHex(function() {
			this.direction = -1;
		});

		o.choices = [];
		for (var i = 0; i < o.directions.length; i++) {
			if (!!o.directions[i]) {
				var dir = [];
				var fx = 0;

				if (o.sourceCreature instanceof Creature) {
					if ((!o.sourceCreature.player.flipped && i > 2) || (o.sourceCreature.player.flipped && i < 3)) {
						fx = -1 * (o.sourceCreature.size - 1);
					}
				}

				dir = G.grid.getHexLine(o.x + fx, o.y, i, o.flipped);

				// Limit hexes based on distance
				if (o.distance > 0) {
					dir = dir.slice(0, o.distance + 1);
				}
				if (o.minDistance > 0) {
					// Exclude current hex
					dir = dir.slice(o.minDistance + 1);
				}

				var hexesDashed = [];
				dir.forEach(function(item) {
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
					var validChoice = false;
					// Search each hex for a creature that matches the team argument
					for (var j = 0; j < dir.length; j++) {
						var creaTarget = dir[j].creature;
						if (creaTarget instanceof Creature && creaTarget.id !== o.id) {
							var creaSource = G.creatures[o.id];
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
						var creature = arrayUtils.last(dir).creature;
						dir.pop();
						dir = dir.concat(creature.hexagons);
					}
				}

				dir.forEach(function(item) {
					arrayUtils.removePos(hexesDashed, item);
				});

				o.hexesDashed = o.hexesDashed.concat(hexesDashed);
				o.choices.push(dir);
			}
		}
		return o;
	},

	/*
	 *	queryChoice(o)
	 *
	 *	fnOnSelect : 		Function : 	Function applied when clicking on one of the available hexes.
	 *	fnOnConfirm : 		Function : 	Function applied when clicking again on the same hex.
	 *	fnOnCancel : 		Function : 	Function applied when clicking a non reachable hex
	 *	requireCreature : 	Boolean : 	Disable a choice if it does not contain a creature matching the team argument
	 * 	args : 				Object : 	Object given to the events function (to easily pass variable for these function)
	 */
	queryChoice: function(o) {
		var defaultOpt = {
			fnOnConfirm: function(choice, args) {
				G.activeCreature.queryMove();
			},
			fnOnSelect: function(choice, args) {
				choice.forEach(function(item) {
					if (item.creature instanceof Creature) {
						item.overlayVisualState("creature selected player" + item.creature.team);
					} else {
						item.displayVisualState("adj");
					}

				});
			},
			fnOnCancel: function(hex, args) {
				G.activeCreature.queryMove();
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

		var hexes = [];
		for (var i = 0; i < o.choices.length; i++) {
			var validChoice = true;

			if (o.requireCreature) {
				validChoice = false;
				// Search each hex for a creature that matches the team argument
				for (var j = 0; j < o.choices[i].length; j++) {
					if (o.choices[i][j].creature instanceof Creature && o.choices[i][j].creature != o.id) {
						var creaSource = G.creatures[o.id];
						var creaTarget = o.choices[i][j].creature;
						if (isTeam(creaSource, creaTarget, o.team)) {
							validChoice = true;
						}
					}
				}
			}

			if (validChoice) hexes = hexes.concat(o.choices[i]);
			else if (o.isDirectionsQuery) {
				G.grid.forEachHex(function() {
					if (o.choices[i][0].direction == this.direction)
						arrayUtils.removePos(o.hexesDashed, this);
				});
			}
		}

		this.queryHexes({
			fnOnConfirm: function(hex, args) {
				// Determine which set of hexes (choice) the hex is part of
				for (var i = 0; i < args.opt.choices.length; i++) {
					for (var j = 0; j < args.opt.choices[i].length; j++) {
						if (hex.pos == args.opt.choices[i][j].pos) {
							args.opt.args.direction = hex.direction;
							args.opt.fnOnConfirm(args.opt.choices[i], args.opt.args);
							return;
						}
					}
				}
			},
			fnOnSelect: function(hex, args) {
				// Determine which set of hexes (choice) the hex is part of
				for (var i = 0; i < args.opt.choices.length; i++) {
					for (var j = 0; j < args.opt.choices[i].length; j++) {
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
	},

	/* 	queryCreature(o)
	 *
	 *	fnOnSelect : 	Function : 	Function applied when clicking on one of the available hexes.
	 *	fnOnConfirm : 	Function : 	Function applied when clicking again on the same hex.
	 *	fnOnCancel : 	Function : 	Function applied when clicking a non reachable hex
	 *	team : 			Team
	 *	id : 			Integer : 	Creature ID
	 * 	args : 			Object : 	Object given to the events function (to easily pass variable for these function)
	 */
	queryCreature: function(o) {

		var defaultOpt = {
			fnOnConfirm: function(crea, args) {
				G.activeCreature.queryMove();
			},
			fnOnSelect: function(crea, args) {
				crea.tracePosition({
					overlayClass: "creature selected player" + crea.team
				});
			},
			fnOnCancel: function(hex, args) {
				G.activeCreature.queryMove();
			},
			optTest: function(crea) {
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
		o.hexes = o.hexes.filter(function(hex) {
			if (hex.creature instanceof Creature && hex.creature.id != o.id) {
				if (!o.optTest(hex.creature)) {
					return false;
				}

				var creaSource = G.creatures[o.id];
				var creaTarget = hex.creature;

				if (isTeam(creaSource, creaTarget, o.team)) {
					return true;
				}
			}

			return false;
		});

		var extended = [];
		o.hexes.forEach(function(hex) {
			extended = extended.concat(hex.creature.hexagons);
		});

		o.hexes = extended;

		this.queryHexes({
			fnOnConfirm: function(hex, args) {
				var crea = hex.creature;
				args.opt.fnOnConfirm(crea, args.opt.args);
			},
			fnOnSelect: function(hex, args) {
				var crea = hex.creature;
				args.opt.fnOnSelect(crea, args.opt.args);
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

	},

	redoLastQuery: function() {
		this.queryHexes(this.lastQueryOpt);
	},

	/*	queryHexes(x, y, distance, size)
	 *
	 *	fnOnSelect : 	Function : 	Function applied when clicking on one of the available hexes.
	 *	fnOnConfirm : 	Function : 	Function applied when clicking again on the same hex.
	 *	fnOnCancel : 	Function : 	Function applied when clicking a non reachable hex
	 * 	args : 			Object : 	Object given to the events function (to easily pass variable for these function)
	 *	hexes : 		Array : 	Reachable hexes
	 */
	queryHexes: function(o) {

		var defaultOpt = {
			fnOnConfirm: function(hex, args) {
				G.activeCreature.queryMove();
			},
			fnOnSelect: function(hex, args) {
				G.activeCreature.faceHex(hex, undefined, true);
				hex.overlayVisualState("creature selected player" + G.activeCreature.team);
			},
			fnOnCancel: function(hex, args) {
				G.activeCreature.queryMove();
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

		G.grid.lastClickedHex = [];

		// Save the last Query
		this.lastQueryOpt = $j.extend({}, o); // Copy Obj

		// Block all hexes
		this.forEachHex(function() {
			this.unsetReachable();
			if (o.hideNonTarget) this.setNotTarget();
			else this.unsetNotTarget();
			if (o.hexesDashed.indexOf(this) !== -1) {
				this.displayVisualState("dashed");
			} else {
				this.cleanDisplayVisualState("dashed");
			}
		});

		// Cleanup
		if (G.grid.materialize_overlay) G.grid.materialize_overlay.alpha = 0;

		// Creature hex shade
		//this.$allOverHex.removeClass("ownCreatureHexShade");

		if (!o.ownCreatureHexShade) {
			if (o.id instanceof Array) {
				o.id.forEach(function(id) {
					G.creatures[id].hexagons.forEach(function(hex) {
						hex.overlayVisualState('ownCreatureHexShade')
					});
				});
			} else {
				if (o.id != 0) {
					G.creatures[o.id].hexagons.forEach(function(hex) {
						hex.overlayVisualState('ownCreatureHexShade')
					})
				}
			}
		}

		// Set reachable the given hexes
		o.hexes.forEach(function(hex) {
			hex.setReachable();
			if (o.hideNonTarget) {
				hex.unsetNotTarget();
			}
		});

		// ONCLICK
		var onConfirmFn = function() {
			var hex = this;
			var y = hex.y;
			var x = hex.x;

			// Clear display and overlay
			G.grid.updateDisplay();

			// Not reachable hex
			if (!hex.reachable) {
				G.grid.lastClickedHex = [];
				if (hex.creature instanceof Creature) { // If creature
					var crea = hex.creature;
					// G.UI.showCreature(crea.type,crea.team);
				} else { // If nothing
					o.fnOnCancel(hex, o.args); // ON CANCEL
				}
			}

			// Reachable hex
			else {

				// Offset Pos
				var offset = (o.flipped) ? o.size - 1 : 0;
				var mult = (o.flipped) ? 1 : -1; // For FLIPPED player
				var availablePos = false;

				for (var i = 0; i < o.size; i++) { // Try next hexagons to see if they fits
					if ((x + offset - i * mult >= G.grid.hexes[y].length) || (x + offset - i * mult < 0)) continue;
					if (G.grid.hexes[y][x + offset - i * mult].isWalkable(o.size, o.id)) {
						x += offset - i * mult;
						availablePos = true;
						break;
					}
				};

				// if(!availablePos) {
				// 	//Prevent Bugs
				// 	console.log("nowhere to go");
				// 	return;
				// }

				hex = G.grid.hexes[y][x]; // New coords
				var clickedtHex = hex;

				G.activeCreature.faceHex(clickedtHex, undefined, true, true);

				if (clickedtHex != G.grid.lastClickedHex) {
					G.grid.lastClickedHex = clickedtHex;
					// ONCLICK
					o.fnOnConfirm(clickedtHex, o.args);
				} else {
					// ONCONFIRM
					o.fnOnConfirm(clickedtHex, o.args);
				}

			}
		};

		
		var onHoverOffFn = function() {
			var hex = this;
			if (hex.creature instanceof Creature) { // toggle hover off event
				var crea = hex.creature;
				if(crea.type == "--" && crea === G.activeCreature){ // the plasma would have been displayed so now display the health again
					crea.updateHealth();
				}
			}
		}
		
		// ONMOUSEOVER
		var onSelectFn = function() {
			var hex = this;
			var y = hex.y;
			var x = hex.x;

			// Xray
			G.grid.xray(hex);

			// Clear display and overlay
			G.grid.updateDisplay();
			G.UI.xrayQueue(-1);
			
			// Not reachable hex
			if (!hex.reachable) {
				if (G.grid.materialize_overlay) G.grid.materialize_overlay.alpha = 0;
				if (hex.creature instanceof Creature) { // If creature
					var crea = hex.creature;
					if(crea.type == "--" && crea === G.activeCreature){
						crea.displayPlasma();
					}
					crea.hexagons.forEach(function(hex) {
						hex.overlayVisualState("hover h_player" + crea.team);
					});
					G.UI.xrayQueue(crea.id);
				} else { // If nothing
					hex.overlayVisualState("hover");
				}
			} else { // Reachable hex


				//Offset Pos
				var offset = (o.flipped) ? o.size - 1 : 0;
				var mult = (o.flipped) ? 1 : -1; // For FLIPPED player
				var availablePos = false;

				for (var i = 0; i < o.size; i++) { // Try next hexagons to see if they fit
					if ((x + offset - i * mult >= G.grid.hexes[y].length) || (x + offset - i * mult < 0)) continue;
					if (G.grid.hexes[y][x + offset - i * mult].isWalkable(o.size, o.id)) {
						x += offset - i * mult;
						availablePos = true;
						break;
					}
				};

				// if(!availablePos) {
				// 	//Prevent Bugs
				// 	console.log("nowhere to go");
				// 	return;
				// }

				hex = G.grid.hexes[y][x]; // New coords
				o.fnOnSelect(hex, o.args);
			}
		};

		// ONRIGHTCLICK
		var onRightClickFn = function() {
			var hex = this;
			var y = hex.y;
			var x = hex.x;

			if (hex.creature instanceof Creature) { // If creature
				G.UI.showCreature(hex.creature.type, hex.creature.player.id);
			} else {
				G.UI.showCreature(G.activeCreature.type, G.activeCreature.player.id);
			}
		};


		this.forEachHex(function() {
			this.onSelectFn = onSelectFn;
			this.onHoverOffFn = onHoverOffFn;
			this.onConfirmFn = onConfirmFn;
			this.onRightClickFn = onRightClickFn;
		});

	},

	/*	xray(hex)
	 *
	 *	hex : 	Hex : 	Hexagon to emphase
	 *
	 *	If hex contain creature call ghostOverlap for each creature hexes
	 *
	 */
	xray: function(hex) {
		// Clear previous ghost
		G.creatures.forEach(function(creature) {
			if (creature instanceof Creature) {
				creature.xray(false);
			}
		});

		if (hex.creature instanceof Creature) {
			hex.creature.hexagons.forEach(function(item) {
				item.ghostOverlap();
			});
		} else {
			hex.ghostOverlap();
		}
	},

	/*	hideCreatureHexes()
	 *
	 *	Ghosts hexes with creatures
	 *
	 */
	hideCreatureHexes: function(except) {
		G.creatures.forEach(function(creature) {
			if (creature instanceof Creature) {
				var hide = true;
				if (except instanceof Creature) {
					if (except.id == creature.id) {
						hide = false;
					}
				}
				if (hide) {
					// this.$display.addClass("ghosted_hidden");
					// this.$health.addClass("ghosted_hidden");
					for (var i = 0; i < creature.size; i++) {
						if (creature.hexagons[i]) {
							// this.hexagons[i].$display.hide();
							// this.hexagons[i].$overlay.hide();
						}
					}
				}
			}
		});
	},

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
	getHexLine: function(x, y, dir, flipped) {
		switch (dir) {
			case 0: // Upright
				return G.grid.getHexMap(x, y - 8, 0, flipped, matrices.diagonalup).reverse();
			case 1: // StraitForward
				return G.grid.getHexMap(x, y, 0, flipped, matrices.straitrow);
			case 2: // Downright
				return G.grid.getHexMap(x, y, 0, flipped, matrices.diagonaldown);
			case 3: // Downleft
				return G.grid.getHexMap(x, y, -4, flipped, matrices.diagonalup);
			case 4: // StraitBackward
				return G.grid.getHexMap(x, y, 0, !flipped, matrices.straitrow);
			case 5: // Upleft
				return G.grid.getHexMap(x, y - 8, -4, flipped, matrices.diagonaldown).reverse();
			default:
				return [];
		}
	},

	/*	showCreaturehexes()
	 *
	 *	Unghosts hexes with creatures
	 *
	 */
	showCreaturehexes: function() {
		G.creatures.forEach(function(creature) {
			if (creature instanceof Creature) {
				// this.display.overlayVisualState("ghosted_hidden");
				// this.health.overlayVisualState("ghosted_hidden");
				for (var i = 0; i < creature.size; i++) {
					//if(this.hexagons[i]) {
					//	this.hexagons[i].display.alpha = 1;
					//	this.hexagons[i].overlay.alpha = 1;
					//}
				}
			}
		});
	},

	/*	clearHexViewAlterations()
	 *
	 *	Removes all hex view alterations like hideCreatureHexes used
	 *	Squashes bugs by making sure all view alterations are removed
	 *	on a change of ability/change of turn/etc
	 *	If you make a new hex view alteration call the function to remove
	 *	the alteration in here to ensure it gets cleared at the right time
	 *
	 */
	clearHexViewAlterations: function() {
		this.showCreaturehexes();
	},

	/*	updateDisplay()
	 *
	 *	Update overlay hexes with creature positions
	 *
	 */
	updateDisplay: function() {
		this.cleanDisplay();
		this.cleanOverlay();
		this.hexes.forEach(function(hex) {
			hex.forEach(function(item) {
				if (item.creature instanceof Creature) {
					if (item.creature.id == G.activeCreature.id) {
						item.overlayVisualState("active creature player" + item.creature.team);
						item.displayVisualState("creature player" + item.creature.team);
					} else {
						item.displayVisualState("creature player" + item.creature.team);
					}
				}
			});
		});
	},

	/*	hexExists(y, x)
	 *
	 *	x : 	Integer : 	Coordinates to test
	 *	y : 	Integer : 	Coordinates to test
	 *
	 *	Test if hex exists
	 *
	 */
	hexExists: function(y, x) {
		if ((y >= 0) && (y < this.hexes.length)) {
			if ((x >= 0) && (x < this.hexes[y].length)) return true;
		}
		return false;
	},

	/*	isHexIn(hex, hexArray)
	 *
	 *	hex : 		Hex : 		Hex to look for
	 *	hexarray : 	Array : 	Array of hexes to look for hex in
	 *
	 *	Test if hex exists inside array of hexes
	 *
	 */
	isHexIn: function(hex, hexArray) {
		for (var i = 0; i < hexArray.length; i++) {
			if (hexArray[i].x == hex.x && hexArray[i].y == hex.y) {
				return true;
			}
		}
		return false;
	},

	/* 	getMovementRange(x, y, distance, size, id)
	 *
	 *	x : 		Integer : 	Start position
	 *	y : 		Integer : 	Start position
	 *	distance : 	Integer : 	Distance from the start position
	 *	size : 		Integer : 	Creature size
	 *	id : 		Integer : 	Creature ID
	 *
	 *	return : 	Array : 	Set of the reachable hexes
	 */
	getMovementRange: function(x, y, distance, size, id) {
		//	Populate distance (hex.g) in hexes by asking an impossible
		//	destination to test all hexagons
		this.cleanReachable(); // If not pathfinding will bug
		this.cleanPathAttr(true); // Erase all pathfinding data
		astar.search(G.grid.hexes[y][x], new Hex(-2, -2, null), size, id);

		// Gather all the reachable hexes
		var hexes = [];
		this.forEachHex(function() {
			// If not Too far or Impossible to reach
			if (this.g <= distance && this.g != 0)
				hexes.push(G.grid.hexes[this.y][this.x]);
		});

		return arrayUtils.extendToLeft(hexes, size);
	},

	/* 	getFlyingRange(x,y,distance,size,id)
	 *
	 *	x : 		Integer : 	Start position
	 *	y : 		Integer : 	Start position
	 *	distance : 	Integer : 	Distance from the start position
	 *	size : 		Integer : 	Creature size
	 *	id : 		Integer : 	Creature ID
	 *
	 *	return : 	Array : 	Set of the reachable hexes
	 */
	getFlyingRange: function(x, y, distance, size, id) {

		// Gather all the reachable hexes
		var hexes = G.grid.hexes[y][x].adjacentHex(distance);

		hexes = hexes.filter(function(hex) {
			return hex.isWalkable(size, id, true);
		});

		return arrayUtils.extendToLeft(hexes, size);
	},

	/*	getHexMap(originx, originy, array)
	 *
	 *	array : 	Array : 	2-dimentions Array containing 0 or 1 (boolean)
	 *	originx : 	Integer : 	Position of the array on the grid
	 *	originy : 	Integer : 	Position of the array on the grid
	 * 	offsetx : 	Integer : 	offset flipped for flipped players
	 *	flipped : 	Boolean : 	If player is flipped or not
	 *
	 *	return : 	Array : 	Set of corresponding hexes
	 */
	getHexMap: function(originx, originy, offsetx, flipped, array) { // Heavy logic in here

		var array = array.slice(0); // Copy to not modify original
		originx += (flipped) ? 1 - array[0].length - offsetx : -1 + offsetx;
		var hexes = [];

		for (var y = 0; y < array.length; y++) {

			array[y] = array[y].slice(0); // Copy row

			// Translating to flipped patern
			if (flipped && y % 2 != 0) { // Odd rows
				array[y].push(0);
			}

			// Translating even to odd row patern
			array[y].unshift(0);
			if (originy % 2 != 0 && y % 2 != 0) { // Even rows
				if (flipped)
					array[y].pop(); // Remove last element as the array will be parse backward
				else
					array[y].splice(0, 1); // Remove first element
			}

			// Gathering hexes
			for (var x = 0; x < array[y].length; x++) {
				if (!!array[y][x]) {
					xfinal = (flipped) ? array[y].length - 1 - x : x; // Parse the array backward for flipped player
					if (this.hexExists(originy + y, originx + xfinal)) {
						hexes.push(this.hexes[originy + y][originx + xfinal]);
					}
				}
			}
		}

		return hexes;
	},

	showGrid: function(val) {
		this.forEachHex(function() {
			if (this.creature) this.creature.xray(val);
			if (this.drop) return;
			if (val) this.displayVisualState("showGrid");
			else this.cleanDisplayVisualState("showGrid");
		});
	},

	showMovementRange: function(id) {
		var crea = G.creatures[id];
		var hexes;
		if (crea.movementType() === "flying") {
			hexes = this.getFlyingRange(
				crea.x, crea.y, crea.stats.movement, crea.size, crea.id
			);
		} else {
			hexes = this.getMovementRange(
				crea.x, crea.y, crea.stats.movement, crea.size, crea.id
			);
		}

		// Block all hexes
		this.forEachHex(function() {
			this.unsetReachable();
		});

		// Set reachable the given hexes
		hexes.forEach(function(hex) {
			hex.setReachable();
		});

	},

	selectHexUp: function() {
		if (this.hexExists(this.selectedHex.y - 1, this.selectedHex.x)) {
			var hex = this.hexes[this.selectedHex.y - 1][this.selectedHex.x];
			this.selectedHex = hex;
			hex.onSelectFn();
		}
	},

	selectHexDown: function() {
		if (this.hexExists(this.selectedHex.y + 1, this.selectedHex.x)) {
			var hex = this.hexes[this.selectedHex.y + 1][this.selectedHex.x];
			this.selectedHex = hex;
			hex.onSelectFn();
		}
	},

	selectHexLeft: function() {
		if (this.hexExists(this.selectedHex.y, this.selectedHex.x - 1)) {
			var hex = this.hexes[this.selectedHex.y][this.selectedHex.x - 1];
			this.selectedHex = hex;
			hex.onSelectFn();
		}
	},

	selectHexRight: function() {
		if (this.hexExists(this.selectedHex.y, this.selectedHex.x + 1)) {
			var hex = this.hexes[this.selectedHex.y][this.selectedHex.x + 1];
			this.selectedHex = hex;
			hex.onSelectFn();
		}
	},

	confirmHex: function() {
		if (G.freezedInput) return;
		this.selectedHex.onConfirmFn();
	},

	orderCreatureZ: function() {

		var index = 0;

		for (var y = 0; y < this.hexes.length; y++) {
			for (var i = 1; i < G.creatures.length; i++) {

				if (G.creatures[i].y == y) {
					this.creatureGroup.remove(G.creatures[i].grp);
					this.creatureGroup.addAt(G.creatures[i].grp, index++);
				}
			};

			if (this.materialize_overlay && this.materialize_overlay.posy == y) {
				this.creatureGroup.remove(this.materialize_overlay);
				this.creatureGroup.addAt(this.materialize_overlay, index++);
			}
		};

		// G.grid.creatureGroup.sort();
	},

	//******************//
	//Shortcut functions//
	//******************//

	/*	forEachHex(f)
	 *
	 *	f : Function : 	Function to execute
	 *
	 *	Execute f for each hexes
	 */
	forEachHex: function(f) {
		this.hexes.forEach(function(hex) {
			hex.forEach(function(item) {
				f.apply(item);
			});
		});
	},

	/*	cleanPathAttr(includeG)
	 *
	 *	includeG : 	Boolean : 	Include hex.g attribute
	 *
	 *	Execute hex.cleanPathAttr() function for all the grid. Refer to the Hex class for more info
	 */
	cleanPathAttr: function(includeG) {
		this.hexes.forEach(function(hex) {
			hex.forEach(function(item) {
				item.cleanPathAttr(includeG);
			});
		});
	},

	/*	cleanReachable()
	 *
	 *	Execute hex.setReachable() function for all the grid. Refer to the Hex class for more info
	 */
	cleanReachable: function() {
		this.hexes.forEach(function(hex) {
			hex.forEach(function(item) {
				item.setReachable();
			});
		});
	},

	/*	cleanDisplay(cssClass)
	 *
	 *	cssClass : 	String : 	Class(es) name(s) to remove with jQuery removeClass function
	 *
	 *	Shorcut for $allDispHex.removeClass()
	 */
	cleanDisplay: function(cssClass) {
		this.forEachHex(function() {
			this.cleanDisplayVisualState(cssClass)
		});
	},
	cleanOverlay: function(cssClass) {
		this.forEachHex(function() {
			this.cleanOverlayVisualState(cssClass)
		});
	},

	/*	previewCreature(creatureData)
	 *
	 *	pos : 			Object : 	Coordinates {x,y}
	 *	creatureData : 	Object : 	Object containing info from the database (G.retreiveCreatureStats)
	 *
	 *	Draw a preview of the creature at the given coordinates
	 */
	previewCreature: function(pos, creatureData, player) {

		this.updateDisplay(); // Retrace players creatures

		var creaHex = this.hexes[pos.y][pos.x - (creatureData.size - 1)];

		if (!G.grid.materialize_overlay) { // If sprite does not exists
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
		this.materialize_overlay.x = creaHex.displayPos.x + ((!player.flipped) ? creatureData.display["offset-x"] : 90 * creatureData.size - this.materialize_overlay.texture.width - creatureData.display["offset-x"]) + this.materialize_overlay.texture.width / 2;
		this.materialize_overlay.y = creaHex.displayPos.y + creatureData.display["offset-y"] + this.materialize_overlay.texture.height;
		this.materialize_overlay.alpha = 0.5;

		if (player.flipped) {
			this.materialize_overlay.scale.setTo(-1, 1);
		} else {
			this.materialize_overlay.scale.setTo(1, 1);
		}

		for (var i = 0; i < creatureData.size; i++) {
			this.hexes[pos.y][pos.x - i].overlayVisualState("creature selected player" + G.activeCreature.team);
		}
	},

	debugHex: function(hexes) {
		$j(".debug").remove();
		var i = 0;
		hexes.forEach(function(hex) {
			var a = G.grid.$creatureW.append('<div class=".debug" id="debug' + i + '"></div>').children("#debug" + i);
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

}); // End of HexGrid Class

/*	Hex Class
 *
 *	Object containing hex informations, positions and DOM elements
 *
 */
var Hex = Class.create({

	/*	Attributes
	 *
	 *	NOTE : attributes and variables starting with $ are jquery element
	 *	and jquery function can be called dirrectly from them.
	 *
	 *	//Jquery attributes
	 *	$display : 		Hex display element
	 *	$overlay : 		Hex overlay element
	 *	$input : 		Hex input element (bind controls on it)
	 *
	 *	//Normal attributes
	 *	x : 			Integer : 	Hex coordinates
	 *	y : 			Integer : 	Hex coordinates
	 *	pos : 			Object : 	Pos object for hex comparison {x,y}
	 *
	 *	f : 			Integer : 	Pathfinding score f = g + h
	 *	g : 			Integer : 	Pathfinding distance from start
	 *	h : 			Integer : 	Pathfinding distance to finish
	 *	pathparent : 	Hex : 		Pathfinding parent hex (the one you came from)
	 *
	 *	blocked : 		Boolean : 	Set to true if an obstacle it on it. Restrict movement.
	 *	creature : 		Creature : 	Creature object , undefined if empty
	 *	reachable : 	Boolean : 	Set to true if accessible by current action
	 *
	 *	displayPos : 	Object : 	Pos object to position creature with absolute coordinates {left,top}
	 *
	 */

	/*	Constructor(x,y)
	 *
	 *	x : 			Integer : 	Hex coordinates
	 *	y : 			Integer : 	Hex coordinates
	 *
	 */
	initialize: function(x, y, grid) {

		this.x = x;
		this.y = y;
		this.pos = {
			x: x,
			y: y
		};
		this.coord = String.fromCharCode(64 + this.y + 1) + (this.x + 1);

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
			this.input.events.onInputOver.add(function() {
				if (G.freezedInput || G.UI.dashopen) return;
				G.grid.selectedHex = this;
				this.onSelectFn();
			}, this);

			this.input.events.onInputOut.add(function() {
				if (G.freezedInput || G.UI.dashopen) return;
				G.grid.redoLastQuery();
				G.grid.xray(new Hex(-1, -1)); // Clear Xray
				G.UI.xrayQueue(-1); // Clear Xray Queue
				this.onHoverOffFn();
			}, this);

			this.input.events.onInputUp.add(function(Sprite, Pointer) {
				if (G.freezedInput || G.UI.dashopen) return;
				switch (Pointer.button) {
					case 0:
						// Left mouse button pressed
						this.onConfirmFn();
						break;
					case 1:
						// Middle mouse button pressed
						break;
					case 2:
						// Right mouse button pressed
						this.onRightClickFn();
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
	},

	/*	adjacentHex(distance)
	 *
	 *	distance : 	integer : 	Distance form the current hex
	 *
	 *	return : 	Array : 	Array containing hexes
	 *
	 *	This function return an array containing all hexes of the grid
	 * 	at the distance given of the current hex.
	 *
	 */
	adjacentHex: function(distance) {
		var adjHex = [];
		for (var i = -distance; i <= distance; i++) {
			var deltaY = i;
			var startX, endX;
			if (this.y % 2 == 0) {
				// Evenrow
				startX = Math.ceil(Math.abs(i) / 2) - distance;
				endX = distance - Math.floor(Math.abs(i) / 2);
			} else {
				// Oddrow
				startX = Math.floor(Math.abs(i) / 2) - distance;
				endX = distance - Math.ceil(Math.abs(i) / 2);
			}
			for (var deltaX = startX; deltaX <= endX; deltaX++) {
				var x = this.x + deltaX;
				var y = this.y + deltaY;
				// Exclude current hex
				if (deltaY == 0 && deltaX == 0) {
					continue;
				}
				if (y < G.grid.hexes.length && y >= 0 && x < G.grid.hexes[y].length && x >= 0) { // Exclude inexisting hexes
					adjHex.push(G.grid.hexes[y][x]);
				}
			}
		}
		return adjHex;
	},

	/*	ghostOverlap()
	 *
	 *	add ghosted class to creature on hexes behind this hex
	 *
	 */
	ghostOverlap: function() {
		for (var i = 1; i <= 3; i++) {
			if (this.y % 2 == 0) {
				if (i == 1) {
					for (var j = 0; j <= 1; j++) {
						if (G.grid.hexExists(this.y + i, this.x + j)) {
							if (G.grid.hexes[this.y + i][this.x + j].creature instanceof Creature) {
								var ghostedCreature = G.grid.hexes[this.y + i][this.x + j].creature;
							}
						}
					}
				} else {
					if (G.grid.hexExists(this.y + i, this.x)) {
						if (G.grid.hexes[this.y + i][this.x].creature instanceof Creature) {
							var ghostedCreature = G.grid.hexes[this.y + i][this.x].creature;
						}
					}
				}
			} else {
				if (i == 1) {
					for (var j = 0; j <= 1; j++) {
						if (G.grid.hexExists(this.y + i, this.x - j)) {
							if (G.grid.hexes[this.y + i][this.x - j].creature instanceof Creature) {
								var ghostedCreature = G.grid.hexes[this.y + i][this.x - j].creature;
							}
						}
					}
				} else {
					if (G.grid.hexExists(this.y + i, this.x)) {
						if (G.grid.hexes[this.y + i][this.x].creature instanceof Creature) {
							var ghostedCreature = G.grid.hexes[this.y + i][this.x].creature;
						}
					}
				}
			}
			if (ghostedCreature instanceof Creature) {
				ghostedCreature.xray(true);
			}
		};
	},

	/*	cleanPathAttr(includeG)
	 *
	 *	includeG : 	Boolean : 	Set includeG to True if you change the start of the calculated path.
	 *
	 *	This function reset all the pathfinding attribute to
	 *	0 to calculate new path to another hex.
	 *
	 */
	cleanPathAttr: function(includeG) {
		this.f = 0;
		this.g = (includeG) ? 0 : this.g;
		this.h = 0;
		this.pathparent = null;
	},

	/*	isWalkable(size, id)
	 *
	 *	size : 				Integer : 	Size of the creature
	 *	id : 				Integer : 	ID of the creature
	 * 	ignoreReachable : 	Boolean : 	Take into account the reachable property
	 *
	 *	return : 	Boolean : 	True if this hex is walkable
	 *
	 */
	isWalkable: function(size, id, ignoreReachable) {
		var blocked = false;

		for (var i = 0; i < size; i++) {
			// For each Hex of the creature
			if ((this.x - i) >= 0 && (this.x - i) < G.grid.hexes[this.y].length) { //if hex exists
				var hex = G.grid.hexes[this.y][this.x - i];
				// Verify if blocked. If it's blocked by one attribute, OR statement will keep it status
				blocked = blocked || hex.blocked;
				if (!ignoreReachable) {
					blocked = blocked || !hex.reachable;
				}
				if (hex.creature instanceof Creature) {

					if (id instanceof Array) {
						var isNotMovingCreature = (id.indexOf(hex.creature.id) == -1);
					} else {
						var isNotMovingCreature = (hex.creature.id != id);
					}

					blocked = blocked || isNotMovingCreature; // Not blocked if this block contains the moving creature
				}

			} else {
				// Blocked by grid boundaries
				blocked = true;
			}
		};
		return !blocked; // Its walkable if it's NOT blocked
	},

	/*	overlayVisualState
	 *
	 *	Change the appearance of the overlay hex
	 *
	 */
	overlayVisualState: function(classes) {
		classes = (classes) ? classes : "";
		this.overlayClasses += " " + classes + " ";
		this.updateStyle();
	},

	/*	displayVisualState
	 *
	 *	Change the appearance of the display hex
	 *
	 */
	displayVisualState: function(classes) {
		classes = (classes) ? classes : "";
		this.displayClasses += " " + classes + " ";
		this.updateStyle();
	},

	/*	cleanOverlayVisualState
	 *
	 *	Clear the appearance of the overlay hex
	 *
	 */
	cleanOverlayVisualState: function(classes) {
		var classes = classes || "creature weakDmg active moveto selected hover h_player0 h_player1 h_player2 h_player3 player0 player1 player2 player3";

		var a = classes.split(' ');
		for (var i = 0; i < a.length; i++) {
			var regex = new RegExp("\\b" + a[i] + "\\b", 'g');
			this.overlayClasses = this.overlayClasses.replace(regex, '');
		};

		this.updateStyle();
	},

	/*	cleanDisplayVisualState
	 *
	 *	Clear the appearance of the display hex
	 *
	 */
	cleanDisplayVisualState: function(classes) {
		classes = classes || "adj hover creature player0 player1 player2 player3";

		var a = classes.split(' ');
		for (var i = 0; i < a.length; i++) {
			var regex = new RegExp("\\b" + a[i] + "\\b", 'g');
			this.displayClasses = this.displayClasses.replace(regex, '');
		};

		this.updateStyle();
	},

	/*	setReachable()
	 *
	 *	Set Hex.reachable to True for this hex and change $display class
	 *
	 */
	setReachable: function() {
		this.reachable = true;
		this.input.input.useHandCursor = true;
		this.updateStyle();
	},

	/*	unsetReachable()
	 *
	 *	Set Hex.reachable to False for this hex and change $display class
	 *
	 */
	unsetReachable: function() {
		this.reachable = false;
		this.input.input.useHandCursor = false;
		this.updateStyle();
	},

	unsetNotTarget: function() {
		this.displayClasses = this.displayClasses.replace(/\bhidden\b/g, '');
		this.updateStyle();
	},

	setNotTarget: function() {
		this.displayClasses += " hidden ";
		this.updateStyle();
	},

	updateStyle: function() {
		// Display Hex
		var targetAlpha = 0;

		targetAlpha = this.reachable || !!this.displayClasses.match(/creature/g);
		targetAlpha = !this.displayClasses.match(/hidden/g) && targetAlpha;
		targetAlpha = !!this.displayClasses.match(/showGrid/g) || targetAlpha;
		targetAlpha = !!this.displayClasses.match(/dashed/g) || targetAlpha;

		if (this.displayClasses.match(/0|1|2|3/)) {
			var p = this.displayClasses.match(/0|1|2|3/);
			this.display.loadTexture("hex_p" + p);
			G.grid.disphexesGroup.bringToTop(this.display);
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
				this.coordText = G.Phaser.add.text(this.originalDisplayPos.x + 45, this.originalDisplayPos.y + 63, this.coord, {
					font: "30pt Play",
					fill: "#000000",
					align: "center"
				});
				this.coordText.anchor.setTo(0.5, 0.5);
				G.grid.overhexesGroup.add(this.coordText);
			}
		} else if (this.coordText && this.coordText.exists) {
			this.coordText.destroy();
		}

		// Overlay Hex
		var targetAlpha = 0;

		targetAlpha = !!this.overlayClasses.match(/hover|creature/g);

		if (this.overlayClasses.match(/0|1|2|3/)) {
			var p = this.overlayClasses.match(/0|1|2|3/);

			if (this.overlayClasses.match(/hover/)) {
				this.overlay.loadTexture("hex_hover_p" + p);
			} else {
				this.overlay.loadTexture("hex_p" + p);
			}
			G.grid.overhexesGroup.bringToTop(this.overlay);
		} else {
			this.overlay.loadTexture("cancel");
		}

		this.overlay.alpha = targetAlpha;
	},

	/**
	 * Add a trap to a hex.
	 * @param {string} type - name of sprite to use; see Phaser.load.image usage
	 * @param {Effect[]} effects - effects to activate when trap triggered
	 * @param {Player} owner - owner of trap
	 * @param {Object} opt - optional arguments merged into the Trap object
	 * Examples:
	 * - turnLifetime
	 * - fullTurnLifetime
	 * - ownerCreature
	 * - destroyOnActivate
	 * - typeOver
	 * @returns {Trap}
	 */
	createTrap: function(type, effects, owner, opt) {
		if (!!this.trap) this.destroyTrap();
		this.trap = new Trap(this.x, this.y, type, effects, owner, opt);
		return this.trap;
	},

	activateTrap: function(trigger, target) {
		if (!this.trap) {
			return;
		}

		var activated = false;
		this.trap.effects.forEach(function(effect) {
			if (trigger.test(effect.trigger) && effect.requireFn()) {
				G.log("Trap triggered");
				effect.activate(target);
				activated = true;
			}
		});

		if (this.trap && this.trap.destroyOnActivate) {
			this.destroyTrap();
		}
	},

	destroyTrap: function() {
		if (!this.trap) return;
		delete G.grid.traps[this.trap.id];
		this.trap.destroy();
		delete this.trap;
	},

	//---------DROP FUNCTION---------//
	pickupDrop: function(crea) {
		if (!this.drop) return;
		this.drop.pickup(crea);
	},

	/**
	 * Override toJSON to avoid circular references when outputting to game log
	 * Used by game log only
	 */
	toJSON: function() {
		return {
			x: this.x,
			y: this.y
		};
	}
}); // End of Hex Class
