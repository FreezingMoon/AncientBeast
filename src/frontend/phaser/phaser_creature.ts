import $j from 'jquery';
import Game from '../../game';
import { Ability } from '../ability';
import { Creature } from '../creature';
import { Hex } from '../hex';
import { PhaserAbility } from './phaser_ability';
import { PhaserHex } from './phaser_hex';
import { PhaserHexGrid } from './phaser_hexgrid';
import * as arrayUtils from '../../utility/arrayUtils';
import { PhaserDrop } from './phaser_drops';

export class PhaserCreature extends Creature {
	display: any;
	grp: Phaser.Group;
	hintGrp: Phaser.Group;
	healthIndicatorGroup: Phaser.Group;
	healthIndicatorText: Phaser.Text;
	healthIndicatorSprite: Phaser.Sprite;
	sprite: Phaser.Sprite;

	constructor(obj: any, game: Game) {
		super(obj, game);

		this.display = obj.display;

		// Abilities
		this.abilities = [
			new PhaserAbility(this, 0, game),
			new PhaserAbility(this, 1, game),
			new PhaserAbility(this, 2, game),
			new PhaserAbility(this, 3, game),
		];

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

		let grid: PhaserHexGrid = game.grid as PhaserHexGrid;

		// Creature Container
		this.grp = game.Phaser.add.group(grid.creatureGroup, 'creatureGrp_' + this.id);
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
	}

