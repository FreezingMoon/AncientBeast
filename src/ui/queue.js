import { throttle } from 'underscore';

const CONST = {
	animDurationMS: 500,
};

export class Queue {
	#element;
	#vignettes;

	static IMMEDIATE = 1;

	constructor(queueElement) {
		this.#element = queueElement;
		this.#element.innerHTML = '';
		this.#vignettes = [];

		refactor.stopGap.init();
	}

	addEventListener(type, callback) {
		this.#element.addEventListener(type, callback);
	}

	setQueue(creatureQueue, activeCreature, turnNumber) {
		refactor.stopGap.setTurnNumber(turnNumber);
		refactor.stopGap.setCreatureQueue(creatureQueue);

		const creatures = refactor.creatureQueue.getCurrentQueue(creatureQueue, activeCreature);
		const nextCreatures = refactor.creatureQueue.getNextQueue(creatureQueue);

		creatures.forEach(refactor.stopGap.updateCreatureDelayStatus);

		const nextVignettes = Queue.#getNextVignettes(creatures, nextCreatures, turnNumber);
		this.#setVignettes(nextVignettes);
	}

	refresh() {
		this.#vignettes.forEach((v) => v.refresh());
	}

	empty(immediately) {
		refactor.stopGap.init();
		if (immediately === Queue.IMMEDIATE) {
			this.#vignettes = [];
			this.#element.innerHTML = '';
		} else {
			this.#setVignettes([]);
		}
	}

	xray(creatureId) {
		this.#vignettes.forEach((v) => v.xray(creatureId));
	}

	bounce(creatureId, bounceHeight = 40) {
		Queue.#throttledBounce(this.#vignettes, creatureId, bounceHeight);
	}

	#setVignettes(nextVignettes) {
		const prevVs = this.#vignettes;
		this.#vignettes = Queue.#reuseEquivalentOldVignettes(prevVs, nextVignettes);
		Queue.#deleteRemovedVignettes(this.#vignettes, prevVs);
		Queue.#insertUpdateNextVignettes(this.#vignettes, prevVs, this.#element);
	}

	static #throttledBounce = throttle((vignettes, creatureId, bounceHeight) => {
		let x = 0;
		vignettes.forEach((v, i) => {
			v.bounce(creatureId, i, x, bounceHeight);
			x += v.getWidth();
		});
	}, 500);

	static #getNextVignettes(creatures, creaturesNext, turnNum) {
		const [undelayedCs, delayedCs] = utils.partitionAt(creatures, refactor.creature.getIsDelayed);
		const hasDelayMarker = undelayedCs.length > 0 && delayedCs.length > 0;

		const undelayedVs = undelayedCs.map((c) => new CreatureVignette(c, turnNum));
		const delayedVs = delayedCs.map((c) => new CreatureVignette(c, turnNum));
		const delayMarkerV = hasDelayMarker ? [new DelayMarkerVignette(turnNum)] : [];
		const turnEndMarkerV = [new TurnEndMarkerVignette(turnNum)];
		const nextTurnVs = creaturesNext.map((c) => new CreatureVignette(c, turnNum + 1, false));

		return [].concat(undelayedVs, delayMarkerV, delayedVs, turnEndMarkerV, nextTurnVs);
	}

	static #reuseEquivalentOldVignettes(oldVignettes, newVignettes) {
		/**
		 * NOTE: For every vignette in newVignettes, if there's
		 * an equivalent in oldVignettes, use the one in oldVignettes.
		 * This lets the vignette DOM elements maintain their state.
		 * ... But use args from new, as the passed CreatureQueue uses different
		 * objects to represent the same creature.
		 */
		const oldVDict = utils.arrToDict(oldVignettes, (v) => v.getHash());
		const nextVs = newVignettes.map((vNew) => {
			const hash = vNew.getHash();
			if (oldVDict.hasOwnProperty(hash)) {
				const vOld = oldVDict[hash];
				vOld.usePropsFrom(vNew);
				return vOld;
			}
			return vNew;
		});

		return nextVs;
	}

	static #deleteRemovedVignettes(nextVignettes, prevVignettes) {
		const nextHashes = new Set(nextVignettes.map((v) => v.getHash()));

		let x = 0;
		prevVignettes.forEach((v, i) => {
			const hash = v.getHash();
			const w = v.getWidth();
			if (!nextHashes.has(hash)) {
				v.delete(i, x);
				console.log('deleting', hash);
			}
			x += w;
		});
	}

	static #insertUpdateNextVignettes(nextVignettes, prevVignettes, containerElement) {
		const prevHashes = new Set(prevVignettes.map((v) => v.getHash()));
		const nextHashes = new Set(nextVignettes.map((v) => v.getHash()));
		const [updateHashes, insertHashes] = utils.splitSetBy(nextHashes, (h) => prevHashes.has(h));

		let x = 0;
		nextVignettes.forEach((v, i) => {
			const hash = v.getHash();
			if (insertHashes.has(hash)) {
				console.log('inserting', hash);
				v.insert(containerElement, i, x);
				x += v.getWidth();
			} else if (updateHashes.has(hash)) {
				v.update(i, x);
				x += v.getWidth();
			}
		});
	}
}

