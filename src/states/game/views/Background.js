export default class Background extends Phaser.Sprite {

    constructor() {

        super(game, 0, 0, 'background');

        game.add.existing(this);
    }
}
