import $j from 'jquery';
import { Creature } from "../creature";
import { Game } from "../../game";
import { Team, isTeam } from "../../utility/team";
import { HexGrid } from "../hexgrid";
import * as arrayUtils from '../../utility/arrayUtils';
import { Hex } from "../hex";
import { PhaserHex } from "./phaser_hex";
import { PhaserCreature } from './phaser_creature';
import { PhaserGame } from './phaser_game';

export class PhaserHexGrid extends HexGrid {

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
	materialize_overlay: any;

	constructor(opts: any, game_: Game) {
		super(opts, game_);

		let game = game_ as PhaserGame;

		this.display = game.Phaser.add.group(undefined, 'displayGroup');
		this.display.x = 230;
		this.display.y = 380;

		this.gridGroup = game.Phaser.add.group(this.display, 'gridGroup');
		this.gridGroup.scale.set(1, 0.75);

		this.trapGroup = game.Phaser.add.group(this.gridGroup, 'trapGrp');
		this.hexesGroup = game.Phaser.add.group(this.gridGroup, 'hexesGroup');
		this.displayHexesGroup = game.Phaser.add.group(this.gridGroup, 'displayHexesGroup');
		this.overlayHexesGroup = game.Phaser.add.group(this.gridGroup, 'overlayHexesGroup');
		this.inputHexesGroup = game.Phaser.add.group(this.gridGroup, 'inputHexesGroup');
		this.dropGroup = game.Phaser.add.group(this.display, 'dropGrp');
		this.creatureGroup = game.Phaser.add.group(this.display, 'creaturesGrp');
		// Parts of traps displayed over creatures
		this.trapOverGroup = game.Phaser.add.group(this.display, 'trapOverGrp');
		this.trapOverGroup.scale.set(1, 0.75);

		// Populate the hexes
		this.populate();

		// Events
		this.game.signals.metaPowers.add(this.handleMetaPowerEvent, this);
	}

	createHex(x: number, y: number, grid: HexGrid, game?: Game): Hex {
		return new PhaserHex(x, y, grid, game);
	}

	handleMetaPowerEvent(message: string, payload: any): void {
		if (message === 'toggleExecuteMonster') {
			this._executionMode = payload;
		}
	}

