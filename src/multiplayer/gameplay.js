import * as $j from 'jquery';

export default class Gameplay {
	constructor(game, match) {
		this.game = game;
		this.match = match;
		this.matchTurn = 1;
		this.matchData = {};
		this.configData = {};
		this.players = game.players;
		this.activePlayer = null;
		this.matchUsers = [];
	}

	moveTo(o) {
		if (this.game.activeCreature.player.id != this.match.userTurn) {
			return;
		}
		let data = o;
		let id = this.match.matchData.match_id;
		let opCode = '4';
		this.match.sendMatchData({ match_id: id, op_code: opCode, data: data });
		this.game.UI.active = true;
	}
	useAbility(o) {
		if (this.game.activeCreature.player.id != this.match.userTurn) {
			return;
		}
		let data = o;
		let id = this.match.matchData.match_id;
		let opCode = '5';
		this.match.sendMatchData({ match_id: id, op_code: opCode, data: data });
		this.game.UI.active = true;
	}
	turnChange() {
		let t = this.matchTurn;
		t++;
		if (t >= this.match.users.length) {
			t = 0;
		}
		this.matchTurn = t;
		console.log('match turn', this.matchTurn);
	}
	updateTurn() {
		this.matchTurn = this.game.activeCreature.player.id;
		//for non active player

		if (this.game.activeCreature.player.id === this.match.userTurn) {
			return;
		}
		//for active player
		this.game.UI.banner(this.match.users[this.matchTurn].playername + ' turn');
		this.turnChange();
		let id = this.match.matchData.match_id;
		let opCode = '2';
		let data = { turn: this.matchTurn };
		this.match.sendMatchData({ match_id: id, op_code: opCode, data: data });
		this.game.UI.active = false;
	}

	delay() {
		if (this.game.activeCreature.player.id != this.match.userTurn) {
			return;
		}
		let id = this.matchData.match_id;
		let opCode = '3';
		let data = { turn: this.matchTurn };
		this.match.sendMatchData({ match_id: id, op_code: opCode, data: data });
	}
}
