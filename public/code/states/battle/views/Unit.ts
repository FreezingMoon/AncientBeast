module battle {
    export class Unit extends Phaser.Sprite {

        constructor(private state: State, xId: number, yId: number, name: string) {

            super(state.game, 0, 0, name);

            this.x = 200 + xId*90;
            this.y = 400 + yId*64;

            this.anchor.setTo(0,1);

            state.game.add.existing(this);

        }

    }
}