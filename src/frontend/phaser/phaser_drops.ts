import { Drop } from '../drops';
import Game from '../../game';
import { PhaserHexGrid } from './phaser_hexgrid';
import Phaser from 'phaser-ce';
import { Creature } from '../creature';

export class PhaserDrop extends Drop {
	display: Phaser.Sprite;

	constructor(name: string, alterations: any, x: number, y: number, game: Game) {
		super(name, alterations, x, y, game);

		this.display = (game.grid as PhaserHexGrid).dropGroup.create(
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

	pickup(creature: Creature): void {
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
