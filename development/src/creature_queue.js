var CreatureQueue = Class.create({
	initialize: function() {
		this.queue = [];
		this.nextQueue = [];
	},

	/**
	 * Add a creature to the next turn's queue by initiative
	 * @param {Creature} creature - The creature to add
	 */
	addByInitiative: function(creature) {
		for (var i = 0; i < this.nextQueue.length; i++) {
			if (this.nextQueue[i].delayed ||
					this.nextQueue[i].getInitiative() < creature.getInitiative()) {
				this.nextQueue.splice(i, 0, creature);
				return;
			}
		}
		this.nextQueue.push(creature);
	},
	dequeue: function() {
		return this.queue.splice(0, 1)[0];
	},
	remove: function(creature) {
		this.queue.removePos(creature);
		this.nextQueue.removePos(creature);
	},
	nextRound: function() {
		// Copy next queue into current queue
		this.queue = this.nextQueue.slice(0);
		// Sort next queue by initiative (current queue may be reordered)
		this.nextQueue = this.nextQueue.sort(function(a, b) {
			// Sort by initiative descending
			return b.getInitiative() - a.getInitiative();
		});
	},
	isCurrentEmpty: function() {
		return this.queue.length === 0;
	},
	isNextEmpty: function() {
		return this.nextQueue.length === 0;
	},
	delay: function(creature) {
		// Find out if the creature is in the current queue or next queue; remove
		// it from the queue and replace it at the end
		var inQueue = this.queue.removePos(creature) || creature === G.activeCreature;
		var queue = this.queue;
		if (!inQueue) {
			queue = this.nextQueue;
			this.nextQueue.removePos(creature);
		}
		// Move creature to end of queue but in order w.r.t. other delayed creatures
		for (var i = 0; i < queue.length; i++) {
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
});
