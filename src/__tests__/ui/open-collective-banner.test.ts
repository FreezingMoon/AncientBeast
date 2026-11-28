import { describe, expect, jest, test } from '@jest/globals';
import { crazyGames } from '../../../platforms/crazygames/crazygames';
import { isThirdPartyContentBlocked, OpenCollectiveBanner } from '../../ui/open-collective-banner';

describe('OpenCollectiveBanner', () => {
	test.each([
		'opencollective_banner',
		'opencollective_banner_scoreboard',
		'opencollective_banner_musicplayer',
	])('uses a CrazyGames banner instead of OpenCollective in %s', (id) => {
		const previousTarget = process.env.VITE_CRAZYGAMES_TARGET;
		process.env.VITE_CRAZYGAMES_TARGET = 'true';
		document.body.innerHTML = `<div id="${id}"></div>`;
		const request = jest.spyOn(crazyGames, 'requestBanner').mockImplementation(() => undefined);
		const clear = jest.spyOn(crazyGames, 'clearBanner').mockImplementation(() => undefined);

		try {
			let viewOpen = false;
			const banner = new OpenCollectiveBanner({
				bannerSelector: `#${id}`,
				onCloseView: () => undefined,
				isViewOpen: () => viewOpen,
				hidden: isThirdPartyContentBlocked(),
			});
			const fetchMembers = jest.spyOn(banner, 'fetchMembers');
			banner.init();
			banner.onViewOpen();
			expect(request).not.toHaveBeenCalled();

			viewOpen = true;
			banner.onViewOpen();
			expect(request).toHaveBeenCalledWith(id);
			expect(fetchMembers).not.toHaveBeenCalled();

			const element = document.getElementById(id);
			expect(element?.style.display).not.toBe('none');
			expect(element?.children).toHaveLength(0);
			banner.onViewClose();
			expect(clear).toHaveBeenCalledWith(id);
		} finally {
			request.mockRestore();
			clear.mockRestore();
			document.body.innerHTML = '';
			if (previousTarget === undefined) {
				delete process.env.VITE_CRAZYGAMES_TARGET;
			} else {
				process.env.VITE_CRAZYGAMES_TARGET = previousTarget;
			}
		}
	});

	test('shows members with at least $15 donated and excludes smaller donations', () => {
		const banner = new OpenCollectiveBanner({
			bannerSelector: '#opencollective-test-banner',
			onCloseView: () => undefined,
			isViewOpen: () => false,
		});
		const members = banner.normalizeMembers([
			{ name: 'Under threshold', profile: '/under', totalAmountDonated: 14.99 },
			{ name: 'At threshold', profile: '/at', totalAmountDonated: 15 },
		]);

		expect(members.map((member) => member.name)).toEqual(['At threshold']);
	});
});
