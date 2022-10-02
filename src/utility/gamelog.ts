import * as $j from 'jquery';
import { IGameConfig } from 'phaser-ce';
import Game from '../game';
import { isEmpty, getGameConfig } from '../script';

export class GameLog {
	//------- Constructor Types ---------//
	game: Game; //Main Game Object
	data: Array<object> //The Messages in the log
	playing: boolean; //Is the game currently running
	timeCursor: number; //The time of the messages
	gameConfig: IGameConfig; //The main game configuraion object
	gameid: number; //Current Game
	_debounce: number; //

	constructor(id:number, game:Game) {
		this.game = game;
		this.data = [];
		this.playing = false;
		this.timeCursor = -1;
		// Set this to null so we can properly decide between form based config or log based config.
		this.gameConfig = null;
		this.gameid = id;
	}

	reset() {
		this.data = [];
		this.playing = false;
		this.timeCursor = -1;
		this.gameConfig = null;
	}

	add(action:object) {
		this.data.push(action);
	}

	config(config:IGameConfig) {
		let game = this.game;

		if (game.gameState != 'initialized') {
			alert('To set the game config, you need to be in the setup screen');
		} else {
			game.loadGame(config, true, this.gameid);
			this.gameConfig = config;
		}
	}

	play(log) {
		let game = this.game,
			config,
			data;

		if (typeof log == 'object' && !log.length) {
			data = log.log;
			config = log.config;
			this.data = data;
			return this.config(config);
		} else if (typeof log == 'string') {
			let results = log.match(/^AB-(dev|[0-9.]+)(\@[0-9\-]+)?:(.+)$/);
			if (results) {
				log = JSON.parse(atob(results[3]));
				return this.play(log);
			}
		}

		if (log) {
			this.data = log;
		}

		let fun = () => {
			this.timeCursor++;

			if (game.debugMode) {
				console.log(this.timeCursor + '/' + this.data.length);
			}

			if (this.timeCursor > this.data.length - 1) {
				// game.activeCreature.queryMove(); // Avoid bug // called twice breaks opening UI. May need to revisit.
				return;
			}

			let interval = setInterval(() => {
				if (!game.freezedInput && !game.turnThrottle) {
					clearInterval(interval);
					game.activeCreature.queryMove(null);
					game.action(this.data[this.timeCursor], {
						callback: fun,
					});
				}
			}, 100);
		};

		fun();
	}

	next() : boolean {
		let game = this.game;

		if (game.freezedInput || game.turnThrottle) {
			return false;
		}

		this.timeCursor++;
		if (game.debugMode) {
			console.log(this.timeCursor + '/' + this.data.length);
		}

		if (this.timeCursor > this.data.length - 1) {
			game.activeCreature.queryMove(null); // Avoid bug
			return;
		}

		let interval = setInterval(() => {
			if (!game.freezedInput && !game.turnThrottle) {
				clearInterval(interval);
				game.activeCreature.queryMove(null); // Avoid bug
				game.action(this.data[this.timeCursor], {
					callback: function () {
						game.activeCreature.queryMove(null);
					},
				});
			}
		}, 100);
	}

	get(state:string) {
		let today = new Date().toISOString().slice(0, 10);
		let config = isEmpty(this.gameConfig) ? getGameConfig() : this.gameConfig,
			dict = {
				config: config,
				log: this.data,
			},
			json = JSON.stringify(dict),
			hash = 'AB-' + this.game.version + '@' + today + ':' + btoa(JSON.stringify(dict)),
			output,
			strOutput;

		let fileName = `AB-${this.game.version}:${today}`;

		switch (state) {
			case 'json':
				output = dict;
				strOutput = json;
				break;
			case 'save':
				// Do not allow this to happen more than once per second.
				if (this._debounce) {
					return;
				}
				this.saveFile(JSON.stringify(dict), `${fileName}.ab`);
				break;
			case 'hash':
				output = hash;
				strOutput = hash;
				break;
			case 'simple':
			default:
				output = `AB.restoreGame('${hash}')`;
				strOutput = output;
		}

		console.log('GameData: ' + strOutput);
		return output;
	}

	saveFile(data, fileName:string) {
		// Set a trap to block consecutive calls within one second.
		this._debounce = new Date().valueOf();
		let a = document.createElement('a');
		let file : Blob = new Blob([data]);
		let url : string = URL.createObjectURL(file);
		a.href = url;
		a.download = fileName;
		document.body.appendChild(a);
		a.click();
		setTimeout(() => {
			document.body.removeChild(a);
			window.URL.revokeObjectURL(url);
			// Remove trap to allow future save calls.
			this._debounce = null;
		}, 1000);
	}
}
