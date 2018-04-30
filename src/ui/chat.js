import * as $j from 'jquery';
// Unused for now
// import * as time from '../utility/time';
import * as str from '../utility/string';

export class Chat {
	/* Constructor
	 *
	 * Chat/Log Functions
	 *
	 */
	constructor(game) {
		this.game = game;
		this.$chat = $j('#chat');
		this.$content = $j('#chatcontent');
		this.$chat.bind('click', () => {
			game.UI.chat.toggle();
		});
		this.messages = [];

		$j('#combatwrapper, #toppanel, #dash, #endscreen').bind('click', () => {
			game.UI.chat.hide();
		});
	}

	show() {
		this.$chat.addClass('focus');
	}

	hide() {
		this.$chat.removeClass('focus');
	}

	toggle() {
		this.$chat.toggleClass('focus');
		this.$content.parent().scrollTop(this.$content.height());
	}

	getCurrentTime() {
		let currentTime = new Date(new Date() - this.game.startMatchTime);
		return (
			str.zfill(currentTime.getUTCHours(), 2) +
			':' +
			str.zfill(currentTime.getMinutes(), 2) +
			':' +
			str.zfill(currentTime.getSeconds(), 2)
		);
	}

	createHTMLTemplate(msg, amount, msgTime = null, ifOuter = true, htmlClass = '') {
		let timeTemplate = msgTime ? '<i>' + msgTime + '</i> ' : '',
			amountTemplate = amount > 1 ? ' [ ' + amount + 'x ]' : '';

		if (ifOuter) {
			return "<p class='" + htmlClass + "'>" + timeTemplate + msg + amountTemplate + '</p>';
		} else {
			return timeTemplate + msg + amountTemplate;
		}
	}

	addMsg(msg, htmlClass, ifNoTimestamp = false) {
		let messagesNo = this.messages.length;
		let currentTime = ifNoTimestamp ? null : this.getCurrentTime();

		// Check if the last message was the same as the current one
		if (this.messages[messagesNo - 1] && this.messages[messagesNo - 1].message === msg) {
			let lastMessage = this.messages[messagesNo - 1];
			lastMessage.amount++;
			lastMessage.time = currentTime;
			$j(lastMessage.DOMObject).html(
				this.createHTMLTemplate(msg, lastMessage.amount, currentTime, false)
			);
		} else {
			this.messages.push({
				message: msg,
				amount: 1,
				time: currentTime,
				class: htmlClass,
				DOMObject: $j.parseHTML(this.createHTMLTemplate(msg, 1, currentTime, true, htmlClass))
			});

			//Append the last message's DOM object
			this.$content.append(this.messages[this.messages.length - 1].DOMObject);
		}

		this.$content.parent().scrollTop(this.$content.height());
	}
}