class Vignette {
	getHash() {
		return 'none';
	}

	getHTML() {
		return `<div></div>`;
	}

	insert(containerElement, queuePosition, x) {
		this.queuePosition = queuePosition;
		if (this.el) {
			this.el.remove();
		}

		const tmp = document.createElement('div');
		tmp.innerHTML = this.getHTML();
		this.el = tmp.firstChild;
		containerElement.appendChild(this.el);

		this.addEvents();
		this.animateInsert(queuePosition, x);
		return this;
	}

	update(queuePosition, x) {
		this.queuePosition = queuePosition;
		this.animateUpdate(queuePosition, x);
		return this;
	}

	delete(queuePosition, x) {
		this.queuePosition = queuePosition;
		this.animateDelete(queuePosition, x).onfinish = () => {
			this.el.remove();
		};
		return this;
	}

	animateInsert(queuePosition, x) {
		const scale = queuePosition === 0 ? 1.25 : 1.0;
		const keyframes = [
			{
				transform: `translateX(${x + 500}px) translateY(-100px) scale(${scale})`,
				easing: 'ease-out',
			},
			{
				transform: `translateX(${x + 500}px) translateY(0px) scale(${scale})`,
				easing: 'ease-in',
				offset: 0.3,
			},
			{ transform: `translateX(${x}px) translateY(0px) scale(${scale})` },
		];
		const options = { duration: CONST.animDurationMS, fill: 'forwards' };
		const animation = this.el.animate(keyframes, options);
		animation.commitStyles();
		return animation;
	}

	animateUpdate(queuePosition, x) {
		const scale = queuePosition === 0 ? 1.25 : 1.0;
		const keyframes = [{ transform: `translateX(${x}px) translateY(0px) scale(${scale})` }];
		const options = { duration: CONST.animDurationMS, fill: 'forwards' };
		const animation = this.el.animate(keyframes, options);
		animation.commitStyles();
		return animation;
	}

	animateDelete(queuePosition, x) {
		if (queuePosition == 0) {
			const scale = 1.25;
			const x = -this.getWidth();
			const keyframes = [{ transform: `translateX(${x}px) translateY(0px) scale(${scale})` }];
			const options = { duration: CONST.animDurationMS, fill: 'forwards' };
			const animation = this.el.animate(keyframes, options);
			animation.commitStyles();
			return animation;
		} else {
			const scale = 1.0;
			const keyframes = [{ transform: `translateX(${x}px) translateY(-100px) scale(${scale})` }];
			const options = { duration: CONST.animDurationMS, fill: 'forwards' };
			const animation = this.el.animate(keyframes, options);
			animation.commitStyles();
			return animation;
		}
	}

