import { UndoSystem } from '../systems/UndoSystem';

/**
 * Handles global keyboard shortcuts
 */
export class Hotkeys {
  constructor(scene: Phaser.Scene) {
    scene.input.keyboard.on('keydown', (event: KeyboardEvent) => {
      // Check for Ctrl+Z (or Cmd+Z on Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
        event.preventDefault();
        const undoSystem = UndoSystem.getInstance();
        if (undoSystem.canUndo()) {
          undoSystem.performUndo();
        }
      }
    });
  }
}
