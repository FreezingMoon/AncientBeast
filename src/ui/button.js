import * as $j from 'jquery';

export class Button {
	/**
	 * Constructor - Create attributes and default buttons
	 * @constructor
	 * @param {Object} opts - Options
	 * @param {Object} game - Game object
	 */
	constructor(opts, game) {
		this.game = game;

		let defaultOpts = {
			click: function () {},
			mouseover: function () {},
			mouseleave: function () {},
			touchstart: function () {},
			touchend: function () {},
			touchX: 0,
			touchY: 0,
			hasShortcut: false,
			clickable: true,
			state: 'normal', // disabled, normal, glowing, selected, active
			$button: undefined,
			attributes: {},
			css: {
				disabled: {},
				glowing: {},
				selected: {},
				active: {},
				normal: {},
				slideIn: {},
			},
		};

		opts = $j.extend(defaultOpts, opts);
		$j.extend(this, opts);
		this.changeState(this.state);

		// Used in applying and removing CSS transitions
		this.cssTransitionMeta = {
			transition: null,
		};
		this.resolveCssTransition = null;
	}

	changeState(state) {
		let game = this.game;

		state = state || this.state;
		this.state = state;
		this.$button
			.unbind('click')
			.unbind('mouseover')
			.unbind('touchstart')
			.unbind('touchend')
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

			if (this.hasShortcut) {
				this.$button.addClass('hover');
			}

			this.mouseover();
		});

		this.$button.bind('mouseleave', () => {
			if (game.freezedInput || !this.clickable) {
				return;
			}

			if (this.hasShortcut) {
				this.$button.removeClass('hover');
			}

			this.mouseleave();
		});

		this.$button.bind('touchstart', (event) => {
			event.preventDefault();
			event.stopPropagation();

			if (game.freezedInput || !this.clickable) {
				return;
			}

			if (this.hasShortcut) {
				this.$button.addClass('hover');
			}

			this.touchX = event.changedTouches[0].pageX;
			this.touchY = event.changedTouches[0].pageY;
		});

		this.$button.bind('touchend', (event) => {
			event.preventDefault();
			event.stopPropagation();

			if (game.freezedInput || !this.clickable) {
				return;
			}

			if (this.hasShortcut) {
				this.$button.removeClass('hover');
			}

			if (this.shouldTriggerClick(event.changedTouches[0]) && this.state != 'disabled') {
				this.click();
			}
		});

		this.$button.removeClass('disabled glowing selected active noclick slideIn');
		this.$button.css(this.css.normal);

		if (state != 'normal') {
			this.$button.addClass(state);
			this.$button.css(this.css[state]);
		}
	}

	/**
	 * Apply a CSS class on a button for a duration
	 * Useful for flashing a different icon etc for a certain period of time
	 * @param {string} transitionClass A CSS class to apply for the transitition
	 * @param {number} transitionMs Time spent in the transition
	 */
	cssTransition(transitionClass, transitionMs) {
		const resolveCssTransitionTask = () => {
			this.$button.removeClass(transitionClass);
			this.resolveTransitionTask = null;
		};

		// Check if the metadata matches, if not then you start the transition immediately, otherwise
		// preserve previous triggers but extend duration
		if (this.cssTransitionMeta.transitionClass !== transitionClass) {
			this.$button.removeClass(this.cssTransitionMeta.transitionClass);
			this.$button.addClass(transitionClass);
			this.stateTransitionMeta = {
				transitionClass,
			};
		}

		if (this.resolveCssTransitionTask) {
			clearTimeout(this.resolveCssTransitionTask);
			this.resolveCssTransitionTask = null;
		}

		// If transition state is not to be reached, do not call the transition function
		// This eliminates async issues that might be encountered by careless use
		if (transitionMs > 0) {
			this.resolveCssTransitionTask = setTimeout(resolveCssTransitionTask, transitionMs);
		}
	}

	triggerClick() {
		if (this.game.freezedInput || !this.clickable || this.state === 'disabled') {
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

	shouldTriggerClick(changedTouches) {
		const endTouchX = changedTouches.pageX;
		const endTouchY = changedTouches.pageY;
		let result = false;

		if (Math.abs(this.touchX - endTouchX) < 50 && Math.abs(this.touchY - endTouchY) < 50) {
			result = true;
		}

		return result;
	}
}
