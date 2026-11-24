import { PeerLobbyProvider } from '../../multiplayer/PeerLobbyProvider';
import Game from '../../game';
import type {
	GameConfig,
	GameMessage,
	ITransport,
	LobbyPlayer,
	PeerId,
	TransportConnectOptions,
} from '../../multiplayer/types';

class FakeTransport implements ITransport {
	private myId = '';
	private messageHandler: (data: GameMessage, peerId: PeerId) => void = () => {};
	private peerJoinHandler: (peerId: PeerId) => void = () => {};
	private peerLeaveHandler: (peerId: PeerId) => void = () => {};
	private connectedHandler: (peerId: PeerId) => void = () => {};

	readonly broadcasts: GameMessage[] = [];
	readonly directMessages: Array<{ peerId: PeerId; data: GameMessage }> = [];
	readonly forwardedMessages: Array<{ peerId: PeerId; data: GameMessage }> = [];

	async connect(_lobbyId: string, options: TransportConnectOptions = {}): Promise<void> {
		this.myId = options.isHost ? options.hostPeerId ?? 'peer-host' : 'peer-client';
	}

	disconnect(): void {}

	async send(data: GameMessage): Promise<void> {
		this.broadcasts.push(data);
	}

	async sendTo(peerId: PeerId, data: GameMessage): Promise<void> {
		this.directMessages.push({ peerId, data });
	}

	async sendExcept(peerId: PeerId, data: GameMessage): Promise<void> {
		this.forwardedMessages.push({ peerId, data });
	}

	onMessage(cb: (data: GameMessage, peerId: PeerId) => void): void {
		this.messageHandler = cb;
	}

	onPeerJoin(cb: (peerId: PeerId) => void): void {
		this.peerJoinHandler = cb;
	}

	onPeerLeave(cb: (peerId: PeerId) => void): void {
		this.peerLeaveHandler = cb;
	}

	onConnected(cb: (peerId: PeerId) => void): void {
		this.connectedHandler = cb;
	}

	getMyId(): string {
		return this.myId;
	}

	receive(data: GameMessage, peerId: PeerId): void {
		this.messageHandler(data, peerId);
	}

	peerJoined(peerId: PeerId): void {
		this.peerJoinHandler(peerId);
	}

	peerLeft(peerId: PeerId): void {
		this.peerLeaveHandler(peerId);
	}

	connected(peerId: PeerId): void {
		this.connectedHandler(peerId);
	}
}

const config: GameConfig = {
	gameMode: 4,
	creaLimitNbr: 3,
	unitDrops: 1,
	abilityUpgrades: 3,
	plasma_amount: 30,
	turnTimePool: -1,
	timePool: -1,
	background_image: 'default',
};

function player(index: number): LobbyPlayer {
	return {
		playerId: `player-${index}`,
		peerId: `peer-${index}`,
		name: `player-${index}`,
		playerIndex: -1,
	};
}

async function createFourPlayerLobby(): Promise<{
	provider: PeerLobbyProvider;
	transport: FakeTransport;
}> {
	const transport = new FakeTransport();
	const provider = new PeerLobbyProvider(transport);
	await provider.createLobby(config, 'AB-TEST');
	return { provider, transport };
}

