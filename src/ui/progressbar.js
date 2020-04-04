import * as $j from 'jquery';

export class ProgressBar {
	constructor(opts, game) {
		let defaultOpts = {
			height: 316,
			width: 7,
			color: 'red',
			$bar: undefined,
		};

		this.game = game;
		opts = $j.extend(defaultOpts, opts);
		$j.extend(this, opts);

		this.$bar.append('<div class="previewbar"></div>');
		this.$preview = this.$bar.children('.previewbar');

		this.$bar.append('<div class="currentbar"></div>');
		this.$current = this.$bar.children('.currentbar');

		this.setSize(1);
	}

	/* setSize
	 *
	 * percentage :	Float :	Size between 0 and 1
	 *
	 */
	setSize(percentage) {
		this.$bar.css({
			width: this.width,
			height: this.height * percentage,
			border: 'solid 1px',
			'border-color': 'transparent',
		});

		this.$current.css({
			width: this.width,
			height: this.height * percentage,
			'background-color': this.color,
			opacity: 1,
		});
	}

	/* animSize
	 *
	 * percentage :	Float :	size between 0 and 1
	 *
	 */
	animSize(percentage) {
		this.$bar.transition(
			{
				queue: false,
				width: this.width,
				height: this.height * percentage,
			},
			500,
			'linear',

		);

		this.$current.transition(
			{
				queue: false,
				width: this.width,
				height: this.height * percentage,
				'background-color': this.color,
				opacity: 1,
			},
			500,
			'linear',
		);
	}

	/* previewSize
	 *
	 * percentage :	Float :	size between 0 and 1
	 *
	 */
	previewSize(percentage) {
		this.$preview.css(
			{
				width: this.width,
				height: this.height * percentage,
				'background-image': 'none',

			},
			500,
			'linear',
		);
	}

	// When enough progress is available to use
	setAvailableStyle() {
		this.$preview.css({
			'background-image':
				'linear-gradient(0deg, #000000 25%,' +
				this.color +
				' 25%,' +
				this.color +
				' 50%, #000000 50%, #000000 75%,' +
				this.color +
				' 75%,' +
				this.color +
				' 100%)',

			'background-size': '8.00px 8.00px', // 2 px lines
			// 'background-size': '4.00px 4.00px', // 1px lines
		});
	}

	// When not enough progress is available to use
	setUnavailableStyle() {
		// Border only added to surround the black preview bar indicating missing progress
		this.$bar.css({
			'border-color': this.color,
		});

		this.$preview.css({
			'background-image': 'none',
			'background-color': 'black',
		});

		this.$current.css({
			'background-color': this.color,
			opacity: 0.25,
		});
	}
}
