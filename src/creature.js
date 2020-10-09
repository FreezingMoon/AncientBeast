import * as $j from 'jquery';
import { Ability } from './ability';
import { search } from './utility/pathfinding';
import { Hex } from './utility/hex';
import * as arrayUtils from './utility/arrayUtils';
import { Drop } from './drops';
import { Effect } from './effect';

/**
 * Creature Class
 *
 * Creature contains all creatures properties and attacks
 */
export class Creature {
	/* Attributes
	 *
	 * NOTE : attributes and variables starting with $ are jquery element
	 * and jquery function can be called dirrectly from them.
	 *
	 * // Jquery attributes
	 * $display :		Creature representation
	 * $effects :		Effects container (inside $display)
	 *
	 * // Normal attributes
	 * x :				Integer :	Hex coordinates
	 * y :				Integer :	Hex coordinates
	 * pos :			Object :	Pos object for hex comparison {x,y}
	 *
	 * name :			String :	Creature name
	 * id :			Integer :	Creature Id incrementing for each creature starting to 1
	 * size :			Integer :	Creature size in hexes (1,2 or 3)
	 * type :			Integer :	Type of the creature stocked in the database
	 * team :			Integer :	Owner's ID (0,1,2 or 3)
	 * player :		Player :	Player object shortcut
	 * hexagons :		Array :		Array containing the hexes where the creature is
	 *
	 * dead :			Boolean :	True if dead
	 * stats :			Object :	Object containing stats of the creature
	 * statsAlt :		Object :	Object containing the alteration value for each stat //todo
	 * abilities :		Array :		Array containing the 4 abilities
	 * remainingMove : Integer :	Remaining moves allowed untill the end of turn
	 *
	 */

	/* Constructor(obj)
	 *
	 * obj :			Object :	Object containing all creature stats
	 *
	 */
	constructor(obj, game) {
		// Engine
		this.game = game;
		this.name = obj.name;
		this.id = game.creatureIdCounter++;
		this.x = obj.x - 0;
		this.y = obj.y - 0;
		this.pos = {
			x: this.x,
			y: this.y,
		};
		this.size = obj.size - 0;
		this.type = obj.type;
		this.level = obj.level - 0;
		this.realm = obj.realm;
		this.animation = obj.animation;
		this.display = obj.display;
		this.drop = obj.drop;
		this._movementType = 'normal';

		if (obj.movementType) {
			this._movementType = obj.movementType;
		}

		this.hexagons = [];

		// Game
		this.team = obj.team; // = playerID (0,1,2,3)
		this.player = game.players[obj.team];
		this.dead = false;
		this.killer = undefined;
		this.hasWait = false;
		this.travelDist = 0;
		this.effects = [];
		this.dropCollection = [];
		this.protectedFromFatigue = this.type == '--' ? true : false;
		this.turnsActive = 0;

		// Statistics
		this.baseStats = {
			health: obj.stats.health - 0,
			regrowth: obj.stats.regrowth - 0,
			endurance: obj.stats.endurance - 0,
			energy: obj.stats.energy - 0,
			meditation: obj.stats.meditation - 0,
			initiative: obj.stats.initiative - 0,
			offense: obj.stats.offense - 0,
			defense: obj.stats.defense - 0,
			movement: obj.stats.movement - 0,
			pierce: obj.stats.pierce - 0,
			slash: obj.stats.slash - 0,
			crush: obj.stats.crush - 0,
			shock: obj.stats.shock - 0,
			burn: obj.stats.burn - 0,
			frost: obj.stats.frost - 0,
			poison: obj.stats.poison - 0,
			sonic: obj.stats.sonic - 0,
			mental: obj.stats.mental - 0,

			moveable: true,
			fatigueImmunity: false,
			frozen: false,
			// Extra energy required for abilities
			reqEnergy: 0,
		};

		this.stats = $j.extend({}, this.baseStats); //Copy
		this.health = obj.stats.health;
		this.endurance = obj.stats.endurance;
		this.energy = obj.stats.energy;
		this.remainingMove = 0; //Default value recovered each turn
		this.dizzy = false;

		// Abilities
		this.abilities = [
			new Ability(this, 0, game),
			new Ability(this, 1, game),
			new Ability(this, 2, game),
			new Ability(this, 3, game),
		];

		this.updateHex();

		let dp = '';

		if (this.type === '--') {
			switch (this.team) {
				case 0:
					dp = 'red';
					break;
				case 1:
					dp = 'blue';
					break;
				case 2:
					dp = 'orange';
					break;
				case 3:
					dp = 'green';
					break;
			}
		}

		// Creature Container
		this.grp = game.Phaser.add.group(game.grid.creatureGroup, 'creatureGrp_' + this.id);
		this.grp.alpha = 0;
		// Adding sprite
		this.sprite = this.grp.create(0, 0, this.name + dp + '_cardboard');
		this.sprite.anchor.setTo(0.5, 1);
		// Placing sprite
		this.sprite.x =
			(!this.player.flipped
				? this.display['offset-x']
				: 90 * this.size - this.sprite.texture.width - this.display['offset-x']) +
			this.sprite.texture.width / 2;
		this.sprite.y = this.display['offset-y'] + this.sprite.texture.height;
		// Placing Group
		this.grp.x = this.hexagons[this.size - 1].displayPos.x;
		this.grp.y = this.hexagons[this.size - 1].displayPos.y;

		this.facePlayerDefault();

		// Hint Group
		this.hintGrp = game.Phaser.add.group(this.grp, 'creatureHintGrp_' + this.id);
		this.hintGrp.x = 45 * this.size;
		this.hintGrp.y = -this.sprite.texture.height + 5;

		// Health indicator
		this.healthIndicatorGroup = game.Phaser.add.group(this.grp, 'creatureHealthGrp_' + this.id);
		// Adding background sprite
		this.healthIndicatorSprite = this.healthIndicatorGroup.create(
			this.player.flipped ? 19 : 19 + 90 * (this.size - 1),
			49,
			'p' + this.team + '_health',
		);
		// Add text
		this.healthIndicatorText = game.Phaser.add.text(
			this.player.flipped ? 45 : 45 + 90 * (this.size - 1),
			63,
			this.health,
			{
				font: 'bold 15pt Play',
				fill: '#fff',
				align: 'center',
				stroke: '#000',
				strokeThickness: 6,
			},
		);
		this.healthIndicatorText.anchor.setTo(0.5, 0.5);
		this.healthIndicatorGroup.add(this.healthIndicatorText);
		// Hide it
		this.healthIndicatorGroup.alpha = 0;

		// State variable for displaying endurance/fatigue text
		this.fatigueText = '';

		// Adding Himself to creature arrays and queue
		game.creatures[this.id] = this;

		this.delayable = true;
		this.delayed = false;
		this.materializationSickness = this.type == '--' ? false : true;
		this.noActionPossible = false;
	}

