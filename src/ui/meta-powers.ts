import * as $j from 'jquery';
import Cookies from 'js-cookie';
import { capitalize } from '../utility/string';
import { Button, ButtonStateEnum } from './button';
import Game, { MetaPowersState } from '../game';

const COOKIE_KEY = 'ab-meta-powers';

/**
 * "God-mode" UI for debugging game state
 * Available in hot-seat games when the app is in development mode
 *
 * Directly accessing instances of this class as they may not be present in some game modes
 *
 * Caution: usage of these tools may break the game log
 */

type defaultToggleObj = {
	enabled: boolean;
	label: string;
};

type MetaPowerStateKey = keyof MetaPowersState;
export class MetaPowers {
	game: Game;
	toggles: Record<MetaPowerStateKey, defaultToggleObj>;
	powerKeysInDisplayOrder: MetaPowerStateKey[];
	panelVisible: boolean;
	// eslint-disable-next-line no-undef
	$els: { [key: string]: JQuery<HTMLElement> } = {};
	btnCloseModal: Button;
	btnExecuteMonster: Button;
	btnResetCooldowns: Button;
	btnDisableMaterializationSickness: Button;
	btnInfiniteEnergy: Button;
	buttonIdToStateKey: Record<string, MetaPowerStateKey>;

	constructor(game: Game) {
		this.game = game;
		this.powerKeysInDisplayOrder = [];
		this.buttonIdToStateKey = {
			'execute-monster-button': 'executeMonster',
			'disable-materialization-sickness-button': 'disableMaterializationSickness',
			'reset-cooldowns-button': 'resetCooldowns',
			'infinite-energy-button': 'infiniteEnergy',
		};

		this.toggles = {
			executeMonster: {
				enabled: this.game.metaPowersState.executeMonster,
				label: 'Execution Mode',
			},
			disableMaterializationSickness: {
				enabled: this.game.metaPowersState.disableMaterializationSickness,
				label: 'Disable Materialization Sickness',
			},
			resetCooldowns: {
				enabled: this.game.metaPowersState.resetCooldowns,
				label: 'Disable Cooldowns',
			},
			infiniteEnergy: { enabled: this.game.metaPowersState.infiniteEnergy, label: 'Infinite Energy' },
		};

		// Object that will contain jQuery element references
		this.$els = {};
		this.panelVisible = false;
		this._bindElements();

		// Events
		this.game.signals.ui.add(this._handleUiEvent, this);

		if (Cookies.get(COOKIE_KEY)) {
			this._restorePowers();
		}

		this._updateEnabledPowersPreview();
	}

	/**
	 * Handle events on the "ui" channel
	 *
	 * @param {string} message Event name
	 * @param {object} payload Event payload
	 */
	_handleUiEvent(message: string, _payload: object) {
		if (message === 'toggleMetaPowers') {
			this._toggleModal();
		}

		if (message === 'toggleDash') {
			this._closeModal();
		}

		if (message === 'closeInterfaceScreens') {
			this._closeModal();
		}
	}

	/**
	 * One-time setup of DOM bindings and other DOM manipulation
	 */
	_bindElements() {
		this.$els = {
			modal: $j('#meta-powers'),
			closeModal: $j('#meta-powers-close-button'),
			resetPowersButton: $j('#reset-toggled-powers'),
			powersList: $j('#meta-powers-list'),
			executeMonsterButton: $j('#execute-monster-button'),
			resetCooldownsButton: $j('#reset-cooldowns-button'),
			disableMaterializationSicknessButton: $j('#disable-materialization-sickness-button'),
			infiniteEnergyButton: $j('#infinite-energy-button'),
		};

		this.panelVisible = !this.$els.modal.hasClass('hide');

		this.btnCloseModal = new Button(
			{
				$button: this.$els.closeModal,
				click: () => this._closeModal(),
			},
			{ isAcceptingInput: this.game.isAcceptingInput },
		);

		this.btnExecuteMonster = new Button(
			{
				$button: this.$els.executeMonsterButton,
				hasShortcut: true,
				click: () => this._togglePower('executeMonster', this.btnExecuteMonster),
			},
			{ isAcceptingInput: this.game.isAcceptingInput },
		);

		this.btnResetCooldowns = new Button(
			{
				$button: this.$els.resetCooldownsButton,
				hasShortcut: true,
				click: () => this._togglePower('resetCooldowns', this.btnResetCooldowns),
			},
			{ isAcceptingInput: this.game.isAcceptingInput },
		);

		this.btnDisableMaterializationSickness = new Button(
			{
				$button: this.$els.disableMaterializationSicknessButton,
				hasShortcut: true,
				click: () =>
					this._togglePower(
						'disableMaterializationSickness',
						this.btnDisableMaterializationSickness,
					),
			},
			{ isAcceptingInput: this.game.isAcceptingInput },
		);

		this.btnInfiniteEnergy = new Button(
			{
				$button: this.$els.infiniteEnergyButton,
				hasShortcut: true,
				click: () => this._togglePower('infiniteEnergy', this.btnInfiniteEnergy),
			},
			{ isAcceptingInput: this.game.isAcceptingInput },
		);

		this.$els.resetPowersButton.on('click', () => {
			this._clearPowers();
		});

		// Resolve power keys from visible button order so number hotkeys follow UI order.
		this.powerKeysInDisplayOrder = this.$els.modal
			.find('.meta-powers-actions .button[id]')
			.toArray()
			.map((el) => this.buttonIdToStateKey[(el as HTMLElement).id])
			.filter(Boolean) as MetaPowerStateKey[];
	}

