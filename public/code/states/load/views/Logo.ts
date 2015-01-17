module load {
    export class Logo extends Phaser.Sprite {

        tween: Phaser.Tween;
        text: Phaser.Text;

        constructor(private state: Phaser.State, data) {

            super(state.game, data.x, data.y, data.name);

            this.anchor.setTo(0.5);
            this.alpha = 0;

            state.game.add.existing(this);

            this.tween = state.game.add.tween(this);
            this.tweenIn();

            this.text = state.game.add.text(this.x, this.y+this.height/2+20, 'LOADING:' +' 0%', {});

            //	Center align
            this.text.anchor.set(0.5, 0.5);
            this.text.align = 'center';

            //	Font style
            this.text.font = 'Arial Black';
            this.text.fontSize = 50;
            this.text.fontWeight = 'bold';

            //	Stroke color and thickness
            this.text.stroke = '#000000';
            this.text.strokeThickness = 6;
            this.text.fill = '#ffffff';

            state.game.load.onFileComplete.add(this.fileComplete, this);
        }

        tweenIn(){
            this.tween.to( { alpha: 1 }, 1500, Phaser.Easing.Quadratic.InOut, true,0,-1,true);
        }

        fileComplete(progress){
            this.text.setText('LOADING: ' + progress +'%');
        }

    }
}