	/* summon()
	 *
	 * Summon animation
	 *
	 */
	summon() {
		let game = this.game;

		game.queue.addByInitiative(this);
		game.updateQueueDisplay();

		game.grid.orderCreatureZ();

		if (game.grid.materialize_overlay) {
			game.grid.materialize_overlay.alpha = 0.5;
			game.Phaser.add
				.tween(game.grid.materialize_overlay)
				.to(
					{
						alpha: 0,
					},
					500,
					Phaser.Easing.Linear.None,
				)
				.start();
		}

		game.Phaser.add
			.tween(this.grp)
			.to(
				{
					alpha: 1,
				},
				500,
				Phaser.Easing.Linear.None,
			)
			.start();

		// Reveal and position health indicator
		this.updateHealth();
		this.healthShow();

		// Trigger trap under
		this.hexagons.forEach((hex) => {
			hex.activateTrap(game.triggers.onStepIn, this);
		});

		// Pickup drop
		this.pickupDrop();
		this.hint(this.name, 'creature_name');
	}

	healthHide() {
		this.healthIndicatorGroup.alpha = 0;
	}

	healthShow() {
		this.healthIndicatorGroup.alpha = 1;
	}

	/* activate()
	 *
	 * Activate the creature by showing movement range and binding controls to this creature
	 *
	 */
	activate() {
		this.travelDist = 0;
		this.oldEnergy = this.energy;
		this.oldHealth = this.health;
		this.noActionPossible = false;

		let game = this.game;
		let stats = this.stats;
		let varReset = function () {
			this.game.onReset(this);
			// Variables reset
			this.updateAlteration();
			this.remainingMove = stats.movement;

			if (!this.materializationSickness) {
				// Fatigued creatures (endurance 0) should not regenerate, but fragile
				// ones (max endurance 0) should anyway
				if (!this.isFatigued()) {
					this.heal(stats.regrowth, true);
					if (stats.meditation > 0) {
						this.recharge(stats.meditation);
					}
				} else {
					if (stats.regrowth < 0) {
						this.heal(stats.regrowth, true);
					} else {
						this.hint('♦', 'damage');
					}
				}
			} else {
				this.hint('♣', 'damage');
			}

			setTimeout(() => {
				game.UI.energyBar.animSize(this.energy / stats.energy);
				game.UI.healthBar.animSize(this.health / stats.health);
			}, 1000);

			this.endurance = stats.endurance;

			this.abilities.forEach((ability) => {
				ability.reset();
			});
		}.bind(this);

		// Frozen or dizzy effect
		if (stats.frozen || this.dizzy) {
			varReset();
			let interval = setInterval(() => {
				if (!game.turnThrottle) {
					clearInterval(interval);
					game.skipTurn({
						tooltip: stats.frozen ? 'frozen' : 'dizzy',
					});
				}
			}, 50);
			return;
		}

		if (!this.hasWait) {
			varReset();

			// Trigger
			game.onStartPhase(this);
		}

		this.materializationSickness = false;

		let interval = setInterval(() => {
			if (!game.freezedInput) {
				clearInterval(interval);
				if (game.turn >= game.minimumTurnBeforeFleeing) {
					game.UI.btnFlee.changeState('normal');
				}

				game.startTimer();
				this.queryMove();
			}
		}, 1000);
	}

	/* deactivate(wait)
	 *
	 * wait :	Boolean :	Deactivate while waiting or not
	 *
	 * Preview the creature position at the given coordinates
	 *
	 */
	deactivate(wait) {
		let game = this.game;
		this.delayed = Boolean(wait);
		this.hasWait = this.delayed;
		this.stats.frozen = false;
		this.dizzy = false;

		// Effects triggers
		if (!wait) {
			this.turnsActive += 1;
			game.onEndPhase(this);
		}

		this.delayable = false;
	}

	/* wait()
	 *
	 * Move the creature to the end of the queue
	 *
	 */
	wait() {
		let abilityAvailable = false;

		if (this.delayed) {
			return;
		}

		// If at least one ability has not been used
		this.abilities.forEach((ability) => {
			abilityAvailable = abilityAvailable || !ability.used;
		});

		if (this.remainingMove > 0 && abilityAvailable) {
			this.delay(this.game.activeCreature === this);
			this.deactivate(true);
		}
	}

