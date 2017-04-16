var Button = Class.create({
	/*	Constructor
	 *
	 *	Create attributes and default buttons
	 *
	 */
	initialize: function(opts) {

		defaultOpts = {
			click: function() {},
			mouseover: function() {},
			mouseleave: function() {},
			clickable: true,
			state: "normal", // disabled,normal,glowing,selected,active
			$button: undefined,
			attributes: {},
			css: {
				disabled: {},
				glowing: {},
				selected: {},
				active: {},
				normal: {},
			}
		};

		opts = $j.extend(defaultOpts, opts);
		$j.extend(this, opts);
		this.changeState(this.state);
	},


	changeState: function(state) {
		var btn = this;

		state = state || this.state;
		this.state = state;
		this.$button.unbind("click").unbind("mouseover").unbind("mouseleave");
		if (state != "disabled") {
			this.$button.bind("click", function() {
				if (G.freezedInput || !btn.clickable) return;
				btn.click();
			});
			this.$button.bind("mouseover", function() {
				if (G.freezedInput || !btn.clickable) return;
				btn.mouseover();
			});
			this.$button.bind("mouseleave", function() {
				if (G.freezedInput || !btn.clickable) return;
				btn.mouseleave();
			});
		}
		this.$button.removeClass("disabled glowing selected active noclick");
		this.$button.css(this.css["normal"]);

		if (state != "normal") {
			this.$button.addClass(state);
			this.$button.css(this.css[state]);
		}
	},

	triggerClick: function() {
		if (G.freezedInput || !this.clickable) return;
		this.click();
	},

	triggerMouseover: function() {
		if (G.freezedInput || !this.clickable) return;
		this.mouseover();
	},

	triggerMouseleave: function() {
		if (G.freezedInput || !this.clickable) return;
		this.mouseleave();
	},
});