/**
 * Drops are a type of creature "buff" collected from a game board hex rather than
 * being applied by an ability.
 *
 * For "pool" resources such as health and energy, the buff restores those resources
 * as well as increasing their maximum values.
 *
 * Each creature has a unique Drop that is added to their location hex when they
 * die.
 *
 * Another creature entering the same hex as the Drop can pick it up, altering its
 * stats (alterations) and/or restoring health/energy.
 *
 * Other rules:
 * - Multiple Drops can stack on a single creature, either the same Drop multiple
 *   times or different Drops from multiple creatures.
 * - Drops currently do NOT expire.
 * - Drops currently cannot be removed by other abilities.
 * - Drops are essentially permanent although this may change in the future.
 */
export class Drop {
	constructor(name, alterations, x, y, game) {
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

		this.hex.drop = this;

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

	pickup(creature) {
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
