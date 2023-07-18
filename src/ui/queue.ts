import { throttle } from 'underscore';
import { Creature } from '../creature';
import { CreatureQueue } from '../creature_queue';

const CONST = {
	animDurationMS: 500,
};

export class Queue {
	private element: HTMLElement;
	private vignettes: Array<Vignette>;
	private eventHandlers: QueueEventHandlers;

	static IMMEDIATE = 1;

	constructor(queueElement: HTMLElement, eventHandlers: QueueEventHandlers = {}) {
		this.element = queueElement;
		this.element.innerHTML = '';
		this.vignettes = [];
		this.eventHandlers = eventHandlers;
	}

	setQueue(creatureQueue: CreatureQueue, turnNumber: number) {
		const nextVignettes = Queue.getNextVignettes(
			creatureQueue.queue,
			creatureQueue.nextQueue,
			turnNumber,
			this.eventHandlers,
		);
		this.setVignettes(nextVignettes);
	}

	refresh() {
		this.vignettes.forEach((v) => v.refresh());
	}

	empty(immediately: number) {
		if (immediately === Queue.IMMEDIATE) {
			this.vignettes = [];
			this.element.innerHTML = '';
		} else {
			this.setVignettes([]);
		}
	}

	xray(creatureId: number) {
		this.vignettes.forEach((v) => v.xray(creatureId));
	}

	bounce(creatureId: number, bounceHeight = 40) {
		Queue.throttledBounce(this.vignettes, creatureId, bounceHeight);
	}

	private setVignettes(nextVignettes: Vignette[]) {
		const prevVs = this.vignettes;
		this.vignettes = Queue.reuseOldDomElements(prevVs, nextVignettes);
		Queue.deleteRemovedVignettes(this.vignettes, prevVs);
		Queue.insertUpdateNextVignettes(this.vignettes, prevVs, this.element);
	}

	private static throttledBounce = throttle(
		(vignettes: Vignette[], creatureId: number, bounceHeight: number) => {
			let x = 0;
			vignettes.forEach((v, i) => {
				v.bounce(creatureId, i, x, bounceHeight);
				x += v.getWidth();
			});
		},
		500,
	);

	private static getNextVignettes(
		creatures: Creature[],
		creaturesNext: Creature[],
		turnNum: number,
		eventHandlers: QueueEventHandlers,
	) {
		const undelayedCsCurr = creatures.filter((c) => !c.isDelayed);
		const delayedCsCurr = creatures.filter((c) => c.isDelayed);
		const hasDelayedCurr = delayedCsCurr.length > 0;

		const undelayedCsNext = creaturesNext.filter((c) => !c.isDelayedInNextQueue);
		const delayedCsNext = creaturesNext.filter((c) => c.isDelayedInNextQueue);
		const hasDelayedNext = delayedCsNext.length > 0;

		const is1stCreature = utils.trueIfFirstElseFalse();

		const newCreatureVCurr = (c: Creature) =>
			new CreatureVignette(c, turnNum, eventHandlers, is1stCreature());
		const undelayedVsCurr = undelayedCsCurr.map(newCreatureVCurr);
		const delayMarkerVCurr = hasDelayedCurr
			? [new DelayMarkerVignette(turnNum, eventHandlers)]
			: [];
		const delayedVsCurr = delayedCsCurr.map(newCreatureVCurr);

		const turnEndMarkerV = [new TurnEndMarkerVignette(turnNum, eventHandlers)];

		const newCreatureVNext = (c: Creature) =>
			new CreatureVignette(c, turnNum + 1, eventHandlers, is1stCreature());
		const undelayedVsNext = undelayedCsNext.map(newCreatureVNext);
		const delayMarkerVNext = hasDelayedNext
			? [new DelayMarkerVignette(turnNum + 1, eventHandlers)]
			: [];
		const delayedVsNext = delayedCsNext.map(newCreatureVNext);
		const vsNext = [].concat(turnEndMarkerV, undelayedVsNext, delayMarkerVNext, delayedVsNext);

		/**
		 * NOTE: There are special cases when delayed creatures are at the front of the queue.
		 * -
		 * DEFAULT CASE - undelayed creatures > 0
		 * (not delayed, active) (delayed) (delayed) ...
		 * becomes:
		 * (not delayed, active) (delay marker) (delayed) (delayed) ...
		 * i.e., delay marker is in front of delayed creatures
		 * -
		 * SPECIAL CASE 1 - num undelayed creatures === 0, num delayed creatures > 1
		 * (delayed, active) (delayed) (delayed) ...
		 * becomes:
		 * (delayed, active) (delay marker) (delayed) (delayed) ...
		 * i.e., delay marker is behind first delayed creature
		 * -
		 * SPECIAL CASE 2 - num undelayed creatures === 0, num delayed creatures === 1
		 * (delayed, active) (turn end marker) ...
		 * becomes:
		 * (delayed, active) (turn end marker) ...
		 * i.e., no delayed marker
		 */

		if (undelayedVsCurr.length === 0 && delayedVsCurr.length > 1) {
			// NOTE: Special case 1
			const firstV = [delayedVsCurr.shift()];
			return [].concat(firstV, delayMarkerVCurr, delayedVsCurr, vsNext);
		} else if (undelayedVsCurr.length === 0 && delayedVsCurr.length === 1) {
			// NOTE: Special case 2
			return [].concat(delayedVsCurr, vsNext);
		}
		// NOTE: All other cases
		return [].concat(undelayedVsCurr, delayMarkerVCurr, delayedVsCurr, vsNext);
	}

