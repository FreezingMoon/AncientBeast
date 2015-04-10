export default class extends Phaser.Sprite {

    constructor(state, x, y, name) {

        super(state.game, x, y, name);

        state.game.add.existing(this);

        this.anchor.setTo(0.5);
        this.alpha = 0;

        this.tween = state.game.add.tween(this);
        this.tweenIn();
    }

    tweenIn(){
        this.tween.to( { alpha: 1 }, 1500, 'Quad.easeInOut', true,0,-1,true);
    }
}
