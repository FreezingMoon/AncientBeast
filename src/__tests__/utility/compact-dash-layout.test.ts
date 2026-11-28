import {
	getCompactDashLayout,
	getNextRealmUnit,
	getLowestRealmUnit,
	getToggledCardSide,
	getMediumCardLayout,
	isTablessLandscapeDash,
} from '../../utility/compact-dash-layout';
import { unitData } from '../../data/units';
import type { CreatureType } from '../../data/types';

describe('compact dash layout breakpoints', () => {
	test.each([
		[500, 450, 'side-rails'],
		[500, 500, 'side-rails'],
		[500, 630, 'side-rails'],
	])('uses side rails at %sx%s', (width, height, expected) => {
		expect(getCompactDashLayout(width, height, false)).toBe(expected);
	});

	test.each([
		[500, 631, 'bottom-dial'],
		[648, 631, 'bottom-dial'],
	])('uses the bottom dial at %sx%s', (width, height, expected) => {
		expect(getCompactDashLayout(width, height, false)).toBe(expected);
	});

	test('uses the full grid at 649px wide and 450px tall', () => {
		expect(getCompactDashLayout(649, 450, true)).toBe('full-grid');
	});

	test('uses the full grid at 500px wide and 700px tall', () => {
		expect(getCompactDashLayout(500, 700, false)).toBe('full-grid');
	});

	test('uses the portrait full-grid branch at 630px wide and 870px tall', () => {
		expect(getCompactDashLayout(630, 870, false)).toBe('full-grid');
	});

	test('uses the portrait full-grid branch at 680px wide and 790px tall', () => {
		expect(getCompactDashLayout(680, 790, false)).toBe('full-grid');
	});

	test('uses the portrait full-grid branch at 701px wide and 785px tall', () => {
		expect(getCompactDashLayout(701, 785, false)).toBe('full-grid');
	});

	test('uses a full grid at 500px wide and 833px tall', () => {
		expect(getCompactDashLayout(500, 833, false)).toBe('full-grid');
	});

	test('uses a split grid at 755px wide and 475px tall', () => {
		expect(getCompactDashLayout(755, 475, true)).toBe('full-grid');
	});

	test('uses a split grid at 655px wide and 380px tall', () => {
		expect(getCompactDashLayout(655, 380, true)).toBe('full-grid');
	});

	test('uses a split grid at 972px wide and 563px tall', () => {
		expect(getCompactDashLayout(972, 563, true)).toBe('full-grid');
	});

	test('uses standard desktop layout at 1173px wide and 609px tall', () => {
		expect(getCompactDashLayout(1173, 609, true)).toBe('standard');
	});

	test('keeps player tabs hidden through narrow landscape widths', () => {
		expect(isTablessLandscapeDash(700, true)).toBe(true);
		expect(isTablessLandscapeDash(700, false)).toBe(false);
		expect(isTablessLandscapeDash(701, true)).toBe(false);
	});

	test('uses one card for short medium layouts', () => {
		expect(getMediumCardLayout(655, 380)).toBe('one-card');
		expect(getMediumCardLayout(890, 435)).toBe('one-card');
		expect(getMediumCardLayout(940, 466)).toBe('one-card');
		expect(getMediumCardLayout(880, 580)).toBe('one-card');
		expect(getMediumCardLayout(701, 785)).toBe('one-card');
	});

	test('uses two cards for sufficiently tall medium layouts', () => {
		expect(getMediumCardLayout(825, 472)).toBe('one-card');
		expect(getMediumCardLayout(972, 563)).toBe('two-cards');
	});

	test('uses the full grid for tiny landscape widths', () => {
		expect(getCompactDashLayout(500, 290, true)).toBe('full-grid');
	});

	test('keeps the card-only mode below 450px tall', () => {
		expect(getCompactDashLayout(500, 449, false)).toBe('card-only');
	});

	test('keeps Flayed and Headless on separate unit sets', () => {
		const flayed = unitData.find((unit) => unit.name === 'Flayed');
		const headless = unitData.find((unit) => unit.name === 'Headless');
		expect(flayed?.set).toBe('β');
		expect(headless?.set).toBe('α');
	});

	test('cycles to the next unit in a realm', () => {
		const candidates = ['W1', 'W2', 'W3', 'W4', 'W5'] as CreatureType[];
		expect(getNextRealmUnit('W', 'W3', candidates)).toBe('W4');
		expect(getNextRealmUnit('W', 'W5', candidates)).toBe('W1');
		expect(getNextRealmUnit('W', '--', candidates)).toBe('W1');
	});

	test('selects the lowest level unit in a realm', () => {
		const candidates = ['W5', 'W2', 'W7', 'W1'] as CreatureType[];
		expect(getLowestRealmUnit('W', candidates)).toBe('W1');
	});

	test('toggles a selected unit between card faces', () => {
		expect(getToggledCardSide('A')).toBe('B');
		expect(getToggledCardSide('B')).toBe('A');
	});
});
