import _ from 'underscore';

export default class MatchI {
	constructor(socket, game, session) {
		this.game = game;
		this.socket = socket;
		this.session = session;
		this.user = session.username;
		this.player1 = null;
		this.player2 = null;
		this.props = {};
		this.turn = false;

		socket.onmatchpresence = (matchdata) => {
			console.log(matchdata);
			// for player1 client when player2 joins match
			if (this.player2 === matchdata.joins[0].username) {
				//TO Do additional players
				if (this.user == this.player1) {
					game.freezedInput = false;
				} else if (this.user == this.player2) {
					game.freezedInput = true;
				}
				game.log('Received match presence update:', matchdata.joins[0].username);
				game.log(this.player1 + ' turn');
			}

			// player 1 join
			if (this.player1 === matchdata.joins[0].username) {
				if (this.user == this.player1) {
					game.freezedInput = false;
				}
				console.info('Received match presence update:', matchdata.joins[0].username);
			}
		};

		socket.onmatchdata = (matchdata) => {
			console.info('Received match data: %o', matchdata);
			if (matchdata) {
			}
		};
	}

	async matchCreate(s, c) {
		let nm = await this.socket.send({ match_create: {} });
		this.player1 = this.session.username;
		this.props = nm;
    return Promise.resolve(nm);
	}
	async matchJoin(s, c) {
		let nj;
    this.player2 = this.session.username;
		var matchList = await c.listMatches(s);
		var openMatch = _.findWhere(matchList.matches, { size: 1 });

		if (openMatch) {
			nj = await this.socket.send({ match_join: { match_id: openMatch.match_id } });
			console.log(`joined match ${openMatch.match_id}`, nj);
			this.props = nj;
			this.player2 = this.session.username;
      return Promise.resolve(nj);
		}
	}

	sendMatchData(obj) {
		this._socket.send({ match_data_send: obj });
	}
}
