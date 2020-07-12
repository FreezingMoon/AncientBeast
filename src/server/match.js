import _ from 'underscore';
import * as $j from 'jquery';


export default class MatchI {
	constructor(connect, game, session) {
		this.game = game;
		this.socket = connect.socket;
		this.session = session;
		this.host = null;
		//TODO total number of players;
		this.matchTurn = 1;
		this.userTurn = null;
		this.matchData = {};
		this.configData = {};
		this.players = [];
		this.activePlayer = null;
		this.client = connect.client;

		connect.socket.onmatchpresence = (md) => {
			if (this.host === this.session.user_id) {
				let p = this.players.length;
				p++;
				this.players.push({ id: md.joins[0].user_id, playername: md.joins[0].username, turn: p });
				this.userTurn = 1;

				//called after match join. Player 1 is host sends match config
				if (this.players.length > 1 && md.joins[0].user_id != this.players[0].id) {
					this.sendMatchData({
						match_id: this.matchData.match_id,
						op_code: '1',
						data: { config: this.configData, players: this.players, host: this.host },
					});
					this.game.freezedInput = false;
					console.log(this.players);
					this.game.UI.banner(this.players[this.matchTurn - 1].playername + ' turn');
				}
				console.log('players' + this.players);
			}
		};

		connect.socket.onmatchdata = (md) => {
			console.info('Received match data: %o', md);
			let op_code = md.op_code;

			switch (op_code) {
				//host shares config with players on join
				case 1:
					this.players = md.data.players;
					this.host = md.data.players.host;
					this.configData = md.data.config;
					this.userTurn = this.getUserTurn();

					this.game.UI.banner(this.players[this.matchTurn - 1].playername + ' turn');
					break;
				case 2:
					game.skipTurn();
					this.matchTurn = md.data.turn;
					this.game.UI.banner(this.session.username + ' turn');

					break;
				case 3:
					game.delayCreature();
          break;
        case 4:
            game.activeCreature.moveTo(game.grid.hexes[md.data.target.y][md.data.target.x]);
           
            break;
        case 5:
          let args = $j.makeArray(md.data.args[1]);

          if (md.data.target.type == 'hex') {
            args.unshift(game.grid.hexes[md.data.target.y][md.data.target.x]);
            game.activeCreature.abilities[md.data.id].animation2({           
              arg:args,
            });
          }
  
          if (md.data.target.type == 'creature') {
            args.unshift(game.creatures[md.data.target.crea]);
            game.activeCreature.abilities[md.data.id].animation2({
                      arg: args,
            });
          }
  
          if (md.data.target.type == 'array') {
            let array = md.data.target.array.map((item) => game.grid.hexes[item.y][item.x]);
  
            args.unshift(array);
            game.activeCreature.abilities[md.data.id].animation2({
 
              arg: args,
            });
          }            
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
		if (t > this.players.length) {
			t = 1;
		}
		this.matchTurn = t;
		console.log(this.matchTurn);
	}
  moveTo(o){
    
    if (this.matchTurn != this.userTurn) {
			return;
    }
    let data =o;
    let id = this.matchData.match_id;
		let opCode = '4';
    this.sendMatchData({ match_id: id, op_code: opCode, data: data });
    this.game.UI.active = true;
  
  }
  useAbility(o){
   
    if (this.matchTurn != this.userTurn) {
			return;
    }
    let data=o;
    let id = this.matchData.match_id;
		let opCode = '5';
    this.sendMatchData({ match_id: id, op_code: opCode, data: data });
    this.game.UI.active = true;

  }

	skipTurn() {
		//for non active player
		if (this.matchTurn != this.userTurn) {
			this.game.UI.active = true;
			return;
		}
		//for active player
		this.turnChange();
		let id = this.matchData.match_id;
		let opCode = '2';
		let data = { turn: this.matchTurn};
		this.sendMatchData({ match_id: id, op_code: opCode, data: data });
		this.game.UI.active = false;
		this.game.UI.banner(this.players[this.matchTurn - 1].playername + ' turn');
	}

	delay() {
		if (this.matchTurn != this.userTurn) {
			return;
		}
		let id = this.matchData.match_id;
		let opCode = '3';
		let data = { turn: this.matchTurn };
		this.sendMatchData({ match_id: id, op_code: opCode, data: data });
	}

	async sendMatchData(obj) {
   
		let data = await this.socket.send({ match_data_send: obj });
		return Promise.resolve(data);
	}
}
