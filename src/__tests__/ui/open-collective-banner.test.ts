import { describe, expect, test } from '@jest/globals';
import { OpenCollectiveBanner } from '../../ui/open-collective-banner';

describe('OpenCollectiveBanner contributor filtering', () => {
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
