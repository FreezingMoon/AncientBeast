import { beforeAll, describe, expect, jest, test } from '@jest/globals';
import { Hex } from '../../utility/hex';
import { Creature } from '../../creature';
import { unitData } from '../../data/units';

// NOTE: ts-comments are necessary in this file to avoid mocking the entire game.
/* eslint-disable @typescript-eslint/ban-ts-comment */

type JQueryMock = jest.Mock<() => { removeClass: jest.Mock }>;

jest.mock('../../ability');
jest.mock('phaser-ce', () => ({
	__esModule: true,
	default: {
		Easing: { Linear: { None: 1 } },
	},
	Point: class Point {},
	Polygon: class Polygon {},
}));

const getRandomString = (length: number) => {
	return Array(length + 1)
		.join((Math.random().toString(36) + '00000000000000000').slice(2, 18))
		.slice(0, length);
};

const getPlayerMock = () => ({});

const getHexesMock = () => {
	const arr = [];
	for (let y = 0; y < 10; y++) {
		const row = [];
		for (let x = 0; x < 10; x++) {
			row.push({
				displayPos: { x, y },
				creature: 0,
			});
		}
		arr.push(row);
	}
	return arr;
};

const getPhaserMock = () => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const self: Record<string, any> = { position: { set: jest.fn() } };
	self.add = () => self;
	self.create = () => self;
	self.forEach = () => self;
	self.group = () => self;
	self.removeChild = () => self;
	self.setTo = () => self;
	self.start = () => self;
	self.text = () => self;
	self.to = () => self;
	self.tween = () => self;
	self.anchor = self;
	self.data = {};
	self.onComplete = self;
	self.parent = self;
	self.sprite = self;
	self.scale = self;
	self.texture = {
		width: 10,
		height: 10,
	};

	return {
		add: self,
	};
};

const getGameMock = () => {
	const self = {
		turn: 0,
		creatures: [],
		players: [],
		queue: { update: jest.fn() },
		updateQueueDisplay: jest.fn(),
		grid: {
			orderCreatureZ: jest.fn(),
			hexes: getHexesMock(),
			getMovementRange: jest.fn(() => []),
		},
		Phaser: getPhaserMock(),
		retrieveCreatureStats: (type: number) => {
			for (const d of unitData) {
				if (d.id === type) {
					return d;
				}
			}
			return {};
		},
		abilities: jest.fn(),
		signals: {
			metaPowers: {
				add: jest.fn(),
			},
		},
		UI: {
			selectedAbility: -1,
		},
		triggers: {
			oncePerDamageChain: {
				test: jest.fn(() => false),
			},
		},
		plasma_amount: 10,
		onReset: jest.fn(),
		onStartPhase: jest.fn(),
		onEndPhase: jest.fn(),
		log: jest.fn(),
		onHeal: jest.fn(),
		activeCreature: undefined,
	};
	self.players = [getPlayerMock(), getPlayerMock()];
	return self;
};

const getCreatureObjMock = () => {
	return {
		stats: {
			health: 10,
			movement: 10,
		},
		temp: false,
		team: 0,
		materializationSickness: true,
		type: getRandomString(5),
		display: {
			'offset-x': true,
		},
		size: 2,
		x: 4,
		y: 4,
	};
};

beforeAll(() => {
	const globalWithJQuery = global as typeof global & { $j: JQueryMock };

	Object.defineProperty(window, 'Phaser', {
		get() {
			return { Easing: { Linear: { None: 1 } } };
		},
	});

	globalWithJQuery.$j = jest.fn(() => ({
		removeClass: jest.fn(),
	}));

	jest.doMock('jquery', () => ({
		__esModule: true,
		default: jest.fn(() => ({
			removeClass: jest.fn(),
		})),
	}));
});

describe('Hex.ghostOverlap', () => {
	test('does not x-ray the active creature when targeting an overlapping higher-row hex', () => {
		const game = getGameMock();
		// @ts-ignore
		const activeCreature = new Creature(getCreatureObjMock(), game);
		// @ts-ignore
		const otherCreature = new Creature(getCreatureObjMock(), game);

		game.activeCreature = activeCreature;
		game.creatures = [activeCreature, otherCreature];

		activeCreature.getScreenBounds = jest.fn(() => ({
			left: 0,
			right: 100,
			top: 0,
			bottom: 100,
		}));
		otherCreature.getScreenBounds = jest.fn(() => ({
			left: 0,
			right: 100,
			top: 0,
			bottom: 100,
		}));
		activeCreature.xray = jest.fn();
		otherCreature.xray = jest.fn();

		const targetHex = Object.create(Hex.prototype) as Hex;
		targetHex.game = game as never;
		targetHex.displayPos = { x: 0, y: 0 };
		targetHex.width = 100;
		targetHex.height = 100;
		Object.defineProperty(targetHex, 'creature', {
			value: undefined,
			configurable: true,
		});

		targetHex.ghostOverlap();

		expect(activeCreature.xray).not.toHaveBeenCalled();
		expect(otherCreature.xray).toHaveBeenCalledWith(true);
	});
});
