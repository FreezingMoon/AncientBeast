export default class Unit extends Phaser.Sprite {

    constructor(state, name, xId, yId, flip, speed, size) {

        super(state.game, 0, 0, name);

        // get my tile
        this.x = 500;
        this.y = 500;

        this.anchor.setTo(.5, 1);

        // todo remake fliping units
        if(flip) {
            this.scale.x = -1;
            this.x -= 20;
        }

        state.game.add.existing(this);
    }
}
