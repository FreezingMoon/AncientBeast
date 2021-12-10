import * as $j from 'jquery';
import { Button, ButtonStateEnum } from './button';

/**
 * "God-mode" UI for debugging game state. Available in hot-seat games when the
 * app running is in development mode.
 * Caution: usage of these tools may break the game log.
 */
export class MetaPowers {
	constructor(game) {
		this.game = game;

		this.state = {
			executeMonster: false,
			disableMaterializationSickness: false,
		};

		this.$els = {
			modal: $j('#meta-powers'),
			closeModal: $j('#meta-powers .framed-modal__return .button'),
			executeMonsterButton: $j('#execute-monster-button'),
			resetCooldownsButton: $j('#reset-cooldowns-button'),
			disableMaterializationSicknessButton: $j('#disable-materialization-sickness-button'),
		};

		// Events
		this.game.signals.ui.add(this._handleUiEvent, this);

		// DOM bindings
		this._bindElements();
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
				click: () => this.toggleExecuteMonster(),
			},
			this.game,
		);

		this.btnResetCooldowns = new Button(
			{
				$button: this.$els.resetCooldownsButton,
				hasShortcut: true,
				click: () => this.resetCooldowns(),
			},
			this.game,
		);

		this.btnDisableMaterializationSickness = new Button(
			{
				$button: this.$els.disableMaterializationSicknessButton,
				hasShortcut: true,
				click: () => this.toggleDisableMaterializationSickness(),
			},
			this.game,
		);
	}

	getState(stateKey) {
		if (!this.state[stateKey]) {
			console.warn(`Meta Powers state does not exist for key: ${stateKey}`);
		}

		return this.state[stateKey];
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

	/**
	 * Toggle the button state for the "Execution Mode" button, and inform the rest
	 * of the app that execution mode is enabled.
	 */
	toggleExecuteMonster() {
		const executeMonster = !this.state.executeMonster;

		this.state = {
			...this.state,
			executeMonster,
		};

		this.btnExecuteMonster.changeState(
			executeMonster ? ButtonStateEnum.active : ButtonStateEnum.normal,
		);

		this.game.signals.metaPowers.dispatch('toggleExecuteMonster', executeMonster);
	}

	/**
	 * Toggle the button state for the "Disable Materialization Sickness" button,
	 * and inform the rest of the app that feature is enabled/disabled.
	 */
	toggleDisableMaterializationSickness() {
		const disableMaterializationSickness = !this.state.disableMaterializationSickness;

		this.state = {
			...this.state,
			disableMaterializationSickness,
		};

		this.btnDisableMaterializationSickness.changeState(
			disableMaterializationSickness ? ButtonStateEnum.active : ButtonStateEnum.normal,
		);

		this.game.signals.metaPowers.dispatch(
			'toggleDisableMaterializationSickness',
			disableMaterializationSickness,
		);
	}

	/**
	 * Inform the rest of the app that cooldowns should be reset.
	 */
	resetCooldowns() {
		this.game.signals.metaPowers.dispatch('resetCooldowns');
	}
}
