import * as $j from "jquery";
import * as time from "../utility/time";
import * as str from "../utility/string";

export class Chat {
	/* Constructor
	 *
	 * Chat/Log Functions
	 *
	 */
	constructor(game) {
		this.game = game;
		this.$chat = $j("#chat");
		this.$content = $j("#chatcontent");
		this.$chat.bind('click', () => {
			game.UI.chat.toggle();
		});

		$j("#combatwrapper, #toppanel, #dash, #endscreen").bind('click', () => {
			game.UI.chat.hide();
		});
	}


	show() {
		this.$chat.addClass("focus");
	}

	hide() {
		this.$chat.removeClass("focus");
	}

	toggle() {
		this.$chat.toggleClass("focus");
		this.$content.parent().scrollTop(this.$content.height());
	}

	addMsg(msg, htmlclass) {
		let time = new Date(new Date() - this.game.startMatchTime);
		this.$content.append("<p class='" + htmlclass + "'><i>" + str.zfill(time.getUTCHours(), 2) + ":" + str.zfill(time.getMinutes(), 2) + ":" + str.zfill(time.getSeconds(), 2) + "</i> " + msg + "</p>");
		this.$content.parent().scrollTop(this.$content.height());
	}
}
