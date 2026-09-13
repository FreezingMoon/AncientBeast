import { afterEach, describe, expect, jest, test } from '@jest/globals';
import $j from 'jquery';
import Cookies from 'js-cookie';

jest.mock('../../game', () => ({
	__esModule: true,
	default: class {},
}));

jest.mock('../../ui/button', () => ({
	Button: class {},
	ButtonStateEnum: {},
}));

import { MetaPowers } from '../../ui/meta-powers';

afterEach(() => {
	Cookies.remove('ab-meta-powers');
	document.body.innerHTML = '';
});

describe('Meta Powers HUD visibility', () => {
	test('syncs the HUD when an open panel is restored from its cookie', () => {
		document.body.innerHTML = `
			<div id="ui">
				<div id="meta-powers" class="hide"></div>
			</div>
		`;
		Cookies.set(
			'ab-meta-powers',
			JSON.stringify({
				toggles: {},
				panelVisible: true,
			}),
		);

		const metaPowers = Object.assign(Object.create(MetaPowers.prototype), {
			toggles: {},
			panelVisible: false,
			$els: { modal: $j('#meta-powers') },
			_persistPowers: jest.fn(),
		}) as MetaPowers;

		metaPowers._restorePowers();

		expect(metaPowers.panelVisible).toBe(true);
		expect(document.getElementById('meta-powers')?.classList.contains('hide')).toBe(false);
		expect(document.getElementById('ui')?.classList.contains('interface-view-open')).toBe(true);
	});
});