	delay(excludeActiveCreature) {
		let game = this.game;

		game.queue.delay(this);
		this.delayable = false;
		this.delayed = true;
		this.hint('Delayed', 'msg_effects');
		game.updateQueueDisplay(excludeActiveCreature);
	}

	/* queryMove()
	 *
	 * launch move action query
	 *
	 */
	queryMove(o) {
		let game = this.game;

		if (this.dead) {
			// Creatures can die during their turns from trap effects; make sure this
			// function doesn't do anything
			return;
		}

		// Once Per Damage Abilities recover
		game.creatures.forEach((creature) => {
			//For all Creature
			if (creature instanceof Creature) {
				creature.abilities.forEach((ability) => {
					if (game.triggers.oncePerDamageChain.test(ability.getTrigger())) {
						ability.setUsed(false);
					}
				});
			}
		});

		let remainingMove = this.remainingMove;
		// No movement range if unmoveable
		if (!this.stats.moveable) {
			remainingMove = 0;
		}

		o = $j.extend(
			{
				targeting: false,
				noPath: false,
				isAbility: false,
				ownCreatureHexShade: true,
				range: game.grid.getMovementRange(this.x, this.y, remainingMove, this.size, this.id),
				callback: function (hex, args) {
					if (hex.x == args.creature.x && hex.y == args.creature.y) {
						// Prevent null movement
						game.activeCreature.queryMove();
						return;
					}

					game.gamelog.add({
						action: 'move',
						target: {
							x: hex.x,
							y: hex.y,
						},
					});
					args.creature.delayable = false;
					game.UI.btnDelay.changeState('disabled');
					args.creature.moveTo(hex, {
						animation: args.creature.movementType() === 'flying' ? 'fly' : 'walk',
						callback: function () {
							game.activeCreature.queryMove();
						},
					});
				},
			},
			o,
		);

		if (!o.isAbility) {
			if (game.UI.selectedAbility != -1) {
				this.hint('Canceled', 'gamehintblack');
			}

			$j('#abilities .ability').removeClass('active');
			game.UI.selectAbility(-1);
			game.UI.updateQueueDisplay();
		}

		game.grid.orderCreatureZ();
		this.facePlayerDefault();
		this.updateHealth();

		if (this.movementType() === 'flying') {
			o.range = game.grid.getFlyingRange(this.x, this.y, remainingMove, this.size, this.id);
		}

		let selectNormal = function (hex, args) {
			args.creature.tracePath(hex);
		};
		let selectFlying = function (hex, args) {
			args.creature.tracePosition({
				x: hex.x,
				y: hex.y,
				overlayClass: 'creature moveto selected player' + args.creature.team,
			});
		};
		let select = o.noPath || this.movementType() === 'flying' ? selectFlying : selectNormal;

		if (this.noActionPossible) {
			game.grid.querySelf({
				fnOnConfirm: function () {
					game.UI.btnSkipTurn.click();
				},
				fnOnCancel: function () {},
				confirmText: 'Skip turn',
			});
		} else {
			game.grid.queryHexes({
				fnOnSelect: select,
				fnOnConfirm: o.callback,
				args: {
					creature: this,
					args: o.args,
				}, // Optional args
				size: this.size,
				flipped: this.player.flipped,
				id: this.id,
				hexes: o.range,
				ownCreatureHexShade: o.ownCreatureHexShade,
				targeting: o.targeting,
			});
		}
	}

	/* previewPosition(hex)
	 *
	 * hex :		Hex :		Position
	 *
	 * Preview the creature position at the given Hex
	 *
	 */
	previewPosition(hex) {
		let game = this.game;

		game.grid.cleanOverlay('hover h_player' + this.team);
		if (!game.grid.hexes[hex.y][hex.x].isWalkable(this.size, this.id)) {
			return; // Break if not walkable
		}

		this.tracePosition({
			x: hex.x,
			y: hex.y,
			overlayClass: 'hover h_player' + this.team,
		});
	}

	/* cleanHex()
	 *
	 * Clean current creature hexagons
	 *
	 */
	cleanHex() {
		this.hexagons.forEach((hex) => {
			hex.creature = undefined;
		});
		this.hexagons = [];
	}

	/* updateHex()
	 *
	 * Update the current hexes containing the creature and their display
	 *
	 */
	updateHex() {
		let count = this.size,
			i;

		for (i = 0; i < count; i++) {
			this.hexagons.push(this.game.grid.hexes[this.y][this.x - i]);
		}

		this.hexagons.forEach((hex) => {
			hex.creature = this;
		});
	}

