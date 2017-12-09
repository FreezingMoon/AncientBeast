export class Drop {
	constructor(name, health, energy, x, y, game) {
		this.name = name;
		this.game = game;
		this.id = game.dropId++;
		this.x = x;
		this.y = y;
		this.pos = {
			x: x,
			y: y
		};
		this.health = health;
		this.energy = energy;
		this.hex = game.grid.hexes[this.y][this.x];

		this.hex.drop = this;

		this.display = game.grid.dropGroup.create(this.hex.displayPos.x + 54, this.hex.displayPos.y + 15, 'drop_' + this.name);
		this.display.alpha = 0;
		this.display.anchor.setTo(.5, .5);
		this.display.scale.setTo(1.5, 1.5);
		game.Phaser.add.tween(this.display).to({
			alpha: 1
		}, 500, Phaser.Easing.Linear.None).start();
	}

	pickup(creature) {
		let game = this.game;

		game.log("%CreatureName" + creature.id + "% picks up " + this.name);
		creature.hint(this.name, "msg_effects");
		creature.dropCollection.push(this);

		creature.updateAlteration();

		this.hex.drop = undefined;

		if (this.health) {
			creature.heal(this.health);
			game.log("%CreatureName" + creature.id + "% gains " + this.health + " health");
		}

		if (this.energy) {
			creature.energy += this.energy;
			game.log("%CreatureName" + creature.id + "% gains " + this.energy + " energy");
		}
		creature.player.score.push({
		    type: "pickupDrop"
		});

		creature.updateAlteration(); // Will cap the stats

		let drop = this,
			tween = game.Phaser.add.tween(this.display).to({
				alpha: 0
			}, 500, Phaser.Easing.Linear.None).start();

		tween.onComplete.add(function() {
			drop.display.destroy();
		});
	}
}
