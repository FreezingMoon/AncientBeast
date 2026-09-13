import { afterEach, describe, expect, test } from '@jest/globals';
import { syncFullscreenViewHud } from '../../ui/hud-visibility';

const renderUi = (viewMarkup = '') => {
	document.body.innerHTML = `<div id="ui">${viewMarkup}</div>`;
	return document.getElementById('ui') as HTMLElement;
};

afterEach(() => {
	document.body.innerHTML = '';
});

describe('syncFullscreenViewHud', () => {
	test('leaves the HUD alone when no full-screen view is mounted', () => {
		const ui = renderUi();

		expect(syncFullscreenViewHud()).toBe(false);
		expect(ui.classList.contains('interface-view-open')).toBe(false);
	});

	test('dims the HUD while an audio, score, dash, or meta-powers view is open', () => {
		for (const viewMarkup of [
			'<div id="musicplayerwrapper"></div>',
			'<div id="scoreboard"></div>',
			'<div id="dash" class="active"></div>',
			'<div id="meta-powers"></div>',
		]) {
			const ui = renderUi(viewMarkup);

			expect(syncFullscreenViewHud()).toBe(true);
			expect(ui.classList.contains('interface-view-open')).toBe(true);
		}
	});

	test('tracks a view when its open state changes after the root is rendered', () => {
		const ui = renderUi('<div id="dash"></div>');
		const dash = document.getElementById('dash') as HTMLElement;

		expect(syncFullscreenViewHud()).toBe(false);
		dash.classList.add('active');
		expect(syncFullscreenViewHud()).toBe(true);
		dash.classList.remove('active');
		expect(syncFullscreenViewHud()).toBe(false);
		expect(ui.classList.contains('interface-view-open')).toBe(false);
	});

	test('restores the HUD when every full-screen view is hidden', () => {
		const ui = renderUi(`
			<div id="musicplayerwrapper" class="hide"></div>
			<div id="scoreboard" class="hide"></div>
			<div id="dash"></div>
			<div id="meta-powers" class="hide"></div>
		`);

		ui.classList.add('interface-view-open');

		expect(syncFullscreenViewHud()).toBe(false);
		expect(ui.classList.contains('interface-view-open')).toBe(false);
	});

	test('includes the secret view, which is mounted outside the UI root', () => {
		const ui = renderUi();
		const secret = document.createElement('div');
		secret.id = 'ab-secret-view';
		secret.style.display = 'flex';
		document.body.appendChild(secret);

		expect(syncFullscreenViewHud()).toBe(true);
		expect(ui.classList.contains('interface-view-open')).toBe(true);
	});
});
