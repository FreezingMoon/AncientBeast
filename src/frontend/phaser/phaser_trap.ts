import { Trap } from '../trap';
import { Game } from '../../game';
import { Effect } from '../../effect';
import { PhaserHexGrid } from './phaser_hexgrid';
import Phaser from 'phaser-ce';
import { PhaserGame } from './phaser_game';

export class PhaserTrap extends Trap {
	phaser: Phaser;
	display: Phaser.Sprite;
	displayOver: Phaser.Sprite;
	typeOver: Phaser.Sprite;

	constructor(
		x: number,
		y: number,
		type: string,
		effects: Effect[],
		owner: string,
		opt: any,
		game: Game,
	) {
		super(x, y, type, effects, owner, opt, game);

		this.phaser = (game as PhaserGame).Phaser;

		let spriteName = 'trap_' + type;
		let pos = this.hex.originalDisplayPos;
		let grid = game.grid as PhaserHexGrid;

		this.display = grid.trapGroup.create(pos.x + this.hex.width / 2, pos.y + 60, spriteName);
		this.display.anchor.setTo(0.5);

		if (this.typeOver) {
			this.displayOver = grid.trapOverGroup.create(
				pos.x + this.hex.width / 2,
				pos.y + 60,
				spriteName,
			);
			this.displayOver.anchor.setTo(0.5);
			this.displayOver.scale.x *= -1;
		}
	}

	destroy(): void {
		let game = this.game as PhaserGame,
			tweenDuration = 500,
			destroySprite = (sprite: Phaser.Sprite, animation: string) => {
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

	hide(duration: number): void {
		duration = duration - 0; // Avoid undefined
		(this.game as PhaserGame).Phaser.add.tween(this.display).to(
			{
				alpha: 0,
			},
			duration,
			Phaser.Easing.Linear.None,
		);
	}

	show(duration: number): void {
		duration = duration - 0; // Avoid undefined
		(this.game as PhaserGame).Phaser.add.tween(this.display).to(
			{
				alpha: 1,
			},
			duration,
			Phaser.Easing.Linear.None,
		);
	}
}
