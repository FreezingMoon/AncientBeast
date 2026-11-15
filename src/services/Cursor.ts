/**
 * Service to manage the game cursor states.
 */
export class Cursor {
    private canvas: HTMLCanvasElement;
    private defaultCursor: string = 'default';

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    /**
     * Sets the cursor to a specific CSS type or predefined game state.
     * @param type The cursor type (e.g., 'progress', 'pointer', 'crosshair')
     */
    set(type: string): void {
        switch (type) {
            case 'progress':
                this.canvas.style.cursor = 'progress';
                break;
            case 'attack':
                this.canvas.style.cursor = 'crosshair';
                break;
            case 'pointer':
                this.canvas.style.cursor = 'pointer';
                break;
            default:
                this.canvas.style.cursor = this.defaultCursor;
        }
    }

    /**
     * Resets the cursor to the default state.
     */
    reset(): void {
        this.canvas.style.cursor = this.defaultCursor;
    }
}
