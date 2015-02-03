module battle {
    export class Wolf extends battle.Unit {

        constructor(state: State, xId: number, yId: number, name: string) {

            super(state, name, xId, yId, 4, 1);

            this.inputEnabled = true;
            this.input.enableDrag(true);
        }
    }
}