	/* faceHex(facefrom,faceto)
	 *
	 * facefrom :	Hex or Creature :	Hex to face from
	 * faceto :	Hex or Creature :	Hex to face
	 *
	 * Face creature at given hex
	 *
	 */
	faceHex(faceto, facefrom, ignoreCreaHex, attackFix) {
		if (!facefrom) {
			facefrom = this.player.flipped ? this.hexagons[this.size - 1] : this.hexagons[0];
		}

		if (
			ignoreCreaHex &&
			this.hexagons.indexOf(faceto) != -1 &&
			this.hexagons.indexOf(facefrom) != -1
		) {
			this.facePlayerDefault();
			return;
		}

		if (faceto instanceof Creature) {
			faceto = faceto.size < 2 ? faceto.hexagons[0] : faceto.hexagons[1];
		}

		if (faceto.x == facefrom.x && faceto.y == facefrom.y) {
			this.facePlayerDefault();
			return;
		}

		if (attackFix && this.size > 1) {
			//only works on 2hex creature targeting the adjacent row
			if (facefrom.y % 2 === 0) {
				if (faceto.x - this.player.flipped == facefrom.x) {
					this.facePlayerDefault();
					return;
				}
			} else {
				if (faceto.x + 1 - this.player.flipped == facefrom.x) {
					this.facePlayerDefault();
					return;
				}
			}
		}

		let flipped;

		if (facefrom.y % 2 === 0) {
			flipped = faceto.x <= facefrom.x;
		} else {
			flipped = faceto.x < facefrom.x;
		}

		if (flipped) {
			this.sprite.scale.setTo(-1, 1);
		} else {
			this.sprite.scale.setTo(1, 1);
		}
		this.sprite.x =
			(!flipped
				? this.display['offset-x']
				: 90 * this.size - this.sprite.texture.width - this.display['offset-x']) +
			this.sprite.texture.width / 2;
	}

	/* facePlayerDefault()
	 *
	 * Face default direction
	 *
	 */
	facePlayerDefault() {
		if (this.player.flipped) {
			this.sprite.scale.setTo(-1, 1);
		} else {
			this.sprite.scale.setTo(1, 1);
		}
		this.sprite.x =
			(!this.player.flipped
				? this.display['offset-x']
				: 90 * this.size - this.sprite.texture.width - this.display['offset-x']) +
			this.sprite.texture.width / 2;
	}

	/* moveTo(hex,opts)
	 *
	 * hex :		Hex :		Destination Hex
	 * opts :		Object :	Optional args object
	 *
	 * Move the creature along a calculated path to the given coordinates
	 *
	 */
	moveTo(hex, opts) {
		let game = this.game,
			defaultOpt = {
				callback: function () {
					return true;
				},
				callbackStepIn: function () {
					return true;
				},
				animation: this.movementType() === 'flying' ? 'fly' : 'walk',
				ignoreMovementPoint: false,
				ignorePath: false,
				customMovementPoint: 0,
				overrideSpeed: 0,
				turnAroundOnComplete: true,
			},
			path;

		opts = $j.extend(defaultOpt, opts);

		// Teleportation ignores moveable
		if (this.stats.moveable || opts.animation === 'teleport') {
			let x = hex.x;
			let y = hex.y;

			if (opts.ignorePath || opts.animation == 'fly') {
				path = [hex];
			} else {
				path = this.calculatePath(x, y);
			}

			if (path.length === 0) {
				return; // Break if empty path
			}

			game.grid.xray(new Hex(0, 0, false, game)); // Clean Xray

			this.travelDist = 0;

			game.animations[opts.animation](this, path, opts);
		} else {
			game.log('This creature cannot be moved');
		}

		let interval = setInterval(() => {
			if (!game.freezedInput) {
				clearInterval(interval);
				opts.callback();
			}
		}, 100);
	}

	/* tracePath(hex)
	 *
	 * hex :	Hex :	Destination Hex
	 *
	 * Trace the path from the current possition to the given coordinates
	 *
	 */
	tracePath(hex) {
		let x = hex.x,
			y = hex.y,
			path = this.calculatePath(x, y); // Store path in grid to be able to compare it later

		if (path.length === 0) {
			return; // Break if empty path
		}

		path.forEach((item) => {
			this.tracePosition({
				x: item.x,
				y: item.y,
				displayClass: 'adj',
				drawOverCreatureTiles: false,
			});
		}); // Trace path

		// Highlight final position
		let last = arrayUtils.last(path);

		this.tracePosition({
			x: last.x,
			y: last.y,
			overlayClass: 'creature moveto selected player' + this.team,
			drawOverCreatureTiles: false,
		});
	}

	tracePosition(args) {
		let defaultArgs = {
			x: this.x,
			y: this.y,
			overlayClass: '',
			displayClass: '',
			drawOverCreatureTiles: true,
		};

		args = $j.extend(defaultArgs, args);

		for (let i = 0; i < this.size; i++) {
			let canDraw = true;

			if (!args.drawOverCreatureTiles) {
				// then check to ensure this is not a creature tile
				for (let j = 0; j < this.hexagons.length; j++) {
					if (this.hexagons[j].x == args.x - i && this.hexagons[j].y == args.y) {
						canDraw = false;
						break;
					}
				}
			}
			if (canDraw) {
				let hex = this.game.grid.hexes[args.y][args.x - i];
				this.game.grid.cleanHex(hex);
				hex.overlayVisualState(args.overlayClass);
				hex.displayVisualState(args.displayClass);
			}
		}
	}

	/* calculatePath(x,y)
	 *
	 * x :		Integer :	Destination coordinates
	 * y :		Integer :	Destination coordinates
	 *
	 * return :	Array :	Array containing the path hexes
	 *
	 */
	calculatePath(x, y) {
		let game = this.game;

		return search(
			game.grid.hexes[this.y][this.x],
			game.grid.hexes[y][x],
			this.size,
			this.id,
			this.game.grid,
		); // Calculate path
	}

	/* calcOffset(x,y)
	 *
	 * x :		Integer :	Destination coordinates
	 * y :		Integer :	Destination coordinates
	 *
	 * return :	Object :	New position taking into acount the size, orientation and obstacle {x,y}
	 *
	 * Return the first possible position for the creature at the given coordinates
	 *
	 */
	calcOffset(x, y) {
		let game = this.game,
			offset = game.players[this.team].flipped ? this.size - 1 : 0,
			mult = game.players[this.team].flipped ? 1 : -1; // For FLIPPED player

		for (let i = 0; i < this.size; i++) {
			// Try next hexagons to see if they fit
			if (x + offset - i * mult >= game.grid.hexes[y].length || x + offset - i * mult < 0) {
				continue;
			}

			if (game.grid.hexes[y][x + offset - i * mult].isWalkable(this.size, this.id)) {
				x += offset - i * mult;
				break;
			}
		}

		return {
			x: x,
			y: y,
		};
	}

