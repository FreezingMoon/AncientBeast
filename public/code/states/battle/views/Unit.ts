module battle {
    export class Unit extends Phaser.Sprite {

        pathFinder;

        constructor(public state: State,
                    name: string,
                    public xId: number,
                    public yId: number,
                    public flip: boolean,
                    public speed: number,
                    public size:number) {

            super(state.game, 0, 0, name);

            // get my tile
            this.x = this.state.tiles[yId][xId].x+10;
            this.y = this.state.tiles[yId][xId].y+20;

            // add unit to the battleGround
            this.state.battleGround[yId][xId] = this;

            this.anchor.setTo(.5, 1);

            // todo remake fliping units
            if(flip) {
                this.scale.x = -1;
                this.x -= 20;
            }

            this.pathFinder = new PathFinder(this);

            state.game.add.existing(this);
        }

        startTurn(){
            var tiles = this.pathFinder.getWalkableTiles();

            tiles.forEach((pos)=>{
                this.state.tiles[pos.y][pos.x].changeColor();
            });

        }
    }
}