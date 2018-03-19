import * as $j from 'jquery';
import { Creature } from './creature';

/*
 * Effect Class
 */
export class Effect {
	/* Constructor(name, owner, target, trigger, optArgs)
	 *
	 * name: name of the effect
	 * owner :	Creature : Creature that casted the effect
	 * target :	Object : Creature or Hex : the object that possess the effect
	 * trigger :	String : Event that trigger the effect
	 * optArgs: dictionary of optional arguments
	 */
	constructor(name, owner, target, trigger, optArgs, game) {
		this.id = game.effectId++;
		this.game = game;

		this.name = name;
		this.owner = owner;
		this.target = target;
		this.trigger = trigger;
		this.creationTurn = game.turn;

		let args = $j.extend(
			{
				// Default Arguments
				requireFn: function() {
					return true;
				},
				effectFn: function() {},
				alterations: {},
				turnLifetime: 0,
				deleteTrigger: 'onStartOfRound',
				stackable: true,
				noLog: false,
				specialHint: undefined, // Special hint for log
				deleteOnOwnerDeath: false
			},
			optArgs
		);

		$j.extend(this, args);

		game.effects.push(this);
	}

	animation() {
		this.activate.apply(this, arguments);
	}

	activate(arg) {
		if (!this.requireFn(arg)) {
			return false;
		}

		if (!this.noLog) {
			console.log('Effect ' + this.name + ' triggered');
		}

		if (arg instanceof Creature) {
			arg.addEffect(this);
		}

		this.effectFn(this, arg);
	}

	deleteEffect() {
		let i = this.target.effects.indexOf(this),
			game = this.game;

		this.target.effects.splice(i, 1);
		i = game.effects.indexOf(this);
		game.effects.splice(i, 1);
		this.target.updateAlteration();
		console.log('Effect ' + this.name + ' deleted');
	}
}