	animateBounce(queuePosition, x, bounceH) {
		const NUM_BOUNCES = 3;
		const BOUNCE_MS = 280 * NUM_BOUNCES;

		const scale = queuePosition === 0 ? 1.25 : 1.0;
		const restingKeyframe = { transform: `translateX(${x}px) translateY(0px) scale(${scale})` };
		const bounceHs = new Array(NUM_BOUNCES)
			.fill(0)
			.map((_, i) => bounceH * Math.pow(1 / (i + 1), 2));
		const keyframes = [restingKeyframe];
		for (const bounceH of bounceHs) {
			keyframes.push({ transform: `translateX(${x}px) translateY(${bounceH}px) scale(${scale})` });
			keyframes.push(restingKeyframe);
		}

		const options = { duration: BOUNCE_MS };
		const animation = this.el.animate(keyframes, options);
		animation.commitStyles();
		return animation;
	}

	getWidth() {
		return this.queuePosition == 0 ? 100 : 80;
	}

	xray() {
		//pass
	}

	bounce() {
		//pass
	}

	addEvents() {
		//pass
	}

	usePropsFrom() {
		//pass
	}

	refresh() {
		//pass
	}
}

class CreatureVignette extends Vignette {
	constructor(creature, turnNumber, turnNumberIsCurrentTurn = true) {
		super();
		this.creature = creature;
		this.turnNumber = turnNumber;
		this.turnNumberIsCurrentTurn = turnNumberIsCurrentTurn;
	}

	getHash() {
		const id = 'id' + refactor.creature.getId(this.creature);
		return `creature_${id}_turn${this.turnNumber}`;
	}

	getHTML() {
		const c = this.creature;
		const classes = ['vignette', 'creature', 'type' + c.type, 'p' + c.team].join(' ');
		return `<div creatureid="${c.id}" class="${classes}">
				<div class="frame"></div>
				<div class="overlay_frame"></div>
				<div class="delay_frame"></div>
				<div class="stats"></div>
			</div>`;
	}

	setCreature(creature) {
		this.creature = creature;
	}

	insert(containerElement, queuePosition, x) {
		super.insert(containerElement, queuePosition, x);
		this.#updateDOM();
		return this;
	}

	update(queuePosition, x) {
		this.queuePosition = queuePosition;
		this.#updateDOM();
		this.animateUpdate(queuePosition, x);
		return this;
	}

	#updateDOM() {
		const cl = this.el.classList;

		if (this.queuePosition === 0) {
			cl.add('active');
		} else {
			cl.remove('active');
		}

		if (this.creature.temp) {
			cl.add('unmaterialized');
		} else {
			cl.remove('unmaterialized');
		}

		if (refactor.creature.getIsDelayed(this.creature) && this.turnNumberIsCurrentTurn) {
			cl.add('delayed');
		}

		this.el.style.zIndex = this.creature.temp ? 1000 : this.queuePosition;

		const stats = this.creature.fatigueText;
		const statsClasses = ['stats', utils.toClassName(stats)].join(' ');
		const statsEl = this.el.querySelector('div.stats');
		statsEl.className = statsClasses;
		statsEl.textContent = stats;
	}

	xray(creatureId) {
		if (creatureId === this.creature.id) {
			this.el.classList.add('xray');
		} else {
			this.el.classList.remove('xray');
		}
	}

	bounce(creatureId, i, x, bounceHeight) {
		if (creatureId === this.creature.id) {
			this.animateBounce(i, x, bounceHeight);
		}
	}

	addEvents() {
		// NOTE: capture "regular" events and emit custom events instead.
		const el = this.el;
		const options = { detail: { creature: this.creature }, bubbles: true };
		const prefix = 'vignettecreature';
		const events = ['mouseenter', 'mouseleave', 'click'];

		for (const eventName of events) {
			const event = new CustomEvent(prefix + eventName, options);
			el.addEventListener(eventName, (e) => {
				e.preventDefault();
				el.dispatchEvent(event);
			});
		}
	}

	usePropsFrom(otherVignette) {
		if (otherVignette.hasOwnProperty('creature')) {
			this.creature = otherVignette.creature;
		}
		if (otherVignette.hasOwnProperty('turnNumber')) {
			this.turnNumber = otherVignette.turnNumber;
		}
		if (otherVignette.hasOwnProperty('turnNumberIsCurrentTurn')) {
			this.turnNumberIsCurrentTurn = otherVignette.turnNumberIsCurrentTurn;
		}
	}

	refresh() {
		this.#updateDOM();
	}

	static is(obj) {
		return typeof obj !== 'undefined' && CreatureVignette.prototype.isPrototypeOf(obj);
	}
}

