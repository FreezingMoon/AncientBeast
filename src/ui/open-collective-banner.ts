import $j from 'jquery';

type OpenCollectiveMember = {
	name?: string;
	image?: string;
	profile?: string;
	role?: string;
	isActive?: boolean;
	totalAmountDonated?: number;
};

type OpenCollectiveBannerConfig = {
	bannerSelector: string;
	onCloseView: () => void;
	isViewOpen: () => boolean;
	enabled?: boolean;
};

const OPEN_COLLECTIVE_WIDGET_ENABLED = true;
const OPEN_COLLECTIVE_CACHE_KEY = 'ab-opencollective-members-v1';
const OPEN_COLLECTIVE_CACHE_TIME_KEY = 'ab-opencollective-members-ts-v1';
const OPEN_COLLECTIVE_REFRESH_TTL_MS = 12 * 60 * 60 * 1000;
const OPEN_COLLECTIVE_FEED_URL = 'https://opencollective.com/ancientbeast/members/all.json';

export class OpenCollectiveBanner {
	static readonly MEMBER_SIZE_PX = 68;
	static readonly MEMBER_GAP_PX = 8;
	static readonly TRACK_PADDING_LEFT_PX = 8;
	static readonly SPEED_PX_PER_SECOND = 36;

	$banner: JQuery<HTMLElement>; //eslint-disable-line no-undef
	$tooltip: JQuery<HTMLElement> | null; //eslint-disable-line no-undef
	$members: JQuery<HTMLElement> | null; //eslint-disable-line no-undef
	$track: JQuery<HTMLElement> | null; //eslint-disable-line no-undef
	onCloseView: () => void;
	isViewOpen: () => boolean;
	enabled: boolean;
	initialized: boolean;
	isFetching: boolean;
	allMembers: OpenCollectiveMember[];
	marqueeIntervalId: number | null;
	scrollOffsetPx: number;
	lastMarqueeTickTs: number | null;
	loopWidthPx: number;
	memberPitchPx: number;

	constructor(config: OpenCollectiveBannerConfig) {
		this.$banner = $j(config.bannerSelector);
		this.onCloseView = config.onCloseView;
		this.isViewOpen = config.isViewOpen;
		this.enabled = config.enabled ?? OPEN_COLLECTIVE_WIDGET_ENABLED;
		this.initialized = false;
		this.isFetching = false;
		this.allMembers = [];
		this.$tooltip = null;
		this.$members = null;
		this.$track = null;
		this.marqueeIntervalId = null;
		this.scrollOffsetPx = 0;
		this.lastMarqueeTickTs = null;
		this.loopWidthPx = 0;
		this.memberPitchPx = OpenCollectiveBanner.MEMBER_SIZE_PX + OpenCollectiveBanner.MEMBER_GAP_PX;
	}

	init() {
		if (this.initialized) {
			return;
		}

		this.initialized = true;

		if (!this.enabled || !this.$banner.length) {
			this.$banner.hide();
			return;
		}

		this.bindInteractions();
		this.allMembers = this.getCachedMembers();
		this.renderContributors();

		if (this.shouldRefreshMembers()) {
			this.fetchMembers();
		}
	}

	onViewOpen() {
		if (!this.enabled || !this.initialized) {
			return;
		}

		this.refreshMarqueeMetrics();
		this.startMarquee();

		if (this.shouldRefreshMembers()) {
			this.fetchMembers();
		}
	}

	onViewClose() {
		this.hideContributorTooltip();
		this.stopMarquee();
	}

	shouldRefreshMembers() {
		const lastRefreshRaw = localStorage.getItem(OPEN_COLLECTIVE_CACHE_TIME_KEY);
		if (!lastRefreshRaw) {
			return true;
		}

		const lastRefreshTs = Number(lastRefreshRaw);
		if (Number.isNaN(lastRefreshTs)) {
			return true;
		}

		return Date.now() - lastRefreshTs > OPEN_COLLECTIVE_REFRESH_TTL_MS;
	}

	bindInteractions() {
		this.$banner.on('mousedown contextmenu', (e) => {
			const mouseButton = (e as unknown as { which?: number }).which;
			if (mouseButton === 3 || e.type === 'contextmenu') {
				e.preventDefault();
				e.stopPropagation();
				if (this.isViewOpen()) {
					this.onCloseView();
				}
			}
		});
	}

	getTooltipElement() {
		if (this.$tooltip && this.$tooltip.length) {
			return this.$tooltip;
		}

		const $existing = $j('#opencollective_banner_tooltip');
		if ($existing.length) {
			this.$tooltip = $existing;
			return $existing;
		}

		const $tooltip = $j('<div>').attr('id', 'opencollective_banner_tooltip');
		$j('body').append($tooltip);
		this.$tooltip = $tooltip;
		return $tooltip;
	}

