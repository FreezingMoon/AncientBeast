import _ from 'underscore';

export default class MatchI {
	constructor(server, game, session) {
		this.game = game;
		this.socket = server.socket;
		this.session = session;
		this.host = null;
		//TODO total number of players;
		this.matchTurn = 1;
		this.userTurn = null;
		this.matchData = {};
		this.configData = {};
		this.players = [];
		this.activePlayer = null;
		this.client = server.client;

		server.socket.onmatchpresence = (md) => {
			//only host

			console.log(md.joins[0]);
			if (this.host === this.session.user_id) {
				let p = this.players.length;
				p++;
				this.players.push({ id: md.joins[0].user_id, playername: md.joins[0].username, turn: p });
				this.userTurn = 1;

				//called after match join. Player 1 is host sends match config
				if (this.players.length > 1 && md.joins[0].user_id != this.players[0].id) {
					this.sendMatchData({
						match_id: this.matchData.match_id,
						op_code: 'op_load',
						data: { config: this.configData, players: this.players, host: this.host },
					});
				}
				console.log('players' + this.players);
			}
		};

		server.socket.onmatchdata = (md) => {
			console.info('Received match data: %o', md);
			let op_code = md.op_code;

			switch (op_code) {
				//host shares config with players on join
				case 'op_load':
					this.players = md.data.players;
					this.host = md.data.players.host;
					this.configData = md.data.config;
					this.userTurn = this.getUserTurn();
					break;
				case 'op_skipTurn':
					game.skipTurn();
					this.turn = md.data.turn;
					break;
			}
		};
	}
	getUserTurn() {
		let p = _.findWhere(this.players, { id: this.session.user_id });
		console.log(p);
		return p.turn;
	}
	async matchCreate() {
		let nm = await this.socket.send({ match_create: {} });
		this.matchData = nm.match;
		this.game.log(this.session.username + ' created match');
		this.host = this.session.user_id;
		this.configData = this.game.setupOpt;
		return Promise.resolve(nm);
	}
	async matchJoin(s) {
		let nj;
		let matchList = await this.client.listMatches(this.session);
		//TODO replace with lobby
		let openMatch = _.findWhere(matchList.matches, { size: 1 });
		if (openMatch) {
			nj = await this.socket.send({ match_join: { match_id: openMatch.match_id } });
			this.matchData = openMatch;
			return Promise.resolve(nj);
		}
	}
	turnChange() {
		let t = this.matchTurn;
		t++;
		if (t === this.players.length) {
			t = 1;
		}
		this.matchTurn = t;
		console.log(this.matchTurn);
	}
	async skipTurn() {
		if (this.matchTurn != this.userTurn) {
			return;
		}

		this.turnChange();
		let id = this.matchData.match_id;
		let opCode = 'op_skipTurn';
		let data = { turn: this.matchTurn };
		await this.sendMatchData({ match_data_send: { match_id: id, op_code: opCode, data: data } });
		this.game.log(this.session.username + ' ended turn');
	}

	async sendMatchData(obj) {
		let data = await this.socket.send({ match_data_send: obj });
		return Promise.resolve(data);
	}
}
