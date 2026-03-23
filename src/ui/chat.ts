import * as $j from 'jquery';
import * as str from '../utility/string';
import { PRIMARY_STATS, MASTERY_STATS } from '../utility/const';
import { Creature } from '../creature';
import { throttle } from 'underscore';
import Game from '../game';

type Message = {
	message: string;
	amount: number;
	time: string;
	class: string;
	DOMObject: JQuery.Node[]; //eslint-disable-line no-undef
};

type MessageToSupress = {
	pattern: RegExp;
	times: number;
};

export class Chat {
	game: Game;
	$chat: JQuery<HTMLElement>; //eslint-disable-line no-undef
	$content: JQuery<HTMLElement>; //eslint-disable-line no-undef
	$expandedContent: JQuery<HTMLElement>; //eslint-disable-line no-undef
	isOpen: boolean;
	messages: Message[];
	isExpanded: boolean;
	isOverCreature: boolean;
	currentExpandedCreature: Creature;
	messagesToSuppress: MessageToSupress[];

	/**
	 * Chat/Log Functions
	 * @constructor
	 */
	constructor(game: Game) {
		this.game = game;
		this.$chat = $j('#chat');
		this.$content = $j('#chatcontent');
		this.$chat.on('click', () => {
			this.toggle();
		});

		// Auto show and close chat when game starts #1107
		setTimeout(() => {
			this.toggle();
		}, 2000);
		setTimeout(() => {
			this.toggle();
		}, 5000);

		this.$chat.on('mouseenter', () => {
			this.peekOpen();
		});
		this.$chat.on('mouseleave', () => {
			this.peekClose();
		});

		this.messages = [];
		this.isOpen = false;
		this.isOverCreature = false;
		this.isExpanded = false;
		this.currentExpandedCreature = null;
		this.messagesToSuppress = [];

		this.$expandedContent = $j('#chatexpanded');
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
	_handleUiEvent(message: string, payload) {
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
		if (!this.isOpen) {
			this.hideExpanded();
		}
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
		this.isOpen = false;
		this.hideExpanded();
	}

	showExpanded(creature: Creature) {
		if (!creature || creature === this.currentExpandedCreature) {
			return;
		}
		this.isOverCreature = true;
		this.currentExpandedCreature = creature;
		this.isExpanded = true;

		const statsContent = this._createStatsContent(creature);
		const masteriesContent = this._createMasteriesContent(creature);

		const expandedHTML = `
				<div class="stats-masteries-container">
					<div class="stats-row">
						${statsContent}
					</div>
					<div class="masteries-row">
						${masteriesContent}
					</div>
				</div>
			`;

		if (this.$expandedContent.children().length > 0) {
			const statValues = this.$expandedContent
				.children()
				.children()
				.children()
				.children('.stat-value');
			statValues.stop().animate({ opacity: 0 }, 200, () => {
				this.$expandedContent.html(expandedHTML);
				statValues.animate({ opacity: 1 }, 200);
			});
			this.$expandedContent.stop().animate({ opacity: 1 }, 200);
		} else {
			this.$expandedContent.html(expandedHTML);
			this.$chat.addClass('expanded');

			this.$content.stop().animate({ opacity: 0 }, 500);
			this.$expandedContent.css({ opacity: 0 }).animate({ opacity: 1 }, 500);
		}
	}

	hideExpanded() {
		this.isOverCreature = false;
		setTimeout(() => {
			if (!this.isExpanded || this.isOverCreature) {
				return;
			}
			this.isExpanded = false;
			this.currentExpandedCreature = null;
			this.$expandedContent.stop().animate({ opacity: 0 }, 200, () => {
				this.$expandedContent.empty();
				this.$chat.removeClass('expanded');
				this.$content.animate({ opacity: 1 }, 200);
			});
		}, 20);
	}

	_createStatsContent(creature: Creature) {
		const stats = PRIMARY_STATS;
		return stats
			.map((stat) => {
				const value =
					stat === 'health'
						? `${creature.health}/${creature.stats[stat]}`
						: stat === 'energy'
						? `${creature.energy}/${creature.stats[stat]}`
						: stat === 'endurance'
						? `${creature.endurance}/${creature.stats[stat]}`
						: stat === 'movement'
						? `${creature.remainingMove}/${creature.stats[stat]}`
						: creature.stats[stat];

				return `
					<div class="stat-item">
						<div class="icon ${stat}"></div>
						<div class="stat-value">${value}</div>
					</div>
				`;
			})
			.join('');
	}

	_createMasteriesContent(creature: Creature) {
		const masteries = MASTERY_STATS;
		return masteries
			.map((mastery) => {
				const value = creature.stats[mastery];
				return `
					<div class="stat-item">
						<div class="icon ${mastery}"></div>
						<div class="stat-value">${value}</div>
					</div>
				`;
			})
			.join('');
	}

	getCurrentTime() {
		const currentTime = new Date(new Date().valueOf() - this.game.startMatchTime.valueOf());
		return (
			str.zfill(currentTime.getUTCHours(), 2) +
			':' +
			str.zfill(currentTime.getMinutes(), 2) +
			':' +
			str.zfill(currentTime.getSeconds(), 2)
		);
	}

	createHTMLTemplate(msg: string, amount: number, msgTime = null, ifOuter = true, htmlClass = '') {
		const timeTemplate = msgTime ? '<i>' + msgTime + '</i> ' : '',
			amountTemplate = amount > 1 ? ' [ ' + amount + 'x ]' : '';

		if (ifOuter) {
			return "<p class='" + htmlClass + "'>" + timeTemplate + msg + amountTemplate + '</p>';
		} else {
			return timeTemplate + msg + amountTemplate;
		}
	}

	addMsg(msg: string, htmlClass: string, ifNoTimestamp = false) {
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
	suppressMessage(pattern: RegExp, times = 1) {
		this.messagesToSuppress.push({
			pattern,
			times,
		});
	}
}
