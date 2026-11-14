import { Hexagon } from './Hexagon';
import { GameConfig } from '../config/GameConfig';

export class Cursor extends Phaser.GameObjects.Container {
    private targetOverlay: Phaser.GameObjects.Sprite;
    private baseOutline: Phaser.GameObjects.Sprite;

    constructor(scene: Phaser.Scene) {
        super(scene);
        
        // The filled outline hexagon (standard)
        this.baseOutline = scene.add.sprite(0, 0, 'hexagon_filled_outline');
        
        // The non-spinning cursor hexagon (new requirement)
        this.targetOverlay = scene.add.sprite(0, 0, 'hexagon_cursor_static');
        this.targetOverlay.setAlpha(0.8);
        
        this.add([this.baseOutline, this.targetOverlay]);
        this.setVisible(false);
        scene.add.existing(this);
    }

    /**
     * Updates the cursor position and visual state for ability targeting
     */
    public showTargeting(hex: Hexagon, playerColor: number) {
        this.setPosition(hex.x, hex.y);
        this.baseOutline.setTint(playerColor);
        this.targetOverlay.setTint(0xffffff); // Keep cursor neutral or slightly tinted
        this.setVisible(true);
        
        // Ensure the overlay is not spinning
        this.targetOverlay.setRotation(0);
        this.baseOutline.setRotation(0);
    }
}
