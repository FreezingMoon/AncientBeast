/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
import * as $j from 'jquery';
import { Create } from 'phaser-ce';
import { Creature } from './creature';
import { Effect } from './effect';
import Game from './game';

/* Damage Class
 *
 * TODO: This documentation needs to be updated with things that are determined dynamically like #melee and #counter
 */
export class Damage {
	/* Constructor */
	game: Game; //Main Game Object
	attacker: Creature; //Creature that initiated the damage
	damages: object; //Object containing the damage by tyoe { frost : 5} for example
	status: string; //Current Effects the damage applies
	effects: Array<Effect>; //Current Effects the damage applies
	area: number; //Number of hexagons being hit
	// eslint-disable-next-line prettier/prettier
	counter: boolean //Whether this is counter-damage
	target: Creature; //Creature that is being targetted by effect

	constructor(
		attacker: Creature,
		damages: object,
		area: number,
		effects: Array<Effect>,
		game: Game,
	) {
		this.game = game;
		this.attacker = attacker;
		this.damages = damages;
		this.status = '';
		this.effects = effects;
		this.area = area;
		this.counter = false;
	}

	/* applyDamage()
	 */
	applyDamage() {
		let trg = this.target.stats,
			atk = this.attacker.stats,
			returnObj = {
				total: 0,
			};

		// Damage calculation
		$j.each(this.damages, (key: number | string, value) => {
			let points: number;

			if (key == 'pure') {
				// Bypass defense calculation
				points = value;
			} else {
				points = Math.round(
					value * (1 + (atk.offense - trg.defense / this.area + atk[key] - trg[key]) / 100),
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
							' )/100)',
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
