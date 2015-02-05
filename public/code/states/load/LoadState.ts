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
            this.load.image('obstacle',    'images/obstacle.png');
            this.load.image('wolf',       'images/CyberHound.png');
        }

        create() {
            var mockData = {
                player: {
                    units:[
                        {
                            count: 10,
                            constructors:{
                                battle:battle.Wolf
                            }
                        }
                    ]
                },
                enemy:{
                    units:[
                        {
                            count: 20,
                            constructors:{
                                battle:battle.Wolf
                            }
                        }
                    ]
                }
            };

            this.game.state.start(this.nextState, true, false, mockData);
        }

    }
}