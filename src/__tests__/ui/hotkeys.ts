import { describe, expect, jest, test } from '@jest/globals';
import { Hotkeys } from '../../ui/hotkeys';

function createAudioHotkeys() {
	const ui = {
		btnAudio: {
			triggerClick: jest.fn(),
		},
		cycleAudioMode: jest.fn(),
		dashopen: true,
		gridSelectLeft: jest.fn(),
	};

	return {
		ui,
		hotkeys: new Hotkeys(ui as unknown as ConstructorParameters<typeof Hotkeys>[0]),
	};
}

describe('Hotkeys audio shortcuts', () => {
	test('opens the audio player with A', () => {
		const { hotkeys, ui } = createAudioHotkeys();

		hotkeys.pressA({ shiftKey: false });

		expect(ui.btnAudio.triggerClick).toHaveBeenCalledTimes(1);
		expect(ui.cycleAudioMode).not.toHaveBeenCalled();
		expect(ui.gridSelectLeft).not.toHaveBeenCalled();
	});

	test('cycles the audio mode with Shift+A', () => {
		const { hotkeys, ui } = createAudioHotkeys();

		hotkeys.pressA({ shiftKey: true });

		expect(ui.cycleAudioMode).toHaveBeenCalledTimes(1);
		expect(ui.btnAudio.triggerClick).not.toHaveBeenCalled();
		expect(ui.gridSelectLeft).not.toHaveBeenCalled();
	});
});
