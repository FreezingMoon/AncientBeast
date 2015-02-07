module battle {
    export class DarkPriest extends battle.Unit {

        constructor(state: State, xId: number, yId: number, flip:boolean, color:string) {

            super(state, 'darkPriest'+color, xId, yId, flip, 2, 1);

            //this.scale.x *= 0.8;
            //this.scale.y *= 0.8;

            this.inputEnabled = true;
            this.input.enableDrag(true);
        }
    }
}