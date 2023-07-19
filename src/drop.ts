import { Creature } from './creature';
import Game from './game';
import { HEX_HEIGHT_PX, HEX_WIDTH_PX, offsetCoordsToPx } from './utility/const';
import { Point, getPointFacade } from './utility/pointfacade';

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
export type DropDefinition = {
	name: string;
	energy?: number;
	movement?: number;
	health?: number;
	poison?: number;
	initiative?: number;
	frost?: number;
	meditation?: number;
	burn?: number;
	offense?: number;
	defense?: number;
	mental?: number;
	endurance?: number;
	shock?: number;
	regrowth?: number;
	pierce?: number;
	slash?: number;
	crush?: number;
	sonic?: number;
};

export type DropAlterations = Omit<DropDefinition, 'name'>;

export class Drop {
	id: number;
	name: string;
	game: Game;
	pos: Point;
	alterations: DropAlterations;

	display: Phaser.Sprite;

	constructor(name: string, alterations: DropAlterations, x: number, y: number, game: Game) {
		this.id = game.dropId++;
		this.name = name;
		this.game = game;
		this.pos = {
			x: x,
			y: y,
		};
		this.alterations = alterations;

		getPointFacade()
			.getDropsAt(this)
			.forEach((drop) => drop.destroy());
		this.game.drops.push(this);

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

	pickup(creature: Creature) {
		const game = this.game;
		const alterations = this.alterations;

		game.log('%CreatureName' + creature.id + '% picks up ' + this.name + ':');
		creature.hint(this.name, 'msg_effects');
		creature.dropCollection.push(this);

		creature.updateAlteration();

		if (alterations.health) {
			creature.heal(alterations.health, false, false);
		}

		if (alterations.energy) {
			creature.recharge(alterations.energy, false);
		}

		if (alterations.endurance) {
			creature.restoreEndurance(alterations.endurance, false);
		}

		if (alterations.movement) {
			creature.restoreMovement(alterations.movement, false);
		}

		// NOTE: Log all the gained alterations.
		const gainedMessage = Object.keys(alterations)
			.map((key) => `${alterations[key]} ${key}`)
			.join(', ')
			// Replace last comma with "and"
			.replace(/, ([^,]*)$/, ' and $1');
		game.log(`Gains ${gainedMessage}`);

		creature.player.score.push({
			type: 'pickupDrop',
		});

		this.pickupAnimAndDestroy();
	}

	pickupAnimAndDestroy() {
		this.display.destroy();
		const tween = this.game.Phaser.add
			.tween(this.display)
			.to({ alpha: 0, x: 400 }, 500, Phaser.Easing.Linear.None)
			.start();

		tween.onComplete.add(() => {
			this.display.destroy();
			this.destroy();
		});
	}

	destroy() {
		this.display?.destroy();
		this.game.drops = this.game.drops.filter((drop) => drop !== this);
	}

	get x() {
		return this.pos.x;
	}

	set x(x: number) {
		this.pos.x = x;
	}

	get y() {
		return this.pos.y;
	}

	set y(y: number) {
		this.pos.y = y;
	}

	/**
	 * @deprecated Use game.hexAt(x, y);
	 */
	get hex() {
		return this.game.hexAt(this.x, this.y);
	}
}
