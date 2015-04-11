export default class extends Phaser.Plugin {

    constructor() {

        super(game);
        this.active = true; // enable update()
        this.visible = true; // enable render()
        game.plugins.add(this);

    }

    /*

    preUpdate(){

    }

    update(){

    }

    render(){

    }

    */
}