	/* getInitiative()
	 *
	 * return :	Integer :	Initiative value to order the queue
	 *
	 */
	getInitiative() {
		// To avoid 2 identical initiative
		return this.stats.initiative * 500 - this.id;
	}

	/* adjacentHexes(dist)
	 *
	 * dist :		Integer :	Distance in hexagons
	 *
	 * return :	Array :		Array of adjacent hexagons
	 *
	 */
	adjacentHexes(dist, clockwise) {
		let game = this.game;

		// TODO Review this algo to allow distance
		if (clockwise) {
			let hexes = [],
				c;
			let o = this.y % 2 === 0 ? 1 : 0;

			if (this.size == 1) {
				c = [
					{
						y: this.y,
						x: this.x + 1,
					},
					{
						y: this.y - 1,
						x: this.x + o,
					},
					{
						y: this.y - 1,
						x: this.x - 1 + o,
					},
					{
						y: this.y,
						x: this.x - 1,
					},
					{
						y: this.y + 1,
						x: this.x - 1 + o,
					},
					{
						y: this.y + 1,
						x: this.x + o,
					},
				];
			}

			if (this.size == 2) {
				c = [
					{
						y: this.y,
						x: this.x + 1,
					},
					{
						y: this.y - 1,
						x: this.x + o,
					},
					{
						y: this.y - 1,
						x: this.x - 1 + o,
					},
					{
						y: this.y - 1,
						x: this.x - 2 + o,
					},
					{
						y: this.y,
						x: this.x - 2,
					},
					{
						y: this.y + 1,
						x: this.x - 2 + o,
					},
					{
						y: this.y + 1,
						x: this.x - 1 + o,
					},
					{
						y: this.y + 1,
						x: this.x + o,
					},
				];
			}

			if (this.size == 3) {
				c = [
					{
						y: this.y,
						x: this.x + 1,
					},
					{
						y: this.y - 1,
						x: this.x + o,
					},
					{
						y: this.y - 1,
						x: this.x - 1 + o,
					},
					{
						y: this.y - 1,
						x: this.x - 2 + o,
					},
					{
						y: this.y - 1,
						x: this.x - 3 + o,
					},
					{
						y: this.y,
						x: this.x - 3,
					},
					{
						y: this.y + 1,
						x: this.x - 3 + o,
					},
					{
						y: this.y + 1,
						x: this.x - 2 + o,
					},
					{
						y: this.y + 1,
						x: this.x - 1 + o,
					},
					{
						y: this.y + 1,
						x: this.x + o,
					},
				];
			}

			let total = c.length;
			for (let i = 0; i < total; i++) {
				const { x, y } = c[i];
				if (game.grid.hexExists(y, x)) {
					hexes.push(game.grid.hexes[y][x]);
				}
			}

			return hexes;
		}

		if (this.size > 1) {
			let hexes = this.hexagons[0].adjacentHex(dist);
			let lasthexes = this.hexagons[this.size - 1].adjacentHex(dist);

			hexes.forEach((hex) => {
				if (arrayUtils.findPos(this.hexagons, hex)) {
					arrayUtils.removePos(hexes, hex);
				} // Remove from array if own creature hex
			});

			lasthexes.forEach((hex) => {
				// If node doesnt already exist in final collection and if it's not own creature hex
				if (!arrayUtils.findPos(hexes, hex) && !arrayUtils.findPos(this.hexagons, hex)) {
					hexes.push(hex);
				}
			});

			return hexes;
		} else {
			return this.hexagons[0].adjacentHex(dist);
		}
	}

	/** recharge
	 * @param {number} amount: amount of energy to restore
	 * @return {void}
	 * Restore energy up to the max limit
	 */
	recharge(amount) {
		this.energy = Math.min(this.stats.energy, this.energy + amount);
	}

	/* heal(amount)
	 *
	 * amount :	Damage :	Amount of health point to restore
	 */
	heal(amount, isRegrowth) {
		let game = this.game;
		// Cap health point
		amount = Math.min(amount, this.stats.health - this.health);

		if (this.health + amount < 1) {
			amount = this.health - 1; // Cap to 1hp
		}

		this.health += amount;

		// Health display Update
		this.updateHealth(isRegrowth);

		if (amount > 0) {
			if (isRegrowth) {
				this.hint('+' + amount + ' ♥', 'healing d' + amount);
			} else {
				this.hint('+' + amount, 'healing d' + amount);
			}

			game.log('%CreatureName' + this.id + '% recovers +' + amount + ' health');
		} else if (amount === 0) {
			if (isRegrowth) {
				this.hint('♦', 'msg_effects');
			} else {
				this.hint('!', 'msg_effects');
			}
		} else {
			if (isRegrowth) {
				this.hint(amount + ' ♠', 'damage d' + amount);
			} else {
				this.hint(amount, 'damage d ' + amount);
			}

			game.log('%CreatureName' + this.id + '% loses ' + amount + ' health');
		}

		game.onHeal(this, amount);
	}

