import Game from './game';
import { Creature } from './creature';
import * as arrayUtils from './utility/arrayUtils';

export class CreatureQueue {
	game: Game;
	queue: Creature[];
	nextQueue: Creature[];
	tempCreature: Creature | Record<string, never>;

	constructor(game: Game) {
		this.game = game;
		this.queue = [];
		this.nextQueue = [];
		this.tempCreature = {};
	}

	/**
	 * @deprecated Use update()
	 */
	addByInitiative(creature: Creature, alsoAddToCurrentQueue = true) {
		this._updateQueues();
	}

	/**
	 * @deprecated Use update()
	 */
	remove(creature: Creature) {
		this._updateQueues();
	}

	/**
	 * @deprecated Use update()
	 */
	removeTempCreature() {
		this._updateQueues();
	}

	/**
	 * @deprecated Use update()
	 */
	nextRound() {
		this._updateQueues();
	}

	isCurrentEmpty() {
		this._updateQueues();
		return this.queue.length === 0;
	}

	isNextEmpty() {
		return this.nextQueue.length === 0;
	}

	/**
	 * @deprecated Use update()
	 */
	delay(creature: Creature) {
		this._updateQueues();
	}

	update() {
		this._updateQueues();
	}

	private _updateQueues() {
		this._updateCurrentQueue();
		this._updateNextQueue();
	}

	private _updateCurrentQueue() {
		const creatures = this.game.creatures.filter((c) => c.isInCurrentQueue);
		const undelayed = creatures
			.filter((c) => !c.isDelayed)
			.sort((a, b) => b.getInitiative() - a.getInitiative());
		const delayed = creatures
			.filter((c) => c.isDelayed)
			.sort((a, b) => b.getInitiative() - a.getInitiative());
		this.queue = [].concat(undelayed, delayed);
	}

	private _updateNextQueue() {
		const creatures = this.game.creatures.filter((c) => c.isInNextQueue);
		const undelayed = creatures
			.filter((c) => !c.isDelayedInNextQueue)
			.sort((a, b) => b.getInitiative() - a.getInitiative());
		const delayed = creatures
			.filter((c) => c.isDelayedInNextQueue)
			.sort((a, b) => b.getInitiative() - a.getInitiative());
		this.nextQueue = [].concat(undelayed, delayed);
	}
}
