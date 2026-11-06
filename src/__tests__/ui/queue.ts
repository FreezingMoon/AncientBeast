import { beforeAll, describe, expect, jest, test } from '@jest/globals';
import type { Creature } from '../../creature';
import type { EventQueue } from '../../event_queue';
import { Queue } from '../../ui/queue';

jest.mock('../../style/avatar-styles', () => ({
	getAvatarSet: () => 'default',
}));

beforeAll(() => {
	window.matchMedia = (media) => ({
		media,
		matches: false,
		onchange: null,
		addListener: jest.fn(),
		removeListener: jest.fn(),
		addEventListener: jest.fn(),
		removeEventListener: jest.fn(),
		dispatchEvent: () => true,
	});
	Element.prototype.animate = jest.fn().mockReturnValue({
		commitStyles: jest.fn(),
		cancel: jest.fn(),
		effect: { updateTiming: jest.fn() },
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
	test('keeps the outgoing active avatar against the marker as it grows', () => {
		const div = document.createElement('div');
		const queue = new Queue(div);
		const animate = Element.prototype.animate as unknown as jest.Mock;
		queue.setQueue(
			{ queue: [creature({ id: 1 })], nextQueue: [creature({ id: 2 })] } as unknown as EventQueue,
			1,
		);
		const outgoing = div.querySelector('.creature.active');
		animate.mockClear();
		queue.setQueue({ queue: [creature({ id: 2 })], nextQueue: [] } as unknown as EventQueue, 2);
		const index = animate.mock.contexts.indexOf(outgoing);
		expect(animate.mock.calls[index][0]).toEqual([
			{ transform: 'translateX(0px) translateY(0px) scale(1.25)', offset: 0 },
			{ transform: 'translateX(-44px) translateY(0px) scale(1.25)', offset: 0.3 },
			{ transform: 'translateX(-100px) translateY(0px) scale(1.25)', offset: 1 },
		]);
	});

	test('keeps following avatars behind the growing active avatar throughout the handoff', () => {
		const div = document.createElement('div');
		const queue = new Queue(div);
		const animate = Element.prototype.animate as unknown as jest.Mock;
		const first = creature({ id: 2 });
		const following = creature({ id: 3 });
		queue.setQueue(
			{ queue: [creature({ id: 1 })], nextQueue: [first, following] } as unknown as EventQueue,
			1,
		);
		animate.mockClear();
		queue.setQueue({ queue: [first, following], nextQueue: [] } as unknown as EventQueue, 2);
		const avatar = div.querySelector('.creature[creatureid="3"]');
		const index = animate.mock.contexts.indexOf(avatar);
		expect(animate.mock.calls[index][0]).toEqual([
			{ transform: 'translateX(180px) translateY(0px) scale(1)' },
		]);
		const animation = animate.mock.results[index].value as { onfinish: () => void };
		animation.onfinish();
		const frames = animate.mock.calls.at(-1)?.[0] as Array<{ transform: string; offset: number }>;
		frames.forEach(({ transform, offset }) => {
			const x = Number(/translateX\(([-\d.]+)px\)/.exec(transform)?.[1]);
			expect(x).toBeCloseTo(100 * (1 - offset) + 80 * (1 + 0.25 * offset));
		});
	});

	test('does not interrupt queue animations on resize events within the same layout', () => {
		const div = document.createElement('div');
		const queue = new Queue(div);
		queue.setQueue(
			{ queue: [creature({ id: 1 })], nextQueue: [creature({ id: 2 })] } as unknown as EventQueue,
			1,
		);
		const animate = Element.prototype.animate as unknown as jest.Mock;
		animate.mockClear();
		queue.resize();
		queue.resize();
		expect(animate).not.toHaveBeenCalled();
	});

	test('repositions queued items immediately when viewport sizing changes', () => {
		const originalMatchMedia = window.matchMedia;
		let mobile = false;
		window.matchMedia = (query) => ({
			...originalMatchMedia(query),
			matches: mobile && query.includes('orientation: landscape'),
		});
		try {
			const div = document.createElement('div');
			const queue = new Queue(div);
			const animate = Element.prototype.animate as unknown as jest.Mock;
			queue.setQueue(
				{
					queue: [creature({ id: 1 }), creature({ id: 2 })],
					nextQueue: [],
				} as unknown as EventQueue,
				1,
			);
			div.querySelectorAll<HTMLElement>('.vignette').forEach((el) => {
				el.getAnimations = () => [];
			});
			const marker = div.querySelector('.roundmarker');
			for (const compact of [true, false]) {
				mobile = compact;
				animate.mockClear();
				queue.resize();
				const index = animate.mock.contexts.indexOf(marker);
				expect(animate.mock.calls[index][0]).toEqual([
					{
						transform: `translateX(${compact ? 164 : 180}px) translateY(0px) scale(1)`,
					},
				]);
			}
		} finally {
			window.matchMedia = originalMatchMedia;
		}
	});

	test('inserts the next round marker from the right, not from the left corner', () => {
		const div = document.createElement('div');
		const queue = new Queue(div);
		const animate = Element.prototype.animate as unknown as jest.Mock;
		queue.setQueue({ queue: [creature({ id: 1 })], nextQueue: [] } as unknown as EventQueue, 1);
		animate.mockClear();
		queue.setQueue({ queue: [creature({ id: 2 })], nextQueue: [] } as unknown as EventQueue, 2);

		const marker = div.querySelector('.roundmarker[turn="2"]');
		const index = animate.mock.contexts.indexOf(marker);
		expect(index).toBeGreaterThanOrEqual(0);
		expect(animate.mock.calls[index][0]).toEqual([
			{
				transform: 'translateX(600px) translateY(-100px) scale(1)',
				easing: 'ease-out',
			},
			{
				transform: 'translateX(600px) translateY(0px) scale(1)',
				easing: 'ease-in',
				offset: 0.3,
			},
			{ transform: 'translateX(100px) translateY(0px) scale(1)' },
		]);
	});

	test('moves the next avatar at queued size until the round marker reaches the corner', () => {
		const div = document.createElement('div');
		const queue = new Queue(div);
		const animate = Element.prototype.animate as unknown as jest.Mock;
		const next = creature({ id: 2 });
		queue.setQueue({ queue: [creature({ id: 1 })], nextQueue: [next] } as unknown as EventQueue, 1);
		animate.mockClear();
		queue.setQueue({ queue: [next], nextQueue: [] } as unknown as EventQueue, 2);

		const avatar = div.querySelector('.creature[creatureid="2"]');
		const index = animate.mock.contexts.indexOf(avatar);
		expect(index).toBeGreaterThanOrEqual(0);
		expect(animate.mock.calls[index][0]).toEqual([
			{ transform: 'translateX(100px) translateY(0px) scale(1)' },
		]);
		const duration = 500;
		expect(animate.mock.calls[index][1]).toEqual({ duration, fill: 'forwards' });
		expect(avatar?.classList.contains('active')).toBe(false);
		const animation = animate.mock.results[index].value as {
			onfinish: () => void;
			effect: { updateTiming: ReturnType<typeof jest.fn> };
		};
		animation.effect.updateTiming.mockClear();
		animation.onfinish();
		expect(animation.effect.updateTiming).not.toHaveBeenCalled();
		expect(avatar?.classList.contains('active')).toBe(true);
		expect(animate.mock.calls.at(-2)?.[1]).toEqual({ duration: 500, fill: 'forwards' });
		expect(animate.mock.calls.at(-2)?.[0]).toEqual([
			{ transform: 'translateX(0px) translateY(0px) scale(1.25)' },
		]);
		expect(animate.mock.calls.at(-1)?.[1]).toEqual({ duration: 500 });
	});

	test('keeps the next round marker small with its title until it enters the active slot', () => {
		const div = document.createElement('div');
		const queue = new Queue(div);
		const animate = Element.prototype.animate as unknown as jest.Mock;
		queue.setQueue(
			{ queue: [creature({ id: 1 }), creature({ id: 2 })], nextQueue: [] } as unknown as EventQueue,
			1,
		);
		const marker = div.querySelector('.roundmarker');
		animate.mockClear();

		queue.setQueue({ queue: [creature({ id: 2 })], nextQueue: [] } as unknown as EventQueue, 1);
		expect(marker?.classList.contains('active')).toBe(false);
		expect(marker?.querySelector('.stats')?.textContent).toBe('Round 1');
		let index = animate.mock.contexts.indexOf(marker);
		expect(animate.mock.calls[index][0]).toEqual([
			{ transform: 'translateX(100px) translateY(0px) scale(1)' },
		]);
		animate.mockClear();
		queue.setQueue({ queue: [], nextQueue: [] } as unknown as EventQueue, 1);

		expect(marker?.classList.contains('active')).toBe(true);
		index = animate.mock.contexts.indexOf(marker);
		expect(index).toBeGreaterThanOrEqual(0);
		expect(animate.mock.calls[index][0]).toEqual([
			{ transform: 'translateX(0px) translateY(0px) scale(1.25)' },
		]);
	});

	test.each([56, 64, 80])('grows a %ipx round marker before it exits the front', (width) => {
		const originalMatchMedia = window.matchMedia;
		window.matchMedia = (query) => ({
			...originalMatchMedia(query),
			matches: query.includes('orientation') ? width !== 80 : width === 56,
		});

		try {
			const div = document.createElement('div');
			const queue = new Queue(div);
			const animate = Element.prototype.animate as unknown as jest.Mock;
			queue.setQueue({ queue: [creature({ id: 1 })], nextQueue: [] } as unknown as EventQueue, 1);
			const marker = div.querySelector('.roundmarker');
			animate.mockClear();

			queue.setQueue({ queue: [creature({ id: 2 })], nextQueue: [] } as unknown as EventQueue, 2);

			expect(marker?.classList.contains('active')).toBe(true);
			const index = animate.mock.contexts.indexOf(marker);
			expect(index).toBeGreaterThanOrEqual(0);
			const frames = animate.mock.calls[index][0] as Array<{
				transform: string;
				offset: number;
			}>;
			const scale = 100 / width;
			const y = 20 + width * (1 - scale);
			const approachDuration = 500;
			const cornerOffset = approachDuration / (approachDuration + 500);
			expect(frames).toEqual([
				{ transform: 'translateX(100px) translateY(0px) scale(1)', offset: 0 },
				{
					transform: `translateX(${width * 0.7}px) translateY(${y}px) scale(${scale})`,
					offset: cornerOffset * 0.3,
				},
				{
					transform: `translateX(0px) translateY(${y}px) scale(${scale})`,
					offset: cornerOffset,
				},
				{
					transform: `translateX(-100px) translateY(${y}px) scale(${scale})`,
					offset: 1,
				},
			]);
			expect(y + width * scale).toBeCloseTo(width + 20);
			expect(width * scale).toBe(100);
		} finally {
			window.matchMedia = originalMatchMedia;
		}
	});

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
