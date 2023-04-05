import _ from 'underscore';
import * as $j from 'jquery';

export default class MatchI {
	constructor(connect, game, session, gameplay) {
		this.game = game;
		this.socket = connect.socket;
		this.session = session;
		this.host = null;
		this.matchTurn = 1;
		this.userTurn = null;
		this.matchData = {};
		this.configData = {};
		this.users = [];
		this.activePlayer = 0;
		this.client = connect.client;
		this.matchUsers = [];

		connect.socket.onmatchmakermatched = (matched) => {
			this.matchUsers = matched.users;
			if (this.host != this.session.user_id) {
				this.storeMatches();
			}
			this.game.updateLobby();
		};

		connect.socket.ondisconnect = (event) => {
			console.info('Disconnected from the server. Event:', event);
		};

		connect.socket.onmatchpresence = (md) => {
			if (md.leaves) {
				this.game.UI.banner(md.leaves.username + ' left match');
				location.reload();
				return;
			}
			// Only host sends data
			if (this.host === this.session.user_id) {
				const u = this.users.length;
				this.users.push({ id: md.joins[0].user_id, playername: md.joins[0].username, turn: u });

				// Called after match join. Player 1 is host sends match config
				if (this.users.length > 1 && md.joins[0].user_id != this.users[0].id) {
					this.sendMatchData({
						match_id: this.matchData.match_id,
						op_code: '1',
						data: { users: this.users, host: this.host, matchdata: this.matchData },
					});

					if (this.game.configData.playerMode === this.users.length) {
						this.game.freezedInput = false;
						this.game.UI.banner(this.users[this.activePlayer].playername + ' turn');
					}
				}
				// console.log('match users', this.users);
				this.users.forEach((v, i) => {
					this.game.players[i].name = this.users[i].playername;
				});
			}
		};

		connect.socket.onmatchdata = (md) => {
			console.info('Received match data: %o', md);
			const op_code = md.op_code;

			switch (op_code) {
				// Host shares config with players on join
				case 1:
					this.users = md.data.users;
					this.host = md.data.users.host;
					this.matchData = md.data.matchdata;
					this.userTurn = this.getUserTurn();
					console.log('match users', this.users);
					this.game.UI.banner(this.users[this.activePlayer].playername + ' turn');
					game.freezedInput = true;
					break;
				case 2:
					game.skipTurn();
					this.game.UI.banner(this.users[md.data.activePlayer].playername + ' turn');
					game.gamelog.add({
						action: 'skip',
					});
					break;
				case 3:
					game.delayCreature();
					game.gamelog.add({
						action: 'delay',
					});
					break;
				case 4:
					game.activeCreature.moveTo(game.grid.hexes[md.data.target.y][md.data.target.x]);
					game.gamelog.add({
						action: 'move',
						target: {
							x: md.data.target.x,
							y: md.data.target.y,
						},
					});
					break;
				case 5:
					const args = $j.makeArray(md.data.args[1]);

					if (md.data.target.type == 'hex') {
						args.unshift(game.grid.hexes[md.data.target.y][md.data.target.x]);
						game.activeCreature.abilities[md.data.id].animation2({
							arg: args,
						});
						game.gamelog.add({
							action: 'ability',
							target: {
								type: 'hex',
								x: md.data.target.x,
								y: md.data.target.y,
							},
							id: md.data.id,
							args: args,
						});
					}

					if (md.data.target.type == 'creature') {
						args.unshift(game.creatures[md.data.target.crea]);
						game.activeCreature.abilities[md.data.id].animation2({
							arg: args,
						});
						game.gamelog.add({
							action: 'ability',
							target: {
								type: 'creature',
								crea: md.data.target.crea,
							},
							id: md.data.id,
							args: args,
						});
					}

					if (md.data.target.type == 'array') {
						const array = md.data.target.array.map((item) => game.grid.hexes[item.y][item.x]);

						args.unshift(array);
						game.activeCreature.abilities[md.data.id].animation2({
							arg: args,
						});
						game.gamelog.add({
							action: 'ability',
							target: {
								type: 'array',
								array: array,
							},
							id: md.data.id,
							args: args,
						});
					}
					break;
			}
		};
	}
	getUserTurn() {
		const p = _.findWhere(this.users, { id: this.session.user_id });
		return p.turn;
	}
	async matchCreate() {
		const nm = await this.socket.send({ match_create: {} });
		this.matchData = nm.match;
		this.game.log(this.session.username + ' created match');
		this.host = this.session.user_id;
		this.userTurn = 0;
		this.game.UI.banner('Waiting for Players');
		return Promise.resolve(nm);
	}
	async readMatches() {
		if (typeof Storage !== 'undefined') {
			let obj = await localStorage.getItem('matches');
			if (obj) {
				obj = JSON.parse(obj);
				return obj;
			}
			return this.matchUsers;
		}
	}
	async storeMatches() {
		if (typeof Storage !== 'undefined') {
			const obj = JSON.stringify(this.matchUsers);
			localStorage.setItem('matches', obj);
			console.log('matches stored.');
		}
	}
	async matchMaker(d, gc) {
		const matchList = await this.client.listMatches(this.session);
		let matchUsers = await this.readMatches();
		matchUsers = _.filter(matchUsers, function (obj) {
			console.log(obj);
			if ('string_properties' in obj && typeof obj.string_properties.match_id != 'undefined') {
				const c = _.findWhere(matchList.matches, { match_id: obj.string_properties.match_id });
				if (c) return true;
			}
		});

		if (matchUsers.length > 0) {
			this.matchUsers = matchUsers;
			this.game.updateLobby();
			return;
		}
		if (typeof Storage !== 'undefined') {
			localStorage.removeItem('matches');
		}
		let ticket;
		const obj = {
			min_count: 2,
			max_count: 20,
			query: '*',
			string_properties: {},
			numeric_properties: {},
		};
		// Only host
		if (d && gc) {
			obj.string_properties = {
				match_id: d.match.match_id,
				background_image: gc.background_image,
			};
			obj.numeric_properties = {
				abilityUpgrades: gc.abilityUpgrades,
				creaLimitNbr: gc.creaLimitNbr,
				plasma_amount: gc.plasma_amount,
				playerMode: gc.playerMode,
				timePool: gc.timePool,
				turnTimePool: gc.turnTimePool,
				unitDrops: gc.unitDrops,
			};
		}

		const message = { matchmaker_add: obj };
		try {
			ticket = await this.socket.send(message);
		} catch (e) {
			console.log('unable to join matchmaker', e);
			return;
		}

		return ticket;
	}
	async matchJoin(id) {
		let nj;
		try {
			nj = await this.socket.send({ match_join: { match_id: id } });
		} catch (e) {
			console.log('match no longer exists', e);
			return;
		}
		return Promise.resolve(nj);
	}

	async sendMatchData(obj) {
		console.log('send match data', obj);
		let data;
		try {
			data = await this.socket.send({ match_data_send: obj });
		} catch (e) {
			console.log('error sending data', e);
			this.sendMatchData(obj);
		}
		return Promise.resolve(data);
	}
}
