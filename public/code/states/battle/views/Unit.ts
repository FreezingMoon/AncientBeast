module battle {
    export class Unit extends Phaser.Sprite {

        constructor(private state: State, x: number, y: number, name: string) {

            super(state.game, x, y, name);

            state.game.add.existing(this);

        }

    }
}