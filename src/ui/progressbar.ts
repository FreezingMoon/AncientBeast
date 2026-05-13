/* eslint-disable @typescript-eslint/no-explicit-any */
import * as $j from 'jquery';

type ProgressBarOptions = {
	height: number;
	width: number;
	color: string;
	$bar: ReturnType<typeof $j> | undefined;
};

export class ProgressBar {
	$bar: any;
	$preview: any;
	$current: any;
	width: number;
	height: number;
	color: string;

	private normalizePercentage(percentage: number): number {
		if (!Number.isFinite(percentage)) {
			return 0;
		}

		const normalized = Math.max(0, Math.min(1, percentage));
		// Avoid subpixel remnants: if the rendered height would be under 1px, treat it as zero.
		if (normalized * this.height < 1) {
			return 0;
		}

		return normalized;
	}

	private syncGlowState(percentage: number) {
		if (percentage < 0.005) {
			this.$current.addClass('no-glow');
			return;
		}

		this.$current.removeClass('no-glow');
	}

	constructor(opts: Partial<ProgressBarOptions>) {
		const defaultOpts: ProgressBarOptions = {
			height: 316,
			width: 7,
			color: 'red',
			$bar: undefined,
		};

		opts = Object.assign({}, defaultOpts, opts);
		$j.extend(this, opts);

		this.$bar.append('<div class="previewbar"></div>');
		this.$preview = this.$bar.children('.previewbar');

		this.$bar.append('<div class="currentbar"></div>');
		this.$current = this.$bar.children('.currentbar');

		this.setSize(1);
	}

	/**
	 * @param{number} percentage - Size between 0 and 1
	 */
	setSize(percentage: number) {
		const normalizedPercentage = this.normalizePercentage(percentage);
		this.syncGlowState(normalizedPercentage);

		this.$bar.css({
			width: this.width,
			height: this.height * normalizedPercentage,
			border: 'solid 1px',
			'border-color': 'transparent',
		});

		this.$current.css({
			width: this.width,
			height: this.height * normalizedPercentage,
			'background-color': this.color,
			'background-image': 'none',
			color: this.color,
		});
	}

	/**
	 * @param{number} percentage - size between 0 and 1
	 */
	animSize(percentage: number) {
		const normalizedPercentage = this.normalizePercentage(percentage);
		this.syncGlowState(normalizedPercentage);

		this.$bar.transition(
			{
				queue: false,
				width: this.width,
				height: this.height * normalizedPercentage,
			},
			500,
			'linear',
		);

		this.$current.transition(
			{
				queue: false,
				width: this.width,
				height: this.height * normalizedPercentage,
				'background-color': this.color,
				'background-image': 'none',
				color: this.color,
			},
			500,
			'linear',
		);
	}

	/**
	 * @param{number} percentage - size between 0 and 1
	 */
	previewSize(percentage: number) {
		const normalizedPercentage = this.normalizePercentage(percentage);

		this.$preview.css(
			{
				width: this.width,
				height: this.height * normalizedPercentage,
				'background-image': 'none',
			},
			500,
			'linear',
		);
	}

	// Sets element's background-image with diagonal stripe pattern
	setStripePattern(element, animated = false) {
		element.css({
			'background-color': this.color,
			'background-image':
				'repeating-linear-gradient(45deg, rgba(0, 0, 0, 0.9) 0 2px, rgba(0, 0, 0, 0) 2px 8px)',
			'background-size': '12px 12px',
			animation: animated ? 'progressStripeShift 900ms linear infinite' : 'none',
			color: this.color,
		});
	}

	// When enough progress is available to use
	setAvailableStyle() {
		this.$bar.css({
			'border-color': 'transparent',
		});

		this.$current.css({
			'background-color': this.color,
			'background-image': 'none',
			color: this.color,
		});

		this.$preview.removeClass('glow-active');
		this.$preview.css({
			'background-color': 'transparent',
		});
		this.setStripePattern(this.$preview, true);
	}

	// When not enough progress is available to use
	setUnavailableStyle() {
		// Border only added to surround the black preview bar indicating missing progress
		this.$bar.css({
			'border-color': this.color,
		});

		this.$preview.removeClass('glow-active');
		this.$preview.css({
			'background-image': 'none',
			'background-color': 'black',
			animation: 'none',
		});

		this.setStripePattern(this.$current, false);
	}

	/**
	 * Change the bar's color dynamically
	 * @param {string} newColor - CSS color value
	 */
	setColor(newColor: string) {
		this.color = newColor;
		this.$current.css({
			'background-color': this.color,
			'background-image': 'none',
			animation: 'none',
			color: this.color,
		});
		this.$preview.css({
			color: this.color,
		});
		// Keep the fill container border transparent in normal mode to avoid
		// 1px artifacts when the fill height is zero.
		const existingBorderColor = this.$bar.css('border-color');
		const isTransparentBorder =
			existingBorderColor === 'transparent' ||
			existingBorderColor === 'rgba(0, 0, 0, 0)' ||
			existingBorderColor === 'rgba(0,0,0,0)';

		this.$bar.css({
			'border-color': isTransparentBorder ? 'transparent' : this.color,
		});
	}
}
