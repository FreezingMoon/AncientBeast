/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Shared Phaser 4 `GameObject` doubles for the Jest suites.
 *
 * Every suite used to hand-roll its own sprite literal, and each one was
 * written in Phaser 2 CE shape: `anchor: { setTo }`, `scale: { setTo }`,
 * `loadTexture()`, `exists`. That is the API the engine facade used to
 * translate, so the doubles went on passing long after gameplay stopped calling
 * it — and they went on passing even when gameplay did move, because a double
 * that is missing a method fails loudly while a double that is merely
 * *different* fails silently. Keeping the doubles in step with the engine is
 * the whole point of this file.
 *
 * The methods here are real implementations, not bare `jest.fn()`s, so a suite
 * that sets an origin and then asserts on the resulting layout is testing
 * something. That follows the precedent in `phaser-mock.ts`, whose easing
 * curves are the genuine formulas precisely because an approximation there
 * quietly changed what the simulation animated.
 *
 * `setOrigin`/`setScale` reproduce Phaser 4's own defaults (`y` falls back to
 * `x`), which is the same fallback the facade's shim had, so gameplay that
 * relied on the one-argument form keeps behaving the same.
 */
import { jest } from '@jest/globals';

/** `jest.Mock` in Jest 29 is parameterised by the function type, not by args. */
type MockFn<Args extends unknown[] = any[], R = any> = jest.Mock<(...args: Args) => R>;

export type SpriteMock = {
	// Transform
	x: number;
	y: number;
	angle: number;
	// Origin / scale, and the derived display origin Phaser recomputes on change.
	originX: number;
	originY: number;
	displayOriginX: number;
	displayOriginY: number;
	scaleX: number;
	scaleY: number;
	// Size and appearance
	width: number;
	height: number;
	alpha: number;
	tint: number;
	visible: boolean;
	active: boolean;
	depth: number;
	key: string;
	frame: string | undefined;
	destroyed: boolean;
	// Containment
	parentContainer: any;
	data: undefined;
	setOrigin: MockFn<[number?, number?], SpriteMock>;
	setScale: MockFn<[number?, number?], SpriteMock>;
	setPosition: MockFn<[number, number], SpriteMock>;
	setTexture: MockFn<[string, string?], SpriteMock>;
	setActive: MockFn<[boolean], SpriteMock>;
	setVisible: MockFn<[boolean], SpriteMock>;
	setDepth: MockFn<[number], SpriteMock>;
	setTint: MockFn<[number], SpriteMock>;
	setAlpha: MockFn<[number], SpriteMock>;
	setInteractive: MockFn<[], SpriteMock>;
	disableInteractive: MockFn<[], SpriteMock>;
	destroy: MockFn<[boolean?], SpriteMock>;
	getBounds: MockFn;
	[key: string]: any;
};

export interface SpriteMockOptions {
	x?: number;
	y?: number;
	angle?: number;
	originX?: number;
	originY?: number;
	scaleX?: number;
	scaleY?: number;
	width?: number;
	height?: number;
	alpha?: number;
	tint?: number;
	visible?: boolean;
	active?: boolean;
	depth?: number;
	key?: string;
	frame?: string;
	/** Extra members merged last, for suite-specific extras. */
	extra?: Record<string, unknown>;
}

export function createSpriteMock(options: SpriteMockOptions = {}): SpriteMock {
	const {
		x = 0,
		y = 0,
		angle = 0,
		originX = 0.5,
		originY = 0.5,
		scaleX = 1,
		scaleY = 1,
		width = 0,
		height = 0,
		alpha = 1,
		tint = 0xffffff,
		visible = true,
		active = true,
		depth = 0,
		key = '',
		frame = undefined,
		extra = {},
	} = options;

	const sprite: SpriteMock = {
		x,
		y,
		angle,
		originX,
		originY,
		displayOriginX: originX * width,
		displayOriginY: originY * height,
		scaleX,
		scaleY,
		width,
		height,
		alpha,
		tint,
		visible,
		active,
		depth,
		key,
		frame,
		destroyed: false,
		parentContainer: null,
		// Phaser 4 has no DataManager. Stating that explicitly means a suite
		// that reaches for `.data` fails on `undefined` rather than quietly
		// getting an object that AB production code no longer reads.
		data: undefined,
	} as SpriteMock;

	const updateDisplayOrigin = () => {
		sprite.displayOriginX = sprite.originX * sprite.width;
		sprite.displayOriginY = sprite.originY * sprite.height;
		return sprite;
	};

	sprite.setOrigin = jest.fn((ox?: number, oy?: number) => {
		// Phaser 4: an omitted x is 0.5, an omitted y is x.
		sprite.originX = ox === undefined ? 0.5 : ox;
		sprite.originY = oy === undefined ? sprite.originX : oy;
		return updateDisplayOrigin();
	});

	sprite.setScale = jest.fn((sx?: number, sy?: number) => {
		// Phaser 4: an omitted x is 1, an omitted y is x.
		sprite.scaleX = sx === undefined ? 1 : sx;
		sprite.scaleY = sy === undefined ? sprite.scaleX : sy;
		return sprite;
	});

	sprite.setPosition = jest.fn((px: number, py: number) => {
		sprite.x = px;
		sprite.y = py;
		return sprite;
	});

	sprite.setTexture = jest.fn((nextKey: string, nextFrame?: string) => {
		sprite.key = nextKey;
		sprite.frame = nextFrame;
		return sprite;
	});

	sprite.setActive = jest.fn((value: boolean) => {
		sprite.active = value;
		return sprite;
	});

	sprite.setVisible = jest.fn((value: boolean) => {
		sprite.visible = value;
		return sprite;
	});

	sprite.setDepth = jest.fn((value: number) => {
		sprite.depth = value;
		return sprite;
	});

	sprite.setTint = jest.fn((value: number) => {
		sprite.tint = value;
		return sprite;
	});

	sprite.setAlpha = jest.fn((value: number) => {
		sprite.alpha = value;
		return sprite;
	});

	sprite.setInteractive = jest.fn(() => sprite);
	sprite.disableInteractive = jest.fn(() => sprite);

	sprite.destroy = jest.fn(() => {
		sprite.destroyed = true;
		sprite.active = false;
		sprite.visible = false;
		sprite.parentContainer = null;
		return sprite;
	});

	// Phaser returns a `Geom.Rectangle`; hex hit-testing only reads the four
	// edges, so a plain literal is enough and keeps the mock dependency-free.
	sprite.getBounds = jest.fn(() => ({
		x: sprite.x,
		y: sprite.y,
		width: sprite.width * sprite.scaleX,
		height: sprite.height * sprite.scaleY,
		right: sprite.x + sprite.width * sprite.scaleX,
		bottom: sprite.y + sprite.height * sprite.scaleY,
		contains: () => true,
	}));

	Object.assign(sprite, extra);
	return sprite;
}
