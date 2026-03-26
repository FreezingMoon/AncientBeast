import $j from 'jquery';
import { describe, expect, test } from '@jest/globals';
import {
	applyBuffDebuffStyle,
	getBuffDebuffSources,
	getStatWithBuffs,
} from '../../ui/buffs-debuffs';

describe('buffs-debuffs', () => {
	type FakeCreature = {
		baseStats: Record<string, number>;
		stats: Record<string, number>;
		effects: Array<{ name: string; alterations: Record<string, unknown> }>;
		dropCollection: Array<{ name: string; alterations: Record<string, unknown> }>;
	};

	const createCreature = (overrides: Partial<FakeCreature> = {}): FakeCreature => ({
		baseStats: {
			offense: 10,
			health: 20,
			movement: 5,
		},
		stats: {
			offense: 10,
			health: 20,
			movement: 5,
		},
		effects: [],
		dropCollection: [],
		...overrides,
	});

	test('getBuffDebuffSources uses modifier names for effects and drops', () => {
		const creature = createCreature({
			effects: [{ name: 'Battle Cry', alterations: { offense: 5 } }],
			dropCollection: [{ name: 'Gooey Drop', alterations: { offense: -2 } }],
		});

		expect(getBuffDebuffSources(creature, 'offense')).toEqual([
			{ kind: 'buff', text: '+5 from Battle Cry' },
			{ kind: 'debuff', text: '-2 from Gooey Drop' },
		]);
	});

	test('getStatWithBuffs compares against creature base stats', () => {
		const creature = createCreature({
			baseStats: { offense: 10 },
			stats: { offense: 15 },
			effects: [{ name: 'Battle Cry', alterations: { offense: 5 } }],
		});

		expect(getStatWithBuffs(creature, 'offense', 999)).toMatchObject({
			current: 15,
			change: 5,
			isBuffed: true,
			isDebuffed: false,
		});
	});

	test('applyBuffDebuffStyle adds color and hover modifiers for materialized units', () => {
		document.body.innerHTML = '<div class="stat offense"><span class="value">15</span></div>';

		const creature = createCreature({
			stats: { offense: 15 },
			effects: [{ name: 'Battle Cry', alterations: { offense: 5 } }],
		});
		const $value = $j('.value');

		applyBuffDebuffStyle($value, creature, 'offense', 10, false);

		expect($value.hasClass('buff')).toBe(true);
		expect($j('.stat .stat-modifiers').length).toBe(1);
		expect($j('.stat .stat-modifiers').text()).toContain('OFFENSE');
		expect($j('.stat .stat-modifiers').text()).toContain('+5 from Battle Cry');
	});

	test('applyBuffDebuffStyle clears color and hover modifiers while browsing', () => {
		document.body.innerHTML =
			'<div class="stat offense"><span class="value buff">10</span><div class="modifiers stat-modifiers"></div></div>';

		const $value = $j('.value');

		applyBuffDebuffStyle($value, undefined, 'offense', 10, true);

		expect($value.hasClass('buff')).toBe(false);
		expect($value.hasClass('debuff')).toBe(false);
		expect($j('.stat .stat-modifiers').length).toBe(0);
	});
});
