module battle {
    export class Tile extends Phaser.Sprite {

        constructor(private state: State, x: number, y: number, name: string) {

            super(state.game, x, y, name);

            this.anchor.setTo(0.5);
            this.scale.y = 0.8;

            state.game.add.existing(this);
        }

        changeColor(){
            this.loadTexture('hexPath', 0);
        }

    }
}