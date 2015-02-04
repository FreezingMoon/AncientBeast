module battle {
    export class State extends Phaser.State {

        battleGround;
        controller;
        tiles;

        create() {

            // used to speed up pathfinding, this.tiles[] is where actual tiles are
            this.battleGround = [ // 16-15 x 11
                [0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
                 [0,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                 [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                 [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                 [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                 [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            ];

            // copy of battle tiles, with actual tiles in it
            this.tiles = [];

            new Background(this, 0,0, 'background');

            // add tiles
            this.battleGround.forEach((tile, y)=>{
                var row = [];
                if(y%2) {
                    for (var x = 0; x < 15; x++) {
                        row.push(new Tile(this, 285 + 90 * x, 380 + 62 * y, 'hex'));
                    }
                } else{
                    for (var x = 0; x < 16; x++) {
                       row.push(new Tile(this, 285-45 + 90 * x, 380 + 62 * y, 'hex'));
                    }
                }
                this.tiles.push(row);
            });


            // showing off pathfinding
            var wolfy = new Wolf(this, 0,0, 'unit');

            var walkable = wolfy.pathFinder.getWalkableTiles();

            walkable.forEach((pos)=>{
                this.tiles[pos.y][pos.x].changeColor();
            });
            // showing off pathfinding

        }
    }

}