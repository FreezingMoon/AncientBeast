import { GameState } from '../types'; // Assuming standard type definitions

/**
 * Manages the "Undo Move" logic, state snapshots, and round constraints.
 */
export class UndoSystem {
  private static instance: UndoSystem;
  private lastStateSnapshot: any = null;
  private usedInCurrentRound: boolean = false;
  private actionPerformed: boolean = false;

  private constructor() {}

  public static getInstance(): UndoSystem {
    if (!UndoSystem.instance) {
      UndoSystem.instance = new UndoSystem();
    }
    return UndoSystem.instance;
  }

  /**
   * Captures the current state before an action occurs.
   */
  public saveSnapshot(state: any): void {
    if (!this.usedInCurrentRound) {
      this.lastStateSnapshot = JSON.parse(JSON.stringify(state)); // Deep clone of relevant state
      this.actionPerformed = true;
      this.updateUI();
    }
  }

  /**
   * Reverts the game to the last saved snapshot.
   */
  public performUndo(): void {
    if (this.canUndo()) {
      console.log("Undoing last move...");
      // Logic to emit state restoration to the game engine
      // Example: GameEngine.loadState(this.lastStateSnapshot);
      
      this.usedInCurrentRound = true;
      this.actionPerformed = false;
      this.lastStateSnapshot = null;
      this.updateUI();
    }
  }

  public canUndo(): boolean {
    return this.actionPerformed && !this.usedInCurrentRound;
  }

  public resetRound(): void {
    this.usedInCurrentRound = false;
    this.actionPerformed = false;
    this.lastStateSnapshot = null;
    this.updateUI();
  }

  private updateUI(): void {
    // Trigger UI refresh event to swap Delay/Undo icons
    window.dispatchEvent(new CustomEvent('undoStatusChanged', { 
      detail: { 
        showUndo: this.canUndo(),
        actionPerformed: this.actionPerformed 
      } 
    }));
  }
}