	/**
	 * Toggle the button state for a Meta Power and inform the rest of the app that setting has changed
	 *
	 * @param {string} stateKey Key for `this.state` setting
	 * @param {Button} button Button representing the toggle state
	 */
	_setPowerState(stateKey: MetaPowerStateKey, enabled: boolean, button: Button) {
		this.game.metaPowersState[stateKey] = enabled;

		this.toggles = {
			...this.toggles,
			[stateKey]: { ...this.toggles[stateKey], enabled },
		};

		button.changeState(enabled ? ButtonStateEnum.active : ButtonStateEnum.normal);

		this.game.signals.metaPowers.dispatch(`toggle${capitalize(stateKey)}`, enabled);

		this._updateEnabledPowersPreview();
		this._persistPowers();
	}

	_togglePower(stateKey: MetaPowerStateKey, button: Button) {
		const enabled = !this.toggles[stateKey].enabled;
		this._setPowerState(stateKey, enabled, button);
	}

	/**
	 * Persist toggled Meta Powers to a cookie
	 */
	_persistPowers() {
		Cookies.set(
			COOKIE_KEY,
			JSON.stringify({
				persisting: true,
				toggles: this.toggles,
				panelVisible: this.panelVisible,
			}),
		);
	}

	/**
	 * If the toggled Meta Powers were persisted to a cookie, restore them
	 */
	_restorePowers() {
		let powers = null;
		let panelVisible = false;

		try {
			const cookieData = JSON.parse(Cookies.get(COOKIE_KEY));
			powers = cookieData?.toggles;
			panelVisible = !!cookieData?.panelVisible;
		} catch (error) {
			Cookies.remove(COOKIE_KEY);
			return;
		}

		(Object.keys(this.toggles) as MetaPowerStateKey[]).forEach((key) => {
			const enabled = !!powers?.[key]?.enabled;
			const button = this[`btn${capitalize(key)}`];
			this._setPowerState(key, enabled, button);
		});

		this.panelVisible = panelVisible;
		this.$els.modal.toggleClass('hide', !panelVisible);
		this._persistPowers();
	}

	/**
	 * Clear toggled Meta Powers and remove cookie
	 */
	_clearPowers() {
		(Object.keys(this.toggles) as MetaPowerStateKey[]).forEach((key) => {
			const button = this[`btn${capitalize(key)}`];
			this._setPowerState(key, false, button);
		});
	}

	/**
	 * Display a list of enabled powers outside of the modal for easy reference
	 */
	_updateEnabledPowersPreview() {
		this.$els.powersList.html('');
	}

	/**
	 * Toggle the visibility of the Meta Powers modal
	 */
	_toggleModal() {
		this.panelVisible = !this.panelVisible;
		this.$els.modal.toggleClass('hide', !this.panelVisible);
		this._persistPowers();
	}

	/**
	 * Close the Meta Powers modal
	 */
	_closeModal() {
		this.panelVisible = false;
		this.$els.modal.addClass('hide');
		this._persistPowers();
	}

	/**
	 * Enable a power by index (1-based) from the available powers
	 *
	 * @param {number} index Index of the power (1 = first power, 2 = second, etc.)
	 */
	enablePowerByIndex(index: number) {
		const powerKeys = this.powerKeysInDisplayOrder.length
			? this.powerKeysInDisplayOrder.slice(0, 9)
			: (Object.keys(this.toggles) as MetaPowerStateKey[]).slice(0, 9);
		if (index < 1 || index > powerKeys.length) {
			return;
		}

		const powerKey = powerKeys[index - 1];
		const button = this[`btn${capitalize(powerKey)}`];

		if (button) {
			const enabled = !this.toggles[powerKey].enabled;
			this._setPowerState(powerKey, enabled, button);
		}
	}
}
