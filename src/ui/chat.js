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

	createHTMLTemplate(msgTime, msg, amount, ifOuter = true, htmlClass = '') {
		if (ifOuter) {
			return (
				"<p class='" +
				htmlClass +
				"'><i>" +
				msgTime +
				'</i> ' +
				msg +
				(amount > 1 ? ' [ ' + amount + 'x ]' : '') +
				'</p>'
			);
		} else {
			return '<i>' + msgTime + '</i> ' + msg + (amount > 1 ? ' [ ' + amount + 'x ]' : '');
		}
	}

	addMsg(msg, htmlClass) {
		let messagesNo = this.messages.length;
		let currentTime = this.getCurrentTime();

		// Check if the last message was the same as the current one
		if (this.messages[messagesNo - 1] && this.messages[messagesNo - 1].message === msg) {
			let lastMessage = this.messages[messagesNo - 1];
			lastMessage.amount++;
			lastMessage.time = currentTime;
			$j(lastMessage.DOMObject).html(
				this.createHTMLTemplate(currentTime, msg, lastMessage.amount, false)
			);
		} else {
			this.messages.push({
				message: msg,
				amount: 1,
				time: currentTime,
				class: htmlClass,
				DOMObject: $j.parseHTML(this.createHTMLTemplate(currentTime, msg, 1, true, htmlClass))
			});
			this.$content.append(this.messages[this.messages.length - 1].DOMObject);
		}

		//Append the last messages DOM object

		this.$content.parent().scrollTop(this.$content.height());
	}
}
