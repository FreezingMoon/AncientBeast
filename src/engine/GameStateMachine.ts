export const GAME_STATES = ['initialized', 'loading', 'loaded', 'playing', 'ended'] as const;

export type GameState = (typeof GAME_STATES)[number];

export function isGameState(value: unknown): value is GameState {
	return GAME_STATES.includes(value as GameState);
}

const TRANSITIONS: Record<GameState, readonly GameState[]> = {
	initialized: ['loading', 'loaded'],
	loading: ['initialized', 'loaded', 'ended'],
	loaded: ['initialized', 'playing', 'ended'],
	playing: ['initialized', 'ended'],
	ended: ['initialized', 'loading'],
};

/** Owns the match lifecycle and rejects impossible phase changes. */
export class GameStateMachine {
	private currentState: GameState = 'initialized';

	get state(): GameState {
		return this.currentState;
	}

	transition(nextState: GameState): GameState {
		if (nextState === this.currentState) {
			return this.currentState;
		}

		if (!TRANSITIONS[this.currentState].includes(nextState)) {
			throw new Error(`Invalid game state transition: ${this.currentState} -> ${nextState}`);
		}

		this.currentState = nextState;
		return this.currentState;
	}

	/** Reset is an explicit lifecycle operation and may happen from any phase. */
	reset(): GameState {
		this.currentState = 'initialized';
		return this.currentState;
	}

	/** Adopt a server snapshot, whose phase may be ahead of this client's phase. */
	synchronize(state: unknown): GameState {
		if (!isGameState(state)) {
			throw new Error(`Invalid synchronized game state: ${String(state)}`);
		}
		this.currentState = state;
		return this.currentState;
	}
}
