/**
 * Drops are a type of creature "buff" collected from a game board hex rather than
 * being applied by an ability.
 *
 * Each creature has a unique Drop that is added to their location hex when they
 * die.
 *
 * Another creature entering the same hex as the Drop can pick it up, altering its
 * stats (alterations) and/or restoring health/energy.
 *
 * Multiple Drops can stack on a single creature, either the same Drop multiple
 * times or different Drops from multiple creatures.
 *
 * Other rules:
 * - Drops currently do NOT expire.
 * - Drops currently cannot be removed by other abilities.
 * - Drops are essentially permanent although this may change in the future.
 */
export class Drop {
	/**
	 *
	 * @param {*} name
	 * @param {*} health
	 * @param {*} energy
	 * @param {*} alterations
	 * @param {*} x
	 * @param {*} y
	 * @param {*} game
	 */
	constructor(name, health, energy, alterations, x, y, game) {
		this.name = name;
		this.game = game;
		this.id = game.dropId++;
		this.x = x;
		this.y = y;
		this.pos = {
			x: x,
			y: y,
		};
		this.health = health;
		this.energy = energy;
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

		if (this.health) {
			creature.heal(this.health);
			game.log('%CreatureName' + creature.id + '% gains ' + this.health + ' health');
		}

		if (this.energy) {
			creature.energy += this.energy;
			game.log('%CreatureName' + creature.id + '% gains ' + this.energy + ' energy');
		}
		creature.player.score.push({
			type: 'pickupDrop',
		});

		creature.updateAlteration(); // Will cap the stats

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
