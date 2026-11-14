import { UndoSystem } from '../../systems/UndoSystem';

/**
 * Logic for the Action Bar buttons (Delay/Undo)
 */
export class ActionButtons {
  private delayButton: any; // Phaser.GameObjects.Image or Sprite
  private undoButton: any;

  constructor(scene: Phaser.Scene) {
    this.createButtons(scene);
    this.setupListeners();
  }

  private createButtons(scene: Phaser.Scene): void {
    // Existing Delay Turn Button
    this.delayButton = scene.add.image(100, 100, 'delay_turn').setInteractive();
    
    // New Undo Move Button (Hidden by default)
    this.undoButton = scene.add.image(100, 100, 'undo_move')
      .setInteractive()
      .setVisible(false);

    this.undoButton.on('pointerdown', () => {
      UndoSystem.getInstance().performUndo();
    });
  }

  private setupListeners(): void {
    window.addEventListener('undoStatusChanged', (event: any) => {
      const { showUndo, actionPerformed } = event.detail;

      if (actionPerformed) {
        // If an action happened, Delay Turn is always hidden
        this.delayButton.setVisible(false);
        // Show Undo only if not used yet this round
        this.undoButton.setVisible(showUndo);
      } else {
        // No action yet: Show Delay, Hide Undo
        this.delayButton.setVisible(true);
        this.undoButton.setVisible(false);
      }
    });
  }
}
