import * as $j from 'jquery';
import * as str from '../utility/string';

export class Chat {
	/**
	 * Chat/Log Functions
	 * @constructor
	 */
	constructor(game) {
		this.game = game;
		this.$chat = $j('#chat');
		this.$content = $j('#chatcontent');
		this.$chat.on('click', () => {
			this.toggle();
		});
		this.$chat.on(
			setTimeout(() => {
				this.toggle();
			}, 2000),
		);
		this.$chat.on(
			setTimeout(() => {
				this.toggle();
			}, 5000),
		);
		this.$chat.on('mouseenter', () => {
			this.peekOpen();
		});
		this.$chat.on('mouseleave', () => {
			this.peekClose();
		});

		this.messages = [];
		this.isOpen = false;
		this.messagesToSuppress = [];

		$j('#combatwrapper, #toppanel, #dash, #endscreen').on('click', () => {
			this.hide();
		});

		// Events
		this.game.signals.ui.add(this._handleUiEvent, this);
	}

	/**
	 * Handle events on the "ui" channel.
	 *
	 * @param {string} message Event name.
	 * @param {object} payload Event payload.
	 */
	_handleUiEvent(message, payload) {
		if (
			message === 'toggleDash' ||
			message === 'toggleScore' ||
			message === 'toggleMusicPlayer' ||
			message === 'toggleMetaPowers' ||
			message === 'closeInterfaceScreens'
		) {
			this.hide();
		}
	}

	show() {
		this.$chat.addClass('focus');
		this.isOpen = true;
	}

	hide() {
		this.$chat.removeClass('focus');
		this.isOpen = false;
	}

	toggle() {
		this.$chat.toggleClass('focus');
		if (this.$chat.hasClass('peek')) {
			this.$chat.removeClass('peek');
		}
		this.$content.parent().scrollTop(this.$content.height());
		this.isOpen = !this.isOpen;
	}

	peekOpen() {
		if (this.$chat.hasClass('focus') === false) {
			this.$chat.addClass('peek');
			this.$content.parent().scrollTop(this.$content.height());
			this.isOpen = !this.isOpen;
		}
	}

	peekClose() {
		if (this.$chat.hasClass('peek')) {
			this.$chat.removeClass('peek');
		}
	}

	getCurrentTime() {
		const currentTime = new Date(new Date() - this.game.startMatchTime);
		return (
			str.zfill(currentTime.getUTCHours(), 2) +
			':' +
			str.zfill(currentTime.getMinutes(), 2) +
			':' +
			str.zfill(currentTime.getSeconds(), 2)
		);
	}

	createHTMLTemplate(msg, amount, msgTime = null, ifOuter = true, htmlClass = '') {
		const timeTemplate = msgTime ? '<i>' + msgTime + '</i> ' : '',
			amountTemplate = amount > 1 ? ' [ ' + amount + 'x ]' : '';

		if (ifOuter) {
			return "<p class='" + htmlClass + "'>" + timeTemplate + msg + amountTemplate + '</p>';
		} else {
			return timeTemplate + msg + amountTemplate;
		}
	}

	addMsg(msg, htmlClass, ifNoTimestamp = false) {
		const messagesNo = this.messages.length;
		const currentTime = ifNoTimestamp ? null : this.getCurrentTime();

		const suppressedMessageIndex = this.messagesToSuppress.findIndex((message) =>
			message.pattern.test(msg),
		);
		if (suppressedMessageIndex > -1) {
			const message = this.messagesToSuppress[suppressedMessageIndex];
			message.times = message.times - 1;

			if (message.times <= 0) {
				this.messagesToSuppress.splice(suppressedMessageIndex, 1);
			}

			return;
		}

		// Check if the last message was the same as the current one
		if (this.messages[messagesNo - 1] && this.messages[messagesNo - 1].message === msg) {
			const lastMessage = this.messages[messagesNo - 1];
			lastMessage.amount++;
			lastMessage.time = currentTime;
			$j(lastMessage.DOMObject).html(
				this.createHTMLTemplate(msg, lastMessage.amount, currentTime, false),
			);
		} else {
			this.messages.push({
				message: msg,
				amount: 1,
				time: currentTime,
				class: htmlClass,
				DOMObject: $j.parseHTML(this.createHTMLTemplate(msg, 1, currentTime, true, htmlClass)),
			});

			// Append the last message's DOM object
			this.$content.append(this.messages[this.messages.length - 1].DOMObject);
		}

		this.$content.parent().scrollTop(this.$content.height());
	}

	/**
	 * Suppress a message from being output to the chat log.
	 *
	 * @param {RegExp} pattern If the chat log message matches this pattern, it will be suppressed.
	 * @param {number} times Suppress the message this many times.
	 */
	suppressMessage(pattern, times = 1) {
		this.messagesToSuppress.push({
			pattern,
			times,
		});
	}
}
