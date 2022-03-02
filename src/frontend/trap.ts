import $j from 'jquery';
import { Game } from '../game';
import { Hex } from './hex';
import { Effect } from '../effect';
import { Creature } from './creature';

export abstract class Trap {
	game: Game;
	hex: Hex;
	type: string;
	effects: Effect[];
	owner: string;
	creationTurn: number;
	destroyOnActivate: boolean;
	id: number;
	destroyAnimation: string;

	turnLifetime: number;
	fullTurnLifetime: number;
	ownerCreature: Creature;

	constructor(
		x: number,
		y: number,
		type: string,
		effects: Effect[],
		owner: string,
		opt: any,
		game: Game,
	) {
		this.game = game;
		this.hex = game.grid.hexes[y][x];
		this.type = type;
		this.effects = effects;
		this.owner = owner;
		this.creationTurn = game.turn;
		this.destroyOnActivate = false;

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
	}

	abstract destroy(): void;
	abstract hide(duration: number): void;
	abstract show(duration: number): void;
}