	/* takeDamage(damage)
	 *
	 * damage :	Damage : 	Damage object
	 *
	 * return :	Object :	Contains damages dealed and if creature is killed or not
	 */
	takeDamage(damage, o) {
		let game = this.game;

		if (this.dead) {
			game.log('%CreatureName' + this.id + '% is already dead, aborting takeDamage call.');
			return;
		}

		let defaultOpt = {
			ignoreRetaliation: false,
			isFromTrap: false,
		};

		o = $j.extend(defaultOpt, o);
		// Determine if melee attack
		damage.melee = false;
		this.adjacentHexes(1).forEach((hex) => {
			if (damage.attacker == hex.creature) {
				damage.melee = true;
			}
		});

		damage.target = this;
		damage.isFromTrap = o.isFromTrap;

		// Trigger
		game.onUnderAttack(this, damage);
		game.onAttack(damage.attacker, damage);

		// Calculation
		if (damage.status === '') {
			// Damages
			let dmg = damage.applyDamage();
			let dmgAmount = dmg.total;

			if (!isFinite(dmgAmount)) {
				// Check for Damage Errors
				this.hint('Error', 'damage');
				game.log('Oops something went wrong !');

				return {
					damages: 0,
					kill: false,
				};
			}

			this.health -= dmgAmount;
			this.health = this.health < 0 ? 0 : this.health; // Cap

			this.addFatigue(dmgAmount);

			// Display
			let nbrDisplayed = dmgAmount ? '-' + dmgAmount : 0;
			this.hint(nbrDisplayed, 'damage d' + dmgAmount);

			if (!damage.noLog) {
				game.log('%CreatureName' + this.id + '% is hit : ' + nbrDisplayed + ' health');
			}

			// If Health is empty
			if (this.health <= 0) {
				this.die(damage.attacker);

				return {
					damages: dmg,
					damageObj: damage,
					kill: true,
				}; // Killed
			}

			// Effects
			damage.effects.forEach((effect) => {
				this.addEffect(effect);
			});

			// Unfreeze if taking non-zero damage
			if (dmgAmount > 0) {
				this.stats.frozen = false;
			}

			// Health display Update
			// Note: update health after adding effects as some effects may affect
			// health display
			this.updateHealth();
			game.UI.updateFatigue();

			// Trigger
			if (!o.ignoreRetaliation) {
				game.onDamage(this, damage);
			}

			return {
				damages: dmg,
				damageObj: damage,
				kill: false,
			}; // Not Killed
		} else {
			if (damage.status == 'Dodged') {
				// If dodged
				if (!damage.noLog) {
					game.log('%CreatureName' + this.id + '% dodged the attack');
				}
			}

			if (damage.status == 'Shielded') {
				// If Shielded
				if (!damage.noLog) {
					game.log('%CreatureName' + this.id + '% shielded the attack');
				}
			}

			if (damage.status == 'Disintegrated') {
				// If Disintegrated
				if (!damage.noLog) {
					game.log('%CreatureName' + this.id + '% has been disintegrated');
				}
				this.die(damage.attacker);
			}

			// Hint
			this.hint(damage.status, 'damage ' + damage.status.toLowerCase());
		}

		return {
			damageObj: damage,
			kill: false,
		}; // Not killed
	}

	updateHealth(noAnimBar) {
		let game = this.game;

		if (this == game.activeCreature && !noAnimBar) {
			game.UI.healthBar.animSize(this.health / this.stats.health);
		}

		// Dark Priest plasma shield when inactive
		if (this.type == '--') {
			if (this.hasCreaturePlayerGotPlasma() && this !== game.activeCreature) {
				this.displayPlasmaShield();
			} else {
				this.displayHealthStats();
			}
		} else {
			this.displayHealthStats();
		}
	}

	displayHealthStats() {
		if (this.stats.frozen) {
			this.healthIndicatorSprite.loadTexture('p' + this.team + '_frozen');
		} else {
			this.healthIndicatorSprite.loadTexture('p' + this.team + '_health');
		}

		this.healthIndicatorText.setText(this.health);
	}

	displayPlasmaShield() {
		this.healthIndicatorSprite.loadTexture('p' + this.team + '_plasma');
		this.healthIndicatorText.setText(this.player.plasma);
	}

	hasCreaturePlayerGotPlasma() {
		return this.player.plasma > 0;
	}

	addFatigue(dmgAmount) {
		if (!this.stats.fatigueImmunity) {
			this.endurance -= dmgAmount;
			this.endurance = this.endurance < 0 ? 0 : this.endurance; // Cap
		}

		this.game.UI.updateFatigue();
	}

	/* addEffect(effect)
	 *
	 * effect :		Effect :	Effect object
	 *
	 */
	addEffect(effect, specialString, specialHint) {
		let game = this.game;

		if (!effect.stackable && this.findEffect(effect.name).length !== 0) {
			//G.log(this.player.name+"'s "+this.name+" is already affected by "+effect.name);
			return false;
		}

		effect.target = this;
		this.effects.push(effect);

		game.onEffectAttach(this, effect);

		this.updateAlteration();

		if (effect.name !== '') {
			if (specialHint || effect.specialHint) {
				this.hint(specialHint, 'msg_effects');
			} else {
				this.hint(effect.name, 'msg_effects');
			}
			if (specialString) {
				game.log(specialString);
			} else {
				game.log('%CreatureName' + this.id + '% is affected by ' + effect.name);
			}
		}
	}

	/** replaceEffect
	 * Add effect, but if the effect is already attached, replace it with the new
	 * effect.
	 * Note that for stackable effects, this is the same as addEffect()
	 *
	 * @param {Effect} effect: the effect to add
	 * @return {void}
	 */
	replaceEffect(effect) {
		if (!effect.stackable && this.findEffect(effect.name).length !== 0) {
			this.removeEffect(effect.name);
		}

		this.addEffect(effect);
	}

