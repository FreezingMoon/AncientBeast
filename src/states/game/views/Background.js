export default class Background extends Phaser.Sprite {

    constructor(state, x, y, name) {

        super(state.game, x, y, name);

        state.game.add.existing(this);

    }
}