	private static reuseOldDomElements(oldVignettes: Vignette[], newVignettes: Vignette[]) {
		/**
		 * NOTE: For every vignette in newVignettes, if there's
		 * an equivalent in oldVignettes, use its DOM element.
		 * This keeps animations, transitions, and styles from breaking.
		 */
		const oldVDict = utils.arrToDict(oldVignettes, (v: Vignette) => v.getHash());
		for (const newV of newVignettes) {
			const hash = newV.getHash();
			if (oldVDict.hasOwnProperty(hash)) {
				newV.el = oldVDict[hash].el;
			}
		}

		return newVignettes;
	}

	private static deleteRemovedVignettes(nextVignettes: Vignette[], prevVignettes: Vignette[]) {
		const nextHashes = new Set(nextVignettes.map((v) => v.getHash()));
		const vignettesDeletedAtFront = utils.takeWhile(
			prevVignettes,
			(v: Vignette) => !nextHashes.has(v.getHash()),
		);
		const spaceDeletedAtFrontOfQueue = vignettesDeletedAtFront.reduce(
			(acc, v) => acc + v.getWidth(),
			0,
		);
		const frontDeletedHashes = new Set(vignettesDeletedAtFront.map((v) => v.getHash()));

		let x = 0;
		prevVignettes.forEach((v, i) => {
			const hash = v.getHash();
			const w = v.getWidth();
			if (!nextHashes.has(hash)) {
				if (frontDeletedHashes.has(hash)) {
					v.deleteFromFront(i, x, spaceDeletedAtFrontOfQueue);
				} else {
					v.delete(i, x);
				}
			}
			x += w;
		});
	}

