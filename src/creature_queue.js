import * as arrayUtils from './utility/arrayUtils';

export class CreatureQueue {
	constructor(game) {
		this.game = game;
		this.queue = [];
		this.nextQueue = [];
		this.tempCreature = {};
	}

	/**
	 * Add a creature to the next turn's queue by initiative, and optionally the current
	 * turn's queue.
	 *
	 * @param {Creature} creature The creature to add.
	 * @param {boolean} alsoAddToCurrentQueue Also add the creature to the current
	 * turn's queue. Doing so lets a creature act in the same turn it was summoned.
	 */
	addByInitiative(creature, alsoAddToCurrentQueue = true) {
		const queues = [this.nextQueue];

		if (alsoAddToCurrentQueue) {
			queues.push(this.queue);
		}

		queues.forEach((queue) => {
			for (let i = 0; i < queue.length; i++) {
				let queueItem = queue[i];

				if (queueItem.delayed || queueItem.getInitiative() < creature.getInitiative()) {
					queue.splice(i, 0, creature);
					return;
				}
			}

			queue.push(creature);
		});
	}

	dequeue() {
		return this.queue.splice(0, 1)[0];
	}

	remove(creature) {
		arrayUtils.removePos(this.queue, creature);
		arrayUtils.removePos(this.nextQueue, creature);
	}

	// Removes temporary Creature from queue
	removeTempCreature() {
		this.remove(this.tempCreature);
	}

	nextRound() {
		// Copy next queue into current queue
		this.queue = this.nextQueue.slice(0);
		// Sort next queue by initiative (current queue may be reordered) descending
		this.nextQueue = this.nextQueue.sort((a, b) => b.getInitiative() - a.getInitiative());
	}

	isCurrentEmpty() {
		return this.queue.length === 0;
	}

	isNextEmpty() {
		return this.nextQueue.length === 0;
	}

	delay(creature) {
		// Find out if the creature is in the current queue or next queue; remove
		// it from the queue and replace it at the end
		let game = this.game,
			inQueue = arrayUtils.removePos(this.queue, creature) || creature === game.activeCreature,
			queue = this.queue;

		if (!inQueue) {
			queue = this.nextQueue;
			arrayUtils.removePos(this.nextQueue, creature);
		}
		// Move creature to end of queue but in order w.r.t. other delayed creatures
		for (let i = 0, len = queue.length; i < len; i++) {
			if (!queue[i].delayed) {
				continue;
			}

			if (queue[i].getInitiative() < creature.getInitiative()) {
				queue.splice(i, 0, creature);
				return;
			}
		}

		queue.push(creature);
	}
}
