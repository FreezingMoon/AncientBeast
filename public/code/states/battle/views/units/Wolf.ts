module battle {
    export class Wolf extends battle.Unit {

        constructor(state: State, xId: number, yId: number, name: string) {

            super(state, xId, yId, name);

            this.inputEnabled = true;
            this.input.enableDrag(true);
        }
    }
}