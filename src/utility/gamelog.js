var Gamelog = Class.create({

	initialize: function(id) {
		this.datas = [];
		this.playing = false;
		this.timeCursor = -1;
	},

	add: function(action) {
		this.datas.push(action);
	},

	play: function(log) {

		if (log) {
			this.datas = log;
		}

		var fun = function() {
			G.gamelog.timeCursor++;
			if (G.debugMode) console.log(G.gamelog.timeCursor + "/" + G.gamelog.datas.length);
			if (G.gamelog.timeCursor > G.gamelog.datas.length - 1) {
				G.activeCreature.queryMove(); // Avoid bug
				return;
			}
			var interval = setInterval(function() {
				if (!G.freezedInput && !G.turnThrottle) {
					clearInterval(interval);
					G.activeCreature.queryMove(); // Avoid bug
					G.action(G.gamelog.datas[G.gamelog.timeCursor], {
						callback: fun
					});
				}
			}, 100);
		};
		fun();
	},

	next: function() {
		if (G.freezedInput || G.turnThrottle) return false;

		G.gamelog.timeCursor++;
		if (G.debugMode) console.log(G.gamelog.timeCursor + "/" + G.gamelog.datas.length);
		if (G.gamelog.timeCursor > G.gamelog.datas.length - 1) {
			G.activeCreature.queryMove(); // Avoid bug
			return;
		}
		var interval = setInterval(function() {
			if (!G.freezedInput && !G.turnThrottle) {
				clearInterval(interval);
				G.activeCreature.queryMove(); // Avoid bug
				G.action(G.gamelog.datas[G.gamelog.timeCursor], {
					callback: function() {
						G.activeCreature.queryMove();
					}
				});
			}
		}, 100);
	},

	get: function() {
		console.log(JSON.stringify(this.datas));
	}
});
