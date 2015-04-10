import Unit from '../Unit';

export default class Wolf extends Unit {

    constructor(state, xId, yId, flip) {

        super(state, 'wolf', xId, yId, flip, 5, 1);

        this.scale.x *= 0.8;
        this.scale.y *= 0.8;

        this.inputEnabled = true;
        this.input.enableDrag(true);
    }
}
