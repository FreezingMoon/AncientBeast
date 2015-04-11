export default class extends Phaser.State {

    preload() {

        this.load.image('ugnis', 'images/ugnis.jpg');

    }

    create() {

        // CONFIG
        this.game.camera.roundPx = false;
        this.game.scale.scaleMode = Phaser.ScaleManager.EXACT_FIT;

        this.game.state.start('loadState');
    }
}