import * as $j from 'jquery';

export class Button {
	/**
	 * Constructor
	 *
	 *	Create attributes and default buttons
	 *
	 */
	constructor(opts, game) {
		this.game = game;

		let defaultOpts = {
			click: function() {},
			mouseover: function() {},
			mouseleave: function() {},
			clickable: true,
			state: 'normal', // disabled, normal, glowing, selected, active
			$button: undefined,
			attributes: {},
			css: {
				disabled: {},
				glowing: {},
				selected: {},
				active: {},
				normal: {}
			}
		};

		opts = $j.extend(defaultOpts, opts);
		$j.extend(this, opts);
		this.changeState(this.state);
	}

	changeState(state) {
		let game = this.game;

		state = state || this.state;
		this.state = state;
		this.$button
			.unbind('click')
			.unbind('mouseover')
			.unbind('mouseleave');

		if (state != 'disabled') {
			this.$button.bind('click', () => {
				if (game.freezedInput || !this.clickable) {
					return;
				}

				this.click();
			});
		}

		this.$button.bind('mouseover', () => {
			if (game.freezedInput || !this.clickable) {
				return;
			}

			this.mouseover();
		});

		this.$button.bind('mouseleave', () => {
			if (game.freezedInput || !this.clickable) {
				return;
			}

			this.mouseleave();
		});

		this.$button.removeClass('disabled glowing selected active noclick');
		this.$button.css(this.css.normal);

		if (state != 'normal') {
			this.$button.addClass(state);
			this.$button.css(this.css[state]);
		}
	}

	triggerClick() {
		if (this.game.freezedInput || !this.clickable) {
			return;
		}

		this.click();
	}

	triggerMouseover() {
		if (this.game.freezedInput || !this.clickable) {
			return;
		}

		this.mouseover();
	}

	triggerMouseleave() {
		if (this.game.freezedInput || !this.clickable) {
			return;
		}

		this.mouseleave();
	}
}
