/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as $j from 'jquery';
import Game from './game';
import { Creature } from './creature';
import { Trap } from './utility/trap';

/*
 * Effect Class
 */
export class Effect {
	/* Constructor(name, owner, target, trigger, optArgs)
	 *
	 * optArgs: dictionary of optional arguments
	 */
	stackable: boolean; //Check if an effect can be stacked
	id: number; //ID of each effect on the stack
	game: Game; //The current game
	name: string; //Name of the Effect
	owner: Creature; //The creature that cast the effect
	target: Creature; //The object that has the effect
	trigger: string; //Event that triggered the effect
	creationTurn: number; //The turn the effect took place
	noLog: boolean; //Check if the action needs to logged to game chat
	specialHint: any; //TODO: Find specialHint useCase maybe string
	deleteOnOwnerDeath: boolean; //Should this creature be removed when the owner of it dies
	triggeredThisChain: boolean; //Did this effect start with the current chain
	trap: Trap;
	special: any;

	turnLifetime: number; //How many turns this effect lasts
	deleteTrigger: string; //If the effect was altered and can remove it

	constructor(
		name: string,
		owner: Creature,
		target: Creature,
		trigger: string,
		optArgs,
		game: Game,
	) {
		this.id = game.effectId++;
		this.game = game;

		this.name = name;
		this.owner = owner;
		this.target = target;
		this.trigger = trigger;
		this.creationTurn = game.turn;

		const args = $j.extend(
			{
				// Default Arguments
				requireFn: function () {
					return true;
				},
				effectFn: function () {},
				alterations: {},
				turnLifetime: 0,
				deleteTrigger: 'onStartOfRound',
				stackable: true,
				noLog: false,
				specialHint: undefined, // Special hint for log
				deleteOnOwnerDeath: false,
			},
			optArgs,
		);

		$j.extend(this, args);

		game.effects.push(this);
	}

	animation(args) {
		this.activate(args);
	}

	activate(arg) {
		if (!this.requireFn(arg)) {
			return false;
		}

		if (!this.noLog) {
			console.log('Effect ' + this.name + ' triggered');
		}

		if (arg instanceof Creature) {
			arg.addEffect(this, null, null);
		}

		this.effectFn(this, arg);
	}

	requireFn(arg): boolean {
		if (arg) {
			return true;
		}
		return false;
	}

	effectFn(Player, arg) {
		//Uknown Effect
	}

	deleteEffect() {
		const targetIdx = this.target.effects.indexOf(this);
		if (this.target.effects[targetIdx]) {
			this.target.effects.splice(targetIdx, 1);
		} else {
			console.warn('Failed to find effect on target.', this);
		}

		const gameIdx = this.game.effects.indexOf(this);
		if (this.game.effects[gameIdx]) {
			this.game.effects.splice(gameIdx, 1);
		} else {
			console.warn('Failed to find effect on game.', this);
		}

		this.target.updateAlteration();
	}
}
