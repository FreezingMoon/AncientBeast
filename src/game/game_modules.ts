// Split game index into multiple files (#1111)
// Refactor game.ts into smaller, focused modules

/**
 * Game state management module
 */
export class GameState {
    private state: Map<string, any> = new Map();
    
    get(key: string): any {
        return this.state.get(key);
    }
    
    set(key: string, value: any): void {
        this.state.set(key, value);
    }
    
    clear(): void {
        this.state.clear();
    }
}

/**
 * Game configuration module
 */
export interface GameConfig {
    gridSize: number;
    maxPlayers: number;
    turnTimeLimit: number;
    enableSound: boolean;
}

export const DEFAULT_CONFIG: GameConfig = {
    gridSize: 15,
    maxPlayers: 4,
    turnTimeLimit: 60,
    enableSound: true
};

/**
 * Game event handling module
 */
export class GameEvents {
    private listeners: Map<string, Function[]> = new Map();
    
    on(event: string, callback: Function): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(callback);
    }
    
    off(event: string, callback: Function): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }
    
    emit(event: string, data?: any): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(cb => cb(data));
        }
    }
}

/**
 * Game loop module
 */
export class GameLoop {
    private running: boolean = false;
    private lastTime: number = 0;
    
    start(): void {
        this.running = true;
        this.lastTime = Date.now();
    }
    
    stop(): void {
        this.running = false;
    }
    
    isRunning(): boolean {
        return this.running;
    }
    
    getDeltaTime(): number {
        const now = Date.now();
        const delta = now - this.lastTime;
        this.lastTime = now;
        return delta;
    }
}
