export default class Tile extends Phaser.Sprite {

    constructor(x, y) {

        super(game, x, y, 'hex');

        this.anchor.setTo(0.5);
        this.scale.y = 0.8;

        game.add.existing(this);

        this.inputEnabled = true;

        this.events.onInputOver.add(this.over, this);
        this.events.onInputOut.add(this.out, this);
    }

    over(){
        this.changeColor();
    }

    out(){
        this.revertColor();
    }

    changeColor(){
        this.loadTexture('hexPath', 0);
    }

    revertColor(){
        this.loadTexture('hex', 0);
    }

}
