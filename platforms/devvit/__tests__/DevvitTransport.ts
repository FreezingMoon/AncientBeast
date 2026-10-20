import { jest, expect, describe, test, beforeEach, afterEach } from '@jest/globals';

import { DevvitTransport } from './DevvitTransport';
import { DevvitLobbyProvider } from './DevvitLobbyProvider';
import type { GameMessage } from '../../../src/multiplayer/types';

const mockResponse = (body: unknown): Response =>
	({ ok: true, json: async () => body } as unknown as Response);

const mockArrayResponse = (items: unknown[]): Response =>
	({ ok: true, json: async () => items } as unknown as Response);

describe('DevvitTransport', () => {
	let fetchImpl: jest.MockedFunction<typeof fetch>;
	let transport: DevvitTransport;

	beforeEach(() => {
		fetchImpl = jest.fn() as unknown as jest.MockedFunction<typeof fetch>;
		fetchImpl.mockResolvedValue(mockResponse({}));
		(global as unknown as { fetch: typeof fetch }).fetch = fetchImpl as unknown as typeof fetch;
		transport = new DevvitTransport({
			fetchImpl: fetchImpl as unknown as typeof fetch,
			pollIntervalMs: 100,
		});
	});

	afterEach(() => {
		transport.disconnect();
		jest.useRealTimers();
		delete (global as unknown as { fetch?: typeof fetch }).fetch;
	});

	test('connect sends join request and starts polling', async () => {
		fetchImpl
			.mockResolvedValueOnce(mockResponse({ myId: 'player-1', playerIndex: 0, isHost: true }))
			.mockResolvedValueOnce(
				mockArrayResponse([
					{
						cursor: '1',
						from: 'player-1',
						message: { type: 'player-joined', player: { peerId: 'player-1', playerIndex: 0 } },
					},
				]),
			)
			.mockResolvedValueOnce(
				mockResponse({
					players: [{ peerId: 'player-1', playerIndex: 0 }],
					status: 'waiting',
					host: 'player-1',
				}),
			);

		const connectPromise = transport.connect('ABC1', { isHost: true });

		await expect(connectPromise).resolves.toBeUndefined();
		expect(fetchImpl).toHaveBeenCalledWith(
			expect.stringContaining('/api/lobby/ABC1/join'),
			expect.objectContaining({ method: 'POST' }),
		);
		expect(transport.getMyId()).toBe('player-1');
	});

	test('send posts message to server', async () => {
		await transport.send({ type: 'heartbeat', timestamp: Date.now(), playerId: 'player-1' });

		expect(fetchImpl).toHaveBeenCalledWith(
			expect.stringContaining('/api/lobby/'),
			expect.objectContaining({
				method: 'POST',
				body: expect.stringContaining('heartbeat'),
			}),
		);
	});

	test('disconnect stops polling and sends leave', async () => {
		transport.disconnect();

		expect(fetchImpl).toHaveBeenCalledWith(
			expect.stringContaining('/leave'),
			expect.objectContaining({ method: 'POST' }),
		);
	});

	test('poll attaches server order from cursor before notifying listeners', async () => {
		const handler = jest.fn();
		transport.onMessage(handler);

		fetchImpl
			.mockResolvedValueOnce(mockResponse({ myId: 'player-1', playerIndex: 0, isHost: true }))
			.mockResolvedValueOnce(
				mockArrayResponse([
					{
						cursor: '6',
						from: 'player-1',
						message: {
							type: 'match-loaded',
							playerId: 'player-1',
						},
					},
					{
						cursor: '7',
						from: 'player-2',
						message: {
							type: 'action-move',
							target: { x: 2, y: 3 },
							playerId: 'player-2',
							creatureId: 4,
						},
					},
				]),
			)
			.mockResolvedValueOnce(
				mockResponse({
					players: [{ peerId: 'player-1', playerIndex: 0 }],
					status: 'playing',
					host: 'player-1',
				}),
			);

		await transport.connect('ABC1', { isHost: true });

		expect(handler).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'action-move',
				serverOrder: 7,
			}),
			'player-2',
		);
	});
});

