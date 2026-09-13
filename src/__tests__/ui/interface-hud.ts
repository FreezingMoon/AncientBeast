import { describe, expect, jest, test } from '@jest/globals';
import $j from 'jquery';

jest.mock('pixi', () => ({}), { virtual: true });
jest.mock('p2', () => ({}), { virtual: true });
jest.mock('phaser-ce', () => ({
	Point: class PointMock {},
	Polygon: class PolygonMock {},
	default: class PhaserMock {},
}));
jest.mock(
	'phaser',
	() => ({
		Signal: class SignalMock {},
		default: class PhaserMock {},
	}),
	{ virtual: true },
);

import { UI } from '../../ui/interface';
import { syncFullscreenViewHud } from '../../ui/hud-visibility';

describe('interface HUD visibility', () => {
	test('treats Meta Powers as an open interface view and closes it with the others', () => {
		const closeView = jest.fn();
		const closeMetaPowers = jest.fn();
		const ui = {
			chat: { isOpen: false },
			metaPowers: {
				panelVisible: true,
				_closeModal: closeMetaPowers,
			},
			closeView,
			isViewOpen: jest.fn(() => false),
		} as unknown as UI;

		expect(UI.prototype.isInterfaceViewOpen.call(ui)).toBe(true);
		UI.prototype.closeOpenInterfaceViews.call(ui);

		expect(closeView).toHaveBeenCalledTimes(4);
		expect(closeMetaPowers).toHaveBeenCalledTimes(1);
	});

	test('an obsolete narrow-screen close callback does not close a reopened dash', () => {
		document.body.innerHTML = '<div id="ui"><div id="dash" class="active"></div></div>';
		Object.defineProperty(window, 'innerWidth', { configurable: true, value: 600 });
		Object.defineProperty(window, 'innerHeight', { configurable: true, value: 700 });

		const $dash = $j('#dash');
		let finishClosing: (() => void) | undefined;
		Object.assign($dash, {
			transition: jest.fn(
				(_properties: object, _duration: number, _easing: string, complete: () => void) => {
					finishClosing = complete;
				},
			),
		});

		const ui = {
			$dash,
			dashopen: true,
			dashAnimSpeed: 250,
			materializeToggled: false,
			dashOpenCollectiveBanner: { onViewClose: jest.fn() },
			game: {
				activeCreature: null,
				signals: { ui: { dispatch: jest.fn() } },
			},
		} as unknown as UI;

		UI.prototype.closeDash.call(ui);
		expect(finishClosing).toBeDefined();

		// Reopening before the fade-out completes creates a new active dash state.
		ui.dashopen = true;
		$dash.addClass('active');
		syncFullscreenViewHud();
		finishClosing?.();

		expect($dash.hasClass('active')).toBe(true);
		expect(document.getElementById('ui')?.classList.contains('interface-view-open')).toBe(true);
	});
});
