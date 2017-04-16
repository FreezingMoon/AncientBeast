var Chat = Class.create({
	/*	Constructor
	 *
	 *	Chat/Log Functions
	 *
	 */
	initialize: function() {
		this.$chat = $j("#chat");
		this.$content = $j("#chatcontent");
		this.$chat.bind('click', function() {
			G.UI.chat.toggle();
		});
		$j("#combatwrapper, #toppanel, #dash, #endscreen").bind('click', function() {
			G.UI.chat.hide();
		});
	},


	show: function() {
		this.$chat.addClass("focus");
	},
	hide: function() {
		this.$chat.removeClass("focus");
	},
	toggle: function() {
		this.$chat.toggleClass("focus");
		this.$content.parent().scrollTop(this.$content.height());
	},

	addMsg: function(msg, htmlclass) {
		var time = new Date(new Date() - G.startMatchTime);
		this.$content.append("<p class='" + htmlclass + "'><i>" + str.zfill(time.getUTCHours(), 2) + ":" + str.zfill(time.getMinutes(), 2) + ":" + str.zfill(time.getSeconds(), 2) + "</i> " + msg + "</p>");
		this.$content.parent().scrollTop(this.$content.height());
	},
});
