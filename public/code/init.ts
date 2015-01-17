class Game extends Phaser.Game {

    constructor() {

        super(1920, 1080, Phaser.AUTO, null);

        this.state.add('preloadState', preload.State, false);
        this.state.add('loadState', load.State, false);
        this.state.add('battleState', battle.State, false);

        // send which state to load after loadState (in this case - mainState)
        this.state.start('preloadState', false, false, 'battleState');

    }

}

window.onload = () => {
    new Game();
};