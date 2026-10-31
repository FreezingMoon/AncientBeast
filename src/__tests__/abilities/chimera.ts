/**
 * Tests for Chimera's Disturbing Sound ability (ability[2]).
 *
 * Disturbing Sound fires a two-part missile — a spinning circle with the
 * musical note layered inside it (only the circle rotates) — and applies
 * damage plus the kill-chain only when the projectile lands.
 */

jest.mock('phaser', () =>
	(
		jest.requireActual('../../../test/phaser-mock') as typeof import('../../../test/phaser-mock')
	).createPhaserMock(),
);

import { jest, expect, describe, test, beforeEach } from '@jest/globals';
import createChimeraAbilities from '../../abilities/Chimera';

/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */

type TweenCompleteHandler = {
	cb: (() => void) | null;
	ctx: unknown;
};

function makeProjectileHarness() {
	const complete: TweenCompleteHandler = {
		cb: null,
		ctx: undefined,
	};
	const updateCbs: Array<() => void> = [];

	const tween = {
		duration: 120,
		onComplete: {
			add: (cb: () => void, ctx: unknown) => {
				complete.cb = cb;
				complete.ctx = ctx;
			},
		},
		onUpdateCallback: (cb: () => void) => {
			updateCbs.push(cb);
		},
	};
	const circle = {
		x: 10,
		y: 20,
		rotation: 0,
		alpha: 1,
		destroy: jest.fn(),
	};
	const spinTween = {
		stop: jest.fn(),
	};
	const note = {
		x: 0,
		y: 0,
		destroy: jest.fn(),
		setOrigin: jest.fn(),
	};

	const projectile = jest.fn((_start: unknown, _end: unknown, _key: unknown) => [tween, circle] as const);
	const addSprite = jest.fn((_x: unknown, _y: unknown, _key: unknown) => note);
	const makeTween = jest.fn(() => ({
		to: jest.fn(() => spinTween),
	}));

	return {
		projectile,
		addSprite,
		makeTween,
		tween,
		circle,
		note,
		spinTween,
		triggerComplete: () => {
			if (!complete.cb) {
				throw new Error('Projectile completion callback was not registered');
			}
			(complete.cb as () => void).call(complete.ctx);
		},
		triggerUpdate: () => {
			for (const cb of updateCbs) {
				cb();
			}
		},
	};
}

function makeAbilityGame(projectileHarness: ReturnType<typeof makeProjectileHarness>) {
	const queryMove = jest.fn();
	const getHexLine = jest.fn(() => [] as any[]);

	const game = {
		abilities: [] as unknown[],
		activeCreature: {
			queryMove,
		},
		animations: {
			projectile: projectileHarness.projectile,
		},
		grid: {
			getHexLine,
			creatureGroup: {},
		},
		soundsys: {
			playSFX: jest.fn(),
		},
		gameEngine: {
			add: {
				sprite: projectileHarness.addSprite,
			},
			tween: projectileHarness.makeTween,
		},
	};

	return {
		game,
		queryMove,
		getHexLine,
	};
}

beforeEach(() => {
	(global as unknown as { Phaser: unknown }).Phaser = {
		Easing: {
			Linear: {
				None: {},
			},
		},
	};
	(global as unknown as { Easing: unknown }).Easing = {
		Linear: { None: {} },
	};
});

describe('Chimera Disturbing Sound', () => {
	test('fires circle + note missile and defers damage until impact', () => {
		const projectileHarness = makeProjectileHarness();
		const { game, queryMove } = makeAbilityGame(projectileHarness);
		(globalThis as any).G = game as any;
		createChimeraAbilities(game as any);

		const ability = (game.abilities as any[])[45][2];
		const target = {
			x: 8,
			y: 3,
			flipped: false,
			takeDamage: jest.fn(() => ({ kill: false })),
		};
		const path = [{ x: 8, y: 3, creature: target }];

		const context = {
			creature: { id: 45 },
			damages: { sonic: 21 },
			isUpgraded: () => false,
			end: jest.fn(),
		};

		ability.activate.call(context, path, { direction: 1 });

		// Turn handoff is deferred while the missile flies.
		expect(context.end).toHaveBeenCalledWith(false, true);
		expect(queryMove).toHaveBeenCalledTimes(0);
		// The circle flies via G.animations.projectile; the note is layered on top.
		expect(projectileHarness.projectile).toHaveBeenCalledTimes(1);
		expect(projectileHarness.projectile.mock.calls[0][2]).toBe(
			'Chimera - Disturbing Sound - circle',
		);
		expect(projectileHarness.addSprite).toHaveBeenCalledTimes(1);
		expect(projectileHarness.addSprite.mock.calls[0][2]).toBe('Chimera - Disturbing Sound - note');
		// Damage is not applied until the projectile lands.
		expect(target.takeDamage).not.toHaveBeenCalled();

		// The note follows the circle without rotating.
		projectileHarness.triggerUpdate();
		expect(projectileHarness.note.x).toBe(projectileHarness.circle.x);
		expect(projectileHarness.note.y).toBe(projectileHarness.circle.y);

		projectileHarness.triggerComplete();
		expect(target.takeDamage).toHaveBeenCalledTimes(1);
		expect(projectileHarness.spinTween.stop).toHaveBeenCalledTimes(1);
		expect(projectileHarness.note.destroy).toHaveBeenCalledTimes(1);
		expect(queryMove).toHaveBeenCalledTimes(1);
	});

	test('continues the kill-chain to the next creature in line', () => {
		const projectileHarness = makeProjectileHarness();
		const { game, queryMove } = makeAbilityGame(projectileHarness);
		(globalThis as any).G = game as any;
		createChimeraAbilities(game as any);

		const ability = (game.abilities as any[])[45][2];
		const first = {
			x: 8,
			y: 3,
			flipped: false,
			takeDamage: jest.fn(() => ({ kill: true })),
		};
		const second = {
			x: 9,
			y: 3,
			takeDamage: jest.fn(() => ({ kill: false })),
		};
		(game.grid as any).getHexLine = jest.fn(() => [
			{ x: 8, y: 3, creature: first },
			{ x: 9, y: 3, creature: second },
		]);
		const path = [{ x: 8, y: 3, creature: first }];

		const context = {
			creature: { id: 45 },
			damages: { sonic: 21 },
			isUpgraded: () => false,
			end: jest.fn(),
		};

		ability.activate.call(context, path, { direction: 1 });
		projectileHarness.triggerComplete();

		expect(first.takeDamage).toHaveBeenCalledTimes(1);
		expect(second.takeDamage).toHaveBeenCalledTimes(1);
		expect(queryMove).toHaveBeenCalledTimes(1);
	});
});
