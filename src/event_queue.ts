import type { Creature } from './creature';

export interface QueueEvent<TData = unknown> {
	readonly isEvent: true;
	id: string;
	type: string;
	turn: number;
	initiative: number;
	delayed?: boolean;
	title: string;
	data: TData;
	resolve: (onComplete: () => void) => void;
}

export type QueueEntry = Creature | QueueEvent;

export function isQueueEvent(entry: QueueEntry): entry is QueueEvent {
	return 'isEvent' in entry && entry.isEvent;
}

type QueueCreature = Creature & { hideFromQueue?: boolean };

export class EventQueue {
	private _getCreatures: () => Creature[];
	private _getTurn: () => number;
	private events: QueueEvent[] = [];

	constructor(getCreatures: () => Creature[], getTurn: () => number) {
		this._getCreatures = getCreatures;
		this._getTurn = getTurn;
	}

	addEvent(event: QueueEvent) {
		this.events.push(event);
	}

	removeEvent(event: QueueEvent) {
		this.events = this.events.filter((queuedEvent) => queuedEvent !== event);
	}

	get queue() {
		const creatures = this._getCreatures().filter(
			(c) => c?.isInCurrentQueue && !(c as QueueCreature)?.hideFromQueue,
		);
		const events = this.events.filter((event) => event.turn <= this._getTurn());
		return this.sortEntries([...creatures, ...events], false);
	}

	get nextQueue() {
		const creatures = this._getCreatures().filter(
			(c) => c?.isInNextQueue && !(c as QueueCreature)?.hideFromQueue,
		);
		const turn = this._getTurn();
		const events = this.events.filter((event) => event.turn > turn && event.turn <= turn + 1);
		return this.sortEntries([...creatures, ...events], true);
	}

	isCurrentEmpty() {
		return this.queue.length === 0;
	}

	getCurrentQueueLength() {
		return this.queue.length;
	}

	private sortEntries(entries: QueueEntry[], isNextQueue: boolean) {
		const isDelayed = (entry: QueueEntry) =>
			isQueueEvent(entry)
				? Boolean(entry.delayed)
				: isNextQueue
				? Boolean(entry.isDelayedInNextQueue)
				: entry.isDelayed;
		const initiative = (entry: QueueEntry) =>
			isQueueEvent(entry) ? entry.initiative * 500 : entry.getInitiative();
		const undelayed = entries
			.filter((entry) => !isDelayed(entry))
			.sort((a, b) => initiative(b) - initiative(a));
		const delayed = entries.filter(isDelayed).sort((a, b) => initiative(b) - initiative(a));
		return [...undelayed, ...delayed];
	}
}