	showContributorTooltip(text: string, anchorEl: HTMLElement) {
		const $tooltip = this.getTooltipElement();
		$tooltip.text(text).addClass('active');

		const tooltipEl = $tooltip.get(0);
		if (!tooltipEl) {
			return;
		}

		window.requestAnimationFrame(() => {
			const rect = anchorEl.getBoundingClientRect();
			const tooltipWidth = tooltipEl.offsetWidth;
			const centeredLeft = rect.left + rect.width / 2;
			const leftMin = tooltipWidth / 2 + 8;
			const leftMax = window.innerWidth - tooltipWidth / 2 - 8;
			const left = Math.max(leftMin, Math.min(leftMax, centeredLeft));
			const top = rect.bottom + 8;

			$tooltip.css({
				left: `${left}px`,
				top: `${top}px`,
			});
		});
	}

	hideContributorTooltip() {
		if (!this.$tooltip || !this.$tooltip.length) {
			return;
		}

		this.$tooltip.removeClass('active');
	}

	startMarquee() {
		if (!this.$members || !this.$members.length || this.loopWidthPx <= 0) {
			return;
		}

		if (this.marqueeIntervalId !== null) {
			return;
		}

		this.lastMarqueeTickTs = window.performance.now();

		this.marqueeIntervalId = window.setInterval(() => {
			if (!this.isViewOpen()) {
				this.stopMarquee();
				return;
			}

			const now = window.performance.now();
			const previousTickTs = this.lastMarqueeTickTs ?? now;
			const deltaMs = now - previousTickTs;
			this.lastMarqueeTickTs = now;

			if (this.loopWidthPx <= 0) {
				return;
			}

			this.scrollOffsetPx =
				(this.scrollOffsetPx + (deltaMs / 1000) * OpenCollectiveBanner.SPEED_PX_PER_SECOND) %
				this.loopWidthPx;
			this.applyMarqueeOffset();
		}, 16);
	}

	stopMarquee() {
		if (this.marqueeIntervalId !== null) {
			window.clearInterval(this.marqueeIntervalId);
			this.marqueeIntervalId = null;
		}

		this.lastMarqueeTickTs = null;
	}

	applyMarqueeOffset() {
		if (!this.$members || !this.$members.length) {
			return;
		}

		const minWrapX = -OpenCollectiveBanner.MEMBER_SIZE_PX;

		this.$members.each((index, element) => {
			let memberX =
				OpenCollectiveBanner.TRACK_PADDING_LEFT_PX +
				index * this.memberPitchPx -
				this.scrollOffsetPx;

			if (this.loopWidthPx > 0) {
				while (memberX <= minWrapX) {
					memberX += this.loopWidthPx;
				}
			}

			(element as HTMLElement).style.transform = `translate3d(${memberX}px, -50%, 0)`;
		});
	}

	refreshMarqueeMetrics() {
		if (!this.$members || !this.$members.length || !this.$track || !this.$track.length) {
			this.loopWidthPx = 0;
			return;
		}

		const trackEl = this.$track.get(0);
		if (!trackEl) {
			this.loopWidthPx = 0;
			return;
		}

		const memberCount = this.$members.length;
		const contentWidth = memberCount * this.memberPitchPx;
		const visibleWidth = Math.max(
			0,
			trackEl.clientWidth - OpenCollectiveBanner.TRACK_PADDING_LEFT_PX,
		);

		if (contentWidth <= visibleWidth) {
			this.loopWidthPx = 0;
			this.scrollOffsetPx = 0;
			this.applyMarqueeOffset();
			return;
		}

		this.loopWidthPx = contentWidth;
		this.scrollOffsetPx = this.scrollOffsetPx % this.loopWidthPx;
		this.applyMarqueeOffset();
	}

	fetchMembers() {
		if (this.isFetching) {
			return;
		}

		this.isFetching = true;

		fetch(OPEN_COLLECTIVE_FEED_URL)
			.then((response) => {
				if (!response.ok) {
					throw new Error(`Failed to load OpenCollective members (${response.status})`);
				}
				return response.json() as Promise<OpenCollectiveMember[]>;
			})
			.then((members) => {
				const normalizedMembers = this.normalizeMembers(members);
				if (!normalizedMembers.length) {
					throw new Error('No OpenCollective members available for banner');
				}

				this.allMembers = normalizedMembers;
				localStorage.setItem(OPEN_COLLECTIVE_CACHE_KEY, JSON.stringify(normalizedMembers));
				localStorage.setItem(OPEN_COLLECTIVE_CACHE_TIME_KEY, Date.now().toString());
				this.renderContributors();
			})
			.catch(() => {
				// Keep whichever members are already rendered.
			})
			.finally(() => {
				this.isFetching = false;
			});
	}