	querySelf(o: any): void {
		const game = this.game;
		const defaultOpt = {
			fnOnConfirm: () => {
				// No-op function.
			},
			fnOnSelect: (creature: Creature) => {
				creature.hexagons.forEach((hex: Hex) => {
					(hex as PhaserHex).overlayVisualState('creature selected player' + hex.creature.team);
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
			fnOnConfirm: (hex: Hex, args: any) => {
				args.opt.fnOnConfirm(game.activeCreature, args.opt.args, { queryOptions: o });
			},
			fnOnSelect: (hex: Hex, args: any) => {
				args.opt.fnOnSelect(game.activeCreature, args.opt.args);
			},
			fnOnCancel: (hex: Hex, args: any) => {
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
	 * queryChoice(o)
	 *
	 * fnOnSelect : 		Function : 	Function applied when clicking on one of the available hexes.
	 * fnOnConfirm : 		Function : 	Function applied when clicking again on the same hex.
	 * fnOnCancel : 		Function : 	Function applied when clicking a non reachable hex
	 * requireCreature : 	Boolean : 	Disable a choice if it does not contain a creature matching the team argument
	 * args : 				Object : 	Object given to the events function (to easily pass variable for these function)
	 */
	queryChoice(o: any) {
		const game = this.game;
		const defaultOpt = {
			fnOnConfirm: () => {
				game.activeCreature.queryMove();
			},
			fnOnSelect: (choice: any) => {
				choice.forEach((item: any) => {
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
				o.choices[i].forEach((hex : Hex) => {
					arrayUtils.removePos(o.hexesDashed, hex);
				});
			} else if (o.isDirectionsQuery) {
				this.forEachHex((hex: Hex) => {
					if (o.choices[i][0].direction == hex.direction) {
						arrayUtils.removePos(o.hexesDashed, hex);
					}
				});
			}
		}

		o.hexesDashed = o.hexesDashed.filter((hexDash) => !hexDash.creature);

		this.queryHexes({
			fnOnConfirm: (hex: Hex, args: any) => {
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
			fnOnSelect: (hex: Hex, args: any) => {
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
	queryCreature(o: any) {
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
			flipped: o.flipped,
			hideNonTarget: true,
			id: o.id,
		});
	}

	/**
	 * queryHexes(x, y, distance, size)
		 *
		 * fnOnSelect : 	Function : 	Function applied when clicking on one of the available hexes.
		 * fnOnConfirm : 	Function : 	Function applied when clicking again on the same hex.
		 * fnOnCancel : 	Function : 	Function applied when clicking a non reachable hex
		 * args : 			Object : 	Object given to the events function (to easily pass variable for these function)
		 * hexes : 		Array : 	Reachable hexes
		 * callbackAfterQueryHexes : 		Function : 	empty function to be overridden with custom logic to execute after queryHexes
		 */
	queryHexes(o: any) {
		const game = this.game;
		const defaultOpt = {
			fnOnConfirm: () => {
				game.activeCreature.queryMove();
			},
			fnOnSelect: (hex: Hex) => {
				game.activeCreature.faceHex(hex, undefined, true);
				(hex as PhaserHex).overlayVisualState('creature selected player' + game.activeCreature.team);
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
				(hex as PhaserHex).displayVisualState('dashed');
			} else {
				(hex as PhaserHex).cleanDisplayVisualState('dashed');
			}

			if (o.shrunkenHexes.includes(hex)) {
				(hex as PhaserHex).displayVisualState('shrunken');
			} else {
				(hex as PhaserHex).cleanDisplayVisualState('shrunken');
			}
		});

		// Cleanup
		if (this.materialize_overlay) {
			this.materialize_overlay.alpha = 0;
		}

		if (!o.ownCreatureHexShade) {
			if (o.id instanceof Array) {
				o.id.forEach((id: number) => {
					game.creatures[id].hexagons.forEach((hex: Hex) => {
						(hex as PhaserHex).overlayVisualState('ownCreatureHexShade');
					});
				});
			} else {
				if (o.id != 0) {
					game.creatures[o.id].hexagons.forEach((hex: Hex) => {
						(hex as PhaserHex).overlayVisualState('ownCreatureHexShade');
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

		const onCreatureHover = (creature: Creature, queueEffect: Function, hex: Hex) => {
			if (creature.isDarkPriest()) {
				if (creature === game.activeCreature) {
					if (creature.hasCreaturePlayerGotPlasma()) {
						creature.displayPlasmaShield();
					}
				} else {
					creature.displayHealthStats();
				}
			}
			creature.hexagons.forEach((h: Hex) => {
				// Flashing outline
				(h as PhaserHex).overlayVisualState('hover h_player' + creature.team);
			});
			if (creature !== game.activeCreature) {
				if (!hex.reachable) {
					$j('canvas').css('cursor', 'n-resize');
				} else {
					// Filled hex with color
					(hex as PhaserHex).displayVisualState('creature player' + hex.creature.team);
				}
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
				hex.creature.die(
					/* Target creature was killed by this fake "creature". This works because
					the death logic doesn't actually care about the killing creature, just
					that creature's player. The first player is always responsible for executing
					creatures. */
					{ player: game.players[0] },
				);
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
				} else {
					// If nothing
					o.fnOnCancel(hex, o.args); // ON CANCEL
				}
			} else {
				// Reachable hex
				// Offset Pos
				const offset = o.flipped ? o.size - 1 : 0;
				const mult = o.flipped ? 1 : -1; // For flipped player

				for (let i = 0, size = o.size; i < size; i++) {
					// Try next hexagons to see if they fits
					if (x + offset - i * mult >= this.hexes[y].length || x + offset - i * mult < 0) {
						continue;
					}

					if (this.hexes[y][x + offset - i * mult].isWalkable(o.size, o.id, false, false)) {
						x += offset - i * mult;
						break;
					}
				}

				hex = this.hexes[y][x]; // New coords
				game.activeCreature.faceHex(hex, undefined, true, true);

				if (hex !== this.lastClickedHex) {
					this.lastClickedHex = hex;
				}

				o.fnOnConfirm(hex, o.args, { queryOptions: o });
			}
		};

		const onHoverOffFn = (hex: Hex) => {
			const { creature } = hex;

			if (creature instanceof Creature) {
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
			}

			if (hex.reachable) {
				if (o.fillHexOnHover) {
					this.cleanHex(hex);
					(hex as PhaserHex).displayVisualState('creature player' + this.game.activeCreature.team);
				}

				// Offset Pos
				const offset = o.flipped ? o.size - 1 : 0;
				const mult = o.flipped ? 1 : -1; // For flipped player

				for (let i = 0, size = o.size; i < size; i++) {
					// Try next hexagons to see if they fit
					if (x + offset - i * mult >= this.hexes[y].length || x + offset - i * mult < 0) {
						continue;
					}

					if (this.hexes[y][x + offset - i * mult].isWalkable(o.size, o.id, false, false)) {
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
				(hex as PhaserHex).overlayVisualState('hover');

				$j('canvas').css('cursor', 'not-allowed');
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

	cleanHex(hex: Hex) {
		(hex as PhaserHex).cleanDisplayVisualState();
		(hex as PhaserHex).cleanOverlayVisualState();
	}

	/**
	 * updateDisplay()
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
						(item as PhaserHex).overlayVisualState(`active creature player${item.creature.team}`);
						(item as PhaserHex).displayVisualState(`creature player${item.creature.team}`);
					}
				}
			});
		});
	}

	showGrid(val) {
		this.forEachHex((hex: PhaserHex) => {
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

	showCurrentCreatureMovementInOverlay(creature) {
		//lastQueryOpt is same thing as used in redoQuery
		this.lastQueryOpt.hexes.forEach((hex) => {
			hex.overlayVisualState('hover h_player' + creature.team);
		});
	}

	orderCreatureZ() {
		let index = 0;
		const creatures = this.game.creatures;

		for (let y = 0, leny = this.hexes.length; y < leny; y++) {
			for (let i = 1, len = creatures.length; i < len; i++) {
				if (creatures[i].y == y) {
					const creature = creatures[i] as PhaserCreature;
					this.creatureGroup.remove(creature.grp);
					this.creatureGroup.addAt(creature.grp, index++);
				}
			}

			if (this.materialize_overlay && this.materialize_overlay.posy == y) {
				this.creatureGroup.remove(this.materialize_overlay);
				this.creatureGroup.addAt(this.materialize_overlay, index++);
			}
		}
	}

	/**
	 * cleanDisplay(cssClass)
	 *
	 * cssClass : 	String : 	Class(es) name(s) to remove with jQuery removeClass function
	 *
	 * Shorcut for $allDispHex.removeClass()
	 */
	cleanDisplay(cssClass = '') {
		this.forEachHex((hex) => {
			(hex as PhaserHex).cleanDisplayVisualState(cssClass);
		});
	}

	cleanOverlay(cssClass = '') {
		this.forEachHex((hex: PhaserHex) => {
			hex.cleanOverlayVisualState(cssClass);
		});
	}

	/**
	 * previewCreature(creatureData)
	 *
	 * pos : 			Object : 	Coordinates {x,y}
	 * creatureData : 	Object : 	Object containing info from the database (game.retrieveCreatureStats)
	 *
	 * Draw a preview of the creature at the given coordinates
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
				: 90 * creatureData.size -
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
			const hexInstance = this.hexes[pos.y][pos.x - i] as PhaserHex;
			this.cleanHex(hexInstance);
			hexInstance.overlayVisualState('creature selected player' + game.activeCreature.team);
		}
	}

	/**
	 * Internal debugging method to log and visually highlight (in blue) an array
	 * of hexes.
	 *
	 * @param hexes Hexes to log and visually highlight.
	 */
	__debugHexes(hexes: Hex[]) {
		super.__debugHexes(hexes);
		hexes.forEach((hex: PhaserHex) => hex.displayVisualState('creature selected player1'));
	}
}

export function createPhaserHexGrid(opts: any, game: Game): HexGrid {
	return new PhaserHexGrid(opts, game);
}

