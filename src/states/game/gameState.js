import TileCtrl from './controllers/tile.ctrl.js';

export default class extends Phaser.State {

    create() {

        this.attacker = {};
        this.defender = {};
        this.turn = 0;

        new TileCtrl();
    }
}