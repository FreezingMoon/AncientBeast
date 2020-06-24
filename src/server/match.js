import _ from 'underscore';

export default class MatchI {
	constructor(socket, game, session) {
		this.game = game;
		this.socket = socket;
		this.session = session;
		this.user = session.username;
		//TODO total number of players;
		this.player1 = null;
		this.player2 = null;
		this.turn = false;
		this.matchData = {};
		this.configData = {};

		socket.onmatchpresence = (matchdata) => {
			console.log(matchdata);
			// for player1 client when player2 joins match
			if (this.player1 && this.player1 != matchdata.joins[0].username) {
				//TO Do additional players
				game.freezedInput = false;
				game.log('Received match presence update:', matchdata.joins[0].username);
				game.log(this.player1 + ' turn');
				this.sendMatchData({
					match_id: this.matchData.match_id,
					op_code: 1,
					data: { gcd: this.configData },
				});
			}
			//no match presence code for player 2
		}

		socket.onmatchdata = (matchdata) => {
			console.info('Received match data: %o', matchdata);
			// for player1
			if (this.player1 === this.user) {
			}
			//for all other players
			if (this.player1 != this.user) {
				if(matchdata.op_code===1){
          this.configData=matchdata.data.gcd;

        }
			}
		};
	}

	async matchCreate(s, c) {
		let nm = await this.socket.send({ match_create: {} });
		this.matchData = nm.match;
		this.user = this.session.username;
		this.player1 = this.session.username;
		return Promise.resolve(nm);
	}
	async matchJoin(s, c) {
		let nj;
		let matchList = await c.listMatches(s);
		let openMatch = _.findWhere(matchList.matches, { size: 1 });

		if (openMatch) {
			nj = await this.socket.send({ match_join: { match_id: openMatch.match_id } });
			console.log(`joined match ${openMatch.match_id}`, nj);
			this.matchData = openMatch;
			this.user = this.session.username;
			this.player2 = this.session.username;
			return Promise.resolve(nj);
		}
	}

	sendMatchData(obj) {
		this.socket.send({ match_data_send: obj });
	}
}
