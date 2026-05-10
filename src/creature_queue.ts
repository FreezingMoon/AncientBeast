import { Creature } from './creature';

type QueueCreature = Creature & { hideFromQueue?: boolean };

export class CreatureQueue {
	private _getCreatures: () => Creature[];

	constructor(getCreatures: () => Creature[]) {
		this._getCreatures = getCreatures;
	}

	get queue() {
		const creatures = this._getCreatures().filter(
			(c) => c?.isInCurrentQueue && !(c as QueueCreature)?.hideFromQueue,
		);
		const undelayed = creatures
			.filter((c) => c && !c.isDelayed)
			.sort((a, b) => b.getInitiative() - a.getInitiative());
		const delayed = creatures
			.filter((c) => c && c.isDelayed)
			.sort((a, b) => b.getInitiative() - a.getInitiative());
		return [].concat(undelayed, delayed);
	}

	get nextQueue() {
		const creatures = this._getCreatures().filter(
			(c) => c?.isInNextQueue && !(c as QueueCreature)?.hideFromQueue,
		);
		const undelayed = creatures
			.filter((c) => c && !c.isDelayedInNextQueue)
			.sort((a, b) => b.getInitiative() - a.getInitiative());
		const delayed = creatures
			.filter((c) => c && c.isDelayedInNextQueue)
			.sort((a, b) => b.getInitiative() - a.getInitiative());
		return [].concat(undelayed, delayed);
	}

	isCurrentEmpty() {
		return this.getCurrentQueueLength() === 0;
	}

	getCurrentQueueLength() {
		return this._getCreatures().filter(
			(c) => c?.isInCurrentQueue && !(c as QueueCreature)?.hideFromQueue,
		).length;
	}
}
