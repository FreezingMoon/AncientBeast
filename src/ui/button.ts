import * as $j from 'jquery';

export const ButtonStateEnum = {
	normal: 'normal',
	disabled: 'disabled',
	glowing: 'glowing',
	selected: 'selected',
	active: 'active',
	hidden: 'hidden',
	noClick: 'noclick',
	slideIn: 'slideIn',
} as const;

type ValueOf<T> = T[keyof T];
type ButtonState = ValueOf<typeof ButtonStateEnum>;

export class Button {
	private isGameAcceptingInput: () => boolean;
	state: ButtonState;
	cssTransitionMeta: { transitionClass: any };
	resolveCssTransition: null;
	$button: any;
	overridefreeze: any;
	clickable: any;
	hasShortcut: any;
	touchX: any;
	touchY: any;
	css: any;
	resolveTransitionTask: null;
	stateTransitionMeta: { transitionClass: any };
	resolveCssTransitionTask: any;
	click() {
		throw new Error('Method not implemented.');
	}
	/**
	 * Constructor - Create attributes and default buttons
	 * @constructor
	 * @param {Object} opts - Options
	 * @param {Object} {isAcceptingInput: () => boolean}
	 */
	constructor(opts, configuration: { isAcceptingInput: () => boolean }) {
		this.isGameAcceptingInput = configuration.isAcceptingInput;

		const defaultOpts = {
			click: function () {},
			mouseover: function () {},
			mouseleave: function () {},
			touchstart: function () {},
			touchend: function () {},
			touchX: 0,
			touchY: 0,
			hasShortcut: false,
			clickable: true,
			state: ButtonStateEnum.normal,
			$button: undefined,
			attributes: {},
			overridefreeze: false,
			css: {
				disabled: {},
				glowing: {},
				selected: {},
				active: {},
				normal: {},
				slideIn: {},
				hidden: {},
				noclick: {},
			},
		};

		opts = $j.extend(defaultOpts, opts);
		$j.extend(this, opts);
		this.changeState(this.state);

		// Used in applying and removing CSS transitions
		this.cssTransitionMeta = {
			transitionClass: null,
		};
		this.resolveCssTransition = null;
	}

	changeState(state) {
		const wrapperElement = this.$button.parent();

		state = state || this.state;
		this.state = state;
		this.$button
			.unbind('click')
			.unbind('mouseover')
			.unbind('touchstart')
			.unbind('touchend')
			.unbind('mouseleave');

		if (!['disabled', 'hidden'].includes(this.state)) {
			this.$button.bind('click', () => {
				if (!this.overridefreeze) {
					if (!this.isGameAcceptingInput || !this.clickable) {
						return;
					}
				}

				this.click();
			});
		}

		this.$button.bind('mouseover', () => {
			if (!this.overridefreeze) {
				if (!this.isGameAcceptingInput || !this.clickable) {
					return;
				}
			}

			if (this.hasShortcut) {
				this.$button.addClass('hover');
			}

			this.mouseover();
		});

		this.$button.bind('mouseleave', () => {
			if (!this.overridefreeze) {
				if (!this.isGameAcceptingInput || !this.clickable) {
					return;
				}
			}
			if (this.hasShortcut) {
				this.$button.removeClass('hover');
			}

			this.mouseleave();
		});

		this.$button.bind('touchstart', (event) => {
			event.preventDefault();
			event.stopPropagation();
			if (!this.overridefreeze) {
				if (!this.isGameAcceptingInput || !this.clickable) {
					return;
				}
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
			if (!this.overridefreeze) {
				if (!this.isGameAcceptingInput || !this.clickable) {
					return;
				}
			}

			if (this.hasShortcut) {
				this.$button.removeClass('hover');
			}

			if (
				this.shouldTriggerClick(event.changedTouches[0]) &&
				this.state !== ButtonStateEnum.disabled
			) {
				this.click();
			}
		});

		this.$button.removeClass('disabled glowing selected active noclick slideIn hidden');
		wrapperElement && wrapperElement.removeClass('hidden');
		this.$button.css(this.css.normal);

		if (state === ButtonStateEnum.hidden) {
			if (wrapperElement && wrapperElement.attr('id').includes(this.$button.attr('id'))) {
				wrapperElement.addClass('hidden');
			}
		}
		if (state !== ButtonStateEnum.normal) {
			this.$button.addClass(state);
			this.$button.css(this.css[state]);
		}
	}
	mouseover() {
		throw new Error('Method not implemented.');
	}
	mouseleave() {
		throw new Error('Method not implemented.');
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
		if (!this.overridefreeze) {
			if (
				!this.isGameAcceptingInput ||
				!this.clickable ||
				['disabled', 'hidden'].includes(this.state)
			) {
				return;
			}
		}

		this.click();
	}

	triggerMouseover() {
		if (!this.overridefreeze) {
			if (!this.isGameAcceptingInput || !this.clickable) {
				return;
			}
		}

		this.mouseover();
	}

	triggerMouseleave() {
		if (!this.overridefreeze) {
			if (!this.isGameAcceptingInput || !this.clickable) {
				return;
			}
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