class TurnEndMarkerVignette extends Vignette {
	constructor(turnNumber) {
		super();
		this.turnNumber = turnNumber;
	}

	getHash() {
		return ['turnend', 'turn' + this.turnNumber].join('_');
	}

	getHTML() {
		return `<div turn="${this.turnNumber}" roundmarker="1" class="vignette roundmarker">
			<div class="frame"></div>
            <div class="stats">Round ${this.turnNumber + 1}</div>
		</div>`;
	}

	animateDelete(queuePosition, x) {
		if (queuePosition <= 1) {
			x = -this.getWidth();
			const keyframes = [{ transform: `translateX(${x}px) translateY(0px) scale(1.0)` }];
			const options = { duration: CONST.animDurationMS, fill: 'forwards' };
			const animation = this.el.animate(keyframes, options);
			animation.commitStyles();
			return animation;
		} else {
			const keyframes = [{ transform: `translateX(${x}px) translateY(-100px) scale(1.0)` }];
			const options = { duration: CONST.animDurationMS, fill: 'forwards' };
			const animation = this.el.animate(keyframes, options);
			animation.commitStyles();
			return animation;
		}
	}

	addEvents() {
		// NOTE: capture "regular" events and emit custom events instead.
		const el = this.el;
		const options = { detail: { turnNumber: this.turnNumber }, bubbles: true };
		const prefix = 'vignetteturnend';
		const events = ['mouseenter', 'mouseleave'];

		for (const eventName of events) {
			const event = new CustomEvent(prefix + eventName, options);
			el.addEventListener(eventName, (e) => {
				e.preventDefault();
				el.dispatchEvent(event);
			});
		}
	}
}

class DelayMarkerVignette extends Vignette {
	constructor(turnNumber) {
		super();
		this.turnNumber = turnNumber;
	}

	getHash() {
		return ['delay', 'turn' + this.turnNumber].join('_');
	}

	getWidth() {
		return 40;
	}
}

const utils = {
	arrToDict: (arr, keyFn) => {
		// NOTE: Turns an array to an object using the key function.
		// If the keyFn produces two or more identical keys, only the
		// last instance at that key will be kept.
		const result = {};
		for (const element of arr) {
			result[keyFn(element)] = element;
		}
		return result;
	},

	partitionAt: (arr, splitFn) => {
		let hasSplit = false;
		return arr.reduce(
			(acc, el, i, arr) => {
				hasSplit = hasSplit || splitFn(el, i, arr);
				acc[hasSplit ? 1 : 0].push(el);
				return acc;
			},
			[[], []],
		);
	},

	splitSetBy: (s, splitFn) => {
		const a = new Set();
		const b = new Set();
		s.forEach((value, key, set) => {
			if (splitFn(value, key, set)) {
				a.add(value);
			} else {
				b.add(value);
			}
		});
		return [a, b];
	},

	toClassName: (s = '', ifNone = 'none', prefixIfNumeric = 'class_') => {
		const SEP = '_';
		s = (SEP + s + SEP).toLowerCase().replace(/[^a-z0-9]+/g, SEP);
		s = s.substring(1, s.length - 1);

		if (s === '' || s === SEP) {
			return ifNone;
		} else if ('0123456789'.indexOf(s[0]) !== -1) {
			return prefixIfNumeric + s;
		}
		return s;
	},
};