	private static insertUpdateNextVignettes(
		nextVignettes: Vignette[],
		prevVignettes: Vignette[],
		containerElement: HTMLElement,
	) {
		const prevHashes = new Set(prevVignettes.map((v) => v.getHash()));
		const nextHashes = new Set(nextVignettes.map((v) => v.getHash()));
		const [updateHashes, insertHashes] = utils.splitSetBy(nextHashes, (h: string) =>
			prevHashes.has(h),
		);

		let x = 0;
		nextVignettes.forEach((v, i) => {
			const hash = v.getHash();
			if (insertHashes.has(hash)) {
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
	queuePosition = -1;
	turnNumber = -1;
	el: HTMLElement;
	eventHandlers: QueueEventHandlers = {};

	getHash() {
		return 'none';
	}

	getHTML() {
		return `<div></div>`;
	}

	insert(containerElement: HTMLElement, queuePosition: number, x: number) {
		this.queuePosition = queuePosition;
		if (this.el) {
			this.el.remove();
		}

		const tmp = document.createElement('div');
		tmp.innerHTML = this.getHTML();
		this.el = tmp.firstChild as HTMLElement;
		containerElement.appendChild(this.el);

		this.addEvents();
		this.animateInsert(queuePosition, x);
		return this;
	}

	update(queuePosition: number, x: number) {
		this.queuePosition = queuePosition;
		this.animateUpdate(queuePosition, x);
		return this;
	}

	delete(queuePosition: number, x: number) {
		this.queuePosition = queuePosition;
		this.animateDelete(queuePosition, x).onfinish = () => {
			this.el.remove();
		};
		return this;
	}

	deleteFromFront(queuePosition: number, x: number, spaceDeletedAtFrontOfQueue: number) {
		this.queuePosition = queuePosition;
		this.animateDeleteFromFront(queuePosition, x, spaceDeletedAtFrontOfQueue).onfinish = () => {
			this.el.remove();
		};
		return this;
	}

	animateInsert(queuePosition: number, x: number) {
		const keyframes = [
			{
				transform: `translateX(${x + 500}px) translateY(-100px) scale(1)`,
				easing: 'ease-out',
			},
			{
				transform: `translateX(${x + 500}px) translateY(0px) scale(1)`,
				easing: 'ease-in',
				offset: 0.3,
			},
			{ transform: `translateX(${x}px) translateY(0px) scale(1)` },
		];
		const animation = this.el.animate(keyframes, {
			duration: CONST.animDurationMS,
			fill: 'forwards',
		});
		animation.commitStyles();
		return animation;
	}

	animateUpdate(queuePosition: number, x: number) {
		const keyframes = [{ transform: `translateX(${x}px) translateY(0px) scale(1)` }];
		const animation = this.el.animate(keyframes, {
			duration: CONST.animDurationMS,
			fill: 'forwards',
		});
		animation.commitStyles();
		return animation;
	}

	animateDelete(queuePosition: number, x: number) {
		const keyframes = [{ transform: `translateX(${x}px) translateY(-100px) scale(1)` }];
		const animation = this.el.animate(keyframes, {
			duration: CONST.animDurationMS,
			fill: 'forwards',
		});
		animation.commitStyles();
		return animation;
	}

	animateDeleteFromFront(queuePosition: number, x: number, emptySpaceAtFrontOfQueue: number) {
		const keyframes = [
			{ transform: `translateX(${x - emptySpaceAtFrontOfQueue}px) translateY(0px) scale(1)` },
		];
		const animation = this.el.animate(keyframes, {
			duration: CONST.animDurationMS,
			fill: 'forwards',
		});
		animation.commitStyles();
		return animation;
	}

	animateBounce(queuePosition: number, x: number, bounceH: number) {
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

		const animation = this.el.animate(keyframes, { duration: BOUNCE_MS });
		animation.commitStyles();
		return animation;
	}

	getWidth() {
		return 80;
	}

	/* eslint-disable @typescript-eslint/no-unused-vars */
	xray(creatureId: number) {
		// pass
	}

	bounce(creatureId: number, i: number, x: number, bounceHeight: number) {
		// pass
	}
	/* eslint-enable @typescript-eslint/no-unused-vars */

	addEvents() {
		// pass
	}

	refresh() {
		// pass
	}
}

class CreatureVignette extends Vignette {
	creature: Creature;
	isActiveCreature: boolean;
	turnNumberIsCurrentTurn: boolean;

	constructor(
		creature: Creature,
		turnNumber: number,
		eventHandlers: QueueEventHandlers,
		isActiveCreature = false,
		turnNumberIsCurrentTurn = true,
	) {
		super();
		this.creature = creature;
		this.turnNumber = turnNumber;
		this.eventHandlers = eventHandlers;
		this.isActiveCreature = isActiveCreature;
		this.turnNumberIsCurrentTurn = turnNumberIsCurrentTurn;
	}

	getHash() {
		const id = 'id' + this.creature.id;
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

	setCreature(creature: Creature) {
		this.creature = creature;
	}

	insert(containerElement: HTMLElement, queuePosition: number, x: number) {
		super.insert(containerElement, queuePosition, x);
		this.updateDOM();
		return this;
	}

	update(queuePosition: number, x: number) {
		this.queuePosition = queuePosition;
		this.updateDOM();
		this.animateUpdate(queuePosition, x);
		return this;
	}

	private updateDOM() {
		const cl = this.el.classList;

		if (this.isActiveCreature) {
			cl.add('active');
		} else {
			cl.remove('active');
		}

		if (this.creature.temp) {
			cl.add('unmaterialized');
			cl.remove('materialized');
		} else {
			cl.remove('unmaterialized');
			cl.add('materialized');
		}

		if (this.creature.isDelayed && this.turnNumberIsCurrentTurn) {
			cl.add('delayed');
		}

		this.el.style.zIndex = this.creature.temp ? '1000' : this.queuePosition + 1 + '';

		const stats = this.creature.fatigueText;
		const statsClasses = ['stats', utils.toClassName(stats)].join(' ');
		const statsEl = this.el.querySelector('div.stats');
		statsEl.className = statsClasses;
		statsEl.textContent = stats;
	}

	animateInsert(queuePosition: number, x: number) {
		const scale = this.isActiveCreature ? 1.25 : 1.0;
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
		const animation = this.el.animate(keyframes, {
			duration: CONST.animDurationMS,
			fill: 'forwards',
		});
		animation.commitStyles();
		return animation;
	}

	animateUpdate(queuePosition: number, x: number) {
		const scale = this.isActiveCreature ? 1.25 : 1.0;
		const keyframes = [{ transform: `translateX(${x}px) translateY(0px) scale(${scale})` }];
		const animation = this.el.animate(keyframes, {
			duration: CONST.animDurationMS,
			fill: 'forwards',
		});
		animation.commitStyles();
		return animation;
	}

	animateDelete(queuePosition: number, x: number) {
		this.el.style.zIndex = '-1';
		const [x_, y, scale] = this.isActiveCreature ? [-this.getWidth(), 0, 1.25] : [x, -100, 1];
		const keyframes = [{ transform: `translateX(${x_}px) translateY(${y}px) scale(${scale})` }];
		const animation = this.el.animate(keyframes, {
			duration: CONST.animDurationMS,
			fill: 'forwards',
		});
		animation.commitStyles();
		return animation;
	}

	animateDeleteFromFront(queuePosition: number, x: number, emptySpaceAtFrontOfQueue: number) {
		const scale = this.isActiveCreature ? 1.25 : 1;
		const keyframes = [
			{
				transform: `translateX(${x - emptySpaceAtFrontOfQueue}px) translateY(0px) scale(${scale})`,
			},
		];
		const animation = this.el.animate(keyframes, {
			duration: CONST.animDurationMS,
			fill: 'forwards',
		});
		animation.commitStyles();
		return animation;
	}

	xray(creatureId: number) {
		if (creatureId === this.creature.id) {
			this.el.classList.add('xray');
		} else {
			this.el.classList.remove('xray');
		}
	}

	bounce(creatureId: number, i: number, x: number, bounceHeight: number) {
		if (creatureId === this.creature.id) {
			this.animateBounce(i, x, bounceHeight);
		}
	}

	addEvents() {
		const el = this.el;
		const h = this.eventHandlers;

		el.addEventListener('click', () => {
			if (h.onCreatureClick) h.onCreatureClick(this.creature);
		});

		el.addEventListener('mouseenter', () => {
			if (h.onCreatureMouseEnter) h.onCreatureMouseEnter(this.creature);
		});

		el.addEventListener('mouseleave', () => {
			if (h.onCreatureMouseLeave) h.onCreatureMouseLeave(this.creature);
		});
	}

	refresh() {
		this.updateDOM();
	}

	getWidth() {
		return this.isActiveCreature ? 100 : 80;
	}

	static is(obj: object) {
		return typeof obj !== 'undefined' && CreatureVignette.prototype.isPrototypeOf(obj);
	}
}

class TurnEndMarkerVignette extends Vignette {
	constructor(turnNumber: number, eventHandlers: QueueEventHandlers) {
		super();
		this.turnNumber = turnNumber;
		this.eventHandlers = eventHandlers;
	}

	getHash() {
		return ['turnend', 'turn' + this.turnNumber].join('_');
	}

	getHTML() {
		return `<div turn="${this.turnNumber}" roundmarker="1" class="vignette roundmarker">
			<div class="frame"></div>
            <div class="stats">Round ${this.turnNumber}</div>
		</div>`;
	}

	addEvents() {
		const el = this.el;
		const h = this.eventHandlers;

		el.addEventListener('click', () => {
			if (h.onTurnEndClick) h.onTurnEndClick(this.turnNumber);
		});

		el.addEventListener('mouseenter', () => {
			if (h.onTurnEndMouseEnter) h.onTurnEndMouseEnter(this.turnNumber);
		});

		el.addEventListener('mouseleave', () => {
			if (h.onTurnEndMouseLeave) h.onTurnEndMouseLeave(this.turnNumber);
		});
	}
}

class DelayMarkerVignette extends Vignette {
	constructor(turnNumber: number, eventHandlers: QueueEventHandlers) {
		super();
		this.turnNumber = turnNumber;
		this.eventHandlers = eventHandlers;
	}

	getHTML() {
		return `<div class="vignette delaymarker">
			<div class="frame"></div>
            <div class="stats">Delayed</div>
		</div>`;
	}

	getHash() {
		return ['delay', 'turn' + this.turnNumber].join('_');
	}

	addEvents() {
		const el = this.el;
		const h = this.eventHandlers;

		el.addEventListener('click', () => {
			if (h.onDelayClick) h.onDelayClick();
		});

		el.addEventListener('mouseenter', () => {
			if (h.onDelayMouseEnter) h.onDelayMouseEnter();
		});

		el.addEventListener('mouseleave', () => {
			if (h.onDelayClick) h.onDelayMouseLeave();
		});
	}

	animateInsert(queuePosition: number, x: number) {
		const keyframes = [
			{
				transform: `translateX(${x}px) translateY(-100px) scale(1)`,
			},
			{
				transform: `translateX(${x}px) translateY(-100px) scale(1)`,
				easing: 'ease-out',
			},
			{ transform: `translateX(${x}px) translateY(0px) scale(1)` },
		];
		const animation = this.el.animate(keyframes, {
			duration: CONST.animDurationMS * 2,
			fill: 'forwards',
		});
		animation.commitStyles();
		return animation;
	}
}

const utils = {
	trueIfFirstElseFalse: () => {
		let v = true;
		return () => {
			if (v) {
				v = false;
				return true;
			}
			return false;
		};
	},

	arrToDict: (arr: Vignette[], keyFn: (arg0: Vignette) => string) => {
		// NOTE: Turns an array to an object using the key function.
		// If the keyFn produces two or more identical keys, only the
		// last instance at that key will be kept.
		const result = {};
		for (const element of arr) {
			result[keyFn(element)] = element;
		}
		return result;
	},

	takeWhile: (arr: Vignette[], takeFn: (arg0: Vignette) => boolean) => {
		const result = [];
		for (const element of arr) {
			if (!takeFn(element)) {
				break;
			}
			result.push(element);
		}
		return result;
	},

	splitSetBy: (
		s: Set<string>,
		splitFn: (value: string, key: string, set: Set<string>) => boolean,
	) => {
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

type QueueEventHandlers = {
	onCreatureClick?: (creature: Creature) => void;
	onCreatureMouseEnter?: (creature: Creature) => void;
	onCreatureMouseLeave?: (creature: Creature) => void;
	onDelayClick?: () => void;
	onDelayMouseEnter?: () => void;
	onDelayMouseLeave?: () => void;
	onTurnEndClick?: (turnNumber: number) => void;
	onTurnEndMouseEnter?: (turnNumber: number) => void;
	onTurnEndMouseLeave?: (turnNumber: number) => void;
};
