import * as $j from 'jquery';
import { capitalize } from '../utility/string';
import { Button, ButtonStateEnum } from './button';

/**
 * "God-mode" UI for debugging game state. Available in hot-seat games when the
 * app running is in development mode.
 * Caution: usage of these tools may break the game log.
 */
export class MetaPowers {
	constructor(game) {
		this.game = game;

		this.toggles = {
			executeMonster: { enabled: false, label: 'Execution Mode' },
			resetCooldowns: { enabled: false, label: 'Disable Materialization Sickness' },
			disableMaterializationSickness: { enabled: false, label: 'Disable Cooldowns' },
		};

		this.$els = {
			modal: $j('#meta-powers'),
			closeModal: $j('#meta-powers .framed-modal__return .button'),
			powersList: $j('#meta-powers-list'),
			executeMonsterButton: $j('#execute-monster-button'),
			resetCooldownsButton: $j('#reset-cooldowns-button'),
			disableMaterializationSicknessButton: $j('#disable-materialization-sickness-button'),
		};

		// Events
		this.game.signals.ui.add(this._handleUiEvent, this);

		// DOM bindings
		this._bindElements();

		this._updatePowersList();
	}

	/**
	 * Handle events on the "ui" channel.
	 *
	 * @param {string} message Event name.
	 * @param {object} payload Event payload.
	 */
	_handleUiEvent(message, payload) {
		if (message === 'toggleMetaPowers') {
			this.toggleModal();
		}

		if (message === 'closeInterfaceScreens') {
			this.closeModal();
		}
	}

	/**
	 * One-time setup of DOM bindings and other DOM manipulation.
	 */
	_bindElements() {
		this.btnCloseModal = new Button(
			{
				$button: this.$els.closeModal,
				click: () => this.toggleModal(),
			},
			this.game,
		);

		this.btnExecuteMonster = new Button(
			{
				$button: this.$els.executeMonsterButton,
				hasShortcut: true,
				click: () => this._togglePower('executeMonster', this.btnExecuteMonster),
			},
			this.game,
		);

		this.btnResetCooldowns = new Button(
			{
				$button: this.$els.resetCooldownsButton,
				hasShortcut: true,
				click: () => this._togglePower('resetCooldowns', this.btnResetCooldowns),
			},
			this.game,
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
			this.game,
		);
	}

	/**
	 * Toggle the button state for a Meta Power and inform the rest of the app that
	 * setting has changed.
	 *
	 * @param {string} stateKey Key for `this.state` setting.
	 * @param {Button} button Button representing the toggle state.
	 */
	_togglePower(stateKey, button) {
		const enabled = !this.toggles[stateKey].enabled;

		this.toggles = {
			...this.toggles,
			[stateKey]: { ...this.toggles[stateKey], enabled },
		};

		button.changeState(enabled ? ButtonStateEnum.active : ButtonStateEnum.normal);

		this.game.signals.metaPowers.dispatch(`toggle${capitalize(stateKey)}`, enabled);

		this._updatePowersList();
	}

	/**
	 * Display a list of enabled powers outside of the modal for easy reference.
	 */
	_updatePowersList() {
		const list = Object.keys(this.toggles)
			.reduce((acc, curr) => {
				if (this.toggles[curr].enabled) {
					return [...acc, this.toggles[curr].label];
				}

				return acc;
			}, [])
			.join(', ');

		this.$els.powersList.html(list.length ? `Enabled Meta Powers: ${list}` : '');
	}

	/**
	 * Toggle the visibility of the Meta Powers modal.
	 */
	toggleModal() {
		this.$els.modal.toggleClass('hide');
	}

	/**
	 * Close the Meta Powers modal.
	 */
	closeModal() {
		this.$els.modal.addClass('hide');
	}
}
