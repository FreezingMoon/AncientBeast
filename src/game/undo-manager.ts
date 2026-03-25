import Game from '../game';

export class UndoManager {
	private game: Game;
	private usedTurn: number | null;
	private replaying: boolean;

	constructor(game: Game) {
		this.game = game;
		this.usedTurn = null;
		this.replaying = false;
	}

	reset(preserveReplay = false) {
		this.usedTurn = null;
		if (!preserveReplay) {
			this.replaying = false;
		}
	}

	get isReplaying() {
		return this.replaying;
	}

	canUndo() {
		if (this.replaying || this.game.multiplayer || this.game.gameState !== 'playing') {
			return false;
		}

		if (!this.game.gamelog.actions.length) {
			return false;
		}

		return this.usedTurn !== this.game.turn;
	}

	undo() {
		if (!this.canUndo()) {
			return false;
		}

		const actions = [...this.game.gamelog.actions];
		actions.pop();

		this.replaying = true;

		this.game.replayActionHistory(actions, () => {
			this.replaying = false;
			this.usedTurn = this.game.turn;
			this.game.log('Undo Move');
			this.game.updateQueueDisplay();
			this.game.UI?.syncUndoButton();
		});

		return true;
	}
}
