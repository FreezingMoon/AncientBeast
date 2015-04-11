import Controller from '../../../classes/Controller.js'

import Tile from '../views/Tile.js';
import Background from '../views/Background.js';
import DarkPriest from '../views/units/DarkPriest.js';

export default class extends Controller {

    constructor(tiles) {

        super();

        new Background();

        this.tiles = [];

        tiles.forEach((row, y)=>{

            let base = y%2 ? 285 : 240;

            row.forEach((tile, x)=>{
                new Tile(base +90 * x, 380 + 62 * y);
            });

        });

    }

    update(){

    }

}