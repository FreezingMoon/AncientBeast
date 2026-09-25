import $j from 'jquery';
import * as str from '../utility/string';
import { PRIMARY_STATS, MASTERY_STATS } from '../utility/const';
import { Creature } from '../creature';
import { Drop } from '../drop';
import { Trap } from '../utility/trap';
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

/** Key used so re-hovering same hex does not rebuild the panel every frame. */
type DropTrapPanelKey = string;

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
	/** When showing drop/trap widgets (not a creature), track key to avoid flicker. */
	currentDropTrapKey: DropTrapPanelKey | null = null;

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

		this.$expandedContent = $j('#unit-hover-panel');
		$j('#combatwrapper, #bottompanel, #dash, #endscreen').on('click', () => {
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
	_handleUiEvent(message: string, _payload) {
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
		this.$content.parent().scrollTop(this.$content.height());
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
		if ((creature as HoverableCreature)?.hideUnitStatsOnHover) {
			return;
		}

		if (!creature || creature === this.currentExpandedCreature) {
			return;
		}
		this.isOverCreature = true;
		this.currentDropTrapKey = null;
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

	/**
	 * Top hover widgets for drops/traps on a hex (issue #2206).
	 * Drop: modified stats with +/- and green/red.
	 * Trap: ability/trap name in player-colored frame + short description.
	 */
	showDropTrapPanel(drops: Drop[], traps: Trap[]) {
		if ((!drops || drops.length === 0) && (!traps || traps.length === 0)) {
			return;
		}

		const key = [
			...drops.map((d) => `d${d.id}`),
			...traps.map((t) => `t${t.id}`),
		]
			.sort()
			.join('|');

		if (key === this.currentDropTrapKey) {
			this.isOverCreature = true;
			return;
		}

		this.isOverCreature = true;
		this.currentExpandedCreature = null;
		this.currentDropTrapKey = key;
		this.isExpanded = true;

		const dropBlocks = drops.map((drop) => this._createDropPanelHtml(drop)).join('');
		const trapBlocks = traps.map((trap) => this._createTrapPanelHtml(trap)).join('');
		const expandedHTML = `
			<div class="hover-panel-rows drop-trap-hover-panel">
				${dropBlocks}
				${trapBlocks}
			</div>
		`;

		if (this.$expandedContent.children().length > 0) {
			this.$expandedContent.stop().animate({ opacity: 0 }, 120, () => {
				this.$expandedContent.html(expandedHTML);
				this.$expandedContent.animate({ opacity: 1 }, 180);
			});
		} else {
			this.$expandedContent.html(expandedHTML);
			this.$expandedContent.css({ opacity: 0 }).animate({ opacity: 1 }, 250);
		}
	}

	_createDropPanelHtml(drop: Drop): string {
		const alts = drop.alterations || {};
		const rows = Object.keys(alts)
			.filter((k) => typeof (alts as Record<string, number>)[k] === 'number')
			.map((stat) => {
				const n = (alts as Record<string, number>)[stat];
				const sign = n > 0 ? '+' : '';
				const color = n > 0 ? '#3dd68c' : n < 0 ? '#ff6b6b' : '#e8eefc';
				return `
					<div class="stat-item">
						<div class="icon ${stat}"></div>
						<div class="stat-value" style="color:${color}">${sign}${n}</div>
					</div>
				`;
			})
			.join('');

		return `
			<div class="hover-panel-row drop-hover-block">
				<div class="stat-item" style="width:100%;margin-bottom:4px">
					<strong style="color:#e8eefc">Drop: ${String(drop.name).replace(/[<>&]/g, '')}</strong>
				</div>
				${rows || '<div class="stat-value">—</div>'}
			</div>
		`;
	}

	_createTrapPanelHtml(trap: Trap): string {
		const team = trap.owner?.id ?? trap.ownerCreature?.team ?? 0;
		const title = trap.name || trap.type || 'Trap';
		// Prefer effect specials / names as the "card B" description slice.
		const effectBits = (trap.effects || [])
			.map((e) => {
				const anyE = e as { name?: string; special?: string; _logMsg?: string };
				return anyE.special || anyE.name || anyE._logMsg || '';
			})
			.filter(Boolean);
		const desc =
			effectBits.join(' · ') ||
			`Trap placed by player ${team + 1}` +
				(trap.ownerCreature ? ` (${trap.ownerCreature.name})` : '');

		const frameColor =
			team === 0 ? '#5b9dff' : team === 1 ? '#ff6b6b' : team === 2 ? '#3dd68c' : '#f0c14b';

		return `
			<div class="hover-panel-row trap-hover-block" style="border:2px solid ${frameColor};border-radius:8px;padding:6px 8px;margin:2px 0">
				<div class="stat-item" style="width:100%">
					<div class="icon ${trap.type || 'offense'}" title="${title}"></div>
					<div class="stat-value" style="color:${frameColor};font-weight:700">${title}</div>
				</div>
				<div style="color:#c5d0e6;font-size:0.85rem;margin-top:4px;max-width:42ch">${desc}</div>
			</div>
		`;
	}

	hideExpanded() {
		this.isOverCreature = false;
		setTimeout(() => {
			if (!this.isExpanded || this.isOverCreature) {
				return;
			}
			this.isExpanded = false;
			this.currentExpandedCreature = null;
			this.currentDropTrapKey = null;
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
