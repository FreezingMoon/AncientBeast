import { describe, expect, test } from '@jest/globals';

import { getDisplaySize, getFrameSize, getSourceSize } from '../../game-display/texture';

describe('sprite size sources', () => {
	const sprite = {
		// A packed atlas frame: the source image is much larger than the frame, and
		// the frame was trimmed when packed.
		texture: { width: 2048, height: 1024 },
		frame: { realWidth: 320, realHeight: 480, width: 300, height: 460 },
		width: 320,
		height: 480,
	};

	test('the frame size is what Phaser 2 texture.width meant, not the source', () => {
		expect(getFrameSize(sprite)).toEqual({ width: 320, height: 480 });
		// The source is the whole atlas; reading it as "my sprite" is the bug this
		// module exists to prevent.
		expect(getSourceSize(sprite.texture)).toEqual({ width: 2048, height: 1024 });
	});

	test('the untrimmed frame wins over the packed one', () => {
		// Pixel coordinates on cardboard artwork are authored against the
		// untrimmed image, so trimming must not shift them.
		expect(getFrameSize(sprite).width).toBe(sprite.frame.realWidth);
		expect(getFrameSize(sprite).width).not.toBe(sprite.frame.width);
	});

	test('the packed frame size is used when no untrimmed size exists', () => {
		expect(getFrameSize({ frame: { width: 300, height: 460 } })).toEqual({
			width: 300,
			height: 460,
		});
	});

	test('a frame-less object falls back to bounds rather than reporting zero', () => {
		expect(getFrameSize({ texture: { width: 64, height: 64 } })).toEqual({
			width: 64,
			height: 64,
		});
		expect(getFrameSize({ width: 20, height: 30 })).toEqual({ width: 20, height: 30 });
		expect(getFrameSize(undefined)).toEqual({ width: 0, height: 0 });
	});

	test('display size is a separate question from frame size', () => {
		const scaled = { ...sprite, width: 640, height: 960 };
		expect(getFrameSize(scaled)).toEqual({ width: 320, height: 480 });
		expect(getDisplaySize(scaled)).toEqual({ width: 640, height: 960 });
	});
});
