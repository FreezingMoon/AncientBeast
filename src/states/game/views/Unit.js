export default class Unit extends Phaser.Sprite {

    constructor(name, xId, yId, flip, speed, size) {

        super(game, 0, 0, name);

        // get my tile
        let base = yId%2 ? 285 : 240;

        this.x = base +90 * xId;
        this.y = 380 + 62 * yId;

        this.anchor.setTo(.5, 1);

        // todo remake fliping units
        if(flip) {
            this.scale.x = -1;
            this.x -= 20;
        }

        game.add.existing(this);
    }
}
