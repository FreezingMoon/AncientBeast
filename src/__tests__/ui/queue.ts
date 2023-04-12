/**
 * @jest-environment jsdom
 */
import { Queue } from '../../ui/queue';
import { expect, describe, test } from '@jest/globals';

describe('Queue', () => {
	test('empties the HTML element argument', () => {
		const div = document.createElement('div');
		div.innerHTML = '<a>Hello</a>';
		expect(div.innerHTML).toBe('<a>Hello</a>');

		const queue = new Queue(div);
		expect(queue).toBeDefined();
		expect(div.innerHTML).toBe('');
	});

	test("xray(creatureId) applies .xray class to creature's vignette", () => {
		const [div, queue, creatureQueue] = getDivQueueCreatureQueue();

		const firstCreature = creatureQueue.queue[0];
		expect(div.querySelector('.xray')).toBeNull();
		queue.xray(firstCreature.id);
		const creatureVignette0 = div.querySelector('.xray');
		expect(creatureVignette0.getAttribute('creatureid')).toBe('' + firstCreature.id);
		queue.xray(-1);
		expect(div.querySelector('.xray')).toBeNull();
	});

	test('xray(creatureId) shows creature name', () => {
		const [div, queue, creatureQueue] = getDivQueueCreatureQueue();

		const firstCreature = creatureQueue.queue[0];
		queue.xray(firstCreature.id);

		const creatureVignette0: HTMLElement = div.querySelector('.xray');
		expect(creatureVignette0.getAttribute('creatureid')).toBe('' + firstCreature.id);
		expect(hasText(creatureVignette0, firstCreature.name)).toBe(true);
		expect(hasText(creatureVignette0, firstCreature.fatigueText)).toBe(false);
		queue.xray(-1);
		expect(hasText(creatureVignette0, firstCreature.name)).toBe(false);
		expect(hasText(creatureVignette0, firstCreature.fatigueText)).toBe(true);

		const secondCreature = creatureQueue.queue[1];
		queue.xray(secondCreature.id);
		const creatureVignette1 = div.querySelector('.xray');
		expect(hasText(creatureVignette1, secondCreature.name)).toBe(true);
		expect(hasText(creatureVignette1, secondCreature.fatigueText)).toBe(false);
		queue.xray(-1);
		expect(hasText(creatureVignette1, secondCreature.name)).toBe(false);
		expect(hasText(creatureVignette1, secondCreature.fatigueText)).toBe(true);
	});
});

function getDivQueueCreatureQueue(): [HTMLElement, Queue, CreatureQueue] {
	const div = document.createElement('div');
	document.body.appendChild(div);
	const creatureQueue = getCreatureQueueMock();

	const queue = new Queue(div);
	queue.setQueue(creatureQueue, creatureQueue.queue[0], 1);
	return [div, queue, creatureQueue];
}

function textNodesUnder(el: HTMLElement) {
	let n: Node;
	const a = [];
	const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
	while ((n = walk.nextNode())) a.push(n);
	return a;
}

function hasText(el, txt) {
	const textNodes: Text[] = textNodesUnder(el);
	return textNodes.reduce((tOrF, node) => tOrF || node.nodeValue === txt, false);
}

function getCreatureMock() {
	return {
		id: Math.floor(Math.random() * 10000000),
		name: (Math.random() + 1).toString(36).substring(7),
		fatigueText: (Math.random() + 1).toString(36).substring(7),
	};
}

type CreatureQueue = {
	game: any;
	queue: Array<any>;
	nextQueue: Array<any>;
};

function getCreatureQueueMock() {
	const creatures = new Array(5).fill(0).map((_) => getCreatureMock());
	const game = getGameMock();
	const q = {
		game,
		queue: creatures,
		nextQueue: Array.from(creatures),
	};
	return q;
}

function getGameMock() {
	return {
		turnNumber: 1,
		activeCreature: getCreatureMock(),
	};
}
