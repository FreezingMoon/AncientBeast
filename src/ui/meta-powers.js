import * as $j from 'jquery';
import { Button, ButtonStateEnum } from './button';

/**
 * Exists outside of UI() class because the Meta Powers should be available outside
 * of a started game.
 */
export class MetaPowers {
	constructor(game) {
		this.game = game;

		this.state = {
			executingMonster: false,
		};

		this.$els = {
			modal: $j('#meta-powers'),
			closeModal: $j('#meta-powers .framed-modal__return .button'),
			executeMonsterButton: $j('#execute-monster-button'),
			resetCooldownsButton: $j('#reset-cooldowns-button'),
		};

		this.bindElements();
	}

	bindElements() {
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

	toggleModal() {
		this.$els.modal.toggleClass('hide');
	}

	toggleExecuteMonster() {
		const executingMonster = !this.state.executingMonster;

		this.state = {
			...this.state,
			executingMonster,
		};

		this.btnExecuteMonster.changeState(
			executingMonster ? ButtonStateEnum.active : ButtonStateEnum.normal,
		);

		this.game.signals.ui.dispatch('toggleExecuteMonster', executingMonster);
	}

	resetCooldowns() {
		// const unlimitedAbilityUses = !this.state.unlimitedAbilityUses;
		// this.state = {
		// 	...this.state,
		// 	unlimitedAbilityUses,
		// };
		// this.btnResetCooldowns.changeState(unlimitedAbilityUses ? 'glowing' : 'normal');
		// Trying a simpler non-event approach.
		// this.game.signals.ui.dispatch('toggleExecuteMonster', executeMonster);
	}
}