describe('PeerLobbyProvider four-player lobbies', () => {
	test('assigns seats 1 through 3 and rejects a fifth player', async () => {
		const { provider, transport } = await createFourPlayerLobby();

		for (let index = 1; index <= 4; index += 1) {
			transport.receive({ type: 'player-joined', player: player(index) }, `peer-${index}`);
		}

		expect(provider.getLobbyState().players.map((item) => item.playerIndex)).toEqual([0, 1, 2, 3]);
		expect(
			transport.directMessages.some(
				(message) =>
					message.peerId === 'peer-4' &&
					message.data.type === 'player-left' &&
					message.data.player.playerIndex === -1,
			),
		).toBe(true);
	});

	test('broadcasts the complete roster and updated host config', async () => {
		const { provider, transport } = await createFourPlayerLobby();

		transport.receive({ type: 'player-joined', player: player(1) }, 'peer-1');
		transport.receive({ type: 'player-joined', player: player(2) }, 'peer-2');
		transport.receive({ type: 'player-joined', player: player(3) }, 'peer-3');

		const rosterMessages = transport.broadcasts.filter((message) => message.type === 'lobby-state');
		expect(rosterMessages.at(-1)).toMatchObject({
			type: 'lobby-state',
			state: {
				players: [{ playerIndex: 0 }, { playerIndex: 1 }, { playerIndex: 2 }, { playerIndex: 3 }],
			},
		});

		provider.updateLobbyConfig({ ...config, plasma_amount: 70, turnTimePool: 40 });

		const configUpdate = transport.broadcasts
			.filter((message) => message.type === 'lobby-state')
			.at(-1);
		expect(configUpdate).toMatchObject({
			state: { config: { plasma_amount: 70, turnTimePool: 40 } },
		});
	});

	test('adopts the host roster and settings on join', async () => {
		const transport = new FakeTransport();
		const provider = new PeerLobbyProvider(transport);
		const joining = provider.joinLobby('AB-TEST');
		await Promise.resolve();
		const joinedPlayer = { ...player(2), peerId: 'peer-client', playerIndex: 2 };
		transport.receive({ type: 'lobby-joined', player: joinedPlayer }, 'peer-host');
		transport.receive(
			{
				type: 'lobby-state',
				state: {
					code: 'AB-TEST',
					host: 'player-0',
					hostPeerId: 'peer-host',
					players: [
						{ ...player(0), playerIndex: 0, peerId: 'peer-host' },
						{ ...player(1), playerIndex: 1 },
						joinedPlayer,
					],
					config: { ...config, plasma_amount: 60 },
					status: 'waiting',
				},
			},
			'peer-host',
		);

		await joining;
		expect(provider.getLobbyState().players.map((item) => item.playerIndex)).toEqual([0, 1, 2]);
		expect(provider.getLobbyState().config.plasma_amount).toBe(60);
	});

	describe('manual multiplayer start', () => {
		function gameWithPlayers(playerCount: number): {
			game: Game;
			markMatchStarted: jest.Mock;
			startGameLoad: jest.Mock;
		} {
			const markMatchStarted = jest.fn();
			const startGameLoad = jest.fn();
			const players = Array.from({ length: playerCount }, (_, playerIndex) => ({
				...player(playerIndex || 1),
				playerIndex,
				peerId: `peer-${playerIndex}`,
			}));
			const game = {
				lobby: {
					isHost: () => true,
					getLobbyState: () => ({
						code: 'AB-TEST',
						host: 'player-0',
						hostPeerId: 'peer-0',
						players,
						config,
						status: 'waiting',
					}),
					markMatchStarted,
					markRoomStarted: jest.fn(),
					sendAction: jest.fn(),
				},
				startGameLoad,
			} as unknown as Game;
			return { game, markMatchStarted, startGameLoad };
		}

		test('does not start a three-player lobby', () => {
			const { game, markMatchStarted, startGameLoad } = gameWithPlayers(3);

			Game.prototype.startMultiplayerMatch.call(game, config);

			expect(markMatchStarted).not.toHaveBeenCalled();
			expect(startGameLoad).not.toHaveBeenCalled();
		});

		test.each([
			[2, 2],
			[4, 4],
		])('starts %i-player lobbies in game mode %i', (playerCount, gameMode) => {
			const { game, markMatchStarted, startGameLoad } = gameWithPlayers(playerCount);

			Game.prototype.startMultiplayerMatch.call(game, { ...config, gameMode });

			expect(markMatchStarted).toHaveBeenCalledTimes(1);
			expect(startGameLoad).toHaveBeenCalledWith(expect.objectContaining({ gameMode }), true);
		});
	});

	test('relays peer match actions to the other connected peers', async () => {
		const { provider, transport } = await createFourPlayerLobby();
		const received: GameMessage[] = [];
		provider.onGameMessage((message) => received.push(message));

		const message: GameMessage = {
			type: 'turn-update',
			playerId: 'player-2',
			creatureId: 9,
			turn: 3,
		};
		transport.receive(message, 'peer-2');

		expect(transport.forwardedMessages).toContainEqual({ peerId: 'peer-2', data: message });
		expect(received).toContain(message);
	});

	test('relays each peer heartbeat without conflating player identities', async () => {
		const { provider, transport } = await createFourPlayerLobby();
		transport.receive({ type: 'player-joined', player: player(1) }, 'peer-1');
		transport.receive({ type: 'player-joined', player: player(2) }, 'peer-2');
		transport.receive({ type: 'player-joined', player: player(3) }, 'peer-3');
		const heartbeat: GameMessage = {
			type: 'heartbeat',
			timestamp: Date.now(),
			playerId: 'player-2',
		};

		transport.receive(heartbeat, 'peer-2');

		expect(transport.forwardedMessages).toContainEqual({
			peerId: 'peer-2',
			data: heartbeat,
		});
		expect(provider.getLobbyState().players).toHaveLength(4);
	});

	test('shows seats as players 1-4 and can remove the last player', async () => {
		const { provider, transport } = await createFourPlayerLobby();
		transport.receive({ type: 'player-joined', player: player(1) }, 'peer-1');
		transport.receive({ type: 'player-joined', player: player(2) }, 'peer-2');
		transport.receive({ type: 'player-joined', player: player(3) }, 'peer-3');

		expect(provider.getLobbyState().players.map((item) => item.playerNumber)).toEqual([1, 2, 3, 4]);

		provider.kickPlayer('player-3');

		expect(provider.getLobbyState().players.map((item) => item.playerNumber)).toEqual([1, 2, 3]);
		expect(transport.directMessages).toContainEqual({
			peerId: 'peer-3',
			data: expect.objectContaining({ type: 'player-left', playerId: 'player-3' }),
		});
	});
});
