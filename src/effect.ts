import { Creature } from './creature';
import Game from './game';
import { Hex } from './utility/hex';

/*
 * Effect Class
 */

type EffectOwner = Creature | Hex;
type EffectTarget = Creature | Hex;

type Damage = number;
type EffectFnArg = Creature | Hex | Damage;

type EffectOptions = Partial<Effect>;

export class Effect {
	id: number;
	game: Game;
	name: string;
	owner: EffectOwner;
	target: EffectTarget;
	trigger: string;
	creationTurn: number;

	// NOTE: These "optional arguments" generally set via "optArgs" in the constructor.
	effectFn: (effect?: Effect, creatureHexOrDamage?: EffectFnArg) => void = () => {};
	requireFn: (arg?: any) => boolean = (arg?: any) => true;
	alterations: { [key: string]: any } = {};
	turnLifetime = 0;
	deleteTrigger = 'onStartOfRound';
	stackable = true;
	specialHint: string | undefined = undefined; // Special hint for log
	deleteOnOwnerDeath = false;

	// TODO: This is *very* similar to owner, though owner can be a hex
	// Very few abilities use this field – they have access to ability.creature
	// Refactor to remove.
	attacker: Creature | undefined = undefined;

	/* Constructor(name, owner, target, trigger, optArgs)
	 *
	 * name: name of the effect
	 * owner :	Creature : Creature that casted the effect
	 * target :	Object : Creature or Hex : the object that possess the effect
	 * trigger :	String : Event that trigger the effect
	 * optArgs: dictionary of optional arguments
	 */
	constructor(
		name: string,
		owner: EffectOwner,
		target: EffectTarget,
		trigger: string,
		optArgs: EffectOptions,
		game: Game,
	) {
		this.id = game.effectId++;
		this.game = game;

		this.name = name;
		this.owner = owner;
		this.target = target;
		this.trigger = trigger;
		this.creationTurn = game.turn;

		for (const key of Object.keys(optArgs)) {
			if (key in this) {
				this[key] = optArgs[key];
			}
		}

		game.effects.push(this);
	}

	animation(...args) {
		if (args) {
			this.activate(...args);
		} else {
			this.activate();
		}
	}

	activate(arg?: any) {
		if (!this.requireFn(arg)) {
			return false;
		}

		if (arg instanceof Creature) {
			arg.addEffect(this);
		}

		this.effectFn(this, arg);
	}

	deleteEffect() {
		if ('effects' in this.target) {
			const targetIdx = this.target.effects.indexOf(this);
			if (this.target.effects[targetIdx]) {
				this.target.effects.splice(targetIdx, 1);
			} else {
				console.warn('Failed to find effect on target.', this);
			}
		}

		const gameIdx = this.game.effects.indexOf(this);
		if (this.game.effects[gameIdx]) {
			this.game.effects.splice(gameIdx, 1);
		} else {
			console.warn('Failed to find effect on game.', this);
		}

		if ('updateAlteration' in this.target) {
			this.target.updateAlteration();
		}
	}
}
