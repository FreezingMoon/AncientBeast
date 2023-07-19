import Game from '../game';
import { Effect } from '../effect';
import { Hex } from './hex';
import { Player } from '../player';
import { Creature } from '../creature';
import { capitalize } from './string';
import { getPointFacade } from './pointfacade';
import { HEX_WIDTH_PX, offsetCoordsToPx } from './const';

export type DestroyAnimationType = 'shrinkDown' | 'none';

export type TrapOptions = Partial<Trap>;

export class Trap {
	id: number;
	x: number;
	y: number;
	game: Game;
	type: string;
	name: string;
	effects: Effect[];
	owner: Player;
	creationTurn: number;

	/**
	 * NOTE: The following attributes are typically set in the
	 * constructor using the "opt" argument.
	 */
	turnLifetime = 0;
	fullTurnLifetime = false;
	ownerCreature: Creature | undefined = undefined; // Needed for fullTurnLifetime
	destroyOnActivate = false;
	typeOver = false;
	destroyAnimation: DestroyAnimationType = 'none';

	//
	display: Phaser.Sprite;
	displayOver: Phaser.Sprite;

	constructor(
		x: number,
		y: number,
		type: string,
		effects: Effect[],
		owner: Player,
		opt: TrapOptions | undefined,
		game: Game,
		name = '',
	) {
		this.game = game;
		this.type = type;
		this.x = x;
		this.y = y;
		this.name = name || capitalize(type.split('-').join(' '));
		this.effects = effects;
		this.owner = owner;
		this.creationTurn = game.turn;

		if (opt) {
			for (const key of Object.keys(opt)) {
				if (key in this) {
					this[key] = opt[key];
				}
			}
		}

		this.id = game.trapId++;

		// NOTE: Destroy any traps here.
		getPointFacade()
			.getTrapsAt(this)
			.forEach((trap) => trap.destroy());
		game.traps.push(this);

		for (let i = this.effects.length - 1; i >= 0; i--) {
			this.effects[i].trap = this;
		}

		const spriteName = 'trap_' + type;
		const px = offsetCoordsToPx(this);
		this.display = game.grid.trapGroup.create(px.x + HEX_WIDTH_PX / 2, px.y + 60, spriteName);
		this.display.anchor.setTo(0.5);

		if (this.typeOver) {
			this.displayOver = game.grid.trapOverGroup.create(
				px.x + HEX_WIDTH_PX / 2,
				px.y + 60,
				spriteName,
			);
			this.displayOver.anchor.setTo(0.5);
			this.displayOver.scale.x *= -1;
		}
	}

	/**
	 * @deprecated: Use this.game.hexAt(x, y)
	 */
	get hex(): Hex {
		return this.game.hexAt(this.x, this.y);
	}

	activate(trigger: RegExp, target: Creature | Hex) {
		this.effects.forEach((effect) => {
			if (trigger.test(effect.trigger) && effect.requireFn()) {
				this.game.log('Trap triggered');
				effect.activate(target);
			}
		});

		if (this.destroyOnActivate) {
			this.destroy();
		}
	}

	destroy() {
		const game = this.game;
		const phaser: Phaser.Game = game.Phaser;
		const tweenDuration = 500;

		const destroySprite = (sprite: Phaser.Sprite, animation: string) => {
			if (animation === 'shrinkDown') {
				sprite.anchor.y = 1;
				sprite.y += sprite.height / 2;

				const tween = phaser.add
					.tween(sprite.scale)
					.to({ y: 0 }, tweenDuration, Phaser.Easing.Linear.None)
					.start();
				tween.onComplete.add(() => sprite.destroy());
			} else {
				sprite.destroy();
			}
		};

		destroySprite(this.display, this.destroyAnimation);
		if (this.displayOver) {
			destroySprite(this.displayOver, this.destroyAnimation);
		}

		game.traps = game.traps.filter((trap) => trap !== this);
	}

	hide(duration = 0) {
		this.game.Phaser.add.tween(this.display).to({ alpha: 0 }, duration, Phaser.Easing.Linear.None);
	}

	show(duration = 0) {
		this.game.Phaser.add.tween(this.display).to({ alpha: 1 }, duration, Phaser.Easing.Linear.None);
	}
}
