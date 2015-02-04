module battle {
    export class Unit extends Phaser.Sprite {

        pathFinder;

        constructor(public state: State,
                    name: string,
                    public xId: number,
                    public yId: number,
                    public speed: number,
                    public size:number) {

            super(state.game, 0, 0, name);

            this.x = 200 + xId*90;
            this.y = 400 + yId*64;

            // add unit to the battleGround
            this.state.battleGround[yId][xId] = this;

            this.anchor.setTo(0,1);

            this.pathFinder = new PathFinder(this);

            state.game.add.existing(this);
        }
    }
}