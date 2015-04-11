export default class Obstacle extends Phaser.Sprite {

    constructor(state, xId, yId, name) {

        super(state.game, 0, 0, name);

        // get my tile
        this.x = this.state.tiles[yId][xId].x;
        this.y = this.state.tiles[yId][xId].y;

        this.state.battleGround[yId][xId] = 1;

        this.anchor.setTo(0.5);

        state.game.add.existing(this);
    }
}