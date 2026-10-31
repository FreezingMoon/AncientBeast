import { describe, expect, test } from '@jest/globals';
import { syncFullscreenViewHud } from '../../ui/hud-visibility';

const renderUi = (viewMarkup = '') => {
	document.body.innerHTML = `<div id="ui">${viewMarkup}</div>`;
	return document.getElementById('ui') as HTMLElement;
};

describe('syncFullscreenViewHud', () => {
	test('leaves the HUD alone when no full-screen view is open', () => {
		const ui = renderUi();

		expect(syncFullscreenViewHud()).toBe(false);
		expect(ui.classList.contains('interface-view-open')).toBe(false);
	});

	test('dims the HUD while dash, scoreboard, music player, meta powers, or hotkeys are open', () => {
		for (const viewMarkup of [
			'<div id="dash" class="active"></div>',
			'<div id="scoreboard"></div>',
			'<div id="musicplayerwrapper"></div>',
			'<div id="meta-powers"></div>',
			'<div id="hotkeys"></div>',
		]) {
			document.body.innerHTML = `<div id="ui">${viewMarkup}</div>`;
			const ui = document.getElementById('ui') as HTMLElement;

			expect(syncFullscreenViewHud()).toBe(true);
			expect(ui.classList.contains('interface-view-open')).toBe(true);
		}
	});

	test('tracks a view whose open state changes after the root is rendered', () => {
		renderUi('<div id="dash"></div>');
		const ui = document.getElementById('ui') as HTMLElement;
		const dash = document.getElementById('dash') as HTMLElement;

		expect(syncFullscreenViewHud()).toBe(false);
		dash.classList.add('active');
		expect(syncFullscreenViewHud()).toBe(true);
		dash.classList.remove('active');
		expect(syncFullscreenViewHud()).toBe(false);
		expect(ui.classList.contains('interface-view-open')).toBe(false);
	});

	test('restores the HUD when every full-screen view is hidden', () => {
		renderUi(`
			<div id="dash"></div>
			<div id="scoreboard" class="hide"></div>
			<div id="musicplayerwrapper" class="hide"></div>
			<div id="meta-powers" class="hide"></div>
			<div id="hotkeys" class="hide"></div>
		`);
		const ui = document.getElementById('ui') as HTMLElement;
		ui.classList.add('interface-view-open');

		expect(syncFullscreenViewHud()).toBe(false);
		expect(ui.classList.contains('interface-view-open')).toBe(false);
	});

	test('returns false without a #ui root instead of throwing', () => {
		document.body.innerHTML = '<div id="scoreboard"></div>';

		expect(syncFullscreenViewHud()).toBe(false);
	});
});
