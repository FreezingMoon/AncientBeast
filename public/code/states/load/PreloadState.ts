module preload {
    export class State extends Phaser.State {

        nextState:string;

        init(nextState){

            this.nextState = nextState;
            this.game.scale.scaleMode = Phaser.ScaleManager.EXACT_FIT;
        }

        preload() {

            this.load.image('ugnis', 'images/ugnis.jpg');
        }

        create() {

            this.game.state.start('loadState', false, false, this.nextState);
        }

    }
}