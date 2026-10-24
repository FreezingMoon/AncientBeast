import { describe, expect, test } from '@jest/globals';
import { GameStateMachine } from '../../engine/GameStateMachine';

describe('GameStateMachine', () => {
	test('accepts the normal match lifecycle', () => {
		const machine = new GameStateMachine();

		expect(machine.state).toBe('initialized');
		machine.transition('loading');
		machine.transition('loaded');
		machine.transition('playing');
		machine.transition('ended');

		expect(machine.state).toBe('ended');
	});

	test('allows retry and rematch transitions', () => {
		const machine = new GameStateMachine();

		machine.transition('loading');
		machine.transition('initialized');
		machine.transition('loading');
		machine.transition('loaded');
		machine.transition('playing');
		machine.transition('ended');
		machine.transition('loading');

		expect(machine.state).toBe('loading');
	});

	test('rejects invalid transitions without changing state', () => {
		const machine = new GameStateMachine();

		expect(() => machine.transition('playing')).toThrow(
			'Invalid game state transition: initialized -> playing',
		);
		expect(machine.state).toBe('initialized');
	});

	test('reset and synchronization are explicit lifecycle operations', () => {
		const machine = new GameStateMachine();

		machine.synchronize('playing');
		machine.reset();

		expect(machine.state).toBe('initialized');
	});

	test('rejects unknown states from synchronized snapshots', () => {
		const machine = new GameStateMachine();

		expect(() => machine.synchronize('unknown')).toThrow(
			'Invalid synchronized game state: unknown',
		);
		expect(machine.state).toBe('initialized');
	});
});