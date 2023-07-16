import { Creature } from './creature';

export class CreatureQueue {
	private _getCreatures: () => Creature[];
	queue: Creature[];
	nextQueue: Creature[];

	constructor(getCreatures: () => Creature[]) {
		this._getCreatures = getCreatures;
		this.queue = [];
		this.nextQueue = [];
	}

	isCurrentEmpty() {
		return this.getCurrentQueueLength() === 0;
	}

	getCurrentQueueLength() {
		return this._getCreatures().filter((c) => c.isInCurrentQueue).length;
	}

	update() {
		this._updateQueues();
	}

	private _updateQueues() {
		this._updateCurrentQueue();
		this._updateNextQueue();
	}

	private _updateCurrentQueue() {
		const creatures = this._getCreatures().filter((c) => c.isInCurrentQueue);
		const undelayed = creatures
			.filter((c) => !c.isDelayed)
			.sort((a, b) => b.getInitiative() - a.getInitiative());
		const delayed = creatures
			.filter((c) => c.isDelayed)
			.sort((a, b) => b.getInitiative() - a.getInitiative());
		this.queue = [].concat(undelayed, delayed);
	}

	private _updateNextQueue() {
		const creatures = this._getCreatures().filter((c) => c.isInNextQueue);
		const undelayed = creatures
			.filter((c) => !c.isDelayedInNextQueue)
			.sort((a, b) => b.getInitiative() - a.getInitiative());
		const delayed = creatures
			.filter((c) => c.isDelayedInNextQueue)
			.sort((a, b) => b.getInitiative() - a.getInitiative());
		this.nextQueue = [].concat(undelayed, delayed);
	}
}