	/** removeEffect
	 * Remove an effect by name
	 *
	 * @param {string} name: name of effect
	 * @return {void}
	 */
	removeEffect(name) {
		let totalEffects = this.effects.length;

		for (let i = 0; i < totalEffects; i++) {
			if (this.effects[i].name === name) {
				this.effects.splice(i, 1);
				break;
			}
		}
	}

	hint(text, cssClass) {
		let game = this.game,
			tooltipSpeed = 250,
			tooltipDisplaySpeed = 500,
			tooltipTransition = Phaser.Easing.Linear.None;

		let hintColor = {
			confirm: {
				fill: '#ffffff',
				stroke: '#000000',
			},
			gamehintblack: {
				fill: '#ffffff',
				stroke: '#000000',
			},
			healing: {
				fill: '#00ff00',
			},
			msg_effects: {
				fill: '#ffff00',
			},
			creature_name: {
				fill: '#ffffff',
				stroke: '#AAAAAA',
			},
		};

		let style = $j.extend(
			{
				font: 'bold 20pt Play',
				fill: '#ff0000',
				align: 'center',
				stroke: '#000000',
				strokeThickness: 2,
			},
			hintColor[cssClass],
		);

		// Remove constant element
		this.hintGrp.forEach(
			(grpHintElem) => {
				if (grpHintElem.cssClass == 'confirm') {
					grpHintElem.cssClass = 'confirm_deleted';
					grpHintElem.tweenAlpha = game.Phaser.add
						.tween(grpHintElem)
						.to(
							{
								alpha: 0,
							},
							tooltipSpeed,
							tooltipTransition,
						)
						.start();
					grpHintElem.tweenAlpha.onComplete.add(function () {
						this.destroy();
					}, grpHintElem);
				}
			},
			this,
			true,
		);

		let hint = game.Phaser.add.text(0, 50, text, style);
		hint.anchor.setTo(0.5, 0.5);

		hint.alpha = 0;
		hint.cssClass = cssClass;

		if (cssClass == 'confirm') {
			hint.tweenAlpha = game.Phaser.add
				.tween(hint)
				.to(
					{
						alpha: 1,
					},
					tooltipSpeed,
					tooltipTransition,
				)
				.start();
		} else {
			hint.tweenAlpha = game.Phaser.add
				.tween(hint)
				.to(
					{
						alpha: 1,
					},
					tooltipSpeed,
					tooltipTransition,
				)
				.to(
					{
						alpha: 1,
					},
					tooltipDisplaySpeed,
					tooltipTransition,
				)
				.to(
					{
						alpha: 0,
					},
					tooltipSpeed,
					tooltipTransition,
				)
				.start();
			hint.tweenAlpha.onComplete.add(function () {
				this.destroy();
			}, hint);
		}

		this.hintGrp.add(hint);

		// Stacking
		this.hintGrp.forEach(
			(grpHintElem) => {
				let index = this.hintGrp.total - this.hintGrp.getIndex(grpHintElem) - 1;
				let offset = -50 * index;

				if (grpHintElem.tweenPos) {
					grpHintElem.tweenPos.stop();
				}

				grpHintElem.tweenPos = game.Phaser.add
					.tween(grpHintElem)
					.to(
						{
							y: offset,
						},
						tooltipSpeed,
						tooltipTransition,
					)
					.start();
			},
			this,
			true,
		);
	}