describe('DevvitLobbyProvider', () => {
	let fetchImpl: jest.MockedFunction<typeof fetch>;
	let mockTransport: jest.Mocked<DevvitTransport>;
	let provider: DevvitLobbyProvider;

	beforeEach(() => {
		fetchImpl = jest.fn() as unknown as jest.MockedFunction<typeof fetch>;
		fetchImpl.mockResolvedValue(mockResponse({}));
		(global as unknown as { fetch: typeof fetch }).fetch = fetchImpl as unknown as typeof fetch;

		mockTransport = {
			connect: jest.fn(async () => {}),
			disconnect: jest.fn(),
			send: jest.fn(async () => {}),
			fetchMessagesAfter: jest.fn(async () => []),
			sendTo: jest.fn(async () => {}),
			sendExcept: jest.fn(async () => {}),
			onMessage: jest.fn(),
			onPeerJoin: jest.fn(),
			onPeerLeave: jest.fn(),
			onConnected: jest.fn(),
			getMyId: jest.fn(() => 'player-1'),
			isHostPeer: jest.fn(() => false),
		} as unknown as jest.Mocked<DevvitTransport>;

		provider = new DevvitLobbyProvider(mockTransport);
	});

	afterEach(() => {
		provider.leaveLobby();
		jest.useRealTimers();
		delete (global as unknown as { fetch?: typeof fetch }).fetch;
	});

	test('createLobby creates lobby and sets host', async () => {
		fetchImpl
			.mockResolvedValueOnce(mockResponse({ code: 'ABC1' }))
			.mockResolvedValueOnce(mockResponse({ myId: 'player-1', playerIndex: 0, isHost: true }))
			.mockResolvedValueOnce(
				mockResponse({
					players: [{ peerId: 'player-1', playerIndex: 0 }],
					status: 'waiting',
					host: 'player-1',
				}),
			)
			.mockResolvedValueOnce(
				mockArrayResponse([
					{
						cursor: '1',
						from: 'player-1',
						message: { type: 'player-joined', player: { peerId: 'player-1', playerIndex: 0 } },
					},
				]),
			)
			.mockResolvedValueOnce(
				mockResponse({
					players: [{ peerId: 'player-1', playerIndex: 0 }],
					status: 'waiting',
					host: 'player-1',
				}),
			);

		const session = await provider.createLobby({
			gameMode: 2,
			creaLimitNbr: 3,
			unitDrops: 1,
			abilityUpgrades: 3,
			plasma_amount: 30,
			turnTimePool: -1,
			timePool: -1,
			background_image: 'default',
		});

		expect(session.code).toBe('ABC1');
		expect(provider.isHost()).toBe(true);
	});

	test('match-start updates state and fires handler', () => {
		(provider as unknown as { isHostFlag: boolean }).isHostFlag = true;
		(provider as unknown as { state: unknown }).state = {
			code: 'ABC1',
			host: 'player-1',
			hostPeerId: 'player-1',
			players: [{ playerId: 'player-1', peerId: 'player-1', name: 'player-1', playerIndex: 0 }],
			config: {
				gameMode: 2,
				creaLimitNbr: 3,
				unitDrops: 1,
				abilityUpgrades: 3,
				plasma_amount: 30,
				turnTimePool: -1,
				timePool: -1,
				background_image: 'default',
			},
			status: 'waiting',
		};

		const matchStartMessage: GameMessage = {
			type: 'match-start',
			config: {
				gameMode: 2,
				creaLimitNbr: 3,
				unitDrops: 1,
				abilityUpgrades: 3,
				plasma_amount: 30,
				turnTimePool: -1,
				timePool: -1,
				background_image: 'default',
			},
			players: [{ playerId: 'player-1', peerId: 'player-1', name: 'player-1', playerIndex: 0 }],
			host: 'player-1',
			hostPeerId: 'player-1',
		};

		const handler = jest.fn();
		provider.onGameMessage(handler);

		mockTransport.getMyId.mockReturnValue('player-1');
		(
			provider as unknown as {
				handleTransportMessage: (m: GameMessage, p: string) => void;
			}
		).handleTransportMessage(matchStartMessage, 'player-1');

		expect(provider.getLobbyState().status).toBe('playing');
		expect(handler).toHaveBeenCalledWith(matchStartMessage);
	});

	test('drops self-originated action messages (no local duplicate)', () => {
		const handler = jest.fn();
		provider.onGameMessage(handler);

		const abilityMessage: GameMessage = {
			type: 'action-ability',
			id: 3,
			target: { type: 'hex', x: 5, y: 5 },
			args: [],
			playerId: 'player-1',
			creatureId: 1,
		};

		// Echoed back from the server, originated by this same client.
		(
			provider as unknown as { handleTransportMessage: (m: GameMessage, p: string) => void }
		).handleTransportMessage(abilityMessage, 'player-1');

		expect(handler).not.toHaveBeenCalled();
	});

	test('applies action messages from other players', () => {
		const handler = jest.fn();
		provider.onGameMessage(handler);

		const abilityMessage: GameMessage = {
			type: 'action-ability',
			id: 3,
			target: { type: 'hex', x: 5, y: 5 },
			args: [],
			playerId: 'player-2',
			creatureId: 2,
		};

		(
			provider as unknown as { handleTransportMessage: (m: GameMessage, p: string) => void }
		).handleTransportMessage(abilityMessage, 'player-2');

		expect(handler).toHaveBeenCalledWith(abilityMessage);
	});

	test('drops self-originated action-end messages (local turn-end already applied)', () => {
		const handler = jest.fn();
		provider.onGameMessage(handler);

		const actionEndMessage: GameMessage = {
			type: 'action-end',
			action: 'skip',
			playerId: 'player-1',
			creatureId: 1,
		};

		(
			provider as unknown as { handleTransportMessage: (m: GameMessage, p: string) => void }
		).handleTransportMessage(actionEndMessage, 'player-1');

		expect(handler).not.toHaveBeenCalled();
	});

	test('buffers out-of-order remote actions until self echo advances the shared sequence', () => {
		const handler = jest.fn();
		provider.onGameMessage(handler);

		const remoteAction: GameMessage = {
			type: 'action-ability',
			id: 3,
			target: { type: 'hex', x: 5, y: 5 },
			args: [],
			playerId: 'player-2',
			creatureId: 2,
			serverOrder: 13,
		};
		const matchStartMessage: GameMessage = {
			type: 'match-start',
			config: {
				gameMode: 2,
				creaLimitNbr: 3,
				unitDrops: 1,
				abilityUpgrades: 3,
				plasma_amount: 30,
				turnTimePool: -1,
				timePool: -1,
				background_image: 'default',
			},
			players: [{ playerId: 'player-1', peerId: 'player-1', name: 'player-1', playerIndex: 0 }],
			host: 'player-1',
			hostPeerId: 'player-1',
			serverOrder: 11,
		};
		const selfEchoAction: GameMessage = {
			type: 'action-ability',
			id: 1,
			target: { type: 'hex', x: 1, y: 1 },
			args: [],
			playerId: 'player-1',
			creatureId: 1,
			serverOrder: 12,
		};

		(
			provider as unknown as { handleTransportMessage: (m: GameMessage, p: string) => void }
		).handleTransportMessage(matchStartMessage, 'player-1');

		handler.mockClear();

		(
			provider as unknown as { handleTransportMessage: (m: GameMessage, p: string) => void }
		).handleTransportMessage(remoteAction, 'player-2');

		expect(handler).not.toHaveBeenCalled();

		(
			provider as unknown as { handleTransportMessage: (m: GameMessage, p: string) => void }
		).handleTransportMessage(selfEchoAction, 'player-1');

		expect(handler).toHaveBeenCalledTimes(1);
		expect(handler).toHaveBeenCalledWith(remoteAction);
	});

	test('ordered non-gameplay messages do not block subsequent ordered gameplay actions', () => {
		const handler = jest.fn();
		provider.onGameMessage(handler);

		const matchStartMessage: GameMessage = {
			type: 'match-start',
			config: {
				gameMode: 2,
				creaLimitNbr: 3,
				unitDrops: 1,
				abilityUpgrades: 3,
				plasma_amount: 30,
				turnTimePool: -1,
				timePool: -1,
				background_image: 'default',
			},
			players: [{ playerId: 'player-1', peerId: 'player-1', name: 'player-1', playerIndex: 0 }],
			host: 'player-1',
			hostPeerId: 'player-1',
			serverOrder: 11,
		};
		const heartbeatMessage: GameMessage = {
			type: 'heartbeat',
			timestamp: Date.now(),
			playerId: 'player-2',
			serverOrder: 12,
		};
		const remoteAction: GameMessage = {
			type: 'action-ability',
			id: 3,
			target: { type: 'hex', x: 5, y: 5 },
			args: [],
			playerId: 'player-2',
			creatureId: 2,
			serverOrder: 13,
		};

		(
			provider as unknown as { handleTransportMessage: (m: GameMessage, p: string) => void }
		).handleTransportMessage(matchStartMessage, 'player-1');

		handler.mockClear();

		(
			provider as unknown as { handleTransportMessage: (m: GameMessage, p: string) => void }
		).handleTransportMessage(remoteAction, 'player-2');

		expect(handler).not.toHaveBeenCalled();

		(
			provider as unknown as { handleTransportMessage: (m: GameMessage, p: string) => void }
		).handleTransportMessage(heartbeatMessage, 'player-2');

		expect(handler).toHaveBeenCalledTimes(1);
		expect(handler).toHaveBeenCalledWith(remoteAction);
	});

	test('requests sync snapshot after repeated gap recovery misses', async () => {
		jest.useFakeTimers();
		mockTransport.fetchMessagesAfter.mockResolvedValue([]);

		const matchStartMessage: GameMessage = {
			type: 'match-start',
			config: {
				gameMode: 2,
				creaLimitNbr: 3,
				unitDrops: 1,
				abilityUpgrades: 3,
				plasma_amount: 30,
				turnTimePool: -1,
				timePool: -1,
				background_image: 'default',
			},
			players: [{ playerId: 'player-1', peerId: 'player-1', name: 'player-1', playerIndex: 0 }],
			host: 'player-1',
			hostPeerId: 'player-1',
			serverOrder: 10,
		};

		(
			provider as unknown as { handleTransportMessage: (m: GameMessage, p: string) => void }
		).handleTransportMessage(matchStartMessage, 'player-1');

		const outOfOrderMessage: GameMessage = {
			type: 'action-move',
			target: { x: 2, y: 2 },
			playerId: 'player-2',
			creatureId: 2,
			serverOrder: 12,
		};

		(
			provider as unknown as { handleTransportMessage: (m: GameMessage, p: string) => void }
		).handleTransportMessage(outOfOrderMessage, 'player-2');

		for (let i = 0; i < 3; i += 1) {
			jest.advanceTimersByTime(750);
			await Promise.resolve();
		}

		expect(mockTransport.send).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'sync-request',
				playerId: 'player-1',
				expectedServerOrder: 11,
			}),
		);
	});

	test('does not request sync when there is no out-of-order gap', async () => {
		jest.useFakeTimers();
		mockTransport.fetchMessagesAfter.mockResolvedValue([]);

		const matchStartMessage: GameMessage = {
			type: 'match-start',
			config: {
				gameMode: 2,
				creaLimitNbr: 3,
				unitDrops: 1,
				abilityUpgrades: 3,
				plasma_amount: 30,
				turnTimePool: -1,
				timePool: -1,
				background_image: 'default',
			},
			players: [{ playerId: 'player-1', peerId: 'player-1', name: 'player-1', playerIndex: 0 }],
			host: 'player-1',
			hostPeerId: 'player-1',
			serverOrder: 15,
		};

		(
			provider as unknown as { handleTransportMessage: (m: GameMessage, p: string) => void }
		).handleTransportMessage(matchStartMessage, 'player-1');

		for (let i = 0; i < 4; i += 1) {
			jest.advanceTimersByTime(750);
			await Promise.resolve();
		}

		expect(mockTransport.send).not.toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'sync-request',
			}),
		);
	});

	test('applies self-originated intent messages (authoritative mode does not apply locally before sending)', () => {
		const handler = jest.fn();
		provider.onGameMessage(handler);

		const intentMessage: GameMessage = {
			type: 'intent',
			intent: { kind: 'move', target: { x: 3, y: 4 } },
			playerId: 'player-1',
		};

		// Echoed back from the server, originated by this same client. In
		// authoritative mode the acting client never applied the intent locally
		// before sending, so it must apply the echoed copy to keep both sides
		// in sync.
		(
			provider as unknown as { handleTransportMessage: (m: GameMessage, p: string) => void }
		).handleTransportMessage(intentMessage, 'player-1');

		expect(handler).toHaveBeenCalledWith(intentMessage);
	});

	test('lobby-joined for another peer does not overwrite local player index', () => {
		(provider as unknown as { state: unknown }).state = {
			code: 'ABC1',
			host: 'player-1',
			hostPeerId: 'player-1',
			players: [{ playerId: 'player-1', peerId: 'player-1', name: 'player-1', playerIndex: 0 }],
			config: {
				gameMode: 2,
				creaLimitNbr: 3,
				unitDrops: 1,
				abilityUpgrades: 3,
				plasma_amount: 30,
				turnTimePool: -1,
				timePool: -1,
				background_image: 'default',
			},
			status: 'waiting',
		};

		const lobbyJoinedMessage: GameMessage = {
			type: 'lobby-joined',
			player: { playerId: 'player-2', peerId: 'player-2', name: 'player-2', playerIndex: 1 },
		};

		(
			provider as unknown as { handleTransportMessage: (m: GameMessage, p: string) => void }
		).handleTransportMessage(lobbyJoinedMessage, 'player-2');

		const localPlayer = provider.getLocalPlayer();
		expect(localPlayer?.playerIndex).toBe(0);
	});

	test('lobby-joined for self updates local player index', () => {
		(provider as unknown as { state: unknown }).state = {
			code: 'ABC1',
			host: 'player-1',
			hostPeerId: 'player-1',
			players: [{ playerId: 'player-1', peerId: 'player-1', name: 'player-1', playerIndex: -1 }],
			config: {
				gameMode: 2,
				creaLimitNbr: 3,
				unitDrops: 1,
				abilityUpgrades: 3,
				plasma_amount: 30,
				turnTimePool: -1,
				timePool: -1,
				background_image: 'default',
			},
			status: 'waiting',
		};

		const lobbyJoinedMessage: GameMessage = {
			type: 'lobby-joined',
			player: { playerId: 'player-1', peerId: 'player-1', name: 'player-1', playerIndex: 0 },
		};

		(
			provider as unknown as { handleTransportMessage: (m: GameMessage, p: string) => void }
		).handleTransportMessage(lobbyJoinedMessage, 'player-1');

		const localPlayer = provider.getLocalPlayer();
		expect(localPlayer?.playerIndex).toBe(0);
	});

	test('host answers sync requests with a snapshot', () => {
		(provider as unknown as { isHostFlag: boolean }).isHostFlag = true;
		(provider as unknown as { state: unknown }).state = {
			code: 'ABC1',
			host: 'player-1',
			hostPeerId: 'player-1',
			players: [{ playerId: 'player-1', peerId: 'player-1', name: 'player-1', playerIndex: 0 }],
			config: {
				gameMode: 2,
				creaLimitNbr: 3,
				unitDrops: 1,
				abilityUpgrades: 3,
				plasma_amount: 30,
				turnTimePool: -1,
				timePool: -1,
				background_image: 'default',
			},
			status: 'playing',
		};

		const syncRequest: GameMessage = {
			type: 'sync-request',
			playerId: 'player-2',
			expectedServerOrder: 99,
			reason: 'missing-sequenced-messages',
		};

		(
			provider as unknown as { handleTransportMessage: (m: GameMessage, p: string) => void }
		).handleTransportMessage(syncRequest, 'player-2');

		expect(mockTransport.send).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'sync-snapshot',
				playerId: 'player-2',
			}),
		);
	});
});
