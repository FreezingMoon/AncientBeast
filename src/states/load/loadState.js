import Logo from './views/Logo.js'

export default class extends Phaser.State {

    init(){

        new Logo(this, this.game.width/2, this.game.height/2, 'ugnis');
    }

    preload() {

        /*
            LOAD EVERY FILE HERE
         */

        this.load.image('background', 'images/bg.jpg');
        this.load.image('hex',        'images/hex.png');
        this.load.image('hexRed',     'images/hex_red.png');
        this.load.image('hexPath',    'images/hex_path.png');
        this.load.image('obstacle',   'images/obstacle.png');
        this.load.image('wolf',       'images/cyber_hound.png');
        this.load.image('darkPriestRed', 'images/dark_priest_red.png');
        this.load.image('darkPriestBlue', 'images/dark_priest_blue.png');

    }

    create() {

        this.game.state.start('gameState');
    }
}