	normalizeMembers(members: OpenCollectiveMember[]) {
		return members
			.filter((member) => member.isActive !== false)
			.filter((member) => Boolean(member.profile) && Boolean(member.name))
			.filter((member) => (member.totalAmountDonated || 0) > 0)
			.filter(
				(member, index, arr) =>
					arr.findIndex((entry) => entry.profile === member.profile) === index,
			);
	}

	getCachedMembers() {
		const cachedMembers = localStorage.getItem(OPEN_COLLECTIVE_CACHE_KEY);
		if (!cachedMembers) {
			return [];
		}

		try {
			const parsedMembers = JSON.parse(cachedMembers) as OpenCollectiveMember[];
			if (Array.isArray(parsedMembers) && parsedMembers.length) {
				return this.normalizeMembers(parsedMembers);
			}
		} catch {
			// Ignore corrupted cache.
		}

		return [];
	}

	getOrderedContributors() {
		return [...this.allMembers].sort(
			(a, b) => (b.totalAmountDonated || 0) - (a.totalAmountDonated || 0),
		);
	}

	renderCtaOnly() {
		this.hideContributorTooltip();
		this.stopMarquee();
		this.$members = null;
		this.$track = null;
		this.loopWidthPx = 0;
		const $inner = $j('<div>').addClass('opencollective_inner');
		const $ctaWrapper = $j('<div>').addClass('opencollective_cta_wrapper');
		const $cta = $j('<a>')
			.addClass('opencollective_cta')
			.attr({
				href: 'https://opencollective.com/ancientbeast/contribute',
				target: '_blank',
				rel: 'noopener noreferrer',
				'aria-label': 'Support Ancient Beast on OpenCollective',
			})
			.on('mousedown', (e) => {
				e.stopPropagation();
			})
			.on('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				window.open(
					'https://opencollective.com/ancientbeast/contribute',
					'_blank',
					'noopener,noreferrer',
				);
			})
			.text('Become a Sponsor');

		$ctaWrapper.append($cta);
		$inner.append($ctaWrapper);
		this.$banner.empty().append($inner).attr('data-oc-view', 'cta-only');
	}

	renderContributors() {
		const contributors = this.getOrderedContributors();
		if (!contributors.length) {
			this.renderCtaOnly();
			return;
		}

		this.hideContributorTooltip();
		this.stopMarquee();

		const $inner = $j('<div>').addClass('opencollective_inner');
		const $pill = $j('<div>').addClass('opencollective_pill');
		const $track = $j('<div>').addClass('opencollective_track');
		const $ctaWrapper = $j('<div>').addClass('opencollective_cta_wrapper');

		contributors.forEach((member) => {
			const href = member.profile || 'https://opencollective.com/ancientbeast';
			const $link = $j('<a>')
				.addClass('opencollective_member')
				.attr({
					href,
					target: '_blank',
					rel: 'noopener noreferrer',
					'aria-label': member.name || 'OpenCollective Supporter',
				})
				.on('mousedown', (e) => {
					e.stopPropagation();
				})
				.on('click', (e) => {
					e.preventDefault();
					e.stopPropagation();
					window.open(href, '_blank', 'noopener,noreferrer');
				})
				.on('mouseenter', (e) => {
					this.showContributorTooltip(
						member.name || 'OpenCollective Supporter',
						e.currentTarget as HTMLElement,
					);
				})
				.on('mouseleave', () => {
					this.hideContributorTooltip();
				});

			if (member.image) {
				$link.append(
					$j('<img>')
						.attr({
							src: member.image,
							alt: `${member.name || 'Supporter'} avatar`,
							loading: 'eager',
						})
						.on('load error', () => {
							if (this.isViewOpen()) {
								this.refreshMarqueeMetrics();
								this.startMarquee();
							}
						}),
				);
			}

			$track.append($link);
		});

		const $cta = $j('<a>')
			.addClass('opencollective_cta')
			.attr({
				href: 'https://opencollective.com/ancientbeast/contribute',
				target: '_blank',
				rel: 'noopener noreferrer',
				'aria-label': 'Support Ancient Beast on OpenCollective',
			})
			.on('mousedown', (e) => {
				e.stopPropagation();
			})
			.on('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				window.open(
					'https://opencollective.com/ancientbeast/contribute',
					'_blank',
					'noopener,noreferrer',
				);
			})
			.text('Become a Sponsor');

		$pill.append($track);
		$ctaWrapper.append($cta);
		$inner.append($pill, $ctaWrapper);
		this.$banner.empty().append($inner).attr('data-oc-view', 'contributors');
		this.$track = $track;
		this.$members = $track.children('.opencollective_member');
		this.applyMarqueeOffset();

		if (this.isViewOpen()) {
			this.refreshMarqueeMetrics();
			this.startMarquee();
		}
	}
}
