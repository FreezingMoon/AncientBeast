import { beforeAll, describe, expect, jest, test } from '@jest/globals';
import type { Creature } from '../../creature';
import type { CreatureQueue } from '../../creature_queue';
import { Queue } from '../../ui/queue';

jest.mock('../../style/avatar-styles', () => ({
	getAvatarSet: () => 'default',
}));

beforeAll(() => {
	Element.prototype.animate = jest.fn().mockReturnValue({
		commitStyles: jest.fn(),
		onfinish: null,
	}) as unknown as typeof Element.prototype.animate;
});

const creature = ({ id, delayed = false, initiative = 10 }) =>
	({
		id,
		type: 0,
		team: 0,
		temp: false,
		dead: false,
		isDelayed: delayed,
		isDelayedInNextQueue: false,
		fatigueText: '',
		getInitiative: () => initiative,
	} as unknown as Creature);

describe('Queue', () => {
	test('empties the HTML element argument', () => {
		const div = document.createElement('div');
		div.innerHTML = '<a>Hello</a>';
		expect(div.innerHTML).toBe('<a>Hello</a>');

		const queue = new Queue(div);
		expect(queue).toBeDefined();
		expect(div.innerHTML).toBe('');
	});

	test('shows an insertion marker where delay would place the active unit', () => {
		const div = document.createElement('div');
		const queue = new Queue(div);

		queue.setQueue(
			{
				queue: [
					creature({ id: 1, initiative: 30 }),
					creature({ id: 2, initiative: 20 }),
					creature({ id: 3, delayed: true, initiative: 10 }),
				],
				nextQueue: [],
			} as unknown as CreatureQueue,
			1,
		);

		queue.showDelayPreview();

		const preview = div.querySelector('.delay-preview-marker') as HTMLElement;
		expect(preview).not.toBeNull();
		expect(preview.getAttribute('aria-hidden')).toBe('true');
		expect(preview.classList.contains('vignette')).toBe(false);
		expect(preview.style.transform).toContain('translateX(160px)');

		queue.clearDelayPreview();

		expect(div.querySelector('.delay-preview')).toBeNull();
	});

	test('clears stale delay preview whenever the queue is re-rendered', () => {
		const div = document.createElement('div');
		const queue = new Queue(div);

		queue.setQueue(
			{
				queue: [creature({ id: 1 }), creature({ id: 2 })],
				nextQueue: [],
			} as unknown as CreatureQueue,
			1,
		);
		queue.showDelayPreview();

		expect(div.querySelector('.delay-preview')).not.toBeNull();

		queue.setQueue(
			{
				queue: [creature({ id: 2 })],
				nextQueue: [],
			} as unknown as CreatureQueue,
			1,
		);

		expect(div.querySelector('.delay-preview')).toBeNull();
	});
});
