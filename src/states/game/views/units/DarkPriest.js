import Unit from '../Unit';

export default class DarkPriest extends Unit {

    constructor(state, xId, yId, flip, color) {

        super(state, 'darkPriest'+color, xId, yId, flip, 2, 1);

        //this.scale.x *= 0.8;
        //this.scale.y *= 0.8;

        this.inputEnabled = true;
        this.input.enableDrag(true);
    }
}
