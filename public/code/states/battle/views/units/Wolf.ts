module battle {
    export class Wolf extends battle.Unit {

        constructor(state: State, xId: number, yId: number, flip:boolean) {

            super(state, 'wolf', xId, yId, flip, 4, 1);

            this.scale.x *= 0.8;
            this.scale.y *= 0.8;

            this.inputEnabled = true;
            this.input.enableDrag(true);
        }
    }
}