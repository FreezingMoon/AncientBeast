var Gamelog = class GameLog {
	constructor(id, game) {
		this.game = game;
		this.data = [];
		this.playing = false;
		this.timeCursor = -1;
		this.gameConfig = {};
	}

	add(action) {
		this.data.push(action);
	}

	config(config) {
		let game = this.game;

		if (game.gameState != 'initialized') {
			alert('To set the game config, you need to be in the setup screen');
		} else {
			game.loadGame(config);
			this.gameConfig = config;
		}
	}

	play(log) {
		let game = this.game;

		if (log) {
			this.data = log;
		}

		let fun = () => {
			this.timeCursor++;

			if (game.debugMode) {
				console.log(this.timeCursor + "/" + this.data.length);
			}

			if (this.timeCursor > this.data.length - 1) {
				game.activeCreature.queryMove(); // Avoid bug
				return;
			}

			let interval = setInterval(() => {
				if (!game.freezedInput && !game.turnThrottle) {
					clearInterval(interval);
					game.activeCreature.queryMove(); // Avoid bug
					game.action(this.data[this.timeCursor], {
						callback: fun
					});
				}
			}, 100);
		};

		fun();
	}

	next() {
		let game = this.game;

		if (game.freezedInput || game.turnThrottle) {
			return false;
		}

		this.timeCursor++;
		if (game.debugMode) {
			console.log(this.timeCursor + "/" + this.data.length);
		}

		if (this.timeCursor > this.data.length - 1) {
			game.activeCreature.queryMove(); // Avoid bug
			return;
		}

		let interval = setInterval(() => {
			if (!game.freezedInput && !game.turnThrottle) {
				clearInterval(interval);
				game.activeCreature.queryMove(); // Avoid bug
				game.action(this.data[this.timeCursor], {
					callback: function() {
						game.activeCreature.queryMove();
					}
				});
			}
		}, 100);
	}

	get() {
		let config = {};

		if (isEmpty(this.gameConfig)) {
			config = getGameConfig();
		} else {
			config = this.gameConfig;
		}

		console.log('Config :' + JSON.stringify(config))
		console.log('Gamelog :' + JSON.stringify(this.data));
	}
};
