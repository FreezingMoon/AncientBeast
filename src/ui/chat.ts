import $j from 'jquery';
import * as str from '../utility/string';
import { PRIMARY_STATS, MASTERY_STATS } from '../utility/const';
import { Creature } from '../creature';
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

type HoverableCreature = Creature & { hideUnitStatsOnHover?: boolean };

/**
 * Slack allowed when deciding whether the log rests at its newest message.
 * Layout is fractional, so an untouched bottom rarely lands on a whole pixel.
 */
const SCROLL_BOTTOM_SLACK = 4;

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
	 * True once the player has opened or closed the log themselves. Automatic
	 * collapses defer to this so the log stays where the player put it.
	 */
	userToggled: boolean;

	/**
	 * Chat/Log Functions
	 * @constructor
	 */
	constructor(game: Game) {
		this.game = game;
		this.$chat = $j('#chat');
		this.$content = $j('#chatcontent');
		this.$chat.on('click', () => {
			if (!$j('body').hasClass('portrait-mode')) {
				this.toggle();
			}
		});

		// Auto show and close chat when game starts #1107
		setTimeout(() => {
			this.show();
		}, 2000);
		setTimeout(() => {
			this.hide();
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
		this.userToggled = false;

		this.$expandedContent = $j('#unit-hover-panel');
		$j('#combatwrapper, #bottompanel, #dash, #endscreen').on('click', () => {
			this.hide();
		});

		// Events
		// Chat collapses whenever any interface screen takes over the viewport.
		for (const message of [
			'toggleDash',
			'toggleScore',
			'toggleMusicPlayer',
			'toggleMetaPowers',
			'closeInterfaceScreens',
		] as const) {
			this.game.channels.ui.on(message, () => this.hide());
		}
	}

	/**
	 * `isOpen` drives Esc handling and the interface-view bookkeeping, so it has
	 * to agree with what is on screen. Deriving it from the classes is the only
	 * way to keep it honest: the three states (minimized, peek, focus) are
	 * reachable from each other, and flipping a boolean per transition drifts
	 * as soon as two of them meet.
	 */
	syncOpenState() {
		this.isOpen = this.$chat.hasClass('focus') || this.$chat.hasClass('peek');
	}

	/** Scroll the log viewport to the newest message. */
	scrollToLatest() {
		const viewport = this.getViewport();
		if (!viewport) {
			return;
		}
		viewport.scrollTop = viewport.scrollHeight;
	}

	/** The scrolling element wrapping the log rows, if it is in the document. */
	private getViewport(): HTMLElement | null {
		const viewport = this.$content.parent()[0];
		return viewport instanceof HTMLElement ? viewport : null;
	}

	/**
	 * True when the player has scrolled the log back from the newest message.
	 *
	 * Measured against the viewport's own scrollable range rather than
	 * `#chatcontent`'s height: the rows are absolutely positioned at the bottom of
	 * the viewport, so the offset that shows the newest one is
	 * `scrollHeight - clientHeight`.
	 */
	isScrolledAwayFromLatest(): boolean {
		const viewport = this.getViewport();
		if (!viewport) {
			return false;
		}
		const distanceFromBottom = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop;
		return distanceFromBottom > SCROLL_BOTTOM_SLACK;
	}

	show() {
		this.$chat.addClass('focus');
		this.syncOpenState();
		this.scrollToLatest();
	}

	hide() {
		this.$chat.removeClass('focus');
		this.syncOpenState();
	}

	/**
	 * Collapse the log on the game's behalf rather than the player's.
	 *
	 * Yields to an explicit toggle: once the player has set the log's visibility
	 * themselves, an automatic collapse must not undo their click.
	 */
	autoHide() {
		if (this.userToggled) {
			return;
		}
		this.hide();
	}

	toggle() {
		this.userToggled = true;
		this.$chat.toggleClass('focus');
		this.$chat.removeClass('peek');
		this.syncOpenState();
		this.scrollToLatest();
		if (!this.isOpen) {
			this.hideExpanded();
		}
	}

	peekOpen() {
		if (!this.$chat.hasClass('focus')) {
			this.$chat.addClass('peek');
			this.syncOpenState();
			this.scrollToLatest();
		}
	}

	peekClose() {
		this.$chat.removeClass('peek');
		this.syncOpenState();
		this.hideExpanded();
	}

	showExpanded(creature: Creature) {
		if ((creature as HoverableCreature)?.hideUnitStatsOnHover) {
			return;
		}

		if (!creature || creature === this.currentExpandedCreature) {
			return;
		}
		this.isOverCreature = true;
		this.currentExpandedCreature = creature;
		this.isExpanded = true;

		const statsContent = this._createStatsContent(creature);
		const masteriesContent = this._createMasteriesContent(creature);

		const expandedHTML = `
				<div class="hover-panel-rows">
					<div class="hover-panel-row">${statsContent}</div>
					<div class="hover-panel-row">${masteriesContent}</div>
				</div>
			`;

		if (this.$expandedContent.children().length > 0) {
			const statValues = this.$expandedContent.find('.stat-value');
			statValues.stop().animate({ opacity: 0 }, 200, () => {
				this.$expandedContent.html(expandedHTML);
				this.$expandedContent.find('.stat-value').animate({ opacity: 1 }, 200);
			});
			this.$expandedContent.stop().animate({ opacity: 1 }, 200);
		} else {
			this.$expandedContent.html(expandedHTML);
			this.$expandedContent.css({ opacity: 0 }).animate({ opacity: 1 }, 300);
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
						? `${creature.remainingMove}/${creature.maxMovement}`
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

		// Read the player's scroll position before touching the DOM. Appending a
		// row grows the content past the viewport, so a check taken afterwards
		// cannot tell the player's own scroll apart from the line that just
		// arrived, and would mistake the newest message for a scroll-away.
		const followLatest = !this.isOpen || !this.isScrolledAwayFromLatest();

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

		// Follow the log to its newest line, unless the player is reading back
		// through it: snapping forward would throw away their place. A minimized
		// log has no scrollable viewport to read, so it always pins to the bottom.
		if (followLatest) {
			this.scrollToLatest();
		}
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
