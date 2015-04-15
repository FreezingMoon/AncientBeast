import Unit from '../Unit';
import PF from '../../services/PathfindingHex.js';

export default class DarkPriest extends Unit {

    constructor(xId, yId, flip, color) {

        super('darkPriest'+color, xId, yId, flip, 2, 1);

        //this.scale.x *= 0.8;
        //this.scale.y *= 0.8;

        this.speed = 5;
        this.xId = xId;
        this.yId = yId;

        this.inputEnabled = true;
        this.input.enableDrag(true);

    }

    generatePaths(grid){
        this.pf = new PF(this, grid);
        return this.pf;
    }
}
