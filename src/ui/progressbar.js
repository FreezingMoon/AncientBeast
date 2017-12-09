import * as $j from "jquery";

export class ProgressBar {
	constructor(opts, game) {
		let defaultOpts = {
			height: 318,
			width: 9,
			color: "red",
			$bar: undefined
		};

		this.game = game;
		opts = $j.extend(defaultOpts, opts);
		$j.extend(this, opts);

		this.$bar.append('<div class="previewbar"></div>');
		this.$preview = this.$bar.children(".previewbar");

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
			"background-color": this.color,
		});
	}

	/* animSize
	 *
	 * percentage :	Float :	size between 0 and 1
	 *
	 */
	animSize(percentage) {
		this.$bar.transition({
			queue: false,
			width: this.width,
			height: this.height * percentage,
		}, 500, "linear");
	}

	/* previewSize
	 *
	 * percentage :	Float :	size between 0 and 1
	 *
	 */
	previewSize(percentage) {
		this.$preview.css({
			width: this.width - 2,
			height: (this.height - 2) * percentage,
		}, 500, "linear");
	}
};
