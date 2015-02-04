module load {
    export class State extends Phaser.State {

        nextState:string;

        init(nextState){

            this.nextState = nextState;
        }

        preload() {

            // show loading
            new Logo(this, {x: this.game.width/2, y: this.game.height/2, name:'ugnis'});

            this.load.image('background', 'images/bg2.jpg');
            this.load.image('hex',        'images/hex.png');
            this.load.image('hexRed',     'images/hex_red.png');
            this.load.image('hexPath',    'images/hex_path.png');
            this.load.image('unit',       'images/CyberHound.png');
        }

        create() {

            this.game.state.start(this.nextState);
        }

    }
}