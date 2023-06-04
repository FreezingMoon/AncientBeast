import { isEmpty, getGameConfig } from '../script';
import { DEBUG_DISABLE_GAME_STATUS_CONSOLE_LOG } from '../debug';
import { major_minor as version } from './version';

export class GameLog {
	constructor(id, game) {
		this.game = game;
		this.data = [];
		this.playing = false;
		this.timeCursor = -1;
		// Set this to null so we can properly decide between form based config or log based config
		this.gameConfig = null;
	}

	reset() {
		this.data = [];
		this.playing = false;
		this.timeCursor = -1;
		this.gameConfig = null;
	}

	add(action) {
		this.data.push(action);
	}

	config(config) {
		const game = this.game;

		if (game.gameState != 'initialized') {
			alert('To set the game config, you need to be in the setup screen');
		} else {
			game.loadGame(config);
			this.gameConfig = config;
		}
	}

	play(log) {
		const game = this.game;
		let config;
		let data;

		if (typeof log == 'object' && !log.length) {
			data = log.log;
			config = log.config;
			this.data = data;
			return this.config(config);
		} else if (typeof log == 'string') {
			const results = log.match(/^AB-(dev|[0-9.]+)(\@[0-9\-]+)?:(.+)$/);
			if (results) {
				log = JSON.parse(atob(results[3]));
				return this.play(log);
			}
		}

		if (log) {
			this.data = log;
		}

		const fun = () => {
			this.timeCursor++;

			if (!DEBUG_DISABLE_GAME_STATUS_CONSOLE_LOG) {
				console.log(this.timeCursor + '/' + this.data.length);
			}

			if (this.timeCursor > this.data.length - 1) {
				// game.activeCreature.queryMove(); // Avoid bug: called twice breaks opening UI (may need to revisit)
				return;
			}

			const interval = setInterval(() => {
				if (!game.freezedInput && !game.turnThrottle) {
					clearInterval(interval);
					game.activeCreature.queryMove();
					game.action(this.data[this.timeCursor], {
						callback: fun,
					});
				}
			}, 100);
		};

		fun();
	}

	next() {
		const game = this.game;

		if (game.freezedInput || game.turnThrottle) {
			return false;
		}

		this.timeCursor++;
		if (!DEBUG_DISABLE_GAME_STATUS_CONSOLE_LOG) {
			console.log(this.timeCursor + '/' + this.data.length);
		}

		if (this.timeCursor > this.data.length - 1) {
			game.activeCreature.queryMove(); // Avoid bug
			return;
		}

		const interval = setInterval(() => {
			if (!game.freezedInput && !game.turnThrottle) {
				clearInterval(interval);
				game.activeCreature.queryMove(); // Avoid bug
				game.action(this.data[this.timeCursor], {
					callback: function () {
						game.activeCreature.queryMove();
					},
				});
			}
		}, 100);
	}

	get(state) {
		const today = new Date().toISOString().slice(0, 10);
		const config = isEmpty(this.gameConfig) ? getGameConfig() : this.gameConfig;
		const dict = {
			config: config,
			log: this.data,
		};
		// TODO:
		// The `replacer` in `JSON.stringify` was added as a bugfix for #2323
		// Some abilities have a circular reference that can't be stringified - `sourceCreature`.
		// The fix doesn't really fit here, but it's currently the only place where it
		// doesn't cause an error to be thrown and doesn't break game playback.
		// The replacer should really be factored into individual abilities, to
		// allow them to be serialized.
		// Note that several options exist to serialize circular references, but
		// when added here, they result in serialized strings larger than 100 MB.
		const json = JSON.stringify(dict, (key, value) => (key === 'sourceCreature' ? {} : value));
		const hash = 'AB-' + version + '@' + today + ':' + btoa(json);
		let output;
		let strOutput;
		const fileName = `AB-${version}:${today}`;

		switch (state) {
			case 'json':
				output = dict;
				strOutput = json;
				break;
			case 'save':
				// Do not allow this to happen more than once per second
				if (this._debounce) {
					return;
				}
				this.saveFile(json, `${fileName}.ab`);
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

	saveFile(data, fileName) {
		// Set a trap to block consecutive calls within one second
		this._debounce = new Date().valueOf();
		const a = document.createElement('a');
		const file = new Blob([data]);
		const url = URL.createObjectURL(file);
		a.href = url;
		a.download = fileName;
		document.body.appendChild(a);
		a.click();
		setTimeout(() => {
			document.body.removeChild(a);
			window.URL.revokeObjectURL(url);
			// Remove trap to allow future save calls
			this._debounce = null;
		}, 1000);
	}
}
