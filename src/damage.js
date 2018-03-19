import * as $j from 'jquery';

/*
 * Damage Class
 *
 * TODO: This documentation needs to be updated with things that are determined dynamically like #melee and #counter
 */
export class Damage {
	/**
	 * attacker : Creature : Unit that initiated the damage
	 * damages : Object : Object containing the damage by type {frost : 5} for example
	 * area : Integer : Number of hexagons being hit
	 * effects : Array : Contains Effect object to apply to the target
	 */
	constructor(attacker, damages, area, effects, game) {
		this.game = game;
		this.attacker = attacker;
		this.damages = damages;
		this.status = '';
		this.effects = effects;
		this.area = area;
		// Whether this is counter-damage
		this.counter = false;
	}

	/* applyDamage()
	 */
	applyDamage() {
		let trg = this.target.stats,
			atk = this.attacker.stats,
			returnObj = {
				total: 0
			};

		// Damage calculation
		$j.each(this.damages, (key, value) => {
			let points;

			if (key == 'pure') {
				// Bypass defense calculation
				points = value;
			} else {
				points = Math.round(
					value * (1 + (atk.offense - trg.defense / this.area + atk[key] - trg[key]) / 100)
				);
				// For debugging purposes
				if (this.game.debugMode) {
					console.log(
						'damage = ' +
							value +
							key +
							'dmg * (1 + (' +
							atk.offense +
							'atkoffense - ' +
							trg.defense +
							'trgdefense / ' +
							this.area +
							'area + ' +
							atk[key] +
							'atk' +
							key +
							' - ' +
							trg[key] +
							'trg' +
							key +
							' )/100)'
					);
				}
			}

			returnObj[key] = points;
			returnObj.total += points;
		});

		returnObj.total = Math.max(returnObj.total, 1); // Minimum of 1 damage

		return returnObj;
	}
}
