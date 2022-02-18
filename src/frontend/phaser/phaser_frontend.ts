import { FrontEndI } from "./frontend";
import Game from "../game";
import { Animations } from '../animations';
import { CreatureQueue } from '../creature_queue';
import { GameLog } from '../utility/gamelog';
import { SoundSys } from '../sound/soundsys';
import { MusicPlayer } from '../sound/musicplayer';
import { Hex } from '../utility/hex';
import { HexGrid } from '../utility/hexgrid';
import { getUrl } from '../assetLoader';
import { Player } from '../player';
import { UI } from '../ui/interface';
import { Creature } from '../creature';
import dataJson from '../data/units.json';
import 'pixi';
import 'p2';
import Phaser, { Signal } from 'phaser-ce';
import MatchI from '../multiplayer/match';
import Gameplay from '../multiplayer/gameplay';
import { sleep } from '../utility/time';


export class PhaserFrontEnd implements FrontEndI {
	game: Game;
	phaser: Phaser;
	signals: [];

	constructor(game: Game) {
			// Phaser
		this.phaser = new Phaser.Game(1920, 1080, Phaser.AUTO, 'combatwrapper', {
			update: this.phaserUpdate.bind(this),
			render: this.phaserRender.bind(this),
		});

		const signalChannels = ['ui', 'metaPowers', 'creature'];
		this.signals = this.setupSignalChannels(signalChannels);
	}

	load(): void {
    console.log("PhaserFrontEnd: load");
	}

	unload(): void {
    console.log("PhaserFrontEnd: unload");
	}

	update(dt: Number): void {
    console.log("PhaserFrontEnd: update, dt=" + dt);
	}

	render(dt: Number): void {
    console.log("PhaserFrontEnd: update, dt=" + dt);
	}

	phaserUpdate() {
		if (this.game.gameState != 'playing') {
			return;
		}
	}

	phaserRender() {
		let count = this.game.creatures.length,
			i;

		for (i = 1; i < count; i++) {
			//G.Phaser.debug.renderSpriteBounds(G.creatures[i].sprite);
		}
	}


	/**
	 * Setup signal channels based on a list of channel names.
	 *
	 * @example setupSignalChannels(['ui', 'game'])
	 * // ... another file
	 * this.game.signals.ui.add((message, payload) => console.log(message, payload), this);
	 *
	 * @see https://photonstorm.github.io/phaser-ce/Phaser.Signal.html
	 *
	 * @param {array} channels List of channel names.
	 * @returns {object} Phaser signals keyed by channel name.
	 */
	setupSignalChannels(channels) {
		const signals = channels.reduce((acc, curr) => {
			return {
				...acc,
				[curr]: new Signal(),
			};
		}, {});

		return signals;
	}

	addGroup(name: String) {

	}

}

class Group {
	handle: Phaser.Group;

	constructor(ctx: any) {
		this.handle = new Phaser.Group(ctx.phaserGame);
	}

	create(x: number, y: number, key: string): Sprite {
		const spriteHandle = this.handle.create(x, y, key);
		return new Sprite(spriteHandle);
	}
}

class Sprite {
	handle: Phaser.Sprite;

	constructor(handle?: Phaser.Sprite) {
		this.handle = handle;
	}
}
