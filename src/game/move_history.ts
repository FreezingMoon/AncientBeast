// Undo Move mechanic (#2704)
// Allows players to undo their last move

class MoveHistory {
    private moves: any[] = [];
    private maxHistory: number = 10;

    addMove(move: any): void {
        this.moves.push(move);
        if (this.moves.length > this.maxHistory) {
            this.moves.shift();
        }
    }

    canUndo(): boolean {
        return this.moves.length > 0;
    }

    undo(): any | null {
        if (!this.canUndo()) {
            return null;
        }
        return this.moves.pop();
    }

    getLastMove(): any | null {
        if (this.moves.length === 0) {
            return null;
        }
        return this.moves[this.moves.length - 1];
    }

    clear(): void {
        this.moves = [];
    }
}

export { MoveHistory };
