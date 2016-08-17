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
		this.queue = this.nextQueue.slice(0);
	},
	isCurrentEmpty: function() {
		return this.queue.length === 0;
	},
	isNextEmpty: function() {
		return this.nextQueue.length === 0;
	},
	delay: function(creature) {
		// Move creature to end of queue but in order w.r.t. other delayed creatures
		this.queue.removePos(creature);
		for (var i = 0; i < this.queue.length; i++) {
			if (!this.queue[i].delayed) {
				continue;
			}
			if (this.queue[i].getInitiative() < creature.getInitiative()) {
				this.queue.splice(i, 0, creature);
				return;
			}
		}
		this.queue.push(creature);
	}
});
