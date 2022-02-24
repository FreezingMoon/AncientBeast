import { TrapI } from "../trapI";
import * as $j from 'jquery';
import Game from "../../game";
import { Hex } from '../hex';
import { Effect } from "../../effect";
import Phaser from 'phaser-ce';

export class PhaserTrap implements TrapI{
    game: Game;
    phaser: Phaser;
    hex: Hex;
    type: String;
    effects: Effect[];
    owner: String;
    creationTurn: number;
    destroyOnActivate: boolean;
    id: any;
    display: any;
    displayOver: any;
    typeOver: any;
    destroyAnimation: any;

    constructor(x, y, type, effects, owner, opt, game) {
		this.game = game;
		this.hex = game.grid.hexes[y][x];
		this.type = type;
		this.effects = effects;
		this.owner = owner;
		this.creationTurn = game.turn;
		this.destroyOnActivate = false;
        this.phaser = game.Phaser;

		const o = {
			turnLifetime: 0,
			fullTurnLifetime: false,
			ownerCreature: undefined, // Needed for fullTurnLifetime
			destroyOnActivate: false,
			typeOver: undefined,
			destroyAnimation: undefined,
		};

		$j.extend(this, o, opt);

		// Register
		game.grid.traps.push(this);
		this.id = game.trapId++;
		this.hex.trap = this;

		for (let i = this.effects.length - 1; i >= 0; i--) {
			// @ts-ignore
			this.effects[i].trap = this;
		}

		let spriteName = 'trap_' + type;
		let pos = this.hex.originalDisplayPos;

		this.display = game.grid.trapGroup.create(pos.x + this.hex.width / 2, pos.y + 60, spriteName);
		this.display.anchor.setTo(0.5);

		if (this.typeOver) {
			this.displayOver = game.grid.trapOverGroup.create(
				pos.x + this.hex.width / 2,
				pos.y + 60,
				spriteName,
			);
			this.displayOver.anchor.setTo(0.5);
			this.displayOver.scale.x *= -1;
		}
	}

    destroy(): void {
        let game = this.game,
			tweenDuration = 500,
			destroySprite = (sprite, animation) => {
				if (animation === 'shrinkDown') {
					sprite.anchor.y = 1;
					sprite.y += sprite.height / 2;

					let tween = game.Phaser.add
						.tween(sprite.scale)
						.to(
							{
								y: 0,
							},
							tweenDuration,
							Phaser.Easing.Linear.None,
						)
						.start();
					tween.onComplete.add(() => {
						sprite.destroy();
					}, sprite);
				} else {
					sprite.destroy();
				}
			};

		destroySprite(this.display, this.destroyAnimation);
		if (this.displayOver) {
			destroySprite(this.displayOver, this.destroyAnimation);
		}

		// Unregister
		let i = game.grid.traps.indexOf(this);
		game.grid.traps.splice(i, 1);
		this.hex.trap = undefined;
    }

    hide(duration) {
		duration = duration - 0; // Avoid undefined
		this.game.Phaser.add.tween(this.display).to(
			{
				alpha: 0,
			},
			duration,
			Phaser.Easing.Linear.None,
		);
	}

	show(duration) {
		duration = duration - 0; // Avoid undefined
		this.game.Phaser.add.tween(this.display).to(
			{
				alpha: 1,
			},
			duration,
			Phaser.Easing.Linear.None,
		);
	}

}
