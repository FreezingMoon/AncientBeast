import _ from 'underscore';
import game from '../game';

export default class MatchI {
	constructor(socket) {
		this._socket = socket;

		socket.onmatchpresence = (matchpresence) => {
			console.info('Received match presence update:', matchpresence.joins[0].username);
		};
		socket.onmatchdata = (matchdata) => {
			console.info('Received match data: %o', matchdata);
		};
	}

	async matchCreate() {
		return this._socket.send({ match_create: {} }).then((m) => {
			return m;
		});
	}
	async matchJoin(session, client) {
		var matchList = await client.listMatches(session);
    var openMatch = _.findWhere(matchList, { size: 1 });
    console.log(openMatch);
		if (openMatch) {
			return this._socket.send({ match_join: { match_id: id } }).then((m) => {
				console.log(`joined match ${openMatch.match_id}`, m);
				return m;
			});
		}
	}
}
