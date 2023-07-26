import { Creature } from './creature';

export class CreatureQueue {
	private _getCreatures: () => Creature[];

	constructor(getCreatures: () => Creature[]) {
		this._getCreatures = getCreatures;
	}

	get queue() {
		const creatures = this._getCreatures().filter((c) => c.isInCurrentQueue);
		const undelayed = creatures
			.filter((c) => !c.isDelayed)
			.sort((a, b) => b.getInitiative() - a.getInitiative());
		const delayed = creatures
			.filter((c) => c.isDelayed)
			.sort((a, b) => b.getInitiative() - a.getInitiative());
		return [].concat(undelayed, delayed);
	}

	get nextQueue() {
		const creatures = this._getCreatures().filter((c) => c.isInNextQueue);
		const undelayed = creatures
			.filter((c) => !c.isDelayedInNextQueue)
			.sort((a, b) => b.getInitiative() - a.getInitiative());
		const delayed = creatures
			.filter((c) => c.isDelayedInNextQueue)
			.sort((a, b) => b.getInitiative() - a.getInitiative());
		return [].concat(undelayed, delayed);
	}

	isCurrentEmpty() {
		return this.getCurrentQueueLength() === 0;
	}

	getCurrentQueueLength() {
		return this._getCreatures().filter((c) => c.isInCurrentQueue).length;
	}
}
