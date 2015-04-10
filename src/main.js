import preloadState from './states/load/preloadState.js';
import loadState from './states/load/loadState.js';
import gameState from './states/game/gameState.js';

class Game extends Phaser.Game {

    constructor() {

        super(1920, 1080, Phaser.AUTO, null);

        this.state.add('preloadState', preloadState, false);
        this.state.add('loadState', loadState, false);
        this.state.add('gameState', gameState, false);

        this.state.start('preloadState');
    }
}

new Game();

