module battle {
    export class State extends Phaser.State {

        battleGround;
        controller;
        tiles;
        units = [];
        initData;
        obstacles;

        init(data){

            this.initData = data;
        }

        create() {

            // used to speed up pathfinding, this.tiles[] is where actual tiles are
            this.battleGround = [ // 16-15 x 11
                [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                 [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
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

            this.obstacles = this.add.group();

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

            // add some obstacles
            this.obstacles.add(new Obstacle(this, 3, 6, 'obstacle'));
            this.obstacles.add(new Obstacle(this, 2, 7, 'obstacle'));
            this.obstacles.add(new Obstacle(this, 1, 7, 'obstacle'));

            // add Player units
            this.initData.player.units.forEach((unit)=>{
                this.units.push(new unit.constructors.battle(this, 0, 5, false));
            });

            // add Enemy units
            this.initData.enemy.units.forEach((unit)=>{
                this.units.push(new unit.constructors.battle(this, 14, 5, true));
            });



            this.units[0].startTurn();
        }
    }

}