	summon(disableMaterializationSickness: boolean): void {
		let game = this.game;

		/* Without Sickness the creature should act in the current turn, except the dark
		priest who must always be in the next queue to properly start the game. */
		const alsoAddToCurrentQueue = disableMaterializationSickness && !this.isDarkPriest();

		game.queue.addByInitiative(this, alsoAddToCurrentQueue);

		if (disableMaterializationSickness) {
			this.materializationSickness = false;
		}

		// Remove temporary Creature to prevent duplicates when the actual
		// materialized Creature with correct position is added to the queue
		game.queue.removeTempCreature();
		game.updateQueueDisplay();

		game.grid.orderCreatureZ();

		if ((game.grid as PhaserHexGrid).materialize_overlay) {
			(game.grid as PhaserHexGrid).materialize_overlay.alpha = 0.5;
			game.Phaser.add
				.tween((game.grid as PhaserHexGrid).materialize_overlay)
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

	healthHide(): void {
		this.healthIndicatorGroup.alpha = 0;
	}

	healthShow(): void {
		this.healthIndicatorGroup.alpha = 1;
	}

	activate(): void {
		this.travelDist = 0;
		this.oldEnergy = this.energy;
		this.oldHealth = this.health;
		this.noActionPossible = false;

		let game = this.game;
		let stats = this.stats;

		let self: PhaserCreature = this;

		let varReset = function () {
			self.game.onReset(self);
			// Variables reset
			self.updateAlteration();
			self.remainingMove = stats.movement;

			if (!self.materializationSickness) {
				// Fatigued creatures (endurance 0) should not regenerate.
				if (!self.isFatigued()) {
					self.heal(stats.regrowth, true);

					if (stats.meditation > 0) {
						self.recharge(stats.meditation);
					}
				} else {
					if (stats.regrowth < 0) {
						self.heal(stats.regrowth, true);
					} else {
						self.hint('♦', 'damage');
					}
				}
			} else {
				self.hint('♣', 'damage');
			}

			setTimeout(() => {
				game.UI.energyBar.animSize(self.energy / stats.energy);
				game.UI.healthBar.animSize(self.health / stats.health);
			}, 1000);

			self.endurance = stats.endurance;

			self.abilities.forEach((ability) => {
				ability.reset();
			});
		}.bind(this);

		// Frozen or dizzy effect
		if (this.isFrozen() || this.isDizzy()) {
			varReset();
			let interval = setInterval(() => {
				if (!game.turnThrottle) {
					clearInterval(interval);
					game.skipTurn({
						tooltip: this.isFrozen() ? 'Frozen' : 'Dizzy',
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
			// if (!game.freezedInput) { remove for muliplayer
			clearInterval(interval);
			if (game.turn >= game.minimumTurnBeforeFleeing) {
				game.UI.btnFlee.changeState('normal');
			}

			game.startTimer();
			this.queryMove();
			// }
		}, 1000);
	}

	queryMove(o?: any): void {
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
				creature.abilities.forEach((ability: Ability) => {
					if (game.triggers.oncePerDamageChain.test(ability.getTriggerStr())) {
						ability.setUsed(false);
					}
				});
			}
		});

		// Clean up temporary creature if a summon was cancelled.
		if (game.creatures[game.creatures.length - 1].temp) {
			game.creatures.pop();
			game.creatureIdCounter--;
		}

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
				callback: function (hex: Hex, args: any) {
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
					if (game.multiplayer) {
						game.gameplay.moveTo({
							target: {
								x: hex.x,
								y: hex.y,
							},
						});
					}
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

				// If this Creature is Dark Priest, remove temporary Creature in queue
				if (this.isDarkPriest()) {
					game.queue.removeTempCreature();
				}
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

		let selectNormal = function (hex: Hex, args: any) {
			args.creature.tracePath(hex);
		};
		let selectFlying = function (hex: Hex, args: any) {
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
					// @ts-ignore
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

	previewPosition(hex: Hex): void {
		let game = this.game;

		(game.grid as PhaserHexGrid).cleanOverlay('hover h_player' + this.team);
		if (!game.grid.hexes[hex.y][hex.x].isWalkable(this.size, this.id)) {
			return; // Break if not walkable
		}

		this.tracePosition({
			x: hex.x,
			y: hex.y,
			overlayClass: 'hover h_player' + this.team,
		});
	}

	faceHex(faceto: any, facefrom?: any, ignoreCreaHex?: boolean, attackFix?: boolean): void {
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
			if (faceto === this) {
				this.facePlayerDefault();
				return;
			}
			faceto = faceto.size < 2 ? faceto.hexagons[0] : faceto.hexagons[1];
		}

		if (faceto.x == facefrom.x && faceto.y == facefrom.y) {
			this.facePlayerDefault();
			return;
		}

		if (attackFix && this.size > 1) {
			//only works on 2hex creature targeting the adjacent row
			if (facefrom.y % 2 === 0) {
				if (((faceto.x - Number(this.player.flipped)) as number) == facefrom.x) {
					this.facePlayerDefault();
					return;
				}
			} else {
				if (faceto.x + 1 - Number(this.player.flipped) == facefrom.x) {
					this.facePlayerDefault();
					return;
				}
			}
		}

		let flipped: boolean;

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

	facePlayerDefault(): void {
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

	moveTo(hex: Hex, opts: any): void {
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
			path: any;

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

			game.grid.xray(new PhaserHex(0, 0, undefined, game)); // Clean Xray

			this.travelDist = 0;

			game.animations.callMethodByStr(opts.animation, this, path, opts);
		} else {
			game.log('This creature cannot be moved');
		}

		let interval = setInterval(() => {
			// Check if creature's movement animation is completely finished.
			if (!game.freezedInput) {
				clearInterval(interval);
				opts.callback();
				game.signals.creature.dispatch('movementComplete', { creature: this, hex });
				game.onCreatureMove(this, hex); // Trigger
			}
		}, 100);
	}

	tracePath(hex: Hex): void {
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

	tracePosition(args: any): void {
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
				let hex = this.game.grid.hexes[args.y][args.x - i] as PhaserHex;
				this.game.grid.cleanHex(hex);
				hex.overlayVisualState(args.overlayClass);
				hex.displayVisualState(args.displayClass);
			}
		}
	}

	displayHealthStats(): void {
		if (this.isFrozen()) {
			this.healthIndicatorSprite.loadTexture('p' + this.team + '_frozen');
		} else {
			this.healthIndicatorSprite.loadTexture('p' + this.team + '_health');
		}

		this.healthIndicatorText.setText(this.health.toString());
	}

	displayPlasmaShield(): void {
		this.healthIndicatorSprite.loadTexture('p' + this.team + '_plasma');
		this.healthIndicatorText.setText(this.player.plasma);
	}

	hint(text: string, cssClass?: string): void {
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

		let self: PhaserCreature = this;

		// Remove constant element
		this.hintGrp.forEach(
			(grpHintElem: any) => {
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
						// @ts-ignore is this a bug? where is this.destroy() defined
						grpHintElem.destroy();
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
				// @ts-ignore is this a bug? where is this.destroy() defined
				hint.destroy();
			}, hint);
		}

		this.hintGrp.add(hint);

		// Stacking
		this.hintGrp.forEach(
			(grpHintElem: any) => {
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

	die(killer: any): void {
		let game = this.game;

		game.log('%CreatureName' + this.id + '% is dead');

		this.dead = true;

		// Triggers
		game.onCreatureDeath(this);

		this.killer = killer.player;
		let isDeny = this.killer.flipped == this.player.flipped;

		// Drop item
		// @ts-ignore
		if (game.unitDrops == 1 && this.drop) {
			let offsetX = this.player.flipped ? this.x - this.size + 1 : this.x;
			/* All properties aside from `name` are assumed to be alterations to the creature's
			statistics. */
			const { name, ...alterations } = this.drop;
			new PhaserDrop(name, alterations, offsetX, this.y, game);
		}

		if (!game.firstKill && !isDeny) {
			// First Kill
			this.killer.score.push({
				type: 'firstKill',
			});
			game.firstKill = true;
		}

		if (this.isDarkPriest()) {
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

		if (this.isDarkPriest()) {
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

	xray(enable: boolean): void {
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
}