	/* updateAlteration()
	 *
	 * Update the stats taking into account the effects' alteration
	 *
	 */
	updateAlteration() {
		this.stats = $j.extend({}, this.baseStats); // Copy

		let buffDebuffArray = this.effects;

		buffDebuffArray.forEach((buff) => {
			$j.each(buff.alterations, (key, value) => {
				if (typeof value == 'string') {
					// Multiplication Buff
					if (value.match(/\*/)) {
						this.stats[key] = eval(this.stats[key] + value);
					}

					// Division Debuff
					if (value.match(/\//)) {
						this.stats[key] = eval(this.stats[key] + value);
					}
				}

				// Usual Buff/Debuff
				if (typeof value == 'number') {
					this.stats[key] += value;
				}

				// Boolean Buff/Debuff
				if (typeof value == 'boolean') {
					this.stats[key] = value;
				}
			});
		});

		this.stats.endurance = Math.max(this.stats.endurance, 0);

		this.endurance = Math.min(this.endurance, this.stats.endurance);
		this.energy = Math.min(this.energy, this.stats.energy);
		this.remainingMove = Math.min(this.remainingMove, this.stats.movement);
	}

	/* die()
	 *
	 * kill animation. remove creature from queue and from hexes
	 *
	 * killer :	Creature :	Killer of this creature
	 *
	 */
	die(killer) {
		let game = this.game;

		game.log('%CreatureName' + this.id + '% is dead');

		this.dead = true;

		// Triggers
		game.onCreatureDeath(this);

		this.killer = killer.player;
		let isDeny = this.killer.flipped == this.player.flipped;

		// Drop item
		if (game.unitDrops == 1 && this.drop) {
			let offsetX = this.player.flipped ? this.x - this.size + 1 : this.x;
			new Drop(this.drop.name, this.drop.health, this.drop.energy, offsetX, this.y, game);
		}

		if (!game.firstKill && !isDeny) {
			// First Kill
			this.killer.score.push({
				type: 'firstKill',
			});
			game.firstKill = true;
		}

		if (this.type == '--') {
			// If Dark Priest
			if (isDeny) {
				// TEAM KILL (DENY)
				this.killer.score.push({
					type: 'deny',
					creature: this,
				});
			} else {
				// Humiliation
				this.killer.score.push({
					type: 'humiliation',
					player: this.team,
				});
			}
		}

		if (!this.undead) {
			// Only if not undead
			if (isDeny) {
				// TEAM KILL (DENY)
				this.killer.score.push({
					type: 'deny',
					creature: this,
				});
			} else {
				// KILL
				this.killer.score.push({
					type: 'kill',
					creature: this,
				});
			}
		}

		if (this.player.isAnnihilated()) {
			// Remove humiliation as annihilation is an upgrade
			let total = this.killer.score.length;
			for (let i = 0; i < total; i++) {
				let s = this.killer.score[i];
				if (s.type == 'humiliation') {
					if (s.player == this.team) {
						this.killer.score.splice(i, 1);
					}

					break;
				}
			}
			// ANNIHILATION
			this.killer.score.push({
				type: 'annihilation',
				player: this.team,
			});
		}

		if (this.type == '--') {
			this.player.deactivate(); // Here because of score calculation
		}

		// Kill animation
		let tweenSprite = game.Phaser.add
			.tween(this.sprite)
			.to(
				{
					alpha: 0,
				},
				500,
				Phaser.Easing.Linear.None,
			)
			.start();
		let tweenHealth = game.Phaser.add
			.tween(this.healthIndicatorGroup)
			.to(
				{
					alpha: 0,
				},
				500,
				Phaser.Easing.Linear.None,
			)
			.start();
		tweenSprite.onComplete.add(() => {
			this.sprite.destroy();
		});
		tweenHealth.onComplete.add(() => {
			this.healthIndicatorGroup.destroy();
		});

		this.cleanHex();

		game.queue.remove(this);
		game.updateQueueDisplay();
		game.grid.updateDisplay();

		if (game.activeCreature === this) {
			game.nextCreature();
			return;
		} // End turn if current active creature die

		// As hex occupation changes, path must be recalculated for the current creature not the dying one
		game.activeCreature.queryMove();
	}

	isFatigued() {
		return this.endurance === 0 && !this.isFragile();
	}

	isFragile() {
		return this.stats.endurance === 0;
	}

	/* getHexMap()
	 *
	 * shortcut convenience function to grid.getHexMap
	 */
	getHexMap(map, invertFlipped) {
		let x = (this.player.flipped ? !invertFlipped : invertFlipped)
			? this.x + 1 - this.size
			: this.x;
		return this.game.grid.getHexMap(
			x,
			this.y - map.origin[1],
			0 - map.origin[0],
			this.player.flipped ? !invertFlipped : invertFlipped,
			map,
		);
	}

	getBuffDebuff(stat) {
		let buffDebuffArray = this.effects.concat(this.dropCollection),
			debuff = 0,
			buffObjs = {
				effects: [],
				drops: [],
			};

		let addToBuffObjs = function (obj) {
			if (obj instanceof Effect) {
				buffObjs.effects.push(obj);
			} else if (obj instanceof Drop) {
				buffObjs.drops.push(obj);
			}
		};

		buffDebuffArray.forEach((buff) => {
			let o = buff;
			$j.each(buff.alterations, (key, value) => {
				if (typeof value == 'string') {
					if (key === stat || stat === undefined) {
						// Multiplication Buff
						if (value.match(/\*/)) {
							addToBuffObjs(o);
							let base = this.stats[key];
							let result = eval(this.stats[key] + value);

							if (result > base) {
								buff += result - base;
							} else {
								debuff += result - base;
							}
						}

						// Division Debuff
						if (value.match(/\//)) {
							addToBuffObjs(o);
							let base = this.stats[key];
							let result = eval(this.stats[key] + value);

							if (result > base) {
								buff += result - base;
							} else {
								debuff += result - base;
							}
						}
					}
				}

				// Usual Buff/Debuff
				if (typeof value == 'number') {
					if (key === stat || stat === undefined) {
						addToBuffObjs(o);
						if (value > 0) {
							buff += value;
						} else {
							debuff += value;
						}
					}
				}
			});
		});

		return {
			buff: 0,
			debuff: debuff,
			objs: buffObjs,
		};
	}

	findEffect(name) {
		let ret = [];

		this.effects.forEach((effect) => {
			if (effect.name == name) {
				ret.push(effect);
			}
		});

		return ret;
	}

	// Make units transparent
	xray(enable) {
		let game = this.game;

		if (enable) {
			game.Phaser.add
				.tween(this.grp)
				.to(
					{
						alpha: 0.5,
					},
					250,
					Phaser.Easing.Linear.None,
				)
				.start();
		} else {
			game.Phaser.add
				.tween(this.grp)
				.to(
					{
						alpha: 1,
					},
					250,
					Phaser.Easing.Linear.None,
				)
				.start();
		}
	}

	pickupDrop() {
		this.hexagons.forEach((hex) => {
			hex.pickupDrop(this);
		});
	}

	/**
	 * Get movement type for this creature
	 * @return {string} "normal", "hover", or "flying"
	 */
	movementType() {
		let totalAbilities = this.abilities.length;

		// If the creature has an ability that modifies movement type, use that,
		// otherwise use the creature's base movement type
		for (let i = 0; i < totalAbilities; i++) {
			if ('movementType' in this.abilities[i]) {
				return this.abilities[i].movementType();
			}
		}

		return this._movementType;
	}
}
