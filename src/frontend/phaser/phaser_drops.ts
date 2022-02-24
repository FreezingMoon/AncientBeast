import { Drops } from '../drops';
import Game from '../../game';
import { Hex } from '../hex';
import Phaser from 'phaser-ce';

export class PhaserDrops extends Drops {
	name: any;
	game: Game;
	id: number;
	x: any;
	y: any;
	pos: Object;
	alterations: any;
	hex: Hex;
	display: Phaser.Sprite;

	constructor(name, alterations, x, y, game) {
		super(name, alterations, x, y, game);

		this.name = name;
		this.game = game;
		this.id = game.dropId++;
		this.x = x;
		this.y = y;
		this.pos = {
			x: x,
			y: y,
		};
		this.alterations = alterations;
		this.hex = game.grid.hexes[this.y][this.x];

		// this.hex.drop = this;

		this.display = game.grid.dropGroup.create(
			this.hex.displayPos.x + 54,
			this.hex.displayPos.y + 15,
			'drop_' + this.name,
		);
		this.display.alpha = 0;
		this.display.anchor.setTo(0.5, 0.5);
		this.display.scale.setTo(1.5, 1.5);
		game.Phaser.add
			.tween(this.display)
			.to(
				{
					alpha: 1,
				},
				500,
				Phaser.Easing.Linear.None,
			)
			.start();
	}

	pickup(creature): void {
		let game = this.game;

		game.log('%CreatureName' + creature.id + '% picks up ' + this.name);
		creature.hint(this.name, 'msg_effects');
		creature.dropCollection.push(this);

		creature.updateAlteration();

		this.hex.drop = undefined;

		if (this.alterations.health) {
			creature.heal(this.alterations.health, false, false);
		}

		if (this.alterations.energy) {
			creature.recharge(this.alterations.energy, false);
		}

		if (this.alterations.endurance) {
			creature.restoreEndurance(this.alterations.endurance, false);
		}

		if (this.alterations.movement) {
			creature.restoreMovement(this.alterations.movement, false);
		}

		// Log all the gained alterations.
		const gainedMessage = Object.keys(this.alterations)
			.map((key) => `${this.alterations[key]} ${key}`)
			.join(', ')
			// Replace last comma with "and".
			.replace(/, ([^,]*)$/, ', and $1');
		game.log(`%CreatureName${creature.id}% gains ${gainedMessage}`);

		creature.player.score.push({
			type: 'pickupDrop',
		});

		let tween = game.Phaser.add
			.tween(this.display)
			.to(
				{
					alpha: 0,
				},
				500,
				Phaser.Easing.Linear.None,
			)
			.start();

		tween.onComplete.add(() => {
			this.display.destroy();
		});
	}
}
