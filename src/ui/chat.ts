import $j from 'jquery';
import * as str from '../utility/string';
import { VITALS, MASTERIES } from '../utility/const';
import { Creature } from '../creature';
import Game from '../game';
import type { Drop } from '../drop';
import type { Ability } from '../ability';
import { getUrl } from '../assets';
import { getPlayerColor } from '../player';

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

type HoverableCreature = Creature & {
	hideUnitStatsOnHover?: boolean;
	/** Ability that created this unit (e.g. an Acrylic Wall from Riot Shield). */
	sourceAbility?: Partial<Ability>;
};

/** A Bad Breath cloud, as recorded in `game.badBreathClouds` (vfx/bad-breath.ts). */
type HoverableCloud = {
	hex: { x: number; y: number };
	owner: Creature;
	sourceAbility?: Partial<Ability>;
};

function escapeHtml(text: string): string {
	return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

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

		this.messagesToSuppress = [];
		this.userToggled = false;

		// Listen for meta power changes to update glow effect
		this.game.channels.metaPowers.on('toggleExecuteMonster', () => this.updateMetaPowersEffect());
		this.game.channels.metaPowers.on('toggleResetCooldowns', () => this.updateMetaPowersEffect());
		this.game.channels.metaPowers.on('toggleDisableMaterializationSickness', () =>
			this.updateMetaPowersEffect(),
		);
		this.game.channels.metaPowers.on('toggleInfiniteEnergy', () => this.updateMetaPowersEffect());
		this.updateMetaPowersEffect();

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

	/**
	 * Check if any meta powers are currently enabled
	 */
	areMetaPowersEnabled(): boolean {
		if (!this.game || !this.game.metaPowersState) {
			return false;
		}
		const state = this.game.metaPowersState;
		return (
			state.executeMonster ||
			state.resetCooldowns ||
			state.disableMaterializationSickness ||
			state.infiniteEnergy
		);
	}

	/**
	 * Update meta powers glow effect on combat log
	 */
	updateMetaPowersEffect() {
		if (this.areMetaPowersEnabled()) {
			this.$chat.addClass('meta-powers-active');
		} else {
			this.$chat.removeClass('meta-powers-active');
		}
	}

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
		if (!creature || creature === this.currentExpandedCreature) {
			return;
		}

		// Traps and clouds under the unit get their own row below its stats (#2206)
		const extras = this._createHexExtras(creature.hexagons ?? []);
		const hoverable = creature as HoverableCreature;
		let rows: string[][];
		if (hoverable.hideUnitStatsOnHover) {
			// Units without stats on hover (e.g. Acrylic Walls) show the ability
			// that made them instead, when known.
			const widgets = [
				this._createAbilityContent(hoverable.sourceAbility, creature.player?.id),
				...extras,
			].filter(Boolean);
			if (widgets.length === 0) {
				return;
			}
			rows = [widgets];
		} else {
			rows = [[this._createStatsContent(creature), this._createMasteriesContent(creature)]];
			if (extras.length > 0) {
				rows.push(extras);
			}
		}

		this.isOverCreature = true;
		this.currentExpandedCreature = creature;
		this.isExpanded = true;

		const expandedHTML = this._createPanelHTML(rows);

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

	/**
	 * Hover panel for an empty hexagon holding a drop, traps or Bad Breath clouds
	 * (#2206). A drop shows the stats it changes as icons with signed, green or
	 * red values; traps and clouds show the ability that made them.
	 */
	showHexDetails(hex: { x: number; y: number }) {
		const drop = this.game.drops?.find(({ pos }) => pos.x === hex.x && pos.y === hex.y);
		const widgets = [
			drop ? this._createDropContent(drop) : '',
			...this._createHexExtras([hex]),
		].filter(Boolean);

		if (widgets.length === 0) {
			return;
		}

		this.currentExpandedCreature = null;
		this.isOverCreature = true;
		this.isExpanded = true;

		this.$expandedContent
			.stop()
			.html(this._createPanelHTML([widgets]))
			.css({ opacity: 0 })
			.animate({ opacity: 1 }, 200);
	}

	/** One `.hover-panel-rows` line per row of widgets. */
	_createPanelHTML(rows: string[][]) {
		this.$expandedContent.toggleClass('multi-row', rows.length > 1);
		return rows
			.map(
				(row) => `
				<div class="hover-panel-rows">
					${row.map((widget) => `<div class="hover-panel-row">${widget}</div>`).join('')}
				</div>
			`,
			)
			.join('');
	}

	/**
	 * Widgets for the traps and Bad Breath clouds on the given hexagons, one per
	 * ability (a multi-hex trap or a unit standing on several of them is shown once).
	 */
	_createHexExtras(points: { x: number; y: number }[]): string[] {
		const isAt = ({ x, y }: { x: number; y: number }) =>
			points.some((point) => point.x === x && point.y === y);
		const clouds =
			(this.game as unknown as { badBreathClouds?: HoverableCloud[] }).badBreathClouds ?? [];

		const widgets = [
			...(this.game.traps ?? [])
				.filter((trap) => isAt(trap))
				.map((trap) => this._createAbilityContent(trap.sourceAbility, trap.owner?.id)),
			...clouds
				.filter((cloud) => isAt(cloud.hex))
				.map((cloud) => this._createAbilityContent(cloud.sourceAbility, cloud.owner?.player?.id)),
		];
		return [...new Set(widgets.filter(Boolean))];
	}

	_createDropContent(drop: Drop) {
		return Object.entries(drop.alterations)
			.filter(([, value]) => typeof value === 'number' && value !== 0)
			.map(([stat, value]: [string, number]) => {
				const sign = value > 0 ? '+' : '-';
				const change = value > 0 ? 'gain' : 'loss';
				return `
					<div class="stat-item">
						<div class="icon ${stat}"></div>
						<div class="stat-value ${change}">${sign}${Math.abs(value)}</div>
					</div>
				`;
			})
			.join('');
	}

	/**
	 * The icon of `ability`, framed in the player's color, next to its description
	 * and info as worded on card B. Empty when the ability or its art is unknown.
	 */
	_createAbilityContent(ability: Partial<Ability> | undefined, playerId: number | undefined) {
		if (!ability?.creature || playerId === undefined) {
			return '';
		}

		let iconUrl: string;
		let frameUrl: string;
		try {
			iconUrl = getUrl(`units/abilities/${ability.creature.name} ${ability.id}`);
			frameUrl = getUrl(`interface/frame_${getPlayerColor(playerId as 0 | 1 | 2 | 3)}`);
		} catch {
			return '';
		}

		const lines = [ability.desc, ability.info]
			.filter(Boolean)
			.map((line) => `<div>${escapeHtml(line)}</div>`)
			.join('');

		return `
			<div class="trap-item">
				<div class="trap-icon" style="background-image: url('${frameUrl}'), url('${iconUrl}')"></div>
				<div class="trap-desc">${lines}</div>
			</div>
		`;
	}

	_createStatsContent(creature: Creature) {
		const stats = VITALS;
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
		const masteries = MASTERIES;
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
