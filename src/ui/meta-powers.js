import * as $j from 'jquery';
import { Button, ButtonStateEnum } from './button';

/**
 * TBC
 */
export class MetaPowers {
	constructor(game) {
		this.game = game;

		this.state = {
			executeMonster: false,
		};

		this.$els = {
			modal: $j('#meta-powers'),
			closeModal: $j('#meta-powers .framed-modal__return .button'),
			executeMonsterButton: $j('#execute-monster-button'),
			resetCooldownsButton: $j('#reset-cooldowns-button'),
		};

		// Events
		this.game.signals.ui.add(this._handleUiEvent, this);

		// DOM bindings
		this._bindElements();
	}

	_handleUiEvent(message, payload) {
		if (message === 'toggleMetaPowers') {
			this.toggleModal();
		}

		if (message === 'closeInterfaceScreens') {
			this.closeModal();
		}
	}

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
				click: () => this.toggleExecuteMonster(),
			},
			this.game,
		);

		this.btnResetCooldowns = new Button(
			{
				$button: this.$els.resetCooldownsButton,
				click: () => this.resetCooldowns(),
			},
			this.game,
		);
	}

	/**
	 * Toggle the visibility of the Meta Powers modal.
	 *
	 */
	toggleModal() {
		this.$els.modal.toggleClass('hide');
	}

	/**
	 * Close the Meta Powers modal.
	 *
	 */
	closeModal() {
		this.$els.modal.addClass('hide');
	}

	/**
	 * Toggle the button state for the "Execution Mode" button, and dispatch an event.
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
	 * Dispatch a "reset cooldowns" event.
	 */
	resetCooldowns() {
		this.game.signals.metaPowers.dispatch('resetCooldowns');
	}
}