const refactor = {
	/** NOTE:
	 * Other modules that the present module relies on sometimes go
	 * into inconsistent states. In order to facilitate future
	 * improvements, workarounds/fixes are factored out of the present
	 * module's code and placed here.
	 * .
	 * Interface is here for easy browsing.
	 * Implementations are below.
	 */
	creatureQueue: {
		// NOTE: Suggestions for fixed/improved CreatureQueue interface.
		getCurrentQueue: () => {
			return [];
		},
		getNextQueue: () => {
			return [];
		},
	},
	creature: {
		// NOTE: Suggestions for fixed/improved Creature interface.
		getId: () => {
			return -1;
		},
		getIsDelayed: () => {
			return false;
		},
	},
	stopGap: {
		// NOTE: Extra data/functions needed only while refactor is pending.
		setTurnNumber: () => {
			// pass
		},
		setCreatureQueue: () => {
			// pass
		},
		turnNumber: -1,
	},
};

refactor.creatureQueue = {
	getCurrentQueue: (creatureQueue, activeCreature) => {
		// NOTE: creatureQueue and game.activeCreature get into inconsistent states.
		// Mostly creatureQueue does *not* hold activeCreature ...
		// - But sometimes it does.
		// - And sometimes activeCreature isn't meant to be active.
		//
		// What we really need is *every* creature that still needs a turn.
		//
		// We'll check if activeCreature is in the queue.
		// - If not, we'll add it to the front.
		// - If so, we'll leave it where it is.
		if (!activeCreature) {
			return creatureQueue.queue;
		}
		const arr = Array.from(creatureQueue.queue);
		const containsActive = arr.some((c) => c.id === activeCreature.id);
		if (containsActive) {
			return arr;
		}
		return [activeCreature].concat(arr);
	},
	getNextQueue: (creatureQueue) => {
		// NOTE: if `getCurrentQueue` is added to creatureQueue
		// add this as well.
		return creatureQueue.nextQueue;
	},
};

refactor.stopGap.init = () => {
	refactor.stopGap.setTurnNumber(-1);
};

refactor.stopGap.setTurnNumber = (turnNumber) => {
	if (turnNumber !== refactor.stopGap.turnNumber) {
		refactor.stopGap.turnNumber = turnNumber;

		const creatureIdsDelayedThisTurn = new Set();

		refactor.stopGap.updateCreatureDelayStatus = (creature) => {
			if (creature.delayed && !creatureIdsDelayedThisTurn.has(creature.id)) {
				creatureIdsDelayedThisTurn.add(creature.id);
			}
		};

		refactor.creature.getIsDelayed = (creature) => {
			// NOTE: Creatures get into inconsistent states vis-a-vis the
			// queue. Sometimes a creature's state will go from delayed
			// to !delayed, while being active and having previously been delayed.
			// This is problematic.
			return creatureIdsDelayedThisTurn.has(creature.id);
		};
	}
};

refactor.stopGap.setCreatureQueue = (creatureQueue) => {
	refactor.creature.getId = (creature) => {
		// NOTE: This is necessary because Creatures *sometimes*
		// modify their ids when they're being placed on the board i.e. "materialized".
		// The queue's tempCreature always seems to have the "correct" id.
		// A copy of that creature in queue's nextQueue has tempCreature.id + 1 **sometimes**.
		// This should probably be refactored into Creature to keep ids consistent.
		if (!creatureQueue.tempCreature) return creature.id;
		const tc = creatureQueue.tempCreature;
		const c = creature;
		if (
			c.id === tc.id + 1 &&
			c.name === tc.name &&
			c.type === tc.type &&
			c.team === tc.team &&
			(c.turnsActive === 0) === (tc.turnsActive === 0)
		) {
			return tc.id;
		}
		return c.id;
	};
};
