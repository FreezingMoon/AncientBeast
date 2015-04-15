import Controller from '../../../classes/Controller.js'

import HexMap from '../services/hex-pathfinder';

import Tile from '../views/Tile.js';
import Background from '../views/Background.js';
import DarkPriest from '../views/units/DarkPriest.js';

export default class TileCtrl extends Controller {

    constructor() {

        super();

        let tiles = [ // 16-15 x 11
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
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
        ];

        var tileMap = new HexMap(tiles);

        new Background();

        this.tiles = [];

        tiles.forEach((row, y)=>{

            let tempRow = [];
            let base = y%2 ? 285 : 240;

            row.forEach((tile, x)=>{
                tempRow.push(new Tile(base +90 * x, 380 + 62 * y));
            });

            this.tiles.push(tempRow);
        });

        // testing PF
        let DP = new DarkPriest(0, 5, false, 'Red');

        let paths = DP.generatePaths(tiles);

        tiles.forEach((row, y)=>{
            row.forEach((tile, x)=>{
                if(paths.getPath(x,y)){
                    this.tiles[y][x].mark();
                }
            });
        });

        // end of test

    }

    update(){

    }

}