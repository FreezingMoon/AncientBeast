module battle {
    export class Obstacle extends Phaser.Sprite {

        constructor(private state: State, xId: number, yId: number, name: string) {

            super(state.game, 0, 0, name);

            // get my tile
            this.x = this.state.tiles[yId][xId].x;
            this.y = this.state.tiles[yId][xId].y;

            this.state.battleGround[yId][xId] = 1;

            this.anchor.setTo(0.5);

            state.game.add.existing(this);
        }

    }
}