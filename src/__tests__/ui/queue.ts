import { beforeAll, describe, expect, jest, test } from '@jest/globals';
import type { Creature } from '../../creature';
import type { EventQueue } from '../../event_queue';
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
		player: { controller: 'human' },
		getInitiative: () => initiative,
	} as unknown as Creature);

const leapAnimations = (animate: jest.Mock) =>
	animate.mock.calls
		.map((call) => call[0] as Array<{ offset?: number; transform?: string }>)
		.filter(
			(frames) =>
				frames.length > 2 &&
				frames[0]?.offset === 0 &&
				frames.at(-1)?.offset === 1 &&
				frames.some((frame) => /translateY\(-[\d.]+px\)/.test(String(frame.transform))),
		);

describe('Queue', () => {
	test('empties the HTML element argument', () => {
		const div = document.createElement('div');
		div.innerHTML = '<a>Hello</a>';
		expect(div.innerHTML).toBe('<a>Hello</a>');

		const queue = new Queue(div);
		expect(queue).toBeDefined();
		expect(div.innerHTML).toBe('');
	});

	test('shows scheduled events in initiative order in the upcoming round', () => {
		const div = document.createElement('div');
		const queue = new Queue(div);
		const asher = creature({ id: 1, initiative: 10 });
		const globeEvent = {
			isEvent: true,
			id: 'crashing-globe-1',
			type: 'crashing-globe',
			turn: 2,
			initiative: 11,
			title: 'Crashing Globe',
			data: { attacker: asher, hex: { x: 4, y: 5 }, upgraded: false },
			resolve: jest.fn(),
		};

		queue.setQueue(
			{
				queue: [],
				nextQueue: [globeEvent, asher],
			} as unknown as EventQueue,
			1,
		);

		const globe = div.querySelector('.crashing-globe-ability');
		const asherVignette = div.querySelector('.creature[creatureid="1"]');
		expect(globe).not.toBeNull();
		expect(globe?.textContent).toContain('Crashing Globe');
		if (!globe || !asherVignette) {
			throw new Error('Queue did not render both the globe event and Asher');
		}
		expect(
			globe.compareDocumentPosition(asherVignette) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});

	test('right-clicking a Crashing Globe event reveals its owner', () => {
		const div = document.createElement('div');
		const attacker = creature({ id: 1 });
		const onEventContextMenu = jest.fn();
		const queue = new Queue(div, { onEventContextMenu });
		const globeEvent = {
			isEvent: true,
			id: 'crashing-globe-1',
			type: 'crashing-globe',
			turn: 2,
			initiative: 11,
			title: 'Crashing Globe',
			data: { attacker, hex: { x: 4, y: 5 }, upgraded: false },
			resolve: jest.fn(),
		};

		queue.setQueue(
			{
				queue: [],
				nextQueue: [globeEvent],
			} as unknown as EventQueue,
			1,
		);

		const globe = div.querySelector('.crashing-globe-ability');
		expect(globe).not.toBeNull();
		globe?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

		expect(onEventContextMenu).toHaveBeenCalledWith(attacker);
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
			} as unknown as EventQueue,
			1,
		);

		queue.showDelayPreview();

		const preview = div.querySelector('.delay-preview-marker') as HTMLElement;
		expect(preview).not.toBeNull();
		expect(preview.getAttribute('aria-hidden')).toBe('true');
		expect(preview.classList.contains('vignette')).toBe(false);
		expect(preview.style.transform).toContain('translateX(260px)');

		queue.clearDelayPreview();

		expect(div.querySelector('.delay-preview')).toBeNull();
	});

	test('shows the delay insertion marker before the visible round marker when no unit is delayed', () => {
		const div = document.createElement('div');
		const queue = new Queue(div);

		queue.setQueue(
			{
				queue: [creature({ id: 1 }), creature({ id: 2 })],
				nextQueue: [],
			} as unknown as EventQueue,
			1,
		);

		queue.showDelayPreview();

		const preview = div.querySelector('.delay-preview-marker') as HTMLElement;
		expect(preview).not.toBeNull();
		expect(preview.style.transform).toContain('translateX(180px)');
	});

	test('clears stale delay preview whenever the queue is re-rendered', () => {
		const div = document.createElement('div');
		const queue = new Queue(div);

		queue.setQueue(
			{
				queue: [creature({ id: 1 }), creature({ id: 2 })],
				nextQueue: [],
			} as unknown as EventQueue,
			1,
		);
		queue.showDelayPreview();

		expect(div.querySelector('.delay-preview')).not.toBeNull();

		queue.setQueue(
			{
				queue: [creature({ id: 2 })],
				nextQueue: [],
			} as unknown as EventQueue,
			1,
		);

		expect(div.querySelector('.delay-preview')).toBeNull();
	});

	test('leaps into its new slot when a unit is delayed', () => {
		const div = document.createElement('div');
		const queue = new Queue(div);
		const animate = Element.prototype.animate as unknown as jest.Mock;

		queue.setQueue(
			{
				queue: [creature({ id: 1 }), creature({ id: 2 }), creature({ id: 3 })],
				nextQueue: [],
			} as unknown as EventQueue,
			1,
		);

		animate.mockClear();

		queue.setQueue(
			{
				queue: [creature({ id: 1, delayed: true }), creature({ id: 2 }), creature({ id: 3 })],
				nextQueue: [],
			} as unknown as EventQueue,
			1,
		);

		const leaps = leapAnimations(animate);

		expect(leaps).toHaveLength(1);
		expect(leaps[0][0].offset).toBe(0);
		expect(leaps[0].at(-1)?.offset).toBe(1);
		expect(String(leaps[0][Math.floor(leaps[0].length / 2)].transform)).toContain(
			'translateY(-60px)',
		);

		// X changes throughout the leap, so the path is horizontal as well as arced.
		const xPositions = leaps[0].map((frame) =>
			Number(/translateX\(([-\d.]+)px\)/.exec(String(frame.transform))?.[1]),
		);
		expect(new Set(xPositions).size).toBeGreaterThan(4);
	});

	test('leaps when an ability forces an undelayed avatar backwards', () => {
		const div = document.createElement('div');
		const queue = new Queue(div);
		const animate = Element.prototype.animate as unknown as jest.Mock;

		queue.setQueue(
			{
				queue: [creature({ id: 1 }), creature({ id: 2 }), creature({ id: 3 })],
				nextQueue: [],
			} as unknown as EventQueue,
			1,
		);

		animate.mockClear();

		// Model a force/reorder mechanic directly: id 1 moves behind the other
		// current-turn units without relying on the voluntary-delay flag.
		queue.setQueue(
			{
				queue: [creature({ id: 2 }), creature({ id: 3 }), creature({ id: 1 })],
				nextQueue: [],
			} as unknown as EventQueue,
			1,
		);

		expect(leapAnimations(animate)).toHaveLength(1);
	});

	test('slides without leaping when the queue merely shuffles forward', () => {
		const div = document.createElement('div');
		const queue = new Queue(div);
		const animate = Element.prototype.animate as unknown as jest.Mock;

		queue.setQueue(
			{
				queue: [creature({ id: 1 }), creature({ id: 2 }), creature({ id: 3 })],
				nextQueue: [],
			} as unknown as EventQueue,
			1,
		);

		animate.mockClear();

		queue.setQueue(
			{
				queue: [creature({ id: 2 }), creature({ id: 3 })],
				nextQueue: [],
			} as unknown as EventQueue,
			1,
		);

		expect(leapAnimations(animate)).toHaveLength(0);
	});
});
