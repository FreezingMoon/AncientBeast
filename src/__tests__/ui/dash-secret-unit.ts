import { describe, expect, test } from '@jest/globals';
import { UI } from '../../ui/interface';

/**
 * The dash's suggestion pool.
 *
 * Opening the dash with the materialize ability active shows a random unit,
 * which is the only way the game *recommends* a unit. Secret units must stay
 * out of that pool: they are reachable by deliberately clicking their locked
 * vignette, never suggested.
 *
 * `showRandomCreature` is exercised through the prototype with a stand-in
 * `this`, like the other UI suites, so no DOM is involved.
 */
describe('dash unit suggestions', () => {
	const makeGame = (availableCreatures: string[]) => ({
		players: [
			{
				creatures: [],
				availableCreatures,
				plasma: 50,
			},
		],
		activeCreature: { player: { id: 0 }, team: 0 },
		lastSummonedType: null,
		retrieveCreatureStats: (type: string) => ({
			size: 1,
			playable: type === 'G4' ? 'secret' : true,
		}),
	});

	const showRandom = (availableCreatures: string[]) => {
		const game = makeGame(availableCreatures);
		let shown: string | undefined;
		const ui = {
			game,
			showCreature: (type: string) => {
				shown = type;
			},
		};

		UI.prototype.showRandomCreature.call(ui as unknown as UI);

		return shown;
	};

	test('never suggests a secret unit, even when it is the only option', () => {
		// The pool holds nothing but the secret unit, so a suggestion would have
		// to land on her. The dash shows the priest instead.
		expect(showRandom(['--', 'G4'])).toBe('--');
	});

	test('still suggests the released units', () => {
		expect(showRandom(['--', 'A1', 'G4'])).toBe('A1');
	});

	test('a secret unit can be suggested once it is released', () => {
		const game = makeGame(['--', 'A1', 'G4']);
		// Released: the secret filter no longer applies to her.
		game.retrieveCreatureStats = (_type: string) => ({ size: 1, playable: true });

		const shown: string[] = [];
		const ui = {
			game,
			showCreature: (type: string) => {
				shown.push(type);
			},
		};

		// The roll is random, so sample until the secret unit comes up.
		for (let i = 0; i < 60 && !shown.includes('G4'); i++) {
			UI.prototype.showRandomCreature.call(ui as unknown as UI);
		}

		expect(shown).toContain('G4');
	});
});
