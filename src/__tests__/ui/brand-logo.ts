import { describe, expect, jest, test } from '@jest/globals';
import { UI } from '../../ui/interface';

/**
 * A stand-in for the logo's engine handle.
 *
 * `scene` is the only member the input guards read: Phaser 4's
 * `GameObject.destroy()` clears it, while a live game object always holds the
 * scene it was created in, so its presence is what "this world is still alive"
 * means to the handle.
 */
const createLogo = (scene: unknown) => ({
	alpha: 0,
	scene,
	input: {} as { cursor?: string },
	setInteractive: jest.fn(),
	disableInteractive: jest.fn(),
});

const setBrandLogoVisible = (logo: ReturnType<typeof createLogo>, visible: boolean) =>
	UI.prototype.setBrandLogoVisible.call({ brandlogo: logo } as unknown as UI, visible);

describe('brand logo visibility', () => {
	test('showing a live logo enables its input', () => {
		const logo = createLogo({ sys: {} });

		setBrandLogoVisible(logo, true);

		expect(logo.alpha).toBe(1);
		expect(logo.setInteractive).toHaveBeenCalledTimes(1);
	});

	test('hiding a live logo disables its input', () => {
		const logo = createLogo({ sys: {} });

		setBrandLogoVisible(logo, false);

		expect(logo.alpha).toBe(0);
		expect(logo.disableInteractive).toHaveBeenCalledTimes(1);
	});

	test('hiding a logo whose scene was destroyed is a no-op, not a crash', () => {
		// A rematch tears the previous Phaser game down outright, leaving a stale
		// UI whose tab-switch and Ctrl+Shift+M handlers still hide the logo.
		// Phaser 4's input methods dereference `scene` unconditionally, so the
		// guard has to catch them before they throw on the dead board.
		const logo = createLogo(undefined);

		expect(() => setBrandLogoVisible(logo, false)).not.toThrow();

		expect(logo.disableInteractive).not.toHaveBeenCalled();
		expect(logo.alpha).toBe(0);
	});
});
